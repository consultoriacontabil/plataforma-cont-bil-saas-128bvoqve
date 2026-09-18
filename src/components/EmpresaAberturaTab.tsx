import React, { useState, useEffect } from 'react'
import {
  Building2,
  FileText,
  Users,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Save,
  RotateCcw,
  Sparkles,
  GitCommit,
  Scale,
  Send,
  Loader2,
  Layers,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react'
import type {
  Empresa,
  CompanyFormationRecord,
  NaturezaJuridicaTipo,
  SocioAberturaItem,
  CnaesAberturaConfig,
  EtapaPipelineItem,
  ChecklistDocItem,
  EmpresaPorte,
} from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { companyFormationService } from '@/services/companyFormation'
import {
  NATUREZAS_JURIDICAS,
  gerarTemplateEtapas,
  gerarTemplateChecklist,
} from '@/lib/companyFormationLegal'
import { FormationSociosTable } from './FormationSociosTable'
import { FormationCnaesSection } from './FormationCnaesSection'
import { FormationDocumentosChecklist } from './FormationDocumentosChecklist'
import { FormationPipeline } from './FormationPipeline'
import { FormationBaseLegalPanel } from './FormationBaseLegalPanel'
import { CheckPassosAbertura } from '@/components/CheckPassosAbertura'
import { GerarLinkPublicoModal } from '@/components/GerarLinkPublicoModal'
import { NovoWorkflowAberturaModal } from '@/components/NovoWorkflowAberturaModal'
import { companyOnboardingService } from '@/services/companyOnboarding'
import type { CompanyOnboardingWorkflowRecord } from '@/types'
import { Share2, PlusCircle, ExternalLink } from 'lucide-react'
import { maskCnpj } from '@/lib/formatters'

interface EmpresaAberturaTabProps {
  empresa: Empresa
  tenantId: string
  usuarioId: string
  userRole?: string
  canEdit: boolean
  onEmpresaAtualizada: () => void
}

export const EmpresaAberturaTab: React.FC<EmpresaAberturaTabProps> = ({
  empresa,
  tenantId,
  usuarioId,
  canEdit,
  onEmpresaAtualizada,
}) => {
  const { toast } = useToast()

  const [formation, setFormation] = useState<CompanyFormationRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeSubTab, setActiveSubTab] = useState('societario')

  // Modais de Ações de Conclusão / Integração
  const [showIntegrarFiscalModal, setShowIntegrarFiscalModal] = useState(false)
  const [integratingFiscal, setIntegratingFiscal] = useState(false)
  const [cnpjIntegracao, setCnpjIntegracao] = useState(empresa.cnpj || '')
  const [ieIntegracao, setIeIntegracao] = useState(empresa.inscricao_estadual || '')
  const [imIntegracao, setImIntegracao] = useState(empresa.inscricao_municipal || '')
  const [dataAberturaIntegracao, setDataAberturaIntegracao] = useState(
    empresa.data_abertura || new Date().toISOString().slice(0, 10),
  )

  const [showObrigacoesModal, setShowObrigacoesModal] = useState(false)
  const [criandoObrigacoes, setCriandoObrigacoes] = useState(false)

  // Workflows vinculados a esta empresa
  const [modalLinkOpen, setModalLinkOpen] = useState(false)
  const [modalNovoWorkflowOpen, setModalNovoWorkflowOpen] = useState(false)
  const [activeWorkflow, setActiveWorkflow] = useState<CompanyOnboardingWorkflowRecord | null>(null)
  const [empresaWorkflows, setEmpresaWorkflows] = useState<CompanyOnboardingWorkflowRecord[]>([])

  const carregarWorkflowsEmpresa = async () => {
    if (!empresa?.id || !tenantId) return
    try {
      const list = await companyOnboardingService.list(tenantId)
      const vinculados = list.filter((w) => w.empresa_id === empresa.id)
      setEmpresaWorkflows(vinculados)
      if (vinculados.length > 0) {
        setActiveWorkflow((prev) => {
          if (!prev) return vinculados[0]
          return vinculados.find((w) => w.id === prev.id) || vinculados[0]
        })
      } else {
        setActiveWorkflow(null)
      }
    } catch (err) {
      console.error('Erro ao buscar workflows de onboarding da empresa:', err)
    }
  }

  useEffect(() => {
    let isMounted = true
    carregarWorkflowsEmpresa()
    return () => {
      isMounted = false
    }
  }, [empresa?.id, tenantId])

  // Carrega o processo de abertura
  const carregarProcesso = async () => {
    try {
      setLoading(true)
      const record = await companyFormationService.getByEmpresa(empresa.id)
      setFormation(record)
    } catch (err) {
      console.error('Erro ao buscar processo de abertura:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarProcesso()
  }, [empresa.id])

  // Iniciar Processo se não existir
  const handleIniciarProcesso = async (natureza: NaturezaJuridicaTipo = 'slu') => {
    try {
      setSaving(true)
      const record = await companyFormationService.iniciarProcesso(
        empresa,
        {
          tenant_id: tenantId,
          empresa: empresa.id,
          natureza_juridica: natureza,
          porte_pretendido: empresa.porte || 'me',
          regime_pretendido:
            empresa.regime_tributario === 'mei'
              ? 'simei'
              : empresa.regime_tributario || 'simples_nacional',
          capital_social_total: 10000,
          quotas_total: 10000,
          valor_nominal_quota: 1,
          socios_json: [
            {
              id: 'socio_titular',
              tipo_pessoa: 'PF',
              nome_razao: empresa.nome_fantasia || empresa.razao_social,
              cpf_cnpj: '',
              percentual_cotas: 100,
              quantidade_cotas: 10000,
              valor_participacao: 10000,
              data_entrada: new Date().toISOString().slice(0, 10),
              pais_residencia: 'Brasil',
              residente_exterior: false,
              cargo_funcao: 'Sócio-Administrador',
              qualificacao: '49 - Sócio-Administrador',
              pro_labore: true,
            },
          ],
          cnaes_json: {
            principal: {
              codigo: '6201-5/01',
              descricao: 'Desenvolvimento de programas de computador sob encomenda',
            },
            secundarios: [],
          },
        },
        usuarioId,
      )
      setFormation(record)
      toast({
        title: 'Processo de Abertura Iniciado',
        description: 'Fluxo, checklist e fundamentação legal carregados com sucesso.',
      })
    } catch (err) {
      console.error('Erro ao iniciar processo:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao iniciar processo',
        description: 'Não foi possível registrar a abertura.',
      })
    } finally {
      setSaving(false)
    }
  }

  // Salvar alterações
  const handleSalvarAlteracoes = async () => {
    if (!formation) return
    try {
      setSaving(true)
      const updated = await companyFormationService.update(
        formation.id,
        {
          natureza_juridica: formation.natureza_juridica,
          porte_pretendido: formation.porte_pretendido,
          regime_pretendido: formation.regime_pretendido,
          status_processo: formation.status_processo,
          capital_social_total: formation.capital_social_total,
          quotas_total: formation.quotas_total,
          valor_nominal_quota: formation.valor_nominal_quota,
          socios_json: formation.socios_json,
          cnaes_json: formation.cnaes_json,
          etapas_json: formation.etapas_json,
          documentos_checklist_json: formation.documentos_checklist_json,
          observacoes: formation.observacoes,
        },
        usuarioId,
        tenantId,
        `Atualizou ficha de abertura da empresa ${empresa.razao_social}`,
      )
      setFormation(updated)
      toast({
        title: 'Alterações Salvas',
        description: 'O processo de abertura foi atualizado com sucesso.',
      })
    } catch (err) {
      console.error('Erro ao salvar alterações:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Não foi possível persistir os dados.',
      })
    } finally {
      setSaving(false)
    }
  }

  // Ações no Check dos Passos da Abertura
  const handleToggleItemPasso = async (
    itemId: string,
    marcado: boolean,
    dadosAuxiliares?: {
      protocolo_viabilidade?: string
      nire?: string
      data_efetivacao_cnpj?: string
      observacao?: string
    },
  ) => {
    if (!formation || !canEdit) return
    const updated = await companyFormationService.alternarItemPasso(
      formation.id,
      itemId,
      marcado,
      usuarioId,
      'Contador / Responsável',
      tenantId,
      dadosAuxiliares,
    )
    setFormation(updated)
  }

  const handleSalvarCamposAuxiliaresPasso = async (
    itemId: string,
    campos: {
      protocolo_viabilidade?: string
      nire?: string
      data_efetivacao_cnpj?: string
      observacao?: string
    },
  ) => {
    if (!formation || !canEdit) return
    const updated = await companyFormationService.salvarCamposAuxiliaresPasso(
      formation.id,
      itemId,
      campos,
      usuarioId,
      'Contador / Responsável',
      tenantId,
    )
    setFormation(updated)
  }

  // Mudança da Natureza Jurídica
  const handleTrocaNaturezaJuridica = (novaNatureza: NaturezaJuridicaTipo) => {
    if (!formation) return
    const temEstrangeiro = (formation.socios_json || []).some((s) => s.residente_exterior)
    const novoChecklist = gerarTemplateChecklist(novaNatureza, temEstrangeiro)

    setFormation({
      ...formation,
      natureza_juridica: novaNatureza,
      documentos_checklist_json: novoChecklist,
    })
    toast({
      title: 'Tipo Societário Alterado',
      description: `O checklist de documentos foi recalculado para ${novaNatureza.toUpperCase()}.`,
    })
  }

  // Executar Integração Fiscal
  const handleConfirmarIntegracaoFiscal = async () => {
    if (!formation) return
    try {
      setIntegratingFiscal(true)
      await companyFormationService.gerarDadosFiscais(formation, empresa, usuarioId, {
        cnpj: cnpjIntegracao,
        inscricaoEstadual: ieIntegracao,
        inscricaoMunicipal: imIntegracao,
        dataAbertura: dataAberturaIntegracao,
        porte: formation.porte_pretendido || 'me',
        regimeTributario:
          formation.regime_pretendido === 'simei'
            ? 'mei'
            : (formation.regime_pretendido as Empresa['regime_tributario']) || 'simples_nacional',
      })
      toast({
        title: 'Dados Fiscais Integrados',
        description: 'O cadastro oficial da empresa foi atualizado com as informações da abertura.',
      })
      setShowIntegrarFiscalModal(false)
      onEmpresaAtualizada()
      carregarProcesso()
    } catch (err) {
      console.error('Erro na integração fiscal:', err)
      toast({
        variant: 'destructive',
        title: 'Falha na integração',
        description: 'Não foi possível atualizar o cadastro fiscal.',
      })
    } finally {
      setIntegratingFiscal(false)
    }
  }

  // Criar Obrigações de Implantação
  const handleCriarObrigacoes = async () => {
    if (!formation) return
    try {
      setCriandoObrigacoes(true)
      const res = await companyFormationService.criarObrigacoesImplantacao(
        empresa,
        formation,
        usuarioId,
      )
      toast({
        title: 'Obrigações de Implantação Geradas',
        description: `${res.totalCriadas} obrigações criadas com sucesso (DAS, DCTFWeb, EFD, Homologação).`,
      })
      setShowObrigacoesModal(false)
    } catch (err) {
      console.error('Erro ao gerar obrigações:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar obrigações',
        description: 'Não foi possível criar as obrigações de início de atividade.',
      })
    } finally {
      setCriandoObrigacoes(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#0FA3A3]" />
      </div>
    )
  }

  // Estado Inicial: Ainda não possui dados de abertura
  if (!formation) {
    return (
      <Card className="rounded-2xl border-[#E2E8F0] shadow-xs text-center p-8 space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-[#0FA3A3]">
          <Building2 className="h-7 w-7" />
        </div>
        <div className="max-w-md mx-auto space-y-2">
          <h3 className="text-base font-bold text-[#1A2333]">Nenhum Processo de Abertura Ativo</h3>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Inicie o fluxo completo de constituição e legalização empresarial no Brasil com
            fundamentação legal atualizada (Lei 13.874/19, LC 123/06, Lei 14.195/21 e DREI).
          </p>
        </div>

        {canEdit ? (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              onClick={() => handleIniciarProcesso('slu')}
              disabled={saving}
              className="rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs font-semibold h-10 gap-2 px-5"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              <span>Iniciar Processo de Abertura (SLU - Recomendado)</span>
            </Button>
            <Button
              onClick={() => handleIniciarProcesso('ltda')}
              disabled={saving}
              variant="outline"
              className="rounded-xl text-xs font-semibold h-10 gap-2 border-slate-200"
            >
              <Users className="h-4 w-4 text-slate-600" />
              <span>Iniciar Abertura com Múltiplos Sócios (LTDA)</span>
            </Button>
          </div>
        ) : (
          <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl max-w-sm mx-auto">
            Apenas usuários com perfil de Contador ou Administrador podem iniciar novos processos de
            abertura.
          </p>
        )}
      </Card>
    )
  }

  const naturezaAtualInfo = NATUREZAS_JURIDICAS[formation.natureza_juridica]

  return (
    <div className="space-y-6">
      {/* Top Banner de Resumo e Ações */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-xs bg-linear-to-r from-slate-50 via-white to-teal-50/20">
        <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-[#0FA3A3] text-white text-xs font-bold uppercase">
                {naturezaAtualInfo.sigla}
              </Badge>
              <h3 className="text-base font-bold text-[#1A2333]">{naturezaAtualInfo.nome}</h3>
              <Badge
                className={
                  formation.status_processo === 'registrado_concluido'
                    ? 'bg-emerald-100 text-emerald-800'
                    : formation.status_processo === 'protocolado_junta'
                      ? 'bg-blue-100 text-blue-800'
                      : formation.status_processo === 'pendencia_documental'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-800'
                }
              >
                {formation.status_processo.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
            <p className="text-xs text-[#64748B] max-w-2xl leading-relaxed">
              {naturezaAtualInfo.fundamentoLegal}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {empresaWorkflows.length > 1 && (
              <Select
                value={activeWorkflow?.id || ''}
                onValueChange={(val) => {
                  const match = empresaWorkflows.find((w) => w.id === val)
                  if (match) setActiveWorkflow(match)
                }}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0] min-w-[160px] bg-white">
                  <SelectValue placeholder="Selecione o workflow" />
                </SelectTrigger>
                <SelectContent>
                  {empresaWorkflows.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.titulo || w.razao_social_pretendida || 'Processo'} (
                      {w.status.replace('_', ' ')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {activeWorkflow && (
              <Button
                type="button"
                onClick={() => setModalLinkOpen(true)}
                className="rounded-xl bg-gradient-to-r from-[#0B1F3A] to-[#1E3A8A] hover:opacity-95 text-white text-xs font-semibold h-9 px-3.5 gap-2 shadow-xs"
              >
                <Share2 className="h-4 w-4 text-[#0FA3A3]" />
                <span>Link do Cliente ({activeWorkflow.link_ativo ? 'Ativo' : 'Inativo'})</span>
              </Button>
            )}

            {canEdit && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalNovoWorkflowOpen(true)}
                className="rounded-xl border-[#0FA3A3] text-teal-800 hover:bg-teal-50 text-xs font-semibold h-9 px-3.5 gap-2 shadow-2xs"
              >
                <PlusCircle className="h-4 w-4 text-[#0FA3A3]" />
                <span>
                  {empresaWorkflows.length > 0
                    ? 'Novo Workflow Simultâneo'
                    : 'Gerar Link para Cliente'}
                </span>
              </Button>
            )}

            {canEdit && (
              <Button
                onClick={handleSalvarAlteracoes}
                disabled={saving}
                className="rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs font-semibold h-9 gap-1.5 shadow-xs"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                <span>Salvar Processo</span>
              </Button>
            )}

            {/* Ações de Conclusão / Integração */}
            {canEdit && (
              <>
                <Button
                  onClick={() => setShowIntegrarFiscalModal(true)}
                  variant="outline"
                  className="rounded-xl text-xs font-semibold h-9 gap-1.5 border-teal-300 text-[#0FA3A3] hover:bg-teal-50"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  <span>Gerar Dados Fiscais da Empresa</span>
                </Button>

                <Button
                  onClick={() => setShowObrigacoesModal(true)}
                  variant="outline"
                  className="rounded-xl text-xs font-semibold h-9 gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  <Layers className="h-3.5 w-3.5 text-blue-600" />
                  <span>Criar Obrigações de Implantação</span>
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sub-abas de Abertura */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="space-y-5">
        <TabsList className="bg-slate-100 p-1 rounded-xl h-10 w-full justify-start overflow-x-auto">
          <TabsTrigger value="societario" className="rounded-lg text-xs font-semibold gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            <span>1. Natureza & Capital</span>
          </TabsTrigger>
          <TabsTrigger value="socios" className="rounded-lg text-xs font-semibold gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span>2. Quadro de Sócios ({formation.socios_json?.length || 0})</span>
          </TabsTrigger>
          <TabsTrigger value="cnaes" className="rounded-lg text-xs font-semibold gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            <span>3. Atividades & Órgãos de Classe</span>
          </TabsTrigger>
          <TabsTrigger value="checklist" className="rounded-lg text-xs font-semibold gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>4. Checklist Documental & GED</span>
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="rounded-lg text-xs font-semibold gap-1.5">
            <GitCommit className="h-3.5 w-3.5" />
            <span>5. Pipeline de Etapas</span>
          </TabsTrigger>
          <TabsTrigger value="base_legal" className="rounded-lg text-xs font-semibold gap-1.5">
            <Scale className="h-3.5 w-3.5" />
            <span>6. Base Legal & Parecer</span>
          </TabsTrigger>
        </TabsList>

        {/* SUB-ABA 1: Natureza & Capital */}
        <TabsContent value="societario" className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Seletor de Natureza Jurídica */}
            <Card className="rounded-2xl border-[#E2E8F0] shadow-xs md:col-span-2">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-[#1A2333]">
                  Seletor de Tipo Societário & Natureza Jurídica
                </CardTitle>
                <p className="text-xs text-[#64748B]">
                  Ao alterar a natureza jurídica, os requisitos de documentos e regras se adaptam
                  automaticamente.
                </p>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs">
                <div>
                  <Label className="text-xs font-semibold text-[#1A2333]">
                    Tipo Societário Selecionado
                  </Label>
                  {canEdit ? (
                    <Select
                      value={formation.natureza_juridica}
                      onValueChange={(val) =>
                        handleTrocaNaturezaJuridica(val as NaturezaJuridicaTipo)
                      }
                    >
                      <SelectTrigger className="h-10 text-xs rounded-xl mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="slu">
                          SLU - Sociedade Limitada Unipessoal (Recomendada)
                        </SelectItem>
                        <SelectItem value="ltda">
                          LTDA - Sociedade Empresária Limitada (2+ sócios)
                        </SelectItem>
                        <SelectItem value="mei">
                          MEI - Microempreendedor Individual (Teto R$ 81k)
                        </SelectItem>
                        <SelectItem value="ei">
                          EI - Empresário Individual (Sem separação de bens)
                        </SelectItem>
                        <SelectItem value="eireli_extinta">
                          EIRELI (Extinta pela Lei 14.195/2021)
                        </SelectItem>
                        <SelectItem value="sociedade_simples_ltda">
                          Sociedade Simples LTDA (RCPJ)
                        </SelectItem>
                        <SelectItem value="sociedade_simples_pura">
                          Sociedade Simples Pura (RCPJ)
                        </SelectItem>
                        <SelectItem value="sa_fechada">
                          S/A de Capital Fechado (Lei 6.404/76)
                        </SelectItem>
                        <SelectItem value="sa_aberta">S/A de Capital Aberto (Bolsa/CVM)</SelectItem>
                        <SelectItem value="associacao">
                          Associação Privada (Sem fins lucrativos)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-semibold text-[#1A2333] mt-1 text-sm">
                      {naturezaAtualInfo.nome}
                    </p>
                  )}
                </div>

                {/* Ficha Explicativa do Tipo Societário */}
                <div className="rounded-xl border border-teal-200 bg-teal-50/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-teal-950 text-xs">
                      Ficha Técnica: {naturezaAtualInfo.nome}
                    </span>
                    <Badge variant="outline" className="border-teal-300 text-teal-800 text-[10px]">
                      Registro: {naturezaAtualInfo.orgaoRegistroPrincipal}
                    </Badge>
                  </div>
                  <p className="text-[#64748B] text-xs leading-relaxed">
                    {naturezaAtualInfo.descricao}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-teal-100">
                    <div>
                      <span className="text-[#64748B] text-[10px]">Responsabilidade:</span>
                      <p className="font-semibold text-teal-900">
                        {naturezaAtualInfo.responsabilidadeLimitada
                          ? 'Limitada ao Capital'
                          : 'Ilimitada (risco)'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[#64748B] text-[10px]">Mínimo de Sócios:</span>
                      <p className="font-semibold text-teal-900">
                        {naturezaAtualInfo.sociosMinimos}{' '}
                        {naturezaAtualInfo.sociosMaximos
                          ? `(máx ${naturezaAtualInfo.sociosMaximos})`
                          : 'ou mais'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[#64748B] text-[10px]">Simples Nacional:</span>
                      <p className="font-semibold text-teal-900">
                        {naturezaAtualInfo.permiteSimples ? 'Permitido' : 'Vedado por lei'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[#64748B] text-[10px]">SIMEI:</span>
                      <p className="font-semibold text-teal-900">
                        {naturezaAtualInfo.permiteSimei ? 'Permitido' : 'Não aplicável'}
                      </p>
                    </div>
                  </div>

                  {naturezaAtualInfo.alertaLegal && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-amber-900 text-[11px] leading-relaxed">
                      <b>Aviso Legal Obrigatório:</b> {naturezaAtualInfo.alertaLegal}
                    </div>
                  )}
                </div>

                {/* Porte e Regime Pretendidos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <Label className="text-xs">Porte Pretendido</Label>
                    {canEdit ? (
                      <Select
                        value={formation.porte_pretendido || 'me'}
                        onValueChange={(val) =>
                          setFormation({ ...formation, porte_pretendido: val as EmpresaPorte })
                        }
                      >
                        <SelectTrigger className="h-9 text-xs rounded-xl mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mei">MEI (Até R$ 81 mil/ano)</SelectItem>
                          <SelectItem value="me">Microempresa - ME (Até R$ 360 mil/ano)</SelectItem>
                          <SelectItem value="epp">
                            Empresa de Pequeno Porte - EPP (Até R$ 4,8 milhões/ano)
                          </SelectItem>
                          <SelectItem value="demais">
                            Demais portes (Acima de R$ 4,8 milhões/ano)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="font-semibold text-[#1A2333] mt-1 uppercase">
                        {formation.porte_pretendido || 'ME'}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs">Regime Tributário Pretendido</Label>
                    {canEdit ? (
                      <Select
                        value={formation.regime_pretendido || 'simples_nacional'}
                        onValueChange={(val) =>
                          setFormation({
                            ...formation,
                            regime_pretendido: val as CompanyFormationRecord['regime_pretendido'],
                          })
                        }
                      >
                        <SelectTrigger className="h-9 text-xs rounded-xl mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="simples_nacional">
                            Simples Nacional (LC 123/2006)
                          </SelectItem>
                          <SelectItem value="simei">SIMEI (Regime MEI)</SelectItem>
                          <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                          <SelectItem value="lucro_real">Lucro Real</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="font-semibold text-[#1A2333] mt-1 capitalize">
                        {formation.regime_pretendido?.replace('_', ' ') || 'Simples Nacional'}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card de Capital Social */}
            <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-[#1A2333]">
                  Capital Social & Quotas
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3.5 text-xs">
                <div>
                  <Label className="text-xs">Capital Social Total (R$)</Label>
                  {canEdit ? (
                    <Input
                      type="number"
                      min="0"
                      step="100"
                      value={formation.capital_social_total || 0}
                      onChange={(e) => {
                        const total = parseFloat(e.target.value) || 0
                        const nominal = formation.valor_nominal_quota || 1
                        setFormation({
                          ...formation,
                          capital_social_total: total,
                          quotas_total: nominal > 0 ? Math.round(total / nominal) : total,
                        })
                      }}
                      className="h-9 text-xs rounded-xl mt-1 font-semibold"
                    />
                  ) : (
                    <p className="text-sm font-bold text-[#1A2333] mt-1">
                      R${' '}
                      {Number(formation.capital_social_total || 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px] text-[#64748B]">Total de Quotas</Label>
                    {canEdit ? (
                      <Input
                        type="number"
                        min="1"
                        value={formation.quotas_total || 0}
                        onChange={(e) =>
                          setFormation({
                            ...formation,
                            quotas_total: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="h-8 text-xs rounded-xl mt-0.5"
                      />
                    ) : (
                      <p className="font-semibold text-[#1A2333] mt-0.5">
                        {formation.quotas_total || 0}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-[11px] text-[#64748B]">Valor Nominal (R$)</Label>
                    {canEdit ? (
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={formation.valor_nominal_quota || 1}
                        onChange={(e) =>
                          setFormation({
                            ...formation,
                            valor_nominal_quota: parseFloat(e.target.value) || 1,
                          })
                        }
                        className="h-8 text-xs rounded-xl mt-0.5"
                      />
                    ) : (
                      <p className="font-semibold text-[#1A2333] mt-0.5">
                        R$ {Number(formation.valor_nominal_quota || 1).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-[#64748B] space-y-1">
                  <p className="font-semibold text-[#1A2333]">Regra de Capital Mínimo:</p>
                  <p>{naturezaAtualInfo.capitalSocialMinimoTexto}</p>
                </div>

                <div>
                  <Label className="text-xs">Status do Processo</Label>
                  {canEdit ? (
                    <Select
                      value={formation.status_processo}
                      onValueChange={(val) =>
                        setFormation({
                          ...formation,
                          status_processo: val as CompanyFormationRecord['status_processo'],
                        })
                      }
                    >
                      <SelectTrigger className="h-9 text-xs rounded-xl mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nao_iniciado">Não Iniciado</SelectItem>
                        <SelectItem value="em_andamento">Em Andamento</SelectItem>
                        <SelectItem value="pendencia_documental">Pendência Documental</SelectItem>
                        <SelectItem value="protocolado_junta">
                          Protocolado na Junta Comercial
                        </SelectItem>
                        <SelectItem value="registrado_concluido">Registrado / Concluído</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-semibold text-[#1A2333] mt-1 capitalize">
                      {formation.status_processo.replace('_', ' ')}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* SUB-ABA 2: Quadro de Sócios */}
        <TabsContent value="socios">
          <FormationSociosTable
            socios={formation.socios_json || []}
            canEdit={canEdit}
            capitalSocialTotal={formation.capital_social_total || 0}
            naturezaJuridica={formation.natureza_juridica}
            onSociosChange={(novosSocios, totalCalculado) => {
              setFormation({
                ...formation,
                socios_json: novosSocios,
                capital_social_total: totalCalculado,
              })
            }}
          />
        </TabsContent>

        {/* SUB-ABA 3: CNAEs e Atividades */}
        <TabsContent value="cnaes">
          <FormationCnaesSection
            cnaes={
              formation.cnaes_json || {
                principal: { codigo: '', descricao: '' },
                secundarios: [],
              }
            }
            naturezaJuridica={formation.natureza_juridica}
            canEdit={canEdit}
            onChange={(novosCnaes) => {
              setFormation({
                ...formation,
                cnaes_json: novosCnaes,
              })
            }}
          />
        </TabsContent>

        {/* SUB-ABA 4: Checklist Documental & GED */}
        <TabsContent value="checklist">
          <FormationDocumentosChecklist
            checklist={formation.documentos_checklist_json || []}
            canEdit={canEdit}
            empresaId={empresa.id}
            tenantId={tenantId}
            usuarioId={usuarioId}
            onChange={(novoChecklist) => {
              setFormation({
                ...formation,
                documentos_checklist_json: novoChecklist,
              })
            }}
          />
        </TabsContent>

        {/* SUB-ABA 5: Pipeline de Etapas & Check dos Passos */}
        <TabsContent value="pipeline" className="space-y-6">
          <CheckPassosAbertura
            itens={formation.checklist_passos_json}
            podeEditar={canEdit}
            usuarioAtual={{
              id: usuarioId,
              nome: 'Responsável',
            }}
            tenantId={tenantId}
            workflowId={formation.id}
            contexto="empresa_aba"
            onToggleItem={handleToggleItemPasso}
            onSalvarCamposAuxiliares={handleSalvarCamposAuxiliaresPasso}
          />

          <FormationPipeline
            etapas={formation.etapas_json || []}
            canEdit={canEdit}
            onChange={(novasEtapas) => {
              setFormation({
                ...formation,
                etapas_json: novasEtapas,
              })
            }}
          />
        </TabsContent>

        {/* SUB-ABA 6: Base Legal */}
        <TabsContent value="base_legal">
          <FormationBaseLegalPanel />
        </TabsContent>
      </Tabs>

      {/* Modal: Gerar Dados Fiscais da Empresa */}
      <Dialog open={showIntegrarFiscalModal} onOpenChange={setShowIntegrarFiscalModal}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base text-[#1A2333] flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#0FA3A3]" />
              <span>Gerar Dados Fiscais da Empresa</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Atualize a ficha oficial da empresa com as inscrições fiscais deferidas pela Junta
              Comercial e Receita Federal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs">CNPJ Homologado</Label>
              <Input
                value={cnpjIntegracao}
                onChange={(e) => setCnpjIntegracao(maskCnpj(e.target.value))}
                placeholder="00.000.000/0000-00"
                className="mt-1 h-9 rounded-xl font-mono text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">Inscrição Municipal (IM / CCM)</Label>
              <Input
                value={imIntegracao}
                onChange={(e) => setImIntegracao(e.target.value)}
                placeholder="Ex.: 9921448-1"
                className="mt-1 h-9 rounded-xl text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">Inscrição Estadual (se aplicável / Comércio)</Label>
              <Input
                value={ieIntegracao}
                onChange={(e) => setIeIntegracao(e.target.value)}
                placeholder="Ex.: 90812498-11 ou Isento"
                className="mt-1 h-9 rounded-xl text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">Data Oficial de Abertura</Label>
              <Input
                type="date"
                value={dataAberturaIntegracao}
                onChange={(e) => setDataAberturaIntegracao(e.target.value)}
                className="mt-1 h-9 rounded-xl text-xs"
              />
            </div>

            <div className="rounded-xl bg-teal-50 p-3 text-[11px] text-teal-900 border border-teal-200">
              <p>
                <b>Ação Automática:</b> O status da empresa passará para <b>ATIVO</b>, o regime
                tributário será atualizado para{' '}
                <b>{formation.regime_pretendido || 'Simples Nacional'}</b> e o evento será
                registrado na auditoria oficial (audit_log).
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowIntegrarFiscalModal(false)}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={integratingFiscal}
              onClick={handleConfirmarIntegracaoFiscal}
              className="rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs"
            >
              {integratingFiscal ? 'Sincronizando...' : 'Confirmar e Atualizar Ficha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Criar Obrigações de Implantação */}
      <Dialog open={showObrigacoesModal} onOpenChange={setShowObrigacoesModal}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base text-[#1A2333] flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-600" />
              <span>Criar Obrigações de Implantação</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Lança na agenda do escritório contábil as obrigações fundamentais de início de
              atividade da nova empresa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 text-xs text-[#1A2333]">
            <p className="text-xs text-[#64748B]">
              Serão geradas 4 obrigações prioritárias na coleção oficial <code>obrigacoes</code>:
            </p>
            <ul className="space-y-1.5 list-disc pl-4 text-xs">
              <li>
                <b>DAS (Simples Nacional):</b> Competência inicial de faturamento e apuração.
              </li>
              <li>
                <b>DCTFWeb Inicial:</b> Declaração acessória sem movimento ou com pró-labore.
              </li>
              <li>
                <b>EFD-Reinf / SPED:</b> Abertura do ambiente fiscal digital.
              </li>
              <li>
                <b>Homologação do Enquadramento:</b> Confirmação da opção pelo Simples/Simei dentro
                do prazo legal de 30 dias.
              </li>
            </ul>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowObrigacoesModal(false)}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={criandoObrigacoes}
              onClick={handleCriarObrigacoes}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs"
            >
              {criandoObrigacoes ? 'Criando Obrigações...' : 'Criar Obrigações Agora'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Link Público para o Cliente */}
      <GerarLinkPublicoModal
        open={modalLinkOpen}
        onOpenChange={setModalLinkOpen}
        workflow={activeWorkflow}
        onWorkflowUpdated={(updated) => {
          setActiveWorkflow(updated)
          setEmpresaWorkflows((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
        }}
      />

      {/* Modal: Criar Novo Workflow de Onboarding para esta Empresa */}
      <NovoWorkflowAberturaModal
        open={modalNovoWorkflowOpen}
        onOpenChange={setModalNovoWorkflowOpen}
        tenantId={tenantId}
        empresaIdPadrao={empresa.id}
        razaoSocialPadrao={empresa.razao_social}
        naturezaPadrao={formation?.natureza_juridica || 'slu'}
        onCreated={(novo) => {
          setEmpresaWorkflows((prev) => [novo, ...prev])
          setActiveWorkflow(novo)
          setModalLinkOpen(true)
        }}
      />
    </div>
  )
}

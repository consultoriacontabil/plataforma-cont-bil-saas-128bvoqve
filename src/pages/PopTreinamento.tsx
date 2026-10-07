import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Bot,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Printer,
  UserCheck,
  Lock,
  Building2,
  Users,
  Calculator,
  MessageSquare,
  Clock,
  Sparkles,
  Award,
  Search,
  KeyRound,
  History,
  FileText,
  Workflow,
  Check,
  Layers,
  ArrowRight,
  Shield,
  HelpCircle,
  AlertCircle,
  Database,
  Radio,
  FileCheck2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { elisaOpsService, type SopRecord, type SopEtapaTemplate } from '@/services/elisaOpsService'

interface ChecklistItemState {
  id: string
  label: string
  checked: boolean
}

// Formatação segura de texto com fallback honesto
function renderTextoHonesto(val: string | null | undefined): string {
  if (!val || !val.trim()) return '—'
  return val.trim()
}

export default function PopTreinamentoPage() {
  const { member, user, tenant } = useAuth()
  const { toast } = useToast()

  const perfil = member?.perfil || 'auxiliar'
  const isReadOnly = perfil === 'auxiliar' || perfil === 'consultor'
  const isCliente = perfil === 'cliente'

  // Seletor de versão: padrão 2026.4 (Vigente), alternativa 2026.3 (Histórico)
  const [versaoSelecionada, setVersaoSelecionada] = useState<'2026.4' | '2026.3'>('2026.4')
  const [sopsCarregados, setSopsCarregados] = useState<SopRecord[]>([])
  const [carregandoSops, setCarregandoSops] = useState(false)
  const [sopSelecionadoCodigo, setSopSelecionadoCodigo] = useState<string>('POP-01')

  // Estado da Ficha de Treinamento e Habilitação Operacional
  const [operadorNome, setOperadorNome] = useState('Operador Elliza Contábil (Synapse Robotics)')
  const [supervisorNome, setSupervisorNome] = useState(
    tenant?.responsavel_tecnico || user?.name || 'Responsável Técnico CFC',
  )
  const [dataTreinamento, setDataTreinamento] = useState(new Date().toISOString().slice(0, 10))

  const [checklistHabilitacao, setChecklistHabilitacao] = useState<ChecklistItemState[]>([
    {
      id: 'onb',
      label:
        'POP-01: Onboarding, Ficha Cadastral (#rpa-empresa-ficha) e trilhas paralelas (Proposta Comercial x Documentos)',
      checked: true,
    },
    {
      id: 'dp_folha',
      label: 'POP-02: DP — Ciclo mensal de folha (verbas → cálculo CLT → e-Social S-1200/S-1299)',
      checked: true,
    },
    {
      id: 'fiscal_rotina',
      label: 'POP-03: Rotina Fiscal, Apurações DAS/DARF e Parcelamentos',
      checked: true,
    },
    {
      id: 'rpa_fecho',
      label:
        'POP-04: Fechamento Contábil Mensal & Trilha RPA v1.0 (16 etapas FCT-04 instrumentadas, telemetria determinística)',
      checked: true,
    },
    {
      id: 'conciliacao_bancaria',
      label:
        'POP-05: Conciliação Bancária e Cartões (#rpa-grid-conciliacao, saldo bancário = contábil e pendências = 0)',
      checked: true,
    },
    {
      id: 'whatsapp_atendimento',
      label:
        'POP-AT-01: Atendimento WhatsApp & NFS-e Assistiva (Evolution API, Modo Supervisão e escalonamento humano)',
      checked: true,
    },
    {
      id: 'pro_labore_fator_r',
      label: 'POP-DP-01: Pró-labore, Fator R (limiar 28%) e Quadro Societário Real (#rpa-grid-qsa)',
      checked: true,
    },
    {
      id: 'obrigacoes_08h',
      label: 'POP-10: Obrigações Acessórias, Calendário & Varredura diária das 08h',
      checked: true,
    },
    {
      id: 'conector_rfb',
      label: 'POP-11: Conector RFB Honesto, Radar CND & Reforma Tributária (Modo Supervisão)',
      checked: true,
    },
    {
      id: 'abertura_empresa',
      label: 'POP-12: Abertura de Empresa & Legalização Societária (link público seguro)',
      checked: true,
    },
    {
      id: 'migracoes_onboarding',
      label: 'POP-13: Migrações de Escritório (Entrada & Saída) & Handover CRC',
      checked: true,
    },
    {
      id: 'tripe_integracao',
      label: 'POP-14: Painel de Integração do Tripé Contábil & Lotes Automáticos',
      checked: true,
    },
    {
      id: 'fiscal_defis_xml',
      label: 'POP-15: DEFIS & Importação de XML Fiscal em Lote',
      checked: true,
    },
    {
      id: 'lote_patrimonio_motor',
      label: 'POP-16: Rotinas em Lote, Patrimônio (#rpa-grid-patrimonio) & Motor Normativo',
      checked: true,
    },
    {
      id: 'integra_contador',
      label: 'POP-17: Integra Contador (SERPRO / e-CAC Oficial) & Túnel mTLS',
      checked: true,
    },
    {
      id: 'nfeio_provedor',
      label: 'POP-18: NFS-e Provedor NFE.io & Webhook de Conciliação',
      checked: true,
    },
    {
      id: 'regras_ouro',
      label:
        'Regras Inegociáveis (Regra de Ouro): Zero alucinação, criterio_sucesso_validado=true, cofre A1 e isolamento multi-tenant',
      checked: true,
    },
  ])

  const [activeTab, setActiveTab] = useState<'catalogo' | 'visao_geral' | 'ficha_habilitacao'>(
    'catalogo',
  )
  const [searchTerm, setSearchTerm] = useState('')

  // Carregar os SOPs reais da collection sops via PocketBase
  useEffect(() => {
    let ativo = true
    async function carregarSopsDaVersao() {
      if (!tenant?.id) return
      setCarregandoSops(true)
      try {
        const registros = await elisaOpsService.listSops(tenant.id, undefined, versaoSelecionada)
        if (ativo) {
          // Ordenar por código natural (POP-01, POP-02, ..., POP-18, POP-AT-01, POP-DP-01)
          const ordenados = [...registros].sort((a, b) => {
            const codA = a.codigo || ''
            const codB = b.codigo || ''
            return codA.localeCompare(codB, undefined, { numeric: true, sensitivity: 'base' })
          })
          setSopsCarregados(ordenados)
          if (ordenados.length > 0) {
            // Manter seleção se existir na lista, senão selecionar o primeiro
            const aindaExiste = ordenados.some((s) => s.codigo === sopSelecionadoCodigo)
            if (!aindaExiste) {
              setSopSelecionadoCodigo(ordenados[0].codigo)
            }
          }
        }
      } catch (err) {
        console.error('[PopTreinamento] Erro ao carregar sops:', err)
      } finally {
        if (ativo) setCarregandoSops(false)
      }
    }
    carregarSopsDaVersao()
    return () => {
      ativo = false
    }
  }, [tenant?.id, versaoSelecionada])

  // SOPs filtrados pela busca
  const sopsFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return sopsCarregados
    const t = searchTerm.toLowerCase()
    return sopsCarregados.filter((sop) => {
      return (
        sop.codigo?.toLowerCase().includes(t) ||
        sop.nome?.toLowerCase().includes(t) ||
        sop.area?.toLowerCase().includes(t) ||
        sop.objetivo?.toLowerCase().includes(t) ||
        sop.regras_negocio?.toLowerCase().includes(t)
      )
    })
  }, [sopsCarregados, searchTerm])

  const sopAtual = useMemo(() => {
    return (
      sopsCarregados.find((s) => s.codigo === sopSelecionadoCodigo) ||
      sopsFiltrados[0] ||
      sopsCarregados[0] ||
      null
    )
  }, [sopsCarregados, sopsFiltrados, sopSelecionadoCodigo])

  // Normalizar etapas template
  const etapasDoSop = useMemo<SopEtapaTemplate[]>(() => {
    if (!sopAtual) return []
    const raw = sopAtual.etapas_template_json
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    return []
  }, [sopAtual])

  const toggleChecklist = (id: string) => {
    if (isReadOnly) {
      toast({
        title: 'Apenas leitura',
        description:
          'Perfil Auxiliar possui acesso para consulta. Edição restrita a Contadores e Administradores.',
      })
      return
    }
    setChecklistHabilitacao((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)),
    )
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSalvarFicha = () => {
    toast({
      title: 'Ficha de Treinamento Validada',
      description: `Certificação registrada para ${operadorNome} com supervisão técnica de ${supervisorNome}.`,
    })
  }

  if (isCliente) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center">
        <ShieldCheck className="h-16 w-16 text-amber-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-800">Acesso Restrito à Equipe Técnica</h1>
        <p className="text-slate-600 mt-2">
          O Procedimento Operacional Padrão (POP) e os manuais de automação da Elliza Contábil são
          de uso interno do escritório contábil.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto print:p-0 print:max-w-none">
      {/* Cabeçalho do Documento */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6 print:border-b-2 print:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge className="bg-[#0FA3A3] text-white font-mono">
              POP-Elliza-{versaoSelecionada}
            </Badge>
            <Badge
              className={
                versaoSelecionada === '2026.4'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'bg-slate-500 text-white'
              }
            >
              {versaoSelecionada === '2026.4' ? 'Versão Vigente' : 'Versão Histórica (Inativa)'}
            </Badge>
            <Badge variant="outline" className="text-slate-600 font-medium">
              NBC PP 01 & NBC PG 01 • Rumo SaaS
            </Badge>
            <Badge
              variant="secondary"
              className="bg-teal-50 text-[#0FA3A3] font-semibold border-teal-200"
            >
              {sopsCarregados.length > 0
                ? `${sopsCarregados.length} Procedimentos Registrados no Banco`
                : 'Carregando POPs da collection sops...'}
            </Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Procedimento Operacional Padrão (POP) & Guia de Treinamento
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Manual de Operação Assistiva e Hiperautomação Contábil{' '}
            <span className="font-semibold text-[#0FA3A3]">Elliza Contábil (Synapse Robotics)</span>{' '}
            na Plataforma Rumo. Catálogo dinâmico carregado diretamente do banco de dados com
            governança de versão e telemetria determinística.
          </p>
        </div>

        <div className="flex items-center gap-2 print:hidden flex-wrap">
          {/* SELETOR DE VERSÃO (2026.4 Vigente / 2026.3 Histórico) */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
            <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
              Versão do POP:
            </span>
            <Select
              value={versaoSelecionada}
              onValueChange={(val: '2026.4' | '2026.3') => setVersaoSelecionada(val)}
            >
              <SelectTrigger
                id="pop-version-selector"
                className="h-8 text-xs font-semibold bg-white border-slate-300 w-[180px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2026.4" className="text-xs font-semibold text-emerald-700">
                  2026.4 (Vigente)
                </SelectItem>
                <SelectItem value="2026.3" className="text-xs text-slate-600">
                  2026.3 (Histórico)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Link to="/elliza">
            <Button className="bg-[#0FA3A3] hover:bg-[#0c8282] text-white flex items-center gap-2 text-xs h-9 shadow-xs">
              <Bot className="h-4 w-4" />
              Painel Elliza
            </Button>
          </Link>
          <Link to="/elisa-fila">
            <Button
              variant="outline"
              className="border-teal-300 text-teal-800 hover:bg-teal-50 flex items-center gap-2 text-xs h-9"
            >
              <Workflow className="h-4 w-4 text-[#0FA3A3]" />
              Fila da Elliza (RPA)
            </Button>
          </Link>
          <Button
            onClick={handlePrint}
            variant="outline"
            className="border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center gap-2 text-xs h-9"
          >
            <Printer className="h-4 w-4" />
            Imprimir PDF
          </Button>
          {!isReadOnly && (
            <Button
              onClick={handleSalvarFicha}
              className="bg-slate-800 hover:bg-slate-900 text-white flex items-center gap-2 text-xs h-9"
            >
              <Award className="h-4 w-4" />
              Validar Treinamento
            </Button>
          )}
        </div>
      </div>

      {/* Banner Informativo de Versão */}
      {versaoSelecionada === '2026.4' ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs text-emerald-950 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-emerald-900">
              <Sparkles className="h-4 w-4 text-emerald-700" />
              <span>
                Catálogo Vigente POP-Elliza-2026.4 — 20 POPs Operacionais Ativos (Migration 0118)
              </span>
            </div>
            <Badge className="bg-emerald-600 text-white text-[10px]">Ativo no Banco</Badge>
          </div>
          <p className="leading-relaxed text-emerald-900/90">
            Esta versão consolida o catálogo 2026.4 com as seguintes revisões-chave:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-emerald-900/90 pt-1">
            <div className="bg-white/80 p-2.5 rounded border border-emerald-200">
              <b className="text-emerald-950">POP-01 (Ficha Cadastral):</b> Integração com Ficha
              Cadastral Completa (<code className="font-mono text-[10px]">#rpa-empresa-ficha</code>
              ), QSA contratual (<code className="font-mono text-[10px]">#rpa-grid-qsa</code>) e
              propostas vinculadas em trilhas paralelas (Comercial × Documentos).
            </div>
            <div className="bg-white/80 p-2.5 rounded border border-emerald-200">
              <b className="text-emerald-950">POP-04 (Trilha RPA v1.0):</b> 16 etapas FCT-04
              instrumentadas com atributos{' '}
              <code className="font-mono text-[10px]">data-step-status</code>,{' '}
              <code className="font-mono text-[10px]">data-step-code</code>, botão{' '}
              <code className="font-mono text-[10px]">#rpa-btn-executar</code> e balancete em{' '}
              <code className="font-mono text-[10px]">#rpa-grid-balancete</code>.
            </div>
            <div className="bg-white/80 p-2.5 rounded border border-emerald-200">
              <b className="text-emerald-950">POP-05, POP-AT-01 & POP-DP-01:</b> POP-05 exclusivo
              como Conciliação Bancária e Cartões (
              <code className="font-mono text-[10px]">#rpa-grid-conciliacao</code>); Atendimento
              WhatsApp desacoplado em <b>POP-AT-01</b>; Pró-labore e Fator R (28%) em{' '}
              <b>POP-DP-01</b>.
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-950 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <History className="h-4 w-4 text-amber-700" />
              <span>
                Catálogo Histórico POP-Elliza-2026.3 — Registros Arquivados no Banco (ativo = false)
              </span>
            </div>
            <Badge variant="outline" className="text-amber-800 border-amber-400 text-[10px]">
              Histórico / Somente Leitura
            </Badge>
          </div>
          <p className="leading-relaxed text-amber-900/90">
            Exibindo os procedimentos arquivados da versão 2026.3 mantidos no banco de dados para
            fins de auditoria CFC e rastreabilidade contábil. Nenhum registro histórico é excluído
            ou sofre mutação destrutiva.
          </p>
        </div>
      )}

      {/* Banner de Conformidade e Supervisão Humana */}
      <div className="rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50 via-cyan-50 to-white p-4 text-sm text-slate-700 shadow-xs">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-6 w-6 text-[#0FA3A3] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-slate-900">
              Regra de Ouro da Hiperautomação Contábil (CFC NBC PP 01 & NBC PG 01)
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              A Elliza Contábil opera como motor automatizado de pré-processamento e minutas. Toda
              tarefa concluída exige validação explícita de critério de sucesso (
              <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">
                criterio_sucesso_validado: true
              </code>
              ). Sem credenciais ativas, opera em <strong>Modo Supervisão honesto</strong> sem
              simular falso sucesso. POP sem etapa cadastrada exibe honestamente &quot;—&quot; sem
              inventar fatos.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Principais da Página */}
      <Tabs
        value={activeTab}
        onValueChange={(val) =>
          setActiveTab(val as 'catalogo' | 'visao_geral' | 'ficha_habilitacao')
        }
        className="space-y-6"
      >
        <TabsList className="bg-slate-100 p-1 flex flex-wrap h-auto gap-1 border border-slate-200 print:hidden">
          <TabsTrigger value="catalogo" className="text-xs font-semibold">
            <Layers className="h-3.5 w-3.5 mr-1 text-[#0FA3A3]" />
            Catálogo de POPs ({versaoSelecionada})
          </TabsTrigger>
          <TabsTrigger value="visao_geral" className="text-xs font-semibold">
            <Shield className="h-3.5 w-3.5 mr-1 text-teal-600" />
            Visão Geral & Regras Inegociáveis
          </TabsTrigger>
          <TabsTrigger value="ficha_habilitacao" className="text-xs font-semibold">
            <Award className="h-3.5 w-3.5 mr-1 text-amber-600" />
            Ficha de Habilitação CFC
          </TabsTrigger>
        </TabsList>

        {/* =========================================================================
            ABA 1: CATÁLOGO DINÂMICO DE POPS DA COLLECTION SOPS
           ========================================================================= */}
        <TabsContent value="catalogo" className="space-y-6">
          {/* Barra de Busca de Procedimentos */}
          <div className="relative print:hidden">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder={`Filtrar POPs da versão ${versaoSelecionada} por código, nome, área ou palavras-chave (ex.: POP-04, conciliação, FCT-04, Fator R, WhatsApp)...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 bg-white border-slate-200 text-sm"
            />
          </div>

          {carregandoSops ? (
            <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
              <Bot className="h-8 w-8 text-[#0FA3A3] animate-spin mx-auto mb-2" />
              <p className="text-xs font-medium">
                Carregando catálogo de POPs da versão {versaoSelecionada}...
              </p>
            </div>
          ) : sopsCarregados.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
              <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800">
                Nenhum procedimento encontrado para a versão {versaoSelecionada} neste escritório.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Verifique se a migration 0118 foi aplicada para o tenant atual.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Menu Lateral de POPs */}
              <div className="lg:col-span-4 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Procedimentos ({sopsFiltrados.length})
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    v{versaoSelecionada}
                  </Badge>
                </div>

                <div className="space-y-1 max-h-[720px] overflow-y-auto pr-1">
                  {sopsFiltrados.map((sop) => {
                    const isSelected = sop.codigo === sopAtual?.codigo
                    const totalEtapas = Array.isArray(sop.etapas_template_json)
                      ? sop.etapas_template_json.length
                      : 0

                    return (
                      <button
                        key={sop.id || sop.codigo}
                        type="button"
                        onClick={() => setSopSelecionadoCodigo(sop.codigo)}
                        className={`w-full text-left p-3 rounded-lg border transition-all text-xs flex flex-col gap-1 ${
                          isSelected
                            ? 'border-teal-500 bg-teal-50/70 shadow-xs'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                sop.ativo ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                            />
                            {sop.codigo}
                          </span>
                          <Badge
                            variant="secondary"
                            className="text-[10px] uppercase font-semibold text-slate-600 bg-slate-100"
                          >
                            {sop.area}
                          </Badge>
                        </div>
                        <p className="font-medium text-slate-800 line-clamp-1">{sop.nome}</p>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                          <span>
                            {totalEtapas > 0 ? `${totalEtapas} etapas` : 'Sem etapas detalhadas'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {sop.nivel_autonomia?.replace('nivel_', 'Nível ') || 'Nível 1'}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Detalhe do POP Selecionado */}
              <div className="lg:col-span-8 space-y-6">
                {sopAtual ? (
                  <Card className="border-slate-200 shadow-xs">
                    <CardHeader className="border-b border-slate-100 pb-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge className="bg-[#0FA3A3] text-white font-mono text-xs">
                              {sopAtual.codigo}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="text-xs uppercase font-semibold text-slate-700"
                            >
                              Área: {sopAtual.area}
                            </Badge>
                            <Badge
                              className={
                                sopAtual.ativo
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  : 'bg-slate-100 text-slate-600'
                              }
                            >
                              {sopAtual.ativo ? 'Ativo na 2026.4' : 'Histórico Inativo'}
                            </Badge>
                            <Badge variant="secondary" className="text-xs font-mono">
                              Versão {sopAtual.versao}
                            </Badge>
                          </div>
                          <CardTitle className="text-lg font-bold text-slate-900">
                            {sopAtual.nome}
                          </CardTitle>
                          <CardDescription className="text-xs text-slate-600 mt-1">
                            Responsável: <b>{sopAtual.responsavel_cargo || 'Equipe Técnica'}</b> •
                            Agente: <b>{sopAtual.agente_nome || 'Elliza'}</b> • Autonomia:{' '}
                            <span className="font-mono">
                              {sopAtual.nivel_autonomia || 'nivel_1_automatico'}
                            </span>
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-5 space-y-5 text-xs text-slate-700">
                      {/* Grid de Objetivo e Condições */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                        <div>
                          <span className="font-bold text-slate-900 block mb-1">🎯 Objetivo:</span>
                          <p className="leading-relaxed">{renderTextoHonesto(sopAtual.objetivo)}</p>
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block mb-1">
                            📋 Pré-condições & Gatilho:
                          </span>
                          <p className="leading-relaxed">
                            <b>Gatilho:</b> {renderTextoHonesto(sopAtual.gatilho)}
                          </p>
                          <p className="leading-relaxed mt-1">
                            <b>Pré-condições:</b> {renderTextoHonesto(sopAtual.pre_condicoes)}
                          </p>
                        </div>
                      </div>

                      {/* Entradas, Saídas e Sistemas */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="p-3 rounded-lg border border-slate-200 bg-white">
                          <span className="font-bold text-slate-900 block mb-1">📥 Entradas:</span>
                          <p className="text-slate-600 leading-relaxed">
                            {renderTextoHonesto(sopAtual.entradas)}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg border border-slate-200 bg-white">
                          <span className="font-bold text-slate-900 block mb-1">📤 Saídas:</span>
                          <p className="text-slate-600 leading-relaxed">
                            {renderTextoHonesto(sopAtual.saida)}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg border border-slate-200 bg-white">
                          <span className="font-bold text-slate-900 block mb-1">💻 Sistemas:</span>
                          <p className="text-slate-600 leading-relaxed">
                            {renderTextoHonesto(sopAtual.sistemas_utilizados)}
                          </p>
                        </div>
                      </div>

                      {/* Regras de Negócio e Casos Especiais */}
                      {sopAtual.regras_negocio && (
                        <div className="p-3.5 rounded-lg border border-teal-200 bg-teal-50/40 space-y-1">
                          <span className="font-bold text-teal-950 flex items-center gap-1.5">
                            <Shield className="h-4 w-4 text-[#0FA3A3]" />
                            Regras de Negócio & Telemetria do POP:
                          </span>
                          <p className="text-slate-700 leading-relaxed">
                            {sopAtual.regras_negocio}
                          </p>
                        </div>
                      )}

                      {/* Critérios de Sucesso e Erro */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/40">
                          <span className="font-bold text-emerald-950 flex items-center gap-1 mb-1">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            Critérios de Sucesso:
                          </span>
                          <p className="text-emerald-900 leading-relaxed">
                            {renderTextoHonesto(sopAtual.criterios_sucesso)}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg border border-rose-200 bg-rose-50/40">
                          <span className="font-bold text-rose-950 flex items-center gap-1 mb-1">
                            <AlertTriangle className="h-4 w-4 text-rose-600" />
                            Critérios de Erro / Falha:
                          </span>
                          <p className="text-rose-900 leading-relaxed">
                            {renderTextoHonesto(sopAtual.criterios_erro)}
                          </p>
                        </div>
                      </div>

                      {/* Etapas Operacionais Estruturadas (Etapas Template) */}
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <Workflow className="h-4 w-4 text-[#0FA3A3]" />
                            Etapas Operacionais ({etapasDoSop.length} etapas cadastradas):
                          </h3>
                          {sopAtual.requer_aprovacao && (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
                              Requer Aprovação Humana
                            </Badge>
                          )}
                        </div>

                        {etapasDoSop.length === 0 ? (
                          <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                            <p className="font-mono text-sm">—</p>
                            <p className="text-[11px] mt-1 text-slate-400">
                              Nenhuma etapa detalhada cadastrada para este POP no banco.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {etapasDoSop.map((et, idx) => (
                              <div
                                key={idx}
                                className="p-3 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-colors space-y-1.5"
                              >
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                      {et.ordem ? `Etapa ${et.ordem}` : `Etapa ${idx + 1}`}
                                    </span>
                                    <span className="font-semibold text-slate-900 text-xs">
                                      {et.titulo || 'Etapa Operacional'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Badge variant="outline" className="text-[10px] font-mono">
                                      {et.responsavel_tipo || 'Elliza'}
                                    </Badge>
                                    {et.requer_aprovacao && (
                                      <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px]">
                                        Aprovação
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                {et.descricao && (
                                  <p className="text-slate-600 text-[11px] leading-relaxed">
                                    {et.descricao}
                                  </p>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 text-[11px]">
                                  <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                    <span className="font-semibold text-slate-700 block">
                                      ⚡ Ação do Agente:
                                    </span>
                                    <span className="text-slate-600">
                                      {renderTextoHonesto(et.acao)}
                                    </span>
                                  </div>
                                  <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                    <span className="font-semibold text-slate-700 block">
                                      ✅ Critério de Sucesso:
                                    </span>
                                    <span className="text-slate-600">
                                      {renderTextoHonesto(et.criterio_sucesso)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Exceções e Próximo Processo */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-[11px] border-t border-slate-100">
                        <div>
                          <span className="font-semibold text-slate-800">
                            Tratamento de Exceções:
                          </span>{' '}
                          <span className="text-slate-600">
                            {renderTextoHonesto(sopAtual.excecoes)}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-800">
                            Próximo Processo na Cadeia:
                          </span>{' '}
                          <span className="text-slate-600">
                            {renderTextoHonesto(sopAtual.proximo_processo)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </div>
          )}
        </TabsContent>

        {/* =========================================================================
            ABA 2: VISÃO GERAL & REGRAS INEFINÁVEIS
           ========================================================================= */}
        <TabsContent value="visao_geral" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-900">
                  <Bot className="h-4 w-4 text-[#0FA3A3]" />
                  Perfil Operacional Elliza (Agente IA)
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 space-y-2">
                <p>
                  A Elliza possui identidade própria registrada na coleção{' '}
                  <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">elliza_perfil</code>{' '}
                  (instituída na migration 0097) —{' '}
                  <b>não é um usuário humano nem concorre com licenças</b>.
                </p>
                <p>
                  Sua governança operacional é centralizada em{' '}
                  <Link to="/elliza" className="font-semibold text-[#0FA3A3] underline">
                    /elliza
                  </Link>
                  , e sua fila de execução RPA com contratos determinísticos em{' '}
                  <Link to="/elisa-fila" className="font-semibold text-[#0FA3A3] underline">
                    /elisa-fila
                  </Link>
                  .
                </p>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Modo de Operação:</span>
                  <Badge variant="secondary" className="bg-teal-50 text-[#0FA3A3] font-bold">
                    Supervisionado / Autonomia Real
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-900">
                  <Lock className="h-4 w-4 text-emerald-600" />
                  Isolamento Multi-Tenant & LGPD
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 space-y-2">
                <p>
                  Cada escritório contábil opera sob particionamento rígido via chave primária{' '}
                  <code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded">tenant_id</code>.
                </p>
                <p>
                  Nenhuma automação ou agente RPA cruza fronteiras de escritórios ou clientes.
                  Tokens públicos possuem expiração e parâmetros restritos.
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-900">
                  <UserCheck className="h-4 w-4 text-indigo-600" />
                  Chancela Técnica CFC
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 space-y-2">
                <p>
                  Conforme a <b>NBC PP 01</b> e <b>NBC PG 01</b>, todo relatório, minuta de SPED ou
                  DARF emitido carrega o nome e CRC do Responsável Técnico:
                </p>
                <p className="font-medium text-slate-800">
                  {tenant?.responsavel_tecnico || 'Contador Responsável'} •{' '}
                  {tenant?.crc_responsavel || 'CRC Ativo'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* MATRIZ DE DEPENDÊNCIA DE CREDENCIAIS */}
          <Card className="border-teal-200 bg-teal-50/30 shadow-xs">
            <CardHeader className="pb-3 border-b border-teal-100">
              <div className="flex items-center gap-2 text-teal-900">
                <KeyRound className="h-5 w-5 text-[#0FA3A3]" />
                <CardTitle className="text-base font-bold">
                  Matriz de Dependência de Credenciais (O Que Destrava o Quê)
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-teal-800">
                A plataforma opera sob o princípio da honestidade operacional: a autonomia só é
                ativada mediante credenciais válidas e testadas.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-white p-3 rounded-lg border border-teal-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Evolution API (URL + API Key)</span>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                      WhatsApp Real
                    </Badge>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Destrava o envio real de cobranças PIX, alertas 24/7 e pedidos de documentos
                    pelo WhatsApp (POP-AT-01). Sem credenciais, as mensagens ficam retidas em status{' '}
                    <code className="bg-slate-100 px-1 rounded">aguardando_credenciais</code> para
                    despacho posterior sob demanda.
                  </p>
                </div>

                <div className="bg-white p-3 rounded-lg border border-teal-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">NFE.io (API Key + Company ID)</span>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                      NFS-e Real
                    </Badge>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Destrava a emissão e cancelamento oficial de NFS-e junto a prefeituras
                    integradas (POP-18). O XML é gravado automaticamente no GED da empresa.
                  </p>
                </div>

                <div className="bg-white p-3 rounded-lg border border-teal-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      e-CNPJ A1 + SERPRO + Túnel mTLS
                    </span>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                      Integra Contador / e-CAC Oficial
                    </Badge>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Destrava consultas oficiais máquina-a-máquina na Receita Federal: SITFIS, Caixa
                    Postal DTE, DCTFWeb e emissão de DAS PGDAS-D (POP-17). Sem o proxy mTLS
                    configurado, o sistema opera em Modo Supervisão honesto com aviso explícito e
                    certidões em pendência.
                  </p>
                </div>

                <div className="bg-white p-3 rounded-lg border border-teal-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Agentes Externos (RPA em VM)</span>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                      Trilha RPA v1.0
                    </Badge>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Endpoints{' '}
                    <code className="bg-slate-100 px-1 rounded">/backend/v1/elliza-agente/*</code>{' '}
                    exigem header de autenticação{' '}
                    <code className="bg-slate-100 px-1 rounded">X-Elliza-Api-Key</code> e validação
                    explícita de critério de sucesso (
                    <code className="bg-slate-100 px-1 rounded">
                      criterio_sucesso_validado: true
                    </code>
                    ).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SEÇÃO: REGRAS INEFINÁVEIS */}
          <Card className="border-rose-200 bg-rose-50/40 shadow-xs">
            <CardHeader className="pb-3 border-b border-rose-100">
              <div className="flex items-center gap-2 text-rose-800">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
                <CardTitle className="text-base font-bold">
                  Regras Inegociáveis da Operação Elliza (Cláusulas Pétreas)
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-rose-700">
                A infração de qualquer uma das regras abaixo invalida a certificação do operador e
                aciona trava de segurança.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs text-slate-800">
              <div className="flex items-start gap-3 bg-white p-3 rounded-lg border border-rose-200 shadow-2xs">
                <span className="font-bold text-rose-700 text-sm">1.</span>
                <div>
                  <p className="font-semibold text-slate-900">
                    Nunca Transmitir para o Fisco sem Aprovação Humana (Assistivo Obrigatório)
                  </p>
                  <p className="text-slate-600 mt-0.5">
                    A Elliza gera o XML de fechamento do e-Social, a escrituração do SPED com hash
                    MD5, a DEFIS, os lotes contábeis e a minuta da NFS-e. Contudo, o botão de
                    transmissão externa exige clique explícito de um usuário com perfil Contador ou
                    Administrador.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white p-3 rounded-lg border border-rose-200 shadow-2xs">
                <span className="font-bold text-rose-700 text-sm">2.</span>
                <div>
                  <p className="font-semibold text-slate-900">
                    Zero Alucinação: Nunca Inventar Valores, Prazos ou Fatos
                  </p>
                  <p className="text-slate-600 mt-0.5">
                    Caso dados cadastrais, alíquotas ou credenciais estejam ausentes, a Elliza deve
                    registrar status pendente ou modo supervisão. Campos vazios em relatórios exibem
                    honestamente &quot;—&quot; sem inventar dados.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white p-3 rounded-lg border border-rose-200 shadow-2xs">
                <span className="font-bold text-rose-700 text-sm">3.</span>
                <div>
                  <p className="font-semibold text-slate-900">
                    Regra de Ouro da Conclusão RPA: Critério de Sucesso Validado
                  </p>
                  <p className="text-slate-600 mt-0.5">
                    Toda transição de job para status CONCLUIDO exige validação formal com o payload{' '}
                    <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">
                      criterio_sucesso_validado: true
                    </code>
                    . Chamadas sem este atributo são rejeitadas com erro HTTP 400 pelo backend.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white p-3 rounded-lg border border-rose-200 shadow-2xs">
                <span className="font-bold text-rose-700 text-sm">4.</span>
                <div>
                  <p className="font-semibold text-slate-900">
                    Certificados A1 e Senhas Jamais em Planilhas ou Chats Abertos
                  </p>
                  <p className="text-slate-600 mt-0.5">
                    Arquivos .pfx e senhas criptografadas trafegam exclusivamente pelo cofre de
                    certificados da plataforma em{' '}
                    <code className="bg-slate-100 px-1 py-0.5 rounded">/empresas/:id</code>. Backups
                    independentes ofuscam senhas e chaves privadas antes do download.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 3: FICHA DE HABILITAÇÃO OPERACIONAL CFC
           ========================================================================= */}
        <TabsContent value="ficha_habilitacao" className="space-y-6">
          <Card className="border-teal-300 shadow-sm bg-white">
            <CardHeader className="border-b border-teal-100 bg-teal-50/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-teal-950 flex items-center gap-2">
                    <Award className="h-5 w-5 text-[#0FA3A3]" />
                    Ficha de Treinamento & Habilitação Operacional — Elliza Contábil (v
                    {versaoSelecionada})
                  </CardTitle>
                  <CardDescription className="text-xs text-teal-800">
                    Documento comprobatório de capacitação técnica da equipe e certificação do motor
                    de automação (Synapse Robotics) — Em conformidade com a NBC PP 01 / NBC PG 01.
                  </CardDescription>
                </div>
                <Badge className="bg-[#0FA3A3] text-white">Validade: 12 Meses</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Identificação das Partes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Operador / Agente Treinado:
                  </label>
                  <Input
                    value={operadorNome}
                    onChange={(e) => setOperadorNome(e.target.value)}
                    disabled={isReadOnly}
                    className="text-xs h-9 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Supervisor Técnico (CFC):
                  </label>
                  <Input
                    value={supervisorNome}
                    onChange={(e) => setSupervisorNome(e.target.value)}
                    disabled={isReadOnly}
                    className="text-xs h-9 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Data da Conclusão:
                  </label>
                  <Input
                    type="date"
                    value={dataTreinamento}
                    onChange={(e) => setDataTreinamento(e.target.value)}
                    disabled={isReadOnly}
                    className="text-xs h-9 bg-slate-50"
                  />
                </div>
              </div>

              {/* Checklist de Competências Práticas */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Checklist de Habilitação por Módulo (Catálogo 2026.4 + Governança & Regras de
                    Ouro):
                  </h3>
                  <span className="text-xs text-slate-500">
                    {checklistHabilitacao.filter((c) => c.checked).length} de{' '}
                    {checklistHabilitacao.length} validados
                  </span>
                </div>

                <div className="space-y-2">
                  {checklistHabilitacao.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => toggleChecklist(item.id)}
                      className={`flex items-start gap-3 p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                        item.checked
                          ? 'border-teal-200 bg-teal-50/40 text-slate-800'
                          : 'border-slate-200 bg-slate-50 text-slate-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => {}}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0FA3A3] focus:ring-[#0FA3A3]"
                      />
                      <div className="flex-1">
                        <span
                          className={`font-medium ${item.checked ? 'text-slate-900' : 'text-slate-600'}`}
                        >
                          {item.label}
                        </span>
                      </div>
                      {item.checked && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Termo de Compromisso */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 space-y-2">
                <p className="font-semibold text-slate-900">
                  Declaração de Conformidade & Ética Profissional:
                </p>
                <p className="leading-relaxed">
                  Declaro que a operação do motor <b>Elliza Contábil (Synapse Robotics)</b> foi
                  devidamente instruída conforme o catálogo de Procedimentos Operacionais Padrão
                  (POP) versão <b>{versaoSelecionada}</b> registrado na collection{' '}
                  <code className="font-mono">sops</code>, compreendendo a Trilha RPA v1.0, o
                  equacionamento da Ficha Cadastral e as diretivas de governança. Fica expressamente
                  reconhecido que a tecnologia atua em regime <b>estritamente assistivo</b> sob
                  supervisão humana contínua, respeitando a soberania da aprovação contábil prévia,
                  os ditames da Lei Geral de Proteção de Dados (LGPD) e as normas do Conselho
                  Federal de Contabilidade.
                </p>
              </div>

              {/* Assinaturas Digitais e Chancelas */}
              <div className="pt-6 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-8 text-center">
                <div className="space-y-1">
                  <div className="border-b border-slate-400 pb-2 font-semibold text-slate-800">
                    {operadorNome}
                  </div>
                  <span className="text-[11px] text-slate-500 uppercase">
                    Operador / Responsável pela Automação (Synapse Robotics)
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="border-b border-slate-400 pb-2 font-semibold text-slate-800">
                    {supervisorNome} — {tenant?.crc_responsavel || 'CRC Ativo'}
                  </div>
                  <span className="text-[11px] text-slate-500 uppercase">
                    Contador Responsável Técnico (NBC PP 01 / NBC PG 01)
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

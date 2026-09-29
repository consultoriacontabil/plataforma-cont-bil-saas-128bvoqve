import React, { useState, useEffect, useCallback, useMemo } from 'react'
import pb from '@/lib/pocketbase/client'
import {
  FileText,
  Send,
  Download,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  RefreshCw,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  FileCode2,
  Clock,
  ExternalLink,
  DollarSign,
  HelpCircle,
  Link as LinkIcon,
  Search,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { reinfService } from '@/services/reinf'
import { dctfwebService } from '@/services/dctfweb'
import { esocialService } from '@/services/esocial'
import type {
  Empresa,
  ReinfEventoRecord,
  ReinfEventoTipo,
  DctfwebDeclaracaoRecord,
  EsocialDiagnosticoCredenciais,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { formatDatePtBr, formatDateTimePtBr } from '@/lib/formatters'

interface PainelReinfDctfwebProps {
  empresas: Empresa[]
  selectedEmpresaId: string
  selectedCompetencia: string
  canManage: boolean
  canEdit: boolean
  onNavigateToEsocial?: () => void
}

export function PainelReinfDctfweb({
  empresas,
  selectedEmpresaId,
  selectedCompetencia,
  canManage,
  canEdit,
  onNavigateToEsocial,
}: PainelReinfDctfwebProps) {
  const { tenant, user } = useAuth()
  const { toast } = useToast()

  const [subTab, setSubTab] = useState<'reinf' | 'dctfweb'>('reinf')
  const [eventosReinf, setEventosReinf] = useState<ReinfEventoRecord[]>([])
  const [declaracaoDctf, setDeclaracaoDctf] = useState<DctfwebDeclaracaoRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [consolidando, setConsolidando] = useState(false)
  const [transmittingReinfId, setTransmittingReinfId] = useState<string | null>(null)
  const [transmittingDctf, setTransmittingDctf] = useState(false)

  // Certificado Ativo Vinculado
  const [temCertificadoAtivo, setTemCertificadoAtivo] = useState<boolean>(false)

  // Modais
  const [modalXmlOpen, setModalXmlOpen] = useState(false)
  const [xmlVisualizando, setXmlVisualizando] = useState<ReinfEventoRecord | null>(null)
  const [modalFechamentoReinfOpen, setModalFechamentoReinfOpen] = useState(false)
  const [modalReaberturaReinfOpen, setModalReaberturaReinfOpen] = useState(false)
  const [motivoReabertura, setMotivoReabertura] = useState('')
  const [reabrindoReinf, setReabrindoReinf] = useState(false)
  const [fechandoReinf, setFechandoReinf] = useState(false)

  // Diagnóstico de Credenciais
  const [modalDiagOpen, setModalDiagOpen] = useState(false)
  const [testandoCredenciais, setTestandoCredenciais] = useState(false)
  const [diagResultado, setDiagResultado] = useState<EsocialDiagnosticoCredenciais | null>(null)

  // Filtros internos Reinf
  const [filtroTipoReinf, setFiltroTipoReinf] = useState<string>('todos')
  const [filtroStatusReinf, setFiltroStatusReinf] = useState<string>('todos')

  const empresaAtual = useMemo(() => {
    return empresas.find((e) => e.id === selectedEmpresaId) || empresas[0]
  }, [empresas, selectedEmpresaId])

  // Carregar dados
  const loadData = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const [reinfList, dctfList] = await Promise.all([
        reinfService.listEventos(tenant.id, {
          empresaId: selectedEmpresaId,
          competencia: selectedCompetencia,
          tipoEvento: filtroTipoReinf,
          status: filtroStatusReinf,
        }),
        dctfwebService.listDeclaracoes(tenant.id, {
          empresaId: selectedEmpresaId,
          competencia: selectedCompetencia,
        }),
      ])
      setEventosReinf(reinfList)
      setDeclaracaoDctf(dctfList[0] || null)
    } catch (err) {
      console.error('Erro ao carregar EFD-Reinf e DCTFWeb:', err)
      toast({
        variant: 'destructive',
        title: 'Erro de carregamento',
        description: 'Não foi possível buscar as declarações federais.',
      })
    } finally {
      setLoading(false)
    }
  }, [
    tenant?.id,
    selectedEmpresaId,
    selectedCompetencia,
    filtroTipoReinf,
    filtroStatusReinf,
    toast,
  ])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const checarCert = async () => {
      const empId = selectedEmpresaId !== 'todas' ? selectedEmpresaId : empresaAtual?.id
      if (!empId || empId === 'todas') {
        setTemCertificadoAtivo(false)
        return
      }
      try {
        const certs = await pb.collection('certificados_digitais').getFullList({
          filter: `empresa = "${empId}" && status = "ativo"`,
        })
        setTemCertificadoAtivo(certs.length > 0)
      } catch {
        setTemCertificadoAtivo(false)
      }
    }
    checarCert()
  }, [selectedEmpresaId, empresaAtual?.id])

  // Estatísticas do Reinf
  const reinfStats = useMemo(() => {
    const total = eventosReinf.length
    const transmitidos = eventosReinf.filter(
      (e) => e.status === 'transmitido' || e.status === 'fechado',
    ).length
    const pendentes = eventosReinf.filter(
      (e) => e.status === 'pendente' || e.status === 'rejeitado',
    ).length
    const r2099Fechado = eventosReinf.some(
      (e) => e.tipo_evento === 'R-2099' && (e.status === 'fechado' || e.status === 'transmitido'),
    )
    let retencaoTotal = 0
    eventosReinf.forEach((e) => {
      retencaoTotal += e.valor_retencao || 0
    })

    return { total, transmitidos, pendentes, r2099Fechado, retencaoTotal }
  }, [eventosReinf])

  // Sincronizar Retenções do DP para o EFD-Reinf
  const handleSincronizarRetencoes = async () => {
    if (!tenant?.id || !empresaAtual) return
    if (selectedEmpresaId === 'todas') {
      toast({
        variant: 'destructive',
        title: 'Selecione uma empresa',
        description:
          'Escolha uma empresa específica para sincronizar retenções do DP para o Reinf.',
      })
      return
    }

    setSincronizando(true)
    try {
      const res = await reinfService.sincronizarRetencoesParaReinf(
        tenant.id,
        empresaAtual.id,
        selectedCompetencia,
        user?.id || 'sistema',
      )
      toast({
        title: 'EFD-Reinf Atualizado!',
        description: `Retenções do DP sincronizadas: ${res.criados} eventos novos, ${res.atualizados} atualizados.`,
      })
      loadData()
    } catch (err) {
      console.error('Erro ao sincronizar retenções:', err)
      toast({
        variant: 'destructive',
        title: 'Falha na sincronização',
        description: 'Não foi possível gerar os eventos do EFD-Reinf a partir do DP.',
      })
    } finally {
      setSincronizando(false)
    }
  }

  // Consolidar DCTFWeb
  const handleConsolidarDctf = async () => {
    if (!tenant?.id || !empresaAtual) return
    if (selectedEmpresaId === 'todas') {
      toast({
        variant: 'destructive',
        title: 'Selecione uma empresa',
        description: 'Escolha uma empresa específica para consolidar a DCTFWeb.',
      })
      return
    }

    setConsolidando(true)
    try {
      const res = await dctfwebService.consolidarDeclaracao(
        tenant.id,
        empresaAtual.id,
        selectedCompetencia,
        user?.id || 'sistema',
      )
      setDeclaracaoDctf(res)
      toast({
        title: 'DCTFWeb Consolidada!',
        description: res.pronta_para_transmitir
          ? 'Declaração sem pendências! Pronta para transmissão oficial.'
          : `Consolidada com ${res.pendencias_bloqueantes?.length || 0} pendência(s) de bloqueio.`,
      })
      loadData()
    } catch (err) {
      console.error('Erro ao consolidar DCTFWeb:', err)
      toast({
        variant: 'destructive',
        title: 'Erro de consolidação',
        description: 'Falha ao consolidar débitos de e-Social e EFD-Reinf.',
      })
    } finally {
      setConsolidando(false)
    }
  }

  // Transmitir Evento Reinf
  const handleTransmitirReinf = async (ev: ReinfEventoRecord) => {
    if (!tenant?.id) return
    setTransmittingReinfId(ev.id)
    try {
      await reinfService.transmitirEvento(ev.id, tenant.id, user?.id || 'sistema')
      toast({
        title: `Evento ${ev.tipo_evento} transmitido!`,
        description: 'Protocolo e recibo oficial emitidos em Modo Supervisão.',
      })
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao transmitir',
        description: 'Não foi possível protocolar o evento no EFD-Reinf.',
      })
    } finally {
      setTransmittingReinfId(null)
    }
  }

  // Fechar Reinf (R-2099)
  const handleFecharReinf = async () => {
    if (!tenant?.id || !empresaAtual) return
    setFechandoReinf(true)
    try {
      await reinfService.fecharCompetencia(
        tenant.id,
        empresaAtual.id,
        selectedCompetencia,
        user?.id || 'sistema',
      )
      toast({
        title: 'Fechamento R-2099 Concluído!',
        description: `Competência ${selectedCompetencia} do EFD-Reinf fechada com trava legal.`,
      })
      setModalFechamentoReinfOpen(false)
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro no fechamento',
        description: 'Não foi possível transmitir o evento R-2099.',
      })
    } finally {
      setFechandoReinf(false)
    }
  }

  // Reabrir Reinf (R-2098)
  const handleReabrirReinf = async () => {
    if (!tenant?.id || !empresaAtual) return
    if (motivoReabertura.trim().length < 10) {
      toast({
        variant: 'destructive',
        title: 'Justificativa obrigatória',
        description: 'Informe uma justificativa auditável com no mínimo 10 caracteres.',
      })
      return
    }

    setReabrindoReinf(true)
    try {
      await reinfService.reabrirCompetencia(
        tenant.id,
        empresaAtual.id,
        selectedCompetencia,
        motivoReabertura.trim(),
        user?.id || 'sistema',
      )
      toast({
        title: 'Reabertura R-2098 Protocolada!',
        description: `Competência ${selectedCompetencia} reaberta para retificações.`,
      })
      setModalReaberturaReinfOpen(false)
      setMotivoReabertura('')
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro na reabertura',
        description: 'Não foi possível transmitir o evento R-2098.',
      })
    } finally {
      setReabrindoReinf(false)
    }
  }

  // Transmitir DCTFWeb
  const handleTransmitirDctf = async () => {
    if (!tenant?.id || !declaracaoDctf) return
    setTransmittingDctf(true)
    try {
      await dctfwebService.transmitirDeclaracao(declaracaoDctf.id, tenant.id, user?.id || 'sistema')
      toast({
        title: 'DCTFWeb Transmitida com Sucesso!',
        description:
          'Declaração aceita pela Receita Federal. DARF consolidado integrado ao Financeiro!',
      })
      loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na transmissão da DCTFWeb.'
      toast({
        variant: 'destructive',
        title: 'Transmissão bloqueada',
        description: msg,
      })
    } finally {
      setTransmittingDctf(false)
    }
  }

  // Testar Credenciais (reutiliza o diagnóstico honesto do e-Social)
  const handleTestarCredenciais = async () => {
    if (!tenant?.id || !empresaAtual) return
    setTestandoCredenciais(true)
    setModalDiagOpen(true)
    try {
      const diag = await esocialService.testarCredenciais(
        tenant.id,
        empresaAtual.id,
        user?.id || 'sistema',
      )
      setDiagResultado(diag)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Falha no teste',
        description: 'Não foi possível executar a rotina de validação de credenciais.',
      })
    } finally {
      setTestandoCredenciais(false)
    }
  }

  // Baixar XML
  const handleBaixarXml = (evento: ReinfEventoRecord) => {
    if (!evento.xml_gerado) return
    const blob = new Blob([evento.xml_gerado], { type: 'application/xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `REINF-${evento.tipo_evento}-${evento.competencia.replace('/', '')}.xml`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Banner de Modo Supervisão e Status Federal */}
      <div className="rounded-2xl border border-sky-200 bg-linear-to-r from-sky-50 via-teal-50 to-emerald-50 p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0FA3A3] text-white shadow-xs">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-[#0B1F3A]">
                  EFD-Reinf & DCTFWeb — Integração Fiscal e Previdenciária
                </h3>
                <BadgeTransmissaoAutonomia
                  tipo="certificado_a1"
                  isCredenciado={temCertificadoAtivo}
                  detalhe={
                    temCertificadoAtivo
                      ? 'Certificado A1 válido vinculado à empresa. EFD-Reinf e DCTFWeb operam com credenciamento ativo.'
                      : 'Certificado A1 ausente ou pendente. As transmissões federais operam em Modo Supervisão com auditoria prévia.'
                  }
                  configUrl="/obrigacoes"
                />
                <Badge
                  variant="outline"
                  className="border-sky-300 text-sky-800 bg-sky-50 text-[10px] font-medium"
                >
                  Layout v2.01 Oficial
                </Badge>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                Retenções do DP e notas de serviço consolidadas diretamente com a Receita Federal.
                Dependência tripla:{' '}
                <b>e-Social (S-1.1) + EFD-Reinf (v2.01) → DCTFWeb de débitos unificados</b>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestarCredenciais}
              className="rounded-xl text-xs font-semibold h-8 border-slate-200 gap-1.5 bg-white text-[#1A2333]"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
              <span>Testar Credenciais</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Sub-Aba: Alternância EFD-Reinf vs DCTFWeb */}
      <Tabs value={subTab} onValueChange={(v) => setSubTab(v as 'reinf' | 'dctfweb')}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 rounded-2xl border border-[#E2E8F0] shadow-2xs">
          <TabsList className="bg-slate-100 p-1 rounded-xl">
            <TabsTrigger value="reinf" className="gap-2 text-xs font-semibold rounded-lg">
              <FileCode2 className="h-4 w-4 text-[#0FA3A3]" />
              <span>EFD-Reinf (Eventos & Retenções)</span>
              {reinfStats.pendentes > 0 && (
                <span className="ml-1 rounded-full bg-rose-500 text-white px-1.5 py-0.2 text-[10px]">
                  {reinfStats.pendentes}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="dctfweb" className="gap-2 text-xs font-semibold rounded-lg">
              <FileText className="h-4 w-4 text-emerald-600" />
              <span>DCTFWeb Consolidada</span>
              {declaracaoDctf && !declaracaoDctf.pronta_para_transmitir && (
                <span className="ml-1 rounded-full bg-amber-500 text-white px-1.5 py-0.2 text-[10px]">
                  Trava
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            {subTab === 'reinf' && canEdit && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSincronizarRetencoes}
                  disabled={sincronizando}
                  className="rounded-xl text-xs font-semibold h-8 border-[#E2E8F0] gap-1.5"
                  title="Varre guias de INSS/IRRF do DP e notas tomadas para popular a fila do Reinf"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${sincronizando ? 'animate-spin' : ''}`} />
                  <span>{sincronizando ? 'Sincronizando...' : 'Derivar do DP'}</span>
                </Button>

                {!reinfStats.r2099Fechado ? (
                  <Button
                    size="sm"
                    onClick={() => setModalFechamentoReinfOpen(true)}
                    className="rounded-xl text-xs font-semibold h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span>Fechar Reinf (R-2099)</span>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setModalReaberturaReinfOpen(true)}
                    className="rounded-xl text-xs font-semibold h-8 border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 gap-1.5"
                  >
                    <Unlock className="h-3.5 w-3.5 text-amber-600" />
                    <span>Reabrir Reinf (R-2098)</span>
                  </Button>
                )}
              </>
            )}

            {subTab === 'dctfweb' && canEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleConsolidarDctf}
                disabled={consolidando}
                className="rounded-xl text-xs font-semibold h-8 border-[#E2E8F0] gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${consolidando ? 'animate-spin' : ''}`} />
                <span>{consolidando ? 'Consolidando...' : 'Reconsolidar Débitos'}</span>
              </Button>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* TAB CONTENT: EFD-REINF                                   */}
        {/* ========================================================= */}
        <TabsContent value="reinf" className="space-y-4 mt-3">
          {/* Cards de Resumo Reinf */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    Eventos na Fila
                  </p>
                  <p className="text-xl font-bold text-[#1A2333] mt-1">{reinfStats.total}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-[#0FA3A3]">
                  <Layers className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    Retenção INSS Apurada
                  </p>
                  <p className="text-xl font-bold text-amber-600 mt-1">
                    R${' '}
                    {reinfStats.retencaoTotal.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <DollarSign className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    Transmitidos / Fechados
                  </p>
                  <p className="text-xl font-bold text-emerald-600 mt-1">
                    {reinfStats.transmitidos} de {reinfStats.total}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    Fechamento (R-2099)
                  </p>
                  <div className="mt-1">
                    {reinfStats.r2099Fechado ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs font-bold gap-1">
                        <Lock className="h-3 w-3" />
                        <span>Fechado</span>
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs font-bold gap-1">
                        <Clock className="h-3 w-3" />
                        <span>Competência Aberta</span>
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Lock className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Eventos EFD-Reinf */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[#64748B] font-semibold border-b border-[#E2E8F0]">
                  <tr>
                    <th className="py-3 px-4">Evento Reinf</th>
                    <th className="py-3 px-4">Prestador / Fornecedor</th>
                    <th className="py-3 px-4">Documento</th>
                    <th className="py-3 px-4">Base / Retenção</th>
                    <th className="py-3 px-4">Prazo Legal</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Recibo / Protocolo</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[#1A2333]">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-[#94A3B8]">
                        Carregando fila de eventos EFD-Reinf...
                      </td>
                    </tr>
                  ) : eventosReinf.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-[#94A3B8]">
                        Nenhum evento do EFD-Reinf encontrado para a competência{' '}
                        {selectedCompetencia}. Clique em &quot;Derivar do DP&quot; para pré-popular
                        a fila com base nas retenções cadastradas.
                      </td>
                    </tr>
                  ) : (
                    eventosReinf.map((ev) => {
                      const hasErros = ev.erros_validacao && ev.erros_validacao.length > 0
                      return (
                        <tr key={ev.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-xs bg-slate-100 text-[#0FA3A3] px-2 py-0.5 rounded border border-slate-200">
                              {ev.tipo_evento}
                            </span>
                            <p className="text-[11px] text-[#64748B] mt-1">
                              {ev.tipo_evento === 'R-1000' && 'Informações do Contribuinte'}
                              {ev.tipo_evento === 'R-2010' && 'Serviços Tomados (INSS 11%)'}
                              {ev.tipo_evento === 'R-2020' && 'Serviços Prestados'}
                              {ev.tipo_evento === 'R-2098' && 'Reabertura Competência'}
                              {ev.tipo_evento === 'R-2099' && 'Fechamento Competência'}
                            </p>
                          </td>

                          <td className="py-3.5 px-4">
                            {ev.prestador_razao_social ? (
                              <div>
                                <p className="font-semibold text-[#1A2333]">
                                  {ev.prestador_razao_social}
                                </p>
                                <p className="text-[11px] text-[#64748B]">
                                  {ev.prestador_cnpj_cpf || '—'}
                                </p>
                              </div>
                            ) : (
                              <span className="text-[#64748B]">
                                {ev.expand?.empresa?.razao_social || 'Contribuinte Matriz'}
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 font-mono text-[#475569]">
                            {ev.numero_documento || '—'}
                          </td>

                          <td className="py-3.5 px-4">
                            {ev.valor_retencao ? (
                              <div>
                                <p className="font-mono font-bold text-amber-600">
                                  R$ {ev.valor_retencao.toFixed(2)}
                                </p>
                                <p className="text-[11px] text-[#64748B]">
                                  Base: R$ {(ev.base_calculo || 0).toFixed(2)} (Cód:{' '}
                                  {ev.codigo_receita || '111-0'})
                                </p>
                              </div>
                            ) : (
                              <span className="text-[#94A3B8]">—</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-[#64748B]">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>
                                {ev.prazo_legal ? formatDatePtBr(ev.prazo_legal) : 'Dia 15'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {ev.status === 'transmitido' && (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
                                Transmitido
                              </Badge>
                            )}
                            {ev.status === 'fechado' && (
                              <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300">
                                Fechado (R-2099)
                              </Badge>
                            )}
                            {ev.status === 'validado' && (
                              <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                                Validado
                              </Badge>
                            )}
                            {ev.status === 'pronto' && (
                              <Badge className="bg-sky-100 text-sky-800 border-sky-300">
                                Pronto p/ Envio
                              </Badge>
                            )}
                            {ev.status === 'pendente' && (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                                Pendente
                              </Badge>
                            )}
                            {ev.status === 'rejeitado' && (
                              <Badge className="bg-rose-100 text-rose-800 border-rose-300">
                                Rejeitado
                              </Badge>
                            )}

                            {hasErros && (
                              <div className="mt-1 flex items-center gap-1 text-[10px] text-rose-600 font-medium">
                                <AlertCircle className="h-3 w-3" />
                                <span>{ev.erros_validacao?.length} inconsistência(s)</span>
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            {ev.recibo_entrega ? (
                              <div>
                                <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 block truncate max-w-[170px]">
                                  {ev.recibo_entrega}
                                </span>
                                <span className="text-[10px] text-[#64748B] block mt-0.5">
                                  {ev.data_transmissao
                                    ? formatDateTimePtBr(ev.data_transmissao)
                                    : ''}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[#94A3B8]">—</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {ev.xml_gerado && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setXmlVisualizando(ev)
                                    setModalXmlOpen(true)
                                  }}
                                  className="h-7 text-[11px] text-[#475569] hover:text-[#0FA3A3] gap-1"
                                >
                                  <FileCode2 className="h-3.5 w-3.5" />
                                  <span>XML</span>
                                </Button>
                              )}

                              {canEdit &&
                                ev.status !== 'transmitido' &&
                                ev.status !== 'fechado' && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleTransmitirReinf(ev)}
                                    disabled={transmittingReinfId === ev.id || hasErros}
                                    className="h-7 text-[11px] font-semibold bg-[#0FA3A3] text-white hover:bg-[#0C8585] rounded-lg gap-1"
                                  >
                                    <Send className="h-3 w-3" />
                                    <span>
                                      {transmittingReinfId === ev.id ? 'Enviando...' : 'Transmitir'}
                                    </span>
                                  </Button>
                                )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ========================================================= */}
        {/* TAB CONTENT: DCTFWEB                                     */}
        {/* ========================================================= */}
        <TabsContent value="dctfweb" className="space-y-4 mt-3">
          {/* Card de Regra Real de Dependência e Bloqueios */}
          {declaracaoDctf && (
            <div
              className={`p-4 rounded-2xl border ${
                declaracaoDctf.pronta_para_transmitir
                  ? 'bg-emerald-50/70 border-emerald-200'
                  : 'bg-amber-50/70 border-amber-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {declaracaoDctf.pronta_para_transmitir ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  )}
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-[#0B1F3A]">
                      {declaracaoDctf.pronta_para_transmitir
                        ? 'DCTFWeb Pronta para Transmissão — e-Social e EFD-Reinf Fechados e Validados'
                        : 'DCTFWeb Bloqueada para Transmissão — Pendências Acionáveis no e-Social ou EFD-Reinf'}
                    </p>
                    <p className="text-xs text-[#64748B]">
                      Pela legislação da Receita Federal do Brasil, a DCTFWeb consolida
                      automaticamente as escriturações do <b>e-Social (S-1299)</b> e do{' '}
                      <b>EFD-Reinf (R-2099)</b>. A declaração só pode ser transmitida após o
                      protocolo de ambos os fechamentos da competência {selectedCompetencia}.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold text-[#64748B]">Status DCTFWeb</p>
                    <Badge
                      className={
                        declaracaoDctf.status === 'transmitida'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : declaracaoDctf.pronta_para_transmitir
                            ? 'bg-sky-100 text-sky-800 border-sky-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                      }
                    >
                      {declaracaoDctf.status === 'transmitida'
                        ? 'Transmitida'
                        : declaracaoDctf.pronta_para_transmitir
                          ? 'Consolidada (Apta)'
                          : 'Bloqueada por Pendências'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Lista de Pendências Bloqueantes (Se houver) */}
              {declaracaoDctf.pendencias_bloqueantes &&
                declaracaoDctf.pendencias_bloqueantes.length > 0 && (
                  <div className="mt-3 p-3 bg-white/80 rounded-xl border border-amber-200/80 space-y-2">
                    <p className="font-bold text-xs text-amber-900 flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <span>Pendências que bloqueiam a transmissão desta DCTFWeb:</span>
                    </p>
                    <div className="space-y-1.5">
                      {declaracaoDctf.pendencias_bloqueantes.map((pend, pIdx) => (
                        <div
                          key={pIdx}
                          className="flex items-start justify-between gap-3 text-xs p-2 rounded-lg bg-amber-50/50 border border-amber-100"
                        >
                          <div>
                            <span className="font-bold text-amber-900">
                              [{pend.modulo}
                              {pend.tipo_evento ? ` / ${pend.tipo_evento}` : ''}]:
                            </span>{' '}
                            <span className="text-amber-800">{pend.motivo}</span>
                            <p className="text-[11px] text-[#0C8585] mt-0.5">
                              <b>Ação necessária:</b> {pend.acao}
                            </p>
                          </div>

                          {pend.modulo === 'e-Social' && onNavigateToEsocial && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={onNavigateToEsocial}
                              className="h-6 text-[10px] px-2 rounded-md border-amber-300 text-amber-900"
                            >
                              Ir para e-Social
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* Cards Totalizadores de Débito DCTFWeb */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    Total de Débitos Apurados
                  </p>
                  <p className="text-xl font-bold text-[#1A2333] mt-1">
                    R${' '}
                    {(declaracaoDctf?.total_debitos || 0).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <DollarSign className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    Deduções / Saldo Suspenso
                  </p>
                  <p className="text-xl font-bold text-[#64748B] mt-1">
                    R${' '}
                    {(declaracaoDctf?.total_deducoes || 0).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-[#64748B]">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs bg-emerald-50/40">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    Saldo a Recolher (DARF Único)
                  </p>
                  <p className="text-xl font-bold text-emerald-700 mt-1">
                    R${' '}
                    {(declaracaoDctf?.saldo_a_recolher || 0).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Débitos por Código de Receita Oficial */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-[#1A2333]">
                  Mapa de Débitos Tributários por Código de Receita
                </h4>
                <p className="text-xs text-[#64748B]">
                  Valores apurados a partir dos demonstrativos de folha e notas fiscais de serviço.
                </p>
              </div>

              {canEdit && declaracaoDctf?.status !== 'transmitida' && (
                <Button
                  onClick={handleTransmitirDctf}
                  disabled={!declaracaoDctf?.pronta_para_transmitir || transmittingDctf}
                  className="rounded-xl text-xs font-semibold bg-[#0FA3A3] hover:bg-[#0C8585] text-white gap-2"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>
                    {transmittingDctf ? 'Transmitindo DCTFWeb...' : 'Transmitir DCTFWeb Oficial'}
                  </span>
                </Button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[#64748B] font-semibold border-b border-[#E2E8F0]">
                  <tr>
                    <th className="py-3 px-4">Origem Declaratória</th>
                    <th className="py-3 px-4">Código Receita</th>
                    <th className="py-3 px-4">Descrição do Tributo</th>
                    <th className="py-3 px-4 font-mono">Base de Cálculo</th>
                    <th className="py-3 px-4">Alíquota</th>
                    <th className="py-3 px-4 font-mono">Valor Apurado</th>
                    <th className="py-3 px-4 font-mono">Saldo a Pagar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[#1A2333]">
                  {!declaracaoDctf?.debitos_json || declaracaoDctf.debitos_json.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#94A3B8]">
                        Nenhum débito apurado. Clique em &quot;Reconsolidar Débitos&quot; para
                        calcular a DCTFWeb.
                      </td>
                    </tr>
                  ) : (
                    declaracaoDctf.debitos_json.map((deb, dIdx) => (
                      <tr key={dIdx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-[#0FA3A3]">{deb.origem}</td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {deb.codigo_receita}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-[#475569] max-w-xs">{deb.descricao}</td>
                        <td className="py-3.5 px-4 font-mono">R$ {deb.base_calculo.toFixed(2)}</td>
                        <td className="py-3.5 px-4 font-semibold text-[#64748B]">
                          {deb.aliquota}%
                        </td>
                        <td className="py-3.5 px-4 font-mono text-amber-700 font-semibold">
                          R$ {deb.valor_apurado.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                          R$ {deb.saldo_pagar.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Rodapé com Informações de Transmissão e Vínculos */}
            {declaracaoDctf?.status === 'transmitida' && (
              <div className="p-4 bg-emerald-50/60 border-t border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <p className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Declaração transmitida com sucesso em Modo Supervisão!</span>
                  </p>
                  <p className="text-[11px] text-emerald-800">
                    Protocolo: <b>{declaracaoDctf.protocolo_envio}</b> | Recibo:{' '}
                    <b>{declaracaoDctf.recibo_entrega}</b>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-200 text-emerald-900 text-xs font-semibold gap-1">
                    <LinkIcon className="h-3 w-3" />
                    <span>DARF Integrado ao Financeiro</span>
                  </Badge>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal: Visualizar XML do Reinf */}
      <Dialog open={modalXmlOpen} onOpenChange={setModalXmlOpen}>
        <DialogContent className="max-w-3xl rounded-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <FileCode2 className="h-5 w-5 text-[#0FA3A3]" />
                  <span>
                    Estrutura XML Oficial — EFD-Reinf Layout {xmlVisualizando?.tipo_evento}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Padrão v2.01.02 da Receita Federal do Brasil (XSD schemas gov.br).
                </DialogDescription>
              </div>

              {xmlVisualizando && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBaixarXml(xmlVisualizando)}
                  className="rounded-xl text-xs gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Baixar XML</span>
                </Button>
              )}
            </div>
          </DialogHeader>

          {xmlVisualizando?.erros_validacao && xmlVisualizando.erros_validacao.length > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
              <p className="font-bold text-xs text-rose-800 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                <span>Pendências Cadastrais Impedindo Transmissão:</span>
              </p>
              <ul className="text-[11px] text-rose-700 list-disc list-inside space-y-0.5">
                {xmlVisualizando.erros_validacao.map((err, i) => (
                  <li key={i}>
                    <b>{err.campo}:</b> {err.mensagem} (<i>Ação: {err.acao}</i>)
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex-1 overflow-auto bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs">
            <pre className="whitespace-pre-wrap">{xmlVisualizando?.xml_gerado || ''}</pre>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalXmlOpen(false)}
              className="rounded-xl text-xs"
            >
              Fechar Visualizador
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Fechamento Reinf R-2099 */}
      <Dialog open={modalFechamentoReinfOpen} onOpenChange={setModalFechamentoReinfOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-emerald-600" />
              <span>Transmitir Evento R-2099 (Fechamento EFD-Reinf)</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Encerramento oficial das retenções da competência {selectedCompetencia}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <p className="text-[#475569]">
              Ao protocolar o evento R-2099, a competência <b>{selectedCompetencia}</b> será marcada
              como fechada no EFD-Reinf, liberando a dependência para a transmissão da DCTFWeb.
            </p>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Eventos Validados:</span>
                <span className="font-bold text-[#1A2333]">{reinfStats.transmitidos}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Pendências Remanescentes:</span>
                <span className="font-bold text-rose-600">{reinfStats.pendentes}</span>
              </div>
            </div>

            {reinfStats.pendentes > 0 && (
              <p className="text-rose-600 font-semibold text-[11px]">
                Atenção: Existem eventos com pendências. O EFD-Reinf pode rejeitar o fechamento caso
                haja cadastros ou notas de serviços inconsistentes.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalFechamentoReinfOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleFecharReinf}
              disabled={fechandoReinf || reinfStats.pendentes > 0}
              className="rounded-xl text-xs bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {fechandoReinf ? 'Fechando...' : 'Confirmar Fechamento R-2099'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Reabertura Reinf R-2098 */}
      <Dialog open={modalReaberturaReinfOpen} onOpenChange={setModalReaberturaReinfOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="h-5 w-5 text-amber-600" />
              <span>Reabrir Competência EFD-Reinf (R-2098)</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Libera a competência {selectedCompetencia} para retificação de retenções de notas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <p className="text-[#475569]">
              Conforme exigência do SPED/EFD-Reinf, a reabertura de eventos periódicos exige
              justificativa formal auditada.
            </p>

            <div>
              <Label className="text-xs font-semibold">
                Justificativa da Reabertura (Mínimo 10 caracteres)
              </Label>
              <Textarea
                value={motivoReabertura}
                onChange={(e) => setMotivoReabertura(e.target.value)}
                placeholder="Ex: Retificação de notas fiscais de tomadores de serviço com alíquota divergente..."
                className="mt-1 h-24 text-xs rounded-xl border-[#E2E8F0] resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalReaberturaReinfOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleReabrirReinf}
              disabled={reabrindoReinf || motivoReabertura.trim().length < 10}
              className="rounded-xl text-xs bg-amber-600 text-white hover:bg-amber-700"
            >
              {reabrindoReinf ? 'Transmitindo R-2098...' : 'Confirmar Reabertura'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Diagnóstico de Credenciais */}
      <Dialog open={modalDiagOpen} onOpenChange={setModalDiagOpen}>
        <DialogContent className="max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-500" />
              <span>Diagnóstico de Credenciais — Declarações Federais</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Validação item a item do Certificado Digital A1, senha, CNPJ transmissor e ambiente
              governamental.
            </DialogDescription>
          </DialogHeader>

          {testandoCredenciais ? (
            <div className="py-8 text-center space-y-3">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-[#0FA3A3]" />
              <p className="text-xs text-[#64748B]">Auditando certificado A1 e conectores...</p>
            </div>
          ) : diagResultado ? (
            <div className="space-y-4 py-2 text-xs">
              <div
                className={`p-3.5 rounded-xl border ${
                  diagResultado.certificado_ok && diagResultado.senha_ok
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  {diagResultado.certificado_ok && diagResultado.senha_ok ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  )}
                  <p className="font-bold text-sm">Status Geral: {diagResultado.status_geral}</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {diagResultado.detalhes.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    {item.sucesso ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="font-bold text-[#1A2333]">{item.item}</p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">{item.mensagem}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-slate-100 rounded-xl text-[11px] text-[#64748B] flex items-center justify-between">
                <span>
                  Modo Atual: <b>Supervisão Controlada (Sem Falso Sucesso)</b>
                </span>
                <span>
                  Ambiente: <b>{diagResultado.ambiente_comunicacao.toUpperCase()}</b>
                </span>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalDiagOpen(false)}
              className="rounded-xl text-xs"
            >
              Fechar Diagnóstico
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

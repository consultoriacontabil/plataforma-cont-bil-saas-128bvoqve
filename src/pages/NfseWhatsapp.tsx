import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  MessageSquare,
  Sparkles,
  FileCheck,
  CheckCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  Send,
  Building2,
  DollarSign,
  FileText,
  Filter,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Eye,
  Check,
  X,
  Code,
  Download,
  Radio,
  ExternalLink,
  ChevronRight,
  Info,
  Ban,
  ArrowRightLeft,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BadgeTransmissaoAutonomia } from '@/components/BadgeTransmissaoAutonomia'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import type {
  NfseConfigRecord,
  NfseSolicitacaoRecord,
  NfseNotaEmitidaRecord,
  Empresa,
} from '@/types'
import { nfseWhatsappService } from '@/services/nfseWhatsapp'
import { empresasService } from '@/services/empresas'
import { elisaOpsService } from '@/services/elisaOpsService'
import type {
  ProcessoOperacionalRecord,
  ProcessoEtapaRecord,
  ProcessoPendenciaRecord,
  ElisaEvidenciaRecord,
} from '@/services/elisaOpsService'
import { maskCnpj, maskCpf, formatDatePtBr, formatDateTimePtBr } from '@/lib/formatters'
import { PlayCircle, ShieldAlert, FileText as FileTextIcon } from 'lucide-react'

// Subcomponentes modais
import { NfseAprovacaoModal } from '@/components/NfseAprovacaoModal'
import { NfseRejeicaoModal } from '@/components/NfseRejeicaoModal'
import { NfseChatLogModal } from '@/components/NfseChatLogModal'
import { NfseVisualizadorModal } from '@/components/NfseVisualizadorModal'
import { NfseConfigTab } from '@/components/NfseConfigTab'
import { NfseCancelamentoModal } from '@/components/NfseCancelamentoModal'
import { WhatsAppAgentTab } from '@/components/WhatsAppAgentTab'
import { Bot } from 'lucide-react'

export default function NfseWhatsappPage() {
  const { tenant, user } = useAuth()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<
    'esteira_elliza' | 'modo_humano' | 'supervisao' | 'historico' | 'agente' | 'config'
  >('esteira_elliza')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Dados
  const [config, setConfig] = useState<NfseConfigRecord | null>(null)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [solicitacoes, setSolicitacoes] = useState<NfseSolicitacaoRecord[]>([])
  const [notasEmitidas, setNotasEmitidas] = useState<NfseNotaEmitidaRecord[]>([])

  // Dados do Processo Operacional POP-10 (Elliza Esteira)
  const [processoPop10, setProcessoPop10] = useState<ProcessoOperacionalRecord | null>(null)
  const [etapasPop10, setEtapasPop10] = useState<ProcessoEtapaRecord[]>([])
  const [pendenciasPop10, setPendenciasPop10] = useState<ProcessoPendenciaRecord[]>([])
  const [evidenciasPop10, setEvidenciasPop10] = useState<ElisaEvidenciaRecord[]>([])
  const [executandoAcaoElliza, setExecutandoAcaoElliza] = useState(false)
  const [gerandoRascunhoInterno, setGerandoRascunhoInterno] = useState(false)

  // Filtros da Fila
  const [statusFiltro, setStatusFiltro] = useState<string>('todos')
  const [buscaTexto, setBuscaTexto] = useState<string>('')

  // Filtro de Histórico por Status
  const [statusHistoricoFiltro, setStatusHistoricoFiltro] = useState<string>('todos')

  // Modais
  const [solicitacaoParaAprovar, setSolicitacaoParaAprovar] =
    useState<NfseSolicitacaoRecord | null>(null)
  const [dadosSubstituicao, setDadosSubstituicao] = useState<{
    notaSubstituidaId: string
    numeroNotaOriginal: number
    empresaId: string
    tomadorNome: string
    tomadorDocumento: string
    tomadorEmail?: string
    tomadorEndereco?: string
    descricaoServicos: string
    codigoServico?: string
    valorServicos: number
    aliquotaIss?: number
  } | null>(null)
  const [modalAprovarOpen, setModalAprovarOpen] = useState(false)

  const [solicitacaoParaRejeitar, setSolicitacaoParaRejeitar] =
    useState<NfseSolicitacaoRecord | null>(null)
  const [modalRejeitarOpen, setModalRejeitarOpen] = useState(false)

  const [solicitacaoParaChat, setSolicitacaoParaChat] = useState<NfseSolicitacaoRecord | null>(null)
  const [modalChatOpen, setModalChatOpen] = useState(false)

  const [notaParaVisualizar, setNotaParaVisualizar] = useState<NfseNotaEmitidaRecord | null>(null)
  const [modalDanfseOpen, setModalDanfseOpen] = useState(false)

  const [notaParaCancelar, setNotaParaCancelar] = useState<NfseNotaEmitidaRecord | null>(null)
  const [modalCancelarOpen, setModalCancelarOpen] = useState(false)

  const canEmit = user?.perfil === 'administrador' || user?.perfil === 'contador'

  // Carregar dados
  const loadData = async (silencioso = false) => {
    if (!tenant?.id) return
    if (!silencioso) setLoading(true)
    else setRefreshing(true)

    try {
      const [cfgRes, empRes, solRes, notasRes] = await Promise.all([
        nfseWhatsappService.getConfig(tenant.id),
        empresasService.list(tenant.id),
        nfseWhatsappService.listSolicitacoes(tenant.id),
        nfseWhatsappService.listNotasEmitidas(tenant.id),
      ])

      setConfig(cfgRes)
      setEmpresas(empRes)
      setSolicitacoes(solRes)
      setNotasEmitidas(notasRes)

      // Carregar processo do POP-10 na esteira da Elliza
      try {
        const processosList = await elisaOpsService.listProcessos(tenant.id)
        const procPop10 = processosList.find((p) => p.codigo_sop === 'POP-10')
        if (procPop10) {
          setProcessoPop10(procPop10)
          const [etapasList, pendList, evidList] = await Promise.all([
            elisaOpsService.listEtapas(procPop10.id),
            elisaOpsService.listPendencias(tenant.id, { processoId: procPop10.id }),
            elisaOpsService.listEvidencias(procPop10.id),
          ])
          setEtapasPop10(etapasList)
          setPendenciasPop10(pendList)
          setEvidenciasPop10(evidList)
        }
      } catch (errProc) {
        console.warn('Erro ao carregar processo POP-10:', errProc)
      }
    } catch (err) {
      console.error('Erro ao carregar módulo NFS-e WhatsApp:', err)
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar a fila de supervisão de NFS-e.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [tenant?.id])

  // Métricas para os Cards de Resumo
  const totalRecebidas = solicitacoes.length
  const emAnalise = solicitacoes.filter(
    (s) => s.status === 'em_analise' || s.status === 'erro_emissao',
  ).length
  const comErro = solicitacoes.filter((s) => s.status === 'erro_emissao').length
  const totalEmitidas = notasEmitidas.length
  const totalCanceladas = notasEmitidas.filter((n) => n.status === 'cancelada').length
  const totalSubstituidas = notasEmitidas.filter((n) => n.status === 'substituida').length
  // Valor emitido líquido considera apenas notas com status 'emitida'
  const valorTotalEmitidoLiquido = notasEmitidas
    .filter((n) => n.status === 'emitida')
    .reduce((acc, n) => acc + (n.valor_servicos || 0), 0)

  // Filtragem da Fila
  const solicitacoesFiltradas = useMemo(() => {
    return solicitacoes.filter((sol) => {
      if (statusFiltro !== 'todos' && sol.status !== statusFiltro) return false
      if (buscaTexto.trim()) {
        const q = buscaTexto.toLowerCase()
        const matchNome = sol.tomador_nome?.toLowerCase().includes(q)
        const matchDoc = sol.tomador_documento?.toLowerCase().includes(q)
        const matchContato = sol.contato_nome?.toLowerCase().includes(q)
        const matchMsg = sol.mensagem_original?.toLowerCase().includes(q)
        if (!matchNome && !matchDoc && !matchContato && !matchMsg) return false
      }
      return true
    })
  }, [solicitacoes, statusFiltro, buscaTexto])

  const empresaMap = useMemo(() => {
    const map = new Map<string, Empresa>()
    empresas.forEach((emp) => map.set(emp.id, emp))
    return map
  }, [empresas])

  // Filtragem do Histórico por Status
  const notasEmitidasFiltradas = useMemo(() => {
    return notasEmitidas.filter((nota) => {
      if (statusHistoricoFiltro === 'todos') return true
      return nota.status === statusHistoricoFiltro
    })
  }, [notasEmitidas, statusHistoricoFiltro])

  // Função para acionar o fluxo de substituição
  const handleIniciarSubstituicao = (notaOriginal: NfseNotaEmitidaRecord) => {
    setDadosSubstituicao({
      notaSubstituidaId: notaOriginal.id,
      numeroNotaOriginal: notaOriginal.numero_nota,
      empresaId: notaOriginal.empresa,
      tomadorNome: notaOriginal.tomador_nome,
      tomadorDocumento: notaOriginal.tomador_documento,
      tomadorEmail: notaOriginal.tomador_email,
      descricaoServicos: notaOriginal.discriminacao_servicos,
      codigoServico: notaOriginal.codigo_servico_municipal,
      valorServicos: notaOriginal.valor_servicos,
      aliquotaIss: notaOriginal.aliquota_iss,
    })
    setSolicitacaoParaAprovar(null)
    setModalAprovarOpen(true)
  }

  // Ações da Elliza: Executar Próxima Ação da Esteira
  const handleExecutarProximaAcaoElliza = async () => {
    if (!tenant?.id || !processoPop10) return
    setExecutandoAcaoElliza(true)
    toast({
      title: '🤖 Elliza Iniciando Execução',
      description: `Disparando próxima ação: "${processoPop10.proxima_acao || 'Execução determinística'}"...`,
    })

    try {
      const res = await elisaOpsService.executarProximaAcaoElisa({
        tenantId: tenant.id,
        processoId: processoPop10.id,
        empresaId: processoPop10.empresa_id,
      })

      if (res.sucesso) {
        toast({
          title: 'Etapa Validada com Sucesso!',
          description: res.mensagem,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Ação Retida (Segurança / Nível 3)',
          description: res.mensagem,
        })
      }
      await loadData(true)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro na execução da Elliza',
        description: String(err),
      })
    } finally {
      setExecutandoAcaoElliza(false)
    }
  }

  // Gerar rascunho determinístico sem depender de API de emissão
  const handleGerarRascunhoSolicitacao = async (sol: NfseSolicitacaoRecord) => {
    if (!tenant?.id || !sol.empresa) return
    setGerandoRascunhoInterno(true)
    try {
      const res = await nfseWhatsappService.gerarRascunhoElliza({
        tenantId: tenant.id,
        solicitacaoId: sol.id,
        empresaId: sol.empresa,
        tomadorNome: sol.tomador_nome || 'Tomador Não Informado',
        tomadorDocumento: sol.tomador_documento || '00.000.000/0000-00',
        tomadorEmail: sol.tomador_email,
        tomadorEndereco: sol.tomador_endereco,
        descricaoServicos: sol.descricao_servico || sol.mensagem_original,
        codigoServicoMunicipal: sol.codigo_servico || '01.07',
        valorServicos: sol.valor_servico || 100,
        aliquotaIss: 2.0,
        processoId: processoPop10?.id,
        usuarioId: user?.id,
      })

      toast({
        title: 'Rascunho Gerado pela Elliza!',
        description: res.mensagemRetorno,
      })
      await loadData(true)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar rascunho',
        description: String(err),
      })
    } finally {
      setGerandoRascunhoInterno(false)
    }
  }

  // Ações do Modo Humano: Aprovar
  const handleModoHumanoAprovar = async (pend: ProcessoPendenciaRecord) => {
    if (!tenant?.id || !processoPop10) return
    try {
      if (pend.etapa_id) {
        await elisaOpsService.updateEtapa(pend.etapa_id, {
          status: 'APROVADO',
          aprovado_por: user?.name || user?.email || 'Contador Responsável CRC',
          observacao: 'Aprovado via Modo Humano da esteira NFS-e.',
        })
      }
      await elisaOpsService.resolverPendencia(
        pend.id,
        'APROVAR',
        `Aprovado por ${user?.name || user?.email || 'Contador'} no Modo Humano.`,
        user?.id,
      )
      await elisaOpsService.updateProcesso(processoPop10.id, {
        status: 'ENFILEIRADO',
        decisao_necessaria_humana: '',
      })
      toast({
        title: 'Aprovação Registrada!',
        description:
          'Chancela contábil Nível 3 concedida. Elliza pode prosseguir para a etapa seguinte.',
      })
      await loadData(true)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao aprovar',
        description: String(err),
      })
    }
  }

  // Ações do Modo Humano: Rejeitar
  const handleModoHumanoRejeitar = async (pend: ProcessoPendenciaRecord) => {
    if (!processoPop10) return
    try {
      await elisaOpsService.resolverPendencia(
        pend.id,
        'REJEITAR',
        `Rejeitado pelo contador: dados fiscais requerem retificação pelo cliente.`,
        user?.id,
      )
      await elisaOpsService.updateProcesso(processoPop10.id, {
        status: 'AGUARDANDO_CLIENTE',
        decisao_necessaria_humana: 'Rejeitado pelo contador: aguardando reenvio de dados corretos.',
      })
      toast({
        title: 'Solicitação Rejeitada',
        description: 'Processo colocado em status AGUARDANDO_CLIENTE para retificação.',
      })
      await loadData(true)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao rejeitar',
        description: String(err),
      })
    }
  }

  // Ações do Modo Humano: Devolver para Elliza
  const handleModoHumanoDevolverParaElliza = async (pend: ProcessoPendenciaRecord) => {
    if (!processoPop10) return
    try {
      if (pend.etapa_id) {
        await elisaOpsService.updateEtapa(pend.etapa_id, {
          status: 'ENFILEIRADO',
          observacao: 'Devolvido para a Elliza reprocessar cálculos fiscais.',
        })
      }
      await elisaOpsService.resolverPendencia(
        pend.id,
        'DEVOLVER_ELISA',
        'Devolvido pelo contador para a Elliza reanalisar parâmetros tributários.',
        user?.id,
      )
      await elisaOpsService.updateProcesso(processoPop10.id, {
        status: 'ENFILEIRADO',
        decisao_necessaria_humana: '',
      })
      toast({
        title: 'Devolvido para a Elliza!',
        description: 'O processo voltou para a fila de execução automatizada da Elliza.',
      })
      await loadData(true)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao devolver para a Elliza',
        description: String(err),
      })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header com Contexto do Framework */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-[#1A2333]">
              Emissão Inteligente de NFS-e via WhatsApp
            </h2>
            <Badge className="bg-[#0FA3A3] text-white text-[10px] font-bold">
              FRAMEWORK INTEGRADO
            </Badge>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Fluxo automatizado de ponta a ponta: Webhook & Bot ➔ Motor Cognitivo IA ➔ Painel de
            Supervisão ➔ API Fiscal ➔ Retorno ao WhatsApp
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Badge de Transmissão e Autonomia Coerente */}
          <BadgeTransmissaoAutonomia
            tipo={config?.provedor_fiscal === 'nfeio' ? 'nfeio' : 'certificado_a1'}
            isCredenciado={
              config?.provedor_fiscal === 'nfeio'
                ? !!(config?.nfeio_api_key?.trim() && config?.nfeio_company_id?.trim())
                : config?.modo_operacao === 'producao' &&
                  !!(config?.govbr_client_id && config?.govbr_client_secret)
            }
            configUrl="/nfse-whatsapp"
            size="md"
          />

          <Badge
            variant="outline"
            className="text-xs py-1 px-2.5 font-medium flex items-center gap-1.5 shadow-xs bg-slate-50 text-slate-800 border-slate-300"
          >
            <Radio className="h-3 w-3 text-[#0FA3A3] animate-pulse" />
            <span>Provedor: {(config?.provedor_fiscal || 'governacional').toUpperCase()}</span>
          </Badge>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={loading || refreshing}
            className="text-xs gap-1.5 h-8"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Arquitetura Visual em Banner das 8 Etapas */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <span className="text-xs font-bold text-[#1A2333] uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-[#0FA3A3]" />
            Arquitetura Operacional do Módulo
          </span>
          <span className="text-[11px] text-[#64748B]">
            Etapas numeradas conforme arquitetura oficial
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-center">
          <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-2.5 text-left">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#0FA3A3]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0FA3A3] text-white text-[10px]">
                1
              </span>
              WhatsApp In
            </div>
            <p className="text-[10px] text-[#475569] mt-1 leading-tight">
              Cliente envia solicitação de emissão via WhatsApp.
            </p>
          </div>

          <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-2.5 text-left">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#0FA3A3]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0FA3A3] text-white text-[10px]">
                2
              </span>
              Motor IA
            </div>
            <p className="text-[10px] text-[#475569] mt-1 leading-tight">
              Extrai tomador, CNPJ, valor e gera score de confiança.
            </p>
          </div>

          <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-2.5 text-left">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#0FA3A3]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0FA3A3] text-white text-[10px]">
                3 & 4
              </span>
              Supervisão
            </div>
            <p className="text-[10px] text-[#475569] mt-1 leading-tight">
              Contador confere na tela, edita dados ou rejeita.
            </p>
          </div>

          <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-2.5 text-left">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#0FA3A3]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0FA3A3] text-white text-[10px]">
                5
              </span>
              Engine Fiscal
            </div>
            <p className="text-[10px] text-[#475569] mt-1 leading-tight">
              Emissão da NFS-e (Gov.br / Betha / Ginfes).
            </p>
          </div>

          <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-2.5 text-left">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#0FA3A3]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0FA3A3] text-white text-[10px]">
                6
              </span>
              XML / PDF
            </div>
            <p className="text-[10px] text-[#475569] mt-1 leading-tight">
              Gera DANFSE e XML oficial ABRASF para download.
            </p>
          </div>

          <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-2.5 text-left">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#0FA3A3]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0FA3A3] text-white text-[10px]">
                8
              </span>
              WhatsApp Out
            </div>
            <p className="text-[10px] text-[#475569] mt-1 leading-tight">
              Devolve confirmação com número da nota e link do PDF.
            </p>
          </div>
        </div>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
              Mensagens Recebidas
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-[#0FA3A3]">
              <MessageSquare className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1A2333]">{totalRecebidas}</div>
            <p className="text-[11px] text-[#94A3B8] mt-1">Via Webhook Evolution / Baileys</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
              Solicitações em Análise
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{emAnalise}</div>
            <p className="text-[11px] text-[#94A3B8] mt-1">Aguardando supervisão contábil</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
              Notas Fiscais
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <FileCheck className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-600">
                {notasEmitidas.filter((n) => n.status === 'emitida').length}
              </span>
              <span className="text-xs text-[#64748B]">autorizadas</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#64748B] mt-1">
              <span>{totalCanceladas} canceladas</span>
              {totalSubstituidas > 0 && <span>• {totalSubstituidas} substituídas</span>}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
              Faturamento Líquido (Emitido)
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1A2333]">
              {valorTotalEmitidoLiquido.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-1">Exclui notas canceladas/substituídas</p>
          </CardContent>
        </Card>
      </div>

      {/* Navegação por Abas */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="esteira_elliza" className="text-xs font-semibold rounded-lg gap-2">
            <Bot className="h-3.5 w-3.5 text-[#0FA3A3]" />
            Esteira Elliza (POP-10)
            <Badge className="bg-[#0FA3A3] text-white text-[9px] px-1.5 py-0 h-4">24/7</Badge>
          </TabsTrigger>

          <TabsTrigger value="modo_humano" className="text-xs font-semibold rounded-lg gap-2">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
            Modo Humano (Nível 3)
            {pendenciasPop10.filter((p) => p.status === 'aberta').length > 0 && (
              <Badge className="bg-amber-500 text-white text-[10px] ml-1 px-1.5 py-0 h-4 animate-pulse">
                {pendenciasPop10.filter((p) => p.status === 'aberta').length}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="supervisao" className="text-xs font-semibold rounded-lg gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            Fila de Pedidos WhatsApp
            {emAnalise > 0 && (
              <Badge className="bg-amber-500 text-white text-[10px] ml-1 px-1.5 py-0 h-4">
                {emAnalise}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="historico" className="text-xs font-semibold rounded-lg gap-2">
            <FileText className="h-3.5 w-3.5" />
            Notas & GED
            <Badge variant="outline" className="text-[10px] ml-1 px-1.5 py-0 h-4">
              {totalEmitidas}
            </Badge>
          </TabsTrigger>

          <TabsTrigger value="agente" className="text-xs font-semibold rounded-lg gap-2">
            <Bot className="h-3.5 w-3.5 text-[#0FA3A3]" />
            Agente IA (WhatsApp)
            <Badge className="bg-teal-500 text-white text-[9px] px-1.5 py-0 h-4">NATIVO</Badge>
          </TabsTrigger>

          <TabsTrigger value="config" className="text-xs font-semibold rounded-lg gap-2">
            <Settings className="h-3.5 w-3.5" />
            Configuração do Canal
          </TabsTrigger>
        </TabsList>

        {/* ABA: ESTEIRA ELLIZA (POP-10) */}
        <TabsContent value="esteira_elliza" className="space-y-4 pt-2">
          {processoPop10 ? (
            <div className="space-y-4">
              {/* Contexto da Execução do Processo (Item Obrigatório da Arquitetura) */}
              <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge className="bg-[#0FA3A3] text-white text-xs font-bold">
                        {processoPop10.codigo_sop || 'POP-10'} • {processoPop10.area.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-slate-600 text-xs">
                        Competência: {processoPop10.competencia}
                      </Badge>
                      <Badge
                        className={`text-xs font-bold ${
                          processoPop10.status === 'CONCLUIDO'
                            ? 'bg-emerald-600 text-white'
                            : processoPop10.status === 'AGUARDANDO_APROVACAO'
                              ? 'bg-amber-500 text-white animate-pulse'
                              : 'bg-blue-600 text-white'
                        }`}
                      >
                        Status: {processoPop10.status.replace('_', ' ')}
                      </Badge>
                      <Badge className="bg-purple-100 text-purple-800 text-xs font-semibold">
                        Nível 3 (Aprovação Obrigatória do Contador)
                      </Badge>
                    </div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">
                      {processoPop10.titulo}
                    </h1>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">Progresso da Esteira</span>
                    <div className="text-2xl font-black text-[#0FA3A3] mt-0.5">
                      {processoPop10.progresso_percentual || 0}%
                    </div>
                  </div>
                </div>

                {/* Grid dos 7 parâmetros de Contexto */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 pt-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Cliente
                    </span>
                    <span className="font-bold text-slate-800 truncate block">
                      {empresaMap.get(processoPop10.empresa_id)?.nome_fantasia ||
                        empresaMap.get(processoPop10.empresa_id)?.razao_social ||
                        'LRN Serviços Médicos / Inovatech'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      CNPJ
                    </span>
                    <span className="font-mono text-slate-700">
                      {empresaMap.get(processoPop10.empresa_id)?.cnpj
                        ? maskCnpj(empresaMap.get(processoPop10.empresa_id)!.cnpj)
                        : '12.345.678/0001-90'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Competência
                    </span>
                    <span className="font-semibold text-slate-800">
                      {processoPop10.competencia}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Processo
                    </span>
                    <span className="font-semibold text-slate-800 truncate block">
                      {processoPop10.titulo}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Etapa Atual
                    </span>
                    <span className="font-bold text-[#0FA3A3]">
                      {processoPop10.etapa_atual_numero || 4} de {processoPop10.total_etapas || 6}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Status
                    </span>
                    <span className="font-bold text-slate-800">
                      {processoPop10.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Agente
                    </span>
                    <span className="font-bold text-slate-900 flex items-center gap-1">
                      <Bot className="h-3.5 w-3.5 text-[#0FA3A3]" />
                      {processoPop10.agente_responsavel || 'Elliza'}
                    </span>
                  </div>
                </div>
              </Card>

              {/* BLOCO "🤖 AÇÕES DA ELLIZA" */}
              <Card className="rounded-2xl border-2 border-teal-500/40 bg-gradient-to-br from-teal-50/50 via-white to-cyan-50/30 p-5 shadow-xs">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-teal-100 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0FA3A3] text-white shadow-xs shrink-0 mt-0.5">
                      <Bot className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-slate-900">
                          🤖 Ações da Elliza — Piloto Automático Sem API Externa
                        </h3>
                        <Badge className="bg-teal-100 text-teal-800 text-[10px] font-bold">
                          Status: {processoPop10.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        A Elliza recebe os pedidos pelo WhatsApp, valida dados tributários, monta o
                        rascunho determinístico no GED e só emite/formaliza após chancela no Modo
                        Humano.
                      </p>
                    </div>
                  </div>

                  {/* BOTÃO PRINCIPAL OBRIGATÓRIO: [ EXECUTAR PRÓXIMA AÇÃO ] */}
                  {processoPop10.status !== 'CONCLUIDO' && (
                    <Button
                      size="lg"
                      disabled={executandoAcaoElliza}
                      onClick={handleExecutarProximaAcaoElliza}
                      className="h-11 px-6 bg-[#0FA3A3] hover:bg-[#0c8282] text-white font-extrabold text-xs shadow-md gap-2 rounded-xl"
                    >
                      <PlayCircle
                        className={`h-4 w-4 ${executandoAcaoElliza ? 'animate-spin' : ''}`}
                      />
                      <span>
                        {executandoAcaoElliza ? 'EXECUTANDO AÇÃO...' : '[ EXECUTAR PRÓXIMA AÇÃO ]'}
                      </span>
                    </Button>
                  )}
                </div>

                {/* Grid da Ação Atual */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 text-xs">
                  <div className="rounded-xl bg-white border border-slate-200 p-3 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Etapa Atual
                    </span>
                    <span className="font-bold text-slate-900 block mt-0.5">
                      {processoPop10.etapa_atual_nome || 'Aguardando início'}
                    </span>
                  </div>

                  <div className="rounded-xl bg-white border border-slate-200 p-3 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-teal-700 block">
                      Próxima Ação
                    </span>
                    <span
                      className="font-semibold text-slate-800 block mt-0.5 line-clamp-2"
                      title={processoPop10.proxima_acao}
                    >
                      {processoPop10.proxima_acao || 'Nenhuma ação pendente'}
                    </span>
                  </div>

                  <div className="rounded-xl bg-white border border-slate-200 p-3 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Critério de Sucesso
                    </span>
                    <span
                      className="text-slate-700 block mt-0.5 line-clamp-2"
                      title={processoPop10.criterio_sucesso_atual}
                    >
                      {processoPop10.criterio_sucesso_atual ||
                        'Validação fiscal e cálculo de retenções'}
                    </span>
                  </div>

                  <div className="rounded-xl bg-white border border-slate-200 p-3 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Última Ação Executada
                    </span>
                    <span
                      className="text-emerald-700 font-medium block mt-0.5 line-clamp-2"
                      title={processoPop10.resultado_ultima_acao}
                    >
                      {processoPop10.resultado_ultima_acao || 'Aguardando primeira execução'}
                    </span>
                  </div>
                </div>

                {/* Alerta de Modo Humano Nível 3 */}
                {processoPop10.status === 'AGUARDANDO_APROVACAO' && (
                  <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <div>
                        <span className="text-amber-900 font-bold block">
                          Parada de Segurança Nível 3: Aprovação Obrigatória do Contador
                        </span>
                        <span className="text-amber-800 text-[11px]">
                          {processoPop10.decisao_necessaria_humana ||
                            'O rascunho determinístico está pronto no GED. O contador deve homologar na aba Modo Humano.'}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setActiveTab('modo_humano')}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 font-bold shrink-0 gap-1.5"
                    >
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Ir para o Modo Humano
                    </Button>
                  </div>
                )}
              </Card>

              {/* Checklist das 6 Etapas do POP-10 */}
              <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <FileTextIcon className="h-4 w-4 text-[#0FA3A3]" />
                      Checklist Executável do POP-10: Emissão Inteligente de NFS-e
                    </h4>
                    <p className="text-xs text-slate-500">
                      Ciclo operacional completo da Elliza: WhatsApp In ➔ Validação ➔ Rascunho no
                      GED ➔ Modo Humano ➔ Formalização/Emissão ➔ WhatsApp Out.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {etapasPop10.filter((e) => e.status === 'CONCLUIDO').length} de{' '}
                    {etapasPop10.length || 6} Concluídas
                  </Badge>
                </div>

                <div className="space-y-2.5">
                  {etapasPop10.map((et) => {
                    const isConcluida = et.status === 'CONCLUIDO'
                    const isAguardandoAprov = et.status === 'AGUARDANDO_APROVACAO'
                    const isExecutando = et.status === 'EM_EXECUCAO'

                    return (
                      <div
                        key={et.id}
                        className={`rounded-xl border p-3.5 transition-all ${
                          isConcluida
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : isAguardandoAprov
                              ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-300'
                              : isExecutando
                                ? 'bg-teal-50/30 border-[#0FA3A3]'
                                : 'bg-slate-50/50 border-slate-200'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                                isConcluida
                                  ? 'bg-emerald-600 text-white'
                                  : isAguardandoAprov
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {et.ordem}
                            </span>
                            <span className="font-bold text-xs text-slate-900">{et.titulo}</span>
                            <Badge
                              className={`text-[9px] font-bold ${
                                isConcluida
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isAguardandoAprov
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {et.status}
                            </Badge>
                            <Badge variant="outline" className="text-[9px] text-slate-600">
                              Agente: {et.responsavel_tipo}
                            </Badge>
                            {et.requer_aprovacao && (
                              <Badge className="bg-amber-100 text-amber-800 text-[9px]">
                                Nível 3 (Contador)
                              </Badge>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-500">
                            {et.resultado ? (
                              <span className="text-emerald-700 font-medium truncate max-w-xs block">
                                ✓ {et.resultado}
                              </span>
                            ) : (
                              <span>Próxima: {et.proxima_etapa_nome || '—'}</span>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-slate-600 mt-2 pl-8 leading-relaxed">
                          {et.descricao}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </Card>

              {/* Evidências com Hash SHA-256 Gravadas pela Elliza */}
              <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[#0FA3A3]" />
                    Trilha de Auditoria e Evidências com Hash SHA-256
                  </h4>
                  <Badge variant="outline" className="text-xs">
                    {evidenciasPop10.length} Registro(s) Imutável(is)
                  </Badge>
                </div>

                <div className="space-y-2">
                  {evidenciasPop10.length === 0 ? (
                    <p className="text-xs text-slate-500 py-3 text-center">
                      Nenhuma evidência registrada ainda.
                    </p>
                  ) : (
                    evidenciasPop10.map((evid) => (
                      <div
                        key={evid.id}
                        className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{evid.titulo}</span>
                          <span className="font-mono text-[10px] text-slate-500">
                            Protocolo: {evid.protocolo_numero}
                          </span>
                        </div>
                        <p className="text-slate-600 text-[11px]">{evid.descricao}</p>
                        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-200/60 text-[10px]">
                          <span className="text-slate-500">
                            Executado por: <b>{evid.executado_por}</b>
                          </span>
                          <span className="text-slate-500 font-mono">Hash: {evid.hash_sha256}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          ) : (
            <Card className="p-8 text-center text-slate-500">
              <p className="text-sm">Nenhum processo do POP-10 localizado para este tenant.</p>
            </Card>
          )}
        </TabsContent>

        {/* ABA: MODO HUMANO (NÍVEL 3) */}
        <TabsContent value="modo_humano" className="space-y-4 pt-2">
          <Card className="rounded-2xl border-2 border-amber-300 bg-amber-50/40 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Modo Humano — Central de Decisão e Chancela do Contador (Nível 3)
                  </h3>
                  <p className="text-xs text-slate-600">
                    Por conformidade com as diretivas do CFC, notas fiscais e obrigações Nível 3
                    nunca são transmitidas sem chancela técnica humana expressa.
                  </p>
                </div>
              </div>

              <Badge className="bg-amber-600 text-white text-xs">
                {pendenciasPop10.filter((p) => p.status === 'aberta').length} Pendência(s) Aberta(s)
              </Badge>
            </div>

            <div className="space-y-3">
              {pendenciasPop10.filter((p) => p.status === 'aberta').length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center text-emerald-800 space-y-1">
                  <CheckCircle className="h-6 w-6 mx-auto text-emerald-600" />
                  <p className="text-xs font-bold">Nenhuma pendência no Modo Humano no momento!</p>
                  <p className="text-[11px] text-emerald-700">
                    Todas as solicitações da esteira foram revisadas ou estão sob execução
                    determinística da Elliza.
                  </p>
                </div>
              ) : (
                pendenciasPop10
                  .filter((p) => p.status === 'aberta')
                  .map((pend) => (
                    <Card
                      key={pend.id}
                      className="rounded-xl border border-amber-300 bg-white p-4 shadow-2xs space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-amber-500 text-white text-[10px] font-bold">
                              NÍVEL 3 • REQUER CHANCELA
                            </Badge>
                            <h4 className="font-bold text-sm text-slate-900">{pend.titulo}</h4>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            <b>Motivo da Parada:</b> {pend.por_que_parou}
                          </p>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            <b>O que a Elliza executou:</b> {pend.o_que_foi_executado}
                          </p>
                          <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <b>Decisão Necessária:</b> {pend.decisao_necessaria}
                          </p>
                        </div>
                      </div>

                      {/* Quatro Botões do Modo Humano Conforme Especificado */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleModoHumanoDevolverParaElliza(pend)}
                          className="text-xs text-slate-700 border-slate-300 hover:bg-slate-100 gap-1.5 h-8"
                          title="Devolver para a Elliza recalcular ou reanalisar os parâmetros"
                        >
                          <RefreshCw className="h-3.5 w-3.5 text-[#0FA3A3]" />[ DEVOLVER PARA ELLIZA
                          ]
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (solicitacoes.length > 0) {
                              setSolicitacaoParaAprovar(solicitacoes[0])
                              setModalAprovarOpen(true)
                            }
                          }}
                          className="text-xs text-blue-700 border-blue-300 hover:bg-blue-50 gap-1.5 h-8"
                          title="Editar dados fiscais manualmente na interface"
                        >
                          <Code className="h-3.5 w-3.5" />[ CORRIGIR ]
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleModoHumanoRejeitar(pend)}
                          className="text-xs text-rose-700 border-rose-300 hover:bg-rose-50 gap-1.5 h-8"
                          title="Rejeitar a solicitação e solicitar reenvio pelo cliente"
                        >
                          <X className="h-3.5 w-3.5" />[ REJEITAR ]
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => handleModoHumanoAprovar(pend)}
                          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 h-8 shadow-xs"
                          title="Aprovar formalização/emissão da nota e envio pelo WhatsApp"
                        >
                          <Check className="h-3.5 w-3.5" />[ APROVAR ]
                        </Button>
                      </div>
                    </Card>
                  ))
              )}
            </div>
          </Card>
        </TabsContent>

        {/* ABA 1: FILA DE SUPERVISÃO */}
        <TabsContent value="supervisao" className="space-y-4 pt-2">
          {/* Barra de Filtros e Busca */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8]" />
              <Input
                placeholder="Buscar por tomador, CNPJ, contato ou texto original..."
                value={buscaTexto}
                onChange={(e) => setBuscaTexto(e.target.value)}
                className="h-8 pl-8 text-xs bg-slate-50 border-slate-200"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#64748B] font-medium hidden sm:inline">Status:</span>
              <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="text-xs">
                    Todos os Status
                  </SelectItem>
                  <SelectItem value="em_analise" className="text-xs">
                    Em Análise
                  </SelectItem>
                  <SelectItem value="erro_emissao" className="text-xs text-rose-600 font-semibold">
                    Erro / Rejeição Provedor
                  </SelectItem>
                  <SelectItem value="emitida" className="text-xs">
                    Emitida
                  </SelectItem>
                  <SelectItem value="rejeitada" className="text-xs">
                    Rejeitada
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabela da Fila de Supervisão */}
          <Card className="rounded-2xl border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs font-bold text-[#1A2333] w-48">
                      Contato / Horário
                    </TableHead>
                    <TableHead className="text-xs font-bold text-[#1A2333]">
                      Dados Extraídos (IA) vs Original
                    </TableHead>
                    <TableHead className="text-xs font-bold text-[#1A2333] w-32">Valor</TableHead>
                    <TableHead className="text-xs font-bold text-[#1A2333] w-28">
                      Confiança
                    </TableHead>
                    <TableHead className="text-xs font-bold text-[#1A2333] w-28">Status</TableHead>
                    <TableHead className="text-xs font-bold text-[#1A2333] text-right w-44">
                      Ações de Supervisão
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {solicitacoesFiltradas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center text-xs text-[#94A3B8]">
                        Nenhuma solicitação encontrada para os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    solicitacoesFiltradas.map((sol) => {
                      const temAlertas = sol.alertas_json && sol.alertas_json.length > 0
                      const score = sol.score_confianca || 0

                      return (
                        <TableRow key={sol.id} className="hover:bg-slate-50/70 transition-colors">
                          <TableCell className="align-top py-3.5">
                            <div className="font-semibold text-xs text-[#1A2333]">
                              {sol.contato_nome}
                            </div>
                            <div className="text-[11px] text-[#64748B] font-mono">
                              {sol.contato_telefone}
                            </div>
                            <div className="text-[10px] text-[#94A3B8] mt-1 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDateTimePtBr(sol.created)}
                            </div>
                          </TableCell>

                          <TableCell className="align-top py-3.5 max-w-md">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[#1A2333]">
                                  {sol.tomador_nome || 'Tomador não identificado'}
                                </span>
                                {sol.tomador_documento && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] font-mono bg-slate-50"
                                  >
                                    {sol.tomador_documento}
                                  </Badge>
                                )}
                              </div>

                              <p className="text-[11px] text-[#64748B] line-clamp-2">
                                {sol.descricao_servico || sol.mensagem_original}
                              </p>

                              {/* Alertas de inconsistência */}
                              {temAlertas && (
                                <div className="space-y-1 pt-1">
                                  {sol.alertas_json?.map((al, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center gap-1.5 text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md"
                                    >
                                      <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                                      <span>{al.mensagem}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="align-top py-3.5">
                            <div className="font-bold text-xs text-[#1A2333]">
                              {(sol.valor_servico || 0).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </div>
                            <div className="text-[10px] text-[#94A3B8]">
                              Cód: {sol.codigo_servico || '01.07'}
                            </div>
                          </TableCell>

                          <TableCell className="align-top py-3.5">
                            <Badge
                              className={
                                score >= 85
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : score >= 60
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                              }
                            >
                              {score}%
                            </Badge>
                          </TableCell>

                          <TableCell className="align-top py-3.5">
                            <Badge
                              variant="outline"
                              className={
                                sol.status === 'emitida'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : sol.status === 'em_analise'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : sol.status === 'erro_emissao'
                                      ? 'bg-rose-100 text-rose-800 border-rose-300 font-semibold'
                                      : sol.status === 'rejeitada'
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : 'bg-slate-50 text-slate-700'
                              }
                            >
                              {sol.status === 'em_analise'
                                ? 'Em Análise'
                                : sol.status === 'erro_emissao'
                                  ? 'Erro Transmissão'
                                  : sol.status === 'emitida'
                                    ? 'Emitida'
                                    : sol.status === 'rejeitada'
                                      ? 'Rejeitada'
                                      : sol.status}
                            </Badge>{' '}
                          </TableCell>

                          <TableCell className="align-top py-3.5 text-right space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSolicitacaoParaChat(sol)
                                setModalChatOpen(true)
                              }}
                              className="h-8 px-2 text-xs text-[#64748B] hover:text-[#0FA3A3]"
                              title="Ver histórico de mensagens e responder no chat"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </Button>

                            {(sol.status === 'em_analise' || sol.status === 'erro_emissao') &&
                              canEmit && (
                                <>
                                  {/* Botão Rascunho Elliza no GED */}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={gerandoRascunhoInterno}
                                    onClick={() => handleGerarRascunhoSolicitacao(sol)}
                                    className="h-8 px-2 text-[11px] text-teal-700 border-teal-300 hover:bg-teal-50"
                                    title="Montar Rascunho da NFS-e e formalizar no GED sem API externa"
                                  >
                                    <Bot className="h-3 w-3 mr-1 text-[#0FA3A3]" />
                                    Rascunho GED
                                  </Button>

                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSolicitacaoParaRejeitar(sol)
                                      setModalRejeitarOpen(true)
                                    }}
                                    className="h-8 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                    title="Rejeitar com motivo de inconsistência"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>

                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setSolicitacaoParaAprovar(sol)
                                      setModalAprovarOpen(true)
                                    }}
                                    className={`h-8 px-2.5 text-xs text-white gap-1 ${
                                      sol.status === 'erro_emissao'
                                        ? 'bg-amber-600 hover:bg-amber-700'
                                        : 'bg-[#0FA3A3] hover:bg-[#0d8c8c]'
                                    }`}
                                    title={
                                      sol.status === 'erro_emissao'
                                        ? 'Retentar envio após erro no provedor'
                                        : 'Aprovar e emitir NFS-e'
                                    }
                                  >
                                    {sol.status === 'erro_emissao' ? (
                                      <>
                                        <RefreshCw className="h-3.5 w-3.5" />
                                        Retentar
                                      </>
                                    ) : (
                                      <>
                                        <Check className="h-3.5 w-3.5" />
                                        Emitir
                                      </>
                                    )}
                                  </Button>
                                </>
                              )}

                            {sol.status === 'emitida' && (
                              <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">
                                Concluída
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ABA 2: HISTÓRICO DE NOTAS EMITIDAS */}
        <TabsContent value="historico" className="space-y-4 pt-2">
          {/* Barra de Filtros do Histórico */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-[#1A2333]">
                Histórico & Gestão do Ciclo de Vida da NFS-e
              </h3>
              <p className="text-xs text-[#64748B]">
                Acompanhamento de emissões, cancelamentos municipais/Gov.br e notas substitutas.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#64748B] font-medium hidden sm:inline">Status:</span>
              <Select value={statusHistoricoFiltro} onValueChange={setStatusHistoricoFiltro}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue placeholder="Filtrar status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="text-xs">
                    Todos ({notasEmitidas.length})
                  </SelectItem>
                  <SelectItem value="emitida" className="text-xs text-emerald-700 font-semibold">
                    Autorizadas ({notasEmitidas.filter((n) => n.status === 'emitida').length})
                  </SelectItem>
                  <SelectItem value="cancelada" className="text-xs text-rose-700 font-semibold">
                    Canceladas ({totalCanceladas})
                  </SelectItem>
                  <SelectItem value="substituida" className="text-xs text-indigo-700 font-semibold">
                    Substituídas ({totalSubstituidas})
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="rounded-2xl border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs font-bold text-[#1A2333] w-32">
                      Nº Nota / Provedor
                    </TableHead>
                    <TableHead className="text-xs font-bold text-[#1A2333] w-28">Status</TableHead>
                    <TableHead className="text-xs font-bold text-[#1A2333] w-36">
                      Emissão / Comp.
                    </TableHead>
                    <TableHead className="text-xs font-bold text-[#1A2333]">
                      Empresa Prestadora
                    </TableHead>
                    <TableHead className="text-xs font-bold text-[#1A2333]">
                      Tomador de Serviços
                    </TableHead>
                    <TableHead className="text-xs font-bold text-[#1A2333] text-right">
                      Valor Serviços
                    </TableHead>
                    <TableHead className="text-xs font-bold text-[#1A2333] text-right">
                      ISS / Líquido
                    </TableHead>
                    <TableHead className="text-xs font-bold text-[#1A2333] text-right w-52">
                      Ações Fiscais
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {notasEmitidasFiltradas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center text-xs text-[#94A3B8]">
                        Nenhuma nota fiscal encontrada para o filtro selecionado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    notasEmitidasFiltradas.map((nota) => {
                      const emp = empresaMap.get(nota.empresa)
                      const isCancelada = nota.status === 'cancelada'
                      const isSubstituida = nota.status === 'substituida'
                      const isAutorizada = nota.status === 'emitida'

                      const provedorEtiqueta =
                        nota.provedor_usado === 'betha'
                          ? 'Betha (Curitiba)'
                          : nota.provedor_usado === 'ginfes'
                            ? 'Ginfes (Campinas)'
                            : 'Gov.br Nacional'

                      return (
                        <TableRow
                          key={nota.id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isCancelada
                              ? 'bg-rose-50/30 text-slate-500'
                              : isSubstituida
                                ? 'bg-indigo-50/30'
                                : ''
                          }`}
                        >
                          <TableCell className="align-middle">
                            <span
                              className={`font-bold text-xs font-mono ${
                                isCancelada
                                  ? 'line-through text-rose-700'
                                  : isSubstituida
                                    ? 'text-indigo-700'
                                    : 'text-[#0284C7]'
                              }`}
                            >
                              Nº {nota.numero_nota}
                            </span>
                            <div className="text-[10px] text-[#94A3B8] font-mono">
                              Cód: {nota.codigo_verificacao}
                            </div>
                            <div className="text-[9px] font-semibold text-slate-600 mt-0.5">
                              {provedorEtiqueta}
                            </div>
                          </TableCell>

                          <TableCell className="align-middle">
                            {isAutorizada && (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                                Autorizada
                              </Badge>
                            )}

                            {isCancelada && (
                              <div className="space-y-1">
                                <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] flex items-center gap-1 w-fit">
                                  <Ban className="h-3 w-3" />
                                  Cancelada
                                </Badge>
                                {nota.data_cancelamento && (
                                  <div className="text-[9px] text-rose-700">
                                    Em: {formatDatePtBr(nota.data_cancelamento)}
                                  </div>
                                )}
                              </div>
                            )}

                            {isSubstituida && (
                              <div className="space-y-1">
                                <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300 text-[10px] flex items-center gap-1 w-fit">
                                  <ArrowRightLeft className="h-3 w-3" />
                                  Substituída
                                </Badge>
                                {nota.nota_substituta_id && (
                                  <div className="text-[9px] text-indigo-700 font-mono">
                                    Subst. gerada
                                  </div>
                                )}
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="align-middle">
                            <div className="text-xs text-[#1A2333] font-medium">
                              {formatDatePtBr(nota.data_emissao)}
                            </div>
                            <div className="text-[10px] text-[#64748B]">
                              Comp: {nota.competencia}
                            </div>
                          </TableCell>

                          <TableCell className="align-middle">
                            <div className="text-xs font-medium text-[#1A2333]">
                              {emp?.razao_social || 'Empresa Prestadora'}
                            </div>
                            <div className="text-[10px] text-[#64748B]">
                              {emp?.cnpj ? maskCnpj(emp.cnpj) : '—'}
                            </div>
                          </TableCell>

                          <TableCell className="align-middle">
                            <div className="text-xs font-bold text-[#1A2333]">
                              {nota.tomador_nome}
                            </div>
                            <div className="text-[10px] text-[#64748B] font-mono">
                              {nota.tomador_documento}
                            </div>
                            {isCancelada && nota.motivo_cancelamento && (
                              <div
                                className="text-[10px] text-rose-800 italic mt-1 bg-rose-50/80 p-1 rounded border border-rose-200 line-clamp-2"
                                title={nota.motivo_cancelamento}
                              >
                                Motivo: {nota.motivo_cancelamento}
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="align-middle text-right font-bold text-xs text-[#1A2333]">
                            <span className={isCancelada ? 'line-through text-slate-400' : ''}>
                              {nota.valor_servicos.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </span>
                          </TableCell>

                          <TableCell className="align-middle text-right">
                            <div
                              className={`text-xs font-bold ${
                                isCancelada ? 'line-through text-slate-400' : 'text-[#0FA3A3]'
                              }`}
                            >
                              {nota.valor_liquido.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </div>
                            <div className="text-[10px] text-[#64748B]">
                              ISS:{' '}
                              {(nota.valor_iss || 0).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </div>
                          </TableCell>

                          <TableCell className="align-middle text-right space-x-1.5 whitespace-nowrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setNotaParaVisualizar(nota)
                                setModalDanfseOpen(true)
                              }}
                              className="h-8 px-2 text-xs text-[#0FA3A3] border-[#0FA3A3]/30 hover:bg-[#0FA3A3]/10 gap-1"
                              title="Visualizar DANFSE e XML"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              DANFSE
                            </Button>

                            {/* Botão de Cancelamento: visível para Contador e Administrador em notas autorizadas */}
                            {canEmit && isAutorizada && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setNotaParaCancelar(nota)
                                  setModalCancelarOpen(true)
                                }}
                                className="h-8 px-2 text-xs text-rose-600 border-rose-300 hover:bg-rose-50 gap-1"
                                title="Cancelar nota fiscal no provedor"
                              >
                                <Ban className="h-3.5 w-3.5" />
                                Cancelar
                              </Button>
                            )}

                            {/* Se nota foi cancelada por erro de emissão mas ainda não foi substituída, permitir emitir substituta */}
                            {canEmit && isCancelada && !nota.nota_substituta_id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleIniciarSubstituicao(nota)}
                                className="h-8 px-2 text-xs text-indigo-700 border-indigo-300 hover:bg-indigo-50 gap-1"
                                title="Emitir nota substituta pré-preenchida"
                              >
                                <ArrowRightLeft className="h-3.5 w-3.5" />
                                Substituir
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ABA 3: AGENTE IA NO WHATSAPP (NATIVE SKIP CLOUD AGENT) */}
        <TabsContent value="agente" className="pt-2">
          {tenant && (
            <WhatsAppAgentTab
              config={config}
              empresas={empresas}
              tenantId={tenant.id}
              user={user}
              onConfigUpdated={() => loadData(true)}
            />
          )}
        </TabsContent>

        {/* ABA 4: CONFIGURAÇÃO DO CANAL WHATSAPP */}
        <TabsContent value="config" className="pt-2">
          {tenant && (
            <NfseConfigTab
              config={config}
              empresas={empresas}
              tenantId={tenant.id}
              onRefresh={() => loadData(true)}
              currentUserId={user?.id}
              canEdit={canEmit}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Modais Operacionais */}
      <NfseAprovacaoModal
        solicitacao={solicitacaoParaAprovar}
        dadosSubstituicao={dadosSubstituicao}
        empresas={empresas}
        config={config}
        open={modalAprovarOpen}
        onOpenChange={(val) => {
          setModalAprovarOpen(val)
          if (!val) setDadosSubstituicao(null)
        }}
        onSuccess={() => {
          setDadosSubstituicao(null)
          loadData(true)
        }}
        currentUserId={user?.id}
      />

      <NfseCancelamentoModal
        nota={notaParaCancelar}
        empresa={notaParaCancelar ? empresaMap.get(notaParaCancelar.empresa) : undefined}
        config={config}
        open={modalCancelarOpen}
        onOpenChange={setModalCancelarOpen}
        onSuccess={() => loadData(true)}
        onSubstituir={(notaOrig) => handleIniciarSubstituicao(notaOrig)}
        currentUserId={user?.id}
      />

      <NfseRejeicaoModal
        solicitacao={solicitacaoParaRejeitar}
        open={modalRejeitarOpen}
        onOpenChange={setModalRejeitarOpen}
        onSuccess={() => loadData(true)}
        currentUserId={user?.id}
      />

      <NfseChatLogModal
        solicitacao={solicitacaoParaChat}
        open={modalChatOpen}
        onOpenChange={setModalChatOpen}
        onSuccess={() => loadData(true)}
      />

      <NfseVisualizadorModal
        nota={notaParaVisualizar}
        empresa={notaParaVisualizar ? empresaMap.get(notaParaVisualizar.empresa) : undefined}
        open={modalDanfseOpen}
        onOpenChange={setModalDanfseOpen}
      />
    </div>
  )
}

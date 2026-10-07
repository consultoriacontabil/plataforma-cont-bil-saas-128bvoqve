import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Bot,
  PlayCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Building2,
  Filter,
  Search,
  RotateCw,
  ExternalLink,
  SlidersHorizontal,
  ArrowRight,
  Sparkles,
  Info,
  Calendar,
  Layers,
  ChevronRight,
  ShieldAlert,
  Laptop,
  CheckSquare,
  Square,
  Lock,
  ListFilter,
  XCircle,
  Check,
  X,
} from 'lucide-react'
import { PainelAgenteExterno } from '@/components/PainelAgenteExterno'
import { useAuth } from '@/contexts/AuthContext'
import {
  elisaOpsService,
  type ElisaJobRecord,
  type ProcessoPendenciaRecord,
  type PrioridadeOperacional,
} from '@/services/elisaOpsService'
import { empresasService } from '@/services/empresas'
import { useRealtime } from '@/hooks/use-realtime'
import type { Empresa } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { maskCnpj, formatDatePtBr } from '@/lib/formatters'

export default function ElisaFilaPage() {
  const { tenant, user, member } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTabParam = searchParams.get('tab') || 'fila'

  // Estados principais
  const [jobs, setJobs] = useState<ElisaJobRecord[]>([])
  const [pendencias, setPendencias] = useState<ProcessoPendenciaRecord[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filtros - Fila Geral
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroArea, setFiltroArea] = useState<string>('todas')
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>('todas')
  const [filtroEmpresaId, setFiltroEmpresaId] = useState<string>('todas')
  const [buscaTexto, setBuscaTexto] = useState<string>('')

  // Filtros - Modo Humano (Classificação por Tipo, Parada, Empresa, Urgência)
  const [filtroHumanoTipoPop, setFiltroHumanoTipoPop] = useState<string>('todos')
  const [filtroHumanoParada, setFiltroHumanoParada] = useState<string>('todas')
  const [filtroHumanoEmpresaId, setFiltroHumanoEmpresaId] = useState<string>('todas')
  const [filtroHumanoUrgencia, setFiltroHumanoUrgencia] = useState<string>('todas')
  const [filtroHumanoStatus, setFiltroHumanoStatus] = useState<string>('aberta')
  const [buscaHumanoTexto, setBuscaHumanoTexto] = useState<string>('')

  // Seleção e Aprovação em Lote (Modo Humano)
  const [itensSelecionadosIds, setItensSelecionadosIds] = useState<string[]>([])
  const [modalLoteAberta, setModalLoteAberta] = useState(false)
  const [decisaoLoteTipo, setDecisaoLoteTipo] = useState<'APROVAR' | 'REJEITAR' | 'DEVOLVER_ELISA'>(
    'APROVAR',
  )
  const [justificativaLote, setJustificativaLote] = useState('')
  const [processandoLote, setProcessandoLote] = useState(false)
  const [resultadoLote, setResultadoLote] = useState<{
    total: number
    sucessos: { id: string; titulo: string }[]
    falhas: { id: string; titulo: string; erro: string }[]
  } | null>(null)

  // Modal Modo Humano / Resolução Individual de Pendência
  const [pendenciaSelecionada, setPendenciaSelecionada] = useState<ProcessoPendenciaRecord | null>(
    null,
  )
  const [decisaoModalAberta, setDecisaoModalAberta] = useState(false)
  const [decisaoTipo, setDecisaoTipo] = useState<
    'APROVAR' | 'REJEITAR' | 'CORRIGIR' | 'DEVOLVER_ELISA'
  >('APROVAR')
  const [resolucaoTexto, setResolucaoTexto] = useState('')
  const [salvandoDecisao, setSalvandoDecisao] = useState(false)

  // Executando Job
  const [executandoJobId, setExecutandoJobId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!tenant?.id) return
    try {
      const [jobsRes, pendRes, empRes] = await Promise.all([
        elisaOpsService.listJobs(tenant.id, {
          status: filtroStatus,
          area: filtroArea,
          prioridade: filtroPrioridade,
          empresaId: filtroEmpresaId,
        }),
        elisaOpsService.listPendencias(tenant.id),
        empresasService.list(tenant.id),
      ])
      setJobs(jobsRes)
      setPendencias(pendRes)
      setEmpresas(empRes)
    } catch (err) {
      console.error('Erro ao carregar Fila da Elliza:', err)
      toast({
        variant: 'destructive',
        title: 'Erro de carregamento',
        description: 'Falha ao sincronizar fila operacional da Elliza.',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [tenant?.id, filtroStatus, filtroArea, filtroPrioridade, filtroEmpresaId, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtime('elisa_jobs', () => loadData())
  useRealtime('processo_pendencias', () => loadData())
  useRealtime('processos_operacionais', () => loadData())

  // Filtragem de texto no cliente - Fila Geral
  const jobsFiltrados = useMemo(() => {
    if (!buscaTexto.trim()) return jobs
    const t = buscaTexto.toLowerCase()
    return jobs.filter((j) => {
      const empNome =
        j.expand?.empresa_id?.razao_social || j.expand?.empresa_id?.nome_fantasia || ''
      const empCnpj = j.expand?.empresa_id?.cnpj || ''
      return (
        j.job_codigo.toLowerCase().includes(t) ||
        j.processo_nome.toLowerCase().includes(t) ||
        j.etapa_atual_nome.toLowerCase().includes(t) ||
        j.proxima_acao.toLowerCase().includes(t) ||
        empNome.toLowerCase().includes(t) ||
        empCnpj.includes(t)
      )
    })
  }, [jobs, buscaTexto])

  // Helper de inferência de Tipo de POP / Processo da pendência
  const getPendenciaTipoPop = useCallback((p: ProcessoPendenciaRecord): string => {
    const texto =
      `${p.titulo} ${p.expand?.processo_id?.titulo || ''} ${p.expand?.processo_id?.codigo_sop || ''} ${p.por_que_parou || ''} ${p.o_que_foi_executado || ''}`.toLowerCase()
    if (
      texto.includes('folha') ||
      texto.includes('esocial') ||
      texto.includes('pró-labore') ||
      texto.includes('pro-labore') ||
      texto.includes('pop-02') ||
      texto.includes('pop-dp-01') ||
      texto.includes('societário') ||
      texto.includes('societario')
    ) {
      return 'folha_dp'
    }
    if (
      texto.includes('pagar') ||
      texto.includes('pop-07') ||
      texto.includes('contas a pagar') ||
      texto.includes('boleto')
    ) {
      return 'contas_pagar'
    }
    if (texto.includes('defis') || texto.includes('pop-11')) {
      return 'defis'
    }
    if (texto.includes('sped') || texto.includes('pop-05') || texto.includes('pop-12')) {
      return 'sped_fiscal'
    }
    if (
      texto.includes('nfse') ||
      texto.includes('nfs-e') ||
      texto.includes('whatsapp') ||
      texto.includes('pop-03')
    ) {
      return 'nfse_whatsapp'
    }
    if (
      texto.includes('nfe.io') ||
      texto.includes('nfeio') ||
      texto.includes('pop-10') ||
      texto.includes('xml')
    ) {
      return 'nfe_io'
    }
    if (
      texto.includes('legislativo') ||
      texto.includes('alíquota') ||
      texto.includes('aliquota') ||
      texto.includes('pop-09')
    ) {
      return 'legislativo'
    }
    if (
      texto.includes('fechamento contábil') ||
      texto.includes('balancete') ||
      texto.includes('fct-04')
    ) {
      return 'fechamento_contabil'
    }
    if (texto.includes('cartão') || texto.includes('cartao') || texto.includes('pop-06')) {
      return 'cartoes'
    }
    if (texto.includes('receber') || texto.includes('pop-08')) {
      return 'contas_receber'
    }
    return 'outros'
  }, [])

  // Helper de inferência de Categoria de Parada
  const getPendenciaTipoParada = useCallback((p: ProcessoPendenciaRecord): string => {
    const statusProc = p.expand?.processo_id?.status || ''
    const texto =
      `${p.titulo} ${p.por_que_parou || ''} ${p.decisao_necessaria || ''} ${statusProc}`.toLowerCase()

    if (
      statusProc === 'AGUARDANDO_DOCUMENTO' ||
      statusProc === 'AGUARDANDO_CLIENTE' ||
      texto.includes('aguardando_cliente') ||
      texto.includes('aguardando_documento') ||
      texto.includes('parada honesta') ||
      texto.includes('jucepar') ||
      texto.includes('olsen') ||
      texto.includes('faltam extratos') ||
      texto.includes('solicitar ao cliente')
    ) {
      return 'aguardando_documento'
    }

    if (
      statusProc === 'BLOQUEADO' ||
      statusProc === 'ERRO' ||
      texto.includes('bloqueado') ||
      texto.includes('divergência') ||
      texto.includes('divergencia') ||
      texto.includes('erro')
    ) {
      return 'bloqueado_erro'
    }

    if (
      texto.includes('lote') ||
      texto.includes('pop-07') ||
      texto.includes('estruturada') ||
      texto.includes('conciliação') ||
      texto.includes('conciliacao')
    ) {
      return 'pendencia_estruturada'
    }

    return 'nivel_3_aprovacao'
  }, [])

  // Helper de inferência de Urgência / Prazo
  const getPendenciaUrgencia = useCallback((p: ProcessoPendenciaRecord): PrioridadeOperacional => {
    return p.expand?.processo_id?.prioridade || 'media'
  }, [])

  // Helper rigoroso de Elegibilidade para Aprovação em Lote:
  // Regra de Ouro: Itens com pendência documental do cliente/órgão (Olsen/Graciani aguardando JUCEPAR,
  // AGUARDANDO_CLIENTE, AGUARDANDO_DOCUMENTO ou bloqueados por erro estrutural) NÃO podem ser aprovados em lote.
  const checarElegibilidadeLote = useCallback(
    (p: ProcessoPendenciaRecord): { elegivel: boolean; motivo?: string } => {
      if (p.status !== 'aberta') {
        return { elegivel: false, motivo: 'Esta pendência já foi resolvida ou finalizada.' }
      }

      const statusProc = p.expand?.processo_id?.status || ''
      const texto =
        `${p.titulo} ${p.por_que_parou || ''} ${p.o_que_falta || ''} ${p.decisao_necessaria || ''}`.toLowerCase()

      // Regra 1: Parada honesta por falta de documento / JUCEPAR / Olsen
      if (
        statusProc === 'AGUARDANDO_DOCUMENTO' ||
        statusProc === 'AGUARDANDO_CLIENTE' ||
        texto.includes('jucepar') ||
        texto.includes('olsen') ||
        texto.includes('parada honesta') ||
        texto.includes('consolidação contratual') ||
        texto.includes('aguardando saneamento documental')
      ) {
        return {
          elegivel: false,
          motivo:
            'Exige decisão específica do contador (Aguardando consolidação/documento do cliente/JUCEPAR). Não elegível para lote.',
        }
      }

      // Regra 2: Processo Bloqueado ou com Erro Grave
      if (statusProc === 'BLOQUEADO' || statusProc === 'ERRO') {
        return {
          elegivel: false,
          motivo: 'Processo bloqueado ou com erro impeditivo. Requer análise manual individual.',
        }
      }

      // Elegível para lote: aprovação Nível 3, chancelas fiscais/contábeis e lotes autorizados
      return { elegivel: true }
    },
    [],
  )

  // Filtragem e Classificação no Modo Humano
  const pendenciasFiltradas = useMemo(() => {
    return pendencias.filter((p) => {
      // Filtro Status (aberta / resolvida / todas)
      if (filtroHumanoStatus !== 'todas' && p.status !== filtroHumanoStatus) {
        return false
      }

      // Filtro Empresa
      if (filtroHumanoEmpresaId !== 'todas' && p.empresa_id !== filtroHumanoEmpresaId) {
        return false
      }

      // Filtro Tipo / POP
      if (filtroHumanoTipoPop !== 'todos') {
        const tipoPop = getPendenciaTipoPop(p)
        if (tipoPop !== filtroHumanoTipoPop) return false
      }

      // Filtro Parada
      if (filtroHumanoParada !== 'todas') {
        const tipoParada = getPendenciaTipoParada(p)
        if (tipoParada !== filtroHumanoParada) return false
      }

      // Filtro Urgência
      if (filtroHumanoUrgencia !== 'todas') {
        const urg = getPendenciaUrgencia(p)
        if (urg !== filtroHumanoUrgencia) return false
      }

      // Busca textual
      if (buscaHumanoTexto.trim()) {
        const t = buscaHumanoTexto.toLowerCase()
        const empNome =
          p.expand?.empresa_id?.razao_social || p.expand?.empresa_id?.nome_fantasia || ''
        const match =
          p.titulo.toLowerCase().includes(t) ||
          (p.por_que_parou || '').toLowerCase().includes(t) ||
          (p.decisao_necessaria || '').toLowerCase().includes(t) ||
          empNome.toLowerCase().includes(t)
        if (!match) return false
      }

      return true
    })
  }, [
    pendencias,
    filtroHumanoStatus,
    filtroHumanoEmpresaId,
    filtroHumanoTipoPop,
    filtroHumanoParada,
    filtroHumanoUrgencia,
    buscaHumanoTexto,
    getPendenciaTipoPop,
    getPendenciaTipoParada,
    getPendenciaUrgencia,
  ])

  // Pendências visíveis que são elegíveis para lote
  const pendenciasElegiveisVisiveis = useMemo(() => {
    return pendenciasFiltradas.filter((p) => checarElegibilidadeLote(p).elegivel)
  }, [pendenciasFiltradas, checarElegibilidadeLote])

  // Total selecionados
  const totalSelecionados = itensSelecionadosIds.length
  const todosElegiveisSelecionados =
    pendenciasElegiveisVisiveis.length > 0 &&
    pendenciasElegiveisVisiveis.every((p) => itensSelecionadosIds.includes(p.id))

  const alternarSelecaoTodos = () => {
    if (todosElegiveisSelecionados) {
      // Desmarcar todos os visíveis
      const idsVisiveis = new Set(pendenciasElegiveisVisiveis.map((p) => p.id))
      setItensSelecionadosIds((prev) => prev.filter((id) => !idsVisiveis.has(id)))
    } else {
      // Marcar todos os elegíveis visíveis
      const novosIds = Array.from(
        new Set([...itensSelecionadosIds, ...pendenciasElegiveisVisiveis.map((p) => p.id)]),
      )
      setItensSelecionadosIds(novosIds)
    }
  }

  const alternarSelecaoItem = (id: string) => {
    setItensSelecionadosIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  // Itens selecionados completos
  const pendenciasSelecionadasParaLote = useMemo(() => {
    return pendencias.filter((p) => itensSelecionadosIds.includes(p.id))
  }, [pendencias, itensSelecionadosIds])

  // Abrir modal de Lote com ação pré-selecionada
  const abrirModalLote = (acao: 'APROVAR' | 'REJEITAR' | 'DEVOLVER_ELISA') => {
    setDecisaoLoteTipo(acao)
    setJustificativaLote(
      acao === 'APROVAR'
        ? 'Aprovação técnica em lote realizada pelo Contador Responsável. Critérios de conformidade e evidências verificados.'
        : acao === 'DEVOLVER_ELISA'
          ? 'Devolvido em lote para continuidade do fluxo operacional automatizado pela Elliza.'
          : 'Rejeitado em lote pelo Contador Responsável após revisão contábil.',
    )
    setResultadoLote(null)
    setModalLoteAberta(true)
  }

  // Execução do lote
  const handleExecutarLote = async () => {
    if (!tenant?.id) return
    if (!justificativaLote.trim()) {
      toast({
        variant: 'destructive',
        title: 'Justificativa Obrigatória',
        description: 'Informe uma justificativa contábil auditável para a operação em lote.',
      })
      return
    }

    setProcessandoLote(true)
    try {
      const res = await elisaOpsService.resolverPendenciasEmLote({
        tenantId: tenant.id,
        usuarioId: user?.id,
        decisao: decisaoLoteTipo,
        justificativa: justificativaLote,
        pendencias: pendenciasSelecionadasParaLote,
      })

      setResultadoLote(res)
      toast({
        title: `Lote Processado: ${res.sucessos.length} de ${res.total} Concluídos`,
        description:
          res.falhas.length === 0
            ? 'Todos os itens foram processados e auditados com sucesso!'
            : `Houve ${res.falhas.length} falha(s). Verifique o resumo do lote.`,
      })

      // Limpar seleção dos que deram certo
      const idsSucesso = new Set(res.sucessos.map((s) => s.id))
      setItensSelecionadosIds((prev) => prev.filter((id) => !idsSucesso.has(id)))
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro no processamento em lote',
        description: String(err),
      })
    } finally {
      setProcessandoLote(false)
    }
  }

  // Disparo de Execução da Próxima Ação
  const handleExecutarJob = async (job: ElisaJobRecord) => {
    if (!tenant?.id) return
    setExecutandoJobId(job.id)
    toast({
      title: '🤖 Elliza em Execução',
      description: `Executando: ${job.proxima_acao}...`,
    })

    try {
      const res = await elisaOpsService.executarProximaAcaoElisa({
        tenantId: tenant.id,
        processoId: job.processo_id,
        etapaId: job.etapa_id,
        jobId: job.id,
        empresaId: job.empresa_id,
      })

      if (res.sucesso) {
        toast({
          title: 'Etapa Executada com Sucesso!',
          description: res.mensagem,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Ação Retida (Segurança)',
          description: res.mensagem,
        })
      }
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro de Execução',
        description: String(err),
      })
    } finally {
      setExecutandoJobId(null)
    }
  }

  // Confirmar Decisão no Modo Humano
  const handleConfirmarDecisao = async () => {
    if (!pendenciaSelecionada) return
    if (!resolucaoTexto.trim()) {
      toast({
        variant: 'destructive',
        title: 'Justificativa Obrigatória',
        description: 'Informe a descrição da decisão tomada pelo contador.',
      })
      return
    }

    setSalvandoDecisao(true)
    try {
      await elisaOpsService.resolverPendencia(
        pendenciaSelecionada.id,
        decisaoTipo,
        resolucaoTexto,
        user?.id,
      )
      toast({
        title: 'Decisão Registrada com Sucesso!',
        description: `Pendência atualizada como ${decisaoTipo}. O processo foi atualizado.`,
      })
      setDecisaoModalAberta(false)
      setPendenciaSelecionada(null)
      setResolucaoTexto('')
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao resolver',
        description: String(err),
      })
    } finally {
      setSalvandoDecisao(false)
    }
  }

  const renderBadgeAutonomia = (nivel: string) => {
    switch (nivel) {
      case 'nivel_1_automatico':
        return (
          <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
            Nível 1 • Automático
          </Badge>
        )
      case 'nivel_2_supervisionado':
        return (
          <Badge className="bg-blue-600 text-white text-[10px] font-bold">
            Nível 2 • Supervisionado
          </Badge>
        )
      case 'nivel_3_aprovacao_obrigatoria':
        return (
          <Badge className="bg-amber-600 text-white text-[10px] font-bold">
            Nível 3 • Aprovação Obrigatória
          </Badge>
        )
      default:
        return <Badge variant="outline">{nivel}</Badge>
    }
  }

  const renderBadgePrioridade = (prio: PrioridadeOperacional) => {
    switch (prio) {
      case 'urgente':
        return (
          <Badge className="bg-red-600 text-white text-[10px] uppercase font-extrabold animate-pulse">
            Urgente
          </Badge>
        )
      case 'alta':
        return (
          <Badge className="bg-amber-500 text-white text-[10px] uppercase font-bold">Alta</Badge>
        )
      case 'media':
        return <Badge className="bg-slate-600 text-white text-[10px] uppercase">Média</Badge>
      case 'baixa':
        return (
          <Badge variant="outline" className="text-slate-500 text-[10px] uppercase">
            Baixa
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Cabeçalho Determinístico */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-[#0FA3A3] text-white text-xs font-bold">FILA DA ELLIZA</Badge>
            <Badge variant="outline" className="text-slate-600 text-xs">
              Orquestração Determinística de Tarefas
            </Badge>
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs flex items-center gap-1">
              <Bot className="h-3 w-3" />
              <span>Agente de Interface Visual Ativo</span>
            </Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#1A2333] tracking-tight">
            Fila Operacional da Elliza
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            A Elliza não navega livremente: recebe tarefa estruturada e executa a próxima ação
            definida pelo processo contábil.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRefreshing(true)
              loadData()
            }}
            disabled={refreshing}
            className="h-9 text-xs border-slate-300 gap-1.5"
          >
            <RotateCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Atualizar Fila</span>
          </Button>

          <Link to="/processos">
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs text-[#0FA3A3] border-teal-300 bg-teal-50/50"
            >
              Biblioteca de SOPs
            </Button>
          </Link>

          <Link to="/pop-treinamento">
            <Button size="sm" className="h-9 text-xs bg-slate-800 hover:bg-slate-900 text-white">
              Consultar POPs Oficiais
            </Button>
          </Link>
        </div>
      </div>

      {/* Regra de Ordenação em Destaque */}
      <div className="rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50/70 via-white to-slate-50 p-3.5 text-xs text-slate-700 shadow-2xs flex items-center gap-3">
        <Info className="h-5 w-5 text-[#0FA3A3] shrink-0" />
        <div className="leading-relaxed">
          <strong>Critério Rigoroso de Ordenação da Fila:</strong> 1. Urgência • 2. Prazo de
          vencimento • 3. Prioridade operacional • 4. Dependências de etapas • 5. Ordem do POP.
        </div>
      </div>

      {/* Abas: Fila de Jobs & Modo Humano (Pendências) */}
      <Tabs
        value={activeTabParam}
        onValueChange={(val) => setSearchParams({ tab: val })}
        className="space-y-4"
      >
        <TabsList className="bg-slate-100 p-1 border border-slate-200">
          <TabsTrigger value="fila" className="text-xs font-semibold gap-2">
            <Bot className="h-4 w-4 text-[#0FA3A3]" />
            <span>Fila Operacional ({jobs.length})</span>
          </TabsTrigger>
          <TabsTrigger value="pendencias" className="text-xs font-semibold gap-2">
            <AlertTriangle
              className={`h-4 w-4 ${pendencias.length > 0 ? 'text-amber-500' : 'text-slate-400'}`}
            />
            <span>
              Modo Humano ({pendencias.filter((p) => p.status === 'aberta').length} Abertas)
            </span>
          </TabsTrigger>
          <TabsTrigger value="agente-externo" className="text-xs font-semibold gap-2">
            <Laptop className="h-4 w-4 text-[#0FA3A3]" />
            <span>Agente Externo (RPA / Playwright)</span>
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: FILA OPERACIONAL */}
        <TabsContent value="fila" className="space-y-4">
          {/* Barra de Filtros Padronizada */}
          <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-2xs">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por job, empresa, CNPJ..."
                  value={buscaTexto}
                  onChange={(e) => setBuscaTexto(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <div>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Status da Fila" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Status</SelectItem>
                    <SelectItem value="ENFILEIRADO">ENFILEIRADO</SelectItem>
                    <SelectItem value="EM_EXECUCAO">EM EXECUÇÃO</SelectItem>
                    <SelectItem value="AGUARDANDO_APROVACAO">AGUARDANDO APROVAÇÃO</SelectItem>
                    <SelectItem value="AGUARDANDO_CLIENTE">AGUARDANDO CLIENTE</SelectItem>
                    <SelectItem value="CONCLUIDO">CONCLUÍDO</SelectItem>
                    <SelectItem value="ERRO">COM ERRO</SelectItem>
                    <SelectItem value="BLOQUEADO">BLOQUEADO</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select value={filtroArea} onValueChange={setFiltroArea}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Área do Processo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as Áreas</SelectItem>
                    <SelectItem value="contabil">Contábil</SelectItem>
                    <SelectItem value="fiscal">Fiscal</SelectItem>
                    <SelectItem value="pessoal">Pessoal (DP)</SelectItem>
                    <SelectItem value="societario">Societário</SelectItem>
                    <SelectItem value="atendimento">Atendimento</SelectItem>
                    <SelectItem value="geral">Geral / Administrativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas Prioridades</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="baixa">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select value={filtroEmpresaId} onValueChange={setFiltroEmpresaId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Filtrar por Empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as Empresas</SelectItem>
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.nome_fantasia || emp.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* TABELA PADRONIZADA E DETERMINÍSTICA DA FILA */}
          <Card className="rounded-2xl border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-3">Job ID / Competência</th>
                    <th className="py-3.5 px-3">Cliente / CNPJ</th>
                    <th className="py-3.5 px-3">Processo / POP</th>
                    <th className="py-3.5 px-3">Etapa Atual</th>
                    <th className="py-3.5 px-3">Próxima Ação da Elliza</th>
                    <th className="py-3.5 px-3">Prioridade / Prazo</th>
                    <th className="py-3.5 px-3">Status</th>
                    <th className="py-3.5 px-3">Autonomia</th>
                    <th className="py-3.5 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {jobsFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500">
                        <Bot className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                        <span className="font-semibold text-slate-700 text-sm">
                          Nenhum job na fila com os filtros aplicados
                        </span>
                        <p className="text-xs text-slate-400 mt-1">
                          Inicie um processo a partir da biblioteca de SOPs para enfileirar novas
                          etapas.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    jobsFiltrados.map((job) => {
                      const empNome =
                        job.expand?.empresa_id?.nome_fantasia ||
                        job.expand?.empresa_id?.razao_social ||
                        'Empresa'
                      const empCnpj = job.expand?.empresa_id?.cnpj
                        ? maskCnpj(job.expand.empresa_id.cnpj)
                        : '—'
                      const isExecutando = executandoJobId === job.id

                      return (
                        <tr key={job.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* 1. Job ID + Competência */}
                          <td className="py-3 px-3 align-top">
                            <span className="font-mono font-bold text-slate-900 block">
                              {job.job_codigo}
                            </span>
                            <span className="text-[11px] text-[#0FA3A3] font-semibold">
                              Comp: {job.competencia}
                            </span>
                          </td>

                          {/* 2. Cliente / CNPJ */}
                          <td className="py-3 px-3 align-top max-w-[200px]">
                            <span
                              className="font-bold text-slate-900 block truncate"
                              title={empNome}
                            >
                              {empNome}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500">{empCnpj}</span>
                          </td>

                          {/* 3. Processo / POP */}
                          <td className="py-3 px-3 align-top">
                            <span className="font-semibold text-slate-800 block">
                              {job.processo_nome}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] text-slate-600 bg-slate-50"
                            >
                              {job.pop_relacionado || 'POP-04'} • {job.area}
                            </Badge>
                          </td>

                          {/* 4. Etapa Atual */}
                          <td className="py-3 px-3 align-top">
                            <span className="font-bold text-slate-800 block">
                              {job.etapa_atual_nome}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              Agente:{' '}
                              <strong className="text-slate-700">{job.agente_responsavel}</strong>
                            </span>
                            {job.executado_por_agente_externo && (
                              <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-[9px] font-bold mt-1">
                                [ RPA Externo ]
                              </Badge>
                            )}
                          </td>

                          {/* 5. Próxima Ação */}
                          <td className="py-3 px-3 align-top max-w-[260px]">
                            <p className="text-[11px] text-slate-700 leading-snug line-clamp-2">
                              {job.proxima_acao}
                            </p>
                            {job.resultado && (
                              <p
                                className="text-[10px] text-emerald-700 mt-0.5 truncate"
                                title={job.resultado}
                              >
                                ✓ {job.resultado}
                              </p>
                            )}
                          </td>

                          {/* 6. Prioridade / Prazo */}
                          <td className="py-3 px-3 align-top whitespace-nowrap">
                            <div className="mb-1">{renderBadgePrioridade(job.prioridade)}</div>
                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-slate-400" />
                              {job.prazo ? formatDatePtBr(job.prazo) : 'Sem prazo'}
                            </span>
                          </td>

                          {/* 7. Status */}
                          <td className="py-3 px-3 align-top">
                            <Badge
                              className={`text-[10px] font-bold ${
                                job.status === 'CONCLUIDO'
                                  ? 'bg-emerald-600 text-white'
                                  : job.status === 'EM_EXECUCAO'
                                    ? 'bg-blue-600 text-white'
                                    : job.status === 'APROVADO'
                                      ? 'bg-emerald-500 text-white'
                                      : job.status === 'AGUARDANDO_APROVACAO'
                                        ? 'bg-amber-500 text-white animate-pulse'
                                        : job.status === 'ERRO' || job.status === 'BLOQUEADO'
                                          ? 'bg-red-600 text-white'
                                          : 'bg-slate-700 text-white'
                              }`}
                            >
                              {job.status === 'APROVADO'
                                ? 'APROVADO (RPA)'
                                : job.status.replace('_', ' ')}
                            </Badge>
                          </td>

                          {/* 8. Autonomia */}
                          <td className="py-3 px-3 align-top">
                            {renderBadgeAutonomia(job.nivel_autonomia)}
                          </td>

                          {/* 9. Ações */}
                          <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link to={`/processos/${job.processo_id}`}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-slate-600 hover:text-slate-900"
                                >
                                  Ver Processo
                                </Button>
                              </Link>

                              {job.status !== 'CONCLUIDO' && (
                                <Button
                                  size="sm"
                                  disabled={isExecutando}
                                  onClick={() => handleExecutarJob(job)}
                                  className="h-7 text-xs bg-[#0FA3A3] hover:bg-[#0c8282] text-white gap-1 font-semibold"
                                >
                                  <PlayCircle
                                    className={`h-3.5 w-3.5 ${isExecutando ? 'animate-spin' : ''}`}
                                  />
                                  <span>{isExecutando ? 'Executando...' : 'Executar'}</span>
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
          </Card>
        </TabsContent>

        {/* ABA 2: MODO HUMANO (PAINEL DE SUPERVISÃO E DECISÃO HUMANA) */}
        <TabsContent value="pendencias" className="space-y-4">
          <Card className="rounded-2xl border-amber-200 bg-amber-50/50 p-4 shadow-2xs">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-amber-950">
                    Painel de Supervisão e Decisão Humana
                  </h3>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-amber-600 text-white text-xs font-bold">
                      {pendencias.filter((p) => p.status === 'aberta').length} Abertas
                    </Badge>
                    <Badge variant="outline" className="text-amber-900 border-amber-300 text-xs">
                      {pendenciasElegiveisVisiveis.length} Elegíveis p/ Lote
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-amber-900/80 leading-relaxed mt-1">
                  Toda vez que a Elliza encontra uma inconsistência ou etapa parametrizada com Nível
                  3 (ex.: Folha, Apuração Fiscal, SPED, DEFIS, NFS-e, Lote de Contas a Pagar), ela
                  pausa de forma segura e submete para este painel. Selecione itens elegíveis na
                  fila para aprovação ou despacho em lote com salvaguarda e auditoria CFC por item.
                </p>
              </div>
            </div>
          </Card>

          {/* BARRA DE CLASSIFICAÇÃO POR TIPO, PARADA, EMPRESA E URGÊNCIA */}
          <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-2xs">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <ListFilter className="h-4 w-4 text-[#0FA3A3]" />
                  <span>Classificação & Filtros da Fila Humana</span>
                  <span className="text-slate-400 font-normal">
                    ({pendenciasFiltradas.length} de {pendencias.length} exibidos)
                  </span>
                </div>
                {(filtroHumanoTipoPop !== 'todos' ||
                  filtroHumanoParada !== 'todas' ||
                  filtroHumanoEmpresaId !== 'todas' ||
                  filtroHumanoUrgencia !== 'todas' ||
                  filtroHumanoStatus !== 'aberta' ||
                  buscaHumanoTexto) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFiltroHumanoTipoPop('todos')
                      setFiltroHumanoParada('todas')
                      setFiltroHumanoEmpresaId('todas')
                      setFiltroHumanoUrgencia('todas')
                      setFiltroHumanoStatus('aberta')
                      setBuscaHumanoTexto('')
                    }}
                    className="h-7 text-xs text-slate-500 hover:text-slate-900 px-2"
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Limpar Filtros
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {/* 1. Busca textual */}
                <div className="relative lg:col-span-2">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Buscar pendência, processo, motivo..."
                    value={buscaHumanoTexto}
                    onChange={(e) => setBuscaHumanoTexto(e.target.value)}
                    className="pl-8 h-9 text-xs"
                  />
                </div>

                {/* 2. Classificação por Tipo / POP */}
                <div>
                  <Select value={filtroHumanoTipoPop} onValueChange={setFiltroHumanoTipoPop}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Tipo de Processo/POP" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os Processos / POPs</SelectItem>
                      <SelectItem value="folha_dp">Folha / eSocial / Pró-labore</SelectItem>
                      <SelectItem value="contas_pagar">Contas a Pagar (POP-07)</SelectItem>
                      <SelectItem value="sped_fiscal">SPED Fiscal / PVA</SelectItem>
                      <SelectItem value="defis">DEFIS Simples Nacional</SelectItem>
                      <SelectItem value="nfse_whatsapp">NFS-e & WhatsApp</SelectItem>
                      <SelectItem value="nfe_io">NFE.io / XMLs Fiscais</SelectItem>
                      <SelectItem value="legislativo">Monitoramento Legislativo</SelectItem>
                      <SelectItem value="fechamento_contabil">Fechamento Contábil</SelectItem>
                      <SelectItem value="cartoes">Cartões e Adquirentes</SelectItem>
                      <SelectItem value="contas_receber">Contas a Receber</SelectItem>
                      <SelectItem value="outros">Outros Processos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 3. Classificação por Tipo de Parada */}
                <div>
                  <Select value={filtroHumanoParada} onValueChange={setFiltroHumanoParada}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Tipo de Parada" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as Paradas</SelectItem>
                      <SelectItem value="nivel_3_aprovacao">
                        Aguardando Aprovação Nível 3
                      </SelectItem>
                      <SelectItem value="pendencia_estruturada">
                        Pendência Estruturada (Lote)
                      </SelectItem>
                      <SelectItem value="aguardando_documento">
                        Aguardando Documento / Cliente
                      </SelectItem>
                      <SelectItem value="bloqueado_erro">Bloqueado / Erro de Regra</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 4. Classificação por Empresa / Cliente */}
                <div>
                  <Select value={filtroHumanoEmpresaId} onValueChange={setFiltroHumanoEmpresaId}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Empresa / Cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as Empresas</SelectItem>
                      {empresas.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.nome_fantasia || emp.razao_social}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 5. Classificação por Urgência / Prazo */}
                <div>
                  <Select value={filtroHumanoUrgencia} onValueChange={setFiltroHumanoUrgencia}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Urgência / Prazo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as Urgências</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="baixa">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Status da Pendência (Abertas / Resolvidas / Todas) */}
              <div className="flex items-center gap-2 pt-1 text-xs">
                <span className="text-slate-500 font-medium">Situação:</span>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={filtroHumanoStatus === 'aberta' ? 'default' : 'outline'}
                    onClick={() => setFiltroHumanoStatus('aberta')}
                    className={`h-7 text-xs px-2.5 ${
                      filtroHumanoStatus === 'aberta'
                        ? 'bg-amber-600 text-white hover:bg-amber-700'
                        : ''
                    }`}
                  >
                    Abertas ({pendencias.filter((p) => p.status === 'aberta').length})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={filtroHumanoStatus === 'resolvida' ? 'default' : 'outline'}
                    onClick={() => setFiltroHumanoStatus('resolvida')}
                    className="h-7 text-xs px-2.5"
                  >
                    Resolvidas ({pendencias.filter((p) => p.status === 'resolvida').length})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={filtroHumanoStatus === 'todas' ? 'default' : 'outline'}
                    onClick={() => setFiltroHumanoStatus('todas')}
                    className="h-7 text-xs px-2.5"
                  >
                    Histórico Completo ({pendencias.length})
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* BARRA DE AÇÃO EM LOTE COM SELEÇÃO MULTIPLA E SALVAGUARDAS */}
          <Card className="rounded-2xl border-slate-200 bg-slate-50/90 p-3.5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all-human"
                    checked={pendenciasElegiveisVisiveis.length > 0 && todosElegiveisSelecionados}
                    disabled={pendenciasElegiveisVisiveis.length === 0}
                    onCheckedChange={alternarSelecaoTodos}
                  />
                  <label
                    htmlFor="select-all-human"
                    className="text-xs font-bold text-slate-800 cursor-pointer select-none"
                  >
                    Selecionar todos os elegíveis visíveis
                  </label>
                </div>

                <Badge
                  variant="outline"
                  className={`text-xs font-semibold ${
                    totalSelecionados > 0
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-white text-slate-600 border-slate-300'
                  }`}
                >
                  {totalSelecionados} selecionado{totalSelecionados === 1 ? '' : 's'}
                </Badge>

                {totalSelecionados > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setItensSelecionadosIds([])}
                    className="h-7 text-xs text-slate-500 hover:text-slate-800 px-2"
                  >
                    Desmarcar todos
                  </Button>
                )}
              </div>

              {/* Botões de Ação em Lote */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  disabled={totalSelecionados === 0}
                  onClick={() => abrirModalLote('APROVAR')}
                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Aprovar em Lote ({totalSelecionados})</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={totalSelecionados === 0}
                  onClick={() => abrirModalLote('DEVOLVER_ELISA')}
                  className="h-8 text-xs text-[#0FA3A3] border-teal-300 hover:bg-teal-50 gap-1.5"
                >
                  <Bot className="h-4 w-4" />
                  <span>Devolver p/ Elliza ({totalSelecionados})</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={totalSelecionados === 0}
                  onClick={() => abrirModalLote('REJEITAR')}
                  className="h-8 text-xs text-red-600 border-red-300 hover:bg-red-50 gap-1.5"
                >
                  <AlertTriangle className="h-4 w-4" />
                  <span>Rejeitar em Lote ({totalSelecionados})</span>
                </Button>
              </div>
            </div>

            {/* Aviso da Regra de Ouro da Plataforma Rumo */}
            <div className="mt-2.5 pt-2 border-t border-slate-200/70 flex items-center gap-2 text-[11px] text-slate-600">
              <Lock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span>
                <strong>Regra de Ouro:</strong> Itens com pendência documental do cliente (ex.:
                Olsen/Graciani aguardando JUCEPAR ou status AGUARDANDO_CLIENTE) ou processos
                bloqueados por erro ficam <em>desabilitados para lote</em> com tooltip explicativo,
                exigindo análise individual do Contador CRC.
              </span>
            </div>
          </Card>

          {/* LISTA / CARDS DAS PENDÊNCIAS COM CHECKBOXES E SALVAGUARDAS */}
          {pendenciasFiltradas.length === 0 ? (
            <Card className="rounded-2xl border border-dashed border-slate-300 p-12 text-center bg-slate-50">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
              <h4 className="font-bold text-slate-800 text-sm">
                Nenhuma pendência encontrada com os filtros aplicados
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Ajuste os filtros de tipo de processo, empresa ou urgência para visualizar outras
                tarefas.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendenciasFiltradas.map((pend) => {
                const empNome =
                  pend.expand?.empresa_id?.nome_fantasia ||
                  pend.expand?.empresa_id?.razao_social ||
                  'Empresa'
                const empCnpj = pend.expand?.empresa_id?.cnpj
                  ? maskCnpj(pend.expand.empresa_id.cnpj)
                  : ''
                const isAberta = pend.status === 'aberta'
                const elegibilidade = checarElegibilidadeLote(pend)
                const isSelecionado = itensSelecionadosIds.includes(pend.id)
                const tipoPop = getPendenciaTipoPop(pend)
                const tipoParada = getPendenciaTipoParada(pend)
                const urgencia = getPendenciaUrgencia(pend)

                return (
                  <Card
                    key={pend.id}
                    className={`rounded-2xl border p-4 transition-all shadow-2xs ${
                      isSelecionado
                        ? 'border-[#0FA3A3] ring-1 ring-[#0FA3A3] bg-teal-50/20'
                        : isAberta
                          ? 'border-amber-300 bg-white hover:border-amber-400'
                          : 'border-slate-200 bg-slate-50/80'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      {/* Checkbox e Conteúdo Principal */}
                      <div className="flex items-start gap-3 max-w-4xl flex-1">
                        {/* Checkbox com Salvaguarda / Tooltip */}
                        <div className="pt-0.5 shrink-0">
                          {elegibilidade.elegivel ? (
                            <Checkbox
                              checked={isSelecionado}
                              onCheckedChange={() => alternarSelecaoItem(pend.id)}
                              aria-label={`Selecionar ${pend.titulo}`}
                            />
                          ) : (
                            <TooltipProvider delayDuration={150}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="cursor-not-allowed">
                                    <Checkbox
                                      disabled
                                      checked={false}
                                      className="opacity-40 cursor-not-allowed border-dashed"
                                    />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs text-xs bg-slate-900 text-white p-2">
                                  <div className="font-bold text-amber-300 mb-0.5 flex items-center gap-1">
                                    <Lock className="h-3 w-3" />
                                    <span>Ineligível para Lote</span>
                                  </div>
                                  <p>{elegibilidade.motivo}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>

                        <div className="space-y-2 flex-1">
                          {/* Badges de Classificação */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              className={
                                isAberta
                                  ? 'bg-amber-600 text-white text-xs'
                                  : 'bg-slate-600 text-white text-xs'
                              }
                            >
                              {pend.status.toUpperCase()}
                            </Badge>

                            {/* Badge do Tipo / POP */}
                            <Badge
                              variant="outline"
                              className="text-xs bg-slate-50 text-slate-700 border-slate-300 font-semibold"
                            >
                              {tipoPop === 'folha_dp' && 'Folha / eSocial (POP-02 / POP-DP-01)'}
                              {tipoPop === 'contas_pagar' && 'Contas a Pagar (POP-07)'}
                              {tipoPop === 'sped_fiscal' && 'SPED Fiscal (POP-05)'}
                              {tipoPop === 'defis' && 'DEFIS Anual (POP-11)'}
                              {tipoPop === 'nfse_whatsapp' && 'NFS-e WhatsApp (POP-03)'}
                              {tipoPop === 'nfe_io' && 'NFE.io / XMLs (POP-10)'}
                              {tipoPop === 'legislativo' && 'Monitoramento Legislativo (POP-09)'}
                              {tipoPop === 'fechamento_contabil' && 'Fechamento Contábil (FCT-04)'}
                              {tipoPop === 'cartoes' && 'Cartões / Adquirentes (POP-06)'}
                              {tipoPop === 'contas_receber' && 'Contas a Receber (POP-08)'}
                              {tipoPop === 'outros' && 'Processo Operacional'}
                            </Badge>

                            {/* Badge de Elegibilidade */}
                            {elegibilidade.elegivel ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] font-bold">
                                Elegível p/ Lote
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] font-bold flex items-center gap-1"
                              >
                                <Lock className="h-2.5 w-2.5" />
                                <span>Decisão Individual</span>
                              </Badge>
                            )}

                            {/* Urgência */}
                            {renderBadgePrioridade(urgencia)}

                            <span className="text-xs text-slate-400">•</span>
                            <span className="text-xs font-semibold text-slate-700">
                              {empNome}{' '}
                              {empCnpj && (
                                <span className="font-mono text-slate-400">({empCnpj})</span>
                              )}
                            </span>
                          </div>

                          {/* Título */}
                          <h4 className="font-bold text-slate-900 text-sm leading-snug">
                            {pend.titulo}
                          </h4>

                          {/* 4 Perguntas Fundamentais do Modo Humano */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                            <div className="bg-red-50 border border-red-200 rounded-lg p-2.5">
                              <span className="font-bold text-red-900 block">
                                1. Por que a Elliza parou?
                              </span>
                              <span className="text-red-800">{pend.por_que_parou}</span>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                              <span className="font-bold text-blue-900 block">
                                2. O que foi executado?
                              </span>
                              <span className="text-blue-800">{pend.o_que_foi_executado}</span>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                              <span className="font-bold text-amber-900 block">
                                3. O que falta?
                              </span>
                              <span className="text-amber-800">{pend.o_que_falta}</span>
                            </div>

                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-2.5">
                              <span className="font-bold text-purple-900 block">
                                4. Decisão necessária:
                              </span>
                              <span className="text-purple-800 font-semibold">
                                {pend.decisao_necessaria}
                              </span>
                            </div>
                          </div>

                          {pend.resolucao_descricao && (
                            <div className="mt-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-2 rounded-lg">
                              <strong>Resolução Registrada:</strong> {pend.resolucao_descricao}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Botões de Ação Individual */}
                      <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 md:min-w-[130px]">
                        {isAberta && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setPendenciaSelecionada(pend)
                              setResolucaoTexto('')
                              setDecisaoTipo('APROVAR')
                              setDecisaoModalAberta(true)
                            }}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 gap-1.5 font-bold shadow-xs"
                          >
                            <ShieldCheck className="h-4 w-4" />
                            <span>Tomar Decisão</span>
                          </Button>
                        )}

                        <Link to={`/processos/${pend.processo_id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs h-8 border-slate-300"
                          >
                            Abrir Processo
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ABA 3: INTEGRAÇÃO COM AGENTE EXTERNO (RPA / PLAYWRIGHT / COMPUTER USE) */}
        <TabsContent value="agente-externo" className="space-y-4">
          <PainelAgenteExterno tenantId={tenant?.id || ''} onRefreshFila={loadData} />
        </TabsContent>
      </Tabs>

      {/* MODAL MODO HUMANO: APROVAR / REJEITAR / CORRIGIR / DEVOLVER PARA ELLIZA */}
      <Dialog open={decisaoModalAberta} onOpenChange={setDecisaoModalAberta}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <ShieldCheck className="h-5 w-5 text-amber-600" />
              <span>Decisão Contábil Humana — Modo Humano</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {pendenciaSelecionada?.titulo}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs space-y-1">
              <span className="font-bold text-slate-800">Decisão necessária:</span>
              <p className="text-slate-600">{pendenciaSelecionada?.decisao_necessaria}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">Selecione a ação técnica:</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={decisaoTipo === 'APROVAR' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDecisaoTipo('APROVAR')}
                  className={`text-xs h-9 justify-start gap-2 ${
                    decisaoTipo === 'APROVAR'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : ''
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>[ APROVAR ]</span>
                </Button>

                <Button
                  type="button"
                  variant={decisaoTipo === 'DEVOLVER_ELISA' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDecisaoTipo('DEVOLVER_ELISA')}
                  className={`text-xs h-9 justify-start gap-2 ${
                    decisaoTipo === 'DEVOLVER_ELISA'
                      ? 'bg-[#0FA3A3] hover:bg-[#0c8282] text-white'
                      : ''
                  }`}
                >
                  <Bot className="h-4 w-4" />
                  <span>[ DEVOLVER PARA ELLIZA ]</span>
                </Button>

                <Button
                  type="button"
                  variant={decisaoTipo === 'CORRIGIR' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDecisaoTipo('CORRIGIR')}
                  className={`text-xs h-9 justify-start gap-2 ${
                    decisaoTipo === 'CORRIGIR' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''
                  }`}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>[ CORRIGIR DADOS ]</span>
                </Button>

                <Button
                  type="button"
                  variant={decisaoTipo === 'REJEITAR' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDecisaoTipo('REJEITAR')}
                  className={`text-xs h-9 justify-start gap-2 ${
                    decisaoTipo === 'REJEITAR' ? 'bg-red-600 hover:bg-red-700 text-white' : ''
                  }`}
                >
                  <AlertTriangle className="h-4 w-4" />
                  <span>[ REJEITAR ]</span>
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">
                Justificativa Contábil / Despacho Técnico (Auditável):
              </label>
              <Textarea
                placeholder="Ex.: Conferido extrato bancário com a nota fiscal correspondente. Conta 3.1.01.02 aprovada para conciliação."
                value={resolucaoTexto}
                onChange={(e) => setResolucaoTexto(e.target.value)}
                className="text-xs min-h-[90px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDecisaoModalAberta(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmarDecisao}
              disabled={salvandoDecisao}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
            >
              {salvandoDecisao ? 'Gravando Decisão...' : 'Confirmar Decisão Técnica'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE PROCESSAMENTO / APROVAÇÃO EM LOTE */}
      <Dialog
        open={modalLoteAberta}
        onOpenChange={(open) => !processandoLote && setModalLoteAberta(open)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              {decisaoLoteTipo === 'APROVAR' && (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              )}
              {decisaoLoteTipo === 'DEVOLVER_ELISA' && <Bot className="h-5 w-5 text-[#0FA3A3]" />}
              {decisaoLoteTipo === 'REJEITAR' && <AlertTriangle className="h-5 w-5 text-red-600" />}
              <span>
                {decisaoLoteTipo === 'APROVAR' && 'Aprovação em Lote — Modo Humano'}
                {decisaoLoteTipo === 'DEVOLVER_ELISA' && 'Devolução em Lote para a Elliza'}
                {decisaoLoteTipo === 'REJEITAR' && 'Rejeição em Lote — Modo Humano'}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Execução em lote de {pendenciasSelecionadasParaLote.length} processo(s) selecionado(s)
              com salvaguarda de auditoria contábil.
            </DialogDescription>
          </DialogHeader>

          {!resultadoLote ? (
            <div className="space-y-4 py-2">
              {/* Resumo dos itens que serão afetados */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Processos Selecionados ({pendenciasSelecionadasParaLote.length}):
                  </span>
                  <Badge variant="outline" className="text-[11px] bg-white">
                    Todos com Critérios Validados
                  </Badge>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
                  {pendenciasSelecionadasParaLote.map((item, idx) => {
                    const emp =
                      item.expand?.empresa_id?.nome_fantasia ||
                      item.expand?.empresa_id?.razao_social ||
                      'Empresa'
                    return (
                      <div
                        key={item.id}
                        className="pt-1.5 first:pt-0 flex items-center justify-between text-xs text-slate-700"
                      >
                        <div className="truncate max-w-[380px]">
                          <span className="font-semibold text-slate-900">
                            {idx + 1}. {item.titulo}
                          </span>
                          <span className="text-[11px] text-slate-500 block truncate">
                            {emp} • {item.decisao_necessaria}
                          </span>
                        </div>
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] shrink-0 font-mono">
                          Nível 3 Aprovável
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Justificativa técnica obrigatória */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800">
                  Despacho Técnico / Justificativa do Lote (Auditável pelo CFC):
                </label>
                <Textarea
                  placeholder="Informe a fundamentação contábil para o despacho em lote..."
                  value={justificativaLote}
                  onChange={(e) => setJustificativaLote(e.target.value)}
                  className="text-xs min-h-[90px]"
                />
                <span className="text-[10px] text-slate-500 block">
                  A justificativa será gravada individualmente em cada pendência e consolidada no
                  log de auditoria do sistema.
                </span>
              </div>
            </div>
          ) : (
            /* RESUMO DO PROCESSAMENTO DO LOTE */
            <div className="space-y-4 py-2">
              <div
                className={`rounded-xl border p-4 ${
                  resultadoLote.falhas.length === 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-amber-50 border-amber-200 text-amber-950'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {resultadoLote.falhas.length === 0 ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  )}
                  <h4 className="font-bold text-sm">Resumo da Execução do Lote</h4>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white/80 rounded-lg p-2 border border-slate-200/60">
                    <span className="text-slate-500 block">Total</span>
                    <strong className="text-slate-900 text-base">{resultadoLote.total}</strong>
                  </div>
                  <div className="bg-white/80 rounded-lg p-2 border border-emerald-200/60">
                    <span className="text-emerald-700 block">Sucesso</span>
                    <strong className="text-emerald-700 text-base">
                      {resultadoLote.sucessos.length}
                    </strong>
                  </div>
                  <div className="bg-white/80 rounded-lg p-2 border border-red-200/60">
                    <span className="text-red-700 block">Falhas</span>
                    <strong className="text-red-700 text-base">
                      {resultadoLote.falhas.length}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Lista de Falhas (se houver) */}
              {resultadoLote.falhas.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-red-900">
                    Itens que não puderam ser processados:
                  </h5>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 text-xs">
                    {resultadoLote.falhas.map((f) => (
                      <div
                        key={f.id}
                        className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-800"
                      >
                        <span className="font-bold block">{f.titulo}</span>
                        <span className="text-[11px] text-red-600">{f.erro}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            {!resultadoLote ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={processandoLote}
                  onClick={() => setModalLoteAberta(false)}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  disabled={processandoLote}
                  onClick={handleExecutarLote}
                  className={`text-xs font-bold text-white ${
                    decisaoLoteTipo === 'APROVAR'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : decisaoLoteTipo === 'DEVOLVER_ELISA'
                        ? 'bg-[#0FA3A3] hover:bg-[#0c8282]'
                        : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {processandoLote
                    ? 'Processando em Lote...'
                    : `Confirmar ${
                        decisaoLoteTipo === 'APROVAR'
                          ? 'Aprovação'
                          : decisaoLoteTipo === 'DEVOLVER_ELISA'
                            ? 'Devolução'
                            : 'Rejeição'
                      } de ${pendenciasSelecionadasParaLote.length} Item(ns)`}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  setModalLoteAberta(false)
                  setResultadoLote(null)
                }}
                className="text-xs bg-slate-900 text-white"
              >
                Concluir e Fechar Resumo
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

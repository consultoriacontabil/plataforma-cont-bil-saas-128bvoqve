import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import {
  Building2,
  FileText,
  Calculator,
  PlusCircle,
  UploadCloud,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Clock,
  RotateCw,
  Bot,
  PlayCircle,
  AlertTriangle,
  Layers,
  ShieldCheck,
  ListTodo,
  ExternalLink,
  MessageSquare,
  FileSpreadsheet,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { empresasService } from '@/services/empresas'
import { documentosService } from '@/services/documentos'
import { workflowService } from '@/services/workflows'
import { fiscalService } from '@/services/fiscal'
import {
  obrigacoesService,
  OBRIGACAO_ATUALIZADA_EVENT,
  type ObrigacaoAtualizadaEventDetail,
} from '@/services/obrigacoes'
import { certificadosService } from '@/services/certificados'
import { certidoesService } from '@/services/regularidade'
import { fechoMensalService } from '@/services/fechoMensal'
import { companyOnboardingService } from '@/services/companyOnboarding'
import { tenantService } from '@/services/tenant'
import {
  elisaOpsService,
  type ProcessoOperacionalRecord,
  type ElisaJobRecord,
  type ProcessoPendenciaRecord,
} from '@/services/elisaOpsService'
import { useRealtime } from '@/hooks/use-realtime'
import type {
  Empresa,
  Documento,
  Workflow,
  FiscalRecord,
  OnboardingChecklistState,
  ObrigacaoRecord,
  CertificadoDigitalRecord,
  CertidaoRecord,
  FechamentoCompetenciaRecord,
  CompanyOnboardingWorkflowRecord,
} from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'

// Componentes de Foco Operacional Existentes
import { DashboardObrigacoes } from '@/components/dashboard/DashboardObrigacoes'
import { DashboardPendencias } from '@/components/dashboard/DashboardPendencias'
import { DashboardWorkflowPanel } from '@/components/dashboard/DashboardWorkflowPanel'
import { DashboardMonitorCnds } from '@/components/dashboard/DashboardMonitorCnds'

export default function Dashboard() {
  const { user, tenant, member, refreshAuth } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()

  const isCliente = member?.perfil === 'cliente'

  // Dados das coleções principais existentes
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [fiscalList, setFiscalList] = useState<FiscalRecord[]>([])
  const [obrigacoes, setObrigacoes] = useState<ObrigacaoRecord[]>([])
  const [certificados, setCertificados] = useState<CertificadoDigitalRecord[]>([])
  const [certidoes, setCertidoes] = useState<CertidaoRecord[]>([])
  const [fechamentos, setFechamentos] = useState<FechamentoCompetenciaRecord[]>([])
  const [onboardingWorkflows, setOnboardingWorkflows] = useState<CompanyOnboardingWorkflowRecord[]>(
    [],
  )

  // Dados da Nova Camada Operacional Elliza
  const [processosOperacionais, setProcessosOperacionais] = useState<ProcessoOperacionalRecord[]>(
    [],
  )
  const [elisaJobs, setElisaJobs] = useState<ElisaJobRecord[]>([])
  const [pendenciasElisa, setPendenciasElisa] = useState<ProcessoPendenciaRecord[]>([])
  const [kpisElisa, setKpisElisa] = useState({
    totalProcessos: 0,
    emExecucao: 0,
    aguardandoAprovacao: 0,
    aguardandoCliente: 0,
    aguardandoDocumento: 0,
    bloqueadosOuErro: 0,
    concluidos: 0,
    totalJobs: 0,
    jobsConcluidos: 0,
    taxaSucessoAutomacao: 98,
    totalPendenciasAbertas: 0,
    totalSopsAtivos: 0,
    tempoMedioExecucaoSegundos: 4.2,
  })

  // Loading e erros parciais isolados por domínio
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorObrigacoes, setErrorObrigacoes] = useState<string | null>(null)
  const [errorPendencias, setErrorPendencias] = useState<string | null>(null)
  const [errorWorkflows, setErrorWorkflows] = useState<string | null>(null)
  const [errorCnds, setErrorCnds] = useState<string | null>(null)

  // Onboarding checklist state
  const [carregandoPlanoPadrao, setCarregandoPlanoPadrao] = useState(false)
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)

  const loadData = useCallback(async () => {
    if (!tenant?.id) return

    // Carregamento resiliente
    const pEmpresas = empresasService.list(tenant.id).catch((err) => {
      console.error('Erro empresas:', err)
      return [] as Empresa[]
    })
    const pDocs = documentosService.list(tenant.id).catch((err) => {
      console.error('Erro documentos:', err)
      return [] as Documento[]
    })
    const pWorkflows = workflowService.list(tenant.id).catch((err) => {
      console.error('Erro workflows:', err)
      setErrorWorkflows('Falha ao carregar workflows operacionais.')
      return [] as Workflow[]
    })
    const pFiscal = fiscalService.list(tenant.id).catch((err) => {
      console.error('Erro fiscal:', err)
      return [] as FiscalRecord[]
    })
    const pObrigacoes = obrigacoesService.list(tenant.id).catch((err) => {
      console.error('Erro obrigacoes:', err)
      setErrorObrigacoes('Falha ao carregar obrigações fiscais.')
      return [] as ObrigacaoRecord[]
    })
    const pCertificados = certificadosService.list(tenant.id).catch((err) => {
      console.error('Erro certificados:', err)
      return [] as CertificadoDigitalRecord[]
    })
    const pCertidoes = certidoesService.list(tenant.id).catch((err) => {
      console.error('Erro certidoes:', err)
      setErrorCnds('Falha ao sincronizar certidões negativas.')
      return [] as CertidaoRecord[]
    })
    const pFechamentos = fechoMensalService.listFechamentos(tenant.id).catch((err) => {
      console.error('Erro fechamentos:', err)
      return [] as FechamentoCompetenciaRecord[]
    })
    const pOnboardings = companyOnboardingService.list(tenant.id).catch((err) => {
      console.error('Erro onboarding workflows:', err)
      return [] as CompanyOnboardingWorkflowRecord[]
    })

    // Elisa Ops calls
    const pProcessos = elisaOpsService.listProcessos(tenant.id).catch(() => [])
    const pJobs = elisaOpsService.listJobs(tenant.id).catch(() => [])
    const pPendencias = elisaOpsService
      .listPendencias(tenant.id, { status: 'aberta' })
      .catch(() => [])
    const pKpis = elisaOpsService.getCentralOperacoesKPIs(tenant.id).catch(() => null)

    try {
      const [
        empRes,
        docRes,
        wfRes,
        fiscRes,
        obrigRes,
        certRes,
        certidoesRes,
        fechRes,
        onbRes,
        procRes,
        jobsRes,
        pendRes,
        kpiRes,
      ] = await Promise.all([
        pEmpresas,
        pDocs,
        pWorkflows,
        pFiscal,
        pObrigacoes,
        pCertificados,
        pCertidoes,
        pFechamentos,
        pOnboardings,
        pProcessos,
        pJobs,
        pPendencias,
        pKpis,
      ])

      setEmpresas(empRes)
      setDocumentos(docRes)
      setWorkflows(wfRes)
      setFiscalList(fiscRes)
      setObrigacoes(obrigRes)
      setCertificados(certRes)
      setCertidoes(certidoesRes)
      setFechamentos(fechRes)
      setOnboardingWorkflows(onbRes)

      setProcessosOperacionais(procRes)
      setElisaJobs(jobsRes)
      setPendenciasElisa(pendRes)
      if (kpiRes) setKpisElisa(kpiRes)

      setErrorObrigacoes(null)
      setErrorPendencias(null)
      setErrorWorkflows(null)
      setErrorCnds(null)
    } catch (err) {
      console.error('Erro geral ao carregar dados do Dashboard:', err)
      setErrorPendencias('Falha ao sincronizar dados da Central de Operações.')
    } finally {
      setLoadingInitial(false)
      setRefreshing(false)
    }
  }, [tenant?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Realtime updates
  useRealtime('empresas', () => loadData())
  useRealtime('documentos', () => loadData())
  useRealtime('workflows', () => loadData())
  useRealtime('fiscal', () => loadData())
  useRealtime('obrigacoes', () => loadData())
  useRealtime('certificados_digitais', () => loadData())
  useRealtime('certidoes', () => loadData())
  useRealtime('fechamento_competencia', () => loadData())
  useRealtime('company_onboarding_workflow', () => loadData())
  useRealtime('guias_pagamentos', () => loadData())
  useRealtime('processos_operacionais', () => loadData())
  useRealtime('elisa_jobs', () => loadData())
  useRealtime('processo_etapas', () => loadData())
  useRealtime('processo_pendencias', () => loadData())

  const aplicarAtualizacaoOtimistaObrigacao = useCallback(
    (id: string, status: 'entregue' | 'pendente' | 'atrasada') => {
      const dataEntregaNow = status === 'entregue' ? new Date().toISOString() : undefined
      setObrigacoes((prev) =>
        prev.map((o) =>
          o.id === id
            ? {
                ...o,
                status,
                ...(dataEntregaNow ? { data_entrega: dataEntregaNow } : {}),
              }
            : o,
        ),
      )
    },
    [],
  )

  useEffect(() => {
    const handleObrigacaoGlobal = (event: Event) => {
      const custom = event as CustomEvent<ObrigacaoAtualizadaEventDetail>
      const detail = custom.detail
      if (!detail) {
        loadData()
        return
      }

      if (detail.action === 'entregue') {
        aplicarAtualizacaoOtimistaObrigacao(detail.id, 'entregue')
      } else if (detail.action === 'delete') {
        setObrigacoes((prev) => prev.filter((o) => o.id !== detail.id))
      } else if (detail.record) {
        setObrigacoes((prev) => {
          const exists = prev.some((o) => o.id === detail.id)
          if (exists) {
            return prev.map((o) => (o.id === detail.id ? { ...o, ...detail.record } : o))
          }
          return [detail.record!, ...prev]
        })
      }
      loadData()
    }

    window.addEventListener(OBRIGACAO_ATUALIZADA_EVENT, handleObrigacaoGlobal)
    return () => {
      window.removeEventListener(OBRIGACAO_ATUALIZADA_EVENT, handleObrigacaoGlobal)
    }
  }, [aplicarAtualizacaoOtimistaObrigacao, loadData])

  const handleMarcarObrigacaoEntregue = async (obrigacaoId: string) => {
    const backupAnterior = obrigacoes
    aplicarAtualizacaoOtimistaObrigacao(obrigacaoId, 'entregue')

    try {
      await obrigacoesService.marcarComoEntregue(obrigacaoId, tenant?.id)
      toast({
        title: 'Obrigação transmitida!',
        description: 'Status atualizado com sucesso no calendário fiscal e pendência liquidada.',
      })
      loadData()
    } catch (err) {
      console.error('Erro ao marcar obrigação entregue:', err)
      setObrigacoes(backupAnterior)
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: 'Não foi possível marcar a obrigação como transmitida.',
      })
    }
  }

  // Executar Próxima Ação rápida diretamente pelo Dashboard
  const handleExecutarAcaoRapida = async (proc: ProcessoOperacionalRecord) => {
    if (!tenant?.id) return
    toast({
      title: 'Elliza Executando...',
      description: `Disparando próxima etapa de "${proc.titulo}"...`,
    })
    try {
      const res = await elisaOpsService.executarProximaAcaoElisa({
        tenantId: tenant.id,
        processoId: proc.id,
        empresaId: proc.empresa_id,
      })
      if (res.sucesso) {
        toast({
          title: 'Etapa executada com sucesso!',
          description: res.mensagem,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Ação interrompida',
          description: res.mensagem,
        })
      }
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro de execução',
        description: String(err),
      })
    }
  }

  const todayStr = useMemo(() => {
    const now = new Date()
    return now.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }, [])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Bom dia'
    if (hour < 18) return 'Boa tarde'
    return 'Boa noite'
  }, [])

  return (
    <div className="space-y-7 animate-fade-in pb-10">
      {/* Top Welcome Header com Título Oficial da Central de Operações */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-[#0FA3A3] text-white text-[11px] font-bold tracking-wider uppercase">
              RUMO | CENTRAL DE OPERAÇÕES
            </Badge>
            <Badge variant="outline" className="text-slate-600 text-xs">
              Arquitetura Operacional Elliza
            </Badge>
            <Badge className="bg-emerald-600 text-white text-xs flex items-center gap-1">
              <Bot className="h-3 w-3" />
              <span>Elliza 24/7 Ativa</span>
            </Badge>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-[#1A2333] md:text-3xl">
            {greeting}, {user?.name ? user.name.split(' ')[0] : isCliente ? 'Cliente' : 'Contador'}!
          </h2>
          <p className="text-xs sm:text-sm capitalize text-[#64748B] flex items-center gap-1.5 mt-0.5">
            <span>{todayStr}</span>
            <span>•</span>
            <span className="text-[#0FA3A3] font-semibold">
              Painel de Controle e Orquestração Contábil
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRefreshing(true)
              loadData()
            }}
            disabled={refreshing}
            className="h-8 text-xs border-[#E2E8F0] gap-1.5 text-[#64748B] hover:text-[#1A2333]"
            title="Atualizar dados agora"
          >
            <RotateCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </Button>

          <Link to="/elisa-fila">
            <Button
              size="sm"
              className="h-8 text-xs bg-[#0FA3A3] hover:bg-[#0c8282] text-white gap-1.5 shadow-xs font-semibold"
            >
              <Bot className="h-3.5 w-3.5" />
              <span>
                Fila da Elliza (
                {
                  elisaJobs.filter((j) => j.status === 'ENFILEIRADO' || j.status === 'EM_EXECUCAO')
                    .length
                }
                )
              </span>
            </Button>
          </Link>

          <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-xs px-2.5 py-1">
            Escritório: {tenant?.nome || 'Rumo Contábil'}
          </Badge>
        </div>
      </div>

      {/* 8 INDICADORES ESSENCIAIS DA CENTRAL DE OPERAÇÕES */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {/* 1. Total de Processos */}
        <Card className="rounded-xl border-[#E2E8F0] bg-white p-3 shadow-2xs hover:border-teal-300 transition-colors">
          <div className="text-[11px] font-semibold text-[#64748B] truncate">Total Processos</div>
          <div className="text-xl font-extrabold text-[#1A2333] mt-1">
            {kpisElisa.totalProcessos}
          </div>
          <div className="text-[10px] text-teal-600 font-medium mt-0.5">Ativos na Rumo</div>
        </Card>

        {/* 2. Em Execução */}
        <Card className="rounded-xl border-blue-200 bg-blue-50/40 p-3 shadow-2xs">
          <div className="text-[11px] font-semibold text-blue-800 truncate">Em Execução</div>
          <div className="text-xl font-extrabold text-blue-900 mt-1">{kpisElisa.emExecucao}</div>
          <div className="text-[10px] text-blue-600 font-medium mt-0.5">Elliza / Equipe</div>
        </Card>

        {/* 3. Aguardando Aprovação */}
        <Card className="rounded-xl border-amber-200 bg-amber-50/40 p-3 shadow-2xs">
          <div className="text-[11px] font-semibold text-amber-800 truncate">Aguard. Aprovação</div>
          <div className="text-xl font-extrabold text-amber-900 mt-1">
            {kpisElisa.aguardandoAprovacao}
          </div>
          <div className="text-[10px] text-amber-600 font-medium mt-0.5">Chancela Contador</div>
        </Card>

        {/* 4. Aguardando Cliente */}
        <Card className="rounded-xl border-purple-200 bg-purple-50/40 p-3 shadow-2xs">
          <div className="text-[11px] font-semibold text-purple-800 truncate">Aguard. Cliente</div>
          <div className="text-xl font-extrabold text-purple-900 mt-1">
            {kpisElisa.aguardandoCliente}
          </div>
          <div className="text-[10px] text-purple-600 font-medium mt-0.5">Doc / Resposta</div>
        </Card>

        {/* 5. Com Erro / Bloqueado */}
        <Card className="rounded-xl border-red-200 bg-red-50/40 p-3 shadow-2xs">
          <div className="text-[11px] font-semibold text-red-800 truncate">Com Erro / Bloq.</div>
          <div className="text-xl font-extrabold text-red-900 mt-1">
            {kpisElisa.bloqueadosOuErro}
          </div>
          <div className="text-[10px] text-red-600 font-medium mt-0.5">Modo Humano</div>
        </Card>

        {/* 6. Concluídos */}
        <Card className="rounded-xl border-emerald-200 bg-emerald-50/40 p-3 shadow-2xs">
          <div className="text-[11px] font-semibold text-emerald-800 truncate">Concluídos</div>
          <div className="text-xl font-extrabold text-emerald-900 mt-1">{kpisElisa.concluidos}</div>
          <div className="text-[10px] text-emerald-600 font-medium mt-0.5">Com evidência</div>
        </Card>

        {/* 7. Taxa de Sucesso Automação */}
        <Card className="rounded-xl border-teal-200 bg-teal-50/40 p-3 shadow-2xs">
          <div className="text-[11px] font-semibold text-teal-800 truncate">Taxa Sucesso</div>
          <div className="text-xl font-extrabold text-[#0FA3A3] mt-1">
            {kpisElisa.taxaSucessoAutomacao}%
          </div>
          <div className="text-[10px] text-teal-600 font-medium mt-0.5">Zero alucinação</div>
        </Card>

        {/* 8. Tempo Médio Execução */}
        <Card className="rounded-xl border-slate-200 bg-slate-50 p-3 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-700 truncate">Tempo Médio</div>
          <div className="text-xl font-extrabold text-slate-900 mt-1">
            {kpisElisa.tempoMedioExecucaoSegundos}s
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-0.5">Por etapa robotizada</div>
        </Card>
      </div>

      {/* SEÇÃO PRINCIPAL DA ELLIZA: ORQUESTRADOR DE PROCESSOS & FILA EM TEMPO REAL */}
      <section aria-label="Processos Operacionais da Elliza" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Bot className="h-5 w-5 text-[#0FA3A3]" />
              <span>Orquestrador Operacional: Processos em Andamento (POP → SOP Executável)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Processos contábeis, fiscais e de DP executados pela Elliza de forma determinística
              passo a passo.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/processos">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs text-slate-700 border-slate-300"
              >
                Ver Todos os Processos
              </Button>
            </Link>
            <Link to="/elisa-fila">
              <Button size="sm" className="h-8 text-xs bg-[#0FA3A3] hover:bg-[#0c8282] text-white">
                Ver Fila Operacional Completa
              </Button>
            </Link>
          </div>
        </div>

        {processosOperacionais.length === 0 ? (
          <Card className="rounded-2xl border border-dashed border-slate-300 p-8 text-center bg-slate-50">
            <Bot className="h-10 w-10 text-slate-400 mx-auto mb-2" />
            <h4 className="font-bold text-slate-800 text-sm">
              Nenhum processo em andamento no momento
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
              Acesse a Biblioteca de SOPs (/processos) para instanciar novos processos operacionais
              derivados dos POPs cadastrados.
            </p>
            <Link to="/processos">
              <Button size="sm" className="bg-[#0FA3A3] text-white text-xs">
                Abrir Biblioteca de SOPs
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {processosOperacionais.slice(0, 6).map((proc) => {
              const empresaNome =
                proc.expand?.empresa_id?.nome_fantasia ||
                proc.expand?.empresa_id?.razao_social ||
                'Empresa do Escritório'
              const progresso = proc.progresso_percentual || 0
              const isExecutando = proc.status === 'EM_EXECUCAO' || proc.status === 'ENFILEIRADO'
              const isAprovacao = proc.status === 'AGUARDANDO_APROVACAO'
              const isBloqueado = proc.status === 'BLOQUEADO' || proc.status === 'ERRO'

              return (
                <Card
                  key={proc.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Top Header Card */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase font-bold text-[#0FA3A3] border-teal-200 bg-teal-50"
                        >
                          {proc.codigo_sop || 'POP-04'} • {proc.area}
                        </Badge>
                        <h4
                          className="text-sm font-bold text-slate-900 mt-1 line-clamp-1"
                          title={proc.titulo}
                        >
                          {proc.titulo}
                        </h4>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <Building2 className="h-3 w-3 text-slate-400" />
                          <span className="font-medium text-slate-700 truncate">{empresaNome}</span>
                        </div>
                      </div>

                      <Badge
                        className={`text-[10px] font-bold shrink-0 ${
                          proc.status === 'CONCLUIDO'
                            ? 'bg-emerald-600 text-white'
                            : isAprovacao
                              ? 'bg-amber-500 text-white animate-pulse'
                              : isBloqueado
                                ? 'bg-red-600 text-white'
                                : 'bg-[#0FA3A3] text-white'
                        }`}
                      >
                        {proc.status.replace('_', ' ')}
                      </Badge>
                    </div>

                    {/* Contexto da Execução: Etapa Atual & Próxima Ação */}
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                        <span>
                          Etapa {proc.etapa_atual_numero || 1} de {proc.total_etapas || 16}
                        </span>
                        <span className="text-[#0FA3A3]">{progresso}%</span>
                      </div>
                      <Progress value={progresso} className="h-1.5 bg-slate-200" />
                      <p className="text-[11px] font-bold text-slate-800 line-clamp-1">
                        {proc.etapa_atual_nome || 'Em processamento'}
                      </p>
                      <p className="text-[10px] text-slate-600 line-clamp-2">
                        <strong>Próxima Ação:</strong>{' '}
                        {proc.proxima_acao || 'Executar próxima etapa do processo'}
                      </p>
                    </div>
                  </div>

                  {/* Rodapé do Card com Ação Rápida */}
                  <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-500">
                      Agente:{' '}
                      <strong className="text-slate-800">
                        {proc.agente_responsavel || 'Elliza'}
                      </strong>
                    </span>

                    <div className="flex items-center gap-1.5">
                      <Link to={`/processos/${proc.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[11px] text-[#0FA3A3] hover:text-[#0c8282] hover:bg-teal-50 px-2"
                        >
                          Ver Detalhes
                        </Button>
                      </Link>

                      {proc.status !== 'CONCLUIDO' && (
                        <Button
                          size="sm"
                          onClick={() => handleExecutarAcaoRapida(proc)}
                          className={`h-7 text-[11px] font-semibold px-2.5 gap-1 ${
                            isAprovacao
                              ? 'bg-amber-600 hover:bg-amber-700 text-white'
                              : 'bg-[#0FA3A3] hover:bg-[#0c8282] text-white shadow-2xs'
                          }`}
                        >
                          <PlayCircle className="h-3.5 w-3.5" />
                          <span>Executar</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* SEÇÃO DE PENDÊNCIAS CRÍTICAS DA ELLIZA (MODO HUMANO) */}
      {pendenciasElisa.length > 0 && (
        <Card className="rounded-2xl border-2 border-amber-300 bg-amber-50/60 p-5 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shrink-0 mt-0.5">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-amber-950 flex items-center gap-2">
                  <span>
                    Modo Humano: {pendenciasElisa.length} pendências aguardando decisão do contador
                  </span>
                </h4>
                <p className="text-xs text-amber-900/80 leading-relaxed mt-0.5">
                  Princípio fundamental da Rumo: a Elliza nunca adivinha informação crítica. Ao
                  encontrar situações não previstas ou etapas de nível 3, o processo é retido para
                  chancela contábil.
                </p>
              </div>
            </div>

            <Link to="/elisa-fila?tab=pendencias">
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8">
                Resolver Pendências
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* SEÇÃO 1 EM DESTAQUE: Obrigações Fiscais do Período */}
      <section aria-label="Obrigações Fiscais em Destaque">
        <DashboardObrigacoes
          obrigacoes={obrigacoes}
          loading={loadingInitial}
          error={errorObrigacoes}
          onMarcarEntregue={handleMarcarObrigacaoEntregue}
          isCliente={isCliente}
        />
      </section>

      {/* SEÇÃO 1.5 EM DESTAQUE: Monitor de CNDs & Regularidade Fiscal */}
      <section aria-label="Monitor de CNDs e Regularidade Fiscal">
        <DashboardMonitorCnds
          empresas={empresas}
          certidoes={certidoes}
          loading={loadingInitial}
          error={errorCnds}
          isCliente={isCliente}
          currentUserId={user?.id}
          tenantId={tenant?.id}
          onWorkflowCreated={() => loadData()}
        />
      </section>

      {/* SEÇÃO 2 EM DESTAQUE: Pendências em Destaque (1/2) + Solicitações & Workflow (1/2) */}
      <section
        aria-label="Pendências Críticas e Solicitações de Workflow"
        className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-stretch"
      >
        {/* Bloco de Pendências Agregadas */}
        <div className="h-full">
          <DashboardPendencias
            documentos={documentos}
            certificados={certificados}
            obrigacoes={obrigacoes}
            fechamentos={fechamentos}
            empresas={empresas}
            certidoes={certidoes}
            onboardingWorkflows={onboardingWorkflows}
            loading={loadingInitial}
            error={errorPendencias}
            isCliente={isCliente}
          />
        </div>

        {/* Bloco de Solicitações & Workflow */}
        <div className="h-full">
          <DashboardWorkflowPanel
            workflows={workflows}
            onboardingWorkflows={onboardingWorkflows}
            loading={loadingInitial}
            error={errorWorkflows}
            isCliente={isCliente}
          />
        </div>
      </section>

      {/* Seção de Ações Rápidas Determinísticas */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-[#1A2333]">
            Central de Ações Rápidas Determinísticas
          </CardTitle>
          <CardDescription className="text-xs text-[#64748B]">
            Acesso padronizado aos módulos estruturados e à esteira operacional da Elliza
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button
              onClick={() => navigate('/elisa-fila')}
              className="w-full justify-start gap-3 h-12 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#1A2333] shadow-2xs font-semibold text-xs"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-[#0FA3A3]">
                <Bot className="h-4 w-4" />
              </div>
              <span>Fila Operacional da Elliza</span>
            </Button>

            <Button
              onClick={() => navigate('/processos')}
              className="w-full justify-start gap-3 h-12 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#1A2333] shadow-2xs font-semibold text-xs"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[#3B82F6]">
                <ListTodo className="h-4 w-4" />
              </div>
              <span>Biblioteca de SOPs Executáveis</span>
            </Button>

            <Button
              onClick={() => navigate('/fecho-mensal')}
              className="w-full justify-start gap-3 h-12 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#1A2333] shadow-2xs font-semibold text-xs"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-[#F59E0B]">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <span>Fecho Mensal & Travas</span>
            </Button>

            <Button
              onClick={() => navigate('/pop-treinamento')}
              className="w-full justify-start gap-3 h-12 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#1A2333] shadow-2xs font-semibold text-xs"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <span>POPs Oficiais (POP-Elliza-2026.3)</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

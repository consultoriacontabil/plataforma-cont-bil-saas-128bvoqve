import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Building2,
  FileText,
  GitPullRequest,
  Calculator,
  PlusCircle,
  UploadCloud,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Clock,
  RotateCw,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { empresasService } from '@/services/empresas'
import { documentosService } from '@/services/documentos'
import { workflowService } from '@/services/workflows'
import { fiscalService } from '@/services/fiscal'
import { obrigacoesService } from '@/services/obrigacoes'
import { certificadosService } from '@/services/certificados'
import { fechoMensalService } from '@/services/fechoMensal'
import { companyOnboardingService } from '@/services/companyOnboarding'
import { tenantService } from '@/services/tenant'
import { useRealtime } from '@/hooks/use-realtime'
import type {
  Empresa,
  Documento,
  Workflow,
  FiscalRecord,
  OnboardingChecklistState,
  ObrigacaoRecord,
  CertificadoDigitalRecord,
  FechamentoCompetenciaRecord,
  CompanyOnboardingWorkflowRecord,
} from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'

// Novos Componentes de Foco Operacional
import { DashboardObrigacoes } from '@/components/dashboard/DashboardObrigacoes'
import { DashboardPendencias } from '@/components/dashboard/DashboardPendencias'
import { DashboardWorkflowPanel } from '@/components/dashboard/DashboardWorkflowPanel'

export default function Dashboard() {
  const { user, tenant, member, refreshAuth } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()

  const isCliente = member?.perfil === 'cliente'

  // Dados das coleções principais
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [fiscalList, setFiscalList] = useState<FiscalRecord[]>([])
  const [obrigacoes, setObrigacoes] = useState<ObrigacaoRecord[]>([])
  const [certificados, setCertificados] = useState<CertificadoDigitalRecord[]>([])
  const [fechamentos, setFechamentos] = useState<FechamentoCompetenciaRecord[]>([])
  const [onboardingWorkflows, setOnboardingWorkflows] = useState<CompanyOnboardingWorkflowRecord[]>(
    [],
  )

  // Loading e erros parciais isolados por domínio
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorObrigacoes, setErrorObrigacoes] = useState<string | null>(null)
  const [errorPendencias, setErrorPendencias] = useState<string | null>(null)
  const [errorWorkflows, setErrorWorkflows] = useState<string | null>(null)

  // Onboarding checklist state
  const [carregandoPlanoPadrao, setCarregandoPlanoPadrao] = useState(false)
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)

  const loadData = useCallback(async () => {
    if (!tenant?.id) return

    // Carregamento resiliente: falhas parciais não derrubam o dashboard todo
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
    const pFechamentos = fechoMensalService.listFechamentos(tenant.id).catch((err) => {
      console.error('Erro fechamentos:', err)
      return [] as FechamentoCompetenciaRecord[]
    })
    const pOnboardings = companyOnboardingService.list(tenant.id).catch((err) => {
      console.error('Erro onboarding workflows:', err)
      return [] as CompanyOnboardingWorkflowRecord[]
    })

    try {
      const [empRes, docRes, wfRes, fiscRes, obrigRes, certRes, fechRes, onbRes] =
        await Promise.all([
          pEmpresas,
          pDocs,
          pWorkflows,
          pFiscal,
          pObrigacoes,
          pCertificados,
          pFechamentos,
          pOnboardings,
        ])

      setEmpresas(empRes)
      setDocumentos(docRes)
      setWorkflows(wfRes)
      setFiscalList(fiscRes)
      setObrigacoes(obrigRes)
      setCertificados(certRes)
      setFechamentos(fechRes)
      setOnboardingWorkflows(onbRes)

      setErrorObrigacoes(null)
      setErrorPendencias(null)
      setErrorWorkflows(null)
    } catch (err) {
      console.error('Erro geral ao carregar dados do Dashboard:', err)
      setErrorPendencias('Falha ao sincronizar pendências do escritório.')
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
  useRealtime('fechamento_competencia', () => loadData())
  useRealtime('company_onboarding_workflow', () => loadData())

  // Ação rápida de marcar obrigação entregue diretamente pelo Dashboard
  const handleMarcarObrigacaoEntregue = async (obrigacaoId: string) => {
    try {
      await obrigacoesService.marcarComoEntregue(obrigacaoId, tenant?.id)
      toast({
        title: 'Obrigação transmitida!',
        description: 'Status atualizado com sucesso no calendário fiscal.',
      })
      await loadData()
    } catch (err) {
      console.error('Erro ao marcar obrigação entregue:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: 'Não foi possível marcar a obrigação como transmitida.',
      })
    }
  }

  // Dynamic greetings
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

  // KPI calculations
  const activeEmpresasCount = useMemo(
    () => empresas.filter((e) => e.status === 'ativo').length,
    [empresas],
  )

  const monthDocsCount = useMemo(() => {
    const currentMonth = new Date().getMonth()
    const currentYear = new Date().getFullYear()
    return documentos.filter((d) => {
      const date = new Date(d.created)
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear
    }).length
  }, [documentos])

  const pendingWfsCount = useMemo(
    () =>
      workflows.filter((w) => w.status === 'em_andamento').length +
      onboardingWorkflows.filter((ow) => ow.status === 'em_andamento' || ow.status === 'em_analise')
        .length,
    [workflows, onboardingWorkflows],
  )

  const pendingFiscalCount = useMemo(() => {
    // Agrupa pendências fiscais: registros em fiscal + obrigações atrasadas ou pendentes
    const fiscCount = fiscalList.filter((f) => f.status === 'pendente').length
    const obrigCount = obrigacoes.filter(
      (o) => o.status === 'atrasada' || o.status === 'pendente',
    ).length
    return fiscCount + obrigCount
  }, [fiscalList, obrigacoes])

  return (
    <div className="space-y-7 animate-fade-in pb-10">
      {/* Top Welcome Header com Ação de Atualização */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#1A2333] md:text-3xl">
            {greeting}, {user?.name ? user.name.split(' ')[0] : isCliente ? 'Cliente' : 'Contador'}!
          </h2>
          <p className="text-xs sm:text-sm capitalize text-[#64748B] flex items-center gap-1.5 mt-0.5">
            <span>{todayStr}</span>
            <span>•</span>
            <span className="text-[#0FA3A3] font-semibold">Painel Operacional do Escritório</span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
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

          <Badge className="bg-[#0FA3A3]/10 text-[#0FA3A3] hover:bg-[#0FA3A3]/20 border-teal-200 text-xs px-2.5 py-1">
            Escritório: {tenant?.nome || 'Rumo Contábil'}
          </Badge>
        </div>
      </div>

      {/* Onboarding Guiado (Multi-Escritório / Novo Tenant) */}
      {!isCliente &&
        (() => {
          const checklist: OnboardingChecklistState = tenant?.onboarding_checklist || {}
          const isTenantNovo = empresas.length === 0 || !checklist.ignorado
          const shouldShow =
            (isTenantNovo ||
              Boolean((location.state as { showOnboarding?: boolean })?.showOnboarding)) &&
            !checklist.ignorado &&
            !onboardingDismissed

          if (!shouldShow) return null

          const etapas = [
            {
              id: 'escritorio_dados',
              titulo: '1. Completar dados do escritório',
              descricao: 'Razão social, CNPJ e preferências do escritório.',
              concluido: Boolean(tenant?.nome && (tenant?.cnpj || checklist.escritorio_dados)),
              botao: 'Ver Perfil',
              onClick: () => navigate('/perfil'),
            },
            {
              id: 'primeira_empresa',
              titulo: '2. Cadastrar primeira empresa cliente',
              descricao: 'Reutilize o cadastro completo com CNPJ/CEP e regime tributário.',
              concluido: empresas.length > 0 || Boolean(checklist.primeira_empresa),
              botao: 'Cadastrar Empresa',
              onClick: () => navigate('/empresas/nova'),
            },
            {
              id: 'plano_contas',
              titulo: '3. Configurar plano de contas',
              descricao: 'Carregue o plano de contas oficial padrão brasileiro com 1 clique.',
              concluido: Boolean(checklist.plano_contas),
              botao: 'Carregar Plano Padrão',
              onClick: async () => {
                if (!tenant?.id) return
                setCarregandoPlanoPadrao(true)
                try {
                  const count = await tenantService.inicializarPlanoContasPadrao(tenant.id)
                  await tenantService.updateOnboarding(tenant.id, { plano_contas: true })
                  await refreshAuth()
                  toast({
                    title: 'Plano de contas configurado!',
                    description:
                      count > 0
                        ? `${count} contas do plano padrão brasileiro foram configuradas com sucesso.`
                        : 'O plano de contas padrão já se encontrava inicializado.',
                  })
                } catch (err) {
                  console.error(err)
                  toast({
                    variant: 'destructive',
                    title: 'Erro',
                    description: 'Não foi possível carregar as contas contábeis.',
                  })
                } finally {
                  setCarregandoPlanoPadrao(false)
                }
              },
            },
            {
              id: 'primeiro_usuario',
              titulo: '4. Convidar primeiro usuário da equipe',
              descricao: 'Adicione contadores ou auxiliares para atuar nas rotinas contábeis.',
              concluido: Boolean(checklist.primeiro_usuario),
              botao: 'Adicionar Usuário',
              onClick: () => navigate('/usuarios'),
            },
            {
              id: 'convite_portal',
              titulo: '5. Enviar convite do Portal do Cliente',
              descricao: 'Conecte seus clientes empresariais para consulta de guias e tributos.',
              concluido: Boolean(checklist.convite_portal),
              botao: 'Portal de Acessos',
              onClick: () => navigate('/portal-acessos'),
            },
          ]

          const concluidas = etapas.filter((e) => e.concluido).length
          const progresso = Math.round((concluidas / etapas.length) * 100)

          const handlePular = async () => {
            setOnboardingDismissed(true)
            if (tenant?.id) {
              try {
                await tenantService.updateOnboarding(tenant.id, { ignorado: true })
                await refreshAuth()
              } catch {
                /* intentionally ignored */
              }
            }
          }

          return (
            <Card className="rounded-3xl border-2 border-teal-500/30 bg-gradient-to-br from-teal-50/60 via-white to-slate-50 p-5 shadow-xs">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-teal-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0FA3A3] text-white shadow-xs">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#1A2333]">
                        Onboarding Guiado do Escritório
                      </h3>
                      <Badge className="bg-teal-100 text-teal-800 text-[10px] font-bold">
                        {concluidas} de {etapas.length} etapas
                      </Badge>
                    </div>
                    <p className="text-xs text-[#64748B]">
                      Configure seu novo ambiente contábil para iniciar as operações com máxima
                      conformidade.
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePular}
                  className="h-7 text-xs text-[#64748B] hover:text-[#1A2333]"
                >
                  Pular por agora
                </Button>
              </div>

              <div className="mt-3 space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-[#1A2333]">
                    <span>Progresso de configuração</span>
                    <span>{progresso}%</span>
                  </div>
                  <Progress value={progresso} className="h-2 bg-teal-100" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1">
                  {etapas.map((et) => (
                    <div
                      key={et.id}
                      className={`flex flex-col justify-between p-3 rounded-xl border text-xs transition-all ${
                        et.concluido
                          ? 'bg-emerald-50/50 border-emerald-200'
                          : 'bg-white border-[#E2E8F0] shadow-2xs hover:border-teal-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-[#1A2333] text-[11px]">{et.titulo}</span>
                          {et.concluido ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Clock className="h-3.5 w-3.5 text-slate-300" />
                          )}
                        </div>
                        <p className="text-[10px] text-[#64748B] line-clamp-2 leading-relaxed">
                          {et.descricao}
                        </p>
                      </div>

                      <div className="pt-2">
                        <Button
                          size="sm"
                          variant={et.concluido ? 'outline' : 'default'}
                          onClick={et.onClick}
                          disabled={carregandoPlanoPadrao && et.id === 'plano_contas'}
                          className={`w-full h-6 text-[10px] font-semibold rounded-lg ${
                            et.concluido
                              ? 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                              : 'bg-[#0FA3A3] text-white hover:bg-[#0C8585]'
                          }`}
                        >
                          {carregandoPlanoPadrao && et.id === 'plano_contas'
                            ? 'Carregando...'
                            : et.concluido
                              ? 'Concluído'
                              : et.botao}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )
        })()}

      {/* 4 KPIs Grid Principais */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1 */}
        <Card
          onClick={() => navigate('/empresas')}
          className="rounded-2xl border-[#E2E8F0] shadow-xs hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer group"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-[#64748B] group-hover:text-[#0FA3A3] transition-colors">
              Empresas Ativas
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-[#0FA3A3]">
              <Building2 className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-[#1A2333]">{activeEmpresasCount}</div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Carteira monitorada</span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2 */}
        <Card
          onClick={() => navigate('/documentos')}
          className="rounded-2xl border-[#E2E8F0] shadow-xs hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer group"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-[#64748B] group-hover:text-[#3B82F6] transition-colors">
              Documentos no Mês
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#3B82F6]">
              <FileText className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-[#1A2333]">{monthDocsCount}</div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-[#64748B] font-medium">
              <span>
                {documentos.filter((d) => d.status === 'pendente').length} pendentes de validação
              </span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3 */}
        <Card
          onClick={() => navigate('/workflow')}
          className="rounded-2xl border-[#E2E8F0] shadow-xs hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer group"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-[#64748B] group-hover:text-[#F59E0B] transition-colors">
              Workflows & Solicitações
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-[#F59E0B]">
              <GitPullRequest className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-[#1A2333]">{pendingWfsCount}</div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-[#64748B]">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <span>Rotinas ativas no Kanban</span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4 */}
        <Card
          onClick={() => navigate('/obrigacoes')}
          className="rounded-2xl border-[#E2E8F0] shadow-xs hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer group"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-[#64748B] group-hover:text-red-600 transition-colors">
              Fiscal Pendente
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-[#EF4444]">
              <Calculator className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-[#1A2333]">{pendingFiscalCount}</div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-[#EF4444] font-medium">
              <span>Aguardando apuração ou envio</span>
            </div>
          </CardContent>
        </Card>
      </div>

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

      {/* Seção de Ações Rápidas */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-[#1A2333]">Ações Rápidas</CardTitle>
          <CardDescription className="text-xs text-[#64748B]">
            Atalhos de produtividade imediata
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {!isCliente && (
              <Button
                onClick={() => navigate('/empresas/nova')}
                className="w-full justify-start gap-3 h-12 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#1A2333] shadow-2xs font-semibold text-xs"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-[#0FA3A3]">
                  <PlusCircle className="h-4 w-4" />
                </div>
                <span>Nova Empresa</span>
              </Button>
            )}

            <Button
              onClick={() => navigate(isCliente ? '/portal?tab=documentos' : '/documentos')}
              className="w-full justify-start gap-3 h-12 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#1A2333] shadow-2xs font-semibold text-xs"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[#3B82F6]">
                <UploadCloud className="h-4 w-4" />
              </div>
              <span>Enviar Documento GED</span>
            </Button>

            {!isCliente && (
              <Button
                onClick={() => navigate('/workflow')}
                className="w-full justify-start gap-3 h-12 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#1A2333] shadow-2xs font-semibold text-xs"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-[#F59E0B]">
                  <GitPullRequest className="h-4 w-4" />
                </div>
                <span>Criar Workflow</span>
              </Button>
            )}

            <Button
              onClick={() => navigate('/rumo-agent')}
              className="w-full justify-between h-12 rounded-xl bg-gradient-to-r from-[#0B1F3A] to-[#123B6D] hover:from-[#123B6D] hover:to-[#0B1F3A] text-white shadow-xs font-semibold text-xs transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-400/20 text-[#0FA3A3]">
                  <Sparkles className="h-4 w-4 text-teal-300" />
                </div>
                <span>Abrir Rumo Agent (IA)</span>
              </div>
              <ArrowRight className="h-4 w-4 text-teal-300" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

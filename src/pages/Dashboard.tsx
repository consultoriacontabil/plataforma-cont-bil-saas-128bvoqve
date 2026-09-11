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
  X,
  Clock,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { useAuth } from '@/contexts/AuthContext'
import { empresasService } from '@/services/empresas'
import { documentosService } from '@/services/documentos'
import { workflowService } from '@/services/workflows'
import { fiscalService } from '@/services/fiscal'
import { useRealtime } from '@/hooks/use-realtime'
import { formatRelativeTimePtBr } from '@/lib/formatters'
import type { Empresa, Documento, Workflow, FiscalRecord, WorkflowActivity } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function Dashboard() {
  const { user, tenant } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [fiscalList, setFiscalList] = useState<FiscalRecord[]>([])
  const [activities, setActivities] = useState<WorkflowActivity[]>([])
  const [loading, setLoading] = useState(true)

  // Onboarding checklist state
  const [showOnboarding, setShowOnboarding] = useState(
    Boolean((location.state as { showOnboarding?: boolean })?.showOnboarding),
  )

  const loadData = useCallback(async () => {
    if (!tenant?.id) return
    try {
      const [empRes, docRes, wfRes, fiscRes] = await Promise.all([
        empresasService.list(tenant.id),
        documentosService.list(tenant.id),
        workflowService.list(tenant.id),
        fiscalService.list(tenant.id),
      ])

      setEmpresas(empRes)
      setDocumentos(docRes)
      setWorkflows(wfRes)
      setFiscalList(fiscRes)

      // Fetch workflow activities
      try {
        const actRes = await workflowService.listActivities(wfRes[0]?.id || '')
        setActivities(actRes.slice(0, 10))
      } catch {
        /* intentionally ignored */
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err)
    } finally {
      setLoading(false)
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
    () => workflows.filter((w) => w.status === 'em_andamento').length,
    [workflows],
  )

  const pendingFiscalCount = useMemo(
    () => fiscalList.filter((f) => f.status === 'pendente').length,
    [fiscalList],
  )

  // Chart 1: Workflow Status Bar Data
  const workflowStatusData = useMemo(() => {
    const counts: Record<string, number> = {
      concluido: 0,
      em_andamento: 0,
      pendente: 0,
      cancelado: 0,
    }
    workflows.forEach((w) => {
      if (counts[w.status] !== undefined) {
        counts[w.status]++
      }
    })
    return [
      { name: 'Concluído', status: 'concluido', total: counts.concluido, fill: '#22C55E' },
      { name: 'Em Andamento', status: 'em_andamento', total: counts.em_andamento, fill: '#3B82F6' },
      { name: 'Pendente', status: 'pendente', total: counts.pendente, fill: '#F59E0B' },
      { name: 'Cancelado', status: 'cancelado', total: counts.cancelado, fill: '#EF4444' },
    ]
  }, [workflows])

  // Chart 2: Documentos por Tipo Donut Data
  const donutColors = ['#0FA3A3', '#3B82F6', '#F59E0B', '#22C55E', '#8B5CF6', '#F43F5E']
  const docsByTypeData = useMemo(() => {
    const map: Record<string, number> = {}
    documentos.forEach((d) => {
      const label = d.tipo.replace('_', ' ')
      map[label] = (map[label] || 0) + 1
    })

    const result = Object.entries(map).map(([name, value], i) => ({
      name,
      value,
      color: donutColors[i % donutColors.length],
    }))

    if (result.length === 0) {
      return [{ name: 'Sem documentos', value: 1, color: '#E2E8F0' }]
    }
    return result
  }, [documentos])

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Welcome Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#1A2333] md:text-3xl">
            {greeting}, {user?.name ? user.name.split(' ')[0] : 'Contador'}!
          </h2>
          <p className="text-xs sm:text-sm capitalize text-[#64748B]">{todayStr}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-[#0FA3A3]/10 text-[#0FA3A3] hover:bg-[#0FA3A3]/20 border-teal-200">
            Escritório: {tenant?.nome || 'Rumo Contábil'}
          </Badge>
        </div>
      </div>

      {/* Inline Onboarding Checklist (dismissible) */}
      {showOnboarding && (
        <Card className="border border-teal-200 bg-gradient-to-r from-teal-50/70 to-emerald-50/70 p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#0FA3A3]" />
                <h4 className="text-sm font-bold text-[#0B1F3A]">
                  Checklist de Inicialização do Escritório
                </h4>
              </div>
              <p className="text-xs text-[#64748B]">
                Complete os passos fundamentais para operar com alta produtividade contábil.
              </p>
            </div>
            <button
              onClick={() => setShowOnboarding(false)}
              className="text-[#94A3B8] hover:text-[#1A2333]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4 text-xs">
            <button
              onClick={() => navigate('/empresas/nova')}
              className="flex items-center gap-2 rounded-lg bg-white p-3 text-left font-medium shadow-xs hover:border-[#0FA3A3] border border-transparent transition-all"
            >
              <CheckCircle2 className="h-4 w-4 text-[#0FA3A3]" />
              <span>1. Cadastrar 1ª Empresa</span>
            </button>

            <button
              onClick={() => navigate('/documentos')}
              className="flex items-center gap-2 rounded-lg bg-white p-3 text-left font-medium shadow-xs hover:border-[#0FA3A3] border border-transparent transition-all"
            >
              <CheckCircle2 className="h-4 w-4 text-[#0FA3A3]" />
              <span>2. Subir Contrato/GED</span>
            </button>

            <button
              onClick={() => navigate('/workflow')}
              className="flex items-center gap-2 rounded-lg bg-white p-3 text-left font-medium shadow-xs hover:border-[#0FA3A3] border border-transparent transition-all"
            >
              <CheckCircle2 className="h-4 w-4 text-[#0FA3A3]" />
              <span>3. Criar Fluxo de Abertura</span>
            </button>

            <button
              onClick={() => navigate('/rumo-agent')}
              className="flex items-center gap-2 rounded-lg bg-white p-3 text-left font-medium shadow-xs hover:border-[#0FA3A3] border border-transparent transition-all"
            >
              <Sparkles className="h-4 w-4 text-[#0FA3A3]" />
              <span>4. Falar com Rumo Agent</span>
            </button>
          </div>
        </Card>
      )}

      {/* 4 KPIs Grid (4 col desktop / 2 tablet / 1 mobile) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1 */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs hover:shadow-md transition-all hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-[#64748B]">Empresas Ativas</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-[#0FA3A3]">
              <Building2 className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-[#1A2333]">{activeEmpresasCount}</div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>+12% vs. mês anterior</span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2 */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs hover:shadow-md transition-all hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-[#64748B]">Documentos no Mês</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#3B82F6]">
              <FileText className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-[#1A2333]">{monthDocsCount}</div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>+8% vs. mês anterior</span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3 */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs hover:shadow-md transition-all hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-[#64748B]">Workflows em Andamento</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-[#F59E0B]">
              <GitPullRequest className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-[#1A2333]">{pendingWfsCount}</div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-[#64748B]">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <span>Rotinas ativas no kanban</span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4 */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs hover:shadow-md transition-all hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-[#64748B]">Fiscal Pendente</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-[#EF4444]">
              <Calculator className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-[#1A2333]">{pendingFiscalCount}</div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-[#EF4444] font-medium">
              <span>Aguardando apuração/recibo</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Area: Atividade Recente (2/3) + Ações Rápidas (1/3) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Atividade Recente (2/3) */}
        <Card className="lg:col-span-2 rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold text-[#1A2333]">
                Atividade Recente
              </CardTitle>
              <CardDescription className="text-xs text-[#64748B]">
                Últimas movimentações operacionais do escritório
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/auditoria')}
              className="text-xs text-[#0FA3A3] hover:text-[#0C8585]"
            >
              Ver auditoria completa
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Clock className="h-8 w-8 text-[#94A3B8] mb-2" />
                  <p className="text-xs text-[#64748B]">Nenhuma atividade recente registrada.</p>
                </div>
              ) : (
                activities.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-start justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[#0B1F3A] text-xs font-bold">
                        {act.expand?.usuario_id?.name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#1A2333]">
                          {act.expand?.usuario_id?.name || 'Sistema'}
                        </p>
                        <p className="text-xs text-[#64748B]">{act.acao}</p>
                        {act.comentario && (
                          <p className="mt-0.5 text-[11px] text-[#94A3B8] italic">
                            &quot;{act.comentario}&quot;
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] text-[#94A3B8] whitespace-nowrap">
                      {formatRelativeTimePtBr(act.created)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Ações Rápidas (1/3) */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-[#1A2333]">Ações Rápidas</CardTitle>
            <CardDescription className="text-xs text-[#64748B]">
              Atalhos de produtividade imediata
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <Button
              onClick={() => navigate('/empresas/nova')}
              className="w-full justify-start gap-3 h-11 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#1A2333] shadow-2xs font-semibold text-xs"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-[#0FA3A3]">
                <PlusCircle className="h-4 w-4" />
              </div>
              <span>Nova Empresa</span>
            </Button>

            <Button
              onClick={() => navigate('/documentos')}
              className="w-full justify-start gap-3 h-11 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#1A2333] shadow-2xs font-semibold text-xs"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[#3B82F6]">
                <UploadCloud className="h-4 w-4" />
              </div>
              <span>Enviar Documento GED</span>
            </Button>

            <Button
              onClick={() => navigate('/workflow')}
              className="w-full justify-start gap-3 h-11 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#1A2333] shadow-2xs font-semibold text-xs"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-[#F59E0B]">
                <GitPullRequest className="h-4 w-4" />
              </div>
              <span>Criar Workflow</span>
            </Button>

            <Button
              onClick={() => navigate('/rumo-agent')}
              className="w-full justify-between h-11 rounded-xl bg-gradient-to-r from-[#0B1F3A] to-[#123B6D] hover:from-[#123B6D] hover:to-[#0B1F3A] text-white shadow-xs font-semibold text-xs transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-400/20 text-[#0FA3A3]">
                  <Sparkles className="h-4 w-4 text-teal-300" />
                </div>
                <span>Abrir Rumo Agent (IA)</span>
              </div>
              <ArrowRight className="h-4 w-4 text-teal-300" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row Charts: Workflow Status Bar + Documentos Donut */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Workflow Status Bar Chart */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-[#1A2333]">
              Workflows por Status
            </CardTitle>
            <CardDescription className="text-xs text-[#64748B]">
              Distribuição de solicitações ativas e concluídas
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={workflowStatusData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <XAxis type="number" allowDecimals={false} stroke="#94A3B8" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="#64748B" fontSize={11} width={90} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    borderColor: '#E2E8F0',
                    fontSize: '12px',
                  }}
                  cursor={{ fill: '#F1F5F9' }}
                />
                <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                  {workflowStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Documentos Donut Chart */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-[#1A2333]">
              Documentos por Tipo
            </CardTitle>
            <CardDescription className="text-xs text-[#64748B]">
              Volume de arquivos GED categorizados no escritório
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={docsByTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {docsByTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    borderColor: '#E2E8F0',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  formatter={(value) => (
                    <span className="text-xs text-[#64748B] capitalize">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

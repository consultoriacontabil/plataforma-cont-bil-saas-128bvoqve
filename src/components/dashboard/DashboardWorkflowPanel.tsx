import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  GitPullRequest,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowUpRight,
  UserCheck,
  Building2,
  Plus,
  Send,
  Sparkles,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatRelativeTimePtBr } from '@/lib/formatters'
import type { Workflow, CompanyOnboardingWorkflowRecord } from '@/types'
import { cn } from '@/lib/utils'

interface DashboardWorkflowPanelProps {
  workflows: Workflow[]
  onboardingWorkflows?: CompanyOnboardingWorkflowRecord[]
  loading?: boolean
  error?: string | null
  isCliente?: boolean
}

export const DashboardWorkflowPanel: React.FC<DashboardWorkflowPanelProps> = ({
  workflows,
  onboardingWorkflows = [],
  loading = false,
  error = null,
  isCliente = false,
}) => {
  const navigate = useNavigate()
  const [activeFilter, setActiveFilter] = useState<
    'todos' | 'em_andamento' | 'pendente' | 'abertura_cliente'
  >('todos')

  // Contadores por status
  const stats = useMemo(() => {
    let pendente = 0
    let emAndamento = 0
    let concluido = 0
    let cancelado = 0

    workflows.forEach((w) => {
      if (w.status === 'pendente') pendente++
      else if (w.status === 'em_andamento') emAndamento++
      else if (w.status === 'concluido') concluido++
      else if (w.status === 'cancelado') cancelado++
    })

    const aberturasAtivas = onboardingWorkflows.filter(
      (ow) =>
        ow.status === 'em_andamento' ||
        ow.status === 'aguardando_cliente' ||
        ow.status === 'em_analise',
    ).length

    return { pendente, emAndamento, concluido, cancelado, aberturasAtivas }
  }, [workflows, onboardingWorkflows])

  // Lista unificada para exibição
  const solicitacoesFiltradas = useMemo(() => {
    // Casos de filtro de onboarding
    if (activeFilter === 'abertura_cliente') {
      return onboardingWorkflows
        .filter((ow) => ow.status !== 'concluido' && ow.status !== 'cancelado')
        .map((ow) => ({
          id: ow.id,
          titulo: ow.razao_social_pretendida || ow.titulo || 'Processo de Abertura',
          empresaOuCliente: ow.cliente_nome
            ? `Cliente: ${ow.cliente_nome}`
            : 'Abertura de Nova Empresa',
          status: ow.status,
          tipo: 'abertura_empresa',
          prioridade: 'alta' as const,
          created: ow.created,
          isAbertura: true,
          token: ow.token,
          responsavel: 'Onboarding Digital',
        }))
    }

    // Casos padrão de workflows
    const list = workflows
      .filter((w) => {
        if (activeFilter === 'todos') return w.status !== 'cancelado'
        return w.status === activeFilter
      })
      .map((w) => ({
        id: w.id,
        titulo: w.titulo,
        empresaOuCliente:
          w.expand?.empresa_id?.nome_fantasia ||
          w.expand?.empresa_id?.razao_social ||
          'Operação interna',
        status: w.status,
        tipo: w.tipo,
        prioridade: w.prioridade,
        created: w.created,
        prazo: w.prazo,
        isAbertura: false,
        token: undefined,
        responsavel: w.expand?.atribuido_id?.name || 'Não atribuído',
      }))

    // Se estiver em 'todos', incorporar as aberturas do onboarding cliente ativas no topo
    if (activeFilter === 'todos') {
      const aberturasMap = onboardingWorkflows
        .filter((ow) => ow.status !== 'concluido' && ow.status !== 'cancelado')
        .map((ow) => ({
          id: ow.id,
          titulo: `Abertura: ${ow.razao_social_pretendida || ow.titulo}`,
          empresaOuCliente: ow.cliente_nome ? `Cliente: ${ow.cliente_nome}` : 'Abertura Online',
          status: ow.status,
          tipo: 'abertura_empresa',
          prioridade: 'alta' as const,
          created: ow.created,
          isAbertura: true,
          token: ow.token,
          responsavel: 'Link Público / Portal',
        }))

      return [...aberturasMap, ...list]
    }

    return list
  }, [workflows, onboardingWorkflows, activeFilter])

  const renderStatusBadge = (status: string, isAbertura: boolean) => {
    if (isAbertura) {
      if (status === 'aguardando_cliente') {
        return (
          <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] font-semibold gap-1">
            <Send className="h-3 w-3 text-purple-600" />
            Aguardando Cliente
          </Badge>
        )
      }
      if (status === 'em_analise') {
        return (
          <Badge className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] font-semibold gap-1">
            <Clock className="h-3 w-3 text-amber-600" />
            Em Análise Docs
          </Badge>
        )
      }
    }

    switch (status) {
      case 'em_andamento':
        return (
          <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-semibold gap-1">
            <Clock className="h-3 w-3 text-blue-600" />
            Em Andamento
          </Badge>
        )
      case 'pendente':
        return (
          <Badge className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] font-semibold gap-1">
            <AlertCircle className="h-3 w-3 text-amber-600" />
            Pendente
          </Badge>
        )
      case 'concluido':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            Concluído
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[10px] font-semibold">
            {status}
          </Badge>
        )
    }
  }

  return (
    <Card className="rounded-2xl border-[#E2E8F0] shadow-xs overflow-hidden flex flex-col h-full">
      <CardHeader className="p-5 pb-3 bg-gradient-to-r from-blue-50/50 via-white to-teal-50/30 border-b border-[#E2E8F0]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-[#3B82F6]">
              <GitPullRequest className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-[#1A2333]">
                  Solicitações & Workflow
                </CardTitle>
                <Badge className="bg-[#0FA3A3]/10 text-[#0FA3A3] border-teal-200 text-[10px] font-bold">
                  {stats.emAndamento + stats.pendente + stats.aberturasAtivas} ativas
                </Badge>
              </div>
              <CardDescription className="text-xs text-[#64748B]">
                Demandas operacionais, rotinas em andamento e processos com clientes
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {!isCliente && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/workflow')}
                className="h-8 text-xs font-semibold gap-1.5 border-[#3B82F6] text-[#3B82F6] hover:bg-blue-50 rounded-xl"
              >
                <span>Abrir Kanban</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Contadores Rápidos com Filtro em Clique */}
        <div className="grid grid-cols-2 gap-2 pt-3 sm:grid-cols-4">
          <button
            type="button"
            onClick={() =>
              setActiveFilter(activeFilter === 'em_andamento' ? 'todos' : 'em_andamento')
            }
            className={cn(
              'flex flex-col text-left p-2.5 rounded-xl border transition-all text-xs',
              activeFilter === 'em_andamento'
                ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-400'
                : 'bg-white border-[#E2E8F0] hover:border-blue-200 hover:bg-blue-50/30',
            )}
          >
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Em Andamento
            </span>
            <span className="text-xl font-extrabold text-blue-600 mt-0.5">{stats.emAndamento}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter(activeFilter === 'pendente' ? 'todos' : 'pendente')}
            className={cn(
              'flex flex-col text-left p-2.5 rounded-xl border transition-all text-xs',
              activeFilter === 'pendente'
                ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-400'
                : 'bg-white border-[#E2E8F0] hover:border-amber-200 hover:bg-amber-50/30',
            )}
          >
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Pendentes
            </span>
            <span className="text-xl font-extrabold text-amber-700 mt-0.5">{stats.pendente}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveFilter(activeFilter === 'abertura_cliente' ? 'todos' : 'abertura_cliente')
            }
            className={cn(
              'flex flex-col text-left p-2.5 rounded-xl border transition-all text-xs',
              activeFilter === 'abertura_cliente'
                ? 'bg-purple-50 border-purple-300 ring-1 ring-purple-400'
                : 'bg-white border-[#E2E8F0] hover:border-purple-200 hover:bg-purple-50/30',
            )}
          >
            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1">
              <Send className="h-3 w-3" />
              Portal Cliente
            </span>
            <span className="text-xl font-extrabold text-purple-700 mt-0.5">
              {stats.aberturasAtivas}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('todos')}
            className={cn(
              'flex flex-col text-left p-2.5 rounded-xl border transition-all text-xs',
              activeFilter === 'todos'
                ? 'bg-teal-50 border-teal-300 ring-1 ring-teal-400'
                : 'bg-white border-[#E2E8F0] hover:border-teal-200 hover:bg-teal-50/30',
            )}
          >
            <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Concluídas
            </span>
            <span className="text-xl font-extrabold text-teal-600 mt-0.5">{stats.concluido}</span>
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 flex flex-col">
        {error ? (
          <div className="p-6 text-center text-xs text-red-600 bg-red-50/50">
            <AlertCircle className="h-6 w-6 mx-auto mb-2 text-red-500" />
            <p className="font-semibold">Erro ao carregar solicitações</p>
            <p className="text-[11px] text-red-500 mt-1">{error}</p>
          </div>
        ) : loading ? (
          <div className="p-8 text-center text-xs text-[#64748B] space-y-2">
            <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Carregando solicitações...</p>
          </div>
        ) : solicitacoesFiltradas.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#64748B] my-auto">
            <div className="h-10 w-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2">
              <GitPullRequest className="h-5 w-5" />
            </div>
            <p className="font-bold text-sm text-[#1A2333]">Nenhuma solicitação encontrada</p>
            <p className="text-[11px] text-[#64748B] mt-1 max-w-xs mx-auto">
              {activeFilter === 'todos'
                ? 'Nenhum fluxo de trabalho ativo no momento. Crie uma nova rotina no Kanban ou aguarde solicitações do portal.'
                : `Nenhuma solicitação com o status "${activeFilter}".`}
            </p>
            {!isCliente && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/workflow')}
                className="mt-3 h-8 text-xs gap-1 border-[#E2E8F0]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Nova Solicitação</span>
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
            {solicitacoesFiltradas.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (item.isAbertura) {
                    navigate(`/workflow/${item.id}`)
                  } else {
                    navigate(`/workflow/${item.id}`)
                  }
                }}
                className="p-3.5 px-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50 cursor-pointer transition-colors group"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/workflow/${item.id}`)
                }}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold mt-0.5 border',
                      item.isAbertura
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200',
                    )}
                  >
                    {item.isAbertura ? (
                      <Sparkles className="h-4 w-4" />
                    ) : (
                      <GitPullRequest className="h-4 w-4" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-bold text-[#1A2333] group-hover:text-[#0FA3A3] transition-colors truncate">
                        {item.titulo}
                      </p>
                      {item.isAbertura && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                          Portal Abertura
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[11px] text-[#64748B] flex-wrap">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-slate-400" />
                        <strong className="text-slate-700">{item.empresaOuCliente}</strong>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <UserCheck className="h-3 w-3 text-slate-400" />
                        <span>{item.responsavel}</span>
                      </span>
                      <span>•</span>
                      <span>{formatRelativeTimePtBr(item.created)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0">
                  <div>{renderStatusBadge(item.status, item.isAbertura)}</div>
                  <div className="text-[#64748B] group-hover:text-[#0FA3A3] group-hover:translate-x-0.5 transition-all">
                    <ArrowUpRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

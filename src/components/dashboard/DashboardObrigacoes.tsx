import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  Filter,
  Check,
  Building2,
  CalendarDays,
  FileCheck2,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatRelativeTimePtBr } from '@/lib/formatters'
import type { ObrigacaoRecord } from '@/types'
import { cn } from '@/lib/utils'

interface DashboardObrigacoesProps {
  obrigacoes: ObrigacaoRecord[]
  loading?: boolean
  error?: string | null
  onMarcarEntregue?: (id: string) => Promise<void>
  isCliente?: boolean
}

export const DashboardObrigacoes: React.FC<DashboardObrigacoesProps> = ({
  obrigacoes,
  loading = false,
  error = null,
  onMarcarEntregue,
  isCliente = false,
}) => {
  const navigate = useNavigate()
  const [periodoFiltro, setPeriodoFiltro] = useState<'7' | '15' | '30' | 'todas'>('15')
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'vencidas' | 'a_vencer' | 'entregues'>(
    'todos',
  )
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Estatísticas e classificação
  const stats = useMemo(() => {
    const now = new Date()
    let vencidas = 0
    let aVencer7 = 0
    let aVencer15 = 0
    let aVencer30 = 0
    let entregues = 0

    obrigacoes.forEach((ob) => {
      if (ob.status === 'cancelada') return
      if (ob.status === 'entregue') {
        entregues++
        return
      }

      const venc = new Date(ob.vencimento)
      const diffMs = venc.getTime() - now.getTime()
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

      if (diffDays < 0 || ob.status === 'atrasada') {
        vencidas++
      } else {
        if (diffDays <= 7) aVencer7++
        if (diffDays <= 15) aVencer15++
        if (diffDays <= 30) aVencer30++
      }
    })

    return { vencidas, aVencer7, aVencer15, aVencer30, entregues }
  }, [obrigacoes])

  // Filtragem das obrigações conforme controles
  const obrigaçõesFiltradas = useMemo(() => {
    const now = new Date()
    return obrigacoes
      .filter((ob) => {
        if (ob.status === 'cancelada') return false

        const venc = new Date(ob.vencimento)
        const diffDays = Math.ceil((venc.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        const isVencida = (diffDays < 0 || ob.status === 'atrasada') && ob.status !== 'entregue'
        const isEntregue = ob.status === 'entregue'
        const isAVencer = !isVencida && !isEntregue

        // Filtro de Status
        if (statusFiltro === 'vencidas' && !isVencida) return false
        if (statusFiltro === 'entregues' && !isEntregue) return false
        if (statusFiltro === 'a_vencer' && !isAVencer) return false

        // Filtro de Período (apenas para não entregues ou se não for 'todas')
        if (periodoFiltro !== 'todas' && !isEntregue) {
          const limiteDias = parseInt(periodoFiltro, 10)
          if (isVencida) {
            // vencidas continuam visíveis no período próximo para atenção imediata
            return true
          }
          if (diffDays > limiteDias) return false
        }

        return true
      })
      .sort((a, b) => {
        // Ordena: vencidas primeiro, depois próximas a vencer, por último entregues
        const isEntregueA = a.status === 'entregue' ? 1 : 0
        const isEntregueB = b.status === 'entregue' ? 1 : 0
        if (isEntregueA !== isEntregueB) return isEntregueA - isEntregueB

        const dateA = new Date(a.vencimento).getTime()
        const dateB = new Date(b.vencimento).getTime()
        return dateA - dateB
      })
  }, [obrigacoes, periodoFiltro, statusFiltro])

  const handleEntrega = async (id: string) => {
    if (!onMarcarEntregue) return
    try {
      setUpdatingId(id)
      await onMarcarEntregue(id)
    } finally {
      setUpdatingId(null)
    }
  }

  const renderBadge = (ob: ObrigacaoRecord) => {
    if (ob.status === 'entregue') {
      return (
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-[10px] font-semibold gap-1">
          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          Transmitida
        </Badge>
      )
    }

    const now = new Date()
    const venc = new Date(ob.vencimento)
    const diffDays = Math.ceil((venc.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays < 0 || ob.status === 'atrasada') {
      return (
        <Badge className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 text-[10px] font-bold gap-1 animate-pulse">
          <AlertCircle className="h-3 w-3 text-red-600" />
          Vencida ({Math.abs(diffDays)}d atrás)
        </Badge>
      )
    }

    if (diffDays <= 7) {
      return (
        <Badge className="bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 text-[10px] font-semibold gap-1">
          <Clock className="h-3 w-3 text-amber-600" />
          Vence em {diffDays === 0 ? 'hoje' : `${diffDays}d`}
        </Badge>
      )
    }

    if (diffDays <= 15) {
      return (
        <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 text-[10px] font-semibold gap-1">
          <CalendarDays className="h-3 w-3 text-blue-600" />
          Vence em {diffDays}d
        </Badge>
      )
    }

    return (
      <Badge className="bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 text-[10px] font-medium gap-1">
        <Calendar className="h-3 w-3 text-slate-500" />
        Vence em {diffDays}d
      </Badge>
    )
  }

  return (
    <Card className="rounded-2xl border-[#E2E8F0] shadow-xs overflow-hidden">
      <CardHeader className="p-5 pb-4 bg-gradient-to-r from-slate-50/70 via-white to-teal-50/20 border-b border-[#E2E8F0]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-[#0FA3A3]">
                <Calendar className="h-4 w-4" />
              </div>
              <CardTitle className="text-base font-bold text-[#1A2333]">
                Obrigações Fiscais do Período
              </CardTitle>
              {stats.vencidas > 0 && (
                <Badge className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5">
                  {stats.vencidas} pendente{stats.vencidas > 1 ? 's' : ''} crítica
                  {stats.vencidas > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs text-[#64748B]">
              Vencimentos fiscais, declarações acessórias e guias tributárias
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(isCliente ? '/portal?tab=obrigacoes' : '/obrigacoes')}
              className="h-8 text-xs font-semibold gap-1.5 border-[#0FA3A3] text-[#0FA3A3] hover:bg-teal-50 rounded-xl"
            >
              <span>{isCliente ? 'Ver no Portal' : 'Abrir Módulo Fiscal'}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Contadores Rápidos de Período */}
        <div className="grid grid-cols-2 gap-2 pt-3 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => {
              setStatusFiltro(statusFiltro === 'vencidas' ? 'todos' : 'vencidas')
              setPeriodoFiltro('todas')
            }}
            className={cn(
              'flex flex-col text-left p-2.5 rounded-xl border transition-all text-xs',
              statusFiltro === 'vencidas'
                ? 'bg-red-50 border-red-300 ring-1 ring-red-400'
                : 'bg-white border-[#E2E8F0] hover:border-red-200 hover:bg-red-50/40',
            )}
          >
            <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Vencidas
            </span>
            <span className="text-xl font-extrabold text-red-600 mt-0.5">{stats.vencidas}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFiltro('a_vencer')
              setPeriodoFiltro('7')
            }}
            className={cn(
              'flex flex-col text-left p-2.5 rounded-xl border transition-all text-xs',
              statusFiltro === 'a_vencer' && periodoFiltro === '7'
                ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-400'
                : 'bg-white border-[#E2E8F0] hover:border-amber-200 hover:bg-amber-50/40',
            )}
          >
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Próx. 7 dias
            </span>
            <span className="text-xl font-extrabold text-amber-700 mt-0.5">{stats.aVencer7}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFiltro('a_vencer')
              setPeriodoFiltro('15')
            }}
            className={cn(
              'flex flex-col text-left p-2.5 rounded-xl border transition-all text-xs',
              statusFiltro === 'a_vencer' && periodoFiltro === '15'
                ? 'bg-teal-50 border-teal-300 ring-1 ring-teal-400'
                : 'bg-white border-[#E2E8F0] hover:border-teal-200 hover:bg-teal-50/40',
            )}
          >
            <span className="text-[10px] font-bold text-[#0FA3A3] uppercase tracking-wider flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              Próx. 15 dias
            </span>
            <span className="text-xl font-extrabold text-[#0B1F3A] mt-0.5">{stats.aVencer15}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFiltro(statusFiltro === 'entregues' ? 'todos' : 'entregues')
              setPeriodoFiltro('todas')
            }}
            className={cn(
              'flex flex-col text-left p-2.5 rounded-xl border transition-all text-xs',
              statusFiltro === 'entregues'
                ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-400'
                : 'bg-white border-[#E2E8F0] hover:border-emerald-200 hover:bg-emerald-50/40',
            )}
          >
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
              <FileCheck2 className="h-3 w-3" />
              Transmitidas
            </span>
            <span className="text-xl font-extrabold text-emerald-600 mt-0.5">
              {stats.entregues}
            </span>
          </button>
        </div>

        {/* Barra de Filtros Rápidos */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-[#64748B] flex items-center gap-1 mr-1">
              <Filter className="h-3 w-3" /> Janela:
            </span>
            {(['7', '15', '30', 'todas'] as const).map((dias) => (
              <button
                key={dias}
                type="button"
                onClick={() => setPeriodoFiltro(dias)}
                className={cn(
                  'px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all',
                  periodoFiltro === dias
                    ? 'bg-[#0B1F3A] text-white shadow-2xs'
                    : 'bg-slate-100 text-[#64748B] hover:bg-slate-200 hover:text-[#1A2333]',
                )}
              >
                {dias === 'todas' ? 'Todas' : `${dias} dias`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            {statusFiltro !== 'todos' && (
              <button
                type="button"
                onClick={() => setStatusFiltro('todos')}
                className="text-[11px] text-[#0FA3A3] hover:underline font-semibold"
              >
                Limpar filtro ({statusFiltro})
              </button>
            )}
            <span className="text-[11px] text-[#64748B]">
              Mostrando <strong className="text-[#1A2333]">{obrigaçõesFiltradas.length}</strong>{' '}
              itens
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {error ? (
          <div className="p-6 text-center text-xs text-red-600 bg-red-50/50">
            <AlertCircle className="h-6 w-6 mx-auto mb-2 text-red-500" />
            <p className="font-semibold">Erro ao carregar obrigações fiscais</p>
            <p className="text-[11px] text-red-500 mt-1">{error}</p>
          </div>
        ) : loading ? (
          <div className="p-8 text-center text-xs text-[#64748B] space-y-2">
            <div className="h-6 w-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Carregando calendário fiscal...</p>
          </div>
        ) : obrigaçõesFiltradas.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#64748B]">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="font-bold text-sm text-[#1A2333]">
              Nenhuma obrigação para o filtro selecionado
            </p>
            <p className="text-[11px] text-[#64748B] mt-1 max-w-sm mx-auto">
              {periodoFiltro === '7'
                ? 'Nenhuma obrigação a vencer nos próximos 7 dias. Seu calendário fiscal está em dia!'
                : periodoFiltro === '15'
                  ? 'Nenhuma obrigação a vencer nos próximos 15 dias.'
                  : 'Nenhuma obrigação encontrada para este critério de visualização.'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPeriodoFiltro('todas')
                setStatusFiltro('todos')
              }}
              className="mt-3 h-8 text-xs border-[#E2E8F0]"
            >
              Ver todas as obrigações
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
            {obrigaçõesFiltradas.map((ob) => {
              const empresaNome =
                ob.expand?.empresa_id?.nome_fantasia ||
                ob.expand?.empresa_id?.razao_social ||
                'Empresa não identificada'
              const venc = new Date(ob.vencimento)
              const vencStr = venc.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
              const valorFormatado =
                ob.valor && ob.valor > 0
                  ? ob.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                  : null

              return (
                <div
                  key={ob.id}
                  className="p-3.5 px-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#0B1F3A] font-bold text-xs border border-slate-200">
                      {ob.tipo}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            if (ob.empresa_id) {
                              navigate(
                                isCliente
                                  ? `/portal?tab=obrigacoes`
                                  : `/empresas/${ob.empresa_id}?tab=fiscal`,
                              )
                            }
                          }}
                          className="font-bold text-xs text-[#1A2333] hover:text-[#0FA3A3] text-left truncate flex items-center gap-1"
                        >
                          <Building2 className="h-3 w-3 text-[#64748B]" />
                          <span>{empresaNome}</span>
                        </button>
                        <span className="text-[11px] font-semibold text-[#64748B]">
                          • Comp. {ob.competencia}
                        </span>
                        {ob.exige_certificado && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            Certificado A1
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-[#64748B] flex-wrap">
                        <span>
                          Vencimento: <strong className="text-[#1A2333]">{vencStr}</strong>
                        </span>
                        {valorFormatado && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-emerald-700">{valorFormatado}</span>
                          </>
                        )}
                        {ob.observacoes && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[280px] italic text-[#64748B]">
                              &quot;{ob.observacoes}&quot;
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0">
                    <div>{renderBadge(ob)}</div>

                    <div className="flex items-center gap-1">
                      {ob.status !== 'entregue' && onMarcarEntregue && !isCliente && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEntrega(ob.id)}
                          disabled={updatingId === ob.id}
                          className="h-8 px-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 gap-1"
                          title="Marcar como transmitida/entregue"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span className="hidden md:inline">Marcar entregue</span>
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (ob.empresa_id) {
                            navigate(
                              isCliente
                                ? `/portal?tab=obrigacoes`
                                : `/empresas/${ob.empresa_id}?tab=fiscal`,
                            )
                          } else {
                            navigate('/obrigacoes')
                          }
                        }}
                        className="h-8 w-8 p-0 text-[#64748B] hover:text-[#0FA3A3] hover:bg-teal-50"
                        title="Abrir detalhes no Fiscal"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

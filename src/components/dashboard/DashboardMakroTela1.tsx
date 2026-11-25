import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Gauge,
  CalendarClock,
  Users,
  FileText,
  Calculator,
  Wallet,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import type { AgendaTributaria, Empresa, EmpresaRegime } from '@/types'
import { cn } from '@/lib/utils'

const LABEL_PERFIL: Record<string, string> = {
  simples_nacional: 'Simples Nacional',
  lucro_presumido: 'Lucro Presumido',
  lucro_real: 'Lucro Real',
  mei: 'MEI',
  todas: 'Todos os perfis',
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

interface DeptoCard {
  chave: string
  nome: string
  icone: React.ReactNode
  cor: string
  bg: string
  total: number
  concluidas: number
  vencidas: number
  aVencer: number
  percentual: number
}

interface DashboardMakroTela1Props {
  agenda: AgendaTributaria[]
  obrigacoes: {
    id: string
    status: string
    vencimento: string
    competencia: string
    tipo: string
    empresa_id?: string
    expand?: { empresa_id?: { nome_fantasia?: string; razao_social?: string } }
  }[]
  empresas: Empresa[]
  loading?: boolean
  competencia: string
}

export const DashboardMakroTela1: React.FC<DashboardMakroTela1Props> = ({
  agenda,
  obrigacoes,
  empresas,
  loading = false,
  competencia,
}) => {
  // Perfis distintos das empresas do tenant
  const perfisAtivos = useMemo(() => {
    const s = new Set<EmpresaRegime>()
    empresas.forEach((e) => {
      if (e.regime_tributario) s.add(e.regime_tributario)
    })
    return Array.from(s)
  }, [empresas])

  const agendaFiltrada = useMemo(
    () =>
      agenda.filter(
        (a) => a.perfil === 'todas' || perfisAtivos.includes(a.perfil as EmpresaRegime),
      ),
    [agenda, perfisAtivos],
  )

  // Percentual por departamento: obrigações existentes (status real) cruzadas com a agenda por tipo
  const departamentos: DeptoCard[] = useMemo(() => {
    const now = new Date()
    const defs: { chave: string; nome: string; icone: React.ReactNode; cor: string; bg: string }[] =
      [
        {
          chave: 'Pessoal',
          nome: 'Pessoal',
          icone: <Users className="h-4 w-4" />,
          cor: 'text-blue-700',
          bg: 'bg-blue-50/60 border-blue-200',
        },
        {
          chave: 'Fiscal',
          nome: 'Fiscal',
          icone: <FileText className="h-4 w-4" />,
          cor: 'text-teal-700',
          bg: 'bg-teal-50/60 border-teal-200',
        },
        {
          chave: 'Contábil',
          nome: 'Contábil',
          icone: <Calculator className="h-4 w-4" />,
          cor: 'text-purple-700',
          bg: 'bg-purple-50/60 border-purple-200',
        },
        {
          chave: 'Financeiro',
          nome: 'Financeiro',
          icone: <Wallet className="h-4 w-4" />,
          cor: 'text-amber-700',
          bg: 'bg-amber-50/60 border-amber-200',
        },
      ]

    return defs.map((d) => {
      const obrigacoesDepto = obrigacoes.filter((ob) => {
        const ag = agendaFiltrada.find((a) => a.obrigacao === ob.tipo)
        if (!ag) return false
        return ag.departamento === d.chave
      })
      const total = obrigacoesDepto.length
      const concluidas = obrigacoesDepto.filter((o) => o.status === 'entregue').length
      const vencidas = obrigacoesDepto.filter((o) => {
        if (o.status === 'entregue') return false
        const venc = new Date(o.vencimento)
        return venc < now || o.status === 'atrasada'
      }).length
      const aVencer = total - concluidas - vencidas
      const percentual = total > 0 ? Math.round((concluidas / total) * 100) : 100
      return { ...d, total, concluidas, vencidas, aVencer, percentual }
    })
  }, [obrigacoes, agendaFiltrada])

  // Grade de obrigações da agenda, com status derivado das obrigações reais da competência
  const grade = useMemo(() => {
    const [ano, mes] = competencia.split('-').map(Number)
    const ultimoDia = new Date(ano, mes, 0).getDate()
    const dataCompetenciaStr = `${competencia}-${String(ultimoDia).padStart(2, '0')}`
    const now = new Date()

    return agendaFiltrada
      .map((a) => {
        // vencimento real = dia do vencimento da agenda no mês seguinte à competência
        const mesVenc = mes === 12 ? 1 : mes + 1
        const anoVenc = mes === 12 ? ano + 1 : ano
        const diaVenc = Math.min(a.vencimento_dia ?? 10, 28)
        const dataVenc = new Date(Date.UTC(anoVenc, mesVenc - 1, diaVenc))
        const ob = obrigacoes.find(
          (o) => o.tipo === a.obrigacao && o.competencia === dataCompetenciaStr,
        )
        const status =
          ob?.status === 'entregue' ? 'entregue' : dataVenc < now ? 'vencida' : 'a_vencer'
        return {
          agenda: a,
          status,
          dataVenc,
          empresaNome:
            ob?.expand?.empresa_id?.nome_fantasia || ob?.expand?.empresa_id?.razao_social,
        }
      })
      .sort((x, y) => x.dataVenc.getTime() - y.dataVenc.getTime())
  }, [agendaFiltrada, obrigacoes, competencia])

  const totalGrade = grade.length
  const entreguesGrade = grade.filter((g) => g.status === 'entregue').length
  const vencidasGrade = grade.filter((g) => g.status === 'vencida').length
  const aVencerGrade = totalGrade - entreguesGrade - vencidasGrade

  return (
    <div className="space-y-5">
      {/* Título da seção — Tela 1 Makro */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-[#1A2333] flex items-center gap-2">
            <Gauge className="h-5 w-5 text-[#0FA3A3]" />
            Painel de Controle — Visão por Departamento
          </h3>
          <p className="text-xs text-[#64748B] mt-0.5">
            Percentual de obrigações concluídas por departamento e grade de obrigações da agenda
            tributária com vencimento e status (competência {competencia}).
          </p>
        </div>
        <Link to="/agenda-tributaria">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 border-[#0FA3A3] text-[#0FA3A3] hover:bg-teal-50"
          >
            <CalendarClock className="h-3.5 w-3.5" />
            Agenda Tributária
          </Button>
        </Link>
      </div>

      {/* Cards de percentual por departamento */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {departamentos.map((d) => (
          <Card key={d.chave} className={cn('rounded-2xl border p-4 shadow-2xs', d.bg)}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-slate-200',
                    d.cor,
                  )}
                >
                  {d.icone}
                </div>
                <span className="text-sm font-bold text-[#1A2333]">{d.nome}</span>
              </div>
              <span className={cn('text-lg font-extrabold', d.cor)}>{d.percentual}%</span>
            </div>
            <Progress value={d.percentual} className="h-2 mt-3 bg-white/70" />
            <div className="flex items-center gap-3 mt-2 text-[10px] font-semibold">
              <span className="text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> {d.concluidas} concluída
                {d.concluidas === 1 ? '' : 's'}
              </span>
              {d.vencidas > 0 && (
                <span className="text-red-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {d.vencidas} vencida
                  {d.vencidas === 1 ? '' : 's'}
                </span>
              )}
              {d.aVencer > 0 && (
                <span className="text-amber-700 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {d.aVencer} a vencer
                </span>
              )}
            </div>
            {d.total === 0 && (
              <p className="text-[10px] text-[#94A3B8] mt-1.5">
                Sem obrigações ativas nesta competência.
              </p>
            )}
          </Card>
        ))}
      </div>

      {/* Grade de obrigações da agenda tributária */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs overflow-hidden">
        <CardHeader className="pb-3 pt-4 px-5 bg-slate-50/60 border-b border-[#E2E8F0]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-[#0FA3A3]" />
                Grade de Obrigações — Agenda Tributária
              </CardTitle>
              <CardDescription className="text-[11px]">
                Perfis ativos na carteira:{' '}
                {perfisAtivos.length > 0
                  ? perfisAtivos.map((p) => LABEL_PERFIL[p] || p).join(', ')
                  : 'nenhuma empresa cadastrada'}{' '}
                — vencimentos típicos por competência.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold">
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                {entreguesGrade} entregue{entreguesGrade === 1 ? '' : 's'}
              </Badge>
              <Badge className="bg-red-50 text-red-700 border-red-200">
                {vencidasGrade} vencida{vencidasGrade === 1 ? '' : 's'}
              </Badge>
              <Badge className="bg-amber-50 text-amber-800 border-amber-200">
                {aVencerGrade} a vencer
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-xs text-[#64748B]">
              <div className="h-6 w-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="mt-2">Carregando grade de obrigações...</p>
            </div>
          ) : totalGrade === 0 ? (
            <div className="p-8 text-center text-xs text-[#64748B]">
              <CalendarClock className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <p className="font-bold text-sm text-[#1A2333]">
                Nenhuma obrigação na agenda para os perfis da carteira
              </p>
              <p className="text-[11px] text-[#64748B] mt-1 max-w-md mx-auto">
                A agenda tributária é semeada automaticamente por tenant (migration 0161). Cadastre
                empresas nos perfis Simples Nacional, Lucro Presumido ou Lucro Real para populá-la.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-[#E2E8F0] text-left text-[10px] uppercase tracking-wide text-[#94A3B8]">
                    <th className="px-5 py-2.5 font-semibold">Obrigação</th>
                    <th className="px-4 py-2.5 font-semibold">Departamento</th>
                    <th className="px-4 py-2.5 font-semibold">Perfil</th>
                    <th className="px-4 py-2.5 font-semibold">Vencimento</th>
                    <th className="px-5 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {grade.map(({ agenda: a, status, dataVenc }) => (
                    <tr
                      key={a.id}
                      className="border-b border-[#F1F5F9] last:border-0 hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-5 py-2.5 font-medium text-[#1A2333]">{a.obrigacao}</td>
                      <td className="px-4 py-2.5 text-[#64748B]">{a.departamento}</td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant="outline"
                          className="text-[10px] font-bold bg-slate-50 text-slate-600 border-slate-200"
                        >
                          {LABEL_PERFIL[a.perfil] || a.perfil}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-[#1A2333]">
                        {dataVenc.toLocaleDateString('pt-BR')}{' '}
                        <span className="text-[10px] text-[#94A3B8]">
                          (dia {a.vencimento_dia ?? '—'} de{' '}
                          {MESES[Number(competencia.split('-')[1]) - 1] || ''})
                        </span>
                      </td>
                      <td className="px-5 py-2.5">
                        {status === 'entregue' ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Entregue
                          </Badge>
                        ) : status === 'vencida' ? (
                          <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] font-bold gap-1 animate-pulse">
                            <AlertTriangle className="h-3 w-3" /> Vencida
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] font-bold gap-1">
                            <Clock className="h-3 w-3" /> A vencer
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default DashboardMakroTela1

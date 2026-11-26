/**
 * Tela 06 do Rumo Whats — Relatórios.
 * Consome relatorioWhats(tenantId, desdeISO): indicadores de conversas/mensagens,
 * respostas IA × humano, série diária, desempenho por atendente e por setor.
 * Padrão visual Makro: cards rounded-2xl, acento #0FA3A3, zebra nas tabelas.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Bot,
  CalendarDays,
  Clock,
  MessageSquare,
  MessagesSquare,
  UserRound,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/contexts/AuthContext'
import { rumoWhatsService, type RelatorioWhats } from '@/services/rumoWhats'
import { cn } from '@/lib/utils'

const PERIODOS = [
  { valor: 7, rotulo: '7 dias' },
  { valor: 30, rotulo: '30 dias' },
  { valor: 90, rotulo: '90 dias' },
] as const

function dataISO(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toISOString().slice(0, 10)
}

function formatarDia(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function IndicadorCard({
  icone,
  rotulo,
  valor,
  detalhe,
}: {
  icone: React.ReactNode
  rotulo: string
  valor: number | string
  detalhe?: string
}) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-xs text-[#64748B]">
          {icone}
          <span>{rotulo}</span>
        </div>
        <p className="text-2xl font-bold text-[#1A2333] mt-1.5">{valor}</p>
        {detalhe && <p className="text-[11px] text-[#64748B] mt-0.5">{detalhe}</p>}
      </CardContent>
    </Card>
  )
}

function TabelaWhats({
  titulo,
  descricao,
  colunas,
  linhas,
  colVazio,
}: {
  titulo: string
  descricao?: string
  colunas: string[]
  linhas: (string | number)[][]
  colVazio: string
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
        {descricao && <CardDescription>{descricao}</CardDescription>}
      </CardHeader>
      <CardContent>
        {linhas.length === 0 ? (
          <p className="text-sm text-[#64748B] py-6 text-center">{colVazio}</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#F8FAFC]">
                  {colunas.map((c, i) => (
                    <TableHead
                      key={c}
                      className={cn('text-xs font-semibold text-[#64748B]', i > 0 && 'text-right')}
                    >
                      {c}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l, i) => (
                  <TableRow key={i} className={cn(i % 2 === 1 && 'bg-[#F8FAFC]/60')}>
                    {l.map((c, j) => (
                      <TableCell
                        key={j}
                        className={cn('text-sm', j > 0 && 'text-right font-mono tabular-nums')}
                      >
                        {c}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function RumoWhatsRelatoriosTab() {
  const { tenant } = useAuth()
  const [dias, setDias] = useState<number>(30)
  const [rel, setRel] = useState<RelatorioWhats | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)

  const carregar = useCallback(async () => {
    if (!tenant?.id) return
    setCarregando(true)
    setErro(false)
    try {
      const r = await rumoWhatsService.relatorioWhats(tenant.id, dataISO(dias))
      setRel(r)
    } catch (err) {
      console.error('Erro ao gerar relatório:', err)
      setErro(true)
    } finally {
      setCarregando(false)
    }
  }, [tenant?.id, dias])

  useEffect(() => {
    carregar()
  }, [carregar])

  const maxDia = useMemo(
    () => Math.max(1, ...(rel?.serie_diaria.map((s) => s.total) ?? [1])),
    [rel],
  )
  const temDados = !!rel && rel.conversas_no_periodo > 0

  if (carregando) {
    return <div className="py-10 text-center text-sm text-[#64748B]">Gerando relatório…</div>
  }

  if (erro) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="py-10 text-center">
          <BarChart3 className="h-10 w-10 text-[#94A3B8] mx-auto" />
          <p className="mt-3 text-sm text-[#64748B]">
            Não foi possível gerar o relatório. Verifique a conexão e tente novamente.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={carregar}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Período */}
      <div className="flex items-center gap-2 flex-wrap">
        <CalendarDays className="h-4 w-4 text-[#0FA3A3]" />
        <span className="text-sm font-medium text-[#1A2333]">Período:</span>
        {PERIODOS.map((p) => (
          <button
            key={p.valor}
            type="button"
            onClick={() => setDias(p.valor)}
            aria-pressed={dias === p.valor}
            aria-label={`Período do relatório: ${p.rotulo}`}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[#0FA3A3]',
              dias === p.valor
                ? 'bg-[#0FA3A3]/10 border-[#0FA3A3]/40 text-[#0FA3A3]'
                : 'border-[#E2E8F0] text-[#64748B] hover:bg-slate-50',
            )}
          >
            {p.rotulo}
          </button>
        ))}
      </div>

      {/* Indicadores */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <IndicadorCard
          icone={<MessageSquare className="h-4 w-4 text-[#0FA3A3]" />}
          rotulo="Conversas no período"
          valor={rel?.conversas_no_periodo ?? 0}
        />
        <IndicadorCard
          icone={<Clock className="h-4 w-4 text-[#A86500]" />}
          rotulo="Abertas / em atendimento"
          valor={`${rel?.conversas_abertas ?? 0} / ${rel?.conversas_em_atendimento ?? 0}`}
        />
        <IndicadorCard
          icone={<MessagesSquare className="h-4 w-4 text-[#0B5CAD]" />}
          rotulo="Mensagens recebidas / enviadas"
          valor={`${rel?.mensagens_recebidas ?? 0} / ${rel?.mensagens_enviadas ?? 0}`}
        />
        <IndicadorCard
          icone={<Bot className="h-4 w-4 text-[#0B7A5E]" />}
          rotulo="Respostas IA × humano"
          valor={`${rel?.respostas_ia ?? 0} × ${rel?.respostas_humano ?? 0}`}
          detalhe={`${rel?.conversas_encerradas ?? 0} conversa(s) encerrada(s)`}
        />
      </div>

      {/* Série diária */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Conversas por dia</CardTitle>
          <CardDescription>Volume diário de conversas iniciadas no período.</CardDescription>
        </CardHeader>
        <CardContent>
          {!temDados || (rel?.serie_diaria.length ?? 0) === 0 ? (
            <p className="text-sm text-[#64748B] py-6 text-center">
              Nenhum registro no período — as conversas aparecem aqui assim que o canal receber
              mensagens.
            </p>
          ) : (
            <div className="space-y-2">
              {rel!.serie_diaria.map((s) => (
                <div key={s.dia} className="flex items-center gap-3">
                  <span className="text-xs text-[#64748B] w-12 shrink-0 tabular-nums">
                    {formatarDia(s.dia)}
                  </span>
                  <div
                    className="h-5 rounded-md bg-[#0FA3A3]/80 min-w-[4px] motion-safe:transition-all"
                    style={{ width: `${Math.max(4, (s.total / maxDia) * 100)}%` }}
                    role="img"
                    aria-label={`${formatarDia(s.dia)}: ${s.total} conversa(s)`}
                  />
                  <span className="text-xs font-medium text-[#1A2333] tabular-nums">{s.total}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <TabelaWhats
          titulo="Por atendente"
          descricao="Conversas assumidas e mensagens enviadas por atendente."
          colunas={['Atendente', 'Conversas', 'Mensagens']}
          linhas={(rel?.por_atendente ?? []).map((a) => [a.nome, a.conversas, a.mensagens])}
          colVazio="Nenhum atendimento humano no período."
        />
        <TabelaWhats
          titulo="Por setor"
          descricao="Conversas roteadas pelo chatbot para cada setor."
          colunas={['Setor', 'Conversas']}
          linhas={(rel?.por_setor ?? []).map((s) => [s.nome, s.conversas])}
          colVazio="Nenhuma conversa roteada no período — configure os setores no chatbot."
        />
      </div>

      {!temDados && (
        <p className="text-[11px] text-[#64748B] border-t pt-3">
          Nenhum registro no período selecionado. Ajuste o período acima ou aguarde novas conversas
          no canal.
        </p>
      )}
    </div>
  )
}

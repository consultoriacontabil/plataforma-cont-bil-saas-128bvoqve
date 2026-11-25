/**
 * Fase Resultados do módulo Financeiro do Escritório (Fatia 3 Makro).
 * DRE gerencial do período (regime de caixa) + comparativo
 * esperado (honorários ativos) × cobrado (títulos) × recebido (baixas).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, Loader2, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/card'
import {
  calcularDre,
  listarHonorarios,
  listarMovimentos,
  listarTitulos,
  type MovimentoCaixa,
  type TituloFinanceiro,
} from '@/services/financeiroEscritorio'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

const fmt = (v: number) => formatCurrency(v)

interface Props {
  tenantId?: string
  competencia: string
}

export function ResultadosFase({ tenantId, competencia }: Props) {
  const [titulos, setTitulos] = useState<TituloFinanceiro[]>([])
  const [movimentos, setMovimentos] = useState<MovimentoCaixa[]>([])
  const [honorarios, setHonorarios] = useState<Array<{ valor_mensal: number; ativo?: boolean }>>([])
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    if (!tenantId) return
    setCarregando(true)
    try {
      const [t, m, h] = await Promise.all([
        listarTitulos({ tenantId, competencia }),
        listarMovimentos({ tenantId, competencia }),
        listarHonorarios({ tenantId, apenasAtivos: true }),
      ])
      setTitulos(t)
      setMovimentos(m)
      setHonorarios(h)
    } catch {
      setTitulos([])
      setMovimentos([])
      setHonorarios([])
    } finally {
      setCarregando(false)
    }
  }, [tenantId, competencia])

  useEffect(() => {
    carregar()
  }, [carregar])

  const dre = useMemo(
    () => calcularDre(competencia, titulos, movimentos),
    [competencia, titulos, movimentos],
  )

  const esperadoMes = useMemo(
    () =>
      honorarios
        .filter((h) => h.ativo !== false)
        .reduce((a, h) => a + (Number(h.valor_mensal) || 0), 0),
    [honorarios],
  )

  const cobradoMes = titulos
    .filter((t) => t.tipo === 'receber')
    .reduce((a, t) => a + (Number(t.valor) || 0), 0)
  const recebidoMes = titulos
    .filter((t) => t.tipo === 'receber' && t.status === 'pago')
    .reduce((a, t) => a + (Number(t.valor_baixado ?? t.valor) || 0), 0)

  if (carregando) {
    return (
      <Card className="rounded-2xl p-4 text-xs text-slate-500 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Calculando resultados…
      </Card>
    )
  }

  const barras = [
    { label: 'Esperado (honorários ativos)', valor: esperadoMes, cor: 'bg-slate-400' },
    { label: 'Cobrado (títulos gerados)', valor: cobradoMes, cor: 'bg-amber-500' },
    { label: 'Recebido (baixas)', valor: recebidoMes, cor: 'bg-emerald-500' },
  ]
  const maxBarra = Math.max(esperadoMes, cobradoMes, recebidoMes, 1)

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl p-4">
        <h4 className="text-sm font-bold text-[#1A2333] flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-[#0FA3A3]" /> DRE gerencial — {competencia}{' '}
          <span className="text-[10px] font-medium text-slate-400">
            (regime de caixa — realizado)
          </span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
          <div className="rounded-xl bg-emerald-50 p-3">
            <p className="text-[11px] font-semibold text-emerald-700">Receita total</p>
            <p className="text-base font-bold text-emerald-700">{fmt(dre.receitaTotal)}</p>
            <p className="text-[10px] text-emerald-600/80">
              Honorários {fmt(dre.receitaHonorarios)} · Outras {fmt(dre.receitaOutras)}
            </p>
          </div>
          <div className="rounded-xl bg-red-50 p-3">
            <p className="text-[11px] font-semibold text-red-700">Despesa total</p>
            <p className="text-base font-bold text-red-700">{fmt(dre.despesaTotal)}</p>
            <p className="text-[10px] text-red-600/80">
              {dre.despesasPorCategoria.length} categoria(s) de despesa
            </p>
          </div>
          <div
            className={cn('rounded-xl p-3', dre.resultado >= 0 ? 'bg-[#0FA3A3]/10' : 'bg-amber-50')}
          >
            <p className="text-[11px] font-semibold text-[#0FA3A3]">Resultado do período</p>
            <p
              className={cn(
                'text-base font-bold',
                dre.resultado >= 0 ? 'text-[#0FA3A3]' : 'text-amber-700',
              )}
            >
              {fmt(dre.resultado)}
            </p>
            <p className="text-[10px] text-slate-500">Margem {dre.margem.toFixed(1)}%</p>
          </div>
        </div>

        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-1.5 font-semibold">Receita / Despesa</th>
              <th className="py-1.5 font-semibold text-right">Valor</th>
              <th className="py-1.5 font-semibold text-right">% sobre receita</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b bg-emerald-50/40">
              <td className="py-1.5 font-semibold text-emerald-700">Receita — Honorários</td>
              <td className="py-1.5 text-right">{fmt(dre.receitaHonorarios)}</td>
              <td className="py-1.5 text-right text-slate-400">—</td>
            </tr>
            <tr className="border-b bg-emerald-50/40">
              <td className="py-1.5 font-semibold text-emerald-700">Receita — Outras</td>
              <td className="py-1.5 text-right">{fmt(dre.receitaOutras)}</td>
              <td className="py-1.5 text-right text-slate-400">—</td>
            </tr>
            {dre.despesasPorCategoria.map((l) => (
              <tr key={l.categoria} className="border-b last:border-0">
                <td className="py-1.5 text-slate-600">Despesa — {l.categoria}</td>
                <td className="py-1.5 text-right text-red-600">({fmt(l.valor)})</td>
                <td className="py-1.5 text-right text-slate-500">
                  {dre.receitaTotal > 0 ? ((l.valor / dre.receitaTotal) * 100).toFixed(1) : '0.0'}%
                </td>
              </tr>
            ))}
            <tr className="border-t-2">
              <td className="py-1.5 font-bold text-[#1A2333]">Resultado</td>
              <td
                className={cn(
                  'py-1.5 text-right font-bold',
                  dre.resultado >= 0 ? 'text-emerald-600' : 'text-red-600',
                )}
              >
                {fmt(dre.resultado)}
              </td>
              <td className="py-1.5 text-right font-bold">{dre.margem.toFixed(1)}%</td>
            </tr>
          </tbody>
        </table>

        {dre.receitaTotal === 0 && dre.despesaTotal === 0 && (
          <p className="text-xs text-slate-500 mt-3">
            Sem valores realizados na competência — o DRE preenche com as baixas de recebimentos e
            de pagamentos.
          </p>
        )}
      </Card>

      <Card className="rounded-2xl p-4">
        <h4 className="text-sm font-bold text-[#1A2333] flex items-center gap-2 mb-1">
          <TrendingUp className="h-4 w-4 text-[#0FA3A3]" /> Esperado × Cobrado × Recebido
        </h4>
        <p className="text-[11px] text-slate-500 mb-4">
          Esperado = soma dos honorários mensais fixos ativos · Cobrado = títulos a receber gerados
          · Recebido = títulos com baixa registrada.
        </p>
        <div className="space-y-3">
          {barras.map((b) => (
            <div key={b.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 font-medium">{b.label}</span>
                <span className="font-bold text-[#1A2333]">{fmt(b.valor)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', b.cor)}
                  style={{ width: `${Math.min(100, (b.valor / maxBarra) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

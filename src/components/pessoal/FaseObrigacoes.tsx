/**
 * Fase Obrigações do Módulo Pessoal (Fatia 5 Makro).
 * Eventos eSocial da competência + guias (coleção guias_pagamentos,
 * campo periodo_apuracao) — via pessoalMakro.
 */

import { useCallback, useEffect, useState } from 'react'
import { FileText, Loader2, ScrollText, Users } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { pessoalMakro } from '@/services/pessoalMakro'
import type { EsocialEventoRecord, GuiaPagamentoRecord } from '@/types'
import { formatCurrency } from '@/lib/formatters'

interface Props {
  tenantId?: string
  empresaId: string
  competencia: string
}

function toNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function FaseObrigacoes({ tenantId, empresaId, competencia }: Props) {
  const [eventos, setEventos] = useState<EsocialEventoRecord[]>([])
  const [guias, setGuias] = useState<GuiaPagamentoRecord[]>([])
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    if (!tenantId || !empresaId || empresaId === 'todas') {
      setEventos([])
      setGuias([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    try {
      const [evs, gss] = await Promise.all([
        pessoalMakro
          .listarEventosEsocial(tenantId, { empresaId, competencia })
          .catch(() => [] as EsocialEventoRecord[]),
        pessoalMakro
          .listarGuias(tenantId, empresaId, competencia)
          .catch(() => [] as GuiaPagamentoRecord[]),
      ])
      setEventos(evs)
      setGuias(gss)
    } catch {
      setEventos([])
      setGuias([])
    } finally {
      setCarregando(false)
    }
  }, [tenantId, empresaId, competencia])

  useEffect(() => {
    carregar()
  }, [carregar])

  if (!tenantId || !empresaId || empresaId === 'todas') {
    return (
      <Card className="rounded-2xl p-4 text-xs text-slate-500">
        Selecione uma empresa no cabeçalho para ver as obrigações.
      </Card>
    )
  }

  if (carregando) {
    return (
      <Card className="rounded-2xl p-4 text-xs text-slate-500 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando obrigações…
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-[#E2E8F0] p-4 shadow-2xs">
        <h4 className="text-sm font-bold text-[#1A2333] flex items-center gap-2 mb-3">
          <ScrollText className="h-4 w-4 text-[#0FA3A3]" /> Eventos eSocial · {competencia}
          <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500">
            {eventos.length}
          </Badge>
        </h4>
        {eventos.length === 0 ? (
          <div className="py-8 text-center">
            <ScrollText className="h-8 w-8 mx-auto text-slate-300 mb-2" aria-hidden />
            <p className="text-sm font-semibold text-[#1A2333]">
              Nenhum evento eSocial nesta competência
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Calcule a folha e movimente colaboradores na fase Movimentações para gerar eventos.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-slate-400 border-b">
                  <th className="py-2 pr-3 font-semibold">Evento</th>
                  <th className="py-2 pr-3 font-semibold">Descrição</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 pr-3 font-semibold">Recebido em</th>
                  <th className="py-2 font-semibold text-right">Recibo</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((e) => (
                  <tr key={e.id} className="border-b last:border-0 text-[#1A2333]">
                    <td className="py-2 pr-3 font-mono font-semibold">{e.codigo_evento}</td>
                    <td className="py-2 pr-3">{e.descricao ?? '—'}</td>
                    <td className="py-2 pr-3">
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-slate-50 text-slate-600 border-slate-200 capitalize"
                      >
                        {e.status ?? 'pendente'}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3">
                      {e.data_recebimento
                        ? new Date(e.data_recebimento).toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                    <td className="py-2 text-right font-mono text-[10px]">
                      {e.numero_recibo ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="rounded-2xl border-[#E2E8F0] p-4 shadow-2xs">
        <h4 className="text-sm font-bold text-[#1A2333] flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-[#0FA3A3]" /> Guias · {competencia}
          <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500">
            {guias.length}
          </Badge>
        </h4>
        {guias.length === 0 ? (
          <div className="py-8 text-center">
            <FileText className="h-8 w-8 mx-auto text-slate-300 mb-2" aria-hidden />
            <p className="text-sm font-semibold text-[#1A2333]">
              Nenhuma guia gerada nesta competência
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Guias de INSS, FGTS e IRRF aparecem aqui após o cálculo da folha.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-slate-400 border-b">
                  <th className="py-2 pr-3 font-semibold">Guia</th>
                  <th className="py-2 pr-3 font-semibold">Descrição</th>
                  <th className="py-2 pr-3 font-semibold">Vencimento</th>
                  <th className="py-2 pr-3 font-semibold text-right">Valor</th>
                  <th className="py-2 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {guias.map((g) => (
                  <tr key={g.id} className="border-b last:border-0 text-[#1A2333]">
                    <td className="py-2 pr-3 font-mono font-semibold">{g.tipo_guia}</td>
                    <td className="py-2 pr-3">{g.descricao ?? '—'}</td>
                    <td className="py-2 pr-3">
                      {g.data_vencimento
                        ? new Date(g.data_vencimento).toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono">
                      {formatCurrency(toNum(g.valor_total))}
                    </td>
                    <td className="py-2 text-right">
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-slate-50 text-slate-600 border-slate-200 capitalize"
                      >
                        {g.situacao ?? 'pendente'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

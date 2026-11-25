/**
 * Fase Lançamentos do Módulo Contábil (Fatia 4 Makro) — grade da competência
 * + lançamento manual em partida dobrada (contabilService.createPartidaDobrada)
 * + importação/conciliação de extrato OFX/TXT (FaseLancamentosImport).
 */

import { useCallback, useEffect, useState } from 'react'
import { BookOpen, FileDown, Loader2, Plus, RefreshCw, Trash2, Upload, Wand2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { contabilService } from '@/services/contabil'
import { competenciaParaBase } from '@/services/contabilMakro'
import {
  conciliarExtrato,
  gerarLancamentosDaConciliacao,
  type ResultadoConciliacao,
} from '@/services/contabilMakroExtratos'
import type { LancamentoContabil } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDatePtBr } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { ImportacaoExtrato } from './FaseLancamentosImport'
import { LancamentoManualDialog, PARTIDA_VAZIA, type FormPartida } from './LancamentoManualDialog'

const fmt = (v: number) => formatCurrency(v)

interface Props {
  tenantId?: string
  usuarioId?: string
  empresaId: string
  competencia: string
  aoMudar: () => void
}

const STATUS_BADGE: Record<string, string> = {
  rascunho: 'bg-amber-50 text-amber-600 border-amber-200',
  confirmado: 'bg-emerald-50 text-emerald-600 border-emerald-200',
}

const ORIGEM_LABEL: Record<string, string> = {
  manual: 'Manual',
  ofx: 'Extrato (OFX/TXT)',
  fiscal: 'Fiscal',
  pessoal: 'Pessoal',
}

export function LancamentosFase({ tenantId, usuarioId, empresaId, competencia, aoMudar }: Props) {
  const { toast } = useToast()
  const [lancamentos, setLancamentos] = useState<LancamentoContabil[]>([])
  const [contas, setContas] = useState<Awaited<ReturnType<typeof contabilService.getPlanoContas>>>(
    [],
  )
  const [carregando, setCarregando] = useState(true)
  const [dialog, setDialog] = useState(false)
  const [importAberto, setImportAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState<FormPartida>(PARTIDA_VAZIA)

  const carregar = useCallback(async () => {
    if (!tenantId || !empresaId) {
      setLancamentos([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    try {
      const res = await contabilService.listLancamentos(
        tenantId,
        { empresaId, competencia: competenciaParaBase(competencia) },
        1,
        200,
      )
      setLancamentos(res.items)
    } catch {
      setLancamentos([])
    } finally {
      setCarregando(false)
    }
  }, [tenantId, empresaId, competencia])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    if (!tenantId || !empresaId) {
      setContas([])
      return
    }
    contabilService
      .getPlanoContas(tenantId, `empresa = "${empresaId}" && ativa = true`)
      .then(setContas)
      .catch(() => setContas([]))
  }, [tenantId, empresaId])

  const analiticas = contas.filter((c) => !contas.some((f) => f.pai === c.id))

  const abrirDialog = () => {
    setForm({ ...PARTIDA_VAZIA, data: `${competencia}-01` })
    setDialog(true)
  }

  const salvar = async () => {
    if (!tenantId) return
    const v = Number(form.valor.replace(',', '.'))
    if (!form.data || !form.historico.trim() || !form.debito || !form.credito || !(v > 0)) {
      toast({ title: 'Preencha todos os campos do lançamento', variant: 'destructive' })
      return
    }
    if (form.debito === form.credito) {
      toast({ title: 'Débito e crédito devem ser contas diferentes', variant: 'destructive' })
      return
    }
    setSalvando(true)
    try {
      await contabilService.createPartidaDobrada({
        tenant_id: tenantId,
        empresa: empresaId,
        data: form.data,
        competencia: competenciaParaBase(competencia),
        valor: v,
        historico: form.historico.trim(),
        debitoContaId: form.debito,
        creditoContaId: form.credito,
        status: form.confirmarJa ? 'confirmado' : 'rascunho',
        origem: 'manual',
        criado_por: usuarioId,
      })
      toast({ title: 'Lançamento registrado em partida dobrada' })
      setDialog(false)
      await carregar()
      aoMudar()
    } catch (e) {
      toast({
        title: 'Erro ao registrar lançamento',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const confirmarLote = async (loteId: string) => {
    try {
      await contabilService.confirmarLote(loteId)
      toast({ title: 'Lote confirmado' })
      await carregar()
      aoMudar()
    } catch {
      toast({ title: 'Erro ao confirmar o lote', variant: 'destructive' })
    }
  }

  const excluir = async (l: LancamentoContabil) => {
    try {
      await contabilService.deleteLancamento(l.id, true)
      toast({ title: 'Lançamento excluído (partida completa)' })
      await carregar()
      aoMudar()
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' })
    }
  }

  const exportarTxt = () => {
    const linhas = lancamentos.map((l) =>
      [
        l.data,
        l.tipo === 'debito' ? 'D' : 'C',
        l.expand?.conta_contabil?.codigo || '',
        l.expand?.contrapartida?.codigo || '',
        l.valor.toFixed(2),
        l.historico.replace(/[\r\n;]+/g, ' '),
        l.lote_id || '',
      ].join(';'),
    )
    const conteudo = ['data;dc;debito;credito;valor;historico;lote', ...linhas].join('\n')
    const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lancamentos-${competencia}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const aoConciliar = async (r: ResultadoConciliacao) => {
    setImportAberto(false)
    if (r.criados > 0) {
      try {
        await gerarLancamentosDaConciliacao({
          tenantId: tenantId!,
          empresaId,
          competencia,
          usuarioId,
          resultado: r,
        })
        toast({
          title: 'Conciliado',
          description: `${r.criados} lançamento(s) gerado(s) do extrato.`,
        })
      } catch {
        toast({ title: 'Erro ao gerar lançamentos do extrato', variant: 'destructive' })
      }
    } else {
      toast({
        title: 'Nada a lançar',
        description: 'Nenhuma transação nova no extrato para esta competência.',
      })
    }
    await carregar()
    aoMudar()
  }

  if (!empresaId) {
    return (
      <Card className="rounded-2xl p-4 text-xs text-slate-500">
        Selecione uma empresa no cabeçalho para escriturar os lançamentos.
      </Card>
    )
  }

  const porLote = new Map<string, LancamentoContabil[]>()
  for (const l of lancamentos) {
    const key = l.lote_id || l.id
    if (!porLote.has(key)) porLote.set(key, [])
    porLote.get(key)!.push(l)
  }

  return (
    <Card className="rounded-2xl border-[#E2E8F0] p-4 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
        <h4 className="text-sm font-bold text-[#1A2333] flex items-center gap-2 flex-1">
          <BookOpen className="h-4 w-4 text-[#0FA3A3]" /> Lançamentos da competência
          <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500">
            {porLote.size} partida(s)
          </Badge>
        </h4>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-9 text-xs" onClick={carregar}>
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
          <Button variant="outline" size="sm" className="h-9 text-xs" onClick={exportarTxt}>
            <FileDown className="h-3.5 w-3.5" /> Exportar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs"
            onClick={() => setImportAberto(true)}
          >
            <Upload className="h-3.5 w-3.5" /> Importar extrato
          </Button>
          <Button size="sm" className="h-9 text-xs" onClick={abrirDialog}>
            <Plus className="h-3.5 w-3.5" /> Novo lançamento
          </Button>
        </div>
      </div>

      {carregando ? (
        <p className="text-xs text-slate-500 flex items-center gap-2 py-6 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando lançamentos…
        </p>
      ) : porLote.size === 0 ? (
        <p className="text-xs text-slate-500 py-6 text-center">
          Nenhum lançamento nesta competência. Registre manualmente, importe um extrato OFX/TXT ou
          aguarde a integração automática com Fiscal e Pessoal.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase text-slate-400 border-b">
                <th className="py-2 pr-3 font-semibold">Data</th>
                <th className="py-2 pr-3 font-semibold">D/C</th>
                <th className="py-2 pr-3 font-semibold">Conta</th>
                <th className="py-2 pr-3 font-semibold">Contrapartida</th>
                <th className="py-2 pr-3 font-semibold">Histórico</th>
                <th className="py-2 pr-3 font-semibold text-right">Valor</th>
                <th className="py-2 pr-3 font-semibold">Origem</th>
                <th className="py-2 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {[...porLote.entries()].flatMap(([loteId, par]) =>
                par
                  .sort((a, b) => (a.tipo === 'debito' ? -1 : 1))
                  .map((l, idx) => (
                    <tr
                      key={l.id}
                      className={cn(
                        'border-b last:border-0 text-[#1A2333]',
                        idx === 0 && 'bg-slate-50/60',
                      )}
                    >
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {idx === 0 ? formatDatePtBr(l.data) : ''}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={cn(
                            'font-bold',
                            l.tipo === 'debito' ? 'text-emerald-600' : 'text-red-500',
                          )}
                        >
                          {l.tipo === 'debito' ? 'D' : 'C'}
                        </span>
                      </td>
                      <td className="py-2 pr-3 font-mono">
                        {l.expand?.conta_contabil?.codigo || '—'}
                        <span className="block text-[10px] text-slate-400 font-sans">
                          {l.expand?.conta_contabil?.nome || ''}
                        </span>
                      </td>
                      <td className="py-2 pr-3 font-mono text-slate-500">
                        {l.expand?.contrapartida?.codigo || '—'}
                      </td>
                      <td className="py-2 pr-3 max-w-56 truncate" title={l.historico}>
                        {idx === 0 ? l.historico : ''}
                      </td>
                      <td className="py-2 pr-3 text-right font-semibold whitespace-nowrap">
                        {idx === 0 ? fmt(l.valor) : ''}
                      </td>
                      <td className="py-2 pr-3">
                        {idx === 0 ? (
                          <Badge
                            variant="outline"
                            className="text-[9px] bg-slate-50 text-slate-500 border-slate-200"
                          >
                            {ORIGEM_LABEL[l.origem || 'manual'] || l.origem}
                          </Badge>
                        ) : null}
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        {idx === 0 && (
                          <span className="inline-flex gap-1 items-center">
                            {l.status === 'rascunho' && (
                              <>
                                <Badge
                                  variant="outline"
                                  className={cn('text-[9px]', STATUS_BADGE[l.status])}
                                >
                                  rascunho
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-[#0FA3A3]"
                                  onClick={() => confirmarLote(loteId)}
                                  aria-label={`Confirmar lote ${loteId}`}
                                >
                                  <Wand2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-red-500 hover:text-red-600"
                              onClick={() => excluir(l)}
                              aria-label={`Excluir lançamento ${loteId}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </span>
                        )}
                      </td>
                    </tr>
                  )),
              )}
            </tbody>
          </table>
        </div>
      )}

      <LancamentoManualDialog
        aberto={dialog}
        onOpenChange={setDialog}
        form={form}
        setForm={setForm}
        analiticas={analiticas}
        salvando={salvando}
        onSalvar={salvar}
      />

      <ImportacaoExtrato
        aberto={importAberto}
        onOpenChange={setImportAberto}
        tenantId={tenantId}
        empresaId={empresaId}
        competencia={competencia}
        contas={contas}
        onConciliado={aoConciliar}
      />
    </Card>
  )
}

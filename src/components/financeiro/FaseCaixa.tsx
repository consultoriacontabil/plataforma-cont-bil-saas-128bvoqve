/**
 * Fase Caixa do módulo Financeiro do Escritório (Fatia 3 Makro).
 * Extrato por conta com saldo = saldo inicial ± movimentos
 * (entradas das baixas de recebimentos + saídas das baixas de pagamentos).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, Loader2, Plus, Trash2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  criarMovimentoAvulso,
  excluirMovimento,
  listarCategorias,
  listarMovimentos,
  listarContas,
  saldoDaConta,
  type CategoriaFinanceira,
  type ContaEscritorio,
  type MovimentoCaixa,
  type NaturezaMovimento,
} from '@/services/financeiroEscritorio'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

const fmt = (v: number) => formatCurrency(v)

interface Props {
  tenantId?: string
  usuarioId?: string
  competencia: string
  aoMudar: () => void
}

export function CaixaFase({ tenantId, usuarioId, competencia, aoMudar }: Props) {
  const { toast } = useToast()
  const [contas, setContas] = useState<ContaEscritorio[]>([])
  const [movimentos, setMovimentos] = useState<MovimentoCaixa[]>([])
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([])
  const [carregando, setCarregando] = useState(true)
  const [dialogLancamento, setDialogLancamento] = useState(false)
  const [carregandoLanc, setCarregandoLanc] = useState(false)

  const carregar = useCallback(async () => {
    if (!tenantId) return
    setCarregando(true)
    try {
      const [c, m] = await Promise.all([
        listarContas(tenantId),
        listarMovimentos({ tenantId, competencia }),
      ])
      setContas(c)
      setMovimentos(m)
    } catch {
      setContas([])
      setMovimentos([])
    } finally {
      setCarregando(false)
    }
  }, [tenantId, competencia])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    if (!tenantId || categorias.length > 0) return
    listarCategorias(tenantId)
      .then(setCategorias)
      .catch(() => setCategorias([]))
  }, [tenantId, categorias.length])

  const saldoPorConta = useMemo(
    () => new Map(contas.map((c) => [c.id, saldoDaConta(c, movimentos)])),
    [contas, movimentos],
  )

  const totalEntradas = movimentos
    .filter((m) => m.natureza === 'entrada')
    .reduce((a, m) => a + (Number(m.valor) || 0), 0)
  const totalSaidas = movimentos
    .filter((m) => m.natureza === 'saida')
    .reduce((a, m) => a + (Number(m.valor) || 0), 0)

  async function handleLancamento(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!tenantId || !usuarioId) return
    const fd = new FormData(e.currentTarget)
    const contaId = String(fd.get('conta_id') || '')
    if (!contaId) {
      toast({ title: 'Selecione a conta', variant: 'destructive' })
      return
    }
    setCarregandoLanc(true)
    try {
      await criarMovimentoAvulso({
        tenantId,
        usuarioId,
        contaId,
        natureza: String(fd.get('natureza') || 'entrada') as NaturezaMovimento,
        descricao: String(fd.get('descricao') || 'Lançamento avulso'),
        competencia,
        data: String(fd.get('data') || '') || undefined,
        valor: Number(fd.get('valor') || 0),
        categoriaId: String(fd.get('categoria_id') || ''),
      })
      toast({ title: 'Lançamento registrado', description: 'Extrato da conta atualizado.' })
      setDialogLancamento(false)
      aoMudar()
      carregar()
    } catch {
      toast({ title: 'Erro ao lançar movimento', variant: 'destructive' })
    } finally {
      setCarregandoLanc(false)
    }
  }

  async function handleExcluir(id: string, descricao: string) {
    try {
      await excluirMovimento(id)
      toast({ title: 'Movimento excluído' })
      aoMudar()
      carregar()
    } catch {
      toast({ title: `Erro ao excluir ${descricao}`, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h4 className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[#0FA3A3]" /> Extrato por conta — {competencia}
          </h4>
          <Button
            size="sm"
            onClick={() => setDialogLancamento(true)}
            disabled={contas.length === 0}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Lançamento avulso
          </Button>
        </div>

        {carregando ? (
          <p className="text-xs text-slate-500 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando extrato…
          </p>
        ) : contas.length === 0 ? (
          <p className="text-xs text-slate-500">
            Nenhuma conta cadastrada. Cadastre caixa e bancos na fase Cadastros.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
              {contas.map((c) => {
                const saldo = saldoPorConta.get(c.id) ?? c.saldo_inicial ?? 0
                return (
                  <div key={c.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                      <Wallet className="h-3 w-3" /> {c.nome}
                      <Badge variant="outline" className="ml-1 text-[9px] capitalize">
                        {c.tipo}
                      </Badge>
                    </p>
                    <p
                      className={cn(
                        'text-base font-bold mt-0.5',
                        saldo < 0 ? 'text-red-600' : 'text-[#1A2333]',
                      )}
                    >
                      {fmt(saldo)}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      saldo inicial {fmt(c.saldo_inicial ?? 0)} ± movimentos
                    </p>
                  </div>
                )
              })}
            </div>

            {movimentos.length === 0 ? (
              <p className="text-xs text-slate-500">
                Nenhum movimento na competência. As baixas de recebimentos (entradas) e de
                pagamentos (saídas) alimentam este extrato automaticamente.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500 border-b">
                      <th className="py-1.5 font-semibold">Data</th>
                      <th className="py-1.5 font-semibold">Conta</th>
                      <th className="py-1.5 font-semibold">Descrição</th>
                      <th className="py-1.5 font-semibold">Categoria</th>
                      <th className="py-1.5 font-semibold">Origem</th>
                      <th className="py-1.5 font-semibold text-right">Valor</th>
                      <th className="py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {movimentos.map((m) => {
                      const entrada = m.natureza === 'entrada'
                      return (
                        <tr key={m.id} className="border-b last:border-0">
                          <td className="py-1.5 text-slate-500">
                            {m.data ? m.data.slice(0, 10).split('-').reverse().join('/') : '—'}
                          </td>
                          <td className="py-1.5 font-medium text-[#1A2333]">
                            {m.expand?.conta_id?.nome || '—'}
                          </td>
                          <td className="py-1.5 text-slate-600">{m.descricao}</td>
                          <td className="py-1.5 text-slate-500">
                            {m.expand?.categoria_id?.nome || '—'}
                          </td>
                          <td className="py-1.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px]',
                                m.titulo_id
                                  ? 'bg-slate-50 text-slate-600 border-slate-200'
                                  : 'bg-[#0FA3A3]/10 text-[#0FA3A3] border-[#0FA3A3]/30',
                              )}
                            >
                              {m.titulo_id ? 'Título' : 'Avulso'}
                            </Badge>
                          </td>
                          <td
                            className={cn(
                              'py-1.5 text-right font-bold',
                              entrada ? 'text-emerald-600' : 'text-red-600',
                            )}
                          >
                            {entrada ? '+' : '−'} {fmt(Number(m.valor))}
                          </td>
                          <td className="py-1.5 text-right">
                            {!m.titulo_id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                aria-label={`Excluir movimento ${m.descricao}`}
                                onClick={() => handleExcluir(m.id, m.descricao)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs">
              <span className="text-slate-500 flex items-center gap-1">
                <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-600" />
                Entradas: <strong className="text-emerald-600">{fmt(totalEntradas)}</strong>
              </span>
              <span className="text-slate-500 flex items-center gap-1">
                <ArrowDownCircle className="h-3.5 w-3.5 text-red-600" />
                Saídas: <strong className="text-red-600">{fmt(totalSaidas)}</strong>
              </span>
              <span className="text-slate-500 ml-auto">
                Saldo do período:{' '}
                <strong
                  className={cn(
                    totalEntradas - totalSaidas >= 0 ? 'text-emerald-600' : 'text-red-600',
                  )}
                >
                  {fmt(totalEntradas - totalSaidas)}
                </strong>
              </span>
            </div>
          </>
        )}
      </Card>

      <Dialog open={dialogLancamento} onOpenChange={setDialogLancamento}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo lançamento de caixa</DialogTitle>
            <DialogDescription>
              Entrada ou saída avulsa, sem vínculo com título de recebimento/pagamento.
            </DialogDescription>
          </DialogHeader>
          <form id="form-lancamento-caixa" onSubmit={handleLancamento} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="lanc-conta">Conta (caixa/banco)</Label>
              <Select name="conta_id" required defaultValue="">
                <SelectTrigger id="lanc-conta">
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lanc-natureza">Natureza</Label>
                <Select name="natureza" defaultValue="entrada">
                  <SelectTrigger id="lanc-natureza">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lanc-valor">Valor (R$)</Label>
                <Input id="lanc-valor" name="valor" type="number" step="0.01" min="0.01" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lanc-descricao">Descrição</Label>
              <Input id="lanc-descricao" name="descricao" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lanc-categoria">Categoria</Label>
                <Select name="categoria_id" defaultValue="">
                  <SelectTrigger id="lanc-categoria">
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lanc-data">Data</Label>
                <Input
                  id="lanc-data"
                  name="data"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </div>
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogLancamento(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-lancamento-caixa" disabled={carregandoLanc}>
              {carregandoLanc && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Lançar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

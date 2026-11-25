/**
 * Fase Pagamentos do módulo Financeiro do Escritório (Fatia 3 Makro).
 * Contas a pagar do escritório (fixas recorrentes e avulsas), com baixa em
 * lote que gera movimento de SAÍDA no caixa/banco da conta selecionada.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, FileSpreadsheet, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import {
  baixarTitulo,
  criarTitulo,
  excluirTitulo,
  listarCategorias,
  listarContas,
  listarTitulos,
  type CategoriaFinanceira,
  type ContaEscritorio,
  type TituloFinanceiro,
} from '@/services/financeiroEscritorio'
import { formatCurrency } from '@/lib/formatters'
import { BadgeStatusTitulo, vencidoDe } from './FaseCadastrosRecebimentos'

const fmt = (v: number) => formatCurrency(v)

interface PagamentosFaseProps {
  tenantId?: string
  usuarioId?: string
  competencia: string
  aoMudar: () => void
}

export function PagamentosFase({ tenantId, usuarioId, competencia, aoMudar }: PagamentosFaseProps) {
  const { toast } = useToast()
  const hoje = new Date().toISOString().slice(0, 10)
  const [titulos, setTitulos] = useState<TituloFinanceiro[]>([])
  const [contas, setContas] = useState<ContaEscritorio[]>([])
  const [categoriasDespesa, setCategoriasDespesa] = useState<CategoriaFinanceira[]>([])
  const [carregando, setCarregando] = useState(true)
  const [dialogDespesa, setDialogDespesa] = useState(false)
  const [dialogBaixa, setDialogBaixa] = useState(false)
  const [baixando, setBaixando] = useState(false)
  const [contaBaixa, setContaBaixa] = useState('')
  const [dataBaixa, setDataBaixa] = useState(new Date().toISOString().slice(0, 10))
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())

  const carregar = useCallback(async () => {
    if (!tenantId) return
    setCarregando(true)
    try {
      const lista = await listarTitulos({ tenantId, competencia, tipo: 'pagar' })
      setTitulos(lista)
    } catch {
      setTitulos([])
    } finally {
      setCarregando(false)
    }
  }, [tenantId, competencia])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    if (!tenantId) return
    listarContas(tenantId)
      .then(setContas)
      .catch(() => setContas([]))
    listarCategorias(tenantId)
      .then((cs) => setCategoriasDespesa(cs.filter((c) => c.tipo === 'despesa')))
      .catch(() => setCategoriasDespesa([]))
  }, [tenantId])

  async function handleCriarDespesa(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!tenantId || !usuarioId) return
    const fd = new FormData(e.currentTarget)
    const valor = Number(fd.get('valor') || 0)
    if (!(valor > 0)) return
    await criarTitulo({
      tenantId,
      usuarioId,
      empresaId: tenantId, // despesa do próprio escritório
      tipo: 'pagar',
      origem: 'despesa_avulsa',
      descricao: String(fd.get('descricao') || 'Despesa do escritório'),
      competencia,
      vencimento: String(fd.get('vencimento') || '') || undefined,
      valor,
      categoriaId: String(fd.get('categoria_id') || ''),
    })
    setDialogDespesa(false)
    toast({
      title: 'Conta a pagar lançada',
      description: 'Disponível para baixa na fase Pagamentos.',
    })
    aoMudar()
    carregar()
  }

  async function handleExcluir(id: string) {
    await excluirTitulo(id)
    aoMudar()
    carregar()
  }

  async function confirmarBaixa() {
    if (!usuarioId || !contaBaixa || selecionados.size === 0) return
    setBaixando(true)
    try {
      const alvo = titulos.filter((t) => selecionados.has(t.id) && t.status === 'aberto')
      for (const t of alvo) {
        await baixarTitulo({
          titulo: t,
          usuarioId,
          contaId: contaBaixa,
          dataBaixa: dataBaixa || undefined,
        })
      }
      toast({
        title: 'Pagamento concluído',
        description: `${alvo.length} título(s) pago(s) — valor lançado como saída no caixa.`,
      })
      setSelecionados(new Set())
      setContaBaixa('')
      setDialogBaixa(false)
      aoMudar()
      carregar()
    } catch {
      toast({ title: 'Erro ao dar baixa nos pagamentos', variant: 'destructive' })
    } finally {
      setBaixando(false)
    }
  }

  function toggleSelecao(id: string) {
    setSelecionados((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const totalAberto = titulos
    .filter((t) => t.status === 'aberto')
    .reduce((a, t) => a + (Number(t.valor) || 0), 0)
  const totalPago = titulos
    .filter((t) => t.status === 'pago')
    .reduce((a, t) => a + (Number(t.valor_baixado ?? t.valor) || 0), 0)
  const totalVencido = titulos
    .filter((t) => vencidoDe(t, hoje))
    .reduce((a, t) => a + (Number(t.valor) || 0), 0)

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h4 className="text-sm font-bold text-[#1A2333]">
            Contas a pagar do escritório — {competencia}
          </h4>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setDialogDespesa(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Nova conta a pagar
            </Button>
          </div>
        </div>

        {carregando ? (
          <p className="text-xs text-slate-500 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando contas a pagar…
          </p>
        ) : titulos.length === 0 ? (
          <p className="text-xs text-slate-500">
            Nenhuma despesa na competência. Lance as contas fixas (folha, aluguel, softwares) e
            avulsas do escritório.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-1.5 w-8" />
                  <th className="py-1.5 font-semibold">Descrição</th>
                  <th className="py-1.5 font-semibold">Categoria</th>
                  <th className="py-1.5 font-semibold">Vencimento</th>
                  <th className="py-1.5 font-semibold text-right">Valor</th>
                  <th className="py-1.5 font-semibold">Status</th>
                  <th className="py-1.5" />
                </tr>
              </thead>
              <tbody>
                {titulos.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="py-1.5">
                      {t.status === 'aberto' ? (
                        <Checkbox
                          checked={selecionados.has(t.id)}
                          onCheckedChange={() => toggleSelecao(t.id)}
                          aria-label={`Selecionar pagamento ${t.descricao}`}
                        />
                      ) : (
                        <span className="text-emerald-600 font-bold">✓</span>
                      )}
                    </td>
                    <td className="py-1.5 font-medium text-[#1A2333]">{t.descricao}</td>
                    <td className="py-1.5 text-slate-500">{t.expand?.categoria_id?.nome || '—'}</td>
                    <td className="py-1.5">
                      {t.vencimento
                        ? t.vencimento.slice(0, 10).split('-').reverse().join('/')
                        : '—'}
                    </td>
                    <td className="py-1.5 text-right font-medium">{fmt(Number(t.valor))}</td>
                    <td className="py-1.5">
                      <BadgeStatusTitulo titulo={t} hoje={hoje} />
                    </td>
                    <td className="py-1.5 text-right">
                      {t.status === 'aberto' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          aria-label={`Excluir pagamento ${t.descricao}`}
                          onClick={() => handleExcluir(t.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs">
          <span className="text-slate-500">
            A pagar: <strong className="text-amber-600">{fmt(totalAberto)}</strong>
          </span>
          {totalVencido > 0 && (
            <span className="text-slate-500">
              Vencido: <strong className="text-red-600">{fmt(totalVencido)}</strong>
            </span>
          )}
          <span className="text-slate-500">
            Pago: <strong className="text-emerald-600">{fmt(totalPago)}</strong>
          </span>
          <Button
            size="sm"
            className="ml-auto h-7 text-[11px]"
            disabled={baixando || selecionados.size === 0 || contas.length === 0}
            title={
              contas.length === 0
                ? 'Cadastre uma conta na fase Cadastros antes de baixar'
                : undefined
            }
            onClick={() => setDialogBaixa(true)}
          >
            {baixando ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            )}
            Pagar ({selecionados.size})
          </Button>
        </div>
      </Card>

      {/* Dialog baixa em lote */}
      <Dialog open={dialogBaixa} onOpenChange={setDialogBaixa}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pagar {selecionados.size} título(s)</DialogTitle>
            <DialogDescription>
              Confirma o pagamento? O valor sai do caixa da conta selecionada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="baixa-pagar-conta">Conta (caixa/banco)</Label>
            <Select value={contaBaixa} onValueChange={setContaBaixa}>
              <SelectTrigger id="baixa-pagar-conta">
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
          <div className="space-y-1.5">
            <Label htmlFor="baixa-pagar-data">Data do pagamento</Label>
            <Input
              id="baixa-pagar-data"
              type="date"
              value={dataBaixa}
              onChange={(e) => setDataBaixa(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogBaixa(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={!contaBaixa || baixando} onClick={confirmarBaixa}>
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog nova despesa */}
      <Dialog open={dialogDespesa} onOpenChange={setDialogDespesa}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova conta a pagar</DialogTitle>
            <DialogDescription>
              Despesa fixa recorrente (folha, aluguel) ou avulsa do escritório.
            </DialogDescription>
          </DialogHeader>
          <form id="form-despesa" onSubmit={handleCriarDespesa} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="desp-descricao">Descrição</Label>
              <Input id="desp-descricao" name="descricao" required placeholder="Aluguel da sede…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="desp-valor">Valor (R$)</Label>
                <Input id="desp-valor" name="valor" type="number" step="0.01" min="0.01" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="desp-vencimento">Vencimento</Label>
                <Input id="desp-vencimento" name="vencimento" type="date" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desp-categoria">Categoria de despesa</Label>
              <Select name="categoria_id" defaultValue="">
                <SelectTrigger id="desp-categoria">
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {categoriasDespesa.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <FileSpreadsheet className="h-3 w-3" /> Categorias são gerenciadas na fase Cadastros.
            </p>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogDespesa(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-despesa">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

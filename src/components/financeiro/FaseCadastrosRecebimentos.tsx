/**
 * Fases Cadastros e Recebimentos do módulo Financeiro do Escritório (Fatia 3 Makro).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
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
  atualizarHonorario,
  buscarHonorariosDeContratos,
  criarConta,
  criarHonorario,
  criarTitulo,
  excluirConta,
  excluirHonorario,
  excluirTitulo,
  gerarTitulosDoMes,
  baixarTitulo,
  criarCategoria,
  listarCategorias,
  listarContas,
  listarHonorarios,
  listarTitulos,
  type ContaEscritorio,
  type CategoriaFinanceira,
  type HonorarioFixo,
  type TituloFinanceiro,
} from '@/services/financeiroEscritorio'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

const fmt = (v: number) => formatCurrency(v)

export function vencidoDe(t: TituloFinanceiro, hoje: string): boolean {
  if (t.status !== 'aberto' || !t.vencimento) return false
  return t.vencimento.slice(0, 10) < hoje
}

export function BadgeStatusTitulo({ titulo, hoje }: { titulo: TituloFinanceiro; hoje: string }) {
  const vencido = vencidoDe(titulo, hoje)
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] font-bold',
        titulo.status === 'pago'
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : vencido
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-amber-50 text-amber-700 border-amber-200',
      )}
    >
      {titulo.status === 'pago' ? 'Pago' : vencido ? 'Vencido' : 'Aberto'}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Fase Cadastros
// ---------------------------------------------------------------------------

interface CadastrosFaseProps {
  tenantId?: string
  usuarioId?: string
  empresas: Array<{ id: string; nome: string }>
  aoMudar: () => void
}

export function CadastrosFase({ tenantId, usuarioId, empresas, aoMudar }: CadastrosFaseProps) {
  const { toast } = useToast()
  const [contas, setContas] = useState<ContaEscritorio[]>([])
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([])
  const [honorarios, setHonorarios] = useState<HonorarioFixo[]>([])
  const [contratos, setContratos] = useState<
    Awaited<ReturnType<typeof buscarHonorariosDeContratos>>
  >([])
  const [carregando, setCarregando] = useState(true)

  const [dialogConta, setDialogConta] = useState(false)
  const [dialogHonorario, setDialogHonorario] = useState(false)
  const [dialogCategoria, setDialogCategoria] = useState(false)

  const carregar = useCallback(async () => {
    if (!tenantId) return
    setCarregando(true)
    try {
      const [c, cat, h, hc] = await Promise.all([
        listarContas(tenantId),
        listarCategorias(tenantId),
        listarHonorarios({ tenantId }),
        buscarHonorariosDeContratos(tenantId),
      ])
      setContas(c)
      setCategorias(cat)
      setHonorarios(h)
      setContratos(hc)
    } catch {
      // silencioso
    } finally {
      setCarregando(false)
    }
  }, [tenantId])

  useEffect(() => {
    carregar()
  }, [carregar])

  const nomesEmpresas = useMemo(() => new Map(empresas.map((e) => [e.id, e.nome])), [empresas])

  const idsComHonorario = useMemo(
    () => new Set(honorarios.filter((h) => h.ativo !== false).map((h) => h.empresa_id)),
    [honorarios],
  )

  const contratosSemHonorario = contratos.filter(
    (c) => c.empresa_id && !idsComHonorario.has(c.empresa_id),
  )

  async function handleCriarConta(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!tenantId || !usuarioId) return
    const fd = new FormData(e.currentTarget)
    await criarConta({
      tenantId,
      usuarioId,
      nome: String(fd.get('nome') || '').trim(),
      tipo: String(fd.get('tipo') || 'caixa') as ContaEscritorio['tipo'],
      agencia: String(fd.get('agencia') || ''),
      contaNumero: String(fd.get('conta_numero') || ''),
      saldoInicial: Number(fd.get('saldo_inicial') || 0),
    })
    setDialogConta(false)
    toast({ title: 'Conta criada', description: 'A conta de caixa/banco foi cadastrada.' })
    aoMudar()
    carregar()
  }

  async function handleCriarCategoria(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!tenantId) return
    const fd = new FormData(e.currentTarget)
    await criarCategoria({
      tenantId,
      nome: String(fd.get('nome') || '').trim(),
      tipo: String(fd.get('tipo') || 'receita') as CategoriaFinanceira['tipo'],
      descricao: String(fd.get('descricao') || ''),
    })
    setDialogCategoria(false)
    toast({ title: 'Categoria criada' })
    aoMudar()
    carregar()
  }

  async function handleCriarHonorario(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!tenantId || !usuarioId) return
    const fd = new FormData(e.currentTarget)
    const empresaId = String(fd.get('empresa_id') || '')
    if (!empresaId) return
    await criarHonorario({
      tenantId,
      usuarioId,
      empresaId,
      descricao: String(fd.get('descricao') || ''),
      valorMensal: Number(fd.get('valor_mensal') || 0),
      diaVencimento: Number(fd.get('dia_vencimento') || 10),
    })
    setDialogHonorario(false)
    toast({
      title: 'Honorário cadastrado',
      description: 'Já pode ser gerado na fase Recebimentos.',
    })
    aoMudar()
    carregar()
  }

  async function importarContrato(contratoId: string) {
    if (!tenantId || !usuarioId) return
    const c = contratos.find((x) => x.id === contratoId)
    if (!c || !c.empresa_id) return
    await criarHonorario({
      tenantId,
      usuarioId,
      empresaId: c.empresa_id,
      descricao: c.descricao,
      valorMensal: c.valor_mensal,
      diaVencimento: c.dia_vencimento,
      origem: 'contrato',
      contratoId: c.id,
    })
    toast({ title: 'Honorário importado do contrato' })
    aoMudar()
    carregar()
  }

  async function toggleHonorario(h: HonorarioFixo) {
    await atualizarHonorario(h.id, { ativo: h.ativo === false })
    aoMudar()
    carregar()
  }

  return (
    <div className="space-y-4">
      {carregando ? (
        <Card className="flex items-center gap-2 p-4 text-xs text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando cadastros…
        </Card>
      ) : (
        <>
          {/* Contas de caixa e bancos */}
          <Card className="rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
                <Wallet className="h-4 w-4 text-[#0FA3A3]" /> Contas de caixa e bancos
              </h4>
              <Button size="sm" onClick={() => setDialogConta(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Nova conta
              </Button>
            </div>
            {contas.length === 0 ? (
              <p className="text-xs text-slate-500">
                Nenhuma conta cadastrada. Cadastre o caixa e as contas bancárias do escritório.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500 border-b">
                      <th className="py-1.5 font-semibold">Nome</th>
                      <th className="py-1.5 font-semibold">Tipo</th>
                      <th className="py-1.5 font-semibold">Agência/Conta</th>
                      <th className="py-1.5 font-semibold text-right">Saldo inicial</th>
                      <th className="py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {contas.map((c) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-1.5 font-medium text-[#1A2333]">{c.nome}</td>
                        <td className="py-1.5 capitalize">{c.tipo}</td>
                        <td className="py-1.5 text-slate-500">
                          {[c.agencia, c.conta_numero].filter(Boolean).join(' / ') || '—'}
                        </td>
                        <td className="py-1.5 text-right font-medium">
                          {fmt(c.saldo_inicial ?? 0)}
                        </td>
                        <td className="py-1.5 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            aria-label={`Excluir conta ${c.nome}`}
                            onClick={async () => {
                              await excluirConta(c.id)
                              aoMudar()
                              carregar()
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Categorias */}
          <Card className="rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-[#0FA3A3]" /> Categorias de receita/despesa
              </h4>
              <Button size="sm" variant="outline" onClick={() => setDialogCategoria(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Nova categoria
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categorias.map((c) => (
                <Badge
                  key={c.id}
                  variant="outline"
                  className={cn(
                    'text-[10px]',
                    c.tipo === 'receita'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-700 border-red-200',
                  )}
                >
                  {c.nome}
                </Badge>
              ))}
            </div>
          </Card>

          {/* Honorários fixos */}
          <Card className="rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#0FA3A3]" /> Honorários mensais fixos por
                cliente
              </h4>
              <Button size="sm" onClick={() => setDialogHonorario(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Novo honorário
              </Button>
            </div>
            {honorarios.length === 0 ? (
              <p className="text-xs text-slate-500">
                Nenhum honorário fixo cadastrado. Cadastre manualmente ou importe de um contrato
                assinado.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500 border-b">
                      <th className="py-1.5 font-semibold">Cliente</th>
                      <th className="py-1.5 font-semibold">Descrição</th>
                      <th className="py-1.5 font-semibold text-right">Valor mensal</th>
                      <th className="py-1.5 font-semibold">Vencimento</th>
                      <th className="py-1.5 font-semibold">Origem</th>
                      <th className="py-1.5 font-semibold text-center">Ativo</th>
                      <th className="py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {honorarios.map((h) => (
                      <tr key={h.id} className="border-b last:border-0">
                        <td className="py-1.5 font-medium text-[#1A2333]">
                          {nomesEmpresas.get(h.empresa_id) || h.empresa_id}
                        </td>
                        <td className="py-1.5 text-slate-500">{h.descricao || '—'}</td>
                        <td className="py-1.5 text-right font-medium">{fmt(h.valor_mensal)}</td>
                        <td className="py-1.5">dia {h.dia_vencimento ?? 10}</td>
                        <td className="py-1.5">
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-slate-50 text-slate-600 border-slate-200"
                          >
                            {h.origem === 'contrato' ? 'Contrato' : 'Manual'}
                          </Badge>
                        </td>
                        <td className="py-1.5 text-center">
                          <Switch
                            checked={h.ativo !== false}
                            onCheckedChange={() => toggleHonorario(h)}
                            aria-label={`Ativar honorário de ${nomesEmpresas.get(h.empresa_id) || 'cliente'}`}
                          />
                        </td>
                        <td className="py-1.5 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            aria-label={`Excluir honorário de ${nomesEmpresas.get(h.empresa_id) || 'cliente'}`}
                            onClick={async () => {
                              await excluirHonorario(h.id)
                              aoMudar()
                              carregar()
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {contratosSemHonorario.length > 0 && (
              <div className="mt-4 rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] font-semibold text-slate-600 mb-2">
                  Contratos assinados sem honorário no Financeiro — importe em 1 clique:
                </p>
                <div className="space-y-1.5">
                  {contratosSemHonorario.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">
                        {nomesEmpresas.get(c.empresa_id!) || c.empresa_id} — {c.descricao} (
                        {fmt(c.valor_mensal)})
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px]"
                        onClick={() => importarContrato(c.id)}
                      >
                        Importar
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Dialog conta */}
      <Dialog open={dialogConta} onOpenChange={setDialogConta}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova conta de caixa/banco</DialogTitle>
            <DialogDescription>
              Contas do escritório usadas para baixar recebimentos e pagamentos.
            </DialogDescription>
          </DialogHeader>
          <form id="form-nova-conta" onSubmit={handleCriarConta} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="conta-nome">Nome</Label>
              <Input id="conta-nome" name="nome" required placeholder="Caixa interno, Banco XYZ…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conta-tipo">Tipo</Label>
              <Select name="tipo" defaultValue="caixa">
                <SelectTrigger id="conta-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="caixa">Caixa</SelectItem>
                  <SelectItem value="banco">Banco</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="conta-agencia">Agência</Label>
                <Input id="conta-agencia" name="agencia" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conta-numero">Conta</Label>
                <Input id="conta-numero" name="conta_numero" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conta-saldo">Saldo inicial (R$)</Label>
              <Input
                id="conta-saldo"
                name="saldo_inicial"
                type="number"
                step="0.01"
                defaultValue="0"
              />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogConta(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-nova-conta">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog categoria */}
      <Dialog open={dialogCategoria} onOpenChange={setDialogCategoria}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova categoria</DialogTitle>
            <DialogDescription>
              Usada para classificar receitas e despesas no DRE.
            </DialogDescription>
          </DialogHeader>
          <form id="form-nova-categoria" onSubmit={handleCriarCategoria} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cat-nome">Nome</Label>
              <Input id="cat-nome" name="nome" required placeholder="Aluguel, Folha, Honorários…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-tipo">Tipo</Label>
              <Select name="tipo" defaultValue="despesa">
                <SelectTrigger id="cat-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-descricao">Descrição</Label>
              <Input id="cat-descricao" name="descricao" />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogCategoria(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-nova-categoria">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog honorário */}
      <Dialog open={dialogHonorario} onOpenChange={setDialogHonorario}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo honorário mensal fixo</DialogTitle>
            <DialogDescription>
              Cobrança recorrente de um cliente — usada na geração em massa dos títulos do mês.
            </DialogDescription>
          </DialogHeader>
          <form id="form-novo-honorario" onSubmit={handleCriarHonorario} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="hon-empresa">Cliente (empresa)</Label>
              <Select name="empresa_id" required defaultValue="">
                <SelectTrigger id="hon-empresa">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hon-descricao">Descrição</Label>
              <Input
                id="hon-descricao"
                name="descricao"
                placeholder="Honorários contábeis mensais"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="hon-valor">Valor mensal (R$)</Label>
                <Input
                  id="hon-valor"
                  name="valor_mensal"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hon-dia">Dia de vencimento</Label>
                <Input
                  id="hon-dia"
                  name="dia_vencimento"
                  type="number"
                  min="1"
                  max="31"
                  defaultValue="10"
                  inputMode="numeric"
                />
              </div>
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogHonorario(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-novo-honorario">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fase Recebimentos
// ---------------------------------------------------------------------------

interface RecebimentosFaseProps {
  tenantId?: string
  usuarioId?: string
  empresas: Array<{ id: string; nome: string }>
  competencia: string
  aoMudar: () => void
}

export function RecebimentosFase({
  tenantId,
  usuarioId,
  empresas,
  competencia,
  aoMudar,
}: RecebimentosFaseProps) {
  const { toast } = useToast()
  const hoje = new Date().toISOString().slice(0, 10)
  const [titulos, setTitulos] = useState<TituloFinanceiro[]>([])
  const [carregando, setCarregando] = useState(true)
  const [gerando, setGerando] = useState(false)
  const [dialogReceita, setDialogReceita] = useState(false)
  const [dialogBaixa, setDialogBaixa] = useState(false)
  const [baixando, setBaixando] = useState(false)
  const [contas, setContas] = useState<ContaEscritorio[]>([])
  const [contaBaixa, setContaBaixa] = useState('')
  const [dataBaixa, setDataBaixa] = useState(new Date().toISOString().slice(0, 10))
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!tenantId || contas.length > 0) return
    listarContas(tenantId)
      .then(setContas)
      .catch(() => setContas([]))
  }, [tenantId, contas.length])

  const nomesEmpresas = useMemo(() => new Map(empresas.map((e) => [e.id, e.nome])), [empresas])

  const carregar = useCallback(async () => {
    if (!tenantId) return
    setCarregando(true)
    try {
      const lista = await listarTitulos({ tenantId, competencia, tipo: 'receber' })
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

  async function handleGerarLote() {
    if (!tenantId || !usuarioId) return
    setGerando(true)
    try {
      const r = await gerarTitulosDoMes({ tenantId, usuarioId, competencia })
      toast({
        title: 'Geração em massa concluída',
        description: `${r.criados} título(s) criado(s), ${r.ignorados} já existente(s)/ignorado(s).`,
      })
      aoMudar()
      carregar()
    } catch {
      toast({ title: 'Erro ao gerar títulos', variant: 'destructive' })
    } finally {
      setGerando(false)
    }
  }

  async function handleCriarReceita(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!tenantId || !usuarioId) return
    const fd = new FormData(e.currentTarget)
    const empresaId = String(fd.get('empresa_id') || '')
    if (!empresaId) return
    await criarTitulo({
      tenantId,
      usuarioId,
      empresaId,
      tipo: 'receber',
      origem: 'receita_avulsa',
      descricao: String(fd.get('descricao') || 'Receita avulsa'),
      competencia,
      vencimento: String(fd.get('vencimento') || '') || undefined,
      valor: Number(fd.get('valor') || 0),
    })
    setDialogReceita(false)
    toast({ title: 'Receita lançada' })
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
        title: 'Baixa concluída',
        description: `${alvo.length} título(s) recebido(s) — valor lançado como entrada no caixa.`,
      })
      setSelecionados(new Set())
      setContaBaixa('')
      setDialogBaixa(false)
      aoMudar()
      carregar()
    } catch {
      toast({ title: 'Erro ao dar baixa', variant: 'destructive' })
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

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h4 className="text-sm font-bold text-[#1A2333]">Títulos a receber — {competencia}</h4>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setDialogReceita(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Receita avulsa
            </Button>
            <Button size="sm" onClick={handleGerarLote} disabled={gerando}>
              {gerando ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
              )}
              Gerar cobranças do mês
            </Button>
          </div>
        </div>

        {/* Checkbox selecionados: visível apenas nos títulos abertos */}
        {carregando ? (
          <p className="text-xs text-slate-500 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando títulos…
          </p>
        ) : titulos.length === 0 ? (
          <p className="text-xs text-slate-500">
            Nenhum título na competência. Use “Gerar cobranças do mês” a partir dos honorários
            fixos.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-1.5 w-8" />
                  <th className="py-1.5 font-semibold">Cliente</th>
                  <th className="py-1.5 font-semibold">Descrição</th>
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
                          aria-label={`Selecionar título de ${nomesEmpresas.get(t.empresa_id) || 'cliente'}`}
                        />
                      ) : (
                        <span className="text-emerald-600 font-bold">✓</span>
                      )}
                    </td>
                    <td className="py-1.5 font-medium text-[#1A2333]">
                      {t.expand?.empresa_id?.nome_fantasia ||
                        nomesEmpresas.get(t.empresa_id) ||
                        t.empresa_id}
                    </td>
                    <td className="py-1.5 text-slate-500">{t.descricao}</td>
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
                      {t.status === 'aberto' && selecionados.has(t.id) && (
                        <span className="text-[10px] text-slate-400">marcado p/ baixa</span>
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
            A receber: <strong className="text-amber-600">{fmt(totalAberto)}</strong>
          </span>
          <span className="text-slate-500">
            Recebido: <strong className="text-emerald-600">{fmt(totalPago)}</strong>
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
            Dar baixa ({selecionados.size})
          </Button>
        </div>
      </Card>

      {/* Dialog baixa em lote */}
      <Dialog open={dialogBaixa} onOpenChange={setDialogBaixa}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dar baixa em {selecionados.size} título(s)</DialogTitle>
            <DialogDescription>
              Confirma o recebimento? O valor entra no caixa da conta selecionada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="baixa-conta">Conta (caixa/banco)</Label>
            <Select value={contaBaixa} onValueChange={setContaBaixa}>
              <SelectTrigger id="baixa-conta">
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
            <Label htmlFor="baixa-data">Data do recebimento</Label>
            <Input
              id="baixa-data"
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
              Confirmar baixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog receita avulsa */}
      <Dialog open={dialogReceita} onOpenChange={setDialogReceita}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova receita avulsa</DialogTitle>
            <DialogDescription>
              Serviço extra, alteração contratual, parcelamento etc.
            </DialogDescription>
          </DialogHeader>
          <form id="form-receita-avulsa" onSubmit={handleCriarReceita} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="rec-empresa">Cliente (empresa)</Label>
              <Select name="empresa_id" required defaultValue="">
                <SelectTrigger id="rec-empresa">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-descricao">Descrição</Label>
              <Input id="rec-descricao" name="descricao" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rec-valor">Valor (R$)</Label>
                <Input id="rec-valor" name="valor" type="number" step="0.01" min="0.01" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rec-vencimento">Vencimento</Label>
                <Input id="rec-vencimento" name="vencimento" type="date" />
              </div>
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogReceita(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-receita-avulsa">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

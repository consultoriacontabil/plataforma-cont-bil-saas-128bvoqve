/**
 * Fase Cadastros do Módulo Contábil (Fatia 4 Makro).
 * Plano de contas da empresa: listagem em árvore (sintéticas/analíticas),
 * criação, edição de nome/ativação e exclusão — via contabilService.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardList, Loader2, Plus, Pencil, Trash2, Save, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { contabilService } from '@/services/contabil'
import type { ContaContabil, ContaTipo } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const TIPOS: Array<{ value: ContaTipo; label: string }> = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'passivo', label: 'Passivo' },
  { value: 'patrimonio', label: 'Patrimônio Líquido' },
  { value: 'receita', label: 'Receita' },
  { value: 'despesa', label: 'Despesa' },
]

interface Props {
  tenantId?: string
  empresaId: string
  aoMudar: () => void
}

export function CadastrosFase({ tenantId, empresaId, aoMudar }: Props) {
  const { toast } = useToast()
  const [contas, setContas] = useState<ContaContabil[]>([])
  const [carregando, setCarregando] = useState(true)
  const [dialogAberto, setDialogAberto] = useState(false)
  const [editando, setEditando] = useState<ContaContabil | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState('')

  // form
  const [codigo, setCodigo] = useState('')
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<ContaTipo>('ativo')
  const [contaPai, setContaPai] = useState<string>('none')

  const carregar = useCallback(async () => {
    if (!tenantId || !empresaId) {
      setContas([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    try {
      const lista = await contabilService.getPlanoContas(tenantId, `empresa = "${empresaId}"`)
      setContas(lista)
    } catch {
      setContas([])
    } finally {
      setCarregando(false)
    }
  }, [tenantId, empresaId])

  useEffect(() => {
    carregar()
  }, [carregar])

  const sinteticas = useMemo(
    () => contas.filter((c) => contas.some((f) => f.pai === c.id)),
    [contas],
  )

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return contas
    return contas.filter(
      (c) => c.codigo.toLowerCase().includes(termo) || c.nome.toLowerCase().includes(termo),
    )
  }, [contas, busca])

  const abrirNova = () => {
    setEditando(null)
    setCodigo('')
    setNome('')
    setTipo('ativo')
    setContaPai('none')
    setDialogAberto(true)
  }

  const abrirEdicao = (c: ContaContabil) => {
    setEditando(c)
    setCodigo(c.codigo)
    setNome(c.nome)
    setTipo(c.tipo)
    setContaPai(c.pai || 'none')
    setDialogAberto(true)
  }

  const salvar = async () => {
    if (!tenantId || !codigo.trim() || !nome.trim()) {
      toast({
        title: 'Preencha código e nome da conta',
        variant: 'destructive',
      })
      return
    }
    setSalvando(true)
    try {
      const payload: Partial<ContaContabil> = {
        tenant_id: tenantId,
        empresa: empresaId,
        codigo: codigo.trim(),
        nome: nome.trim(),
        tipo,
        ativa: editando ? editando.ativa : true,
        pai: contaPai === 'none' ? undefined : contaPai,
      }
      if (editando) {
        await contabilService.updateConta(editando.id, payload)
      } else {
        await contabilService.createConta(payload)
      }
      toast({ title: editando ? 'Conta atualizada' : 'Conta criada' })
      setDialogAberto(false)
      await carregar()
      aoMudar()
    } catch {
      toast({ title: 'Erro ao salvar a conta', variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  const alternarAtiva = async (c: ContaContabil) => {
    try {
      await contabilService.updateConta(c.id, { ativa: !c.ativa })
      await carregar()
      aoMudar()
    } catch {
      toast({ title: 'Erro ao alterar status da conta', variant: 'destructive' })
    }
  }

  const excluir = async (c: ContaContabil) => {
    if (sinteticas.some((s) => s.id === c.id)) {
      toast({
        title: 'Conta sintética',
        description: 'Exclua ou mova as contas filhas antes de excluir esta.',
        variant: 'destructive',
      })
      return
    }
    try {
      await contabilService.deleteConta(c.id)
      toast({ title: 'Conta excluída' })
      await carregar()
      aoMudar()
    } catch {
      toast({ title: 'Erro ao excluir a conta', variant: 'destructive' })
    }
  }

  if (!empresaId) {
    return (
      <Card className="rounded-2xl p-4 text-xs text-slate-500">
        Selecione uma empresa no cabeçalho para gerenciar o plano de contas.
      </Card>
    )
  }

  if (carregando) {
    return (
      <Card className="rounded-2xl p-4 text-xs text-slate-500 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando plano de contas…
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl border-[#E2E8F0] p-4 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
        <h4 className="text-sm font-bold text-[#1A2333] flex items-center gap-2 flex-1">
          <ClipboardList className="h-4 w-4 text-[#0FA3A3]" /> Plano de contas
          <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500">
            {contas.length} contas
          </Badge>
        </h4>
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar código ou nome…"
          aria-label="Buscar conta no plano de contas"
          className="h-9 text-xs sm:w-56"
        />
        <Button size="sm" className="h-9 text-xs" onClick={abrirNova}>
          <Plus className="h-3.5 w-3.5" /> Nova conta
        </Button>
      </div>

      {filtradas.length === 0 ? (
        <p className="text-xs text-slate-500 py-6 text-center">
          Nenhuma conta encontrada{busca ? ' para a busca' : ' — crie a primeira conta'}.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase text-slate-400 border-b">
                <th className="py-2 pr-3 font-semibold">Código</th>
                <th className="py-2 pr-3 font-semibold">Nome</th>
                <th className="py-2 pr-3 font-semibold">Tipo</th>
                <th className="py-2 pr-3 font-semibold">Nível</th>
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((c) => {
                const sintetica = contas.some((f) => f.pai === c.id)
                const pai = c.pai ? contas.find((p) => p.id === c.pai) : null
                return (
                  <tr key={c.id} className="border-b last:border-0 text-[#1A2333]">
                    <td className="py-2 pr-3 font-mono font-semibold">{c.codigo}</td>
                    <td className={cn('py-2 pr-3', pai && 'pl-4')}>
                      {pai && (
                        <span className="text-[10px] text-slate-400 mr-1">└ {pai.codigo}</span>
                      )}
                      {c.nome}
                    </td>
                    <td className="py-2 pr-3">
                      {TIPOS.find((t) => t.value === c.tipo)?.label || c.tipo}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge
                        variant="outline"
                        className="text-[9px] bg-slate-50 text-slate-500 border-slate-200"
                      >
                        {sintetica ? 'Sintética' : 'Analítica'}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={() => alternarAtiva(c)}
                        className={cn(
                          'text-[10px] font-bold rounded-full px-2 py-0.5 border',
                          c.ativa
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            : 'bg-slate-50 text-slate-400 border-slate-200',
                        )}
                        aria-label={
                          c.ativa ? `Desativar conta ${c.codigo}` : `Ativar conta ${c.codigo}`
                        }
                      >
                        {c.ativa ? 'Ativa' : 'Inativa'}
                      </button>
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => abrirEdicao(c)}
                        aria-label={`Editar conta ${c.codigo}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-red-500 hover:text-red-600"
                        onClick={() => excluir(c)}
                        aria-label={`Excluir conta ${c.codigo}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {editando ? `Editar conta ${editando.codigo}` : 'Nova conta do plano'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="conta-codigo" className="text-[11px]">
                  Código
                </Label>
                <Input
                  id="conta-codigo"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="1.1.1.01"
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label htmlFor="conta-nome" className="text-[11px]">
                  Nome
                </Label>
                <Input
                  id="conta-nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Caixa geral"
                  className="h-9 text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="conta-tipo" className="text-[11px]">
                  Natureza
                </Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as ContaTipo)}>
                  <SelectTrigger id="conta-tipo" className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="conta-pai" className="text-[11px]">
                  Conta superior (sintética)
                </Label>
                <Select value={contaPai} onValueChange={setContaPai}>
                  <SelectTrigger id="conta-pai" className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma (raiz)</SelectItem>
                    {sinteticas
                      .filter((s) => s.id !== editando?.id)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.codigo} — {s.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogAberto(false)}>
              <X className="h-3.5 w-3.5" /> Cancelar
            </Button>
            <Button size="sm" onClick={salvar} disabled={salvando}>
              {salvando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {editando ? 'Salvar alterações' : 'Criar conta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

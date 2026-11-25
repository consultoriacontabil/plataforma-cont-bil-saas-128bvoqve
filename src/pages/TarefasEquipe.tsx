import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ListTodo,
  Plus,
  RotateCw,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  User as UserIcon,
  CalendarDays,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { tarefasEquipeService } from '@/services/tarefasEquipe'
import { empresasService } from '@/services/empresas'
import { usersService } from '@/services/users'
import type { Empresa, TarefaEquipe, TarefaEquipeStatus } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const LABEL_STATUS: Record<TarefaEquipeStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
}

const LABEL_PRIORIDADE: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
}

function formatarData(valor?: string) {
  if (!valor) return '—'
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function diasParaVencimento(valor?: string): number | null {
  if (!valor) return null
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - hoje.getTime()) / 86400000)
}

interface FormTarefa {
  titulo: string
  descricao: string
  responsavel_id: string
  empresa_id: string
  vencimento: string
  status: TarefaEquipeStatus
  prioridade: string
}

const FORM_VAZIO: FormTarefa = {
  titulo: '',
  descricao: '',
  responsavel_id: 'none',
  empresa_id: 'none',
  vencimento: '',
  status: 'pendente',
  prioridade: 'media',
}

export default function TarefasEquipePage() {
  const { tenant, user } = useAuth()
  const { toast } = useToast()

  const [tarefas, setTarefas] = useState<TarefaEquipe[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [membros, setMembros] = useState<{ userId: string; nome: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todas')
  const [saving, setSaving] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editando, setEditando] = useState<TarefaEquipe | null>(null)
  const [form, setForm] = useState<FormTarefa>(FORM_VAZIO)
  const [excluindo, setExcluindo] = useState<TarefaEquipe | null>(null)

  const carregar = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const [lista, emps] = await Promise.all([
        tarefasEquipeService.list(tenant.id),
        empresasService.list(tenant.id).catch(() => [] as Empresa[]),
      ])
      setTarefas(lista)
      setEmpresas(emps)
    } catch (err) {
      console.error('Erro ao carregar tarefas da equipe:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar as tarefas da equipe.',
      })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, toast])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Membros do tenant (para seleção de responsável)
  useEffect(() => {
    if (!tenant?.id) return
    let cancelado = false
    usersService
      .listMembers(tenant.id)
      .then((ms) => {
        if (cancelado) return
        setMembros(
          ms
            .map((m) => ({
              userId: m.expand?.user_id?.id || m.user_id,
              nome: m.expand?.user_id?.name || m.expand?.user_id?.email || 'Membro',
            }))
            .sort((a, b) => a.nome.localeCompare(b.nome)),
        )
      })
      .catch(() => {
        if (!cancelado) setMembros([])
      })
    return () => {
      cancelado = true
    }
  }, [tenant?.id])

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return tarefas
      .filter((t) => {
        if (filtroStatus !== 'todas' && t.status !== filtroStatus) return false
        if (!q) return true
        const resp = t.expand?.responsavel_id?.name || ''
        const emp = t.expand?.empresa_id?.nome_fantasia || t.expand?.empresa_id?.razao_social || ''
        return (
          t.titulo.toLowerCase().includes(q) ||
          (t.descricao || '').toLowerCase().includes(q) ||
          resp.toLowerCase().includes(q) ||
          emp.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => {
        // Abertas primeiro (pendente/em_andamento), depois por created desc
        const rankA = a.status === 'concluida' ? 1 : 0
        const rankB = b.status === 'concluida' ? 1 : 0
        if (rankA !== rankB) return rankA - rankB
        return (b.created || '').localeCompare(a.created || '')
      })
  }, [tarefas, busca, filtroStatus])

  const resumo = useMemo(
    () => ({
      pendente: tarefas.filter((t) => t.status === 'pendente').length,
      em_andamento: tarefas.filter((t) => t.status === 'em_andamento').length,
      concluida: tarefas.filter((t) => t.status === 'concluida').length,
      atrasadas: tarefas.filter(
        (t) => t.status !== 'concluida' && (diasParaVencimento(t.vencimento) ?? 99) < 0,
      ).length,
    }),
    [tarefas],
  )

  const abrirNova = () => {
    setEditando(null)
    setForm({ ...FORM_VAZIO, responsavel_id: user?.id || 'none' })
    setFormOpen(true)
  }

  const abrirEdicao = (t: TarefaEquipe) => {
    setEditando(t)
    setForm({
      titulo: t.titulo,
      descricao: t.descricao || '',
      responsavel_id: t.responsavel_id || 'none',
      empresa_id: t.empresa_id || 'none',
      vencimento: t.vencimento ? t.vencimento.slice(0, 10) : '',
      status: t.status,
      prioridade: t.prioridade || 'media',
    })
    setFormOpen(true)
  }

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant?.id || !form.titulo.trim()) return
    setSaving(true)
    try {
      const payload = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || undefined,
        responsavel_id: form.responsavel_id === 'none' ? undefined : form.responsavel_id,
        empresa_id: form.empresa_id === 'none' ? undefined : form.empresa_id,
        vencimento: form.vencimento || undefined,
        status: form.status,
        prioridade: form.prioridade,
      }
      if (editando) {
        await tarefasEquipeService.update(editando.id, payload)
        toast({ title: 'Tarefa atualizada!' })
      } else {
        await tarefasEquipeService.create({ tenant_id: tenant.id, ...payload })
        toast({ title: 'Tarefa criada!', description: 'Ela já aparece no topo da lista.' })
      }
      setFormOpen(false)
      await carregar()
    } catch (err) {
      console.error('Erro ao salvar tarefa:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Verifique os campos e tente novamente.',
      })
    } finally {
      setSaving(false)
    }
  }

  const alternarConcluida = async (t: TarefaEquipe) => {
    try {
      if (t.status === 'concluida') {
        await tarefasEquipeService.update(t.id, { status: 'pendente' })
      } else {
        await tarefasEquipeService.marcarConcluida(t.id)
      }
      await carregar()
    } catch (err) {
      console.error('Erro ao atualizar status da tarefa:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: 'Não foi possível alterar o status da tarefa.',
      })
    }
  }

  const excluir = async () => {
    if (!excluindo) return
    try {
      await tarefasEquipeService.delete(excluindo.id)
      toast({ title: 'Tarefa excluída.' })
      setExcluindo(null)
      await carregar()
    } catch (err) {
      console.error('Erro ao excluir tarefa:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: 'Apenas administradores podem excluir tarefas.',
      })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1A2333] flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-[#0FA3A3]" />
            Tarefas da Equipe
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Painel de tarefas internas do escritório com responsável, prazo e status.
          </p>
        </div>
        <Button
          onClick={abrirNova}
          className="bg-[#0FA3A3] hover:bg-[#0c8282] text-white h-9 text-xs gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Nova Tarefa
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="rounded-xl border-[#E2E8F0] p-3 shadow-2xs">
          <div className="text-[11px] font-semibold text-[#64748B]">Pendentes</div>
          <div className="text-xl font-extrabold text-amber-600 mt-1">{resumo.pendente}</div>
        </Card>
        <Card className="rounded-xl border-[#E2E8F0] p-3 shadow-2xs">
          <div className="text-[11px] font-semibold text-[#64748B]">Em andamento</div>
          <div className="text-xl font-extrabold text-blue-600 mt-1">{resumo.em_andamento}</div>
        </Card>
        <Card className="rounded-xl border-[#E2E8F0] p-3 shadow-2xs">
          <div className="text-[11px] font-semibold text-[#64748B]">Atrasadas</div>
          <div className="text-xl font-extrabold text-red-600 mt-1">{resumo.atrasadas}</div>
        </Card>
        <Card className="rounded-xl border-[#E2E8F0] p-3 shadow-2xs">
          <div className="text-[11px] font-semibold text-[#64748B]">Concluídas</div>
          <div className="text-xl font-extrabold text-emerald-600 mt-1">{resumo.concluida}</div>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por título, descrição, responsável ou empresa..."
            className="h-9 pl-9 text-xs"
            aria-label="Buscar tarefas"
          />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="h-9 w-full sm:w-44 text-xs" aria-label="Filtrar por status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos os status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="concluida">Concluída</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={carregar}
          disabled={loading}
          className="h-9 text-xs gap-1.5"
        >
          <RotateCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {/* Lista de tarefas */}
      {loading ? (
        <Card className="rounded-2xl border-dashed p-8 text-center text-sm text-[#94A3B8]">
          Carregando tarefas...
        </Card>
      ) : filtradas.length === 0 ? (
        <Card className="rounded-2xl border border-dashed border-slate-300 p-10 text-center bg-slate-50">
          <ListTodo className="h-10 w-10 text-slate-400 mx-auto mb-2" />
          <h4 className="font-bold text-slate-800 text-sm">Nenhuma tarefa encontrada</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
            Crie a primeira tarefa da equipe para distribuir responsabilidades do escritório.
          </p>
          <Button size="sm" onClick={abrirNova} className="bg-[#0FA3A3] text-white text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Nova Tarefa
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtradas.map((t) => {
            const dias = diasParaVencimento(t.vencimento)
            const atrasada = t.status !== 'concluida' && dias !== null && dias < 0
            const venceBreve = t.status !== 'concluida' && dias !== null && dias >= 0 && dias <= 3
            return (
              <Card
                key={t.id}
                className={cn(
                  'rounded-xl border-[#E2E8F0] p-4 shadow-2xs transition-colors',
                  atrasada && 'border-red-200 bg-red-50/40',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      onClick={() => alternarConcluida(t)}
                      aria-label={
                        t.status === 'concluida'
                          ? `Reabrir tarefa ${t.titulo}`
                          : `Concluir tarefa ${t.titulo}`
                      }
                      className="mt-0.5 shrink-0 text-[#94A3B8] hover:text-[#0FA3A3] transition-colors"
                    >
                      {t.status === 'concluida' ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <Clock className="h-5 w-5" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <p
                        className={cn(
                          'text-sm font-semibold text-[#1A2333]',
                          t.status === 'concluida' && 'line-through text-[#94A3B8]',
                        )}
                      >
                        {t.titulo}
                      </p>
                      {t.descricao && (
                        <p className="text-xs text-[#64748B] line-clamp-2 mt-0.5">{t.descricao}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-[#64748B]">
                        <span className="flex items-center gap-1">
                          <UserIcon className="h-3 w-3" />
                          {t.expand?.responsavel_id?.name || 'Sem responsável'}
                        </span>
                        {t.expand?.empresa_id && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {t.expand.empresa_id.nome_fantasia ||
                              t.expand.empresa_id.razao_social ||
                              '—'}
                          </span>
                        )}
                        {t.vencimento && (
                          <span
                            className={cn(
                              'flex items-center gap-1 font-medium',
                              atrasada && 'text-red-600',
                              venceBreve && 'text-amber-600',
                            )}
                          >
                            <CalendarDays className="h-3 w-3" />
                            {formatarData(t.vencimento)}
                            {atrasada && ' (atrasada)'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] font-bold',
                        t.status === 'pendente' && 'bg-amber-50 text-amber-700 border-amber-200',
                        t.status === 'em_andamento' && 'bg-blue-50 text-blue-700 border-blue-200',
                        t.status === 'concluida' &&
                          'bg-emerald-50 text-emerald-700 border-emerald-200',
                      )}
                    >
                      {LABEL_STATUS[t.status]}
                    </Badge>
                    {t.prioridade && (
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] font-bold',
                          t.prioridade === 'alta' && 'bg-red-50 text-red-700 border-red-200',
                          t.prioridade === 'media' && 'bg-slate-50 text-slate-600 border-slate-200',
                          t.prioridade === 'baixa' && 'bg-slate-50 text-[#94A3B8] border-slate-200',
                        )}
                      >
                        {LABEL_PRIORIDADE[t.prioridade] || t.prioridade}
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => abrirEdicao(t)}
                      className="h-7 w-7 text-[#64748B] hover:text-[#0FA3A3]"
                      aria-label={`Editar tarefa ${t.titulo}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setExcluindo(t)}
                      className="h-7 w-7 text-[#64748B] hover:text-red-600"
                      aria-label={`Excluir tarefa ${t.titulo}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dica de integração */}
      <p className="text-[11px] text-[#94A3B8]">
        As tarefas concluídas ficam ao final da lista. A integração completa com o{' '}
        <Link to="/elisa-fila" className="text-[#0FA3A3] hover:underline">
          Fila da Elliza
        </Link>{' '}
        vem na Fatia 2 do modelo Makro.
      </p>

      {/* Dialog: criar/editar */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333]">
              {editando ? 'Editar Tarefa' : 'Nova Tarefa da Equipe'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Defina o responsável, o prazo e a prioridade para acompanhar a execução.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="tarefa-titulo" className="text-xs font-semibold">
                Título *
              </Label>
              <Input
                id="tarefa-titulo"
                required
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ex: Entregar DAS de janeiro da Padaria Central"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tarefa-descricao" className="text-xs font-semibold">
                Descrição
              </Label>
              <Textarea
                id="tarefa-descricao"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Detalhes da execução, evidências etc."
                className="text-xs min-h-[70px]"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Responsável</Label>
                <Select
                  value={form.responsavel_id}
                  onValueChange={(v) => setForm({ ...form, responsavel_id: v })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem responsável</SelectItem>
                    {membros.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Empresa (opcional)</Label>
                <Select
                  value={form.empresa_id}
                  onValueChange={(v) => setForm({ ...form, empresa_id: v })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {empresas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome_fantasia || e.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tarefa-vencimento" className="text-xs font-semibold">
                  Vencimento
                </Label>
                <Input
                  id="tarefa-vencimento"
                  type="date"
                  value={form.vencimento}
                  onChange={(e) => setForm({ ...form, vencimento: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Prioridade</Label>
                <Select
                  value={form.prioridade}
                  onValueChange={(v) => setForm({ ...form, prioridade: v })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as TarefaEquipeStatus })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFormOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving || !form.titulo.trim()}
                className="rounded-xl bg-[#0FA3A3] text-white hover:bg-[#0C8585] text-xs"
              >
                {saving ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar tarefa'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: exclusão */}
      <Dialog open={Boolean(excluindo)} onOpenChange={(open) => !open && setExcluindo(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333]">
              Excluir tarefa?
            </DialogTitle>
            <DialogDescription className="text-xs">
              A tarefa &quot;{excluindo?.titulo}&quot; será removida permanentemente. Somente
              administradores podem excluir.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setExcluindo(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" size="sm" onClick={excluir} className="gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

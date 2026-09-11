import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  GitPullRequest,
  Plus,
  Clock,
  AlertCircle,
  Calendar,
  Building2,
  User as UserIcon,
  CheckCircle2,
  ChevronRight,
  Send,
  X,
  Loader2,
  ArrowRight,
  Filter,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { workflowService } from '@/services/workflows'
import { empresasService } from '@/services/empresas'
import { usersService } from '@/services/users'
import { useRealtime } from '@/hooks/use-realtime'
import { formatDatePtBr } from '@/lib/formatters'
import type {
  Workflow,
  WorkflowActivity,
  WorkflowStatus,
  WorkflowPrioridade,
  WorkflowTipo,
  Empresa,
  TenantMember,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
  DialogDescription,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const COLUMNS: Array<{ id: WorkflowStatus; label: string; color: string; badgeColor: string }> = [
  {
    id: 'pendente',
    label: 'Pendente',
    color: 'border-amber-400',
    badgeColor: 'bg-amber-100 text-amber-800',
  },
  {
    id: 'em_andamento',
    label: 'Em Andamento',
    color: 'border-blue-500',
    badgeColor: 'bg-blue-100 text-blue-800',
  },
  {
    id: 'concluido',
    label: 'Concluído',
    color: 'border-emerald-500',
    badgeColor: 'bg-emerald-100 text-emerald-800',
  },
  {
    id: 'cancelado',
    label: 'Cancelado',
    color: 'border-red-400',
    badgeColor: 'bg-red-100 text-red-800',
  },
]

export default function WorkflowPage() {
  const { user, tenant } = useAuth()
  const { toast } = useToast()

  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [members, setMembers] = useState<TenantMember[]>([])
  const [loading, setLoading] = useState(true)

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null)
  const [activities, setActivities] = useState<WorkflowActivity[]>([])
  const [newComment, setNewComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  // Create form
  const [formData, setFormData] = useState({
    empresa_id: '',
    tipo: 'abertura_empresa' as WorkflowTipo,
    titulo: '',
    descricao: '',
    prioridade: 'media' as WorkflowPrioridade,
    prazo: '',
    atribuido_id: '',
  })
  const [creating, setCreating] = useState(false)

  // Drag and drop state
  const [draggedWorkflowId, setDraggedWorkflowId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      const [wfRes, empRes, memRes] = await Promise.all([
        workflowService.list(tenant.id),
        empresasService.list(tenant.id),
        usersService.listMembers(tenant.id),
      ])
      setWorkflows(wfRes)
      setEmpresas(empRes)
      setMembers(memRes)
      if (empRes.length > 0 && !formData.empresa_id) {
        setFormData((prev) => ({ ...prev, empresa_id: empRes[0].id }))
      }
    } catch (err) {
      console.error('Error loading workflow board:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar workflows',
        description: 'Não foi possível buscar as demandas.',
      })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, formData.empresa_id, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtime('workflows', () => loadData())
  useRealtime('workflow_activity', () => {
    if (selectedWorkflow) {
      workflowService.listActivities(selectedWorkflow.id).then(setActivities)
    }
  })

  // Load activities when workflow detail opens
  useEffect(() => {
    if (selectedWorkflow) {
      workflowService.listActivities(selectedWorkflow.id).then(setActivities)
    } else {
      setActivities([])
    }
  }, [selectedWorkflow])

  // Drag and drop logic
  const handleDragStart = (id: string) => {
    setDraggedWorkflowId(id)
  }

  const handleDropOnColumn = async (newStatus: WorkflowStatus) => {
    if (!draggedWorkflowId) return
    const wf = workflows.find((w) => w.id === draggedWorkflowId)
    if (!wf || wf.status === newStatus) {
      setDraggedWorkflowId(null)
      return
    }

    // Optimistic UI Update
    const previous = [...workflows]
    setWorkflows((prev) =>
      prev.map((w) => (w.id === draggedWorkflowId ? { ...w, status: newStatus } : w)),
    )
    setDraggedWorkflowId(null)

    try {
      await workflowService.update(wf.id, { status: newStatus })
      if (user?.id && tenant?.id) {
        await workflowService.addActivity({
          tenant_id: tenant.id,
          workflow_id: wf.id,
          usuario_id: user.id,
          acao: `Moveu para ${newStatus.replace('_', ' ')}`,
        })
      }
      toast({
        title: 'Status atualizado',
        description: `Workflow movido para ${newStatus.replace('_', ' ')}.`,
      })
    } catch (err) {
      // Rollback
      setWorkflows(previous)
      toast({
        variant: 'destructive',
        title: 'Erro na atualização',
        description: 'Não foi possível salvar o novo status.',
      })
    }
  }

  const handleAdvanceStatus = async (wf: Workflow) => {
    let nextStatus: WorkflowStatus = 'em_andamento'
    if (wf.status === 'pendente') nextStatus = 'em_andamento'
    else if (wf.status === 'em_andamento') nextStatus = 'concluido'
    else return

    try {
      const updated = await workflowService.update(wf.id, { status: nextStatus })
      if (user?.id && tenant?.id) {
        await workflowService.addActivity({
          tenant_id: tenant.id,
          workflow_id: wf.id,
          usuario_id: user.id,
          acao: `Avançou status para ${nextStatus.replace('_', ' ')}`,
        })
      }
      setSelectedWorkflow({ ...wf, status: nextStatus })
      loadData()
      toast({
        title: 'Status avançado!',
        description: `O workflow agora está em ${nextStatus.replace('_', ' ')}.`,
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao avançar status',
      })
    }
  }

  const handleCancelWorkflow = async (wf: Workflow) => {
    try {
      await workflowService.update(wf.id, { status: 'cancelado' })
      if (user?.id && tenant?.id) {
        await workflowService.addActivity({
          tenant_id: tenant.id,
          workflow_id: wf.id,
          usuario_id: user.id,
          acao: 'Cancelou o workflow',
          comentario: 'Solicitação cancelada pelo usuário.',
        })
      }
      setSelectedWorkflow({ ...wf, status: 'cancelado' })
      loadData()
      toast({
        title: 'Workflow cancelado',
        description: 'A solicitação foi marcada como cancelada.',
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao cancelar workflow',
      })
    }
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant?.id || !user?.id) return
    if (!formData.titulo.trim()) {
      toast({
        variant: 'destructive',
        title: 'Título obrigatório',
        description: 'Informe o título do workflow.',
      })
      return
    }

    setCreating(true)
    try {
      const created = await workflowService.create({
        tenant_id: tenant.id,
        empresa_id: formData.empresa_id || undefined,
        tipo: formData.tipo,
        titulo: formData.titulo.trim(),
        descricao: formData.descricao.trim(),
        prioridade: formData.prioridade,
        status: 'pendente',
        prazo: formData.prazo ? `${formData.prazo} 23:59:59` : undefined,
        atribuido_id: formData.atribuido_id || undefined,
        criado_por_id: user.id,
      })

      // Initial activity
      await workflowService.addActivity({
        tenant_id: tenant.id,
        workflow_id: created.id,
        usuario_id: user.id,
        acao: 'Criou o workflow',
        comentario: formData.descricao.trim() || undefined,
      })

      toast({
        title: 'Workflow criado!',
        description: 'A demanda já está disponível na coluna Pendente.',
      })

      setCreateModalOpen(false)
      setFormData({
        empresa_id: empresas[0]?.id || '',
        tipo: 'abertura_empresa',
        titulo: '',
        descricao: '',
        prioridade: 'media',
        prazo: '',
        atribuido_id: '',
      })
      loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao criar workflow.'
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar workflow',
        description: msg,
      })
    } finally {
      setCreating(false)
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedWorkflow || !tenant?.id || !user?.id || !newComment.trim()) return

    setSubmittingComment(true)
    try {
      await workflowService.addActivity({
        tenant_id: tenant.id,
        workflow_id: selectedWorkflow.id,
        usuario_id: user.id,
        acao: 'Adicionou comentário',
        comentario: newComment.trim(),
      })
      setNewComment('')
      const updatedActs = await workflowService.listActivities(selectedWorkflow.id)
      setActivities(updatedActs)
      toast({
        title: 'Comentário registrado!',
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar comentário',
      })
    } finally {
      setSubmittingComment(false)
    }
  }

  const isPastDue = (prazo?: string) => {
    if (!prazo) return false
    return new Date(prazo).getTime() < new Date().getTime()
  }

  const getPriorityDot = (prioridade: WorkflowPrioridade) => {
    switch (prioridade) {
      case 'alta':
        return <span className="h-2 w-2 rounded-full bg-red-500" title="Prioridade Alta" />
      case 'media':
        return <span className="h-2 w-2 rounded-full bg-amber-500" title="Prioridade Média" />
      case 'baixa':
        return <span className="h-2 w-2 rounded-full bg-blue-500" title="Prioridade Baixa" />
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#1A2333]">Gestão de Workflows</h2>
          <p className="text-xs text-[#64748B]">
            Kanban operacional de rotinas contábeis, prazos e solicitações
          </p>
        </div>
        <Button
          onClick={() => setCreateModalOpen(true)}
          className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs h-10 shadow-xs"
        >
          <Plus className="h-4 w-4" />
          <span>Novo Workflow</span>
        </Button>
      </div>

      {/* Kanban Board Columns (4 Columns) */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#0FA3A3]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 items-start">
          {COLUMNS.map((col) => {
            const colWorkflows = workflows.filter((w) => w.status === col.id)
            return (
              <div
                key={col.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropOnColumn(col.id)}
                className="flex flex-col rounded-2xl border border-[#E2E8F0] bg-slate-50/75 p-3 min-h-[500px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 px-1 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2.5 w-2.5 rounded-full border-2', col.color)} />
                    <span className="text-xs font-bold text-[#1A2333]">{col.label}</span>
                  </div>
                  <Badge variant="secondary" className="text-[11px] font-semibold px-2">
                    {colWorkflows.length}
                  </Badge>
                </div>

                {/* Column Cards Container */}
                <div className="flex-1 space-y-3 pt-3 overflow-y-auto">
                  {colWorkflows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-xs text-[#94A3B8]">
                      Nenhuma demanda nesta coluna
                    </div>
                  ) : (
                    colWorkflows.map((wf) => {
                      const delayed = wf.status !== 'concluido' && isPastDue(wf.prazo)
                      return (
                        <div
                          key={wf.id}
                          draggable
                          onDragStart={() => handleDragStart(wf.id)}
                          onClick={() => setSelectedWorkflow(wf)}
                          className="group rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-2xs hover:shadow-md transition-all hover:-translate-y-0.5 cursor-grab active:cursor-grabbing space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#0FA3A3] bg-teal-50 px-2 py-0.5 rounded-md">
                              {wf.tipo.replace('_', ' ')}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {getPriorityDot(wf.prioridade)}
                              <span className="text-[10px] capitalize text-[#94A3B8]">
                                {wf.prioridade}
                              </span>
                            </div>
                          </div>

                          <h4 className="text-xs font-bold text-[#1A2333] line-clamp-2 group-hover:text-[#0FA3A3] transition-colors">
                            {wf.titulo}
                          </h4>

                          {wf.expand?.empresa_id && (
                            <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
                              <Building2 className="h-3 w-3 text-[#94A3B8] shrink-0" />
                              <span className="truncate">
                                {wf.expand.empresa_id.nome_fantasia ||
                                  wf.expand.empresa_id.razao_social}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px]">
                            {wf.prazo ? (
                              <div
                                className={cn(
                                  'flex items-center gap-1 font-medium',
                                  delayed ? 'text-[#EF4444]' : 'text-[#64748B]',
                                )}
                              >
                                <Calendar className="h-3 w-3" />
                                <span>{formatDatePtBr(wf.prazo)}</span>
                                {delayed && (
                                  <Badge className="bg-red-100 text-red-700 text-[9px] px-1 py-0">
                                    Atrasado
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-[#94A3B8]">Sem prazo</span>
                            )}

                            <div className="flex items-center gap-1">
                              <Avatar className="h-5 w-5">
                                <AvatarFallback className="text-[9px] bg-[#0B1F3A] text-white">
                                  {wf.expand?.atribuido_id?.name?.charAt(0) || 'U'}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: Novo Workflow */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base text-[#1A2333]">Criar Novo Workflow</DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Cadastre demandas operacionais com prazos e responsáveis
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1A2333]">Empresa Vinculada</Label>
              <Select
                value={formData.empresa_id}
                onValueChange={(val) => setFormData({ ...formData, empresa_id: val })}
              >
                <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome_fantasia || e.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1A2333]">Tipo da Rotina *</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(val: WorkflowTipo) => setFormData({ ...formData, tipo: val })}
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="abertura_empresa">Abertura de Empresa</SelectItem>
                    <SelectItem value="alteracao_contratual">Alteração Contratual</SelectItem>
                    <SelectItem value="envio_obrigacao">Envio de Obrigação</SelectItem>
                    <SelectItem value="revisao_documento">Revisão de Documento</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1A2333]">Prioridade</Label>
                <Select
                  value={formData.prioridade}
                  onValueChange={(val: WorkflowPrioridade) =>
                    setFormData({ ...formData, prioridade: val })
                  }
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="baixa">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wf_titulo" className="text-xs font-semibold text-[#1A2333]">
                Título da Demanda *
              </Label>
              <Input
                id="wf_titulo"
                required
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Ex: Protocolo de alteração de endereço na JUCESP"
                className="h-10 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wf_desc" className="text-xs font-semibold text-[#1A2333]">
                Descrição Detalhada
              </Label>
              <Textarea
                id="wf_desc"
                rows={3}
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Detalhes dos procedimentos, sócios que assinarão, pendências..."
                className="text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="wf_prazo" className="text-xs font-semibold text-[#1A2333]">
                  Prazo Limite
                </Label>
                <Input
                  id="wf_prazo"
                  type="date"
                  value={formData.prazo}
                  onChange={(e) => setFormData({ ...formData, prazo: e.target.value })}
                  className="h-10 text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1A2333]">Responsável</Label>
                <Select
                  value={formData.atribuido_id}
                  onValueChange={(val) => setFormData({ ...formData, atribuido_id: val })}
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.expand?.user_id?.name || m.expand?.user_id?.email || 'Membro'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateModalOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs shadow-xs"
              >
                {creating ? 'Salvando...' : 'Criar Demanda'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Detalhes do Workflow & Timeline de Atividades */}
      <Dialog open={Boolean(selectedWorkflow)} onOpenChange={() => setSelectedWorkflow(null)}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[92vh] flex flex-col p-6">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#0FA3A3] uppercase tracking-wider">
                  {selectedWorkflow?.tipo.replace('_', ' ')}
                </span>
                <DialogTitle className="text-base text-[#1A2333] mt-0.5">
                  {selectedWorkflow?.titulo}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#64748B]">
                  {selectedWorkflow?.expand?.empresa_id?.nome_fantasia ||
                    selectedWorkflow?.expand?.empresa_id?.razao_social}{' '}
                  • Prazo: {formatDatePtBr(selectedWorkflow?.prazo)}
                </DialogDescription>
              </div>
              <Badge
                className={
                  selectedWorkflow?.status === 'concluido'
                    ? 'bg-[#DCFCE7] text-[#166534]'
                    : selectedWorkflow?.status === 'em_andamento'
                      ? 'bg-[#DBEAFE] text-[#1E40AF]'
                      : selectedWorkflow?.status === 'cancelado'
                        ? 'bg-[#FEE2E2] text-[#991B1B]'
                        : 'bg-[#FEF3C7] text-[#92400E]'
                }
              >
                {selectedWorkflow?.status.replace('_', ' ')}
              </Badge>
            </div>
          </DialogHeader>

          {selectedWorkflow && (
            <div className="flex-1 overflow-y-auto space-y-4 py-3">
              {/* Status Actions */}
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs border border-slate-200">
                <span className="text-[#64748B]">Ações rápidas de status:</span>
                <div className="flex items-center gap-2">
                  {selectedWorkflow.status !== 'concluido' &&
                    selectedWorkflow.status !== 'cancelado' && (
                      <Button
                        size="sm"
                        onClick={() => handleAdvanceStatus(selectedWorkflow)}
                        className="h-8 gap-1.5 rounded-lg bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs font-semibold"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>
                          {selectedWorkflow.status === 'pendente'
                            ? 'Iniciar (Em Andamento)'
                            : 'Concluir Workflow'}
                        </span>
                      </Button>
                    )}

                  {selectedWorkflow.status !== 'cancelado' &&
                    selectedWorkflow.status !== 'concluido' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCancelWorkflow(selectedWorkflow)}
                        className="h-8 text-xs text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        Cancelar Demanda
                      </Button>
                    )}
                </div>
              </div>

              {/* Description */}
              {selectedWorkflow.descricao && (
                <div className="rounded-xl border border-slate-100 p-3 bg-white text-xs space-y-1">
                  <span className="font-bold text-[#64748B]">Descrição da Demanda:</span>
                  <p className="text-[#1A2333] whitespace-pre-line">{selectedWorkflow.descricao}</p>
                </div>
              )}

              {/* Timeline of activities */}
              <div className="space-y-3 pt-2">
                <h5 className="text-xs font-bold text-[#1A2333]">
                  Histórico & Comentários ({activities.length})
                </h5>
                <div className="space-y-3">
                  {activities.map((act) => (
                    <div
                      key={act.id}
                      className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs"
                    >
                      <Avatar className="h-7 w-7 mt-0.5">
                        <AvatarFallback className="text-[10px] bg-[#0B1F3A] text-white">
                          {act.expand?.usuario_id?.name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[#1A2333]">
                            {act.expand?.usuario_id?.name || 'Membro do Escritório'}
                          </span>
                          <span className="text-[10px] text-[#94A3B8]">
                            {formatDatePtBr(act.created)}
                          </span>
                        </div>
                        <p className="text-[#64748B] mt-0.5">{act.acao}</p>
                        {act.comentario && (
                          <div className="mt-1 rounded-lg bg-white p-2 border border-slate-100 text-[#1A2333]">
                            {act.comentario}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Comment Box */}
                <form onSubmit={handleAddComment} className="flex gap-2 pt-2">
                  <Input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Adicionar nota ou comentário nesta demanda..."
                    className="h-10 text-xs rounded-xl border-[#E2E8F0]"
                  />
                  <Button
                    type="submit"
                    disabled={submittingComment || !newComment.trim()}
                    className="h-10 rounded-xl bg-[#0B1F3A] hover:bg-[#123B6D] text-white text-xs gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Enviar</span>
                  </Button>
                </form>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

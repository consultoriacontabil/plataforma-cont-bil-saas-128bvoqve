import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckSquare,
  Lock,
  Unlock,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  FileText,
  UserCheck,
  Search,
  Filter,
  Bot,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { empresasService } from '@/services/empresas'
import { fechoMensalService } from '@/services/fechoMensal'
import type {
  Empresa,
  FechamentoCompetenciaRecord,
  FechamentoChecklistItemRecord,
  FechamentoStatus,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export default function FechoMensalPage() {
  const { tenant, member, user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('empresa') || ''
  })
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('competencia') || '09/2026'
  })

  // Fechamento e Checklist da Empresa Selecionada
  const [fechamento, setFechamento] = useState<FechamentoCompetenciaRecord | null>(null)
  const [checklistItens, setChecklistItens] = useState<FechamentoChecklistItemRecord[]>([])
  const [dicasAutomaticas, setDicasAutomaticas] = useState<
    Record<string, { status: 'ok' | 'alerta' | 'pendente'; detalhe: string }>
  >({})

  // Visão Geral de todas as empresas
  const [todosFechamentos, setTodosFechamentos] = useState<FechamentoCompetenciaRecord[]>([])

  // Modais
  const [isAprovarOpen, setIsAprovarOpen] = useState(false)
  const [isReabrirOpen, setIsReabrirOpen] = useState(false)
  const [obsAprovacao, setObsAprovacao] = useState('')
  const [motivoReabertura, setMotivoReabertura] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Permissões:
  // Administrador pode tudo (aprovar + reabrir)
  // Contador pode aprovar fechamento (não pode reabrir se não for admin)
  // Auxiliar / Consultor / Cliente não aprovam nem reabrem
  const isAdmin = member?.perfil === 'administrador'
  const isContador = member?.perfil === 'contador'
  const canAprovar = isAdmin || isContador
  const canReabrir = isAdmin

  // 1. Carregar Empresas
  useEffect(() => {
    if (!tenant?.id) return
    const fetchEmpresas = async () => {
      try {
        const emps = await empresasService.list(tenant.id)
        setEmpresas(emps)
        if (emps.length > 0 && !selectedEmpresaId) {
          setSelectedEmpresaId(emps[0].id)
        }
      } catch (err) {
        console.error('Erro ao carregar empresas:', err)
      }
    }
    void fetchEmpresas()
  }, [tenant?.id, selectedEmpresaId])

  // 2. Carregar Checklist e Fechamento da Empresa + Competência
  const loadDadosFechamento = useCallback(async () => {
    if (!tenant?.id || !selectedEmpresaId || !selectedCompetencia) return
    setLoading(true)
    try {
      const [resChecklist, dicas, listGeral] = await Promise.all([
        fechoMensalService.inicializarOuObterChecklist(
          tenant.id,
          selectedEmpresaId,
          selectedCompetencia,
        ),
        fechoMensalService.verificarStatusAutomatico(
          tenant.id,
          selectedEmpresaId,
          selectedCompetencia,
        ),
        fechoMensalService.listFechamentos(tenant.id, selectedCompetencia),
      ])

      setFechamento(resChecklist.fechamento)
      setChecklistItens(resChecklist.itens)
      setDicasAutomaticas(dicas)
      setTodosFechamentos(listGeral)
    } catch (err) {
      console.error('Erro ao carregar fecho mensal:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível buscar as informações de fechamento.',
      })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, selectedEmpresaId, selectedCompetencia, toast])

  useEffect(() => {
    void loadDadosFechamento()
  }, [loadDadosFechamento])

  // Itens concluídos
  const itensConcluidos = useMemo(
    () => checklistItens.filter((i) => i.concluido).length,
    [checklistItens],
  )
  const itensTotal = checklistItens.length
  const todosObrigatoriosConcluidos = useMemo(() => {
    const obrigatorios = checklistItens.filter((i) => i.obrigatorio)
    return obrigatorios.length > 0 && obrigatorios.every((i) => i.concluido)
  }, [checklistItens])

  const percentualConclusao = itensTotal > 0 ? Math.round((itensConcluidos / itensTotal) * 100) : 0

  // Marcar/Desmarcar Item Manualmente
  const handleToggleItem = async (item: FechamentoChecklistItemRecord) => {
    if (fechamento?.status === 'fechado') {
      toast({
        variant: 'destructive',
        title: 'Competência Fechada',
        description: 'Reabra a competência para alterar os itens do fechamento.',
      })
      return
    }

    try {
      const novoStatus = !item.concluido
      const updated = await fechoMensalService.toggleChecklistItem(item.id, novoStatus, user?.id)

      setChecklistItens((prev) => prev.map((i) => (i.id === item.id ? updated : i)))

      toast({
        title: novoStatus ? 'Item concluído' : 'Item reaberto',
        description: `${item.titulo}`,
      })
    } catch (err) {
      console.error('Erro ao atualizar item:', err)
    }
  }

  // Aprovar Fechamento
  const handleAprovarFechamento = async () => {
    if (!fechamento || !user?.id) return
    setActionLoading(true)
    try {
      const updated = await fechoMensalService.aprovarFechamento(
        fechamento.id,
        user.id,
        obsAprovacao,
      )
      setFechamento(updated)
      setIsAprovarOpen(false)
      toast({
        title: 'Competência Fechada com Sucesso!',
        description: `A competência ${selectedCompetencia} foi oficialmente encerrada e bloqueada para alterações.`,
      })
      void loadDadosFechamento()
    } catch (err: any) {
      console.error('Erro ao aprovar fechamento:', err)
      toast({
        variant: 'destructive',
        title: 'Erro na aprovação',
        description: err?.message || 'Falha ao encerrar a competência.',
      })
    } finally {
      setActionLoading(false)
    }
  }

  // Reabrir Competência
  const handleReabrirCompetencia = async () => {
    if (!fechamento || !user?.id || !motivoReabertura.trim()) {
      toast({
        variant: 'destructive',
        title: 'Motivo obrigatório',
        description: 'Informe a justificativa para a reabertura da competência na auditoria.',
      })
      return
    }
    setActionLoading(true)
    try {
      const updated = await fechoMensalService.reabrirCompetencia(
        fechamento.id,
        user.id,
        motivoReabertura,
      )
      setFechamento(updated)
      setIsReabrirOpen(false)
      setMotivoReabertura('')
      toast({
        title: 'Competência Reaberta!',
        description: `A competência ${selectedCompetencia} agora permite edições e ajustes contábeis.`,
      })
      void loadDadosFechamento()
    } catch (err: any) {
      console.error('Erro ao reabrir competência:', err)
      toast({
        variant: 'destructive',
        title: 'Erro na reabertura',
        description: err?.message || 'Falha ao reabrir a competência.',
      })
    } finally {
      setActionLoading(false)
    }
  }

  const activeEmpresa = empresas.find((e) => e.id === selectedEmpresaId)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-[#1A2333]">
              Fecho Mensal & Checklist
            </h2>
            <Badge className="bg-[#0FA3A3] text-white text-[11px] font-semibold">Oficial</Badge>
          </div>
          <p className="text-xs text-[#64748B]">
            Encerramento contábil por competência com checklist estruturado, checagens automáticas e
            bloqueio de lançamentos
          </p>
        </div>

        {/* Status e Ações de Fechamento */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Botão Atalho: Perguntar ao Rumo Agent o que falta */}
          <Button
            onClick={() => {
              const empresaNome =
                activeEmpresa?.nome_fantasia || activeEmpresa?.razao_social || 'a empresa'
              const pergunta = `O que falta para fechar a competência ${selectedCompetencia} da empresa ${empresaNome}?`
              navigate(`/rumo-agent?q=${encodeURIComponent(pergunta)}`)
            }}
            variant="outline"
            className="gap-2 rounded-xl text-xs font-semibold h-10 border-[#0FA3A3] text-[#0FA3A3] hover:bg-teal-50 shadow-xs"
            title="Abrir Rumo Agent com diagnóstico inteligente desta competência"
          >
            <Bot className="h-4 w-4 text-[#0FA3A3]" />
            <span>Perguntar ao Rumo Agent o que falta</span>
          </Button>

          {fechamento?.status === 'fechado' ? (
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-100 text-[#16A34A] border-emerald-300 text-xs py-1 px-3 flex items-center gap-1.5 font-bold">
                <Lock className="h-3.5 w-3.5" />
                <span>Competência Fechada</span>
              </Badge>

              {canReabrir && (
                <Button
                  onClick={() => setIsReabrirOpen(true)}
                  variant="outline"
                  className="gap-2 rounded-xl text-xs font-semibold h-10 border-[#EF4444] text-[#EF4444] hover:bg-red-50 shadow-xs"
                >
                  <Unlock className="h-4 w-4" />
                  <span>Reabrir Competência</span>
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-100 text-[#D97706] border-amber-300 text-xs py-1 px-3 flex items-center gap-1.5 font-bold">
                <Clock className="h-3.5 w-3.5" />
                <span>Em Andamento ({percentualConclusao}%)</span>
              </Badge>

              {canAprovar && (
                <Button
                  onClick={() => setIsAprovarOpen(true)}
                  disabled={!todosObrigatoriosConcluidos}
                  className={cn(
                    'gap-2 rounded-xl text-xs font-semibold h-10 shadow-xs',
                    todosObrigatoriosConcluidos
                      ? 'bg-[#16A34A] text-white hover:bg-emerald-700'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed',
                  )}
                  title={
                    !todosObrigatoriosConcluidos
                      ? 'Conclua todos os itens obrigatórios do checklist para aprovar o fechamento'
                      : undefined
                  }
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Aprovar Fechamento Oficial</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Seletor de Empresa e Competência */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Empresa */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Empresa / Cliente *
              </label>
              <Select value={selectedEmpresaId} onValueChange={setSelectedEmpresaId}>
                <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0] font-semibold">
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome_fantasia || e.razao_social} ({e.cnpj})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Competência */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Competência de Fechamento *
              </label>
              <Select value={selectedCompetencia} onValueChange={setSelectedCompetencia}>
                <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0] font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="08/2026">08/2026 (Agosto 2026)</SelectItem>
                  <SelectItem value="09/2026">09/2026 (Setembro 2026)</SelectItem>
                  <SelectItem value="10/2026">10/2026 (Outubro 2026)</SelectItem>
                  <SelectItem value="11/2026">11/2026 (Novembro 2026)</SelectItem>
                  <SelectItem value="12/2026">12/2026 (Dezembro 2026)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Barra de Progresso do Fechamento */}
            <div className="space-y-1.5 flex flex-col justify-center">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-[#64748B]">Progresso do Checklist</span>
                <span className="text-[#1A2333]">
                  {itensConcluidos} de {itensTotal} concluídos ({percentualConclusao}%)
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-500',
                    percentualConclusao === 100
                      ? 'bg-[#16A34A]'
                      : percentualConclusao >= 50
                        ? 'bg-[#0FA3A3]'
                        : 'bg-[#F59E0B]',
                  )}
                  style={{ width: `${percentualConclusao}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card Informativo de Bloqueio se Fechada */}
      {fechamento?.status === 'fechado' && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs text-emerald-900 flex items-start gap-3 shadow-2xs">
          <ShieldCheck className="h-5 w-5 text-[#16A34A] shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <p className="font-bold text-sm text-[#16A34A]">
              Competência {selectedCompetencia} Oficialmente Encerrada
            </p>
            <p className="text-[#64748B]">
              Aprovado por{' '}
              <span className="font-semibold text-[#1A2333]">
                {fechamento.expand?.fechado_por?.name || 'Contador Responsável'}
              </span>{' '}
              em{' '}
              {fechamento.data_fechamento
                ? new Date(fechamento.data_fechamento).toLocaleString('pt-BR')
                : 'Data não informada'}
              . Nenhum novo lançamento ou alteração contábil é permitida para esta empresa neste
              mês.
            </p>
            {fechamento.observacoes && (
              <p className="text-[11px] text-[#1A2333] font-medium pt-0.5 italic">
                &quot;{fechamento.observacoes}&quot;
              </p>
            )}
          </div>
        </div>
      )}

      {/* Lista do Checklist */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-[#E2E8F0] py-4 px-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-[#1A2333]">
                Itens do Checklist de Encerramento
              </CardTitle>
              <CardDescription className="text-xs text-[#64748B]">
                Clique nas caixas para marcar a conclusão manual ou confira a verificação em tempo
                real
              </CardDescription>
            </div>
            <Button
              onClick={loadDadosFechamento}
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs text-[#0FA3A3]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Atualizar Verificações</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 divide-y divide-[#E2E8F0]">
          {loading ? (
            <div className="py-12 text-center text-xs text-[#94A3B8]">
              Carregando checklist de fechamento...
            </div>
          ) : checklistItens.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#94A3B8]">
              Nenhum item configurado para este fechamento.
            </div>
          ) : (
            checklistItens.map((item) => {
              const dica = dicasAutomaticas[item.codigo_item]

              return (
                <div
                  key={item.id}
                  className={cn(
                    'p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors',
                    item.concluido ? 'bg-emerald-50/20' : 'hover:bg-slate-50/60',
                  )}
                >
                  {/* Left: Checkbox + Título + Descrição */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <button
                      type="button"
                      disabled={fechamento?.status === 'fechado'}
                      onClick={() => handleToggleItem(item)}
                      className={cn(
                        'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-all focus:outline-hidden',
                        item.concluido
                          ? 'border-[#16A34A] bg-[#16A34A] text-white shadow-xs'
                          : 'border-slate-300 bg-white hover:border-[#0FA3A3]',
                        fechamento?.status === 'fechado' && 'opacity-60 cursor-not-allowed',
                      )}
                    >
                      {item.concluido && <CheckCircle2 className="h-4 w-4" />}
                    </button>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            'text-sm font-bold',
                            item.concluido ? 'text-[#16A34A] line-through' : 'text-[#1A2333]',
                          )}
                        >
                          {item.titulo}
                        </span>
                        {item.obrigatorio && (
                          <Badge
                            variant="outline"
                            className="text-[9px] font-bold text-red-600 border-red-200 uppercase tracking-wider"
                          >
                            Obrigatório
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-[#64748B]">{item.descricao}</p>

                      {/* Info de quem concluiu e quando */}
                      {item.concluido && (
                        <p className="text-[11px] text-emerald-700 font-medium pt-0.5">
                          ✔ Concluído por {item.expand?.responsavel?.name || user?.name || 'Equipe'}{' '}
                          em{' '}
                          {item.concluido_em
                            ? new Date(item.concluido_em).toLocaleDateString('pt-BR')
                            : 'Hoje'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Dica / Estado Automático do Sistema */}
                  <div className="sm:text-right shrink-0">
                    {dica ? (
                      <div
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border',
                          dica.status === 'ok'
                            ? 'bg-emerald-50 text-[#16A34A] border-emerald-200'
                            : dica.status === 'alerta'
                              ? 'bg-amber-50 text-[#D97706] border-amber-200'
                              : 'bg-slate-50 text-[#64748B] border-slate-200',
                        )}
                      >
                        <Sparkles className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-[11px]">{dica.detalhe}</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#94A3B8]">Checagem manual</span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Visão Geral de Todas as Empresas para a Competência */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-[#E2E8F0] py-4 px-6">
          <CardTitle className="text-base font-bold text-[#1A2333]">
            Visão Geral do Fechamento na Competência {selectedCompetencia}
          </CardTitle>
          <CardDescription className="text-xs text-[#64748B]">
            Acompanhamento do status de encerramento em todas as empresas atendidas pelo escritório
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Empresa / Razão Social</th>
                  <th className="py-3 px-4">CNPJ</th>
                  <th className="py-3 px-4">Competência</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Encerramento</th>
                  <th className="py-3 px-4 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {empresas.map((emp) => {
                  const fechoEmp = todosFechamentos.find((f) => f.empresa === emp.id)
                  const isFechado = fechoEmp?.status === 'fechado'
                  const isEmAndamento = fechoEmp?.status === 'em_andamento'

                  return (
                    <tr
                      key={emp.id}
                      className={cn(
                        'hover:bg-slate-50/80 transition-colors',
                        selectedEmpresaId === emp.id && 'bg-teal-50/30',
                      )}
                    >
                      <td className="py-3.5 px-4 font-semibold text-[#1A2333]">
                        {emp.nome_fantasia || emp.razao_social}
                      </td>
                      <td className="py-3.5 px-4 text-[#64748B]">{emp.cnpj}</td>
                      <td className="py-3.5 px-4 font-medium text-[#1A2333]">
                        {selectedCompetencia}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isFechado ? (
                          <Badge className="bg-emerald-100 text-[#16A34A] border-emerald-200 text-[10px] font-bold">
                            Fechada
                          </Badge>
                        ) : isEmAndamento ? (
                          <Badge className="bg-amber-100 text-[#D97706] border-amber-200 text-[10px] font-bold">
                            Em Andamento
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-[#64748B] border-slate-200 text-[10px]">
                            Aberta
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[#64748B]">
                        {fechoEmp?.data_fechamento ? (
                          <span>
                            {new Date(fechoEmp.data_fechamento).toLocaleDateString('pt-BR')} •{' '}
                            {fechoEmp.expand?.fechado_por?.name || 'Contador'}
                          </span>
                        ) : (
                          <span className="text-[#94A3B8]">Pendente</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Button
                          onClick={() => setSelectedEmpresaId(emp.id)}
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-[#0FA3A3] hover:text-[#0C8585] gap-1 font-semibold"
                        >
                          <span>Ver Checklist</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal: Aprovar Fechamento Oficial */}
      <Dialog open={isAprovarOpen} onOpenChange={setIsAprovarOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#16A34A] flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              <span>Aprovar Fechamento Oficial</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Encerramento contábil da competência {selectedCompetencia} para{' '}
              {activeEmpresa?.nome_fantasia || activeEmpresa?.razao_social}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 space-y-1 text-emerald-950">
              <p className="font-bold">Atenção ao Bloqueio Contábil:</p>
              <p>
                Ao aprovar o fechamento, o sistema registrará seu usuário e timestamp oficial. A
                partir deste momento, o hook server-side{' '}
                <span className="font-mono font-bold">
                  bloqueará qualquer inclusão ou alteração
                </span>{' '}
                de lançamentos contábeis nesta competência.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-[#1A2333]">
                Parecer / Observações do Contador
              </label>
              <Textarea
                value={obsAprovacao}
                onChange={(e) => setObsAprovacao(e.target.value)}
                placeholder="Ex: Conciliações e balancete conferidos sem pendências. Fechamento concluído com êxito."
                className="h-24 text-xs rounded-xl"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAprovarOpen(false)}
              className="h-9 text-xs rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAprovarFechamento}
              disabled={actionLoading}
              className="h-9 text-xs rounded-xl bg-[#16A34A] text-white hover:bg-emerald-700"
            >
              {actionLoading ? 'Gravando Fechamento...' : 'Confirmar e Bloquear Competência'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Reabrir Competência Fechada */}
      <Dialog open={isReabrirOpen} onOpenChange={setIsReabrirOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#EF4444] flex items-center gap-2">
              <Unlock className="h-5 w-5" />
              <span>Reabrir Competência Fechada</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Ação restrita a Administradores com registro obrigatório na Trilha de Auditoria
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            <div className="rounded-xl border border-red-200 bg-red-50/70 p-3 space-y-1 text-red-950">
              <p className="font-bold">Aviso de Auditoria e Compliance:</p>
              <p>
                A reabertura liberará temporariamente o lançamento e edição de partidas contábeis na
                competência {selectedCompetencia}. Essa operação ficará gravada no log de auditoria
                com seu usuário, data e motivo.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-[#1A2333]">
                Justificativa Obrigatória da Reabertura *
              </label>
              <Textarea
                value={motivoReabertura}
                onChange={(e) => setMotivoReabertura(e.target.value)}
                placeholder="Ex: Ajuste de conciliação bancária ref. tarifa retida incorretamente."
                className="h-24 text-xs rounded-xl"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsReabrirOpen(false)}
              className="h-9 text-xs rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleReabrirCompetencia}
              disabled={actionLoading || !motivoReabertura.trim()}
              className="h-9 text-xs rounded-xl bg-[#EF4444] text-white hover:bg-red-700"
            >
              {actionLoading ? 'Reabrindo...' : 'Confirmar Reabertura'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

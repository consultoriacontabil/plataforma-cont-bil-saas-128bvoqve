import React, { useState, useEffect } from 'react'
import {
  FileText,
  Share2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  Check,
  X,
  ExternalLink,
  Plus,
  ArrowRight,
  Building2,
  RefreshCw,
  Search,
  Filter,
  Users,
  Briefcase,
  Layers,
  ChevronDown,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import type {
  CompanyOnboardingWorkflowRecord,
  OnboardingChecklistItem,
  StatusOnboardingWorkflow,
} from '@/types'
import { companyOnboardingService } from '@/services/companyOnboarding'
import { GerarLinkPublicoModal } from '@/components/GerarLinkPublicoModal'
import { NovoWorkflowAberturaModal } from '@/components/NovoWorkflowAberturaModal'
import { RecusarDocumentoModal } from '@/components/RecusarDocumentoModal'

interface WorkflowAberturaViewProps {
  tenantId: string
  empresaIdFiltro?: string
  razaoSocialFiltro?: string
}

export function WorkflowAberturaView({
  tenantId,
  empresaIdFiltro,
  razaoSocialFiltro,
}: WorkflowAberturaViewProps) {
  const { user } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [workflows, setWorkflows] = useState<CompanyOnboardingWorkflowRecord[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState<CompanyOnboardingWorkflowRecord | null>(
    null,
  )
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

  // Modais
  const [modalNovoOpen, setModalNovoOpen] = useState(false)
  const [modalLinkOpen, setModalLinkOpen] = useState(false)
  const [recusarItem, setRecusarItem] = useState<{ id: string; titulo: string } | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  // Permissões
  const isCliente = user?.perfil === 'cliente'
  const canManage = user?.perfil === 'administrador' || user?.perfil === 'contador'

  const carregarWorkflows = async () => {
    if (!tenantId) return
    try {
      setLoading(true)
      const list = await companyOnboardingService.list(tenantId)
      setWorkflows(list)
      if (list.length > 0) {
        // Se houver filtro de empresa alvo ou nenhum selecionado, seleciona o primeiro compatível
        if (empresaIdFiltro) {
          const match = list.find((w) => w.empresa_id === empresaIdFiltro)
          setSelectedWorkflow(match || list[0])
        } else if (!selectedWorkflow) {
          setSelectedWorkflow(list[0])
        } else {
          // Atualiza dados do selecionado caso tenha sido alterado
          const match = list.find((w) => w.id === selectedWorkflow.id)
          setSelectedWorkflow(match || list[0])
        }
      } else {
        setSelectedWorkflow(null)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar workflows.'
      toast({
        variant: 'destructive',
        title: 'Erro de carregamento',
        description: msg,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarWorkflows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  // Ações do Contador no Checklist
  const handleAprovarItem = async (itemId: string) => {
    if (!selectedWorkflow || !canManage) return

    try {
      setActionLoadingId(itemId)
      const updated = await companyOnboardingService.aprovarDocumento(
        selectedWorkflow.id,
        itemId,
        user?.id || '',
        tenantId,
      )
      setSelectedWorkflow(updated)
      setWorkflows((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
      toast({
        title: 'Documento aprovado!',
        description: 'O status do documento foi atualizado para aprovado com sucesso.',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao aprovar documento.'
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: msg,
      })
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleConfirmarRecusa = async (motivo: string) => {
    if (!selectedWorkflow || !recusarItem || !canManage) return

    try {
      const updated = await companyOnboardingService.recusarDocumento(
        selectedWorkflow.id,
        recusarItem.id,
        motivo,
        user?.id || '',
        tenantId,
      )
      setSelectedWorkflow(updated)
      setWorkflows((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
      toast({
        title: 'Documento recusado',
        description: 'O cliente receberá o apontamento na página pública para substituição.',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao recusar documento.'
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: msg,
      })
    }
  }

  // Avançar status do workflow
  const handleMudarStatusWf = async (novoStatus: StatusOnboardingWorkflow) => {
    if (!selectedWorkflow || !canManage) return
    try {
      setActionLoadingId('status')
      const updated = await companyOnboardingService.update(
        selectedWorkflow.id,
        { status: novoStatus },
        user?.id || '',
        tenantId,
        `Alteração de status do workflow para: ${novoStatus}`,
      )
      setSelectedWorkflow(updated)
      setWorkflows((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
      toast({
        title: 'Status atualizado',
        description: `O workflow agora está em status: ${novoStatus.replace('_', ' ')}.`,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao mudar status.'
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: msg,
      })
    } finally {
      setActionLoadingId(null)
    }
  }

  // Filtragem
  const workflowsFiltrados = workflows.filter((w) => {
    const matchBusca =
      !searchTerm ||
      w.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.razao_social_pretendida?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchStatus = filtroStatus === 'todos' || w.status === filtroStatus

    return matchBusca && matchStatus
  })

  // Métricas do workflow selecionado
  const checklist = selectedWorkflow?.checklist_docs_json || []
  const enviadosCount = checklist.filter(
    (it) => it.status === 'enviado' || it.status === 'aprovado',
  ).length
  const aprovadosCount = checklist.filter((it) => it.status === 'aprovado').length
  const recusadosCount = checklist.filter((it) => it.status === 'recusado').length
  const pendentesCount = checklist.filter((it) => it.status === 'pendente').length
  const totalCount = checklist.length

  if (isCliente) {
    return (
      <Card className="rounded-2xl border-[#E2E8F0] p-8 text-center bg-white shadow-2xs">
        <p className="text-xs text-[#64748B]">
          A visualização de gestão de workflows é restrita à equipe contábil. Utilize o link
          exclusivo enviado pelo seu contador para envio de documentos.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-[#1A2333] flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-[#0FA3A3]" />
            <span>Workflow de Abertura & Legalização</span>
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Gestão ponta a ponta do checklist documental com link público para autoatendimento do
            cliente.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={carregarWorkflows}
            disabled={loading}
            className="h-9 text-xs rounded-xl border-[#E2E8F0] text-slate-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-[#0FA3A3]' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>

          {canManage && (
            <Button
              type="button"
              size="sm"
              onClick={() => setModalNovoOpen(true)}
              className="h-9 px-4 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs font-semibold gap-1.5 shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Novo Processo de Abertura</span>
            </Button>
          )}
        </div>
      </div>

      {loading && workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3 bg-white rounded-2xl border border-[#E2E8F0]">
          <RefreshCw className="h-8 w-8 animate-spin text-[#0FA3A3]" />
          <p className="text-xs text-[#64748B]">Carregando workflows de abertura...</p>
        </div>
      ) : workflows.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-2 border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-[#0FA3A3] mb-3">
            <Briefcase className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-[#1A2333]">Nenhum workflow de abertura ativo</h3>
          <p className="text-xs text-[#64748B] max-w-md mx-auto mt-1 mb-5">
            Inicie um novo processo de abertura para gerar automaticamente o checklist documental e
            o link público de envio para o cliente.
          </p>
          {canManage && (
            <Button
              type="button"
              onClick={() => setModalNovoOpen(true)}
              className="h-9 px-5 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs font-semibold gap-2 shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Iniciar Primeiro Workflow</span>
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Coluna Esquerda: Lista de Workflows (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs overflow-hidden">
              <CardHeader className="p-4 pb-3 border-b border-[#E2E8F0] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1A2333]">
                    Processos ({workflowsFiltrados.length})
                  </span>
                  <Badge variant="secondary" className="text-[10px] text-slate-600 font-semibold">
                    Multi-tenant
                  </Badge>
                </div>

                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Filtrar por nome ou razão..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 pl-8 text-xs rounded-xl border-[#E2E8F0]"
                  />
                </div>
              </CardHeader>

              <div className="max-h-[620px] overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
                {workflowsFiltrados.map((wf) => {
                  const isSelected = selectedWorkflow?.id === wf.id
                  const docs = wf.checklist_docs_json || []
                  const aprv = docs.filter((d) => d.status === 'aprovado').length
                  const pend = docs.filter((d) => d.status === 'pendente').length

                  return (
                    <div
                      key={wf.id}
                      onClick={() => setSelectedWorkflow(wf)}
                      className={`p-3 rounded-xl cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-teal-50/70 border-teal-300 text-teal-950 shadow-2xs'
                          : 'bg-white hover:bg-slate-50 border-transparent text-[#1A2333]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <p className="text-xs font-bold truncate">
                            {wf.razao_social_pretendida || wf.titulo}
                          </p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                              variant="outline"
                              className="text-[9px] uppercase px-1.5 py-0 border-slate-300 font-bold"
                            >
                              {wf.natureza_juridica || 'SLU'}
                            </Badge>
                            <Badge
                              className={`text-[9px] px-1.5 py-0 font-medium ${
                                wf.status === 'aguardando_cliente'
                                  ? 'bg-amber-100 text-amber-800'
                                  : wf.status === 'em_analise'
                                    ? 'bg-blue-100 text-blue-800'
                                    : wf.status === 'concluido'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {wf.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>

                        {wf.link_ativo ? (
                          <Badge
                            title="Link público ativo"
                            className="bg-emerald-100 text-emerald-800 text-[9px] shrink-0"
                          >
                            Link ON
                          </Badge>
                        ) : (
                          <Badge
                            title="Link revogado"
                            className="bg-rose-100 text-rose-800 text-[9px] shrink-0"
                          >
                            Link OFF
                          </Badge>
                        )}
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[10px] text-[#64748B]">
                        <span>
                          {aprv}/{docs.length} docs aprovados
                        </span>
                        {pend > 0 && (
                          <span className="text-amber-600 font-semibold">{pend} pendentes</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>

          {/* Coluna Direita: Detalhe do Workflow Selecionado (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {selectedWorkflow ? (
              <div className="space-y-4">
                {/* Header do Processo Selecionado */}
                <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
                  <CardHeader className="p-5 pb-4 border-b border-[#E2E8F0]">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className="bg-[#0FA3A3] text-white text-xs font-bold uppercase">
                            {selectedWorkflow.natureza_juridica?.toUpperCase() || 'SLU'}
                          </Badge>
                          <h3 className="text-base font-extrabold text-[#1A2333]">
                            {selectedWorkflow.razao_social_pretendida || selectedWorkflow.titulo}
                          </h3>
                        </div>
                        <p className="text-xs text-[#64748B]">
                          Cliente:{' '}
                          <span className="font-semibold text-slate-800">
                            {selectedWorkflow.cliente_nome || 'Não informado'}
                          </span>{' '}
                          {selectedWorkflow.cliente_telefone &&
                            `(${selectedWorkflow.cliente_telefone})`}
                        </p>
                      </div>

                      {/* Botão de Destaque: Gerar / Ver Link para o Cliente */}
                      <Button
                        type="button"
                        onClick={() => setModalLinkOpen(true)}
                        className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#0B1F3A] to-[#1E3A8A] text-white text-xs font-semibold gap-2 shadow-xs shrink-0 hover:opacity-95"
                      >
                        <Share2 className="h-4 w-4 text-[#0FA3A3]" />
                        <span>Gerar Link para o Cliente</span>
                      </Button>
                    </div>

                    {/* Contadores do Checklist */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-center">
                        <span className="text-[10px] text-[#64748B] block">Total de Itens</span>
                        <span className="text-base font-extrabold text-[#1A2333]">
                          {totalCount}
                        </span>
                      </div>
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 text-center">
                        <span className="text-[10px] text-emerald-800 block">Aprovados</span>
                        <span className="text-base font-extrabold text-emerald-700">
                          {aprovadosCount}
                        </span>
                      </div>
                      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-2.5 text-center">
                        <span className="text-[10px] text-blue-800 block">Em Análise</span>
                        <span className="text-base font-extrabold text-blue-700">
                          {enviadosCount - aprovadosCount}
                        </span>
                      </div>
                      <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-2.5 text-center">
                        <span className="text-[10px] text-rose-800 block">Recusados / Pend.</span>
                        <span className="text-base font-extrabold text-rose-700">
                          {recusadosCount + pendentesCount}
                        </span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 space-y-4">
                    {/* Lista do Checklist com Status e Ações do Contador */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold text-[#1A2333] flex items-center gap-1.5">
                          <FileText className="h-4 w-4 text-[#0FA3A3]" />
                          <span>Checklist Documental & Validação Técnica</span>
                        </h4>
                        <span className="text-[11px] text-[#64748B]">
                          {aprovadosCount} de {totalCount} concluídos
                        </span>
                      </div>

                      <div className="rounded-xl border border-[#E2E8F0] overflow-hidden divide-y divide-slate-100">
                        {checklist.map((item) => {
                          const isAprovado = item.status === 'aprovado'
                          const isEnviado = item.status === 'enviado'
                          const isRecusado = item.status === 'recusado'
                          const isPendente = item.status === 'pendente'
                          const isItemLoading = actionLoadingId === item.id

                          return (
                            <div
                              key={item.id}
                              className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                            >
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-[#1A2333]">
                                    {item.titulo}
                                  </span>
                                  {item.obrigatorio ? (
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] text-rose-700 border-rose-200 bg-rose-50"
                                    >
                                      Obrigatório
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] text-slate-500 border-slate-200"
                                    >
                                      Opcional
                                    </Badge>
                                  )}

                                  {/* Badges de Status */}
                                  {isAprovado && (
                                    <Badge className="bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                                      Aprovado
                                    </Badge>
                                  )}
                                  {isEnviado && (
                                    <Badge className="bg-blue-100 text-blue-800 text-[9px] font-bold">
                                      Enviado pelo Cliente
                                    </Badge>
                                  )}
                                  {isRecusado && (
                                    <Badge className="bg-rose-100 text-rose-800 text-[9px] font-bold">
                                      Recusado (Aguardando Correção)
                                    </Badge>
                                  )}
                                  {isPendente && (
                                    <Badge className="bg-amber-100 text-amber-800 text-[9px] font-bold">
                                      Pendente de Envio
                                    </Badge>
                                  )}
                                </div>

                                {item.detalhe && (
                                  <p className="text-[11px] text-[#64748B]">{item.detalhe}</p>
                                )}

                                {/* Arquivo anexado */}
                                {item.nome_arquivo && (
                                  <div className="flex items-center gap-2 text-[11px] font-mono text-teal-800 bg-teal-50 px-2.5 py-1 rounded-md w-fit border border-teal-100">
                                    <span className="truncate max-w-xs">{item.nome_arquivo}</span>
                                    {item.arquivo_url && (
                                      <a
                                        href={item.arquivo_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#0FA3A3] hover:underline flex items-center gap-0.5 ml-1 font-sans text-[10px]"
                                      >
                                        <Eye className="h-3 w-3" /> Ver Arquivo
                                      </a>
                                    )}
                                  </div>
                                )}

                                {isRecusado && item.motivo_recusa && (
                                  <p className="text-[10px] text-rose-700 font-medium">
                                    Motivo da recusa: {item.motivo_recusa}
                                  </p>
                                )}
                              </div>

                              {/* Ações do Contador: Aprovar / Recusar */}
                              {canManage && (
                                <div className="shrink-0 flex items-center gap-1.5">
                                  {isAprovado ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      disabled={isItemLoading}
                                      onClick={() =>
                                        setRecusarItem({ id: item.id, titulo: item.titulo })
                                      }
                                      className="h-8 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg px-2"
                                    >
                                      Reabrir / Recusar
                                    </Button>
                                  ) : (
                                    <>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={isItemLoading}
                                        onClick={() =>
                                          setRecusarItem({ id: item.id, titulo: item.titulo })
                                        }
                                        className="h-8 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 rounded-lg px-2.5 gap-1"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                        <span>Recusar</span>
                                      </Button>

                                      <Button
                                        type="button"
                                        size="sm"
                                        disabled={isItemLoading}
                                        onClick={() => handleAprovarItem(item.id)}
                                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 gap-1 shadow-xs"
                                      >
                                        {isItemLoading ? (
                                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Check className="h-3.5 w-3.5" />
                                        )}
                                        <span>Aprovar</span>
                                      </Button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Seção de Dados Preliminares enviados pelo cliente */}
                    {selectedWorkflow.dados_preliminares_json && (
                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        <h4 className="text-xs font-bold text-[#1A2333] flex items-center gap-1.5">
                          <Users className="h-4 w-4 text-[#0FA3A3]" />
                          <span>Dados Fornecidos pelo Cliente via Link</span>
                        </h4>

                        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2 text-xs">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <span className="text-[#64748B] block text-[10px]">
                                Razão Social:
                              </span>
                              <span className="font-semibold">
                                {selectedWorkflow.dados_preliminares_json.razao_social_pretendida ||
                                  '—'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[#64748B] block text-[10px]">
                                Nome Fantasia:
                              </span>
                              <span className="font-semibold">
                                {selectedWorkflow.dados_preliminares_json
                                  .nome_fantasia_pretendido || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[#64748B] block text-[10px]">
                                Capital Social:
                              </span>
                              <span className="font-semibold">
                                {selectedWorkflow.dados_preliminares_json.capital_social_pretendido
                                  ? `R$ ${selectedWorkflow.dados_preliminares_json.capital_social_pretendido.toLocaleString('pt-BR')}`
                                  : '—'}
                              </span>
                            </div>
                          </div>

                          {/* Sócios informados */}
                          {selectedWorkflow.dados_preliminares_json.socios &&
                            selectedWorkflow.dados_preliminares_json.socios.length > 0 && (
                              <div className="pt-2 border-t border-slate-200/60">
                                <span className="text-[10px] text-[#64748B] block mb-1">
                                  Sócios Declarados:
                                </span>
                                <div className="space-y-1">
                                  {selectedWorkflow.dados_preliminares_json.socios.map((soc, i) => (
                                    <div
                                      key={i}
                                      className="flex items-center justify-between text-[11px] bg-white p-2 rounded-lg border border-slate-200"
                                    >
                                      <span className="font-medium text-[#1A2333]">
                                        {soc.nome} ({soc.cpf || 'Sem CPF'})
                                      </span>
                                      <Badge variant="secondary" className="text-[10px] font-bold">
                                        {soc.percentual_cotas}%
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="rounded-2xl border-[#E2E8F0] p-12 text-center bg-white">
                <p className="text-xs text-[#64748B]">
                  Selecione um processo de abertura na lista lateral para gerenciar os documentos e
                  o link público.
                </p>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Modais */}
      <GerarLinkPublicoModal
        open={modalLinkOpen}
        onOpenChange={setModalLinkOpen}
        workflow={selectedWorkflow}
        onWorkflowUpdated={(updated) => {
          setSelectedWorkflow(updated)
          setWorkflows((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
        }}
      />

      <NovoWorkflowAberturaModal
        open={modalNovoOpen}
        onOpenChange={setModalNovoOpen}
        tenantId={tenantId}
        empresaIdPadrao={empresaIdFiltro}
        razaoSocialPadrao={razaoSocialFiltro}
        onCreated={(novo) => {
          setWorkflows((prev) => [novo, ...prev])
          setSelectedWorkflow(novo)
          // Abre imediatamente o modal de link público para o contador já poder copiar
          setModalLinkOpen(true)
        }}
      />

      <RecusarDocumentoModal
        open={!!recusarItem}
        onOpenChange={(open) => !open && setRecusarItem(null)}
        itemTitulo={recusarItem?.titulo || ''}
        onConfirm={handleConfirmarRecusa}
      />
    </div>
  )
}

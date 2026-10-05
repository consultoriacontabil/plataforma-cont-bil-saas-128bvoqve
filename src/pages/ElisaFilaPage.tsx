import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Bot,
  PlayCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Building2,
  Filter,
  Search,
  RotateCw,
  ExternalLink,
  SlidersHorizontal,
  ArrowRight,
  Sparkles,
  Info,
  Calendar,
  Layers,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  elisaOpsService,
  type ElisaJobRecord,
  type ProcessoPendenciaRecord,
  type PrioridadeOperacional,
} from '@/services/elisaOpsService'
import { empresasService } from '@/services/empresas'
import { useRealtime } from '@/hooks/use-realtime'
import type { Empresa } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { maskCnpj, formatDatePtBr } from '@/lib/formatters'

export default function ElisaFilaPage() {
  const { tenant, user, member } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTabParam = searchParams.get('tab') || 'fila'

  // Estados principais
  const [jobs, setJobs] = useState<ElisaJobRecord[]>([])
  const [pendencias, setPendencias] = useState<ProcessoPendenciaRecord[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroArea, setFiltroArea] = useState<string>('todas')
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>('todas')
  const [filtroEmpresaId, setFiltroEmpresaId] = useState<string>('todas')
  const [buscaTexto, setBuscaTexto] = useState<string>('')

  // Modal Modo Humano / Resolução de Pendência
  const [pendenciaSelecionada, setPendenciaSelecionada] = useState<ProcessoPendenciaRecord | null>(
    null,
  )
  const [decisaoModalAberta, setDecisaoModalAberta] = useState(false)
  const [decisaoTipo, setDecisaoTipo] = useState<
    'APROVAR' | 'REJEITAR' | 'CORRIGIR' | 'DEVOLVER_ELISA'
  >('APROVAR')
  const [resolucaoTexto, setResolucaoTexto] = useState('')
  const [salvandoDecisao, setSalvandoDecisao] = useState(false)

  // Executando Job
  const [executandoJobId, setExecutandoJobId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!tenant?.id) return
    try {
      const [jobsRes, pendRes, empRes] = await Promise.all([
        elisaOpsService.listJobs(tenant.id, {
          status: filtroStatus,
          area: filtroArea,
          prioridade: filtroPrioridade,
          empresaId: filtroEmpresaId,
        }),
        elisaOpsService.listPendencias(tenant.id),
        empresasService.list(tenant.id),
      ])
      setJobs(jobsRes)
      setPendencias(pendRes)
      setEmpresas(empRes)
    } catch (err) {
      console.error('Erro ao carregar Fila da ELISA:', err)
      toast({
        variant: 'destructive',
        title: 'Erro de carregamento',
        description: 'Falha ao sincronizar fila operacional da ELISA.',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [tenant?.id, filtroStatus, filtroArea, filtroPrioridade, filtroEmpresaId, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtime('elisa_jobs', () => loadData())
  useRealtime('processo_pendencias', () => loadData())
  useRealtime('processos_operacionais', () => loadData())

  // Filtragem de texto no cliente
  const jobsFiltrados = useMemo(() => {
    if (!buscaTexto.trim()) return jobs
    const t = buscaTexto.toLowerCase()
    return jobs.filter((j) => {
      const empNome =
        j.expand?.empresa_id?.razao_social || j.expand?.empresa_id?.nome_fantasia || ''
      const empCnpj = j.expand?.empresa_id?.cnpj || ''
      return (
        j.job_codigo.toLowerCase().includes(t) ||
        j.processo_nome.toLowerCase().includes(t) ||
        j.etapa_atual_nome.toLowerCase().includes(t) ||
        j.proxima_acao.toLowerCase().includes(t) ||
        empNome.toLowerCase().includes(t) ||
        empCnpj.includes(t)
      )
    })
  }, [jobs, buscaTexto])

  // Disparo de Execução da Próxima Ação
  const handleExecutarJob = async (job: ElisaJobRecord) => {
    if (!tenant?.id) return
    setExecutandoJobId(job.id)
    toast({
      title: '🤖 ELISA em Execução',
      description: `Executando: ${job.proxima_acao}...`,
    })

    try {
      const res = await elisaOpsService.executarProximaAcaoElisa({
        tenantId: tenant.id,
        processoId: job.processo_id,
        etapaId: job.etapa_id,
        jobId: job.id,
        empresaId: job.empresa_id,
      })

      if (res.sucesso) {
        toast({
          title: 'Etapa Executada com Sucesso!',
          description: res.mensagem,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Ação Retida (Segurança)',
          description: res.mensagem,
        })
      }
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro de Execução',
        description: String(err),
      })
    } finally {
      setExecutandoJobId(null)
    }
  }

  // Confirmar Decisão no Modo Humano
  const handleConfirmarDecisao = async () => {
    if (!pendenciaSelecionada) return
    if (!resolucaoTexto.trim()) {
      toast({
        variant: 'destructive',
        title: 'Justificativa Obrigatória',
        description: 'Informe a descrição da decisão tomada pelo contador.',
      })
      return
    }

    setSalvandoDecisao(true)
    try {
      await elisaOpsService.resolverPendencia(
        pendenciaSelecionada.id,
        decisaoTipo,
        resolucaoTexto,
        user?.id,
      )
      toast({
        title: 'Decisão Registrada com Sucesso!',
        description: `Pendência atualizada como ${decisaoTipo}. O processo foi atualizado.`,
      })
      setDecisaoModalAberta(false)
      setPendenciaSelecionada(null)
      setResolucaoTexto('')
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao resolver',
        description: String(err),
      })
    } finally {
      setSalvandoDecisao(false)
    }
  }

  const renderBadgeAutonomia = (nivel: string) => {
    switch (nivel) {
      case 'nivel_1_automatico':
        return (
          <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
            Nível 1 • Automático
          </Badge>
        )
      case 'nivel_2_supervisionado':
        return (
          <Badge className="bg-blue-600 text-white text-[10px] font-bold">
            Nível 2 • Supervisionado
          </Badge>
        )
      case 'nivel_3_aprovacao_obrigatoria':
        return (
          <Badge className="bg-amber-600 text-white text-[10px] font-bold">
            Nível 3 • Aprovação Obrigatória
          </Badge>
        )
      default:
        return <Badge variant="outline">{nivel}</Badge>
    }
  }

  const renderBadgePrioridade = (prio: PrioridadeOperacional) => {
    switch (prio) {
      case 'urgente':
        return (
          <Badge className="bg-red-600 text-white text-[10px] uppercase font-extrabold animate-pulse">
            Urgente
          </Badge>
        )
      case 'alta':
        return (
          <Badge className="bg-amber-500 text-white text-[10px] uppercase font-bold">Alta</Badge>
        )
      case 'media':
        return <Badge className="bg-slate-600 text-white text-[10px] uppercase">Média</Badge>
      case 'baixa':
        return (
          <Badge variant="outline" className="text-slate-500 text-[10px] uppercase">
            Baixa
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Cabeçalho Determinístico */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-[#0FA3A3] text-white text-xs font-bold">FILA DA ELISA</Badge>
            <Badge variant="outline" className="text-slate-600 text-xs">
              Orquestração Determinística de Tarefas
            </Badge>
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs flex items-center gap-1">
              <Bot className="h-3 w-3" />
              <span>Agente de Interface Visual Ativo</span>
            </Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#1A2333] tracking-tight">
            Fila Operacional da ELISA
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            A ELISA não navega livremente: recebe tarefa estruturada e executa a próxima ação
            definida pelo processo contábil.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRefreshing(true)
              loadData()
            }}
            disabled={refreshing}
            className="h-9 text-xs border-slate-300 gap-1.5"
          >
            <RotateCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Atualizar Fila</span>
          </Button>

          <Link to="/processos">
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs text-[#0FA3A3] border-teal-300 bg-teal-50/50"
            >
              Biblioteca de SOPs
            </Button>
          </Link>

          <Link to="/pop-treinamento">
            <Button size="sm" className="h-9 text-xs bg-slate-800 hover:bg-slate-900 text-white">
              Consultar POPs Oficiais
            </Button>
          </Link>
        </div>
      </div>

      {/* Regra de Ordenação em Destaque */}
      <div className="rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50/70 via-white to-slate-50 p-3.5 text-xs text-slate-700 shadow-2xs flex items-center gap-3">
        <Info className="h-5 w-5 text-[#0FA3A3] shrink-0" />
        <div className="leading-relaxed">
          <strong>Critério Rigoroso de Ordenação da Fila:</strong> 1. Urgência • 2. Prazo de
          vencimento • 3. Prioridade operacional • 4. Dependências de etapas • 5. Ordem do POP.
        </div>
      </div>

      {/* Abas: Fila de Jobs & Modo Humano (Pendências) */}
      <Tabs
        value={activeTabParam}
        onValueChange={(val) => setSearchParams({ tab: val })}
        className="space-y-4"
      >
        <TabsList className="bg-slate-100 p-1 border border-slate-200">
          <TabsTrigger value="fila" className="text-xs font-semibold gap-2">
            <Bot className="h-4 w-4 text-[#0FA3A3]" />
            <span>Fila Operacional ({jobs.length})</span>
          </TabsTrigger>
          <TabsTrigger value="pendencias" className="text-xs font-semibold gap-2">
            <AlertTriangle
              className={`h-4 w-4 ${pendencias.length > 0 ? 'text-amber-500' : 'text-slate-400'}`}
            />
            <span>
              Modo Humano ({pendencias.filter((p) => p.status === 'aberta').length} Abertas)
            </span>
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: FILA OPERACIONAL */}
        <TabsContent value="fila" className="space-y-4">
          {/* Barra de Filtros Padronizada */}
          <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-2xs">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por job, empresa, CNPJ..."
                  value={buscaTexto}
                  onChange={(e) => setBuscaTexto(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <div>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Status da Fila" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Status</SelectItem>
                    <SelectItem value="ENFILEIRADO">ENFILEIRADO</SelectItem>
                    <SelectItem value="EM_EXECUCAO">EM EXECUÇÃO</SelectItem>
                    <SelectItem value="AGUARDANDO_APROVACAO">AGUARDANDO APROVAÇÃO</SelectItem>
                    <SelectItem value="AGUARDANDO_CLIENTE">AGUARDANDO CLIENTE</SelectItem>
                    <SelectItem value="CONCLUIDO">CONCLUÍDO</SelectItem>
                    <SelectItem value="ERRO">COM ERRO</SelectItem>
                    <SelectItem value="BLOQUEADO">BLOQUEADO</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select value={filtroArea} onValueChange={setFiltroArea}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Área do Processo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as Áreas</SelectItem>
                    <SelectItem value="contabil">Contábil</SelectItem>
                    <SelectItem value="fiscal">Fiscal</SelectItem>
                    <SelectItem value="pessoal">Pessoal (DP)</SelectItem>
                    <SelectItem value="societario">Societário</SelectItem>
                    <SelectItem value="atendimento">Atendimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas Prioridades</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="baixa">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select value={filtroEmpresaId} onValueChange={setFiltroEmpresaId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Filtrar por Empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as Empresas</SelectItem>
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.nome_fantasia || emp.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* TABELA PADRONIZADA E DETERMINÍSTICA DA FILA */}
          <Card className="rounded-2xl border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-3">Job ID / Competência</th>
                    <th className="py-3.5 px-3">Cliente / CNPJ</th>
                    <th className="py-3.5 px-3">Processo / POP</th>
                    <th className="py-3.5 px-3">Etapa Atual</th>
                    <th className="py-3.5 px-3">Próxima Ação da ELISA</th>
                    <th className="py-3.5 px-3">Prioridade / Prazo</th>
                    <th className="py-3.5 px-3">Status</th>
                    <th className="py-3.5 px-3">Autonomia</th>
                    <th className="py-3.5 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {jobsFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500">
                        <Bot className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                        <span className="font-semibold text-slate-700 text-sm">
                          Nenhum job na fila com os filtros aplicados
                        </span>
                        <p className="text-xs text-slate-400 mt-1">
                          Inicie um processo a partir da biblioteca de SOPs para enfileirar novas
                          etapas.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    jobsFiltrados.map((job) => {
                      const empNome =
                        job.expand?.empresa_id?.nome_fantasia ||
                        job.expand?.empresa_id?.razao_social ||
                        'Empresa'
                      const empCnpj = job.expand?.empresa_id?.cnpj
                        ? maskCnpj(job.expand.empresa_id.cnpj)
                        : '—'
                      const isExecutando = executandoJobId === job.id

                      return (
                        <tr key={job.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* 1. Job ID + Competência */}
                          <td className="py-3 px-3 align-top">
                            <span className="font-mono font-bold text-slate-900 block">
                              {job.job_codigo}
                            </span>
                            <span className="text-[11px] text-[#0FA3A3] font-semibold">
                              Comp: {job.competencia}
                            </span>
                          </td>

                          {/* 2. Cliente / CNPJ */}
                          <td className="py-3 px-3 align-top max-w-[200px]">
                            <span
                              className="font-bold text-slate-900 block truncate"
                              title={empNome}
                            >
                              {empNome}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500">{empCnpj}</span>
                          </td>

                          {/* 3. Processo / POP */}
                          <td className="py-3 px-3 align-top">
                            <span className="font-semibold text-slate-800 block">
                              {job.processo_nome}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] text-slate-600 bg-slate-50"
                            >
                              {job.pop_relacionado || 'POP-04'} • {job.area}
                            </Badge>
                          </td>

                          {/* 4. Etapa Atual */}
                          <td className="py-3 px-3 align-top">
                            <span className="font-bold text-slate-800 block">
                              {job.etapa_atual_nome}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Agente:{' '}
                              <strong className="text-slate-700">{job.agente_responsavel}</strong>
                            </span>
                          </td>

                          {/* 5. Próxima Ação */}
                          <td className="py-3 px-3 align-top max-w-[260px]">
                            <p className="text-[11px] text-slate-700 leading-snug line-clamp-2">
                              {job.proxima_acao}
                            </p>
                            {job.resultado && (
                              <p
                                className="text-[10px] text-emerald-700 mt-0.5 truncate"
                                title={job.resultado}
                              >
                                ✓ {job.resultado}
                              </p>
                            )}
                          </td>

                          {/* 6. Prioridade / Prazo */}
                          <td className="py-3 px-3 align-top whitespace-nowrap">
                            <div className="mb-1">{renderBadgePrioridade(job.prioridade)}</div>
                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-slate-400" />
                              {job.prazo ? formatDatePtBr(job.prazo) : 'Sem prazo'}
                            </span>
                          </td>

                          {/* 7. Status */}
                          <td className="py-3 px-3 align-top">
                            <Badge
                              className={`text-[10px] font-bold ${
                                job.status === 'CONCLUIDO'
                                  ? 'bg-emerald-600 text-white'
                                  : job.status === 'EM_EXECUCAO'
                                    ? 'bg-blue-600 text-white'
                                    : job.status === 'AGUARDANDO_APROVACAO'
                                      ? 'bg-amber-500 text-white animate-pulse'
                                      : job.status === 'ERRO' || job.status === 'BLOQUEADO'
                                        ? 'bg-red-600 text-white'
                                        : 'bg-slate-700 text-white'
                              }`}
                            >
                              {job.status.replace('_', ' ')}
                            </Badge>
                          </td>

                          {/* 8. Autonomia */}
                          <td className="py-3 px-3 align-top">
                            {renderBadgeAutonomia(job.nivel_autonomia)}
                          </td>

                          {/* 9. Ações */}
                          <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link to={`/processos/${job.processo_id}`}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-slate-600 hover:text-slate-900"
                                >
                                  Ver Processo
                                </Button>
                              </Link>

                              {job.status !== 'CONCLUIDO' && (
                                <Button
                                  size="sm"
                                  disabled={isExecutando}
                                  onClick={() => handleExecutarJob(job)}
                                  className="h-7 text-xs bg-[#0FA3A3] hover:bg-[#0c8282] text-white gap-1 font-semibold"
                                >
                                  <PlayCircle
                                    className={`h-3.5 w-3.5 ${isExecutando ? 'animate-spin' : ''}`}
                                  />
                                  <span>{isExecutando ? 'Executando...' : 'Executar'}</span>
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ABA 2: MODO HUMANO (INTERVENÇÃO DO CONTADOR) */}
        <TabsContent value="pendencias" className="space-y-4">
          <Card className="rounded-2xl border-amber-200 bg-amber-50/50 p-4 shadow-2xs">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold text-amber-950">
                  Painel de Supervisão e Decisão Humana
                </h3>
                <p className="text-xs text-amber-900/80 leading-relaxed mt-0.5">
                  Toda vez que a ELISA encontra uma inconsistência (ex.: lançamento bancário sem
                  classificação, divergência de saldo ou etapa que exige aprovação legal de nível
                  3), a etapa é pausada de forma segura e encaminhada para este painel. A ELISA
                  nunca toma decisões críticas por adivinhação.
                </p>
              </div>
            </div>
          </Card>

          {pendencias.length === 0 ? (
            <Card className="rounded-2xl border border-dashed border-slate-300 p-12 text-center bg-slate-50">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
              <h4 className="font-bold text-slate-800 text-sm">
                Nenhuma pendência retida no Modo Humano
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Todas as operações da ELISA estão fluindo normalmente sem retenções críticas.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendencias.map((pend) => {
                const empNome =
                  pend.expand?.empresa_id?.nome_fantasia ||
                  pend.expand?.empresa_id?.razao_social ||
                  'Empresa'
                const isAberta = pend.status === 'aberta'

                return (
                  <Card
                    key={pend.id}
                    className={`rounded-2xl border p-4 transition-all shadow-2xs ${
                      isAberta
                        ? 'border-amber-300 bg-white hover:border-amber-400'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="space-y-2 max-w-3xl">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            className={
                              isAberta
                                ? 'bg-amber-600 text-white text-xs'
                                : 'bg-slate-600 text-white text-xs'
                            }
                          >
                            {pend.status.toUpperCase()}
                          </Badge>
                          <span className="font-bold text-slate-900 text-sm">{pend.titulo}</span>
                          <span className="text-xs text-slate-500">•</span>
                          <span className="text-xs font-semibold text-slate-700">{empNome}</span>
                        </div>

                        {/* 4 Perguntas Fundamentais do Modo Humano */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                          <div className="bg-red-50 border border-red-200 rounded-lg p-2.5">
                            <span className="font-bold text-red-900 block">
                              1. Por que a ELISA parou?
                            </span>
                            <span className="text-red-800">{pend.por_que_parou}</span>
                          </div>

                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                            <span className="font-bold text-blue-900 block">
                              2. O que foi executado?
                            </span>
                            <span className="text-blue-800">{pend.o_que_foi_executado}</span>
                          </div>

                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                            <span className="font-bold text-amber-900 block">3. O que falta?</span>
                            <span className="text-amber-800">{pend.o_que_falta}</span>
                          </div>

                          <div className="bg-purple-50 border border-purple-200 rounded-lg p-2.5">
                            <span className="font-bold text-purple-900 block">
                              4. Decisão necessária:
                            </span>
                            <span className="text-purple-800 font-semibold">
                              {pend.decisao_necessaria}
                            </span>
                          </div>
                        </div>

                        {pend.resolucao_descricao && (
                          <div className="mt-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-2 rounded-lg">
                            <strong>Resolução Registrada:</strong> {pend.resolucao_descricao}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
                        {isAberta && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setPendenciaSelecionada(pend)
                              setResolucaoTexto('')
                              setDecisaoTipo('APROVAR')
                              setDecisaoModalAberta(true)
                            }}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 gap-1.5 font-bold shadow-xs"
                          >
                            <ShieldCheck className="h-4 w-4" />
                            <span>Tomar Decisão</span>
                          </Button>
                        )}

                        <Link to={`/processos/${pend.processo_id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs h-8 border-slate-300"
                          >
                            Abrir Processo
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* MODAL MODO HUMANO: APROVAR / REJEITAR / CORRIGIR / DEVOLVER PARA ELISA */}
      <Dialog open={decisaoModalAberta} onOpenChange={setDecisaoModalAberta}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <ShieldCheck className="h-5 w-5 text-amber-600" />
              <span>Decisão Contábil Humana — Modo Humano</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {pendenciaSelecionada?.titulo}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs space-y-1">
              <span className="font-bold text-slate-800">Decisão necessária:</span>
              <p className="text-slate-600">{pendenciaSelecionada?.decisao_necessaria}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">Selecione a ação técnica:</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={decisaoTipo === 'APROVAR' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDecisaoTipo('APROVAR')}
                  className={`text-xs h-9 justify-start gap-2 ${
                    decisaoTipo === 'APROVAR'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : ''
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>[ APROVAR ]</span>
                </Button>

                <Button
                  type="button"
                  variant={decisaoTipo === 'DEVOLVER_ELISA' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDecisaoTipo('DEVOLVER_ELISA')}
                  className={`text-xs h-9 justify-start gap-2 ${
                    decisaoTipo === 'DEVOLVER_ELISA'
                      ? 'bg-[#0FA3A3] hover:bg-[#0c8282] text-white'
                      : ''
                  }`}
                >
                  <Bot className="h-4 w-4" />
                  <span>[ DEVOLVER PARA ELISA ]</span>
                </Button>

                <Button
                  type="button"
                  variant={decisaoTipo === 'CORRIGIR' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDecisaoTipo('CORRIGIR')}
                  className={`text-xs h-9 justify-start gap-2 ${
                    decisaoTipo === 'CORRIGIR' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''
                  }`}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>[ CORRIGIR DADOS ]</span>
                </Button>

                <Button
                  type="button"
                  variant={decisaoTipo === 'REJEITAR' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDecisaoTipo('REJEITAR')}
                  className={`text-xs h-9 justify-start gap-2 ${
                    decisaoTipo === 'REJEITAR' ? 'bg-red-600 hover:bg-red-700 text-white' : ''
                  }`}
                >
                  <AlertTriangle className="h-4 w-4" />
                  <span>[ REJEITAR ]</span>
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">
                Justificativa Contábil / Despacho Técnico (Auditável):
              </label>
              <Textarea
                placeholder="Ex.: Conferido extrato bancário com a nota fiscal correspondente. Conta 3.1.01.02 aprovada para conciliação."
                value={resolucaoTexto}
                onChange={(e) => setResolucaoTexto(e.target.value)}
                className="text-xs min-h-[90px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDecisaoModalAberta(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmarDecisao}
              disabled={salvandoDecisao}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
            >
              {salvandoDecisao ? 'Gravando Decisão...' : 'Confirmar Decisão Técnica'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

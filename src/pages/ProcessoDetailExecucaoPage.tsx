import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Bot,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
  ArrowLeft,
  RotateCw,
  FileText,
  History,
  FileCheck2,
  Lock,
  Unlock,
  SlidersHorizontal,
  ChevronRight,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  elisaOpsService,
  type ProcessoOperacionalRecord,
  type ProcessoEtapaRecord,
  type ElisaEvidenciaRecord,
  type ProcessoPendenciaRecord,
  type ProcessoEstado,
} from '@/services/elisaOpsService'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
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

export default function ProcessoDetailExecucaoPage() {
  const { id } = useParams<{ id: string }>()
  const { tenant, user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [processo, setProcesso] = useState<ProcessoOperacionalRecord | null>(null)
  const [etapas, setEtapas] = useState<ProcessoEtapaRecord[]>([])
  const [evidencias, setEvidencias] = useState<ElisaEvidenciaRecord[]>([])
  const [pendencias, setPendencias] = useState<ProcessoPendenciaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [executando, setExecutando] = useState(false)

  // Modal de Aprovação / Intervenção Humana
  const [aprovandoEtapa, setAprovandoEtapa] = useState<ProcessoEtapaRecord | null>(null)
  const [modalAprovacaoAberta, setModalAprovacaoAberta] = useState(false)
  const [justificativaAprovacao, setJustificativaAprovacao] = useState('')
  const [salvandoAprovacao, setSalvandoAprovacao] = useState(false)

  const loadData = useCallback(async () => {
    if (!id || !tenant?.id) return
    try {
      const [procRes, etapasRes, evidRes, pendRes] = await Promise.all([
        elisaOpsService.getProcessoById(id),
        elisaOpsService.listEtapas(id),
        elisaOpsService.listEvidencias(id),
        elisaOpsService.listPendencias(tenant.id, { processoId: id }),
      ])
      setProcesso(procRes)
      setEtapas(etapasRes)
      setEvidencias(evidRes)
      setPendencias(pendRes)
    } catch (err) {
      console.error('Erro ao carregar detalhes do processo:', err)
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao sincronizar dados do processo.',
      })
    } finally {
      setLoading(false)
    }
  }, [id, tenant?.id, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtime('processos_operacionais', () => loadData())
  useRealtime('processo_etapas', () => loadData())
  useRealtime('elisa_evidencias', () => loadData())
  useRealtime('processo_pendencias', () => loadData())

  // Etapa Atual ativa na esteira
  const etapaAtualAtiva = useMemo(() => {
    if (!etapas.length) return null
    return (
      etapas.find(
        (e) =>
          e.status === 'EM_EXECUCAO' ||
          e.status === 'ENFILEIRADO' ||
          e.status === 'AGUARDANDO_APROVACAO',
      ) ||
      etapas.find((e) => e.status !== 'CONCLUIDO') ||
      etapas[etapas.length - 1]
    )
  }, [etapas])

  // EXECUTAR PRÓXIMA AÇÃO DA ELLIZA
  const handleExecutarProximaAcao = async () => {
    if (!processo || !tenant?.id) return
    setExecutando(true)
    toast({
      title: '🤖 Elliza Iniciando Execução',
      description: `Disparando próxima ação da etapa: "${processo.proxima_acao}"...`,
    })

    try {
      const res = await elisaOpsService.executarProximaAcaoElisa({
        tenantId: tenant.id,
        processoId: processo.id,
        empresaId: processo.empresa_id,
      })

      if (res.sucesso) {
        toast({
          title: 'Etapa Validada e Concluída com Sucesso!',
          description: res.mensagem,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Ação Retida (Segurança / Aprovação)',
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
      setExecutando(false)
    }
  }

  // Aprovar Etapa (Chancela do Contador para Etapas Nível 3)
  const handleConfirmarAprovacaoEtapa = async () => {
    if (!aprovandoEtapa || !processo) return
    setSalvandoAprovacao(true)
    try {
      await elisaOpsService.updateEtapa(aprovandoEtapa.id, {
        status: 'APROVADO',
        aprovado_por: user?.name || user?.email || 'Contador Responsável CRC',
        observacao: `Aprovado pelo contador: ${justificativaAprovacao}`,
      })
      await elisaOpsService.updateProcesso(processo.id, {
        status: 'ENFILEIRADO',
        decisao_necessaria_humana: '',
      })
      toast({
        title: 'Etapa Aprovada!',
        description: `A etapa "${aprovandoEtapa.titulo}" foi chancelada e a Elliza pode prosseguir com a execução.`,
      })
      setModalAprovacaoAberta(false)
      setAprovandoEtapa(null)
      setJustificativaAprovacao('')
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao aprovar etapa',
        description: String(err),
      })
    } finally {
      setSalvandoAprovacao(false)
    }
  }

  if (loading || !processo) {
    return (
      <div className="p-12 text-center text-slate-500 space-y-3">
        <RotateCw className="h-8 w-8 animate-spin mx-auto text-[#0FA3A3]" />
        <p className="text-sm font-semibold">Carregando detalhes do processo operacional...</p>
      </div>
    )
  }

  const empresaNome =
    processo.expand?.empresa_id?.nome_fantasia ||
    processo.expand?.empresa_id?.razao_social ||
    'Cliente Rumo'
  const empresaCnpj = processo.expand?.empresa_id?.cnpj
    ? maskCnpj(processo.expand.empresa_id.cnpj)
    : '—'
  const isProcessoConcluido = processo.status === 'CONCLUIDO'
  const isProcessoAguardandoAprovacao = processo.status === 'AGUARDANDO_APROVACAO'

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Botão Voltar & Breadcrumb Determinístico */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/processos')}
          className="text-xs text-slate-600 gap-1.5 h-8 hover:text-slate-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Voltar para Processos</span>
        </Button>

        <div className="flex items-center gap-2">
          <Link to="/elisa-fila">
            <Button variant="outline" size="sm" className="h-8 text-xs border-slate-300">
              Ver na Fila da Elliza
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            className="h-8 text-xs border-slate-300 gap-1"
          >
            <RotateCw className="h-3 w-3" />
            <span>Atualizar</span>
          </Button>
        </div>
      </div>

      {/* CONTEXTO DA EXECUÇÃO OBRIGATÓRIO (Item 7 da Arquitetura Elliza) */}
      <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge className="bg-[#0FA3A3] text-white text-xs font-bold">
                {processo.codigo_sop || 'POP-04'} • {processo.area.toUpperCase()}
              </Badge>
              <Badge variant="outline" className="text-slate-600 text-xs">
                Competência: {processo.competencia}
              </Badge>
              <Badge
                className={`text-xs font-bold ${
                  isProcessoConcluido
                    ? 'bg-emerald-600 text-white'
                    : isProcessoAguardandoAprovacao
                      ? 'bg-amber-500 text-white animate-pulse'
                      : 'bg-blue-600 text-white'
                }`}
              >
                Status: {processo.status.replace('_', ' ')}
              </Badge>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{processo.titulo}</h1>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-500 block">Progresso Geral</span>
            <div className="text-2xl font-black text-[#0FA3A3] mt-0.5">
              {processo.progresso_percentual || 0}%
            </div>
          </div>
        </div>

        {/* Linha com os 7 Parâmetros do Contexto de Execução */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 pt-4 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Cliente</span>
            <span className="font-bold text-slate-800 truncate block" title={empresaNome}>
              {empresaNome}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">CNPJ</span>
            <span className="font-mono text-slate-700">{empresaCnpj}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">
              Competência
            </span>
            <span className="font-semibold text-slate-800">{processo.competencia}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Processo</span>
            <span className="font-semibold text-slate-800 truncate block">{processo.titulo}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">
              Etapa Atual
            </span>
            <span className="font-bold text-[#0FA3A3]">
              {processo.etapa_atual_numero || 1} de {processo.total_etapas || etapas.length}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Status</span>
            <span className="font-bold text-slate-800">{processo.status.replace('_', ' ')}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">
              Agente Responsável
            </span>
            <span className="font-bold text-slate-900 flex items-center gap-1">
              <Bot className="h-3.5 w-3.5 text-[#0FA3A3]" />
              {processo.agente_responsavel || 'Elliza'}
            </span>
          </div>
        </div>
      </Card>

      {/* BLOCO "🤖 AÇÕES DA ELLIZA" (Item 5 da Arquitetura Elliza) */}
      <Card className="rounded-2xl border-2 border-teal-500/40 bg-gradient-to-br from-teal-50/50 via-white to-cyan-50/30 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-teal-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0FA3A3] text-white shadow-xs shrink-0 mt-0.5">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">
                  🤖 Ações da Elliza — Piloto Automático Determinístico
                </h3>
                <Badge className="bg-teal-100 text-teal-800 text-[10px] font-bold">
                  Status: {processo.status}
                </Badge>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                O sistema define o processo. A Elliza executa a próxima etapa. O sistema valida os
                critérios de sucesso e grava evidência com protocolo.
              </p>
            </div>
          </div>

          {/* BOTÃO PRINCIPAL OBRIGATÓRIO: [ EXECUTAR PRÓXIMA AÇÃO ] */}
          {!isProcessoConcluido && (
            <Button
              size="lg"
              disabled={executando}
              onClick={handleExecutarProximaAcao}
              className="h-11 px-6 bg-[#0FA3A3] hover:bg-[#0c8282] text-white font-extrabold text-xs shadow-md gap-2 rounded-xl"
            >
              <PlayCircle className={`h-4 w-4 ${executando ? 'animate-spin' : ''}`} />
              <span>{executando ? 'EXECUTANDO AÇÃO...' : '[ EXECUTAR PRÓXIMA AÇÃO ]'}</span>
            </Button>
          )}
        </div>

        {/* Grid de Detalhamento da Ação Atual da Elliza */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 text-xs">
          <div className="rounded-xl bg-white border border-slate-200 p-3 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Etapa Atual
            </span>
            <span className="font-bold text-slate-900 block mt-0.5">
              {processo.etapa_atual_nome || 'Aguardando início'}
            </span>
          </div>

          <div className="rounded-xl bg-white border border-slate-200 p-3 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-teal-700 block">
              Próxima Ação
            </span>
            <span
              className="font-semibold text-slate-800 block mt-0.5 line-clamp-2"
              title={processo.proxima_acao}
            >
              {processo.proxima_acao || 'Nenhuma ação pendente'}
            </span>
          </div>

          <div className="rounded-xl bg-white border border-slate-200 p-3 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Critério de Sucesso
            </span>
            <span
              className="text-slate-700 block mt-0.5 line-clamp-2"
              title={processo.criterio_sucesso_atual}
            >
              {processo.criterio_sucesso_atual || 'Validação aritmética e partidas equilibradas'}
            </span>
          </div>

          <div className="rounded-xl bg-white border border-slate-200 p-3 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Última Ação Executada
            </span>
            <span
              className="text-emerald-700 font-medium block mt-0.5 line-clamp-2"
              title={processo.resultado_ultima_acao}
            >
              {processo.resultado_ultima_acao || 'Aguardando primeira execução'}
            </span>
          </div>
        </div>

        {/* Alerta de Aprovação Pendente se Houver */}
        {isProcessoAguardandoAprovacao && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-amber-900 font-semibold">
                {processo.decisao_necessaria_humana ||
                  'Esta etapa requer aprovação técnica do Contador.'}
              </span>
            </div>
            {etapaAtualAtiva && (
              <Button
                size="sm"
                onClick={() => {
                  setAprovandoEtapa(etapaAtualAtiva)
                  setJustificativaAprovacao('Conferido e aprovado pelo Contador Responsável.')
                  setModalAprovacaoAberta(true)
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-7 font-bold shrink-0"
              >
                Aprovar Agora
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* ABAS DO PROCESSO: CHECKLIST EXECUTÁVEL, EVIDÊNCIAS E AUDITORIA */}
      <Tabs defaultValue="checklist" className="space-y-4">
        <TabsList className="bg-slate-100 p-1 border border-slate-200">
          <TabsTrigger value="checklist" className="text-xs font-semibold gap-2">
            <FileText className="h-4 w-4 text-[#0FA3A3]" />
            <span>Checklist Executável ({etapas.length} Etapas)</span>
          </TabsTrigger>
          <TabsTrigger value="evidencias" className="text-xs font-semibold gap-2">
            <FileCheck2 className="h-4 w-4 text-blue-600" />
            <span>Evidências Registradas ({evidencias.length})</span>
          </TabsTrigger>
          <TabsTrigger value="pendencias" className="text-xs font-semibold gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span>Modo Humano ({pendencias.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: CHECKLIST EXECUTÁVEL (Item 3 da Arquitetura Elliza) */}
        <TabsContent value="checklist" className="space-y-3">
          <div className="space-y-3">
            {etapas.map((et) => {
              const isConcluida = et.status === 'CONCLUIDO'
              const isExecutandoEtapa = et.status === 'EM_EXECUCAO'
              const isAguardandoAprov = et.status === 'AGUARDANDO_APROVACAO'
              const isAprovada = et.status === 'APROVADO'

              return (
                <Card
                  key={et.id}
                  className={`rounded-2xl border transition-all p-4 ${
                    isConcluida
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : isExecutandoEtapa
                        ? 'bg-white border-[#0FA3A3] shadow-md ring-1 ring-[#0FA3A3]/30'
                        : isAguardandoAprov
                          ? 'bg-amber-50/50 border-amber-300'
                          : 'bg-white border-slate-200 shadow-2xs'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 max-w-4xl">
                      {/* Top linha da Etapa */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-800">
                          {et.ordem}
                        </span>

                        <h4 className="text-sm font-bold text-slate-900">{et.titulo}</h4>

                        <Badge
                          className={`text-[10px] font-bold ${
                            isConcluida
                              ? 'bg-emerald-600 text-white'
                              : isExecutandoEtapa
                                ? 'bg-blue-600 text-white'
                                : isAguardandoAprov
                                  ? 'bg-amber-500 text-white'
                                  : isAprovada
                                    ? 'bg-teal-600 text-white'
                                    : 'bg-slate-500 text-white'
                          }`}
                        >
                          {et.status.replace('_', ' ')}
                        </Badge>

                        <Badge variant="outline" className="text-[10px] text-slate-600 bg-slate-50">
                          Responsável: {et.responsavel_tipo || 'Elliza'}
                        </Badge>

                        {et.requer_aprovacao && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
                            Requer Aprovação
                          </Badge>
                        )}
                      </div>

                      {et.descricao && (
                        <p className="text-xs text-slate-600 leading-relaxed pl-8">
                          {et.descricao}
                        </p>
                      )}

                      {/* Parâmetros Determinísticos da Etapa: Entrada, Ação, Critérios */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs pt-1 pl-8">
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                          <span className="font-bold text-slate-700 block text-[10px] uppercase">
                            Entrada
                          </span>
                          <span className="text-slate-600 text-[11px]">
                            {et.entrada || 'Dados do processo'}
                          </span>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                          <span className="font-bold text-teal-800 block text-[10px] uppercase">
                            Ação
                          </span>
                          <span className="text-slate-700 text-[11px] font-medium">
                            {et.acao || 'Executar validação'}
                          </span>
                        </div>

                        <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2">
                          <span className="font-bold text-emerald-900 block text-[10px] uppercase">
                            Critério de Sucesso
                          </span>
                          <span className="text-emerald-800 text-[11px]">
                            {et.criterio_sucesso || 'Validação sem divergência'}
                          </span>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                          <span className="font-bold text-slate-700 block text-[10px] uppercase">
                            Próxima Etapa
                          </span>
                          <span className="text-slate-600 text-[11px]">
                            {et.proxima_etapa_nome || 'Próximo passo do POP'}
                          </span>
                        </div>
                      </div>

                      {/* Resultado Registrado */}
                      {et.resultado && (
                        <div className="pl-8 pt-1">
                          <div className="text-xs bg-white border border-slate-200 rounded-lg p-2.5 text-slate-800">
                            <strong className="text-emerald-700">Resultado Registrado:</strong>{' '}
                            {et.resultado}
                            {et.data_conclusao && (
                              <span className="text-slate-400 text-[10px] block mt-0.5">
                                Concluído em: {formatDatePtBr(et.data_conclusao)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Ações da Etapa Individual */}
                    <div className="shrink-0 flex flex-col gap-1.5 self-start">
                      {isAguardandoAprov && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setAprovandoEtapa(et)
                            setJustificativaAprovacao('Conferido e chancelado pelo Contador.')
                            setModalAprovacaoAberta(true)
                          }}
                          className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-7 font-bold shadow-xs"
                        >
                          Chancela CRC
                        </Button>
                      )}

                      {!isConcluida && !isAguardandoAprov && (
                        <Button
                          size="sm"
                          disabled={executando}
                          onClick={handleExecutarProximaAcao}
                          className="bg-[#0FA3A3] hover:bg-[#0c8282] text-white text-xs h-7 gap-1 font-semibold"
                        >
                          <PlayCircle className="h-3 w-3" />
                          <span>Executar</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* ABA 2: EVIDÊNCIAS AUDITÁVEIS (Item 11 da Arquitetura Elliza) */}
        <TabsContent value="evidencias" className="space-y-3">
          {evidencias.length === 0 ? (
            <Card className="rounded-2xl border border-dashed border-slate-300 p-8 text-center bg-slate-50">
              <FileCheck2 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <h4 className="font-bold text-slate-800 text-sm">
                Nenhuma evidência registrada ainda
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Conforme a Elliza for executando as etapas do checklist, protocolos e comprovantes
                serão gravados aqui.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {evidencias.map((ev) => (
                <Card
                  key={ev.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Badge className="bg-teal-50 text-[#0FA3A3] border-teal-200 text-[10px] font-bold uppercase">
                        {ev.tipo}
                      </Badge>
                      <h4 className="font-bold text-slate-900 text-xs mt-1">{ev.titulo}</h4>
                    </div>
                    {ev.protocolo_numero && (
                      <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold">
                        {ev.protocolo_numero}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{ev.descricao}</p>

                  <div className="rounded-lg bg-slate-50 border border-slate-100 p-2 text-[11px] text-slate-700">
                    <strong>Resultado:</strong> {ev.resultado_obtido || 'Operação validada'}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                    <span>Agente: {ev.executado_por}</span>
                    <span>{formatDatePtBr(ev.created)}</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ABA 3: MODO HUMANO / PENDÊNCIAS */}
        <TabsContent value="pendencias" className="space-y-3">
          {pendencias.length === 0 ? (
            <Card className="rounded-2xl border border-dashed border-slate-300 p-8 text-center bg-slate-50">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <h4 className="font-bold text-slate-800 text-sm">
                Sem pendências para este processo
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                A execução pela Elliza segue sem interrupções não previstas.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendencias.map((pend) => (
                <Card
                  key={pend.id}
                  className="rounded-2xl border border-amber-300 bg-amber-50/30 p-4 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-amber-950 text-sm">{pend.titulo}</span>
                    <Badge className="bg-amber-600 text-white text-xs">
                      {pend.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div className="bg-white p-2 rounded-lg border border-amber-200">
                      <strong className="text-red-900 block">Por que parou?</strong>
                      <span className="text-slate-700">{pend.por_que_parou}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-amber-200">
                      <strong className="text-purple-900 block">Decisão Necessária:</strong>
                      <span className="text-slate-700">{pend.decisao_necessaria}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* MODAL DE CHANCELA / APROVAÇÃO TÉCNICA */}
      <Dialog open={modalAprovacaoAberta} onOpenChange={setModalAprovacaoAberta}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <ShieldCheck className="h-5 w-5 text-amber-600" />
              <span>Chancela Técnica do Contador Responsável</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {aprovandoEtapa?.titulo}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-xs text-slate-700 leading-relaxed">
              Você está aprovando formalmente os cálculos e minutas gerados pela Elliza para a etapa
              selecionada. Esta ação será auditada com o seu perfil habilitado.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">Parecer Técnico:</label>
              <Textarea
                value={justificativaAprovacao}
                onChange={(e) => setJustificativaAprovacao(e.target.value)}
                className="text-xs min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalAprovacaoAberta(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmarAprovacaoEtapa}
              disabled={salvandoAprovacao}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
            >
              {salvandoAprovacao ? 'Chancelando...' : 'Confirmar e Liberar para Elliza'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

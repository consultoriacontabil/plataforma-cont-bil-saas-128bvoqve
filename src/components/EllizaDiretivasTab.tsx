import React, { useState, useEffect, useCallback } from 'react'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Edit2,
  Save,
  RotateCcw,
  Sliders,
  Check,
  X,
  Loader2,
  HelpCircle,
  Cpu,
  FileCheck2,
  Calendar,
  AlertCircle,
  Info,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { ellizaDiretivasService, ATIVIDADES_ELLIZA_CONFIG } from '@/services/ellizaDiretivas'
import type {
  EllizaDiretivaRecord,
  EllizaAprovacaoRecord,
  EllizaAtividade,
  EllizaNivelAutonomia,
  EllizaAprovacaoStatus,
} from '@/types'
import { formatDateTimePtBr } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface EllizaDiretivasTabProps {
  tenantId: string
  canEdit: boolean // Administrador pode editar
  canApprove: boolean // Administrador e Contador podem aprovar
}

const AUTONOMIA_LABELS: Record<
  EllizaNivelAutonomia,
  { label: string; badgeClass: string; icon: React.ReactNode; desc: string }
> = {
  somente_leitura: {
    label: 'Somente Leitura',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    icon: <Lock className="h-3 w-3 text-slate-600" />,
    desc: 'ELLIZA audita e lê dados continuamente, mas não executa alterações nem transmissões.',
  },
  executar_com_aprovacao: {
    label: 'Executa com Aprovação',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    icon: <AlertTriangle className="h-3 w-3 text-amber-700" />,
    desc: 'ELLIZA prepara a minuta/ação e enfileira na Fila de Aprovação. Ação só é executada após chancela de um Contador ou Administrador.',
  },
  autonomo: {
    label: 'Autônomo',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    icon: <CheckCircle2 className="h-3 w-3 text-emerald-700" />,
    desc: 'ELLIZA processa rotinas e disparos autorizados de forma independente dentro da janela e limites diários definidos.',
  },
}

export function EllizaDiretivasTab({ tenantId, canEdit, canApprove }: EllizaDiretivasTabProps) {
  const { toast } = useToast()

  // Estado das Diretivas
  const [diretivas, setDiretivas] = useState<EllizaDiretivaRecord[]>([])
  const [loadingDiretivas, setLoadingDiretivas] = useState(false)

  // Modal de edição de diretiva
  const [diretivaEditando, setDiretivaEditando] = useState<EllizaDiretivaRecord | null>(null)
  const [nivelForm, setNivelForm] = useState<EllizaNivelAutonomia>('somente_leitura')
  const [ativoForm, setAtivoForm] = useState<boolean>(true)
  const [janelaInicioForm, setJanelaInicioForm] = useState<string>('08:00')
  const [janelaFimForm, setJanelaFimForm] = useState<string>('18:00')
  const [limiteDiarioForm, setLimiteDiarioForm] = useState<string>('')
  const [observacoesForm, setObservacoesForm] = useState<string>('')
  const [salvandoDiretiva, setSalvandoDiretiva] = useState(false)

  // Estado da Fila de Aprovação
  const [aprovacoes, setAprovacoes] = useState<EllizaAprovacaoRecord[]>([])
  const [loadingAprovacoes, setLoadingAprovacoes] = useState(false)
  const [filtroStatusAprovacao, setFiltroStatusAprovacao] = useState<
    'pendente' | 'aprovado' | 'rejeitado' | 'todos'
  >('pendente')

  // Modal de decisão de aprovação
  const [itemParaDecidir, setItemParaDecidir] = useState<EllizaAprovacaoRecord | null>(null)
  const [tipoDecisao, setTipoDecisao] = useState<'aprovado' | 'rejeitado'>('aprovado')
  const [justificativaForm, setJustificativaForm] = useState<string>('')
  const [processandoDecisao, setProcessandoDecisao] = useState(false)

  // Modal de visualização de payload
  const [itemVisualizandoPayload, setItemVisualizandoPayload] =
    useState<EllizaAprovacaoRecord | null>(null)

  // Carregar diretivas
  const carregarDiretivas = useCallback(async () => {
    if (!tenantId) return
    setLoadingDiretivas(true)
    try {
      const data = await ellizaDiretivasService.listDiretivas(tenantId)
      setDiretivas(data)
    } catch (err) {
      console.error('Erro ao carregar diretivas:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar diretivas operacionais',
        description: 'Não foi possível buscar a matriz de autonomia da ELLIZA.',
      })
    } finally {
      setLoadingDiretivas(false)
    }
  }, [tenantId, toast])

  // Carregar fila de aprovação
  const carregarAprovacoes = useCallback(async () => {
    if (!tenantId) return
    setLoadingAprovacoes(true)
    try {
      const data = await ellizaDiretivasService.listAprovacoes(tenantId, filtroStatusAprovacao)
      setAprovacoes(data)
    } catch (err) {
      console.error('Erro ao carregar aprovações:', err)
    } finally {
      setLoadingAprovacoes(false)
    }
  }, [tenantId, filtroStatusAprovacao])

  useEffect(() => {
    carregarDiretivas()
  }, [carregarDiretivas])

  useEffect(() => {
    carregarAprovacoes()
  }, [carregarAprovacoes])

  // Abrir modal de edição de diretiva
  const handleEditarDiretiva = (dir: EllizaDiretivaRecord) => {
    setDiretivaEditando(dir)
    setNivelForm(dir.nivel_autonomia)
    setAtivoForm(dir.ativo)
    setJanelaInicioForm(dir.janela_inicio || '08:00')
    setJanelaFimForm(dir.janela_fim || '18:00')
    setLimiteDiarioForm(dir.limite_diario ? String(dir.limite_diario) : '')
    setObservacoesForm(dir.observacoes || '')
  }

  // Salvar alterações na diretiva
  const handleSalvarDiretiva = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!diretivaEditando || !tenantId) return

    setSalvandoDiretiva(true)
    try {
      const limiteNum = limiteDiarioForm ? parseInt(limiteDiarioForm, 10) : undefined
      await ellizaDiretivasService.updateDiretiva(
        diretivaEditando.id,
        {
          nivel_autonomia: nivelForm,
          ativo: ativoForm,
          janela_inicio: janelaInicioForm,
          janela_fim: janelaFimForm,
          limite_diario: isNaN(limiteNum ?? NaN) ? undefined : limiteNum,
          observacoes: observacoesForm.trim(),
        },
        tenantId,
      )

      toast({
        title: 'Diretiva operacional atualizada',
        description: `Autonomia de "${ATIVIDADES_ELLIZA_CONFIG[diretivaEditando.atividade]?.label || diretivaEditando.atividade}" configurada para "${AUTONOMIA_LABELS[nivelForm].label}". Alteração auditada.`,
      })
      setDiretivaEditando(null)
      carregarDiretivas()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar diretiva',
        description: msg,
      })
    } finally {
      setSalvandoDiretiva(false)
    }
  }

  // Abrir modal de decisão (aprovar/rejeitar)
  const handleAbrirDecisao = (item: EllizaAprovacaoRecord, decisao: 'aprovado' | 'rejeitado') => {
    setItemParaDecidir(item)
    setTipoDecisao(decisao)
    setJustificativaForm('')
  }

  // Submeter decisão
  const handleConfirmarDecisao = async () => {
    if (!itemParaDecidir) return
    setProcessandoDecisao(true)
    try {
      const resp = await ellizaDiretivasService.decidirAprovacao(
        itemParaDecidir.id,
        tipoDecisao,
        justificativaForm.trim() || undefined,
      )

      toast({
        title: tipoDecisao === 'aprovado' ? 'Ação Aprovada' : 'Ação Rejeitada',
        description: resp.mensagem || 'Decisão registrada e auditada com sucesso.',
      })
      setItemParaDecidir(null)
      carregarAprovacoes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar decisão',
        description: msg,
      })
    } finally {
      setProcessandoDecisao(false)
    }
  }

  // Contagem de pendentes
  const totalPendentes = aprovacoes.filter((a) => a.status === 'pendente').length

  return (
    <div className="space-y-6">
      {/* Banner Explicativo do Modo Supervisão & Matriz de Diretivas */}
      <Card className="border-teal-200 bg-gradient-to-r from-teal-500/10 via-slate-50 to-white shadow-2xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0FA3A3] text-white shadow-xs">
                <Sliders className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-base font-bold text-slate-900">
                    Diretivas Operacionais & Autonomia da ELLIZA
                  </CardTitle>
                  <Badge className="bg-[#0FA3A3] text-white text-[10px]">
                    Governança CFC / NBC PP 01
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-teal-300 text-teal-800 bg-teal-50 text-[10px]"
                  >
                    Modo Supervisão
                  </Badge>
                </div>
                <CardDescription className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
                  Defina o nível de autonomia que a ELLIZA possui em cada atividade operacional do
                  escritório contábil.
                  {canEdit ? (
                    <span className="font-semibold text-slate-800">
                      {' '}
                      Você possui perfil de Administrador e pode ajustar as diretivas abaixo.
                    </span>
                  ) : (
                    <span className="font-semibold text-slate-800">
                      {' '}
                      Você possui perfil de Contador (modo leitura para diretivas e permissão para
                      aprovar itens na fila).
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                carregarDiretivas()
                carregarAprovacoes()
              }}
              disabled={loadingDiretivas || loadingAprovacoes}
              className="text-xs h-8 gap-1.5 shrink-0"
            >
              <RotateCcw
                className={cn(
                  'h-3.5 w-3.5',
                  (loadingDiretivas || loadingAprovacoes) && 'animate-spin',
                )}
              />
              Atualizar
            </Button>
          </div>
        </CardHeader>

        {/* Guia Rápido dos Níveis de Autonomia */}
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200/80 text-xs">
            <div className="p-2.5 rounded-lg bg-white border border-slate-200">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-1">
                <Lock className="h-3.5 w-3.5 text-slate-600" />
                <span>1. Somente Leitura</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-tight">
                ELLIZA apenas audita, gera alertas preventivos e calcula prévias. Nenhuma gravação
                externa ou fechamento é acionado.
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                <span>2. Executar com Aprovação</span>
              </div>
              <p className="text-[11px] text-amber-900 leading-tight">
                ELLIZA redige a minuta e encaminha para a <b>Fila de Aprovação</b>. A transmissão ou
                lançamento só ocorre após chancela do Contador.
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200">
              <div className="flex items-center gap-1.5 font-bold text-emerald-900 mb-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                <span>3. Autônomo</span>
              </div>
              <p className="text-[11px] text-emerald-900 leading-tight">
                ELLIZA executa rotinas autorizadas dentro da janela horária e limite diário, gerando
                registro auditado no <i>audit_log</i>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* =========================================================================
          SEÇÃO 1: MATRIZ DAS 7 ATIVIDADES OPERACIONAIS
         ========================================================================= */}
      <Card className="rounded-2xl border-slate-200 shadow-2xs overflow-hidden">
        <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-[#0FA3A3]" />
                Atividades Operacionais & Níveis de Autonomia ({diretivas.length || 7})
              </CardTitle>
              <CardDescription className="text-xs">
                Controle granular de permissões e horários por módulo de atuação
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loadingDiretivas ? (
            <div className="p-8 text-center text-xs text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-[#0FA3A3]" />
              Carregando diretivas operacionais...
            </div>
          ) : diretivas.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Nenhuma diretiva cadastrada para o escritório. Elas são provisionadas automaticamente
              na criação do tenant.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {diretivas.map((dir) => {
                const config = ATIVIDADES_ELLIZA_CONFIG[dir.atividade] || {
                  label: dir.atividade,
                  descricao: '',
                  modulo: 'Geral',
                }
                const autoConfig =
                  AUTONOMIA_LABELS[dir.nivel_autonomia] || AUTONOMIA_LABELS.somente_leitura

                return (
                  <div
                    key={dir.id}
                    className="p-4 hover:bg-slate-50/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 max-w-2xl">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">{config.label}</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-slate-50 border-slate-200 text-slate-600"
                        >
                          {config.modulo}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] font-semibold flex items-center gap-1',
                            autoConfig.badgeClass,
                          )}
                        >
                          {autoConfig.icon}
                          {autoConfig.label}
                        </Badge>
                        {dir.ativo ? (
                          <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">
                            Ativa
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-slate-400 border-slate-200 text-[10px]"
                          >
                            Pausada
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">{config.descricao}</p>

                      {config.restricaoSupervisao && (
                        <p className="text-[11px] text-teal-800 font-medium flex items-center gap-1">
                          <Info className="h-3 w-3 shrink-0" />
                          <span>Regra do Modo Supervisão: {config.restricaoSupervisao}</span>
                        </p>
                      )}

                      {/* Parâmetros operacionais */}
                      <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-400" />
                          Janela: {dir.janela_inicio || '08:00'} às {dir.janela_fim || '18:00'}
                        </span>
                        {dir.limite_diario ? (
                          <span>
                            Limite diário: <b>{dir.limite_diario}</b> execuções
                          </span>
                        ) : (
                          <span>Sem limite diário específico</span>
                        )}
                        {dir.observacoes && (
                          <span
                            className="italic text-slate-400 truncate max-w-xs"
                            title={dir.observacoes}
                          >
                            Obs: {dir.observacoes}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {canEdit ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditarDiretiva(dir)}
                          className="h-8 text-xs gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-100"
                        >
                          <Edit2 className="h-3.5 w-3.5 text-[#0FA3A3]" />
                          Editar Diretiva
                        </Button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          Somente Administrador edita
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* =========================================================================
          SEÇÃO 2: FILA DE APROVAÇÃO HUMANA (Supervisão do Contador)
         ========================================================================= */}
      <Card className="rounded-2xl border-slate-200 shadow-2xs overflow-hidden">
        <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4 text-amber-600" />
                  Fila de Aprovação da ELLIZA ({aprovacoes.length})
                </CardTitle>
                {totalPendentes > 0 && (
                  <Badge className="bg-amber-500 text-white text-[10px] animate-pulse">
                    {totalPendentes} pendente{totalPendentes > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                Ações preparadas pela ELLIZA sob o nível "Executar com Aprovação" aguardando decisão
                humana
              </CardDescription>
            </div>

            {/* Filtros de status da fila */}
            <div className="flex items-center gap-1.5">
              {(['pendente', 'aprovado', 'rejeitado', 'todos'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setFiltroStatusAprovacao(st)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-colors',
                    filtroStatusAprovacao === st
                      ? 'bg-[#0FA3A3] text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loadingAprovacoes ? (
            <div className="p-8 text-center text-xs text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-[#0FA3A3]" />
              Carregando itens da fila de aprovação...
            </div>
          ) : aprovacoes.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500 space-y-2">
              <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500" />
              <p className="font-semibold text-slate-700">Fila limpa!</p>
              <p className="text-slate-400">
                Nenhum item{' '}
                {filtroStatusAprovacao !== 'todos' ? `com status "${filtroStatusAprovacao}"` : ''}{' '}
                aguardando decisão.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {aprovacoes.map((item) => {
                const configAtiv = ATIVIDADES_ELLIZA_CONFIG[item.atividade]
                const isPendente = item.status === 'pendente'

                return (
                  <div
                    key={item.id}
                    className={cn(
                      'p-4 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs',
                      isPendente ? 'bg-amber-50/20 hover:bg-amber-50/40' : 'hover:bg-slate-50/50',
                    )}
                  >
                    <div className="space-y-1.5 max-w-2xl">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{item.titulo}</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-slate-50 border-slate-200"
                        >
                          {configAtiv?.label || item.atividade}
                        </Badge>

                        {/* Badge de status */}
                        {item.status === 'pendente' ? (
                          <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] gap-1">
                            <Clock className="h-3 w-3" /> Aguardando Decisão
                          </Badge>
                        ) : item.status === 'aprovado' || item.status === 'executado' ? (
                          <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px] gap-1">
                            <CheckCircle2 className="h-3 w-3" /> {item.status.toUpperCase()}
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-100 text-rose-900 border-rose-300 text-[10px] gap-1">
                            <XCircle className="h-3 w-3" /> {item.status.toUpperCase()}
                          </Badge>
                        )}
                      </div>

                      {item.descricao && (
                        <p className="text-slate-600 leading-relaxed">{item.descricao}</p>
                      )}

                      {/* Metadados: data criação, entidade e aprovador */}
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1 flex-wrap">
                        <span>
                          Gerado em: <b>{formatDateTimePtBr(item.created)}</b>
                        </span>
                        {item.entidade_tipo && (
                          <span>
                            Entidade:{' '}
                            <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-700">
                              {item.entidade_tipo}
                            </code>
                          </span>
                        )}
                        {item.decidido_em && (
                          <span>
                            Decidido em: <b>{formatDateTimePtBr(item.decidido_em)}</b>
                          </span>
                        )}
                        {item.expand?.aprovado_por?.name && (
                          <span>
                            Por: <b>{item.expand.aprovado_por.name}</b>
                          </span>
                        )}
                        {item.justificativa && (
                          <span className="italic text-slate-600">
                            Justificativa: "{item.justificativa}"
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ações da Fila */}
                    <div className="shrink-0 flex items-center gap-2 flex-wrap">
                      {/* Ver Payload / Dados */}
                      {item.payload_acao && Object.keys(item.payload_acao).length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setItemVisualizandoPayload(item)}
                          className="h-8 text-xs border-slate-300 text-slate-700"
                        >
                          Ver Payload
                        </Button>
                      )}

                      {/* Botões Aprovar e Rejeitar (somente para pendentes) */}
                      {isPendente && canApprove ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleAbrirDecisao(item, 'aprovado')}
                            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleAbrirDecisao(item, 'rejeitado')}
                            className="h-8 text-xs gap-1"
                          >
                            <X className="h-3.5 w-3.5" />
                            Rejeitar
                          </Button>
                        </>
                      ) : isPendente && !canApprove ? (
                        <span className="text-[11px] text-slate-400 italic">
                          Requer Contador ou Administrador para aprovar
                        </span>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* =========================================================================
          MODAL: EDITAR DIRETIVA OPERACIONAL
         ========================================================================= */}
      <Dialog open={Boolean(diretivaEditando)} onOpenChange={() => setDiretivaEditando(null)}>
        <DialogContent className="max-w-lg">
          {diretivaEditando && (
            <form onSubmit={handleSalvarDiretiva}>
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-[#0FA3A3]" />
                  Configurar Diretiva:{' '}
                  {ATIVIDADES_ELLIZA_CONFIG[diretivaEditando.atividade]?.label ||
                    diretivaEditando.atividade}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Ajuste o grau de autonomia da ELLIZA. As alterações são gravadas no{' '}
                  <i>audit_log</i> com rastreabilidade completa.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4 text-xs">
                {/* Ativo / Inativo */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold text-slate-900">
                      Atividade Habilitada
                    </Label>
                    <p className="text-[11px] text-slate-500">
                      Se desativada, a ELLIZA não executará nenhuma ação nem leitura para este
                      módulo.
                    </p>
                  </div>
                  <Switch checked={ativoForm} onCheckedChange={setAtivoForm} />
                </div>

                {/* Grau de Autonomia */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-900">
                    Nível de Autonomia *
                  </Label>
                  <Select
                    value={nivelForm}
                    onValueChange={(val: EllizaNivelAutonomia) => setNivelForm(val)}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="somente_leitura" className="text-xs">
                        🔒 Somente Leitura (Auditoria e alertas preventivos)
                      </SelectItem>
                      <SelectItem value="executar_com_aprovacao" className="text-xs">
                        ⚠️ Executar com Aprovação (Gera minuta para aprovação humana)
                      </SelectItem>
                      <SelectItem value="autonomo" className="text-xs">
                        ⚡ Autônomo (Execução contínua nas janelas autorizadas)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-slate-500 pt-0.5">
                    {AUTONOMIA_LABELS[nivelForm].desc}
                  </p>
                </div>

                {/* Janela Horária */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-900">
                      Janela Início (HH:MM)
                    </Label>
                    <Input
                      type="time"
                      value={janelaInicioForm}
                      onChange={(e) => setJanelaInicioForm(e.target.value)}
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-900">
                      Janela Fim (HH:MM)
                    </Label>
                    <Input
                      type="time"
                      value={janelaFimForm}
                      onChange={(e) => setJanelaFimForm(e.target.value)}
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Limite Diário */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-900">
                    Limite Diário de Execuções (Opcional)
                  </Label>
                  <Input
                    type="number"
                    value={limiteDiarioForm}
                    onChange={(e) => setLimiteDiarioForm(e.target.value)}
                    placeholder="Ex: 50 (deixe em branco para ilimitado)"
                    className="h-9 text-xs"
                    min={1}
                  />
                  <p className="text-[11px] text-slate-400">
                    Prevenção contra loops ou disparos massivos acidentais.
                  </p>
                </div>

                {/* Observações Internas */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-900">
                    Observações de Governança
                  </Label>
                  <Textarea
                    value={observacoesForm}
                    onChange={(e) => setObservacoesForm(e.target.value)}
                    placeholder="Descreva particularidades acordadas com os sócios..."
                    className="h-16 text-xs resize-none"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDiretivaEditando(null)}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={salvandoDiretiva}
                  className="bg-[#0FA3A3] hover:bg-[#0c8787] text-white text-xs gap-1.5"
                >
                  {salvandoDiretiva ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      Salvar Diretiva
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          MODAL: DECIDIR ITEM DA FILA (APROVAR / REJEITAR)
         ========================================================================= */}
      <Dialog open={Boolean(itemParaDecidir)} onOpenChange={() => setItemParaDecidir(null)}>
        <DialogContent className="max-w-md">
          {itemParaDecidir && (
            <div>
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  {tipoDecisao === 'aprovado' ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      Aprovar Ação da ELLIZA
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-rose-600" />
                      Rejeitar Ação da ELLIZA
                    </>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs">{itemParaDecidir.titulo}</DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-4 text-xs">
                {itemParaDecidir.descricao && (
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                    {itemParaDecidir.descricao}
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-900">
                    Justificativa / Parecer Técnico (Opcional)
                  </Label>
                  <Textarea
                    value={justificativaForm}
                    onChange={(e) => setJustificativaForm(e.target.value)}
                    placeholder="Adicione um motivo ou parecer para registro no histórico..."
                    className="h-20 text-xs resize-none"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setItemParaDecidir(null)}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmarDecisao}
                  disabled={processandoDecisao}
                  className={cn(
                    'text-xs text-white',
                    tipoDecisao === 'aprovado'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700',
                  )}
                >
                  {processandoDecisao ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      Processando...
                    </>
                  ) : tipoDecisao === 'aprovado' ? (
                    'Confirmar Aprovação'
                  ) : (
                    'Confirmar Rejeição'
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          MODAL: VISUALIZAR PAYLOAD DA AÇÃO
         ========================================================================= */}
      <Dialog
        open={Boolean(itemVisualizandoPayload)}
        onOpenChange={() => setItemVisualizandoPayload(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Payload da Ação: {itemVisualizandoPayload?.titulo}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Dados brutos preparados pela ELLIZA para execução
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <pre className="p-3 rounded-lg bg-slate-900 text-teal-300 font-mono text-[11px] overflow-x-auto max-h-80 leading-relaxed">
              {JSON.stringify(itemVisualizandoPayload?.payload_acao, null, 2)}
            </pre>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setItemVisualizandoPayload(null)}
              className="text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

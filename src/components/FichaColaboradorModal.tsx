import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Users2,
  FileText,
  DollarSign,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  Clock,
  Briefcase,
  Palmtree,
  Coins,
  Bus,
  Scale,
  UserMinus,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Code2,
  Copy,
  Download,
  Building2,
  Receipt,
  UserCheck,
  User,
  ArrowUpRight,
  TrendingUp,
  Hash,
  AlertCircle,
  FileCode2,
  Sparkles,
  Info,
  Layers,
  Edit,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { maskCpf, formatDatePtBr, formatDateTimePtBr } from '@/lib/formatters'
import {
  fichaColaboradorService,
  type FichaColaboradorCompleta,
  type TimelineItem,
} from '@/services/fichaColaborador'
import type { UserRole, EsocialEventoRecord } from '@/types'
import { cn } from '@/lib/utils'

interface FichaColaboradorModalProps {
  funcionarioId: string | null
  tenantId: string
  userRole?: UserRole
  open: boolean
  onOpenChange: (open: boolean) => void
  onEditarColaborador?: (func: any) => void
  onNavegarAba?: (
    aba:
      | 'funcionarios'
      | 'folha'
      | 'ferias_decimo'
      | 'rescisoes'
      | 'verbas'
      | 'beneficios'
      | 'convencoes'
      | 'esocial',
  ) => void
}

export function FichaColaboradorModal({
  funcionarioId,
  tenantId,
  userRole,
  open,
  onOpenChange,
  onEditarColaborador,
  onNavegarAba,
}: FichaColaboradorModalProps) {
  const { toast } = useToast()

  const [ficha, setFicha] = useState<FichaColaboradorCompleta | null>(null)
  const [loading, setLoading] = useState(false)
  const [abaInterna, setAbaInterna] = useState<
    | 'timeline'
    | 'cadastral'
    | 'contrato'
    | 'remuneracao'
    | 'eventos_esocial'
    | 'ferias_decimo'
    | 'beneficios'
    | 'rescisao'
  >('timeline')

  // Timeline: itens expandidos
  const [expandedTimelineIds, setExpandedTimelineIds] = useState<Record<string, boolean>>({})

  // Modal Ver XML de Evento e-Social
  const [modalXmlOpen, setModalXmlOpen] = useState(false)
  const [xmlVisualizando, setXmlVisualizando] = useState<{
    titulo: string
    conteudo: string
  } | null>(null)

  const canEdit = userRole === 'administrador' || userRole === 'contador'

  const carregarFicha = useCallback(async () => {
    if (!funcionarioId || !tenantId) return
    setLoading(true)
    try {
      const res = await fichaColaboradorService.getFicha360(tenantId, funcionarioId)
      setFicha(res)
    } catch (err) {
      console.error('Erro ao carregar Ficha 360 do Colaborador:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar ficha',
        description: 'Não foi possível consolidar os dados do colaborador.',
      })
    } finally {
      setLoading(false)
    }
  }, [funcionarioId, tenantId, toast])

  useEffect(() => {
    if (open && funcionarioId) {
      carregarFicha()
    } else {
      setFicha(null)
      setExpandedTimelineIds({})
    }
  }, [open, funcionarioId, carregarFicha])

  const toggleExpandTimeline = (id: string) => {
    setExpandedTimelineIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const handleCopiarXml = (texto: string) => {
    navigator.clipboard.writeText(texto)
    toast({
      title: 'XML Copiado',
      description: 'Estrutura XML transferida para a área de transferência.',
    })
  }

  const handleBaixarXml = (titulo: string, texto: string) => {
    const blob = new Blob([texto], { type: 'application/xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${titulo.replace(/[^a-zA-Z0-9_-]/g, '_')}.xml`
    a.click()
    URL.revokeObjectURL(url)
  }

  const abrirXmlVisualizador = (titulo: string, xml?: string) => {
    if (!xml) {
      toast({
        variant: 'destructive',
        title: 'XML não disponível',
        description: 'Este evento ainda não gerou arquivo XML.',
      })
      return
    }
    setXmlVisualizando({ titulo, conteudo: xml })
    setModalXmlOpen(true)
  }

  // Cores e Ícones da Timeline
  const getTimelineBadge = (item: TimelineItem) => {
    switch (item.categoria) {
      case 'admissao':
        return {
          icon: <UserCheck className="h-4 w-4" />,
          color: 'bg-emerald-600 text-white',
          border: 'border-emerald-200',
        }
      case 'alteracao_salarial':
        return {
          icon: <TrendingUp className="h-4 w-4" />,
          color: 'bg-blue-600 text-white',
          border: 'border-blue-200',
        }
      case 'alteracao_cadastral':
        return {
          icon: <User className="h-4 w-4" />,
          color: 'bg-sky-600 text-white',
          border: 'border-sky-200',
        }
      case 'ferias':
        return {
          icon: <Palmtree className="h-4 w-4" />,
          color: item.isPrevisto ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white',
          border: 'border-emerald-200',
        }
      case 'decimo_terceiro':
        return {
          icon: <DollarSign className="h-4 w-4" />,
          color: 'bg-indigo-600 text-white',
          border: 'border-indigo-200',
        }
      case 'folha':
        return {
          icon: <Receipt className="h-4 w-4" />,
          color: 'bg-teal-600 text-white',
          border: 'border-teal-200',
        }
      case 'beneficio':
        return {
          icon: <Bus className="h-4 w-4" />,
          color: 'bg-sky-500 text-white',
          border: 'border-sky-200',
        }
      case 'esocial':
        return {
          icon: <ShieldCheck className="h-4 w-4" />,
          color:
            item.status === 'rejeitado'
              ? 'bg-rose-600 text-white'
              : item.status === 'transmitido' || item.status === 'fechado'
                ? 'bg-[#0FA3A3] text-white'
                : 'bg-amber-500 text-white',
          border: 'border-teal-200',
        }
      case 'rescisao':
        return {
          icon: <UserMinus className="h-4 w-4" />,
          color: 'bg-rose-600 text-white',
          border: 'border-rose-200',
        }
      case 'aviso_previo':
        return {
          icon: <Clock className="h-4 w-4" />,
          color: 'bg-amber-600 text-white',
          border: 'border-amber-200',
        }
      default:
        return {
          icon: <Clock className="h-4 w-4" />,
          color: 'bg-slate-600 text-white',
          border: 'border-slate-200',
        }
    }
  }

  const func = ficha?.funcionario
  const conf = ficha?.conformidadeEsocial

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] h-[92vh] p-0 flex flex-col rounded-2xl overflow-hidden bg-[#FAFBFC] border-[#E2E8F0]">
          {/* Header da Ficha 360 */}
          <div className="bg-white border-b border-[#E2E8F0] p-5 shrink-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-[#0FA3A3] text-xl font-bold shrink-0">
                  {func?.nome_completo
                    ? func.nome_completo
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                    : 'FC'}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-[#1A2333]">
                      {func?.nome_completo || 'Carregando Ficha...'}
                    </h2>
                    {func?.status === 'ativo' && (
                      <Badge className="bg-[#DCFCE7] text-[#16A34A] border-emerald-200 text-xs font-semibold">
                        Ativo
                      </Badge>
                    )}
                    {func?.status === 'ferias' && (
                      <Badge className="bg-[#FEF3C7] text-[#D97706] border-amber-200 text-xs font-semibold">
                        Em Férias
                      </Badge>
                    )}
                    {func?.status === 'afastado' && (
                      <Badge className="bg-[#F3E8FF] text-[#9333EA] border-purple-200 text-xs font-semibold">
                        Afastado
                      </Badge>
                    )}
                    {func?.status === 'demitido' && (
                      <Badge className="bg-[#FEE2E2] text-[#DC2626] border-rose-200 text-xs font-semibold">
                        Desligado / Rescindido
                      </Badge>
                    )}

                    {/* Badge de Conformidade e-Social */}
                    {conf && (
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs font-semibold gap-1.5',
                          conf.statusConformidade === 'conforme' &&
                            'bg-emerald-50 text-emerald-800 border-emerald-300',
                          conf.statusConformidade === 'pendencias' &&
                            'bg-amber-50 text-amber-800 border-amber-300',
                          conf.statusConformidade === 'critico' &&
                            'bg-rose-50 text-rose-800 border-rose-300',
                        )}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Score e-Social: {conf.percentual}%</span>
                        {conf.statusConformidade === 'conforme' && <span>🟢</span>}
                        {conf.statusConformidade === 'pendencias' && <span>🟡</span>}
                        {conf.statusConformidade === 'critico' && <span>🔴</span>}
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#64748B] mt-1">
                    <span>
                      <strong>CPF:</strong> {func?.cpf ? maskCpf(func.cpf) : '—'}
                    </span>
                    <span>
                      <strong>Cargo:</strong> {func?.cargo || '—'}
                    </span>
                    <span>
                      <strong>Empresa:</strong>{' '}
                      {ficha?.empresa?.nome_fantasia || ficha?.empresa?.razao_social || '—'}
                    </span>
                    <span>
                      <strong>Matrícula:</strong> {func?.matricula_esocial || 'Sem matrícula'}
                    </span>
                    <span>
                      <strong>Admissão:</strong>{' '}
                      {func?.data_admissao ? formatDatePtBr(func.data_admissao) : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ações / Atalhos Rápidos */}
              <div className="flex flex-wrap items-center gap-2">
                {canEdit && func && onEditarColaborador && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onOpenChange(false)
                      onEditarColaborador(func)
                    }}
                    className="h-8 text-xs font-semibold gap-1.5 border-[#E2E8F0]"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    <span>Editar Cadastro</span>
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => carregarFicha()}
                  variant="ghost"
                  className="h-8 text-xs font-semibold text-[#64748B]"
                >
                  Atualizar
                </Button>
              </div>
            </div>

            {/* Cards Resumo Rápido Topo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-100">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                  Salário Base
                </span>
                <span className="text-sm font-bold text-[#1A2333] font-mono">
                  R${' '}
                  {Number(ficha?.resumoFinanceiro.salarioAtual || 0).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                  Último Bruto Apurado
                </span>
                <span className="text-sm font-bold text-[#1A2333] font-mono">
                  R${' '}
                  {Number(ficha?.resumoFinanceiro.ultimoBrutoApurado || 0).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                  Benefícios Mensais
                </span>
                <span className="text-sm font-bold text-sky-700 font-mono">
                  R${' '}
                  {Number(ficha?.resumoFinanceiro.totalBeneficiosMensal || 0).toLocaleString(
                    'pt-BR',
                    {
                      minimumFractionDigits: 2,
                    },
                  )}
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                  Último Líquido Pago
                </span>
                <span className="text-sm font-bold text-emerald-700 font-mono">
                  R${' '}
                  {Number(ficha?.resumoFinanceiro.ultimoLiquido || 0).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Abas Internas da Ficha 360 */}
          <Tabs
            value={abaInterna}
            onValueChange={(v) => setAbaInterna(v as typeof abaInterna)}
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="bg-white border-b border-[#E2E8F0] px-5">
              <TabsList className="bg-transparent h-11 p-0 gap-6 border-b border-transparent">
                <TabsTrigger
                  value="timeline"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-[#0FA3A3] data-[state=active]:text-[#0FA3A3] rounded-none px-1 text-xs font-bold gap-1.5"
                >
                  <Clock className="h-4 w-4" />
                  <span>Timeline 360º ({ficha?.timeline.length || 0})</span>
                </TabsTrigger>
                <TabsTrigger
                  value="cadastral"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-[#0FA3A3] data-[state=active]:text-[#0FA3A3] rounded-none px-1 text-xs font-bold gap-1.5"
                >
                  <ShieldCheck className="h-4 w-4 text-[#0FA3A3]" />
                  <span>Dados Cadastrais (S-2200)</span>
                </TabsTrigger>
                <TabsTrigger
                  value="contrato"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-[#0FA3A3] data-[state=active]:text-[#0FA3A3] rounded-none px-1 text-xs font-bold gap-1.5"
                >
                  <Briefcase className="h-4 w-4" />
                  <span>Contrato &amp; CCT</span>
                </TabsTrigger>
                <TabsTrigger
                  value="remuneracao"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-[#0FA3A3] data-[state=active]:text-[#0FA3A3] rounded-none px-1 text-xs font-bold gap-1.5"
                >
                  <Coins className="h-4 w-4 text-[#0FA3A3]" />
                  <span>Remuneração &amp; Verbas ({ficha?.verbasLancamentos.length || 0})</span>
                </TabsTrigger>
                <TabsTrigger
                  value="eventos_esocial"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-[#0FA3A3] data-[state=active]:text-[#0FA3A3] rounded-none px-1 text-xs font-bold gap-1.5"
                >
                  <FileCode2 className="h-4 w-4 text-[#0FA3A3]" />
                  <span>Eventos e-Social ({ficha?.eventosEsocial.length || 0})</span>
                </TabsTrigger>
                <TabsTrigger
                  value="ferias_decimo"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-[#0FA3A3] data-[state=active]:text-[#0FA3A3] rounded-none px-1 text-xs font-bold gap-1.5"
                >
                  <Palmtree className="h-4 w-4 text-emerald-600" />
                  <span>Férias &amp; 13º</span>
                </TabsTrigger>
                <TabsTrigger
                  value="beneficios"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-[#0FA3A3] data-[state=active]:text-[#0FA3A3] rounded-none px-1 text-xs font-bold gap-1.5"
                >
                  <Bus className="h-4 w-4 text-sky-600" />
                  <span>Benefícios ({ficha?.beneficios.length || 0})</span>
                </TabsTrigger>
                {ficha?.rescisao && (
                  <TabsTrigger
                    value="rescisao"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-rose-600 data-[state=active]:text-rose-600 rounded-none px-1 text-xs font-bold gap-1.5"
                  >
                    <UserMinus className="h-4 w-4 text-rose-600" />
                    <span>Rescisão (TRCT)</span>
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            {/* Conteúdo scrollável */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {loading ? (
                <div className="py-16 text-center text-xs text-[#64748B]">
                  <Sparkles className="h-8 w-8 animate-spin mx-auto text-[#0FA3A3] mb-2" />
                  <p>Consolidando todos os eventos e registros do vínculo...</p>
                </div>
              ) : (
                <>
                  {/* === ABA 1: TIMELINE 360 COMPLETA === */}
                  <TabsContent value="timeline" className="m-0 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-[#1A2333]">
                          Linha do Tempo Cronológica do Vínculo
                        </h3>
                        <p className="text-xs text-[#64748B]">
                          Admissão, alterações contratuais/salariais, férias, 13º, benefícios,
                          folhas e eventos e-Social transmitidos.
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {ficha?.timeline.length || 0} fatos registrados
                      </Badge>
                    </div>

                    {ficha?.timeline.length === 0 ? (
                      <p className="text-center py-12 text-xs text-[#94A3B8]">
                        Nenhum evento registrado na linha do tempo deste colaborador.
                      </p>
                    ) : (
                      <div className="relative border-l-2 border-slate-200 ml-4 space-y-5 py-2">
                        {ficha?.timeline.map((item) => {
                          const badgeInfo = getTimelineBadge(item)
                          const isExpanded = !!expandedTimelineIds[item.id]

                          return (
                            <div key={item.id} className="relative pl-7 group">
                              {/* Ícone no nodo da timeline */}
                              <span
                                className={cn(
                                  'absolute -left-3.5 top-1 h-7 w-7 rounded-full border-2 border-white flex items-center justify-center shadow-xs transition-transform group-hover:scale-110',
                                  badgeInfo.color,
                                )}
                              >
                                {badgeInfo.icon}
                              </span>

                              {/* Card do item */}
                              <div
                                className={cn(
                                  'rounded-xl border bg-white p-3.5 transition-all shadow-2xs hover:border-[#0FA3A3]/50',
                                  item.isPrevisto
                                    ? 'border-dashed border-amber-300 bg-amber-50/20'
                                    : 'border-[#E2E8F0]',
                                )}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-bold text-xs text-[#1A2333]">
                                      {item.titulo}
                                    </span>
                                    {item.badgeTexto && (
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          'text-[10px] font-semibold py-0',
                                          item.badgeVariant === 'success' &&
                                            'bg-emerald-50 text-emerald-800 border-emerald-300',
                                          item.badgeVariant === 'warning' &&
                                            'bg-amber-50 text-amber-800 border-amber-300',
                                          item.badgeVariant === 'destructive' &&
                                            'bg-rose-50 text-rose-800 border-rose-300',
                                          item.isPrevisto &&
                                            'border-dashed border-amber-400 bg-amber-100 text-amber-900',
                                        )}
                                      >
                                        {item.badgeTexto}
                                      </Badge>
                                    )}
                                  </div>

                                  <span className="text-[11px] font-medium text-[#64748B] flex items-center gap-1 shrink-0">
                                    <Calendar className="h-3.5 w-3.5 text-[#94A3B8]" />
                                    {formatDatePtBr(item.data)}
                                  </span>
                                </div>

                                <p className="text-xs text-[#475569] mt-1.5 leading-relaxed">
                                  {item.descricaoCurta}
                                </p>

                                {/* Ações do Item */}
                                <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 text-xs">
                                  <button
                                    type="button"
                                    onClick={() => toggleExpandTimeline(item.id)}
                                    className="text-[11px] font-semibold text-[#0FA3A3] hover:underline flex items-center gap-1"
                                  >
                                    <span>{isExpanded ? 'Ocultar Detalhes' : 'Ver Detalhes'}</span>
                                    {isExpanded ? (
                                      <ChevronUp className="h-3 w-3" />
                                    ) : (
                                      <ChevronDown className="h-3 w-3" />
                                    )}
                                  </button>

                                  <div className="flex items-center gap-2">
                                    {item.referenciaOrigem?.xml && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          abrirXmlVisualizador(
                                            item.titulo,
                                            item.referenciaOrigem?.xml,
                                          )
                                        }
                                        className="h-6 text-[10px] text-teal-700 bg-teal-50 hover:bg-teal-100 px-2 rounded-md gap-1"
                                      >
                                        <Code2 className="h-3 w-3" />
                                        <span>Ver XML</span>
                                      </Button>
                                    )}
                                    {item.referenciaOrigem?.tipo === 'folha' && onNavegarAba && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          onOpenChange(false)
                                          onNavegarAba('folha')
                                        }}
                                        className="h-6 text-[10px] text-[#64748B] hover:text-[#0FA3A3] px-2 rounded-md gap-1"
                                      >
                                        <span>Ir para Folha</span>
                                        <ExternalLink className="h-3 w-3" />
                                      </Button>
                                    )}
                                    {item.referenciaOrigem?.tipo === 'ferias' && onNavegarAba && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          onOpenChange(false)
                                          onNavegarAba('ferias_decimo')
                                        }}
                                        className="h-6 text-[10px] text-[#64748B] hover:text-emerald-700 px-2 rounded-md gap-1"
                                      >
                                        <span>Ir para Férias</span>
                                        <ExternalLink className="h-3 w-3" />
                                      </Button>
                                    )}
                                    {item.referenciaOrigem?.tipo === 'beneficio' &&
                                      onNavegarAba && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            onOpenChange(false)
                                            onNavegarAba('beneficios')
                                          }}
                                          className="h-6 text-[10px] text-[#64748B] hover:text-sky-700 px-2 rounded-md gap-1"
                                        >
                                          <span>Ir para Benefícios</span>
                                          <ExternalLink className="h-3 w-3" />
                                        </Button>
                                      )}
                                    {item.referenciaOrigem?.tipo === 'rescisao' && onNavegarAba && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          onOpenChange(false)
                                          onNavegarAba('rescisoes')
                                        }}
                                        className="h-6 text-[10px] text-[#64748B] hover:text-rose-700 px-2 rounded-md gap-1"
                                      >
                                        <span>Ir para Rescisão</span>
                                        <ExternalLink className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                {/* Bloco Expansível de Detalhes */}
                                {isExpanded && item.detalhes && (
                                  <div className="mt-2.5 pt-2.5 border-t border-slate-100 bg-slate-50/70 p-3 rounded-lg text-[11px] font-mono text-slate-700 space-y-1">
                                    {Object.entries(item.detalhes).map(([k, v]) => {
                                      if (v === null || v === undefined || v === '') return null
                                      let vStr =
                                        typeof v === 'object' ? JSON.stringify(v) : String(v)
                                      return (
                                        <div
                                          key={k}
                                          className="flex flex-col sm:flex-row sm:items-baseline gap-1"
                                        >
                                          <span className="font-bold text-slate-900 uppercase text-[10px] sm:w-44 shrink-0">
                                            {k.replace(/_/g, ' ')}:
                                          </span>
                                          <span className="text-slate-700 break-all">{vStr}</span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </TabsContent>

                  {/* === ABA 2: DADOS CADASTRAIS (S-2200) === */}
                  <TabsContent value="cadastral" className="m-0 space-y-4">
                    {/* Alertas de Conformidade e-Social */}
                    {conf && conf.pendencias.length > 0 && (
                      <Card className="rounded-xl border-amber-200 bg-amber-50/40 shadow-none">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <span>
                              Pendências de Conformidade e-Social S-2200 ({conf.pendencias.length}{' '}
                              alertas)
                            </span>
                          </div>
                          <ul className="text-xs text-amber-800 list-disc list-inside space-y-1">
                            {conf.pendencias.map((p, idx) => (
                              <li key={idx}>
                                <strong>Campo {p.campo}:</strong> {p.descricao}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Bloco 1: Identificação Civil */}
                      <Card className="rounded-xl border-[#E2E8F0]">
                        <CardHeader className="py-3 px-4 border-b">
                          <CardTitle className="text-xs font-bold text-[#1A2333] flex items-center gap-2">
                            <User className="h-4 w-4 text-[#0FA3A3]" />
                            <span>Identificação Civil &amp; Pessoal</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-2.5 text-xs">
                          <div className="flex justify-between border-b pb-1.5">
                            <span className="text-[#64748B]">Nome Completo:</span>
                            <span className="font-bold text-[#1A2333]">{func?.nome_completo}</span>
                          </div>
                          <div className="flex justify-between border-b pb-1.5">
                            <span className="text-[#64748B]">CPF:</span>
                            <span className="font-mono font-bold text-[#1A2333]">
                              {func?.cpf ? maskCpf(func.cpf) : '—'}
                            </span>
                          </div>
                          <div className="flex justify-between border-b pb-1.5">
                            <span className="text-[#64748B]">PIS / NIS / PASEP:</span>
                            <span className="font-mono font-bold text-[#1A2333]">
                              {func?.nis_pis || (
                                <span className="text-rose-600 font-sans">Não cadastrado</span>
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between border-b pb-1.5">
                            <span className="text-[#64748B]">Sexo Biológico:</span>
                            <span className="font-semibold text-[#1A2333]">
                              {func?.sexo === 'M'
                                ? 'Masculino'
                                : func?.sexo === 'F'
                                  ? 'Feminino'
                                  : '—'}
                            </span>
                          </div>
                          <div className="flex justify-between border-b pb-1.5">
                            <span className="text-[#64748B]">Estado Civil:</span>
                            <span className="font-semibold text-[#1A2333] capitalize">
                              {func?.estado_civil || '—'}
                            </span>
                          </div>
                          <div className="flex justify-between border-b pb-1.5">
                            <span className="text-[#64748B]">Raça / Cor:</span>
                            <span className="font-semibold text-[#1A2333] capitalize">
                              {func?.raca_cor || '—'}
                            </span>
                          </div>
                          <div className="flex justify-between border-b pb-1.5">
                            <span className="text-[#64748B]">Grau de Instrução:</span>
                            <span className="font-semibold text-[#1A2333]">
                              {func?.grau_instrucao ? func.grau_instrucao.replace(/_/g, ' ') : '—'}
                            </span>
                          </div>
                          <div className="flex justify-between border-b pb-1.5">
                            <span className="text-[#64748B]">Filiação (Nome da Mãe):</span>
                            <span className="font-semibold text-[#1A2333]">
                              {func?.nome_mae || '—'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#64748B]">Dependentes IRRF:</span>
                            <span className="font-bold text-[#1A2333]">
                              {func?.dependentes_irrf ?? 0}
                            </span>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Bloco 2: CTPS & Enquadramento Trabalhista */}
                      <Card className="rounded-xl border-[#E2E8F0]">
                        <CardHeader className="py-3 px-4 border-b">
                          <CardTitle className="text-xs font-bold text-[#1A2333] flex items-center gap-2">
                            <FileText className="h-4 w-4 text-[#0FA3A3]" />
                            <span>CTPS &amp; e-Social Layout S-1.1</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-2.5 text-xs">
                          <div className="flex justify-between border-b pb-1.5">
                            <span className="text-[#64748B]">CTPS (Número / Série / UF):</span>
                            <span className="font-mono font-bold text-[#1A2333]">
                              {func?.ctps_numero
                                ? `${func.ctps_numero} / ${func.ctps_serie || '—'} / ${func.ctps_uf || '—'}`
                                : 'Digital / Não preenchido'}
                            </span>
                          </div>
                          <div className="flex justify-between border-b pb-1.5">
                            <span className="text-[#64748B]">CBO Oficial (MTE):</span>
                            <span className="font-mono font-bold text-[#0FA3A3]">
                              {func?.cbo || (
                                <span className="text-rose-600 font-sans">Pendente</span>
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between border-b pb-1.5">
                            <span className="text-[#64748B]">Matrícula e-Social:</span>
                            <span className="font-mono font-bold text-[#1A2333]">
                              {func?.matricula_esocial || '—'}
                            </span>
                          </div>
                          <div className="flex justify-between border-b pb-1.5">
                            <span className="text-[#64748B]">Categoria do Trabalhador:</span>
                            <span className="font-semibold text-[#1A2333]">
                              {func?.categoria_trabalhador || '101 - Empregado Geral'}
                            </span>
                          </div>
                          <div className="flex justify-between border-b pb-1.5">
                            <span className="text-[#64748B]">PCD (Pessoa c/ Deficiência):</span>
                            <span className="font-semibold text-[#1A2333]">
                              {func?.pcd ? `Sim (${func.tipo_deficiencia || 'Geral'})` : 'Não'}
                            </span>
                          </div>
                          <div className="flex justify-between border-b pb-1.5">
                            <span className="text-[#64748B]">Centro de Custo / Setor:</span>
                            <span className="font-semibold text-[#1A2333]">
                              {func?.centro_custo || '—'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#64748B]">Regime Trabalhista:</span>
                            <span className="font-bold text-[#1A2333] uppercase">
                              {func?.tipo || 'CLT'}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  {/* === ABA 3: CONTRATO & CONVENÇÃO COLETIVA === */}
                  <TabsContent value="contrato" className="m-0 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Vínculo Atual */}
                      <Card className="rounded-xl border-[#E2E8F0]">
                        <CardHeader className="py-3 px-4 border-b">
                          <CardTitle className="text-xs font-bold text-[#1A2333]">
                            Condições Contratuais Atuais
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-2.5 text-xs">
                          <div className="flex justify-between border-b pb-1.5">
                            <span className="text-[#64748B]">Tipo de Contrato:</span>
                            <span className="font-bold uppercase text-[#1A2333]">{func?.tipo}</span>
                          </div>
                          <div className="flex justify-between border-b pb-1.5">
                            <span className="text-[#64748B]">Data de Início (Admissão):</span>
                            <span className="font-bold text-[#1A2333]">
                              {func?.data_admissao ? formatDatePtBr(func.data_admissao) : '—'}
                            </span>
                          </div>
                          <div className="flex justify-between border-b pb-1.5">
                            <span className="text-[#64748B]">Salário Base Atual:</span>
                            <span className="font-mono font-bold text-[#1A2333]">
                              R${' '}
                              {Number(func?.salario || 0).toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                          <div className="flex justify-between border-b pb-1.5">
                            <span className="text-[#64748B]">Situação do Contrato:</span>
                            <span className="font-bold capitalize text-[#1A2333]">
                              {func?.status}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#64748B]">Carga Horária Base:</span>
                            <span className="font-semibold text-[#1A2333]">
                              220h mensais (44h semanais)
                            </span>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Convenção Coletiva de Trabalho (CCT) Regente */}
                      <Card className="rounded-xl border-[#E2E8F0]">
                        <CardHeader className="py-3 px-4 border-b">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-xs font-bold text-[#1A2333] flex items-center gap-1.5">
                              <Scale className="h-4 w-4 text-amber-600" />
                              <span>Convenção Coletiva (CCT) Regente</span>
                            </CardTitle>
                            {ficha?.convencaoVigente && (
                              <Badge
                                className={cn(
                                  'text-[10px] font-semibold',
                                  ficha.convencaoVigente.status_vigencia === 'vigente'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-200',
                                )}
                              >
                                {ficha.convencaoVigente.status_vigencia.toUpperCase()}
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 space-y-2.5 text-xs">
                          {ficha?.convencaoVigente ? (
                            <>
                              <div>
                                <p className="font-bold text-[#1A2333]">
                                  {ficha.convencaoVigente.titulo}
                                </p>
                                <p className="text-[11px] text-[#64748B]">
                                  Reg. MTE: {ficha.convencaoVigente.numero_registro_mte || '—'}
                                </p>
                              </div>
                              <div className="flex justify-between border-b pb-1.5">
                                <span className="text-[#64748B]">Sindicato Laboral:</span>
                                <span className="font-semibold text-[#1A2333] text-right max-w-[200px] truncate">
                                  {ficha.convencaoVigente.sindicato_laboral}
                                </span>
                              </div>
                              <div className="flex justify-between border-b pb-1.5">
                                <span className="text-[#64748B]">Piso Salarial da Categoria:</span>
                                <span className="font-mono font-bold text-[#1A2333]">
                                  R${' '}
                                  {Number(ficha.convencaoVigente.piso_salarial || 0).toLocaleString(
                                    'pt-BR',
                                    {
                                      minimumFractionDigits: 2,
                                    },
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between border-b pb-1.5">
                                <span className="text-[#64748B]">
                                  Último Reajuste Convencionado:
                                </span>
                                <span className="font-bold text-[#0FA3A3]">
                                  {ficha.convencaoVigente.percentual_reajuste}%
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#64748B]">Adicional HE / Noturno CCT:</span>
                                <span className="font-mono font-semibold text-[#1A2333]">
                                  {ficha.convencaoVigente.adicional_hora_extra}% /{' '}
                                  {ficha.convencaoVigente.adicional_noturno}%
                                </span>
                              </div>
                            </>
                          ) : (
                            <p className="text-center py-4 text-[#94A3B8]">
                              Nenhuma CCT vinculada à empresa deste colaborador.
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  {/* === ABA 4: REMUNERAÇÃO, VERBAS & FOLHAS === */}
                  <TabsContent value="remuneracao" className="m-0 space-y-4">
                    {/* Tabela de Verbas Lançadas */}
                    <Card className="rounded-xl border-[#E2E8F0] overflow-hidden">
                      <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
                        <div>
                          <CardTitle className="text-xs font-bold text-[#1A2333]">
                            Catálogo de Verbas Variáveis Lançadas por Competência
                          </CardTitle>
                          <CardDescription className="text-[11px]">
                            Horas extras, adicionais noturnos, DSR e descontos legais CLT.
                          </CardDescription>
                        </div>
                        {onNavegarAba && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              onOpenChange(false)
                              onNavegarAba('verbas')
                            }}
                            className="h-7 text-xs font-semibold gap-1 text-[#0FA3A3]"
                          >
                            <span>Ir para Verbas &amp; Descontos</span>
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </CardHeader>
                      <CardContent className="p-0">
                        {ficha?.verbasLancamentos.length === 0 ? (
                          <p className="text-center py-8 text-xs text-[#94A3B8]">
                            Nenhum lançamento variável para este colaborador.
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-[#F8FAFC] text-[#64748B] font-semibold border-b">
                                <tr>
                                  <th className="py-2.5 px-4">Competência</th>
                                  <th className="py-2.5 px-4">Verba / Rubrica</th>
                                  <th className="py-2.5 px-4">Tipo</th>
                                  <th className="py-2.5 px-4">Qtd / Alíquota</th>
                                  <th className="py-2.5 px-4">Referência / Detalhe</th>
                                  <th className="py-2.5 px-4 text-right">Valor Calculado</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {ficha?.verbasLancamentos.map((vl) => {
                                  const isProv = vl.expand?.verba?.tipo === 'provento'
                                  return (
                                    <tr key={vl.id} className="hover:bg-slate-50/70">
                                      <td className="py-2.5 px-4 font-mono font-medium">
                                        {vl.competencia}
                                      </td>
                                      <td className="py-2.5 px-4">
                                        <p className="font-bold text-[#1A2333]">
                                          {vl.expand?.verba?.descricao || 'Verba'}
                                        </p>
                                        <span className="text-[10px] text-[#64748B] font-mono">
                                          Rubrica:{' '}
                                          {vl.expand?.verba?.rubrica_esocial ||
                                            vl.expand?.verba?.codigo ||
                                            '—'}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-4">
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            'text-[10px] uppercase font-bold',
                                            isProv
                                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                              : 'bg-rose-50 text-rose-800 border-rose-200',
                                          )}
                                        >
                                          {isProv ? 'Provento (+)' : 'Desconto (-)'}
                                        </Badge>
                                      </td>
                                      <td className="py-2.5 px-4 font-mono">
                                        {vl.quantidade}{' '}
                                        {vl.aliquota_percentual
                                          ? `(${vl.aliquota_percentual}%)`
                                          : ''}
                                      </td>
                                      <td className="py-2.5 px-4 text-slate-600 max-w-xs truncate">
                                        {vl.referencia_detalhe || '—'}
                                      </td>
                                      <td
                                        className={cn(
                                          'py-2.5 px-4 font-mono font-bold text-right',
                                          isProv ? 'text-emerald-700' : 'text-rose-700',
                                        )}
                                      >
                                        {isProv ? '+' : '-'} R${' '}
                                        {Number(vl.valor_calculado || 0).toLocaleString('pt-BR', {
                                          minimumFractionDigits: 2,
                                        })}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Histórico de Folhas Fechadas */}
                    <Card className="rounded-xl border-[#E2E8F0] overflow-hidden">
                      <CardHeader className="py-3 px-4 border-b">
                        <CardTitle className="text-xs font-bold text-[#1A2333]">
                          Histórico de Folhas de Pagamento do Vínculo
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        {ficha?.folhas.length === 0 ? (
                          <p className="text-center py-6 text-xs text-[#94A3B8]">
                            Nenhum contracheque ou folha processada.
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-[#F8FAFC] text-[#64748B] font-semibold border-b">
                                <tr>
                                  <th className="py-2 px-4">Competência</th>
                                  <th className="py-2 px-4">Salário Base</th>
                                  <th className="py-2 px-4">INSS</th>
                                  <th className="py-2 px-4">IRRF</th>
                                  <th className="py-2 px-4">FGTS 8%</th>
                                  <th className="py-2 px-4">Líquido</th>
                                  <th className="py-2 px-4">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {ficha?.folhas.map((f) => (
                                  <tr key={f.id} className="hover:bg-slate-50/70">
                                    <td className="py-2 px-4 font-mono font-bold">
                                      {f.competencia}
                                    </td>
                                    <td className="py-2 px-4 font-mono">
                                      R$ {Number(f.salario_base || 0).toFixed(2)}
                                    </td>
                                    <td className="py-2 px-4 font-mono text-amber-700">
                                      - R$ {Number(f.inss || 0).toFixed(2)}
                                    </td>
                                    <td className="py-2 px-4 font-mono text-amber-700">
                                      - R$ {Number(f.irrf || 0).toFixed(2)}
                                    </td>
                                    <td className="py-2 px-4 font-mono text-indigo-700">
                                      R$ {Number(f.fgts || 0).toFixed(2)}
                                    </td>
                                    <td className="py-2 px-4 font-mono font-bold text-emerald-700">
                                      R$ {Number(f.total_liquido || 0).toFixed(2)}
                                    </td>
                                    <td className="py-2 px-4">
                                      <Badge
                                        className={cn(
                                          'text-[10px] uppercase font-bold',
                                          f.status === 'paga'
                                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                            : 'bg-amber-50 text-amber-800 border-amber-200',
                                        )}
                                      >
                                        {f.status}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* === ABA 5: EVENTOS E-SOCIAL (S-2200, S-2205, S-2230, S-1200, S-1210, S-2299) === */}
                  <TabsContent value="eventos_esocial" className="m-0 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-[#1A2333]">
                          Eventos e-Social na Fila de Transmissão Oficial
                        </h3>
                        <p className="text-xs text-[#64748B]">
                          Eventos vinculados ao CPF deste colaborador, protocolos de entrega e
                          espelho XML.
                        </p>
                      </div>
                      {onNavegarAba && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onOpenChange(false)
                            onNavegarAba('esocial')
                          }}
                          className="h-8 text-xs font-semibold gap-1 text-[#0FA3A3]"
                        >
                          <span>Abrir Painel Geral e-Social</span>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    {ficha?.eventosEsocial.length === 0 ? (
                      <p className="text-center py-8 text-xs text-[#94A3B8]">
                        Nenhum evento e-Social gerado para este colaborador.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {ficha?.eventosEsocial.map((ev) => {
                          const isTransmitido =
                            ev.status === 'transmitido' || ev.status === 'fechado'
                          const isRejeitado = ev.status === 'rejeitado'
                          return (
                            <Card
                              key={ev.id}
                              className={cn(
                                'rounded-xl transition-all border',
                                isRejeitado && 'border-rose-300 bg-rose-50/20',
                                isTransmitido && 'border-emerald-200',
                              )}
                            >
                              <CardContent className="p-4">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <Badge className="bg-[#0FA3A3] text-white font-mono text-xs">
                                        {ev.tipo_evento}
                                      </Badge>
                                      <span className="font-bold text-xs text-[#1A2333]">
                                        {ev.identificador_evento || 'Evento sem ID'}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          'text-[10px] font-semibold',
                                          isTransmitido &&
                                            'bg-emerald-50 text-emerald-800 border-emerald-300',
                                          isRejeitado && 'bg-rose-50 text-rose-800 border-rose-300',
                                        )}
                                      >
                                        {ev.status.toUpperCase()}
                                      </Badge>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#64748B]">
                                      <span>
                                        Competência: <strong>{ev.competencia || '—'}</strong>
                                      </span>
                                      {ev.protocolo_envio && (
                                        <span>
                                          Protocolo: <strong>{ev.protocolo_envio}</strong>
                                        </span>
                                      )}
                                      {ev.recibo_entrega && (
                                        <span>
                                          Recibo:{' '}
                                          <strong className="text-emerald-700">
                                            {ev.recibo_entrega}
                                          </strong>
                                        </span>
                                      )}
                                      {ev.data_transmissao && (
                                        <span>
                                          Transmitido em: {formatDateTimePtBr(ev.data_transmissao)}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {ev.xml_gerado && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          abrirXmlVisualizador(
                                            `${ev.tipo_evento} - ${ev.identificador_evento}`,
                                            ev.xml_gerado,
                                          )
                                        }
                                        className="h-8 text-xs font-semibold gap-1 text-[#0FA3A3] border-teal-200 hover:bg-teal-50"
                                      >
                                        <Code2 className="h-3.5 w-3.5" />
                                        <span>Visualizar XML</span>
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                {/* Erros de rejeição */}
                                {isRejeitado && ev.erros_validacao && (
                                  <div className="mt-3 pt-3 border-t border-rose-200 text-xs text-rose-800 space-y-1">
                                    <div className="flex items-center gap-1 font-bold">
                                      <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                                      <span>Inconsistências apontadas:</span>
                                    </div>
                                    <pre className="text-[11px] whitespace-pre-wrap font-sans bg-rose-50 p-2 rounded-lg">
                                      {typeof ev.erros_validacao === 'string'
                                        ? ev.erros_validacao
                                        : JSON.stringify(ev.erros_validacao, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    )}
                  </TabsContent>

                  {/* === ABA 6: FÉRIAS & 13º SALÁRIO === */}
                  <TabsContent value="ferias_decimo" className="m-0 space-y-4">
                    {/* Férias */}
                    <Card className="rounded-xl border-[#E2E8F0]">
                      <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
                        <div>
                          <CardTitle className="text-xs font-bold text-[#1A2333] flex items-center gap-1.5">
                            <Palmtree className="h-4 w-4 text-emerald-600" />
                            <span>Períodos de Férias do Colaborador</span>
                          </CardTitle>
                        </div>
                        {onNavegarAba && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              onOpenChange(false)
                              onNavegarAba('ferias_decimo')
                            }}
                            className="h-7 text-xs font-semibold gap-1 text-emerald-700 hover:bg-emerald-50"
                          >
                            <span>Ir para Férias &amp; 13º</span>
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </CardHeader>
                      <CardContent className="p-4 space-y-3">
                        {ficha?.ferias.length === 0 ? (
                          <p className="text-center py-4 text-xs text-[#94A3B8]">
                            Nenhum cálculo de férias registrado.
                          </p>
                        ) : (
                          ficha?.ferias.map((fe) => (
                            <div
                              key={fe.id}
                              className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                <span className="font-bold text-sm text-[#1A2333]">
                                  {fe.dias_gozo} dias de gozo{' '}
                                  {fe.vender_abono && `(+${fe.dias_abono} dias abono)`}
                                </span>
                                <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">
                                  {fe.status.toUpperCase()}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-[#64748B]">
                                <div>
                                  <span>Período Aquisitivo:</span>
                                  <p className="font-semibold text-slate-800">
                                    {fe.periodo_aquisitivo_inicio?.slice(0, 10)} a{' '}
                                    {fe.periodo_aquisitivo_fim?.slice(0, 10)}
                                  </p>
                                </div>
                                <div>
                                  <span>Período de Gozo:</span>
                                  <p className="font-semibold text-slate-800">
                                    {fe.data_inicio_gozo?.slice(0, 10)} a{' '}
                                    {fe.data_fim_gozo?.slice(0, 10)}
                                  </p>
                                </div>
                                <div>
                                  <span>Total Bruto:</span>
                                  <p className="font-mono font-bold text-slate-800">
                                    R$ {Number(fe.total_bruto || 0).toFixed(2)}
                                  </p>
                                </div>
                                <div>
                                  <span>Líquido Pago:</span>
                                  <p className="font-mono font-bold text-emerald-700">
                                    R$ {Number(fe.total_liquido || 0).toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>

                    {/* 13º Salário */}
                    <Card className="rounded-xl border-[#E2E8F0]">
                      <CardHeader className="py-3 px-4 border-b">
                        <CardTitle className="text-xs font-bold text-[#1A2333] flex items-center gap-1.5">
                          <DollarSign className="h-4 w-4 text-indigo-600" />
                          <span>Parcelas de 13º Salário (CLT)</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 space-y-3">
                        {ficha?.decimos.length === 0 ? (
                          <p className="text-center py-4 text-xs text-[#94A3B8]">
                            Nenhuma parcela de 13º apurada.
                          </p>
                        ) : (
                          ficha?.decimos.map((dc) => (
                            <div
                              key={dc.id}
                              className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                <span className="font-bold text-sm text-[#1A2333]">
                                  {dc.parcela === 'primeira_parcela'
                                    ? '1ª Parcela'
                                    : dc.parcela === 'segunda_parcela'
                                      ? '2ª Parcela'
                                      : 'Parcela Única'}{' '}
                                  ({dc.ano})
                                </span>
                                <Badge className="bg-indigo-100 text-indigo-800 text-[10px]">
                                  {dc.status.toUpperCase()}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-[#64748B]">
                                <div>
                                  <span>Meses Trabalhados:</span>
                                  <p className="font-semibold text-slate-800">
                                    {dc.meses_trabalhados}/12
                                  </p>
                                </div>
                                <div>
                                  <span>Remuneração Base:</span>
                                  <p className="font-mono font-bold text-slate-800">
                                    R$ {Number(dc.remuneracao_base_calculo || 0).toFixed(2)}
                                  </p>
                                </div>
                                <div>
                                  <span>Guia INSS Cód.:</span>
                                  <p className="font-semibold text-slate-800">
                                    {dc.codigo_receita_inss || '2172'}
                                  </p>
                                </div>
                                <div>
                                  <span>Valor Líquido:</span>
                                  <p className="font-mono font-bold text-emerald-700">
                                    R$ {Number(dc.total_liquido || dc.valor_bruto || 0).toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* === ABA 7: BENEFÍCIOS (VT / VA / VR) === */}
                  <TabsContent value="beneficios" className="m-0 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-[#1A2333]">
                          Concessões de Benefícios VT / VA / VR
                        </h3>
                        <p className="text-xs text-[#64748B]">
                          Créditos mensais, operadoras contratadas, custo da empresa e desconto do
                          colaborador (limite legal 6% VT).
                        </p>
                      </div>
                      {onNavegarAba && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onOpenChange(false)
                            onNavegarAba('beneficios')
                          }}
                          className="h-8 text-xs font-semibold gap-1 text-sky-700 border-sky-200"
                        >
                          <span>Abrir Painel de Benefícios</span>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    {ficha?.beneficios.length === 0 ? (
                      <p className="text-center py-8 text-xs text-[#94A3B8]">
                        Nenhum benefício concedido para este colaborador.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {ficha?.beneficios.map((bn) => (
                          <Card key={bn.id} className="rounded-xl border-[#E2E8F0]">
                            <CardContent className="p-4 space-y-2 text-xs">
                              <div className="flex items-center justify-between">
                                <Badge className="bg-sky-50 text-sky-800 border-sky-200 uppercase font-bold text-[10px]">
                                  {bn.tipo.replace('_', ' ')}
                                </Badge>
                                <span className="font-mono text-slate-500 font-medium">
                                  {bn.competencia}
                                </span>
                              </div>
                              <p className="font-bold text-sm text-[#1A2333]">{bn.operadora}</p>
                              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t text-[#64748B]">
                                <div>
                                  <span>Total Fornecido:</span>
                                  <p className="font-mono font-bold text-slate-800">
                                    R$ {Number(bn.valor_total_beneficio || 0).toFixed(2)}
                                  </p>
                                </div>
                                <div>
                                  <span>Dias Úteis:</span>
                                  <p className="font-semibold text-slate-800">
                                    {bn.dias_uteis} dias
                                  </p>
                                </div>
                                <div>
                                  <span>Custo Empresa:</span>
                                  <p className="font-mono font-bold text-sky-700">
                                    R$ {Number(bn.custo_empresa || 0).toFixed(2)}
                                  </p>
                                </div>
                                <div>
                                  <span>Desconto Colaborador:</span>
                                  <p className="font-mono font-bold text-rose-700">
                                    - R$ {Number(bn.desconto_colaborador || 0).toFixed(2)}
                                  </p>
                                </div>
                              </div>
                              {bn.numero_cartao && (
                                <p className="text-[10px] text-slate-500 pt-1 font-mono">
                                  Cartão: {bn.numero_cartao}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* === ABA 8: RESCISÃO CONTRATUAL (SE DESLIGADO) === */}
                  {ficha?.rescisao && (
                    <TabsContent value="rescisao" className="m-0 space-y-4">
                      <Card className="rounded-xl border-rose-200 bg-rose-50/20">
                        <CardHeader className="py-3 px-4 border-b border-rose-100 flex flex-row items-center justify-between">
                          <div>
                            <CardTitle className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                              <UserMinus className="h-4 w-4 text-rose-600" />
                              <span>Processo Rescisório (TRCT Homologado / Simulado)</span>
                            </CardTitle>
                          </div>
                          {onNavegarAba && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                onOpenChange(false)
                                onNavegarAba('rescisoes')
                              }}
                              className="h-7 text-xs font-semibold gap-1 text-rose-800 border-rose-200"
                            >
                              <span>Ver no Painel de Rescisões</span>
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          )}
                        </CardHeader>
                        <CardContent className="p-4 space-y-3 text-xs">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-rose-100">
                            <div>
                              <span className="text-[#64748B] text-[11px] block">Motivo:</span>
                              <strong className="text-slate-800 capitalize">
                                {ficha.rescisao.motivo_desligamento.replace(/_/g, ' ')}
                              </strong>
                            </div>
                            <div>
                              <span className="text-[#64748B] text-[11px] block">
                                Data Desligamento:
                              </span>
                              <strong className="text-slate-800">
                                {formatDatePtBr(ficha.rescisao.data_desligamento)}
                              </strong>
                            </div>
                            <div>
                              <span className="text-[#64748B] text-[11px] block">
                                Aviso Prévio:
                              </span>
                              <strong className="text-slate-800">
                                {ficha.rescisao.dias_aviso_previo} dias (
                                {ficha.rescisao.tipo_aviso_previo})
                              </strong>
                            </div>
                            <div>
                              <span className="text-[#64748B] text-[11px] block">
                                Prazo Art. 477 §6º:
                              </span>
                              <strong className="text-rose-700">
                                {formatDatePtBr(ficha.rescisao.prazo_pagamento_limite)}
                              </strong>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="bg-white p-3 rounded-xl border border-slate-200">
                              <span className="text-[#64748B] text-[11px] block">
                                Total Bruto Rescisório:
                              </span>
                              <span className="text-base font-mono font-bold text-slate-900">
                                R${' '}
                                {Number(ficha.rescisao.total_bruto_rescisao || 0).toLocaleString(
                                  'pt-BR',
                                  {
                                    minimumFractionDigits: 2,
                                  },
                                )}
                              </span>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-200">
                              <span className="text-[#64748B] text-[11px] block">
                                Multa FGTS 40%:
                              </span>
                              <span className="text-base font-mono font-bold text-indigo-700">
                                R${' '}
                                {Number(
                                  ficha.rescisao.valor_multa_rescisoria_fgts || 0,
                                ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-200">
                              <span className="text-[#64748B] text-[11px] block">
                                Líquido do TRCT:
                              </span>
                              <span className="text-base font-mono font-bold text-emerald-700">
                                R${' '}
                                {Number(ficha.rescisao.total_liquido_rescisao || 0).toLocaleString(
                                  'pt-BR',
                                  {
                                    minimumFractionDigits: 2,
                                  },
                                )}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  )}
                </>
              )}
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Modal Visualizador de XML e-Social */}
      <Dialog open={modalXmlOpen} onOpenChange={setModalXmlOpen}>
        <DialogContent className="max-w-3xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-bold text-[#1A2333]">
              <FileCode2 className="h-4 w-4 text-[#0FA3A3]" />
              <span>XML Estruturado — {xmlVisualizando?.titulo}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Arquivo no padrão nacional SPED / e-Social (Layout Oficial S-1.1).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopiarXml(xmlVisualizando?.conteudo || '')}
                className="h-8 text-xs font-semibold gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copiar XML</span>
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  handleBaixarXml(
                    xmlVisualizando?.titulo || 'esocial',
                    xmlVisualizando?.conteudo || '',
                  )
                }
                className="h-8 text-xs font-semibold gap-1.5 bg-[#0FA3A3] text-white hover:bg-[#0C8585]"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Baixar .XML</span>
              </Button>
            </div>

            <div className="relative">
              <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono max-h-[400px] overflow-auto whitespace-pre-wrap leading-relaxed border border-slate-800">
                {xmlVisualizando?.conteudo}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

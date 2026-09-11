import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  MessageSquare,
  Sparkles,
  FileCheck,
  CheckCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  Send,
  Building2,
  DollarSign,
  FileText,
  Filter,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Eye,
  Check,
  X,
  Code,
  Download,
  Radio,
  ExternalLink,
  ChevronRight,
  Info,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import type {
  NfseConfigRecord,
  NfseSolicitacaoRecord,
  NfseNotaEmitidaRecord,
  Empresa,
} from '@/types'
import { nfseWhatsappService } from '@/services/nfseWhatsapp'
import { empresasService } from '@/services/empresas'
import { maskCnpj, maskCpf, formatDatePtBr, formatDateTimePtBr } from '@/lib/formatters'

// Subcomponentes modais
import { NfseAprovacaoModal } from '@/components/NfseAprovacaoModal'
import { NfseRejeicaoModal } from '@/components/NfseRejeicaoModal'
import { NfseChatLogModal } from '@/components/NfseChatLogModal'
import { NfseVisualizadorModal } from '@/components/NfseVisualizadorModal'
import { NfseConfigTab } from '@/components/NfseConfigTab'

export default function NfseWhatsappPage() {
  const { tenant, user } = useAuth()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<'supervisao' | 'historico' | 'config'>('supervisao')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Dados
  const [config, setConfig] = useState<NfseConfigRecord | null>(null)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [solicitacoes, setSolicitacoes] = useState<NfseSolicitacaoRecord[]>([])
  const [notasEmitidas, setNotasEmitidas] = useState<NfseNotaEmitidaRecord[]>([])

  // Filtros da Fila
  const [statusFiltro, setStatusFiltro] = useState<string>('todos')
  const [buscaTexto, setBuscaTexto] = useState<string>('')

  // Modais
  const [solicitacaoParaAprovar, setSolicitacaoParaAprovar] =
    useState<NfseSolicitacaoRecord | null>(null)
  const [modalAprovarOpen, setModalAprovarOpen] = useState(false)

  const [solicitacaoParaRejeitar, setSolicitacaoParaRejeitar] =
    useState<NfseSolicitacaoRecord | null>(null)
  const [modalRejeitarOpen, setModalRejeitarOpen] = useState(false)

  const [solicitacaoParaChat, setSolicitacaoParaChat] = useState<NfseSolicitacaoRecord | null>(null)
  const [modalChatOpen, setModalChatOpen] = useState(false)

  const [notaParaVisualizar, setNotaParaVisualizar] = useState<NfseNotaEmitidaRecord | null>(null)
  const [modalDanfseOpen, setModalDanfseOpen] = useState(false)

  const canEmit = user?.perfil === 'administrador' || user?.perfil === 'contador'

  // Carregar dados
  const loadData = async (silencioso = false) => {
    if (!tenant?.id) return
    if (!silencioso) setLoading(true)
    else setRefreshing(true)

    try {
      const [cfgRes, empRes, solRes, notasRes] = await Promise.all([
        nfseWhatsappService.getConfig(tenant.id),
        empresasService.list(tenant.id),
        nfseWhatsappService.listSolicitacoes(tenant.id),
        nfseWhatsappService.listNotasEmitidas(tenant.id),
      ])

      setConfig(cfgRes)
      setEmpresas(empRes)
      setSolicitacoes(solRes)
      setNotasEmitidas(notasRes)
    } catch (err) {
      console.error('Erro ao carregar módulo NFS-e WhatsApp:', err)
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar a fila de supervisão de NFS-e.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [tenant?.id])

  // Métricas para os Cards de Resumo
  const totalRecebidas = solicitacoes.length
  const emAnalise = solicitacoes.filter((s) => s.status === 'em_analise').length
  const totalEmitidas = notasEmitidas.length
  const valorTotalEmitido = notasEmitidas.reduce((acc, n) => acc + (n.valor_servicos || 0), 0)

  // Filtragem da Fila
  const solicitacoesFiltradas = useMemo(() => {
    return solicitacoes.filter((sol) => {
      if (statusFiltro !== 'todos' && sol.status !== statusFiltro) return false
      if (buscaTexto.trim()) {
        const q = buscaTexto.toLowerCase()
        const matchNome = sol.tomador_nome?.toLowerCase().includes(q)
        const matchDoc = sol.tomador_documento?.toLowerCase().includes(q)
        const matchContato = sol.contato_nome?.toLowerCase().includes(q)
        const matchMsg = sol.mensagem_original?.toLowerCase().includes(q)
        if (!matchNome && !matchDoc && !matchContato && !matchMsg) return false
      }
      return true
    })
  }, [solicitacoes, statusFiltro, buscaTexto])

  const empresaMap = useMemo(() => {
    const map = new Map<string, Empresa>()
    empresas.forEach((emp) => map.set(emp.id, emp))
    return map
  }, [empresas])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header com Contexto do Framework */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-[#1A2333]">
              Emissão Inteligente de NFS-e via WhatsApp
            </h2>
            <Badge className="bg-[#0FA3A3] text-white text-[10px] font-bold">
              FRAMEWORK INTEGRADO
            </Badge>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Fluxo automatizado de ponta a ponta: Webhook & Bot ➔ Motor Cognitivo IA ➔ Painel de
            Supervisão ➔ API Fiscal ➔ Retorno ao WhatsApp
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-xs bg-amber-50 text-amber-700 border-amber-200 py-1 px-2.5 font-medium flex items-center gap-1.5 shadow-xs"
            title="A plataforma está configurada em modo simulação controlada, gerando XMLs nacionais válidos e DANFSE com número sequencial sem cobrança real na prefeitura."
          >
            <Radio className="h-3 w-3 text-amber-500 animate-pulse" />
            Modo Simulação Controlada
          </Badge>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={loading || refreshing}
            className="text-xs gap-1.5 h-8"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Arquitetura Visual em Banner das 8 Etapas */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <span className="text-xs font-bold text-[#1A2333] uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-[#0FA3A3]" />
            Arquitetura Operacional do Módulo
          </span>
          <span className="text-[11px] text-[#64748B]">
            Etapas numeradas conforme arquitetura oficial
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-center">
          <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-2.5 text-left">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#0FA3A3]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0FA3A3] text-white text-[10px]">
                1
              </span>
              WhatsApp In
            </div>
            <p className="text-[10px] text-[#475569] mt-1 leading-tight">
              Cliente envia solicitação de emissão via WhatsApp.
            </p>
          </div>

          <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-2.5 text-left">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#0FA3A3]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0FA3A3] text-white text-[10px]">
                2
              </span>
              Motor IA
            </div>
            <p className="text-[10px] text-[#475569] mt-1 leading-tight">
              Extrai tomador, CNPJ, valor e gera score de confiança.
            </p>
          </div>

          <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-2.5 text-left">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#0FA3A3]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0FA3A3] text-white text-[10px]">
                3 & 4
              </span>
              Supervisão
            </div>
            <p className="text-[10px] text-[#475569] mt-1 leading-tight">
              Contador confere na tela, edita dados ou rejeita.
            </p>
          </div>

          <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-2.5 text-left">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#0FA3A3]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0FA3A3] text-white text-[10px]">
                5
              </span>
              Engine Fiscal
            </div>
            <p className="text-[10px] text-[#475569] mt-1 leading-tight">
              Emissão da NFS-e (gov.br / prefeitura em simulação).
            </p>
          </div>

          <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-2.5 text-left">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#0FA3A3]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0FA3A3] text-white text-[10px]">
                6
              </span>
              XML / PDF
            </div>
            <p className="text-[10px] text-[#475569] mt-1 leading-tight">
              Gera DANFSE e XML oficial ABRASF para download.
            </p>
          </div>

          <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-2.5 text-left">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#0FA3A3]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0FA3A3] text-white text-[10px]">
                8
              </span>
              WhatsApp Out
            </div>
            <p className="text-[10px] text-[#475569] mt-1 leading-tight">
              Devolve confirmação com número da nota e link do PDF.
            </p>
          </div>
        </div>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
              Mensagens Recebidas
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-[#0FA3A3]">
              <MessageSquare className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1A2333]">{totalRecebidas}</div>
            <p className="text-[11px] text-[#94A3B8] mt-1">Via Webhook Evolution / Baileys</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
              Solicitações em Análise
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{emAnalise}</div>
            <p className="text-[11px] text-[#94A3B8] mt-1">Aguardando supervisão contábil</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
              Notas Emitidas
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <FileCheck className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{totalEmitidas}</div>
            <p className="text-[11px] text-[#94A3B8] mt-1">Com XML e DANFSE gerados</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
              Valor Total Emitido
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1A2333]">
              {valorTotalEmitido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-1">Competência atual</p>
          </CardContent>
        </Card>
      </div>

      {/* Navegação por Abas */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="supervisao" className="text-xs font-semibold rounded-lg gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            Fila de Supervisão (Etapa 4)
            {emAnalise > 0 && (
              <Badge className="bg-amber-500 text-white text-[10px] ml-1 px-1.5 py-0 h-4">
                {emAnalise}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="historico" className="text-xs font-semibold rounded-lg gap-2">
            <FileText className="h-3.5 w-3.5" />
            Histórico de Notas Emitidas (XML/PDF)
            <Badge variant="outline" className="text-[10px] ml-1 px-1.5 py-0 h-4">
              {totalEmitidas}
            </Badge>
          </TabsTrigger>

          <TabsTrigger value="config" className="text-xs font-semibold rounded-lg gap-2">
            <Settings className="h-3.5 w-3.5" />
            Configuração do Canal WhatsApp
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: FILA DE SUPERVISÃO */}
        <TabsContent value="supervisao" className="space-y-4 pt-2">
          {/* Barra de Filtros e Busca */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8]" />
              <Input
                placeholder="Buscar por tomador, CNPJ, contato ou texto original..."
                value={buscaTexto}
                onChange={(e) => setBuscaTexto(e.target.value)}
                className="h-8 pl-8 text-xs bg-slate-50 border-slate-200"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#64748B] font-medium hidden sm:inline">Status:</span>
              <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="text-xs">
                    Todos os Status
                  </SelectItem>
                  <SelectItem value="em_analise" className="text-xs">
                    Em Análise
                  </SelectItem>
                  <SelectItem value="emitida" className="text-xs">
                    Emitida
                  </SelectItem>
                  <SelectItem value="rejeitada" className="text-xs">
                    Rejeitada
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabela da Fila de Supervisão */}
          <Card className="rounded-2xl border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs font-bold text-[#1A2333] w-48">
                      Contato / Horário
                    </TableHead>
                    <TableHead className="text-xs font-bold text-[#1A2333]">
                      Dados Extraídos (IA) vs Original
                    </TableHead>
                    <TableHead className="text-xs font-bold text-[#1A2333] w-32">Valor</TableHead>
                    <TableHead className="text-xs font-bold text-[#1A2333] w-28">
                      Confiança
                    </TableHead>
                    <TableHead className="text-xs font-bold text-[#1A2333] w-28">Status</TableHead>
                    <TableHead className="text-xs font-bold text-[#1A2333] text-right w-44">
                      Ações de Supervisão
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {solicitacoesFiltradas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center text-xs text-[#94A3B8]">
                        Nenhuma solicitação encontrada para os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    solicitacoesFiltradas.map((sol) => {
                      const temAlertas = sol.alertas_json && sol.alertas_json.length > 0
                      const score = sol.score_confianca || 0

                      return (
                        <TableRow key={sol.id} className="hover:bg-slate-50/70 transition-colors">
                          <TableCell className="align-top py-3.5">
                            <div className="font-semibold text-xs text-[#1A2333]">
                              {sol.contato_nome}
                            </div>
                            <div className="text-[11px] text-[#64748B] font-mono">
                              {sol.contato_telefone}
                            </div>
                            <div className="text-[10px] text-[#94A3B8] mt-1 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDateTimePtBr(sol.created)}
                            </div>
                          </TableCell>

                          <TableCell className="align-top py-3.5 max-w-md">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[#1A2333]">
                                  {sol.tomador_nome || 'Tomador não identificado'}
                                </span>
                                {sol.tomador_documento && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] font-mono bg-slate-50"
                                  >
                                    {sol.tomador_documento}
                                  </Badge>
                                )}
                              </div>

                              <p className="text-[11px] text-[#64748B] line-clamp-2">
                                {sol.descricao_servico || sol.mensagem_original}
                              </p>

                              {/* Alertas de inconsistência */}
                              {temAlertas && (
                                <div className="space-y-1 pt-1">
                                  {sol.alertas_json?.map((al, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center gap-1.5 text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md"
                                    >
                                      <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                                      <span>{al.mensagem}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="align-top py-3.5">
                            <div className="font-bold text-xs text-[#1A2333]">
                              {(sol.valor_servico || 0).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </div>
                            <div className="text-[10px] text-[#94A3B8]">
                              Cód: {sol.codigo_servico || '01.07'}
                            </div>
                          </TableCell>

                          <TableCell className="align-top py-3.5">
                            <Badge
                              className={
                                score >= 85
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : score >= 60
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                              }
                            >
                              {score}%
                            </Badge>
                          </TableCell>

                          <TableCell className="align-top py-3.5">
                            <Badge
                              variant="outline"
                              className={
                                sol.status === 'emitida'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : sol.status === 'em_analise'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : sol.status === 'rejeitada'
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : 'bg-slate-50 text-slate-700'
                              }
                            >
                              {sol.status === 'em_analise'
                                ? 'Em Análise'
                                : sol.status === 'emitida'
                                  ? 'Emitida'
                                  : sol.status === 'rejeitada'
                                    ? 'Rejeitada'
                                    : sol.status}
                            </Badge>
                          </TableCell>

                          <TableCell className="align-top py-3.5 text-right space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSolicitacaoParaChat(sol)
                                setModalChatOpen(true)
                              }}
                              className="h-8 px-2 text-xs text-[#64748B] hover:text-[#0FA3A3]"
                              title="Ver histórico de mensagens e responder no chat"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </Button>

                            {sol.status === 'em_analise' && canEmit && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSolicitacaoParaRejeitar(sol)
                                    setModalRejeitarOpen(true)
                                  }}
                                  className="h-8 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                  title="Rejeitar com motivo de inconsistência"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>

                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSolicitacaoParaAprovar(sol)
                                    setModalAprovarOpen(true)
                                  }}
                                  className="h-8 px-2.5 text-xs bg-[#0FA3A3] hover:bg-[#0d8c8c] text-white gap-1"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Emitir
                                </Button>
                              </>
                            )}

                            {sol.status === 'emitida' && (
                              <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">
                                Concluída
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ABA 2: HISTÓRICO DE NOTAS EMITIDAS */}
        <TabsContent value="historico" className="space-y-4 pt-2">
          <Card className="rounded-2xl border-slate-200 shadow-xs overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-[#1A2333]">
                  Notas Fiscais de Serviço Emitidas (Etapas 5 e 6)
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  Documentos gerados com layout nacional ABRASF, XML completo e DANFSE para
                  impressão.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs bg-slate-50">
                Total: {notasEmitidas.length} notas
              </Badge>
            </CardHeader>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs font-bold text-[#1A2333] w-28">Nº Nota</TableHead>
                    <TableHead className="text-xs font-bold text-[#1A2333] w-36">
                      Emissão / Comp.
                    </TableHead>
                    <TableHead className="text-xs font-bold text-[#1A2333]">
                      Empresa Prestadora
                    </TableHead>
                    <TableHead className="text-xs font-bold text-[#1A2333]">
                      Tomador de Serviços
                    </TableHead>
                    <TableHead className="text-xs font-bold text-[#1A2333] text-right">
                      Valor Serviços
                    </TableHead>
                    <TableHead className="text-xs font-bold text-[#1A2333] text-right">
                      ISS / Líquido
                    </TableHead>
                    <TableHead className="text-xs font-bold text-[#1A2333] text-right w-44">
                      Documentos
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {notasEmitidas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-xs text-[#94A3B8]">
                        Nenhuma nota fiscal emitida até o momento.
                      </TableCell>
                    </TableRow>
                  ) : (
                    notasEmitidas.map((nota) => {
                      const emp = empresaMap.get(nota.empresa)
                      return (
                        <TableRow key={nota.id} className="hover:bg-slate-50/70 transition-colors">
                          <TableCell className="align-middle">
                            <span className="font-bold text-xs text-[#0284C7] font-mono">
                              Nº {nota.numero_nota}
                            </span>
                            <div className="text-[10px] text-[#94A3B8] font-mono">
                              Cód: {nota.codigo_verificacao}
                            </div>
                          </TableCell>

                          <TableCell className="align-middle">
                            <div className="text-xs text-[#1A2333] font-medium">
                              {formatDatePtBr(nota.data_emissao)}
                            </div>
                            <div className="text-[10px] text-[#64748B]">
                              Comp: {nota.competencia}
                            </div>
                          </TableCell>

                          <TableCell className="align-middle">
                            <div className="text-xs font-medium text-[#1A2333]">
                              {emp?.razao_social || 'Inovatech Soluções'}
                            </div>
                            <div className="text-[10px] text-[#64748B]">
                              {emp?.cnpj ? maskCnpj(emp.cnpj) : '—'}
                            </div>
                          </TableCell>

                          <TableCell className="align-middle">
                            <div className="text-xs font-bold text-[#1A2333]">
                              {nota.tomador_nome}
                            </div>
                            <div className="text-[10px] text-[#64748B] font-mono">
                              {nota.tomador_documento}
                            </div>
                          </TableCell>

                          <TableCell className="align-middle text-right font-bold text-xs text-[#1A2333]">
                            {nota.valor_servicos.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </TableCell>

                          <TableCell className="align-middle text-right">
                            <div className="text-xs font-bold text-[#0FA3A3]">
                              {nota.valor_liquido.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </div>
                            <div className="text-[10px] text-[#64748B]">
                              ISS:{' '}
                              {(nota.valor_iss || 0).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </div>
                          </TableCell>

                          <TableCell className="align-middle text-right space-x-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setNotaParaVisualizar(nota)
                                setModalDanfseOpen(true)
                              }}
                              className="h-8 px-2.5 text-xs text-[#0FA3A3] border-[#0FA3A3]/30 hover:bg-[#0FA3A3]/10 gap-1"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              DANFSE
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ABA 3: CONFIGURAÇÃO DO CANAL WHATSAPP */}
        <TabsContent value="config" className="pt-2">
          {tenant && (
            <NfseConfigTab
              config={config}
              empresas={empresas}
              tenantId={tenant.id}
              onRefresh={() => loadData(true)}
              currentUserId={user?.id}
              canEdit={canEmit}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Modais Operacionais */}
      <NfseAprovacaoModal
        solicitacao={solicitacaoParaAprovar}
        empresas={empresas}
        open={modalAprovarOpen}
        onOpenChange={setModalAprovarOpen}
        onSuccess={() => loadData(true)}
        currentUserId={user?.id}
      />

      <NfseRejeicaoModal
        solicitacao={solicitacaoParaRejeitar}
        open={modalRejeitarOpen}
        onOpenChange={setModalRejeitarOpen}
        onSuccess={() => loadData(true)}
        currentUserId={user?.id}
      />

      <NfseChatLogModal
        solicitacao={solicitacaoParaChat}
        open={modalChatOpen}
        onOpenChange={setModalChatOpen}
        onSuccess={() => loadData(true)}
      />

      <NfseVisualizadorModal
        nota={notaParaVisualizar}
        empresa={notaParaVisualizar ? empresaMap.get(notaParaVisualizar.empresa) : undefined}
        open={modalDanfseOpen}
        onOpenChange={setModalDanfseOpen}
      />
    </div>
  )
}

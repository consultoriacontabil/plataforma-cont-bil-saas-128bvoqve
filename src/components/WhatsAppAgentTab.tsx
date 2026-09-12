import React, { useState, useEffect, useRef } from 'react'
import {
  MessageSquare,
  Bot,
  User as UserIcon,
  Send,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertTriangle,
  Play,
  RotateCw,
  Sliders,
  Settings,
  Building2,
  HelpCircle,
  FileText,
  Check,
  ArrowRight,
  Info,
  Calendar,
  XCircle,
  Filter,
  Search,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
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
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import type {
  NfseConfigRecord,
  WaAtendimentoConversaRecord,
  WaAtendimentoMensagemRecord,
  Empresa,
  User,
} from '@/types'
import { whatsappAgentService } from '@/services/whatsappAgent'
import { formatDateTimePtBr } from '@/lib/formatters'

interface WhatsAppAgentTabProps {
  config: NfseConfigRecord | null
  empresas: Empresa[]
  tenantId: string
  user: User | null
  onConfigUpdated: () => void
}

export const WhatsAppAgentTab: React.FC<WhatsAppAgentTabProps> = ({
  config,
  empresas,
  tenantId,
  user,
  onConfigUpdated,
}) => {
  const { toast } = useToast()

  // Permissões: Cliente não acessa config; Contador/Admin configuram; Auxiliar lê conversas
  const perfil = user?.perfil || 'auxiliar'
  const canEditConfig = perfil === 'administrador' || perfil === 'contador'
  const isCliente = perfil === 'cliente'

  // Estados de Configuração do Agente IA
  const [iaAtiva, setIaAtiva] = useState<boolean>(config?.ia_ativa ?? true)
  const [iaModoOperacao, setIaModoOperacao] = useState<'supervisionado' | 'autonomo_duvidas'>(
    config?.ia_modo_operacao || 'autonomo_duvidas',
  )
  const [iaMsgBoasVindas, setIaMsgBoasVindas] = useState<string>(
    config?.ia_mensagem_boas_vindas ||
      'Olá! Sou o assistente virtual da Rumo Consultoria Contábil. Como posso ajudar sua empresa hoje? Posso consultar prazos de obrigações, guias de impostos, status de NFS-e ou documentos.',
  )
  const [iaHoraInicio, setIaHoraInicio] = useState<string>(config?.ia_horario_inicio || '08:30')
  const [iaHoraFim, setIaHoraFim] = useState<string>(config?.ia_horario_fim || '18:00')
  const [iaMsgForaHorario, setIaMsgForaHorario] = useState<string>(
    config?.ia_mensagem_fora_horario ||
      'Olá! Nosso horário de atendimento contábil é de segunda a sexta, das 08:30 às 18:00. Sua mensagem foi registrada e o contador responsável responderá no próximo dia útil.',
  )
  const [salvandoConfig, setSalvandoConfig] = useState(false)

  // Estado do Teste do Agente
  const [modalTestarOpen, setModalTestarOpen] = useState(false)
  const [perguntaTeste, setPerguntaTeste] = useState('')
  const [empresaTeste, setEmpresaTeste] = useState<string>(
    empresas.length > 0 ? empresas[0].id : '',
  )
  const [testandoAgente, setTestandoAgente] = useState(false)
  const [respostaTeste, setRespostaTeste] = useState<string | null>(null)
  const [tempoRespostaTeste, setTempoRespostaTeste] = useState<string | null>(null)

  // Estados do Painel de Conversas
  const [conversas, setConversas] = useState<WaAtendimentoConversaRecord[]>([])
  const [loadingConversas, setLoadingConversas] = useState(true)
  const [statusFiltro, setStatusFiltro] = useState<string>('todos')
  const [empresaFiltro, setEmpresaFiltro] = useState<string>('todas')
  const [buscaTexto, setBuscaTexto] = useState('')

  // Conversa Selecionada
  const [conversaAtiva, setConversaAtiva] = useState<WaAtendimentoConversaRecord | null>(null)
  const [mensagens, setMensagens] = useState<WaAtendimentoMensagemRecord[]>([])
  const [loadingMensagens, setLoadingMensagens] = useState(false)
  const [respostaManual, setRespostaManual] = useState('')
  const [enviandoMensagem, setEnviandoMensagem] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Carregar conversas
  const carregarConversas = async (silencioso = false) => {
    if (!silencioso) setLoadingConversas(true)
    try {
      const lista = await whatsappAgentService.listConversas(tenantId, {
        status: statusFiltro,
        empresaId: empresaFiltro,
        busca: buscaTexto,
      })
      setConversas(lista)
      if (conversaAtiva) {
        const atualizada = lista.find((c) => c.id === conversaAtiva.id)
        if (atualizada) setConversaAtiva(atualizada)
      } else if (lista.length > 0 && !conversaAtiva) {
        setConversaAtiva(lista[0])
      }
    } catch (err) {
      console.error('Erro ao listar conversas:', err)
    } finally {
      setLoadingConversas(false)
    }
  }

  useEffect(() => {
    carregarConversas()
  }, [tenantId, statusFiltro, empresaFiltro])

  // Carregar mensagens quando a conversa ativa muda
  useEffect(() => {
    if (!conversaAtiva) {
      setMensagens([])
      return
    }
    const loadMsgs = async () => {
      setLoadingMensagens(true)
      try {
        const msgs = await whatsappAgentService.listMensagens(conversaAtiva.id)
        setMensagens(msgs)
      } catch (err) {
        console.error('Erro ao carregar mensagens:', err)
      } finally {
        setLoadingMensagens(false)
      }
    }
    loadMsgs()
  }, [conversaAtiva?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  // Salvar configurações
  const handleSalvarConfig = async () => {
    if (!config?.id) return
    setSalvandoConfig(true)
    try {
      await whatsappAgentService.salvarConfigIa(
        config.id,
        tenantId,
        {
          ia_ativa: iaAtiva,
          ia_modo_operacao: iaModoOperacao,
          ia_mensagem_boas_vindas: iaMsgBoasVindas,
          ia_horario_inicio: iaHoraInicio,
          ia_horario_fim: iaHoraFim,
          ia_mensagem_fora_horario: iaMsgForaHorario,
        },
        user?.id,
      )
      toast({
        title: 'Configuração do Agente salva',
        description: 'Os parâmetros do Agente de IA no WhatsApp foram atualizados com sucesso.',
      })
      onConfigUpdated()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast({
        title: 'Erro ao salvar configuração',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setSalvandoConfig(false)
    }
  }

  // Executar teste do agente
  const handleExecutarTeste = async () => {
    if (!perguntaTeste.trim()) return
    setTestandoAgente(true)
    setRespostaTeste(null)
    setTempoRespostaTeste(null)
    try {
      const inicio = Date.now()
      const res = await whatsappAgentService.testarAgente({
        tenantId,
        mensagem: perguntaTeste,
        empresaId: empresaTeste || undefined,
      })
      const duracao = ((Date.now() - inicio) / 1000).toFixed(1)
      setRespostaTeste(res.resposta)
      setTempoRespostaTeste(`${duracao}s`)
      toast({
        title: 'Resposta do Agente Nativo recebida',
        description: `Processado com sucesso pelo agente em ${duracao}s.`,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setRespostaTeste(`[Erro na chamada do agente nativo]: ${msg}`)
      toast({
        title: 'Falha no teste do agente',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setTestandoAgente(false)
    }
  }

  // Enviar resposta manual ou aprovar sugestão
  const handleEnviarMensagem = async (sugestaoId?: string, conteudoPersonalizado?: string) => {
    if (!conversaAtiva) return
    const texto = (conteudoPersonalizado || respostaManual).trim()
    if (!texto) return

    setEnviandoMensagem(true)
    try {
      const res = await whatsappAgentService.enviarMensagem({
        conversaId: conversaAtiva.id,
        conteudo: texto,
        mensagemId: sugestaoId,
      })
      setRespostaManual('')
      const atualizadas = await whatsappAgentService.listMensagens(conversaAtiva.id)
      setMensagens(atualizadas)
      carregarConversas(true)
      toast({
        title: 'Mensagem despachada',
        description:
          res.evolution_dispatch === 'enviado_real'
            ? 'Enviada via Evolution API para o WhatsApp do cliente.'
            : 'Registrada com sucesso (Modo Demonstração / Simulação sem Evolution API).',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast({
        title: 'Erro ao despachar mensagem',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setEnviandoMensagem(false)
    }
  }

  const isEvolutionConfigured = !!(
    config?.evolution_api_url &&
    config?.evolution_api_key &&
    config?.evolution_instance
  )

  return (
    <div className="space-y-6">
      {/* Banner de Status e Transparência */}
      <div className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-500/10 via-cyan-500/5 to-transparent p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0FA3A3] text-white shadow-sm">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#1A2333]">
                Agente Contábil de Atendimento no WhatsApp (Skip Cloud Native)
              </h3>
              <Badge
                className={
                  iaAtiva
                    ? 'bg-emerald-600 text-white text-[10px]'
                    : 'bg-slate-400 text-white text-[10px]'
                }
              >
                {iaAtiva ? 'AGENTE ATIVO' : 'AGENTE INATIVO'}
              </Badge>
              <Badge
                variant="outline"
                className="text-[10px] border-teal-300 text-teal-800 bg-teal-50"
              >
                {iaModoOperacao === 'supervisionado'
                  ? 'Modo Supervisionado'
                  : 'Autônomo p/ Dúvidas'}
              </Badge>
            </div>
            <p className="text-xs text-[#475569] mt-0.5 max-w-2xl leading-relaxed">
              Responde perguntas dos clientes usando <strong>exclusivamente dados do tenant</strong>{' '}
              (obrigações, guias, documentos, férias e NFS-e). Atos fiscais (emissão/cancelamento)
              são <strong>obrigatoriamente escalados para supervisão do contador</strong> no modo
              assistivo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isEvolutionConfigured && (
            <Badge
              variant="outline"
              className="bg-amber-50 text-amber-800 border-amber-300 text-[11px] py-1 px-2.5 font-medium flex items-center gap-1.5"
              title="A Evolution API não está cadastrada. Todas as respostas e interações operam em Modo Simulação com transparência."
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              Modo Simulação / Demonstração
            </Badge>
          )}

          <Button
            onClick={() => setModalTestarOpen(true)}
            className="bg-[#0FA3A3] hover:bg-[#0c8787] text-white text-xs gap-1.5 h-9 font-semibold shadow-xs"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Testar Agente Nativo
          </Button>
        </div>
      </div>

      {/* Grid Principal: Painel de Conversas (Esquerda) e Configuração / Detalhes (Direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUNA ESQUERDA: LISTA DE CONVERSAS (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="rounded-2xl border-slate-200 shadow-xs overflow-hidden">
            <CardHeader className="p-4 pb-3 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold text-[#1A2333] uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[#0FA3A3]" />
                  Conversas no WhatsApp ({conversas.length})
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => carregarConversas(true)}
                  className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800"
                  title="Atualizar conversas"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Filtros rápidos */}
              <div className="space-y-2 pt-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Buscar contato, telefone ou texto..."
                    value={buscaTexto}
                    onChange={(e) => setBuscaTexto(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && carregarConversas()}
                    className="h-7 pl-8 text-xs bg-white border-slate-200"
                  />
                </div>

                <div className="flex gap-2">
                  <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                    <SelectTrigger className="h-7 text-[11px] flex-1">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos" className="text-xs">
                        Todos os status
                      </SelectItem>
                      <SelectItem
                        value="escalada_humano"
                        className="text-xs text-amber-700 font-semibold"
                      >
                        Escaladas p/ Humano
                      </SelectItem>
                      <SelectItem value="em_atendimento" className="text-xs text-blue-700">
                        Em Atendimento
                      </SelectItem>
                      <SelectItem
                        value="resolvida_ia"
                        className="text-xs text-emerald-700 font-semibold"
                      >
                        Respondidas por IA
                      </SelectItem>
                      <SelectItem value="encerrada" className="text-xs text-slate-500">
                        Encerradas
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={empresaFiltro} onValueChange={setEmpresaFiltro}>
                    <SelectTrigger className="h-7 text-[11px] flex-1">
                      <SelectValue placeholder="Empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas" className="text-xs">
                        Todas as Empresas
                      </SelectItem>
                      {empresas.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id} className="text-xs truncate">
                          {emp.nome_fantasia || emp.razao_social}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 max-h-[580px] overflow-y-auto divide-y divide-slate-100">
              {loadingConversas ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Carregando conversas do WhatsApp...
                </div>
              ) : conversas.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Nenhuma conversa encontrada com os filtros selecionados.
                </div>
              ) : (
                conversas.map((conv) => {
                  const isSelected = conversaAtiva?.id === conv.id
                  const empNome =
                    conv.expand?.empresa?.nome_fantasia ||
                    conv.expand?.empresa?.razao_social ||
                    'Empresa não identificada'

                  return (
                    <button
                      key={conv.id}
                      onClick={() => setConversaAtiva(conv)}
                      className={`w-full text-left p-3.5 transition-colors flex flex-col gap-1.5 ${
                        isSelected
                          ? 'bg-teal-50/80 border-l-4 border-[#0FA3A3]'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-[#1A2333] truncate max-w-[190px]">
                          {conv.contato_nome}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {conv.ultima_interacao
                            ? formatDateTimePtBr(conv.ultima_interacao).split(' ')[1]
                            : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                        <span>{conv.contato_telefone}</span>
                        <span>•</span>
                        <span className="truncate text-slate-600 font-sans font-medium">
                          {empNome}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                        {conv.ultima_mensagem || 'Sem mensagens recentes'}
                      </p>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1.5">
                          {conv.status === 'escalada_humano' && (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[9px] px-1.5 py-0">
                              Escalada (Ato Fiscal)
                            </Badge>
                          )}
                          {conv.status === 'resolvida_ia' && (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[9px] px-1.5 py-0">
                              Atendido por IA
                            </Badge>
                          )}
                          {conv.status === 'em_atendimento' && (
                            <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[9px] px-1.5 py-0">
                              Em Atendimento
                            </Badge>
                          )}
                          {conv.status === 'aberta' && (
                            <Badge className="bg-slate-100 text-slate-700 text-[9px] px-1.5 py-0">
                              Nova
                            </Badge>
                          )}
                        </div>

                        {/* Badges de Transparência de Respostas */}
                        <div className="flex items-center gap-1 text-[9px] text-slate-500">
                          <span
                            className="flex items-center gap-0.5 px-1 rounded bg-teal-50 text-[#0FA3A3] font-semibold"
                            title="Respostas geradas por IA"
                          >
                            <Bot className="h-2.5 w-2.5" />
                            {conv.total_respostas_ia || 0}
                          </span>
                          <span
                            className="flex items-center gap-0.5 px-1 rounded bg-blue-50 text-blue-700 font-semibold"
                            title="Respostas dadas por atendente humano"
                          >
                            <UserIcon className="h-2.5 w-2.5" />
                            {conv.total_respostas_humano || 0}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* COLUNA CENTRAL / DIREITA: CHAT DA CONVERSA & HISTÓRICO (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="rounded-2xl border-slate-200 shadow-xs overflow-hidden flex flex-col h-[650px]">
            {/* Header do Chat */}
            <div className="p-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
              {conversaAtiva ? (
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#1A2333]">
                      {conversaAtiva.contato_nome}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono bg-white">
                      {conversaAtiva.contato_telefone}
                    </Badge>
                    {conversaAtiva.status === 'escalada_humano' && (
                      <Badge className="bg-amber-500 text-white text-[9px] px-1.5">
                        Supervisão Requerida
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Empresa:{' '}
                    <strong>
                      {conversaAtiva.expand?.empresa?.nome_fantasia ||
                        conversaAtiva.expand?.empresa?.razao_social ||
                        'Geral'}
                    </strong>
                  </p>
                </div>
              ) : (
                <span className="text-xs text-slate-400">Nenhuma conversa selecionada</span>
              )}

              {conversaAtiva && (
                <div className="flex items-center gap-1.5">
                  <Select
                    value={conversaAtiva.status}
                    onValueChange={async (novoStatus: any) => {
                      try {
                        await whatsappAgentService.atualizarStatusConversa(
                          conversaAtiva.id,
                          novoStatus,
                          user?.id,
                        )
                        setConversaAtiva((prev) => (prev ? { ...prev, status: novoStatus } : null))
                        carregarConversas(true)
                        toast({ title: 'Status da conversa atualizado' })
                      } catch (e) {
                        toast({ title: 'Erro ao atualizar status', variant: 'destructive' })
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 text-[11px] w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aberta" className="text-xs">
                        Aberta
                      </SelectItem>
                      <SelectItem value="em_atendimento" className="text-xs">
                        Em Atendimento
                      </SelectItem>
                      <SelectItem value="escalada_humano" className="text-xs text-amber-700">
                        Escalada Humano
                      </SelectItem>
                      <SelectItem value="resolvida_ia" className="text-xs text-emerald-700">
                        Resolvida IA
                      </SelectItem>
                      <SelectItem value="encerrada" className="text-xs text-slate-500">
                        Encerrada
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Corpo das Mensagens */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#F8FAFC]">
              {loadingMensagens ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Carregando mensagens da conversa...
                </div>
              ) : mensagens.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Nenhuma mensagem registrada nesta conversa.
                </div>
              ) : (
                mensagens.map((msg) => {
                  const isCliente = msg.remetente_tipo === 'cliente'
                  const isIa = msg.remetente_tipo === 'ia'
                  const isHumano = msg.remetente_tipo === 'humano'
                  const isSistema = msg.remetente_tipo === 'sistema'
                  const pendenteAprovacao = msg.status_envio === 'sugerida_ia'

                  if (isSistema) {
                    return (
                      <div key={msg.id} className="text-center my-2">
                        <span className="inline-block text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full font-medium shadow-2xs">
                          {msg.conteudo}
                        </span>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isCliente ? 'items-start' : 'items-end'}`}
                    >
                      {/* Badge de Transparência do Remetente */}
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1 px-1">
                        {isCliente && <span className="font-semibold text-slate-600">Cliente</span>}
                        {isIa && (
                          <span className="flex items-center gap-1 font-semibold text-[#0FA3A3] bg-teal-50 px-1.5 py-0.5 rounded">
                            <Bot className="h-3 w-3" />
                            Agente IA Nativo
                          </span>
                        )}
                        {isHumano && (
                          <span className="flex items-center gap-1 font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                            <UserIcon className="h-3 w-3" />
                            Contador / Atendente
                          </span>
                        )}
                        <span>{formatDateTimePtBr(msg.created).split(' ')[1]}</span>
                      </div>

                      {/* Balão da Mensagem */}
                      <div
                        className={`rounded-2xl p-3 text-xs max-w-[85%] shadow-2xs leading-relaxed ${
                          isCliente
                            ? 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs'
                            : isIa
                              ? pendenteAprovacao
                                ? 'bg-amber-50/90 text-amber-950 border border-amber-300 rounded-tr-xs'
                                : 'bg-teal-50 text-slate-800 border border-teal-200 rounded-tr-xs'
                              : 'bg-[#123B6D] text-white rounded-tr-xs'
                        }`}
                      >
                        <p className="whitespace-pre-line">{msg.conteudo}</p>

                        {/* Se for sugestão pendente de aprovação do contador no modo supervisionado */}
                        {pendenteAprovacao && canEditConfig && (
                          <div className="mt-2.5 pt-2 border-t border-amber-200 flex items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold text-amber-800 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Sugestão de resposta da IA (Aguardando aprovação)
                            </span>
                            <Button
                              size="sm"
                              onClick={() => handleEnviarMensagem(msg.id, msg.conteudo)}
                              disabled={enviandoMensagem}
                              className="h-6 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1"
                            >
                              <Check className="h-3 w-3" />
                              Aprovar & Enviar
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input para envio de resposta humana do contador */}
            <div className="p-3 border-t border-slate-200 bg-white space-y-2">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Digitar resposta ao cliente no WhatsApp (enviada como atendente humano)..."
                  value={respostaManual}
                  onChange={(e) => setRespostaManual(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleEnviarMensagem()
                    }
                  }}
                  disabled={!conversaAtiva || enviandoMensagem}
                  className="min-h-[58px] max-h-[90px] text-xs resize-none border-slate-200"
                />
                <Button
                  onClick={() => handleEnviarMensagem()}
                  disabled={!conversaAtiva || !respostaManual.trim() || enviandoMensagem}
                  className="h-auto bg-[#123B6D] hover:bg-[#0e2f57] text-white px-3 font-semibold text-xs shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Pressione Enter para enviar</span>
                <span>
                  Modo de despacho:{' '}
                  <strong>{isEvolutionConfigured ? 'Evolution API Real' : 'Simulação'}</strong>
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* COLUNA DIREITA: CONFIGURAÇÕES DO AGENTE POR TENANT (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="rounded-2xl border-slate-200 shadow-xs">
            <CardHeader className="p-4 pb-3 border-b border-slate-100 bg-slate-50/70">
              <CardTitle className="text-xs font-bold text-[#1A2333] uppercase tracking-wider flex items-center gap-2">
                <Sliders className="h-4 w-4 text-[#0FA3A3]" />
                Parâmetros do Agente IA
              </CardTitle>
              <CardDescription className="text-[11px] text-slate-500">
                Regras de atendimento e autonomia por tenant
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 space-y-4 text-xs">
              {/* Ativar/Desativar */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/50">
                <div>
                  <Label className="text-xs font-bold text-[#1A2333]">Agente de Atendimento</Label>
                  <p className="text-[10px] text-slate-500">
                    Ativa o agente nas mensagens do WhatsApp
                  </p>
                </div>
                <Switch
                  checked={iaAtiva}
                  onCheckedChange={setIaAtiva}
                  disabled={!canEditConfig || salvandoConfig}
                />
              </div>

              {/* Modo de Operação (Requisito 4) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-[#1A2333]">Modo de Operação</Label>
                <Select
                  value={iaModoOperacao}
                  onValueChange={(val: any) => setIaModoOperacao(val)}
                  disabled={!canEditConfig || salvandoConfig}
                >
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="autonomo_duvidas" className="text-xs">
                      Autônomo para Dúvidas (Recomendado)
                    </SelectItem>
                    <SelectItem value="supervisionado" className="text-xs">
                      Sempre Supervisionado (Aprovar antes)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-500 leading-tight">
                  {iaModoOperacao === 'supervisionado'
                    ? 'O agente sugere a resposta no painel e o contador deve aprovar antes de despachar.'
                    : 'Responde dúvidas comuns automaticamente (prazos, guias, GED). Atos fiscais sempre são escalados.'}
                </p>
              </div>

              {/* Horário de Atendimento */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-[#1A2333]">Horário de Atendimento</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400">Início:</span>
                    <Input
                      type="time"
                      value={iaHoraInicio}
                      onChange={(e) => setIaHoraInicio(e.target.value)}
                      disabled={!canEditConfig || salvandoConfig}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Fim:</span>
                    <Input
                      type="time"
                      value={iaHoraFim}
                      onChange={(e) => setIaHoraFim(e.target.value)}
                      disabled={!canEditConfig || salvandoConfig}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Mensagem de Boas-Vindas */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-[#1A2333]">Mensagem de Boas-Vindas</Label>
                <Textarea
                  value={iaMsgBoasVindas}
                  onChange={(e) => setIaMsgBoasVindas(e.target.value)}
                  disabled={!canEditConfig || salvandoConfig}
                  className="text-xs min-h-[70px] resize-none"
                />
              </div>

              {/* Mensagem Fora do Horário */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-[#1A2333]">Mensagem Fora do Horário</Label>
                <Textarea
                  value={iaMsgForaHorario}
                  onChange={(e) => setIaMsgForaHorario(e.target.value)}
                  disabled={!canEditConfig || salvandoConfig}
                  className="text-xs min-h-[70px] resize-none"
                />
              </div>

              {canEditConfig && (
                <Button
                  onClick={handleSalvarConfig}
                  disabled={salvandoConfig}
                  className="w-full bg-[#0FA3A3] hover:bg-[#0c8787] text-white text-xs font-semibold h-9"
                >
                  {salvandoConfig ? 'Salvando...' : 'Salvar Parâmetros'}
                </Button>
              )}

              {isCliente && (
                <div className="p-2.5 rounded-lg bg-slate-100 text-slate-600 text-[11px]">
                  Visualização somente leitura para perfil Cliente.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* MODAL: TESTAR AGENTE NATIVO EM TEMPO REAL */}
      <Dialog open={modalTestarOpen} onOpenChange={setModalTestarOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333] flex items-center gap-2">
              <Bot className="h-5 w-5 text-[#0FA3A3]" />
              Testar Agente Nativo de Atendimento (WhatsApp Agent)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Simule uma pergunta real de um cliente para inspecionar a resposta direta do
              assistente nativo do Skip Cloud sobre as coleções contábeis.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Empresa de Contexto */}
            <div className="space-y-1">
              <Label className="text-xs font-bold text-[#1A2333]">Empresa Simulada</Label>
              <Select value={empresaTeste} onValueChange={setEmpresaTeste}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id} className="text-xs">
                      {emp.razao_social} ({emp.cnpj})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sugestões rápidas de teste */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-600">
                Perguntas de Teste Sugeridas:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPerguntaTeste(
                      'Qual o prazo de vencimento do nosso DAS e quais guias estão pendentes?',
                    )
                  }
                  className="text-[10px] h-6 px-2"
                >
                  📅 Prazo do DAS e guias
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPerguntaTeste(
                      'Gostaria de saber quais documentos já enviamos para o escritório este mês.',
                    )
                  }
                  className="text-[10px] h-6 px-2"
                >
                  📂 Documentos no GED
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPerguntaTeste(
                      'Preciso emitir uma NFS-e de R$ 2.500 para o cliente Alfa Tecnologia.',
                    )
                  }
                  className="text-[10px] h-6 px-2 text-amber-700 border-amber-300"
                >
                  ⚠️ Pedir emissão de NFS-e (Ato Fiscal)
                </Button>
              </div>
            </div>

            {/* Campo de Pergunta */}
            <div className="space-y-1">
              <Label className="text-xs font-bold text-[#1A2333]">Pergunta do Cliente</Label>
              <Textarea
                placeholder="Ex: Qual o valor da nossa guia previdenciária e o prazo de entrega?"
                value={perguntaTeste}
                onChange={(e) => setPerguntaTeste(e.target.value)}
                className="text-xs min-h-[70px]"
              />
            </div>

            {/* Resposta do Agente */}
            {respostaTeste && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0FA3A3] flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    Resposta do Agente Nativo
                  </span>
                  {tempoRespostaTeste && (
                    <Badge variant="outline" className="text-[10px] font-mono">
                      Tempo: {tempoRespostaTeste}
                    </Badge>
                  )}
                </div>
                <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-3.5 text-xs text-slate-800 whitespace-pre-line leading-relaxed max-h-56 overflow-y-auto">
                  {respostaTeste}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalTestarOpen(false)}
              className="text-xs"
            >
              Fechar
            </Button>
            <Button
              size="sm"
              onClick={handleExecutarTeste}
              disabled={testandoAgente || !perguntaTeste.trim()}
              className="bg-[#0FA3A3] hover:bg-[#0c8787] text-white text-xs gap-1.5 font-semibold"
            >
              {testandoAgente ? (
                <>
                  <RotateCw className="h-3.5 w-3.5 animate-spin" />
                  Consultando Agente Nativo...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Executar Teste
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

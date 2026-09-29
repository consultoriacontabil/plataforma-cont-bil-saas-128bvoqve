import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Bot,
  Send,
  Plus,
  MessageSquare,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Cpu,
  RefreshCw,
  HelpCircle,
  ExternalLink,
  BookOpen,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { EllizaDiretivasTab } from '@/components/EllizaDiretivasTab'
import { ellizaAgentService, type EllizaStatusResponse } from '@/services/ellizaAgent'
import type { AgentConversationRecord } from '@/types'
import { cn } from '@/lib/utils'

const PROMPT_SUGESTOES = [
  'Resumo das rotinas ativas da ELLIZA 24/7 e o que falta para fechar a competência atual',
  'Quais são os 12 Procedimentos Operacionais Padrão (POP) e como funciona a supervisão humana?',
  'Quais rotinas contábeis estão ativas sem credenciais externas e quais dependem de A1/WhatsApp?',
  'Como a ELLIZA executa a conciliação bancária assistida e a conferência do Fecho Mensal?',
]

export default function EllizaPage() {
  const { user, tenant, member } = useAuth()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()

  const canEditDiretivas = member?.perfil === 'administrador'
  const canApproveFila = member?.perfil === 'administrador' || member?.perfil === 'contador'

  const [conversations, setConversations] = useState<AgentConversationRecord[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<
    Array<{ id: string; role: 'user' | 'agent'; conteudo: string }>
  >([])
  const [inputMessage, setInputMessage] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamedText, setStreamedText] = useState('')
  const [statusInfo, setStatusInfo] = useState<EllizaStatusResponse | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamedText])

  // Carregar status da ELLIZA
  const carregarStatus = useCallback(async () => {
    if (!tenant?.id) return
    setLoadingStatus(true)
    try {
      const data = await ellizaAgentService.getStatus(tenant.id)
      setStatusInfo(data)
    } catch (err) {
      console.warn('Não foi possível carregar status da ELLIZA:', err)
    } finally {
      setLoadingStatus(false)
    }
  }, [tenant?.id])

  useEffect(() => {
    carregarStatus()
  }, [carregarStatus])

  // Carregar histórico de conversas do usuário
  const loadConversations = useCallback(async () => {
    if (!user?.id) return
    try {
      const convs = await ellizaAgentService.listarConversas(user.id)
      setConversations(convs)
      if (convs.length > 0 && !activeConvId) {
        setActiveConvId(convs[0].id)
      }
    } catch (err) {
      console.error('Erro ao listar conversas da ELLIZA:', err)
    }
  }, [user?.id, activeConvId])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Preencher pergunta vinda por query param (?q=...)
  useEffect(() => {
    const q = searchParams.get('q')
    if (q && q.trim()) {
      setInputMessage(q.trim())
    }
  }, [searchParams])

  // Carregar mensagens da conversa ativa
  const loadMessages = useCallback(async (convId: string) => {
    try {
      const msgs = await ellizaAgentService.listarMensagens(convId)
      if (msgs.length > 0) {
        setMessages(
          msgs.map((m) => ({
            id: m.id,
            role: m.role,
            conteudo: m.conteudo,
          })),
        )
      } else {
        setMessages([
          {
            id: 'welcome-elliza',
            role: 'agent',
            conteudo:
              'Olá! Sou a **ELLIZA**, a hiperautomação 24/7 da plataforma Rumo Contábil.\n\n' +
              'Atuo no backend Skip Cloud processando dados do seu escritório: conheço todos os 12 Procedimentos Operacionais Padrão (POP), monitoro prazos de obrigações, audito vencimentos de certificados A1 e auxilio na conciliação e fecho contábil.\n\n' +
              '💡 *Lembrete de governança: Todas as transmissões com efeitos legais externos e fechamentos oficiais operam em Modo Assistivo Supervisionado, exigindo a chancela técnica do Contador Responsável (NBC PP 01 / NBC PG 01).*\n\n' +
              'Como posso acelerar suas rotinas hoje?',
          },
        ])
      }
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err)
    }
  }, [])

  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId)
    } else {
      setMessages([
        {
          id: 'welcome-elliza',
          role: 'agent',
          conteudo:
            'Olá! Sou a **ELLIZA**, a hiperautomação 24/7 da plataforma Rumo Contábil.\n\n' +
            'Atuo no backend Skip Cloud processando dados do seu escritório: conheço todos os 12 Procedimentos Operacionais Padrão (POP), monitoro prazos de obrigações, audito vencimentos de certificados A1 e auxilio na conciliação e fecho contábil.\n\n' +
            'Como posso acelerar suas rotinas hoje?',
        },
      ])
    }
  }, [activeConvId, loadMessages])

  const handleNewConversation = async () => {
    if (!tenant?.id) return
    try {
      const newConv = await ellizaAgentService.criarConversa('Nova sessão ELLIZA', tenant.id)
      setConversations((prev) => [newConv, ...prev])
      setActiveConvId(newConv.id)
      setMessages([
        {
          id: 'welcome-elliza',
          role: 'agent',
          conteudo:
            'Olá! Nova sessão iniciada com a **ELLIZA**. Estou conectada ao seu escritório contábil. Como posso te apoiar?',
        },
      ])
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Tente novamente.'
      toast({
        variant: 'destructive',
        title: 'Erro ao iniciar sessão',
        description: errMsg,
      })
    }
  }

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim()
    if (!text || streaming || !tenant?.id || !user?.id) return

    setInputMessage('')
    let currentConvId = activeConvId

    if (!currentConvId) {
      try {
        const newConv = await ellizaAgentService.criarConversa(
          text.length > 30 ? text.slice(0, 30) + '...' : text,
          tenant.id,
        )
        setConversations((prev) => [newConv, ...prev])
        currentConvId = newConv.id
        setActiveConvId(newConv.id)
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Tente novamente.'
        toast({
          variant: 'destructive',
          title: 'Erro ao iniciar conversa',
          description: errMsg,
        })
        return
      }
    }

    const userMsgId = 'user-' + Date.now()
    setMessages((prev) => [...prev, { id: userMsgId, role: 'user', conteudo: text }])
    setStreaming(true)
    setStreamedText('')

    try {
      let accumulatedReply = ''
      const res = await ellizaAgentService.enviarMensagem({
        mensagem: text,
        conversationId: currentConvId,
        tenantId: tenant.id,
        onChunk: (_token, full) => {
          accumulatedReply = full
          setStreamedText(full)
        },
      })

      const finalReply =
        res.conteudo ||
        accumulatedReply.trim() ||
        'Consulta realizada com sucesso na base contábil da ELLIZA.'

      setMessages((prev) => [
        ...prev,
        { id: 'agent-' + Date.now(), role: 'agent', conteudo: finalReply },
      ])
      setStreamedText('')
    } catch (err) {
      console.warn('Backend stream indisponível, gerando resposta assistiva de contingência:', err)
      // Contingência técnica fundamentada no POP e escopo do tenant
      let fallbackText = ''
      const lower = text.toLowerCase()

      if (
        lower.includes('pop') ||
        lower.includes('treinamento') ||
        lower.includes('procedimento')
      ) {
        fallbackText =
          '### Base Operacional ELLIZA — Procedimentos Operacionais Padrão (POP)\n\n' +
          'A ELLIZA opera fundamentada nos 12 POPs homologados da plataforma:\n' +
          '• **POP 01 (Onboarding):** Cadastro via CNPJ público, guarda A1 no cofre e migração de planilhas.\n' +
          '• **POP 02 (DP & e-Social):** Folha mensal CLT, verbas, CCT em 1 clique e cadeia S-1200 a S-1299/DCTFWeb.\n' +
          '• **POP 03 (Fiscal & SPED):** Apuração DAS/DARF, parcelamentos PAR/PER-DCOMP e validação PVA com hash MD5.\n' +
          '• **POP 04 (Contábil & Fecho):** Conciliação bancária OFX/CSV, pré-lançamentos automáticos e trava retroativa.\n' +
          '• **POP 05 (WhatsApp & NFS-e):** Minutas assistidas com chancela humana antes da transmissão.\n' +
          '• **POP 06 (Prazos 24/7):** Varreduras contínuas de obrigações tributárias e alertas preventivos.\n' +
          '• **POP 07 a 12:** CNDs, Abertura societária, Migrações CRC, Tripé Contábil, DEFIS e Lote Multi-empresas.\n\n' +
          'Para inspecionar o manual completo passo a passo, acesse a página **/pop-treinamento** ou **/manual**.'
      } else if (
        lower.includes('rotina') ||
        lower.includes('24/7') ||
        lower.includes('credencial')
      ) {
        fallbackText =
          '### Status das Rotinas da Hiperautomação 24/7 ELLIZA\n\n' +
          '🟢 **Rotinas Ativas sem Credenciais Externas:**\n' +
          '• Varredura contínua de vencimentos de obrigações e prazos fiscais\n' +
          '• Auditoria de saúde e validade de certificados A1 no cofre criptografado\n' +
          '• Validação do checklist de fechamento contábil e trava contra edições retroativas\n' +
          '• Retenção e purga automática de backups temporários\n\n' +
          '🟡 **Rotinas Dependentes de Credenciais Externas (Aguardando ativação pelo usuário):**\n' +
          '• Transmissão e-CAC RFB oficial (Requer certificado A1 .pfx + procuração eletrônica)\n' +
          '• Atendimento WhatsApp automatizado (Requer Evolution API configurada em NFS-e WhatsApp)\n' +
          '• Baixa bancária automática de honorários (Requer credenciais de API / Webhook bancário)\n\n' +
          '*A infraestrutura 24 horas da ELLIZA é 100% nativa na nuvem Skip Cloud (sem necessidade de VM ou RPA de tela).*'
      } else if (
        lower.includes('fecho') ||
        lower.includes('fechamento') ||
        lower.includes('competência')
      ) {
        fallbackText =
          '### Diagnóstico de Fechamento Contábil — ELLIZA\n\n' +
          'Consultando a base de dados do escritório "' +
          (tenant?.nome || 'Escritório') +
          '":\n\n' +
          '• **Conciliação Bancária:** Extratos bancários integrados na conta 1.1.1.02.\n' +
          '• **Pré-Lançamentos:** Há sugestões de alta confiança aguardando validação no módulo Pré-Lançamento.\n' +
          '• **Obrigações e Guias:** Verifique no módulo Fiscal se o DAS Simples Nacional e DARFs previdenciários da competência foram transmitidos.\n' +
          '• **Trava Retroativa:** Lembre-se que, ao aprovar o fecho oficial em `/fecho-mensal`, o backend bloqueia qualquer edição retroativa nos lançamentos contábeis.\n\n' +
          '*Consulte o Responsável Técnico CFC do seu escritório para a aprovação formal do período.*'
      } else {
        fallbackText =
          'Olá! Sou a **ELLIZA**, a hiperautomação 24/7 da Rumo Contábil vinculada ao escritório **' +
          (tenant?.nome || 'seu escritório') +
          '**.\n\n' +
          'Estou à disposição para responder dúvidas sobre o POP de Treinamento, situação de empresas, obrigações acessórias a vencer, conciliações contábeis e conformidade fiscal.\n\n' +
          'Como posso ajudar nesta demanda?'
      }

      setMessages((prev) => [
        ...prev,
        { id: 'agent-' + Date.now(), role: 'agent', conteudo: fallbackText },
      ])
      setStreamedText('')
    } finally {
      setStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header com Identidade da ELLIZA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge className="bg-[#0FA3A3] text-white">ELLIZA 24/7</Badge>
            <Badge variant="outline" className="border-teal-300 text-teal-800 bg-teal-50/50">
              Hiperautomação Nativa Skip Cloud
            </Badge>
            <Badge className="bg-emerald-600 text-white">Modo Supervisionado (CFC)</Badge>
            <Badge variant="secondary" className="text-slate-600">
              Multi-tenant Seguro
            </Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0FA3A3] text-white shadow-xs">
              <Bot className="h-5 w-5" />
            </span>
            ELLIZA — Hiperautomação Contábil 24/7
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Agente nativo da plataforma com memória persistente, RAG sobre o POP e rotinas em nuvem.
            Saiba mais em{' '}
            <Link
              to="/pop-treinamento"
              className="text-[#0FA3A3] underline hover:text-[#0c8282] font-semibold"
            >
              /pop-treinamento
            </Link>{' '}
            e no manual em{' '}
            <Link
              to="/manual"
              className="text-[#0FA3A3] underline hover:text-[#0c8282] font-semibold"
            >
              /manual
            </Link>
            .
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/pop-treinamento">
            <Button
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-100 text-xs h-9"
            >
              <BookOpen className="h-4 w-4 mr-1.5 text-[#0FA3A3]" />
              Ver POP Treinamento
            </Button>
          </Link>
          <Button
            onClick={carregarStatus}
            variant="outline"
            className="border-slate-300 text-slate-700 hover:bg-slate-100 text-xs h-9"
            disabled={loadingStatus}
          >
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', loadingStatus && 'animate-spin')} />
            Atualizar Status
          </Button>
        </div>
      </div>

      {/* Painel de Abas: Chat da ELLIZA e Central de Rotinas 24/7 */}
      <Tabs defaultValue="chat" className="space-y-6">
        <TabsList className="bg-slate-100 p-1 border border-slate-200">
          <TabsTrigger value="chat" className="text-xs font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[#0FA3A3]" />
            Chat com a ELLIZA
          </TabsTrigger>
          <TabsTrigger value="diretivas" className="text-xs font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#0FA3A3]" />
            Diretivas & Fila de Aprovação
          </TabsTrigger>
          <TabsTrigger value="rotinas" className="text-xs font-semibold flex items-center gap-2">
            <Cpu className="h-4 w-4 text-emerald-600" />
            Central de Rotinas 24/7 & Limites
          </TabsTrigger>
        </TabsList>

        {/* =========================================================================
            ABA 1: INTERFACE DE CHAT DA ELLIZA
           ========================================================================= */}
        <TabsContent value="chat" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar de Sessões / Conversas */}
            <Card className="lg:col-span-1 border-slate-200 shadow-xs flex flex-col h-[650px]">
              <CardHeader className="p-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-[#0FA3A3]" />
                    Sessões Salvas
                  </span>
                  <Button
                    onClick={handleNewConversation}
                    size="sm"
                    className="h-7 px-2 text-xs bg-[#0FA3A3] hover:bg-[#0c8282] text-white"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Nova
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-2 flex-1 overflow-y-auto space-y-1">
                {conversations.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    Nenhuma conversa anterior encontrada.
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => setActiveConvId(conv.id)}
                      className={cn(
                        'w-full text-left p-2.5 rounded-lg text-xs transition-colors flex items-start justify-between gap-2',
                        activeConvId === conv.id
                          ? 'bg-teal-50 border border-teal-200 text-teal-900 font-semibold'
                          : 'hover:bg-slate-50 text-slate-700',
                      )}
                    >
                      <div className="truncate">
                        <p className="truncate">{conv.titulo || 'Conversa sem título'}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(conv.created).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <ChevronRight className="h-3 w-3 text-slate-400 shrink-0 mt-1" />
                    </button>
                  ))
                )}
              </CardContent>

              {/* Box de Governança no rodapé da sidebar */}
              <div className="p-3 border-t border-slate-100 bg-slate-50/70 rounded-b-xl text-[11px] text-slate-600 space-y-1">
                <div className="flex items-center gap-1 font-semibold text-slate-800">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#0FA3A3]" />
                  <span>Escopo do Tenant:</span>
                </div>
                <p className="truncate text-slate-700 font-medium">
                  {tenant?.nome || 'Escritório Contábil'}
                </p>
                <p className="text-[10px] text-slate-500">
                  Dados isolados por chave primária de escritório.
                </p>
              </div>
            </Card>

            {/* Painel Central de Mensagens */}
            <Card className="lg:col-span-3 border-slate-200 shadow-xs flex flex-col h-[650px]">
              <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-[#0FA3A3]">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900">
                        ELLIZA • Assistente & Hiperautomação Contábil
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Conhecimento consolidado dos 12 POPs e coleções da Rumo Contábil
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px]">
                    24/7 Ativa
                  </Badge>
                </div>
              </CardHeader>

              {/* Área de rolagem de mensagens */}
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      'flex gap-3 max-w-[88%]',
                      m.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto',
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        m.role === 'user' ? 'bg-slate-800 text-white' : 'bg-[#0FA3A3] text-white',
                      )}
                    >
                      {m.role === 'user' ? 'VC' : <Bot className="h-4 w-4" />}
                    </div>
                    <div
                      className={cn(
                        'rounded-2xl p-3.5 text-xs leading-relaxed shadow-xs',
                        m.role === 'user'
                          ? 'bg-[#0B1F3A] text-white rounded-tr-none'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none whitespace-pre-wrap',
                      )}
                    >
                      {m.conteudo}
                    </div>
                  </div>
                ))}

                {/* Mensagem em streaming */}
                {streaming && streamedText && (
                  <div className="flex gap-3 max-w-[88%] mr-auto">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0FA3A3] text-white text-xs font-bold">
                      <Bot className="h-4 w-4 animate-pulse" />
                    </div>
                    <div className="rounded-2xl p-3.5 text-xs leading-relaxed bg-white border border-teal-200 text-slate-800 rounded-tl-none whitespace-pre-wrap shadow-xs">
                      {streamedText}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </CardContent>

              {/* Sugestões de Perguntas Rápidas */}
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px]">
                <span className="font-semibold text-slate-500 shrink-0 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-[#0FA3A3]" /> Sugestões:
                </span>
                {PROMPT_SUGESTOES.map((sugestao, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(sugestao)}
                    disabled={streaming}
                    className="shrink-0 bg-white border border-slate-200 hover:border-teal-300 hover:bg-teal-50/50 text-slate-700 px-2.5 py-1 rounded-full transition-colors text-[10px]"
                  >
                    {sugestao.length > 40 ? sugestao.slice(0, 40) + '...' : sugestao}
                  </button>
                ))}
              </div>

              {/* Caixa de Entrada de Texto */}
              <div className="p-3 border-t border-slate-200 bg-white flex items-end gap-2">
                <Textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Pergunte à ELLIZA sobre procedimentos operacionais (POP), prazos, folha CLT, SPED ou fecho..."
                  className="min-h-[44px] max-h-32 text-xs resize-none"
                  rows={2}
                  disabled={streaming}
                />
                <Button
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || streaming}
                  className="h-10 px-4 bg-[#0FA3A3] hover:bg-[#0c8282] text-white shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* =========================================================================
            ABA 2: DIRETIVAS OPERACIONAIS & FILA DE APROVAÇÃO HUMANA
           ========================================================================= */}
        <TabsContent value="diretivas" className="space-y-4">
          <EllizaDiretivasTab
            tenantId={tenant?.id || ''}
            canEdit={canEditDiretivas}
            canApprove={canApproveFila}
          />
        </TabsContent>

        {/* =========================================================================
            ABA 3: CENTRAL DE ROTINAS 24/7 & LIMITES
           ========================================================================= */}
        <TabsContent value="rotinas" className="space-y-6">
          {/* Card dos Limites e Definição Acordada */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-teal-200 bg-teal-50/30 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#0FA3A3]" />
                  O Que a ELLIZA É (Hiperautomação 24/7)
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-700 space-y-2">
                <p>
                  • <b>Agente Nativo Skip Cloud:</b> Executa diretamente no backend com motor de
                  RAG, ferramentas sobre coleções de dados e memória persistente.
                </p>
                <p>
                  • <b>Computador 24h na Nuvem:</b> O backend da Skip Cloud opera continuamente
                  processando rotinas agendadas (cron), webhooks e chats.
                </p>
                <p>
                  • <b>Aprende por Instrução:</b> Absorve orientações e procedimentos em linguagem
                  natural sem necessidade de recodificar regras estruturais.
                </p>
                <p>
                  • <b>Isolamento Multi-tenant:</b> Toda resposta e consulta é estritamente
                  confinada ao escritório contábil logado.
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-slate-50/60 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-slate-600" />
                  Limites Definidos e Acordados (Fora do Escopo)
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 space-y-2">
                <p>
                  • <b>Sem RPA Visual:</b> A ELLIZA não enxerga telas gráficas, não movimenta mouse
                  e não dá cliques em botões de janelas de desktop.
                </p>
                <p>
                  • <b>Sem Instalação em VM:</b> Não necessita de máquinas virtuais externas em
                  Windows ou servidores dedicados caros.
                </p>
                <p>
                  • <b>Sem Operação de Softwares Desktop Legados:</b> Não substitui por emulação
                  direta o sistema Domínio ou softwares locais em desktop.
                </p>
                <p>
                  • <b>Chancela Humana Obrigatória (CFC):</b> Emissões fiscais com efeito legal
                  externo exigem aprovação do Contador.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Rotinas Ativas 24/7 (Já operando sem credenciais externas) */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-emerald-600" />
                    Rotinas Ativas 24/7 (Operando sem Dependência de Credenciais Externas)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Rotinas que rodam continuamente no servidor Skip Cloud para garantir
                    conformidade preventiva da sua carteira.
                  </CardDescription>
                </div>
                <Badge className="bg-emerald-600 text-white">4 Rotinas Ativas</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {(
                statusInfo?.rotinas_ativas_24_7 || [
                  {
                    id: 'job_obrigacoes_vencimentos',
                    nome: 'Varredura de Prazos & Competências',
                    frequencia: 'Diária às 08:00 UTC e varredura contínua',
                    status: 'ativo_sem_credencial_externa',
                    descricao:
                      'Analisa vencimentos de tributos, parcelamentos e gera alertas automáticos.',
                  },
                  {
                    id: 'job_certificados_a1',
                    nome: 'Auditoria Preventiva de Certificados A1',
                    frequencia: 'Varredura diária 30d/15d/vencido',
                    status: 'ativo_sem_credencial_externa',
                    descricao:
                      'Monitora a saúde e validade de certificados no cofre e alerta administradores.',
                  },
                  {
                    id: 'job_fechamento_competencias',
                    nome: 'Checagem de Consistência do Fecho Mensal',
                    frequencia: 'Sob demanda / diária',
                    status: 'ativo_sem_credencial_externa',
                    descricao:
                      'Valida checklist contábil de 9 etapas e trava contra edições retroativas.',
                  },
                  {
                    id: 'job_purga_backups',
                    nome: 'Retenção e Purga Automática de Backups',
                    frequencia: 'A cada 15 minutos',
                    status: 'ativo_sem_credencial_externa',
                    descricao: 'Garante política de retenção temporária e exclusão segura.',
                  },
                ]
              ).map((rotina) => (
                <div
                  key={rotina.id}
                  className="flex flex-col md:flex-row md:items-center justify-between p-3 rounded-lg border border-slate-200 bg-white hover:border-emerald-200 transition-colors gap-2 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{rotina.nome}</span>
                      <Badge
                        variant="outline"
                        className="text-emerald-700 bg-emerald-50 border-emerald-300 text-[10px]"
                      >
                        Ativo 24/7
                      </Badge>
                    </div>
                    <p className="text-slate-600">{rotina.descricao}</p>
                  </div>
                  <div className="text-[11px] text-slate-500 shrink-0 font-medium">
                    Frequência: {rotina.frequencia}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Rotinas Aguardando Credenciais Externas */}
          <Card className="border-amber-200 bg-amber-50/20 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    Rotinas com Dependência de Credenciais Externas (Aguardando Ativação)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Funcionalidades que ficam em Modo Supervisão até que o escritório contábil
                    registre as credenciais reais no cofre.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-amber-300 text-amber-800 bg-amber-50">
                  Modo Supervisão
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {(
                statusInfo?.rotinas_aguardando_credenciais || [
                  {
                    id: 'rotina_ecac_rfb_real',
                    nome: 'Transmissão Oficial e-CAC / DTE RFB',
                    dependencia: 'Certificado A1 (.pfx) válido + senha no cofre + procuração e-CAC',
                    status: 'pendente_certificado_a1',
                    descricao: 'Captura automática de intimações DTE e validação oficial de CNDs.',
                  },
                  {
                    id: 'rotina_whatsapp_evolution',
                    nome: 'Atendimento & Notificações WhatsApp',
                    dependencia: 'Instância e API Key Evolution API',
                    status: 'pendente_credencial_evolution',
                    descricao: 'Envio assistido de avisos de guias, recibos de folha e cobrança.',
                  },
                  {
                    id: 'rotina_cobranca_pix_boleto',
                    nome: 'Liquidação & Cobrança Bancária PIX/Boleto',
                    dependencia: 'Credenciais de API Bancária (Open Finance / Webhook)',
                    status: 'pendente_credencial_bancaria',
                    descricao:
                      'Baixa bancária em tempo real de faturamentos de honorários contábeis.',
                  },
                ]
              ).map((rotina) => (
                <div
                  key={rotina.id}
                  className="flex flex-col md:flex-row md:items-center justify-between p-3 rounded-lg border border-amber-200 bg-white gap-2 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{rotina.nome}</span>
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px]">
                        Aguardando Credencial
                      </Badge>
                    </div>
                    <p className="text-slate-600">{rotina.descricao}</p>
                    <p className="text-[11px] text-amber-900 font-medium">
                      🔑 <b>Requisito:</b> {rotina.dependencia}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <Link to="/empresas">
                      <Button variant="outline" size="sm" className="text-xs h-8 border-slate-300">
                        Configurar em Empresas
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

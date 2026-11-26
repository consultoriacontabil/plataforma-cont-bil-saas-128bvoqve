import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  QrCode,
  RefreshCw,
  Smartphone,
  MessageSquare,
  Send,
  Phone,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Unplug,
  ShieldAlert,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { rumoWhatsService, type ConectorEstado } from '@/services/rumoWhats'
import type {
  WaCanalRecord,
  WaAtendimentoConversaRecord,
  WaAtendimentoMensagemRecord,
} from '@/types'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { RumoWhatsChatbotTab } from '@/components/rumoWhats/RumoWhatsChatbotTab'
import { RumoWhatsTransmissaoTab } from '@/components/rumoWhats/RumoWhatsTransmissaoTab'
import { RumoWhatsConfigTab } from '@/components/rumoWhats/RumoWhatsConfigTab'
import { RumoWhatsRelatoriosTab } from '@/components/rumoWhats/RumoWhatsRelatoriosTab'

const PRODUTO = 'Rumo Whats'
const VERSAO_PAINEL = '1.0.0'

function formatarHora(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatarTelefone(tel: string) {
  const dig = tel.replace(/\D/g, '')
  if (dig.length === 13)
    return `+${dig.slice(0, 2)} (${dig.slice(2, 4)}) ${dig.slice(4, 9)}-${dig.slice(9)}`
  if (dig.length === 12)
    return `+${dig.slice(0, 2)} (${dig.slice(2, 4)}) ${dig.slice(4, 8)}-${dig.slice(8)}`
  return tel
}

// ---------------------------------------------------------------------------
// Tela 01 — Conexão por QR
// ---------------------------------------------------------------------------
function ConexaoQrCard() {
  const [estado, setEstado] = useState<ConectorEstado | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [recarregando, setRecarregando] = useState(false)
  const [qrTick, setQrTick] = useState(Date.now())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { tenant } = useAuth()
  // URL do conector vem do canal (wa_canais.conector_url), editada em Configurações
  const [conectorUrl, setConectorUrl] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    let url = ''
    if (tenant?.id) {
      try {
        const canal = await rumoWhatsService.carregarCanalPrincipal(tenant.id)
        url = rumoWhatsService.normalizarConectorUrl(canal?.conector_url || '')
      } catch (err) {
        console.error('Erro ao carregar o canal do conector:', err)
      }
    }
    setConectorUrl(url)
    const resultado: { ok: boolean; estado?: ConectorEstado; erro?: string } =
      await rumoWhatsService.estadoConector(url)
    if (resultado.ok && resultado.estado) {
      setEstado(resultado.estado)
      setErro(null)
    } else {
      setEstado(null)
      setErro(resultado.erro || 'Conector indisponível.')
    }
    setCarregando(false)
  }, [tenant?.id])

  useEffect(() => {
    carregar()
    timerRef.current = setInterval(carregar, 10000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [carregar])

  const handleRecarregar = async () => {
    setRecarregando(true)
    const r = await rumoWhatsService.recarregarSessao(conectorUrl)
    if (!r.ok) {
      toast({ title: 'Recarregar sessão', description: r.erro, variant: 'destructive' })
      setRecarregando(false)
      return
    }
    toast({ title: 'Sessão descartada', description: 'Um novo QR será gerado em segundos.' })
    // QR novo: bust de cache e re-poll em seguida
    setQrTick(Date.now())
    setTimeout(() => {
      carregar()
      setRecarregando(false)
    }, 2500)
  }

  const qrSrc = conectorUrl ? `${conectorUrl.replace(/\/$/, '')}/qr.png?t=${qrTick}` : ''

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-[#0FA3A3]" />
            <div>
              <CardTitle className="text-base">Conexão por QR Code</CardTitle>
              <CardDescription>
                Pareie o aparelho do atendimento: WhatsApp → Dispositivos conectados → Conectar
                dispositivo.
              </CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleRecarregar} disabled={recarregando}>
            <RefreshCw className={cn('h-4 w-4 mr-1.5', recarregando && 'animate-spin')} />
            Recarregar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {carregando && !estado && !erro ? (
          <div className="py-8 text-center text-sm text-[#64748B]">Consultando o conector…</div>
        ) : erro ? (
          <div className="flex items-start gap-3 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-4">
            <Unplug className="h-5 w-5 text-[#A86500] mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-[#A86500]">Conector offline</p>
              <p className="text-[#7C5A0B] mt-1">{erro}</p>
              <p className="text-[#7C5A0B] mt-2">
                O conector é o processo Node{' '}
                <code>tools/conector-whatsapp/conector-whatsapp.js</code> que roda na máquina do
                escritório (não no Skip Cloud). Suba-o, abra um túnel HTTPS para ele e cole a URL na
                aba <strong>Configurações</strong> (campo URL do conector).
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-[minmax(0,300px)_1fr]">
            {/* QR */}
            <div className="rounded-lg border bg-white p-4 flex flex-col items-center gap-3">
              {estado?.conectado ? (
                <div className="py-6 text-center">
                  <CheckCircle2 className="h-14 w-14 text-[#12805C] mx-auto" />
                  <p className="mt-3 text-sm font-semibold text-[#12805C]">Sessão conectada</p>
                  {estado.numero_pareado && (
                    <p className="text-xs text-[#64748B] mt-1">
                      Número pareado: {formatarTelefone(estado.numero_pareado)}
                    </p>
                  )}
                </div>
              ) : estado?.tem_qr && qrSrc ? (
                <img
                  src={qrSrc}
                  alt="QR Code de pareamento do WhatsApp"
                  width={256}
                  height={256}
                  className="aspect-square w-full max-w-[256px] rounded-md border"
                  onError={() => setErro('QR indisponível no conector. Clique em Recarregar.')}
                />
              ) : (
                <div className="py-6 text-center">
                  <QrCode className="h-14 w-14 text-[#94A3B8] mx-auto" />
                  <p className="mt-3 text-sm text-[#64748B]">
                    Sem QR no momento. Clique em Recarregar para gerar um novo.
                  </p>
                </div>
              )}
              <p className="text-[11px] text-[#64748B] text-center">
                O QR se renova sozinho no conector. Se expirar, clique em Recarregar.
              </p>
            </div>

            {/* Estado da conexão */}
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge
                  className={cn(
                    estado?.conectado
                      ? 'bg-[#12805C] text-white'
                      : 'bg-[#FEF3C7] text-[#A86500] hover:bg-[#FEF3C7]',
                  )}
                >
                  {estado?.conectado ? 'Conectado' : 'Aguardando pareamento'}
                </Badge>
                {estado?.tem_qr && !estado?.conectado && (
                  <Badge variant="outline">QR disponível</Badge>
                )}
              </div>
              <dl className="grid grid-cols-[140px_1fr] gap-y-2 items-start">
                <dt className="text-[#64748B]">Número pareado</dt>
                <dd className="font-medium">
                  {estado?.numero_pareado ? formatarTelefone(estado.numero_pareado) : '—'}
                </dd>
                <dt className="text-[#64748B]">Conectado em</dt>
                <dd className="font-medium">{formatarHora(estado?.conectado_em) || '—'}</dd>
                <dt className="text-[#64748B]">QR gerado em</dt>
                <dd className="font-medium">{formatarHora(estado?.qr_atualizado_em) || '—'}</dd>
                <dt className="text-[#64748B]">Último erro</dt>
                <dd className="font-medium">
                  {estado?.ultimo_erro ? (
                    <span className="text-[#B3261E]">{estado.ultimo_erro}</span>
                  ) : (
                    '—'
                  )}
                </dd>
              </dl>

              <Separator />

              {/* Caminho alternativo: código de 8 dígitos */}
              <div className="rounded-lg border bg-[#F8FAFC] p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Smartphone className="h-4 w-4 text-[#0B5CAD]" />
                  <p className="text-sm font-semibold">Conectar com número de telefone</p>
                </div>
                <p className="text-xs text-[#64748B]">
                  Sem câmera? No conector, o mesmo QR fornece o código de 8 dígitos: no celular,
                  abra <em>Conectar dispositivo → Conectar com número de telefone</em> e digite o
                  código exibido no log do conector.
                </p>
              </div>

              <div className="rounded-lg border border-[#FECACA] bg-[#FFFAFA] p-3 flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 text-[#B3261E] mt-0.5" />
                <p className="text-xs text-[#7A2B26]">
                  Para a Meta, este pareamento é "app não oficial" — o número pode ser banido. Use
                  um número <strong>dedicado</strong> ao atendimento, nunca o principal do
                  escritório.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Painel do atendente — conversas + mensagens + envio enfileirado
// ---------------------------------------------------------------------------
function PainelAtendente() {
  const { tenant, user } = useAuth()
  const [canal, setCanal] = useState<WaCanalRecord | null>(null)
  const [conversas, setConversas] = useState<WaAtendimentoConversaRecord[]>([])
  const [conversaAtiva, setConversaAtiva] = useState<string | null>(null)
  const [mensagens, setMensagens] = useState<WaAtendimentoMensagemRecord[]>([])
  const [rascunho, setRascunho] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    if (!tenant?.id) return
    try {
      const [canais, convs] = await Promise.all([
        rumoWhatsService.listarCanais(tenant.id),
        rumoWhatsService.listarConversas(tenant.id),
      ])
      setCanal(canais.find((c) => c.modo === 'qr') || canais[0] || null)
      setConversas(convs)
      setConversaAtiva((atual) => atual || convs[0]?.id || null)
    } catch (err) {
      console.error('Erro ao carregar atendimentos:', err)
    } finally {
      setCarregando(false)
    }
  }, [tenant?.id])

  const carregarMensagens = useCallback(async (conversaId: string) => {
    try {
      setMensagens(await rumoWhatsService.listarMensagens(conversaId))
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    if (conversaAtiva) carregarMensagens(conversaAtiva)
  }, [conversaAtiva, carregarMensagens])

  // Realtime: novas conversas e mensagens aparecem no painel
  useEffect(() => {
    if (!tenant?.id) return
    const subs = [
      pb
        .collection('wa_atendimento_conversas')
        .subscribe('*', () => carregar())
        .catch(() => {}),
      pb
        .collection('wa_atendimento_mensagens')
        .subscribe('*', () => {
          carregar()
          if (conversaAtiva) carregarMensagens(conversaAtiva)
        })
        .catch(() => {}),
    ]
    return () => {
      pb.collection('wa_atendimento_conversas')
        .unsubscribe('*')
        .catch(() => {})
      pb.collection('wa_atendimento_mensagens')
        .unsubscribe('*')
        .catch(() => {})
    }
  }, [tenant?.id, conversaAtiva, carregar, carregarMensagens])

  const handleEnviar = async () => {
    const conteudo = rascunho.trim()
    if (!conteudo || !tenant?.id || !conversaAtiva) return
    setEnviando(true)
    try {
      const msg = await rumoWhatsService.enfileirarMensagem(
        tenant.id,
        conversaAtiva,
        conteudo,
        canal?.id,
      )
      setMensagens((prev) => [...prev, msg])
      setRascunho('')
      toast({
        title: 'Mensagem enfileirada',
        description: 'Status pendente — o laço de envio do conector despacha pelo socket.',
      })
    } catch (err) {
      console.error('Erro ao enfileirar mensagem:', err)
      toast({ title: 'Erro ao enfileirar mensagem', variant: 'destructive' })
    } finally {
      setEnviando(false)
    }
  }

  const badgeStatus = (s: WaAtendimentoConversaRecord['status']) => {
    switch (s) {
      case 'aberta':
        return <Badge variant="outline">Aberta</Badge>
      case 'em_atendimento':
        return <Badge className="bg-[#0B5CAD] text-white">Em atendimento</Badge>
      case 'escalada_humano':
        return <Badge className="bg-[#A86500] text-white">Escalada</Badge>
      case 'resolvida_ia':
        return <Badge className="bg-[#12805C] text-white">Resolvida (IA)</Badge>
      case 'encerrada':
        return <Badge variant="secondary">Encerrada</Badge>
      default:
        return <Badge variant="outline">{s}</Badge>
    }
  }

  const badgeEnvio = (s?: WaAtendimentoMensagemRecord['status_envio']) => {
    switch (s) {
      case 'pendente':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-[#A86500]">
            <Clock className="h-3 w-3" /> pendente
          </span>
        )
      case 'enviada':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-[#12805C]">
            <CheckCircle2 className="h-3 w-3" /> enviada
          </span>
        )
      case 'falha':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-[#B3261E]">
            <AlertTriangle className="h-3 w-3" /> falha
          </span>
        )
      default:
        return null
    }
  }

  const conversa = conversas.find((c) => c.id === conversaAtiva) || null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#0FA3A3]" />
            <div>
              <CardTitle className="text-base">Atendimentos</CardTitle>
              <CardDescription>
                Conversas recebidas pelo canal QR {canal ? `· ${canal.nome}` : ''}
              </CardDescription>
            </div>
          </div>
          {canal && (
            <Badge
              className={cn(
                canal.status === 'conectado'
                  ? 'bg-[#12805C] text-white'
                  : 'bg-[#FEF3C7] text-[#A86500] hover:bg-[#FEF3C7]',
              )}
            >
              {canal.modo === 'qr' ? 'QR' : canal.modo} · {canal.status}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {carregando ? (
          <div className="py-8 text-center text-sm text-[#64748B]">Carregando atendimentos…</div>
        ) : conversas.length === 0 ? (
          <div className="py-10 text-center">
            <MessageSquare className="h-10 w-10 text-[#94A3B8] mx-auto" />
            <p className="mt-3 text-sm text-[#64748B]">
              Nenhuma conversa ainda. Elas aparecem aqui quando o conector pareado entrega mensagens
              no webhook.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[280px_1fr]">
            {/* Lista de conversas */}
            <ScrollArea className="h-[460px] rounded-lg border">
              <div className="divide-y">
                {conversas.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setConversaAtiva(c.id)}
                    className={cn(
                      'w-full text-left px-3 py-3 hover:bg-[#F8FAFC] transition-colors',
                      c.id === conversaAtiva && 'bg-[#EFF6FF]',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold truncate">{c.contato_nome}</span>
                      <span className="text-[10px] text-[#64748B] shrink-0">
                        {formatarHora(c.ultima_interacao)}
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B] truncate mt-0.5">
                      {c.ultima_mensagem || c.contato_telefone}
                    </p>
                    <div className="mt-1.5">{badgeStatus(c.status)}</div>
                  </button>
                ))}
              </div>
            </ScrollArea>

            {/* Thread de mensagens */}
            <div className="rounded-lg border flex flex-col h-[460px]">
              {conversa ? (
                <>
                  <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold">{conversa.contato_nome}</p>
                      <p className="text-xs text-[#64748B] flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {formatarTelefone(conversa.contato_telefone)}
                      </p>
                    </div>
                    {badgeStatus(conversa.status)}
                  </div>
                  <ScrollArea className="flex-1 px-4 py-3">
                    <div className="space-y-2">
                      {mensagens.length === 0 && (
                        <p className="text-xs text-[#64748B] text-center py-6">
                          Sem mensagens nesta conversa.
                        </p>
                      )}
                      {mensagens.map((m) => {
                        const minha =
                          m.remetente_tipo === 'humano' || m.remetente_tipo === 'sistema'
                        return (
                          <div
                            key={m.id}
                            className={cn('flex', minha ? 'justify-end' : 'justify-start')}
                          >
                            <div
                              className={cn(
                                'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                                minha
                                  ? 'bg-[#DCFCE7] text-[#14532D]'
                                  : 'bg-[#F1F5F9] text-[#1A2333]',
                              )}
                            >
                              {m.remetente_tipo === 'ia' && (
                                <p className="text-[10px] font-semibold text-[#0B5CAD] mb-0.5">
                                  IA
                                </p>
                              )}
                              <p className="whitespace-pre-wrap">{m.conteudo}</p>
                              {m.mensagem_apagada && (
                                <p className="text-[10px] italic text-[#A86500] mt-1">
                                  mensagem apagada no aparelho
                                </p>
                              )}
                              <div className="flex items-center justify-end gap-1 mt-0.5">
                                <span className="text-[10px] opacity-70">
                                  {formatarHora(m.created)}
                                </span>
                                {badgeEnvio(m.status_envio)}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                  <div className="border-t p-3">
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1.5">
                        <Label htmlFor="rumo-whats-rascunho" className="sr-only">
                          Mensagem
                        </Label>
                        <Textarea
                          id="rumo-whats-rascunho"
                          value={rascunho}
                          onChange={(e) => setRascunho(e.target.value)}
                          placeholder="Escreva a resposta… entra na fila com status pendente."
                          rows={2}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              handleEnviar()
                            }
                          }}
                        />
                      </div>
                      <Button onClick={handleEnviar} disabled={enviando || !rascunho.trim()}>
                        <Send className="h-4 w-4 mr-1.5" />
                        Enviar
                      </Button>
                    </div>
                    <p className="text-[10px] text-[#64748B] mt-1.5">
                      O envio é enfileirado com status <code>pendente</code> — o laço de envio do
                      conector despacha pelo socket e grava o wamid de volta.
                      {user?.name ? ` Atendente: ${user.name}.` : ''}
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-[#64748B]">
                  Selecione uma conversa.
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Página /extensao — Rumo Whats
// ---------------------------------------------------------------------------
type AbaId = 'atendimento' | 'chatbot' | 'transmissao' | 'configuracoes' | 'relatorios'

const ABAS: { id: AbaId; rotulo: string }[] = [
  { id: 'atendimento', rotulo: 'Atendimento' },
  { id: 'chatbot', rotulo: 'Chatbot' },
  { id: 'transmissao', rotulo: 'Transmissão' },
  { id: 'configuracoes', rotulo: 'Configurações' },
  { id: 'relatorios', rotulo: 'Relatórios' },
]

export default function ExtensaoWhatsAppPage() {
  const { tenant } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const abaParam = searchParams.get('tab') as AbaId | null
  const aba: AbaId = abaParam && ABAS.some((a) => a.id === abaParam) ? abaParam : 'atendimento'

  const trocarAba = (id: AbaId) => {
    setSearchParams(id === 'atendimento' ? {} : { tab: id }, { replace: false })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      {/* Cabeçalho com registros de produto/versão */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
            Atendimento WhatsApp
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-[#1A2333]">Rumo Whats</h1>
          <p className="text-sm text-[#64748B] mt-1">
            Atendimento WhatsApp com conexão por QR Code (pareamento de aparelho), painel do
            atendente, chatbot, transmissão e relatórios.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#64748B]">
          <Badge variant="outline" className="font-mono">
            {PRODUTO} v{VERSAO_PAINEL}
          </Badge>
          <Badge variant="outline">Conector Baileys</Badge>
          {tenant?.nome && <span className="hidden md:inline">· {tenant.nome}</span>}
        </div>
      </div>

      {/* Abas (deep-link ?tab=) */}
      <div
        role="tablist"
        aria-label="Seções do Rumo Whats"
        className="flex items-center gap-1 border-b border-[#E2E8F0] overflow-x-auto"
      >
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={aba === a.id}
            onClick={() => trocarAba(a.id)}
            className={cn(
              'px-3.5 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors focus-visible:outline-2 focus-visible:outline-[#0FA3A3]',
              aba === a.id
                ? 'border-[#0FA3A3] text-[#0FA3A3]'
                : 'border-transparent text-[#64748B] hover:text-[#1A2333]',
            )}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {aba === 'atendimento' && (
        <>
          <ConexaoQrCard />
          <PainelAtendente />
        </>
      )}
      {aba === 'chatbot' && <RumoWhatsChatbotTab />}
      {aba === 'transmissao' && <RumoWhatsTransmissaoTab />}
      {aba === 'configuracoes' && <RumoWhatsConfigTab />}
      {aba === 'relatorios' && <RumoWhatsRelatoriosTab />}

      <p className="text-[11px] text-[#64748B] border-t pt-3">
        {PRODUTO} v{VERSAO_PAINEL} · Conector: <code>tools/conector-whatsapp</code> (Baileys, QR
        pareamento) · Webhook: <code>/backend/v1/rumo-whats/webhook</code> · Coleções:{' '}
        <code>wa_canais</code>, <code>wa_atendimento_conversas</code>,{' '}
        <code>wa_atendimento_mensagens</code>
      </p>
    </div>
  )
}

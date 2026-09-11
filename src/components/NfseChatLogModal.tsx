import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Send, MessageSquare, Bot, User, Clock, Loader2 } from 'lucide-react'
import type { NfseSolicitacaoRecord } from '@/types'
import { nfseWhatsappService } from '@/services/nfseWhatsapp'
import { useToast } from '@/hooks/use-toast'

interface NfseChatLogModalProps {
  solicitacao: NfseSolicitacaoRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export const NfseChatLogModal: React.FC<NfseChatLogModalProps> = ({
  solicitacao,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { toast } = useToast()
  const [novaMensagem, setNovaMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (!solicitacao) return null

  const historico = solicitacao.historico_mensagens_json || []

  const handleEnviarMensagem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novaMensagem.trim()) return

    setEnviando(true)
    try {
      await nfseWhatsappService.enviarMensagemWhatsApp(solicitacao.id, novaMensagem.trim())
      toast({
        title: 'Mensagem enviada',
        description: 'Registrada no histórico da conversa e enviada ao canal.',
      })
      setNovaMensagem('')
      onSuccess()
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      toast({
        title: 'Falha ao despachar mensagem',
        description: errMsg,
        variant: 'destructive',
      })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between pr-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0FA3A3] text-white text-xs font-bold">
                8
              </span>
              <DialogTitle className="text-base font-bold text-[#1A2333]">
                Log de Conversa WhatsApp & Bot
              </DialogTitle>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {solicitacao.contato_telefone}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-[#64748B]">
            Histórico completo de trocas de mensagens entre o contato ({solicitacao.contato_nome}) e
            o Bot Engine da plataforma.
          </DialogDescription>
        </DialogHeader>

        {/* Chat message timeline */}
        <div className="flex-1 overflow-y-auto space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-xl my-2 max-h-[420px]">
          {historico.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#94A3B8]">
              Nenhuma mensagem estruturada registrada neste atendimento.
            </div>
          ) : (
            historico.map((msg, index) => {
              const isCliente = msg.origem === 'cliente'
              return (
                <div
                  key={index}
                  className={`flex flex-col ${isCliente ? 'items-start' : 'items-end'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    {isCliente ? (
                      <>
                        <User className="h-3 w-3 text-[#64748B]" />
                        <span className="text-[10px] font-semibold text-[#64748B]">
                          {solicitacao.contato_nome} (Cliente)
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] font-semibold text-[#0FA3A3]">
                          Rumo Bot / Escritório
                        </span>
                        <Bot className="h-3 w-3 text-[#0FA3A3]" />
                      </>
                    )}
                    <span className="text-[9px] text-[#94A3B8] flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(msg.data).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-xs leading-relaxed whitespace-pre-wrap ${
                      isCliente
                        ? 'bg-white text-[#1A2333] border border-slate-200 rounded-tl-xs'
                        : 'bg-[#123B6D] text-white rounded-tr-xs'
                    }`}
                  >
                    {msg.texto}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Input para envio de mensagem rápida de suporte */}
        <form onSubmit={handleEnviarMensagem} className="flex gap-2 pt-1">
          <Input
            value={novaMensagem}
            onChange={(e) => setNovaMensagem(e.target.value)}
            placeholder="Enviar resposta ou orientação adicional ao WhatsApp..."
            className="text-xs h-9"
          />
          <Button
            type="submit"
            size="sm"
            disabled={enviando || !novaMensagem.trim()}
            className="bg-[#0FA3A3] hover:bg-[#0d8c8c] text-white text-xs gap-1 shrink-0"
          >
            {enviando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Enviar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

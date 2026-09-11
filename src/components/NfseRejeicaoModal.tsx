import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Send, Loader2 } from 'lucide-react'
import type { NfseSolicitacaoRecord } from '@/types'
import { nfseWhatsappService } from '@/services/nfseWhatsapp'
import { useToast } from '@/hooks/use-toast'

interface NfseRejeicaoModalProps {
  solicitacao: NfseSolicitacaoRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  currentUserId?: string
}

export const NfseRejeicaoModal: React.FC<NfseRejeicaoModalProps> = ({
  solicitacao,
  open,
  onOpenChange,
  onSuccess,
  currentUserId,
}) => {
  const { toast } = useToast()
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)

  React.useEffect(() => {
    if (solicitacao) {
      if (solicitacao.alertas_json && solicitacao.alertas_json.length > 0) {
        const primeiroAlerta = solicitacao.alertas_json[0].mensagem
        setMotivo(`Favor corrigir: ${primeiroAlerta}`)
      } else {
        setMotivo('')
      }
    }
  }, [solicitacao])

  if (!solicitacao) return null

  const handleRejeitar = async () => {
    if (!motivo.trim()) {
      toast({
        title: 'Informe o motivo da devolução',
        description: 'O motivo será enviado ao cliente pelo WhatsApp para correção dos dados.',
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      await nfseWhatsappService.rejeitarSolicitacao(
        solicitacao.tenant_id,
        solicitacao.id,
        motivo.trim(),
        currentUserId || 'system',
      )

      toast({
        title: 'Solicitação devolvida',
        description: 'O apontamento foi registrado e enviado de volta ao WhatsApp (Etapa 8).',
      })
      onSuccess()
      onOpenChange(false)
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      toast({
        title: 'Erro ao devolver solicitação',
        description: errMsg,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-white text-xs font-bold">
              8
            </span>
            <DialogTitle className="text-base font-bold text-[#1A2333]">
              Devolver / Rejeitar Solicitação de NFS-e
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-[#64748B]">
            Etapa 8: O motivo informado será enviado automaticamente de volta ao contato via
            WhatsApp com instruções para reenvio dos dados corretos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-2">
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-900">
              <strong>Contato:</strong> {solicitacao.contato_nome} ({solicitacao.contato_telefone})
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-[#1A2333]">
              Motivo da Devolução / Inconsistência *
            </Label>
            <Textarea
              rows={4}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: O CNPJ informado possui dígito verificador inválido pela Receita Federal. Favor reenviar o CNPJ correto ou cartão CNPJ atualizado."
              className="text-xs"
            />
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-[11px] text-[#64748B]">
            <strong>Mensagem que o cliente receberá:</strong>
            <p className="italic mt-1 text-[#334155]">
              &quot;Olá. Sua solicitação de NFS-e precisou ser devolvida pelo contador com o
              seguinte apontamento: <strong>{motivo || '[seu motivo aqui]'}</strong>. Por favor,
              responda com os dados corrigidos.&quot;
            </p>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={salvando}
            className="text-xs"
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleRejeitar}
            disabled={salvando || !motivo.trim()}
            className="text-xs gap-1.5"
          >
            {salvando ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Devolvendo...
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                Devolver ao WhatsApp
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

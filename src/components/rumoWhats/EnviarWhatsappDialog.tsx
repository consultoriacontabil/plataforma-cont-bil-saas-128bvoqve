/**
 * Diálogo "Enviar por WhatsApp" (Tela 07 do Rumo Whats).
 * Reutilizável: recebe o preview do documento (título + linhas) e o destino,
 * enfileirando em wa_whats_disparos com origem='documento' — tarefa que a
 * ELLIZA (Agente Externo via ZAP) executa. Nunca envio direto do navegador.
 */

import { useEffect, useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { rumoWhatsService, type DocumentoWhats } from '@/services/rumoWhats'
import { useToast } from '@/hooks/use-toast'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId?: string
  documento: DocumentoWhats | null
  /** Telefone sugerido (ex.: cadastro do colaborador/empresa), se houver. */
  telefoneInicial?: string
  /** Descrição curta exibida no dialog (ex.: "Recibo de pagamento · 2026-11"). */
  contexto?: string
  onSuccess?: () => void
}

/** Normaliza o número para o padrão do disparo (só dígitos, com DDI 55). */
function normalizarTelefone(v: string): string {
  const dig = v.replace(/\D/g, '')
  if (!dig) return ''
  if (dig.startsWith('55')) return dig
  return `55${dig}`
}

export function EnviarWhatsappDialog({
  open,
  onOpenChange,
  tenantId,
  documento,
  telefoneInicial = '',
  contexto,
  onSuccess,
}: Props) {
  const { toast } = useToast()
  const [telefone, setTelefone] = useState(telefoneInicial)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (open) {
      setTelefone(telefoneInicial)
      setErro('')
      setEnviando(false)
    }
  }, [open, telefoneInicial])

  const enviar = async () => {
    setErro('')
    const tel = normalizarTelefone(telefone)
    if (tel.length < 12) {
      setErro('Informe um número válido com DDD (ex.: 11 98888-7777).')
      return
    }
    if (!tenantId || !documento) return
    setEnviando(true)
    try {
      const msg = contexto
        ? `${contexto}\n\n${documento.titulo}\n${documento.resumo}`
        : `${documento.titulo}\n${documento.resumo}`
      await rumoWhatsService.enfileirarDocumento(tenantId, {
        telefone: tel,
        mensagem: msg,
        documentoNome: documento.titulo,
        documentoDocId: documento.docId,
        moduloOrigem: documento.moduloOrigem,
        origemId: documento.origemId,
        destinatarioNome: documento.destinatarioNome,
      })
      toast({
        title: 'Envio enfileirado',
        description: `A ELLIZA vai enviar "${documento.titulo}" para ${tel} pelo WhatsApp.`,
      })
      onOpenChange(false)
      onSuccess?.()
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Não foi possível enfileirar o envio',
        description: e instanceof Error ? e.message : undefined,
      })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md" aria-describedby="enviar-whats-desc">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
            <Send className="h-4 w-4 text-[#0FA3A3]" /> Enviar por WhatsApp
          </DialogTitle>
          <DialogDescription id="enviar-whats-desc" className="text-xs text-slate-500">
            {contexto
              ? `${contexto} — a tarefa entra na fila da ELLIZA (ZAP), sem envio direto.`
              : 'A tarefa entra na fila da ELLIZA (ZAP), sem envio direto.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="whats-telefone" className="text-xs text-slate-600">
              Telefone do destinatário
            </Label>
            <Input
              id="whats-telefone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="11 98888-7777"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="h-9 text-sm rounded-xl"
              aria-invalid={!!erro}
            />
            {erro ? (
              <p className="text-[11px] text-red-600" role="alert">
                {erro}
              </p>
            ) : null}
          </div>

          {documento && (
            <div
              className="rounded-xl border border-[#E2E8F0] overflow-hidden"
              aria-label="Pré-visualização do documento"
            >
              <div className="px-3 py-2 bg-slate-50 border-b border-[#E2E8F0]">
                <p className="text-xs font-bold text-[#1A2333]">{documento.titulo}</p>
                <p className="text-[10px] text-slate-500">{documento.tipo}</p>
              </div>
              <div className="px-3 py-2">
                <p className="text-[11px] text-slate-600 whitespace-pre-wrap">{documento.resumo}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="rounded-xl h-9 text-xs"
            onClick={() => onOpenChange(false)}
            disabled={enviando}
          >
            Cancelar
          </Button>
          <Button
            onClick={enviar}
            disabled={enviando || !tenantId || !documento}
            className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs h-9"
          >
            {enviando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Enfileirar envio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

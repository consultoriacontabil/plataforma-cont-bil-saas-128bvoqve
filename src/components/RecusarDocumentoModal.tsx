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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface RecusarDocumentoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemTitulo: string
  onConfirm: (motivo: string) => Promise<void>
}

export function RecusarDocumentoModal({
  open,
  onOpenChange,
  itemTitulo,
  onConfirm,
}: RecusarDocumentoModalProps) {
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!motivo.trim()) return

    try {
      setLoading(true)
      await onConfirm(motivo.trim())
      setMotivo('')
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-xl border-[#E2E8F0]">
        <DialogHeader className="space-y-1.5 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-[#1A2333]">
                Recusar Documento do Cliente
              </DialogTitle>
              <DialogDescription className="text-xs text-[#64748B]">
                Informe o motivo da recusa. O cliente verá este apontamento na página pública para
                reenviar corrigido.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs text-slate-700">
            <span className="font-semibold">Documento: </span>
            <span>{itemTitulo}</span>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-[#1A2333]">
              Motivo da Recusa / Instruções para Reenvio *
            </Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: Documento ilegível ou CNH vencida há mais de 30 dias. Por favor, envie uma foto nítida e frente/verso..."
              rows={3}
              className="text-xs rounded-xl border-[#E2E8F0] resize-none"
              required
            />
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-9 text-xs rounded-xl border-[#E2E8F0]"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !motivo.trim()}
              className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold gap-1.5 shadow-xs"
            >
              {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              <span>Confirmar Recusa e Notificar</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

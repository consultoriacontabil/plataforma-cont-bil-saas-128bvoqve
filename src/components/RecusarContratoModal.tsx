import { useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { contratosService } from '@/services/contratos'
import type { ContratoHonorarioRecord } from '@/types'

interface RecusarContratoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contrato: ContratoHonorarioRecord | null
  onSuccess: () => void
}

export function RecusarContratoModal({
  open,
  onOpenChange,
  contrato,
  onSuccess,
}: RecusarContratoModalProps) {
  const { toast } = useToast()
  const [justificativa, setJustificativa] = useState('')
  const [loading, setLoading] = useState(false)

  if (!contrato) return null

  const handleRecusar = async () => {
    if (!justificativa.trim()) {
      toast({
        title: 'Justificativa obrigatória',
        description: 'Por favor, detalhe o motivo da recusa ou as cláusulas a serem ajustadas.',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)
      await contratosService.recusar(contrato.id, justificativa.trim())

      toast({
        title: 'Documento recusado',
        description: 'O escritório contábil foi notificado e poderá revisar as condições.',
      })

      setJustificativa('')
      onOpenChange(false)
      onSuccess()
    } catch (err: unknown) {
      console.error('Erro ao recusar contrato:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao registrar recusa.'
      toast({
        title: 'Erro',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl bg-white border-[#E2E8F0]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-rose-600 mb-1">
            <AlertCircle className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Apontamento de Recusa
            </span>
          </div>
          <DialogTitle className="text-base font-bold text-[#1A2333]">
            Recusar {contrato.tipo === 'proposta' ? 'Proposta' : 'Contrato'}
          </DialogTitle>
          <DialogDescription className="text-xs text-[#64748B]">
            Informe para o escritório os motivos ou condições que devem ser alterados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div>
            <Label className="text-xs font-semibold text-[#1A2333]">
              Motivo da Recusa / Ajustes Solicitados *
            </Label>
            <Textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex.: Gostaria de ajustar a Cláusula 2ª referente à data de vencimento (preferência pelo dia 20) e incluir escopo específico de consultoria tributária..."
              rows={4}
              className="mt-1 text-xs rounded-xl border-[#E2E8F0] resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-xs text-[#64748B]"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleRecusar}
            disabled={loading || !justificativa.trim()}
            className="rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                <span>Enviando Recusa...</span>
              </>
            ) : (
              <span>Confirmar Recusa com Justificativa</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

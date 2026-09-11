import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Printer, Download, Code, FileText, CheckCircle } from 'lucide-react'
import type { NfseNotaEmitidaRecord, Empresa } from '@/types'
import { gerarDanfseHtml } from '@/services/nfseWhatsapp'
import { useToast } from '@/hooks/use-toast'

interface NfseVisualizadorModalProps {
  nota: NfseNotaEmitidaRecord | null
  empresa?: Empresa
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const NfseVisualizadorModal: React.FC<NfseVisualizadorModalProps> = ({
  nota,
  empresa,
  open,
  onOpenChange,
}) => {
  const { toast } = useToast()

  if (!nota) return null

  const htmlDanfse = gerarDanfseHtml(nota, empresa)

  const handleImprimir = () => {
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(htmlDanfse)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => {
        printWindow.print()
      }, 500)
    } else {
      toast({
        title: 'Bloqueador de pop-ups detectado',
        description: 'Permita pop-ups para abrir a janela de impressão da DANFSE.',
        variant: 'destructive',
      })
    }
  }

  const handleDownloadXml = () => {
    const xml = nota.xml_conteudo || ''
    if (!xml) {
      toast({
        title: 'XML não disponível',
        description: 'Esta nota fiscal não possui conteúdo XML gravado.',
        variant: 'destructive',
      })
      return
    }

    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `NFSe_${nota.numero_nota}_${nota.codigo_verificacao}.xml`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: 'Download iniciado',
      description: `Arquivo XML da NFS-e Nº ${nota.numero_nota} baixado.`,
    })
  }

  const handleDownloadXmlCancelamento = () => {
    if (!nota.xml_cancelamento) {
      toast({
        title: 'XML não disponível',
        description: 'Não há XML de cancelamento arquivado para esta nota fiscal.',
        variant: 'destructive',
      })
      return
    }

    const blob = new Blob([nota.xml_cancelamento], { type: 'application/xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Cancelamento_NFSe_${nota.numero_nota}.xml`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: 'Download iniciado',
      description: `Arquivo Cancelamento_NFSe_${nota.numero_nota}.xml baixado com sucesso.`,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-4">
        <DialogHeader className="pb-2 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pr-6">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0FA3A3] text-white text-xs font-bold">
                6
              </span>
              <div>
                <DialogTitle className="text-base font-bold text-[#1A2333]">
                  DANFSE Eletrônica — Nota Fiscal Nº {nota.numero_nota}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#64748B]">
                  Código de Verificação:{' '}
                  <strong className="font-mono text-[#0FA3A3]">{nota.codigo_verificacao}</strong> |
                  Competência: {nota.competencia}
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {nota.status === 'cancelada' && nota.xml_cancelamento && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadXmlCancelamento}
                  className="text-xs gap-1.5 h-8 text-rose-700 border-rose-300 hover:bg-rose-50"
                  title="Baixar XML do Evento de Cancelamento"
                >
                  <Code className="h-3.5 w-3.5 text-rose-600" />
                  XML Cancelamento
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadXml}
                className="text-xs gap-1.5 h-8"
              >
                <Code className="h-3.5 w-3.5" />
                Baixar XML
              </Button>
              <Button
                size="sm"
                onClick={handleImprimir}
                className="bg-[#0FA3A3] hover:bg-[#0d8c8c] text-white text-xs gap-1.5 h-8"
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimir / PDF
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Preview Iframe da DANFSE */}
        <div className="flex-1 w-full min-h-[500px] border border-slate-200 rounded-lg overflow-hidden bg-white mt-2 shadow-inner">
          <iframe
            title={`DANFSE ${nota.numero_nota}`}
            srcDoc={htmlDanfse}
            className="w-full h-full border-none"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

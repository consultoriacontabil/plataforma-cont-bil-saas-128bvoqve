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
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Copy,
  Check,
  ExternalLink,
  QrCode,
  RefreshCw,
  Power,
  ShieldCheck,
  Share2,
} from 'lucide-react'
import type { CompanyOnboardingWorkflowRecord } from '@/types'
import { companyOnboardingService } from '@/services/companyOnboarding'
import { useAuth } from '@/contexts/AuthContext'

interface GerarLinkPublicoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workflow: CompanyOnboardingWorkflowRecord | null
  onWorkflowUpdated: (wf: CompanyOnboardingWorkflowRecord) => void
}

export function GerarLinkPublicoModal({
  open,
  onOpenChange,
  workflow,
  onWorkflowUpdated,
}: GerarLinkPublicoModalProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [loadingAction, setLoadingAction] = useState(false)
  const [showQr, setShowQr] = useState(false)

  if (!workflow) return null

  const origin = window.location.origin
  const publicUrl = `${origin}/abertura/${workflow.token}`

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      toast({
        title: 'Link copiado!',
        description: 'A URL de envio de documentos foi copiada para a área de transferência.',
      })
      setTimeout(() => setCopied(false), 2500)
    } catch (_) {
      toast({
        variant: 'destructive',
        title: 'Não foi possível copiar',
        description: 'Selecione o link manualmente.',
      })
    }
  }

  const handleRegenerarToken = async () => {
    if (
      !confirm(
        'Tem certeza que deseja regenerar o link? O link anterior deixará de funcionar imediatamente.',
      )
    ) {
      return
    }

    try {
      setLoadingAction(true)
      const updated = await companyOnboardingService.regenerarToken(
        workflow.id,
        user?.id || '',
        workflow.tenant_id,
      )
      onWorkflowUpdated(updated)
      toast({
        title: 'Link regenerado!',
        description: 'Um novo token criptográfico exclusivo foi gerado para este cliente.',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao regenerar link.'
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: msg,
      })
    } finally {
      setLoadingAction(false)
    }
  }

  const handleToggleAtivo = async () => {
    const novoEstado = !workflow.link_ativo
    try {
      setLoadingAction(true)
      const updated = await companyOnboardingService.alternarLinkAtivo(
        workflow.id,
        novoEstado,
        user?.id || '',
        workflow.tenant_id,
      )
      onWorkflowUpdated(updated)
      toast({
        title: novoEstado ? 'Link reativado' : 'Link revogado com sucesso',
        description: novoEstado
          ? 'O cliente já pode acessar e anexar documentos novamente.'
          : 'O acesso público para este cliente foi bloqueado temporariamente.',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao alterar estado.'
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: msg,
      })
    } finally {
      setLoadingAction(false)
    }
  }

  // Gera URL de QR Code usando api pública segura de QR Code (sem dependência pesada instalada)
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    publicUrl,
  )}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl bg-white p-6 shadow-xl border-[#E2E8F0]">
        <DialogHeader className="space-y-1.5 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-[#0FA3A3]">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-[#1A2333]">
                Link Público de Abertura & Envio de Documentos
              </DialogTitle>
              <DialogDescription className="text-xs text-[#64748B]">
                Envie este link seguro diretamente para o cliente anexar documentos e dados da
                empresa.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Status do Link */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2">
              <ShieldCheck
                className={`h-4 w-4 ${workflow.link_ativo ? 'text-emerald-600' : 'text-slate-400'}`}
              />
              <span className="text-xs font-semibold text-[#1A2333]">Status do Acesso:</span>
            </div>
            {workflow.link_ativo ? (
              <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                Ativo & Acessível
              </Badge>
            ) : (
              <Badge className="bg-rose-100 text-rose-800 text-[10px] font-bold">
                Revogado / Inativo
              </Badge>
            )}
          </div>

          {/* Campo de URL com botão de copiar */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#1A2333]">
              URL Direta para Envio ao Cliente
            </Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={publicUrl}
                className="h-10 text-xs font-mono bg-slate-50 border-[#E2E8F0] select-all rounded-xl"
              />
              <Button
                type="button"
                onClick={handleCopyLink}
                className="h-10 px-4 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs font-semibold gap-1.5 shrink-0"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </Button>
            </div>
          </div>

          {/* Botões de Ação Rápida */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              asChild
              className="h-8 text-xs rounded-xl gap-1.5 border-[#E2E8F0] text-slate-700 hover:bg-slate-50"
            >
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                <span>Testar / Abrir Link</span>
              </a>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowQr(!showQr)}
              className="h-8 text-xs rounded-xl gap-1.5 border-[#E2E8F0] text-slate-700 hover:bg-slate-50"
            >
              <QrCode className="h-3.5 w-3.5 text-slate-500" />
              <span>{showQr ? 'Ocultar QR Code' : 'Visualizar QR Code'}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleToggleAtivo}
              disabled={loadingAction}
              className={`h-8 text-xs rounded-xl gap-1.5 border-[#E2E8F0] ${
                workflow.link_ativo
                  ? 'text-rose-600 hover:bg-rose-50'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <Power className="h-3.5 w-3.5" />
              <span>{workflow.link_ativo ? 'Revogar Acesso' : 'Reativar Acesso'}</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRegenerarToken}
              disabled={loadingAction}
              className="h-8 text-xs rounded-xl gap-1.5 text-slate-500 hover:text-slate-800 ml-auto"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loadingAction ? 'animate-spin text-[#0FA3A3]' : ''}`}
              />
              <span>Regenerar Token</span>
            </Button>
          </div>

          {/* QR Code expansível */}
          {showQr && (
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center space-y-2 animate-fade-in">
              <img
                src={qrCodeUrl}
                alt="QR Code do Link Público"
                className="h-44 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-2xs"
              />
              <p className="text-[11px] text-[#64748B] text-center max-w-xs">
                O cliente pode apontar a câmera do celular ou WhatsApp para acessar a página de
                envio direto do smartphone.
              </p>
            </div>
          )}

          {/* Aviso informativo de segurança */}
          <div className="rounded-xl bg-blue-50/70 border border-blue-200 p-3 text-[11px] text-blue-900 leading-relaxed">
            <p className="font-semibold mb-0.5">Como funciona a segurança do cliente?</p>
            O cliente não precisa ter login nem senha na plataforma contábil. O token exclusivo
            permite apenas anexar documentos e consultar o status do checklist desta abertura
            específica.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

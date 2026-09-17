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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { RefreshCw, PlusCircle, Building2, User } from 'lucide-react'
import type { CompanyOnboardingWorkflowRecord, NaturezaJuridicaTipo } from '@/types'
import { companyOnboardingService } from '@/services/companyOnboarding'
import { useAuth } from '@/contexts/AuthContext'
import { maskPhone } from '@/lib/formatters'

interface NovoWorkflowAberturaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  empresaIdPadrao?: string
  razaoSocialPadrao?: string
  naturezaPadrao?: NaturezaJuridicaTipo
  onCreated: (wf: CompanyOnboardingWorkflowRecord) => void
}

export function NovoWorkflowAberturaModal({
  open,
  onOpenChange,
  tenantId,
  empresaIdPadrao,
  razaoSocialPadrao,
  naturezaPadrao,
  onCreated,
}: NovoWorkflowAberturaModalProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const [titulo, setTitulo] = useState('')
  const [razaoSocial, setRazaoSocial] = useState(razaoSocialPadrao || '')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [naturezaJuridica, setNaturezaJuridica] = useState<NaturezaJuridicaTipo>(
    naturezaPadrao || 'slu',
  )
  const [clienteNome, setClienteNome] = useState('')
  const [clienteEmail, setClienteEmail] = useState('')
  const [clienteTelefone, setClienteTelefone] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId) return

    const nomeWorkflow =
      titulo.trim() ||
      (razaoSocial.trim()
        ? `Abertura: ${razaoSocial.trim()}`
        : `Abertura ${naturezaJuridica.toUpperCase()}`)

    try {
      setLoading(true)
      const novoWf = await companyOnboardingService.create(
        {
          tenant_id: tenantId,
          empresa_id: empresaIdPadrao || undefined,
          solicitante_id: user?.id,
          titulo: nomeWorkflow,
          razao_social_pretendida: razaoSocial.trim(),
          nome_fantasia_pretendido: nomeFantasia.trim(),
          natureza_juridica: naturezaJuridica,
          cliente_nome: clienteNome.trim(),
          cliente_email: clienteEmail.trim(),
          cliente_telefone: clienteTelefone.trim(),
          observacoes: observacoes.trim(),
        },
        user?.id || '',
      )

      toast({
        title: 'Workflow de abertura iniciado!',
        description:
          'O fluxo foi criado com checklist automático e o link público já está pronto para envio.',
      })

      onCreated(novoWf)
      onOpenChange(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao criar workflow.'
      toast({
        variant: 'destructive',
        title: 'Erro ao iniciar workflow',
        description: msg,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl bg-white p-6 shadow-xl border-[#E2E8F0]">
        <DialogHeader className="space-y-1.5 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-[#0FA3A3]">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-[#1A2333]">
                Iniciar Novo Workflow de Abertura
              </DialogTitle>
              <DialogDescription className="text-xs text-[#64748B]">
                Cria o checklist de documentos oficial e gera o link público para envio ao cliente.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-[#1A2333]">
              Título / Identificação do Processo *
            </Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Abertura - Drogaria Nova Esperança"
              className="h-10 text-xs rounded-xl border-[#E2E8F0]"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#1A2333]">
                Razão Social Pretendida
              </Label>
              <Input
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                placeholder="Ex.: Nova Esperança Medicamentos LTDA"
                className="h-9 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#1A2333]">
                Tipo Societário Previsto
              </Label>
              <Select
                value={naturezaJuridica}
                onValueChange={(val) => setNaturezaJuridica(val as NaturezaJuridicaTipo)}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slu">SLU - Limitada Unipessoal</SelectItem>
                  <SelectItem value="ltda">LTDA - Sociedade Empresária</SelectItem>
                  <SelectItem value="mei">MEI - Microempreendedor</SelectItem>
                  <SelectItem value="ei">EI - Empresário Individual</SelectItem>
                  <SelectItem value="sociedade_simples_pura">Sociedade Simples</SelectItem>
                  <SelectItem value="sa_fechada">S/A Fechada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dados do Cliente */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#1A2333]">
              <User className="h-4 w-4 text-[#0FA3A3]" />
              <span>Dados do Cliente / Solicitante (opcional)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="space-y-0.5">
                <Label className="text-[10px] text-[#64748B]">Nome</Label>
                <Input
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                  placeholder="Nome do cliente"
                  className="h-8 text-xs rounded-lg bg-white"
                />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] text-[#64748B]">E-mail</Label>
                <Input
                  type="email"
                  value={clienteEmail}
                  onChange={(e) => setClienteEmail(e.target.value)}
                  placeholder="cliente@email.com"
                  className="h-8 text-xs rounded-lg bg-white"
                />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] text-[#64748B]">WhatsApp</Label>
                <Input
                  value={clienteTelefone}
                  onChange={(e) => setClienteTelefone(maskPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className="h-8 text-xs rounded-lg bg-white"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-[#1A2333]">Observações Iniciais</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Instruções para a equipe interna ou particularidades do cliente..."
              rows={2}
              className="text-xs rounded-xl resize-none border-[#E2E8F0]"
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
              disabled={loading}
              className="h-9 px-5 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs font-semibold gap-2 shadow-xs"
            >
              {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              <span>Iniciar e Gerar Link</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

import { useState } from 'react'
import { Send, Loader2, ShieldCheck, Building2, Mail, User, Info } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useToast } from '@/hooks/use-toast'
import { assinaturasService } from '@/services/assinaturas'
import { contratosService } from '@/services/contratos'
import type {
  ContratoHonorarioRecord,
  Empresa,
  TipoAssinaturaDemonstrativo,
  DadosCongeladosContrato,
} from '@/types'

interface SolicitarAssinaturaContratoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contrato: ContratoHonorarioRecord | null
  empresa: Empresa | null
  tenantNome?: string
  tenantCnpj?: string
  onSuccess: () => void
}

export function SolicitarAssinaturaContratoModal({
  open,
  onOpenChange,
  contrato,
  empresa,
  tenantNome = 'Rumo Consultoria Contábil',
  tenantCnpj = '12.345.678/0001-90',
  onSuccess,
}: SolicitarAssinaturaContratoModalProps) {
  const { toast } = useToast()
  const [tipoAssinatura, setTipoAssinatura] =
    useState<TipoAssinaturaDemonstrativo>('eletronica_declarada')
  const [assinante, setAssinante] = useState('')
  const [cargoCpf, setCargoCpf] = useState('Representante Legal')
  const [emailAssinante, setEmailAssinante] = useState('')
  const [loading, setLoading] = useState(false)

  if (!contrato) return null

  const handleSolicitar = async () => {
    if (!assinante.trim()) {
      toast({
        title: 'Assinante obrigatório',
        description: 'Informe o nome completo do signatário.',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)

      // 1. Preparar e congelar os dados contratuais
      const dadosCongelados: DadosCongeladosContrato = {
        titulo: contrato.titulo,
        tipo: contrato.tipo,
        empresa: empresa
          ? {
              id: empresa.id,
              razao_social: empresa.razao_social,
              nome_fantasia: empresa.nome_fantasia,
              cnpj: empresa.cnpj,
            }
          : undefined,
        escritorio: {
          nome: tenantNome,
          cnpj: tenantCnpj,
          crc: 'CRC/SP 2SP034821/O',
        },
        modelo_mensalidade: contrato.modelo_mensalidade,
        valor_mensal: contrato.valor_mensal,
        dia_vencimento: contrato.dia_vencimento,
        prazo_contrato: contrato.prazo_contrato,
        data_inicio: contrato.data_inicio,
        clausulas: contrato.clausulas,
        gerado_em: new Date().toISOString(),
      }

      // 2. Atualizar contrato com dados congelados e status 'enviado'
      await contratosService.enviarAoCliente(contrato.id, dadosCongelados)

      // 3. Criar registro formal de assinatura na coleção assinaturas_demonstrativos
      const assCriada = await assinaturasService.solicitarAssinatura({
        tenantId: contrato.tenant_id,
        contratoId: contrato.id,
        tipoDocumento: 'contrato_honorarios',
        empresaId: contrato.empresa || empresa?.id,
        competencia: '09/2026',
        tipoAssinatura: tipoAssinatura,
        tipoCertificado: 'nenhum',
        assinante: assinante.trim(),
        cargoCpf: cargoCpf.trim(),
        emailAssinante: emailAssinante.trim(),
        dadosDocumento: dadosCongelados as unknown as Record<string, unknown>,
      })

      toast({
        title: 'Assinatura solicitada com sucesso!',
        description: `Token público gerado: ${assCriada.token_verificacao}. O cliente foi notificado.`,
      })

      onOpenChange(false)
      onSuccess()
    } catch (err: unknown) {
      console.error('Erro ao solicitar assinatura de contrato:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao solicitar assinatura.'
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
      <DialogContent className="max-w-lg rounded-2xl bg-white border-[#E2E8F0]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-[#0FA3A3] mb-1">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Fluxo Formal de Assinatura Digital
            </span>
          </div>
          <DialogTitle className="text-lg font-bold text-[#1A2333]">
            Solicitar Assinatura de {contrato.tipo === 'proposta' ? 'Proposta' : 'Contrato'}
          </DialogTitle>
          <DialogDescription className="text-xs text-[#64748B]">
            O documento será congelado, o hash SHA-256 será computado e uma notificação com e-mail
            será enviada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Modalidade de Assinatura */}
          <div>
            <Label className="text-xs font-semibold text-[#1A2333] mb-2 block">
              Modalidade de Assinatura
            </Label>
            <RadioGroup
              value={tipoAssinatura}
              onValueChange={(val) => setTipoAssinatura(val as TipoAssinaturaDemonstrativo)}
              className="grid grid-cols-1 gap-2"
            >
              <label
                htmlFor="opt-eletronica-ctr"
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  tipoAssinatura === 'eletronica_declarada'
                    ? 'border-[#0FA3A3] bg-[#0FA3A3]/5'
                    : 'border-[#E2E8F0] hover:bg-slate-50'
                }`}
              >
                <RadioGroupItem
                  value="eletronica_declarada"
                  id="opt-eletronica-ctr"
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <div className="font-bold text-[#1A2333] flex items-center gap-1.5">
                    <span>Eletrônica Avançada / Declarada</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-sm">
                      Recomendado
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748B]">
                    Assinatura ágil pelo Portal ou link com hash SHA-256, carimbo de tempo, IP e
                    validade plena pela MP 2.200-2/2001 e Lei 14.063/2020.
                  </p>
                </div>
              </label>

              <label
                htmlFor="opt-icp-ctr"
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  tipoAssinatura === 'icp_brasil'
                    ? 'border-[#0FA3A3] bg-[#0FA3A3]/5'
                    : 'border-[#E2E8F0] hover:bg-slate-50'
                }`}
              >
                <RadioGroupItem value="icp_brasil" id="opt-icp-ctr" className="mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold text-[#1A2333]">Certificado ICP-Brasil (A1 / A3)</div>
                  <p className="text-[11px] text-[#64748B]">
                    Assinatura qualificada via token criptográfico com despacho automático ao
                    gateway contratual.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold text-[#1A2333]">
                Nome do Assinante / Signatário *
              </Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
                <Input
                  value={assinante}
                  onChange={(e) => setAssinante(e.target.value)}
                  placeholder="Ex.: Carlos Eduardo Silva"
                  className="pl-9 h-9 text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-[#1A2333]">Cargo / CPF</Label>
                <Input
                  value={cargoCpf}
                  onChange={(e) => setCargoCpf(e.target.value)}
                  placeholder="Diretor Geral - CPF..."
                  className="mt-1 h-9 text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-[#1A2333]">
                  E-mail para Notificação
                </Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
                  <Input
                    type="email"
                    value={emailAssinante}
                    onChange={(e) => setEmailAssinante(e.target.value)}
                    placeholder="carlos@empresa.com.br"
                    className="pl-9 h-9 text-xs rounded-xl border-[#E2E8F0]"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900 text-[11px] flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <p>
              Ao confirmar, o status passará para <strong>Enviado</strong>, permitindo ao signatário
              assinar digitalmente no Portal ou verificar em <code>/verificar-assinatura</code>.
            </p>
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
            onClick={handleSolicitar}
            disabled={loading || !assinante.trim()}
            className="rounded-xl text-xs font-semibold bg-[#0FA3A3] hover:bg-[#0D8B8B] text-white shadow-xs gap-1.5"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Gerando & Enviando...</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                <span>Congelar Dados & Solicitar Assinatura</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { useState } from 'react'
import {
  ShieldCheck,
  Lock,
  AlertTriangle,
  FileCheck,
  Send,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { assinaturasService } from '@/services/assinaturas'
import { contratosService } from '@/services/contratos'
import type {
  ContratoHonorarioRecord,
  Empresa,
  AssinaturaDemonstrativoRecord,
  DadosCongeladosContrato,
} from '@/types'

interface AssinarContratoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contrato: ContratoHonorarioRecord | null
  empresa: Empresa | null
  assinaturaExistente?: AssinaturaDemonstrativoRecord | null
  tenantNome?: string
  tenantCnpj?: string
  userEmail?: string
  userName?: string
  onSuccess: () => void
}

export function AssinarContratoModal({
  open,
  onOpenChange,
  contrato,
  empresa,
  assinaturaExistente,
  tenantNome = 'Rumo Consultoria Contábil',
  tenantCnpj = '12.345.678/0001-90',
  userEmail = '',
  userName = '',
  onSuccess,
}: AssinarContratoModalProps) {
  const { toast } = useToast()
  const [concordou, setConcordou] = useState(false)
  const [assinanteNome, setAssinanteNome] = useState(userName || '')
  const [cargoCpf, setCargoCpf] = useState('Representante Legal')
  const [loading, setLoading] = useState(false)

  if (!contrato) return null

  const handleAssinar = async () => {
    if (!concordou) {
      toast({
        title: 'Declaração obrigatória',
        description: 'Você precisa declarar ciência e concordância com os termos do contrato.',
        variant: 'destructive',
      })
      return
    }

    if (!assinanteNome.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome do signatário responsável.',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)

      // Garantir dados congelados
      const dadosCongelados: DadosCongeladosContrato =
        (contrato.dados_congelados as DadosCongeladosContrato) || {
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

      let assinaturaId = assinaturaExistente?.id

      // Se ainda não houver assinatura criada, criar a solicitação primeiro
      if (!assinaturaId) {
        const novaAss = await assinaturasService.solicitarAssinatura({
          tenantId: contrato.tenant_id,
          contratoId: contrato.id,
          tipoDocumento: 'contrato_honorarios',
          empresaId: contrato.empresa || empresa?.id,
          competencia: '09/2026',
          tipoAssinatura: 'eletronica_declarada',
          tipoCertificado: 'nenhum',
          assinante: assinanteNome.trim(),
          cargoCpf: cargoCpf.trim(),
          emailAssinante: userEmail,
          dadosDocumento: dadosCongelados as unknown as Record<string, unknown>,
        })
        assinaturaId = novaAss.id
      }

      // Executar a assinatura com validação de hash e carimbo de tempo
      await assinaturasService.assinar({
        assinaturaId: assinaturaId,
        contratoId: contrato.id,
        dadosAtuais: dadosCongelados as unknown as Record<string, unknown>,
        ipAssinatura: `${window.location.hostname} (Portal Cliente HTTPS Autenticado)`,
        observacoes: `Assinatura digital concluída via Portal pelo titular ${assinanteNome.trim()}.`,
      })

      // Atualizar status do contrato para assinado
      await contratosService.update(contrato.id, {
        status: 'assinado',
      })

      toast({
        title: 'Contrato assinado com sucesso!',
        description:
          'Sua assinatura foi registrada e o documento foi autenticado com hash SHA-256.',
      })

      onOpenChange(false)
      onSuccess()
    } catch (err: unknown) {
      console.error('Erro ao assinar contrato:', err)
      const msg = err instanceof Error ? err.message : 'Falha na assinatura eletrônica.'
      toast({
        title: 'Erro na assinatura',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl bg-white border-[#E2E8F0]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-[#0FA3A3] mb-1">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Assinatura Eletrônica Legal — Lei 14.063/2020
            </span>
          </div>
          <DialogTitle className="text-lg font-bold text-[#1A2333]">
            Assinar {contrato.tipo === 'proposta' ? 'Proposta Comercial' : 'Contrato de Honorários'}
          </DialogTitle>
          <DialogDescription className="text-xs text-[#64748B]">
            Documento: <strong className="text-[#1A2333]">{contrato.titulo}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-slate-700">
              <span className="font-semibold">Valor Mensal:</span>
              <span className="font-bold text-[#0FA3A3] text-sm">
                R$ {contrato.valor_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-700">
              <span className="font-semibold">Vencimento & Vigência:</span>
              <span className="font-medium text-slate-900">
                Dia {contrato.dia_vencimento} • {contrato.prazo_contrato} meses
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-700">
              <span className="font-semibold">Escritório Contábil:</span>
              <span className="font-medium text-slate-900">{tenantNome}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold text-[#1A2333]">
                Nome Completo do Assinante *
              </Label>
              <Input
                value={assinanteNome}
                onChange={(e) => setAssinanteNome(e.target.value)}
                placeholder="Ex.: Carlos Eduardo Silva"
                className="mt-1 h-9 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-[#1A2333]">Cargo / CPF *</Label>
              <Input
                value={cargoCpf}
                onChange={(e) => setCargoCpf(e.target.value)}
                placeholder="Ex.: Diretor Geral - CPF 123.456.789-00"
                className="mt-1 h-9 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>
          </div>

          {/* Declaração de Integridade e Aceite Legal */}
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 space-y-2">
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="concordo-contrato"
                checked={concordou}
                onCheckedChange={(checked) => setConcordou(!!checked)}
                className="mt-0.5 border-emerald-500 data-[state=checked]:bg-emerald-600"
              />
              <label
                htmlFor="concordo-contrato"
                className="text-[11px] leading-relaxed cursor-pointer font-medium select-none"
              >
                Declaro que li, compreendi e concordo integralmente com todas as cláusulas, valores
                e condições estipuladas neste instrumento, conferindo eficácia jurídica e executiva
                com fulcro na <strong>Medida Provisória nº 2.200-2/2001</strong> e na{' '}
                <strong>Lei Federal nº 14.063/2020</strong>.
              </label>
            </div>
            <p className="text-[10px] text-emerald-800 flex items-center gap-1 pl-6">
              <Lock className="h-3 w-3 inline text-emerald-600" />
              Garantia de integridade com hash SHA-256 e endereço IP registrado.
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
            onClick={handleAssinar}
            disabled={loading || !concordou || !assinanteNome.trim()}
            className="rounded-xl text-xs font-semibold bg-[#16A34A] hover:bg-[#15803D] text-white shadow-xs gap-1.5"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Autenticando & Assinando...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>Confirmar Assinatura Digital</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

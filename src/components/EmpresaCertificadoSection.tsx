import React, { useState, useEffect } from 'react'
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  KeyRound,
  UploadCloud,
  FileCheck,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Info,
  Calendar,
  Building,
  CheckCircle2,
  Trash2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { certificadosService, type CertificadoSaudeInfo } from '@/services/certificados'
import type {
  CertificadoDigitalRecord,
  TipoCertificadoDigital,
  StatusCertificadoDigital,
} from '@/types'
import { useToast } from '@/hooks/use-toast'
import { formatDatePtBr } from '@/lib/formatters'

export interface CertificadoFormState {
  id?: string
  tipo: TipoCertificadoDigital
  titular: string
  numero_serie: string
  emissor: string
  validade: string
  senha?: string
  status: StatusCertificadoDigital
  observacoes: string
  arquivoFile?: File | null
  arquivoNomeAtual?: string
}

interface EmpresaCertificadoSectionProps {
  empresaId?: string
  razaoSocial?: string
  cnpj?: string
  canEdit: boolean
  formState: CertificadoFormState
  onChange: (state: CertificadoFormState) => void
  onDeleteCertificado?: () => Promise<void>
}

export function EmpresaCertificadoSection({
  empresaId,
  razaoSocial,
  cnpj,
  canEdit,
  formState,
  onChange,
  onDeleteCertificado,
}: EmpresaCertificadoSectionProps) {
  const { toast } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Auto preencher titular sugerido se estiver vazio
  useEffect(() => {
    if (!formState.titular && (razaoSocial || cnpj)) {
      const cleanCnpj = cnpj?.replace(/\D/g, '') || ''
      const titularSugerido = razaoSocial ? `${razaoSocial.toUpperCase()}:${cleanCnpj}` : cleanCnpj
      onChange({ ...formState, titular: titularSugerido })
    }
  }, [razaoSocial, cnpj, formState, onChange])

  const simulatedCert: Partial<CertificadoDigitalRecord> | null = formState.validade
    ? {
        validade: formState.validade,
        status: formState.status,
      }
    : null

  const saude: CertificadoSaudeInfo = certificadosService.calcularSaude(
    simulatedCert as CertificadoDigitalRecord,
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const lower = file.name.toLowerCase()
      if (!lower.endsWith('.pfx') && !lower.endsWith('.p12')) {
        toast({
          variant: 'destructive',
          title: 'Arquivo incompatível',
          description: 'Selecione um arquivo de certificado A1 com extensão .pfx ou .p12.',
        })
        return
      }

      onChange({
        ...formState,
        arquivoFile: file,
        arquivoNomeAtual: file.name,
      })

      toast({
        title: 'Certificado selecionado',
        description: `Arquivo ${file.name} pronto para envio.`,
      })
    }
  }

  const handleDelete = async () => {
    if (!onDeleteCertificado) return
    if (!window.confirm('Tem certeza que deseja remover o certificado desta empresa?')) return
    try {
      setDeleting(true)
      await onDeleteCertificado()
      toast({
        title: 'Certificado removido',
        description: 'Os dados do certificado foram excluídos.',
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: 'Não foi possível remover o certificado.',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="rounded-2xl border-[#E2E8F0] shadow-xs overflow-hidden">
      <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#0FA3A3]" />
            <div>
              <CardTitle className="text-sm font-bold text-[#1A2333]">
                Gestão de Certificado Digital (e-CNPJ)
              </CardTitle>
              <CardDescription className="text-xs text-[#64748B]">
                Vincule o certificado da empresa para assinar obrigações, consultar certidões e
                manter regularidade fiscal
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {formState.validade ? (
              saude.saude === 'valido' ? (
                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold gap-1.5 py-1 px-3">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Certificado OK ({saude.diasRestantes}d)</span>
                </Badge>
              ) : saude.saude === 'proximo_vencimento' ? (
                <Badge className="bg-amber-50 text-amber-800 border border-amber-300 text-xs font-semibold gap-1.5 py-1 px-3 animate-pulse">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                  <span>Vence em {saude.diasRestantes} dias</span>
                </Badge>
              ) : (
                <Badge className="bg-red-50 text-red-700 border border-red-200 text-xs font-semibold gap-1.5 py-1 px-3">
                  <ShieldX className="h-3.5 w-3.5 text-red-600" />
                  <span>Certificado Expirado</span>
                </Badge>
              )
            ) : (
              <Badge variant="outline" className="text-xs text-slate-500 border-dashed">
                Não configurado
              </Badge>
            )}

            {formState.id && canEdit && onDeleteCertificado && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="h-8 px-2 text-xs text-red-600 hover:bg-red-50"
                title="Excluir certificado"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Aviso de Segurança e Tipo de Certificado */}
        <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-3 text-xs text-[#0B1F3A] flex items-start gap-2.5">
          <Info className="h-4 w-4 text-[#0FA3A3] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-[#0B1F3A]">Segurança e Proteção de Senha</p>
            <p className="text-[#64748B] text-[11px] leading-relaxed">
              O arquivo A1 (.pfx/.p12) e a senha são salvos de forma protegida para execução de
              rotinas automáticas da contabilidade (SPED, DCTFWeb, e-CAC). Recomendamos restringir o
              acesso apenas a contadores e administradores autorizados.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Tipo de Certificado */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#1A2333]">Tipo de Certificado *</Label>
            <Select
              disabled={!canEdit}
              value={formState.tipo}
              onValueChange={(val: TipoCertificadoDigital) => {
                onChange({
                  ...formState,
                  tipo: val,
                  // Se mudar para A3, limpa arquivo PFX pois A3 é hardware físico
                  arquivoFile: val === 'a3' ? null : formState.arquivoFile,
                })
              }}
            >
              <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a1">Certificado A1 (Arquivo em Nuvem .pfx / .p12)</SelectItem>
                <SelectItem value="a3">
                  Certificado A3 (Cartão / Token Físico - apenas metadados)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-[#64748B]">
              {formState.tipo === 'a1'
                ? 'Permite upload de arquivo criptografado e senha.'
                : 'A3 é token/smartcard físico; apenas metadados de controle são armazenados.'}
            </p>
          </div>

          {/* Emissor */}
          <div className="space-y-1.5">
            <Label htmlFor="emissor" className="text-xs font-semibold text-[#1A2333]">
              Autoridade Certificadora (Emissor) *
            </Label>
            <Input
              id="emissor"
              disabled={!canEdit}
              value={formState.emissor}
              onChange={(e) => onChange({ ...formState, emissor: e.target.value })}
              placeholder="Ex: Serasa Experian, Certisign, AC Safeweb, Soluti..."
              className="h-10 text-xs rounded-xl border-[#E2E8F0]"
            />
          </div>

          {/* Validade */}
          <div className="space-y-1.5">
            <Label htmlFor="validade" className="text-xs font-semibold text-[#1A2333]">
              Data de Validade *
            </Label>
            <Input
              id="validade"
              type="date"
              disabled={!canEdit}
              value={formState.validade}
              onChange={(e) => onChange({ ...formState, validade: e.target.value })}
              className="h-10 text-xs rounded-xl border-[#E2E8F0]"
            />
          </div>

          {/* Titular */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="titular" className="text-xs font-semibold text-[#1A2333]">
              Titular do Certificado (Razão Social / CNPJ) *
            </Label>
            <Input
              id="titular"
              disabled={!canEdit}
              value={formState.titular}
              onChange={(e) => onChange({ ...formState, titular: e.target.value })}
              placeholder="Ex: EMPRESA EXEMPLO LTDA:00000000000100"
              className="h-10 text-xs rounded-xl border-[#E2E8F0]"
            />
          </div>

          {/* Número de Série */}
          <div className="space-y-1.5">
            <Label htmlFor="numero_serie" className="text-xs font-semibold text-[#1A2333]">
              Número de Série (Hexadecimal)
            </Label>
            <Input
              id="numero_serie"
              disabled={!canEdit}
              value={formState.numero_serie}
              onChange={(e) => onChange({ ...formState, numero_serie: e.target.value })}
              placeholder="Ex: 2F48A9C10D87E5B3"
              className="h-10 text-xs font-mono rounded-xl border-[#E2E8F0]"
            />
          </div>
        </div>

        {/* Upload de Arquivo A1 e Senha (Apenas para A1) */}
        {formState.tipo === 'a1' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-xl bg-slate-50 p-4 border border-slate-200/70">
            {/* Arquivo .PFX */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1A2333]">
                Arquivo do Certificado A1 (.pfx / .p12)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".pfx,.p12,application/x-pkcs12"
                  disabled={!canEdit}
                  onChange={handleFileChange}
                  className="h-10 text-xs rounded-xl border-[#E2E8F0] bg-white file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[11px] file:bg-[#0FA3A3]/10 file:text-[#0FA3A3]"
                />
              </div>
              {formState.arquivoNomeAtual && (
                <p className="text-[11px] text-emerald-700 flex items-center gap-1 mt-1">
                  <FileCheck className="h-3.5 w-3.5" />
                  <span>
                    Arquivo atual: <b>{formState.arquivoNomeAtual}</b>
                  </span>
                </p>
              )}
            </div>

            {/* Senha do Certificado */}
            <div className="space-y-1.5">
              <Label htmlFor="senha_cert" className="text-xs font-semibold text-[#1A2333]">
                Senha do Certificado A1
              </Label>
              <div className="relative">
                <Input
                  id="senha_cert"
                  type={showPassword ? 'text' : 'password'}
                  disabled={!canEdit}
                  value={formState.senha || ''}
                  onChange={(e) => onChange({ ...formState, senha: e.target.value })}
                  placeholder="Senha de exportação/instalação do .pfx"
                  className="h-10 text-xs rounded-xl border-[#E2E8F0] pr-10 bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-[#64748B]">
                Protegida para uso em transmissões fiscais automáticas.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Certificado Tipo A3 (Dispositivo Físico)</p>
              <p className="text-[11px] text-amber-800">
                O certificado A3 reside em token criptográfico ou smartcard físico na posse do
                cliente/empresa. Nesta plataforma são mantidos a validade e o emissor para
                acompanhamento de vencimento e avisos de regularidade fiscal. Não há upload de
                arquivo ou senha para este padrão.
              </p>
            </div>
          </div>
        )}

        {/* Status e Observações */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#1A2333]">Status do Certificado</Label>
            <Select
              disabled={!canEdit}
              value={formState.status}
              onValueChange={(val: StatusCertificadoDigital) =>
                onChange({ ...formState, status: val })
              }
            >
              <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="expirado">Expirado</SelectItem>
                <SelectItem value="revogado">Revogado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="obs_cert" className="text-xs font-semibold text-[#1A2333]">
              Observações do Certificado
            </Label>
            <Input
              id="obs_cert"
              disabled={!canEdit}
              value={formState.observacoes}
              onChange={(e) => onChange({ ...formState, observacoes: e.target.value })}
              placeholder="Ex: Videoconferência realizada por Sócio X, procuração no e-CAC ativa..."
              className="h-10 text-xs rounded-xl border-[#E2E8F0]"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

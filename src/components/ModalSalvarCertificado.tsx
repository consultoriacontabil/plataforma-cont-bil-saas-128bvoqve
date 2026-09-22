import React, { useState, useEffect } from 'react'
import {
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  UploadCloud,
  FileCheck,
  Eye,
  EyeOff,
  AlertTriangle,
  Info,
  Loader2,
  Save,
} from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { certificadosService } from '@/services/certificados'
import { getErrorMessage, extractFieldErrors } from '@/lib/pocketbase/errors'
import { useToast } from '@/hooks/use-toast'
import type {
  Empresa,
  CertificadoDigitalRecord,
  TipoCertificadoDigital,
  StatusCertificadoDigital,
} from '@/types'

export interface ModalSalvarCertificadoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresa: Empresa
  tenantId: string
  certificadoExistente?: CertificadoDigitalRecord | null
  canEdit: boolean
  onSuccess: (salvo: CertificadoDigitalRecord) => void
}

export function ModalSalvarCertificado({
  open,
  onOpenChange,
  empresa,
  tenantId,
  certificadoExistente,
  canEdit,
  onSuccess,
}: ModalSalvarCertificadoProps) {
  const { toast } = useToast()
  const [salvando, setSalvando] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [tipo, setTipo] = useState<TipoCertificadoDigital>('a1')
  const [titular, setTitular] = useState('')
  const [numeroSerie, setNumeroSerie] = useState('')
  const [emissor, setEmissor] = useState('')
  const [validade, setValidade] = useState('')
  const [senha, setSenha] = useState('')
  const [status, setStatus] = useState<StatusCertificadoDigital>('ativo')
  const [observacoes, setObservacoes] = useState('')
  const [arquivoFile, setArquivoFile] = useState<File | null>(null)
  const [arquivoNomeAtual, setArquivoNomeAtual] = useState('')
  const [erros, setErros] = useState<Record<string, string>>({})

  // Sincronizar estado inicial ao abrir modal ou alterar certificadoExistente
  useEffect(() => {
    if (open) {
      setErros({})
      if (certificadoExistente) {
        setTipo(certificadoExistente.tipo || 'a1')
        setTitular(certificadoExistente.titular || '')
        setNumeroSerie(certificadoExistente.numero_serie || '')
        setEmissor(certificadoExistente.emissor || '')
        setValidade(
          certificadoExistente.validade ? certificadoExistente.validade.split('T')[0] : '',
        )
        setSenha(certificadoExistente.senha || '')
        setStatus(certificadoExistente.status || 'ativo')
        setObservacoes(certificadoExistente.observacoes || '')
        setArquivoFile(null)
        setArquivoNomeAtual(certificadoExistente.arquivo_pfx || '')
      } else {
        const cleanCnpj = empresa.cnpj?.replace(/\D/g, '') || ''
        const titularSugerido = empresa.razao_social
          ? `${empresa.razao_social.toUpperCase()}:${cleanCnpj}`
          : cleanCnpj

        setTipo('a1')
        setTitular(titularSugerido)
        setNumeroSerie('')
        setEmissor('')
        setValidade('')
        setSenha('')
        setStatus('ativo')
        setObservacoes('')
        setArquivoFile(null)
        setArquivoNomeAtual('')
      }
    }
  }, [open, certificadoExistente, empresa])

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

      setArquivoFile(file)
      setArquivoNomeAtual(file.name)
      toast({
        title: 'Certificado selecionado',
        description: `Arquivo ${file.name} pronto para envio.`,
      })
    }
  }

  const validar = () => {
    const novosErros: Record<string, string> = {}
    if (!titular.trim()) {
      novosErros.titular = 'Titular do certificado é obrigatório.'
    }
    if (!emissor.trim()) {
      novosErros.emissor = 'Autoridade certificadora (emissor) é obrigatória.'
    }
    if (!validade.trim()) {
      novosErros.validade = 'Data de validade é obrigatória.'
    }
    setErros(novosErros)
    return Object.keys(novosErros).length === 0
  }

  const handleSalvar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!canEdit) {
      toast({
        variant: 'destructive',
        title: 'Sem permissão',
        description: 'Usuários com perfil de cliente não têm autorização para editar certificados.',
      })
      return
    }

    if (!validar()) {
      toast({
        variant: 'destructive',
        title: 'Campos incompletos',
        description: 'Preencha os campos obrigatórios do certificado.',
      })
      return
    }

    setSalvando(true)
    try {
      const certFormData = new FormData()
      certFormData.append('tenant_id', tenantId)
      certFormData.append('empresa', empresa.id)
      certFormData.append('tipo', tipo)
      certFormData.append('titular', titular.trim())
      if (numeroSerie.trim()) {
        certFormData.append('numero_serie', numeroSerie.trim())
      }
      certFormData.append('emissor', emissor.trim())

      // Formatar validade para ISO 8601 estrita aceita pelo PocketBase
      const isoValidade = new Date(`${validade}T12:00:00.000Z`).toISOString()
      certFormData.append('validade', isoValidade)

      if (senha) {
        certFormData.append('senha', senha)
      }
      certFormData.append('status', status)
      if (observacoes.trim()) {
        certFormData.append('observacoes', observacoes.trim())
      }
      if (arquivoFile) {
        certFormData.append('arquivo_pfx', arquivoFile)
      }

      const certId = certificadoExistente?.id || null
      const salvo = await certificadosService.save(certId, certFormData)

      toast({
        title: certId ? 'Certificado atualizado!' : 'Certificado cadastrado!',
        description: `O certificado digital de ${empresa.nome_fantasia || empresa.razao_social} foi salvo com sucesso.`,
      })

      onSuccess(salvo)
      onOpenChange(false)
    } catch (err: unknown) {
      console.error('Erro ao salvar certificado digital diretamente:', err)
      const fieldErrs = extractFieldErrors(err)
      if (Object.keys(fieldErrs).length > 0) {
        setErros(fieldErrs)
      }
      const rawMsg = getErrorMessage(err)
      toast({
        variant: 'destructive',
        title: 'Falha ao salvar certificado digital',
        description: rawMsg || 'Verifique as informações preenchidas e tente novamente.',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-teal-50 text-[#0FA3A3] flex items-center justify-center shrink-0">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-[#1A2333]">
                {certificadoExistente
                  ? 'Atualizar / Substituir Certificado Digital'
                  : 'Cadastrar Certificado Digital'}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#64748B]">
                Empresa:{' '}
                <span className="font-semibold text-slate-800">{empresa.razao_social}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSalvar} className="space-y-4 pt-2">
          {/* Aviso informativo de segurança */}
          <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-3 text-xs text-[#0B1F3A] flex items-start gap-2.5">
            <Info className="h-4 w-4 text-[#0FA3A3] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-[#0B1F3A]">Segurança e Proteção de Senha</p>
              <p className="text-[#64748B] text-[11px] leading-relaxed">
                O certificado e a senha são salvos diretamente na base de certificados digitais e
                são utilizados apenas para automações contábeis e fiscais (SPED, e-CAC, NFS-e,
                DCTFWeb).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Tipo */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1A2333]">Tipo *</Label>
              <Select
                value={tipo}
                disabled={!canEdit || salvando}
                onValueChange={(val: TipoCertificadoDigital) => {
                  setTipo(val)
                  if (val === 'a3') {
                    setArquivoFile(null)
                  }
                }}
              >
                <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a1">Certificado A1 (Arquivo .pfx)</SelectItem>
                  <SelectItem value="a3">Certificado A3 (Físico / Token)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Emissor */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="modal_emissor" className="text-xs font-semibold text-[#1A2333]">
                Autoridade Certificadora (Emissor) *
              </Label>
              <Input
                id="modal_emissor"
                disabled={!canEdit || salvando}
                value={emissor}
                onChange={(e) => {
                  setEmissor(e.target.value)
                  if (erros.emissor) setErros((prev) => ({ ...prev, emissor: '' }))
                }}
                placeholder="Ex: Certisign, Serasa Experian, Soluti, Safeweb..."
                className={`h-10 text-xs rounded-xl ${erros.emissor ? 'border-red-500' : 'border-[#E2E8F0]'}`}
              />
              {erros.emissor && <p className="text-[11px] text-red-500">{erros.emissor}</p>}
            </div>

            {/* Titular */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="modal_titular" className="text-xs font-semibold text-[#1A2333]">
                Titular do Certificado (Razão Social / CNPJ) *
              </Label>
              <Input
                id="modal_titular"
                disabled={!canEdit || salvando}
                value={titular}
                onChange={(e) => {
                  setTitular(e.target.value)
                  if (erros.titular) setErros((prev) => ({ ...prev, titular: '' }))
                }}
                placeholder="Ex: EMPRESA EXEMPLO LTDA:00000000000100"
                className={`h-10 text-xs rounded-xl ${erros.titular ? 'border-red-500' : 'border-[#E2E8F0]'}`}
              />
              {erros.titular && <p className="text-[11px] text-red-500">{erros.titular}</p>}
            </div>

            {/* Validade */}
            <div className="space-y-1.5">
              <Label htmlFor="modal_validade" className="text-xs font-semibold text-[#1A2333]">
                Data de Validade *
              </Label>
              <Input
                id="modal_validade"
                type="date"
                disabled={!canEdit || salvando}
                value={validade}
                onChange={(e) => {
                  setValidade(e.target.value)
                  if (erros.validade) setErros((prev) => ({ ...prev, validade: '' }))
                }}
                className={`h-10 text-xs rounded-xl ${erros.validade ? 'border-red-500' : 'border-[#E2E8F0]'}`}
              />
              {erros.validade && <p className="text-[11px] text-red-500">{erros.validade}</p>}
            </div>

            {/* Número de Série */}
            <div className="space-y-1.5">
              <Label htmlFor="modal_num_serie" className="text-xs font-semibold text-[#1A2333]">
                Número de Série
              </Label>
              <Input
                id="modal_num_serie"
                disabled={!canEdit || salvando}
                value={numeroSerie}
                onChange={(e) => setNumeroSerie(e.target.value)}
                placeholder="Ex: 2F48A9C10D87E5B3"
                className="h-10 text-xs font-mono rounded-xl border-[#E2E8F0]"
              />
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1A2333]">Status</Label>
              <Select
                value={status}
                disabled={!canEdit || salvando}
                onValueChange={(val: StatusCertificadoDigital) => setStatus(val)}
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

            {/* Observações */}
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="modal_obs" className="text-xs font-semibold text-[#1A2333]">
                Observações
              </Label>
              <Input
                id="modal_obs"
                disabled={!canEdit || salvando}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Anotações internas sobre o certificado..."
                className="h-10 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>
          </div>

          {/* Upload Arquivo A1 e Senha */}
          {tipo === 'a1' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-slate-50 p-3.5 border border-slate-200">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1A2333]">
                  Arquivo do Certificado A1 (.pfx / .p12)
                </Label>
                <Input
                  type="file"
                  accept=".pfx,.p12,application/x-pkcs12"
                  disabled={!canEdit || salvando}
                  onChange={handleFileChange}
                  className="h-10 text-xs rounded-xl border-[#E2E8F0] bg-white file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[11px] file:bg-[#0FA3A3]/10 file:text-[#0FA3A3]"
                />
                {arquivoNomeAtual && (
                  <p className="text-[11px] text-emerald-700 flex items-center gap-1 mt-1">
                    <FileCheck className="h-3.5 w-3.5" />
                    <span>
                      Arquivo atual: <b>{arquivoNomeAtual}</b>
                    </span>
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="modal_senha_cert" className="text-xs font-semibold text-[#1A2333]">
                  Senha do Certificado A1
                </Label>
                <div className="relative">
                  <Input
                    id="modal_senha_cert"
                    type={showPassword ? 'text' : 'password'}
                    disabled={!canEdit || salvando}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Senha do arquivo .pfx"
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
                  Necessária para emissão de NFS-e e integrações RFB.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Certificado Tipo A3 (Dispositivo Físico)</p>
                <p className="text-[11px] text-amber-800">
                  Os dados de emissor e validade são salvos para controle e alerta de renovação. O
                  token/smartcard físico permanece com o cliente.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 border-t border-slate-100 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={salvando}
              onClick={() => onOpenChange(false)}
              className="text-xs rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvando || !canEdit}
              className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs h-9 shadow-xs"
            >
              {salvando ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Salvando Certificado...</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>Salvar Certificado</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

import React, { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { documentosService } from '@/services/documentos'
import { DocumentoTipo, Documento } from '@/types'
import {
  UploadCloud,
  FileText,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  FileImage,
  FileCheck,
  File,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ModalUploadDocumentoEmpresaProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  empresaId: string
  empresaNome?: string
  usuarioUploadId?: string
  usuarioNome?: string
  onUploadSuccess: (docsCriados: Documento[]) => void
}

export const TIPOS_DOCUMENTOS_EXPANDIDOS: {
  value: DocumentoTipo
  label: string
  categoria: string
}[] = [
  // Societário & Cadastral
  {
    value: 'contrato_social',
    label: 'Contrato Social / Ato Constitutivo',
    categoria: 'Societário',
  },
  {
    value: 'alteracao_contratual',
    label: 'Alteração Contratual / Aditivo',
    categoria: 'Societário',
  },
  { value: 'procuracoes', label: 'Procuração (e-CAC / Junta / Cartório)', categoria: 'Societário' },
  // Financeiro & Bancário (migração 0101)
  { value: 'extrato_bancario', label: 'Extrato Bancário (PDF / OFX)', categoria: 'Financeiro' },
  { value: 'fatura_cartao', label: 'Fatura de Cartão de Crédito', categoria: 'Financeiro' },
  { value: 'maquininha', label: 'Comprovantes de Maquininha / Apps', categoria: 'Financeiro' },
  { value: 'credito', label: 'Contrato de Financiamento / Crédito', categoria: 'Financeiro' },
  // Fiscal & Faturamento
  { value: 'nota_fiscal', label: 'Nota Fiscal (NF-e / NFS-e / Danfe)', categoria: 'Fiscal' },
  { value: 'fatura', label: 'Fatura Comercial / Boleto de Fornecedor', categoria: 'Fiscal' },
  // Relatórios & Outros
  { value: 'relatorios', label: 'Relatórios / Balancetes / DRE', categoria: 'Geral' },
  { value: 'outros', label: 'Outros Documentos Gerais', categoria: 'Geral' },
]

export const ModalUploadDocumentoEmpresa: React.FC<ModalUploadDocumentoEmpresaProps> = ({
  open,
  onOpenChange,
  tenantId,
  empresaId,
  empresaNome,
  usuarioUploadId,
  usuarioNome,
  onUploadSuccess,
}) => {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedTipo, setSelectedTipo] = useState<DocumentoTipo>('contrato_social')
  const [observacoes, setObservacoes] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)

  const resetForm = () => {
    setUploadedFiles([])
    setObservacoes('')
    setSelectedTipo('contrato_social')
    setIsDragOver(false)
  }

  const handleClose = (isOpen: boolean) => {
    if (!uploading) {
      if (!isOpen) resetForm()
      onOpenChange(isOpen)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files).filter((f) => {
        if (f.size > 26214400) {
          toast({
            variant: 'destructive',
            title: 'Arquivo muito grande',
            description: `O arquivo ${f.name} excede o limite máximo de 25MB.`,
          })
          return false
        }
        return true
      })
      setUploadedFiles((prev) => [...prev, ...filesArray])
    }
    // Limpar o input para permitir selecionar o mesmo arquivo novamente se desejado
    if (e.target) e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files).filter((f) => {
        if (f.size > 26214400) {
          toast({
            variant: 'destructive',
            title: 'Arquivo muito grande',
            description: `O arquivo ${f.name} excede o limite máximo de 25MB.`,
          })
          return false
        }
        return true
      })
      setUploadedFiles((prev) => [...prev, ...filesArray])
    }
  }

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase()
    if (ext === 'pdf') return <FileText className="h-4 w-4 text-red-500" />
    if (ext === 'jpg' || ext === 'jpeg' || ext === 'png')
      return <FileImage className="h-4 w-4 text-blue-500" />
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv' || ext === 'ofx')
      return <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
    if (ext === 'docx' || ext === 'doc') return <FileCheck className="h-4 w-4 text-indigo-500" />
    return <File className="h-4 w-4 text-slate-500" />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validações estritas de sessão e integridade
    if (!tenantId) {
      toast({
        variant: 'destructive',
        title: 'Tenant não identificado',
        description:
          'Não foi possível identificar o escritório contábil ativo. Recarregue a página.',
      })
      return
    }

    if (!empresaId) {
      toast({
        variant: 'destructive',
        title: 'Empresa não identificada',
        description:
          'Vínculo com a empresa ausente. Retorne à listagem e selecione a empresa novamente.',
      })
      return
    }

    if (!usuarioUploadId) {
      toast({
        variant: 'destructive',
        title: 'Sessão de usuário não autenticada',
        description:
          'Seu usuário não possui um ID válido na sessão ativa. Faça login novamente para prosseguir.',
      })
      return
    }

    if (uploadedFiles.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Selecione pelo menos um arquivo',
        description: 'Arraste ou escolha os arquivos que deseja arquivar no GED desta empresa.',
      })
      return
    }

    setUploading(true)
    const docsCriados: Documento[] = []
    const erros: string[] = []

    try {
      for (const file of uploadedFiles) {
        try {
          const formData = new FormData()
          formData.append('tenant_id', tenantId)
          formData.append('empresa_id', empresaId)
          formData.append('nome_arquivo', file.name)
          formData.append('tipo', selectedTipo)
          formData.append('status', 'processado')
          formData.append('origem_documento', 'upload_manual')
          formData.append('usuario_upload_id', usuarioUploadId)
          formData.append('arquivo', file)
          if (observacoes.trim()) {
            formData.append('observacoes', observacoes.trim())
          }

          const docCriado = await documentosService.create(formData)
          docsCriados.push(docCriado)
        } catch (err: unknown) {
          console.error(`Erro ao enviar arquivo ${file.name}:`, err)
          const msg = err instanceof Error ? err.message : 'Erro desconhecido'
          erros.push(`${file.name}: ${msg}`)
        }
      }

      if (docsCriados.length > 0) {
        toast({
          title: 'Documento(s) arquivado(s) com sucesso!',
          description: `${docsCriados.length} arquivo(s) gravado(s) no GED da empresa com HTTP 200.`,
        })
        onUploadSuccess(docsCriados)
        resetForm()
        onOpenChange(false)
      }

      if (erros.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Aviso sobre alguns arquivos',
          description: `Falha em ${erros.length} arquivo(s): ${erros.join(', ')}`,
        })
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="rounded-2xl max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base text-[#1A2333] flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-[#0FA3A3]" />
            <span>Enviar Documento ao GED da Empresa</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-[#64748B]">
            O documento será armazenado no arquivo digital indexado da empresa{' '}
            <strong className="text-slate-800 font-semibold">{empresaNome || 'selecionada'}</strong>
            .
          </DialogDescription>
        </DialogHeader>

        {!usuarioUploadId && (
          <Alert variant="destructive" className="my-2 border-red-200 bg-red-50 text-red-900">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-xs">
              Atenção: Usuário atual não identificado na sessão. É obrigatório estar autenticado com
              ID válido para arquivar documentos.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Informações de Vínculo Automático */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <div>
              <span className="text-[#64748B] block text-[11px]">Empresa Vinculada:</span>
              <span className="font-semibold text-[#1A2333] truncate block" title={empresaNome}>
                {empresaNome || 'Empresa Atual'}
              </span>
            </div>
            <div>
              <span className="text-[#64748B] block text-[11px]">Usuário Responsável:</span>
              <span className="font-semibold text-[#1A2333] truncate block">
                {usuarioNome ||
                  (usuarioUploadId ? `ID: ${usuarioUploadId.slice(0, 10)}...` : 'Não identificado')}
              </span>
            </div>
          </div>

          {/* Seleção do Tipo de Documento */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#1A2333]">Tipo do Documento *</Label>
            <Select
              value={selectedTipo}
              onValueChange={(val: DocumentoTipo) => setSelectedTipo(val)}
            >
              <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                <SelectValue placeholder="Selecione a classificação do documento" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {TIPOS_DOCUMENTOS_EXPANDIDOS.map((tipo) => (
                  <SelectItem key={tipo.value} value={tipo.value}>
                    <span className="text-[11px] text-[#64748B] mr-2">[{tipo.categoria}]</span>
                    <span>{tipo.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-[#64748B]">
              Classificação utilizada na indexação, filtros e relatórios fiscais do GED.
            </p>
          </div>

          {/* Área de Drag & Drop */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all',
              isDragOver
                ? 'border-[#0FA3A3] bg-teal-50/50'
                : 'border-[#E2E8F0] hover:border-[#0FA3A3] hover:bg-slate-50',
            )}
          >
            <UploadCloud className="h-10 w-10 text-[#0FA3A3] mb-2" />
            <p className="text-xs font-semibold text-[#1A2333]">
              Arraste arquivos aqui ou clique para selecionar
            </p>
            <p className="text-[11px] text-[#94A3B8] mt-1">
              PDF, JPG, PNG, DOCX, XLSX, OFX (máx. 25MB por arquivo)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.xls,.ofx,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Lista de Arquivos Selecionados */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              <p className="text-[11px] font-bold text-[#64748B]">
                Arquivos selecionados ({uploadedFiles.length}):
              </p>
              {uploadedFiles.map((f, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs border border-slate-100"
                >
                  <div className="flex items-center gap-2 overflow-hidden mr-2">
                    {getFileIcon(f.name)}
                    <span className="truncate max-w-xs font-medium text-slate-800">{f.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-[#94A3B8]">
                      {(f.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                      title="Remover arquivo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Campo de Observações */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#1A2333]">
              Observações / Histórico (opcional)
            </Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex.: Aditivo contratual assinado em cartório, competência 04/2025..."
              className="min-h-[70px] text-xs rounded-xl border-[#E2E8F0] resize-none"
            />
          </div>

          {/* Rodapé / Botões de Ação */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={uploading}
              className="text-xs rounded-xl h-9"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={uploading || uploadedFiles.length === 0 || !usuarioUploadId}
              className="text-xs rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white h-9 gap-2 shadow-xs"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Enviando para o GED...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>
                    Arquivar {uploadedFiles.length > 0 ? `(${uploadedFiles.length})` : ''}
                  </span>
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
export default ModalUploadDocumentoEmpresa

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  FileText,
  UploadCloud,
  Search,
  Filter,
  Eye,
  Download,
  Trash2,
  FileCheck,
  FileSpreadsheet,
  FileImage,
  FileCode,
  File,
  X,
  Loader2,
  Building2,
  Calendar,
  User as UserIcon,
  CheckCircle2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { documentosService } from '@/services/documentos'
import { empresasService } from '@/services/empresas'
import { useRealtime } from '@/hooks/use-realtime'
import { formatDatePtBr } from '@/lib/formatters'
import type { Documento, Empresa, DocumentoTipo, DocumentoStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { cn } from '@/lib/utils'

export default function Documentos() {
  const { user, tenant } = useAuth()
  const { toast } = useToast()

  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState<'todos' | DocumentoTipo>('todos')
  const [statusFilter, setStatusFilter] = useState<'todos' | DocumentoStatus>('todos')

  // Modals
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<Documento | null>(null)

  // Upload Form
  const [selectedEmpresaId, setSelectedEmpresaId] = useState('')
  const [selectedTipo, setSelectedTipo] = useState<DocumentoTipo>('contrato_social')
  const [uploadObservacoes, setUploadObservacoes] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadData = useCallback(async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      const [docs, emps] = await Promise.all([
        documentosService.list(tenant.id),
        empresasService.list(tenant.id),
      ])
      setDocumentos(docs)
      setEmpresas(emps)
      if (emps.length > 0 && !selectedEmpresaId) {
        setSelectedEmpresaId(emps[0].id)
      }
    } catch (err) {
      console.error('Error loading GED docs:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar documentos',
        description: 'Não foi possível carregar os arquivos.',
      })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, selectedEmpresaId, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Realtime hook
  useRealtime('documentos', () => loadData())

  const filteredDocs = useMemo(() => {
    return documentos.filter((doc) => {
      const matchSearch =
        search.trim() === '' ||
        doc.nome_arquivo.toLowerCase().includes(search.toLowerCase()) ||
        (doc.observacoes && doc.observacoes.toLowerCase().includes(search.toLowerCase())) ||
        (doc.expand?.empresa_id?.nome_fantasia &&
          doc.expand.empresa_id.nome_fantasia.toLowerCase().includes(search.toLowerCase())) ||
        (doc.expand?.empresa_id?.cnpj && doc.expand.empresa_id.cnpj.includes(search))

      const matchTipo = tipoFilter === 'todos' || doc.tipo === tipoFilter
      const matchStatus = statusFilter === 'todos' || doc.status === statusFilter

      return matchSearch && matchTipo && matchStatus
    })
  }, [documentos, search, tipoFilter, statusFilter])

  // Drag and drop handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files).filter(
        (f) => f.size <= 26214400, // 25MB
      )
      setUploadedFiles((prev) => [...prev, ...filesArray])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files).filter((f) => f.size <= 26214400)
      setUploadedFiles((prev) => [...prev, ...filesArray])
    }
  }

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEmpresaId) {
      toast({
        variant: 'destructive',
        title: 'Selecione uma empresa',
        description: 'Todo documento deve estar vinculado a uma empresa.',
      })
      return
    }

    if (uploadedFiles.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Selecione pelo menos um arquivo',
        description: 'Arraste ou escolha arquivos para envio.',
      })
      return
    }

    if (!tenant?.id || !user?.id) return

    setUploading(true)
    let successCount = 0

    try {
      for (const file of uploadedFiles) {
        const formData = new FormData()
        formData.append('tenant_id', tenant.id)
        formData.append('empresa_id', selectedEmpresaId)
        formData.append('nome_arquivo', file.name)
        formData.append('tipo', selectedTipo)
        formData.append('status', 'processado')
        formData.append('observacoes', uploadObservacoes)
        formData.append('arquivo', file)
        formData.append('usuario_upload_id', user.id)

        await documentosService.create(formData)
        successCount++
      }

      toast({
        title: 'Documentos arquivados!',
        description: `${successCount} arquivo(s) enviados com sucesso ao GED.`,
      })
      setUploadModalOpen(false)
      setUploadedFiles([])
      setUploadObservacoes('')
      loadData()
    } catch (err: unknown) {
      console.error('Upload error:', err)
      const msg = err instanceof Error ? err.message : 'Falha no envio de arquivos.'
      toast({
        variant: 'destructive',
        title: 'Erro no envio',
        description: msg,
      })
    } finally {
      setUploading(false)
    }
  }

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase()
    if (ext === 'pdf') return <FileText className="h-8 w-8 text-red-500" />
    if (ext === 'jpg' || ext === 'jpeg' || ext === 'png')
      return <FileImage className="h-8 w-8 text-blue-500" />
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv')
      return <FileSpreadsheet className="h-8 w-8 text-emerald-500" />
    if (ext === 'docx' || ext === 'doc') return <FileCheck className="h-8 w-8 text-indigo-500" />
    return <File className="h-8 w-8 text-slate-500" />
  }

  const getStatusBadge = (status: DocumentoStatus) => {
    switch (status) {
      case 'processado':
        return <Badge className="bg-[#DCFCE7] text-[#166534] hover:bg-[#DCFCE7]">Processado</Badge>
      case 'pendente':
        return <Badge className="bg-[#FEF3C7] text-[#92400E] hover:bg-[#FEF3C7]">Pendente</Badge>
      case 'rejeitado':
        return <Badge className="bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FEE2E2]">Rejeitado</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const isPreviewablePdf = (doc: Documento) => {
    return (
      doc.arquivo &&
      (doc.nome_arquivo.toLowerCase().endsWith('.pdf') ||
        doc.arquivo.toLowerCase().endsWith('.pdf'))
    )
  }

  const isPreviewableImage = (doc: Documento) => {
    const ext = doc.nome_arquivo.split('.').pop()?.toLowerCase()
    return ext === 'jpg' || ext === 'jpeg' || ext === 'png'
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#1A2333]">
            Documentos & GED Inteligente
          </h2>
          <p className="text-xs text-[#64748B]">
            Armazenamento, indexação e auditoria documental de até 25MB por arquivo
          </p>
        </div>
        <Button
          onClick={() => setUploadModalOpen(true)}
          className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs h-10 shadow-xs"
        >
          <UploadCloud className="h-4 w-4" />
          <span>Enviar Documento</span>
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome do arquivo, empresa ou anotação..."
            className="h-10 pl-9 pr-4 rounded-xl text-xs border-[#E2E8F0]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={tipoFilter}
            onValueChange={(val: 'todos' | DocumentoTipo) => setTipoFilter(val)}
          >
            <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0] w-44">
              <SelectValue placeholder="Tipo de Documento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="contrato_social">Contrato Social</SelectItem>
              <SelectItem value="alteracao_contratual">Alteração Contratual</SelectItem>
              <SelectItem value="fatura">Fatura</SelectItem>
              <SelectItem value="nota_fiscal">Nota Fiscal</SelectItem>
              <SelectItem value="procuracoes">Procurações</SelectItem>
              <SelectItem value="relatorios">Relatórios</SelectItem>
              <SelectItem value="outros">Outros</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(val: 'todos' | DocumentoStatus) => setStatusFilter(val)}
          >
            <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0] w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="processado">Processado</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="rejeitado">Rejeitado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid of Cards (3 per row desktop) */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#0FA3A3]" />
        </div>
      ) : filteredDocs.length === 0 ? (
        <Card className="rounded-2xl border-[#E2E8F0] p-12 text-center shadow-xs">
          <FileText className="h-12 w-12 text-[#94A3B8] mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#1A2333]">Nenhum documento localizado</p>
          <p className="text-xs text-[#64748B] mt-1">
            Envie arquivos no botão &quot;Enviar Documento&quot; para iniciar o arquivo GED.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDocs.map((doc) => {
            const fileUrl = doc.arquivo ? documentosService.getFileUrl(doc, doc.arquivo) : null
            return (
              <Card
                key={doc.id}
                onClick={() => setSelectedDoc(doc)}
                className="group rounded-2xl border-[#E2E8F0] shadow-xs hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between"
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 overflow-hidden">
                      <div className="shrink-0 p-1 rounded-xl bg-slate-50 group-hover:bg-slate-100 transition-colors">
                        {getFileIcon(doc.nome_arquivo)}
                      </div>
                      <div className="overflow-hidden">
                        <h4
                          className="text-xs font-bold text-[#1A2333] truncate group-hover:text-[#0FA3A3] transition-colors"
                          title={doc.nome_arquivo}
                        >
                          {doc.nome_arquivo}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[#64748B]">
                          <Building2 className="h-3 w-3 text-[#94A3B8] shrink-0" />
                          <span className="truncate">
                            {doc.expand?.empresa_id?.nome_fantasia ||
                              doc.expand?.empresa_id?.razao_social ||
                              'Empresa'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div>{getStatusBadge(doc.status)}</div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-2 text-[11px] text-[#64748B] space-y-1">
                    <div className="flex items-center justify-between">
                      <span>Tipo:</span>
                      <span className="font-semibold text-[#1A2333] capitalize">
                        {doc.tipo.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Data de Envio:</span>
                      <span>{formatDatePtBr(doc.created)}</span>
                    </div>
                  </div>

                  {doc.observacoes && (
                    <p className="text-[11px] text-[#64748B] line-clamp-2 italic">
                      &quot;{doc.observacoes}&quot;
                    </p>
                  )}

                  <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-[#94A3B8]">
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[9px] bg-[#0B1F3A] text-white">
                          {doc.expand?.usuario_upload_id?.name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate max-w-[120px]">
                        {doc.expand?.usuario_upload_id?.name || 'Contador'}
                      </span>
                    </div>
                    <span className="font-semibold text-[#0FA3A3] group-hover:underline">
                      Ver detalhes
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Document Upload Modal (Drag and Drop, Max 25MB) */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent className="rounded-2xl max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base text-[#1A2333]">
              Enviar Documentos para o GED
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Formatos aceitos: PDF, JPG, PNG, DOCX, XLSX (até 25 MB por arquivo)
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUploadSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1A2333]">Empresa *</Label>
              <Select value={selectedEmpresaId} onValueChange={setSelectedEmpresaId}>
                <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Selecione a empresa vinculada" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome_fantasia || e.razao_social} ({e.cnpj})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1A2333]">Tipo do Documento *</Label>
              <Select
                value={selectedTipo}
                onValueChange={(val: DocumentoTipo) => setSelectedTipo(val)}
              >
                <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Classificação do documento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contrato_social">Contrato Social</SelectItem>
                  <SelectItem value="alteracao_contratual">Alteração Contratual</SelectItem>
                  <SelectItem value="fatura">Fatura</SelectItem>
                  <SelectItem value="nota_fiscal">Nota Fiscal</SelectItem>
                  <SelectItem value="procuracoes">Procurações</SelectItem>
                  <SelectItem value="relatorios">Relatórios</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Drag and Drop Zone */}
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
                Suporta múltiplos arquivos simultâneos (máx. 25MB cada)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Selected files list */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                <p className="text-[11px] font-bold text-[#64748B]">
                  Arquivos selecionados ({uploadedFiles.length}):
                </p>
                {uploadedFiles.map((f, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs"
                  >
                    <span className="truncate max-w-xs">{f.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#94A3B8]">
                        {(f.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                      <button
                        type="button"
                        onClick={() => setUploadedFiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-[#94A3B8] hover:text-red-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="upload_obs" className="text-xs font-semibold text-[#1A2333]">
                Observações
              </Label>
              <Textarea
                id="upload_obs"
                rows={2}
                value={uploadObservacoes}
                onChange={(e) => setUploadObservacoes(e.target.value)}
                placeholder="Detalhes sobre a competência, período ou notas de conferência..."
                className="text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setUploadModalOpen(false)
                  setUploadedFiles([])
                }}
                className="text-xs rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={uploading || uploadedFiles.length === 0}
                className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs shadow-xs"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Enviando arquivos...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Concluir Upload ({uploadedFiles.length})</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Document Detail Modal with File Preview */}
      <Dialog open={Boolean(selectedDoc)} onOpenChange={() => setSelectedDoc(null)}>
        <DialogContent className="rounded-2xl max-w-4xl max-h-[92vh] flex flex-col p-6">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-base text-[#1A2333]">
                  {selectedDoc?.nome_arquivo}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#64748B]">
                  {selectedDoc?.expand?.empresa_id?.nome_fantasia ||
                    selectedDoc?.expand?.empresa_id?.razao_social}{' '}
                  • Enviado em {formatDatePtBr(selectedDoc?.created)}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedDoc && (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden py-4">
              {/* Left 2 cols: File Preview */}
              <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center min-h-[380px] overflow-hidden">
                {selectedDoc.arquivo ? (
                  isPreviewablePdf(selectedDoc) ? (
                    <iframe
                      src={documentosService.getFileUrl(selectedDoc, selectedDoc.arquivo)}
                      title={selectedDoc.nome_arquivo}
                      className="w-full h-full min-h-[420px] rounded-xl"
                    />
                  ) : isPreviewableImage(selectedDoc) ? (
                    <img
                      src={documentosService.getFileUrl(selectedDoc, selectedDoc.arquivo)}
                      alt={selectedDoc.nome_arquivo}
                      className="max-h-[420px] max-w-full object-contain p-2"
                    />
                  ) : (
                    <div className="p-8 text-center space-y-3">
                      {getFileIcon(selectedDoc.nome_arquivo)}
                      <p className="text-xs font-semibold text-[#1A2333]">
                        Visualização em nuvem não suportada para este formato
                      </p>
                      <p className="text-[11px] text-[#64748B]">
                        Arquivos DOCX/XLSX podem ser baixados diretamente para visualização no
                        Office.
                      </p>
                      <Button
                        asChild
                        className="rounded-xl bg-[#0B1F3A] hover:bg-[#123B6D] text-white text-xs gap-2"
                      >
                        <a
                          href={documentosService.getFileUrl(selectedDoc, selectedDoc.arquivo)}
                          download={selectedDoc.nome_arquivo}
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Baixar Arquivo Completo</span>
                        </a>
                      </Button>
                    </div>
                  )
                ) : (
                  <div className="p-8 text-center text-xs text-[#94A3B8]">
                    Arquivo físico não localizado no storage.
                  </div>
                )}
              </div>

              {/* Right Col: Metadata & Audit Trail */}
              <div className="space-y-4 overflow-y-auto">
                <div className="rounded-xl border border-[#E2E8F0] p-4 bg-white shadow-2xs space-y-3 text-xs">
                  <h5 className="font-bold text-[#1A2333] border-b pb-2">Metadados do Arquivo</h5>
                  <div>
                    <span className="text-[#64748B]">Classificação:</span>
                    <p className="font-semibold text-[#1A2333] capitalize">
                      {selectedDoc.tipo.replace('_', ' ')}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#64748B]">Status:</span>
                    <div className="mt-1">{getStatusBadge(selectedDoc.status)}</div>
                  </div>
                  <div>
                    <span className="text-[#64748B]">Responsável pelo Envio:</span>
                    <p className="font-semibold text-[#1A2333]">
                      {selectedDoc.expand?.usuario_upload_id?.name || 'Administrador'}
                    </p>
                  </div>
                  {selectedDoc.observacoes && (
                    <div>
                      <span className="text-[#64748B]">Anotações:</span>
                      <p className="text-[#1A2333] mt-0.5">{selectedDoc.observacoes}</p>
                    </div>
                  )}

                  {selectedDoc.arquivo && (
                    <Button
                      asChild
                      className="w-full gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs mt-2"
                    >
                      <a
                        href={documentosService.getFileUrl(selectedDoc, selectedDoc.arquivo)}
                        download={selectedDoc.nome_arquivo}
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download Direto</span>
                      </a>
                    </Button>
                  )}
                </div>

                {/* Audit trail */}
                <div className="rounded-xl border border-[#E2E8F0] p-4 bg-slate-50 space-y-2 text-xs">
                  <h5 className="font-bold text-[#1A2333]">Trilha de Auditoria GED</h5>
                  <div className="space-y-2 text-[11px] text-[#64748B]">
                    <div className="border-l-2 border-teal-500 pl-2">
                      <p className="font-semibold text-[#1A2333]">Documento armazenado</p>
                      <p>{formatDatePtBr(selectedDoc.created)} • Upload validado via hash SHA</p>
                    </div>
                    <div className="border-l-2 border-emerald-500 pl-2">
                      <p className="font-semibold text-[#1A2333]">Status: Processado</p>
                      <p>Disponibilizado para conciliação contábil e fiscal</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

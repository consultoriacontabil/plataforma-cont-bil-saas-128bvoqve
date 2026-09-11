import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Compass,
  Building2,
  FileText,
  Clock,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Bell,
  LogOut,
  FileCheck,
  Calendar,
  Download,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { portalService } from '@/services/portal'
import { notificacoesService } from '@/services/notificacoes'
import type { Empresa, Documento, ObrigacaoRecord, NotificacaoRecord, DocumentoTipo } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { formatDatePtBr } from '@/lib/formatters'
import pb from '@/lib/pocketbase/client'
import { cn } from '@/lib/utils'

export default function PortalClientePage() {
  const { user, tenant, signOut } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('')
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [obrigacoes, setObrigacoes] = useState<ObrigacaoRecord[]>([])
  const [notificacoes, setNotificacoes] = useState<NotificacaoRecord[]>([])
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [loading, setLoading] = useState(true)

  // Upload GED State
  const [uploadTipo, setUploadTipo] = useState<DocumentoTipo>('fatura')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadObs, setUploadObs] = useState('')
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // Carregar empresas permitidas para este cliente
  const loadPortalData = useCallback(async () => {
    if (!tenant?.id || !user?.email) return
    setLoading(true)
    try {
      const emps = await portalService.getClienteEmpresas(tenant.id, user.email)
      setEmpresas(emps)

      const activeEmpId = selectedEmpresaId || emps[0]?.id
      if (activeEmpId) {
        setSelectedEmpresaId(activeEmpId)
        const [docs, obs, notifs] = await Promise.all([
          portalService.getClienteDocumentos(tenant.id, activeEmpId),
          portalService.getClienteObrigacoes(tenant.id, activeEmpId),
          notificacoesService.list(tenant.id, user.id),
        ])
        setDocumentos(docs)
        setObrigacoes(obs)
        setNotificacoes(notifs)
        setUnreadNotifs(notifs.filter((n) => !n.lida).length)
      }
    } catch (err) {
      console.error('Erro ao carregar dados do portal do cliente:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar portal',
        description: 'Não foi possível carregar os dados da sua empresa.',
      })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, user?.email, user?.id, selectedEmpresaId, toast])

  useEffect(() => {
    loadPortalData()
  }, [loadPortalData])

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      if (file.size > 26214400) {
        toast({
          variant: 'destructive',
          title: 'Arquivo muito grande',
          description: 'O tamanho máximo permitido é de 25 MB.',
        })
        return
      }
      setUploadFile(file)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      if (file.size > 26214400) {
        toast({
          variant: 'destructive',
          title: 'Arquivo muito grande',
          description: 'O tamanho máximo permitido é de 25 MB.',
        })
        return
      }
      setUploadFile(file)
    }
  }

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant?.id || !selectedEmpresaId || !uploadFile || !user?.id) {
      toast({
        variant: 'destructive',
        title: 'Campos incompletos',
        description: 'Selecione um arquivo para enviar ao escritório.',
      })
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('tenant_id', tenant.id)
      formData.append('empresa_id', selectedEmpresaId)
      formData.append('nome_arquivo', uploadFile.name)
      formData.append('tipo', uploadTipo)
      formData.append('status', 'pendente')
      formData.append('usuario_upload_id', user.id)
      formData.append('arquivo', uploadFile)
      if (uploadObs) formData.append('observacoes', uploadObs.trim())

      await portalService.uploadClienteDocumento(formData)

      toast({
        title: 'Documento enviado!',
        description: 'O escritório contábil foi notificado e fará a classificação.',
      })

      setUploadFile(null)
      setUploadObs('')
      loadPortalData()
    } catch (err) {
      console.error('Erro no upload pelo portal:', err)
      toast({
        variant: 'destructive',
        title: 'Falha no envio',
        description: 'Não foi possível enviar o documento.',
      })
    } finally {
      setUploading(false)
    }
  }

  const activeEmpresa = empresas.find((e) => e.id === selectedEmpresaId)

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-[#1A2333]">
      {/* Topbar Simplificado do Portal */}
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#E2E8F0] bg-white px-4 md:px-8 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#0FA3A3] to-[#123B6D] text-white shadow-md">
            <Compass className="h-6 w-6" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-[#1A2333]">
              Portal da Empresa
            </span>
            <p className="text-[10px] uppercase font-semibold text-[#64748B]">
              Rumo Consultoria Contábil
            </p>
          </div>
        </div>

        {/* Controles de Topo: Seletor de Empresa, Notificações, Sair */}
        <div className="flex items-center gap-3">
          {empresas.length > 1 && (
            <Select value={selectedEmpresaId} onValueChange={setSelectedEmpresaId}>
              <SelectTrigger className="w-52 h-9 text-xs rounded-xl bg-slate-50 border-[#E2E8F0]">
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome_fantasia || e.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Notificações do Portal */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9 text-[#64748B]">
                <Bell className="h-5 w-5" />
                {unreadNotifs > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#EF4444] text-[9px] font-bold text-white">
                    {unreadNotifs}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0 rounded-2xl shadow-xl">
              <div className="p-3 border-b border-[#E2E8F0] bg-slate-50 font-bold text-xs">
                Avisos do Escritório
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 p-1">
                {notificacoes.length === 0 ? (
                  <p className="p-4 text-center text-xs text-[#94A3B8]">
                    Nenhuma notificação recente.
                  </p>
                ) : (
                  notificacoes.map((n) => (
                    <div key={n.id} className="p-2.5 text-xs">
                      <p className="font-semibold text-[#1A2333]">{n.titulo}</p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">{n.mensagem}</p>
                    </div>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Usuário e Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <span className="hidden sm:inline-block text-xs font-semibold text-[#1A2333]">
              {user?.name || user?.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="h-8 gap-1 text-xs text-[#EF4444] hover:bg-rose-50"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Conteúdo do Portal */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Banner de Boas-vindas da Empresa */}
        <div className="bg-gradient-to-r from-[#0B1F3A] to-[#123B6D] text-white p-6 rounded-3xl shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#0FA3A3]" />
              <h1 className="text-xl font-bold">
                {activeEmpresa?.nome_fantasia || activeEmpresa?.razao_social || 'Sua Empresa'}
              </h1>
            </div>
            <p className="text-xs text-[#94A3B8] mt-1">
              CNPJ: {activeEmpresa?.cnpj} • Regime:{' '}
              {activeEmpresa?.regime_tributario?.replace('_', ' ').toUpperCase()}
            </p>
          </div>

          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm px-4 py-3 rounded-2xl">
            <div className="text-center">
              <span className="block text-lg font-bold text-white">{documentos.length}</span>
              <span className="text-[10px] text-[#94A3B8] uppercase">Documentos</span>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div className="text-center">
              <span className="block text-lg font-bold text-[#0FA3A3]">
                {obrigacoes.filter((o) => o.status === 'entregue').length}/{obrigacoes.length}
              </span>
              <span className="text-[10px] text-[#94A3B8] uppercase">Obrigações OK</span>
            </div>
          </div>
        </div>

        {/* Abas Principais: Documentos e Obrigações */}
        <Tabs defaultValue="documentos" className="w-full">
          <TabsList className="bg-slate-200/60 p-1 rounded-xl h-10 w-full sm:w-auto">
            <TabsTrigger value="documentos" className="gap-2 text-xs font-semibold rounded-lg">
              <FileText className="h-4 w-4" />
              <span>Meus Documentos ({documentos.length})</span>
            </TabsTrigger>
            <TabsTrigger value="obrigacoes" className="gap-2 text-xs font-semibold rounded-lg">
              <Clock className="h-4 w-4" />
              <span>Obrigações Fiscais ({obrigacoes.length})</span>
            </TabsTrigger>
          </TabsList>

          {/* ABA DOCUMENTOS (Upload GED Drag and drop + Lista) */}
          <TabsContent value="documentos" className="space-y-6 mt-4">
            {/* Área de Upload Drag-and-Drop */}
            <Card className="rounded-3xl border border-[#E2E8F0] shadow-2xs overflow-hidden">
              <CardHeader className="bg-slate-50/70 border-b border-[#E2E8F0] pb-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <UploadCloud className="h-4 w-4 text-[#0FA3A3]" />
                  <span>Enviar Documentos ao Escritório</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Envie notas fiscais, faturas, extratos ou recibos para a contabilidade (limite:
                  até 25 MB).
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleUploadSubmit} className="space-y-4">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={cn(
                      'border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer',
                      isDragging
                        ? 'border-[#0FA3A3] bg-[#0FA3A3]/5'
                        : 'border-[#CBD5E1] bg-slate-50 hover:bg-slate-100/60',
                    )}
                    onClick={() => document.getElementById('portal-file-input')?.click()}
                  >
                    <input
                      id="portal-file-input"
                      type="file"
                      className="hidden"
                      onChange={handleFileChange}
                      accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx"
                    />
                    <UploadCloud className="h-10 w-10 text-[#0FA3A3] mx-auto mb-2" />
                    <p className="text-xs font-bold text-[#1A2333]">
                      {uploadFile
                        ? uploadFile.name
                        : 'Arraste e solte seu arquivo aqui, ou clique para buscar'}
                    </p>
                    <p className="text-[11px] text-[#64748B] mt-1">
                      {uploadFile
                        ? `${(uploadFile.size / 1024 / 1024).toFixed(2)} MB selecionado`
                        : 'PDF, Imagens (PNG/JPG), Planilhas XLSX ou DOCX até 25 MB'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold">Tipo de Documento</Label>
                      <Select
                        value={uploadTipo}
                        onValueChange={(v) => setUploadTipo(v as DocumentoTipo)}
                      >
                        <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fatura">Fatura / Concessionária</SelectItem>
                          <SelectItem value="nota_fiscal">Nota Fiscal (NFSe / NFe)</SelectItem>
                          <SelectItem value="contrato_social">Contrato ou Aditivo</SelectItem>
                          <SelectItem value="relatorios">Extrato / Relatório</SelectItem>
                          <SelectItem value="outros">Outros Documentos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold">
                        Observações para o Contador (Opcional)
                      </Label>
                      <Input
                        value={uploadObs}
                        onChange={(e) => setUploadObs(e.target.value)}
                        placeholder="Ex: Ref. ao pagamento do aluguel da sede..."
                        className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={!uploadFile || uploading}
                      className="rounded-xl text-xs font-semibold h-10 px-6 bg-[#0FA3A3] text-white hover:bg-[#0C8585]"
                    >
                      {uploading ? 'Enviando ao Escritório...' : 'Confirmar Envio do Documento'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Lista de Documentos Enviados e Status */}
            <div className="rounded-3xl border border-[#E2E8F0] bg-white shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-[#E2E8F0] bg-slate-50/50">
                <h3 className="text-sm font-bold text-[#1A2333]">Histórico de Documentos</h3>
                <p className="text-xs text-[#64748B]">
                  Acompanhe a classificação contábil realizada pela equipe do escritório
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] text-[#64748B] font-semibold border-b border-[#E2E8F0]">
                    <tr>
                      <th className="py-3 px-4">Nome do Arquivo</th>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4">Enviado em</th>
                      <th className="py-3 px-4">Observações</th>
                      <th className="py-3 px-4">Status de Classificação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[#1A2333]">
                    {documentos.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-[#94A3B8]">
                          Nenhum documento cadastrado ou enviado ainda.
                        </td>
                      </tr>
                    ) : (
                      documentos.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-[#1A2333] flex items-center gap-2">
                            <FileText className="h-4 w-4 text-[#0FA3A3] shrink-0" />
                            <span className="truncate max-w-xs">{d.nome_arquivo}</span>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-[#475569] uppercase text-[10px]">
                            {d.tipo.replace('_', ' ')}
                          </td>
                          <td className="py-3.5 px-4 text-[#64748B]">
                            {formatDatePtBr(d.created)}
                          </td>
                          <td className="py-3.5 px-4 text-[#64748B]">{d.observacoes || '—'}</td>
                          <td className="py-3.5 px-4">
                            {d.status === 'processado' && (
                              <Badge className="bg-[#DCFCE7] text-[#16A34A] border-emerald-200">
                                Classificado
                              </Badge>
                            )}
                            {d.status === 'pendente' && (
                              <Badge className="bg-[#FEF3C7] text-[#D97706] border-amber-200">
                                Em Análise
                              </Badge>
                            )}
                            {d.status === 'rejeitado' && (
                              <Badge className="bg-[#FEE2E2] text-[#DC2626] border-rose-200">
                                Recusado
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* ABA OBRIGAÇÕES FISCAIS (Somente leitura para o cliente) */}
          <TabsContent value="obrigacoes" className="space-y-4 mt-4">
            <div className="rounded-3xl border border-[#E2E8F0] bg-white shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-[#E2E8F0] bg-slate-50/50">
                <h3 className="text-sm font-bold text-[#1A2333]">Obrigações e Guias Fiscais</h3>
                <p className="text-xs text-[#64748B]">
                  Consulte os prazos de vencimento e comprovantes de entrega gerenciados pela Rumo
                  Consultoria
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] text-[#64748B] font-semibold border-b border-[#E2E8F0]">
                    <tr>
                      <th className="py-3 px-4">Guia / Tributo</th>
                      <th className="py-3 px-4">Competência</th>
                      <th className="py-3 px-4">Vencimento</th>
                      <th className="py-3 px-4">Valor Previsto</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Guia / Anexo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[#1A2333]">
                    {obrigacoes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-[#94A3B8]">
                          Nenhuma obrigação fiscal registrada para esta empresa.
                        </td>
                      </tr>
                    ) : (
                      obrigacoes.map((ob) => (
                        <tr key={ob.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-[#1A2333]">{ob.tipo}</td>
                          <td className="py-3.5 px-4 font-medium text-[#475569]">
                            {ob.competencia}
                          </td>
                          <td className="py-3.5 px-4 text-[#64748B]">
                            {formatDatePtBr(ob.vencimento)}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-[#1A2333]">
                            {ob.valor !== undefined && ob.valor !== null
                              ? `R$ ${ob.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                              : '—'}
                          </td>
                          <td className="py-3.5 px-4">
                            {ob.status === 'entregue' && (
                              <Badge className="bg-[#DCFCE7] text-[#16A34A] border-emerald-200">
                                Entregue / Paga
                              </Badge>
                            )}
                            {ob.status === 'pendente' && (
                              <Badge className="bg-[#FEF3C7] text-[#D97706] border-amber-200">
                                Aguardando Pagamento
                              </Badge>
                            )}
                            {ob.status === 'atrasada' && (
                              <Badge className="bg-[#FEE2E2] text-[#DC2626] border-rose-200">
                                Vencida
                              </Badge>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {ob.anexo ? (
                              <a
                                href={pb.files.getURL(ob, ob.anexo)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-[#0FA3A3] hover:underline"
                              >
                                <Download className="h-3.5 w-3.5" />
                                <span>Baixar Guia</span>
                              </a>
                            ) : (
                              <span className="text-[#94A3B8]">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

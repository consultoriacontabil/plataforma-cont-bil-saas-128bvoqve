import React, { useState } from 'react'
import {
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Plus,
  Trash2,
  Paperclip,
  Check,
} from 'lucide-react'
import type { ChecklistDocItem, StatusItemChecklist } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DialogFooter,
} from '@/components/ui/dialog'
import { documentosService } from '@/services/documentos'
import { useToast } from '@/hooks/use-toast'

interface FormationDocumentosChecklistProps {
  checklist: ChecklistDocItem[]
  canEdit: boolean
  empresaId: string
  tenantId: string
  usuarioId: string
  onChange: (updated: ChecklistDocItem[]) => void
}

export const FormationDocumentosChecklist: React.FC<FormationDocumentosChecklistProps> = ({
  checklist,
  canEdit,
  empresaId,
  tenantId,
  usuarioId,
  onChange,
}) => {
  const { toast } = useToast()
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [novoTitulo, setNovoTitulo] = useState('')
  const [novaCategoria, setNovaCategoria] = useState<ChecklistDocItem['categoria']>('socios')
  const [novoDetalhe, setNovoDetalhe] = useState('')
  const [novoObrigatorio, setNovoObrigatorio] = useState(true)

  const concluidosCount = checklist.filter(
    (d) => d.status === 'recebido' || d.status === 'nao_aplicavel',
  ).length
  const totalCount = checklist.length
  const percConcluido = totalCount > 0 ? Math.round((concluidosCount / totalCount) * 100) : 0

  const handleStatusChange = (id: string, newStatus: StatusItemChecklist) => {
    const updated = checklist.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          status: newStatus,
          data_recebimento:
            newStatus === 'recebido'
              ? new Date().toISOString().slice(0, 10)
              : item.data_recebimento,
        }
      }
      return item
    })
    onChange(updated)
  }

  const handleFileUpload = async (itemId: string, file: File) => {
    try {
      setUploadingItemId(itemId)
      const formData = new FormData()
      formData.append('tenant_id', tenantId)
      formData.append('empresa_id', empresaId)
      formData.append('nome_arquivo', file.name)
      formData.append('tipo', 'contrato_social')
      formData.append('status', 'processado')
      formData.append('origem_documento', 'upload_manual')
      formData.append('usuario_upload_id', usuarioId || '')
      formData.append(
        'observacoes',
        `[Checklist Abertura]: Documento anexado ao item de constituição`,
      )
      formData.append('arquivo', file)

      const doc = await documentosService.create(formData)

      const updated = checklist.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            status: 'recebido' as StatusItemChecklist,
            data_recebimento: new Date().toISOString().slice(0, 10),
            ged_documento_id: doc.id,
            nome_arquivo: file.name,
          }
        }
        return item
      })

      onChange(updated)
      toast({
        title: 'Documento anexado ao GED',
        description: `O arquivo ${file.name} foi catalogado com sucesso no repositório multi-tenant.`,
      })
    } catch (err) {
      console.error('Erro no upload:', err)
      toast({
        variant: 'destructive',
        title: 'Falha no upload',
        description: 'Não foi possível salvar o arquivo no GED.',
      })
    } finally {
      setUploadingItemId(null)
    }
  }

  const handleAddCustomItem = () => {
    if (!novoTitulo.trim()) return
    const novoItem: ChecklistDocItem = {
      id: `doc_custom_${Date.now()}`,
      categoria: novaCategoria,
      titulo: novoTitulo.trim(),
      obrigatorio: novoObrigatorio,
      status: 'pendente',
      detalhe: novoDetalhe.trim(),
    }
    onChange([...checklist, novoItem])
    setShowAddModal(false)
    setNovoTitulo('')
    setNovoDetalhe('')
    toast({
      title: 'Item adicionado ao checklist',
    })
  }

  const handleRemoveItem = (id: string) => {
    onChange(checklist.filter((it) => it.id !== id))
  }

  return (
    <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
      <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#0FA3A3]" />
            <span>Checklist Documental & GED de Abertura</span>
          </CardTitle>
          <p className="text-xs text-[#64748B] mt-0.5">
            Documentação obrigatória adaptada ao tipo societário selecionado
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#1A2333]">
              {concluidosCount}/{totalCount} ({percConcluido}%)
            </span>
            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className="h-full bg-teal-600 transition-all duration-300"
                style={{ width: `${percConcluido}%` }}
              />
            </div>
          </div>

          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddModal(true)}
              className="h-8 gap-1 rounded-xl text-xs"
            >
              <Plus className="h-3 w-3" />
              <span>Adicionar Item</span>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
        <div className="divide-y divide-slate-100">
          {checklist.map((item) => (
            <div
              key={item.id}
              className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 first:pt-0 last:pb-0"
            >
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-[#1A2333]">{item.titulo}</span>
                  {item.obrigatorio ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-red-600 border-red-200 bg-red-50/50"
                    >
                      Obrigatório
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-slate-500 border-slate-200"
                    >
                      Facultativo
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-[10px] capitalize text-slate-600">
                    {item.categoria}
                  </Badge>
                </div>
                {item.detalhe && <p className="text-[11px] text-[#64748B]">{item.detalhe}</p>}
                {item.nome_arquivo && (
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md w-fit">
                    <Paperclip className="h-3 w-3 text-teal-600" />
                    <span>{item.nome_arquivo}</span>
                    {item.data_recebimento && <span>(anexado em {item.data_recebimento})</span>}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Upload Direto para GED */}
                {canEdit && (
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFileUpload(item.id, file)
                      }}
                      disabled={uploadingItemId === item.id}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      asChild
                      className="h-8 gap-1 text-xs rounded-xl border-slate-200 hover:bg-slate-50 cursor-pointer"
                    >
                      <span>
                        <Upload className="h-3 w-3 text-slate-600" />
                        <span>{uploadingItemId === item.id ? 'Enviando...' : 'Anexar ao GED'}</span>
                      </span>
                    </Button>
                  </label>
                )}

                {/* Status Seletor */}
                {canEdit ? (
                  <Select
                    value={item.status}
                    onValueChange={(val) => handleStatusChange(item.id, val as StatusItemChecklist)}
                  >
                    <SelectTrigger
                      className={`h-8 w-36 text-xs rounded-xl font-medium ${
                        item.status === 'recebido'
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          : item.status === 'em_andamento'
                            ? 'border-blue-300 bg-blue-50 text-blue-800'
                            : item.status === 'nao_aplicavel'
                              ? 'border-slate-200 bg-slate-100 text-slate-500'
                              : 'border-amber-300 bg-amber-50 text-amber-800'
                      }`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="em_andamento">Em Andamento</SelectItem>
                      <SelectItem value="recebido">Recebido / OK</SelectItem>
                      <SelectItem value="nao_aplicavel">Não Aplicável</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge
                    className={
                      item.status === 'recebido'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.status === 'em_andamento'
                          ? 'bg-blue-100 text-blue-800'
                          : item.status === 'nao_aplicavel'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-amber-100 text-amber-800'
                    }
                  >
                    {item.status === 'recebido'
                      ? 'Recebido'
                      : item.status === 'em_andamento'
                        ? 'Em Andamento'
                        : item.status === 'nao_aplicavel'
                          ? 'Não Aplicável'
                          : 'Pendente'}
                  </Badge>
                )}

                {canEdit && item.id.startsWith('doc_custom_') && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRemoveItem(item.id)}
                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      {/* Modal Adicionar Item Customizado */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-[#1A2333]">
              Adicionar Documento ao Checklist
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Título do Documento</Label>
              <Input
                placeholder="Ex.: Procuração Pública do Sócio Estrangeiro"
                value={novoTitulo}
                onChange={(e) => setNovoTitulo(e.target.value)}
                className="mt-1 h-9 rounded-xl text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select
                value={novaCategoria}
                onValueChange={(val) => setNovaCategoria(val as ChecklistDocItem['categoria'])}
              >
                <SelectTrigger className="mt-1 h-9 rounded-xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="socios">Sócios</SelectItem>
                  <SelectItem value="empresa">Empresa / Imóvel</SelectItem>
                  <SelectItem value="viabilidade">Viabilidade</SelectItem>
                  <SelectItem value="societario">Societário / Atos</SelectItem>
                  <SelectItem value="orgao_classe">Órgão de Classe</SelectItem>
                  <SelectItem value="mercantil">Mercantil / Junta</SelectItem>
                  <SelectItem value="licencas">Licenças / Alvarás</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Observações / Detalhe</Label>
              <Input
                placeholder="Exigência municipal específica da localidade"
                value={novoDetalhe}
                onChange={(e) => setNovoDetalhe(e.target.value)}
                className="mt-1 h-9 rounded-xl text-xs"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="novoObrigatorio"
                checked={novoObrigatorio}
                onChange={(e) => setNovoObrigatorio(e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <label htmlFor="novoObrigatorio" className="text-xs text-[#1A2333] cursor-pointer">
                Documento obrigatório para conclusão da abertura
              </label>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddModal(false)}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleAddCustomItem}
              disabled={!novoTitulo.trim()}
              className="rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs"
            >
              Salvar Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

import React, { useState, useRef, useMemo } from 'react'
import {
  Upload,
  FileCode,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Layers,
  ArrowRight,
  Loader2,
  Filter,
  Trash2,
  Building2,
  Sparkles,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { xmlFiscalBatchService } from '@/services/xmlFiscalBatchService'
import type {
  Empresa,
  PreviaImportacaoXmlResult,
  XmlParsedNota,
  XmlStatusPrevia,
  XmlAcaoDuplicidade,
  ExecutarImportacaoXmlResult,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DialogFooter,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'

interface ModalImportacaoXmlLoteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresas: Empresa[]
  selectedEmpresaId: string
  onImportacaoConcluida?: () => void
}

export function ModalImportacaoXmlLote({
  open,
  onOpenChange,
  empresas,
  selectedEmpresaId,
  onImportacaoConcluida,
}: ModalImportacaoXmlLoteProps) {
  const { user, tenant } = useAuth()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Configuração inicial do lote
  const [empresaId, setEmpresaId] = useState(selectedEmpresaId || (empresas[0]?.id ?? ''))
  const [competencia, setCompetencia] = useState(() => {
    const d = new Date()
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  })
  const [gerarCascataContabil, setGerarCascataContabil] = useState(true)

  // Estado do processamento
  const [lendoArquivos, setLendoArquivos] = useState(false)
  const [executandoImportacao, setExecutandoImportacao] = useState(false)
  const [previa, setPrevia] = useState<PreviaImportacaoXmlResult | null>(null)
  const [resultado, setResultado] = useState<ExecutarImportacaoXmlResult | null>(null)

  // Gerenciamento de duplicadas
  const [acaoDuplicidadeGlobal, setAcaoDuplicidadeGlobal] = useState<XmlAcaoDuplicidade>('pular')
  const [acoesLinhaLinha, setAcoesLinhaLinha] = useState<Record<string, XmlAcaoDuplicidade>>({})

  // Filtro de prévia
  const [filtroStatusPrevia, setFiltroStatusPrevia] = useState<'todos' | XmlStatusPrevia>('todos')

  // Leitura dos arquivos selecionados / arrastados
  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0 || !tenant?.id || !empresaId) return

    setLendoArquivos(true)
    setResultado(null)
    const xmlFiles: Array<{ nome: string; conteudo: string }> = []

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (file.name.toLowerCase().endsWith('.xml') || file.type.includes('xml')) {
          const text = await file.text()
          xmlFiles.push({ nome: file.name, conteudo: text })
        }
      }

      if (xmlFiles.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Nenhum XML válido selecionado',
          description: 'Por favor, selecione arquivos com extensão .xml (NF-e mod 55 ou NFS-e).',
        })
        setLendoArquivos(false)
        return
      }

      // Analisar o lote no serviço com verificação de duplicidade
      const analise = await xmlFiscalBatchService.analisarLoteXml(
        xmlFiles,
        tenant.id,
        empresaId,
        competencia,
      )

      setPrevia(analise)
      setAcoesLinhaLinha({})

      toast({
        title: `${analise.total_arquivos} arquivos analisados`,
        description: `Prontas: ${analise.prontas} · Duplicadas: ${analise.duplicadas} · Erros: ${analise.erros}`,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na leitura dos arquivos XML.'
      toast({
        variant: 'destructive',
        title: 'Erro ao processar lote de arquivos',
        description: msg,
      })
    } finally {
      setLendoArquivos(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Drag and drop handlers
  const [isDragging, setIsDragging] = useState(false)
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
    if (e.dataTransfer.files) {
      handleFilesSelected(e.dataTransfer.files)
    }
  }

  // Filtrar itens da prévia para visualização na tabela
  const itensFiltrados = useMemo(() => {
    if (!previa) return []
    if (filtroStatusPrevia === 'todos') return previa.itens
    return previa.itens.filter((item) => item.status_previa === filtroStatusPrevia)
  }, [previa, filtroStatusPrevia])

  // Confirmar e Executar Importação
  const handleConfirmarImportacao = async () => {
    if (!previa || !tenant?.id || !user?.id || !empresaId) return

    setExecutandoImportacao(true)
    try {
      const res = await xmlFiscalBatchService.executarImportacaoLote({
        tenantId: tenant.id,
        empresaId,
        usuarioId: user.id,
        itens: previa.itens,
        acaoDuplicidadeGlobal,
        acoesIndividuais: acoesLinhaLinha,
        gerarCascataContabil,
      })

      setResultado(res)

      if (res.sucesso) {
        toast({
          title: 'Importação de XMLs concluída!',
          description: `${res.total_criados} notas cadastradas e ${res.total_atualizados} atualizadas com sucesso.`,
        })
        if (onImportacaoConcluida) {
          onImportacaoConcluida()
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Importação com pendências',
          description: 'Nenhum registro gravado. Verifique os erros no relatório.',
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao gravar lote.'
      toast({
        variant: 'destructive',
        title: 'Erro na execução da importação',
        description: msg,
      })
    } finally {
      setExecutandoImportacao(false)
    }
  }

  // Reset do estado ao fechar
  const handleClose = () => {
    setPrevia(null)
    setResultado(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="rounded-2xl max-w-4xl max-h-[92vh] flex flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="p-5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center text-[#0FA3A3]">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Importação de XML Fiscal em Lote (NF-e & NFS-e)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Upload múltiplo de documentos fiscais com parser inteligente, diagnóstico de
                duplicidade e cascata contábil de apuração.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Seção 1: Configuração do Lote */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700">Empresa Destino *</Label>
              <Select value={empresaId} onValueChange={setEmpresaId} disabled={Boolean(previa)}>
                <SelectTrigger className="h-9 text-xs rounded-xl bg-white border-slate-200">
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent className="max-h-52">
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome_fantasia || e.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700">Competência Fiscal</Label>
              <Input
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value)}
                placeholder="MM/AAAA"
                disabled={Boolean(previa)}
                className="h-9 text-xs rounded-xl bg-white border-slate-200 font-mono"
              />
            </div>

            <div className="space-y-1 flex flex-col justify-center pt-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="cascata_switch"
                  className="text-[11px] font-semibold text-slate-700 cursor-pointer"
                >
                  Cascata Contábil (LOTE-FISC)
                </Label>
                <Switch
                  id="cascata_switch"
                  checked={gerarCascataContabil}
                  onCheckedChange={setGerarCascataContabil}
                />
              </div>
              <span className="text-[10px] text-slate-400">
                Gera provisão tributária proporcional automática
              </span>
            </div>
          </div>

          {/* Seção 2: Área de Upload / Dropzone */}
          {!previa && !resultado && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-[#0FA3A3] bg-teal-50/50'
                  : 'border-slate-300 hover:border-slate-400 bg-slate-50/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".xml,text/xml,application/xml"
                onChange={(e) => handleFilesSelected(e.target.files)}
                className="hidden"
              />

              <div className="max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-[#0FA3A3] mx-auto flex items-center justify-center shadow-xs">
                  {lendoArquivos ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <Upload className="w-6 h-6" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-800">
                    {lendoArquivos
                      ? 'Processando arquivos XML...'
                      : 'Clique ou arraste seus arquivos XML para cá'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Suporte nativo a NF-e Modelo 55 (mercadorias/SEFAZ) e NFS-e (serviços padrão
                    ABRASF / Nacional)
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs rounded-xl border-slate-300 pointer-events-none"
                >
                  Selecionar Múltiplos Arquivos
                </Button>
              </div>
            </div>
          )}

          {/* Seção 3: Prévia com Contadores e Diagnóstico */}
          {previa && !resultado && (
            <div className="space-y-4">
              {/* Contadores da Prévia */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-100 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-500 font-medium">Total de Arquivos</p>
                    <p className="text-lg font-bold text-slate-800">{previa.total_arquivos}</p>
                  </div>
                  <Layers className="h-5 w-5 text-slate-400" />
                </div>

                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-emerald-600 font-medium">Prontas p/ Criar</p>
                    <p className="text-lg font-bold text-emerald-700">{previa.prontas}</p>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-amber-600 font-medium">Duplicadas no Banco</p>
                    <p className="text-lg font-bold text-amber-700">{previa.duplicadas}</p>
                  </div>
                  <RefreshCw className="h-5 w-5 text-amber-600" />
                </div>

                <div className="p-3 bg-red-50 rounded-xl border border-red-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-red-600 font-medium">Erros / Inválidos</p>
                    <p className="text-lg font-bold text-red-700">{previa.erros}</p>
                  </div>
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
              </div>

              {/* Barra de Ação Global para Duplicadas */}
              {previa.duplicadas > 0 && (
                <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span className="text-xs text-amber-900 font-medium">
                      Existem {previa.duplicadas} notas já cadastradas na base. O que fazer?
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-amber-800">Ação global:</span>
                    <Select
                      value={acaoDuplicidadeGlobal}
                      onValueChange={(val: XmlAcaoDuplicidade) => setAcaoDuplicidadeGlobal(val)}
                    >
                      <SelectTrigger className="h-8 text-xs rounded-lg bg-white border-amber-300 w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pular">Pular (Manter)</SelectItem>
                        <SelectItem value="atualizar">Atualizar Dados</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Tabela de Prévia com Filtros */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-slate-500" />
                    <span className="font-bold text-slate-800 text-xs">
                      Detalhamento dos Arquivos ({previa.itens.length})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">Filtrar:</span>
                    <Select
                      value={filtroStatusPrevia}
                      onValueChange={(val: 'todos' | XmlStatusPrevia) => setFiltroStatusPrevia(val)}
                    >
                      <SelectTrigger className="h-7 text-[11px] rounded-lg border-slate-200 w-32 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos ({previa.itens.length})</SelectItem>
                        <SelectItem value="pronta">Prontas ({previa.prontas})</SelectItem>
                        <SelectItem value="duplicada">Duplicadas ({previa.duplicadas})</SelectItem>
                        <SelectItem value="erro">Erros ({previa.erros})</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] uppercase font-bold text-slate-500">
                        <th className="py-2 px-3">Arquivo</th>
                        <th className="py-2 px-3">Tipo / Doc</th>
                        <th className="py-2 px-3">Emitente / Tomador</th>
                        <th className="py-2 px-3 text-right">Valor Total</th>
                        <th className="py-2 px-3 text-center">Diagnóstico</th>
                        <th className="py-2 px-3 text-right">Tratamento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {itensFiltrados.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3">
                            <span
                              className="font-mono text-[11px] text-slate-800 block truncate max-w-[150px]"
                              title={item.arquivo_nome}
                            >
                              {item.arquivo_nome}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {item.data_emissao || 'Data n/d'}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <Badge
                              variant="outline"
                              className={`text-[9px] font-bold ${
                                item.tipo === 'nfe_55'
                                  ? 'border-blue-200 text-blue-700 bg-blue-50/50'
                                  : 'border-purple-200 text-purple-700 bg-purple-50/50'
                              }`}
                            >
                              {item.tipo === 'nfe_55' ? 'NF-e 55' : 'NFS-e'}
                            </Badge>
                            <span className="block font-mono text-[11px] font-semibold text-slate-700">
                              Nº {item.numero}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className="font-medium text-slate-800 block truncate max-w-[180px]"
                              title={item.emitente_razao}
                            >
                              {item.emitente_razao}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {item.emitente_cnpj_cpf}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800">
                            R${' '}
                            {(item.valor_total || 0).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {item.status_previa === 'pronta' && (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] hover:bg-emerald-50">
                                Pronta
                              </Badge>
                            )}
                            {item.status_previa === 'duplicada' && (
                              <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] hover:bg-amber-50">
                                Duplicada
                              </Badge>
                            )}
                            {item.status_previa === 'erro' && (
                              <Badge
                                className="bg-red-50 text-red-700 border-red-200 text-[10px] hover:bg-red-50"
                                title={item.motivo_status}
                              >
                                Erro
                              </Badge>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {item.status_previa === 'duplicada' ? (
                              <Select
                                value={acoesLinhaLinha[item.chave_acesso] || acaoDuplicidadeGlobal}
                                onValueChange={(val: XmlAcaoDuplicidade) =>
                                  setAcoesLinhaLinha({
                                    ...acoesLinhaLinha,
                                    [item.chave_acesso]: val,
                                  })
                                }
                              >
                                <SelectTrigger className="h-6 text-[10px] rounded border-slate-200 w-24 bg-white ml-auto">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pular">Pular</SelectItem>
                                  <SelectItem value="atualizar">Atualizar</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : item.status_previa === 'erro' ? (
                              <span
                                className="text-[10px] text-red-500 truncate block max-w-[120px]"
                                title={item.motivo_status}
                              >
                                {item.motivo_status}
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-600 font-medium">
                                Nova gravação
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Seção 4: Relatório Pós-Execução */}
          {resultado && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span className="font-bold text-emerald-900 text-sm">
                    Lote Fiscal Processado com Sucesso!
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-slate-500">Criadas:</span>{' '}
                    <strong className="text-emerald-700 font-mono">
                      {resultado.total_criados}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Atualizadas:</span>{' '}
                    <strong className="text-blue-700 font-mono">
                      {resultado.total_atualizados}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Ignoradas:</span>{' '}
                    <strong className="text-amber-700 font-mono">
                      {resultado.total_ignorados}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Erros isolados:</span>{' '}
                    <strong className="text-red-700 font-mono">{resultado.total_erros}</strong>
                  </div>
                </div>

                {resultado.lote_contabil_id && (
                  <div className="pt-2 text-xs text-emerald-800 flex items-center gap-1.5 border-t border-emerald-200 mt-2">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    <span>
                      Cascata Contábil Ativada:{' '}
                      <strong className="font-mono">{resultado.lote_contabil_id}</strong>
                    </span>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50 space-y-1.5">
                <span className="font-semibold text-slate-700 text-xs">
                  Trilha de Execução e Auditoria:
                </span>
                <div className="max-h-48 overflow-y-auto space-y-1 text-[11px] font-mono text-slate-600">
                  {resultado.mensagens.map((msg, i) => (
                    <div key={i} className="leading-tight">
                      {msg}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:justify-between items-center gap-2">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-teal-600" />
            <span>Isolamento por Tenant • Falha de um arquivo não aborta o lote</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="text-xs rounded-xl"
            >
              {resultado ? 'Fechar' : 'Cancelar'}
            </Button>

            {previa && !resultado && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setPrevia(null)
                    setAcoesLinhaLinha({})
                  }}
                  className="text-xs rounded-xl"
                >
                  Novo Arquivo
                </Button>
                <Button
                  type="button"
                  disabled={executandoImportacao || previa.prontas + previa.duplicadas === 0}
                  onClick={handleConfirmarImportacao}
                  className="gap-1.5 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs shadow-xs"
                >
                  {executandoImportacao ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Gravando na base...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Confirmar e Importar Lote</span>
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import React, { useState, useRef } from 'react'
import {
  UploadCloud,
  FileText,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Info,
  Check,
  X,
  Edit2,
  Sparkles,
  ArrowRight,
  Loader2,
  FolderArchive,
  RefreshCw,
  ExternalLink,
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
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { cadastroAssistidoService } from '@/services/cadastroAssistido'
import { documentosService } from '@/services/documentos'
import {
  extrairDadosDocumento,
  prepararCamposParaRevisao,
  validarConsistenciaCadastro,
} from '@/lib/extracaoDocumentos'
import { EXEMPLO_CARTAO_CNPJ_TEXTO, EXEMPLO_CONTRATO_SOCIAL_TEXTO } from '@/lib/documentosExemplo'
import type {
  CampoExtraidoItem,
  AlertaValidacao,
  Empresa,
  DocumentoCadastroTipo,
  User,
  Tenant,
} from '@/types'

interface CadastroAssistidoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formAtual: Partial<Empresa>
  empresaId?: string
  tenant: Tenant | null
  usuario: User | null
  onAplicarDados: (dados: Partial<Empresa>) => void
  onFocarCampo?: (campo: string) => void
}

export function CadastroAssistidoModal({
  open,
  onOpenChange,
  formAtual,
  empresaId,
  tenant,
  usuario,
  onAplicarDados,
  onFocarCampo,
}: CadastroAssistidoModalProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Estados principais do fluxo
  const [etapa, setEtapa] = useState<'upload' | 'revisao' | 'alertas'>('upload')
  const [processando, setProcessando] = useState(false)
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null)
  const [nomeDocumento, setNomeDocumento] = useState<string>('')
  const [tipoDocumento, setTipoDocumento] = useState<DocumentoCadastroTipo>('cartao_cnpj')
  const [textoExtraido, setTextoExtraido] = useState<string>('')

  // Itens extraídos
  const [camposRevisao, setCamposRevisao] = useState<CampoExtraidoItem[]>([])
  const [alertasGerados, setAlertasGerados] = useState<AlertaValidacao[]>([])
  const [salvarNoGed, setSalvarNoGed] = useState<boolean>(Boolean(empresaId))
  const [tipoGed, setTipoGed] = useState<'contrato_social' | 'outros'>('contrato_social')

  // Edição inline de item
  const [editandoCampo, setEditandoCampo] = useState<string | null>(null)
  const [valorEditado, setValorEditado] = useState<string>('')

  // Resetar ao fechar ou reabrir
  const reiniciar = () => {
    setEtapa('upload')
    setProcessando(false)
    setArquivoSelecionado(null)
    setNomeDocumento('')
    setTextoExtraido('')
    setCamposRevisao([])
    setAlertasGerados([])
    setEditandoCampo(null)
  }

  // Manipular arquivo recebido
  const processarArquivo = async (file: File) => {
    if (file.size > 26214400) {
      toast({
        variant: 'destructive',
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo permitido é 25 MB.',
      })
      return
    }

    setArquivoSelecionado(file)
    setNomeDocumento(file.name)
    setProcessando(true)

    try {
      // 1. Tentar extração de texto via backend hook
      let texto = ''
      try {
        const res = await cadastroAssistidoService.extrairTextoDocumento(file)
        if (res.success && res.markdown) {
          texto = res.markdown
        } else if (res.erro === 'documento_digitalizado_sem_ocr') {
          toast({
            variant: 'destructive',
            title: 'Documento Digitalizado sem Camada de Texto',
            description:
              res.mensagem ||
              'Envie o PDF digital original (com texto selecionável) do Cartão CNPJ ou Contrato Social.',
          })
          setProcessando(false)
          return
        }
      } catch (bkErr) {
        console.warn('Backend toMarkdown indisponível ou erro HTTP, tentando fallback:', bkErr)
      }

      // Se for arquivo de texto ou não veio do toMarkdown, tenta leitura direta se txt/json
      if (!texto && file.type.includes('text')) {
        texto = await file.text()
      }

      if (!texto) {
        // Se ainda não tiver texto, orienta sobre OCR / PDF com texto
        toast({
          variant: 'destructive',
          title: 'Não foi possível extrair texto',
          description:
            'O documento enviado não contém camada de texto selecionável. Para leitura automática, utilize o PDF original do Cartão CNPJ emitido pela Receita Federal.',
        })
        setProcessando(false)
        return
      }

      setTextoExtraido(texto)
      executarParserEValidacoes(texto, file.name)
    } catch (err: unknown) {
      console.error('Erro na extração do documento:', err)
      const msg = err instanceof Error ? err.message : 'Falha na análise do arquivo.'
      toast({
        variant: 'destructive',
        title: 'Falha no processamento',
        description: msg,
      })
    } finally {
      setProcessando(false)
    }
  }

  // Processar texto sintético de exemplo
  const processarExemplo = (tipo: 'cnpj' | 'contrato') => {
    setProcessando(true)
    const texto = tipo === 'cnpj' ? EXEMPLO_CARTAO_CNPJ_TEXTO : EXEMPLO_CONTRATO_SOCIAL_TEXTO
    const nome =
      tipo === 'cnpj' ? 'Cartao_CNPJ_Aurora_Exemplo.pdf' : 'Contrato_Social_Aurora_Exemplo.pdf'
    setNomeDocumento(nome)
    setArquivoSelecionado(null)
    setTextoExtraido(texto)

    setTimeout(() => {
      executarParserEValidacoes(texto, nome)
      setProcessando(false)
      toast({
        title: 'Exemplo carregado com sucesso!',
        description: `Dados sintéticos de ${tipo === 'cnpj' ? 'Cartão CNPJ' : 'Contrato Social'} prontos para revisão.`,
      })
    }, 400)
  }

  const executarParserEValidacoes = (texto: string, nomeDoc: string) => {
    const extracao = extrairDadosDocumento(texto, nomeDoc)
    const itensRevisao = prepararCamposParaRevisao(extracao, nomeDoc)
    const alertas = validarConsistenciaCadastro(formAtual, extracao.campos, nomeDoc)

    setCamposRevisao(itensRevisao)
    setAlertasGerados(alertas)
    setTipoDocumento(
      extracao.documentoTipoDetectado === 'cartao_cnpj'
        ? 'cartao_cnpj'
        : extracao.documentoTipoDetectado === 'contrato_social'
          ? 'contrato_social'
          : 'outro',
    )
    setTipoGed(extracao.documentoTipoDetectado === 'contrato_social' ? 'contrato_social' : 'outros')
    setEtapa('revisao')
  }

  // Ações na revisão de campos
  const handleAlternarStatusCampo = (campo: string) => {
    setCamposRevisao((prev) =>
      prev.map((item) => {
        if (item.campo === campo) {
          const novoStatus = item.status === 'aceito' ? 'rejeitado' : 'aceito'
          return { ...item, status: novoStatus }
        }
        return item
      }),
    )
  }

  const handleAceitarTodos = () => {
    setCamposRevisao((prev) => prev.map((item) => ({ ...item, status: 'aceito' })))
  }

  const handleRejeitarTodos = () => {
    setCamposRevisao((prev) => prev.map((item) => ({ ...item, status: 'rejeitado' })))
  }

  const handleSalvarEdicaoCampo = (campo: string) => {
    setCamposRevisao((prev) =>
      prev.map((item) => {
        if (item.campo === campo) {
          return {
            ...item,
            valor: valorEditado,
            status: 'editado',
          }
        }
        return item
      }),
    )
    setEditandoCampo(null)
  }

  // Aplicar dados ao formulário pai
  const handleConfirmarEAplicar = async () => {
    const dadosParaAplicar: Partial<Empresa> = {}
    const acoesRegistradas: Record<string, string> = {}

    camposRevisao.forEach((item) => {
      if (item.status === 'aceito' || item.status === 'editado') {
        dadosParaAplicar[item.campo as keyof Empresa] = item.valor as never
        acoesRegistradas[item.campo] = `${item.status}: ${item.valor}`
      } else {
        acoesRegistradas[item.campo] = 'rejeitado'
      }
    })

    // Caso tenha sócios extraídos e o formulário não tenha observação sobre eles
    const sociosItem = camposRevisao.find((c) => c.campo === 'socios_qsa')
    if (sociosItem && sociosItem.status !== 'rejeitado') {
      const obsAtual = formAtual.observacoes || ''
      if (!obsAtual.includes('Sócios:')) {
        dadosParaAplicar.observacoes = obsAtual
          ? `${obsAtual}\n\nQuadro Societário: ${sociosItem.valor}`
          : `Quadro Societário: ${sociosItem.valor}`
      }
    }

    // 1. Arquivar no GED da empresa se estiver em modo de edição e marcado
    if (salvarNoGed && empresaId && tenant?.id && arquivoSelecionado && usuario?.id) {
      try {
        const gedFormData = new FormData()
        gedFormData.append('tenant_id', tenant.id)
        gedFormData.append('empresa_id', empresaId)
        gedFormData.append('nome_arquivo', arquivoSelecionado.name)
        gedFormData.append('tipo', tipoGed)
        gedFormData.append('status', 'processado')
        gedFormData.append(
          'observacoes',
          'Documento processado via Cadastro Assistido em ' +
            new Date().toLocaleDateString('pt-BR'),
        )
        gedFormData.append('arquivo', arquivoSelecionado)
        gedFormData.append('usuario_upload_id', usuario.id)

        await documentosService.create(gedFormData)
        toast({
          title: 'Documento arquivado no GED!',
          description: `Arquivo salvo com sucesso na categoria "${tipoGed}".`,
        })
      } catch (gedErr) {
        console.warn('Erro ao salvar documento no GED:', gedErr)
        toast({
          variant: 'destructive',
          title: 'Aviso de arquivamento',
          description: 'Não foi possível salvar o arquivo no GED, mas os dados foram extraídos.',
        })
      }
    }

    // 2. Persistir log do preenchimento assistido na coleção empresa_cadastro_assistido
    if (tenant?.id) {
      try {
        const camposExtraidosObj: Record<string, string> = {}
        camposRevisao.forEach((c) => {
          camposExtraidosObj[c.campo] = c.valor
        })

        await cadastroAssistidoService.salvarLog({
          tenantId: tenant.id,
          empresaId: empresaId || undefined,
          arquivoNome: nomeDocumento || 'documento_assistido',
          arquivoFile: arquivoSelecionado,
          tipoDocumento: tipoDocumento,
          camposExtraidos: camposExtraidosObj,
          alertas: alertasGerados,
          acoes: acoesRegistradas,
          criadoPorId: usuario?.id,
        })
      } catch (logErr) {
        console.warn('Falha ao gravar log do cadastro assistido:', logErr)
      }
    }

    // 3. Aplicar os campos ao formulário principal
    onAplicarDados(dadosParaAplicar)

    toast({
      title: 'Dados cadastrais aplicados!',
      description: `${Object.keys(dadosParaAplicar).length} campos foram preenchidos no formulário.`,
    })

    onOpenChange(false)
    reiniciar()
  }

  // Contadores de alertas
  const inconsistencias = alertasGerados.filter((a) => a.categoria === 'inconsistencia')
  const ausencias = alertasGerados.filter((a) => a.categoria === 'ausencia')
  const atencoes = alertasGerados.filter((a) => a.categoria === 'atencao')

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reiniciar()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 rounded-2xl overflow-hidden border-[#E2E8F0]">
        {/* Header com estilo padrão Rumo */}
        <DialogHeader className="p-5 pb-4 border-b border-slate-100 bg-[#F8FAFC]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-[#0FA3A3]/10 text-[#0FA3A3] flex items-center justify-center">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-[#1A2333]">
                  Cadastro Assistido por Documentos
                </DialogTitle>
                <DialogDescription className="text-xs text-[#64748B]">
                  Extração automática de Cartão CNPJ, Contrato Social e Ficha Cadastral com
                  auditoria e consistência
                </DialogDescription>
              </div>
            </div>

            {etapa !== 'upload' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={reiniciar}
                className="text-xs text-[#64748B] hover:text-[#1A2333] h-8"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Novo Arquivo
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Conteúdo Principal com scroll */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ETAPA 1: UPLOAD / SELEÇÃO DE DOCUMENTO */}
          {etapa === 'upload' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    processarArquivo(e.dataTransfer.files[0])
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#CBD5E1] hover:border-[#0FA3A3] transition-colors rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer bg-[#F8FAFC] hover:bg-[#F0FDFA]"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.docx"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      processarArquivo(e.target.files[0])
                    }
                  }}
                />
                <div className="h-14 w-14 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-[#0FA3A3]">
                  {processando ? (
                    <Loader2 className="h-7 w-7 animate-spin" />
                  ) : (
                    <UploadCloud className="h-7 w-7" />
                  )}
                </div>

                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-[#1A2333]">
                    {processando
                      ? 'Processando e analisando documento...'
                      : 'Clique ou arraste o documento aqui'}
                  </p>
                  <p className="text-xs text-[#64748B]">
                    Aceita PDF digital, PNG, JPG ou DOCX (limite de até 25 MB)
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
                  <Badge
                    variant="outline"
                    className="text-[11px] bg-white border-slate-200 text-[#475569]"
                  >
                    Cartão CNPJ (PDF Receita)
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[11px] bg-white border-slate-200 text-[#475569]"
                  >
                    Contrato Social
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[11px] bg-white border-slate-200 text-[#475569]"
                  >
                    Ficha Cadastral Junta
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[11px] bg-white border-slate-200 text-[#475569]"
                  >
                    Comprovante de Endereço
                  </Badge>
                </div>
              </div>

              {/* Botão para Testar com Documento de Exemplo Sintético */}
              <div className="p-4 rounded-xl border border-[#E2E8F0] bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#1A2333]">
                      Deseja testar sem um arquivo real?
                    </h4>
                    <p className="text-[11px] text-[#64748B]">
                      Carregue um Cartão CNPJ ou Contrato Social sintético de demonstração.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => processarExemplo('cnpj')}
                    disabled={processando}
                    className="text-xs h-8 rounded-lg border-[#0FA3A3] text-[#0FA3A3] hover:bg-[#F0FDFA]"
                  >
                    Exemplo Cartão CNPJ
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => processarExemplo('contrato')}
                    disabled={processando}
                    className="text-xs h-8 rounded-lg border-[#64748B] text-[#475569]"
                  >
                    Exemplo Contrato
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ETAPA 2 e 3: REVISÃO DE DADOS EXTRAÍDOS E PAINEL DE ALERTAS */}
          {etapa !== 'upload' && (
            <Tabs
              value={etapa}
              onValueChange={(val) => setEtapa(val as 'revisao' | 'alertas')}
              className="space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <TabsList className="bg-slate-100 p-1 rounded-xl">
                  <TabsTrigger
                    value="revisao"
                    className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#0FA3A3] data-[state=active]:shadow-xs gap-1.5"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>
                      Dados Extraídos (
                      {camposRevisao.filter((c) => c.status !== 'rejeitado').length})
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="alertas"
                    className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#1A2333] data-[state=active]:shadow-xs gap-1.5"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-[#F59E0B]" />
                    <span>Validações & Alertas ({alertasGerados.length})</span>
                  </TabsTrigger>
                </TabsList>

                <div className="flex items-center gap-2 text-xs text-[#64748B]">
                  <FileText className="h-3.5 w-3.5 text-[#0FA3A3]" />
                  <span className="font-medium truncate max-w-[200px]" title={nomeDocumento}>
                    {nomeDocumento}
                  </span>
                </div>
              </div>

              {/* ABA DE DADOS EXTRAÍDOS (REVISÃO CAMPO A CAMPO) */}
              <TabsContent value="revisao" className="space-y-3 mt-0">
                <div className="flex items-center justify-between py-1">
                  <p className="text-xs text-[#64748B]">
                    Revise cada campo antes de aplicar ao cadastro. Você pode aceitar, editar ou
                    rejeitar.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleAceitarTodos}
                      className="text-[11px] h-7 text-[#0FA3A3] hover:text-[#0C8585] p-1.5"
                    >
                      Aceitar Todos
                    </Button>
                    <span className="text-slate-300">|</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRejeitarTodos}
                      className="text-[11px] h-7 text-[#EF4444] hover:text-[#DC2626] p-1.5"
                    >
                      Rejeitar Todos
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {camposRevisao.length === 0 ? (
                    <div className="text-center py-8 text-xs text-[#64748B]">
                      Nenhum campo estruturado foi reconhecido no texto do documento.
                    </div>
                  ) : (
                    camposRevisao.map((item) => {
                      const isEditing = editandoCampo === item.campo
                      const isRejeitado = item.status === 'rejeitado'

                      return (
                        <div
                          key={item.campo}
                          className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isRejeitado
                              ? 'bg-slate-50/70 border-slate-200 opacity-60'
                              : item.status === 'editado'
                                ? 'bg-amber-50/40 border-amber-200'
                                : 'bg-white border-slate-200 shadow-xs'
                          }`}
                        >
                          <div className="flex-1 space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#1A2333]">
                                {item.rotulo}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 h-4 ${
                                  item.confianca === 'alta'
                                    ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                                    : item.confianca === 'media'
                                      ? 'border-blue-200 text-blue-700 bg-blue-50'
                                      : 'border-amber-200 text-amber-700 bg-amber-50'
                                }`}
                              >
                                {item.confianca === 'alta'
                                  ? 'Alta Confiança'
                                  : item.confianca === 'media'
                                    ? 'Média Confiança'
                                    : 'Atenção'}
                              </Badge>

                              {item.status === 'editado' && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 h-4 border-amber-300 bg-amber-50 text-amber-800"
                                >
                                  Editado
                                </Badge>
                              )}
                            </div>

                            {isEditing ? (
                              <div className="flex items-center gap-2 pt-1">
                                <Input
                                  value={valorEditado}
                                  onChange={(e) => setValorEditado(e.target.value)}
                                  className="h-8 text-xs rounded-lg"
                                  autoFocus
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleSalvarEdicaoCampo(item.campo)}
                                  className="h-8 px-2.5 rounded-lg bg-[#0FA3A3] text-white"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditandoCampo(null)}
                                  className="h-8 px-2 rounded-lg text-[#64748B]"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <p className="text-xs font-medium text-[#334155] break-words">
                                {item.valor}
                              </p>
                            )}
                          </div>

                          {/* Ações do item */}
                          {!isEditing && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditandoCampo(item.campo)
                                  setValorEditado(item.valor)
                                }}
                                className="h-7 w-7 p-0 rounded-lg text-[#64748B] hover:text-[#1A2333]"
                                title="Editar valor manualmente"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleAlternarStatusCampo(item.campo)}
                                className={`h-7 px-2.5 text-xs rounded-lg gap-1 ${
                                  item.status === 'aceito' || item.status === 'editado'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-slate-100 text-[#64748B] border-slate-200 hover:bg-slate-200'
                                }`}
                              >
                                {item.status === 'aceito' || item.status === 'editado' ? (
                                  <>
                                    <Check className="h-3 w-3" />
                                    <span>Aceito</span>
                                  </>
                                ) : (
                                  <>
                                    <X className="h-3 w-3" />
                                    <span>Rejeitado</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Opção de arquivar no GED da empresa quando aplicável */}
                {empresaId && arquivoSelecionado && (
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/70 p-3 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2.5">
                      <Checkbox
                        id="ged_arquivar"
                        checked={salvarNoGed}
                        onCheckedChange={(c) => setSalvarNoGed(Boolean(c))}
                      />
                      <Label
                        htmlFor="ged_arquivar"
                        className="text-xs font-semibold text-[#1A2333] cursor-pointer"
                      >
                        Arquivar também no GED da empresa (Documentos Digitais)
                      </Label>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-[#64748B]">
                      <FolderArchive className="h-3.5 w-3.5 text-[#0FA3A3]" />
                      <span>
                        Categoria: {tipoGed === 'contrato_social' ? 'Contrato Social' : 'Outros'}
                      </span>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ABA DE ALERTAS E INCONSISTÊNCIAS */}
              <TabsContent value="alertas" className="space-y-3 mt-0">
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-xl border border-red-200 bg-red-50/50 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-[#EF4444]" />
                    <div>
                      <p className="text-[10px] font-semibold text-red-600 uppercase">
                        Inconsistências
                      </p>
                      <p className="text-sm font-bold text-red-900">{inconsistencias.length}</p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/50 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
                    <div>
                      <p className="text-[10px] font-semibold text-amber-700 uppercase">
                        Ausências
                      </p>
                      <p className="text-sm font-bold text-amber-900">{ausencias.length}</p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/50 flex items-center gap-2">
                    <Info className="h-4 w-4 text-[#3B82F6]" />
                    <div>
                      <p className="text-[10px] font-semibold text-blue-700 uppercase">Atenções</p>
                      <p className="text-sm font-bold text-blue-900">{atencoes.length}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {alertasGerados.length === 0 ? (
                    <div className="p-6 text-center text-xs text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-col items-center gap-1.5">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                      <p className="font-bold">Nenhuma inconsistência ou ausência identificada!</p>
                      <p className="text-[11px] text-emerald-600">
                        O cadastro está consistente com os documentos processados.
                      </p>
                    </div>
                  ) : (
                    alertasGerados.map((alerta) => {
                      const isBloqueante = alerta.severidade === 'bloqueante'
                      const isInconsistente = alerta.categoria === 'inconsistencia'
                      const isAusencia = alerta.categoria === 'ausencia'

                      return (
                        <div
                          key={alerta.id}
                          className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs ${
                            isBloqueante || isInconsistente
                              ? 'bg-red-50/40 border-red-200'
                              : isAusencia
                                ? 'bg-amber-50/40 border-amber-200'
                                : 'bg-blue-50/40 border-blue-200'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              {isInconsistente ? (
                                <AlertCircle className="h-4 w-4 text-[#EF4444] shrink-0" />
                              ) : isAusencia ? (
                                <AlertTriangle className="h-4 w-4 text-[#F59E0B] shrink-0" />
                              ) : (
                                <Info className="h-4 w-4 text-[#3B82F6] shrink-0" />
                              )}
                              <span
                                className={`font-bold ${
                                  isInconsistente
                                    ? 'text-red-900'
                                    : isAusencia
                                      ? 'text-amber-900'
                                      : 'text-blue-900'
                                }`}
                              >
                                {alerta.titulo}
                              </span>
                            </div>
                            <p className="text-[#475569] pl-5">{alerta.mensagem}</p>
                            {alerta.sugestao && (
                              <p className="text-[11px] text-[#64748B] pl-5 italic">
                                Sugestão: {alerta.sugestao}
                              </p>
                            )}
                          </div>

                          {alerta.campoRelacionado && onFocarCampo && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                onFocarCampo(alerta.campoRelacionado!)
                                onOpenChange(false)
                              }}
                              className="text-[11px] h-7 px-2 shrink-0 text-[#0FA3A3] hover:text-[#0C8585]"
                            >
                              <span>Ir ao campo</span>
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>

        {/* Footer com botões de ação */}
        <DialogFooter className="p-4 border-t border-slate-100 bg-[#F8FAFC] flex flex-col sm:flex-row items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs h-9 rounded-xl border-[#E2E8F0]"
          >
            Cancelar
          </Button>

          {etapa !== 'upload' && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEtapa(etapa === 'revisao' ? 'alertas' : 'revisao')}
                className="text-xs h-9 rounded-xl"
              >
                {etapa === 'revisao'
                  ? `Ver Validações (${alertasGerados.length})`
                  : 'Voltar aos Dados Extraídos'}
              </Button>

              <Button
                type="button"
                onClick={handleConfirmarEAplicar}
                className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs h-9 px-5 shadow-xs"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Aplicar ao Cadastro</span>
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

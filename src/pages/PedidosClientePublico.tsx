import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { RumoLogo } from '@/components/RumoLogo'
import {
  ShieldCheck,
  ShieldAlert,
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Paperclip,
  Check,
  RefreshCw,
  Calendar,
  ExternalLink,
  ChevronRight,
  Info,
  CreditCard,
  Landmark,
  Smartphone,
  BadgePercent,
  CheckCircle,
  HelpCircle,
  AlertCircle,
  FileCheck,
} from 'lucide-react'
import {
  pedidosDocumentosService,
  TIPOS_DOCUMENTOS_FIXOS,
} from '@/services/pedidosDocumentosService'
import type { PedidoDocumentoRecord, ItemStatusPedidoDocumento } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { maskCnpj } from '@/lib/formatters'

export default function PedidosClientePublicoPage() {
  const { token } = useParams<{ token: string }>()
  const [searchParams] = useSearchParams()
  const tokenQuery = searchParams.get('token')
  const tokenFinal = token || tokenQuery || ''

  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [pedido, setPedido] = useState<PedidoDocumentoRecord | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null)
  const [observacaoPorItem, setObservacaoPorItem] = useState<Record<string, string>>({})

  const carregarPedido = async () => {
    if (!tokenFinal) {
      setErrorMsg('Token de acesso não informado no link.')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setErrorMsg('')
      const data = await pedidosDocumentosService.getPedido(tokenFinal)

      if (!data) {
        setErrorMsg('Solicitação de documentos não encontrada ou código expirado.')
        return
      }

      if (data.status === 'cancelado') {
        setErrorMsg('Esta solicitação de documentos foi cancelada pelo escritório contábil.')
        return
      }

      if (data.link_expira_em) {
        const expDate = new Date(data.link_expira_em)
        if (expDate.getTime() < Date.now()) {
          setErrorMsg(
            'O prazo de envio deste link de solicitação expirou. Entre em contato com seu contador.',
          )
          return
        }
      }

      setPedido(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao buscar solicitação.'
      setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarPedido()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenFinal])

  // Upload do arquivo pelo cliente
  const handleUploadArquivo = async (item: ItemStatusPedidoDocumento, file: File) => {
    if (!pedido) return

    // Validações básicas de formato (PDF, OFX, JPG, PNG, DOCX, XLSX, CSV, ZIP)
    const extensoesValidas = [
      'pdf',
      'ofx',
      'jpg',
      'jpeg',
      'png',
      'doc',
      'docx',
      'xls',
      'xlsx',
      'csv',
      'txt',
      'zip',
    ]
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (!extensoesValidas.includes(ext)) {
      toast({
        variant: 'destructive',
        title: 'Formato não suportado',
        description:
          'Por favor envie arquivos em formato PDF, OFX, Excel/CSV, Word ou Imagem (JPG/PNG).',
      })
      return
    }

    // Limite de 30MB
    if (file.size > 30 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Arquivo muito grande',
        description: 'O tamanho limite do arquivo é de 30 MB.',
      })
      return
    }

    try {
      setUploadingItemId(item.id)
      const obs = observacaoPorItem[item.id] || ''
      const res = await pedidosDocumentosService.uploadArquivoClientePublico({
        pedido,
        itemId: item.id,
        file,
        observacoes: obs,
      })

      setPedido(res.pedido)
      toast({
        title: 'Arquivo enviado com sucesso!',
        description: `O documento "${file.name}" foi anexado com sucesso e arquivado no GED da sua empresa.`,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao enviar arquivo.'
      toast({
        variant: 'destructive',
        title: 'Erro no envio',
        description: msg,
      })
    } finally {
      setUploadingItemId(null)
    }
  }

  // Ícone representativo por tipo
  const getIconeTipo = (tipo: string) => {
    switch (tipo) {
      case 'extratos':
        return <Landmark className="h-5 w-5 text-[#0FA3A3]" />
      case 'cartoes':
        return <CreditCard className="h-5 w-5 text-indigo-500" />
      case 'maquininhas':
        return <Smartphone className="h-5 w-5 text-emerald-500" />
      case 'credito':
        return <BadgePercent className="h-5 w-5 text-amber-500" />
      default:
        return <FileText className="h-5 w-5 text-[#0FA3A3]" />
    }
  }

  // Estatísticas de progresso
  const itens = pedido?.itens_status || []
  const totalItens = itens.length
  const recebidosCount = itens.filter((i) => i.status === 'recebido').length
  const pendentesCount = itens.filter((i) => i.status === 'solicitado').length
  const percConcluido = totalItens > 0 ? Math.round((recebidosCount / totalItens) * 100) : 0
  const is100Concluido = totalItens > 0 && recebidosCount === totalItens

  const empresa = pedido?.expand?.empresa
  const razaoSocial = empresa?.razao_social || 'Empresa Cliente'
  const cnpjFormatado = empresa?.cnpj ? maskCnpj(empresa.cnpj) : ''

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-[#1A2333] flex flex-col justify-between">
      {/* Topbar Público Seguro */}
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#E2E8F0] bg-white px-4 md:px-8 shadow-2xs">
        <div className="flex items-center gap-3">
          <RumoLogo
            size={38}
            variant="light"
            title="Portal de Envio de Documentos"
            subtitle="Rumo Consultoria Contábil • Transmissão Segura"
          />
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-[11px] font-medium border-teal-200 text-teal-800 bg-teal-50 gap-1.5"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-[#0FA3A3]" />
            <span className="hidden sm:inline">Ambiente Criptografado & Seguro</span>
            <span className="sm:hidden">Seguro</span>
          </Badge>
        </div>
      </header>

      {/* Conteúdo Central */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <RefreshCw className="h-8 w-8 animate-spin text-[#0FA3A3]" />
            <p className="text-xs text-[#64748B]">Carregando solicitação de documentos...</p>
          </div>
        ) : errorMsg ? (
          /* Erro ou Link Expirado */
          <Card className="rounded-2xl border-rose-200 bg-white shadow-2xs max-w-xl mx-auto mt-8">
            <CardContent className="p-8 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#1A2333]">Link Indisponível</h3>
                <p className="text-xs text-[#64748B] leading-relaxed">{errorMsg}</p>
              </div>
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                  className="text-xs"
                >
                  Tentar novamente
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : pedido ? (
          <div className="space-y-6">
            {/* Cabeçalho da Empresa & Competência */}
            <Card className="rounded-2xl border-slate-200 bg-white shadow-2xs overflow-hidden">
              <div className="h-2 bg-[#0FA3A3]" />
              <CardContent className="p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-[#0FA3A3] uppercase tracking-wider">
                        Fechamento Contábil & Fiscal
                      </span>
                      <Badge className="bg-slate-100 text-slate-700 text-[11px] font-mono border-slate-200">
                        Comp. {pedido.competencia}
                      </Badge>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-[#1A2333] flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-[#0FA3A3]" />
                      {razaoSocial}
                    </h1>
                    {cnpjFormatado && (
                      <p className="text-xs text-[#64748B] font-mono">CNPJ: {cnpjFormatado}</p>
                    )}
                  </div>

                  {pedido.link_expira_em && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 sm:self-start">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        Prazo de envio até:{' '}
                        <strong>
                          {new Date(pedido.link_expira_em).toLocaleDateString('pt-BR')}
                        </strong>
                      </span>
                    </div>
                  )}
                </div>

                {pedido.observacoes && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700">
                    <strong className="text-[#1A2333]">Instruções da Contabilidade:</strong>{' '}
                    {pedido.observacoes}
                  </div>
                )}

                {/* Barra de Progresso Geral */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#64748B]">
                      Progresso de envio dos documentos:
                    </span>
                    <span className="font-bold text-[#1A2333]">
                      {recebidosCount} de {totalItens} anexados ({percConcluido}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        is100Concluido
                          ? 'bg-emerald-500'
                          : percConcluido > 0
                            ? 'bg-teal-500'
                            : 'bg-amber-400'
                      }`}
                      style={{ width: `${percConcluido}%` }}
                    />
                  </div>
                </div>

                {is100Concluido && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-emerald-800 text-xs">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>
                      <strong>Excelente!</strong> Todos os documentos solicitados para este mês
                      foram recebidos. O escritório contábil já foi notificado e dará andamento ao
                      fechamento.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lista dos Documentos Solicitados para Upload */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#1A2333] uppercase tracking-wider flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#0FA3A3]" />
                  Documentos Solicitados ({totalItens})
                </h2>
                <span className="text-xs text-[#64748B]">
                  Envie cada arquivo no seu respectivo item
                </span>
              </div>

              <div className="space-y-3">
                {itens.map((item, idx) => {
                  const isRecebido = item.status === 'recebido'
                  const isUploading = uploadingItemId === item.id
                  const fileInputId = `upload-file-${item.id}`

                  return (
                    <Card
                      key={item.id}
                      className={`rounded-2xl transition-all border ${
                        isRecebido
                          ? 'bg-emerald-50/30 border-emerald-200 shadow-2xs'
                          : 'bg-white border-slate-200 shadow-xs hover:border-teal-300'
                      }`}
                    >
                      <CardContent className="p-4 sm:p-5">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          {/* Ícone e Detalhes */}
                          <div className="flex items-start gap-3">
                            <div
                              className={`p-2.5 rounded-xl shrink-0 ${
                                isRecebido
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {getIconeTipo(item.tipo)}
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-[#1A2333]">
                                  {idx + 1}. {item.detalhe}
                                </span>
                                {isRecebido ? (
                                  <Badge className="bg-emerald-100 text-emerald-800 text-[10px] gap-1 font-semibold">
                                    <Check className="h-3 w-3" /> Recebido
                                  </Badge>
                                ) : (
                                  <Badge className="bg-amber-100 text-amber-800 text-[10px] gap-1 font-semibold">
                                    <Clock className="h-3 w-3" /> Aguardando envio
                                  </Badge>
                                )}
                              </div>

                              {/* Descrição orientativa */}
                              <p className="text-[11px] text-[#64748B] leading-relaxed">
                                {item.tipo === 'extratos' &&
                                  'Envie o extrato em formato PDF ou OFX exportado pelo seu internet banking.'}
                                {item.tipo === 'cartoes' &&
                                  'Envie a fatura consolidada e detalhada com todos os lançamentos do período.'}
                                {item.tipo === 'maquininhas' &&
                                  'Relatório de vendas, fechamento de lote ou extrato de liquidação da adquirente.'}
                                {item.tipo === 'credito' &&
                                  'Contrato assinado, cédula de crédito (CCB) ou cronograma de parcelas.'}
                              </p>

                              {isRecebido && (
                                <div className="text-[11px] font-mono text-emerald-700 flex items-center gap-1.5 pt-1">
                                  <Paperclip className="h-3 w-3" />
                                  <span>
                                    Arquivo anexado: {item.nome_arquivo || 'documento.pdf'}
                                  </span>
                                  {item.recebido_em && (
                                    <span className="text-[10px] text-slate-400">
                                      ({new Date(item.recebido_em).toLocaleString('pt-BR')})
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Ação de Upload */}
                          <div className="shrink-0 self-end sm:self-center">
                            <input
                              type="file"
                              id={fileInputId}
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0]
                                if (f) handleUploadArquivo(item, f)
                              }}
                              disabled={isUploading}
                            />

                            <Button
                              size="sm"
                              onClick={() => document.getElementById(fileInputId)?.click()}
                              disabled={isUploading}
                              variant={isRecebido ? 'outline' : 'default'}
                              className={`h-9 text-xs gap-1.5 ${
                                isRecebido
                                  ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                                  : 'bg-[#0FA3A3] hover:bg-[#0d8c8c] text-white shadow-xs'
                              }`}
                            >
                              {isUploading ? (
                                <>
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                  <span>Enviando...</span>
                                </>
                              ) : isRecebido ? (
                                <>
                                  <Upload className="h-3.5 w-3.5" />
                                  <span>Substituir Arquivo</span>
                                </>
                              ) : (
                                <>
                                  <Upload className="h-3.5 w-3.5" />
                                  <span>Anexar Arquivo</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Campo opcional de observação para itens ainda não enviados */}
                        {!isRecebido && (
                          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                            <input
                              type="text"
                              value={observacaoPorItem[item.id] || ''}
                              onChange={(e) =>
                                setObservacaoPorItem((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              placeholder="Observação para este documento (opcional, ex: 'Conta poupança sem movimentação')..."
                              className="h-8 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 flex-1 focus:bg-white transition-colors"
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>

            {/* Ajuda & Instruções de Segurança */}
            <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-2xs">
              <div className="flex items-start gap-3 text-xs text-[#64748B]">
                <Info className="h-4 w-4 text-[#0FA3A3] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-[#1A2333]">
                    Como funciona a entrega dos documentos?
                  </p>
                  <p className="leading-relaxed">
                    Os arquivos anexados nesta página são inseridos instantaneamente no GED (Gestão
                    Eletrônica de Documentos) do escritório contábil na pasta correta da sua
                    empresa. Não é necessário criar senha ou efetuar login.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        ) : null}
      </main>

      {/* Footer Público */}
      <footer className="border-t border-[#E2E8F0] bg-white py-4 px-6 text-center text-xs text-[#94A3B8]">
        <p>© {new Date().getFullYear()} Rumo Consultoria Contábil • Plataforma Contábil SaaS</p>
      </footer>
    </div>
  )
}

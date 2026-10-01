import { useState, useEffect, useMemo } from 'react'
import {
  FileText,
  Plus,
  Send,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  Clock,
  CheckCircle2,
  FileCheck,
  Building,
  Calendar,
  SlidersHorizontal,
  ExternalLink,
  Loader2,
  Share2,
  Trash2,
  XCircle,
  Landmark,
  CreditCard,
  Smartphone,
  BadgePercent,
  Search,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import {
  pedidosDocumentosService,
  TIPOS_DOCUMENTOS_FIXOS,
} from '@/services/pedidosDocumentosService'
import type { Empresa, PedidoDocumentoRecord, ItemStatusPedidoDocumento, Documento } from '@/types'

interface PedidosDocumentosTabProps {
  empresas: Empresa[]
  tenantId: string
  canEdit: boolean
}

export function PedidosDocumentosTab({ empresas, tenantId, canEdit }: PedidosDocumentosTabProps) {
  const { user } = useAuth()
  const { toast } = useToast()

  const [pedidos, setPedidos] = useState<PedidoDocumentoRecord[]>([])
  const [loading, setLoading] = useState(false)

  // Filtros
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('todas')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroCompetencia, setFiltroCompetencia] = useState<string>('todas')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')

  // Modal Novo Pedido
  const [modalNovoAberto, setModalNovoAberto] = useState(false)
  const [salvandoPedido, setSalvandoPedido] = useState(false)
  const [empresaNovo, setEmpresaNovo] = useState<string>('')
  const [competenciaNovo, setCompetenciaNovo] = useState<string>('')
  const [diasExpiraNovo, setDiasExpiraNovo] = useState<number>(15)
  const [observacoesNovo, setObservacoesNovo] = useState<string>('')

  // 4 Tipos fixos de documento
  const [tipoExtratos, setTipoExtratos] = useState(true)
  const [tipoCartoes, setTipoCartoes] = useState(true)
  const [tipoMaquininhas, setTipoMaquininhas] = useState(false)
  const [tipoCredito, setTipoCredito] = useState(false)

  // Seletores dinâmicos de contas/maquininhas
  const [contasBancariasEmpresa, setContasBancariasEmpresa] = useState<any[]>([])
  const [contasSelecionadas, setContasSelecionadas] = useState<Record<string, boolean>>({})
  const [plataformaLivre, setPlataformaLivre] = useState<string>('')

  // Modal Link Gerado
  const [modalLinkAberto, setModalLinkAberto] = useState(false)
  const [ultimoPedidoCriado, setUltimoPedidoCriado] = useState<PedidoDocumentoRecord | null>(null)
  const [linkCopiado, setLinkCopiado] = useState(false)

  // Disparo WhatsApp
  const [disparandoWaId, setDisparandoWaId] = useState<string | null>(null)

  // Modal Baixa Manual
  const [modalBaixaAberto, setModalBaixaAberto] = useState(false)
  const [pedidoSelecionadoBaixa, setPedidoSelecionadoBaixa] =
    useState<PedidoDocumentoRecord | null>(null)
  const [itemSelecionadoBaixa, setItemSelecionadoBaixa] =
    useState<ItemStatusPedidoDocumento | null>(null)
  const [docsGedDisponiveis, setDocsGedDisponiveis] = useState<Documento[]>([])
  const [docGedSelecionadoId, setDocGedSelecionadoId] = useState<string>('')
  const [nomeArquivoManual, setNomeArquivoManual] = useState<string>('')
  const [baixandoItem, setBaixandoItem] = useState(false)

  // Modal Cancelar / Excluir Pedido
  const [modalExcluirAberto, setModalExcluirAberto] = useState(false)
  const [pedidoParaExcluir, setPedidoParaExcluir] = useState<PedidoDocumentoRecord | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  // Competência padrão (MM/AAAA do mês anterior)
  useEffect(() => {
    const hoje = new Date()
    hoje.setMonth(hoje.getMonth() - 1)
    const mm = String(hoje.getMonth() + 1).padStart(2, '0')
    const aaaa = hoje.getFullYear()
    setCompetenciaNovo(`${mm}/${aaaa}`)
  }, [])

  const carregarPedidos = async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const records = await pedidosDocumentosService.listarPedidos({
        tenantId,
        empresaId: filtroEmpresa,
        status: filtroStatus,
        competencia: filtroCompetencia,
        tipo: filtroTipo,
      })
      setPedidos(records)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarPedidos()
  }, [tenantId, filtroEmpresa, filtroStatus, filtroCompetencia, filtroTipo])

  // Contas bancárias para a empresa selecionada no form de novo pedido
  useEffect(() => {
    if (!empresaNovo || !tenantId) {
      setContasBancariasEmpresa([])
      setContasSelecionadas({})
      return
    }
    const loadContas = async () => {
      const contas = await pedidosDocumentosService.listarContasBancarias(tenantId, empresaNovo)
      setContasBancariasEmpresa(contas)
      const map: Record<string, boolean> = {}
      contas.forEach((c: any) => {
        map[c.id] = true
      })
      setContasSelecionadas(map)
    }
    loadContas()
  }, [empresaNovo, tenantId])

  // Lista única de competências presentes para o seletor de filtro
  const competenciasDisponiveis = useMemo(() => {
    const set = new Set<string>()
    pedidos.forEach((p) => {
      if (p.competencia) set.add(p.competencia)
    })
    return Array.from(set).sort().reverse()
  }, [pedidos])

  const handleCriarPedido = async () => {
    if (!empresaNovo) {
      toast({
        title: 'Selecione a empresa',
        description: 'Informe qual empresa da carteira receberá a solicitação.',
        variant: 'destructive',
      })
      return
    }
    if (!competenciaNovo || !/^\d{2}\/\d{4}$/.test(competenciaNovo)) {
      toast({
        title: 'Competência inválida',
        description: 'Informe a competência no formato MM/AAAA (ex: 04/2026).',
        variant: 'destructive',
      })
      return
    }

    const tipos: string[] = []
    const itens: Array<{
      tipo: 'extratos' | 'cartoes' | 'maquininhas' | 'credito'
      detalhe: string
      banco_conta_id?: string
      plataforma?: string
    }> = []

    if (tipoExtratos) {
      tipos.push('extratos')
      const contasAtivas = contasBancariasEmpresa.filter((c) => contasSelecionadas[c.id])
      if (contasAtivas.length > 0) {
        contasAtivas.forEach((c) => {
          itens.push({
            tipo: 'extratos',
            detalhe: `Extratos Bancários: (em PDF e OFX) - Banco ${c.banco} (Ag: ${c.agencia} / Conta: ${c.conta})`,
            banco_conta_id: c.id,
          })
        })
      } else {
        itens.push({
          tipo: 'extratos',
          detalhe: 'Extratos Bancários: (em PDF e OFX) de todas as contas da empresa',
        })
      }
    }

    if (tipoCartoes) {
      tipos.push('cartoes')
      itens.push({
        tipo: 'cartoes',
        detalhe: 'Cartões de Crédito: Faturas completas do cartão da empresa',
      })
    }

    if (tipoMaquininhas) {
      tipos.push('maquininhas')
      const detalhePlat = plataformaLivre.trim()
        ? `Maquininhas e Apps: Relatórios de vendas e extratos de plataformas (${plataformaLivre.trim()})`
        : 'Maquininhas e Apps: Relatórios de vendas e extratos de plataformas (ex: Mercado Pago)'
      itens.push({
        tipo: 'maquininhas',
        detalhe: detalhePlat,
        plataforma: plataformaLivre.trim() || undefined,
      })
    }

    if (tipoCredito) {
      tipos.push('credito')
      itens.push({
        tipo: 'credito',
        detalhe: 'Crédito: Contratos de novos empréstimos ou financiamentos',
      })
    }

    if (itens.length === 0) {
      toast({
        title: 'Nenhum documento selecionado',
        description: 'Selecione ao menos um dos 4 tipos de documentos para criar a solicitação.',
        variant: 'destructive',
      })
      return
    }

    setSalvandoPedido(true)
    try {
      const novo = await pedidosDocumentosService.criarPedido(
        {
          tenant_id: tenantId,
          empresa: empresaNovo,
          competencia: competenciaNovo,
          tipos_solicitados: tipos,
          itens,
          dias_expiracao: diasExpiraNovo,
          observacoes: observacoesNovo.trim() || undefined,
        },
        user?.id || '',
      )

      toast({
        title: 'Pedido de documentos gerado!',
        description: `Link público exclusivo gerado para a competência ${competenciaNovo}.`,
      })

      setUltimoPedidoCriado(novo)
      setModalNovoAberto(false)
      setModalLinkAberto(true)
      carregarPedidos()
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      toast({
        title: 'Erro ao gerar pedido',
        description: errMsg,
        variant: 'destructive',
      })
    } finally {
      setSalvandoPedido(false)
    }
  }

  const handleCopiarLink = (token: string) => {
    const url = `${window.location.origin}/pedidos-documentos/${token}`
    navigator.clipboard.writeText(url)
    setLinkCopiado(true)
    setTimeout(() => setLinkCopiado(false), 2000)
    toast({
      title: 'Link copiado!',
      description:
        'O link público seguro para upload de documentos foi copiado para sua área de transferência.',
    })
  }

  const handleEnviarOuCobrarWhatsApp = async (
    pedido: PedidoDocumentoRecord,
    isCobranca = false,
  ) => {
    setDisparandoWaId(pedido.id)
    try {
      const resp = await pedidosDocumentosService.enviarWhatsApp({
        pedidoId: pedido.id,
        tenantId,
        userId: user?.id || '',
        isCobranca,
      })

      if (resp.avisoFlood) {
        toast({
          title: 'Aviso Anti-flood (24h)',
          description: resp.avisoFlood,
        })
      }

      if (resp.statusEnvio === 'enviado') {
        toast({
          title: isCobranca ? 'Lembrete enviado com sucesso!' : 'Solicitação enviada!',
          description: 'A notificação foi entregue ao WhatsApp do cliente.',
        })
      } else if (resp.statusEnvio === 'aguardando_credenciais') {
        toast({
          title: 'Modo Supervisão (Sem credencial WhatsApp)',
          description:
            'A mensagem foi registrada na fila com status "aguardando_credenciais". Configure a Evolution API para envio real.',
        })
      } else {
        toast({
          title: 'Resultado do envio',
          description: resp.mensagem,
        })
      }

      carregarPedidos()
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      toast({
        title: 'Erro no disparo WhatsApp',
        description: errMsg,
        variant: 'destructive',
      })
    } finally {
      setDisparandoWaId(null)
    }
  }

  const handleAbrirBaixaManual = async (
    pedido: PedidoDocumentoRecord,
    item: ItemStatusPedidoDocumento,
  ) => {
    setPedidoSelecionadoBaixa(pedido)
    setItemSelecionadoBaixa(item)
    setDocGedSelecionadoId('')
    setNomeArquivoManual('')
    setModalBaixaAberto(true)

    const docs = await pedidosDocumentosService.listarDocumentosGed(tenantId, pedido.empresa)
    setDocsGedDisponiveis(docs)
  }

  const handleConfirmarBaixaManual = async () => {
    if (!pedidoSelecionadoBaixa || !itemSelecionadoBaixa) return
    setBaixandoItem(true)
    try {
      await pedidosDocumentosService.marcarComoRecebido({
        pedido_id: pedidoSelecionadoBaixa.id,
        item_id: itemSelecionadoBaixa.id,
        documento_ged_id: docGedSelecionadoId || undefined,
        nome_arquivo: nomeArquivoManual.trim() || undefined,
        tenant_id: tenantId,
        userId: user?.id || '',
      })

      toast({
        title: 'Item marcado como recebido!',
        description: 'Status atualizado com sucesso e vinculado à trilha contábil do GED.',
      })

      setModalBaixaAberto(false)
      carregarPedidos()
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      toast({
        title: 'Erro ao baixar documento',
        description: errMsg,
        variant: 'destructive',
      })
    } finally {
      setBaixandoItem(false)
    }
  }

  const handleConfirmarExclusaoOuCancelamento = async (modo: 'cancelar' | 'excluir') => {
    if (!pedidoParaExcluir) return
    setExcluindo(true)
    try {
      if (modo === 'cancelar') {
        await pedidosDocumentosService.cancelarPedido(
          pedidoParaExcluir.id,
          tenantId,
          user?.id || '',
        )
        toast({
          title: 'Pedido cancelado',
          description: 'A solicitação foi marcada como cancelada.',
        })
      } else {
        await pedidosDocumentosService.excluirPedido(pedidoParaExcluir.id, tenantId, user?.id || '')
        toast({
          title: 'Pedido excluído',
          description: 'A solicitação foi removida permanentemente.',
        })
      }
      setModalExcluirAberto(false)
      setPedidoParaExcluir(null)
      carregarPedidos()
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      toast({
        title: 'Erro ao processar',
        description: errMsg,
        variant: 'destructive',
      })
    } finally {
      setExcluindo(false)
    }
  }

  // Métricas do painel resumo
  const agoraMs = Date.now()
  const totalPedidos = pedidos.length

  // Abertos: status pendente ou parcialmente_atendido
  const pedidosAbertos = pedidos.filter(
    (p) => p.status === 'pendente' || p.status === 'parcialmente_atendido',
  )
  const totalAbertos = pedidosAbertos.length

  // Recebidos no prazo: atendidos com link_expira_em >= updated ou sem expiração
  const recebidosNoPrazo = pedidos.filter((p) => {
    if (p.status !== 'atendido') return false
    if (!p.link_expira_em) return true
    const expMs = new Date(p.link_expira_em).getTime()
    const updMs = new Date(p.updated).getTime()
    return updMs <= expMs
  }).length

  // Atrasados: abertos e link_expira_em < agora
  const pedidosAtrasados = pedidos.filter((p) => {
    if (p.status === 'atendido' || p.status === 'cancelado') return false
    if (!p.link_expira_em) return false
    return new Date(p.link_expira_em).getTime() < agoraMs
  })
  const totalAtrasados = pedidosAtrasados.length

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Banner Superior & Ações */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#1A2333]">
              Pedidos de Documentos Mensais (Clientes)
            </h2>
            <Badge className="bg-[#0FA3A3] text-white text-[10px]">Motor Contábil & GED</Badge>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Solicite extratos, faturas de cartão, maquininhas e contratos de crédito aos clientes
            via link público seguro e WhatsApp com baixa automática no GED da empresa.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarPedidos}
            disabled={loading}
            className="text-xs h-9 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            size="sm"
            onClick={() => setModalNovoAberto(true)}
            disabled={!canEdit}
            className="bg-[#0FA3A3] hover:bg-[#0d8c8c] text-white text-xs h-9 gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Novo Pedido de Documentos
          </Button>
        </div>
      </div>

      {/* Painel Resumo: 4 Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total */}
        <Card className="rounded-2xl border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
              Total de Pedidos
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-[#1A2333]">
              <FileText className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1A2333]">{totalPedidos}</div>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">Competências gerenciadas</p>
          </CardContent>
        </Card>

        {/* Abertos / Pendentes */}
        <Card className="rounded-2xl border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
              Pedidos Abertos
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{totalAbertos}</div>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">Aguardando envio pelo cliente</p>
          </CardContent>
        </Card>

        {/* Recebidos no Prazo */}
        <Card className="rounded-2xl border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
              Recebidos no Prazo
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{recebidosNoPrazo}</div>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">Concluídos dentro do vencimento</p>
          </CardContent>
        </Card>

        {/* Atrasados */}
        <Card className="rounded-2xl border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
              Pedidos Atrasados
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">{totalAtrasados}</div>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">Prazo expirado com pendência</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros da Listagem (Empresa, Tipo, Status, Competência) */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Filtro Empresa */}
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-[#64748B]">Empresa:</span>
            <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
              <SelectTrigger className="w-52 h-8 text-xs bg-slate-50">
                <SelectValue placeholder="Todas as empresas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas" className="text-xs">
                  Todas as Empresas
                </SelectItem>
                {empresas.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id} className="text-xs">
                    {emp.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro Tipo de Documento */}
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-[#64748B]">Tipo Solicitado:</span>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-48 h-8 text-xs bg-slate-50">
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">
                  Todos os Tipos
                </SelectItem>
                <SelectItem value="extratos" className="text-xs">
                  Extratos Bancários
                </SelectItem>
                <SelectItem value="cartoes" className="text-xs">
                  Cartões de Crédito
                </SelectItem>
                <SelectItem value="maquininhas" className="text-xs">
                  Maquininhas e Apps
                </SelectItem>
                <SelectItem value="credito" className="text-xs">
                  Crédito / Financiamento
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro Status */}
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-[#64748B]">Status:</span>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-40 h-8 text-xs bg-slate-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">
                  Todos os Status
                </SelectItem>
                <SelectItem value="pendente" className="text-xs">
                  Pendente
                </SelectItem>
                <SelectItem value="parcialmente_atendido" className="text-xs">
                  Parcialmente Atendido
                </SelectItem>
                <SelectItem value="atendido" className="text-xs">
                  Atendido (100%)
                </SelectItem>
                <SelectItem value="cancelado" className="text-xs">
                  Cancelado
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro Competência */}
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-[#64748B]">Competência:</span>
            <Select value={filtroCompetencia} onValueChange={setFiltroCompetencia}>
              <SelectTrigger className="w-36 h-8 text-xs bg-slate-50 font-mono">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas" className="text-xs font-mono">
                  Todas
                </SelectItem>
                {competenciasDisponiveis.map((comp) => (
                  <SelectItem key={comp} value={comp} className="text-xs font-mono">
                    {comp}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="text-xs text-[#64748B] self-end md:self-center">
          Mostrando <strong>{pedidos.length}</strong> pedido(s)
        </div>
      </div>

      {/* Tabela de Pedidos com Ações Completas */}
      <Card className="rounded-2xl border-slate-200 shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="text-xs font-bold text-[#1A2333] w-64">
                Empresa / Competência
              </TableHead>
              <TableHead className="text-xs font-bold text-[#1A2333]">
                Progresso & Documentos Solicitados
              </TableHead>
              <TableHead className="text-xs font-bold text-[#1A2333] w-36">Status</TableHead>
              <TableHead className="text-xs font-bold text-[#1A2333] w-40">
                Prazo & WhatsApp
              </TableHead>
              <TableHead className="text-xs font-bold text-[#1A2333] text-right w-72">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pedidos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-xs text-[#94A3B8]">
                  {loading
                    ? 'Carregando pedidos de documentos...'
                    : 'Nenhum pedido de documentos encontrado com os filtros selecionados.'}
                </TableCell>
              </TableRow>
            ) : (
              pedidos.map((ped) => {
                const totalItens = (ped.itens_status || []).length
                const itensRecebidos = (ped.itens_status || []).filter(
                  (i) => i.status === 'recebido',
                ).length
                const itensPendentes = (ped.itens_status || []).filter(
                  (i) => i.status === 'solicitado',
                ).length
                const perc = totalItens > 0 ? Math.round((itensRecebidos / totalItens) * 100) : 0
                const empNome = ped.expand?.empresa?.razao_social || 'Empresa'

                // Status de atraso
                const isAtrasado =
                  ped.status !== 'atendido' &&
                  ped.status !== 'cancelado' &&
                  ped.link_expira_em &&
                  new Date(ped.link_expira_em).getTime() < agoraMs

                return (
                  <TableRow key={ped.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Empresa / Competência */}
                    <TableCell className="align-top py-3.5">
                      <div className="font-semibold text-xs text-[#1A2333] flex items-center gap-1.5">
                        <Building className="h-3.5 w-3.5 text-[#0FA3A3]" />
                        {empNome}
                      </div>
                      <div className="text-[11px] font-mono text-[#64748B] mt-0.5">
                        Competência: <strong className="text-[#1A2333]">{ped.competencia}</strong>
                      </div>
                      <div className="text-[10px] text-[#94A3B8] mt-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Criado em: {new Date(ped.created).toLocaleDateString('pt-BR')}
                      </div>
                      {ped.observacoes && (
                        <div className="text-[10px] text-slate-500 italic mt-1 truncate max-w-xs">
                          Obs: {ped.observacoes}
                        </div>
                      )}
                    </TableCell>

                    {/* Progresso & Itens */}
                    <TableCell className="align-top py-3.5">
                      <div className="space-y-2">
                        {/* Barra de progresso */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                            <div
                              className={`h-full rounded-full transition-all ${
                                perc === 100
                                  ? 'bg-emerald-500'
                                  : perc > 0
                                    ? 'bg-teal-500'
                                    : 'bg-amber-400'
                              }`}
                              style={{ width: `${perc}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-[#1A2333] shrink-0">
                            {itensRecebidos} de {totalItens} recebidos ({perc}%)
                          </span>
                        </div>

                        {/* Itens detalhados */}
                        <div className="space-y-1">
                          {(ped.itens_status || []).map((it) => (
                            <div
                              key={it.id}
                              className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-50 border border-slate-200/60"
                            >
                              <div className="flex items-center gap-2 truncate pr-2">
                                {it.status === 'recebido' ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                ) : (
                                  <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                )}
                                <span
                                  className={`truncate ${
                                    it.status === 'recebido'
                                      ? 'text-slate-500 line-through'
                                      : 'text-[#1A2333] font-medium'
                                  }`}
                                  title={it.detalhe}
                                >
                                  {it.detalhe}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {it.status === 'recebido' ? (
                                  <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">
                                    Recebido {it.nome_arquivo ? `(${it.nome_arquivo})` : ''}
                                  </Badge>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleAbrirBaixaManual(ped, it)}
                                    disabled={!canEdit}
                                    className="h-6 text-[10px] px-2 text-[#0FA3A3] hover:text-[#0b7878] hover:bg-teal-50"
                                  >
                                    <FileCheck className="h-3 w-3 mr-1" />
                                    Marcar recebido
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TableCell>

                    {/* Status do Pedido com Badges */}
                    <TableCell className="align-top py-3.5">
                      <div className="space-y-1">
                        {ped.status === 'atendido' ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold text-[11px]">
                            Recebido (100%)
                          </Badge>
                        ) : ped.status === 'cancelado' ? (
                          <Badge className="bg-slate-100 text-slate-700 border-slate-200 font-semibold text-[11px]">
                            Cancelado
                          </Badge>
                        ) : ped.status === 'parcialmente_atendido' ? (
                          <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-semibold text-[11px]">
                            Parcial
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-50 text-amber-700 border-amber-200 font-semibold text-[11px]">
                            Aguardando
                          </Badge>
                        )}

                        {isAtrasado && (
                          <div>
                            <Badge className="bg-rose-50 text-rose-700 border-rose-200 font-bold text-[10px]">
                              Atrasado / Vencido
                            </Badge>
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Prazo & WhatsApp */}
                    <TableCell className="align-top py-3.5 text-xs text-[#64748B]">
                      <div className="space-y-1">
                        {ped.link_expira_em && (
                          <div
                            className={`text-[11px] font-medium flex items-center gap-1 ${
                              isAtrasado ? 'text-rose-600 font-bold' : 'text-slate-700'
                            }`}
                          >
                            <Clock className="h-3 w-3 shrink-0" />
                            Prazo: {new Date(ped.link_expira_em).toLocaleDateString('pt-BR')}
                          </div>
                        )}

                        <div className="text-[10px] text-[#94A3B8]">
                          {ped.ultimo_envio_whatsapp_em ? (
                            <span>
                              Disparado em:{' '}
                              {new Date(ped.ultimo_envio_whatsapp_em).toLocaleDateString('pt-BR')}
                            </span>
                          ) : (
                            <span className="italic">WhatsApp não disparado</span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Ações por Pedido */}
                    <TableCell className="align-top py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Copiar Link */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopiarLink(ped.token_publico)}
                          className="h-8 text-xs gap-1"
                          title="Copiar Link Seguro para o Cliente"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span className="hidden lg:inline">Link</span>
                        </Button>

                        {/* Abrir Link Público do Cliente (Preview) */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            window.open(`/pedidos-documentos/${ped.token_publico}`, '_blank')
                          }
                          className="h-8 w-8 p-0 text-[#64748B] hover:text-[#0FA3A3]"
                          title="Abrir página pública de upload"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>

                        {/* Enviar / Lembrete WhatsApp */}
                        {ped.status !== 'cancelado' && (
                          <Button
                            size="sm"
                            onClick={() =>
                              handleEnviarOuCobrarWhatsApp(ped, !!ped.ultimo_envio_whatsapp_em)
                            }
                            disabled={disparandoWaId === ped.id || !canEdit}
                            className={`h-8 text-xs gap-1.5 text-white ${
                              ped.ultimo_envio_whatsapp_em
                                ? 'bg-amber-600 hover:bg-amber-700'
                                : 'bg-[#0FA3A3] hover:bg-[#0d8c8c]'
                            }`}
                            title={
                              ped.ultimo_envio_whatsapp_em
                                ? 'Enviar Lembrete de Cobrança por WhatsApp'
                                : 'Disparar Pedido por WhatsApp'
                            }
                          >
                            {disparandoWaId === ped.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                            {ped.ultimo_envio_whatsapp_em ? 'Lembrete' : 'WhatsApp'}
                          </Button>
                        )}

                        {/* Cancelar / Excluir */}
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setPedidoParaExcluir(ped)
                              setModalExcluirAberto(true)
                            }}
                            className="h-8 w-8 p-0 text-[#94A3B8] hover:text-rose-600"
                            title="Cancelar ou excluir pedido"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* MODAL 1: NOVO PEDIDO DE DOCUMENTOS COM OS 4 TIPOS LITERAIS */}
      <Dialog open={modalNovoAberto} onOpenChange={setModalNovoAberto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0FA3A3] text-white text-xs font-bold">
                +
              </span>
              <DialogTitle className="text-lg font-bold text-[#1A2333]">
                Novo Pedido de Documentos Mensais
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-[#64748B]">
              Selecione a empresa, a competência e marque quais categorias de documentos são
              exigidas neste fechamento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Empresa e Competência */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-medium text-[#1A2333]">Empresa da Carteira *</Label>
                <Select value={empresaNovo} onValueChange={setEmpresaNovo}>
                  <SelectTrigger className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id} className="text-xs">
                        {emp.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 md:col-span-1">
                <Label className="text-xs font-medium text-[#1A2333]">
                  Competência (MM/AAAA) *
                </Label>
                <Input
                  value={competenciaNovo}
                  onChange={(e) => setCompetenciaNovo(e.target.value)}
                  placeholder="04/2026"
                  className="h-9 text-xs font-mono bg-white"
                />
              </div>
            </div>

            {/* Os 4 Tipos Fixos com Textos Literais do Enunciado */}
            <div className="space-y-3 border-t border-slate-200 pt-3">
              <Label className="text-xs font-bold text-[#1A2333] uppercase tracking-wider">
                Documentos Solicitados para o Fechamento
              </Label>

              {/* TIPO 1: Extratos Bancários */}
              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/60 space-y-2">
                <div className="flex items-start gap-2.5">
                  <Checkbox
                    id="tipo-extratos"
                    checked={tipoExtratos}
                    onCheckedChange={(c) => setTipoExtratos(!!c)}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <label
                      htmlFor="tipo-extratos"
                      className="text-xs font-bold text-[#1A2333] cursor-pointer"
                    >
                      Excerpto / Extratos Bancários: (em PDF e OFX)
                    </label>
                    <p className="text-[11px] text-[#64748B]">
                      Extratos completos das contas correntes e aplicações da empresa no período.
                    </p>
                  </div>
                </div>

                {tipoExtratos && contasBancariasEmpresa.length > 0 && (
                  <div className="pl-6 pt-1 border-t border-slate-200/80 space-y-1.5">
                    <span className="text-[10px] font-bold text-[#64748B] uppercase">
                      Contas bancárias cadastradas da empresa:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {contasBancariasEmpresa.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                        >
                          <Checkbox
                            id={`conta-${c.id}`}
                            checked={!!contasSelecionadas[c.id]}
                            onCheckedChange={(checked) =>
                              setContasSelecionadas((prev) => ({
                                ...prev,
                                [c.id]: !!checked,
                              }))
                            }
                          />
                          <label
                            htmlFor={`conta-${c.id}`}
                            className="text-xs cursor-pointer truncate"
                          >
                            <strong>{c.banco}</strong> (Ag: {c.agencia} / Cc: {c.conta})
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* TIPO 2: Faturas de Cartão de Crédito */}
              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/60">
                <div className="flex items-start gap-2.5">
                  <Checkbox
                    id="tipo-cartoes"
                    checked={tipoCartoes}
                    onCheckedChange={(c) => setTipoCartoes(!!c)}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <label
                      htmlFor="tipo-cartoes"
                      className="text-xs font-bold text-[#1A2333] cursor-pointer"
                    >
                      Faturas de Cartão de Crédito: (faturas completas do cartão da empresa)
                    </label>
                    <p className="text-[11px] text-[#64748B]">
                      Fatura fechada com o detalhamento das despesas corporativas para conciliação.
                    </p>
                  </div>
                </div>
              </div>

              {/* TIPO 3: Maquininhas e Apps */}
              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/60 space-y-2">
                <div className="flex items-start gap-2.5">
                  <Checkbox
                    id="tipo-maquininhas"
                    checked={tipoMaquininhas}
                    onCheckedChange={(c) => setTipoMaquininhas(!!c)}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <label
                      htmlFor="tipo-maquininhas"
                      className="text-xs font-bold text-[#1A2333] cursor-pointer"
                    >
                      Maquininhas e Apps: (relatórios de vendas e extratos de plataformas ex.:
                      Mercado Pago)
                    </label>
                    <p className="text-[11px] text-[#64748B]">
                      Comprovantes de liquidação de adquirentes e intermediações digitais.
                    </p>
                  </div>
                </div>

                {tipoMaquininhas && (
                  <div className="pl-6 pt-1">
                    <Label className="text-[11px] text-[#64748B]">
                      Plataformas / Maquininhas específicas (opcional):
                    </Label>
                    <Input
                      value={plataformaLivre}
                      onChange={(e) => setPlataformaLivre(e.target.value)}
                      placeholder="Ex: Mercado Pago, Stone, Cielo, Hotmart, iFood"
                      className="h-8 text-xs bg-white mt-1"
                    />
                  </div>
                )}
              </div>

              {/* TIPO 4: Crédito */}
              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/60">
                <div className="flex items-start gap-2.5">
                  <Checkbox
                    id="tipo-credito"
                    checked={tipoCredito}
                    onCheckedChange={(c) => setTipoCredito(!!c)}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <label
                      htmlFor="tipo-credito"
                      className="text-xs font-bold text-[#1A2333] cursor-pointer"
                    >
                      Crédito: (contratos de novos empréstimos ou financiamentos)
                    </label>
                    <p className="text-[11px] text-[#64748B]">
                      Contratos de mútuo, empréstimos bancários e financiamentos tomados no mês.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Prazo de entrega e Observações */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-200 pt-3">
              <div className="space-y-1 sm:col-span-1">
                <Label className="text-xs font-medium text-[#1A2333]">
                  Prazo de entrega (dias)
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="90"
                  value={diasExpiraNovo}
                  onChange={(e) => setDiasExpiraNovo(parseInt(e.target.value) || 15)}
                  className="h-8 text-xs bg-white font-mono"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-medium text-[#1A2333]">
                  Observações / Instruções para o cliente (opcional)
                </Label>
                <Input
                  value={observacoesNovo}
                  onChange={(e) => setObservacoesNovo(e.target.value)}
                  placeholder="Ex: Favor exportar faturas em formato PDF analítico..."
                  className="h-8 text-xs bg-white"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalNovoAberto(false)}
              disabled={salvandoPedido}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleCriarPedido}
              disabled={salvandoPedido || !empresaNovo}
              className="bg-[#0FA3A3] hover:bg-[#0d8c8c] text-white text-xs gap-1.5"
            >
              {salvandoPedido ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Gerando Pedido...
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Gerar Pedido & Link Público
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: LINK PÚBLICO GERADO COM SUCESSO */}
      <Dialog open={modalLinkAberto} onOpenChange={setModalLinkAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <DialogTitle className="text-base font-bold text-[#1A2333]">
                Pedido Gerado com Sucesso!
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-[#64748B]">
              O cliente pode enviar os arquivos diretamente através do link público seguro sem
              necessidade de login prévio.
            </DialogDescription>
          </DialogHeader>

          {ultimoPedidoCriado && (
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-[#1A2333]">
                  Link Público Seguro para Upload:
                </Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/pedidos-documentos/${ultimoPedidoCriado.token_publico}`}
                    className="text-xs font-mono bg-slate-50 select-all"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopiarLink(ultimoPedidoCriado.token_publico)}
                    className="shrink-0 h-9 gap-1.5 text-xs"
                  >
                    {linkCopiado ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {linkCopiado ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3 text-xs text-teal-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Share2 className="h-4 w-4 text-[#0FA3A3]" />
                  Disparo Automático via WhatsApp
                </div>
                <p className="text-[11px] leading-relaxed text-teal-800">
                  Você também pode disparar este link diretamente para o WhatsApp do cliente
                  clicando no botão abaixo ou na lista de pedidos. O motor de WhatsApp respeita as
                  autorizações e o Modo Supervisão da empresa.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalLinkAberto(false)}
              className="text-xs"
            >
              Fechar
            </Button>
            {ultimoPedidoCriado && (
              <Button
                size="sm"
                onClick={() => {
                  setModalLinkAberto(false)
                  handleEnviarOuCobrarWhatsApp(ultimoPedidoCriado, false)
                }}
                className="bg-[#0FA3A3] hover:bg-[#0d8c8c] text-white text-xs gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                Disparar WhatsApp Agora
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: BAIXA MANUAL ("Marcar como recebido" com seletor GED) */}
      <Dialog open={modalBaixaAberto} onOpenChange={setModalBaixaAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-[#0FA3A3]" />
              <DialogTitle className="text-base font-bold text-[#1A2333]">
                Baixa Manual de Documento
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-[#64748B]">
              Confirme o recebimento do item e opcionalmente vincule ao arquivo já arquivado no GED.
            </DialogDescription>
          </DialogHeader>

          {itemSelecionadoBaixa && (
            <div className="space-y-3 py-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
                <span className="text-[10px] font-bold text-[#64748B] uppercase">Item:</span>
                <p className="text-xs font-semibold text-[#1A2333]">
                  {itemSelecionadoBaixa.detalhe}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#1A2333]">
                  Vincular a Documento do GED da Empresa (Opcional):
                </Label>
                <Select value={docGedSelecionadoId} onValueChange={setDocGedSelecionadoId}>
                  <SelectTrigger className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Selecione um documento do GED (ou deixe em branco)" />
                  </SelectTrigger>
                  <SelectContent>
                    {docsGedDisponiveis.map((d) => (
                      <SelectItem key={d.id} value={d.id} className="text-xs">
                        {d.nome_arquivo} ({d.tipo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#1A2333]">
                  Nome do arquivo ou anotação (Opcional):
                </Label>
                <Input
                  value={nomeArquivoManual}
                  onChange={(e) => setNomeArquivoManual(e.target.value)}
                  placeholder="Ex: extrato_abril_itau.pdf"
                  className="h-9 text-xs bg-white"
                />
                <p className="text-[11px] text-[#94A3B8]">
                  Se o cliente enviou por outro canal (e-mail ou impresso), você pode confirmar a
                  baixa diretamente.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalBaixaAberto(false)}
              disabled={baixandoItem}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmarBaixaManual}
              disabled={baixandoItem}
              className="bg-[#0FA3A3] hover:bg-[#0d8c8c] text-white text-xs gap-1.5"
            >
              {baixandoItem ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Baixando...
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Confirmar Baixa
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: CANCELAR OU EXCLUIR PEDIDO */}
      <Dialog open={modalExcluirAberto} onOpenChange={setModalExcluirAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle className="text-base font-bold text-[#1A2333]">
                Gerenciar Pedido de Documentos
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-[#64748B]">
              Escolha se deseja apenas cancelar a solicitação (mantendo histórico) ou excluí-la
              permanentemente da plataforma.
            </DialogDescription>
          </DialogHeader>

          {pedidoParaExcluir && (
            <div className="py-2 text-xs text-slate-700 space-y-2">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <strong>Empresa:</strong>{' '}
                  {pedidoParaExcluir.expand?.empresa?.razao_social || 'Empresa'}
                </div>
                <div>
                  <strong>Competência:</strong> {pedidoParaExcluir.competencia}
                </div>
                <div>
                  <strong>Status atual:</strong> {pedidoParaExcluir.status}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 gap-2 flex flex-col sm:flex-row">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalExcluirAberto(false)}
              disabled={excluindo}
              className="text-xs"
            >
              Fechar
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleConfirmarExclusaoOuCancelamento('cancelar')}
              disabled={excluindo}
              className="text-xs"
            >
              Cancelar Pedido
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleConfirmarExclusaoOuCancelamento('excluir')}
              disabled={excluindo}
              className="text-xs gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

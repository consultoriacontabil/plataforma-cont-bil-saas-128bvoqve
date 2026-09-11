import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  FileText,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Send,
  Eye,
  Edit,
  Trash2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Building2,
  DollarSign,
  Calendar,
  Layers,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Repeat,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { empresasService } from '@/services/empresas'
import { assinaturasService } from '@/services/assinaturas'
import { contratosService } from '@/services/contratos'
import { formatDatePtBr } from '@/lib/formatters'
import { ContratoModalView } from '@/components/ContratoModalView'
import { ContratoEditorModal } from '@/components/ContratoEditorModal'
import { SolicitarAssinaturaContratoModal } from '@/components/SolicitarAssinaturaContratoModal'
import { FaturamentoRecorrenteTab } from '@/components/FaturamentoRecorrenteTab'
import type {
  ContratoHonorarioRecord,
  Empresa,
  AssinaturaDemonstrativoRecord,
  TipoContratoHonorario,
  StatusContratoHonorario,
} from '@/types'

export function ContratosPage() {
  const { tenant, user, member } = useAuth()
  const currentRole = member?.perfil
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTab = searchParams.get('tab') || 'contratos'
  const setActiveTab = (tab: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', tab)
      return next
    })
  }

  const [contratos, setContratos] = useState<ContratoHonorarioRecord[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [assinaturas, setAssinaturas] = useState<AssinaturaDemonstrativoRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('todas')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroBusca, setFiltroBusca] = useState<string>('')

  // Modais
  const [selectedContrato, setSelectedContrato] = useState<ContratoHonorarioRecord | null>(null)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [editorModalOpen, setEditorModalOpen] = useState(false)
  const [solicitarModalOpen, setSolicitarModalOpen] = useState(false)

  const isAuxiliar = currentRole === 'auxiliar'
  const isCliente = currentRole === 'cliente'
  const canEdit =
    currentRole === 'administrador' || currentRole === 'contador' || currentRole === 'auxiliar'
  const canSolicitarAssinatura = currentRole === 'administrador' || currentRole === 'contador'

  // Carregar dados
  const loadData = useCallback(async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      const [listContratos, listEmpresas, listAss] = await Promise.all([
        contratosService.list(tenant.id),
        empresasService.list(tenant.id),
        assinaturasService.list(tenant.id, { tipoDocumento: 'contrato_honorarios' }),
      ])
      setContratos(listContratos)
      setEmpresas(listEmpresas)
      setAssinaturas(listAss)
    } catch (err) {
      console.error('Erro ao carregar contratos:', err)
      toast({
        title: 'Erro ao carregar contratos',
        description: 'Não foi possível carregar a lista de propostas e contratos.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filtragem
  const contratosFiltrados = useMemo(() => {
    return contratos.filter((c) => {
      if (filtroEmpresa !== 'todas' && c.empresa !== filtroEmpresa) return false
      if (filtroTipo !== 'todos' && c.tipo !== filtroTipo) return false
      if (filtroStatus !== 'todos' && c.status !== filtroStatus) return false
      if (filtroBusca.trim()) {
        const q = filtroBusca.toLowerCase()
        const matchTitulo = c.titulo.toLowerCase().includes(q)
        const matchEmp =
          c.expand?.empresa?.razao_social?.toLowerCase().includes(q) ||
          c.expand?.empresa?.nome_fantasia?.toLowerCase().includes(q)
        if (!matchTitulo && !matchEmp) return false
      }
      return true
    })
  }, [contratos, filtroEmpresa, filtroTipo, filtroStatus, filtroBusca])

  // Métricas
  const totalContratos = contratos.length
  const totalAssinados = contratos.filter((c) => c.status === 'assinado').length
  const totalAguardando = contratos.filter((c) => c.status === 'enviado').length
  const totalRascunhos = contratos.filter((c) => c.status === 'rascunho').length
  const totalRecusados = contratos.filter((c) => c.status === 'recusado').length

  const valorMensalTotalAssinado = contratos
    .filter((c) => c.status === 'assinado')
    .reduce((acc, c) => acc + (c.valor_mensal || 0), 0)

  // Encontrar assinatura vinculada
  const getAssinaturaForContrato = (contratoId: string) => {
    return assinaturas.find((a) => a.contrato === contratoId)
  }

  // Ações
  const handleOpenNew = () => {
    setSelectedContrato(null)
    setEditorModalOpen(true)
  }

  const handleOpenEdit = (c: ContratoHonorarioRecord) => {
    setSelectedContrato(c)
    setEditorModalOpen(true)
  }

  const handleOpenView = (c: ContratoHonorarioRecord) => {
    setSelectedContrato(c)
    setViewModalOpen(true)
  }

  const handleOpenSolicitar = (c: ContratoHonorarioRecord) => {
    if (!canSolicitarAssinatura) {
      toast({
        title: 'Permissão restrita',
        description: 'Perfil auxiliar não possui permissão para solicitar assinaturas formais.',
        variant: 'destructive',
      })
      return
    }
    setSelectedContrato(c)
    setSolicitarModalOpen(true)
  }

  const handleDelete = async (c: ContratoHonorarioRecord) => {
    if (c.status === 'assinado') {
      toast({
        title: 'Ação não permitida',
        description: 'Contratos já assinados e autenticados com hash não podem ser excluídos.',
        variant: 'destructive',
      })
      return
    }

    if (!confirm(`Deseja realmente excluir "${c.titulo}"?`)) return

    try {
      await contratosService.delete(c.id)
      toast({
        title: 'Documento excluído com sucesso',
      })
      loadData()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao excluir',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#0B1F3A] flex items-center gap-2.5">
            <span>Contratos & Faturamento Recorrente</span>
            <Badge variant="outline" className="text-xs border-[#0FA3A3] text-[#0FA3A3]">
              Honorários Contábeis
            </Badge>
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B]">
            Gestão de contratos, cobrança mensal automatizada, integração com Contas a Receber e
            assinatura digital com verificação SHA-256.
          </p>
        </div>

        {canEdit && activeTab === 'contratos' && (
          <Button
            onClick={handleOpenNew}
            className="rounded-xl text-xs sm:text-sm font-semibold bg-[#0FA3A3] hover:bg-[#0D8B8B] text-white shadow-xs gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Nova Proposta / Contrato</span>
          </Button>
        )}
      </div>

      {/* Navegação por Abas: Contratos vs Faturamento Recorrente */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-xl h-11 border border-slate-200">
          <TabsTrigger
            value="contratos"
            className="rounded-lg text-xs font-semibold px-4 gap-2 data-[state=active]:bg-white data-[state=active]:text-[#0B1F3A] data-[state=active]:shadow-xs"
          >
            <FileText className="h-4 w-4 text-[#0FA3A3]" />
            <span>Contratos de Honorários</span>
            <Badge className="ml-1 bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0 border-0">
              {contratos.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="faturamento"
            className="rounded-lg text-xs font-semibold px-4 gap-2 data-[state=active]:bg-white data-[state=active]:text-[#0B1F3A] data-[state=active]:shadow-xs"
          >
            <Repeat className="h-4 w-4 text-[#0FA3A3]" />
            <span>Faturamento Recorrente</span>
            <Badge className="ml-1 bg-[#0FA3A3]/20 text-[#0FA3A3] text-[10px] px-1.5 py-0 border-0 font-bold">
              Automação
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="faturamento" className="pt-4">
          <FaturamentoRecorrenteTab
            empresas={empresas}
            canManage={canSolicitarAssinatura}
            isAuxiliar={isAuxiliar}
          />
        </TabsContent>

        <TabsContent value="contratos" className="pt-2 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-[#64748B] uppercase">Total Emitidos</p>
                  <p className="text-xl font-black text-[#1A2333]">{totalContratos}</p>
                  <p className="text-[10px] text-[#64748B]">{totalRascunhos} em rascunho</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-[#64748B] uppercase">
                    Aguardando Assinatura
                  </p>
                  <p className="text-xl font-black text-[#1A2333]">{totalAguardando}</p>
                  <p className="text-[10px] text-amber-700 font-semibold">Notificados ao cliente</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-[#64748B] uppercase">
                    Contratos Assinados
                  </p>
                  <p className="text-xl font-black text-emerald-700">{totalAssinados}</p>
                  <p className="text-[10px] text-emerald-700 font-semibold">
                    Autenticidade SHA-256
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-teal-50 text-[#0FA3A3] flex items-center justify-center shrink-0">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-[#64748B] uppercase">
                    Honorários Ativos
                  </p>
                  <p className="text-xl font-black text-[#0B1F3A]">
                    R${' '}
                    {valorMensalTotalAssinado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-[#64748B]">Mensalidade recorrente</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Barra de Filtros e Busca */}
          <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* Busca textual */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
                  <Input
                    value={filtroBusca}
                    onChange={(e) => setFiltroBusca(e.target.value)}
                    placeholder="Buscar por título ou modelo..."
                    className="pl-9 h-9 text-xs rounded-xl border-[#E2E8F0]"
                  />
                </div>

                {/* Filtro Empresa */}
                <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
                  <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                    <SelectValue placeholder="Todas as empresas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as empresas</SelectItem>
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.nome_fantasia || emp.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Filtro Tipo */}
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                    <SelectValue placeholder="Todos os tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os tipos</SelectItem>
                    <SelectItem value="contrato">Contratos</SelectItem>
                    <SelectItem value="proposta">Propostas Comerciais</SelectItem>
                  </SelectContent>
                </Select>

                {/* Filtro Status */}
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="enviado">Enviado (Aguardando)</SelectItem>
                    <SelectItem value="assinado">Assinado</SelectItem>
                    <SelectItem value="recusado">Recusado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Listagem de Propostas e Contratos */}
          {loading ? (
            <div className="text-center py-16 space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0FA3A3] mx-auto" />
              <p className="text-xs text-[#64748B]">
                Carregando documentos e contratos de honorários...
              </p>
            </div>
          ) : contratosFiltrados.length === 0 ? (
            <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
              <CardContent className="p-12 text-center space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <FileText className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-[#1A2333]">
                  Nenhum contrato ou proposta encontrada
                </h3>
                <p className="text-xs text-[#64748B] max-w-md mx-auto">
                  Não há documentos cadastrados com os filtros atuais. Clique no botão acima para
                  criar o primeiro contrato com o modelo contábil padrão.
                </p>
                {canEdit && (
                  <Button
                    onClick={handleOpenNew}
                    size="sm"
                    className="rounded-xl text-xs bg-[#0FA3A3] hover:bg-[#0D8B8B] text-white gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Criar Contrato</span>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {contratosFiltrados.map((c) => {
                const assinatura = getAssinaturaForContrato(c.id)
                const isAssinado = c.status === 'assinado' || assinatura?.status === 'assinada'
                const isEnviado = c.status === 'enviado'
                const isRecusado = c.status === 'recusado'
                const isRascunho = c.status === 'rascunho'

                const empNome =
                  c.expand?.empresa?.nome_fantasia ||
                  c.expand?.empresa?.razao_social ||
                  'Prospect / Não Vinculado'

                return (
                  <Card
                    key={c.id}
                    className="rounded-2xl border-[#E2E8F0] shadow-xs flex flex-col justify-between hover:border-[#0FA3A3]/50 transition-all bg-white"
                  >
                    <CardHeader className="p-5 pb-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <Badge
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 ${
                            c.tipo === 'proposta'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {c.tipo === 'proposta' ? 'Proposta' : 'Contrato'}
                        </Badge>

                        <Badge
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 ${
                            isAssinado
                              ? 'bg-emerald-600 text-white'
                              : isEnviado
                                ? 'bg-blue-600 text-white'
                                : isRecusado
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {c.status.toUpperCase()}
                        </Badge>
                      </div>

                      <div>
                        <CardTitle className="text-sm font-bold text-[#0B1F3A] line-clamp-2 leading-snug">
                          {c.titulo}
                        </CardTitle>
                        <p className="text-xs text-[#64748B] flex items-center gap-1 mt-1">
                          <Building2 className="h-3.5 w-3.5 text-[#0FA3A3]" />
                          <span className="truncate">{empNome}</span>
                        </p>
                      </div>
                    </CardHeader>

                    <CardContent className="p-5 pt-0 space-y-3">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1.5">
                        <div className="flex items-center justify-between text-[#64748B]">
                          <span>Honorário Mensal:</span>
                          <span className="font-extrabold text-[#0FA3A3] text-sm">
                            R${' '}
                            {c.valor_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[#64748B]">
                          <span>Vencimento & Prazo:</span>
                          <span className="font-medium text-[#1A2333]">
                            Dia {c.dia_vencimento} • {c.prazo_contrato} meses
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[#64748B]">
                          <span>Modelo:</span>
                          <span className="font-mono text-[11px] text-[#1A2333]">
                            {c.modelo_mensalidade}
                          </span>
                        </div>
                      </div>

                      {/* Recusa */}
                      {isRecusado && c.observacoes_recusa && (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] space-y-1">
                          <span className="font-bold flex items-center gap-1 text-rose-700">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Motivo da Recusa:
                          </span>
                          <p className="line-clamp-2 italic font-mono">"{c.observacoes_recusa}"</p>
                        </div>
                      )}

                      {/* Selo se Assinado */}
                      {isAssinado && assinatura && (
                        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] space-y-1">
                          <div className="flex items-center justify-between font-bold text-emerald-800">
                            <span className="flex items-center gap-1">
                              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                              Assinatura Autêntica
                            </span>
                            <a
                              href={`/verificar-assinatura?token=${encodeURIComponent(
                                assinatura.token_verificacao,
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-700 hover:text-emerald-950 underline font-mono text-[10px]"
                            >
                              {assinatura.token_verificacao.slice(0, 16)}...
                            </a>
                          </div>
                          <p className="text-[10px] text-emerald-700">
                            Por {assinatura.assinante} em{' '}
                            {assinatura.data_assinatura
                              ? formatDatePtBr(assinatura.data_assinatura)
                              : ''}
                          </p>
                        </div>
                      )}

                      {/* Ações */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenView(c)}
                          className="rounded-xl text-xs h-8 px-2.5 border-[#E2E8F0] gap-1 text-[#0FA3A3]"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Visualizar PDF</span>
                        </Button>

                        <div className="flex items-center gap-1">
                          {/* Se for rascunho ou recusado, pode editar */}
                          {(isRascunho || isRecusado) && canEdit && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(c)}
                              className="rounded-xl text-xs h-8 px-2 text-[#64748B] hover:text-[#0B1F3A]"
                              title="Editar Cláusulas"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          )}

                          {/* Solicitar Assinatura */}
                          {(isRascunho || isRecusado) && canSolicitarAssinatura && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleOpenSolicitar(c)}
                              className="rounded-xl text-xs h-8 px-2.5 bg-[#0FA3A3] hover:bg-[#0D8B8B] text-white gap-1"
                            >
                              <Send className="h-3.5 w-3.5" />
                              <span>Solicitar Assinatura</span>
                            </Button>
                          )}

                          {/* Excluir rascunho */}
                          {(isRascunho || isRecusado) && canEdit && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(c)}
                              className="rounded-xl text-xs h-8 px-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                              title="Excluir"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal de Visualização Formal e Print-to-PDF com Selo */}
      <ContratoModalView
        open={viewModalOpen}
        onOpenChange={setViewModalOpen}
        contrato={selectedContrato}
        empresa={
          selectedContrato ? empresas.find((e) => e.id === selectedContrato.empresa) || null : null
        }
        assinatura={selectedContrato ? getAssinaturaForContrato(selectedContrato.id) || null : null}
        tenantNome={tenant?.nome || 'Rumo Consultoria Contábil'}
        tenantCnpj={tenant?.cnpj || '12.345.678/0001-90'}
      />

      {/* Modal Editor de Proposta e Cláusulas */}
      <ContratoEditorModal
        open={editorModalOpen}
        onOpenChange={setEditorModalOpen}
        contrato={selectedContrato}
        empresas={empresas}
        tenantId={tenant?.id || ''}
        userId={user?.id}
        onSaved={loadData}
      />

      {/* Modal Solicitar Assinatura Digital */}
      <SolicitarAssinaturaContratoModal
        open={solicitarModalOpen}
        onOpenChange={setSolicitarModalOpen}
        contrato={selectedContrato}
        empresa={
          selectedContrato ? empresas.find((e) => e.id === selectedContrato.empresa) || null : null
        }
        tenantNome={tenant?.nome || 'Rumo Consultoria Contábil'}
        tenantCnpj={tenant?.cnpj || '12.345.678/0001-90'}
        onSuccess={loadData}
      />
    </div>
  )
}

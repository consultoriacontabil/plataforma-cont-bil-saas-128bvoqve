import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  FileText,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Eye,
  Download,
  Send,
  Loader2,
  Trash2,
  Edit3,
  Building2,
  ShieldCheck,
  Users,
  Coins,
  FileCheck,
  TrendingUp,
  Clock,
  Sparkles,
  HelpCircle,
  AlertTriangle,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { defisService } from '@/services/defisService'
import { useRealtime } from '@/hooks/use-realtime'
import { formatDatePtBr, formatDateTimePtBr } from '@/lib/formatters'
import type {
  DefisDeclaracaoRecord,
  DefisStatus,
  DefisTipoDeclaracao,
  DefisElementoFiscal,
  DefisSocioParticipacao,
  Empresa,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'

interface DefisTabProps {
  empresas: Empresa[]
  selectedEmpresaId: string
  onSelectEmpresa: (empresaId: string) => void
}

export function DefisTab({ empresas, selectedEmpresaId, onSelectEmpresa }: DefisTabProps) {
  const { user, tenant } = useAuth()
  const { toast } = useToast()

  const [declaracoes, setDeclaracoes] = useState<DefisDeclaracaoRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<'todos' | DefisStatus>('todos')
  const [anoFiltro, setAnoFiltro] = useState<'todos' | string>('todos')

  // Modais
  const [gerarModalOpen, setGerarModalOpen] = useState(false)
  const [gerandoAutomatico, setGerandoAutomatico] = useState(false)
  const [revisaoModalOpen, setRevisaoModalOpen] = useState(false)
  const [transmitirModalOpen, setTransmitirModalOpen] = useState(false)
  const [selectedDeclaracao, setSelectedDeclaracao] = useState<DefisDeclaracaoRecord | null>(null)
  const [submittingTransmissao, setSubmittingTransmissao] = useState(false)
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  // Formulário de Geração / Revisão
  const anoAtual = new Date().getFullYear()
  const [anoCalendario, setAnoCalendario] = useState(anoAtual - 1)
  const [tipoDeclaracao, setTipoDeclaracao] = useState<DefisTipoDeclaracao>('original')
  const [faturamentoAnual, setFaturamentoAnual] = useState(0)
  const [totalDasPago, setTotalDasPago] = useState(0)
  const [empregadosInicio, setEmpregadosInicio] = useState(0)
  const [empregadosFim, setEmpregadosFim] = useState(0)
  const [elementosFiscais, setElementosFiscais] = useState<DefisElementoFiscal>({
    receita_mercado_interno: 0,
    receita_mercado_externo: 0,
    receita_locacao_bens: 0,
    receita_isenta_imune: 0,
    ganhos_capital: 0,
    despesas_operacionais_totais: 0,
    lucro_apurado: 0,
    rendimento_socios_isento: 0,
    rendimento_socios_tributado: 0,
    saldo_caixa_inicio: 1000,
    saldo_caixa_fim: 1000,
    compras_mercadorias: 0,
  })
  const [dadosSocietarios, setDadosSocietarios] = useState<DefisSocioParticipacao[]>([])
  const [observacoes, setObservacoes] = useState('')
  const [reciboManual, setReciboManual] = useState('')
  const [avisosGeracao, setAvisosGeracao] = useState<string[]>([])
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const canEdit = !user?.role || user.role === 'administrador' || user.role === 'contador'

  const loadDeclaracoes = useCallback(async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      const res = await defisService.list(tenant.id, selectedEmpresaId || undefined)
      setDeclaracoes(res)
    } catch (err) {
      console.error('Erro ao carregar declarações DEFIS:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar DEFIS',
        description: 'Não foi possível carregar as declarações cadastradas.',
      })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, selectedEmpresaId, toast])

  useEffect(() => {
    loadDeclaracoes()
  }, [loadDeclaracoes])

  useRealtime('defis_declaracoes', () => loadDeclaracoes())

  // Filtragem
  const declaracoesFiltradas = useMemo(() => {
    return declaracoes.filter((item) => {
      const matchSearch =
        search.trim() === '' ||
        String(item.ano_calendario).includes(search) ||
        (item.expand?.empresa?.razao_social &&
          item.expand.empresa.razao_social.toLowerCase().includes(search.toLowerCase())) ||
        (item.expand?.empresa?.cnpj && item.expand.empresa.cnpj.includes(search))

      const matchStatus = statusFiltro === 'todos' || item.status === statusFiltro
      const matchAno = anoFiltro === 'todos' || String(item.ano_calendario) === anoFiltro

      return matchSearch && matchStatus && matchAno
    })
  }, [declaracoes, search, statusFiltro, anoFiltro])

  // Disparar Gerador Automático a partir das bases existentes
  const handleIniciarGeracaoAutomatica = async () => {
    if (!tenant?.id || !selectedEmpresaId) {
      toast({
        variant: 'destructive',
        title: 'Selecione uma empresa',
        description: 'Escolha a empresa para consolidar os dados fiscais e gerar a DEFIS.',
      })
      return
    }

    setGerandoAutomatico(true)
    try {
      const rascunho = await defisService.gerarRascunhoAutomatico({
        tenantId: tenant.id,
        empresaId: selectedEmpresaId,
        anoCalendario,
        tipoDeclaracao,
        usuarioId: user?.id,
      })

      setFaturamentoAnual(rascunho.faturamentoAnual)
      setTotalDasPago(rascunho.totalDasPago)
      setEmpregadosInicio(rascunho.totalEmpregadosInicio)
      setEmpregadosFim(rascunho.totalEmpregadosFim)
      setElementosFiscais(rascunho.elementosFiscais)
      setDadosSocietarios(rascunho.dadosSocietarios)
      setAvisosGeracao(rascunho.avisos)
      setObservacoes(
        `Declaração DEFIS gerada automaticamente em ${new Date().toLocaleDateString('pt-BR')} com base nos livros fiscais e folhas registradas.`,
      )
      setEditandoId(null)

      setGerarModalOpen(false)
      setRevisaoModalOpen(true)

      toast({
        title: 'Dados consolidados com sucesso!',
        description: `Faturamento de R$ ${rascunho.faturamentoAnual.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
        })} e ${rascunho.dadosSocietarios.length} sócio(s) carregados para revisão.`,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao consolidar dados da empresa.'
      toast({
        variant: 'destructive',
        title: 'Erro na geração da DEFIS',
        description: msg,
      })
    } finally {
      setGerandoAutomatico(false)
    }
  }

  // Abrir declaração existente para visualização ou edição
  const handleAbrirRevisao = (dec: DefisDeclaracaoRecord) => {
    setSelectedDeclaracao(dec)
    setEditandoId(dec.id)
    setAnoCalendario(dec.ano_calendario)
    setTipoDeclaracao(dec.tipo_declaracao)
    setFaturamentoAnual(dec.faturamento_anual_declarado || 0)
    setTotalDasPago(dec.total_das_pago || 0)
    setEmpregadosInicio(dec.total_empregados_inicio || 0)
    setEmpregadosFim(dec.total_empregados_fim || 0)
    setElementosFiscais(
      dec.elementos_fiscais_json || {
        receita_mercado_interno: dec.faturamento_anual_declarado || 0,
        receita_mercado_externo: 0,
        receita_locacao_bens: 0,
        receita_isenta_imune: 0,
        ganhos_capital: 0,
        despesas_operacionais_totais: 0,
        lucro_apurado: 0,
        rendimento_socios_isento: 0,
        rendimento_socios_tributado: 0,
        saldo_caixa_inicio: 1000,
        saldo_caixa_fim: 1000,
        compras_mercadorias: 0,
      },
    )
    setDadosSocietarios(dec.dados_societarios_json || [])
    setObservacoes(dec.observacoes || '')
    setAvisosGeracao([])
    setRevisaoModalOpen(true)
  }

  // Salvar rascunho / pronto
  const handleSalvarDeclaracao = async (novoStatus: DefisStatus) => {
    if (!tenant?.id) return
    const empId = selectedDeclaracao ? selectedDeclaracao.empresa : selectedEmpresaId
    if (!empId) return

    setSalvandoEdicao(true)
    try {
      await defisService.salvar(
        {
          tenantId: tenant.id,
          empresaId: empId,
          anoCalendario,
          exercicio: anoCalendario + 1,
          tipoDeclaracao,
          status: novoStatus,
          faturamentoAnualDeclarado: faturamentoAnual,
          totalDasPago,
          totalEmpregadosInicio: empregadosInicio,
          totalEmpregadosFim: empregadosFim,
          elementosFiscais,
          dadosSocietarios,
          observacoes,
          usuarioId: user?.id,
        },
        editandoId || undefined,
      )

      toast({
        title: novoStatus === 'pronto' ? 'DEFIS pronta para envio!' : 'Rascunho salvo',
        description: `Ano-calendário ${anoCalendario} gravado com sucesso.`,
      })

      setRevisaoModalOpen(false)
      loadDeclaracoes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar declaração.'
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: msg,
      })
    } finally {
      setSalvandoEdicao(false)
    }
  }

  // Transmissão Oficial em MODO DE SUPERVISÃO (Honestidade técnica)
  const handleTransmitirSupervisao = async () => {
    if (!selectedDeclaracao || !tenant?.id || !user?.id) return

    setSubmittingTransmissao(true)
    try {
      const res = await defisService.transmitirModoSupervisao(
        selectedDeclaracao.id,
        user.id,
        tenant.id,
        reciboManual,
      )

      toast({
        title: 'DEFIS transmitida em Modo de Supervisão!',
        description: `Recibo formal ${res.recibo_numero} gerado e registrado na auditoria com sucesso.`,
      })

      setTransmitirModalOpen(false)
      setSelectedDeclaracao(null)
      setReciboManual('')
      loadDeclaracoes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao registrar transmissão.'
      toast({
        variant: 'destructive',
        title: 'Erro na transmissão',
        description: msg,
      })
    } finally {
      setSubmittingTransmissao(false)
    }
  }

  // Excluir declaração
  const handleExcluir = async (id: string) => {
    if (!tenant?.id || !user?.id) return
    if (!confirm('Deseja realmente excluir esta declaração DEFIS?')) return

    try {
      await defisService.delete(id, tenant.id, user.id)
      toast({
        title: 'Declaração excluída',
        description: 'Registro removido da base de dados.',
      })
      loadDeclaracoes()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
      })
    }
  }

  // Exportar TXT para download
  const handleDownloadTxt = (dec: DefisDeclaracaoRecord) => {
    const conteudo =
      dec.arquivo_exportado_txt ||
      defisService.gerarArquivoTxtEstrutura({
        anoCalendario: dec.ano_calendario,
        exercicio: dec.exercicio,
        tipoDeclaracao: dec.tipo_declaracao,
        status: dec.status,
        faturamentoAnualDeclarado: dec.faturamento_anual_declarado,
        totalDasPago: dec.total_das_pago,
        totalEmpregadosInicio: dec.total_empregados_inicio,
        totalEmpregadosFim: dec.total_empregados_fim,
        elementosFiscais: dec.elementos_fiscais_json,
        dadosSocietarios: dec.dados_societarios_json,
      })

    const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `DEFIS_${dec.ano_calendario}_${dec.tipo_declaracao}_${dec.id.slice(0, 6)}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: 'Arquivo DEFIS exportado',
      description: 'Estrutura oficial baixada em formato texto para conferência.',
    })
  }

  const getStatusBadge = (status: DefisStatus) => {
    switch (status) {
      case 'transmitido_supervisao':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 gap-1 font-semibold">
            <ShieldCheck className="h-3 w-3 text-emerald-600" />
            <span>Transmitido (Modo Supervisão)</span>
          </Badge>
        )
      case 'pronto':
        return (
          <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50 gap-1 font-semibold">
            <CheckCircle2 className="h-3 w-3 text-blue-600" />
            <span>Pronto para Transmissão</span>
          </Badge>
        )
      case 'rascunho':
      default:
        return (
          <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 gap-1 font-semibold">
            <Clock className="h-3 w-3 text-amber-600" />
            <span>Rascunho em Elaboração</span>
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Barra de Seleção da Empresa e Ação Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#0FA3A3]" />
            <h3 className="text-base font-bold text-slate-900">
              DEFIS — Declaração de Informações Socioeconômicas e Fiscais
            </h3>
            <Badge variant="outline" className="text-[10px] text-slate-600 border-slate-300">
              Simples Nacional
            </Badge>
          </div>
          <p className="text-xs text-slate-500">
            Consolidação anual automática de faturamento (NFS-e/NF-e), guias DAS recolhidas, folha
            de empregados e QSA com transmissão assistida em Modo Supervisão.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-64">
            <Select value={selectedEmpresaId} onValueChange={onSelectEmpresa}>
              <SelectTrigger className="h-10 text-xs rounded-xl border-slate-200 bg-slate-50">
                <SelectValue placeholder="Filtrar por Empresa..." />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                <SelectItem value="todas">Todas as Empresas</SelectItem>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome_fantasia || e.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {canEdit && (
            <Button
              onClick={() => {
                if (!selectedEmpresaId || selectedEmpresaId === 'todas') {
                  toast({
                    variant: 'destructive',
                    title: 'Selecione uma empresa',
                    description: 'Escolha uma empresa específica para gerar a DEFIS.',
                  })
                  return
                }
                setGerarModalOpen(true)
              }}
              className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs h-10 shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Gerar DEFIS</span>
            </Button>
          )}
        </div>
      </div>

      {/* Cards de Resumo Rápido */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-[#0FA3A3]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Total Declaradas</p>
              <p className="text-xl font-bold text-slate-900">{declaracoes.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Modo Supervisão</p>
              <p className="text-xl font-bold text-emerald-700">
                {declaracoes.filter((d) => d.status === 'transmitido_supervisao').length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Prontas p/ Envio</p>
              <p className="text-xl font-bold text-blue-700">
                {declaracoes.filter((d) => d.status === 'pronto').length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Rascunhos</p>
              <p className="text-xl font-bold text-amber-700">
                {declaracoes.filter((d) => d.status === 'rascunho').length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Declarações */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por ano, empresa ou CNPJ..."
              className="h-9 pl-9 text-xs rounded-xl border-slate-200"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={statusFiltro}
              onValueChange={(val: 'todos' | DefisStatus) => setStatusFiltro(val)}
            >
              <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200 w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="pronto">Pronto</SelectItem>
                <SelectItem value="transmitido_supervisao">Transmitido Supervisão</SelectItem>
              </SelectContent>
            </Select>

            <Select value={anoFiltro} onValueChange={(val) => setAnoFiltro(val)}>
              <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200 w-36">
                <SelectValue placeholder="Ano-calendário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os anos</SelectItem>
                <SelectItem value={String(anoAtual - 1)}>{anoAtual - 1}</SelectItem>
                <SelectItem value={String(anoAtual - 2)}>{anoAtual - 2}</SelectItem>
                <SelectItem value={String(anoAtual - 3)}>{anoAtual - 3}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Empresa / CNPJ</th>
                <th className="py-3 px-4">Ano-Calendário</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4 text-right">Faturamento Declarado</th>
                <th className="py-3 px-4 text-right">DAS Recolhido</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Recibo / Data</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-[#0FA3A3]" />
                    Carregando declarações DEFIS...
                  </td>
                </tr>
              ) : declaracoesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Nenhuma declaração DEFIS encontrada. Clique em "Gerar DEFIS" para consolidar a
                    primeira declaração.
                  </td>
                </tr>
              ) : (
                declaracoesFiltradas.map((dec) => (
                  <tr key={dec.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">
                        {dec.expand?.empresa?.nome_fantasia ||
                          dec.expand?.empresa?.razao_social ||
                          'Empresa'}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {dec.expand?.empresa?.cnpj}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {dec.ano_calendario}
                      <span className="block text-[10px] font-normal text-slate-400">
                        Exercício {dec.exercicio}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {dec.tipo_declaracao}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                      R${' '}
                      {(dec.faturamento_anual_declarado || 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      R${' '}
                      {(dec.total_das_pago || 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3 px-4 text-center">{getStatusBadge(dec.status)}</td>
                    <td className="py-3 px-4">
                      {dec.recibo_numero ? (
                        <div>
                          <span className="font-mono text-[11px] font-semibold text-slate-800 block">
                            {dec.recibo_numero}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formatDateTimePtBr(dec.data_transmissao)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAbrirRevisao(dec)}
                          className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900"
                          title="Visualizar e Editar"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDownloadTxt(dec)}
                          className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900"
                          title="Exportar arquivo TXT estruturado"
                        >
                          <Download className="h-4 w-4" />
                        </Button>

                        {dec.status !== 'transmitido_supervisao' && canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedDeclaracao(dec)
                              setTransmitirModalOpen(true)
                            }}
                            className="h-8 px-2 text-[11px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 gap-1"
                            title="Transmitir em Modo Supervisão"
                          >
                            <Send className="h-3.5 w-3.5" />
                            <span>Transmitir</span>
                          </Button>
                        )}

                        {canEdit && dec.status !== 'transmitido_supervisao' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleExcluir(dec.id)}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: SELEÇÃO PARA GERAR AUTOMÁTICO */}
      <Dialog open={gerarModalOpen} onOpenChange={setGerarModalOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#0FA3A3]" />
              <DialogTitle className="text-base text-slate-900">
                Gerar Rascunho DEFIS a partir dos Livros
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              A plataforma fará a varredura contábil-fiscal das notas fiscais emitidas (NFS-e e
              NF-e), guias DAS recolhidas no período e quadro de empregados do DP.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Ano-Calendário *</Label>
              <Select
                value={String(anoCalendario)}
                onValueChange={(val) => setAnoCalendario(parseInt(val, 10))}
              >
                <SelectTrigger className="h-10 text-xs rounded-xl border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={String(anoAtual - 1)}>
                    {anoAtual - 1} (Exercício {anoAtual})
                  </SelectItem>
                  <SelectItem value={String(anoAtual - 2)}>
                    {anoAtual - 2} (Exercício {anoAtual - 1})
                  </SelectItem>
                  <SelectItem value={String(anoAtual - 3)}>
                    {anoAtual - 3} (Exercício {anoAtual - 2})
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Tipo da Declaração *</Label>
              <Select
                value={tipoDeclaracao}
                onValueChange={(val: DefisTipoDeclaracao) => setTipoDeclaracao(val)}
              >
                <SelectTrigger className="h-10 text-xs rounded-xl border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="original">Original</SelectItem>
                  <SelectItem value="retificadora">Retificadora</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 space-y-1">
              <p className="font-semibold flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                Regra de Conformidade:
              </p>
              <p>
                Os valores apurados serão apresentados em tela de revisão detalhada antes de
                qualquer formalização, permitindo ajustes nos elementos fiscais consolidados (EFC) e
                pro-labore dos sócios.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setGerarModalOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleIniciarGeracaoAutomatica}
                disabled={gerandoAutomatico}
                className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs shadow-xs"
              >
                {gerandoAutomatico ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Consolidando dados...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Consolidar e Revisar</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: TELA DE REVISÃO E EDIÇÃO COMPLETA DA DEFIS */}
      <Dialog open={revisaoModalOpen} onOpenChange={setRevisaoModalOpen}>
        <DialogContent className="rounded-2xl max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#0FA3A3] uppercase tracking-wider">
                  Módulo Fiscal • Simples Nacional
                </span>
                <DialogTitle className="text-lg text-slate-900 mt-0.5">
                  Revisão da DEFIS — Ano-Calendário {anoCalendario} (Exercício {anoCalendario + 1})
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Confira e ajuste os valores apurados das notas, tributos DAS e dados
                  socioeconômicos antes de concluir o lote.
                </DialogDescription>
              </div>
              <Badge variant="outline" className="capitalize text-xs">
                {tipoDeclaracao}
              </Badge>
            </div>
          </DialogHeader>

          {avisosGeracao.length > 0 && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Observações de Consistência:
              </span>
              <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                {avisosGeracao.map((aviso, idx) => (
                  <li key={idx}>{aviso}</li>
                ))}
              </ul>
            </div>
          )}

          <Tabs defaultValue="fiscais" className="w-full space-y-4">
            <TabsList className="bg-slate-100 p-1 rounded-xl">
              <TabsTrigger value="fiscais" className="gap-2 text-xs py-1.5 px-3 rounded-lg">
                <Coins className="w-3.5 h-3.5" />
                1. Valores & Faturamento
              </TabsTrigger>
              <TabsTrigger value="efc" className="gap-2 text-xs py-1.5 px-3 rounded-lg">
                <TrendingUp className="w-3.5 h-3.5" />
                2. Elementos Fiscais (EFC)
              </TabsTrigger>
              <TabsTrigger value="dp" className="gap-2 text-xs py-1.5 px-3 rounded-lg">
                <Users className="w-3.5 h-3.5" />
                3. Empregados & DP
              </TabsTrigger>
              <TabsTrigger value="qsa" className="gap-2 text-xs py-1.5 px-3 rounded-lg">
                <Building2 className="w-3.5 h-3.5" />
                4. Sócios & QSA ({dadosSocietarios.length})
              </TabsTrigger>
            </TabsList>

            {/* ABA 1: VALORES CONSOLIDADOS */}
            <TabsContent value="fiscais" className="space-y-4 m-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Faturamento Anual Declarado (R$) *
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={faturamentoAnual}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0
                      setFaturamentoAnual(v)
                      setElementosFiscais((prev) => ({ ...prev, receita_mercado_interno: v }))
                    }}
                    className="h-10 text-xs rounded-xl font-mono border-slate-200"
                  />
                  <p className="text-[10px] text-slate-400">
                    Soma de todas as NFS-e emitidas + NF-e modelo 55 de saída da empresa no ano.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Total de Guias DAS Pagas no Ano (R$) *
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={totalDasPago}
                    onChange={(e) => setTotalDasPago(parseFloat(e.target.value) || 0)}
                    className="h-10 text-xs rounded-xl font-mono border-slate-200"
                  />
                  <p className="text-[10px] text-slate-400">
                    Repasse consolidado das guias DAS quitadas na plataforma e conferidas no e-CAC.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Observações da Declaração
                </Label>
                <Textarea
                  rows={2}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Justificativas, informações de faturamento de filiais, parcelamentos vigentes..."
                  className="text-xs rounded-xl border-slate-200"
                />
              </div>
            </TabsContent>

            {/* ABA 2: ELEMENTOS FISCAIS CONSOLIDADOS (EFC) */}
            <TabsContent value="efc" className="space-y-4 m-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-slate-600">
                    Receita Mercado Interno (R$)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={elementosFiscais.receita_mercado_interno}
                    onChange={(e) =>
                      setElementosFiscais({
                        ...elementosFiscais,
                        receita_mercado_interno: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-9 text-xs rounded-lg font-mono border-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-slate-600">
                    Receita Mercado Externo / Exportação (R$)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={elementosFiscais.receita_mercado_externo}
                    onChange={(e) =>
                      setElementosFiscais({
                        ...elementosFiscais,
                        receita_mercado_externo: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-9 text-xs rounded-lg font-mono border-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-slate-600">
                    Receitas Isentas / Imunes (R$)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={elementosFiscais.receita_isenta_imune}
                    onChange={(e) =>
                      setElementosFiscais({
                        ...elementosFiscais,
                        receita_isenta_imune: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-9 text-xs rounded-lg font-mono border-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-slate-600">
                    Despesas Operacionais Totais (R$)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={elementosFiscais.despesas_operacionais_totais}
                    onChange={(e) =>
                      setElementosFiscais({
                        ...elementosFiscais,
                        despesas_operacionais_totais: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-9 text-xs rounded-lg font-mono border-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-slate-600">
                    Lucro Líquido Apurado (R$)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={elementosFiscais.lucro_apurado}
                    onChange={(e) =>
                      setElementosFiscais({
                        ...elementosFiscais,
                        lucro_apurado: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-9 text-xs rounded-lg font-mono border-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-slate-600">
                    Rendimentos Isentos aos Sócios (R$)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={elementosFiscais.rendimento_socios_isento}
                    onChange={(e) =>
                      setElementosFiscais({
                        ...elementosFiscais,
                        rendimento_socios_isento: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-9 text-xs rounded-lg font-mono border-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-slate-600">
                    Saldo Caixa no Início do Período (R$)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={elementosFiscais.saldo_caixa_inicio}
                    onChange={(e) =>
                      setElementosFiscais({
                        ...elementosFiscais,
                        saldo_caixa_inicio: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-9 text-xs rounded-lg font-mono border-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-slate-600">
                    Saldo Caixa no Fim do Período (R$)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={elementosFiscais.saldo_caixa_fim}
                    onChange={(e) =>
                      setElementosFiscais({
                        ...elementosFiscais,
                        saldo_caixa_fim: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-9 text-xs rounded-lg font-mono border-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-slate-600">
                    Compras de Mercadorias para Revenda (R$)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={elementosFiscais.compras_mercadorias}
                    onChange={(e) =>
                      setElementosFiscais({
                        ...elementosFiscais,
                        compras_mercadorias: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-9 text-xs rounded-lg font-mono border-slate-200"
                  />
                </div>
              </div>
            </TabsContent>

            {/* ABA 3: EMPREGADOS DO DP */}
            <TabsContent value="dp" className="space-y-4 m-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Quantidade de Empregados no Início do Ano-Calendário *
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    value={empregadosInicio}
                    onChange={(e) => setEmpregadosInicio(parseInt(e.target.value, 10) || 0)}
                    className="h-10 text-xs rounded-xl font-mono border-slate-200"
                  />
                  <p className="text-[10px] text-slate-400">
                    Contratos de trabalho ativos em 01/01 do ano-calendário (módulo DP).
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Quantidade de Empregados no Fim do Ano-Calendário *
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    value={empregadosFim}
                    onChange={(e) => setEmpregadosFim(parseInt(e.target.value, 10) || 0)}
                    className="h-10 text-xs rounded-xl font-mono border-slate-200"
                  />
                  <p className="text-[10px] text-slate-400">
                    Contratos de trabalho ativos em 31/12 do ano-calendário (módulo DP).
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* ABA 4: SÓCIOS E QSA */}
            <TabsContent value="qsa" className="space-y-4 m-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  Sócios Cadastrados para a DEFIS ({dadosSocietarios.length})
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDadosSocietarios([
                      ...dadosSocietarios,
                      {
                        nome: 'Novo Sócio',
                        cpf: '000.000.000-00',
                        percentual_participacao: 0,
                        pro_labore_anual: 0,
                        rendimentos_isentos_lucros: 0,
                        irrf_retido: 0,
                      },
                    ])
                  }}
                  className="h-7 text-xs rounded-lg gap-1 border-slate-200"
                >
                  <Plus className="h-3 w-3" />
                  <span>Adicionar Sócio</span>
                </Button>
              </div>

              <div className="space-y-3">
                {dadosSocietarios.map((socio, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-6 gap-2 text-xs relative"
                  >
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-[10px] font-semibold text-slate-500">
                        Nome do Sócio
                      </Label>
                      <Input
                        value={socio.nome}
                        onChange={(e) => {
                          const arr = [...dadosSocietarios]
                          arr[idx].nome = e.target.value
                          setDadosSocietarios(arr)
                        }}
                        className="h-8 text-xs rounded-lg bg-white border-slate-200"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-slate-500">CPF</Label>
                      <Input
                        value={socio.cpf}
                        onChange={(e) => {
                          const arr = [...dadosSocietarios]
                          arr[idx].cpf = e.target.value
                          setDadosSocietarios(arr)
                        }}
                        className="h-8 text-xs rounded-lg bg-white border-slate-200"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-slate-500">
                        Participação (%)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={socio.percentual_participacao}
                        onChange={(e) => {
                          const arr = [...dadosSocietarios]
                          arr[idx].percentual_participacao = parseFloat(e.target.value) || 0
                          setDadosSocietarios(arr)
                        }}
                        className="h-8 text-xs rounded-lg bg-white border-slate-200"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-slate-500">
                        Pró-Labore Anual (R$)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={socio.pro_labore_anual}
                        onChange={(e) => {
                          const arr = [...dadosSocietarios]
                          arr[idx].pro_labore_anual = parseFloat(e.target.value) || 0
                          setDadosSocietarios(arr)
                        }}
                        className="h-8 text-xs rounded-lg bg-white border-slate-200"
                      />
                    </div>

                    <div className="space-y-1 flex items-end justify-between">
                      <div className="flex-1 mr-1">
                        <Label className="text-[10px] font-semibold text-slate-500">
                          Lucro Isento (R$)
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={socio.rendimentos_isentos_lucros}
                          onChange={(e) => {
                            const arr = [...dadosSocietarios]
                            arr[idx].rendimentos_isentos_lucros = parseFloat(e.target.value) || 0
                            setDadosSocietarios(arr)
                          }}
                          className="h-8 text-xs rounded-lg bg-white border-slate-200"
                        />
                      </div>
                      {dadosSocietarios.length > 1 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setDadosSocietarios(dadosSocietarios.filter((_, i) => i !== idx))
                          }}
                          className="h-8 w-8 text-red-500 hover:text-red-700"
                          title="Remover sócio"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="border-t pt-3 gap-2 flex flex-col sm:flex-row sm:justify-between items-center">
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Política de Honestidade Técnica • Transmissões em Modo Supervisão</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRevisaoModalOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={salvandoEdicao}
                onClick={() => handleSalvarDeclaracao('rascunho')}
                className="text-xs rounded-xl"
              >
                Salvar como Rascunho
              </Button>
              <Button
                type="button"
                disabled={salvandoEdicao}
                onClick={() => handleSalvarDeclaracao('pronto')}
                className="gap-1.5 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs shadow-xs"
              >
                {salvandoEdicao ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                <span>Concluir Revisão (Pronto)</span>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: TRANSMISSÃO OFICIAL EM MODO SUPERVISÃO */}
      <Dialog open={transmitirModalOpen} onOpenChange={setTransmitirModalOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <DialogTitle className="text-base text-slate-900">
                Transmissão da DEFIS em Modo Supervisão
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Em estrita conformidade com a política de honestidade técnica, as transmissões para a
              Receita Federal dependem de certificado A1/e-CAC ativo. A declaração é formalizada no
              sistema com recibo e trilha de auditoria rastreável.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Empresa:</span>
                <span className="font-semibold text-slate-900">
                  {selectedDeclaracao?.expand?.empresa?.nome_fantasia ||
                    selectedDeclaracao?.expand?.empresa?.razao_social}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ano-Calendário:</span>
                <span className="font-mono font-bold text-slate-900">
                  {selectedDeclaracao?.ano_calendario}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Faturamento Declarado:</span>
                <span className="font-mono font-semibold text-slate-900">
                  R${' '}
                  {(selectedDeclaracao?.faturamento_anual_declarado || 0).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Número do Recibo Oficial da RFB (Opcional)
              </Label>
              <Input
                value={reciboManual}
                onChange={(e) => setReciboManual(e.target.value)}
                placeholder="Ex: 12.345.678/0001-90-DEFIS-2025"
                className="h-10 text-xs rounded-xl border-slate-200 font-mono"
              />
              <p className="text-[10px] text-slate-400">
                Se já transmitido no PGDAS-D / e-CAC, informe o protocolo. Caso contrário, um número
                de supervisão oficial será gerado automaticamente.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setTransmitirModalOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleTransmitirSupervisao}
                disabled={submittingTransmissao}
                className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs"
              >
                {submittingTransmissao ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Registrando...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Confirmar Transmissão Supervisionada</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

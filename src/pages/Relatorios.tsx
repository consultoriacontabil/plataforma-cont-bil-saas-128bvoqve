import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  BarChart3,
  Building2,
  Users,
  Calendar,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { useAuth } from '@/contexts/AuthContext'
import { empresasService } from '@/services/empresas'
import {
  relatoriosService,
  type FechamentoEmpresaRow,
  type ProdutividadeUsuarioRow,
  type RelatoriosFiltro,
} from '@/services/relatorios'
import type { Empresa } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const COLORS = ['#0FA3A3', '#3B82F6', '#F59E0B', '#EF4444', '#10B981', '#8B5CF6']

export default function Relatorios() {
  const { tenant } = useAuth()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<'fechamento' | 'produtividade'>('fechamento')
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [periodo, setPeriodo] = useState<RelatoriosFiltro['periodo']>('mes_atual')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [empresaId, setEmpresaId] = useState('todas')

  // Dados calculados
  const [fechamentoData, setFechamentoData] = useState<FechamentoEmpresaRow[]>([])
  const [produtividadeData, setProdutividadeData] = useState<ProdutividadeUsuarioRow[]>([])

  // Carregar lista de empresas para o filtro
  useEffect(() => {
    if (!tenant?.id) return
    const fetchEmps = async () => {
      try {
        const data = await empresasService.list(tenant.id)
        setEmpresas(data)
      } catch (err) {
        console.error('Erro ao listar empresas:', err)
      }
    }
    void fetchEmps()
  }, [tenant?.id])
  // Carregar dados dos relatórios
  const loadRelatorios = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const filtro: RelatoriosFiltro = {
        periodo,
        dataInicio: dataInicio || undefined,
        dataFim: dataFim || undefined,
        empresaId: empresaId !== 'todas' ? empresaId : undefined,
      }

      const [fech, prod] = await Promise.all([
        relatoriosService.getFechamentoPorEmpresa(tenant.id, filtro),
        relatoriosService.getProdutividadePorUsuario(tenant.id, filtro),
      ])

      setFechamentoData(fech)
      setProdutividadeData(prod)
    } catch (err) {
      console.error('Erro ao gerar relatórios:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar relatórios',
        description: 'Não foi possível consolidar as informações do período selecionado.',
      })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, periodo, dataInicio, dataFim, empresaId, toast])

  useEffect(() => {
    void loadRelatorios()
  }, [loadRelatorios])

  // Totais Fechamento
  const totaisFechamento = useMemo(() => {
    let docsRecebidos = 0
    let docsPendentes = 0
    let wfConcluidos = 0
    let wfPendentes = 0
    let obEntregues = 0
    let obAtrasadas = 0
    let valorTotal = 0

    fechamentoData.forEach((row) => {
      docsRecebidos += row.documentosRecebidos
      docsPendentes += row.documentosPendentes
      wfConcluidos += row.workflowsConcluidos
      wfPendentes += row.workflowsPendentes
      obEntregues += row.obrigacoesEntregues
      obAtrasadas += row.obrigacoesAtrasadas
      valorTotal += row.totalObrigacoesValor
    })

    return {
      docsRecebidos,
      docsPendentes,
      wfConcluidos,
      wfPendentes,
      obEntregues,
      obAtrasadas,
      valorTotal,
    }
  }, [fechamentoData])

  // Totais Produtividade
  const totaisProdutividade = useMemo(() => {
    let wfTratados = 0
    let wfConcluidos = 0
    let obEntregues = 0
    let obAtrasadas = 0

    produtividadeData.forEach((row) => {
      wfTratados += row.workflowsTratados
      wfConcluidos += row.workflowsConcluidos
      obEntregues += row.obrigacoesEntregues
      obAtrasadas += row.obrigacoesAtrasadas
    })

    return {
      wfTratados,
      wfConcluidos,
      obEntregues,
      obAtrasadas,
    }
  }, [produtividadeData])

  // Chart data: Fechamento por empresa
  const chartFechamento = useMemo(() => {
    return fechamentoData.slice(0, 6).map((f) => ({
      name: f.empresaNome.length > 15 ? `${f.empresaNome.slice(0, 14)}...` : f.empresaNome,
      Concluídos: f.workflowsConcluidos,
      Pendentes: f.workflowsPendentes,
      Obrigações: f.obrigacoesEntregues,
      Atrasadas: f.obrigacoesAtrasadas,
    }))
  }, [fechamentoData])

  // Chart data: Produtividade por usuário
  const chartProdutividade = useMemo(() => {
    return produtividadeData.map((p) => ({
      name: p.userName.split(' ')[0],
      Workflows: p.workflowsConcluidos,
      Obrigações: p.obrigacoesEntregues,
    }))
  }, [produtividadeData])

  // Export CSV Fechamento
  const handleExportFechamentoCsv = () => {
    if (fechamentoData.length === 0) {
      toast({ title: 'Nenhum dado para exportar' })
      return
    }

    const headers = [
      'Empresa',
      'CNPJ',
      'Regime Tributario',
      'Documentos Recebidos',
      'Documentos Pendentes',
      'Workflows Concluidos',
      'Workflows Pendentes',
      'Obrigacoes Entregues',
      'Obrigacoes Atrasadas',
      'Obrigacoes Pendentes',
      'Valor Total Guias (R$)',
    ]

    const rows = fechamentoData.map((r) => [
      `"${r.empresaNome.replace(/"/g, '""')}"`,
      `"${r.cnpj}"`,
      `"${r.regime}"`,
      r.documentosRecebidos,
      r.documentosPendentes,
      r.workflowsConcluidos,
      r.workflowsPendentes,
      r.obrigacoesEntregues,
      r.obrigacoesAtrasadas,
      r.obrigacoesPendentes,
      r.totalObrigacoesValor.toFixed(2),
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `fechamento_empresas_rumo_${new Date().toISOString().split('T')[0]}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Exportação concluída!',
      description: `${fechamentoData.length} empresas exportadas para CSV.`,
    })
  }

  // Export CSV Produtividade
  const handleExportProdutividadeCsv = () => {
    if (produtividadeData.length === 0) {
      toast({ title: 'Nenhum dado para exportar' })
      return
    }

    const headers = [
      'Usuario',
      'E-mail',
      'Perfil',
      'Workflows Atribuidos',
      'Workflows Concluidos',
      'Obrigacoes Entregues',
      'Obrigacoes Atrasadas',
      'Tempo Medio Conclusao (Horas)',
    ]

    const rows = produtividadeData.map((p) => [
      `"${p.userName.replace(/"/g, '""')}"`,
      `"${p.email}"`,
      `"${p.perfil}"`,
      p.workflowsTratados,
      p.workflowsConcluidos,
      p.obrigacoesEntregues,
      p.obrigacoesAtrasadas,
      p.tempoMedioConclusaoHoras,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `produtividade_equipe_rumo_${new Date().toISOString().split('T')[0]}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Exportação concluída!',
      description: `${produtividadeData.length} membros exportados para CSV.`,
    })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#1A2333]">
            Relatórios Gerenciais
          </h2>
          <p className="text-xs text-[#64748B]">
            Visão consolidada de fechamento contábil por cliente e produtividade operacional da
            equipe
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'fechamento' ? (
            <Button
              onClick={handleExportFechamentoCsv}
              variant="outline"
              className="gap-2 rounded-xl text-xs font-semibold h-10 border-[#E2E8F0] bg-white shadow-xs hover:bg-slate-50"
            >
              <Download className="h-4 w-4 text-[#0FA3A3]" />
              <span>Exportar Fechamento (CSV)</span>
            </Button>
          ) : (
            <Button
              onClick={handleExportProdutividadeCsv}
              variant="outline"
              className="gap-2 rounded-xl text-xs font-semibold h-10 border-[#E2E8F0] bg-white shadow-xs hover:bg-slate-50"
            >
              <Download className="h-4 w-4 text-[#0FA3A3]" />
              <span>Exportar Produtividade (CSV)</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter Card */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Período */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Período de Apuração
              </label>
              <Select
                value={periodo}
                onValueChange={(val) => setPeriodo(val as RelatoriosFiltro['periodo'])}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mes_atual">Mês Atual</SelectItem>
                  <SelectItem value="3_meses">Últimos 3 Meses</SelectItem>
                  <SelectItem value="6_meses">Últimos 6 Meses</SelectItem>
                  <SelectItem value="12_meses">Últimos 12 Meses</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Dates if chosen */}
            {periodo === 'custom' ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    Data Inicial
                  </label>
                  <Input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="h-9 text-xs rounded-xl border-[#E2E8F0]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    Data Final
                  </label>
                  <Input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="h-9 text-xs rounded-xl border-[#E2E8F0]"
                  />
                </div>
              </>
            ) : (
              /* Empresa Filter */
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Empresa / Cliente
                </label>
                <Select value={empresaId} onValueChange={setEmpresaId}>
                  <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                    <SelectValue placeholder="Todas as Empresas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as Empresas</SelectItem>
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.nome_fantasia || emp.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Reload button */}
            <div className="flex items-end">
              <Button
                onClick={loadRelatorios}
                disabled={loading}
                className="w-full h-9 rounded-xl bg-[#0B1F3A] hover:bg-[#123B6D] text-white text-xs font-semibold shadow-xs"
              >
                {loading ? 'Atualizando...' : 'Atualizar Relatório'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'fechamento' | 'produtividade')}
        className="space-y-6"
      >
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger
            value="fechamento"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-[#0FA3A3] data-[state=active]:shadow-2xs"
          >
            <Building2 className="h-3.5 w-3.5 mr-2" />
            1. Fechamento por Empresa
          </TabsTrigger>
          <TabsTrigger
            value="produtividade"
            className="rounded-lg text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-[#0FA3A3] data-[state=active]:shadow-2xs"
          >
            <Users className="h-3.5 w-3.5 mr-2" />
            2. Produtividade por Usuário
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Fechamento por Empresa */}
        <TabsContent value="fechamento" className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                    Docs Recebidos
                  </p>
                  <p className="text-2xl font-bold text-[#1A2333] mt-0.5">
                    {totaisFechamento.docsRecebidos}
                  </p>
                  <p className="text-[10px] text-amber-600 font-medium">
                    {totaisFechamento.docsPendentes} pendentes
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#3B82F6]">
                  <FileText className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                    Workflows Concluídos
                  </p>
                  <p className="text-2xl font-bold text-[#16A34A] mt-0.5">
                    {totaisFechamento.wfConcluidos}
                  </p>
                  <p className="text-[10px] text-[#64748B]">
                    {totaisFechamento.wfPendentes} em andamento
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#16A34A]">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                    Obrigações Entregues
                  </p>
                  <p className="text-2xl font-bold text-[#0FA3A3] mt-0.5">
                    {totaisFechamento.obEntregues}
                  </p>
                  <p className="text-[10px] text-red-600 font-semibold">
                    {totaisFechamento.obAtrasadas} atrasadas
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-[#0FA3A3]">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                    Total em Guias
                  </p>
                  <p className="text-xl font-bold text-[#0B1F3A] mt-0.5">
                    {totaisFechamento.valorTotal.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </p>
                  <p className="text-[10px] text-[#64748B]">Apuradas no período</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-[#0B1F3A]">
                  <DollarSign className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart Section */}
          <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-[#1A2333]">
                Volume Operacional por Empresa no Período
              </CardTitle>
              <CardDescription className="text-xs text-[#64748B]">
                Comparativo de workflows e obrigações entregues vs pendências
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartFechamento}
                    margin={{ top: 10, right: 20, left: -20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0',
                        fontSize: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="Concluídos" fill="#16A34A" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Pendentes" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Obrigações" fill="#0FA3A3" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Atrasadas" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Table Details */}
          <Card className="rounded-2xl border-[#E2E8F0] shadow-xs overflow-hidden">
            <CardHeader className="border-b border-[#E2E8F0] bg-slate-50/50 py-3 px-4">
              <CardTitle className="text-xs font-bold text-[#1A2333] uppercase tracking-wider">
                Detalhamento do Fechamento por Empresa
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#1A2333]">
                <thead className="border-b border-[#E2E8F0] bg-slate-50 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Empresa</th>
                    <th className="px-4 py-3">Regime</th>
                    <th className="px-4 py-3 text-center">Docs Recebidos</th>
                    <th className="px-4 py-3 text-center">Workflows Concluídos</th>
                    <th className="px-4 py-3 text-center">Obrigações Entregues</th>
                    <th className="px-4 py-3 text-center">Atrasadas</th>
                    <th className="px-4 py-3 text-right">Valor das Guias</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fechamentoData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#94A3B8]">
                        Nenhuma informação encontrada para o período selecionado.
                      </td>
                    </tr>
                  ) : (
                    fechamentoData.map((row) => (
                      <tr key={row.empresaId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-[#0B1F3A]">{row.empresaNome}</p>
                          <p className="text-[10px] text-[#64748B] font-mono">CNPJ: {row.cnpj}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {row.regime.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-center font-semibold">
                          <span>{row.documentosRecebidos}</span>
                          {row.documentosPendentes > 0 && (
                            <span className="text-[10px] text-amber-600 block">
                              ({row.documentosPendentes} pendentes)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center font-semibold text-[#16A34A]">
                          <span>{row.workflowsConcluidos}</span>
                          {row.workflowsPendentes > 0 && (
                            <span className="text-[10px] text-[#64748B] block font-normal">
                              ({row.workflowsPendentes} abertos)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center font-semibold text-[#0FA3A3]">
                          {row.obrigacoesEntregues}
                        </td>
                        <td className="px-4 py-3.5 text-center font-bold">
                          {row.obrigacoesAtrasadas > 0 ? (
                            <span className="text-[#DC2626] bg-red-50 px-2 py-0.5 rounded-full text-[10px]">
                              {row.obrigacoesAtrasadas}
                            </span>
                          ) : (
                            <span className="text-[#94A3B8]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold">
                          {row.totalObrigacoesValor > 0
                            ? row.totalObrigacoesValor.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })
                            : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* TAB 2: Produtividade por Usuário */}
        <TabsContent value="produtividade" className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                    Workflows Atribuídos
                  </p>
                  <p className="text-2xl font-bold text-[#1A2333] mt-0.5">
                    {totaisProdutividade.wfTratados}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#3B82F6]">
                  <Clock className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                    Workflows Finalizados
                  </p>
                  <p className="text-2xl font-bold text-[#16A34A] mt-0.5">
                    {totaisProdutividade.wfConcluidos}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#16A34A]">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                    Obrigações Entregues
                  </p>
                  <p className="text-2xl font-bold text-[#0FA3A3] mt-0.5">
                    {totaisProdutividade.obEntregues}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-[#0FA3A3]">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                    Obrigações Atrasadas
                  </p>
                  <p className="text-2xl font-bold text-[#DC2626] mt-0.5">
                    {totaisProdutividade.obAtrasadas}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-[#DC2626]">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart Section */}
          <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-[#1A2333]">
                Produtividade por Membro da Equipe
              </CardTitle>
              <CardDescription className="text-xs text-[#64748B]">
                Entregas concluídas no período por colaborador
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartProdutividade}
                    margin={{ top: 10, right: 20, left: -20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0',
                        fontSize: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="Workflows" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Obrigações" fill="#0FA3A3" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Table Details */}
          <Card className="rounded-2xl border-[#E2E8F0] shadow-xs overflow-hidden">
            <CardHeader className="border-b border-[#E2E8F0] bg-slate-50/50 py-3 px-4">
              <CardTitle className="text-xs font-bold text-[#1A2333] uppercase tracking-wider">
                Métricas Individuais de Desempenho
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#1A2333]">
                <thead className="border-b border-[#E2E8F0] bg-slate-50 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Colaborador</th>
                    <th className="px-4 py-3">Perfil</th>
                    <th className="px-4 py-3 text-center">Workflows Tratados</th>
                    <th className="px-4 py-3 text-center">Workflows Concluídos</th>
                    <th className="px-4 py-3 text-center">Obrigações Entregues</th>
                    <th className="px-4 py-3 text-center">Obrigações Atrasadas</th>
                    <th className="px-4 py-3 text-right">Tempo Médio Conclusão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {produtividadeData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#94A3B8]">
                        Nenhum dado encontrado para o período.
                      </td>
                    </tr>
                  ) : (
                    produtividadeData.map((row) => (
                      <tr key={row.userId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-[#0B1F3A]">{row.userName}</p>
                          <p className="text-[10px] text-[#64748B]">{row.email}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge className="bg-[#0FA3A3] text-white text-[10px] uppercase">
                            {row.perfil}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-center font-semibold text-[#1A2333]">
                          {row.workflowsTratados}
                        </td>
                        <td className="px-4 py-3.5 text-center font-semibold text-[#16A34A]">
                          {row.workflowsConcluidos}
                        </td>
                        <td className="px-4 py-3.5 text-center font-semibold text-[#0FA3A3]">
                          {row.obrigacoesEntregues}
                        </td>
                        <td className="px-4 py-3.5 text-center font-bold">
                          {row.obrigacoesAtrasadas > 0 ? (
                            <span className="text-[#DC2626] bg-red-50 px-2 py-0.5 rounded-full text-[10px]">
                              {row.obrigacoesAtrasadas}
                            </span>
                          ) : (
                            <span className="text-[#94A3B8]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold">
                          {row.tempoMedioConclusaoHoras > 0
                            ? `${row.tempoMedioConclusaoHoras}h`
                            : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

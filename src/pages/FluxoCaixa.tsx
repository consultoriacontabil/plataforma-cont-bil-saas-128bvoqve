import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Building2,
  Calendar,
  Download,
  Filter,
  DollarSign,
  AlertOctagon,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  ChevronDown,
  Layers,
  Sparkles,
  RefreshCw,
  Wallet,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts'
import { useAuth } from '@/contexts/AuthContext'
import { empresasService } from '@/services/empresas'
import { financeiroService } from '@/services/financeiro'
import type {
  Empresa,
  ContaBancariaRecord,
  DFCFluxoResultado,
  FluxoCaixaCompetenciaResumo,
  FluxoCaixaItemProjecao,
} from '@/types'
import { formatDatePtBr } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

export default function FluxoCaixaPage() {
  const { tenant, user, hasPermission } = useAuth()
  const { toast } = useToast()

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('all')
  const [contasBancarias, setContasBancarias] = useState<ContaBancariaRecord[]>([])
  const [selectedContaId, setSelectedContaId] = useState<string>('all')

  // Período padrão: 01/09/2026 até 31/10/2026 (ou dinâmico)
  const [dataInicio, setDataInicio] = useState<string>('2026-09-01')
  const [dataFim, setDataFim] = useState<string>('2026-10-31')
  const [agrupamento, setAgrupamento] = useState<'semana' | 'mes'>('semana')
  const [tipoGrafico, setTipoGrafico] = useState<'barras' | 'linha'>('barras')

  // Dados calculados
  const [dfcData, setDfcData] = useState<DFCFluxoResultado | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [expandedPeriodo, setExpandedPeriodo] = useState<string | null>(null)

  // Filtro de pesquisa rápida na tabela de detalhamento
  const [buscaTabela, setBuscaTabela] = useState<string>('')
  const [filtroOrigem, setFiltroOrigem] = useState<'todos' | 'realizado' | 'previsto'>('todos')

  const canAccess = hasPermission(['administrador', 'contador', 'auxiliar', 'consultor'])

  // Carregar empresas e contas
  useEffect(() => {
    if (!tenant?.id) return
    const fetchBase = async () => {
      try {
        const [empList, cbList] = await Promise.all([
          empresasService.list(tenant.id),
          financeiroService.listContasBancarias(tenant.id),
        ])
        setEmpresas(empList)
        setContasBancarias(cbList)
      } catch (err) {
        console.error('Erro ao carregar dados base:', err)
      }
    }
    fetchBase()
  }, [tenant?.id])

  // Carregar e processar DFC / Fluxo
  const carregarRelatorio = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const res = await financeiroService.calcularFluxoCaixaEDFC({
        tenantId: tenant.id,
        empresaId: selectedEmpresaId,
        contaBancariaId: selectedContaId,
        dataInicio,
        dataFim,
        agrupamento,
      })
      setDfcData(res)
    } catch (err) {
      console.error('Erro ao calcular DFC e Fluxo de Caixa:', err)
      toast({
        variant: 'destructive',
        title: 'Erro no cálculo do fluxo de caixa',
        description: 'Não foi possível compilar os dados projetados.',
      })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, selectedEmpresaId, selectedContaId, dataInicio, dataFim, agrupamento, toast])

  useEffect(() => {
    carregarRelatorio()
  }, [carregarRelatorio])

  // Preparar dados do gráfico
  const chartData = useMemo(() => {
    if (!dfcData) return []
    return dfcData.competencias.map((c) => ({
      periodo: c.periodoRotulo,
      entradas: c.totalEntradas,
      entradasRealizadas: c.entradasRealizadas,
      entradasPrevistas: c.entradasPrevistas,
      saidas: c.totalSaidas,
      saidasRealizadas: c.saidasRealizadas,
      saidasPrevistas: c.saidasPrevistas,
      saldoFinal: c.saldoFinal,
      isNegativo: c.isNegativo,
    }))
  }, [dfcData])

  // Itens filtrados para a visão detalhada
  const itensFiltrados = useMemo(() => {
    if (!dfcData) return []
    return dfcData.itensDetalhados.filter((item) => {
      if (filtroOrigem !== 'todos' && item.origem !== filtroOrigem) return false
      if (!buscaTabela.trim()) return true
      const q = buscaTabela.toLowerCase()
      return (
        item.descricao.toLowerCase().includes(q) ||
        item.pessoa.toLowerCase().includes(q) ||
        (item.documento && item.documento.toLowerCase().includes(q)) ||
        (item.empresaNome && item.empresaNome.toLowerCase().includes(q))
      )
    })
  }, [dfcData, filtroOrigem, buscaTabela])

  // Exportar Relatório para CSV
  const handleExportarCsv = () => {
    if (!dfcData) return
    const linhas: string[] = []
    linhas.push('RELATÓRIO DE FLUXO DE CAIXA E DFC PROJETADO - RUMO CONSULTORIA CONTÁBIL')
    linhas.push(`Gerado em:;${new Date().toLocaleString('pt-BR')}`)
    linhas.push(`Escopo Empresa:;${selectedEmpresaId === 'all' ? 'Todas' : selectedEmpresaId}`)
    linhas.push(`Conta Bancária:;${selectedContaId === 'all' ? 'Todas' : selectedContaId}`)
    linhas.push(`Período:;${dataInicio} até ${dataFim}`)
    linhas.push('')
    linhas.push('RESUMO POR COMPETÊNCIA / SEMANA')
    linhas.push(
      'Período;Saldo Inicial;Entradas Realizadas;Entradas Previstas;Total Entradas;Saídas Realizadas;Saídas Previstas;Total Saídas;Resultado Líquido;Saldo Final Projetado;Alerta Negativo',
    )

    dfcData.competencias.forEach((c) => {
      linhas.push(
        [
          `"${c.periodoRotulo}"`,
          c.saldoInicial.toFixed(2),
          c.entradasRealizadas.toFixed(2),
          c.entradasPrevistas.toFixed(2),
          c.totalEntradas.toFixed(2),
          c.saidasRealizadas.toFixed(2),
          c.saidasPrevistas.toFixed(2),
          c.totalSaidas.toFixed(2),
          c.resultadoPeriodo.toFixed(2),
          c.saldoFinal.toFixed(2),
          c.isNegativo ? 'SIM' : 'NÃO',
        ].join(';'),
      )
    })

    linhas.push('')
    linhas.push('MOVIMENTAÇÕES DETALHADAS (REALIZADAS E PROJETADAS)')
    linhas.push('Data;Tipo;Origem;Favorecido/Cliente;Descrição;Documento;Empresa;Conta;Valor (R$)')
    dfcData.itensDetalhados.forEach((it) => {
      linhas.push(
        [
          it.data,
          it.tipo.toUpperCase(),
          it.origem === 'realizado' ? 'REALIZADO' : 'PROJETADO',
          `"${it.pessoa}"`,
          `"${it.descricao}"`,
          `"${it.documento || ''}"`,
          `"${it.empresaNome || ''}"`,
          `"${it.contaBancariaNome || ''}"`,
          it.valor.toFixed(2),
        ].join(';'),
      )
    })

    const blob = new Blob(['\ufeff' + linhas.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fluxo_caixa_dfc_${dataInicio}_${dataFim}.csv`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: 'Exportação concluída!',
      description: 'O arquivo CSV do Fluxo de Caixa e DFC foi baixado com sucesso.',
    })
  }

  if (!canAccess) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center space-y-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
          <AlertOctagon className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-[#1A2333]">Acesso Restrito ao Módulo Financeiro</h2>
        <p className="max-w-md text-xs text-[#64748B]">
          Seu perfil de usuário não possui permissão para visualizar relatórios de tesouraria, fluxo
          de caixa ou projeções bancárias. Entre em contato com o administrador do escritório.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Top Header & Controles de Filtros */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-[#E2E8F0] pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-[#0FA3A3] shadow-xs">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-[#1A2333]">
                Fluxo de Caixa & DFC Projetado
              </h1>
              <Badge className="bg-teal-100 text-[#0FA3A3] border-teal-200 text-[10px] uppercase font-bold">
                DFC Indireto
              </Badge>
            </div>
            <p className="text-xs text-[#64748B]">
              Movimento bancário conciliado somado à projeção de títulos a pagar e receber por data
              de vencimento
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => carregarRelatorio()}
            variant="outline"
            size="sm"
            className="h-9 text-xs rounded-xl border-[#E2E8F0] gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Atualizar</span>
          </Button>

          <Button
            onClick={handleExportarCsv}
            size="sm"
            className="h-9 text-xs rounded-xl bg-[#0FA3A3] text-white hover:bg-[#0C8585] gap-1.5 shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Exportar CSV</span>
          </Button>
        </div>
      </div>

      {/* Painel de Filtros: Empresa, Conta Bancária, Intervalo e Agrupamento */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-xs bg-white">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <Label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">
                Empresa
              </Label>
              <Select value={selectedEmpresaId} onValueChange={setSelectedEmpresaId}>
                <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs bg-slate-50/50">
                  <SelectValue placeholder="Todas as empresas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as empresas</SelectItem>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome_fantasia || e.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">
                Conta Bancária
              </Label>
              <Select value={selectedContaId} onValueChange={setSelectedContaId}>
                <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs bg-slate-50/50">
                  <SelectValue placeholder="Todas as contas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as contas</SelectItem>
                  {contasBancarias.map((cb) => (
                    <SelectItem key={cb.id} value={cb.id}>
                      {cb.banco} (Ag. {cb.agencia})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">
                De (Data Inicial)
              </Label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">
                Até (Data Final)
              </Label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">
                Projeção por
              </Label>
              <Select
                value={agrupamento}
                onValueChange={(v) => setAgrupamento(v as 'semana' | 'mes')}
              >
                <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs bg-slate-50/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semana">Semanas (Curto Prazo)</SelectItem>
                  <SelectItem value="mes">Competências / Mês</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Métricas Principais do Fluxo */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-[#64748B]">Saldo Inicial Geral</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-[#1A2333]">
              R${' '}
              {(dfcData?.saldoInicialGeral || 0).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}
            </div>
            <p className="mt-1 text-[11px] text-[#64748B]">Soma dos saldos iniciais das contas</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-[#64748B]">Entradas Totais</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <ArrowDownLeft className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-emerald-600">
              R${' '}
              {(
                (dfcData?.totalEntradasRealizadas || 0) + (dfcData?.totalEntradasPrevistas || 0)
              ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="mt-1 text-[11px] text-emerald-700">
              Realizado: R${' '}
              {(dfcData?.totalEntradasRealizadas || 0).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}{' '}
              | Previsto: R${' '}
              {(dfcData?.totalEntradasPrevistas || 0).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-[#64748B]">Saídas Totais</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-rose-600">
              R${' '}
              {(
                (dfcData?.totalSaidasRealizadas || 0) + (dfcData?.totalSaidasPrevistas || 0)
              ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="mt-1 text-[11px] text-rose-700">
              Realizado: R${' '}
              {(dfcData?.totalSaidasRealizadas || 0).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}{' '}
              | Previsto: R${' '}
              {(dfcData?.totalSaidasPrevistas || 0).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            'rounded-2xl border shadow-xs transition-all',
            (dfcData?.saldoFinalProjetado || 0) < 0
              ? 'border-red-300 bg-red-50/40 text-red-950'
              : 'border-[#E2E8F0] bg-slate-900 text-white',
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span
              className={cn(
                'text-xs font-semibold',
                (dfcData?.saldoFinalProjetado || 0) < 0 ? 'text-red-700' : 'text-slate-400',
              )}
            >
              Saldo Final Projetado
            </span>
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg',
                (dfcData?.saldoFinalProjetado || 0) < 0
                  ? 'bg-red-200 text-red-800'
                  : 'bg-white/10 text-teal-300',
              )}
            >
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'text-2xl font-extrabold',
                (dfcData?.saldoFinalProjetado || 0) < 0 ? 'text-red-600' : 'text-white',
              )}
            >
              R${' '}
              {(dfcData?.saldoFinalProjetado || 0).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}
            </div>
            <p
              className={cn(
                'mt-1 text-[11px] font-medium flex items-center gap-1',
                (dfcData?.saldoFinalProjetado || 0) < 0 ? 'text-red-600' : 'text-teal-300',
              )}
            >
              {(dfcData?.saldoFinalProjetado || 0) < 0 ? (
                <>
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Atenção: Saldo projetado em deficit</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Fluxo de caixa saudável no período</span>
                </>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos de Evolução do Saldo e Entradas vs Saídas */}
      <Card className="rounded-3xl border-[#E2E8F0] bg-white shadow-2xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-[#E2E8F0]">
          <div>
            <CardTitle className="text-base font-bold text-[#1A2333]">
              Projeção Financeira: Entradas, Saídas e Evolução do Saldo
            </CardTitle>
            <CardDescription className="text-xs">
              Comparativo das movimentações estimadas e saldo cumulativo da tesouraria
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            <Button
              variant={tipoGrafico === 'barras' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTipoGrafico('barras')}
              className={cn(
                'h-7 text-xs rounded-lg',
                tipoGrafico === 'barras' && 'bg-[#0FA3A3] text-white',
              )}
            >
              Entradas vs. Saídas
            </Button>
            <Button
              variant={tipoGrafico === 'linha' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTipoGrafico('linha')}
              className={cn(
                'h-7 text-xs rounded-lg',
                tipoGrafico === 'linha' && 'bg-[#0FA3A3] text-white',
              )}
            >
              Evolução do Saldo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="h-80 w-full">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-[#94A3B8]">
                Nenhum dado financeiro para renderizar no período selecionado.
              </div>
            ) : tipoGrafico === 'barras' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val: unknown) => [
                      `R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                      '',
                    ]}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar
                    dataKey="entradas"
                    name="Entradas (Realizadas + Previstas)"
                    fill="#10B981"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="saidas"
                    name="Saídas (Realizadas + Previstas)"
                    fill="#EF4444"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val: unknown) => [
                      `R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                      'Saldo Projetado',
                    ]}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                    }}
                  />
                  <ReferenceLine y={0} stroke="#EF4444" strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="saldoFinal"
                    name="Saldo Acumulado (R$)"
                    stroke="#0FA3A3"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#0FA3A3' }}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabela Resumo por Competência com Alerta Visual de Saldo Negativo */}
      <Card className="rounded-3xl border-[#E2E8F0] bg-white shadow-2xs overflow-hidden">
        <CardHeader className="border-b border-[#E2E8F0] pb-3">
          <CardTitle className="text-base font-bold text-[#1A2333]">
            Quadro Demonstrativo de Fluxo de Caixa (DFC) por Período
          </CardTitle>
          <CardDescription className="text-xs">
            Acompanhe o saldo inicial, fluxos operacionais e o fechamento projetado. Períodos com
            saldo negativo são sinalizados com destaque visual.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[#64748B] font-semibold border-b border-[#E2E8F0]">
                <tr>
                  <th className="py-3.5 px-4">Período / Competência</th>
                  <th className="py-3.5 px-4 text-right">Saldo Inicial</th>
                  <th className="py-3.5 px-4 text-right text-emerald-700">Entradas (Real/Prev)</th>
                  <th className="py-3.5 px-4 text-right text-rose-700">Saídas (Real/Prev)</th>
                  <th className="py-3.5 px-4 text-right">Resultado do Período</th>
                  <th className="py-3.5 px-4 text-right">Saldo Final Projetado</th>
                  <th className="py-3.5 px-4 text-center">Situação</th>
                  <th className="py-3.5 px-4 text-center">Itens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[#1A2333]">
                {!dfcData || dfcData.competencias.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-[#94A3B8]">
                      Nenhuma competência encontrada para o filtro selecionado.
                    </td>
                  </tr>
                ) : (
                  dfcData.competencias.map((c) => {
                    const isExpanded = expandedPeriodo === c.periodoRotulo

                    return (
                      <React.Fragment key={c.periodoRotulo}>
                        <tr
                          className={cn(
                            'hover:bg-slate-50/70 transition-colors cursor-pointer',
                            c.isNegativo && 'bg-red-50/30',
                          )}
                          onClick={() => setExpandedPeriodo(isExpanded ? null : c.periodoRotulo)}
                        >
                          <td className="py-3.5 px-4 font-bold text-[#1A2333]">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-[#0FA3A3]" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-[#94A3B8]" />
                              )}
                              <span>{c.periodoRotulo}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-[#64748B]">
                            R${' '}
                            {c.saldoInicial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-emerald-600 font-semibold">
                            + R${' '}
                            {c.totalEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            <span className="block text-[10px] text-[#94A3B8]">
                              (
                              {c.entradasRealizadas > 0
                                ? `R$ ${c.entradasRealizadas.toFixed(0)} real`
                                : ''}
                              {c.entradasPrevistas > 0
                                ? ` + R$ ${c.entradasPrevistas.toFixed(0)} prev`
                                : ''}
                              )
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-rose-600 font-semibold">
                            - R${' '}
                            {c.totalSaidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            <span className="block text-[10px] text-[#94A3B8]">
                              (
                              {c.saidasRealizadas > 0
                                ? `R$ ${c.saidasRealizadas.toFixed(0)} real`
                                : ''}
                              {c.saidasPrevistas > 0
                                ? ` + R$ ${c.saidasPrevistas.toFixed(0)} prev`
                                : ''}
                              )
                            </span>
                          </td>
                          <td
                            className={cn(
                              'py-3.5 px-4 text-right font-mono font-bold',
                              c.resultadoPeriodo >= 0 ? 'text-emerald-600' : 'text-rose-600',
                            )}
                          >
                            {c.resultadoPeriodo >= 0 ? '+ ' : ''}R${' '}
                            {c.resultadoPeriodo.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td
                            className={cn(
                              'py-3.5 px-4 text-right font-mono font-extrabold',
                              c.isNegativo ? 'text-red-600 text-sm' : 'text-[#1A2333]',
                            )}
                          >
                            R$ {c.saldoFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {c.isNegativo ? (
                              <Badge className="bg-[#FEE2E2] text-[#DC2626] border-rose-200 gap-1 font-bold animate-pulse">
                                <AlertTriangle className="h-3 w-3" />
                                <span>Saldo Negativo</span>
                              </Badge>
                            ) : (
                              <Badge className="bg-[#DCFCE7] text-[#16A34A] border-emerald-200">
                                Positivo
                              </Badge>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center text-[#64748B]">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium">
                              {c.itens.length} mov.
                            </span>
                          </td>
                        </tr>

                        {/* Detalhes expandidos da competência */}
                        {isExpanded && (
                          <tr className="bg-slate-50/60">
                            <td colSpan={8} className="p-4 border-t border-slate-200">
                              <div className="space-y-2">
                                <p className="font-semibold text-xs text-[#1A2333]">
                                  Lançamentos que compõem {c.periodoRotulo}:
                                </p>
                                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                  <table className="w-full text-left text-[11px]">
                                    <thead className="bg-slate-100 text-[#64748B] font-medium">
                                      <tr>
                                        <th className="py-2 px-3">Data</th>
                                        <th className="py-2 px-3">Origem</th>
                                        <th className="py-2 px-3">Tipo</th>
                                        <th className="py-2 px-3">Favorecido / Pessoa</th>
                                        <th className="py-2 px-3">Descrição</th>
                                        <th className="py-2 px-3 text-right">Valor</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {c.itens.map((it) => (
                                        <tr key={it.id} className="hover:bg-slate-50">
                                          <td className="py-2 px-3">{formatDatePtBr(it.data)}</td>
                                          <td className="py-2 px-3">
                                            <Badge
                                              variant="outline"
                                              className={cn(
                                                'text-[10px]',
                                                it.origem === 'realizado'
                                                  ? 'text-teal-700 bg-teal-50 border-teal-200'
                                                  : 'text-amber-700 bg-amber-50 border-amber-200',
                                              )}
                                            >
                                              {it.origem === 'realizado' ? 'Realizado' : 'Previsto'}
                                            </Badge>
                                          </td>
                                          <td className="py-2 px-3">
                                            <span
                                              className={cn(
                                                'font-semibold',
                                                it.tipo === 'entrada'
                                                  ? 'text-emerald-600'
                                                  : 'text-rose-600',
                                              )}
                                            >
                                              {it.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                                            </span>
                                          </td>
                                          <td className="py-2 px-3 font-medium text-[#1A2333]">
                                            {it.pessoa}
                                          </td>
                                          <td className="py-2 px-3 text-[#64748B] max-w-xs truncate">
                                            {it.descricao}
                                          </td>
                                          <td
                                            className={cn(
                                              'py-2 px-3 text-right font-mono font-bold',
                                              it.tipo === 'entrada'
                                                ? 'text-emerald-600'
                                                : 'text-rose-600',
                                            )}
                                          >
                                            {it.tipo === 'entrada' ? '+ ' : '- '}R${' '}
                                            {it.valor.toLocaleString('pt-BR', {
                                              minimumFractionDigits: 2,
                                            })}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Tabela com Todos os Lançamentos Detalhados e Busca */}
      <Card className="rounded-3xl border-[#E2E8F0] bg-white shadow-2xs">
        <CardHeader className="border-b border-[#E2E8F0] pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-[#1A2333]">
                Extrato Consolidado do Período ({itensFiltrados.length} movimentações)
              </CardTitle>
              <CardDescription className="text-xs">
                Todas as linhas realizadas e projetadas consideradas no cálculo do fluxo
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Buscar por descrição, pessoa, NF..."
                value={buscaTabela}
                onChange={(e) => setBuscaTabela(e.target.value)}
                className="h-8 w-56 text-xs rounded-xl border-[#E2E8F0]"
              />

              <Select
                value={filtroOrigem}
                onValueChange={(v) => setFiltroOrigem(v as 'todos' | 'realizado' | 'previsto')}
              >
                <SelectTrigger className="h-8 w-32 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="realizado">Realizados</SelectItem>
                  <SelectItem value="previsto">Previstos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[#64748B] font-semibold border-b border-[#E2E8F0] sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-4">Data Ref.</th>
                  <th className="py-3 px-4">Origem</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Favorecido / Pagador</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4">Empresa</th>
                  <th className="py-3 px-4">Conta Bancária</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[#1A2333]">
                {itensFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#94A3B8]">
                      Nenhuma movimentação atende aos critérios de busca.
                    </td>
                  </tr>
                ) : (
                  itensFiltrados.map((it) => (
                    <tr key={it.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">{formatDatePtBr(it.data)}</td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px]',
                            it.origem === 'realizado'
                              ? 'text-teal-700 bg-teal-50 border-teal-200'
                              : 'text-amber-700 bg-amber-50 border-amber-200',
                          )}
                        >
                          {it.origem === 'realizado' ? 'Realizado' : 'Previsto (A Vencer)'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            'font-semibold',
                            it.tipo === 'entrada' ? 'text-emerald-600' : 'text-rose-600',
                          )}
                        >
                          {it.tipo === 'entrada' ? 'Entrada (+)' : 'Saída (-)'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-[#1A2333]">{it.pessoa}</td>
                      <td className="py-3 px-4 text-[#64748B] max-w-xs truncate">{it.descricao}</td>
                      <td className="py-3 px-4 text-[#475569]">{it.empresaNome || '—'}</td>
                      <td className="py-3 px-4 text-[#64748B]">{it.contaBancariaNome || '—'}</td>
                      <td
                        className={cn(
                          'py-3 px-4 text-right font-mono font-bold',
                          it.tipo === 'entrada' ? 'text-emerald-600' : 'text-rose-600',
                        )}
                      >
                        {it.tipo === 'entrada' ? '+ ' : '- '}R${' '}
                        {it.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

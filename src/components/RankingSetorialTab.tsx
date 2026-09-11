import React, { useState, useMemo } from 'react'
import {
  Building2,
  TrendingUp,
  Percent,
  Download,
  Printer,
  Search,
  Filter,
  Layers,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Briefcase,
  SlidersHorizontal,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip as TooltipUI,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type {
  RelatorioSetorialCarteira,
  EmpresaImpactoSetorial,
} from '@/services/relatorioSetorial'
import { relatorioSetorialService } from '@/services/relatorioSetorial'
import { SETORES_CONFIG, SetorAtividade } from '@/lib/reformaTributaria/parametros'
import { RelatorioSetorialModal } from './RelatorioSetorialModal'
import { ApresentacaoExecutivaModal } from './ApresentacaoExecutivaModal'
import { PainelMonitoramentoTrimestral } from './PainelMonitoramentoTrimestral'

interface RankingSetorialTabProps {
  relatorio: RelatorioSetorialCarteira | null
  loading: boolean
  onRecarregar: () => void
  tenantNome?: string
  tenantId?: string
  usuarioId?: string
  canExecute?: boolean
  crcEscritorio?: string
  onAbrirSimulacaoEmpresa?: (empresaId: string) => void
}

export function RankingSetorialTab({
  relatorio,
  loading,
  onRecarregar,
  tenantNome,
  tenantId,
  usuarioId,
  canExecute,
  crcEscritorio,
  onAbrirSimulacaoEmpresa,
}: RankingSetorialTabProps) {
  // Filtros locais
  const [busca, setBusca] = useState('')
  const [setorFiltro, setSetorFiltro] = useState<string>('todos')
  const [tratamentoFiltro, setTratamentoFiltro] = useState<string>('todos')
  const [ordenacao, setOrdenacao] = useState<
    'impacto_desc' | 'impacto_asc' | 'faturamento_desc' | 'variacao_desc'
  >('impacto_desc')

  // Modal de impressão do relatório setorial
  const [modalImprimirOpen, setModalImprimirOpen] = useState(false)

  // Modal de apresentação executiva individual ao cliente
  const [empresaApresentacao, setEmpresaApresentacao] = useState<EmpresaImpactoSetorial | null>(
    null,
  )

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  // Empresas filtradas e ordenadas
  const empresasFiltradas = useMemo(() => {
    if (!relatorio) return []

    let lista = [...relatorio.rankingEmpresas]

    // 1. Filtro de busca textual (nome, CNPJ, CNAE)
    if (busca.trim()) {
      const q = busca.toLowerCase().trim()
      lista = lista.filter((e) => {
        return (
          e.razaoSocial.toLowerCase().includes(q) ||
          (e.nomeFantasia && e.nomeFantasia.toLowerCase().includes(q)) ||
          e.cnpj.includes(q) ||
          (e.cnaeDetectado && e.cnaeDetectado.toLowerCase().includes(q))
        )
      })
    }

    // 2. Filtro de Setor
    if (setorFiltro !== 'todos') {
      lista = lista.filter((e) => e.setor === setorFiltro)
    }

    // 3. Filtro de Tratamento
    if (tratamentoFiltro === 'favorecido') {
      lista = lista.filter((e) => e.tratamentoFavorecido)
    } else if (tratamentoFiltro === 'geral') {
      lista = lista.filter((e) => !e.tratamentoFavorecido)
    } else if (tratamentoFiltro === 'insuficiente') {
      lista = lista.filter((e) => !e.dadosSuficientes)
    }

    // 4. Ordenação (respeitando manter insuficientes no final se ordenando por impacto)
    lista.sort((a, b) => {
      if (!a.dadosSuficientes && b.dadosSuficientes) return 1
      if (a.dadosSuficientes && !b.dadosSuficientes) return -1
      if (!a.dadosSuficientes && !b.dadosSuficientes)
        return a.razaoSocial.localeCompare(b.razaoSocial)

      switch (ordenacao) {
        case 'impacto_desc':
          return b.impactoAcumuladoReais - a.impactoAcumuladoReais
        case 'impacto_asc':
          return a.impactoAcumuladoReais - b.impactoAcumuladoReais
        case 'faturamento_desc':
          return b.faturamentoBase - a.faturamentoBase
        case 'variacao_desc':
          return b.variacao2033Percentual - a.variacao2033Percentual
        default:
          return 0
      }
    })

    return lista
  }, [relatorio, busca, setorFiltro, tratamentoFiltro, ordenacao])

  // Dados para o Gráfico de Barras por Setor
  const dadosGraficoSetores = useMemo(() => {
    if (!relatorio) return []
    return relatorio.setoresResumo.map((s) => {
      // Nome encurtado para o eixo X
      let nomeCurto = s.setorNome.split('/')[0].replace('Serviços em ', '').trim()
      if (nomeCurto.length > 18) nomeCurto = nomeCurto.substring(0, 16) + '...'
      return {
        setorCompleto: s.setorNome,
        nome: nomeCurto,
        empresas: s.quantidadeEmpresas,
        impactoAcumulado: s.impactoAcumuladoTotal,
        cargaAtual: s.cargaAtualTotal,
        carga2033: s.carga2033Total,
        reducao60: s.reducao60,
      }
    })
  }, [relatorio])

  // Download do arquivo CSV
  const handleDownloadCsv = () => {
    if (!relatorio) return
    const csvContent = relatorioSetorialService.gerarCsvRanking(relatorio, tenantNome)
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute(
      'download',
      `ranking-impacto-setorial-reforma-${new Date().toISOString().slice(0, 10)}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Contagem de empresas em setores com redução de 60%
  const totalFavorecidos60 = useMemo(() => {
    if (!relatorio) return 0
    return relatorio.rankingEmpresas.filter((e) => e.tratamentoFavorecido).length
  }, [relatorio])

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="h-9 w-9 border-3 border-[#0FA3A3] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-[#1A2333]">
          Processando impacto setorial da carteira...
        </p>
        <p className="text-xs text-[#64748B]">
          Consultando lançamentos contábeis, regimes tributários e aplicando regras da LC 214/2025.
        </p>
      </div>
    )
  }

  if (!relatorio || relatorio.totalEmpresasAnalisadas === 0) {
    return (
      <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
        <CardContent className="py-16 text-center space-y-3">
          <Building2 className="h-10 w-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-[#1A2333]">
            Nenhuma empresa cadastrada na carteira
          </h3>
          <p className="text-xs text-[#64748B] max-w-md mx-auto">
            Cadastre clientes no módulo de Empresas para gerar o ranking setorial e avaliar o
            impacto da reforma tributária.
          </p>
          <Button
            onClick={onRecarregar}
            variant="outline"
            size="sm"
            className="gap-2 rounded-xl text-xs h-9 mt-2"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Recarregar Carteira</span>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* SEÇÃO 1: PAINEL DE MONITORAMENTO TRIMESTRAL */}
      {tenantId && (
        <PainelMonitoramentoTrimestral
          tenantId={tenantId}
          tenantNome={tenantNome}
          usuarioId={usuarioId}
          canExecute={canExecute}
          onAnaliseConcluida={onRecarregar}
        />
      )}

      {/* BARRA SUPERIOR DE AÇÕES & ATUALIZAÇÃO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#123B6D] to-[#0FA3A3] text-white flex items-center justify-center font-bold shadow-xs">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm md:text-base font-bold text-[#1A2333]">
                Diagnóstico Setorial da Carteira de Clientes
              </h3>
              <Badge className="bg-[#0FA3A3] text-white text-[10px] uppercase font-bold">
                EC 132 & LC 214
              </Badge>
              {relatorio.rankingEmpresas[0]?.calculada?.parametrosUtilizados?.isCustomizado && (
                <Badge className="bg-teal-700 text-white text-[10px] uppercase font-bold">
                  Parâmetros Customizados
                </Badge>
              )}
            </div>
            <p className="text-xs text-[#64748B]">
              Estratificação de risco e oportunidades com base em lançamentos contábeis reais e
              parâmetros legais de transição.
              {relatorio.rankingEmpresas[0]?.calculada?.parametrosUtilizados?.fonte && (
                <span className="block text-[11px] text-teal-700 font-semibold mt-0.5">
                  Fonte normativa adotada:{' '}
                  {relatorio.rankingEmpresas[0].calculada.parametrosUtilizados.fonte}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRecarregar}
            className="gap-1.5 rounded-xl text-xs font-semibold h-9 border-[#E2E8F0]"
            title="Recalcular métricas para toda a carteira"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#64748B]" />
            <span>Recalcular</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadCsv}
            className="gap-1.5 rounded-xl text-xs font-semibold h-9 border-[#E2E8F0]"
            title="Exportar planilha CSV do ranking"
          >
            <Download className="h-3.5 w-3.5 text-[#0FA3A3]" />
            <span>Exportar CSV</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => setModalImprimirOpen(true)}
            className="gap-1.5 rounded-xl text-xs font-semibold h-9 bg-[#123B6D] hover:bg-[#0B1F3A] text-white shadow-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Imprimir Parecer Setorial (PDF)</span>
          </Button>
        </div>
      </div>

      {/* CARDS EXECUTIVOS DE TOPO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Empresas Analisadas */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748B]">Empresas Analisadas</span>
              <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Briefcase className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-[#1A2333] mt-2">
              {relatorio.totalEmpresasAnalisadas}
            </p>
            <div className="flex items-center justify-between mt-1 text-[11px] text-[#64748B]">
              <span>Com dados contábeis:</span>
              <span className="font-semibold text-emerald-700">
                {relatorio.totalEmpresasSuficientes} empresas
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Impacto Total Acumulado */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748B]">Impacto Total Acumulado</span>
              <div
                className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                  relatorio.impactoTotalCarteiraAcumuladoReais > 0
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <p
              className={`text-2xl font-extrabold mt-2 ${
                relatorio.impactoTotalCarteiraAcumuladoReais > 0
                  ? 'text-amber-600'
                  : 'text-emerald-600'
              }`}
            >
              {relatorio.impactoTotalCarteiraAcumuladoReais > 0 ? '+' : ''}
              {formatBRL(relatorio.impactoTotalCarteiraAcumuladoReais)}
            </p>
            <div className="flex items-center justify-between mt-1 text-[11px] text-[#64748B]">
              <span>Período da Transição:</span>
              <span className="font-semibold">2026–2033</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Mais Impactada (Aumento) */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748B]">Maior Impacto (Aumento)</span>
              <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            {relatorio.empresasMaisImpactadasAumento.length > 0 ? (
              <>
                <p
                  className="text-sm font-bold text-[#1A2333] mt-2 truncate"
                  title={relatorio.empresasMaisImpactadasAumento[0].razaoSocial}
                >
                  {relatorio.empresasMaisImpactadasAumento[0].razaoSocial}
                </p>
                <div className="flex items-center justify-between mt-1 text-[11px]">
                  <span className="text-[#64748B]">
                    {relatorio.empresasMaisImpactadasAumento[0].setorNome.split('/')[0]}
                  </span>
                  <span className="font-bold text-rose-600">
                    +{formatBRL(relatorio.empresasMaisImpactadasAumento[0].impactoAcumuladoReais)}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm font-semibold text-[#64748B] mt-2">
                Nenhum aumento identificado
              </p>
            )}
          </CardContent>
        </Card>

        {/* Card 4: Setores com Tratamento Favorecido (Redução 60%) */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748B]">
                Tratamento Favorecido (60%)
              </span>
              <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-emerald-700 mt-2">
              {totalFavorecidos60}{' '}
              <span className="text-xs font-medium text-[#64748B]">clientes</span>
            </p>
            <div className="flex items-center justify-between mt-1 text-[11px] text-[#64748B]">
              <span>LC 214/2025 Art. 9º:</span>
              <span className="font-semibold text-emerald-700">Saúde & Educação</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* GRÁFICO DE BARRAS: IMPACTO ACUMULADO POR SETOR */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm md:text-base font-bold text-[#1A2333] flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#0FA3A3]" />
                Comparativo de Impacto Tributário Acumulado por Setor (2026–2033)
              </CardTitle>
              <CardDescription className="text-xs text-[#64748B]">
                Soma em Reais (R$) da variação de carga de todas as empresas do mesmo segmento.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
                <span className="h-3 w-3 rounded bg-amber-500 inline-block" />
                Aumento de Carga
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
                <span className="h-3 w-3 rounded bg-emerald-500 inline-block" />
                Estabilidade / Economia
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="h-80 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={dadosGraficoSetores}
              margin={{ top: 10, right: 10, left: 20, bottom: 30 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis
                dataKey="nome"
                interval={0}
                angle={-15}
                textAnchor="end"
                tick={{ fontSize: 11, fill: '#64748B' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748B' }}
                tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(val: any) => formatBRL(Number(val) || 0)}
                labelFormatter={(_, arr) => {
                  if (arr && arr[0]?.payload?.setorCompleto) {
                    return arr[0].payload.setorCompleto
                  }
                  return ''
                }}
                contentStyle={{
                  backgroundColor: '#fff',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="impactoAcumulado" name="Impacto Acumulado (R$)" radius={[6, 6, 0, 0]}>
                {dadosGraficoSetores.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.impactoAcumulado > 0 ? '#F59E0B' : '#10B981'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* TABELA / RANKING GERAL COM FILTROS */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-xs overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm md:text-base font-bold text-[#1A2333]">
                Ranking de Empresas da Carteira
              </CardTitle>
              <CardDescription className="text-xs text-[#64748B]">
                Classificação ordenada pelo maior impacto financeiro acumulado da reforma
                (2026–2033).
              </CardDescription>
            </div>

            {/* BARRA DE FILTROS */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Busca Textual */}
              <div className="relative w-48 sm:w-60">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar empresa ou CNPJ..."
                  className="h-8 pl-8 text-xs rounded-xl border-[#E2E8F0] bg-white"
                />
              </div>

              {/* Filtro de Setor */}
              <Select value={setorFiltro} onValueChange={setSetorFiltro}>
                <SelectTrigger className="h-8 text-xs rounded-xl border-[#E2E8F0] bg-white min-w-[140px]">
                  <SelectValue placeholder="Todos os Setores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Setores</SelectItem>
                  {Object.values(SETORES_CONFIG).map((cfg) => (
                    <SelectItem key={cfg.id} value={cfg.id}>
                      {cfg.nome.split('/')[0]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filtro de Tratamento */}
              <Select value={tratamentoFiltro} onValueChange={setTratamentoFiltro}>
                <SelectTrigger className="h-8 text-xs rounded-xl border-[#E2E8F0] bg-white min-w-[130px]">
                  <SelectValue placeholder="Tratamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Regimes</SelectItem>
                  <SelectItem value="favorecido">Redução 60%</SelectItem>
                  <SelectItem value="geral">Regime Padrão</SelectItem>
                  <SelectItem value="insuficiente">Dados Insuficientes</SelectItem>
                </SelectContent>
              </Select>

              {/* Ordenação */}
              <Select value={ordenacao} onValueChange={(v: any) => setOrdenacao(v)}>
                <SelectTrigger className="h-8 text-xs rounded-xl border-[#E2E8F0] bg-white min-w-[150px]">
                  <ArrowUpDown className="h-3 w-3 mr-1 text-[#64748B]" />
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="impacto_desc">Maior Impacto (R$)</SelectItem>
                  <SelectItem value="impacto_asc">Menor Impacto / Economia</SelectItem>
                  <SelectItem value="variacao_desc">Maior Variação %</SelectItem>
                  <SelectItem value="faturamento_desc">Maior Faturamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-slate-100">
              <thead className="bg-slate-100 font-bold text-[10px] uppercase text-[#64748B]">
                <tr>
                  <th className="py-3 px-4">Posição & Empresa</th>
                  <th className="py-3 px-3">Setor & Atividade</th>
                  <th className="py-3 px-3 text-center">Regime</th>
                  <th className="py-3 px-3 text-right">Faturamento Base</th>
                  <th className="py-3 px-3 text-right">Carga Atual</th>
                  <th className="py-3 px-3 text-right">Carga 2033</th>
                  <th className="py-3 px-3 text-right">Impacto Acum. (R$)</th>
                  <th className="py-3 px-3 text-right">Variação %</th>
                  <th className="py-3 px-3 text-center">Tratamento</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {empresasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-xs text-[#94A3B8]">
                      Nenhuma empresa encontrada com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  empresasFiltradas.map((empresa, idx) => (
                    <tr
                      key={empresa.empresaId}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        !empresa.dadosSuficientes ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      {/* Posição e Empresa */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold text-[#94A3B8] w-6">
                            #{idx + 1}
                          </span>
                          <div>
                            <span className="font-bold text-[#1A2333] block">
                              {empresa.razaoSocial}
                            </span>
                            <span className="text-[10px] text-[#64748B] font-mono">
                              {empresa.cnpj}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Setor & CNAE */}
                      <td className="py-3 px-3 max-w-[200px]">
                        <span
                          className="font-medium text-[#1A2333] block truncate"
                          title={empresa.setorNome}
                        >
                          {empresa.setorNome.split('/')[0]}
                        </span>
                        {empresa.cnaeDetectado ? (
                          <span
                            className="text-[10px] text-[#64748B] block truncate"
                            title={empresa.cnaeDetectado}
                          >
                            CNAE: {empresa.cnaeDetectado}
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#94A3B8] block">
                            Atividade declarada
                          </span>
                        )}
                      </td>

                      {/* Regime */}
                      <td className="py-3 px-3 text-center">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] uppercase font-mono font-medium">
                          {empresa.regime.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Faturamento Base & Origem */}
                      <td className="py-3 px-3 text-right font-mono">
                        {empresa.dadosSuficientes ? (
                          <>
                            <span className="font-bold text-[#1A2333]">
                              {formatBRL(empresa.faturamentoBase)}
                            </span>
                            <TooltipProvider>
                              <TooltipUI>
                                <TooltipTrigger asChild>
                                  <span className="block text-[9px] text-[#0FA3A3] cursor-help underline decoration-dotted">
                                    {empresa.origemFaturamento === 'contabil_real'
                                      ? 'Lançamentos Reais'
                                      : empresa.origemFaturamento === 'simulacao_salva'
                                        ? 'Cenário Salvo'
                                        : 'Porte Declarado'}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  {empresa.origemDescricao}
                                </TooltipContent>
                              </TooltipUI>
                            </TooltipProvider>
                          </>
                        ) : (
                          <span className="text-amber-700 font-semibold text-[10px] block">
                            Dados insuficientes
                          </span>
                        )}
                      </td>

                      {/* Carga Atual */}
                      <td className="py-3 px-3 text-right font-mono text-[#64748B]">
                        {empresa.dadosSuficientes ? (
                          <>
                            <span>{formatBRL(empresa.cargaAtualReais)}</span>
                            <span className="block text-[10px] text-[#94A3B8]">
                              {empresa.aliquotaAtualEfetiva}%
                            </span>
                          </>
                        ) : (
                          '-'
                        )}
                      </td>

                      {/* Carga 2033 */}
                      <td className="py-3 px-3 text-right font-mono font-semibold text-[#1A2333]">
                        {empresa.dadosSuficientes ? (
                          <>
                            <span>{formatBRL(empresa.carga2033Reais)}</span>
                            <span className="block text-[10px] text-[#0FA3A3]">
                              {empresa.aliquota2033Efetiva}%
                            </span>
                          </>
                        ) : (
                          '-'
                        )}
                      </td>

                      {/* Impacto Acumulado */}
                      <td
                        className={`py-3 px-3 text-right font-mono font-bold ${
                          !empresa.dadosSuficientes
                            ? 'text-slate-400'
                            : empresa.impactoAcumuladoReais > 0
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                        }`}
                      >
                        {empresa.dadosSuficientes ? (
                          <>
                            {empresa.impactoAcumuladoReais > 0 ? '+' : ''}
                            {formatBRL(empresa.impactoAcumuladoReais)}
                          </>
                        ) : (
                          '-'
                        )}
                      </td>

                      {/* Variação % */}
                      <td className="py-3 px-3 text-right font-mono">
                        {empresa.dadosSuficientes ? (
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              empresa.variacao2033Percentual > 0
                                ? 'bg-amber-100 text-amber-800'
                                : empresa.variacao2033Percentual < 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {empresa.variacao2033Percentual > 0 ? '+' : ''}
                            {empresa.variacao2033Percentual}%
                          </span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-medium">
                            Aviso
                          </span>
                        )}
                      </td>

                      {/* Badge de Tratamento */}
                      <td className="py-3 px-3 text-center">
                        {empresa.tratamentoFavorecido ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px]">
                            Redução 60%
                          </Badge>
                        ) : empresa.regime === 'simples_nacional' ? (
                          <Badge
                            variant="outline"
                            className="border-teal-500/40 text-teal-700 text-[10px]"
                          >
                            Simples 50%
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-600 text-[10px]">
                            Regime Geral
                          </Badge>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEmpresaApresentacao(empresa)}
                            className="h-7 px-2.5 text-[11px] font-semibold text-[#123B6D] hover:bg-slate-100 border-[#E2E8F0] rounded-lg gap-1"
                            title="Gerar Dossiê / Apresentação Executiva em PDF"
                          >
                            <Printer className="h-3 w-3 text-[#0FA3A3]" />
                            <span>Apresentação</span>
                          </Button>

                          {onAbrirSimulacaoEmpresa && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => onAbrirSimulacaoEmpresa(empresa.empresaId)}
                              className="h-7 px-2 text-xs font-semibold text-[#0FA3A3] hover:text-[#0b7d7d] hover:bg-teal-50 rounded-lg"
                            >
                              Simular
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
        </CardContent>
      </Card>

      {/* MODAL IMPRIMÍVEL DO RELATÓRIO SETORIAL */}
      <RelatorioSetorialModal
        open={modalImprimirOpen}
        onOpenChange={setModalImprimirOpen}
        relatorio={relatorio}
        tenantNome={tenantNome}
      />

      {/* MODAL DE APRESENTAÇÃO EXECUTIVA INDIVIDUAL PARA O CLIENTE */}
      <ApresentacaoExecutivaModal
        open={!!empresaApresentacao}
        onOpenChange={(open) => !open && setEmpresaApresentacao(null)}
        empresa={empresaApresentacao}
        tenantNome={tenantNome}
        crcEscritorio={crcEscritorio}
      />
    </div>
  )
}

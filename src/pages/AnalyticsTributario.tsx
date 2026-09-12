import { useState, useEffect, useRef } from 'react'
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  AlertTriangle,
  Info,
  ShieldAlert,
  Download,
  Filter,
  RefreshCw,
  Building2,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle,
  ExternalLink,
  Printer,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { analyticsTributarioService } from '@/services/analyticsTributario'
import type {
  AnalyticsTributarioCarteira,
  InsightDivergencia,
  MesCargaTributaria,
  RankingEmpresaCarga,
  DivergenciaSeveridade,
} from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Link } from 'react-router-dom'

export function AnalyticsTributarioPage() {
  const { tenant } = useAuth()
  const { toast } = useToast()

  const [periodo, setPeriodo] = useState<6 | 12 | 24>(12)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AnalyticsTributarioCarteira | null>(null)
  const [empresaSelecionadaId, setEmpresaSelecionadaId] = useState<string>('todas')
  const [filtroSeveridade, setFiltroSeveridade] = useState<string>('todos')

  const printableRef = useRef<HTMLDivElement>(null)

  const carregarDados = async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const res = await analyticsTributarioService.getAnalytics(tenant.id, periodo)
      setData(res)
    } catch (err: any) {
      console.error('Erro ao carregar analytics tributário:', err)
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível compilar as informações fiscais da carteira.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [tenant?.id, periodo])

  const handleExportPdf = () => {
    window.print()
  }

  // Filtragem de Insights
  const insightsFiltrados = (data?.insightsDivergencias || []).filter((ins) => {
    if (empresaSelecionadaId !== 'todas' && ins.empresaId !== empresaSelecionadaId) {
      return false
    }
    if (filtroSeveridade !== 'todos' && ins.severidade !== filtroSeveridade) {
      return false
    }
    return true
  })

  // Série a exibir (consolidada ou de uma empresa específica)
  const serieExibida: MesCargaTributaria[] =
    empresaSelecionadaId === 'todas'
      ? data?.serieMensalConsolidada || []
      : data?.seriesPorEmpresa[empresaSelecionadaId] || []

  // Calcular pontos para mini gráfico SVG
  const maxTributo = Math.max(...serieExibida.map((s) => s.totalTributos), 1000)
  const maxAliq = Math.max(...serieExibida.map((s) => s.aliquotaEfetiva), 25)

  const getSeveridadeBadge = (sev: DivergenciaSeveridade) => {
    switch (sev) {
      case 'critico':
        return (
          <Badge className="bg-red-600 hover:bg-red-700 text-white gap-1 text-[11px]">
            <AlertTriangle className="w-3 h-3" /> Crítico
          </Badge>
        )
      case 'alerta':
        return (
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1 text-[11px]">
            <AlertTriangle className="w-3 h-3" /> Atenção
          </Badge>
        )
      case 'info':
        return (
          <Badge className="bg-blue-600 hover:bg-blue-700 text-white gap-1 text-[11px]">
            <Info className="w-3 h-3" /> Oportunidade
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6 animate-fade-in" ref={printableRef}>
      {/* HEADER & AÇÕES */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Analytics Tributário da Carteira
            </h1>
            <Badge
              variant="outline"
              className="text-blue-700 border-blue-200 bg-blue-50 text-[11px]"
            >
              Auditoria Preditiva
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Evolução de carga efetiva, detecção de divergências entre competências e inteligência de
            oportunidades.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 print:hidden">
          <Select
            value={String(periodo)}
            onValueChange={(val) => setPeriodo(Number(val) as 6 | 12 | 24)}
          >
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6" className="text-xs">
                Últimos 6 meses
              </SelectItem>
              <SelectItem value="12" className="text-xs">
                Últimos 12 meses
              </SelectItem>
              <SelectItem value="24" className="text-xs">
                Últimos 24 meses
              </SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={carregarDados}
            disabled={loading}
            className="h-9 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Recalcular
          </Button>

          <Button
            size="sm"
            className="h-9 text-xs bg-slate-900 hover:bg-slate-800 text-white gap-1.5"
            onClick={handleExportPdf}
          >
            <Printer className="w-3.5 h-3.5" />
            Exportar Painel (PDF)
          </Button>
        </div>
      </div>

      {/* BANNER DE TRANSPARÊNCIA E CITAÇÃO LEGAL */}
      <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/80 text-xs text-slate-600 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 bg-blue-600 text-white rounded-lg mt-0.5">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-slate-800">
              Fontes das Séries Temporais e Regras de Apuração:
            </span>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Consolidação das apurações do Simples Nacional (LC nº 123/2006), Lucro Presumido (Lei
              nº 9.718/1998), retenções DCTFWeb (IN RFB nº 2.005/2021) e guias homologadas. Valores
              calculados por competência.
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="bg-white text-slate-700 text-[11px] shrink-0 self-start md:self-auto"
        >
          Multi-Tenant Isolado
        </Badge>
      </div>

      {/* CARDS COM KPI CONSOLIDADOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Faturamento Acumulado ({periodo}m)
            </span>
            <div className="text-xl font-bold text-slate-900">
              R${' '}
              {(data?.totalFaturamentoCarteira || 0).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}
            </div>
            <p className="text-[11px] text-slate-400">Total transacionado na carteira</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Tributos Recolhidos ({periodo}m)
            </span>
            <div className="text-xl font-bold text-blue-700">
              R${' '}
              {(data?.totalTributosCarteira || 0).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}
            </div>
            <p className="text-[11px] text-slate-400">Federais, Estaduais e Trabalhistas</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Alíquota Efetiva Média
            </span>
            <div className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>{data?.aliquotaMediaCarteira || 0}%</span>
              <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px]">
                Regime Misto
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400">Carga total sobre receita bruta</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Divergências Detectadas
            </span>
            <div className="text-xl font-bold text-amber-600 flex items-center gap-2">
              <span>{data?.insightsDivergencias.length || 0}</span>
              <span className="text-xs text-red-600 font-semibold">
                ({data?.insightsDivergencias.filter((i) => i.severidade === 'critico').length || 0}{' '}
                críticas)
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Necessitam revisão contábil</p>
          </CardContent>
        </Card>
      </div>

      {/* SEÇÃO PRINCIPAL: GRÁFICO E FILTRO DE EMPRESA */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Tendência de Carga Tributária Mensal
            </CardTitle>
            <CardDescription className="text-xs">
              Evolução do montante recolhido (barras) confrontado com a alíquota efetiva % (linha).
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <Label className="text-xs text-slate-500 whitespace-nowrap">Visualizar:</Label>
            <Select value={empresaSelecionadaId} onValueChange={setEmpresaSelecionadaId}>
              <SelectTrigger className="w-[220px] h-8 text-xs">
                <SelectValue placeholder="Consolidado da Carteira" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas" className="text-xs">
                  🌐 Consolidado da Carteira
                </SelectItem>
                {data?.rankingEmpresas.map((emp) => (
                  <SelectItem key={emp.empresaId} value={emp.empresaId} className="text-xs">
                    {emp.nomeFantasia || emp.razaoSocial}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* GRÁFICO SVG PERSONALIZADO E RESPONSIVO */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 px-2">
              <span>Montante em R$</span>
              <span>Alíquota Efetiva (%)</span>
            </div>

            <div className="h-64 w-full bg-slate-50/50 rounded-xl p-4 border border-slate-100 flex items-end gap-2 sm:gap-4 justify-between relative overflow-hidden">
              {/* Grid lines */}
              <div className="absolute inset-x-0 top-1/4 border-b border-slate-200/50 stroke-dasharray"></div>
              <div className="absolute inset-x-0 top-2/4 border-b border-slate-200/50"></div>
              <div className="absolute inset-x-0 top-3/4 border-b border-slate-200/50"></div>

              {serieExibida.map((item, idx) => {
                const alturaBarra = Math.max(12, (item.totalTributos / maxTributo) * 100)
                const isSalto = (item.variacaoMoM || 0) > 30

                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center h-full justify-end z-10 group relative"
                  >
                    {/* Tooltip hover */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col bg-slate-900 text-white text-[11px] p-2.5 rounded-lg shadow-xl z-30 pointer-events-none whitespace-nowrap min-w-[170px]">
                      <span className="font-bold text-slate-200">{item.mesAnoLabel}</span>
                      <span>Faturamento: R$ {item.faturamento.toLocaleString('pt-BR')}</span>
                      <span>Tributos: R$ {item.totalTributos.toLocaleString('pt-BR')}</span>
                      <span className="text-emerald-400 font-semibold">
                        Alíquota Efetiva: {item.aliquotaEfetiva}%
                      </span>
                      {item.variacaoMoM !== undefined && (
                        <span className={item.variacaoMoM > 0 ? 'text-amber-400' : 'text-blue-300'}>
                          Var. MoM:{' '}
                          {item.variacaoMoM > 0 ? `+${item.variacaoMoM}%` : `${item.variacaoMoM}%`}
                        </span>
                      )}
                    </div>

                    {/* Alíquota pontual no topo da barra */}
                    <span className="text-[10px] font-semibold text-slate-600 mb-1">
                      {item.aliquotaEfetiva}%
                    </span>

                    {/* Barra de tributos */}
                    <div
                      style={{ height: `${alturaBarra}%` }}
                      className={`w-full max-w-[36px] rounded-t-md transition-all duration-300 ${
                        isSalto
                          ? 'bg-red-500 hover:bg-red-600'
                          : item.totalTributos === 0
                            ? 'bg-slate-300 h-2'
                            : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    />

                    {/* Label da competência */}
                    <span className="text-[10px] font-medium text-slate-600 mt-2 truncate max-w-[48px]">
                      {item.mesAnoLabel.slice(0, 5)}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 px-2">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-blue-600 rounded-xs" />
                  <span>Carga Regular</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-red-500 rounded-xs" />
                  <span>Divergência / Salto &gt;30%</span>
                </div>
              </div>
              <span className="italic text-[11px]">
                Passe o cursor sobre os meses para detalhar faturamento e variação MoM.
              </span>
            </div>
          </div>

          {/* TABELA MENSAL DETALHADA */}
          <div className="border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Competência</th>
                  <th className="py-2.5 px-3 text-right">Faturamento</th>
                  <th className="py-2.5 px-3 text-right">Impostos Federais</th>
                  <th className="py-2.5 px-3 text-right">Estaduais / Municipais</th>
                  <th className="py-2.5 px-3 text-right">Trabalhistas / Prev.</th>
                  <th className="py-2.5 px-3 text-right font-bold text-slate-900">
                    Total Tributos
                  </th>
                  <th className="py-2.5 px-3 text-right font-bold text-blue-700">
                    Alíquota Efetiva
                  </th>
                  <th className="py-2.5 px-3 text-center">Variação MoM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {serieExibida.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{s.mesAnoLabel}</td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      R$ {s.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                      R$ {s.impostosFederais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                      R${' '}
                      {s.impostosEstaduaisMunicipais.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                      R${' '}
                      {s.impostosTrabalhistasPrevidenciarios.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      R$ {s.totalTributos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-blue-700">
                      {s.aliquotaEfetiva}%
                    </td>
                    <td className="py-2.5 px-3 text-center font-semibold">
                      {s.variacaoMoM !== undefined ? (
                        s.variacaoMoM > 0 ? (
                          <span className="text-red-600 inline-flex items-center gap-0.5">
                            <ArrowUpRight className="w-3 h-3" /> +{s.variacaoMoM}%
                          </span>
                        ) : s.variacaoMoM < 0 ? (
                          <span className="text-emerald-600 inline-flex items-center gap-0.5">
                            <ArrowDownRight className="w-3 h-3" /> {s.variacaoMoM}%
                          </span>
                        ) : (
                          <span className="text-slate-400">0.0%</span>
                        )
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 2: DIVERGÊNCIAS DETECTADAS & RANKING DA CARTEIRA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* INSIGHTS DE DIVERGÊNCIAS */}
        <Card className="border-slate-200 shadow-xs flex flex-col">
          <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Divergências & Achados da Carteira
                </CardTitle>
                <Badge variant="secondary" className="bg-amber-100 text-amber-900 text-xs">
                  {insightsFiltrados.length} achados
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Auditoria automática cruzando variações de carga, competências zeradas e regras
                tributárias.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 print:hidden">
              <Select value={filtroSeveridade} onValueChange={setFiltroSeveridade}>
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="text-xs">
                    Todas severidades
                  </SelectItem>
                  <SelectItem value="critico" className="text-xs">
                    Críticos
                  </SelectItem>
                  <SelectItem value="alerta" className="text-xs">
                    Atenção
                  </SelectItem>
                  <SelectItem value="info" className="text-xs">
                    Oportunidades
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="p-0 flex-1 overflow-y-auto max-h-[500px] divide-y divide-slate-100">
            {insightsFiltrados.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-xs">
                Nenhuma divergência identificada para os filtros selecionados.
              </div>
            ) : (
              insightsFiltrados.map((ins) => (
                <div key={ins.id} className="p-4 hover:bg-slate-50/70 transition-colors space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getSeveridadeBadge(ins.severidade)}
                      <span className="font-semibold text-slate-900 text-xs">
                        {ins.empresaNome}
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                        {ins.competencia}
                      </span>
                    </div>

                    {ins.impactoEstimado && (
                      <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                        Impacto: R$ {ins.impactoEstimado.toLocaleString('pt-BR')}
                      </span>
                    )}
                  </div>

                  <h4 className="text-xs font-semibold text-slate-800">{ins.titulo}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{ins.explicacao}</p>

                  <div className="pt-1 flex items-center justify-end">
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-0 px-2 gap-1"
                    >
                      <Link to={ins.link}>
                        <span>Ver no Módulo Fiscal</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* RANKING DE EMPRESAS POR CARGA EFETIVA */}
        <Card className="border-slate-200 shadow-xs flex flex-col">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-700" />
              Ranking de Carga Tributária por Empresa
            </CardTitle>
            <CardDescription className="text-xs">
              Média do período selecionado ({periodo} meses) com oportunidades de planejamento.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0 flex-1 overflow-y-auto max-h-[500px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Empresa</th>
                  <th className="py-2.5 px-3">Regime</th>
                  <th className="py-2.5 px-3 text-right">Alíq. Média</th>
                  <th className="py-2.5 px-3 text-center">Tendência</th>
                  <th className="py-2.5 px-3">Oportunidades</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.rankingEmpresas || []).map((emp) => (
                  <tr key={emp.empresaId} className="hover:bg-slate-50/60">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">{emp.nomeFantasia}</div>
                      <div className="text-[11px] font-mono text-slate-400">{emp.cnpj}</div>
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {emp.regime.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-blue-700">
                      {emp.aliquotaEfetivaMedia}%
                    </td>
                    <td className="py-3 px-3 text-center">
                      {emp.tendencia === 'alta' ? (
                        <span className="text-red-600 inline-flex items-center gap-0.5 font-medium text-[11px]">
                          <TrendingUp className="w-3.5 h-3.5" /> Alta
                        </span>
                      ) : emp.tendencia === 'baixa' ? (
                        <span className="text-emerald-600 inline-flex items-center gap-0.5 font-medium text-[11px]">
                          <TrendingDown className="w-3.5 h-3.5" /> Baixa
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">Estável</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="space-y-1">
                        {emp.oportunidades.map((opp, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1 text-[11px] text-slate-600"
                          >
                            <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                            <span>{opp}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
export default AnalyticsTributarioPage

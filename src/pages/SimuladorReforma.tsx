import React, { useState, useEffect, useMemo } from 'react'
import {
  Calculator,
  Building2,
  TrendingUp,
  FileText,
  Printer,
  Save,
  Share2,
  Trash2,
  ArrowRight,
  Info,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Sparkles,
  HelpCircle,
  ExternalLink,
  Percent,
  Layers,
  History,
  RotateCcw,
  GitCompare,
  DownloadCloud,
  Check,
  FileSpreadsheet,
  Sliders,
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
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
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
import { empresasService } from '@/services/empresas'
import { simuladorReformaService } from '@/services/simuladorReforma'
import type { Empresa, SimulacaoReformaRecord } from '@/types'
import {
  PARAMETROS_REFORMA,
  SETORES_CONFIG,
  SetorAtividade,
  estimarAliquotaSimplesNacional,
} from '@/lib/reformaTributaria/parametros'
import {
  SimulacaoInput,
  SimulacaoCalculada,
  calcularSimulacaoReforma,
  RegimeAtual,
} from '@/lib/reformaTributaria/calculos'
import { RelatorioReformaModal } from '@/components/RelatorioReformaModal'
import { ComparadorCenariosModal } from '@/components/ComparadorCenariosModal'
import { ApresentacaoExecutivaModal } from '@/components/ApresentacaoExecutivaModal'
import { RankingSetorialTab } from '@/components/RankingSetorialTab'
import { relatorioSetorialService, RelatorioSetorialCarteira } from '@/services/relatorioSetorial'
import { parametrosReformaService } from '@/services/parametrosReforma'
import { ParametrosReformaTab } from '@/components/ParametrosReformaTab'
import type { ParametrosReformaRecord } from '@/types'
import {
  Tooltip as TooltipUI,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export default function SimuladorReformaPage() {
  const { tenant, user, member } = useAuth()
  const { toast } = useToast()

  // Lista de empresas do tenant
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('avulsa')
  const [loadingEmpresas, setLoadingEmpresas] = useState(false)

  // Histórico de simulações salvas
  const [historico, setHistorico] = useState<SimulacaoReformaRecord[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(false)

  // Estado do formulário de entrada
  const [razaoSocial, setRazaoSocial] = useState('')
  const [regimeAtual, setRegimeAtual] = useState<RegimeAtual>('simples_nacional')
  const [faturamentoAnual, setFaturamentoAnual] = useState<number>(1200000)
  const [setorAtividade, setSetorAtividade] = useState<SetorAtividade>('servicos_geral')
  const [percentualCreditosInsumos, setPercentualCreditosInsumos] = useState<number>(15)
  const [aliquotaAtualEstimada, setAliquotaAtualEstimada] = useState<number>(12.0)
  const [reducaoSetorial60, setReducaoSetorial60] = useState<boolean>(false)
  const [vendeCestaBasica, setVendeCestaBasica] = useState<boolean>(false)
  const [percentualCestaBasica, setPercentualCestaBasica] = useState<number>(0)
  const [permanecerNoSimples, setPermanecerNoSimples] = useState<boolean>(true)
  const [anoBase, setAnoBase] = useState<number>(2026)

  // Modal Salvar Simulação
  const [modalSalvarOpen, setModalSalvarOpen] = useState(false)
  const [tituloSimulacao, setTituloSimulacao] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Modal Relatório Imprimível
  const [modalRelatorioOpen, setModalRelatorioOpen] = useState(false)
  const [modalApresentacaoExecutivaOpen, setModalApresentacaoExecutivaOpen] = useState(false)

  // Modal Comparador de Cenários Lado a Lado
  const [modalComparadorOpen, setModalComparadorOpen] = useState(false)

  // Estado da busca de receita contábil real
  const [buscandoReceitaReal, setBuscandoReceitaReal] = useState(false)
  const [origemReceitaRealInfo, setOrigemReceitaRealInfo] = useState<{
    periodo: string
    valor: number
    detalhes: string
  } | null>(null)

  // Relatório Setorial da Carteira
  const [relatorioSetorial, setRelatorioSetorial] = useState<RelatorioSetorialCarteira | null>(null)
  const [loadingSetorial, setLoadingSetorial] = useState(false)

  // Parâmetros Parametrizados da Reforma
  const [parametroAtivo, setParametroAtivo] = useState<ParametrosReformaRecord | null>(null)
  const [historicoParametros, setHistoricoParametros] = useState<ParametrosReformaRecord[]>([])

  // Permissão de edição dos parâmetros (apenas Administrador)
  const canEditParametros = member?.perfil === 'administrador'

  // Aba ativa: simulador | ranking_setorial | historico | parametros
  const [activeTab, setActiveTab] = useState<
    'simulador' | 'ranking_setorial' | 'historico' | 'parametros'
  >('simulador')

  // Carrega empresas do tenant
  useEffect(() => {
    if (!tenant?.id) return
    setLoadingEmpresas(true)
    empresasService
      .list(tenant.id, "status = 'ativo'")
      .then((res) => setEmpresas(res))
      .catch((err) => console.error('Erro ao listar empresas:', err))
      .finally(() => setLoadingEmpresas(false))
  }, [tenant?.id])

  // Função para puxar faturamento real dos lançamentos contábeis
  const handlePuxarFaturamentoReal = async () => {
    if (!tenant?.id) return
    if (!selectedEmpresaId || selectedEmpresaId === 'avulsa') {
      toast({
        title: 'Selecione uma empresa',
        description:
          'É necessário selecionar uma empresa da carteira para consultar seus lançamentos contábeis.',
        variant: 'destructive',
      })
      return
    }

    try {
      setBuscandoReceitaReal(true)
      const res = await simuladorReformaService.obterReceitaRealExercicio(
        tenant.id,
        selectedEmpresaId,
      )

      if (res.sucesso && res.faturamentoTotal > 0) {
        setFaturamentoAnual(res.faturamentoTotal)
        setOrigemReceitaRealInfo({
          periodo: res.periodoDescricao,
          valor: res.faturamentoTotal,
          detalhes: `${res.quantidadeLancamentos} lançamentos confirmados em ${res.detalhesPorConta.length} conta(s) de receita`,
        })

        toast({
          title: 'Faturamento real importado!',
          description: `Valor de ${res.faturamentoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} obtido a partir de ${res.periodoDescricao}.`,
        })
      } else {
        toast({
          title: 'Lançamentos contábeis insuficientes',
          description:
            res.mensagem ||
            'Não foram identificadas receitas confirmadas no último exercício para esta empresa. Você pode preencher o faturamento manualmente.',
          variant: 'default',
        })
      }
    } catch (err: any) {
      console.error('Erro ao puxar receita contábil:', err)
      toast({
        title: 'Erro ao consultar lançamentos',
        description:
          err?.message ||
          'Não foi possível consultar os lançamentos contábeis no momento. Preencha manualmente.',
        variant: 'destructive',
      })
    } finally {
      setBuscandoReceitaReal(false)
    }
  }

  // Carrega histórico de simulações
  const carregarHistorico = async () => {
    if (!tenant?.id) return
    setLoadingHistorico(true)
    try {
      const records = await simuladorReformaService.list(tenant.id)
      setHistorico(records)
    } catch (err) {
      console.error('Erro ao carregar histórico:', err)
    } finally {
      setLoadingHistorico(false)
    }
  }

  // Carrega parâmetros customizados do tenant
  const carregarParametrosReforma = async () => {
    if (!tenant?.id) return
    try {
      const [ativo, hist] = await Promise.all([
        parametrosReformaService.getAtivo(tenant.id),
        parametrosReformaService.listHistorico(tenant.id),
      ])
      setParametroAtivo(ativo)
      setHistoricoParametros(hist)
    } catch (err) {
      console.error('Erro ao buscar parâmetros da reforma:', err)
    }
  }

  // Carrega diagnóstico setorial da carteira
  const carregarRelatorioSetorial = async (customParams?: any) => {
    if (!tenant?.id) return
    setLoadingSetorial(true)
    try {
      const rel = await relatorioSetorialService.gerarRankingSetorialCarteira(
        tenant.id,
        undefined,
        customParams || parametroAtivo?.parametros_json,
      )
      setRelatorioSetorial(rel)
    } catch (err) {
      console.error('Erro ao processar relatório setorial:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar ranking setorial',
        description: 'Não foi possível compilar os impactos setoriais da carteira.',
      })
    } finally {
      setLoadingSetorial(false)
    }
  }

  useEffect(() => {
    carregarParametrosReforma()
    carregarHistorico()
    carregarRelatorioSetorial()
  }, [tenant?.id])

  // Ao selecionar uma empresa existente, auto-preenche dados
  const handleSelecionarEmpresa = (empresaId: string) => {
    setSelectedEmpresaId(empresaId)
    if (empresaId === 'avulsa') {
      setRazaoSocial('Análise Tributária Avulsa')
      return
    }

    const emp = empresas.find((e) => e.id === empresaId)
    if (!emp) return

    setRazaoSocial(emp.razao_social || emp.nome_fantasia || '')

    // Mapear regime
    if (emp.regime_tributario === 'lucro_presumido') {
      setRegimeAtual('lucro_presumido')
    } else if (emp.regime_tributario === 'lucro_real') {
      setRegimeAtual('lucro_real')
    } else {
      setRegimeAtual('simples_nacional')
    }

    // Sugere faturamento e alíquota de acordo com porte/regime
    if (emp.porte === 'me') {
      setFaturamentoAnual(600000)
    } else if (emp.porte === 'epp') {
      setFaturamentoAnual(2400000)
    } else {
      setFaturamentoAnual(4800000)
    }

    // Se a empresa já tem setor identificado ou nome específico
    const nome = (emp.razao_social || emp.nome_fantasia || '').toLowerCase()
    if (
      nome.includes('clínica') ||
      nome.includes('médic') ||
      nome.includes('hospital') ||
      nome.includes('saúde')
    ) {
      setSetorAtividade('servicos_saude')
      setReducaoSetorial60(true)
    } else if (
      nome.includes('tech') ||
      nome.includes('software') ||
      nome.includes('digital') ||
      nome.includes('sistemas')
    ) {
      setSetorAtividade('tecnologia_software')
      setReducaoSetorial60(false)
    } else if (nome.includes('transporte') || nome.includes('log')) {
      setSetorAtividade('transporte_coletivo')
      setReducaoSetorial60(true)
    } else if (
      nome.includes('café') ||
      nome.includes('grãos') ||
      nome.includes('mercado') ||
      nome.includes('comércio')
    ) {
      setSetorAtividade('comercio_geral')
      setReducaoSetorial60(false)
    }
  }

  // Atualiza alíquota estimada sugerida quando regime, setor ou faturamento mudam
  const handleSugerirAliquota = (
    novoRegime: RegimeAtual,
    novoSetor: SetorAtividade,
    novoFaturamento: number,
  ) => {
    const setorCfg = SETORES_CONFIG[novoSetor]
    if (novoRegime === 'simples_nacional') {
      const aliq = estimarAliquotaSimplesNacional(novoFaturamento, novoSetor)
      setAliquotaAtualEstimada(aliq)
    } else if (novoRegime === 'lucro_presumido') {
      setAliquotaAtualEstimada(setorCfg.aliquotaAtualEstimadaPresumido)
    } else {
      setAliquotaAtualEstimada(setorCfg.aliquotaAtualEstimadaReal)
    }
    setPercentualCreditosInsumos(setorCfg.percentualCreditosInsumosPadrao)
    setReducaoSetorial60(setorCfg.reducao60)
  }

  // Objeto de entrada da simulação
  const simulacaoInput: SimulacaoInput = useMemo(() => {
    return {
      empresaId: selectedEmpresaId !== 'avulsa' ? selectedEmpresaId : undefined,
      razaoSocial: razaoSocial || 'Empresa em Análise',
      regimeAtual,
      faturamentoAnual,
      percentualCreditosInsumos,
      setorAtividade,
      reducaoSetorial60,
      vendeCestaBasica,
      percentualCestaBasica,
      aliquotaAtualEstimada,
      permanecerNoSimplesNaTransicao: permanecerNoSimples,
      anoBase,
    }
  }, [
    selectedEmpresaId,
    razaoSocial,
    regimeAtual,
    faturamentoAnual,
    percentualCreditosInsumos,
    setorAtividade,
    reducaoSetorial60,
    vendeCestaBasica,
    percentualCestaBasica,
    aliquotaAtualEstimada,
    permanecerNoSimples,
    anoBase,
  ])

  // Executa o motor de cálculo da reforma determinístico utilizando parâmetros customizados se ativos
  const calculada: SimulacaoCalculada = useMemo(() => {
    return calcularSimulacaoReforma(simulacaoInput, parametroAtivo?.parametros_json)
  }, [simulacaoInput, parametroAtivo])

  // Dados para os gráficos de comparação
  const dadosGraficoBarras = useMemo(() => {
    return calculada.tabelaAnual.map((item) => ({
      ano: item.ano.toString(),
      'Carga Atual': item.cargaAtualEstimadaReais,
      'Carga Projetada (IBS/CBS)': item.cargaProjetadaIBSCBSReais,
      Diferenca: item.diferencaReais,
    }))
  }, [calculada])

  const dadosGraficoAliquotas = useMemo(() => {
    return calculada.tabelaAnual.map((item) => ({
      ano: item.ano.toString(),
      'Alíquota Atual (%)': item.aliquotaAtualEfetiva,
      'Alíquota Efetiva IBS/CBS (%)': item.aliquotaEfetivaIBSCBS,
      'Alíquota Nominal Combinada (%)': item.aliquotaNominalCombinada,
    }))
  }, [calculada])

  // Handler para Salvar Simulação no Backend
  const handleSalvarSimulacao = async () => {
    if (!tenant?.id) return
    if (!tituloSimulacao.trim()) {
      toast({
        variant: 'destructive',
        title: 'Título obrigatório',
        description: 'Dê um nome ou identificação para salvar o cenário.',
      })
      return
    }

    setSalvando(true)
    try {
      await simuladorReformaService.create({
        tenantId: tenant.id,
        empresaId: selectedEmpresaId !== 'avulsa' ? selectedEmpresaId : undefined,
        titulo: tituloSimulacao.trim(),
        razaoSocial: razaoSocial || 'Análise Avulsa',
        regimeAtual,
        setorAtividade,
        faturamentoAnual,
        aliquotaAtualEstimada,
        percentualCreditos: percentualCreditosInsumos,
        reducaoSetorial60,
        vendeCestaBasica,
        calculada,
        compartilhadoPortal: false,
        criadoPor: user?.id,
      })

      toast({
        title: 'Cenário salvo com sucesso!',
        description: 'A simulação foi registrada no histórico e na trilha de auditoria.',
      })
      setModalSalvarOpen(false)
      setTituloSimulacao('')
      carregarHistorico()
    } catch (err) {
      console.error('Erro ao salvar simulação:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o cenário no banco de dados.',
      })
    } finally {
      setSalvando(false)
    }
  }

  // Handler para carregar simulação do histórico de volta ao formulário
  const handleCarregarDoHistorico = (record: SimulacaoReformaRecord) => {
    if (record.empresa) {
      setSelectedEmpresaId(record.empresa)
    } else {
      setSelectedEmpresaId('avulsa')
    }
    setRazaoSocial(record.razao_social || '')
    setRegimeAtual(record.regime_atual)
    setSetorAtividade(record.setor_atividade as SetorAtividade)
    setFaturamentoAnual(record.faturamento_anual)
    setAliquotaAtualEstimada(record.aliquota_atual_estimada)
    setPercentualCreditosInsumos(record.percentual_creditos || 0)
    setReducaoSetorial60(!!record.reducao_setorial_60)
    setVendeCestaBasica(!!record.vende_cesta_basica)

    const inputs = record.inputs_json as Partial<SimulacaoInput> | undefined
    if (inputs) {
      if (inputs.percentualCestaBasica !== undefined)
        setPercentualCestaBasica(inputs.percentualCestaBasica)
      if (inputs.permanecerNoSimplesNaTransicao !== undefined)
        setPermanecerNoSimples(inputs.permanecerNoSimplesNaTransicao)
      if (inputs.anoBase) setAnoBase(inputs.anoBase)
    }

    setActiveTab('simulador')
    toast({
      title: 'Cenário carregado',
      description: `Parâmetros da simulação "${record.titulo}" foram aplicados.`,
    })
  }

  // Handler para alternar compartilhamento no portal do cliente
  const handleToggleCompartilhamento = async (record: SimulacaoReformaRecord) => {
    if (!tenant?.id) return
    const novoStatus = !record.compartilhado_portal
    try {
      await simuladorReformaService.togglePortalShare(record.id, novoStatus, tenant.id, user?.id)
      setHistorico((prev) =>
        prev.map((item) =>
          item.id === record.id ? { ...item, compartilhado_portal: novoStatus } : item,
        ),
      )
      toast({
        title: novoStatus ? 'Compartilhado no Portal' : 'Compartilhamento Removido',
        description: novoStatus
          ? 'O cliente agora tem acesso ao relatório através do portal.'
          : 'A simulação não está mais visível para o cliente.',
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao alterar compartilhamento',
        description: 'Tente novamente.',
      })
    }
  }

  // Handler para excluir simulação
  const handleExcluirHistorico = async (id: string) => {
    if (!tenant?.id) return
    if (!confirm('Tem certeza que deseja excluir esta simulação?')) return

    try {
      await simuladorReformaService.delete(id, tenant.id, user?.id)
      setHistorico((prev) => prev.filter((item) => item.id !== id))
      toast({
        title: 'Simulação excluída',
        description: 'O registro foi removido do histórico.',
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o registro.',
      })
    }
  }

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-[#1A2333]">
              Simulador da Reforma Tributária (IBS / CBS)
            </h2>
            <Badge className="bg-[#0FA3A3] text-white text-[10px] font-bold uppercase tracking-wider">
              EC 132 & LC 214
            </Badge>
          </div>
          <p className="text-xs md:text-sm text-[#64748B] mt-1">
            Planejamento de transição 2026–2033, impacto de alíquotas, apropriação de créditos e
            suporte consultivo a clientes.
          </p>
          <p className="text-[11px] text-amber-700 font-medium mt-1 bg-amber-50/80 border border-amber-200/60 px-2.5 py-1 rounded-lg inline-block">
            ⚖ <b>Aviso de Conformidade CFC:</b> Projeções e estimativas preliminares com base na EC
            132/2023 e LC 214/2025. Não substitui o parecer individualizado do contador responsável
            técnico.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setModalComparadorOpen(true)}
            className="gap-2 rounded-xl text-xs font-bold h-9 border-[#0FA3A3]/40 bg-teal-50/60 text-[#0E7A7A] hover:bg-teal-100/70 shadow-xs"
          >
            <GitCompare className="h-4 w-4 text-[#0FA3A3]" />
            <span>Comparar Cenários (Lado a Lado)</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setTituloSimulacao(
                `Cenário ${razaoSocial || 'Simulação'} - ${new Date().toLocaleDateString('pt-BR')}`,
              )
              setModalSalvarOpen(true)
            }}
            className="gap-2 rounded-xl text-xs font-semibold h-9 border-[#E2E8F0]"
          >
            <Save className="h-4 w-4 text-[#0FA3A3]" />
            <span>Salvar Cenário</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => setModalApresentacaoExecutivaOpen(true)}
            className="gap-2 rounded-xl text-xs font-semibold h-9 bg-[#123B6D] hover:bg-[#0B1F3A] text-white shadow-sm"
            title="Dossiê formal para reunião executiva com o cliente"
          >
            <Printer className="h-4 w-4" />
            <span>Apresentação Executiva</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setModalRelatorioOpen(true)}
            className="gap-2 rounded-xl text-xs font-semibold h-9 border-[#E2E8F0]"
          >
            <FileSpreadsheet className="h-4 w-4 text-[#64748B]" />
            <span>Relatório Completo</span>
          </Button>
        </div>
      </div>

      {/* Tabs Principais */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="simulador" className="rounded-lg text-xs font-semibold gap-2">
            <Calculator className="h-3.5 w-3.5" />
            <span>Simulador & Análise de Cenários</span>
          </TabsTrigger>
          <TabsTrigger value="ranking_setorial" className="rounded-lg text-xs font-semibold gap-2">
            <Building2 className="h-3.5 w-3.5 text-[#0FA3A3]" />
            <span>Ranking Setorial da Carteira</span>
            {relatorioSetorial && (
              <Badge className="bg-[#0FA3A3] text-white text-[10px] h-4 px-1 rounded-full font-bold">
                {relatorioSetorial.totalEmpresasAnalisadas}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="historico" className="rounded-lg text-xs font-semibold gap-2">
            <History className="h-3.5 w-3.5" />
            <span>Cenários Salvos ({historico.length})</span>
          </TabsTrigger>
          <TabsTrigger value="parametros" className="rounded-lg text-xs font-semibold gap-2">
            <Sliders className="h-3.5 w-3.5" />
            <span>Parâmetros da Reforma</span>
            {parametroAtivo && (
              <Badge className="bg-[#0FA3A3] text-white text-[9px] h-4 px-1 rounded-full font-bold">
                Customizado
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Banner de transparência se parâmetros customizados estiverem em vigor */}
        {parametroAtivo && activeTab !== 'parametros' && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-xs">
            <div className="flex items-center gap-2">
              <Badge className="bg-teal-700 text-white font-bold text-[10px] uppercase">
                Parâmetros Customizados (v{parametroAtivo.versao})
              </Badge>
              <span className="font-semibold">Fonte: {parametroAtivo.fonte}</span>
              <span className="text-teal-700 text-[11px] hidden sm:inline">
                • CBS: {parametroAtivo.parametros_json.aliquotaReferenciaPlena.cbs}% | IBS:{' '}
                {parametroAtivo.parametros_json.aliquotaReferenciaPlena.ibs}% (Total:{' '}
                {parametroAtivo.parametros_json.aliquotaReferenciaPlena.total}%)
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('parametros')}
              className="text-teal-900 hover:text-teal-950 hover:bg-teal-100/70 text-xs font-bold h-7"
            >
              Configurar
            </Button>
          </div>
        )}

        {/* ABA 1: SIMULADOR & ANÁLISE */}
        <TabsContent value="simulador" className="space-y-6">
          {/* PAINEL DE ENTRADAS / FORMULÁRIO */}
          <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-[#1A2333]">
                    Premissas e Dados da Empresa
                  </CardTitle>
                  <CardDescription className="text-xs text-[#64748B]">
                    Selecione uma empresa da carteira ou insira parâmetros para análise avulsa.
                  </CardDescription>
                </div>
                {selectedEmpresaId !== 'avulsa' && (
                  <Badge
                    variant="outline"
                    className="text-[11px] text-[#0FA3A3] border-[#0FA3A3]/40"
                  >
                    Empresa da Carteira
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Seleção de Empresa */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#1A2333]">
                    Empresa (Cliente do Escritório)
                  </Label>
                  <Select value={selectedEmpresaId} onValueChange={handleSelecionarEmpresa}>
                    <SelectTrigger className="h-9 rounded-xl text-xs border-[#E2E8F0]">
                      <SelectValue placeholder="Selecione ou Avulsa..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="avulsa">-- Análise Avulsa (Sem vínculo) --</SelectItem>
                      {empresas.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.nome_fantasia || emp.razao_social} ({emp.cnpj})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Razão Social / Nome de Exibição */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#1A2333]">
                    Razão Social / Nome
                  </Label>
                  <Input
                    value={razaoSocial}
                    onChange={(e) => setRazaoSocial(e.target.value)}
                    placeholder="Ex: Prime Inovação Tecnologia Ltda"
                    className="h-9 rounded-xl text-xs border-[#E2E8F0]"
                  />
                </div>

                {/* Regime Tributário Atual */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#1A2333]">Regime Atual</Label>
                  <Select
                    value={regimeAtual}
                    onValueChange={(val: RegimeAtual) => {
                      setRegimeAtual(val)
                      handleSugerirAliquota(val, setorAtividade, faturamentoAnual)
                    }}
                  >
                    <SelectTrigger className="h-9 rounded-xl text-xs border-[#E2E8F0]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simples_nacional">Simples Nacional (LC 123/06)</SelectItem>
                      <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                      <SelectItem value="lucro_real">Lucro Real (Não-cumulativo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Faturamento Anual (Receita Bruta) com Integração Contábil */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <Label className="text-xs font-semibold text-[#1A2333]">
                      Faturamento Anual (R$)
                    </Label>

                    {/* Botão Puxar do último exercício contábil */}
                    <TooltipProvider>
                      <TooltipUI>
                        <TooltipTrigger asChild>
                          <span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={selectedEmpresaId === 'avulsa' || buscandoReceitaReal}
                              onClick={handlePuxarFaturamentoReal}
                              className={`h-6 px-1.5 text-[11px] font-semibold gap-1 rounded-lg ${
                                selectedEmpresaId === 'avulsa'
                                  ? 'text-slate-400 cursor-not-allowed'
                                  : 'text-[#0FA3A3] hover:text-[#0c8282] hover:bg-teal-50'
                              }`}
                            >
                              <DownloadCloud
                                className={`h-3 w-3 ${buscandoReceitaReal ? 'animate-bounce' : ''}`}
                              />
                              <span>
                                {buscandoReceitaReal ? 'Buscando...' : 'Puxar do último exercício'}
                              </span>
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {selectedEmpresaId === 'avulsa' && (
                          <TooltipContent side="top" className="text-xs max-w-xs">
                            Selecione uma empresa da carteira acima para puxar os lançamentos
                            contábeis de receitas do último exercício.
                          </TooltipContent>
                        )}
                      </TooltipUI>
                    </TooltipProvider>
                  </div>

                  <Input
                    type="number"
                    min="0"
                    step="10000"
                    value={faturamentoAnual}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0
                      setFaturamentoAnual(val)
                      setOrigemReceitaRealInfo(null)
                      if (regimeAtual === 'simples_nacional') {
                        setAliquotaAtualEstimada(
                          estimarAliquotaSimplesNacional(val, setorAtividade),
                        )
                      }
                    }}
                    className="h-9 rounded-xl text-xs border-[#E2E8F0]"
                  />

                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[#64748B]">{formatBRL(faturamentoAnual)} / ano</span>

                    {origemReceitaRealInfo && (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        <Check className="h-2.5 w-2.5" />
                        Base real: {origemReceitaRealInfo.periodo}
                      </span>
                    )}
                  </div>
                </div>

                {/* Setor de Atividade */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#1A2333]">Setor de Atividade</Label>
                  <Select
                    value={setorAtividade}
                    onValueChange={(val: SetorAtividade) => {
                      setSetorAtividade(val)
                      handleSugerirAliquota(regimeAtual, val, faturamentoAnual)
                    }}
                  >
                    <SelectTrigger className="h-9 rounded-xl text-xs border-[#E2E8F0]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(SETORES_CONFIG).map((cfg) => (
                        <SelectItem key={cfg.id} value={cfg.id}>
                          {cfg.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Alíquota Efetiva Atual Estimada */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-[#1A2333]">
                      Alíquota Atual Estimada (%)
                    </Label>
                    <button
                      type="button"
                      onClick={() =>
                        handleSugerirAliquota(regimeAtual, setorAtividade, faturamentoAnual)
                      }
                      className="text-[10px] font-semibold text-[#0FA3A3] hover:underline"
                    >
                      Sugerir
                    </button>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={aliquotaAtualEstimada}
                    onChange={(e) => setAliquotaAtualEstimada(Number(e.target.value) || 0)}
                    className="h-9 rounded-xl text-xs border-[#E2E8F0]"
                  />
                  <span className="text-[10px] text-[#64748B]">
                    Carga atual: {formatBRL((faturamentoAnual * aliquotaAtualEstimada) / 100)}/ano
                  </span>
                </div>

                {/* % Insumos / Créditos Apropriáveis */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#1A2333]">
                    Insumos com Crédito (% da Receita)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={percentualCreditosInsumos}
                    onChange={(e) => setPercentualCreditosInsumos(Number(e.target.value) || 0)}
                    className="h-9 rounded-xl text-xs border-[#E2E8F0]"
                  />
                  <span className="text-[10px] text-[#64748B]">
                    Base compras: {formatBRL((faturamentoAnual * percentualCreditosInsumos) / 100)}
                  </span>
                </div>
              </div>

              {/* Tratamentos Especiais / Checkboxes */}
              <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-3">
                <span className="text-xs font-bold text-[#1A2333] block">
                  Regimes Diferenciados & Opções da Transição (LC 214/2025):
                </span>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  {/* Redução de 60% */}
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="reducao60"
                      checked={reducaoSetorial60}
                      onCheckedChange={(c) => setReducaoSetorial60(!!c)}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="reducao60"
                        className="text-xs font-semibold text-[#1A2333] cursor-pointer"
                      >
                        Redução de 60% da alíquota
                      </Label>
                      <p className="text-[10px] text-[#64748B]">
                        Para educação, saúde humana, dispositivos médicos, insumos agropecuários
                        etc.
                      </p>
                    </div>
                  </div>

                  {/* Cesta Básica com Alíquota Zero */}
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="cestaBasica"
                      checked={vendeCestaBasica}
                      onCheckedChange={(c) => {
                        const checked = !!c
                        setVendeCestaBasica(checked)
                        if (checked && percentualCestaBasica === 0) setPercentualCestaBasica(100)
                      }}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="cestaBasica"
                        className="text-xs font-semibold text-[#1A2333] cursor-pointer"
                      >
                        Cesta Básica Nacional (Alíquota Zero)
                      </Label>
                      <p className="text-[10px] text-[#64748B]">
                        Alíquota zero para itens essenciais com manutenção de créditos.
                      </p>
                    </div>
                  </div>

                  {/* Opção Simples Nacional na Transição */}
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="permSimples"
                      checked={permanecerNoSimples}
                      onCheckedChange={(c) => setPermanecerNoSimples(!!c)}
                      disabled={regimeAtual !== 'simples_nacional'}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="permSimples"
                        className={`text-xs font-semibold cursor-pointer ${
                          regimeAtual === 'simples_nacional' ? 'text-[#1A2333]' : 'text-slate-400'
                        }`}
                      >
                        Permanecer no Simples até 2032
                      </Label>
                      <p className="text-[10px] text-[#64748B]">
                        Garante desconto de 50% de IBS/CBS até R$ 3,6M na transição.
                      </p>
                    </div>
                  </div>
                </div>

                {vendeCestaBasica && (
                  <div className="pt-2 border-t border-slate-200 flex items-center gap-3">
                    <Label className="text-xs font-semibold text-[#1A2333]">
                      % do faturamento composto por itens de Cesta Básica:
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={percentualCestaBasica}
                      onChange={(e) => setPercentualCestaBasica(Number(e.target.value) || 0)}
                      className="h-8 w-24 rounded-lg text-xs"
                    />
                    <span className="text-[11px] text-[#64748B]">
                      ({percentualCestaBasica}% com alíquota zero)
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* CARDS DE IMPACTO EXECUTIVO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#64748B]">
                    Carga Tributária Atual
                  </span>
                  <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Calculator className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-xl font-bold text-[#1A2333] mt-2">
                  {formatBRL((faturamentoAnual * aliquotaAtualEstimada) / 100)}
                </p>
                <div className="flex items-center justify-between mt-1 text-[11px] text-[#64748B]">
                  <span>Alíquota Efetiva:</span>
                  <span className="font-semibold">{aliquotaAtualEstimada}%</span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#64748B]">Carga Plena em 2033</span>
                  <div className="h-8 w-8 rounded-lg bg-teal-50 text-[#0FA3A3] flex items-center justify-center">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-xl font-bold text-[#1A2333] mt-2">
                  {formatBRL(
                    calculada.tabelaAnual.find((t) => t.ano === 2033)?.cargaProjetadaIBSCBSReais ||
                      0,
                  )}
                </p>
                <div className="flex items-center justify-between mt-1 text-[11px] text-[#64748B]">
                  <span>Alíquota Combinada:</span>
                  <span className="font-semibold">
                    {calculada.tabelaAnual.find((t) => t.ano === 2033)?.aliquotaNominalCombinada}%
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#64748B]">
                    Variação em 2033 vs. Atual
                  </span>
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                      (calculada.tabelaAnual.find((t) => t.ano === 2033)?.diferencaReais || 0) > 0
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    <Percent className="h-4 w-4" />
                  </div>
                </div>
                <p
                  className={`text-xl font-bold mt-2 ${
                    (calculada.tabelaAnual.find((t) => t.ano === 2033)?.diferencaReais || 0) > 0
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {(calculada.tabelaAnual.find((t) => t.ano === 2033)?.diferencaReais || 0) > 0
                    ? '+'
                    : ''}
                  {formatBRL(
                    calculada.tabelaAnual.find((t) => t.ano === 2033)?.diferencaReais || 0,
                  )}
                </p>
                <div className="flex items-center justify-between mt-1 text-[11px] text-[#64748B]">
                  <span>Variação %:</span>
                  <span className="font-semibold">
                    {(calculada.tabelaAnual.find((t) => t.ano === 2033)?.diferencaPercentual || 0) >
                    0
                      ? '+'
                      : ''}
                    {calculada.tabelaAnual.find((t) => t.ano === 2033)?.diferencaPercentual}%
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#64748B]">
                    Impacto Acumulado Transição
                  </span>
                  <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Layers className="h-4 w-4" />
                  </div>
                </div>
                <p
                  className={`text-xl font-bold mt-2 ${
                    calculada.resumo.impactoTotalAcumuladoReais > 0
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {calculada.resumo.impactoTotalAcumuladoReais > 0 ? '+' : ''}
                  {formatBRL(calculada.resumo.impactoTotalAcumuladoReais)}
                </p>
                <div className="flex items-center justify-between mt-1 text-[11px] text-[#64748B]">
                  <span>Virada no Cenário:</span>
                  <span className="font-semibold">
                    {calculada.resumo.anoVirada ? `Em ${calculada.resumo.anoVirada}` : 'Estável'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* GRÁFICOS COMPARATIVOS (BARRA E LINHA) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de Barras: Carga Atual vs Carga Projetada */}
            <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-[#1A2333]">
                  Comparativo de Carga Tributária Anual (2026–2033)
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  Em Reais (R$) — Carga atual vs. IBS/CBS projetado com créditos deduzidos
                </CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dadosGraficoBarras}
                    margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis
                      dataKey="ano"
                      textAnchor="middle"
                      tick={{ fontSize: 11, fill: '#64748B' }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(val: any) => formatBRL(Number(val) || 0)}
                      labelFormatter={(label) => `Ano ${label}`}
                      contentStyle={{
                        backgroundColor: '#fff',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="Carga Atual" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Carga Projetada (IBS/CBS)" fill="#0FA3A3" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gráfico de Linhas: Evolução da Alíquota */}
            <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-[#1A2333]">
                  Evolução das Alíquotas Nominais vs. Efetivas
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  Curva de transição e escalonamento da alíquota combinada (CBS + IBS)
                </CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={dadosGraficoAliquotas}
                    margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="ano" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <Tooltip
                      formatter={(val: any) => `${Number(val).toFixed(1)}%`}
                      labelFormatter={(label) => `Ano ${label}`}
                      contentStyle={{
                        backgroundColor: '#fff',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Line
                      type="monotone"
                      dataKey="Alíquota Atual (%)"
                      stroke="#64748B"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Alíquota Nominal Combinada (%)"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Alíquota Efetiva IBS/CBS (%)"
                      stroke="#0FA3A3"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* TABELA DETALHADA ANO A ANO */}
          <Card className="rounded-2xl border-[#E2E8F0] shadow-xs overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-[#1A2333]">
                    Cronograma Detalhado da Transição (2026 a 2033)
                  </CardTitle>
                  <CardDescription className="text-xs text-[#64748B]">
                    Abertura completa de débitos brutos, créditos de insumos, tributos antigos
                    residuais e carga líquida.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs font-semibold">
                  {calculada.parametrosUtilizados.versaoNormativa}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs divide-y divide-slate-100">
                  <thead className="bg-slate-100/80 font-bold text-[11px] uppercase text-[#64748B]">
                    <tr>
                      <th className="py-3 px-4">Ano</th>
                      <th className="py-3 px-4">Fase Legal</th>
                      <th className="py-3 px-4 text-right">Alíq. Nominal</th>
                      <th className="py-3 px-4 text-right">Débito Bruto</th>
                      <th className="py-3 px-4 text-right">Crédito Insumos</th>
                      <th className="py-3 px-4 text-right">Tributos Antigos</th>
                      <th className="py-3 px-4 text-right">Carga Projetada</th>
                      <th className="py-3 px-4 text-right">Diferença (R$)</th>
                      <th className="py-3 px-4 text-right">Variação %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {calculada.tabelaAnual.map((item) => (
                      <tr
                        key={item.ano}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          item.ano === 2033 ? 'bg-teal-50/40 font-semibold' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-bold font-mono text-[#1A2333]">
                          {item.ano}
                          {item.ano === 2026 && (
                            <span className="ml-1.5 px-1 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] uppercase font-bold">
                              Teste
                            </span>
                          )}
                          {item.ano === 2033 && (
                            <span className="ml-1.5 px-1 py-0.2 rounded bg-teal-100 text-teal-800 text-[9px] uppercase font-bold">
                              Pleno
                            </span>
                          )}
                        </td>
                        <td
                          className="py-3 px-4 text-[#64748B] max-w-[220px] truncate"
                          title={item.descricao}
                        >
                          {item.descricao}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium">
                          {item.aliquotaNominalCombinada}%
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[#64748B]">
                          {formatBRL(item.valorDebitoBrutoReais)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-600">
                          {item.valorCreditosInsumosReais > 0
                            ? `-${formatBRL(item.valorCreditosInsumosReais)}`
                            : 'R$ 0,00'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[#64748B]">
                          {formatBRL(item.valorResidualTributosAntigosReais)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#1A2333]">
                          {formatBRL(item.cargaProjetadaIBSCBSReais)}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono font-semibold ${
                            item.diferencaReais > 0
                              ? 'text-amber-600'
                              : item.diferencaReais < 0
                                ? 'text-emerald-600'
                                : 'text-slate-600'
                          }`}
                        >
                          {item.diferencaReais > 0 ? '+' : ''}
                          {formatBRL(item.diferencaReais)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              item.diferencaPercentual > 0
                                ? 'bg-amber-100 text-amber-800'
                                : item.diferencaPercentual < 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {item.diferencaPercentual > 0 ? '+' : ''}
                            {item.diferencaPercentual}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* RECOMENDAÇÕES E PONTO CRÍTICO */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="rounded-2xl border-[#E2E8F0] shadow-xs md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-[#0FA3A3]" />
                  Recomendações Determinísticas de Gestão Tributária
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  Orientações estratégicas geradas a partir do perfil e das alíquotas do cenário
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-2">
                {calculada.resumo.recomendacoes.map((rec, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-xs text-[#334155]"
                  >
                    <CheckCircle2 className="h-4 w-4 text-[#0FA3A3] shrink-0 mt-0.5" />
                    <p className="leading-relaxed">{rec}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Ponto de Virada / Atenção
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  Fase crítica para planejamento financeiro e repasse de preços
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-2 text-xs">
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-950 space-y-1">
                  <span className="font-bold block">Momento Chave:</span>
                  <p className="leading-relaxed text-[11px]">{calculada.resumo.pontoCritico}</p>
                </div>

                <div className="space-y-1.5 text-[11px] text-[#64748B]">
                  <div className="flex justify-between">
                    <span>Maior aumento projetado:</span>
                    <span className="font-bold text-[#1A2333]">
                      Ano {calculada.resumo.maiorAumentoReais.ano} (+
                      {formatBRL(calculada.resumo.maiorAumentoReais.valor)})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tratamento da Folha:</span>
                    <span className="font-semibold text-rose-600">Não gera crédito IBS/CBS</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Split Payment:</span>
                    <span className="font-semibold text-[#0FA3A3]">Retenção na liquidação</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ABA NOVA: RANKING SETORIAL DA CARTEIRA */}
        <TabsContent value="ranking_setorial" className="space-y-6">
          <RankingSetorialTab
            relatorio={relatorioSetorial}
            loading={loadingSetorial}
            onRecarregar={carregarRelatorioSetorial}
            tenantNome={tenant?.nome}
            tenantId={tenant?.id}
            usuarioId={user?.id}
            canExecute={user?.perfil === 'administrador' || user?.perfil === 'contador'}
            crcEscritorio="CRC/SP nº 2SP034821/O"
            onAbrirSimulacaoEmpresa={(empresaId) => {
              handleSelecionarEmpresa(empresaId)
              setActiveTab('simulador')
            }}
          />
        </TabsContent>

        {/* ABA 2: HISTÓRICO DE CENÁRIOS SALVOS */}
        <TabsContent value="historico" className="space-y-4">
          <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-[#1A2333]">
                  Cenários Salvos na Plataforma
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  Histórico de simulações salvas por empresa para acompanhamento e auditoria.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={carregarHistorico}
                className="gap-1.5 rounded-xl text-xs h-8"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Atualizar</span>
              </Button>
            </CardHeader>

            <CardContent className="pt-4">
              {loadingHistorico ? (
                <div className="py-8 text-center text-xs text-[#94A3B8]">
                  Carregando histórico...
                </div>
              ) : historico.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Calculator className="h-8 w-8 text-[#94A3B8] mx-auto opacity-50" />
                  <p className="text-sm font-semibold text-[#1A2333]">
                    Nenhuma simulação salva ainda
                  </p>
                  <p className="text-xs text-[#64748B]">
                    Configure as premissas no simulador e clique em &quot;Salvar Cenário&quot;.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {historico.map((item) => {
                    const resJson = item.resultado_json as any
                    const impacto = resJson?.impactoTotalAcumuladoReais ?? 0
                    return (
                      <div
                        key={item.id}
                        className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 p-2 rounded-xl transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[#1A2333]">{item.titulo}</span>
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {item.regime_atual.replace('_', ' ')}
                            </Badge>
                            {item.compartilhado_portal && (
                              <Badge className="bg-emerald-600 text-white text-[10px]">
                                Visível no Portal
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-[#64748B]">
                            {item.razao_social || 'Análise Avulsa'} • Faturamento:{' '}
                            {formatBRL(item.faturamento_anual)} • Setor:{' '}
                            {SETORES_CONFIG[item.setor_atividade as SetorAtividade]?.nome ||
                              item.setor_atividade}
                          </p>
                          <p className="text-[11px] text-[#94A3B8]">
                            Salvo em: {new Date(item.created).toLocaleString('pt-BR')}
                            {item.expand?.criado_por?.name && ` por ${item.expand.criado_por.name}`}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="text-right mr-2 hidden sm:block">
                            <span className="text-[10px] text-[#64748B] block">
                              Impacto Acumulado
                            </span>
                            <span
                              className={`text-xs font-bold ${
                                impacto > 0 ? 'text-amber-600' : 'text-emerald-600'
                              }`}
                            >
                              {impacto > 0 ? '+' : ''}
                              {formatBRL(impacto)}
                            </span>
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleCarregarDoHistorico(item)}
                            className="h-8 rounded-lg text-xs"
                            title="Carregar para o simulador"
                          >
                            Abrir
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleCompartilhamento(item)}
                            className={`h-8 rounded-lg text-xs ${
                              item.compartilhado_portal
                                ? 'text-emerald-700 bg-emerald-50'
                                : 'text-[#64748B]'
                            }`}
                            title={
                              item.compartilhado_portal
                                ? 'Remover compartilhamento do portal'
                                : 'Compartilhar no portal do cliente'
                            }
                          >
                            <Share2 className="h-3.5 w-3.5 mr-1" />
                            {item.compartilhado_portal ? 'No Portal' : 'Compartilhar'}
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleExcluirHistorico(item.id)}
                            className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 rounded-lg"
                            title="Excluir simulação"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 4: PARÂMETROS DA REFORMA VERSIONADOS */}
        <TabsContent value="parametros" className="space-y-6">
          <ParametrosReformaTab
            parametroAtivo={parametroAtivo}
            historico={historicoParametros}
            canEdit={canEditParametros}
            onReload={() => {
              carregarParametrosReforma()
              carregarRelatorioSetorial()
            }}
          />
        </TabsContent>
      </Tabs>

      {/* DIÁLOGO: SALVAR SIMULAÇÃO */}
      <Dialog open={modalSalvarOpen} onOpenChange={setModalSalvarOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333]">
              Salvar Cenário de Simulação
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Armazene esta projeção para consultas futuras, auditoria ou compartilhamento com o
              cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Título do Cenário *</Label>
              <Input
                value={tituloSimulacao}
                onChange={(e) => setTituloSimulacao(e.target.value)}
                placeholder="Ex: Cenário Otimista 2026-2033 - Inovatech"
                className="h-9 rounded-xl border-[#E2E8F0] text-xs"
              />
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-[11px] text-[#64748B]">
              <p>
                <strong className="text-[#1A2333]">Empresa:</strong> {razaoSocial || 'Avulsa'}
              </p>
              <p>
                <strong className="text-[#1A2333]">Faturamento:</strong>{' '}
                {formatBRL(faturamentoAnual)}
              </p>
              <p>
                <strong className="text-[#1A2333]">Regime:</strong>{' '}
                {regimeAtual.replace('_', ' ').toUpperCase()}
              </p>
              <p>
                <strong className="text-[#1A2333]">Variação em 2033:</strong>{' '}
                {(calculada.tabelaAnual.find((t) => t.ano === 2033)?.diferencaPercentual || 0) > 0
                  ? '+'
                  : ''}
                {calculada.tabelaAnual.find((t) => t.ano === 2033)?.diferencaPercentual}%
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalSalvarOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={salvando || !tituloSimulacao.trim()}
              onClick={handleSalvarSimulacao}
              className="rounded-xl bg-[#0FA3A3] text-white hover:bg-[#0C8585] text-xs"
            >
              {salvando ? 'Salvando...' : 'Salvar Projeção'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL COMPARADOR DE CENÁRIOS LADO A LADO */}
      <ComparadorCenariosModal
        open={modalComparadorOpen}
        onOpenChange={setModalComparadorOpen}
        cenarioBaseAtual={calculada}
        empresaAtual={
          selectedEmpresaId !== 'avulsa'
            ? empresas.find((e) => e.id === selectedEmpresaId) || null
            : null
        }
        historicoSalvo={historico}
        tenantNome={tenant?.name}
      />

      {/* MODAL RELATÓRIO IMPRIMÍVEL (PRINT TO PDF) */}
      <RelatorioReformaModal
        open={modalRelatorioOpen}
        onOpenChange={setModalRelatorioOpen}
        calculada={calculada}
        tituloRelatorio={tituloSimulacao || `Parecer Tributário - ${razaoSocial}`}
      />

      {/* MODAL APRESENTAÇÃO EXECUTIVA INDIVIDUAL */}
      <ApresentacaoExecutivaModal
        open={modalApresentacaoExecutivaOpen}
        onOpenChange={setModalApresentacaoExecutivaOpen}
        empresa={{
          empresaId: selectedEmpresaId,
          razaoSocial: razaoSocial || 'Empresa em Análise',
          nomeFantasia: empresas.find((e) => e.id === selectedEmpresaId)?.nome_fantasia || '',
          cnpj: empresas.find((e) => e.id === selectedEmpresaId)?.cnpj || '00.000.000/0001-00',
          regime: regimeAtual,
          porte: (empresas.find((e) => e.id === selectedEmpresaId)?.porte as any) || 'demais',
          setor: setorAtividade,
          setorNome: SETORES_CONFIG[setorAtividade]?.nome || 'Atividade Geral',
          cnaeDetectado: empresas.find((e) => e.id === selectedEmpresaId)?.cnae_principal || '',
          faturamentoBase: faturamentoAnual,
          origemFaturamento: origemReceitaRealInfo ? 'contabil_real' : 'porte_declarado',
          origemDescricao: origemReceitaRealInfo
            ? `Lançamentos Contábeis (${origemReceitaRealInfo.periodo})`
            : 'Informado Manualmente na Simulação',
          dadosSuficientes: faturamentoAnual > 0,
          tratamentoFavorecido: reducaoSetorial60,
          tratamentoBadge: reducaoSetorial60
            ? 'Redução 60% (LC 214/25)'
            : regimeAtual === 'simples_nacional'
              ? 'Simples 50%'
              : 'Regime Geral',
          percentualCreditos: percentualCreditosInsumos,
          cargaAtualReais: (faturamentoAnual * aliquotaAtualEstimada) / 100,
          aliquotaAtualEfetiva: aliquotaAtualEstimada,
          carga2033Reais:
            calculada.tabelaAnual.find((t) => t.ano === 2033)?.cargaProjetadaIBSCBSReais || 0,
          aliquota2033Efetiva:
            faturamentoAnual > 0
              ? Math.round(
                  ((calculada.tabelaAnual.find((t) => t.ano === 2033)?.cargaProjetadaIBSCBSReais ||
                    0) /
                    faturamentoAnual) *
                    100 *
                    10,
                ) / 10
              : 0,
          aliquota2033NominalCombinada:
            calculada.tabelaAnual.find((t) => t.ano === 2033)?.aliquotaNominalCombinada || 26.5,
          impacto2033Reais: calculada.tabelaAnual.find((t) => t.ano === 2033)?.diferencaReais || 0,
          variacao2033Percentual:
            calculada.tabelaAnual.find((t) => t.ano === 2033)?.diferencaPercentual || 0,
          impactoAcumuladoReais: calculada.resumo.impactoTotalAcumuladoReais,
          mediaVariacaoPercentual: calculada.resumo.mediaVariacaoPercentual,
          calculada: calculada,
        }}
        tenantNome={tenant?.nome}
        crcEscritorio="CRC/SP nº 2SP034821/O"
      />
    </div>
  )
}

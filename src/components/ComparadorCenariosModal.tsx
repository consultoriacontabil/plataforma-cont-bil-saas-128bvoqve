import React, { useState, useMemo, useRef } from 'react'
import {
  Printer,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Layers,
  ArrowRight,
  Sparkles,
  Award,
  Plus,
  Trash2,
  Info,
  Calendar,
  Building2,
  Percent,
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SimulacaoReformaRecord, Empresa } from '@/types'
import {
  SimulacaoCalculada,
  SimulacaoInput,
  calcularSimulacaoReforma,
  RegimeAtual,
} from '@/lib/reformaTributaria/calculos'
import { SETORES_CONFIG, SetorAtividade } from '@/lib/reformaTributaria/parametros'

export interface ComparadorItemCenario {
  id: string
  titulo: string
  estrategiaTag: string
  calculada: SimulacaoCalculada
  origem: 'salvo' | 'variacao'
}

interface ComparadorCenariosModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cenarioBaseAtual: SimulacaoCalculada
  empresaAtual?: Empresa | null
  historicoSalvo: SimulacaoReformaRecord[]
  tenantNome?: string
}

const CORES_CENARIOS = [
  { stroke: '#0FA3A3', fill: 'rgba(15, 163, 163, 0.1)', badge: 'bg-[#0FA3A3] text-white' },
  { stroke: '#123B6D', fill: 'rgba(18, 59, 109, 0.1)', badge: 'bg-[#123B6D] text-white' },
  { stroke: '#F59E0B', fill: 'rgba(245, 158, 11, 0.1)', badge: 'bg-amber-500 text-white' },
]

export function ComparadorCenariosModal({
  open,
  onOpenChange,
  cenarioBaseAtual,
  empresaAtual,
  historicoSalvo,
  tenantNome,
}: ComparadorCenariosModalProps) {
  const printRef = useRef<HTMLDivElement>(null)

  // Gerador de variações rápidas da mesma empresa
  const gerarCenariosPadrao = (): ComparadorItemCenario[] => {
    const baseInput = cenarioBaseAtual.inputs

    // Cenário 1: Base Atual (como configurado no formulário)
    const c1: ComparadorItemCenario = {
      id: 'cenario-base',
      titulo:
        'Cenário A: ' +
        (baseInput.permanecerNoSimplesNaTransicao
          ? 'Permanecer no Simples até 2032'
          : 'Regime Padrão'),
      estrategiaTag: baseInput.permanecerNoSimplesNaTransicao
        ? 'Simples Nacional 50%'
        : 'Regime Vigente',
      calculada: cenarioBaseAtual,
      origem: 'variacao',
    }

    // Cenário 2: Migração antecipada em 2027 (ou Lucro Presumido/Real se era Simples, ou sem benefício transitório)
    const input2: SimulacaoInput = {
      ...baseInput,
      permanecerNoSimplesNaTransicao: false,
      regimeAtual:
        baseInput.regimeAtual === 'simples_nacional' ? 'lucro_presumido' : baseInput.regimeAtual,
      aliquotaAtualEstimada:
        baseInput.regimeAtual === 'simples_nacional' ? 14.5 : baseInput.aliquotaAtualEstimada,
      percentualCreditosInsumos: Math.max(baseInput.percentualCreditosInsumos, 20),
    }
    const calc2 = calcularSimulacaoReforma(input2)
    const c2: ComparadorItemCenario = {
      id: 'cenario-migracao-2027',
      titulo: 'Cenário B: Migrar em 2027 para Regime Regular (Crédito Amplo)',
      estrategiaTag: 'Migração CBS 2027',
      calculada: calc2,
      origem: 'variacao',
    }

    // Cenário 3: Estratégia de Otimização (com Redução Setorial de 60% ou ampliação de créditos em insumos)
    const input3: SimulacaoInput = {
      ...baseInput,
      reducaoSetorial60: true,
      percentualCreditosInsumos: Math.min(
        100,
        Math.round(baseInput.percentualCreditosInsumos * 1.5 || 35),
      ),
    }
    const calc3 = calcularSimulacaoReforma(input3)
    const c3: ComparadorItemCenario = {
      id: 'cenario-otimizado-60',
      titulo: 'Cenário C: Estratégia Otimizada (Redução 60% + Gestão de Créditos)',
      estrategiaTag: 'Redução 60% / Otimizado',
      calculada: calc3,
      origem: 'variacao',
    }

    return [c1, c2, c3]
  }

  // Lista de 2 ou 3 cenários comparados ativamente
  const [cenarios, setCenarios] = useState<ComparadorItemCenario[]>(() => gerarCenariosPadrao())

  // Filtra simulações salvas da mesma empresa (ou todas se for avulsa)
  const simulacoesMesmaEmpresa = useMemo(() => {
    if (!cenarioBaseAtual.inputs.empresaId) return historicoSalvo
    return historicoSalvo.filter(
      (h) => h.empresa === cenarioBaseAtual.inputs.empresaId || !h.empresa,
    )
  }, [historicoSalvo, cenarioBaseAtual.inputs.empresaId])

  // Identifica o cenário mais vantajoso (menor impacto acumulado na transição e menor carga em 2033)
  const melhorCenarioId = useMemo(() => {
    if (cenarios.length === 0) return null
    let menorImpacto = Infinity
    let melhorId = cenarios[0].id

    cenarios.forEach((c) => {
      const imp = c.calculada.resumo.impactoTotalAcumuladoReais
      if (imp < menorImpacto) {
        menorImpacto = imp
        melhorId = c.id
      }
    })
    return melhorId
  }, [cenarios])

  // Dados para o Gráfico de Linhas Evolutivo Ano a Ano (2026-2033)
  const dadosGraficoLinhas = useMemo(() => {
    const anos = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]
    return anos.map((ano) => {
      const ponto: Record<string, any> = { ano: ano.toString() }
      cenarios.forEach((c, idx) => {
        const linhaAno = c.calculada.tabelaAnual.find((t) => t.ano === ano)
        ponto[`cenario_${idx}`] = linhaAno ? linhaAno.cargaProjetadaIBSCBSReais : 0
      })
      return ponto
    })
  }, [cenarios])

  const formatBRL = (val: number) => {
    return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  const handlePrint = () => {
    window.print()
  }

  // Substituir um slot por uma simulação salva do histórico
  const handleSelecionarDoHistorico = (index: number, simId: string) => {
    if (simId.startsWith('padrao_')) {
      // Criação rápida de estratégia variada
      const baseInput = cenarioBaseAtual.inputs
      let novoInput: SimulacaoInput = { ...baseInput }
      let novoTitulo = ''
      let tag = ''

      if (simId === 'padrao_simples_2032') {
        novoInput.regimeAtual = 'simples_nacional'
        novoInput.permanecerNoSimplesNaTransicao = true
        novoTitulo = 'Estratégia 1: Permanecer no Simples até 2032'
        tag = 'Simples Nacional 50%'
      } else if (simId === 'padrao_migrar_2027') {
        novoInput.regimeAtual = 'lucro_presumido'
        novoInput.permanecerNoSimplesNaTransicao = false
        novoInput.aliquotaAtualEstimada = 14.53
        novoInput.percentualCreditosInsumos = 25
        novoTitulo = 'Estratégia 2: Migrar em 2027 (CBS Plena)'
        tag = 'Migração 2027'
      } else if (simId === 'padrao_migrar_2033') {
        novoInput.regimeAtual = 'simples_nacional'
        novoInput.permanecerNoSimplesNaTransicao = true
        novoTitulo = 'Estratégia 3: Migração Plena em 2033'
        tag = 'Migração 2033'
      } else if (simId === 'padrao_reducao_60') {
        novoInput.reducaoSetorial60 = true
        novoTitulo = 'Estratégia 4: Redução Setorial de 60%'
        tag = 'Redução 60%'
      }

      const calc = calcularSimulacaoReforma(novoInput)
      const novoItem: ComparadorItemCenario = {
        id: `estrategia_${Date.now()}_${index}`,
        titulo: novoTitulo,
        estrategiaTag: tag,
        calculada: calc,
        origem: 'variacao',
      }

      setCenarios((prev) => {
        const copy = [...prev]
        copy[index] = novoItem
        return copy
      })
      return
    }

    const rec = historicoSalvo.find((h) => h.id === simId)
    if (!rec) return

    const inputsJson = rec.inputs_json as any
    const inputs: SimulacaoInput = inputsJson || {
      razaoSocial: rec.razao_social || 'Empresa',
      regimeAtual: rec.regime_atual,
      faturamentoAnual: rec.faturamento_anual,
      percentualCreditosInsumos: rec.percentual_creditos || 15,
      setorAtividade: (rec.setor_atividade as SetorAtividade) || 'servicos_geral',
      reducaoSetorial60: !!rec.reducao_setorial_60,
      vendeCestaBasica: !!rec.vende_cesta_basica,
      percentualCestaBasica: 0,
      aliquotaAtualEstimada: rec.aliquota_atual_estimada,
      permanecerNoSimplesNaTransicao: true,
      anoBase: 2026,
    }

    const calc = calcularSimulacaoReforma(inputs)
    const novoItem: ComparadorItemCenario = {
      id: rec.id,
      titulo: rec.titulo,
      estrategiaTag: rec.regime_atual.replace('_', ' ').toUpperCase(),
      calculada: calc,
      origem: 'salvo',
    }

    setCenarios((prev) => {
      const copy = [...prev]
      copy[index] = novoItem
      return copy
    })
  }

  // Adicionar 3º cenário se estiver com 2
  const handleAdicionarTerceiroCenario = () => {
    if (cenarios.length >= 3) return
    const baseInput = cenarioBaseAtual.inputs
    const input3: SimulacaoInput = {
      ...baseInput,
      reducaoSetorial60: true,
      percentualCreditosInsumos: 40,
    }
    const calc = calcularSimulacaoReforma(input3)
    setCenarios((prev) => [
      ...prev,
      {
        id: `cenario_extra_${Date.now()}`,
        titulo: 'Cenário C: Estratégia Alternativa Redução 60%',
        estrategiaTag: 'Alternativa 60%',
        calculada: calc,
        origem: 'variacao',
      },
    ])
  }

  // Remover cenário (mantendo no mínimo 2)
  const handleRemoverCenario = (index: number) => {
    if (cenarios.length <= 2) return
    setCenarios((prev) => prev.filter((_, idx) => idx !== index))
  }

  // Resetar para as 3 variações padrão
  const handleResetarPadrao = () => {
    setCenarios(gerarCenariosPadrao())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto p-0 rounded-2xl">
        {/* Cabeçalho de Navegação e Ações */}
        <DialogHeader className="p-6 pb-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 no-print">
          <div>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-lg font-bold text-[#1A2333]">
                Comparador Estratégico de Cenários da Reforma Tributária
              </DialogTitle>
              <Badge className="bg-[#0FA3A3] text-white text-[10px] font-bold">Lado a Lado</Badge>
            </div>
            <DialogDescription className="text-xs text-[#64748B] mt-0.5">
              Compare 2 a 3 estratégias para a mesma empresa (ex.: Simples até 2032 vs. migração em
              2027 vs. 2033).
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {cenarios.length < 3 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAdicionarTerceiroCenario}
                className="gap-1.5 rounded-xl text-xs font-semibold h-9"
              >
                <Plus className="h-4 w-4 text-[#0FA3A3]" />
                <span>Adicionar 3º Cenário</span>
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetarPadrao}
              className="gap-1.5 rounded-xl text-xs font-semibold h-9 text-[#64748B]"
            >
              <Layers className="h-4 w-4" />
              <span>Variações Padrão</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 rounded-xl text-xs font-semibold h-9 bg-[#123B6D] hover:bg-[#0B1F3A] text-white shadow-xs"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir / Salvar PDF</span>
            </Button>
          </div>
        </DialogHeader>

        {/* ÁREA FORMAL DE VISUALIZAÇÃO E IMPRESSÃO */}
        <div
          ref={printRef}
          className="p-6 md:p-8 space-y-6 bg-white print:p-0 print:m-0 print:text-black"
        >
          {/* Cabeçalho do Escritório Contábil */}
          <div className="border-b-2 border-[#123B6D] pb-4 flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-[#0FA3A3] text-white flex items-center justify-center font-bold text-xs print:border print:border-black">
                  R
                </div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#123B6D]">
                  {tenantNome || 'Rumo Consultoria Contábil'}
                </h3>
              </div>
              <p className="text-[11px] text-[#64748B]">
                CRC/SP nº 2SP034821/O • Inteligência Tributária & Planejamento Estratégico
              </p>
              <p className="text-[10px] text-[#94A3B8]">
                Empresa Analisada:{' '}
                <strong className="text-[#1A2333]">
                  {cenarioBaseAtual.inputs.razaoSocial ||
                    empresaAtual?.razao_social ||
                    'Cliente da Carteira'}
                </strong>{' '}
                {empresaAtual?.cnpj ? `(CNPJ: ${empresaAtual.cnpj})` : ''}
              </p>
            </div>

            <div className="text-right space-y-0.5">
              <Badge
                variant="outline"
                className="text-[10px] uppercase font-bold tracking-wider border-slate-300"
              >
                Comparativo Multicritério
              </Badge>
              <p className="text-xs font-bold text-[#1A2333] mt-1">
                Transição 2026–2033 (EC 132 & LC 214)
              </p>
              <p className="text-[10px] text-[#64748B]">
                Emissão: {new Date().toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>

          {/* SELETORES DE CENÁRIO (Controle interativo no modal, oculto na impressão) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
            {cenarios.map((cenario, idx) => {
              const cor = CORES_CENARIOS[idx] || CORES_CENARIOS[0]
              const isMelhor = cenario.id === melhorCenarioId

              return (
                <div key={cenario.id || idx} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1A2333] flex items-center gap-1.5">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: cor.stroke }}
                      />
                      Slot {idx + 1}: {cenario.estrategiaTag}
                    </span>
                    {cenarios.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoverCenario(idx)}
                        className="h-6 w-6 text-rose-600 hover:bg-rose-50"
                        title="Remover este cenário"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  <Select
                    onValueChange={(val) => handleSelecionarDoHistorico(idx, val)}
                    defaultValue={cenario.id}
                  >
                    <SelectTrigger className="h-8 rounded-xl text-xs bg-white border-[#E2E8F0]">
                      <SelectValue placeholder="Trocar estratégia/cenário..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="padrao_simples_2032">
                        -- Variação: Simples Nacional até 2032 --
                      </SelectItem>
                      <SelectItem value="padrao_migrar_2027">
                        -- Variação: Migrar em 2027 (CBS Integral) --
                      </SelectItem>
                      <SelectItem value="padrao_migrar_2033">
                        -- Variação: Migrar somente em 2033 --
                      </SelectItem>
                      <SelectItem value="padrao_reducao_60">
                        -- Variação: Aplicar Redução 60% --
                      </SelectItem>
                      {simulacoesMesmaEmpresa.length > 0 && (
                        <>
                          <SelectItem disabled value="__divider">
                            ── Cenários Salvos desta Empresa ──
                          </SelectItem>
                          {simulacoesMesmaEmpresa.map((h) => (
                            <SelectItem key={h.id} value={h.id}>
                              {h.titulo} ({formatBRL(h.faturamento_anual)})
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>

                  <div className="text-[11px] text-[#64748B] flex items-center justify-between px-1">
                    <span>Fat: {formatBRL(cenario.calculada.inputs.faturamentoAnual)}</span>
                    {isMelhor && (
                      <span className="font-bold text-emerald-700 flex items-center gap-0.5">
                        <Award className="h-3.5 w-3.5 text-emerald-600" />
                        Mais Vantajoso
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* CARDS COMPARATIVOS RESUMIDOS (LADO A LADO) */}
          <div
            className={`grid grid-cols-1 md:grid-cols-${cenarios.length} gap-4`}
            style={{
              gridTemplateColumns: `repeat(${cenarios.length}, minmax(0, 1fr))`,
            }}
          >
            {cenarios.map((cenario, idx) => {
              const cor = CORES_CENARIOS[idx] || CORES_CENARIOS[0]
              const isMelhor = cenario.id === melhorCenarioId
              const linha2033 = cenario.calculada.tabelaAnual.find((t) => t.ano === 2033)
              const cargaAtual =
                (cenario.calculada.inputs.faturamentoAnual *
                  cenario.calculada.inputs.aliquotaAtualEstimada) /
                100
              const carga2033 = linha2033?.cargaProjetadaIBSCBSReais || 0
              const difReais = linha2033?.diferencaReais || 0
              const difPerc = linha2033?.diferencaPercentual || 0
              const acum = cenario.calculada.resumo.impactoTotalAcumuladoReais

              return (
                <div
                  key={cenario.id || idx}
                  className={`rounded-2xl border p-4 space-y-3 relative transition-all ${
                    isMelhor
                      ? 'border-emerald-400 bg-emerald-50/30 shadow-xs ring-2 ring-emerald-500/20'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  {isMelhor && (
                    <div className="absolute -top-3 right-4">
                      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-extrabold text-[10px] uppercase shadow-sm px-2.5 py-0.5 gap-1">
                        <Award className="h-3 w-3" />
                        Recomendado
                      </Badge>
                    </div>
                  )}

                  <div className="border-b pb-2 space-y-0.5">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider block"
                      style={{ color: cor.stroke }}
                    >
                      Estratégia {idx + 1} • {cenario.estrategiaTag}
                    </span>
                    <h4 className="font-extrabold text-sm text-[#1A2333] line-clamp-2">
                      {cenario.titulo}
                    </h4>
                    <span className="text-[11px] text-[#64748B] block">
                      Regime: {cenario.calculada.inputs.regimeAtual.replace('_', ' ').toUpperCase()}{' '}
                      •{' '}
                      {SETORES_CONFIG[cenario.calculada.inputs.setorAtividade]?.nome ||
                        cenario.calculada.inputs.setorAtividade}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-[#64748B]">Carga Tributária Atual:</span>
                      <span className="font-mono font-bold text-[#1A2333]">
                        {formatBRL(cargaAtual)}/ano (
                        {cenario.calculada.inputs.aliquotaAtualEstimada}%)
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-[#64748B]">Carga Plena em 2033:</span>
                      <span className="font-mono font-bold text-[#1A2333]">
                        {formatBRL(carga2033)}/ano ({linha2033?.aliquotaEfetivaIBSCBS}%)
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                      <span className="text-[#64748B]">Variação em 2033:</span>
                      <span
                        className={`font-mono font-extrabold ${
                          difReais > 0 ? 'text-amber-600' : 'text-emerald-600'
                        }`}
                      >
                        {difReais > 0 ? '+' : ''}
                        {formatBRL(difReais)} ({difPerc > 0 ? '+' : ''}
                        {difPerc}%)
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                      <span className="text-[#64748B] font-semibold">Impacto Acumulado:</span>
                      <span
                        className={`font-mono font-black text-sm ${
                          acum > 0 ? 'text-amber-600' : 'text-emerald-600'
                        }`}
                      >
                        {acum > 0 ? '+' : ''}
                        {formatBRL(acum)}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-[#64748B] uppercase block">
                        Ponto de Virada:
                      </span>
                      <p className="text-[11px] text-[#1A2333] font-medium leading-tight mt-0.5">
                        {cenario.calculada.resumo.anoVirada
                          ? `Ano ${cenario.calculada.resumo.anoVirada}`
                          : 'Convergência Progressiva'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 bg-slate-50/70 p-2.5 rounded-xl">
                      <span className="text-[10px] font-bold text-[#123B6D] uppercase flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#0FA3A3]" />
                        Recomendação-Chave:
                      </span>
                      <p className="text-[11px] text-[#334155] leading-relaxed mt-1">
                        {cenario.calculada.resumo.recomendacoes[0] ||
                          'Acompanhar transição e regulamentação das leis complementares.'}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* GRÁFICO DE LINHAS: EVOLUÇÃO ANO A ANO DOS CENÁRIOS SELECIONADOS */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-[#1A2333] flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-[#0FA3A3]" />
                  Evolução da Carga Tributária Anual Lado a Lado (2026–2033)
                </h4>
                <p className="text-xs text-[#64748B]">
                  Curva de custos tributários projetados ano a ano para cada estratégia simulada (em
                  R$)
                </p>
              </div>
              <Badge variant="outline" className="text-[11px] border-slate-300">
                2026 a 2033
              </Badge>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={dadosGraficoLinhas}
                  margin={{ top: 10, right: 20, left: 20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="ano" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val: any, name: any) => {
                      const idx = Number(name.replace('cenario_', ''))
                      const cen = cenarios[idx]
                      return [formatBRL(Number(val) || 0), cen?.titulo || name]
                    }}
                    labelFormatter={(label) => `Ano de Exercício ${label}`}
                    contentStyle={{
                      backgroundColor: '#fff',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '11px',
                    }}
                  />
                  <Legend
                    formatter={(value) => {
                      const idx = Number(value.replace('cenario_', ''))
                      return cenarios[idx]?.titulo || value
                    }}
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  />
                  {cenarios.map((cenario, idx) => {
                    const cor = CORES_CENARIOS[idx] || CORES_CENARIOS[0]
                    return (
                      <Line
                        key={cenario.id || idx}
                        type="monotone"
                        dataKey={`cenario_${idx}`}
                        name={`cenario_${idx}`}
                        stroke={cor.stroke}
                        strokeWidth={cenario.id === melhorCenarioId ? 3.5 : 2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    )
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* TABELA COMPARATIVA COMPLETA ANO A ANO (2026 A 2033) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b pb-1.5">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#123B6D] flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-[#0FA3A3]" />
                Tabela Comparativa Consolidada de Carga Anual (2026–2033)
              </h4>
              <span className="text-[10px] text-[#64748B]">Valores em Reais (R$)</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 divide-y divide-slate-200">
                <thead className="bg-slate-100 font-bold text-[10px] uppercase text-[#64748B]">
                  <tr>
                    <th className="py-2.5 px-3">Ano</th>
                    <th className="py-2.5 px-3">Fase Legal</th>
                    {cenarios.map((c, idx) => (
                      <th key={c.id || idx} className="py-2.5 px-3 text-right">
                        {c.estrategiaTag}
                        {c.id === melhorCenarioId && (
                          <span className="ml-1 text-emerald-600 font-extrabold">★</span>
                        )}
                      </th>
                    ))}
                    <th className="py-2.5 px-3 text-right">Diferença Favorável</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {[2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033].map((ano) => {
                    const valoresAno = cenarios.map((c) => {
                      const linha = c.calculada.tabelaAnual.find((t) => t.ano === ano)
                      return linha ? linha.cargaProjetadaIBSCBSReais : 0
                    })
                    const minValor = Math.min(...valoresAno)
                    const maxValor = Math.max(...valoresAno)
                    const economiaMax = maxValor - minValor
                    const faseDesc =
                      cenarios[0]?.calculada.tabelaAnual.find((t) => t.ano === ano)?.fase || ''

                    return (
                      <tr key={ano} className={ano === 2033 ? 'bg-teal-50/50 font-semibold' : ''}>
                        <td className="py-2.5 px-3 font-bold font-mono text-[#1A2333]">
                          {ano}
                          {ano === 2033 && (
                            <span className="ml-1.5 px-1 py-0.2 rounded bg-teal-100 text-teal-800 text-[9px] uppercase font-bold">
                              Pleno
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-[#64748B]">
                          {ano === 2026
                            ? 'Ano Teste (1% compensável)'
                            : ano <= 2028
                              ? 'CBS Plena (8,8%) e IBS 0,1%'
                              : ano <= 2032
                                ? `Graduação IBS (${(ano - 2028) * 10}%)`
                                : 'Vigência Plena IBS/CBS'}
                        </td>
                        {cenarios.map((c, idx) => {
                          const linha = c.calculada.tabelaAnual.find((t) => t.ano === ano)
                          const valor = linha ? linha.cargaProjetadaIBSCBSReais : 0
                          const isMenorDoAno = valor === minValor && valoresAno.length > 1

                          return (
                            <td
                              key={c.id || idx}
                              className={`py-2.5 px-3 text-right font-mono ${
                                isMenorDoAno
                                  ? 'text-emerald-700 font-bold bg-emerald-50/40'
                                  : 'text-[#1A2333]'
                              }`}
                            >
                              {formatBRL(valor)}
                            </td>
                          )
                        })}
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                          {economiaMax > 10 ? `Economia de ${formatBRL(economiaMax)}` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* PARECER TÉCNICO COMPARATIVO */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#123B6D] flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-[#0FA3A3]" />
              Conclusão da Análise Comparativa do Escritório
            </h4>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-[#334155] space-y-2">
              <p className="leading-relaxed">
                Com base no cruzamento das <strong>{cenarios.length} estratégias analisadas</strong>
                , o cenário mais vantajoso no horizonte da transição 2026–2033 é o{' '}
                <strong className="text-emerald-700">
                  {cenarios.find((c) => c.id === melhorCenarioId)?.titulo || 'Recomendado'}
                </strong>
                , que totaliza menor desembolso acumulado de tributos (
                <strong>
                  {formatBRL(
                    cenarios.find((c) => c.id === melhorCenarioId)?.calculada.resumo
                      .impactoTotalAcumuladoReais || 0,
                  )}
                </strong>
                ).
              </p>
              <p className="leading-relaxed text-[11px] text-[#64748B]">
                Recomendamos revisão contratual e parametrização do software de gestão tributária
                até o 4º trimestre de 2026 para aproveitamento imediato do período teste (CBS 0,9% +
                IBS 0,1%), assegurando que nenhum crédito da cadeia produtiva seja desperdiçado.
              </p>
            </div>
          </div>

          {/* Assinatura do Contador / Responsável Técnico */}
          <div className="pt-8 border-t border-slate-300 flex justify-between items-end text-xs">
            <div>
              <p className="text-[10px] text-[#94A3B8]">
                Elaborado por Plataforma Contábil Rumo Contábil
              </p>
              <p className="text-[10px] text-[#94A3B8]">
                Módulo Fiscal & Comparador de Cenários Tributários
              </p>
            </div>
            <div className="text-center w-64 border-t border-slate-400 pt-1">
              <p className="font-bold text-[#1A2333]">
                {tenantNome || 'Rumo Consultoria Contábil'}
              </p>
              <p className="text-[11px] text-[#64748B]">Departamento de Inteligência Tributária</p>
              <p className="text-[10px] text-[#94A3B8]">CRC/SP 2SP034821/O</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

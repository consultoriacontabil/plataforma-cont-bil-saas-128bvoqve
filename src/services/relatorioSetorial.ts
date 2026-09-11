import pb from '@/lib/pocketbase/client'
import type { Empresa, SimulacaoReformaRecord } from '@/types'
import {
  SetorAtividade,
  SETORES_CONFIG,
  estimarAliquotaSimplesNacional,
} from '@/lib/reformaTributaria/parametros'
import {
  calcularSimulacaoReforma,
  SimulacaoInput,
  SimulacaoCalculada,
  RegimeAtual,
} from '@/lib/reformaTributaria/calculos'
import { simuladorReformaService } from './simuladorReforma'

export type OrigemFaturamento =
  | 'contabil_real'
  | 'simulacao_salva'
  | 'porte_declarado'
  | 'insuficiente'

export interface EmpresaImpactoSetorial {
  empresaId: string
  razaoSocial: string
  nomeFantasia?: string
  cnpj: string
  uf?: string
  cidade?: string
  regime: RegimeAtual
  regimeOriginal?: string
  porte?: string
  setor: SetorAtividade
  setorNome: string
  cnaeDetectado?: string
  faturamentoBase: number
  origemFaturamento: OrigemFaturamento
  origemDescricao: string
  dadosSuficientes: boolean
  tratamentoFavorecido: boolean // reducao 60%
  tratamentoBadge: string
  percentualCreditos: number
  // Métricas financeiras e de alíquotas
  cargaAtualReais: number
  aliquotaAtualEfetiva: number
  carga2033Reais: number
  aliquota2033Efetiva: number
  aliquota2033NominalCombinada: number
  impacto2033Reais: number
  variacao2033Percentual: number
  impactoAcumuladoReais: number
  mediaVariacaoPercentual: number
  calculada?: SimulacaoCalculada
}

export interface SetorResumoRanking {
  setorId: SetorAtividade
  setorNome: string
  reducao60: boolean
  quantidadeEmpresas: number
  faturamentoTotal: number
  cargaAtualTotal: number
  carga2033Total: number
  impacto2033Total: number
  variacaoMediaPercentual: number
  impactoAcumuladoTotal: number
}

export interface RelatorioSetorialCarteira {
  geradoEm: string
  tenantId: string
  totalEmpresasAnalisadas: number
  totalEmpresasSuficientes: number
  totalEmpresasInsuficientes: number
  impactoTotalCarteiraAcumuladoReais: number
  faturamentoTotalCarteira: number
  cargaAtualTotalCarteira: number
  carga2033TotalCarteira: number
  variacaoGeralCarteiraPercentual: number
  empresasMaisImpactadasAumento: EmpresaImpactoSetorial[]
  empresasMaisBeneficiadasEconomia: EmpresaImpactoSetorial[]
  rankingEmpresas: EmpresaImpactoSetorial[] // ordenadas do maior para o menor impacto acumulado, insuficientes no fim
  setoresResumo: SetorResumoRanking[]
}

/**
 * Classifica a empresa no setor do motor da reforma a partir de CNAE, observações,
 * razão social e nome fantasia.
 */
export function detectarSetorAtividade(
  empresa: Empresa,
  cnaeAssistido?: string,
  simulacaoSalva?: SimulacaoReformaRecord,
): { setor: SetorAtividade; cnaeTexto?: string; reducao60: boolean } {
  // 1. Se houver simulação previamente salva para a empresa, respeitar a escolha
  if (
    simulacaoSalva?.setor_atividade &&
    SETORES_CONFIG[simulacaoSalva.setor_atividade as SetorAtividade]
  ) {
    const setorId = simulacaoSalva.setor_atividade as SetorAtividade
    return {
      setor: setorId,
      cnaeTexto: undefined,
      reducao60: SETORES_CONFIG[setorId].reducao60 || !!simulacaoSalva.reducao_setorial_60,
    }
  }

  const textoBusca = [
    empresa.razao_social || '',
    empresa.nome_fantasia || '',
    empresa.observacoes || '',
    cnaeAssistido || '',
  ]
    .join(' ')
    .toLowerCase()

  // Extrair CNAE se houver
  const cnaeMatch = textoBusca.match(/\b\d{2}\.?\d{2}-?\d-?\d{2}\b/)
  const cnaeTexto = cnaeAssistido || (cnaeMatch ? cnaeMatch[0] : undefined)

  // 1. Saúde Humana (LC 214/2025 art. 9º - Redução de 60%)
  // CNAE divisão 86
  if (
    textoBusca.includes('86.') ||
    textoBusca.includes('saúde') ||
    textoBusca.includes('saude') ||
    textoBusca.includes('médic') ||
    textoBusca.includes('medic') ||
    textoBusca.includes('clínica') ||
    textoBusca.includes('clinica') ||
    textoBusca.includes('hospital') ||
    textoBusca.includes('odontol') ||
    textoBusca.includes('laborat') ||
    textoBusca.includes('fisioterap') ||
    textoBusca.includes('dmed')
  ) {
    return { setor: 'servicos_saude', cnaeTexto, reducao60: true }
  }

  // 2. Educação (LC 214/2025 art. 9º - Redução 60%)
  // CNAE divisão 85
  if (
    textoBusca.includes('85.') ||
    textoBusca.includes('educa') ||
    textoBusca.includes('escola') ||
    textoBusca.includes('faculdade') ||
    textoBusca.includes('ensino') ||
    textoBusca.includes('treinamento') ||
    textoBusca.includes('colégio') ||
    textoBusca.includes('colegio')
  ) {
    return { setor: 'servicos_educacao', cnaeTexto, reducao60: true }
  }

  // 3. Dispositivos Médicos
  if (
    textoBusca.includes('prótese') ||
    textoBusca.includes('protese') ||
    textoBusca.includes('ortopédic') ||
    textoBusca.includes('dispositivo médico') ||
    textoBusca.includes('aparelho auditivo')
  ) {
    return { setor: 'dispositivos_medicos', cnaeTexto, reducao60: true }
  }

  // 4. Agropecuária e Insumos (Redução 60%)
  // CNAE divisões 01 a 03
  if (
    textoBusca.includes('agro') ||
    textoBusca.includes('rural') ||
    textoBusca.includes('fazenda') ||
    textoBusca.includes('insumo agrícol') ||
    textoBusca.includes('insumo agricol') ||
    textoBusca.includes('adubo') ||
    textoBusca.includes('sementes')
  ) {
    return { setor: 'agropecuaria_insumos', cnaeTexto, reducao60: true }
  }

  // 5. Transporte Coletivo de Passageiros (Redução 60%)
  // CNAE 492
  if (
    textoBusca.includes('transporte coletivo') ||
    textoBusca.includes('passageiros') ||
    textoBusca.includes('ônibus') ||
    textoBusca.includes('onibus') ||
    textoBusca.includes('viação') ||
    textoBusca.includes('viacao')
  ) {
    return { setor: 'transporte_coletivo', cnaeTexto, reducao60: true }
  }

  // 6. Tecnologia da Informação & Software
  // CNAE divisão 62 ou 63
  if (
    textoBusca.includes('62.') ||
    textoBusca.includes('software') ||
    textoBusca.includes('tecnologia') ||
    textoBusca.includes('informática') ||
    textoBusca.includes('informatica') ||
    textoBusca.includes('programação') ||
    textoBusca.includes('programacao') ||
    textoBusca.includes('saas') ||
    textoBusca.includes('nuvem') ||
    textoBusca.includes('ti') ||
    textoBusca.includes('tech')
  ) {
    return { setor: 'tecnologia_software', cnaeTexto, reducao60: false }
  }

  // 7. Indústria e Transformação
  // CNAE divisões 10 a 33
  if (
    textoBusca.includes('indústria') ||
    textoBusca.includes('industria') ||
    textoBusca.includes('fábrica') ||
    textoBusca.includes('fabrica') ||
    textoBusca.includes('manufatura') ||
    textoBusca.includes('metalúrg') ||
    textoBusca.includes('metalurg')
  ) {
    return { setor: 'industria_transformacao', cnaeTexto, reducao60: false }
  }

  // 8. Comércio Varejista e Atacadista Geral
  // CNAE divisões 45 a 47
  if (
    textoBusca.includes('comércio') ||
    textoBusca.includes('comercio') ||
    textoBusca.includes('varej') ||
    textoBusca.includes('atacad') ||
    textoBusca.includes('loja') ||
    textoBusca.includes('cafeteria') ||
    textoBusca.includes('grãos') ||
    textoBusca.includes('graos') ||
    textoBusca.includes('mercado') ||
    textoBusca.includes('supermercado')
  ) {
    return { setor: 'comercio_geral', cnaeTexto, reducao60: false }
  }

  // 9. Padrão: Serviços Gerais (consultorias, BPO, contabilidade, advocacia, etc.)
  return { setor: 'servicos_geral', cnaeTexto, reducao60: false }
}

/**
 * Mapeia o regime do cadastro para o tipo do simulador
 */
function normalizarRegime(regimeCadastrado?: string): RegimeAtual {
  if (regimeCadastrado === 'lucro_presumido') return 'lucro_presumido'
  if (regimeCadastrado === 'lucro_real') return 'lucro_real'
  return 'simples_nacional'
}

/**
 * Estima um faturamento anual padrão pelo porte quando não há receita real nem simulação salva
 */
function estimarFaturamentoPorPorte(porte?: string): number {
  switch (porte) {
    case 'mei':
      return 60000
    case 'me':
      return 600000
    case 'epp':
      return 2400000
    case 'demais':
      return 6000000
    default:
      return 0
  }
}

export const relatorioSetorialService = {
  /**
   * Executa a análise setorial completa de toda a carteira de empresas do escritório (multi-tenant)
   */
  async gerarRankingSetorialCarteira(
    tenantId: string,
    filtroStatus = "status = 'ativo'",
  ): Promise<RelatorioSetorialCarteira> {
    // 1. Buscar todas as empresas ativas da carteira
    const empresas = await pb.collection('empresas').getFullList<Empresa>({
      filter: `tenant_id = "${tenantId}"${filtroStatus ? ` && (${filtroStatus})` : ''}`,
      sort: 'razao_social',
    })

    // 2. Buscar simulações existentes para reaproveitar parâmetros refinados pelo contador
    let simulacoesExistentes: SimulacaoReformaRecord[] = []
    try {
      simulacoesExistentes = await pb
        .collection('simulacoes_reforma')
        .getFullList<SimulacaoReformaRecord>({
          filter: `tenant_id = "${tenantId}"`,
          sort: '-created',
        })
    } catch (err) {
      console.warn('Simulações prévias não carregadas:', err)
    }

    const simulacoesPorEmpresaMap = new Map<string, SimulacaoReformaRecord>()
    for (const sim of simulacoesExistentes) {
      if (sim.empresa && !simulacoesPorEmpresaMap.has(sim.empresa)) {
        simulacoesPorEmpresaMap.set(sim.empresa, sim)
      }
    }

    // 3. Buscar dados de cadastro assistido para detectar CNAE
    let cadastrosAssistidos: any[] = []
    try {
      cadastrosAssistidos = await pb.collection('empresa_cadastro_assistido').getFullList({
        filter: `tenant_id = "${tenantId}"`,
      })
    } catch {
      // Ignora se não houver
    }
    const cnaePorEmpresaMap = new Map<string, string>()
    for (const ca of cadastrosAssistidos) {
      if (ca.empresa && ca.campos_extraidos?.cnae_principal) {
        cnaePorEmpresaMap.set(ca.empresa, ca.campos_extraidos.cnae_principal)
      }
    }

    // 4. Processar cada empresa individualmente
    const empresasAnalisadas: EmpresaImpactoSetorial[] = []

    for (const emp of empresas) {
      const simSalva = simulacoesPorEmpresaMap.get(emp.id)
      const cnaeCadastrado = cnaePorEmpresaMap.get(emp.id)

      // Identificar setor e tratamento favorecido
      const deteccao = detectarSetorAtividade(emp, cnaeCadastrado, simSalva)
      const setorId = deteccao.setor
      const setorConfig = SETORES_CONFIG[setorId]
      const reducao60 = deteccao.reducao60

      // Regime tributário
      const regime = normalizarRegime(simSalva?.regime_atual || emp.regime_tributario)

      // Determinação do faturamento base e origem
      let faturamentoBase = 0
      let origemFaturamento: OrigemFaturamento = 'insuficiente'
      let origemDescricao = 'Sem dados suficientes'

      // Prioridade 1: Tentar receita contábil real dos lançamentos
      try {
        const receitaReal = await simuladorReformaService.obterReceitaRealExercicio(
          tenantId,
          emp.id,
        )
        if (receitaReal.sucesso && receitaReal.faturamentoTotal > 0) {
          faturamentoBase = receitaReal.faturamentoTotal
          origemFaturamento = 'contabil_real'
          origemDescricao = `Lançamentos contábeis (${receitaReal.periodoDescricao})`
        }
      } catch {
        // Fallback para próxima opção
      }

      // Prioridade 2: Simulação salva previamente
      if (faturamentoBase === 0 && simSalva && simSalva.faturamento_anual > 0) {
        faturamentoBase = simSalva.faturamento_anual
        origemFaturamento = 'simulacao_salva'
        origemDescricao = `Cenário salvo "${simSalva.titulo}"`
      }

      // Prioridade 3: Estimativa pelo porte cadastrado
      if (faturamentoBase === 0 && emp.porte) {
        const estimadoPorte = estimarFaturamentoPorPorte(emp.porte)
        if (estimadoPorte > 0) {
          faturamentoBase = estimadoPorte
          origemFaturamento = 'porte_declarado'
          origemDescricao = `Estimado pelo porte cadastrado (${emp.porte.toUpperCase()})`
        }
      }

      const dadosSuficientes = faturamentoBase > 0

      // Determinar alíquota estimada atual
      let aliqAtual = simSalva?.aliquota_atual_estimada
      if (!aliqAtual || aliqAtual <= 0) {
        if (regime === 'simples_nacional') {
          aliqAtual = estimarAliquotaSimplesNacional(faturamentoBase || 600000, setorId)
        } else if (regime === 'lucro_presumido') {
          aliqAtual = setorConfig.aliquotaAtualEstimadaPresumido
        } else {
          aliqAtual = setorConfig.aliquotaAtualEstimadaReal
        }
      }

      const percentualCreditos =
        simSalva?.percentual_creditos !== undefined
          ? simSalva.percentual_creditos
          : setorConfig.percentualCreditosInsumosPadrao

      // Badge de tratamento setorial
      let tratamentoBadge = 'Regime Geral (26,5%)'
      if (reducao60) {
        tratamentoBadge = 'Redução 60% (LC 214/25)'
      } else if (regime === 'simples_nacional') {
        tratamentoBadge = 'Simples / Redução 50% transição'
      }

      if (!dadosSuficientes) {
        // Empresa sem dados suficientes para projeção determinística
        empresasAnalisadas.push({
          empresaId: emp.id,
          razaoSocial: emp.razao_social,
          nomeFantasia: emp.nome_fantasia,
          cnpj: emp.cnpj,
          uf: emp.uf,
          cidade: emp.cidade,
          regime,
          regimeOriginal: emp.regime_tributario,
          porte: emp.porte,
          setor: setorId,
          setorNome: setorConfig.nome,
          cnaeDetectado: deteccao.cnaeTexto,
          faturamentoBase: 0,
          origemFaturamento: 'insuficiente',
          origemDescricao: 'Faturamento não informado nem estimado',
          dadosSuficientes: false,
          tratamentoFavorecido: reducao60,
          tratamentoBadge,
          percentualCreditos,
          cargaAtualReais: 0,
          aliquotaAtualEfetiva: aliqAtual,
          carga2033Reais: 0,
          aliquota2033Efetiva: 0,
          aliquota2033NominalCombinada: 0,
          impacto2033Reais: 0,
          variacao2033Percentual: 0,
          impactoAcumuladoReais: 0,
          mediaVariacaoPercentual: 0,
        })
        continue
      }

      // Executar cálculo do simulador determinístico
      const inputSimulacao: SimulacaoInput = {
        empresaId: emp.id,
        razaoSocial: emp.razao_social,
        regimeAtual: regime,
        faturamentoAnual: faturamentoBase,
        percentualCreditosInsumos: percentualCreditos,
        setorAtividade: setorId,
        reducaoSetorial60: reducao60,
        vendeCestaBasica: simSalva?.vende_cesta_basica ?? false,
        percentualCestaBasica: (simSalva?.inputs_json as any)?.percentualCestaBasica ?? 0,
        aliquotaAtualEstimada: aliqAtual,
        permanecerNoSimplesNaTransicao: true,
        anoBase: 2026,
      }

      const calculada = calcularSimulacaoReforma(inputSimulacao)
      const linha2033 = calculada.tabelaAnual.find((t) => t.ano === 2033)
      const cargaAtualReais = (faturamentoBase * aliqAtual) / 100
      const carga2033Reais = linha2033?.cargaProjetadaIBSCBSReais ?? 0
      const impacto2033Reais = linha2033?.diferencaReais ?? 0
      const variacao2033Percentual = linha2033?.diferencaPercentual ?? 0

      empresasAnalisadas.push({
        empresaId: emp.id,
        razaoSocial: emp.razao_social,
        nomeFantasia: emp.nome_fantasia,
        cnpj: emp.cnpj,
        uf: emp.uf,
        cidade: emp.cidade,
        regime,
        regimeOriginal: emp.regime_tributario,
        porte: emp.porte,
        setor: setorId,
        setorNome: setorConfig.nome,
        cnaeDetectado: deteccao.cnaeTexto,
        faturamentoBase,
        origemFaturamento,
        origemDescricao,
        dadosSuficientes: true,
        tratamentoFavorecido: reducao60,
        tratamentoBadge,
        percentualCreditos,
        cargaAtualReais: Math.round(cargaAtualReais * 100) / 100,
        aliquotaAtualEfetiva: aliqAtual,
        carga2033Reais: Math.round(carga2033Reais * 100) / 100,
        aliquota2033Efetiva: linha2033?.aliquotaEfetivaIBSCBS ?? 0,
        aliquota2033NominalCombinada: linha2033?.aliquotaNominalCombinada ?? 26.5,
        impacto2033Reais: Math.round(impacto2033Reais * 100) / 100,
        variacao2033Percentual,
        impactoAcumuladoReais: Math.round(calculada.resumo.impactoTotalAcumuladoReais * 100) / 100,
        mediaVariacaoPercentual: Math.round(calculada.resumo.mediaVariacaoPercentual * 10) / 10,
        calculada,
      })
    }

    // 5. Ordenar ranking: empresas com dados suficientes do maior impacto acumulado para o menor (aumentos no topo, economias no fim),
    // seguidas pelas empresas com dados insuficientes no final da lista
    const suficientes = empresasAnalisadas.filter((e) => e.dadosSuficientes)
    const insuficientes = empresasAnalisadas.filter((e) => !e.dadosSuficientes)

    suficientes.sort((a, b) => b.impactoAcumuladoReais - a.impactoAcumuladoReais)
    const rankingOrdenado = [...suficientes, ...insuficientes]

    // 6. Agrupamento por Setor
    const setorMap = new Map<SetorAtividade, SetorResumoRanking>()
    for (const e of suficientes) {
      if (!setorMap.has(e.setor)) {
        setorMap.set(e.setor, {
          setorId: e.setor,
          setorNome: e.setorNome,
          reducao60: e.tratamentoFavorecido,
          quantidadeEmpresas: 0,
          faturamentoTotal: 0,
          cargaAtualTotal: 0,
          carga2033Total: 0,
          impacto2033Total: 0,
          variacaoMediaPercentual: 0,
          impactoAcumuladoTotal: 0,
        })
      }
      const s = setorMap.get(e.setor)!
      s.quantidadeEmpresas += 1
      s.faturamentoTotal += e.faturamentoBase
      s.cargaAtualTotal += e.cargaAtualReais
      s.carga2033Total += e.carga2033Reais
      s.impacto2033Total += e.impacto2033Reais
      s.impactoAcumuladoTotal += e.impactoAcumuladoReais
    }

    const setoresResumo: SetorResumoRanking[] = Array.from(setorMap.values()).map((s) => {
      const varMedia =
        s.cargaAtualTotal > 0
          ? ((s.carga2033Total - s.cargaAtualTotal) / s.cargaAtualTotal) * 100
          : 0
      return {
        ...s,
        faturamentoTotal: Math.round(s.faturamentoTotal * 100) / 100,
        cargaAtualTotal: Math.round(s.cargaAtualTotal * 100) / 100,
        carga2033Total: Math.round(s.carga2033Total * 100) / 100,
        impacto2033Total: Math.round(s.impacto2033Total * 100) / 100,
        impactoAcumuladoTotal: Math.round(s.impactoAcumuladoTotal * 100) / 100,
        variacaoMediaPercentual: Math.round(varMedia * 10) / 10,
      }
    })

    // Ordenar setores do maior impacto acumulado total para o menor
    setoresResumo.sort((a, b) => b.impactoAcumuladoTotal - a.impactoAcumuladoTotal)

    // 7. Totais executivos da carteira
    let totalFat = 0
    let totalCargaAtual = 0
    let totalCarga2033 = 0
    let totalImpactoAcumulado = 0

    for (const e of suficientes) {
      totalFat += e.faturamentoBase
      totalCargaAtual += e.cargaAtualReais
      totalCarga2033 += e.carga2033Reais
      totalImpactoAcumulado += e.impactoAcumuladoReais
    }

    const variacaoGeralCarteira =
      totalCargaAtual > 0 ? ((totalCarga2033 - totalCargaAtual) / totalCargaAtual) * 100 : 0

    const empresasMaisImpactadasAumento = suficientes
      .filter((e) => e.impactoAcumuladoReais > 0)
      .slice(0, 3)
    const empresasMaisBeneficiadasEconomia = suficientes
      .filter((e) => e.impactoAcumuladoReais <= 0)
      .sort((a, b) => a.impactoAcumuladoReais - b.impactoAcumuladoReais)
      .slice(0, 3)

    return {
      geradoEm: new Date().toISOString(),
      tenantId,
      totalEmpresasAnalisadas: empresas.length,
      totalEmpresasSuficientes: suficientes.length,
      totalEmpresasInsuficientes: insuficientes.length,
      impactoTotalCarteiraAcumuladoReais: Math.round(totalImpactoAcumulado * 100) / 100,
      faturamentoTotalCarteira: Math.round(totalFat * 100) / 100,
      cargaAtualTotalCarteira: Math.round(totalCargaAtual * 100) / 100,
      carga2033TotalCarteira: Math.round(totalCarga2033 * 100) / 100,
      variacaoGeralCarteiraPercentual: Math.round(variacaoGeralCarteira * 10) / 10,
      empresasMaisImpactadasAumento,
      empresasMaisBeneficiadasEconomia,
      rankingEmpresas: rankingOrdenado,
      setoresResumo,
    }
  },

  /**
   * Exporta os dados do ranking para formato CSV formatado para Excel/Planilhas Google
   */
  gerarCsvRanking(dados: RelatorioSetorialCarteira, tenantNome?: string): string {
    const cabecalho = [
      'Empresa (Razao Social)',
      'Nome Fantasia',
      'CNPJ',
      'Setor de Atividade',
      'CNAE Identificado',
      'Regime Tributario',
      'Origem do Faturamento',
      'Faturamento Base Anual (R$)',
      'Carga Tributaria Atual (R$)',
      'Aliq. Atual (%)',
      'Carga 2033 Projetada (R$)',
      'Aliq. 2033 (%)',
      'Variacao 2033 (R$)',
      'Variacao 2033 (%)',
      'Impacto Acumulado 2026-2033 (R$)',
      'Tratamento Setorial',
      'Status dos Dados',
    ]

    const linhas = dados.rankingEmpresas.map((item) => {
      return [
        `"${(item.razaoSocial || '').replace(/"/g, '""')}"`,
        `"${(item.nomeFantasia || '').replace(/"/g, '""')}"`,
        `"${item.cnpj}"`,
        `"${item.setorNome.replace(/"/g, '""')}"`,
        `"${(item.cnaeDetectado || 'Não identificado').replace(/"/g, '""')}"`,
        `"${item.regime.replace('_', ' ').toUpperCase()}"`,
        `"${item.origemDescricao.replace(/"/g, '""')}"`,
        item.dadosSuficientes ? item.faturamentoBase.toFixed(2).replace('.', ',') : '0,00',
        item.dadosSuficientes ? item.cargaAtualReais.toFixed(2).replace('.', ',') : '0,00',
        item.dadosSuficientes ? item.aliquotaAtualEfetiva.toFixed(1).replace('.', ',') : '0,0',
        item.dadosSuficientes ? item.carga2033Reais.toFixed(2).replace('.', ',') : '0,00',
        item.dadosSuficientes ? item.aliquota2033Efetiva.toFixed(1).replace('.', ',') : '0,0',
        item.dadosSuficientes ? item.impacto2033Reais.toFixed(2).replace('.', ',') : '0,00',
        item.dadosSuficientes ? item.variacao2033Percentual.toFixed(1).replace('.', ',') : '0,0',
        item.dadosSuficientes ? item.impactoAcumuladoReais.toFixed(2).replace('.', ',') : '0,00',
        `"${item.tratamentoBadge.replace(/"/g, '""')}"`,
        item.dadosSuficientes ? '"Suficiente"' : '"Dados Insuficientes"',
      ].join(';')
    })

    const infoHeader = [
      `# Relatorio de Impacto Setorial da Reforma Tributaria (IBS/CBS)`,
      `# Escritorio: ${tenantNome || 'Rumo Consultoria Contabil'}`,
      `# Emissao: ${new Date(dados.geradoEm).toLocaleString('pt-BR')}`,
      `# Total Analisado: ${dados.totalEmpresasAnalisadas} empresas | Impacto Total: R$ ${dados.impactoTotalCarteiraAcumuladoReais.toFixed(2)}`,
      '',
    ].join('\n')

    return infoHeader + [cabecalho.join(';'), ...linhas].join('\n')
  },
}

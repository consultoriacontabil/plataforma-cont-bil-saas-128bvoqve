import {
  PARAMETROS_REFORMA,
  SETORES_CONFIG,
  SetorAtividade,
  ParametrosAnoTransicao,
} from './parametros'

export type RegimeAtual = 'simples_nacional' | 'lucro_presumido' | 'lucro_real'

export interface SimulacaoInput {
  empresaId?: string
  razaoSocial: string
  regimeAtual: RegimeAtual
  faturamentoAnual: number
  percentualCreditosInsumos: number // 0 a 100%
  setorAtividade: SetorAtividade
  reducaoSetorial60: boolean
  vendeCestaBasica: boolean // se true, itens com alíquota zero
  percentualCestaBasica: number // 0 a 100% da receita que corresponde a cesta básica
  aliquotaAtualEstimada: number // %
  permanecerNoSimplesNaTransicao: boolean
  anoBase: number
}

export interface ResultadoAnoTransicao {
  ano: number
  descricao: string
  fase: string
  // Valores atuais
  cargaAtualEstimadaReais: number
  aliquotaAtualEfetiva: number
  // Valores projetados IBS/CBS
  aliquotaNominalCBS: number
  aliquotaNominalIBS: number
  aliquotaNominalCombinada: number
  aliquotaEfetivaIBSCBS: number
  valorDebitoBrutoReais: number
  valorCreditosInsumosReais: number
  valorResidualTributosAntigosReais: number
  cargaProjetadaIBSCBSReais: number
  // Comparativo
  diferencaReais: number // Positivo = aumento de carga tributária, Negativo = economia
  diferencaPercentual: number // % de variação sobre a carga atual
  impactoTipo: 'economia' | 'aumento' | 'neutro'
}

export interface ResumoSimulacao {
  anoVirada?: number // Primeiro ano em que a variação muda de sinal ou atinge pico
  impactoTotalAcumuladoReais: number
  mediaVariacaoPercentual: number
  maiorAumentoReais: { ano: number; valor: number }
  maiorEconomiaReais: { ano: number; valor: number }
  pontoCritico: string
  recomendacoes: string[]
}

export interface SimulacaoCalculada {
  inputs: SimulacaoInput
  tabelaAnual: ResultadoAnoTransicao[]
  resumo: ResumoSimulacao
  parametrosUtilizados: {
    aliquotaReferenciaPlena: typeof PARAMETROS_REFORMA.aliquotaReferenciaPlena
    reducaoAplicadaPercentual: number
    versaoNormativa: string
  }
}

/**
 * Motor central de cálculo determinístico da Reforma Tributária (IBS/CBS)
 * Segue as regras da EC 132/2023, LC 214/2025 e cronograma 2026-2033.
 */
export function calcularSimulacaoReforma(input: SimulacaoInput): SimulacaoCalculada {
  const {
    regimeAtual,
    faturamentoAnual,
    percentualCreditosInsumos,
    setorAtividade,
    reducaoSetorial60,
    vendeCestaBasica,
    percentualCestaBasica,
    aliquotaAtualEstimada,
    permanecerNoSimplesNaTransicao,
  } = input

  // Fator de redução de alíquota sobre o IBS/CBS
  let fatorAliquotaIBSCBS = 1.0

  if (vendeCestaBasica && percentualCestaBasica > 0) {
    // Parcela da cesta básica possui alíquota zero
    const parcelaCesta = Math.min(100, Math.max(0, percentualCestaBasica)) / 100
    fatorAliquotaIBSCBS *= 1 - parcelaCesta
  }

  if (reducaoSetorial60) {
    // Redução de 60% prevista no art. 9º da EC 132/2023 e LC 214/2025
    fatorAliquotaIBSCBS *= 1 - PARAMETROS_REFORMA.reducoes.setoresPrioritarios60 // 0.40
  }

  const reducaoPercentualFinal = Math.round((1 - fatorAliquotaIBSCBS) * 100)

  // Carga tributária atual estimada total
  const cargaAtualReais = (faturamentoAnual * aliquotaAtualEstimada) / 100

  // Créditos de insumos aproveitáveis
  // Insumos reais aproximados pelo percentual informado
  const baseInsumos = faturamentoAnual * (percentualCreditosInsumos / 100)

  const tabelaAnual: ResultadoAnoTransicao[] = PARAMETROS_REFORMA.calendarioTransicao.map(
    (item) => {
      return calcularAno(
        item,
        regimeAtual,
        faturamentoAnual,
        baseInsumos,
        fatorAliquotaIBSCBS,
        cargaAtualReais,
        aliquotaAtualEstimada,
        permanecerNoSimplesNaTransicao,
      )
    },
  )

  // Análise de resumo e ponto de virada
  let impactoTotalAcumuladoReais = 0
  let somaVariacoesPerc = 0
  let maiorAumento = { ano: 2033, valor: -Infinity }
  let maiorEconomia = { ano: 2026, valor: Infinity }
  let anoVirada: number | undefined = undefined

  tabelaAnual.forEach((linha, idx) => {
    impactoTotalAcumuladoReais += linha.diferencaReais
    somaVariacoesPerc += linha.diferencaPercentual

    if (linha.diferencaReais > maiorAumento.valor) {
      maiorAumento = { ano: linha.ano, valor: linha.diferencaReais }
    }
    if (linha.diferencaReais < maiorEconomia.valor) {
      maiorEconomia = { ano: linha.ano, valor: linha.diferencaReais }
    }

    if (idx > 0 && anoVirada === undefined) {
      const prev = tabelaAnual[idx - 1].diferencaReais
      if ((prev <= 0 && linha.diferencaReais > 0) || (prev >= 0 && linha.diferencaReais < 0)) {
        anoVirada = linha.ano
      }
    }
  })

  const mediaVariacaoPercentual =
    tabelaAnual.length > 0 ? somaVariacoesPerc / tabelaAnual.length : 0

  // Gera recomendações estratégicas determinísticas
  const recomendacoes = gerarRecomendacoes({
    input,
    tabelaAnual,
    impactoTotalAcumuladoReais,
    anoVirada,
  })

  const pontoCritico = identificarPontoCritico(tabelaAnual, regimeAtual)

  return {
    inputs: input,
    tabelaAnual,
    resumo: {
      anoVirada,
      impactoTotalAcumuladoReais,
      mediaVariacaoPercentual,
      maiorAumentoReais: maiorAumento.valor === -Infinity ? { ano: 2033, valor: 0 } : maiorAumento,
      maiorEconomiaReais:
        maiorEconomia.valor === Infinity ? { ano: 2026, valor: 0 } : maiorEconomia,
      pontoCritico,
      recomendacoes,
    },
    parametrosUtilizados: {
      aliquotaReferenciaPlena: PARAMETROS_REFORMA.aliquotaReferenciaPlena,
      reducaoAplicadaPercentual: reducaoPercentualFinal,
      versaoNormativa: PARAMETROS_REFORMA.versaoNormativa,
    },
  }
}

function calcularAno(
  paramAno: ParametrosAnoTransicao,
  regimeAtual: RegimeAtual,
  faturamentoAnual: number,
  baseInsumos: number,
  fatorAliquotaIBSCBS: number,
  cargaAtualReais: number,
  aliquotaAtualEstimada: number,
  permanecerNoSimplesNaTransicao: boolean,
): ResultadoAnoTransicao {
  const ano = paramAno.ano

  // Alíquotas nominais aplicadas
  let aliqCBSNominal = paramAno.aliquotaCBS
  let aliqIBSNominal = paramAno.aliquotaIBS

  // No Simples Nacional com faturamento até R$ 3.6M e opção de permanecer no regime transitório:
  const elegivelDescontoSimples =
    regimeAtual === 'simples_nacional' &&
    faturamentoAnual <= PARAMETROS_REFORMA.simplesNacional.sublimiteTransicional &&
    permanecerNoSimplesNaTransicao &&
    ano <= 2032

  let fatorSimplesTransicao = 1.0
  if (elegivelDescontoSimples) {
    fatorSimplesTransicao = PARAMETROS_REFORMA.simplesNacional.descontoTransicaoSimplesSublimite // 50%
  }

  // Alíquota combinada nominal antes de créditos
  const aliqCombinadaNominal =
    (aliqCBSNominal + aliqIBSNominal) * fatorAliquotaIBSCBS * fatorSimplesTransicao

  let valorDebitoBrutoReais = 0
  let valorCreditosInsumosReais = 0
  let valorResidualTributosAntigosReais = 0
  let cargaProjetadaIBSCBSReais = 0

  if (ano === 2026) {
    // Ano de teste: CBS 0,9% + IBS 0,1% = 1%. Totalmente compensável contra PIS/COFINS devidos.
    // O recolhimento não aumenta a carga líquida se o contribuinte compensar.
    const debitoTeste = (faturamentoAnual * aliqCombinadaNominal) / 100
    valorDebitoBrutoReais = debitoTeste
    valorCreditosInsumosReais = 0
    // Em 2026, mantém-se a carga atual integral, e o 1% é compensável (impacto financeiro neutro)
    valorResidualTributosAntigosReais = cargaAtualReais
    cargaProjetadaIBSCBSReais = cargaAtualReais
  } else if (ano >= 2027 && ano <= 2028) {
    // 2027-2028: CBS plena (~8.8%), IBS de calibração (0,1%).
    // PIS e COFINS extintos. ICMS e ISS mantidos integralmente (ou fração do Simples).
    valorDebitoBrutoReais = (faturamentoAnual * aliqCombinadaNominal) / 100

    if (regimeAtual === 'simples_nacional' && permanecerNoSimplesNaTransicao) {
      // No Simples unificado durante a transição, a empresa recolhe a guia única com rebalanceamento
      // Em 2027/2028, a variação é mínima pois a guia do Simples é recalculada pela LC 214/2025
      cargaProjetadaIBSCBSReais = cargaAtualReais * 1.02 // Leve ajuste de calibração (+2%)
      valorResidualTributosAntigosReais = cargaAtualReais * 0.98
      valorCreditosInsumosReais = Math.max(
        0,
        valorDebitoBrutoReais - (cargaProjetadaIBSCBSReais - valorResidualTributosAntigosReais),
      )
    } else {
      // Regime Lucro Presumido ou Lucro Real
      // Aproveitamento de créditos de IBS/CBS sobre insumos
      valorCreditosInsumosReais = (baseInsumos * aliqCombinadaNominal) / 100
      const ibsCbsLiquido = Math.max(0, valorDebitoBrutoReais - valorCreditosInsumosReais)

      // Tributos antigos residuais: ICMS/ISS + IRPJ/CSLL (PIS/COFINS foi substituído pelo CBS)
      // Estima-se que PIS/COFINS representava cerca de 30% a 45% dos tributos sobre faturamento
      const parcelaTributosMantidos = 0.65 // 65% da carga atual continua (ICMS/ISS/IR/CSLL)
      valorResidualTributosAntigosReais = cargaAtualReais * parcelaTributosMantidos
      cargaProjetadaIBSCBSReais = ibsCbsLiquido + valorResidualTributosAntigosReais
    }
  } else if (ano >= 2029 && ano <= 2032) {
    // 2029 a 2032: Graduação do IBS (10%, 20%, 30%, 40%) e redução proporcional do ICMS/ISS (90%, 80%, 70%, 60%)
    valorDebitoBrutoReais = (faturamentoAnual * aliqCombinadaNominal) / 100

    if (regimeAtual === 'simples_nacional' && permanecerNoSimplesNaTransicao) {
      // Transição suave com teto de benefício 50%
      const fatorGrad = (ano - 2028) * 0.05 // Aumento gradual de 5% ao ano na transição do Simples
      cargaProjetadaIBSCBSReais = cargaAtualReais * (1 + fatorGrad)
      valorResidualTributosAntigosReais = cargaAtualReais * paramAno.fatorTributosAntigos
      valorCreditosInsumosReais = Math.max(
        0,
        valorDebitoBrutoReais - (cargaProjetadaIBSCBSReais - valorResidualTributosAntigosReais),
      )
    } else {
      valorCreditosInsumosReais = (baseInsumos * aliqCombinadaNominal) / 100
      const ibsCbsLiquido = Math.max(0, valorDebitoBrutoReais - valorCreditosInsumosReais)

      // PIS/COFINS já zerados. ICMS/ISS reduzidos proporcionalmente pelo fatorTributosAntigos
      // Parcela de ICMS/ISS + IR/CSLL
      const parcelaAntigaResidual = 0.65 * paramAno.fatorTributosAntigos + 0.2 // 20% piso de IRPJ/CSLL
      valorResidualTributosAntigosReais = cargaAtualReais * Math.min(1.0, parcelaAntigaResidual)
      cargaProjetadaIBSCBSReais = ibsCbsLiquido + valorResidualTributosAntigosReais
    }
  } else {
    // 2033: Regime Pleno — ICMS, ISS, PIS, COFINS totalmente extintos
    // CBS ~8.8% + IBS ~17.7% = 26.5% de referência
    valorDebitoBrutoReais = (faturamentoAnual * aliqCombinadaNominal) / 100

    if (
      regimeAtual === 'simples_nacional' &&
      faturamentoAnual <= 3600000 &&
      permanecerNoSimplesNaTransicao
    ) {
      // No Simples em 2033, encerra-se o desconto de 50% da transição.
      // O contribuinte pode permanecer no regime específico do Simples com repasse de crédito reduzido,
      // ou migrar para o regime regular com crédito amplo para os clientes PJ.
      cargaProjetadaIBSCBSReais = cargaAtualReais * 1.25 // Aumento aproximado de 25% com a convergência plena
      valorCreditosInsumosReais = (baseInsumos * aliqCombinadaNominal) / 100
      valorResidualTributosAntigosReais = 0
    } else {
      valorCreditosInsumosReais = (baseInsumos * aliqCombinadaNominal) / 100
      const ibsCbsLiquido = Math.max(0, valorDebitoBrutoReais - valorCreditosInsumosReais)
      // IRPJ/CSLL continuam a incidir sobre a renda (mantendo fatia equivalente no Presumido/Real)
      const irpjCsllEstimado = cargaAtualReais * 0.35 // parcela do IRPJ/CSLL
      valorResidualTributosAntigosReais = irpjCsllEstimado
      cargaProjetadaIBSCBSReais = ibsCbsLiquido + irpjCsllEstimado
    }
  }

  const diferencaReais = Math.round((cargaProjetadaIBSCBSReais - cargaAtualReais) * 100) / 100
  const diferencaPercentual =
    cargaAtualReais > 0
      ? Math.round(((cargaProjetadaIBSCBSReais - cargaAtualReais) / cargaAtualReais) * 1000) / 10
      : 0

  const aliquotaEfetivaIBSCBS =
    faturamentoAnual > 0
      ? Math.round((cargaProjetadaIBSCBSReais / faturamentoAnual) * 1000) / 10
      : 0

  let impactoTipo: 'economia' | 'aumento' | 'neutro' = 'neutro'
  if (diferencaReais > 50) impactoTipo = 'aumento'
  else if (diferencaReais < -50) impactoTipo = 'economia'

  return {
    ano,
    descricao: paramAno.descricao,
    fase: paramAno.fase,
    cargaAtualEstimadaReais: Math.round(cargaAtualReais * 100) / 100,
    aliquotaAtualEfetiva: aliquotaAtualEstimada,
    aliquotaNominalCBS: aliqCBSNominal,
    aliquotaNominalIBS: aliqIBSNominal,
    aliquotaNominalCombinada: Math.round(aliqCombinadaNominal * 10) / 10,
    aliquotaEfetivaIBSCBS,
    valorDebitoBrutoReais: Math.round(valorDebitoBrutoReais * 100) / 100,
    valorCreditosInsumosReais: Math.round(valorCreditosInsumosReais * 100) / 100,
    valorResidualTributosAntigosReais: Math.round(valorResidualTributosAntigosReais * 100) / 100,
    cargaProjetadaIBSCBSReais: Math.round(cargaProjetadaIBSCBSReais * 100) / 100,
    diferencaReais,
    diferencaPercentual,
    impactoTipo,
  }
}

function identificarPontoCritico(tabela: ResultadoAnoTransicao[], regime: RegimeAtual): string {
  if (regime === 'simples_nacional') {
    return 'Ano de 2033 (fim do benefício de 50% de redução na transição do Simples até R$ 3,6M e encerramento de regras transitórias).'
  }
  const primeiroAumento = tabela.find((t) => t.diferencaReais > 1000)
  if (primeiroAumento) {
    return `Ano de ${primeiroAumento.ano} (${primeiroAumento.fase === 'cbs_plena' ? 'extinção do PIS/COFINS e CBS 8,8%' : 'graduação do IBS'}), com variação de +${primeiroAumento.diferencaPercentual}% sobre a carga atual.`
  }
  return 'Transição gradual com impacto equilibrado entre créditos e débitos apurados.'
}

interface GerarRecomendacoesParams {
  input: SimulacaoInput
  tabelaAnual: ResultadoAnoTransicao[]
  impactoTotalAcumuladoReais: number
  anoVirada?: number
}

function gerarRecomendacoes({
  input,
  tabelaAnual,
  impactoTotalAcumuladoReais,
}: GerarRecomendacoesParams): string[] {
  const recs: string[] = []
  const {
    regimeAtual,
    faturamentoAnual,
    percentualCreditosInsumos,
    setorAtividade,
    reducaoSetorial60,
    vendeCestaBasica,
  } = input

  // Regra 1: Setor de Serviços vs. Apropriação de Créditos
  if (
    (setorAtividade === 'servicos_geral' || setorAtividade === 'tecnologia_software') &&
    percentualCreditosInsumos < 25
  ) {
    recs.push(
      'Empresa do setor de serviços com baixo volume de créditos de insumos (<25%): folha de pagamento não gera créditos de IBS/CBS. Recomenda-se planejar readequação de preços e contratos com clientes a partir de 2027.',
    )
  }

  // Regra 2: Simples Nacional e Sublimite
  if (regimeAtual === 'simples_nacional') {
    if (faturamentoAnual <= PARAMETROS_REFORMA.simplesNacional.sublimiteTransicional) {
      recs.push(
        'Como o faturamento anual está abaixo de R$ 3,6M, a empresa tem direito à redução de 50% de IBS/CBS na transição até 2032 pela LC 214/2025. Vale a pena manter a opção pelo Simples até 2032 e reavaliar a migração em 2033.',
      )
      recs.push(
        'Atenção ao repasse de créditos para clientes PJ: no Simples, clientes tomadores aproveitam apenas o crédito recolhido no DAS. Caso seus principais clientes exijam crédito amplo, simule a opção pelo regime regular de IBS/CBS.',
      )
    } else {
      recs.push(
        'Faturamento acima do sublimite de R$ 3,6M/ano: o recolhimento de ICMS/ISS já ocorre fora da guia única em diversos estados. Na transição do IBS/CBS, a empresa será desenquadrada no IVA dual, exigindo apuração contábil regular.',
      )
    }
  }

  // Regra 3: Redução Setorial de 60%
  if (reducaoSetorial60) {
    recs.push(
      'Setor com redução de 60% da alíquota de referência (LC 214/2025 e EC 132/2023): a carga nominal de IBS/CBS cai para ~10,6% (vs. 26,5% do regime padrão). Manter a documentação comprobatória da atividade elegível em dia.',
    )
  }

  // Regra 4: Cesta Básica com Alíquota Zero
  if (vendeCestaBasica) {
    recs.push(
      'Operações com itens da Cesta Básica Nacional de Alimentos contam com alíquota zero (100% de redução), garantindo manutenção dos créditos vinculados conforme o art. 8º da LC 214/2025.',
    )
  }

  // Regra 5: Comércio / Indústria com alto crédito
  if (
    (setorAtividade === 'comercio_geral' || setorAtividade === 'industria_transformacao') &&
    percentualCreditosInsumos >= 50
  ) {
    recs.push(
      'Alto aproveitamento de créditos na cadeia de suprimentos: a não-cumulatividade plena da reforma extingue a cumulatividade oculta de ICMS e ISS. A transição tende a ser neutra ou benéfica para a competitividade industrial e comercial.',
    )
  }

  // Regra 6: Lucro Presumido vs. Real a partir de 2027
  if (regimeAtual === 'lucro_presumido' && impactoTotalAcumuladoReais > 0) {
    recs.push(
      'Para empresas no Lucro Presumido, a unificação em CBS (8,8%) sem cumulatividade a partir de 2027 aumenta a carga em relação aos 3,65% antigos de PIS/COFINS. Avalie a migração para Lucro Real ou renegociação de margens.',
    )
  }

  // Regra 7: Ano 2026 de teste
  recs.push(
    'Em 2026 (período de testes com CBS 0,9% e IBS 0,1%), adeque o sistema de emissão de NF-e/NFS-e para a validação das tags de IBS/CBS. Os valores recolhidos são compensáveis contra PIS/COFINS devidos.',
  )

  return recs
}

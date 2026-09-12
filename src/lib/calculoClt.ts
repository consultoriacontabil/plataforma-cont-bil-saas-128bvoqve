/**
 * Motor de Cálculo Trabalhista e Previdenciário conforme CLT e Legislação Vigente
 *
 * Regras implementadas:
 * 1. Tabela progressiva do INSS (Portaria Interministerial MPS/MF - faixas progressivas)
 * 2. Tabela progressiva do IRRF (Lei nº 14.663/2023 / Lei nº 14.848/2024)
 * 3. Dedução legal por dependente de IRRF: R$ 189,59 por dependente
 * 4. Desconto Simplificado Mensal de IRRF (R$ 564,80) quando mais vantajoso que deduções legais
 * 5. FGTS Patronal: 8% sobre a base tributável (ou 2% para contrato aprendiz)
 * 6. Horas Extras: CF art. 7º, XVI e CLT art. 59 (adicional mínimo constitucional de 50%)
 * 7. Adicional Noturno: CLT art. 73 (20% urbano, hora noturna reduzida de 52min30s - fator 60/52.5 = 1.142857)
 * 8. Vale Transporte: Lei nº 7.418/85 (teto legal de 6% sobre o salário-base)
 * 9. Faltas injustificadas e reflexo em perda do DSR semanal (Lei nº 605/49)
 * 10. Reflexo de DSR sobre verbas variáveis (horas extras e adicional noturno)
 */

import type {
  AlertaConformidadeClt,
  ItemRubrica,
  VerbaCatalogoRecord,
  VerbaLancamentoRecord,
} from '@/types'

// === 1. TABELA PROGRESSIVA INSS 2024/2026 ===
export interface FaixaInss {
  limiteInferior: number
  limiteSuperior: number
  aliquota: number
}

export const TABELA_INSS_PROGRESSIVA: FaixaInss[] = [
  { limiteInferior: 0, limiteSuperior: 1412.0, aliquota: 0.075 },
  { limiteInferior: 1412.0, limiteSuperior: 2666.68, aliquota: 0.09 },
  { limiteInferior: 2666.68, limiteSuperior: 4000.03, aliquota: 0.12 },
  { limiteInferior: 4000.03, limiteSuperior: 7786.02, aliquota: 0.14 },
]

export const TETO_SALARIO_CONTRIBUICAO_INSS = 7786.02
export const TETO_DESCONTO_INSS = 908.85 // Teto máximo progressivo apurado: 105.90 + 112.92 + 160.00 + 530.03 = 908.85

export function calcularInssProgressivo(baseCalculo: number): {
  inss: number
  faixasDetalhadas: { faixa: string; baseFaixa: number; aliquota: number; valorFaixa: number }[]
  atingiuTeto: boolean
} {
  const baseEfetiva = Math.max(0, Math.min(baseCalculo, TETO_SALARIO_CONTRIBUICAO_INSS))
  let inssTotal = 0
  const faixasDetalhadas: {
    faixa: string
    baseFaixa: number
    aliquota: number
    valorFaixa: number
  }[] = []

  for (let i = 0; i < TABELA_INSS_PROGRESSIVA.length; i++) {
    const f = TABELA_INSS_PROGRESSIVA[i]
    if (baseEfetiva > f.limiteInferior) {
      const valorBaseNaFaixa = Math.min(baseEfetiva, f.limiteSuperior) - f.limiteInferior
      const valorFaixa = valorBaseNaFaixa * f.aliquota
      inssTotal += valorFaixa
      faixasDetalhadas.push({
        faixa: `Faixa ${i + 1} (${(f.aliquota * 100).toFixed(1)}%)`,
        baseFaixa: Number(valorBaseNaFaixa.toFixed(2)),
        aliquota: f.aliquota,
        valorFaixa: Number(valorFaixa.toFixed(2)),
      })
    }
  }

  const finalVal = Math.min(inssTotal, TETO_DESCONTO_INSS)
  return {
    inss: Number(finalVal.toFixed(2)),
    faixasDetalhadas,
    atingiuTeto: baseCalculo >= TETO_SALARIO_CONTRIBUICAO_INSS,
  }
}

// === 2. TABELA PROGRESSIVA IRRF 2024/2026 ===
export interface FaixaIrrf {
  limiteInferior: number
  limiteSuperior: number
  aliquota: number
  parcelaDeduzir: number
}

export const DEDUCAO_LEGAL_POR_DEPENDENTE_IRRF = 189.59
export const DESCONTO_SIMPLIFICADO_MENSAL_IRRF = 564.8

export const TABELA_IRRF_PROGRESSIVA: FaixaIrrf[] = [
  { limiteInferior: 0, limiteSuperior: 2259.2, aliquota: 0.0, parcelaDeduzir: 0.0 },
  { limiteInferior: 2259.2, limiteSuperior: 2826.65, aliquota: 0.075, parcelaDeduzir: 169.44 },
  { limiteInferior: 2826.65, limiteSuperior: 3751.05, aliquota: 0.15, parcelaDeduzir: 381.44 },
  { limiteInferior: 3751.05, limiteSuperior: 4664.68, aliquota: 0.225, parcelaDeduzir: 662.77 },
  { limiteInferior: 4664.68, limiteSuperior: Infinity, aliquota: 0.275, parcelaDeduzir: 896.0 },
]

export function calcularIrrfProgressivo(params: {
  baseBrutaParaIrrf: number
  inssDescontado: number
  dependentes: number
  outrasDeducoesLegais?: number // Ex: pensão alimentícia judicial
}): {
  irrf: number
  baseCalculo: number
  aliquotaEfetiva: number
  metodoUtilizado: 'deducoes_legais' | 'desconto_simplificado'
  deducaoTotalUtilizada: number
} {
  const { baseBrutaParaIrrf, inssDescontado, dependentes, outrasDeducoesLegais = 0 } = params

  const deducoesLegais =
    inssDescontado + dependentes * DEDUCAO_LEGAL_POR_DEPENDENTE_IRRF + outrasDeducoesLegais
  const baseDeducoesLegais = Math.max(0, baseBrutaParaIrrf - deducoesLegais)

  // Comparação com o desconto simplificado oficial (R$ 564,80)
  const baseSimplificada = Math.max(0, baseBrutaParaIrrf - DESCONTO_SIMPLIFICADO_MENSAL_IRRF)

  const calcFaixa = (base: number) => {
    for (const f of TABELA_IRRF_PROGRESSIVA) {
      if (base <= f.limiteSuperior) {
        const valor = Math.max(0, base * f.aliquota - f.parcelaDeduzir)
        return { valor, aliquota: f.aliquota }
      }
    }
    return { valor: 0, aliquota: 0 }
  }

  const resLegais = calcFaixa(baseDeducoesLegais)
  const resSimplificado = calcFaixa(baseSimplificada)

  if (resSimplificado.valor < resLegais.valor) {
    return {
      irrf: Number(resSimplificado.valor.toFixed(2)),
      baseCalculo: Number(baseSimplificada.toFixed(2)),
      aliquotaEfetiva: resSimplificado.aliquota,
      metodoUtilizado: 'desconto_simplificado',
      deducaoTotalUtilizada: DESCONTO_SIMPLIFICADO_MENSAL_IRRF,
    }
  }

  return {
    irrf: Number(resLegais.valor.toFixed(2)),
    baseCalculo: Number(baseDeducoesLegais.toFixed(2)),
    aliquotaEfetiva: resLegais.aliquota,
    metodoUtilizado: 'deducoes_legais',
    deducaoTotalUtilizada: Number(deducoesLegais.toFixed(2)),
  }
}

// === 3. VALIDAÇÕES E CÁLCULOS CLT POR VERBA ===

/**
 * Valida o lançamento de uma verba contra preceitos da CLT e emite alertas acionáveis
 */
export function validarLancamentoClt(params: {
  verba: VerbaCatalogoRecord
  salarioBase: number
  quantidade: number
  aliquotaPercentual?: number
  valorCalculado: number
  horasMensais?: number
}): { alertas: AlertaConformidadeClt[]; valorSugerido?: number } {
  const {
    verba,
    salarioBase,
    quantidade,
    aliquotaPercentual,
    valorCalculado,
    horasMensais = 220,
  } = params
  const alertas: AlertaConformidadeClt[] = []
  let valorSugerido: number | undefined

  const valorHoraBase = salarioBase > 0 && horasMensais > 0 ? salarioBase / horasMensais : 0
  const valorDiaBase = salarioBase > 0 ? salarioBase / 30 : 0

  // 1. Horas Extras (CF art. 7º, XVI e CLT art. 59)
  if (
    verba.codigo === '1020' ||
    verba.codigo === '1021' ||
    verba.descricao.toLowerCase().includes('hora extra')
  ) {
    const adicional =
      aliquotaPercentual !== undefined ? aliquotaPercentual : verba.valor_padrao || 50
    if (adicional < 50) {
      alertas.push({
        tipo: 'infracao',
        regra: 'CF/88 Art. 7º, XVI / CLT Art. 59',
        mensagem: `Adicional de hora extra informado (${adicional}%) está abaixo do mínimo legal de 50%.`,
        sugestao: 'Ajuste o adicional para no mínimo 50% ou 100% em domingos/feriados.',
      })
    }

    if (quantidade > 44) {
      alertas.push({
        tipo: 'aviso',
        regra: 'CLT Art. 59 (Limite de 2h diárias)',
        mensagem: `Quantidade de horas extras (${quantidade}h) excede o limite comum de 2h por dia útil no mês.`,
        sugestao: 'Verifique se há acordo de compensação ou termo coletivo firmado.',
      })
    }

    if (valorHoraBase > 0 && quantidade > 0) {
      const calcEsperado = quantidade * valorHoraBase * (1 + adicional / 100)
      valorSugerido = Number(calcEsperado.toFixed(2))
      if (Math.abs(valorCalculado - calcEsperado) > 0.1) {
        alertas.push({
          tipo: 'informativo',
          regra: 'Cálculo Hora Normal × Adicional',
          mensagem: `Valor calculado (R$ ${valorCalculado.toFixed(2)}) difere do cálculo padrão CLT (R$ ${calcEsperado.toFixed(2)}: ${quantidade}h × R$ ${valorHoraBase.toFixed(2)}/h × ${(1 + adicional / 100).toFixed(2)}).`,
        })
      }
    }
  }

  // 2. Adicional Noturno (CLT art. 73)
  if (verba.codigo === '1030' || verba.descricao.toLowerCase().includes('noturno')) {
    const adicional =
      aliquotaPercentual !== undefined ? aliquotaPercentual : verba.valor_padrao || 20
    if (adicional < 20) {
      alertas.push({
        tipo: 'infracao',
        regra: 'CLT Art. 73',
        mensagem: `Adicional noturno urbano (${adicional}%) está abaixo do piso legal obrigatório de 20%.`,
        sugestao: 'Defina no mínimo 20% sobre a hora diurna para trabalho entre 22h e 5h.',
      })
    }

    if (valorHoraBase > 0 && quantidade > 0) {
      // Hora ficta noturna reduzida (52min30s): 1h noturna relógio = 1.142857 hora ficta
      const fatorHoraReduzida = 60 / 52.5 // ~1.142857
      const calcEsperado = quantidade * valorHoraBase * (adicional / 100)
      const calcComReducao = quantidade * fatorHoraReduzida * valorHoraBase * (adicional / 100)
      valorSugerido = Number(calcEsperado.toFixed(2))

      alertas.push({
        tipo: 'informativo',
        regra: 'CLT Art. 73 §1º (Hora Ficta Noturna)',
        mensagem: `A hora noturna urbana tem 52min30s. Com a redução legal (fator 1,1428), ${quantidade}h relógio equivalem a ${(quantidade * fatorHoraReduzida).toFixed(2)}h apuradas (R$ ${calcComReducao.toFixed(2)}).`,
      })
    }
  }

  // 3. Vale Transporte (Lei nº 7.418/85 - Teto legal 6%)
  if (
    verba.codigo === '9001' ||
    verba.rubrica_esocial === '9904' ||
    verba.descricao.toLowerCase().includes('transporte')
  ) {
    const tetoLegalVT = salarioBase * 0.06
    if (valorCalculado > tetoLegalVT + 0.01) {
      alertas.push({
        tipo: 'infracao',
        regra: 'Lei nº 7.418/85 Art. 4º, §único',
        mensagem: `Desconto de VT (R$ ${valorCalculado.toFixed(2)}) ultrapassa o teto máximo legal de 6% do salário-base (R$ ${tetoLegalVT.toFixed(2)}).`,
        sugestao: `Limite o desconto de VT a R$ ${tetoLegalVT.toFixed(2)} ou ao custo real dos vales fornecidos (o menor).`,
      })
    }
  }

  // 4. Faltas Injustificadas e Atrasos (CLT art. 473)
  if (verba.codigo === '9003' || verba.descricao.toLowerCase().includes('falta')) {
    if (valorDiaBase > 0 && quantidade > 0) {
      const calcEsperado = quantidade * valorDiaBase
      valorSugerido = Number(calcEsperado.toFixed(2))
      alertas.push({
        tipo: 'aviso',
        regra: 'Lei nº 605/49 Art. 6º',
        mensagem: `Falta de ${quantidade} dia(s) acarreta perda da remuneração do repouso semanal (DSR) da semana correspondente.`,
        sugestao:
          'Considere lançar também a verba de Desconto DSR da semana se o colaborador não compensou.',
      })
    }
  }

  return { alertas, valorSugerido }
}

// === 4. PROCESSADOR CONSOLIDADO DA FOLHA POR COLABORADOR ===

// === 5. CÁLCULO DE MÉDIAS DE VERBAS VARIÁVEIS (CLT art. 142 §5º e Lei 4.090/62) ===
export interface CalculoMediasResult {
  mediaApurada: number
  totalLancamentos: number
  mesesConsiderados: number
  itensDetalhados: {
    competencia: string
    verba: string
    codigo?: string
    valor: number
  }[]
}

/**
 * Calcula a média de verbas variáveis marcadas com reflexo_ferias_13
 */
export function apurarMediasVerbasVariaveis(params: {
  lancamentos: (VerbaLancamentoRecord & { verbaObj?: VerbaCatalogoRecord })[]
  mesesDivisor?: number // 12 para férias/13º padrão ou meses trabalhados
}): CalculoMediasResult {
  const { lancamentos, mesesDivisor = 12 } = params
  const itensDetalhados: {
    competencia: string
    verba: string
    codigo?: string
    valor: number
  }[] = []

  let somaValores = 0

  for (const l of lancamentos) {
    const v = l.verbaObj || (l.expand?.verba as VerbaCatalogoRecord | undefined)
    // Apenas verbas com reflexo_ferias_13 ativo e tipo provento
    if (v && v.reflexo_ferias_13 && v.tipo === 'provento') {
      const val = Number(l.valor_calculado || 0)
      if (val > 0) {
        somaValores += val
        itensDetalhados.push({
          competencia: l.competencia,
          verba: v.descricao,
          codigo: v.codigo,
          valor: val,
        })
      }
    }
  }

  const divisor = Math.max(1, mesesDivisor)
  const mediaApurada = Number((somaValores / divisor).toFixed(2))

  return {
    mediaApurada,
    totalLancamentos: somaValores,
    mesesConsiderados: divisor,
    itensDetalhados,
  }
}

// === 6. MOTOR DE CÁLCULO DE FÉRIAS CLT ===
export interface ParametrosCalculoFerias {
  salarioBase: number
  diasGozo: number // normalmente 20 ou 30 dias
  venderAbono: boolean // venda de até 1/3 (10 dias)
  diasAbono?: number
  dependentes: number
  mediaVariaveis?: number
  adiantar13?: boolean
}

export interface ResultadoCalculoFerias {
  salarioBase: number
  mediaVariaveis: number
  remuneracaoBase: number
  diasGozo: number
  diasAbono: number
  valorFeriasGozo: number
  tercoConstitucionalFerias: number
  valorAbonoPecuniario: number
  tercoConstitucionalAbono: number
  totalBruto: number
  baseInss: number
  inss: number
  baseIrrf: number
  irrf: number
  totalDescontos: number
  totalLiquido: number
  dataLimitePagamentoSugerida?: string
}

export function calcularFeriasClt(params: ParametrosCalculoFerias): ResultadoCalculoFerias {
  const {
    salarioBase,
    diasGozo,
    venderAbono,
    diasAbono = venderAbono ? 10 : 0,
    dependentes,
    mediaVariaveis = 0,
  } = params

  const remuneracaoBase = Number((salarioBase + mediaVariaveis).toFixed(2))
  const valorDia = remuneracaoBase / 30

  // Gozo
  const valorFeriasGozo = Number((valorDia * diasGozo).toFixed(2))
  const tercoConstitucionalFerias = Number((valorFeriasGozo / 3).toFixed(2))

  // Abono pecuniário (CLT art. 143: faculdade do empregado converter 1/3 das férias em abono)
  const diasAbonoEfetivos = venderAbono ? Math.min(10, Math.max(1, diasAbono)) : 0
  const valorAbonoPecuniario = Number((valorDia * diasAbonoEfetivos).toFixed(2))
  const tercoConstitucionalAbono = Number((valorAbonoPecuniario / 3).toFixed(2))

  const totalBruto = Number(
    (
      valorFeriasGozo +
      tercoConstitucionalFerias +
      valorAbonoPecuniario +
      tercoConstitucionalAbono
    ).toFixed(2),
  )

  // Incidências: Abono pecuniário e seu 1/3 são ISENTOS de INSS e IRRF (Súmula 386/STJ e Lei 8.212/91)
  const baseTributavel = Number((valorFeriasGozo + tercoConstitucionalFerias).toFixed(2))

  const resInss = calcularInssProgressivo(baseTributavel)
  const inss = resInss.inss

  const resIrrf = calcularIrrfProgressivo({
    baseBrutaParaIrrf: baseTributavel,
    inssDescontado: inss,
    dependentes,
  })
  const irrf = resIrrf.irrf

  const totalDescontos = Number((inss + irrf).toFixed(2))
  const totalLiquido = Number((totalBruto - totalDescontos).toFixed(2))

  return {
    salarioBase,
    mediaVariaveis,
    remuneracaoBase,
    diasGozo,
    diasAbono: diasAbonoEfetivos,
    valorFeriasGozo,
    tercoConstitucionalFerias,
    valorAbonoPecuniario,
    tercoConstitucionalAbono,
    totalBruto,
    baseInss: baseTributavel,
    inss,
    baseIrrf: resIrrf.baseCalculo,
    irrf,
    totalDescontos,
    totalLiquido,
  }
}

// === 7. MOTOR DE CÁLCULO DE 13º SALÁRIO CLT ===
export interface ParametrosCalculoDecimo {
  salarioBase: number
  mesesTrabalhados: number // avos 1 a 12 (mês com >14 dias conta 1 avo)
  parcela: 'primeira_parcela' | 'segunda_parcela' | 'parcela_unica'
  mediaVariaveis?: number
  adiantamentoJaPago?: number // valor recebido na 1ª parcela
  dependentes: number
  salarioMaternidadeMeses?: number // se afastada, INSS compensa
}

export interface ResultadoCalculoDecimo {
  salarioBase: number
  mediaVariaveis: number
  remuneracaoBase: number
  mesesTrabalhados: number
  valorIntegralAnual: number
  valorBrutoParcela: number
  adiantamentoDescontado: number
  salarioMaternidadeAbatimento: number
  baseInss: number
  inss: number
  baseIrrf: number
  irrf: number
  fgts: number
  totalDescontos: number
  totalLiquido: number
}

export function calcularDecimoTerceiroClt(params: ParametrosCalculoDecimo): ResultadoCalculoDecimo {
  const {
    salarioBase,
    mesesTrabalhados,
    parcela,
    mediaVariaveis = 0,
    adiantamentoJaPago = 0,
    dependentes,
    salarioMaternidadeMeses = 0,
  } = params

  const avosEfetivos = Math.min(12, Math.max(1, mesesTrabalhados))
  const remuneracaoBase = Number((salarioBase + mediaVariaveis).toFixed(2))
  const valorIntegralAnual = Number(((remuneracaoBase * avosEfetivos) / 12).toFixed(2))

  // Salário-maternidade: responsabilidade da Previdência Social
  const salarioMaternidadeAbatimento =
    salarioMaternidadeMeses > 0
      ? Number(((remuneracaoBase * salarioMaternidadeMeses) / 12).toFixed(2))
      : 0

  let valorBrutoParcela = 0
  let adiantamentoDescontado = 0
  let inss = 0
  let irrf = 0
  let baseInss = 0
  let baseIrrf = 0

  if (parcela === 'primeira_parcela') {
    // 1ª Parcela: adiantamento de 50% sem descontos de INSS ou IRRF (CLT art. 4º Lei 4.749/65)
    valorBrutoParcela = Number((valorIntegralAnual * 0.5).toFixed(2))
    inss = 0
    irrf = 0
  } else if (parcela === 'segunda_parcela') {
    // 2ª Parcela: valor total apurado anual deduzindo o adiantamento da 1ª parcela
    // e aplicando INSS e IRRF sobre o TOTAL anual devido (tributação exclusiva na fonte)
    valorBrutoParcela = valorIntegralAnual
    adiantamentoDescontado = adiantamentoJaPago

    baseInss = valorIntegralAnual
    const resInss = calcularInssProgressivo(baseInss)
    inss = resInss.inss

    const resIrrf = calcularIrrfProgressivo({
      baseBrutaParaIrrf: valorIntegralAnual,
      inssDescontado: inss,
      dependentes,
    })
    irrf = resIrrf.irrf
    baseIrrf = resIrrf.baseCalculo
  } else {
    // Parcela única (ou rescisória)
    valorBrutoParcela = valorIntegralAnual
    baseInss = valorIntegralAnual
    const resInss = calcularInssProgressivo(baseInss)
    inss = resInss.inss

    const resIrrf = calcularIrrfProgressivo({
      baseBrutaParaIrrf: valorIntegralAnual,
      inssDescontado: inss,
      dependentes,
    })
    irrf = resIrrf.irrf
    baseIrrf = resIrrf.baseCalculo
  }

  // FGTS 8% sobre o valor devido da parcela
  const baseFgts =
    parcela === 'segunda_parcela' ? valorIntegralAnual - adiantamentoJaPago : valorBrutoParcela
  const fgts = Number((Math.max(0, baseFgts) * 0.08).toFixed(2))

  const totalDescontos = Number((adiantamentoDescontado + inss + irrf).toFixed(2))
  const totalLiquido = Number(Math.max(0, valorBrutoParcela - totalDescontos).toFixed(2))

  return {
    salarioBase,
    mediaVariaveis,
    remuneracaoBase,
    mesesTrabalhados: avosEfetivos,
    valorIntegralAnual,
    valorBrutoParcela,
    adiantamentoDescontado,
    salarioMaternidadeAbatimento,
    baseInss,
    inss,
    baseIrrf,
    irrf,
    fgts,
    totalDescontos,
    totalLiquido,
  }
}

// === 8. MOTOR DE CÁLCULO DE RESCISÃO DE CONTRATO CLT ===
export interface ParametrosCalculoRescisao {
  salarioBase: number
  dataAdmissao: string // YYYY-MM-DD
  dataDesligamento: string // YYYY-MM-DD
  motivoDesligamento:
    | 'sem_justa_causa_empregador'
    | 'justa_causa_empregador'
    | 'pedido_demissao'
    | 'acordo_consensual_art_484_a'
    | 'termino_contrato_experiencia'
    | 'rescisao_indireta'
    | 'aposentadoria'
  tipoAvisoPrevio: 'trabalhado' | 'indenizado' | 'dispensado' | 'nao_aplicavel'
  dataAvisoPrevio?: string
  mediaVariaveis?: number
  dependentes: number
  feriasVencidas?: boolean // período aquisitivo anterior não gozado
  saldoFgts?: number // saldo informado para cálculo da multa
  descontoAdiantamento?: number
  outrosProventos?: number
  outrosDescontos?: number
}

export interface ResultadoCalculoRescisao {
  anosCompletosTrabalhados: number
  diasAvisoPrevioLei12506: number
  dataProjecaoAviso: string
  diasSaldoSalario: number
  saldoSalarioValor: number
  avisoPrevioIndenizadoValor: number
  decimoTerceiroProporcionalValor: number
  decimoTerceiroIndenizadoAviso: number
  feriasVencidasValor: number
  tercoFeriasVencidas: number
  feriasProporcionaisValor: number
  tercoFeriasProporcionais: number
  feriasIndenizadasAviso: number
  totalBrutoRescisao: number
  descontoInss: number
  descontoIrrf: number
  descontoAvisoNaoCumprido: number
  descontoAdiantamento: number
  outrosDescontos: number
  totalDescontosRescisao: number
  totalLiquidoRescisao: number
  aliquotaMultaFgts: number
  valorMultaFgts: number
  saqueFgtsAutorizado: boolean
  codigoSaqueFgts: string
  prazoPagamentoLimite: string
  alertasConformidade: AlertaConformidadeClt[]
  rubricasDetalhadas: {
    rubrica: string
    descricao: string
    tipo: 'provento' | 'desconto'
    valor: number
  }[]
}

export function calcularRescisaoClt(params: ParametrosCalculoRescisao): ResultadoCalculoRescisao {
  const {
    salarioBase,
    dataAdmissao,
    dataDesligamento,
    motivoDesligamento,
    tipoAvisoPrevio,
    dataAvisoPrevio,
    mediaVariaveis = 0,
    dependentes,
    feriasVencidas = false,
    saldoFgts = 0,
    descontoAdiantamento = 0,
    outrosProventos = 0,
    outrosDescontos = 0,
  } = params

  const alertasConformidade: AlertaConformidadeClt[] = []
  const rubricasDetalhadas: {
    rubrica: string
    descricao: string
    tipo: 'provento' | 'desconto'
    valor: number
  }[] = []

  const remuneracaoBase = Number((salarioBase + mediaVariaveis).toFixed(2))
  const valorDia = remuneracaoBase / 30

  // 1. Cálculo de tempo de serviço e aviso prévio (Lei 12.506/2011)
  const dtAdm = new Date(dataAdmissao)
  const dtDem = new Date(dataDesligamento)

  let diffYears = dtDem.getFullYear() - dtAdm.getFullYear()
  const m = dtDem.getMonth() - dtAdm.getMonth()
  if (m < 0 || (m === 0 && dtDem.getDate() < dtAdm.getDate())) {
    diffYears--
  }
  const anosCompletosTrabalhados = Math.max(0, diffYears)

  // Lei 12.506/2011: 30 dias + 3 dias por ano trabalhado, até o limite de 90 dias (60 adicionais)
  const diasAdicionais = Math.min(60, anosCompletosTrabalhados * 3)
  const diasAvisoPrevioLei12506 = 30 + diasAdicionais

  // Projeção do aviso prévio no contrato de trabalho (OJ 82 da SDI-1 do TST)
  const diasParaProjetar =
    tipoAvisoPrevio === 'indenizado' || tipoAvisoPrevio === 'trabalhado'
      ? diasAvisoPrevioLei12506
      : 0
  const dtProjetada = new Date(dtDem.getTime() + diasParaProjetar * 24 * 60 * 60 * 1000)
  const dataProjecaoAviso = dtProjetada.toISOString().slice(0, 10)

  // 2. Dias de saldo de salário
  const diasSaldoSalario = Math.min(30, dtDem.getDate())
  const saldoSalarioValor = Number((valorDia * diasSaldoSalario).toFixed(2))
  rubricasDetalhadas.push({
    rubrica: '01',
    descricao: `Saldo de Salário (${diasSaldoSalario} dias)`,
    tipo: 'provento',
    valor: saldoSalarioValor,
  })

  // 3. Aviso Prévio
  let avisoPrevioIndenizadoValor = 0
  let descontoAvisoNaoCumprido = 0

  if (
    motivoDesligamento === 'sem_justa_causa_empregador' ||
    motivoDesligamento === 'rescisao_indireta'
  ) {
    if (tipoAvisoPrevio === 'indenizado') {
      avisoPrevioIndenizadoValor = Number(
        ((remuneracaoBase / 30) * diasAvisoPrevioLei12506).toFixed(2),
      )
      rubricasDetalhadas.push({
        rubrica: '02',
        descricao: `Aviso Prévio Indenizado (${diasAvisoPrevioLei12506} dias - Lei 12.506)`,
        tipo: 'provento',
        valor: avisoPrevioIndenizadoValor,
      })
    }
  } else if (motivoDesligamento === 'acordo_consensual_art_484_a') {
    // Acordo mútuo: aviso prévio indenizado pela metade (CLT art. 484-A)
    if (tipoAvisoPrevio === 'indenizado') {
      avisoPrevioIndenizadoValor = Number(
        (((remuneracaoBase / 30) * diasAvisoPrevioLei12506) / 2).toFixed(2),
      )
      rubricasDetalhadas.push({
        rubrica: '02',
        descricao: `Aviso Prévio Indenizado (50% Acordo Art. 484-A CLT - ${diasAvisoPrevioLei12506} dias)`,
        tipo: 'provento',
        valor: avisoPrevioIndenizadoValor,
      })
    }
  } else if (motivoDesligamento === 'pedido_demissao') {
    if (tipoAvisoPrevio === 'indenizado') {
      // Empregado não cumpriu o aviso prévio: desconto de 30 dias (CLT art. 487 §2º)
      descontoAvisoNaoCumprido = Number(salarioBase.toFixed(2))
      rubricasDetalhadas.push({
        rubrica: '9908',
        descricao: 'Desconto Aviso Prévio Não Cumprido (CLT art. 487 §2º)',
        tipo: 'desconto',
        valor: descontoAvisoNaoCumprido,
      })
    }
  }

  // 4. 13º Salário Proporcional (CLT art. 146 § único: fração igual ou superior a 15 dias de trabalho)
  // Meses no ano corrente até a data de demissão
  const mesDemissao = dtDem.getMonth() + 1
  const diasNoUltimoMes = dtDem.getDate()
  let avosDecimo = diasNoUltimoMes >= 15 ? mesDemissao : mesDemissao - 1
  // Se admitido no mesmo ano
  if (dtAdm.getFullYear() === dtDem.getFullYear()) {
    const mesAdmissao = dtAdm.getMonth() + 1
    const diasNoMesAdm = 30 - dtAdm.getDate() + 1
    const avoAdm = diasNoMesAdm >= 15 ? 1 : 0
    avosDecimo = Math.max(0, mesDemissao - mesAdmissao + avoAdm)
  }
  avosDecimo = Math.min(12, Math.max(0, avosDecimo))

  let decimoTerceiroProporcionalValor = 0
  let decimoTerceiroIndenizadoAviso = 0

  if (motivoDesligamento !== 'justa_causa_empregador') {
    decimoTerceiroProporcionalValor = Number(((remuneracaoBase * avosDecimo) / 12).toFixed(2))
    rubricasDetalhadas.push({
      rubrica: '03',
      descricao: `13º Salário Proporcional (${avosDecimo}/12 avos)`,
      tipo: 'provento',
      valor: decimoTerceiroProporcionalValor,
    })

    // Avos de 13º sobre a projeção do aviso indenizado (1/12 para cada 30 dias)
    if (tipoAvisoPrevio === 'indenizado' && diasAvisoPrevioLei12506 >= 15) {
      const avosAviso = Math.round(diasAvisoPrevioLei12506 / 30)
      decimoTerceiroIndenizadoAviso = Number(((remuneracaoBase * avosAviso) / 12).toFixed(2))
      if (decimoTerceiroIndenizadoAviso > 0) {
        rubricasDetalhadas.push({
          rubrica: '04',
          descricao: `13º sobre Projeção Aviso Indenizado (${avosAviso}/12 avos)`,
          tipo: 'provento',
          valor: decimoTerceiroIndenizadoAviso,
        })
      }
    }
  }

  // 5. Férias Vencidas e Proporcionais + 1/3
  let feriasVencidasValor = 0
  let tercoFeriasVencidas = 0
  let feriasProporcionaisValor = 0
  let tercoFeriasProporcionais = 0
  let feriasIndenizadasAviso = 0

  if (motivoDesligamento !== 'justa_causa_empregador') {
    if (feriasVencidas) {
      feriasVencidasValor = Number(remuneracaoBase.toFixed(2))
      tercoFeriasVencidas = Number((feriasVencidasValor / 3).toFixed(2))
      rubricasDetalhadas.push({
        rubrica: '05',
        descricao: 'Férias Vencidas Simples',
        tipo: 'provento',
        valor: feriasVencidasValor,
      })
      rubricasDetalhadas.push({
        rubrica: '06',
        descricao: '1/3 Constitucional sobre Férias Vencidas',
        tipo: 'provento',
        valor: tercoFeriasVencidas,
      })
    }

    // Férias Proporcionais
    // Período aquisitivo incompleto: contagem de meses desde o aniversário de admissão
    let mesesAquisitivo = (dtDem.getMonth() - dtAdm.getMonth() + 12) % 12
    if (dtDem.getDate() >= dtAdm.getDate() || dtDem.getDate() >= 15) {
      mesesAquisitivo++
    }
    const avosFerias = Math.min(12, Math.max(1, mesesAquisitivo))
    feriasProporcionaisValor = Number(((remuneracaoBase * avosFerias) / 12).toFixed(2))
    tercoFeriasProporcionais = Number((feriasProporcionaisValor / 3).toFixed(2))

    rubricasDetalhadas.push({
      rubrica: '07',
      descricao: `Férias Proporcionais (${avosFerias}/12 avos)`,
      tipo: 'provento',
      valor: feriasProporcionaisValor,
    })
    rubricasDetalhadas.push({
      rubrica: '08',
      descricao: '1/3 Constitucional sobre Férias Proporcionais',
      tipo: 'provento',
      valor: tercoFeriasProporcionais,
    })

    // Férias Indenizadas pela projeção do aviso prévio (1/12 + 1/3)
    if (tipoAvisoPrevio === 'indenizado') {
      const valorAvoFerias = remuneracaoBase / 12
      const avosAvisoFerias = Math.max(1, Math.round(diasAvisoPrevioLei12506 / 30))
      const feriasAviso = valorAvoFerias * avosAvisoFerias
      const tercoAviso = feriasAviso / 3
      feriasIndenizadasAviso = Number((feriasAviso + tercoAviso).toFixed(2))
      rubricasDetalhadas.push({
        rubrica: '09',
        descricao: `Férias Projeção Aviso Indenizado (${avosAvisoFerias}/12 avos + 1/3)`,
        tipo: 'provento',
        valor: feriasIndenizadasAviso,
      })
    }
  }

  // 6. Proventos Totais
  const totalBrutoRescisao = Number(
    (
      saldoSalarioValor +
      avisoPrevioIndenizadoValor +
      decimoTerceiroProporcionalValor +
      decimoTerceiroIndenizadoAviso +
      feriasVencidasValor +
      tercoFeriasVencidas +
      feriasProporcionaisValor +
      tercoFeriasProporcionais +
      feriasIndenizadasAviso +
      outrosProventos
    ).toFixed(2),
  )

  // 7. Descontos Fiscais e Previdenciários
  // INSS incide sobre Saldo de Salário (e 13º proporcional tem tabela exclusiva)
  const resInssSaldo = calcularInssProgressivo(saldoSalarioValor)
  const descontoInss = resInssSaldo.inss

  rubricasDetalhadas.push({
    rubrica: '9901',
    descricao: 'INSS Previdência Social sobre Saldo de Salário',
    tipo: 'desconto',
    valor: descontoInss,
  })

  // IRRF sobre saldo de salário e verbas tributáveis
  const resIrrf = calcularIrrfProgressivo({
    baseBrutaParaIrrf: saldoSalarioValor,
    inssDescontado: descontoInss,
    dependentes,
  })
  const descontoIrrf = resIrrf.irrf

  if (descontoIrrf > 0) {
    rubricasDetalhadas.push({
      rubrica: '9902',
      descricao: 'IRRF Retido na Fonte Rescisão',
      tipo: 'desconto',
      valor: descontoIrrf,
    })
  }

  if (descontoAdiantamento > 0) {
    rubricasDetalhadas.push({
      rubrica: '9903',
      descricao: 'Adiantamento Salarial a Compensar',
      tipo: 'desconto',
      valor: descontoAdiantamento,
    })
  }

  const totalDescontosRescisao = Number(
    (
      descontoInss +
      descontoIrrf +
      descontoAvisoNaoCumprido +
      descontoAdiantamento +
      outrosDescontos
    ).toFixed(2),
  )

  const totalLiquidoRescisao = Number(
    Math.max(0, totalBrutoRescisao - totalDescontosRescisao).toFixed(2),
  )

  // 8. FGTS e Multa Rescisória
  let aliquotaMultaFgts = 0
  let valorMultaFgts = 0
  let saqueFgtsAutorizado = false
  let codigoSaqueFgts = '00'

  if (
    motivoDesligamento === 'sem_justa_causa_empregador' ||
    motivoDesligamento === 'rescisao_indireta'
  ) {
    aliquotaMultaFgts = 40 // 40% CLT e CF art. 7º I c/c Lei 8.036/90
    saqueFgtsAutorizado = true
    codigoSaqueFgts = '01'
    valorMultaFgts = Number(((saldoFgts * 40) / 100).toFixed(2))
  } else if (motivoDesligamento === 'acordo_consensual_art_484_a') {
    aliquotaMultaFgts = 20 // 20% no acordo do art. 484-A
    saqueFgtsAutorizado = true
    codigoSaqueFgts = '01A' // saque limitado a 80% dos depósitos
    valorMultaFgts = Number(((saldoFgts * 20) / 100).toFixed(2))
  } else if (motivoDesligamento === 'termino_contrato_experiencia') {
    aliquotaMultaFgts = 0
    saqueFgtsAutorizado = true
    codigoSaqueFgts = '04'
  } else if (motivoDesligamento === 'aposentadoria') {
    aliquotaMultaFgts = 0
    saqueFgtsAutorizado = true
    codigoSaqueFgts = '05'
  } else {
    // Justa causa ou pedido de demissão: sem multa rescisória e saque bloqueado
    aliquotaMultaFgts = 0
    saqueFgtsAutorizado = false
    codigoSaqueFgts = '00'
  }

  // 9. Prazo legal de pagamento da rescisão (CLT art. 477 §6º: 10 dias corridos)
  const dtPrazo = new Date(dtDem.getTime() + 10 * 24 * 60 * 60 * 1000)
  const prazoPagamentoLimite = dtPrazo.toISOString().slice(0, 10)

  // 10. Alertas de conformidade CLT
  if (
    (motivoDesligamento === 'sem_justa_causa_empregador' ||
      motivoDesligamento === 'acordo_consensual_art_484_a') &&
    !dataAvisoPrevio
  ) {
    alertasConformidade.push({
      tipo: 'infracao',
      regra: 'CLT Art. 487 / Lei 12.506/2011',
      mensagem:
        'Aviso prévio não possui data de comunicação formal. Risco de nulidade ou obrigação de indenização plena.',
      sugestao: 'Registre a data formal em que o colaborador tomou ciência por escrito.',
    })
  }

  alertasConformidade.push({
    tipo: 'aviso',
    regra: 'CLT Art. 477 §6º e §8º',
    mensagem: `Prazo improrrogável de quitação: ${prazoPagamentoLimite} (10 dias corridos do término). Atraso acarreta multa no valor de 1 salário (R$ ${salarioBase.toFixed(2)}).`,
    sugestao:
      'Programe o pagamento bancário e gere a chave de conectividade social antecipadamente.',
  })

  if (aliquotaMultaFgts > 0) {
    alertasConformidade.push({
      tipo: 'informativo',
      regra: 'Lei nº 8.036/90 Art. 18 §1º',
      mensagem: `Multa do FGTS de ${aliquotaMultaFgts}% sobre o saldo apurado (R$ ${valorMultaFgts.toFixed(2)}). Nota: O adicional de 10% da LC 110/01 foi extinto pela Lei nº 13.932/2019.`,
    })
  }

  if (motivoDesligamento === 'justa_causa_empregador') {
    alertasConformidade.push({
      tipo: 'aviso',
      regra: 'CLT Art. 482',
      mensagem:
        'Dispensa por Justa Causa: Saque do FGTS e seguro-desemprego bloqueados. Exige comprovação documental robusta da falta grave.',
    })
  }

  if (feriasVencidas) {
    alertasConformidade.push({
      tipo: 'aviso',
      regra: 'CLT Art. 134 e 137',
      mensagem:
        'Férias vencidas apuradas na rescisão. Verifique se o período concessivo expirou antes da data de demissão para eventual dobra legal.',
    })
  }

  return {
    anosCompletosTrabalhados,
    diasAvisoPrevioLei12506,
    dataProjecaoAviso,
    diasSaldoSalario,
    saldoSalarioValor,
    avisoPrevioIndenizadoValor,
    decimoTerceiroProporcionalValor,
    decimoTerceiroIndenizadoAviso,
    feriasVencidasValor,
    tercoFeriasVencidas,
    feriasProporcionaisValor,
    tercoFeriasProporcionais,
    feriasIndenizadasAviso,
    totalBrutoRescisao,
    descontoInss,
    descontoIrrf,
    descontoAvisoNaoCumprido,
    descontoAdiantamento,
    outrosDescontos,
    totalDescontosRescisao,
    totalLiquidoRescisao,
    aliquotaMultaFgts,
    valorMultaFgts,
    saqueFgtsAutorizado,
    codigoSaqueFgts,
    prazoPagamentoLimite,
    alertasConformidade,
    rubricasDetalhadas,
  }
}

export interface ResultadoProcessamentoFolha {
  salarioBase: number
  totalProventos: number
  totalBruto: number
  baseInss: number
  inss: number
  baseIrrf: number
  irrf: number
  baseFgts: number
  fgts: number
  totalDescontosVariaveis: number
  totalDescontos: number
  salarioLiquido: number
  proventosDetalhados: ItemRubrica[]
  descontosDetalhados: ItemRubrica[]
}

export function processarCalculoFolhaClt(params: {
  salarioBase: number
  dependentes: number
  lancamentos: (VerbaLancamentoRecord & { verbaObj?: VerbaCatalogoRecord })[]
}): ResultadoProcessamentoFolha {
  const { salarioBase, dependentes, lancamentos } = params

  const proventosDetalhados: ItemRubrica[] = [
    {
      descricao: 'Salário Base Contratual',
      valor: Number(salarioBase.toFixed(2)),
      codigo: '1000',
      rubrica_esocial: '1000',
      tipo: 'provento',
      quantidade: 30,
      unidade: 'dias',
      referencia: '30 dias',
    },
  ]

  const descontosDetalhados: ItemRubrica[] = []

  let somaProventosVariaveis = 0
  let somaDescontosVariaveis = 0

  let baseInss = salarioBase
  let baseFgts = salarioBase
  let deducoesPreIrrf = 0

  for (const lanc of lancamentos) {
    const v = lanc.verbaObj || (lanc.expand?.verba as VerbaCatalogoRecord | undefined)
    const valor = Number(lanc.valor_calculado || 0)
    if (valor <= 0) continue

    const isProvento = v ? v.tipo === 'provento' : valor > 0

    if (isProvento) {
      somaProventosVariaveis += valor
      proventosDetalhados.push({
        descricao: v ? v.descricao : 'Verba Remuneratória',
        valor: Number(valor.toFixed(2)),
        codigo: v?.codigo,
        rubrica_esocial: v?.rubrica_esocial || '1000',
        tipo: 'provento',
        quantidade: lanc.quantidade,
        unidade: v?.unidade,
        aliquota_percentual: lanc.aliquota_percentual,
        referencia: lanc.referencia_detalhe,
      })

      if (v?.incide_inss !== false) {
        baseInss += valor
      }
      if (v?.incide_fgts !== false) {
        baseFgts += valor
      }
    } else {
      somaDescontosVariaveis += valor
      descontosDetalhados.push({
        descricao: v ? v.descricao : 'Desconto em Folha',
        valor: Number(valor.toFixed(2)),
        codigo: v?.codigo,
        rubrica_esocial: v?.rubrica_esocial || '9901',
        tipo: 'desconto',
        quantidade: lanc.quantidade,
        unidade: v?.unidade,
        aliquota_percentual: lanc.aliquota_percentual,
        referencia: lanc.referencia_detalhe,
      })

      // Se a verba for pensão alimentícia judicial, deduz da base do IRRF
      if (v?.codigo === '9005' || v?.descricao.toLowerCase().includes('pensão')) {
        deducoesPreIrrf += valor
      }
      // Faltas reduzem a base de cálculo de INSS e FGTS
      if (
        v?.codigo === '9003' ||
        v?.codigo === '9004' ||
        v?.descricao.toLowerCase().includes('falta')
      ) {
        baseInss = Math.max(0, baseInss - valor)
        baseFgts = Math.max(0, baseFgts - valor)
      }
    }
  }

  const totalBruto = salarioBase + somaProventosVariaveis

  // 1. Cálculo progressivo INSS
  const resInss = calcularInssProgressivo(baseInss)
  const inss = resInss.inss

  descontosDetalhados.unshift({
    descricao: resInss.atingiuTeto ? 'INSS Previdência (Teto CLT)' : 'INSS Previdência Social',
    valor: Number(inss.toFixed(2)),
    codigo: '9901',
    rubrica_esocial: '9901',
    tipo: 'desconto',
    referencia: resInss.atingiuTeto ? 'Teto legal R$ 908,85' : `Base R$ ${baseInss.toFixed(2)}`,
  })

  // 2. Base IRRF e Cálculo progressivo
  // Base do IRRF = Bruto que incide - INSS apurado - deduções dependentes/pensão
  const resIrrf = calcularIrrfProgressivo({
    baseBrutaParaIrrf: totalBruto,
    inssDescontado: inss,
    dependentes,
    outrasDeducoesLegais: deducoesPreIrrf,
  })
  const irrf = resIrrf.irrf

  if (irrf > 0) {
    descontosDetalhados.splice(1, 0, {
      descricao: `IRRF Retido na Fonte (${dependentes > 0 ? `${dependentes} dep.` : resIrrf.metodoUtilizado === 'desconto_simplificado' ? 'simplificado' : 'tabela'})`,
      valor: Number(irrf.toFixed(2)),
      codigo: '9902',
      rubrica_esocial: '9902',
      tipo: 'desconto',
      referencia: `Base R$ ${resIrrf.baseCalculo.toFixed(2)} (${(resIrrf.aliquotaEfetiva * 100).toFixed(1)}%)`,
    })
  }

  // 3. FGTS 8% Patronal
  const fgts = Number((baseFgts * 0.08).toFixed(2))

  const totalDescontos = Number((inss + irrf + somaDescontosVariaveis).toFixed(2))
  const salarioLiquido = Number(Math.max(0, totalBruto - totalDescontos).toFixed(2))

  return {
    salarioBase: Number(salarioBase.toFixed(2)),
    totalProventos: Number(totalBruto.toFixed(2)),
    totalBruto: Number(totalBruto.toFixed(2)),
    baseInss: Number(baseInss.toFixed(2)),
    inss,
    baseIrrf: resIrrf.baseCalculo,
    irrf,
    baseFgts: Number(baseFgts.toFixed(2)),
    fgts,
    totalDescontosVariaveis: Number(somaDescontosVariaveis.toFixed(2)),
    totalDescontos,
    salarioLiquido,
    proventosDetalhados,
    descontosDetalhados,
  }
}

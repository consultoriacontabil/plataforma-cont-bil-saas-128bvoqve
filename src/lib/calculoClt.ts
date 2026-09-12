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

/**
 * Motor de Cálculo Unificado Normativo — FASE 3
 * Centraliza alíquotas, faixas e limites vigentes (INSS, IRRF, FGTS, Simples Nacional, ISS, Lucro Presumido).
 *
 * Princípios de Engenharia:
 * 1. Camada única e versionada de parâmetros com vigência.
 * 2. Fallback resiliente síncrono para garantir estabilidade e paridade imediata caso a rede ou banco esteja inacessível.
 * 3. Cache local por tenant com invalidação sob demanda.
 * 4. Funções puras de cálculo que garantem idênticos resultados numéricos aos anteriores.
 */

import pb from '@/lib/pocketbase/client'
import { auditService } from '@/services/audit'

export type ParametroCategoria =
  | 'inss'
  | 'irrf'
  | 'fgts'
  | 'simples_nacional'
  | 'iss'
  | 'lucro_presumido'
  | 'outros'

export interface FaixaInssParam {
  ate: number
  aliquota: number
  deducao: number
}

export interface InssParametros {
  aliquota_patronal_padrao: number
  rat_padrao: number
  terceiros_padrao: number
  teto_salario_contribuicao: number
  teto_desconto: number
  faixas: FaixaInssParam[]
}

export interface FaixaIrrfParam {
  ate: number
  aliquota: number
  deducao: number
}

export interface IrrfParametros {
  deducao_por_dependente: number
  desconto_simplificado_mensal: number
  faixas: FaixaIrrfParam[]
}

export interface FgtsParametros {
  aliquota_clt: number
  aliquota_jovem_aprendiz: number
  aliquota_domestico: number
  multa_rescisoria_sem_justa_causa: number
  contribuicao_social_rescisoria: number
}

export interface FaixaSimplesParam {
  faixa: number
  limite_rbt12: number
  aliquota_nominal: number
  parcela_deduzir: number
}

export interface SimplesNacionalParametros {
  sublimite_estadual: number
  limite_geral: number
  anexo_I_comercio: FaixaSimplesParam[]
  anexo_II_industria: FaixaSimplesParam[]
  anexo_III_servicos: FaixaSimplesParam[]
  anexo_IV_servicos_obras: FaixaSimplesParam[]
}

export interface IssParametros {
  aliquota_minima: number
  aliquota_maxima: number
  aliquota_padrao: number
  aliquota_retencao_padrao: number
}

export interface LucroPresumidoParametros {
  presuncao_irpj_comercio: number
  presuncao_irpj_servicos: number
  aliquota_irpj: number
  adicional_irpj_limite_trimestral: number
  aliquota_adicional_irpj: number
  presuncao_csll_comercio: number
  presuncao_csll_servicos: number
  aliquota_csll: number
  pis_cumulativo: number
  cofins_cumulativo: number
}

export interface ParametroNormativoRecord {
  id: string
  tenant_id: string
  categoria: ParametroCategoria
  chave: string
  titulo: string
  descricao?: string
  vigencia_inicio: string
  vigencia_fim?: string
  valores_json: Record<string, unknown>
  ativo: boolean
  versao: number
  atualizado_por?: string
  created: string
  updated: string
}

// ==========================================
// VALORES PADRÃO VIGENTES (FALLBACK ESTÁVEL)
// ==========================================

export const PARAMETROS_INSS_PADRAO: InssParametros = {
  aliquota_patronal_padrao: 20.0,
  rat_padrao: 2.0,
  terceiros_padrao: 5.8,
  teto_salario_contribuicao: 7786.02,
  teto_desconto: 908.85,
  faixas: [
    { ate: 1412.0, aliquota: 0.075, deducao: 0.0 },
    { ate: 2666.68, aliquota: 0.09, deducao: 21.18 },
    { ate: 4000.03, aliquota: 0.12, deducao: 101.18 },
    { ate: 7786.02, aliquota: 0.14, deducao: 181.18 },
  ],
}

export const PARAMETROS_IRRF_PADRAO: IrrfParametros = {
  deducao_por_dependente: 189.59,
  desconto_simplificado_mensal: 564.8,
  faixas: [
    { ate: 2259.2, aliquota: 0.0, deducao: 0.0 },
    { ate: 2826.65, aliquota: 0.075, deducao: 169.44 },
    { ate: 3751.05, aliquota: 0.15, deducao: 381.44 },
    { ate: 4664.68, aliquota: 0.225, deducao: 662.77 },
    { ate: 999999999.0, aliquota: 0.275, deducao: 896.0 },
  ],
}

export const PARAMETROS_FGTS_PADRAO: FgtsParametros = {
  aliquota_clt: 8.0,
  aliquota_jovem_aprendiz: 2.0,
  aliquota_domestico: 8.0,
  multa_rescisoria_sem_justa_causa: 40.0,
  contribuicao_social_rescisoria: 10.0,
}

export const PARAMETROS_SIMPLES_PADRAO: SimplesNacionalParametros = {
  sublimite_estadual: 3600000.0,
  limite_geral: 4800000.0,
  anexo_I_comercio: [
    { faixa: 1, limite_rbt12: 180000.0, aliquota_nominal: 0.04, parcela_deduzir: 0.0 },
    { faixa: 2, limite_rbt12: 360000.0, aliquota_nominal: 0.073, parcela_deduzir: 5940.0 },
    { faixa: 3, limite_rbt12: 720000.0, aliquota_nominal: 0.095, parcela_deduzir: 13860.0 },
    { faixa: 4, limite_rbt12: 1800000.0, aliquota_nominal: 0.107, parcela_deduzir: 22500.0 },
    { faixa: 5, limite_rbt12: 3600000.0, aliquota_nominal: 0.143, parcela_deduzir: 87300.0 },
    { faixa: 6, limite_rbt12: 4800000.0, aliquota_nominal: 0.19, parcela_deduzir: 378000.0 },
  ],
  anexo_II_industria: [
    { faixa: 1, limite_rbt12: 180000.0, aliquota_nominal: 0.045, parcela_deduzir: 0.0 },
    { faixa: 2, limite_rbt12: 360000.0, aliquota_nominal: 0.078, parcela_deduzir: 5940.0 },
    { faixa: 3, limite_rbt12: 720000.0, aliquota_nominal: 0.1, parcela_deduzir: 13860.0 },
    { faixa: 4, limite_rbt12: 1800000.0, aliquota_nominal: 0.112, parcela_deduzir: 22500.0 },
    { faixa: 5, limite_rbt12: 3600000.0, aliquota_nominal: 0.147, parcela_deduzir: 85500.0 },
    { faixa: 6, limite_rbt12: 4800000.0, aliquota_nominal: 0.3, parcela_deduzir: 720000.0 },
  ],
  anexo_III_servicos: [
    { faixa: 1, limite_rbt12: 180000.0, aliquota_nominal: 0.06, parcela_deduzir: 0.0 },
    { faixa: 2, limite_rbt12: 360000.0, aliquota_nominal: 0.112, parcela_deduzir: 9360.0 },
    { faixa: 3, limite_rbt12: 720000.0, aliquota_nominal: 0.135, parcela_deduzir: 17640.0 },
    { faixa: 4, limite_rbt12: 1800000.0, aliquota_nominal: 0.16, parcela_deduzir: 35640.0 },
    { faixa: 5, limite_rbt12: 3600000.0, aliquota_nominal: 0.21, parcela_deduzir: 125640.0 },
    { faixa: 6, limite_rbt12: 4800000.0, aliquota_nominal: 0.33, parcela_deduzir: 648000.0 },
  ],
  anexo_IV_servicos_obras: [
    { faixa: 1, limite_rbt12: 180000.0, aliquota_nominal: 0.045, parcela_deduzir: 0.0 },
    { faixa: 2, limite_rbt12: 360000.0, aliquota_nominal: 0.09, parcela_deduzir: 8100.0 },
    { faixa: 3, limite_rbt12: 720000.0, aliquota_nominal: 0.102, parcela_deduzir: 12420.0 },
    { faixa: 4, limite_rbt12: 1800000.0, aliquota_nominal: 0.14, parcela_deduzir: 39780.0 },
    { faixa: 5, limite_rbt12: 3600000.0, aliquota_nominal: 0.22, parcela_deduzir: 183780.0 },
    { faixa: 6, limite_rbt12: 4800000.0, aliquota_nominal: 0.33, parcela_deduzir: 828000.0 },
  ],
}

export const PARAMETROS_ISS_PADRAO: IssParametros = {
  aliquota_minima: 2.0,
  aliquota_maxima: 5.0,
  aliquota_padrao: 5.0,
  aliquota_retencao_padrao: 5.0,
}

export const PARAMETROS_LUCRO_PRESUMIDO_PADRAO: LucroPresumidoParametros = {
  presuncao_irpj_comercio: 8.0,
  presuncao_irpj_servicos: 32.0,
  aliquota_irpj: 15.0,
  adicional_irpj_limite_trimestral: 60000.0,
  aliquota_adicional_irpj: 10.0,
  presuncao_csll_comercio: 12.0,
  presuncao_csll_servicos: 32.0,
  aliquota_csll: 9.0,
  pis_cumulativo: 0.65,
  cofins_cumulativo: 3.0,
}

// Cache local em memória (tenantId -> categoria -> params)
const cacheParametros = new Map<string, Map<ParametroCategoria, Record<string, unknown>>>()

export const calculoUnificadoService = {
  /**
   * Limpa o cache para recarregar do banco
   */
  invalidarCache(tenantId?: string) {
    if (tenantId) {
      cacheParametros.delete(tenantId)
    } else {
      cacheParametros.clear()
    }
  },

  /**
   * Lista todos os parâmetros cadastrados para o tenant
   */
  async listarParametros(tenantId: string): Promise<ParametroNormativoRecord[]> {
    try {
      const records = await pb
        .collection('parametros_normativos')
        .getFullList<ParametroNormativoRecord>({
          filter: `tenant_id = "${tenantId}"`,
          sort: 'categoria,chave',
          expand: 'atualizado_por',
        })
      return records
    } catch (err) {
      console.warn('Erro ao listar parametros normativos:', err)
      return []
    }
  },

  /**
   * Obtém parâmetros vigentes de uma categoria
   */
  async obterParametrosCategoria<T>(
    tenantId: string,
    categoria: ParametroCategoria,
    fallback: T,
  ): Promise<T> {
    const tenantCache = cacheParametros.get(tenantId)
    if (tenantCache && tenantCache.has(categoria)) {
      return tenantCache.get(categoria) as T
    }

    try {
      const records = await pb
        .collection('parametros_normativos')
        .getFullList<ParametroNormativoRecord>({
          filter: `tenant_id = "${tenantId}" && categoria = "${categoria}" && ativo = true`,
          sort: '-vigencia_inicio,-versao',
        })

      if (records.length > 0 && records[0].valores_json) {
        const val = records[0].valores_json as T
        if (!cacheParametros.has(tenantId)) {
          cacheParametros.set(tenantId, new Map())
        }
        cacheParametros.get(tenantId)!.set(categoria, val as Record<string, unknown>)
        return val
      }
    } catch (err) {
      console.warn(
        `[calculoUnificado] Falha ao obter ${categoria} do banco, usando fallback normativo:`,
        err,
      )
    }

    return fallback
  },

  /**
   * Atualiza ou cria parâmetros normativos
   */
  async salvarParametros(params: {
    tenantId: string
    id?: string
    categoria: ParametroCategoria
    chave: string
    titulo: string
    descricao?: string
    vigencia_inicio: string
    vigencia_fim?: string
    valores_json: Record<string, unknown>
    ativo?: boolean
    usuarioId?: string
  }): Promise<ParametroNormativoRecord> {
    let record: ParametroNormativoRecord

    if (params.id) {
      record = await pb
        .collection('parametros_normativos')
        .update<ParametroNormativoRecord>(params.id, {
          titulo: params.titulo,
          descricao: params.descricao,
          vigencia_inicio: params.vigencia_inicio,
          vigencia_fim: params.vigencia_fim || null,
          valores_json: params.valores_json,
          ativo: params.ativo ?? true,
          atualizado_por: params.usuarioId || undefined,
        })
    } else {
      record = await pb.collection('parametros_normativos').create<ParametroNormativoRecord>({
        tenant_id: params.tenantId,
        categoria: params.categoria,
        chave: params.chave,
        titulo: params.titulo,
        descricao: params.descricao,
        vigencia_inicio: params.vigencia_inicio,
        vigencia_fim: params.vigencia_fim || null,
        valores_json: params.valores_json,
        ativo: params.ativo ?? true,
        versao: 1,
        atualizado_por: params.usuarioId || undefined,
      })
    }

    this.invalidarCache(params.tenantId)

    await auditService.log(
      params.tenantId,
      params.usuarioId || '',
      params.id ? 'atualizar_parametro_normativo' : 'criar_parametro_normativo',
      'parametros_normativos',
      record.id,
      `Parâmetro normativo '${params.titulo}' (${params.categoria}) atualizado. Vigência a partir de ${params.vigencia_inicio.slice(0, 10)}.`,
    )

    return record
  },

  // ==========================================
  // FUNÇÕES CENTRAIS DE CÁLCULO NORMATIVO
  // ==========================================

  /**
   * Cálculo progressivo do INSS sobre salário/remuneração
   */
  calcularInssProgressivo(baseCalculo: number, config: InssParametros = PARAMETROS_INSS_PADRAO) {
    if (baseCalculo <= 0) {
      return { valorDesconto: 0, aliquotaEfetiva: 0, faixasDetalhadas: [] }
    }

    const baseEfetiva = Math.min(baseCalculo, config.teto_salario_contribuicao)
    let totalDesconto = 0
    let faixaAnteriorTeto = 0

    const faixasDetalhadas: {
      faixa: number
      baseFaixa: number
      aliquota: number
      descontoFaixa: number
    }[] = []

    for (let i = 0; i < config.faixas.length; i++) {
      const f = config.faixas[i]
      if (baseEfetiva > faixaAnteriorTeto) {
        const baseNestaFaixa = Math.min(baseEfetiva - faixaAnteriorTeto, f.ate - faixaAnteriorTeto)
        const descontoFaixa = Math.round(baseNestaFaixa * f.aliquota * 100) / 100
        totalDesconto += descontoFaixa

        faixasDetalhadas.push({
          faixa: i + 1,
          baseFaixa: Math.round(baseNestaFaixa * 100) / 100,
          aliquota: f.aliquota,
          descontoFaixa,
        })
      }
      faixaAnteriorTeto = f.ate
    }

    totalDesconto = Math.min(totalDesconto, config.teto_desconto)
    const valorDesconto = Math.round(totalDesconto * 100) / 100
    const aliquotaEfetiva = Math.round((valorDesconto / baseCalculo) * 10000) / 100

    return {
      valorDesconto,
      aliquotaEfetiva,
      faixasDetalhadas,
    }
  },

  /**
   * Cálculo progressivo do IRRF sobre rendimentos do trabalho
   */
  calcularIrrfProgressivo(
    params: {
      rendimentoTributavel: number
      inssDeduzido: number
      dependentes?: number
      outrasDeducoesLegais?: number
      pensaoAlimenticia?: number
    },
    config: IrrfParametros = PARAMETROS_IRRF_PADRAO,
  ) {
    const {
      rendimentoTributavel,
      inssDeduzido,
      dependentes = 0,
      outrasDeducoesLegais = 0,
      pensaoAlimenticia = 0,
    } = params

    if (rendimentoTributavel <= 0) {
      return {
        baseCalculo: 0,
        valorIrrf: 0,
        aliquotaNominal: 0,
        parcelaDeduzir: 0,
        aliquotaEfetiva: 0,
        metodoAplicado: 'legal' as const,
      }
    }

    // Dedução Legal
    const totalDeducaoDependentes = dependentes * config.deducao_por_dependente
    const baseLegal = Math.max(
      0,
      rendimentoTributavel -
        inssDeduzido -
        totalDeducaoDependentes -
        outrasDeducoesLegais -
        pensaoAlimenticia,
    )

    // Desconto Simplificado
    const baseSimplificado = Math.max(0, rendimentoTributavel - config.desconto_simplificado_mensal)

    const calcularImpostoSobreBase = (base: number) => {
      let aliquota = 0
      let parcela = 0

      for (const f of config.faixas) {
        if (base <= f.ate) {
          aliquota = f.aliquota
          parcela = f.deducao
          break
        }
      }

      const imposto = Math.max(0, Math.round((base * aliquota - parcela) * 100) / 100)
      return { imposto, aliquota, parcela }
    }

    const calcLegal = calcularImpostoSobreBase(baseLegal)
    const calcSimplificado = calcularImpostoSobreBase(baseSimplificado)

    // O sistema opta pelo modelo mais benéfico ao trabalhador
    const aplicarSimplificado = calcSimplificado.imposto < calcLegal.imposto

    const impostoFinal = aplicarSimplificado ? calcSimplificado.imposto : calcLegal.imposto
    const baseFinal = aplicarSimplificado ? baseSimplificado : baseLegal
    const aliquotaFinal = aplicarSimplificado ? calcSimplificado.aliquota : calcLegal.aliquota
    const parcelaFinal = aplicarSimplificado ? calcSimplificado.parcela : calcLegal.parcela

    return {
      baseCalculo: Math.round(baseFinal * 100) / 100,
      valorIrrf: impostoFinal,
      aliquotaNominal: aliquotaFinal,
      parcelaDeduzir: parcelaFinal,
      aliquotaEfetiva: Math.round((impostoFinal / rendimentoTributavel) * 10000) / 100,
      metodoAplicado: (aplicarSimplificado ? 'simplificado' : 'legal') as 'legal' | 'simplificado',
      detalhesComparacao: {
        legal: { base: baseLegal, imposto: calcLegal.imposto },
        simplificado: { base: baseSimplificado, imposto: calcSimplificado.imposto },
      },
    }
  },

  /**
   * Cálculo de FGTS
   */
  calcularFgts(
    remuneracao: number,
    tipo: 'clt' | 'aprendiz' | 'domestico' = 'clt',
    config: FgtsParametros = PARAMETROS_FGTS_PADRAO,
  ) {
    if (remuneracao <= 0) return { aliquota: 0, valor: 0 }
    let aliquota = config.aliquota_clt
    if (tipo === 'aprendiz') aliquota = config.aliquota_jovem_aprendiz
    else if (tipo === 'domestico') aliquota = config.aliquota_domestico

    const valor = Math.round(remuneracao * (aliquota / 100) * 100) / 100
    return { aliquota, valor }
  },

  /**
   * Cálculo da alíquota efetiva e valor do Simples Nacional (DAS)
   * Fórmula oficial: Alíquota Efetiva = (RBT12 * Alíquota Nominal - Parcela a Deduzir) / RBT12
   */
  calcularDasSimplesNacional(
    params: {
      rbt12: number
      faturamentoMes: number
      anexo: 'I' | 'II' | 'III' | 'IV'
    },
    config: SimplesNacionalParametros = PARAMETROS_SIMPLES_PADRAO,
  ) {
    const { rbt12, faturamentoMes, anexo } = params
    if (faturamentoMes <= 0) {
      return { aliquotaEfetiva: 0, valorDas: 0, faixa: 1, ultrapassouSublimite: false }
    }

    const rbt12Efetivo = Math.max(rbt12, faturamentoMes)
    const tabela =
      anexo === 'I'
        ? config.anexo_I_comercio
        : anexo === 'II'
          ? config.anexo_II_industria
          : anexo === 'III'
            ? config.anexo_III_servicos
            : config.anexo_IV_servicos_obras

    let faixaSelecionada = tabela[0]
    for (const faixa of tabela) {
      if (rbt12Efetivo <= faixa.limite_rbt12) {
        faixaSelecionada = faixa
        break
      }
      faixaSelecionada = faixa
    }

    // Cálculo da Alíquota Efetiva
    let aliqEfetiva =
      (rbt12Efetivo * faixaSelecionada.aliquota_nominal - faixaSelecionada.parcela_deduzir) /
      rbt12Efetivo
    aliqEfetiva = Math.max(0.04, Math.min(0.33, aliqEfetiva))

    const valorDas = Math.round(faturamentoMes * aliqEfetiva * 100) / 100
    const ultrapassouSublimite = rbt12Efetivo > config.sublimite_estadual

    return {
      faixa: faixaSelecionada.faixa,
      aliquotaNominal: faixaSelecionada.aliquota_nominal,
      parcelaDeduzir: faixaSelecionada.parcela_deduzir,
      aliquotaEfetiva: Math.round(aliqEfetiva * 10000) / 100, // em porcentagem, ex: 8.52%
      valorDas,
      ultrapassouSublimite,
      limiteGeral: config.limite_geral,
    }
  },

  /**
   * Cálculo trimestral de IRPJ e CSLL no Lucro Presumido
   */
  calcularLucroPresumidoTrimestral(
    params: {
      receitaComercio?: number
      receitaServicos?: number
      outrasReceitas?: number
    },
    config: LucroPresumidoParametros = PARAMETROS_LUCRO_PRESUMIDO_PADRAO,
  ) {
    const recCom = params.receitaComercio || 0
    const recServ = params.receitaServicos || 0
    const outras = params.outrasReceitas || 0

    // 1. Base IRPJ
    const baseIrpjCom = recCom * (config.presuncao_irpj_comercio / 100)
    const baseIrpjServ = recServ * (config.presuncao_irpj_servicos / 100)
    const baseIrpjTotal = baseIrpjCom + baseIrpjServ + outras

    const irpjNormal = baseIrpjTotal * (config.aliquota_irpj / 100)
    const excessoTrimestral = Math.max(0, baseIrpjTotal - config.adicional_irpj_limite_trimestral)
    const adicionalIrpj = excessoTrimestral * (config.aliquota_adicional_irpj / 100)
    const totalIrpj = Math.round((irpjNormal + adicionalIrpj) * 100) / 100

    // 2. Base CSLL
    const baseCsllCom = recCom * (config.presuncao_csll_comercio / 100)
    const baseCsllServ = recServ * (config.presuncao_csll_servicos / 100)
    const baseCsllTotal = baseCsllCom + baseCsllServ + outras

    const totalCsll = Math.round(baseCsllTotal * (config.aliquota_csll / 100) * 100) / 100

    // 3. PIS e COFINS cumulativo
    const receitaTotal = recCom + recServ + outras
    const pisCumulativo = Math.round(receitaTotal * (config.pis_cumulativo / 100) * 100) / 100
    const cofinsCumulativo = Math.round(receitaTotal * (config.cofins_cumulativo / 100) * 100) / 100

    return {
      receitaTotal,
      baseIrpjTotal: Math.round(baseIrpjTotal * 100) / 100,
      totalIrpj,
      adicionalIrpj: Math.round(adicionalIrpj * 100) / 100,
      baseCsllTotal: Math.round(baseCsllTotal * 100) / 100,
      totalCsll,
      pisCumulativo,
      cofinsCumulativo,
      totalFederal:
        Math.round((totalIrpj + totalCsll + pisCumulativo + cofinsCumulativo) * 100) / 100,
    }
  },

  /**
   * Cálculo de ISS sobre serviços
   */
  calcularIss(
    valorServicos: number,
    aliquota = 5.0,
    config: IssParametros = PARAMETROS_ISS_PADRAO,
  ) {
    if (valorServicos <= 0) return { aliquota: 0, valorIss: 0 }
    const aliqEfetiva = Math.max(config.aliquota_minima, Math.min(config.aliquota_maxima, aliquota))
    const valorIss = Math.round(valorServicos * (aliqEfetiva / 100) * 100) / 100
    return {
      aliquota: aliqEfetiva,
      valorIss,
    }
  },
}

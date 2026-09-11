/**
 * PARÂMETROS LEGAIS DA REFORMA TRIBUTÁRIA DO CONSUMO
 * Base Legal Primária:
 * - Emenda Constitucional nº 132/2023 (EC 132/2023)
 * - Lei Complementar nº 214/2025 (LC 214/2025 - Regulamento Geral IBS/CBS)
 * - Artigos 124 a 133 do ADCT (Ato das Disposições Constitucionais Transitórias)
 * - Resoluções preliminares do Comitê Gestor do IBS (CGIBS) e Receita Federal do Brasil (RFB)
 *
 * NOTA DE MANUTENÇÃO:
 * Este objeto centraliza todas as alíquotas de referência, percentuais de graduação
 * do período de transição (2026 a 2033) e regras de redução/desconto.
 * Quando o Comitê Gestor do IBS ou o Senado Federal fixarem novas alíquotas de referência
 * definitivas, atualize este arquivo diretamente.
 */

export interface ParametrosAnoTransicao {
  ano: number
  descricao: string
  fase: 'teste' | 'cbs_plena' | 'graduacao' | 'pleno'
  /** CBS alíquota nominal de referência (%) */
  aliquotaCBS: number
  /** IBS alíquota nominal de referência (%) */
  aliquotaIBS: number
  /** Fator de redução dos tributos antigos (PIS/COFINS/ICMS/ISS) — de 1.0 (100% mantido) até 0.0 (extinto) */
  fatorTributosAntigos: number
  /** Percentual do IBS em relação à alíquota de referência definitiva (art. 128 ADCT) */
  fatorIBSGraduacao: number
  /** Se compensável no ano teste (2026) */
  testeCompensavel?: boolean
}

export const PARAMETROS_REFORMA = {
  versaoNormativa: 'LC 214/2025 e EC 132/2023',
  fonte: 'Senado Federal / Comitê Gestor do IBS / Receita Federal do Brasil',

  /**
   * Alíquota de referência combinada estimada para o regime pleno em 2033:
   * Alíquota padrão estimada em ~26.5% (CBS ~8.8% Federal, IBS ~17.7% Estados e Municípios)
   */
  aliquotaReferenciaPlena: {
    cbs: 8.8,
    ibs: 17.7,
    total: 26.5,
  },

  /**
   * Reduções de alíquotas previstas na LC 214/2025 e EC 132/2023:
   * - Redução de 60% para serviços prioritários (educação, saúde, medicamentos, etc.)
   * - Redução de 30% para profissões intelectuais regulamentadas (médicos, advogados, contadores em PF/sociedade unipessoal)
   * - Alíquota zero (100% redução) para cesta básica nacional de alimentos
   */
  reducoes: {
    setoresPrioritarios60: 0.6, // Redução de 60% (alíquota efetiva fica em 40% da referência)
    profissoesRegulamentadas30: 0.3, // Redução de 30% (alíquota efetiva fica em 70% da referência)
    cestaBasicaNacional: 1.0, // Alíquota zero (100% de desconto)
  },

  /**
   * Regras para o Simples Nacional (LC 123/2006 c/c LC 214/2025):
   * - Sublimite estadual para ICMS/ISS e IBS/CBS: R$ 3.600.000,00 anuais
   * - Teto geral do Simples: R$ 4.800.000,00 anuais
   * - Quem fatura até R$ 3.600.000,00/ano no Simples possui redução de 50% no IBS/CBS durante a transição
   *   se optar por apurar no regime misto/híbrido até 2032.
   * - Possibilidade de permanecer no Simples até 2032 ou optar pelo regime regular de IBS/CBS gerando crédito pleno aos clientes.
   */
  simplesNacional: {
    sublimiteTransicional: 3600000, // R$ 3.600.000 / ano
    tetoMaximoSimples: 4800000, // R$ 4.800.000 / ano
    descontoTransicaoSimplesSublimite: 0.5, // 50% de redução na transição
  },

  /**
   * Calendário oficial da transição ano a ano (2026 a 2033)
   * Fundamentação:
   * - 2026: Ano de teste (CBS 0,9% + IBS 0,1% = 1,0%, compensáveis com PIS/COFINS)
   * - 2027: CBS entra integralmente (~8,8%), PIS e COFINS extintos, IPI zerado na maioria; IBS 0,1%
   * - 2028: Transição preparatória com CBS plena e IBS 0,1%
   * - 2029: Início da graduação do IBS (art. 128 ADCT): 10% do IBS pleno (1/10) e redução de 1/10 do ICMS/ISS (permanece 90%)
   * - 2030: IBS 20% do pleno (2/10); ICMS/ISS em 80% (8/10)
   * - 2031: IBS 30% do pleno (3/10); ICMS/ISS em 70% (7/10)
   * - 2032: IBS 40% do pleno (4/10); ICMS/ISS em 60% (6/10)
   *   *Nota: em 2032 encerra-se a fase transitória de benefícios estaduais e do Simples 50%
   * - 2033: Regime pleno final. Extinção completa de ICMS, ISS, PIS e COFINS. IBS 100% (~17,7%) e CBS 100% (~8,8%).
   */
  calendarioTransicao: [
    {
      ano: 2026,
      descricao: 'Período de Teste e Calibração',
      fase: 'teste',
      aliquotaCBS: 0.9,
      aliquotaIBS: 0.1,
      fatorTributosAntigos: 1.0, // 100% dos tributos atuais mantidos, com recolhimento compensável
      fatorIBSGraduacao: 0.0,
      testeCompensavel: true,
    },
    {
      ano: 2027,
      descricao: 'Entrada Plena da CBS e Extinção do PIS/COFINS',
      fase: 'cbs_plena',
      aliquotaCBS: 8.8,
      aliquotaIBS: 0.1,
      fatorTributosAntigos: 1.0, // ICMS e ISS continuam 100%; PIS/COFINS extintos
      fatorIBSGraduacao: 0.0,
    },
    {
      ano: 2028,
      descricao: 'CBS Integral e Preparação de Sistemas IBS',
      fase: 'cbs_plena',
      aliquotaCBS: 8.8,
      aliquotaIBS: 0.1,
      fatorTributosAntigos: 1.0,
      fatorIBSGraduacao: 0.0,
    },
    {
      ano: 2029,
      descricao: 'Graduação do IBS (10%) e Redução de 10% no ICMS/ISS',
      fase: 'graduacao',
      aliquotaCBS: 8.8,
      aliquotaIBS: 1.77, // 10% de 17.7%
      fatorTributosAntigos: 0.9, // 90% mantido de ICMS/ISS
      fatorIBSGraduacao: 0.1,
    },
    {
      ano: 2030,
      descricao: 'Graduação do IBS (20%) e Redução de 20% no ICMS/ISS',
      fase: 'graduacao',
      aliquotaCBS: 8.8,
      aliquotaIBS: 3.54, // 20% de 17.7%
      fatorTributosAntigos: 0.8, // 80% mantido de ICMS/ISS
      fatorIBSGraduacao: 0.2,
    },
    {
      ano: 2031,
      descricao: 'Graduação do IBS (30%) e Redução de 30% no ICMS/ISS',
      fase: 'graduacao',
      aliquotaCBS: 8.8,
      aliquotaIBS: 5.31, // 30% de 17.7%
      fatorTributosAntigos: 0.7, // 70% mantido de ICMS/ISS
      fatorIBSGraduacao: 0.3,
    },
    {
      ano: 2032,
      descricao: 'Último ano transitório do IBS (40%) e 60% de ICMS/ISS',
      fase: 'graduacao',
      aliquotaCBS: 8.8,
      aliquotaIBS: 7.08, // 40% de 17.7%
      fatorTributosAntigos: 0.6, // 60% mantido de ICMS/ISS
      fatorIBSGraduacao: 0.4,
    },
    {
      ano: 2033,
      descricao: 'Vigência Plena do IVA Dual (IBS + CBS)',
      fase: 'pleno',
      aliquotaCBS: 8.8,
      aliquotaIBS: 17.7,
      fatorTributosAntigos: 0.0, // Extinção total de ICMS, ISS, PIS e COFINS
      fatorIBSGraduacao: 1.0,
    },
  ] as ParametrosAnoTransicao[],
}

export type SetorAtividade =
  | 'servicos_geral'
  | 'servicos_educacao'
  | 'servicos_saude'
  | 'dispositivos_medicos'
  | 'agropecuaria_insumos'
  | 'transporte_coletivo'
  | 'comercio_geral'
  | 'industria_transformacao'
  | 'tecnologia_software'

export interface SetorConfig {
  id: SetorAtividade
  nome: string
  reducao60: boolean
  descricao: string
  aliquotaAtualEstimadaPresumido: number
  aliquotaAtualEstimadaReal: number
  percentualCreditosInsumosPadrao: number
}

export const SETORES_CONFIG: Record<SetorAtividade, SetorConfig> = {
  servicos_geral: {
    id: 'servicos_geral',
    nome: 'Serviços em Geral / Consultoria / BPO',
    reducao60: false,
    descricao: 'Prestação de serviços comum, sem regime favorecido específico.',
    aliquotaAtualEstimadaPresumido: 14.53, // ISS 5% + PIS 0,65% + COFINS 3% + IRPJ/CSLL ~5,88%
    aliquotaAtualEstimadaReal: 16.5,
    percentualCreditosInsumosPadrao: 15,
  },
  servicos_educacao: {
    id: 'servicos_educacao',
    nome: 'Serviços Educacionais (Escolas, Faculdades, Cursos Técnicos)',
    reducao60: true,
    descricao:
      'Redução de 60% da alíquota de referência de IBS/CBS prevista no art. 9º da EC 132/23 e LC 214/25.',
    aliquotaAtualEstimadaPresumido: 12.0,
    aliquotaAtualEstimadaReal: 14.0,
    percentualCreditosInsumosPadrao: 20,
  },
  servicos_saude: {
    id: 'servicos_saude',
    nome: 'Serviços de Saúde Humana (Clínicas, Hospitais, Laboratórios)',
    reducao60: true,
    descricao: 'Redução de 60% do IBS/CBS para procedimentos médicos e hospitalares.',
    aliquotaAtualEstimadaPresumido: 11.5,
    aliquotaAtualEstimadaReal: 13.5,
    percentualCreditosInsumosPadrao: 25,
  },
  dispositivos_medicos: {
    id: 'dispositivos_medicos',
    nome: 'Dispositivos Médicos e de Acessibilidade',
    reducao60: true,
    descricao: 'Redução de 60% na comercialização de equipamentos médicos e próteses.',
    aliquotaAtualEstimadaPresumido: 15.0,
    aliquotaAtualEstimadaReal: 18.0,
    percentualCreditosInsumosPadrao: 45,
  },
  agropecuaria_insumos: {
    id: 'agropecuaria_insumos',
    nome: 'Insumos Agropecuários e Alimentos In Natura',
    reducao60: true,
    descricao: 'Redução de 60% sobre insumos agropecuários e aquícolas.',
    aliquotaAtualEstimadaPresumido: 8.5,
    aliquotaAtualEstimadaReal: 11.0,
    percentualCreditosInsumosPadrao: 50,
  },
  transporte_coletivo: {
    id: 'transporte_coletivo',
    nome: 'Transporte Coletivo de Passageiros',
    reducao60: true,
    descricao: 'Redução de 60% em transporte coletivo rodoviário e metroviário.',
    aliquotaAtualEstimadaPresumido: 9.0,
    aliquotaAtualEstimadaReal: 12.0,
    percentualCreditosInsumosPadrao: 40,
  },
  comercio_geral: {
    id: 'comercio_geral',
    nome: 'Comércio Varejista e Atacadista Geral',
    reducao60: false,
    descricao:
      'Venda de mercadorias no regime geral (com alto volume de apropriação de créditos de entrada).',
    aliquotaAtualEstimadaPresumido: 16.0,
    aliquotaAtualEstimadaReal: 21.0,
    percentualCreditosInsumosPadrao: 65,
  },
  industria_transformacao: {
    id: 'industria_transformacao',
    nome: 'Indústria e Manufatura',
    reducao60: false,
    descricao:
      'Transformação industrial, com apropriação de créditos de insumos, energia e maquinário.',
    aliquotaAtualEstimadaPresumido: 18.0,
    aliquotaAtualEstimadaReal: 24.0,
    percentualCreditosInsumosPadrao: 70,
  },
  tecnologia_software: {
    id: 'tecnologia_software',
    nome: 'Tecnologia da Informação & Licenciamento de Software',
    reducao60: false,
    descricao:
      'Desenvolvimento e SaaS. Baixa geração de créditos físicos, folha não gera crédito de IBS/CBS.',
    aliquotaAtualEstimadaPresumido: 14.53,
    aliquotaAtualEstimadaReal: 17.0,
    percentualCreditosInsumosPadrao: 18,
  },
}

/**
 * Alíquota efetiva padrão do Simples Nacional sugerida por faturamento anual e setor
 */
export function estimarAliquotaSimplesNacional(
  faturamentoAnual: number,
  setor: SetorAtividade,
): number {
  if (faturamentoAnual <= 180000) return 4.0
  if (faturamentoAnual <= 360000) return 6.5
  if (faturamentoAnual <= 720000) return 9.5
  if (faturamentoAnual <= 1800000) return 12.0
  if (faturamentoAnual <= 3600000) return 14.5
  return 17.5 // Entre 3.6M e 4.8M
}

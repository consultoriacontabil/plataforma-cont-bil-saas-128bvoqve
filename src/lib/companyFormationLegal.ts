/**
 * Base de conhecimento legal e regulatória para abertura de empresas no Brasil
 * Marco Legal atualizado: Código Civil (Lei 10.406/2002 c/ Lei 13.874/2019 e Lei 14.195/2021),
 * LC 123/2006 (MEI/Simples), Lei 6.404/76 (S/A), Lei 6.839/80 (Conselhos de Classe),
 * e normas do DREI / Redesim.
 */

import type { NaturezaJuridicaTipo, CnaeItem, EtapaPipelineItem, ChecklistDocItem } from '@/types'

export interface NaturezaInfo {
  tipo: NaturezaJuridicaTipo
  nome: string
  sigla: string
  fundamentoLegal: string
  descricao: string
  sociosMinimos: number
  sociosMaximos?: number
  responsabilidadeLimitada: boolean
  capitalSocialMinimoTexto: string
  permiteSimples: boolean
  permiteSimei: boolean
  alertaLegal?: string
  orgaoRegistroPrincipal:
    | 'Junta Comercial'
    | 'Cartório de Registro Civil (RCPJ)'
    | 'Portal do Empreendedor'
}

export const NATUREZAS_JURIDICAS: Record<NaturezaJuridicaTipo, NaturezaInfo> = {
  slu: {
    tipo: 'slu',
    nome: 'Sociedade Limitada Unipessoal',
    sigla: 'SLU',
    fundamentoLegal:
      'Código Civil, art. 982, parágrafo único e art. 1.052, §§ 1º e 2º (incluídos pela Lei da Liberdade Econômica nº 13.874/2019)',
    descricao:
      'Sociedade constituída por uma única pessoa física ou jurídica. O patrimônio pessoal do titular fica blindado e separado do patrimônio da empresa (responsabilidade limitada ao capital social), sem exigência de capital mínimo.',
    sociosMinimos: 1,
    sociosMaximos: 1,
    responsabilidadeLimitada: true,
    capitalSocialMinimoTexto:
      'Sem valor mínimo por lei (sugere-se valor condizente com a atividade, ex.: R$ 1.000 a R$ 10.000).',
    permiteSimples: true,
    permiteSimei: false,
    orgaoRegistroPrincipal: 'Junta Comercial',
  },
  ltda: {
    tipo: 'ltda',
    nome: 'Sociedade Empresária Limitada (Pluripessoal)',
    sigla: 'LTDA',
    fundamentoLegal:
      'Código Civil, arts. 1.052 a 1.087 e Instruções Normativas DREI nº 81/2020 e 112/2022',
    descricao:
      'Formada por dois ou mais sócios (pessoas físicas ou jurídicas). A responsabilidade de cada sócio é restrita ao valor de suas quotas, mas todos respondem solidariamente pela integralização do capital social.',
    sociosMinimos: 2,
    responsabilidadeLimitada: true,
    capitalSocialMinimoTexto:
      'Sem valor mínimo legal. O capital deve ser dividido em quotas e subscrito/integralizado conforme o contrato social.',
    permiteSimples: true,
    permiteSimei: false,
    orgaoRegistroPrincipal: 'Junta Comercial',
  },
  mei: {
    tipo: 'mei',
    nome: 'Microempreendedor Individual',
    sigla: 'MEI',
    fundamentoLegal: 'Lei Complementar nº 123/2006 (art. 18-A a 18-E) e Resoluções CGSN',
    descricao:
      'Empresário individual com teto de faturamento de até R$ 81.000,00 anuais (proporcional no ano de abertura: R$ 6.750/mês). Não pode ter sócios nem participar como sócio/administrador de outra empresa. Permite contratar no máximo 1 empregado recebendo salário mínimo ou piso da categoria.',
    sociosMinimos: 1,
    sociosMaximos: 1,
    responsabilidadeLimitada: false,
    capitalSocialMinimoTexto: 'Sem capital mínimo (declaratório).',
    permiteSimples: true,
    permiteSimei: true,
    alertaLegal:
      'Atenção: O MEI responde com patrimônio pessoal ilimitadamente pelas obrigações empresariais. Profissões regulamentadas (médicos, advogados, contadores, engenheiros, dentistas) são legalmente impedidas de optar pelo MEI.',
    orgaoRegistroPrincipal: 'Portal do Empreendedor',
  },
  ei: {
    tipo: 'ei',
    nome: 'Empresário Individual',
    sigla: 'EI',
    fundamentoLegal: 'Código Civil, arts. 966 a 980',
    descricao:
      'A pessoa física exerce a atividade empresarial em nome próprio. Não há separação patrimonial: os bens pessoais do titular respondem pelas dívidas da empresa de forma ilimitada.',
    sociosMinimos: 1,
    sociosMaximos: 1,
    responsabilidadeLimitada: false,
    capitalSocialMinimoTexto: 'Sem capital mínimo legal.',
    permiteSimples: true,
    permiteSimei: false,
    alertaLegal:
      'Risco patrimonial elevado: não há escudo protetor entre os bens particulares e as dívidas da empresa.',
    orgaoRegistroPrincipal: 'Junta Comercial',
  },
  eireli_extinta: {
    tipo: 'eireli_extinta',
    nome: 'EIRELI (Extinta por Lei — Transformação Obrigatória)',
    sigla: 'EIRELI (Extinta)',
    fundamentoLegal:
      'Art. 41 da Lei nº 14.195/2021 c/ LC nº 166/2019 e Ofício Circular DREI nº 351/2021',
    descricao:
      'A figura da EIRELI foi legalmente EXTINTA pelo art. 41 da Lei nº 14.195/2021. As empresas existentes foram compulsoriamente transformadas em SLU (Sociedade Limitada Unipessoal) pelas Juntas Comerciais.',
    sociosMinimos: 1,
    sociosMaximos: 1,
    responsabilidadeLimitada: true,
    capitalSocialMinimoTexto: 'Antiga exigência de 100 salários mínimos não mais aplicável.',
    permiteSimples: true,
    permiteSimei: false,
    alertaLegal:
      'AVISO LEGAL IMPORTANTE: A EIRELI foi formalmente extinta pela Lei 14.195/2021. Não é mais permitido registrar nova EIRELI no Brasil. Selecione SLU (Sociedade Limitada Unipessoal).',
    orgaoRegistroPrincipal: 'Junta Comercial',
  },
  sa_fechada: {
    tipo: 'sa_fechada',
    nome: 'Sociedade Anônima de Capital Fechado',
    sigla: 'S/A Fechada',
    fundamentoLegal:
      'Lei das Sociedades por Ações nº 6.404/1976 e Lei nº 13.818/2019 (publicações digitais)',
    descricao:
      'Capital dividido em ações. As ações não são negociadas em bolsa de valores ou balcão organizado. Indicada para empresas que buscam captação com investidores ou governança estruturada.',
    sociosMinimos: 2,
    responsabilidadeLimitada: true,
    capitalSocialMinimoTexto:
      'Pelo menos 10% do capital social emitido em dinheiro deve ser realizado mediante depósito bancário (art. 80, II da Lei 6.404/76).',
    permiteSimples: false,
    permiteSimei: false,
    alertaLegal:
      'S/A não pode optar pelo Simples Nacional (art. 3º, § 4º, I da LC 123/2006). Sujeita a regras de governança e demonstrações financeiras formais.',
    orgaoRegistroPrincipal: 'Junta Comercial',
  },
  sa_aberta: {
    tipo: 'sa_aberta',
    nome: 'Sociedade Anônima de Capital Aberto',
    sigla: 'S/A Aberta',
    fundamentoLegal: 'Lei nº 6.404/1976 e Lei nº 6.385/1976 (Mercado de Capitais / CVM)',
    descricao:
      'Ações negociadas no mercado de capitais / B3, sob regulamentação e fiscalização da CVM (Comissão de Valores Mobiliários).',
    sociosMinimos: 2,
    responsabilidadeLimitada: true,
    capitalSocialMinimoTexto: 'Exigência de registro prévio na CVM e depósito legal inicial.',
    permiteSimples: false,
    permiteSimei: false,
    alertaLegal:
      'Exclusiva para grandes corporações com auditoria independente obrigatória (CVM/CFC).',
    orgaoRegistroPrincipal: 'Junta Comercial',
  },
  sociedade_simples_pura: {
    tipo: 'sociedade_simples_pura',
    nome: 'Sociedade Simples Pura',
    sigla: 'SS Pura',
    fundamentoLegal: 'Código Civil, arts. 997 a 1.038',
    descricao:
      'Destinada a pessoas que exercem profissão intelectual, de natureza científica, literária ou artística (ex.: médicos, engenheiros, advogados, contadores). Não exerce atividade mercantil nem empresária.',
    sociosMinimos: 2,
    responsabilidadeLimitada: false,
    capitalSocialMinimoTexto: 'Sem capital mínimo legal.',
    permiteSimples: true,
    permiteSimei: false,
    alertaLegal:
      'Na Sociedade Simples Pura, os sócios respondem ilimitadamente e subsidiariamente pelas obrigações sociais caso o patrimônio da sociedade se esgote (art. 1.023 CC). Registrada no RCPJ ou na OAB (para advocacia).',
    orgaoRegistroPrincipal: 'Cartório de Registro Civil (RCPJ)',
  },
  sociedade_simples_ltda: {
    tipo: 'sociedade_simples_ltda',
    nome: 'Sociedade Simples Limitada',
    sigla: 'SS LTDA',
    fundamentoLegal: 'Código Civil, art. 983 c/ art. 1.052 a 1.087',
    descricao:
      'Sociedade simples de profissionais intelectuais que adota o tipo societário da Limitada. O registro é efetuado no Cartório de Registro Civil de Pessoas Jurídicas (RCPJ) ou OAB, e os bens particulares dos sócios ficam protegidos.',
    sociosMinimos: 2,
    responsabilidadeLimitada: true,
    capitalSocialMinimoTexto: 'Sem capital mínimo legal.',
    permiteSimples: true,
    permiteSimei: false,
    orgaoRegistroPrincipal: 'Cartório de Registro Civil (RCPJ)',
  },
  associacao: {
    tipo: 'associacao',
    nome: 'Associação Privada (Sem Fins Lucrativos)',
    sigla: 'Associação',
    fundamentoLegal: 'Código Civil, arts. 53 a 61',
    descricao:
      'União de pessoas que se organizam para fins não econômicos (culturais, esportivos, beneficentes, profissionais, de classe). Não há sócios, mas associados; os resultados são integralmente reinvestidos no objetivo social.',
    sociosMinimos: 2,
    responsabilidadeLimitada: true,
    capitalSocialMinimoTexto:
      'Não possui capital social (possui patrimônio social formado por doações/anuidades).',
    permiteSimples: false,
    permiteSimei: false,
    orgaoRegistroPrincipal: 'Cartório de Registro Civil (RCPJ)',
  },
}

/**
 * Mapeamento de grupos de CNAE e conselhos de classe obrigatórios
 * Regra legal: Lei nº 6.839/1980 (art. 1º) — O registro de empresas e a anotação dos
 * profissionais legalmente habilitados, delas encarregados, serão obrigatórios nas entidades
 * competentes para a fiscalização do exercício das diversas profissões, em razão da atividade básica.
 */
export interface RegraConselhoCnae {
  prefixo: string // ex: "86", "69", "71"
  orgaoClasse: string
  siglaConselho: string
  fundamento: string
  impedidoMei: boolean
  anexoPadraoSimples: string
  observacao: string
}

export const REGRAS_CNAE_CONSELHOS: RegraConselhoCnae[] = [
  {
    prefixo: '8610',
    orgaoClasse: 'Conselho Regional de Medicina (CRM) e Vigilância Sanitária',
    siglaConselho: 'CRM',
    fundamento: 'Lei 3.268/57 e Lei 6.839/80 c/ Resoluções CFM',
    impedidoMei: true,
    anexoPadraoSimples: 'Anexo III ou V (Fator R)',
    observacao:
      'Atividades de atendimento hospitalar e pronto-socorro. Exige RT médico com CRM ativo.',
  },
  {
    prefixo: '8630',
    orgaoClasse: 'Conselho Regional de Medicina (CRM) ou Odontologia (CRO)',
    siglaConselho: 'CRM / CRO',
    fundamento: 'Lei 3.268/57 (CRM), Lei 4.324/64 (CRO) e Lei 6.839/80',
    impedidoMei: true,
    anexoPadraoSimples: 'Anexo III ou V (Fator R)',
    observacao:
      'Consultórios médicos e odontológicos. Exige registro de PJ no CRM/CRO e alvará sanitário.',
  },
  {
    prefixo: '8640',
    orgaoClasse: 'CRM / CRF / CRBM e Vigilância Sanitária Municipal/Estadual',
    siglaConselho: 'CRM / CRF / CRBM',
    fundamento: 'Lei 6.839/80 e RDC Anvisa 50/2002',
    impedidoMei: true,
    anexoPadraoSimples: 'Anexo III ou V',
    observacao: 'Laboratórios de análises clínicas e diagnóstico por imagem. Exige RT qualificado.',
  },
  {
    prefixo: '8650',
    orgaoClasse: 'Conselho Regional da Profissão (CREFITO, CRP, CRN, CRFa)',
    siglaConselho: 'CREFITO/CRP/CRN/CRFa',
    fundamento: 'Leis federais de regulamentação das profissões de saúde e Lei 6.839/80',
    impedidoMei: true,
    anexoPadraoSimples: 'Anexo III ou V (Fator R)',
    observacao: 'Fisioterapia, psicologia, nutrição, fonoaudiologia, terapia ocupacional.',
  },
  {
    prefixo: '8690',
    orgaoClasse: 'Vigilância Sanitária e Conselhos de Saúde correlatos',
    siglaConselho: 'VISA / CR',
    fundamento: 'Lei 6.839/80 e legislação sanitária local',
    impedidoMei: false,
    anexoPadraoSimples: 'Anexo III',
    observacao: 'Outras atividades de atenção à saúde humana (conferir atividade específica).',
  },
  {
    prefixo: '6911',
    orgaoClasse: 'Ordem dos Advogados do Brasil (OAB)',
    siglaConselho: 'OAB',
    fundamento: 'Estatuto da Advocacia (Lei nº 8.906/1994, arts. 15 a 17)',
    impedidoMei: true,
    anexoPadraoSimples: 'Anexo IV',
    observacao:
      'ATENÇÃO LEGAL: Sociedades de advogados (unipessoais ou pluripessoais) NÃO são registradas na Junta Comercial nem no RCPJ. O registro é exclusivo na Seccional da OAB competente.',
  },
  {
    prefixo: '6920',
    orgaoClasse: 'Conselho Regional de Contabilidade (CRC)',
    siglaConselho: 'CRC',
    fundamento: 'Decreto-Lei nº 9.295/1946 e Resolução CFC nº 1.555/2018',
    impedidoMei: true,
    anexoPadraoSimples: 'Anexo III',
    observacao:
      'Atividades de contabilidade, auditoria e perícia contábil. Exige sócio/RT contador registrado.',
  },
  {
    prefixo: '7111',
    orgaoClasse: 'Conselho de Arquitetura e Urbanismo (CAU)',
    siglaConselho: 'CAU',
    fundamento: 'Lei nº 12.378/2010 e Lei 6.839/80',
    impedidoMei: true,
    anexoPadraoSimples: 'Anexo III ou V (Fator R)',
    observacao: 'Serviços de arquitetura e urbanismo. Exige registro de PJ no CAU.',
  },
  {
    prefixo: '7112',
    orgaoClasse: 'Conselho Regional de Engenharia e Agronomia (CREA)',
    siglaConselho: 'CREA',
    fundamento: 'Lei nº 5.194/1966 e Lei 6.839/80',
    impedidoMei: true,
    anexoPadraoSimples: 'Anexo III ou V (Fator R)',
    observacao:
      'Serviços de engenharia. Exige Anotação de Responsabilidade Técnica (ART) e registro de PJ no CREA.',
  },
  {
    prefixo: '7020',
    orgaoClasse: 'Conselho Regional de Administração (CRA)',
    siglaConselho: 'CRA',
    fundamento: 'Lei nº 4.769/1965 e Lei 6.839/80',
    impedidoMei: true,
    anexoPadraoSimples: 'Anexo III ou V (Fator R)',
    observacao:
      'Consultoria em gestão empresarial. Pode ser exigido registro no CRA conforme o objeto social.',
  },
  {
    prefixo: '7500',
    orgaoClasse: 'Conselho Regional de Medicina Veterinária (CRMV)',
    siglaConselho: 'CRMV',
    fundamento: 'Lei nº 5.517/1968 e Lei 6.839/80',
    impedidoMei: true,
    anexoPadraoSimples: 'Anexo III',
    observacao: 'Atividades veterinárias e clínicas para animais. Exige RT veterinário registrado.',
  },
  {
    prefixo: '6821',
    orgaoClasse: 'Conselho Regional de Corretores de Imóveis (CRECI)',
    siglaConselho: 'CRECI',
    fundamento: 'Lei nº 6.530/1978 e Decreto 81.871/78',
    impedidoMei: true,
    anexoPadraoSimples: 'Anexo III',
    observacao: 'Intermediação imobiliária e corretagem. Exige registro da imobiliária no CRECI.',
  },
  {
    prefixo: '6201',
    orgaoClasse: 'Não há conselho obrigatório (CRA ou CREA facultativo)',
    siglaConselho: 'Sem conselho',
    fundamento: 'Profissão não regulamentada por conselho específico',
    impedidoMei: true, // Desenvolvimento de software não é permitido no MEI
    anexoPadraoSimples: 'Anexo III ou V (Fator R)',
    observacao: 'Desenvolvimento de programas de computador sob encomenda. Não permitido como MEI.',
  },
  {
    prefixo: '6202',
    orgaoClasse: 'Sem conselho de classe obrigatório',
    siglaConselho: 'Sem conselho',
    fundamento: 'Profissão não regulamentada',
    impedidoMei: true,
    anexoPadraoSimples: 'Anexo III ou V (Fator R)',
    observacao: 'Desenvolvimento e customização de programas customizáveis.',
  },
  {
    prefixo: '6209',
    orgaoClasse: 'Sem conselho de classe obrigatório',
    siglaConselho: 'Sem conselho',
    fundamento: 'Profissão não regulamentada',
    impedidoMei: true,
    anexoPadraoSimples: 'Anexo III ou V (Fator R)',
    observacao: 'Suporte técnico, manutenção e outros serviços em tecnologia da informação.',
  },
  {
    prefixo: '47',
    orgaoClasse: 'Não exige conselho (salvo produtos controlados/farmácia CRF)',
    siglaConselho: 'Órgão sanitário/bombeiros',
    fundamento: 'Comércio varejista em geral',
    impedidoMei: false,
    anexoPadraoSimples: 'Anexo I (Comércio)',
    observacao:
      'Comércio varejista. Verificar se a mercadoria é permitida na lista de ocupações do MEI.',
  },
  {
    prefixo: '56',
    orgaoClasse: 'Vigilância Sanitária Municipal e Corpo de Bombeiros',
    siglaConselho: 'VISA / Bombeiros',
    fundamento: 'RDC 216/2004 Anvisa e Lei 13.425/2017 (Lei Kiss)',
    impedidoMei: false,
    anexoPadraoSimples: 'Anexo I ou Anexo III',
    observacao: 'Alimentação, restaurantes e bares. Exige vistoria e alvará sanitário rigoroso.',
  },
]

/**
 * Analisa um código CNAE e retorna metadados de conselho, MEI e Simples
 */
export function analisarCnae(codigoRaw: string): {
  codigoFormatado: string
  exigeConselho: boolean
  orgaoRegistro: string
  siglaConselho: string
  fundamento: string
  impedidoMei: boolean
  anexoSimples: string
  observacao: string
} {
  const digits = codigoRaw.replace(/\D/g, '')
  // Formatar para 0000-0/00
  let formatado = digits
  if (digits.length >= 7) {
    formatado = `${digits.slice(0, 4)}-${digits.slice(4, 5)}/${digits.slice(5, 7)}`
  }

  // Buscar regra mais específica
  for (const regra of REGRAS_CNAE_CONSELHOS) {
    const limpoPrefixo = regra.prefixo.replace(/\D/g, '')
    if (digits.startsWith(limpoPrefixo)) {
      return {
        codigoFormatado: formatado,
        exigeConselho:
          regra.siglaConselho !== 'Sem conselho' && !regra.siglaConselho.includes('sanitário'),
        orgaoRegistro: regra.orgaoClasse,
        siglaConselho: regra.siglaConselho,
        fundamento: regra.fundamento,
        impedidoMei: regra.impedidoMei,
        anexoSimples: regra.anexoPadraoSimples,
        observacao: regra.observacao,
      }
    }
  }

  return {
    codigoFormatado: formatado,
    exigeConselho: false,
    orgaoRegistro: 'Licenciamento comum (Prefeitura / Bombeiros)',
    siglaConselho: 'Nenhum',
    fundamento: 'Legislação municipal e estadual ordinária',
    impedidoMei: false,
    anexoSimples: 'Anexo III (Serviço) ou I (Comércio)',
    observacao: 'Atividade sem órgão de classe específico identificado previamente.',
  }
}

/**
 * Gera template de etapas do pipeline de abertura padrão brasileiro
 */
export function gerarTemplateEtapas(): EtapaPipelineItem[] {
  return [
    {
      id: 'etapa_1',
      nome: '1. Consulta Prévia de Viabilidade & Endereço (Prefeitura)',
      status: 'pendente',
      observacao:
        'Verificação locacional de zoneamento urbano e uso do solo na Prefeitura Municipal.',
    },
    {
      id: 'etapa_2',
      nome: '2. Pesquisa e Reserva de Nome Empresarial (Junta Comercial/Redesim)',
      status: 'pendente',
      observacao: 'Garante exclusividade da firma ou denominação social no âmbito estadual.',
    },
    {
      id: 'etapa_3',
      nome: '3. Elaboração e Assinatura do Ato Constitutivo (Contrato Social / Requerimento)',
      status: 'pendente',
      observacao:
        'Minuta com cláusulas obrigatórias (CC arts. 997 e 1.054) assinada via certificado digital ou GOV.BR.',
    },
    {
      id: 'etapa_4',
      nome: '4. Protocolo e Registro na Junta Comercial / RCPJ (DBE Redesim)',
      status: 'pendente',
      observacao:
        'Geração do DBE na Receita Federal, emissão de DARE/taxa e protocolo na Junta Comercial.',
    },
    {
      id: 'etapa_5',
      nome: '5. Obtenção do CNPJ, Inscrição Estadual (SEFAZ) e CCM Municipal',
      status: 'pendente',
      observacao:
        'Liberação do cartão CNPJ ativo e geração do Cadastro de Contribuintes Mobiliários da Prefeitura.',
    },
    {
      id: 'etapa_6',
      nome: '6. Registro em Órgão de Classe / Licenciamento & Alvarás (CRM, CREA, VISA etc.)',
      status: 'pendente',
      observacao:
        'Protocolo de registro da pessoa jurídica no conselho competente e liberação de alvarás de funcionamento.',
    },
    {
      id: 'etapa_7',
      nome: '7. Opção pelo Enquadramento Tributário (Simples Nacional / Simei)',
      status: 'pendente',
      observacao:
        'Prazo fatal de 30 dias contados do último deferimento de inscrição (art. 6º, § 5º da Res. CGSN 140/2018).',
    },
    {
      id: 'etapa_8',
      nome: '8. Abertura de Contas Bancárias PJ & Emissão do Certificado Digital e-CNPJ A1',
      status: 'pendente',
      observacao:
        'Finalização operacional, emissão do certificado digital contábil e início das movimentações.',
    },
  ]
}

/**
 * Gera template de checklist de documentos adaptado à natureza jurídica e particularidades
 */
export function gerarTemplateChecklist(
  natureza: NaturezaJuridicaTipo,
  temSocioEstrangeiro = false,
  temMenorRepresentado = false,
): ChecklistDocItem[] {
  const docs: ChecklistDocItem[] = [
    // 1. Documentos pessoais dos sócios
    {
      id: 'doc_pessoal_socios',
      categoria: 'socios',
      titulo: 'Documento de Identificação Oficial dos Sócios (RG/CNH + CPF)',
      obrigatorio: true,
      status: 'pendente',
      detalhe:
        'Cópia autenticada ou documento digital com validação QR Code (GOV.BR / CNH Digital).',
    },
    {
      id: 'doc_residencia_socios',
      categoria: 'socios',
      titulo: 'Comprovante de Residência dos Sócios (recente, máx. 90 dias)',
      obrigatorio: true,
      status: 'pendente',
      detalhe: 'Conta de água, luz, gás ou telefone em nome do sócio ou declaração de residência.',
    },
    // 2. Imóvel sede
    {
      id: 'doc_imovel_iptu',
      categoria: 'empresa',
      titulo: 'Carnê do IPTU do Imóvel Sede (Folha com nº de inscrição imobiliária)',
      obrigatorio: true,
      status: 'pendente',
      detalhe: 'Utilizado para preenchimento da viabilidade municipal e cálculo de zoneamento.',
    },
    {
      id: 'doc_locacao_imovel',
      categoria: 'empresa',
      titulo: 'Contrato de Locação Comercial, Comodato ou Escritura do Imóvel',
      obrigatorio: false,
      status: 'pendente',
      detalhe: 'Comprovando a autorização de uso do endereço para atividades empresariais.',
    },
    // 3. Viabilidade
    {
      id: 'doc_viabilidade',
      categoria: 'viabilidade',
      titulo: 'Consulta Prévia de Viabilidade Aprovada (Prefeitura / Redesim)',
      obrigatorio: true,
      status: 'pendente',
      detalhe: 'Resultado favorável da análise locacional e de nome comercial.',
    },
    // 4. Certidões dos sócios
    {
      id: 'doc_certidoes_socios',
      categoria: 'socios',
      titulo: 'Certidões de Distribuição Cível e Criminal da Justiça Federal e Estadual',
      obrigatorio: false,
      status: 'pendente',
      detalhe:
        'Para comprovar inexistência de impedimentos legais ao exercício da atividade empresarial (art. 1.011 CC).',
    },
  ]

  // Adaptações por natureza jurídica
  if (natureza === 'mei') {
    docs.push({
      id: 'doc_ccmei',
      categoria: 'mercantil',
      titulo: 'Certificado da Condição de Microempreendedor Individual (CCMEI)',
      obrigatorio: true,
      status: 'pendente',
      detalhe: 'Documento oficial comprobatório gerado pelo Portal do Empreendedor após inscrição.',
    })
  } else if (natureza === 'slu' || natureza === 'ltda' || natureza === 'sociedade_simples_ltda') {
    docs.push(
      {
        id: 'doc_contrato_social',
        categoria: 'societario',
        titulo:
          natureza === 'slu'
            ? 'Ato Constitutivo Unipessoal (Contrato Social SLU)'
            : 'Contrato Social de Constituição',
        obrigatorio: true,
        status: 'pendente',
        detalhe:
          'Minuta completa com qualificação dos sócios, objeto social, capital, administração e foro.',
      },
      {
        id: 'doc_dbe_fci',
        categoria: 'mercantil',
        titulo: 'DBE (Documento Básico de Entrada) e Capa de Processo / FCN',
        obrigatorio: true,
        status: 'pendente',
        detalhe:
          'Transmitido via Coletor Nacional da Receita Federal com direcionamento à Junta Comercial.',
      },
      {
        id: 'doc_recibo_dare',
        categoria: 'mercantil',
        titulo: 'Comprovante de Pagamento da Taxa da Junta Comercial (DARE / Guia Estadual)',
        obrigatorio: true,
        status: 'pendente',
        detalhe: 'Taxa mercantil estadual para protocolo e arquivamento do ato.',
      },
    )
  } else if (natureza === 'sa_fechada' || natureza === 'sa_aberta') {
    docs.push(
      {
        id: 'doc_estatuto_social',
        categoria: 'societario',
        titulo: 'Estatuto Social e Ata da Assembleia Geral de Constituição',
        obrigatorio: true,
        status: 'pendente',
        detalhe: 'Documento fundamental nos termos da Lei 6.404/76.',
      },
      {
        id: 'doc_deposito_bancario_sa',
        categoria: 'societario',
        titulo: 'Comprovante de Depósito Bancário Inicial de 10% do Capital em Dinheiro',
        obrigatorio: true,
        status: 'pendente',
        detalhe:
          'Exigência expressa do art. 80, II da Lei das S/A (depósito em instituição financeira oficial).',
      },
    )
  }

  // Particularidades: Sócio Estrangeiro
  if (temSocioEstrangeiro) {
    docs.push(
      {
        id: 'doc_procuracao_estrangeiro',
        categoria: 'socios',
        titulo: 'Procuração Pública para Representante Legal Residente no Brasil',
        obrigatorio: true,
        status: 'pendente',
        detalhe:
          'Com poderes expressos para receber citação em juízo e administrar bens (art. 1.011 c/ Lei 14.195/21).',
      },
      {
        id: 'doc_rde_ied_bcb',
        categoria: 'socios',
        titulo:
          'Registro Declaratório Eletrônico de Investimento Estrangeiro (RDE-IED / Banco Central)',
        obrigatorio: true,
        status: 'pendente',
        detalhe:
          'Registro obrigatório no Bacen para capital social integralizado por não-residentes.',
      },
      {
        id: 'doc_passaporte_traduzido',
        categoria: 'socios',
        titulo: 'Passaporte com Apostilamento de Haia e Tradução Juramentada',
        obrigatorio: true,
        status: 'pendente',
        detalhe:
          'Documento original apostilado no país de origem e registrado em Cartório de Títulos e Documentos (RTD).',
      },
    )
  }

  // Particularidades: Menor de idade ou representado
  if (temMenorRepresentado) {
    docs.push({
      id: 'doc_representacao_menor',
      categoria: 'socios',
      titulo: 'Certidão de Nascimento do Menor e Documentos do Pai/Mãe Representante',
      obrigatorio: true,
      status: 'pendente',
      detalhe:
        'O sócio menor não pode exercer administração nem ter cotas não integralizadas (Instrução DREI 81/20).',
    })
  }

  return docs
}

/**
 * Citações da base legal brasileira para abertura de empresas
 */
export interface CitacaoLegal {
  titulo: string
  dispositivo: string
  resumo: string
  importancia: string
}

export const BASE_LEGAL_CITACAO: CitacaoLegal[] = [
  {
    titulo: 'Sociedade Limitada Unipessoal (SLU)',
    dispositivo:
      'Código Civil, art. 982, § único e art. 1.052, §§ 1º e 2º (Lei 13.874/2019 - Liberdade Econômica)',
    resumo:
      'Autorizou a constituição de sociedade limitada por apenas 1 (uma) pessoa, sem a necessidade de constituir sócios de fachada e sem a antiga exigência de 100 salários mínimos que vigorava para a EIRELI.',
    importancia:
      'Principal veículo de abertura para empreendedores individuais que buscam blindagem patrimonial sem sócio.',
  },
  {
    titulo: 'Extinção Definitiva da EIRELI',
    dispositivo: 'Lei nº 14.195/2021, art. 41',
    resumo:
      'Determinou expressamente que as empresas individuais de responsabilidade limitada (EIRELI) fossem transformadas compulsoriamente em sociedade limitada unipessoal, revogando o art. 980-A do Código Civil.',
    importancia:
      'Não se cria mais EIRELI no Brasil; qualquer referência deve ser convertida para SLU.',
  },
  {
    titulo: 'Microempreendedor Individual (MEI) e Teto',
    dispositivo: 'Lei Complementar nº 123/2006, art. 18-A a 18-E',
    resumo:
      'Limite anual de receita bruta de R$ 81.000,00 (ou proporcional no ano-calendário de abertura). Tributação fixa mensal no SIMEI com recolhimento unificado de INSS, ISS e/ou ICMS.',
    importancia:
      'Veda participação de pessoas com mais de uma empresa ou profissões de natureza regulamentada/intelectual.',
  },
  {
    titulo: 'Registro em Órgãos e Conselhos de Classe',
    dispositivo: 'Lei Federal nº 6.839/1980, art. 1º',
    resumo:
      '"O registro de empresas e a anotação dos profissionais legalmente habilitados, delas encarregados, serão obrigatórios nas entidades competentes para a fiscalização do exercício das diversas profissões, em razão da atividade básica ou em relação àquela pela qual prestem serviços a terceiros."',
    importancia:
      'Exige registro no CRM, CRO, CREA, CRA, CRC, OAB etc. sob pena de autuação e impedimento da atividade.',
  },
  {
    titulo: 'Registro Automático e Atos Digitais na Redesim',
    dispositivo: 'Lei nº 14.195/2021 e Lei nº 11.598/2007 (Redesim)',
    resumo:
      'Estabelece o deferimento automático de atos constitutivos com uso de instrumentos padronizados nas Juntas Comerciais e dispensa de reconhecimento de firma e autenticação de cópias quando atestadas pelo advogado ou contador.',
    importancia:
      'Agilidade procedimental: o contador tem fé pública para autenticar documentos dos sócios.',
  },
  {
    titulo: 'Alvará de Funcionamento Provisório / Classificação de Risco',
    dispositivo: 'Lei nº 13.874/2019 (art. 3º, I) e Resolução CGSIM nº 51/2019',
    resumo:
      'Atividades classificadas como de baixo risco ("nível de risco I") são dispensadas de atos públicos de liberação da atividade econômica (alvará e licenças prévias) para início da operação.',
    importancia:
      'Permite início imediato das atividades sem vistoria prévia da prefeitura ou bombeiros para atividades de baixo risco.',
  },
  {
    titulo: 'Proteção de Dados Pessoais dos Sócios (LGPD)',
    dispositivo: 'Lei Geral de Proteção de Dados nº 13.709/2018, arts. 7º, II e V',
    resumo:
      'O tratamento de dados pessoais (CPF, RG, endereço e dados patrimoniais) para fins de registro público empresarial fundamenta-se no cumprimento de obrigação legal e execução de contrato.',
    importancia:
      'Garante guarda segura e sigilo técnico de senhas GOV.BR e documentos digitalizados no sistema contábil.',
  },
]

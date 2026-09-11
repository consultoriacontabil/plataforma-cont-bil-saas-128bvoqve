/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const certidoesCol = app.findCollectionByNameOrId('certidoes')
    const ecacCol = app.findCollectionByNameOrId('ecac_comunicacoes')

    // Buscar tenant padrão e empresas
    let tenantId = 'l91og8ybo9krtay'
    try {
      const t = app.findFirstRecordByData('tenants', 'cnpj', '12.345.678/0001-90')
      tenantId = t.id
    } catch (_) {}

    // Empresa 1: Inovatech Soluções Digitais Ltda (todas certidões válidas, >30 dias)
    // Empresa 2: Grãos do Sul Cafeteria (uma vencendo em 15 dias, uma vencida, + 2 comunicações E-CAC não lidas sendo uma alta)
    let empresa1Id = 'feb9h004jovi7xh'
    let empresa2Id = 'xgfoy8yifisdc0n'

    try {
      const e1 = app.findFirstRecordByData('empresas', 'cnpj', '33.456.789/0001-12')
      empresa1Id = e1.id
    } catch (_) {}

    try {
      const e2 = app.findFirstRecordByData('empresas', 'cnpj', '18.902.345/0001-88')
      empresa2Id = e2.id
    } catch (_) {}

    const now = new Date()

    // Datas calculadas relativas a hoje
    const dateMinus60 = new Date(now.getTime() - 60 * 86400000).toISOString()
    const dateMinus15 = new Date(now.getTime() - 15 * 86400000).toISOString()
    const dateMinus5 = new Date(now.getTime() - 5 * 86400000).toISOString()
    const datePlus15 = new Date(now.getTime() + 15 * 86400000).toISOString() // Vence em 15 dias (amarelo)
    const datePlus120 = new Date(now.getTime() + 120 * 86400000).toISOString() // Válida >30 dias (verde)
    const datePlus180 = new Date(now.getTime() + 180 * 86400000).toISOString() // Válida >30 dias (verde)
    const datePlus30Limit = new Date(now.getTime() + 20 * 86400000).toISOString() // Prazo resposta E-CAC

    // Seeds para Empresa 1 (Inovatech): Regularidade 100% OK
    const seedsEmpresa1Certidoes = [
      {
        tipo: 'receita_pgfn_cnd',
        status: 'valida',
        numero_controle: 'RFB.2026.883910.BR',
        data_emissao: dateMinus60,
        data_validade: datePlus120,
        origem: 'automatica',
        observacoes: 'Emitida sem pendências pela Receita Federal e PGFN.',
      },
      {
        tipo: 'fgts_crf',
        status: 'valida',
        numero_controle: 'CRF.20260901.4429',
        data_emissao: dateMinus15,
        data_validade: datePlus120,
        origem: 'manual',
        observacoes: 'Certificado de Regularidade do FGTS perante a Caixa Econômica Federal.',
      },
      {
        tipo: 'trabalhista_cndt',
        status: 'valida',
        numero_controle: 'CNDT-TST-99214/2026',
        data_emissao: dateMinus60,
        data_validade: datePlus180,
        origem: 'automatica',
        observacoes:
          'Certidão Negativa de Débitos Trabalhistas emitida pelo Tribunal Superior do Trabalho.',
      },
    ]

    for (let i = 0; i < seedsEmpresa1Certidoes.length; i++) {
      const item = seedsEmpresa1Certidoes[i]
      try {
        app.findFirstRecordByData('certidoes', 'numero_controle', item.numero_controle)
      } catch (_) {
        const r = new Record(certidoesCol)
        r.set('tenant_id', tenantId)
        r.set('empresa', empresa1Id)
        r.set('tipo', item.tipo)
        r.set('status', item.status)
        r.set('numero_controle', item.numero_controle)
        r.set('data_emissao', item.data_emissao)
        r.set('data_validade', item.data_validade)
        r.set('origem', item.origem)
        r.set('observacoes', item.observacoes)
        app.save(r)
      }
    }

    // Seeds para Empresa 2 (Grãos do Sul): 1 vencendo em 15 dias, 1 vencida, 1 válida
    const seedsEmpresa2Certidoes = [
      {
        tipo: 'receita_pgfn_cpen',
        status: 'valida', // Validade vence em 15 dias -> badge amarelo
        numero_controle: 'RFB.CPEN.2026.110293',
        data_emissao: dateMinus60,
        data_validade: datePlus15,
        origem: 'automatica',
        observacoes:
          'Certidão Positiva com Efeitos de Negativa (débitos com exigibilidade suspensa/parcelamento). Vencimento em 15 dias.',
      },
      {
        tipo: 'municipal',
        status: 'vencida', // Vencida há 15 dias -> badge vermelho
        numero_controle: 'CND-PMC-CUR-77182',
        data_emissao: dateMinus60,
        data_validade: dateMinus15,
        origem: 'manual',
        observacoes:
          'Certidão Negativa de Tributos Municipais (ISS/Taxas) da Prefeitura de Curitiba com validade expirada.',
      },
      {
        tipo: 'trabalhista_cndt',
        status: 'valida',
        numero_controle: 'CNDT-TST-44810/2026',
        data_emissao: dateMinus15,
        data_validade: datePlus180,
        origem: 'manual',
        observacoes: 'Certidão Negativa Trabalhista CNDT válida.',
      },
    ]

    for (let i = 0; i < seedsEmpresa2Certidoes.length; i++) {
      const item = seedsEmpresa2Certidoes[i]
      try {
        app.findFirstRecordByData('certidoes', 'numero_controle', item.numero_controle)
      } catch (_) {
        const r = new Record(certidoesCol)
        r.set('tenant_id', tenantId)
        r.set('empresa', empresa2Id)
        r.set('tipo', item.tipo)
        r.set('status', item.status)
        r.set('numero_controle', item.numero_controle)
        r.set('data_emissao', item.data_emissao)
        r.set('data_validade', item.data_validade)
        r.set('origem', item.origem)
        r.set('observacoes', item.observacoes)
        app.save(r)
      }
    }

    // Seeds de Comunicações E-CAC para Empresa 2 (2 não lidas, uma com criticidade alta)
    const seedsEcacEmpresa2 = [
      {
        tipo: 'exclusao_simples',
        assunto: 'Termo de Exclusão do Simples Nacional por Débitos Federais',
        conteudo:
          'Fica o contribuinte notificado da iminência de exclusão do regime Simples Nacional por débitos em aberto perante a Receita Federal e Procuradoria-Geral da Fazenda Nacional. Prazo improrrogável de 30 dias para regularização ou adesão a parcelamento.',
        data_comunicacao: dateMinus5,
        data_limite_resposta: datePlus30Limit,
        lida: false,
        criticidade: 'alta',
        numero_processo: '10980.720349/2026-11',
        origem_captura: 'manual_supervisionado',
      },
      {
        tipo: 'cobranca_parcelamento',
        assunto: 'Aviso de Cobrança - Parcela em Atraso do Parcelamento Simplificado RFB',
        conteudo:
          'Identificada ausência de pagamento da parcela referente à competência anterior no parcelamento ordinário Simples Nacional. A inadimplência de 3 parcelas acarretará rescisão automática.',
        data_comunicacao: dateMinus15,
        data_limite_resposta: datePlus15,
        lida: false,
        criticidade: 'media',
        numero_processo: '10980.701122/2025-44',
        origem_captura: 'manual_supervisionado',
      },
      {
        tipo: 'aviso_geral',
        assunto: 'Confirmação de Transmissão DCTFWeb sem movimento',
        conteudo:
          'Comunicação de recibo da declaração de Débitos e Créditos Tributários Federais Previdenciários referente ao exercício anterior.',
        data_comunicacao: dateMinus60,
        data_limite_resposta: null,
        lida: true,
        criticidade: 'baixa',
        numero_processo: 'REC-DCTF-2026-00391',
        origem_captura: 'manual_supervisionado',
      },
    ]

    for (let k = 0; k < seedsEcacEmpresa2.length; k++) {
      const msg = seedsEcacEmpresa2[k]
      try {
        app.findFirstRecordByData('ecac_comunicacoes', 'numero_processo', msg.numero_processo)
      } catch (_) {
        const r = new Record(ecacCol)
        r.set('tenant_id', tenantId)
        r.set('empresa', empresa2Id)
        r.set('tipo', msg.tipo)
        r.set('assunto', msg.assunto)
        r.set('conteudo', msg.conteudo)
        r.set('data_comunicacao', msg.data_comunicacao)
        if (msg.data_limite_resposta) {
          r.set('data_limite_resposta', msg.data_limite_resposta)
        }
        r.set('lida', msg.lida)
        r.set('criticidade', msg.criticidade)
        r.set('numero_processo', msg.numero_processo)
        r.set('origem_captura', msg.origem_captura)
        app.save(r)
      }
    }
  },
  (app) => {
    // Reverter seeds de certidoes e ecac
    try {
      app
        .db()
        .newQuery(
          "DELETE FROM certidoes WHERE numero_controle LIKE 'RFB.%' OR numero_controle LIKE 'CRF.%' OR numero_controle LIKE 'CNDT-%' OR numero_controle LIKE 'CND-%'",
        )
        .execute()
    } catch (_) {}

    try {
      app
        .db()
        .newQuery(
          "DELETE FROM ecac_comunicacoes WHERE numero_processo LIKE '10980.%' OR numero_processo LIKE 'REC-DCTF-%'",
        )
        .execute()
    } catch (_) {}
  },
)

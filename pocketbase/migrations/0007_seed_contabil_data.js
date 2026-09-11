/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const tenantList = app.findRecordsByFilter('tenants', 'ativo = true', '-created', 10, 0)
    if (!tenantList || tenantList.length === 0) return

    const primaryTenant = tenantList[0]
    const planoContasCol = app.findCollectionByNameOrId('plano_contas')
    const lancamentosCol = app.findCollectionByNameOrId('lancamentos_contabeis')
    const empresasCol = app.findCollectionByNameOrId('empresas')

    // Find admin / staff user for criado_por
    let staffUser
    try {
      staffUser = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'carlos.silva@rumoconsultoria.com.br',
      )
    } catch (_) {
      try {
        staffUser = app.findAuthRecordByEmail(
          '_pb_users_auth_',
          'rumo@rumoconsultoriacontabil.com.br',
        )
      } catch (_) {}
    }

    // 1. Seed Plano de Contas Brasileiro Padrão (~28 contas estruturadas)
    const contasPadrao = [
      // 1 ATIVO
      { codigo: '1', nome: 'ATIVO', tipo: 'ativo', nivel: 1, paiCodigo: null },
      { codigo: '1.1', nome: 'Ativo Circulante', tipo: 'ativo', nivel: 2, paiCodigo: '1' },
      {
        codigo: '1.1.1',
        nome: 'Caixa e Equivalentes de Caixa',
        tipo: 'ativo',
        nivel: 3,
        paiCodigo: '1.1',
      },
      { codigo: '1.1.1.01', nome: 'Caixa Geral', tipo: 'ativo', nivel: 4, paiCodigo: '1.1.1' },
      {
        codigo: '1.1.1.02',
        nome: 'Bancos Conta Movimento',
        tipo: 'ativo',
        nivel: 4,
        paiCodigo: '1.1.1',
      },
      {
        codigo: '1.1.1.03',
        nome: 'Aplicações Financeiras de Liquidez Imediata',
        tipo: 'ativo',
        nivel: 4,
        paiCodigo: '1.1.1',
      },
      {
        codigo: '1.1.2',
        nome: 'Créditos e Contas a Receber',
        tipo: 'ativo',
        nivel: 3,
        paiCodigo: '1.1',
      },
      {
        codigo: '1.1.2.01',
        nome: 'Clientes / Duplicatas a Receber',
        tipo: 'ativo',
        nivel: 4,
        paiCodigo: '1.1.2',
      },
      { codigo: '1.1.3', nome: 'Estoques', tipo: 'ativo', nivel: 3, paiCodigo: '1.1' },
      {
        codigo: '1.1.3.01',
        nome: 'Mercadorias para Revenda',
        tipo: 'ativo',
        nivel: 4,
        paiCodigo: '1.1.3',
      },
      { codigo: '1.2', nome: 'Ativo Não Circulante', tipo: 'ativo', nivel: 2, paiCodigo: '1' },
      { codigo: '1.2.1', nome: 'Imobilizado', tipo: 'ativo', nivel: 3, paiCodigo: '1.2' },
      {
        codigo: '1.2.1.01',
        nome: 'Equipamentos e Máquinas',
        tipo: 'ativo',
        nivel: 4,
        paiCodigo: '1.2.1',
      },

      // 2 PASSIVO E PATRIMÔNIO LÍQUIDO
      {
        codigo: '2',
        nome: 'PASSIVO E PATRIMÔNIO LÍQUIDO',
        tipo: 'passivo',
        nivel: 1,
        paiCodigo: null,
      },
      { codigo: '2.1', nome: 'Passivo Circulante', tipo: 'passivo', nivel: 2, paiCodigo: '2' },
      { codigo: '2.1.1', nome: 'Fornecedores', tipo: 'passivo', nivel: 3, paiCodigo: '2.1' },
      {
        codigo: '2.1.1.01',
        nome: 'Fornecedores Nacionais',
        tipo: 'passivo',
        nivel: 4,
        paiCodigo: '2.1.1',
      },
      {
        codigo: '2.1.2',
        nome: 'Obrigações Fiscais e Tributárias',
        tipo: 'passivo',
        nivel: 3,
        paiCodigo: '2.1',
      },
      {
        codigo: '2.1.2.01',
        nome: 'Impostos e Contribuições a Recolher (Simples / DCTF)',
        tipo: 'passivo',
        nivel: 4,
        paiCodigo: '2.1.2',
      },
      {
        codigo: '2.1.3',
        nome: 'Obrigações Trabalhistas e Sociais',
        tipo: 'passivo',
        nivel: 3,
        paiCodigo: '2.1',
      },
      {
        codigo: '2.1.3.01',
        nome: 'Salários e Ordenados a Pagar',
        tipo: 'passivo',
        nivel: 4,
        paiCodigo: '2.1.3',
      },
      {
        codigo: '2.1.3.02',
        nome: 'Encargos a Recolher (INSS / FGTS)',
        tipo: 'passivo',
        nivel: 4,
        paiCodigo: '2.1.3',
      },
      { codigo: '2.2', nome: 'Patrimônio Líquido', tipo: 'patrimonio', nivel: 2, paiCodigo: '2' },
      {
        codigo: '2.2.1',
        nome: 'Capital Social Realizado',
        tipo: 'patrimonio',
        nivel: 3,
        paiCodigo: '2.2',
      },
      {
        codigo: '2.2.2',
        nome: 'Reservas e Lucros/Prejuízos Acumulados',
        tipo: 'patrimonio',
        nivel: 3,
        paiCodigo: '2.2',
      },

      // 3 RECEITAS
      { codigo: '3', nome: 'RECEITAS', tipo: 'receita', nivel: 1, paiCodigo: null },
      {
        codigo: '3.1',
        nome: 'Receita Operacional Bruta',
        tipo: 'receita',
        nivel: 2,
        paiCodigo: '3',
      },
      {
        codigo: '3.1.1',
        nome: 'Receita de Venda de Serviços e Licenças',
        tipo: 'receita',
        nivel: 3,
        paiCodigo: '3.1',
      },
      {
        codigo: '3.1.2',
        nome: 'Receita de Venda de Mercadorias',
        tipo: 'receita',
        nivel: 3,
        paiCodigo: '3.1',
      },

      // 4 DESPESAS E CUSTOS
      {
        codigo: '4',
        nome: 'DESPESAS E CUSTOS OPERACIONAIS',
        tipo: 'despesa',
        nivel: 1,
        paiCodigo: null,
      },
      { codigo: '4.1', nome: 'Despesas com Pessoal', tipo: 'despesa', nivel: 2, paiCodigo: '4' },
      {
        codigo: '4.1.1',
        nome: 'Salários, Férias e 13º Salário',
        tipo: 'despesa',
        nivel: 3,
        paiCodigo: '4.1',
      },
      {
        codigo: '4.1.2',
        nome: 'Encargos Sociais (FGTS e Previdência)',
        tipo: 'despesa',
        nivel: 3,
        paiCodigo: '4.1',
      },
      {
        codigo: '4.2',
        nome: 'Despesas Gerais e Administrativas',
        tipo: 'despesa',
        nivel: 2,
        paiCodigo: '4',
      },
      {
        codigo: '4.2.1',
        nome: 'Aluguel, Condomínio e IPTU',
        tipo: 'despesa',
        nivel: 3,
        paiCodigo: '4.2',
      },
      {
        codigo: '4.2.2',
        nome: 'Energia Elétrica, Água e Comunicação',
        tipo: 'despesa',
        nivel: 3,
        paiCodigo: '4.2',
      },
      {
        codigo: '4.2.3',
        nome: 'Serviços de Terceiros e Consultorias',
        tipo: 'despesa',
        nivel: 3,
        paiCodigo: '4.2',
      },
      {
        codigo: '4.3',
        nome: 'Despesas Tributárias e Impostos sobre Vendas',
        tipo: 'despesa',
        nivel: 2,
        paiCodigo: '4',
      },
      {
        codigo: '4.3.1',
        nome: 'Simples Nacional / DAS sobre Faturamento',
        tipo: 'despesa',
        nivel: 3,
        paiCodigo: '4.3',
      },
    ]

    // Save plano de contas for primary tenant
    const mapCodigoToId = {}

    for (let i = 0; i < contasPadrao.length; i++) {
      const c = contasPadrao[i]
      let rec
      try {
        const found = app.findRecordsByFilter(
          'plano_contas',
          `tenant_id = '${primaryTenant.id}' && codigo = '${c.codigo}'`,
          '',
          1,
          0,
        )
        if (found.length > 0) {
          rec = found[0]
        }
      } catch (_) {}

      if (!rec) {
        rec = new Record(planoContasCol)
        rec.set('tenant_id', primaryTenant.id)
        rec.set('codigo', c.codigo)
        rec.set('nome', c.nome)
        rec.set('tipo', c.tipo)
        rec.set('nivel', c.nivel)
        rec.set('ativa', true)
        if (c.paiCodigo && mapCodigoToId[c.paiCodigo]) {
          rec.set('pai', mapCodigoToId[c.paiCodigo])
        }
        app.save(rec)
      }
      mapCodigoToId[c.codigo] = rec.id
    }

    // Update any parent references if missed
    for (let i = 0; i < contasPadrao.length; i++) {
      const c = contasPadrao[i]
      if (c.paiCodigo && mapCodigoToId[c.paiCodigo]) {
        try {
          const r = app.findRecordById('plano_contas', mapCodigoToId[c.codigo])
          if (!r.getString('pai')) {
            r.set('pai', mapCodigoToId[c.paiCodigo])
            app.save(r)
          }
        } catch (_) {}
      }
    }

    // 2. Seed ~16 Lançamentos Contábeis em Partida Dobrada (Débito = Crédito rigoroso)
    // Competências: 08/2026 e 09/2026
    // Empresas do tenant
    const empresas = app.findRecordsByFilter(
      'empresas',
      `tenant_id = '${primaryTenant.id}'`,
      '-created',
      10,
      0,
    )
    if (!empresas || empresas.length === 0) return

    const empInovatech =
      empresas.find((e) => e.getString('cnpj') === '33.456.789/0001-12') || empresas[0]
    const empGraos =
      empresas.find((e) => e.getString('cnpj') === '18.902.345/0001-88') ||
      empresas[1] ||
      empresas[0]

    // Documents to link optionally
    let docNfId = ''
    let docFaturaId = ''
    try {
      const docs = app.findRecordsByFilter(
        'documentos',
        `tenant_id = '${primaryTenant.id}'`,
        '-created',
        5,
        0,
      )
      if (docs.length > 0) docNfId = docs[0].id
      if (docs.length > 1) docFaturaId = docs[1].id
    } catch (_) {}

    // Definir pares de partidas dobradas (cada lote tem 1 débito e 1 crédito idênticos)
    const seedPartidas = [
      // === Competência 08/2026 - Empresa Inovatech ===
      {
        lote: 'LOTE-2026-08-001',
        empresaId: empInovatech.id,
        competencia: '08/2026',
        data: '2026-08-05 10:00:00.000Z',
        valor: 45000.0,
        historico:
          'Recebimento de clientes ref. prestação de serviços de software conforme NFSe 1042',
        debitoConta: '1.1.1.02', // Bancos Conta Movimento
        creditoConta: '3.1.1', // Receita de Serviços
        status: 'confirmado',
        documentoId: docNfId,
      },
      {
        lote: 'LOTE-2026-08-002',
        empresaId: empInovatech.id,
        competencia: '08/2026',
        data: '2026-08-10 14:30:00.000Z',
        valor: 18500.0,
        historico: 'Pagamento de folha salarial dos colaboradores competência 07/2026 via TED',
        debitoConta: '2.1.3.01', // Salários a Pagar
        creditoConta: '1.1.1.02', // Bancos
        status: 'confirmado',
      },
      {
        lote: 'LOTE-2026-08-003',
        empresaId: empInovatech.id,
        competencia: '08/2026',
        data: '2026-08-15 16:00:00.000Z',
        valor: 3500.0,
        historico: 'Pagamento de aluguel do escritório Av. Paulista e taxa condominial',
        debitoConta: '4.2.1', // Aluguel e Condomínio
        creditoConta: '1.1.1.02', // Bancos
        status: 'confirmado',
      },
      {
        lote: 'LOTE-2026-08-004',
        empresaId: empInovatech.id,
        competencia: '08/2026',
        data: '2026-08-20 09:15:00.000Z',
        valor: 4320.5,
        historico: 'Provisão mensal de Simples Nacional referente ao faturamento de serviços',
        debitoConta: '4.3.1', // Simples Nacional
        creditoConta: '2.1.2.01', // Impostos a Recolher
        status: 'confirmado',
      },

      // === Competência 08/2026 - Empresa Grãos do Sul ===
      {
        lote: 'LOTE-2026-08-005',
        empresaId: empGraos.id,
        competencia: '08/2026',
        data: '2026-08-12 11:00:00.000Z',
        valor: 28000.0,
        historico: 'Receitas de vendas a vista de café e derivados na loja física',
        debitoConta: '1.1.1.01', // Caixa Geral
        creditoConta: '3.1.2', // Venda de Mercadorias
        status: 'confirmado',
      },
      {
        lote: 'LOTE-2026-08-006',
        empresaId: empGraos.id,
        competencia: '08/2026',
        data: '2026-08-18 15:45:00.000Z',
        valor: 12500.0,
        historico: 'Compra de cafés especiais em grão de fornecedores de MG para revenda',
        debitoConta: '1.1.3.01', // Mercadorias para Revenda
        creditoConta: '2.1.1.01', // Fornecedores Nacionais
        status: 'confirmado',
        documentoId: docFaturaId,
      },

      // === Competência 09/2026 - Empresa Inovatech ===
      {
        lote: 'LOTE-2026-09-001',
        empresaId: empInovatech.id,
        competencia: '09/2026',
        data: '2026-09-02 09:00:00.000Z',
        valor: 52000.0,
        historico: 'Faturamento de licenças SaaS e suporte técnico contratos corporativos',
        debitoConta: '1.1.2.01', // Clientes a Receber
        creditoConta: '3.1.1', // Receita de Serviços
        status: 'confirmado',
      },
      {
        lote: 'LOTE-2026-09-002',
        empresaId: empInovatech.id,
        competencia: '09/2026',
        data: '2026-09-05 11:20:00.000Z',
        valor: 52000.0,
        historico: 'Liquidação bancária de duplicatas de clientes via boleto emitido',
        debitoConta: '1.1.1.02', // Bancos
        creditoConta: '1.1.2.01', // Clientes a Receber
        status: 'confirmado',
      },
      {
        lote: 'LOTE-2026-09-003',
        empresaId: empInovatech.id,
        competencia: '09/2026',
        data: '2026-09-08 14:00:00.000Z',
        valor: 19800.0,
        historico: 'Apropriação da folha salarial técnica de desenvolvedores ref. 08/2026',
        debitoConta: '4.1.1', // Salários
        creditoConta: '2.1.3.01', // Salários a Pagar
        status: 'confirmado',
      },
      {
        lote: 'LOTE-2026-09-004',
        empresaId: empInovatech.id,
        competencia: '09/2026',
        data: '2026-09-10 10:30:00.000Z',
        valor: 4320.5,
        historico: 'Recolhimento de guia DAS Simples Nacional debitado em conta corrente',
        debitoConta: '2.1.2.01', // Impostos a Recolher
        creditoConta: '1.1.1.02', // Bancos
        status: 'confirmado',
      },
      {
        lote: 'LOTE-2026-09-005',
        empresaId: empInovatech.id,
        competencia: '09/2026',
        data: '2026-09-11 15:00:00.000Z',
        valor: 1200.0,
        historico: 'Despesa com energia elétrica e conectividade fibra ótica data center',
        debitoConta: '4.2.2', // Energia e Comunicação
        creditoConta: '1.1.1.02', // Bancos
        status: 'rascunho',
      },

      // === Competência 09/2026 - Empresa Grãos do Sul ===
      {
        lote: 'LOTE-2026-09-006',
        empresaId: empGraos.id,
        competencia: '09/2026',
        data: '2026-09-04 13:00:00.000Z',
        valor: 8500.0,
        historico: 'Pagamento a fornecedor de embalagens especiais via transferência Pix',
        debitoConta: '2.1.1.01', // Fornecedores
        creditoConta: '1.1.1.02', // Bancos
        status: 'confirmado',
      },
      {
        lote: 'LOTE-2026-09-007',
        empresaId: empGraos.id,
        competencia: '09/2026',
        data: '2026-09-09 16:30:00.000Z',
        valor: 34000.0,
        historico: 'Faturamento de vendas da cafeteria e assinaturas mensais de café',
        debitoConta: '1.1.1.02', // Bancos
        creditoConta: '3.1.2', // Venda de Mercadorias
        status: 'confirmado',
      },
    ]

    for (let i = 0; i < seedPartidas.length; i++) {
      const p = seedPartidas[i]
      const debContaId = mapCodigoToId[p.debitoConta]
      const credContaId = mapCodigoToId[p.creditoConta]
      if (!debContaId || !credContaId) continue

      // Check if already seeded by lote_id
      try {
        const exist = app.findRecordsByFilter(
          'lancamentos_contabeis',
          `tenant_id = '${primaryTenant.id}' && lote_id = '${p.lote}'`,
          '',
          1,
          0,
        )
        if (exist.length > 0) continue
      } catch (_) {}

      // 1. Criar Lançamento a DÉBITO
      const recDeb = new Record(lancamentosCol)
      recDeb.set('tenant_id', primaryTenant.id)
      recDeb.set('empresa', p.empresaId)
      recDeb.set('data', p.data)
      recDeb.set('tipo', 'debito')
      recDeb.set('conta_contabil', debContaId)
      recDeb.set('contrapartida', credContaId)
      recDeb.set('valor', p.valor)
      recDeb.set('historico', p.historico)
      if (p.documentoId) recDeb.set('documento', p.documentoId)
      recDeb.set('competencia', p.competencia)
      recDeb.set('status', p.status)
      recDeb.set('lote_id', p.lote)
      if (staffUser) recDeb.set('criado_por', staffUser.id)
      app.save(recDeb)

      // 2. Criar Lançamento a CRÉDITO
      const recCred = new Record(lancamentosCol)
      recCred.set('tenant_id', primaryTenant.id)
      recCred.set('empresa', p.empresaId)
      recCred.set('data', p.data)
      recCred.set('tipo', 'credito')
      recCred.set('conta_contabil', credContaId)
      recCred.set('contrapartida', debContaId)
      recCred.set('valor', p.valor)
      recCred.set('historico', p.historico)
      if (p.documentoId) recCred.set('documento', p.documentoId)
      recCred.set('competencia', p.competencia)
      recCred.set('status', p.status)
      recCred.set('lote_id', p.lote)
      if (staffUser) recCred.set('criado_por', staffUser.id)
      app.save(recCred)
    }
  },
  (app) => {
    // down rollback
  },
)

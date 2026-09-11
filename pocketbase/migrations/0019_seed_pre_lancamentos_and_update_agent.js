/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Atualizar agente Rumo Agent com novas tools (incluindo fechamento, checklist, pre_lancamentos, lancamentos, demonstrativos, impostos_retidos)
    // e prompt estendido para responder sobre fechamento de competência com checklist estruturado e citação de fontes
    $ai.agents.define(app, {
      slug: 'rumo-agent',
      name: 'Rumo Agent',
      description:
        'Assistente virtual da Rumo Consultoria Contábil para suporte operacional aos contadores e clientes.',
      systemPrompt:
        'Você é o Rumo Agent, assistente virtual da Rumo Consultoria Contábil. Responda sempre em português brasileiro, com tom profissional e cordial. Você auxilia contadores com informações operacionais, fiscais e contábeis do escritório, limitadas estritamente ao tenant do usuário logado.\n\n' +
        'Ao responder sobre FECHAMENTO DE COMPETÊNCIA ou quando perguntarem "o que falta para fechar a competência X da empresa Y?":\n' +
        '1. Consulte as coleções fechamento_competencia, fechamento_checklist_itens, obrigacoes, folha_pagamento, impostos_retidos, lancamentos_contabeis, contas_financeiras, extratos_bancarios, ativos e demonstrativos.\n' +
        '2. Estruture a resposta como um CHECKLIST claro em linguagem natural com status por item: [OK] Concluído, [PENDENTE] Em aberto, ou [BLOQUEADO] Item atrasado/inconsistente.\n' +
        '3. Se houver BLOQUEIOS ou itens atrasados (ex: obrigações fiscais vencidas/atrasadas, lançamentos em rascunho, impostos retidos pendentes), destaque-os em primeiro lugar.\n' +
        '4. Se todos os itens obrigatórios estiverem concluídos, informe que a competência está pronta para encerramento oficial pelo Contador Responsável e mencione se há demonstrativos aguardando aprovação.\n' +
        '5. Sempre cite as fontes com a tag [Ver fonte: Nome da Coleção ou Registro] no formato padrão da aplicação.\n' +
        '6. Você é estritamente somente leitura: nunca altere, exclua ou crie registros.',
      tier: 'fast',
      tools: [
        { collection: 'empresas', perms: { list: true, read: true } },
        { collection: 'documentos', perms: { list: true, read: true } },
        { collection: 'workflows', perms: { list: true, read: true } },
        { collection: 'fiscal', perms: { list: true, read: true } },
        { collection: 'obrigacoes', perms: { list: true, read: true } },
        { collection: 'lancamentos_contabeis', perms: { list: true, read: true } },
        { collection: 'fechamento_competencia', perms: { list: true, read: true } },
        { collection: 'fechamento_checklist_itens', perms: { list: true, read: true } },
        { collection: 'folha_pagamento', perms: { list: true, read: true } },
        { collection: 'impostos_retidos', perms: { list: true, read: true } },
        { collection: 'demonstrativos', perms: { list: true, read: true } },
        { collection: 'ativos', perms: { list: true, read: true } },
        { collection: 'pre_lancamentos', perms: { list: true, read: true } },
        { collection: 'contas_financeiras', perms: { list: true, read: true } },
        { collection: 'extratos_bancarios', perms: { list: true, read: true } },
      ],
    })

    // 2. Seeds de pre_lancamentos a partir dos documentos existentes nas empresas de exemplo
    try {
      const preCol = app.findCollectionByNameOrId('pre_lancamentos')
      const tenants = app.findCollectionByNameOrId('tenants')
      const empresas = app.findCollectionByNameOrId('empresas')
      const planoContas = app.findCollectionByNameOrId('plano_contas')
      const documentos = app.findCollectionByNameOrId('documentos')
      const users = app.findCollectionByNameOrId('_pb_users_auth_')

      const tenantRecs = app.findRecordsByFilter('tenants', '', '', 1, 0)
      if (tenantRecs.length === 0) return
      const tenantId = tenantRecs[0].id

      let adminUserId = ''
      try {
        const adminUser = app.findAuthRecordByEmail(
          '_pb_users_auth_',
          'rumo@rumoconsultoriacontabil.com.br',
        )
        adminUserId = adminUser.id
      } catch (_) {
        const uList = app.findRecordsByFilter('_pb_users_auth_', '', '', 1, 0)
        if (uList.length > 0) adminUserId = uList[0].id
      }

      // Buscar empresas
      let inovatechId = ''
      let graosId = ''
      let logprimeId = ''
      let clinicaId = ''

      const empList = app.findRecordsByFilter('empresas', `tenant_id = "${tenantId}"`, '', 10, 0)
      empList.forEach((e) => {
        const cnpj = e.getString('cnpj')
        if (cnpj.indexOf('33.456.789') !== -1) inovatechId = e.id
        else if (cnpj.indexOf('18.902.345') !== -1) graosId = e.id
        else if (cnpj.indexOf('07.654.321') !== -1) logprimeId = e.id
        else if (cnpj.indexOf('45.123.987') !== -1) clinicaId = e.id
      })
      if (!inovatechId && empList.length > 0) inovatechId = empList[0].id
      if (!graosId && empList.length > 1) graosId = empList[1].id

      // Buscar contas do plano de contas
      // Contas analíticas chave:
      // Banco: 1.1.1.02
      // Fornecedores Nacionais: 2.1.1.01
      // Clientes: 1.1.2.01
      // Simples Nacional a Recolher: 2.1.2.01
      // Simples Nacional Despesa: 4.3.1
      // Receita Serviços: 3.1.1
      // Despesa Serviços Terceiros: 4.2.3
      // Despesa Energia/Comunicação: 4.2.2
      // Despesa Salários: 4.1.1
      // Salários a Pagar: 2.1.3.01
      let cBanco = ''
      let cFornecedores = ''
      let cClientes = ''
      let cDespServicos = ''
      let cRecServicos = ''
      let cDespSimples = ''
      let cSimplesRecolher = ''
      let cDespEnergia = ''

      const contas = app.findRecordsByFilter(
        'plano_contas',
        `tenant_id = "${tenantId}"`,
        '',
        100,
        0,
      )
      contas.forEach((c) => {
        const cod = c.getString('codigo')
        if (cod === '1.1.1.02') cBanco = c.id
        else if (cod === '2.1.1.01') cFornecedores = c.id
        else if (cod === '1.1.2.01') cClientes = c.id
        else if (cod === '4.2.3') cDespServicos = c.id
        else if (cod === '3.1.1') cRecServicos = c.id
        else if (cod === '4.3.1') cDespSimples = c.id
        else if (cod === '2.1.2.01') cSimplesRecolher = c.id
        else if (cod === '4.2.2') cDespEnergia = c.id
      })

      // Buscar documentos existentes
      const docs = app.findRecordsByFilter('documentos', `tenant_id = "${tenantId}"`, '', 20, 0)
      let docFaturaGraos = ''
      let docNfseMaio = ''
      let docIssRetido = ''

      docs.forEach((d) => {
        const nome = d.getString('nome_arquivo')
        if (nome.indexOf('Fatura_Fornecedor_Graos') !== -1) docFaturaGraos = d.id
        else if (nome.indexOf('NFSe_Lote_Maio') !== -1) docNfseMaio = d.id
        else if (nome.indexOf('Comprovante_ISS_Retido') !== -1) docIssRetido = d.id
      })

      // Inserir sugestões de exemplo (competências 09/2026 e 10/2026)
      // 1. Alta Confiança (95) - NFSe Serviços Inovatech
      try {
        app.findFirstRecordByData(
          'pre_lancamentos',
          'historico_sugerido',
          'NFSe Lote Maio/2026 - Receita de Serviços de Desenvolvimento de Software e Licenciamento',
        )
      } catch (_) {
        const s1 = new Record(preCol)
        s1.set('tenant_id', tenantId)
        s1.set('empresa', inovatechId)
        if (docNfseMaio) s1.set('documento', docNfseMaio)
        s1.set('competencia', '09/2026')
        s1.set('debito_sugerido', cClientes || cBanco)
        s1.set('credito_sugerido', cRecServicos)
        s1.set('valor_sugerido', 38500.0)
        s1.set(
          'historico_sugerido',
          'NFSe Lote Maio/2026 - Receita de Serviços de Desenvolvimento de Software e Licenciamento',
        )
        s1.set('confianca', 95)
        s1.set('status', 'pendente')
        app.save(s1)
      }

      // 2. Alta Confiança (88) - Fatura Fornecedor Grãos MG
      try {
        app.findFirstRecordByData(
          'pre_lancamentos',
          'historico_sugerido',
          'Fatura Fornecedor Grãos MG - Aquisição de café especial e insumos torrados',
        )
      } catch (_) {
        const s2 = new Record(preCol)
        s2.set('tenant_id', tenantId)
        s2.set('empresa', graosId || inovatechId)
        if (docFaturaGraos) s2.set('documento', docFaturaGraos)
        s2.set('competencia', '09/2026')
        s2.set('debito_sugerido', cDespEnergia || cDespServicos)
        s2.set('credito_sugerido', cFornecedores || cBanco)
        s2.set('valor_sugerido', 8450.0)
        s2.set(
          'historico_sugerido',
          'Fatura Fornecedor Grãos MG - Aquisição de café especial e insumos torrados',
        )
        s2.set('confianca', 88)
        s2.set('status', 'pendente')
        app.save(s2)
      }

      // 3. Média Confiança (68) - Comprovante Retenção ISS Clínica
      try {
        app.findFirstRecordByData(
          'pre_lancamentos',
          'historico_sugerido',
          'Comprovante Guia DARM ISS Retido ref. serviços médicos hospitalares',
        )
      } catch (_) {
        const s3 = new Record(preCol)
        s3.set('tenant_id', tenantId)
        s3.set('empresa', clinicaId || inovatechId)
        if (docIssRetido) s3.set('documento', docIssRetido)
        s3.set('competencia', '09/2026')
        s3.set('debito_sugerido', cSimplesRecolher || cDespSimples)
        s3.set('credito_sugerido', cBanco)
        s3.set('valor_sugerido', 1420.0)
        s3.set(
          'historico_sugerido',
          'Comprovante Guia DARM ISS Retido ref. serviços médicos hospitalares',
        )
        s3.set('confianca', 68)
        s3.set('status', 'pendente')
        app.save(s3)
      }

      // 4. Já Convertida (100) - Demonstração de fluxo aceito/convertido
      try {
        app.findFirstRecordByData(
          'pre_lancamentos',
          'historico_sugerido',
          'Guia DAS Simples Nacional comp 08/2026 recolhida via débito em conta',
        )
      } catch (_) {
        const s4 = new Record(preCol)
        s4.set('tenant_id', tenantId)
        s4.set('empresa', inovatechId)
        s4.set('competencia', '09/2026')
        s4.set('debito_sugerido', cDespSimples)
        s4.set('credito_sugerido', cBanco)
        s4.set('valor_sugerido', 4320.5)
        s4.set(
          'historico_sugerido',
          'Guia DAS Simples Nacional comp 08/2026 recolhida via débito em conta',
        )
        s4.set('confianca', 98)
        s4.set('status', 'convertido')
        s4.set('lote_id', 'LOTE-PRE-0926-001')
        s4.set('data_processamento', '2026-09-10T14:30:00.000Z')
        if (adminUserId) s4.set('processado_por', adminUserId)
        app.save(s4)
      }

      // 5. Média Confiança (72) - Competência 10/2026
      try {
        app.findFirstRecordByData(
          'pre_lancamentos',
          'historico_sugerido',
          'Fatura Concessionária Energia e Infraestrutura Nuvem comp 10/2026',
        )
      } catch (_) {
        const s5 = new Record(preCol)
        s5.set('tenant_id', tenantId)
        s5.set('empresa', inovatechId)
        s5.set('competencia', '10/2026')
        s5.set('debito_sugerido', cDespEnergia)
        s5.set('credito_sugerido', cBanco)
        s5.set('valor_sugerido', 2150.0)
        s5.set(
          'historico_sugerido',
          'Fatura Concessionária Energia e Infraestrutura Nuvem comp 10/2026',
        )
        s5.set('confianca', 72)
        s5.set('status', 'pendente')
        app.save(s5)
      }
    } catch (err) {
      console.log('Seed pre_lancamentos error:', err)
    }
  },
  (app) => {
    // down migration
  },
)

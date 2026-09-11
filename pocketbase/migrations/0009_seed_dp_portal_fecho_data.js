/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findRecordsByFilter('tenants', 'ativo = true', '-created', 5, 0)
    if (!tenants || tenants.length === 0) return
    const primaryTenant = tenants[0]
    const tenantId = primaryTenant.id

    const empresas = app.findRecordsByFilter(
      'empresas',
      `tenant_id = '${tenantId}'`,
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

    const planoContas = app.findRecordsByFilter(
      'plano_contas',
      `tenant_id = '${tenantId}'`,
      'codigo',
      100,
      0,
    )
    const mapCodToId = {}
    planoContas.forEach((pc) => {
      mapCodToId[pc.getString('codigo')] = pc.id
    })

    // 1. Seed Mapeamento Contábil
    // Obrigações comuns: DAS, DARF, INSS, FGTS
    // Documentos: nota_fiscal, fatura
    const mapeamentoCol = app.findCollectionByNameOrId('mapeamento_contabil')

    const seedMapeamentos = [
      {
        origem: 'obrigacao',
        chave: 'DAS',
        descricao: 'Guia DAS Simples Nacional',
        contaDebitoCod: '4.3.1', // Simples Nacional / DAS sobre Faturamento
        contaCreditoCod: '1.1.1.02', // Bancos Conta Movimento
      },
      {
        origem: 'obrigacao',
        chave: 'DARF',
        descricao: 'DARF Impostos Federais',
        contaDebitoCod: '4.3', // Despesas Tributárias
        contaCreditoCod: '1.1.1.02', // Bancos
      },
      {
        origem: 'obrigacao',
        chave: 'INSS',
        descricao: 'Guia da Previdência Social / INSS',
        contaDebitoCod: '4.1.2', // Encargos Sociais (FGTS e Previdência)
        contaCreditoCod: '1.1.1.02', // Bancos
      },
      {
        origem: 'obrigacao',
        chave: 'FGTS',
        descricao: 'Guia de Recolhimento do FGTS',
        contaDebitoCod: '4.1.2', // Encargos Sociais
        contaCreditoCod: '1.1.1.02', // Bancos
      },
      {
        origem: 'documento',
        chave: 'nota_fiscal',
        descricao: 'Nota Fiscal de Serviço / Mercadoria',
        contaDebitoCod: '4.2.3', // Serviços de Terceiros e Consultorias
        contaCreditoCod: '1.1.1.02', // Bancos
      },
      {
        origem: 'documento',
        chave: 'fatura',
        descricao: 'Faturas e Concessionárias',
        contaDebitoCod: '4.2.2', // Energia, Água e Comunicação
        contaCreditoCod: '1.1.1.02', // Bancos
      },
    ]

    seedMapeamentos.forEach((item) => {
      const debId = mapCodToId[item.contaDebitoCod]
      const credId = mapCodToId[item.contaCreditoCod]
      if (!debId || !credId) return

      try {
        const exist = app.findRecordsByFilter(
          'mapeamento_contabil',
          `tenant_id = '${tenantId}' && origem = '${item.origem}' && chave = '${item.chave}'`,
          '',
          1,
          0,
        )
        if (exist.length > 0) return
      } catch (_) {}

      const rec = new Record(mapeamentoCol)
      rec.set('tenant_id', tenantId)
      rec.set('origem', item.origem)
      rec.set('chave', item.chave)
      rec.set('descricao', item.descricao)
      rec.set('conta_debito', debId)
      rec.set('conta_credito', credId)
      app.save(rec)
    })

    // 2. Seed Funcionários (DP)
    const funcionariosCol = app.findCollectionByNameOrId('funcionarios')
    const seedFuncs = [
      {
        empresaId: empInovatech.id,
        nome: 'Lucas Medeiros Albuquerque',
        cpf: '234.567.890-11',
        cargo: 'Engenheiro de Software Sênior',
        dataAdmissao: '2023-02-15 09:00:00.000Z',
        salario: 12500.0,
        tipo: 'clt',
        status: 'ativo',
        centroCusto: 'Desenvolvimento & Engenharia',
      },
      {
        empresaId: empInovatech.id,
        nome: 'Mariana Duarte Souza',
        cpf: '345.678.901-22',
        cargo: 'Tech Lead / Arquiteta Cloud',
        dataAdmissao: '2022-08-01 09:00:00.000Z',
        salario: 15000.0,
        tipo: 'clt',
        status: 'ativo',
        centroCusto: 'Desenvolvimento & Engenharia',
      },
      {
        empresaId: empInovatech.id,
        nome: 'Guilherme Ramos Castro',
        cpf: '456.789.012-33',
        cargo: 'Analista de QA e Automação',
        dataAdmissao: '2024-01-10 09:00:00.000Z',
        salario: 6200.0,
        tipo: 'clt',
        status: 'ativo',
        centroCusto: 'Qualidade de Software',
      },
      {
        empresaId: empGraos.id,
        nome: 'Carla Beatriz Fagundes',
        cpf: '567.890.123-44',
        cargo: 'Gerente Operacional de Cafeteria',
        dataAdmissao: '2021-06-15 08:00:00.000Z',
        salario: 4800.0,
        tipo: 'clt',
        status: 'ativo',
        centroCusto: 'Operações e Salão',
      },
      {
        empresaId: empGraos.id,
        nome: 'Rodrigo Pires Nogueira',
        cpf: '678.901.234-55',
        cargo: 'Barista Líder Especialista',
        dataAdmissao: '2023-11-01 08:00:00.000Z',
        salario: 3200.0,
        tipo: 'clt',
        status: 'ativo',
        centroCusto: 'Operações e Salão',
      },
    ]

    const createdFuncs = []
    seedFuncs.forEach((sf) => {
      let funcRec
      try {
        const found = app.findRecordsByFilter(
          'funcionarios',
          `tenant_id = '${tenantId}' && cpf = '${sf.cpf}'`,
          '',
          1,
          0,
        )
        if (found.length > 0) {
          funcRec = found[0]
        }
      } catch (_) {}

      if (!funcRec) {
        funcRec = new Record(funcionariosCol)
        funcRec.set('tenant_id', tenantId)
        funcRec.set('empresa', sf.empresaId)
        funcRec.set('nome_completo', sf.nome)
        funcRec.set('cpf', sf.cpf)
        funcRec.set('cargo', sf.cargo)
        funcRec.set('data_admissao', sf.dataAdmissao)
        funcRec.set('salario', sf.salario)
        funcRec.set('tipo', sf.tipo)
        funcRec.set('status', sf.status)
        funcRec.set('centro_custo', sf.centroCusto)
        app.save(funcRec)
      }
      createdFuncs.push(funcRec)
    })

    // 3. Seed Eventos de DP (Histórico/Timeline)
    const eventosCol = app.findCollectionByNameOrId('eventos_dp')
    createdFuncs.forEach((f) => {
      try {
        const found = app.findRecordsByFilter(
          'eventos_dp',
          `funcionario = '${f.id}' && tipo = 'admissao'`,
          '',
          1,
          0,
        )
        if (found.length === 0) {
          const ev = new Record(eventosCol)
          ev.set('tenant_id', tenantId)
          ev.set('empresa', f.getString('empresa'))
          ev.set('funcionario', f.id)
          ev.set('tipo', 'admissao')
          ev.set('data_evento', f.getString('data_admissao'))
          ev.set(
            'descricao',
            'Admissão regular no cargo ' +
              f.getString('cargo') +
              ' com salário base de R$ ' +
              f.getFloat('salario').toFixed(2),
          )
          app.save(ev)
        }
      } catch (_) {}
    })

    // 4. Seed Folha de Pagamento na competência 09/2026 para funcionários da Inovatech
    const folhaCol = app.findCollectionByNameOrId('folha_pagamento')
    const inovatechFuncs = createdFuncs.filter((f) => f.getString('empresa') === empInovatech.id)

    inovatechFuncs.forEach((f) => {
      try {
        const found = app.findRecordsByFilter(
          'folha_pagamento',
          `tenant_id = '${tenantId}' && funcionario = '${f.id}' && competencia = '09/2026'`,
          '',
          1,
          0,
        )
        if (found.length === 0) {
          const salario = f.getFloat('salario')
          // Cálculos simplificados padrão CLT Brasil
          // INSS teto simplificado / ~11%
          const inss = Math.min(salario * 0.11, 908.85)
          // IRRF simplificado
          const irrf = salario > 5000 ? (salario - inss) * 0.15 : (salario - inss) * 0.075
          // FGTS (encargo patronal)
          const fgts = salario * 0.08
          const proventos = [{ descricao: 'Salário Base', valor: salario }]
          const descontos = [
            { descricao: 'INSS Previdência', valor: Number(inss.toFixed(2)) },
            { descricao: 'IRRF Retido na Fonte', valor: Number(irrf.toFixed(2)) },
          ]
          const totalLiquido = salario - (inss + irrf)

          const folhaRec = new Record(folhaCol)
          folhaRec.set('tenant_id', tenantId)
          folhaRec.set('empresa', empInovatech.id)
          folhaRec.set('funcionario', f.id)
          folhaRec.set('competencia', '09/2026')
          folhaRec.set('salario_base', salario)
          folhaRec.set('proventos', JSON.stringify(proventos))
          folhaRec.set('descontos', JSON.stringify(descontos))
          folhaRec.set('inss', Number(inss.toFixed(2)))
          folhaRec.set('irrf', Number(irrf.toFixed(2)))
          folhaRec.set('fgts', Number(fgts.toFixed(2)))
          folhaRec.set('total_liquido', Number(totalLiquido.toFixed(2)))
          folhaRec.set('status', 'processada')
          app.save(folhaRec)
        }
      } catch (_) {}
    })

    // 5. Seed Usuário Cliente e Portal Acesso de Exemplo
    // Para testar imediatamente o Portal do Cliente
    const portalCol = app.findCollectionByNameOrId('portal_acessos')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const membersCol = app.findCollectionByNameOrId('tenant_members')

    const clienteEmail = 'contato.financeiro@inovatech.com.br'
    let clienteUser
    try {
      clienteUser = app.findAuthRecordByEmail('_pb_users_auth_', clienteEmail)
    } catch (_) {
      try {
        clienteUser = new Record(usersCol)
        clienteUser.setEmail(clienteEmail)
        clienteUser.setPassword('Skip@Pass')
        clienteUser.setVerified(true)
        clienteUser.set('name', 'Ana Beatriz (Inovatech)')
        app.save(clienteUser)
      } catch (_) {}
    }

    if (clienteUser) {
      // Garantir associação em tenant_members com perfil 'cliente'
      try {
        const mems = app.findRecordsByFilter(
          'tenant_members',
          `tenant_id = '${tenantId}' && user_id = '${clienteUser.id}'`,
          '',
          1,
          0,
        )
        if (mems.length === 0) {
          const mem = new Record(membersCol)
          mem.set('tenant_id', tenantId)
          mem.set('user_id', clienteUser.id)
          mem.set('perfil', 'cliente')
          mem.set('status', 'ativo')
          app.save(mem)
        }
      } catch (_) {}

      // Garantir registro em portal_acessos
      try {
        const portalRecs = app.findRecordsByFilter(
          'portal_acessos',
          `tenant_id = '${tenantId}' && email = '${clienteEmail}'`,
          '',
          1,
          0,
        )
        if (portalRecs.length === 0) {
          const pRec = new Record(portalCol)
          pRec.set('tenant_id', tenantId)
          pRec.set('empresa', empInovatech.id)
          pRec.set('email', clienteEmail)
          pRec.set('nome_contato', 'Ana Beatriz Silveira')
          pRec.set('user', clienteUser.id)
          pRec.set('ativo', true)
          app.save(pRec)
        }
      } catch (_) {}
    }
  },
  (app) => {
    // down rollback
  },
)

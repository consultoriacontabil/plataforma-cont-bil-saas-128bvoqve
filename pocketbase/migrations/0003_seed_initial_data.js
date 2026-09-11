/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const tenantMembersCol = app.findCollectionByNameOrId('tenant_members')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const documentosCol = app.findCollectionByNameOrId('documentos')
    const workflowsCol = app.findCollectionByNameOrId('workflows')
    const workflowActivityCol = app.findCollectionByNameOrId('workflow_activity')
    const fiscalCol = app.findCollectionByNameOrId('fiscal')
    const auditLogCol = app.findCollectionByNameOrId('audit_log')
    const agentConversationsCol = app.findCollectionByNameOrId('agent_conversations')
    const agentMessagesCol = app.findCollectionByNameOrId('agent_messages')

    // 1. Initial admin user
    let adminUser
    try {
      adminUser = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'rumo@rumoconsultoriacontabil.com.br',
      )
    } catch (_) {
      adminUser = new Record(users)
      adminUser.setEmail('rumo@rumoconsultoriacontabil.com.br')
      adminUser.setPassword('Skip@Pass')
      adminUser.setVerified(true)
      adminUser.set('name', 'Diretoria Rumo')
      app.save(adminUser)
    }

    // Also seed a second staff user (Contador)
    let contadorUser
    try {
      contadorUser = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'carlos.silva@rumoconsultoria.com.br',
      )
    } catch (_) {
      contadorUser = new Record(users)
      contadorUser.setEmail('carlos.silva@rumoconsultoria.com.br')
      contadorUser.setPassword('Skip@Pass')
      contadorUser.setVerified(true)
      contadorUser.set('name', 'Carlos Silva (Contador)')
      app.save(contadorUser)
    }

    // 2. Initial Tenant
    let tenant
    try {
      tenant = app.findFirstRecordByData('tenants', 'nome', 'Rumo Consultoria Contábil')
    } catch (_) {
      tenant = new Record(tenantsCol)
      tenant.set('nome', 'Rumo Consultoria Contábil')
      tenant.set('cnpj', '12.345.678/0001-90')
      tenant.set('plano', 'pro')
      tenant.set('ativo', true)
      app.save(tenant)
    }

    // 3. Tenant Memberships
    try {
      app.findFirstRecordByData('tenant_members', 'user_id', adminUser.id)
    } catch (_) {
      const member = new Record(tenantMembersCol)
      member.set('user_id', adminUser.id)
      member.set('tenant_id', tenant.id)
      member.set('perfil', 'administrador')
      member.set('status', 'ativo')
      app.save(member)
    }

    try {
      app.findFirstRecordByData('tenant_members', 'user_id', contadorUser.id)
    } catch (_) {
      const member2 = new Record(tenantMembersCol)
      member2.set('user_id', contadorUser.id)
      member2.set('tenant_id', tenant.id)
      member2.set('perfil', 'contador')
      member2.set('status', 'ativo')
      app.save(member2)
    }

    // 4. Seed Empresas (Realistic Brazilian Companies)
    const empresasData = [
      {
        razao_social: 'Inovatech Soluções Digitais Ltda',
        nome_fantasia: 'Inovatech Software',
        cnpj: '33.456.789/0001-12',
        inscricao_estadual: '123.456.789.001',
        inscricao_municipal: '987654-1',
        regime_tributario: 'simples_nacional',
        porte: 'me',
        data_abertura: '2021-03-15',
        cep: '01310-100',
        logradouro: 'Avenida Paulista',
        numero: '1578',
        complemento: 'Conjunto 802',
        bairro: 'Bela Vista',
        cidade: 'São Paulo',
        uf: 'SP',
        pais: 'Brasil',
        email: 'financeiro@inovatech.com.br',
        telefone: '(11) 3214-5500',
        site: 'https://inovatech.com.br',
        observacoes:
          'Desenvolvimento de software e consultoria em nuvem. Envia documentos até o 5º dia útil.',
        status: 'ativo',
      },
      {
        razao_social: 'Café & Grãos Gourmet do Sul Comércio Ltda',
        nome_fantasia: 'Grãos do Sul Cafeteria',
        cnpj: '18.902.345/0001-88',
        inscricao_estadual: '543.210.987.002',
        inscricao_municipal: '123456-8',
        regime_tributario: 'simples_nacional',
        porte: 'epp',
        data_abertura: '2019-08-20',
        cep: '80020-000',
        logradouro: 'Rua XV de Novembro',
        numero: '450',
        complemento: 'Loja 2',
        bairro: 'Centro',
        cidade: 'Curitiba',
        uf: 'PR',
        pais: 'Brasil',
        email: 'contato@graosdosul.com.br',
        telefone: '(41) 3322-1100',
        site: 'https://graosdosul.com.br',
        observacoes:
          'Comércio varejista e cafeteria. Três filiais planejadas para o segundo semestre.',
        status: 'ativo',
      },
      {
        razao_social: 'LogPrime Transportes e Armazéns Gerais S/A',
        nome_fantasia: 'LogPrime Express',
        cnpj: '07.654.321/0001-44',
        inscricao_estadual: '876.543.210.003',
        inscricao_municipal: '334455-9',
        regime_tributario: 'lucro_presumido',
        porte: 'demais',
        data_abertura: '2015-11-10',
        cep: '13050-000',
        logradouro: 'Rodovia Santos Dumont',
        numero: 'Km 68',
        complemento: 'Galpão 4',
        bairro: 'Distrito Industrial',
        cidade: 'Campinas',
        uf: 'SP',
        pais: 'Brasil',
        email: 'fiscal@logprime.com.br',
        telefone: '(19) 3788-9000',
        site: 'https://logprime.com.br',
        observacoes:
          'Transportadora de cargas fracionadas e centro de distribuição. Apuração quinzenal.',
        status: 'ativo',
      },
      {
        razao_social: 'Dra. Beatriz Santos Clínica Médica Ltda',
        nome_fantasia: 'Clínica Bem Viver',
        cnpj: '45.123.987/0001-33',
        inscricao_estadual: 'Isento',
        inscricao_municipal: '556677-2',
        regime_tributario: 'lucro_presumido',
        porte: 'me',
        data_abertura: '2022-01-10',
        cep: '22041-001',
        logradouro: 'Rua Barata Ribeiro',
        numero: '200',
        complemento: 'Sala 501',
        bairro: 'Copacabana',
        cidade: 'Rio de Janeiro',
        uf: 'RJ',
        pais: 'Brasil',
        email: 'recepcao@clinicabemviver.med.br',
        telefone: '(21) 2548-7700',
        site: 'https://clinicabemviver.med.br',
        observacoes: 'Clínica de especialidades médicas e exames preventivos com DMED anual.',
        status: 'ativo',
      },
    ]

    const createdEmpresas = []
    for (let i = 0; i < empresasData.length; i++) {
      const item = empresasData[i]
      let empRecord
      try {
        empRecord = app.findFirstRecordByData('empresas', 'cnpj', item.cnpj)
      } catch (_) {
        empRecord = new Record(empresasCol)
        empRecord.set('tenant_id', tenant.id)
        for (const k in item) {
          empRecord.set(k, item[k])
        }
        app.save(empRecord)
      }
      createdEmpresas.push(empRecord)
    }

    // 5. Seed Documentos (5-6 records)
    const docsData = [
      {
        empresa_id: createdEmpresas[0].id,
        nome_arquivo: 'Contrato_Social_Consolidado_2024.pdf',
        tipo: 'contrato_social',
        status: 'processado',
        observacoes: 'Última alteração averbada na JUCESP com inclusão de atividade de SaaS.',
        usuario_upload_id: adminUser.id,
      },
      {
        empresa_id: createdEmpresas[0].id,
        nome_arquivo: 'NFSe_Lote_Maio_2025.pdf',
        tipo: 'nota_fiscal',
        status: 'processado',
        observacoes: 'Notas de serviços prestados para clientes do exterior e nacionais.',
        usuario_upload_id: contadorUser.id,
      },
      {
        empresa_id: createdEmpresas[1].id,
        nome_arquivo: 'Fatura_Fornecedor_Graos_MG.pdf',
        tipo: 'fatura',
        status: 'pendente',
        observacoes: 'Fatura de compra de café especial com retenção de PIS/COFINS.',
        usuario_upload_id: adminUser.id,
      },
      {
        empresa_id: createdEmpresas[2].id,
        nome_arquivo: 'Relatorio_CTe_Abril_2025.xlsx',
        tipo: 'relatorios',
        status: 'processado',
        observacoes: 'Planilha resumo de conhecimentos de transporte emitidos no mês anterior.',
        usuario_upload_id: contadorUser.id,
      },
      {
        empresa_id: createdEmpresas[2].id,
        nome_arquivo: 'Procuracao_RFB_Certificado_Digital.pdf',
        tipo: 'procuracoes',
        status: 'processado',
        observacoes: 'Procuração eletrônica e-CAC válida até dezembro de 2026.',
        usuario_upload_id: adminUser.id,
      },
      {
        empresa_id: createdEmpresas[3].id,
        nome_arquivo: 'Comprovante_ISS_Retido_042025.pdf',
        tipo: 'outros',
        status: 'pendente',
        observacoes: 'Guia DARM autenticada para compensação na apuração trimestral.',
        usuario_upload_id: contadorUser.id,
      },
    ]

    for (let i = 0; i < docsData.length; i++) {
      const doc = docsData[i]
      try {
        app.findFirstRecordByData('documentos', 'nome_arquivo', doc.nome_arquivo)
      } catch (_) {
        const docRecord = new Record(documentosCol)
        docRecord.set('tenant_id', tenant.id)
        docRecord.set('empresa_id', doc.empresa_id)
        docRecord.set('nome_arquivo', doc.nome_arquivo)
        docRecord.set('tipo', doc.tipo)
        docRecord.set('status', doc.status)
        docRecord.set('observacoes', doc.observacoes)
        docRecord.set('usuario_upload_id', doc.usuario_upload_id)
        app.save(docRecord)
      }
    }

    // 6. Seed Workflows (4 records)
    const wfData = [
      {
        empresa_id: createdEmpresas[0].id,
        tipo: 'alteracao_contratual',
        titulo: 'Alteração do Contrato Social - Inclusão de sócio investidor',
        descricao:
          'Elaborar minuta da 4ª alteração contratual para entrada de sócio cotista e registro na JUCESP.',
        prioridade: 'alta',
        status: 'em_andamento',
        prazo: '2025-06-15',
        atribuido_id: contadorUser.id,
        criado_por_id: adminUser.id,
      },
      {
        empresa_id: createdEmpresas[1].id,
        tipo: 'abertura_empresa',
        titulo: 'Abertura de Filial Shopping Palladium',
        descricao:
          'Consulta prévia de viabilidade de local, DBE e protocolo na Prefeitura de Curitiba.',
        prioridade: 'media',
        status: 'pendente',
        prazo: '2025-06-30',
        atribuido_id: adminUser.id,
        criado_por_id: adminUser.id,
      },
      {
        empresa_id: createdEmpresas[2].id,
        tipo: 'envio_obrigacao',
        titulo: 'Transmissão EFD Contribuições - Competência 04/2025',
        descricao: 'Conferência de créditos de PIS/COFINS de combustíveis e envio pelo PVA SPED.',
        prioridade: 'alta',
        status: 'concluido',
        prazo: '2025-05-15',
        atribuido_id: contadorUser.id,
        criado_por_id: adminUser.id,
      },
      {
        empresa_id: createdEmpresas[3].id,
        tipo: 'revisao_documento',
        titulo: 'Revisão do Livro Caixa e DMED 2025',
        descricao: 'Cruzamento das notas de convênios médicos com os recebimentos em conta PJ.',
        prioridade: 'baixa',
        status: 'pendente',
        prazo: '2025-07-10',
        atribuido_id: contadorUser.id,
        criado_por_id: contadorUser.id,
      },
    ]

    for (let i = 0; i < wfData.length; i++) {
      const wf = wfData[i]
      let wfRecord
      try {
        wfRecord = app.findFirstRecordByData('workflows', 'titulo', wf.titulo)
      } catch (_) {
        wfRecord = new Record(workflowsCol)
        wfRecord.set('tenant_id', tenant.id)
        for (const k in wf) {
          wfRecord.set(k, wf[k])
        }
        app.save(wfRecord)

        // Add seed activity
        const act = new Record(workflowActivityCol)
        act.set('tenant_id', tenant.id)
        act.set('workflow_id', wfRecord.id)
        act.set('usuario_id', adminUser.id)
        act.set('acao', 'Criou o workflow')
        act.set('comentario', 'Workflow cadastrado no sistema com prazo definido.')
        app.save(act)
      }
    }

    // 7. Seed Fiscal Records (5-6 records)
    const fiscalData = [
      {
        empresa_id: createdEmpresas[0].id,
        tipo_obrigacao: 'dctf',
        periodo_apuracao: '04/2025',
        status: 'entregue',
        data_entrega: '2025-05-18',
        observacoes: 'DCTF mensal entregue sem débitos a declarar no Simples.',
        responsavel_id: contadorUser.id,
      },
      {
        empresa_id: createdEmpresas[0].id,
        tipo_obrigacao: 'iss',
        periodo_apuracao: '05/2025',
        status: 'pendente',
        observacoes: 'Apuração do ISSQN próprio da Prefeitura de São Paulo.',
        responsavel_id: contadorUser.id,
      },
      {
        empresa_id: createdEmpresas[1].id,
        tipo_obrigacao: 'icms',
        periodo_apuracao: '04/2025',
        status: 'aprovado',
        data_entrega: '2025-05-12',
        observacoes: 'GIA/SPED Fiscal PR transmitido com valor apurado pago.',
        responsavel_id: contadorUser.id,
      },
      {
        empresa_id: createdEmpresas[2].id,
        tipo_obrigacao: 'efd_contribuicoes',
        periodo_apuracao: '04/2025',
        status: 'entregue',
        data_entrega: '2025-05-14',
        observacoes: 'EFD transmitida via receitanet com recibo validado.',
        responsavel_id: contadorUser.id,
      },
      {
        empresa_id: createdEmpresas[2].id,
        tipo_obrigacao: 'ecd',
        periodo_apuracao: '12/2024',
        status: 'em_andamento',
        observacoes: 'ECD ano-calendário 2024 em conferência dos saldos contábeis.',
        responsavel_id: adminUser.id,
      },
      {
        empresa_id: createdEmpresas[3].id,
        tipo_obrigacao: 'pis_cofins',
        periodo_apuracao: '05/2025',
        status: 'pendente',
        observacoes: 'Cálculo de alíquotas do Lucro Presumido (0,65% e 3,00%).',
        responsavel_id: contadorUser.id,
      },
    ]

    for (let i = 0; i < fiscalData.length; i++) {
      const f = fiscalData[i]
      try {
        const records = app.findRecordsByFilter(
          'fiscal',
          `empresa_id = '${f.empresa_id}' && tipo_obrigacao = '${f.tipo_obrigacao}' && periodo_apuracao = '${f.periodo_apuracao}'`,
          '',
          1,
          0,
        )
        if (records.length > 0) continue
      } catch (_) {}

      const rec = new Record(fiscalCol)
      rec.set('tenant_id', tenant.id)
      for (const k in f) {
        rec.set(k, f[k])
      }
      app.save(rec)
    }

    // 8. Seed Audit Log Entries
    const auditEntries = [
      {
        acao: 'Cadastro de empresa',
        entidade_tipo: 'empresas',
        entidade_id: createdEmpresas[0].id,
        detalhes: 'Cadastrou a empresa Inovatech Soluções Digitais Ltda no Simples Nacional.',
      },
      {
        acao: 'Upload de documento',
        entidade_tipo: 'documentos',
        entidade_id: createdEmpresas[0].id,
        detalhes: 'Armazenou Contrato_Social_Consolidado_2024.pdf vinculado à Inovatech.',
      },
      {
        acao: 'Criação de workflow',
        entidade_tipo: 'workflows',
        entidade_id: createdEmpresas[1].id,
        detalhes: 'Abriu demanda de Abertura de Filial Shopping Palladium com prazo 30/06/2025.',
      },
      {
        acao: 'Transmissão fiscal',
        entidade_tipo: 'fiscal',
        entidade_id: createdEmpresas[2].id,
        detalhes: 'Marcou como entregue EFD Contribuições 04/2025 para LogPrime Express.',
      },
    ]

    for (let i = 0; i < auditEntries.length; i++) {
      const a = auditEntries[i]
      const log = new Record(auditLogCol)
      log.set('tenant_id', tenant.id)
      log.set('usuario_id', adminUser.id)
      log.set('acao', a.acao)
      log.set('entidade_tipo', a.entidade_tipo)
      log.set('entidade_id', a.entidade_id)
      log.set('detalhes', a.detalhes)
      app.save(log)
    }

    // 9. Initial Agent Conversation
    let initialConv
    try {
      initialConv = app.findFirstRecordByData('agent_conversations', 'user_id', adminUser.id)
    } catch (_) {
      initialConv = new Record(agentConversationsCol)
      initialConv.set('tenant_id', tenant.id)
      initialConv.set('user_id', adminUser.id)
      initialConv.set('titulo', 'Boas-vindas e Visão Geral do Escritório')
      initialConv.set('resumo', 'Apresentação do assistente contábil e status das empresas ativas.')
      app.save(initialConv)

      const msg1 = new Record(agentMessagesCol)
      msg1.set('tenant_id', tenant.id)
      msg1.set('conversation_id', initialConv.id)
      msg1.set('user_id', adminUser.id)
      msg1.set('role', 'user')
      msg1.set('conteudo', 'Olá Rumo Agent! Como você pode me ajudar hoje?')
      app.save(msg1)

      const msg2 = new Record(agentMessagesCol)
      msg2.set('tenant_id', tenant.id)
      msg2.set('conversation_id', initialConv.id)
      msg2.set('user_id', adminUser.id)
      msg2.set('role', 'agent')
      msg2.set(
        'conteudo',
        'Olá! Sou o Rumo Agent, seu assistente virtual na Rumo Consultoria Contábil. Posso consultar empresas cadastradas, verificar status de documentos, acompanhar workflows abertos e obrigações fiscais pendentes para qualquer cliente do seu escritório. Como posso te auxiliar neste momento?',
      )
      app.save(msg2)
    }
  },
  (app) => {
    // Truncate or remove seed records if needed
  },
)

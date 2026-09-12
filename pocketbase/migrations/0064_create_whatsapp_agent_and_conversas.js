/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const empresas = app.findCollectionByNameOrId('empresas')
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const nfseSol = app.findCollectionByNameOrId('nfse_solicitacoes')

    const tenantsId = tenants.id
    const empresasId = empresas.id
    const usersId = users.id
    const nfseSolId = nfseSol.id

    // 1. Atualizar nfse_config para adicionar campos de IA
    const nfseCfg = app.findCollectionByNameOrId('nfse_config')
    if (!nfseCfg.fields.getByName('ia_ativa')) {
      nfseCfg.fields.add(new BoolField({ name: 'ia_ativa' }))
    }
    if (!nfseCfg.fields.getByName('ia_modo_operacao')) {
      nfseCfg.fields.add(
        new SelectField({
          name: 'ia_modo_operacao',
          values: ['supervisionado', 'autonomo_duvidas'],
          maxSelect: 1,
        }),
      )
    }
    if (!nfseCfg.fields.getByName('ia_mensagem_boas_vindas')) {
      nfseCfg.fields.add(new TextField({ name: 'ia_mensagem_boas_vindas' }))
    }
    if (!nfseCfg.fields.getByName('ia_horario_inicio')) {
      nfseCfg.fields.add(new TextField({ name: 'ia_horario_inicio' }))
    }
    if (!nfseCfg.fields.getByName('ia_horario_fim')) {
      nfseCfg.fields.add(new TextField({ name: 'ia_horario_fim' }))
    }
    if (!nfseCfg.fields.getByName('ia_mensagem_fora_horario')) {
      nfseCfg.fields.add(new TextField({ name: 'ia_mensagem_fora_horario' }))
    }
    app.save(nfseCfg)

    // 2. Coleção wa_atendimento_conversas (conversas do WhatsApp com clientes)
    const waConversas = new Collection({
      name: 'wa_atendimento_conversas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'tenant_id',
          type: 'relation',
          required: true,
          collectionId: tenantsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'empresa',
          type: 'relation',
          required: false,
          collectionId: empresasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'contato_nome', type: 'text', required: true },
        { name: 'contato_telefone', type: 'text', required: true },
        { name: 'origem_chat_jid', type: 'text' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['aberta', 'em_atendimento', 'escalada_humano', 'resolvida_ia', 'encerrada'],
          maxSelect: 1,
        },
        {
          name: 'escalonamento_motivo',
          type: 'select',
          values: ['ato_fiscal', 'duvida_complexa', 'solicitacao_cliente', 'erro_ia', 'outro'],
          maxSelect: 1,
        },
        {
          name: 'solicitacao_nfse',
          type: 'relation',
          required: false,
          collectionId: nfseSolId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'ultima_mensagem', type: 'text' },
        { name: 'ultima_interacao', type: 'date' },
        { name: 'total_mensagens', type: 'number' },
        { name: 'total_respostas_ia', type: 'number' },
        { name: 'total_respostas_humano', type: 'number' },
        { name: 'skip_conversation_id', type: 'text' },
        {
          name: 'atendente_humano',
          type: 'relation',
          required: false,
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_wa_conv_tenant ON wa_atendimento_conversas (tenant_id, status)',
        'CREATE INDEX idx_wa_conv_empresa ON wa_atendimento_conversas (tenant_id, empresa)',
        'CREATE INDEX idx_wa_conv_telefone ON wa_atendimento_conversas (contato_telefone)',
        'CREATE INDEX idx_wa_conv_interacao ON wa_atendimento_conversas (ultima_interacao DESC)',
      ],
    })
    app.save(waConversas)

    // 3. Coleção wa_atendimento_mensagens (mensagens individuais com transparência IA x Humano)
    const waConversasId = waConversas.id
    const waMensagens = new Collection({
      name: 'wa_atendimento_mensagens',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'tenant_id',
          type: 'relation',
          required: true,
          collectionId: tenantsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'conversa',
          type: 'relation',
          required: true,
          collectionId: waConversasId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'remetente_tipo',
          type: 'select',
          required: true,
          values: ['cliente', 'ia', 'humano', 'sistema'],
          maxSelect: 1,
        },
        { name: 'conteudo', type: 'text', required: true },
        {
          name: 'status_envio',
          type: 'select',
          values: ['sugerida_ia', 'enviada', 'pendente_aprovacao', 'rejeitada_contador'],
          maxSelect: 1,
        },
        {
          name: 'aprovado_por',
          type: 'relation',
          required: false,
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'mensagem_id_externo', type: 'text' },
        { name: 'citacoes_json', type: 'json' },
        { name: 'tools_executadas_json', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_wa_msg_conv ON wa_atendimento_mensagens (conversa, created)',
        'CREATE INDEX idx_wa_msg_tenant ON wa_atendimento_mensagens (tenant_id)',
      ],
    })
    app.save(waMensagens)

    // 4. Definir Agente Nativo Skip Cloud: whatsapp-agent
    $ai.agents.define(app, {
      slug: 'whatsapp-agent',
      name: 'Agente Contábil WhatsApp',
      description:
        'Assistente de IA no WhatsApp integrado para atendimento aos clientes do escritório de contabilidade.',
      systemPrompt:
        'Você é o Agente de Atendimento no WhatsApp da Rumo Consultoria Contábil. Você conversa diretamente com clientes e gestores de empresas atendidas pelo escritório contábil. Responda em português brasileiro (pt-BR) de forma educada, prestativa, objetiva e transparente.\n\n' +
        'DIRETRIZES FUNDAMENTAIS:\n' +
        '1. CONSULTAS DE DADOS (SOMENTE LEITURA): Você tem acesso para ler apenas as informações do tenant da empresa que está conversando com você. Você pode consultar: status de obrigações e prazos (obrigacoes), guias de pagamentos e parcelamentos (guias_pagamentos, parcelamentos_federais), documentos no GED (documentos), status de NFS-e solicitadas ou emitidas (nfse_solicitacoes, nfse_notas_emitidas), conformidade de e-Social/Reinf/DCTFWeb (esocial_eventos, reinf_eventos, dctfweb_declaracoes) e dados de férias/13º (ferias_periodos, decimo_terceiro) quando questionado.\n' +
        '2. VERACIDADE ABSOLUTA: NUNCA invente números, valores, prazos, vencimentos ou obrigações inexistentes. Se você não encontrar os dados ou não tiver certeza, declare claramente que não localizou a informação no sistema e que irá encaminhar para o contador responsável responder.\n' +
        '3. ATOS FISCAIS EXIGEM APROVAÇÃO HUMANA (MODO ASSISTIVO): Se o cliente solicitar a EMISSÃO de NFS-e, cancelamento de nota, alteração contratual, contratação/demissão de funcionário ou qualquer outro ato fiscal/tributário/trabalhista, NUNCA execute ou prometa emissão automática. Explique gentilmente que os dados foram encaminhados com prioridade para a fila de conferência e aprovação do contador responsável, de acordo com o padrão de segurança e conformidade do escritório.\n' +
        '4. HORÁRIO E SUPORTE: O horário padrão de expediente do escritório é de segunda a sexta-feira, das 08h30 às 18h00. Fora desse horário ou para assuntos urgentes, informe os canais oficiais de plantão.',
      tier: 'fast',
      tools: [
        { collection: 'empresas', perms: { list: true, read: true } },
        { collection: 'obrigacoes', perms: { list: true, read: true } },
        { collection: 'guias_pagamentos', perms: { list: true, read: true } },
        { collection: 'parcelamentos_federais', perms: { list: true, read: true } },
        { collection: 'documentos', perms: { list: true, read: true } },
        { collection: 'nfse_solicitacoes', perms: { list: true, read: true } },
        { collection: 'nfse_notas_emitidas', perms: { list: true, read: true } },
        { collection: 'esocial_eventos', perms: { list: true, read: true } },
        { collection: 'reinf_eventos', perms: { list: true, read: true } },
        { collection: 'dctfweb_declaracoes', perms: { list: true, read: true } },
        { collection: 'ferias_periodos', perms: { list: true, read: true } },
        { collection: 'decimo_terceiro', perms: { list: true, read: true } },
      ],
      memory: [
        {
          type: 'faq',
          payload: {
            qa: [
              {
                question: 'Qual o prazo de envio do DAS do Simples Nacional?',
                answer:
                  'A guia do DAS vence todo dia 20 de cada mês (ou dia útil subsequente). O escritório apura as notas emitidas e disponibiliza a guia até o dia 15.',
              },
              {
                question: 'Como funciona a emissão de NFS-e pelo WhatsApp?',
                answer:
                  'Basta enviar pelo WhatsApp os dados: CNPJ ou CPF do tomador, descrição do serviço e valor. O Agente IA estrutura os dados e encaminha para a fila de supervisão do contador responsável aprovar e emitir com segurança.',
              },
              {
                question: 'Como consultar minhas guias em aberto ou parcelamentos?',
                answer:
                  'Você pode solicitar diretamente pelo WhatsApp o status de guias como DAS, DARF Previdenciário ou parcelamentos vigentes. O agente consulta o sistema contábil em tempo real e fornece vencimentos e valores.',
              },
              {
                question: 'Qual o horário de atendimento do escritório?',
                answer:
                  'Nosso expediente de atendimento contábil é de segunda a sexta-feira, das 08h30 às 18h00.',
              },
            ],
          },
        },
        {
          type: 'text',
          payload: {
            text: 'Procedimentos de Atendimento Contábil Rumo via WhatsApp: Todo cliente autenticado por telefone tem suas dúvidas de prazos, documentos e guias respondidas prontamente pelo Agente IA. Atos fiscais e emissões de NFS-e passam por supervisão contábil com conferência de alíquotas e retenções antes da transmissão final à prefeitura.',
          },
        },
      ],
    })
  },
  (app) => {
    try {
      $ai.agents.delete(app, 'whatsapp-agent')
    } catch (_) {}
    try {
      const waMsg = app.findCollectionByNameOrId('wa_atendimento_mensagens')
      app.delete(waMsg)
    } catch (_) {}
    try {
      const waConv = app.findCollectionByNameOrId('wa_atendimento_conversas')
      app.delete(waConv)
    } catch (_) {}
  },
)

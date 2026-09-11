/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const empresas = app.findCollectionByNameOrId('empresas')
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    const tenantsId = tenants.id
    const empresasId = empresas.id
    const usersId = users.id

    // Coleção: whatsapp_leads_contatos
    // Registra contatos e leads capturados diretamente da conversa ativa do WhatsApp Web via extensão Chrome
    const whatsappLeads = new Collection({
      name: 'whatsapp_leads_contatos',
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
          name: 'empresa_associada',
          type: 'relation',
          required: false,
          collectionId: empresasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'nome_contato', type: 'text', required: true },
        { name: 'telefone', type: 'text', required: true },
        { name: 'origem_chat_jid', type: 'text' },
        {
          name: 'status_captura',
          type: 'select',
          required: true,
          values: ['capturado', 'empresa_criada', 'empresa_vinculada', 'descartado'],
          maxSelect: 1,
        },
        { name: 'observacoes', type: 'text' },
        { name: 'dados_extras', type: 'json' },
        {
          name: 'capturado_por',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_wa_leads_tenant_status ON whatsapp_leads_contatos (tenant_id, status_captura)',
        'CREATE INDEX idx_wa_leads_telefone ON whatsapp_leads_contatos (telefone)',
        'CREATE INDEX idx_wa_leads_empresa ON whatsapp_leads_contatos (tenant_id, empresa_associada)',
        'CREATE INDEX idx_wa_leads_created ON whatsapp_leads_contatos (created DESC)',
      ],
    })
    app.save(whatsappLeads)

    // Coleção: whatsapp_templates
    // Armazena modelos de mensagens contábeis pré-formatadas para preenchimento assistivo
    const whatsappTemplates = new Collection({
      name: 'whatsapp_templates',
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
        { name: 'titulo', type: 'text', required: true },
        {
          name: 'categoria',
          type: 'select',
          required: true,
          values: ['cobranca', 'boas_vindas', 'obrigacao_prazo', 'documentos', 'geral'],
          maxSelect: 1,
        },
        { name: 'conteudo', type: 'text', required: true },
        { name: 'ativo', type: 'bool' },
        {
          name: 'created',
          type: 'autodate',
          onCreate: true,
          onUpdate: false,
        },
        {
          name: 'updated',
          type: 'autodate',
          onCreate: true,
          onUpdate: true,
        },
      ],
      indexes: [
        'CREATE INDEX idx_wa_tpl_tenant_cat ON whatsapp_templates (tenant_id, categoria)',
        'CREATE INDEX idx_wa_tpl_created ON whatsapp_templates (created DESC)',
      ],
    })
    app.save(whatsappTemplates)

    // Buscar tenant real para seed
    let defaultTenantRecord = null
    try {
      const allTenants = app.findRecordsByFilter('tenants', '', 'created', 1, 0)
      if (allTenants && allTenants.length > 0) {
        defaultTenantRecord = allTenants[0]
      }
    } catch (_) {}

    if (defaultTenantRecord) {
      const templatesIniciais = [
        {
          titulo: 'Cobrança Amigável de Honorários Contábeis',
          categoria: 'cobranca',
          conteudo:
            'Olá, {{contato}}! Tudo bem? Aqui é da equipe da {{escritorio}}.\n\nConstatamos que os honorários contábeis referentes à empresa *{{empresa}}* com vencimento em *{{data_vencimento}}* no valor de *{{valor}}* constam em aberto.\n\nPodemos reenviar a 2ª via do boleto ou chave PIX para facilitar a quitação? Ficamos à disposição caso precise de auxílio!',
        },
        {
          titulo: 'Boas-Vindas ao Novo Cliente Rumo',
          categoria: 'boas_vindas',
          conteudo:
            'Olá, {{contato}}! Seja muito bem-vindo(a) à {{escritorio}}! 🎉\n\nÉ uma honra cuidar da gestão contábil, fiscal e trabalhista da *{{empresa}}*.\n\nJá disponibilizamos seu acesso exclusivo ao nosso Portal do Cliente: acesse {{portal_url}} para acompanhar guias, documentos e demonstrativos com total segurança.\n\nQualquer dúvida, estamos sempre por aqui!',
        },
        {
          titulo: 'Aviso de Prazo de Obrigação Fiscal / Guia',
          categoria: 'obrigacao_prazo',
          conteudo:
            'Atenção, {{contato}}!\n\nLembramos que a guia/obrigação *{{obrigacao}}* da empresa *{{empresa}}* possui vencimento programado para *{{data_vencimento}}* no valor de *{{valor}}*.\n\nO documento já foi emitido e está anexado para seu pagamento em dia, evitando multas e juros. Confirmando o recebimento, agradecemos!',
        },
        {
          titulo: 'Envio de Recibo / Contrato de Prestação de Serviços',
          categoria: 'documentos',
          conteudo:
            'Olá, {{contato}}! Segue o documento contábil referente à *{{empresa}}*:\n\n📄 *Documento:* {{documento_nome}}\n📅 *Competência/Data:* {{competencia}}\n🔐 *Protocolo Digital:* {{protocolo}}\n\nFavor conferir os dados anexos. Estamos à disposição para eventuais dúvidas!',
        },
      ]

      for (const tpl of templatesIniciais) {
        const rec = new Record(whatsappTemplates)
        rec.set('tenant_id', defaultTenantRecord.id)
        rec.set('titulo', tpl.titulo)
        rec.set('categoria', tpl.categoria)
        rec.set('conteudo', tpl.conteudo)
        rec.set('ativo', true)
        app.save(rec)
      }
    }
  },
  (app) => {
    try {
      const colLeads = app.findCollectionByNameOrId('whatsapp_leads_contatos')
      app.delete(colLeads)
    } catch (_) {}
    try {
      const colTpl = app.findCollectionByNameOrId('whatsapp_templates')
      app.delete(colTpl)
    } catch (_) {}
  },
)

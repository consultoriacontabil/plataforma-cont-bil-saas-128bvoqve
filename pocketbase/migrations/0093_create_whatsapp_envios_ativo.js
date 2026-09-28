/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const tenantsId = tenantsCol.id
    const empresasId = empresasCol.id

    // 1. Collection: whatsapp_notificacoes_autorizadas
    // Preferências de autorização de envio ativo de WhatsApp por empresa
    const notificacoesAutorizadas = new Collection({
      name: 'whatsapp_notificacoes_autorizadas',
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
          required: true,
          collectionId: empresasId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'telefone_destinatario', type: 'text' },
        { name: 'permitir_avisos', type: 'bool' },
        { name: 'permitir_guias', type: 'bool' },
        { name: 'permitir_previas', type: 'bool' },
        { name: 'permitir_demonstrativos', type: 'bool' },
        { name: 'permitir_documentos', type: 'bool' },
        { name: 'ativo', type: 'bool' },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_wa_autoriz_tenant_emp ON whatsapp_notificacoes_autorizadas (tenant_id, empresa)',
        'CREATE INDEX idx_wa_autoriz_empresa ON whatsapp_notificacoes_autorizadas (empresa)',
      ],
    })
    app.save(notificacoesAutorizadas)

    // 2. Collection: whatsapp_envios
    // Auditoria completa e fila de envios ativos por WhatsApp
    const enviosCol = new Collection({
      name: 'whatsapp_envios',
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
          required: true,
          collectionId: empresasId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['aviso', 'guia', 'demonstrativo', 'previa', 'documento'],
          maxSelect: 1,
        },
        { name: 'referencia', type: 'text' },
        { name: 'destinatario', type: 'text', required: true },
        { name: 'mensagem', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['fila', 'aguardando_credenciais', 'enviado', 'falhou', 'cancelado'],
          maxSelect: 1,
        },
        {
          name: 'origem',
          type: 'select',
          required: true,
          values: ['manual', 'elliza', 'agendador'],
          maxSelect: 1,
        },
        { name: 'erro', type: 'text' },
        { name: 'detalhes_json', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_wa_envios_tenant_emp ON whatsapp_envios (tenant_id, empresa)',
        'CREATE INDEX idx_wa_envios_status ON whatsapp_envios (status)',
        'CREATE INDEX idx_wa_envios_tipo ON whatsapp_envios (tipo)',
        'CREATE INDEX idx_wa_envios_origem ON whatsapp_envios (origem)',
        'CREATE INDEX idx_wa_envios_created ON whatsapp_envios (created DESC)',
      ],
    })
    app.save(enviosCol)
  },
  (app) => {
    try {
      const e = app.findCollectionByNameOrId('whatsapp_envios')
      app.delete(e)
    } catch (_) {}

    try {
      const a = app.findCollectionByNameOrId('whatsapp_notificacoes_autorizadas')
      app.delete(a)
    } catch (_) {}
  },
)

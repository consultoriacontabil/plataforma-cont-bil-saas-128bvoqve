/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Add email_notificacoes_prazo to users if not present
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!users.fields.getByName('email_notificacoes_prazo')) {
      users.fields.add(
        new BoolField({
          name: 'email_notificacoes_prazo',
          required: false,
        }),
      )
      app.save(users)
    }

    const tenants = app.findCollectionByNameOrId('tenants')
    const empresas = app.findCollectionByNameOrId('empresas')
    const tenantsId = tenants.id
    const empresasId = empresas.id

    // 2. Collection: obrigacoes
    const obrigacoes = new Collection({
      name: 'obrigacoes',
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
          name: 'empresa_id',
          type: 'relation',
          required: true,
          collectionId: empresasId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'tipo',
          type: 'select',
          values: [
            'DAS',
            'SPED',
            'GFIP',
            'DIRF',
            'EFD',
            'DARF',
            'FGTS',
            'INSS',
            'DCTF',
            'DMED',
            'GIA',
            'OUTROS',
          ],
          maxSelect: 1,
        },
        { name: 'competencia', type: 'text', required: true },
        { name: 'vencimento', type: 'date', required: true },
        {
          name: 'status',
          type: 'select',
          values: ['pendente', 'em_andamento', 'entregue', 'atrasada', 'cancelada'],
          maxSelect: 1,
        },
        {
          name: 'responsavel_id',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'valor', type: 'number', min: 0 },
        { name: 'observacoes', type: 'text' },
        {
          name: 'anexo',
          type: 'file',
          maxSelect: 1,
          maxSize: 26214400,
          mimeTypes: [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/xml',
            'text/xml',
          ],
        },
        { name: 'data_entrega', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_obrigacoes_tenant_vencimento ON obrigacoes (tenant_id, vencimento ASC)',
        'CREATE INDEX idx_obrigacoes_empresa_status ON obrigacoes (empresa_id, status)',
        'CREATE INDEX idx_obrigacoes_responsavel ON obrigacoes (responsavel_id)',
        'CREATE INDEX idx_obrigacoes_created ON obrigacoes (created DESC)',
      ],
    })
    app.save(obrigacoes)

    // 3. Collection: notificacoes
    const notificacoes = new Collection({
      name: 'notificacoes',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (usuario_destino_id = @request.auth.id || usuario_destino_id = '')",
      viewRule:
        "@request.auth.id != '' && (usuario_destino_id = @request.auth.id || usuario_destino_id = '')",
      createRule: "@request.auth.id != ''",
      updateRule:
        "@request.auth.id != '' && (usuario_destino_id = @request.auth.id || usuario_destino_id = '')",
      deleteRule:
        "@request.auth.id != '' && (usuario_destino_id = @request.auth.id || usuario_destino_id = '')",
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
          name: 'usuario_destino_id',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'titulo', type: 'text', required: true },
        { name: 'mensagem', type: 'text', required: true },
        {
          name: 'tipo',
          type: 'select',
          values: [
            'prazo_proximo',
            'atrasada',
            'workflow_status',
            'documento_rejeitado',
            'sistema',
          ],
          maxSelect: 1,
        },
        { name: 'link', type: 'text' },
        { name: 'lida', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_notificacoes_tenant_user_lida ON notificacoes (tenant_id, usuario_destino_id, lida)',
        'CREATE INDEX idx_notificacoes_created ON notificacoes (created DESC)',
      ],
    })
    app.save(notificacoes)
  },
  (app) => {
    try {
      const notificacoes = app.findCollectionByNameOrId('notificacoes')
      app.delete(notificacoes)
    } catch (_) {}

    try {
      const obrigacoes = app.findCollectionByNameOrId('obrigacoes')
      app.delete(obrigacoes)
    } catch (_) {}

    try {
      const users = app.findCollectionByNameOrId('_pb_users_auth_')
      if (users.fields.getByName('email_notificacoes_prazo')) {
        users.fields.removeByName('email_notificacoes_prazo')
        app.save(users)
      }
    } catch (_) {}
  },
)

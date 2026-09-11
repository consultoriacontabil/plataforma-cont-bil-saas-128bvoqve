migrate(
  (app) => {
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    const collection = new Collection({
      name: 'empresas_migracoes_lote',
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
          collectionId: tenantsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'usuario_id',
          type: 'relation',
          required: false,
          collectionId: usersCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'nome_arquivo',
          type: 'text',
          required: true,
        },
        {
          name: 'modo_duplicidade',
          type: 'select',
          required: true,
          values: ['atualizar', 'pular'],
          maxSelect: 1,
        },
        {
          name: 'total_linhas',
          type: 'number',
          min: 0,
        },
        {
          name: 'total_importadas',
          type: 'number',
          min: 0,
        },
        {
          name: 'total_atualizadas',
          type: 'number',
          min: 0,
        },
        {
          name: 'total_puladas',
          type: 'number',
          min: 0,
        },
        {
          name: 'total_erros',
          type: 'number',
          min: 0,
        },
        {
          name: 'relatorio_json',
          type: 'json',
          required: false,
        },
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
        'CREATE INDEX idx_emp_migr_tenant ON empresas_migracoes_lote (tenant_id)',
        'CREATE INDEX idx_emp_migr_created ON empresas_migracoes_lote (created DESC)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('empresas_migracoes_lote')
      app.delete(col)
    } catch (_) {}
  },
)

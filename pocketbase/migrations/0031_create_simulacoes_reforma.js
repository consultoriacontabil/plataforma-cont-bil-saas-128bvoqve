migrate(
  (app) => {
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    const collection = new Collection({
      name: 'simulacoes_reforma',
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
          name: 'empresa',
          type: 'relation',
          required: false,
          collectionId: empresasCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'titulo',
          type: 'text',
          required: true,
        },
        {
          name: 'razao_social',
          type: 'text',
          required: false,
        },
        {
          name: 'cnpj',
          type: 'text',
          required: false,
        },
        {
          name: 'regime_atual',
          type: 'select',
          required: true,
          values: ['simples_nacional', 'lucro_presumido', 'lucro_real'],
          maxSelect: 1,
        },
        {
          name: 'setor_atividade',
          type: 'text',
          required: true,
        },
        {
          name: 'faturamento_anual',
          type: 'number',
          required: true,
        },
        {
          name: 'aliquota_atual_estimada',
          type: 'number',
          required: true,
        },
        {
          name: 'percentual_creditos',
          type: 'number',
          required: false,
        },
        {
          name: 'reducao_setorial_60',
          type: 'bool',
          required: false,
        },
        {
          name: 'vende_cesta_basica',
          type: 'bool',
          required: false,
        },
        {
          name: 'inputs_json',
          type: 'json',
          required: false,
        },
        {
          name: 'resultado_json',
          type: 'json',
          required: false,
        },
        {
          name: 'compartilhado_portal',
          type: 'bool',
          required: false,
        },
        {
          name: 'criado_por',
          type: 'relation',
          required: false,
          collectionId: usersCol.id,
          cascadeDelete: false,
          maxSelect: 1,
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
        'CREATE INDEX idx_sim_reforma_tenant ON simulacoes_reforma (tenant_id)',
        'CREATE INDEX idx_sim_reforma_empresa ON simulacoes_reforma (empresa)',
        'CREATE INDEX idx_sim_reforma_created ON simulacoes_reforma (created DESC)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('simulacoes_reforma')
      app.delete(collection)
    } catch (_) {}
  },
)

migrate(
  (app) => {
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    const collection = new Collection({
      name: 'empresas_migracoes_onboarding',
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
          name: 'empresa_id',
          type: 'relation',
          required: true,
          collectionId: empresasCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['entrada', 'saida'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['iniciado', 'em_andamento', 'bloqueado', 'concluido', 'cancelado'],
          maxSelect: 1,
        },
        {
          name: 'responsavel_id',
          type: 'relation',
          required: false,
          collectionId: usersCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'data_inicio',
          type: 'date',
          required: false,
        },
        {
          name: 'data_corte',
          type: 'date',
          required: false,
        },
        {
          name: 'primeira_competencia',
          type: 'text',
          required: false,
        },
        {
          name: 'contador_anterior',
          type: 'text',
          required: false,
        },
        {
          name: 'novo_contador',
          type: 'text',
          required: false,
        },
        {
          name: 'contato_outro_contador',
          type: 'text',
          required: false,
        },
        {
          name: 'regime_tributario_definido',
          type: 'text',
          required: false,
        },
        {
          name: 'motivo_saida',
          type: 'text',
          required: false,
        },
        {
          name: 'checklist_itens_json',
          type: 'json',
          required: false,
        },
        {
          name: 'historico_atividades_json',
          type: 'json',
          required: false,
        },
        {
          name: 'observacoes',
          type: 'text',
          required: false,
        },
        {
          name: 'concluido_em',
          type: 'date',
          required: false,
        },
        {
          name: 'concluido_por_id',
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
        'CREATE INDEX idx_emo_tenant_tipo ON empresas_migracoes_onboarding (tenant_id, tipo)',
        'CREATE INDEX idx_emo_empresa ON empresas_migracoes_onboarding (empresa_id)',
        'CREATE INDEX idx_emo_status ON empresas_migracoes_onboarding (status)',
        'CREATE INDEX idx_emo_created ON empresas_migracoes_onboarding (created DESC)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('empresas_migracoes_onboarding')
      app.delete(collection)
    } catch (_) {}
  },
)

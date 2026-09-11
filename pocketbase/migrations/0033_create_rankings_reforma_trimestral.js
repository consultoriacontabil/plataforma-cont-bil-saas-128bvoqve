migrate(
  (app) => {
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    const collection = new Collection({
      name: 'rankings_reforma_trimestral',
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
          name: 'periodo',
          type: 'text',
          required: true, // ex: "2026-T1", "2026-T2"
        },
        {
          name: 'ano',
          type: 'number',
          required: true,
        },
        {
          name: 'trimestre',
          type: 'number',
          required: true,
        },
        {
          name: 'data_execucao',
          type: 'date',
          required: false,
        },
        {
          name: 'executado_por_tipo',
          type: 'select',
          required: true,
          values: ['cron_trimestral', 'manual_usuario'],
          maxSelect: 1,
        },
        {
          name: 'executado_por',
          type: 'relation',
          required: false,
          collectionId: usersCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'total_empresas',
          type: 'number',
          required: true,
        },
        {
          name: 'total_suficientes',
          type: 'number',
          required: false,
        },
        {
          name: 'faturamento_total',
          type: 'number',
          required: false,
        },
        {
          name: 'impacto_total_acumulado',
          type: 'number',
          required: false,
        },
        {
          name: 'variacao_media_percentual',
          type: 'number',
          required: false,
        },
        {
          name: 'resultado_json',
          type: 'json',
          required: false, // Estrutura completa do ranking e das empresas
        },
        {
          name: 'alertas_variacao_json',
          type: 'json',
          required: false, // Lista de empresas que variaram > limiar vs snapshot anterior
        },
        {
          name: 'versao_normativa',
          type: 'text',
          required: false, // "EC 132/2023 e LC 214/2025"
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
        'CREATE INDEX idx_rank_trim_tenant ON rankings_reforma_trimestral (tenant_id)',
        'CREATE INDEX idx_rank_trim_periodo ON rankings_reforma_trimestral (tenant_id, periodo)',
        'CREATE INDEX idx_rank_trim_created ON rankings_reforma_trimestral (created DESC)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('rankings_reforma_trimestral')
      app.delete(collection)
    } catch (_) {}
  },
)

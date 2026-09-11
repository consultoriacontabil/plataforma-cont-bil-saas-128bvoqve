/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const empresas = app.findCollectionByNameOrId('empresas')
    const contratos = app.findCollectionByNameOrId('contratos_honorarios')
    const contasFinanceiras = app.findCollectionByNameOrId('contas_financeiras')
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    const tenantsId = tenants.id
    const empresasId = empresas.id
    const contratosId = contratos.id
    const contasFinId = contasFinanceiras.id
    const usersId = users.id

    // 1. Coleção faturamentos_recorrentes
    // tenant_id, contrato, empresa, competencia (AAAA-MM), valor, data_vencimento, status (previsto | faturado | pago | cancelado), titulo_financeiro, motivo_cancelamento, notas, criado_por
    const faturamentosRecorrentes = new Collection({
      name: 'faturamentos_recorrentes',
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
          name: 'contrato',
          type: 'relation',
          required: true,
          collectionId: contratosId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'empresa',
          type: 'relation',
          required: true,
          collectionId: empresasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'competencia',
          type: 'text',
          required: true,
        },
        {
          name: 'valor',
          type: 'number',
          required: true,
          min: 0,
        },
        {
          name: 'data_vencimento',
          type: 'date',
          required: true,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['previsto', 'faturado', 'pago', 'cancelado'],
          maxSelect: 1,
        },
        {
          name: 'titulo_financeiro',
          type: 'relation',
          required: false,
          collectionId: contasFinId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'motivo_cancelamento',
          type: 'text',
        },
        {
          name: 'notas',
          type: 'text',
        },
        {
          name: 'criado_por',
          type: 'relation',
          required: false,
          collectionId: usersId,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_fat_rec_tenant_comp ON faturamentos_recorrentes (tenant_id, competencia)',
        'CREATE INDEX idx_fat_rec_contrato_comp ON faturamentos_recorrentes (contrato, competencia)',
        'CREATE INDEX idx_fat_rec_empresa_status ON faturamentos_recorrentes (empresa, status)',
        'CREATE INDEX idx_fat_rec_created ON faturamentos_recorrentes (created DESC)',
      ],
    })
    app.save(faturamentosRecorrentes)

    // 2. Coleção parametros_reforma
    // tenant_id, ativo (bool), versao (number), fonte, descricao_alteracao, parametros_json (JSON), atualizado_por (relation users)
    const parametrosReforma = new Collection({
      name: 'parametros_reforma',
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
          name: 'ativo',
          type: 'bool',
        },
        {
          name: 'versao',
          type: 'number',
          min: 1,
        },
        {
          name: 'fonte',
          type: 'text',
          required: true,
        },
        {
          name: 'descricao_alteracao',
          type: 'text',
        },
        {
          name: 'parametros_json',
          type: 'json',
          required: true,
        },
        {
          name: 'atualizado_por',
          type: 'relation',
          required: false,
          collectionId: usersId,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_param_reforma_tenant_ativo ON parametros_reforma (tenant_id, ativo)',
        'CREATE INDEX idx_param_reforma_tenant_versao ON parametros_reforma (tenant_id, versao)',
        'CREATE INDEX idx_param_reforma_created ON parametros_reforma (created DESC)',
      ],
    })
    app.save(parametrosReforma)
  },
  (app) => {
    try {
      const p = app.findCollectionByNameOrId('parametros_reforma')
      app.delete(p)
    } catch (_) {}
    try {
      const f = app.findCollectionByNameOrId('faturamentos_recorrentes')
      app.delete(f)
    } catch (_) {}
  },
)

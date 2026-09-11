/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const empresas = app.findCollectionByNameOrId('empresas')
    const documentos = app.findCollectionByNameOrId('documentos')
    const planoContas = app.findCollectionByNameOrId('plano_contas')
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    const tenantsId = tenants.id
    const empresasId = empresas.id
    const documentosId = documentos.id
    const planoContasId = planoContas.id
    const usersId = users.id

    // Nova coleção: pre_lancamentos
    // tenant_id (relation), empresa (relation), documento (relation),
    // competencia (text), debito_sugerido (relation -> plano_contas),
    // credito_sugerido (relation -> plano_contas), valor_sugerido (number),
    // historico_sugerido (text), confianca (number 0-100),
    // status (select: pendente, aceito, rejeitado, convertido),
    // motivo_rejeicao (text), lote_id (text),
    // data_processamento (date), processado_por (relation -> users)
    const preLancamentos = new Collection({
      name: 'pre_lancamentos',
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
          name: 'documento',
          type: 'relation',
          required: false,
          collectionId: documentosId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'competencia',
          type: 'text',
          required: true,
        },
        {
          name: 'debito_sugerido',
          type: 'relation',
          required: false,
          collectionId: planoContasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'credito_sugerido',
          type: 'relation',
          required: false,
          collectionId: planoContasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'valor_sugerido',
          type: 'number',
          required: true,
          min: 0,
        },
        {
          name: 'historico_sugerido',
          type: 'text',
          required: true,
        },
        {
          name: 'confianca',
          type: 'number',
          required: true,
          min: 0,
          max: 100,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['pendente', 'aceito', 'rejeitado', 'convertido'],
          maxSelect: 1,
        },
        {
          name: 'motivo_rejeicao',
          type: 'text',
        },
        {
          name: 'lote_id',
          type: 'text',
        },
        {
          name: 'data_processamento',
          type: 'date',
        },
        {
          name: 'processado_por',
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
        'CREATE INDEX idx_pre_lanc_tenant_emp_comp ON pre_lancamentos (tenant_id, empresa, competencia)',
        'CREATE INDEX idx_pre_lanc_status ON pre_lancamentos (status)',
        'CREATE INDEX idx_pre_lanc_confianca ON pre_lancamentos (confianca)',
        'CREATE INDEX idx_pre_lanc_doc ON pre_lancamentos (documento)',
        'CREATE INDEX idx_pre_lanc_created ON pre_lancamentos (created DESC)',
      ],
    })

    app.save(preLancamentos)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('pre_lancamentos')
      app.delete(col)
    } catch (_) {}
  },
)

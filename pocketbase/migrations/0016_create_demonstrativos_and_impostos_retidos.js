/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const empresas = app.findCollectionByNameOrId('empresas')
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const contasFinanceiras = app.findCollectionByNameOrId('contas_financeiras')

    const tenantsId = tenants.id
    const empresasId = empresas.id
    const usersId = users.id
    const contasFinanceirasId = contasFinanceiras.id

    // 1. Coleção: demonstrativos
    // tenant_id, empresa, competencia, tipo (dre | balanco), dados (json), status (rascunho | enviado | aprovado | reprovado),
    // data_envio (date), data_aprovacao (date), observacoes_cliente (text), aprovado_por (relation -> users),
    // gerado_por (relation -> users)
    const demonstrativos = new Collection({
      name: 'demonstrativos',
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
        { name: 'competencia', type: 'text', required: true },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['dre', 'balanco'],
          maxSelect: 1,
        },
        { name: 'dados', type: 'json', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['rascunho', 'enviado', 'aprovado', 'reprovado'],
          maxSelect: 1,
        },
        { name: 'data_envio', type: 'date' },
        { name: 'data_aprovacao', type: 'date' },
        { name: 'observacoes_cliente', type: 'text' },
        {
          name: 'aprovado_por',
          type: 'relation',
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'gerado_por',
          type: 'relation',
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_dem_tenant_emp_comp ON demonstrativos (tenant_id, empresa, competencia)',
        'CREATE INDEX idx_dem_status ON demonstrativos (status)',
        'CREATE INDEX idx_dem_tipo ON demonstrativos (tipo)',
        'CREATE INDEX idx_dem_created ON demonstrativos (created DESC)',
      ],
    })
    app.save(demonstrativos)

    // 2. Coleção: impostos_retidos
    // tenant_id, empresa, competencia, tipo (darf_inss | darf_irrf | fgts), valor (number),
    // vencimento (date), status (pendente | pago | atrasado), vinculo_folha (text ou competencia/id),
    // vinculo_titulo_financeiro (relation -> contas_financeiras), lote_contabil (text), pago_em (date), observacoes (text)
    const impostosRetidos = new Collection({
      name: 'impostos_retidos',
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
        { name: 'competencia', type: 'text', required: true },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['darf_inss', 'darf_irrf', 'fgts'],
          maxSelect: 1,
        },
        { name: 'valor', type: 'number', required: true },
        { name: 'vencimento', type: 'date', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['pendente', 'pago', 'atrasado'],
          maxSelect: 1,
        },
        { name: 'vinculo_folha', type: 'text' },
        {
          name: 'vinculo_titulo_financeiro',
          type: 'relation',
          collectionId: contasFinanceirasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'lote_contabil', type: 'text' },
        { name: 'pago_em', type: 'date' },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_imp_tenant_emp_comp ON impostos_retidos (tenant_id, empresa, competencia)',
        'CREATE INDEX idx_imp_tipo_status ON impostos_retidos (tipo, status)',
        'CREATE INDEX idx_imp_vencimento ON impostos_retidos (vencimento)',
        'CREATE INDEX idx_imp_created ON impostos_retidos (created DESC)',
      ],
    })
    app.save(impostosRetidos)
  },
  (app) => {
    try {
      const ir = app.findCollectionByNameOrId('impostos_retidos')
      app.delete(ir)
    } catch (_) {}

    try {
      const dem = app.findCollectionByNameOrId('demonstrativos')
      app.delete(dem)
    } catch (_) {}
  },
)

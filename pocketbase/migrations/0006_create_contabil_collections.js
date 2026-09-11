/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const empresas = app.findCollectionByNameOrId('empresas')
    const documentos = app.findCollectionByNameOrId('documentos')
    const tenantsId = tenants.id
    const empresasId = empresas.id
    const documentosId = documentos.id

    // 1. Collection: plano_contas
    // Fields: tenant_id, codigo, nome, tipo, nivel, pai, ativa, created, updated
    const planoContas = new Collection({
      name: 'plano_contas',
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
        { name: 'codigo', type: 'text', required: true },
        { name: 'nome', type: 'text', required: true },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['ativo', 'passivo', 'patrimonio', 'receita', 'despesa'],
          maxSelect: 1,
        },
        { name: 'nivel', type: 'number', min: 1, max: 10, onlyInt: true },
        { name: 'ativa', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_plano_contas_tenant_cod ON plano_contas (tenant_id, codigo)',
        'CREATE INDEX idx_plano_contas_tipo ON plano_contas (tipo)',
        'CREATE INDEX idx_plano_contas_created ON plano_contas (created DESC)',
      ],
    })
    app.save(planoContas)
    const planoContasId = planoContas.id

    // Add optional self-relation field 'pai' to plano_contas
    planoContas.fields.add(
      new RelationField({
        name: 'pai',
        collectionId: planoContasId,
        cascadeDelete: false,
        maxSelect: 1,
      }),
    )
    app.save(planoContas)

    // 2. Collection: lancamentos_contabeis
    // Fields:
    // tenant_id (relation->tenants)
    // empresa (relation->empresas)
    // data (date)
    // tipo (select: debito | credito)
    // conta_contabil (relation->plano_contas)
    // contrapartida (relation->plano_contas, optional)
    // valor (number, min: 0.01)
    // historico (text, required)
    // documento (relation->documentos, optional)
    // competencia (text, MM/YYYY, required)
    // status (select: rascunho | confirmado)
    // lote_id (text, to group double-entry pairs if needed)
    // criado_por (relation->_pb_users_auth_)
    // created, updated (autodate)
    const lancamentosContabeis = new Collection({
      name: 'lancamentos_contabeis',
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
        { name: 'data', type: 'date', required: true },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['debito', 'credito'],
          maxSelect: 1,
        },
        {
          name: 'conta_contabil',
          type: 'relation',
          required: true,
          collectionId: planoContasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'contrapartida',
          type: 'relation',
          collectionId: planoContasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'valor', type: 'number', required: true, min: 0.01 },
        { name: 'historico', type: 'text', required: true },
        {
          name: 'documento',
          type: 'relation',
          collectionId: documentosId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'competencia', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          values: ['rascunho', 'confirmado'],
          maxSelect: 1,
        },
        { name: 'lote_id', type: 'text' },
        {
          name: 'criado_por',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_lancamentos_tenant_emp_comp ON lancamentos_contabeis (tenant_id, empresa, competencia)',
        'CREATE INDEX idx_lancamentos_conta ON lancamentos_contabeis (conta_contabil)',
        'CREATE INDEX idx_lancamentos_data ON lancamentos_contabeis (data DESC)',
        'CREATE INDEX idx_lancamentos_lote ON lancamentos_contabeis (lote_id)',
      ],
    })
    app.save(lancamentosContabeis)
  },
  (app) => {
    try {
      const lc = app.findCollectionByNameOrId('lancamentos_contabeis')
      app.delete(lc)
    } catch (_) {}

    try {
      const pc = app.findCollectionByNameOrId('plano_contas')
      app.delete(pc)
    } catch (_) {}
  },
)

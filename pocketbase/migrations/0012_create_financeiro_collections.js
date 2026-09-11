/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const empresas = app.findCollectionByNameOrId('empresas')
    const planoContas = app.findCollectionByNameOrId('plano_contas')
    const tenantsId = tenants.id
    const empresasId = empresas.id
    const planoContasId = planoContas.id

    // 1. Collection: contas_bancarias
    // tenant_id, empresa, banco, agencia, conta, saldo_inicial, saldo_atual, ativa, conta_contabil, created, updated
    const contasBancarias = new Collection({
      name: 'contas_bancarias',
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
        { name: 'banco', type: 'text', required: true },
        { name: 'agencia', type: 'text', required: true },
        { name: 'conta', type: 'text', required: true },
        { name: 'saldo_inicial', type: 'number', required: true },
        { name: 'saldo_atual', type: 'number' },
        { name: 'ativa', type: 'bool' },
        {
          name: 'conta_contabil',
          type: 'relation',
          collectionId: planoContasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_contas_bancarias_tenant_emp ON contas_bancarias (tenant_id, empresa)',
        'CREATE INDEX idx_contas_bancarias_created ON contas_bancarias (created DESC)',
      ],
    })
    app.save(contasBancarias)
    const contasBancariasId = contasBancarias.id

    // 2. Collection: contas_financeiras (Pagar / Receber)
    // tipo: pagar | receber
    // tenant_id, empresa, pessoa (fornecedor/cliente), descricao, documento_ref,
    // categoria (relation->plano_contas), valor, data_emissao, data_vencimento,
    // data_pagamento, status: pendente | pago | atrasado | cancelado,
    // conta_bancaria (relation->contas_bancarias), lote_contabil_id, observacoes
    const contasFinanceiras = new Collection({
      name: 'contas_financeiras',
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
          values: ['pagar', 'receber'],
          maxSelect: 1,
        },
        { name: 'pessoa', type: 'text', required: true },
        { name: 'descricao', type: 'text', required: true },
        { name: 'documento_ref', type: 'text' },
        {
          name: 'categoria',
          type: 'relation',
          collectionId: planoContasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'valor', type: 'number', required: true, min: 0.01 },
        { name: 'data_emissao', type: 'date', required: true },
        { name: 'data_vencimento', type: 'date', required: true },
        { name: 'data_pagamento', type: 'date' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['pendente', 'pago', 'atrasado', 'cancelado'],
          maxSelect: 1,
        },
        {
          name: 'conta_bancaria',
          type: 'relation',
          collectionId: contasBancariasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'lote_contabil_id', type: 'text' },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_contas_fin_tenant_emp_tipo ON contas_financeiras (tenant_id, empresa, tipo)',
        'CREATE INDEX idx_contas_fin_status ON contas_financeiras (status)',
        'CREATE INDEX idx_contas_fin_vencimento ON contas_financeiras (data_vencimento)',
        'CREATE INDEX idx_contas_fin_created ON contas_financeiras (created DESC)',
      ],
    })
    app.save(contasFinanceiras)
    const contasFinanceirasId = contasFinanceiras.id

    // 3. Collection: extratos_bancarios
    // tenant_id, conta_bancaria (relation), empresa (relation), data (date), descricao (text),
    // valor (number), tipo_transacao: credito | debito,
    // status: pendente | conciliado | ignorado,
    // titulo_conciliado (relation->contas_financeiras, optional),
    // lote_contabil_id, conciliado_em (date), conciliado_por (relation->_pb_users_auth_)
    const extratosBancarios = new Collection({
      name: 'extratos_bancarios',
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
          name: 'conta_bancaria',
          type: 'relation',
          required: true,
          collectionId: contasBancariasId,
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
        { name: 'descricao', type: 'text', required: true },
        { name: 'documento_numero', type: 'text' },
        { name: 'valor', type: 'number', required: true },
        {
          name: 'tipo_transacao',
          type: 'select',
          required: true,
          values: ['credito', 'debito'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['pendente', 'conciliado', 'ignorado'],
          maxSelect: 1,
        },
        {
          name: 'titulo_conciliado',
          type: 'relation',
          collectionId: contasFinanceirasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'lote_contabil_id', type: 'text' },
        { name: 'conciliado_em', type: 'date' },
        {
          name: 'conciliado_por',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_extratos_tenant_conta ON extratos_bancarios (tenant_id, conta_bancaria)',
        'CREATE INDEX idx_extratos_emp_status ON extratos_bancarios (empresa, status)',
        'CREATE INDEX idx_extratos_data ON extratos_bancarios (data DESC)',
      ],
    })
    app.save(extratosBancarios)

    // 4. Garantir campo onboarding_checklist no tenants (json ou text) para persistência do progresso
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    if (!tenantsCol.fields.getByName('onboarding_checklist')) {
      tenantsCol.fields.add(
        new JSONField({
          name: 'onboarding_checklist',
          maxSize: 20480,
        }),
      )
      app.save(tenantsCol)
    }
  },
  (app) => {
    try {
      const eb = app.findCollectionByNameOrId('extratos_bancarios')
      app.delete(eb)
    } catch (_) {}

    try {
      const cf = app.findCollectionByNameOrId('contas_financeiras')
      app.delete(cf)
    } catch (_) {}

    try {
      const cb = app.findCollectionByNameOrId('contas_bancarias')
      app.delete(cb)
    } catch (_) {}
  },
)

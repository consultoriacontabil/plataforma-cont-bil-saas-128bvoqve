/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const empresas = app.findCollectionByNameOrId('empresas')
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    const tenantsId = tenants.id
    const empresasId = empresas.id
    const usersId = users.id

    // Coleção: contratos_honorarios
    // tenant_id, empresa (opcional para prospect), titulo, tipo (proposta | contrato),
    // modelo_mensalidade, valor_mensal, dia_vencimento, prazo_contrato, data_inicio,
    // clausulas (JSON array [{titulo, texto}]), status (rascunho | enviado | assinado | recusado | cancelado),
    // dados_congelados (JSON), observacoes_recusa, criado_por
    const contratosHonorarios = new Collection({
      name: 'contratos_honorarios',
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
          required: false,
          collectionId: empresasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'titulo', type: 'text', required: true },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['proposta', 'contrato'],
          maxSelect: 1,
        },
        {
          name: 'modelo_mensalidade',
          type: 'text',
          required: true,
        },
        { name: 'valor_mensal', type: 'number', min: 0 },
        { name: 'dia_vencimento', type: 'number', min: 1, max: 31 },
        { name: 'prazo_contrato', type: 'number', min: 1 },
        { name: 'data_inicio', type: 'date' },
        { name: 'clausulas', type: 'json' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['rascunho', 'enviado', 'assinado', 'recusado', 'cancelado'],
          maxSelect: 1,
        },
        { name: 'dados_congelados', type: 'json' },
        { name: 'observacoes_recusa', type: 'text' },
        {
          name: 'criado_por',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_contratos_tenant_empresa ON contratos_honorarios (tenant_id, empresa)',
        'CREATE INDEX idx_contratos_tenant_status ON contratos_honorarios (tenant_id, status)',
        'CREATE INDEX idx_contratos_tipo ON contratos_honorarios (tipo)',
        'CREATE INDEX idx_contratos_created ON contratos_honorarios (created DESC)',
      ],
    })
    app.save(contratosHonorarios)

    // Ajustar coleção assinaturas_demonstrativos:
    // 1. Tornar campo 'demonstrativo' opcional (required: false)
    // 2. Adicionar campo 'tipo_documento' (select: demonstrativo | contrato_honorarios)
    // 3. Adicionar campo relation 'contrato' apontando para contratos_honorarios
    const assinaturasCol = app.findCollectionByNameOrId('assinaturas_demonstrativos')
    const fieldDem = assinaturasCol.fields.getByName('demonstrativo')
    if (fieldDem) {
      fieldDem.required = false
    }

    if (!assinaturasCol.fields.getByName('tipo_documento')) {
      assinaturasCol.fields.add(
        new SelectField({
          name: 'tipo_documento',
          required: false,
          values: ['demonstrativo', 'contrato_honorarios'],
          maxSelect: 1,
        }),
      )
    }

    if (!assinaturasCol.fields.getByName('contrato')) {
      assinaturasCol.fields.add(
        new RelationField({
          name: 'contrato',
          required: false,
          collectionId: contratosHonorarios.id,
          cascadeDelete: true,
          maxSelect: 1,
        }),
      )
    }

    // Tornar empresa opcional em assinaturas_demonstrativos caso uma proposta seja para prospect
    const fieldEmp = assinaturasCol.fields.getByName('empresa')
    if (fieldEmp) {
      fieldEmp.required = false
    }

    app.save(assinaturasCol)
    assinaturasCol.addIndex('idx_ass_dem_contrato', false, 'contrato', '')
    app.save(assinaturasCol)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('contratos_honorarios')
      app.delete(col)
    } catch (_) {}
  },
)

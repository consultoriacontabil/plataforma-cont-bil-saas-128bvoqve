/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const usersCol = app.findCollectionByNameOrId('users')

    const tenantsId = tenantsCol.id
    const empresasId = empresasCol.id
    const usersId = usersCol.id

    // Collection: defis_declaracoes
    // Armazena as declarações socioeconômicas e fiscais do Simples Nacional (ano-calendário anterior)
    const defisCollection = new Collection({
      name: 'defis_declaracoes',
      type: 'base',
      listRule:
        "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'",
      viewRule:
        "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'",
      createRule:
        "@request.auth.id != '' && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')",
      deleteRule:
        "@request.auth.id != '' && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')",
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
          name: 'ano_calendario',
          type: 'number',
          required: true,
        },
        {
          name: 'exercicio',
          type: 'number',
          required: true,
        },
        {
          name: 'tipo_declaracao',
          type: 'select',
          values: ['original', 'retificadora'],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'status',
          type: 'select',
          values: ['rascunho', 'pronto', 'transmitido_supervisao'],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'modo_operacao',
          type: 'select',
          values: ['supervisionado', 'conector_oficial'],
          maxSelect: 1,
        },
        {
          name: 'faturamento_anual_declarado',
          type: 'number',
        },
        {
          name: 'total_das_pago',
          type: 'number',
        },
        {
          name: 'total_empregados_inicio',
          type: 'number',
        },
        {
          name: 'total_empregados_fim',
          type: 'number',
        },
        {
          name: 'elementos_fiscais_json',
          type: 'json',
        },
        {
          name: 'dados_societarios_json',
          type: 'json',
        },
        {
          name: 'recibo_numero',
          type: 'text',
        },
        {
          name: 'data_transmissao',
          type: 'date',
        },
        {
          name: 'transmitido_por',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
        },
        {
          name: 'observacoes',
          type: 'text',
        },
        {
          name: 'arquivo_exportado_txt',
          type: 'text',
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_defis_empresa_ano ON defis_declaracoes (empresa, ano_calendario, tipo_declaracao)',
        'CREATE INDEX idx_defis_tenant ON defis_declaracoes (tenant_id)',
        'CREATE INDEX idx_defis_status ON defis_declaracoes (status)',
        'CREATE INDEX idx_defis_created ON defis_declaracoes (created DESC)',
      ],
    })
    app.save(defisCollection)
    console.log('[MIGRATION_0087] Collection defis_declaracoes criada com sucesso.')
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('defis_declaracoes')
      app.delete(col)
      console.log('[MIGRATION_0087] Collection defis_declaracoes removida.')
    } catch (_) {}
  },
)

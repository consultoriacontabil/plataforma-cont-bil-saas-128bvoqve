migrate(
  (app) => {
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    const collection = new Collection({
      name: 'empresa_cadastro_assistido',
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
          name: 'arquivo_nome',
          type: 'text',
          required: false,
        },
        {
          name: 'arquivo',
          type: 'file',
          maxSelect: 1,
          maxSize: 26214400, // 25 MB
        },
        {
          name: 'tipo_documento',
          type: 'select',
          required: false,
          values: [
            'cartao_cnpj',
            'contrato_social',
            'ficha_cadastral',
            'cpf_socio',
            'comprovante_endereco',
            'declaracao_ir',
            'outro',
          ],
          maxSelect: 1,
        },
        {
          name: 'campos_extraidos',
          type: 'json',
          required: false,
        },
        {
          name: 'alertas',
          type: 'json',
          required: false,
        },
        {
          name: 'acoes',
          type: 'json',
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
        'CREATE INDEX idx_empresa_cad_assistido_tenant ON empresa_cadastro_assistido (tenant_id)',
        'CREATE INDEX idx_empresa_cad_assistido_empresa ON empresa_cadastro_assistido (empresa)',
        'CREATE INDEX idx_empresa_cad_assistido_created ON empresa_cadastro_assistido (created DESC)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('empresa_cadastro_assistido')
      app.delete(collection)
    } catch (_) {}
  },
)

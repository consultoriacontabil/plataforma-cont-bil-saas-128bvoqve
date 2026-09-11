/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const empresas = app.findCollectionByNameOrId('empresas')
    const tenantsId = tenants.id
    const empresasId = empresas.id

    // 1. Criar coleção certificados_digitais
    const certificados = new Collection({
      name: 'certificados_digitais',
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
          name: 'tipo',
          type: 'select',
          values: ['a1', 'a3'],
          maxSelect: 1,
        },
        {
          name: 'titular',
          type: 'text',
          required: true,
        },
        {
          name: 'numero_serie',
          type: 'text',
        },
        {
          name: 'emissor',
          type: 'text',
          required: true,
        },
        {
          name: 'validade',
          type: 'date',
          required: true,
        },
        {
          name: 'arquivo_pfx',
          type: 'file',
          maxSelect: 1,
          maxSize: 10485760, // 10MB
          mimeTypes: [
            'application/x-pkcs12',
            'application/octet-stream',
            'application/x-x509-ca-cert',
          ],
          protected: true,
        },
        {
          name: 'senha',
          type: 'text',
        },
        {
          name: 'status',
          type: 'select',
          values: ['ativo', 'expirado', 'revogado'],
          maxSelect: 1,
        },
        {
          name: 'observacoes',
          type: 'text',
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_certificados_tenant_emp ON certificados_digitais (tenant_id, empresa)',
        'CREATE INDEX idx_certificados_validade ON certificados_digitais (validade ASC)',
        'CREATE INDEX idx_certificados_status ON certificados_digitais (status)',
        'CREATE INDEX idx_certificados_created ON certificados_digitais (created DESC)',
      ],
    })
    app.save(certificados)

    // 2. Adicionar campo exige_certificado na coleção obrigacoes caso não exista
    const obrigacoes = app.findCollectionByNameOrId('obrigacoes')
    if (!obrigacoes.fields.getByName('exige_certificado')) {
      obrigacoes.fields.add(
        new BoolField({
          name: 'exige_certificado',
          required: false,
        }),
      )
      app.save(obrigacoes)
    }
  },
  (app) => {
    try {
      const obrigacoes = app.findCollectionByNameOrId('obrigacoes')
      if (obrigacoes.fields.getByName('exige_certificado')) {
        obrigacoes.fields.removeByName('exige_certificado')
        app.save(obrigacoes)
      }
    } catch (_) {}

    try {
      const certificados = app.findCollectionByNameOrId('certificados_digitais')
      app.delete(certificados)
    } catch (_) {}
  },
)

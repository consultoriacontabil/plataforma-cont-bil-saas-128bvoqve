/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const empresas = app.findCollectionByNameOrId('empresas')
    const demonstrativos = app.findCollectionByNameOrId('demonstrativos')

    const tenantsId = tenants.id
    const empresasId = empresas.id
    const demonstrativosId = demonstrativos.id

    // Coleção: assinaturas_demonstrativos
    // tenant_id, demonstrativo, empresa, competencia, tipo_assinatura (eletronica_declarada | icp_brasil),
    // tipo_certificado (nenhum | a1 | a3), assinante, cargo_cpf, email_assinante,
    // hash_conteudo, hash_documentacao, status (solicitada | assinada | expirada | cancelada),
    // token_verificacao, data_solicitacao, data_assinatura, dados_certificado (json),
    // ip_assinatura, provedor (interno | d4sign | clicksign | outro), payload_provedor (json)
    const assinaturasDemonstrativos = new Collection({
      name: 'assinaturas_demonstrativos',
      type: 'base',
      listRule: '', // Leitura pública permitida para verificação de autenticidade pelo token
      viewRule: '', // Visualização pública permitida por token_verificacao
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
          name: 'demonstrativo',
          type: 'relation',
          required: true,
          collectionId: demonstrativosId,
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
          name: 'tipo_assinatura',
          type: 'select',
          required: true,
          values: ['eletronica_declarada', 'icp_brasil'],
          maxSelect: 1,
        },
        {
          name: 'tipo_certificado',
          type: 'select',
          values: ['nenhum', 'a1', 'a3'],
          maxSelect: 1,
        },
        { name: 'assinante', type: 'text', required: true },
        { name: 'cargo_cpf', type: 'text', required: true },
        { name: 'email_assinante', type: 'email' },
        { name: 'hash_conteudo', type: 'text', required: true },
        { name: 'hash_documentacao', type: 'text' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['solicitada', 'assinada', 'expirada', 'cancelada'],
          maxSelect: 1,
        },
        { name: 'token_verificacao', type: 'text', required: true },
        { name: 'data_solicitacao', type: 'date' },
        { name: 'data_assinatura', type: 'date' },
        { name: 'dados_certificado', type: 'json' },
        { name: 'ip_assinatura', type: 'text' },
        {
          name: 'provedor',
          type: 'select',
          required: true,
          values: ['interno', 'd4sign', 'clicksign', 'outro'],
          maxSelect: 1,
        },
        { name: 'payload_provedor', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_ass_dem_tenant_dem ON assinaturas_demonstrativos (tenant_id, demonstrativo)',
        'CREATE INDEX idx_ass_dem_token ON assinaturas_demonstrativos (token_verificacao)',
        'CREATE INDEX idx_ass_dem_status ON assinaturas_demonstrativos (status)',
        'CREATE INDEX idx_ass_dem_created ON assinaturas_demonstrativos (created DESC)',
      ],
    })
    app.save(assinaturasDemonstrativos)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('assinaturas_demonstrativos')
      app.delete(col)
    } catch (_) {}
  },
)

/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const waEnviosCol = app.findCollectionByNameOrId('whatsapp_envios')
    const tenantsId = tenantsCol.id
    const empresasId = empresasCol.id
    const waEnviosId = waEnviosCol.id

    // 1. Atualizar whatsapp_notificacoes_autorizadas adicionando campo permitir_cobrancas
    const waAutorizCol = app.findCollectionByNameOrId('whatsapp_notificacoes_autorizadas')
    if (!waAutorizCol.fields.getByName('permitir_cobrancas')) {
      waAutorizCol.fields.add(
        new BoolField({
          name: 'permitir_cobrancas',
        }),
      )
      app.save(waAutorizCol)
    }

    // 2. Atualizar whatsapp_envios permitindo tipo 'cobranca' e 'teste' no select
    const waTipoField = waEnviosCol.fields.getByName('tipo')
    if (waTipoField) {
      waTipoField.values = [
        'aviso',
        'guia',
        'demonstrativo',
        'previa',
        'documento',
        'cobranca',
        'teste',
      ]
      app.save(waEnviosCol)
    }

    // 3. Atualizar nfse_config para suportar chave_pix_padrao e beneficiario_padrao do escritório
    const nfseCfgCol = app.findCollectionByNameOrId('nfse_config')
    if (!nfseCfgCol.fields.getByName('chave_pix_padrao')) {
      nfseCfgCol.fields.add(
        new TextField({
          name: 'chave_pix_padrao',
        }),
      )
    }
    if (!nfseCfgCol.fields.getByName('beneficiario_padrao')) {
      nfseCfgCol.fields.add(
        new TextField({
          name: 'beneficiario_padrao',
        }),
      )
    }
    app.save(nfseCfgCol)

    // 4. Criar Collection cobrancas
    try {
      app.findCollectionByNameOrId('cobrancas')
    } catch (_) {
      const cobrancasCol = new Collection({
        name: 'cobrancas',
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
            values: ['pix', 'boleto'],
            maxSelect: 1,
          },
          { name: 'descricao', type: 'text', required: true },
          { name: 'competencia', type: 'text' },
          { name: 'valor', type: 'number', required: true },
          { name: 'vencimento', type: 'date', required: true },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['pendente', 'pago', 'cancelado', 'vencido'],
            maxSelect: 1,
          },
          { name: 'chave_pix', type: 'text' },
          { name: 'beneficiario_nome', type: 'text' },
          { name: 'codigo_barras', type: 'text' },
          { name: 'payload_pix', type: 'text' },
          { name: 'link_boleto', type: 'text' },
          {
            name: 'whatsapp_envio_id',
            type: 'relation',
            collectionId: waEnviosId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'pago_em', type: 'date' },
          { name: 'pago_valor', type: 'number' },
          { name: 'observacoes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_cobrancas_tenant_emp ON cobrancas (tenant_id, empresa)',
          'CREATE INDEX idx_cobrancas_status ON cobrancas (status)',
          'CREATE INDEX idx_cobrancas_vencimento ON cobrancas (vencimento)',
          'CREATE INDEX idx_cobrancas_tipo ON cobrancas (tipo)',
        ],
      })
      app.save(cobrancasCol)
    }
  },
  (app) => {
    try {
      const c = app.findCollectionByNameOrId('cobrancas')
      app.delete(c)
    } catch (_) {}
  },
)

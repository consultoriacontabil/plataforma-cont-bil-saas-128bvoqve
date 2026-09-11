/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const empresas = app.findCollectionByNameOrId('empresas')
    const tenantsId = tenants.id
    const empresasId = empresas.id

    // 1. Criar coleção certidoes
    const certidoes = new Collection({
      name: 'certidoes',
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
          required: true,
          values: [
            'receita_pgfn_cnd',
            'receita_pgfn_cpen',
            'fgts_crf',
            'estadual',
            'municipal',
            'trabalhista_cndt',
          ],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['valida', 'pendente_emissao', 'vencida', 'positiva_sem_efeito'],
          maxSelect: 1,
        },
        {
          name: 'numero_controle',
          type: 'text',
        },
        {
          name: 'data_emissao',
          type: 'date',
        },
        {
          name: 'data_validade',
          type: 'date',
          required: true,
        },
        {
          name: 'arquivo_pdf',
          type: 'file',
          maxSelect: 1,
          maxSize: 15728640, // 15MB
          mimeTypes: ['application/pdf'],
          protected: false,
        },
        {
          name: 'origem',
          type: 'select',
          required: true,
          values: ['manual', 'automatica'],
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
        'CREATE INDEX idx_certidoes_tenant_empresa ON certidoes (tenant_id, empresa)',
        'CREATE INDEX idx_certidoes_validade ON certidoes (data_validade ASC)',
        'CREATE INDEX idx_certidoes_status ON certidoes (status)',
        'CREATE INDEX idx_certidoes_tipo ON certidoes (tipo)',
      ],
    })
    app.save(certidoes)

    // 2. Criar coleção ecac_comunicacoes
    const ecac = new Collection({
      name: 'ecac_comunicacoes',
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
          required: true,
          values: [
            'intimacao_fiscal',
            'notificacao_lancamento',
            'pendencia_cadastral',
            'exclusao_simples',
            'cobranca_parcelamento',
            'aviso_geral',
          ],
          maxSelect: 1,
        },
        {
          name: 'assunto',
          type: 'text',
          required: true,
        },
        {
          name: 'conteudo',
          type: 'text',
        },
        {
          name: 'data_comunicacao',
          type: 'date',
          required: true,
        },
        {
          name: 'data_limite_resposta',
          type: 'date',
        },
        {
          name: 'lida',
          type: 'bool',
        },
        {
          name: 'criticidade',
          type: 'select',
          required: true,
          values: ['baixa', 'media', 'alta'],
          maxSelect: 1,
        },
        {
          name: 'anexo',
          type: 'file',
          maxSelect: 1,
          maxSize: 15728640, // 15MB
          mimeTypes: [
            'application/pdf',
            'application/zip',
            'application/x-zip-compressed',
            'image/jpeg',
            'image/png',
          ],
          protected: false,
        },
        {
          name: 'numero_processo',
          type: 'text',
        },
        {
          name: 'origem_captura',
          type: 'select',
          values: ['manual_supervisionado', 'automatica_conector'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_ecac_tenant_empresa ON ecac_comunicacoes (tenant_id, empresa)',
        'CREATE INDEX idx_ecac_data ON ecac_comunicacoes (data_comunicacao DESC)',
        'CREATE INDEX idx_ecac_criticidade ON ecac_comunicacoes (criticidade)',
        'CREATE INDEX idx_ecac_lida ON ecac_comunicacoes (lida)',
      ],
    })
    app.save(ecac)
  },
  (app) => {
    try {
      const ecac = app.findCollectionByNameOrId('ecac_comunicacoes')
      app.delete(ecac)
    } catch (_) {}

    try {
      const certidoes = app.findCollectionByNameOrId('certidoes')
      app.delete(certidoes)
    } catch (_) {}
  },
)

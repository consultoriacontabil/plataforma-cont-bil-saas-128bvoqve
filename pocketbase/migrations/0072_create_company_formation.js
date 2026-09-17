migrate(
  (app) => {
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    const collection = new Collection({
      name: 'company_formation',
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
          required: true,
          collectionId: empresasCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'natureza_juridica',
          type: 'select',
          required: true,
          values: [
            'slu',
            'ltda',
            'mei',
            'ei',
            'eireli_extinta',
            'sa_fechada',
            'sa_aberta',
            'sociedade_simples_pura',
            'sociedade_simples_ltda',
            'associacao',
          ],
          maxSelect: 1,
        },
        {
          name: 'porte_pretendido',
          type: 'select',
          required: false,
          values: ['mei', 'me', 'epp', 'demais'],
          maxSelect: 1,
        },
        {
          name: 'regime_pretendido',
          type: 'select',
          required: false,
          values: ['simples_nacional', 'simei', 'lucro_presumido', 'lucro_real'],
          maxSelect: 1,
        },
        {
          name: 'status_processo',
          type: 'select',
          required: false,
          values: [
            'nao_iniciado',
            'em_andamento',
            'pendencia_documental',
            'protocolado_junta',
            'registrado_concluido',
            'cancelado',
          ],
          maxSelect: 1,
        },
        {
          name: 'capital_social_total',
          type: 'number',
          required: false,
        },
        {
          name: 'quotas_total',
          type: 'number',
          required: false,
        },
        {
          name: 'valor_nominal_quota',
          type: 'number',
          required: false,
        },
        {
          name: 'socios_json',
          type: 'json',
          required: false,
        },
        {
          name: 'cnaes_json',
          type: 'json',
          required: false,
        },
        {
          name: 'etapas_json',
          type: 'json',
          required: false,
        },
        {
          name: 'documentos_checklist_json',
          type: 'json',
          required: false,
        },
        {
          name: 'base_legal_versao',
          type: 'text',
          required: false,
        },
        {
          name: 'integracao_gerada',
          type: 'bool',
          required: false,
        },
        {
          name: 'dados_fiscais_integrados_em',
          type: 'date',
          required: false,
        },
        {
          name: 'observacoes',
          type: 'text',
          required: false,
        },
        {
          name: 'responsavel',
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
        'CREATE INDEX idx_company_formation_tenant ON company_formation (tenant_id)',
        'CREATE UNIQUE INDEX idx_company_formation_empresa ON company_formation (empresa)',
        'CREATE INDEX idx_company_formation_status ON company_formation (status_processo)',
        'CREATE INDEX idx_company_formation_natureza ON company_formation (natureza_juridica)',
        'CREATE INDEX idx_company_formation_created ON company_formation (created DESC)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('company_formation')
      app.delete(collection)
    } catch (_) {}
  },
)

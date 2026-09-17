migrate(
  (app) => {
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    const collection = new Collection({
      name: 'company_onboarding_workflow',
      type: 'base',
      // Permite leitura pública por token de link e leitura autenticada multi-tenant
      listRule: "@request.auth.id != '' || token != ''",
      viewRule: "@request.auth.id != '' || token != ''",
      // Criação autenticada por contadores/administradores da plataforma
      createRule: "@request.auth.id != ''",
      // Edição permitida autenticada ou atualização pública se o token bater com o record
      updateRule: "@request.auth.id != '' || (token != '' && token = @request.body.token)",
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
          name: 'empresa_id',
          type: 'relation',
          required: false,
          collectionId: empresasCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'solicitante_id',
          type: 'relation',
          required: false,
          collectionId: usersCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'titulo',
          type: 'text',
          required: true,
        },
        {
          name: 'razao_social_pretendida',
          type: 'text',
          required: false,
        },
        {
          name: 'nome_fantasia_pretendido',
          type: 'text',
          required: false,
        },
        {
          name: 'natureza_juridica',
          type: 'select',
          required: false,
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
          name: 'status',
          type: 'select',
          required: true,
          values: ['em_andamento', 'aguardando_cliente', 'em_analise', 'concluido', 'cancelado'],
          maxSelect: 1,
        },
        {
          name: 'pipeline_etapas_json',
          type: 'json',
          required: false,
        },
        {
          name: 'checklist_docs_json',
          type: 'json',
          required: false,
        },
        {
          name: 'dados_preliminares_json',
          type: 'json',
          required: false,
        },
        {
          name: 'token',
          type: 'text',
          required: true,
        },
        {
          name: 'link_ativo',
          type: 'bool',
          required: false,
        },
        {
          name: 'expira_em',
          type: 'date',
          required: false,
        },
        {
          name: 'cliente_nome',
          type: 'text',
          required: false,
        },
        {
          name: 'cliente_email',
          type: 'email',
          required: false,
        },
        {
          name: 'cliente_telefone',
          type: 'text',
          required: false,
        },
        {
          name: 'observacoes',
          type: 'text',
          required: false,
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
        'CREATE INDEX idx_cow_tenant ON company_onboarding_workflow (tenant_id)',
        'CREATE UNIQUE INDEX idx_cow_token ON company_onboarding_workflow (token)',
        'CREATE INDEX idx_cow_status ON company_onboarding_workflow (status)',
        'CREATE INDEX idx_cow_empresa ON company_onboarding_workflow (empresa_id)',
        'CREATE INDEX idx_cow_created ON company_onboarding_workflow (created DESC)',
      ],
    })

    app.save(collection)

    // Ajusta as regras da coleção 'documentos' para permitir anexos pelo cliente via link público de abertura
    // sem exigir login do usuário, desde que origem_documento = 'link_publico'
    try {
      const docsCol = app.findCollectionByNameOrId('documentos')
      // Se a regra atual requer login, adicionamos exceção controlada para link público
      docsCol.createRule =
        "@request.auth.id != '' || @request.body.origem_documento = 'link_publico'"
      docsCol.viewRule = "@request.auth.id != '' || origem_documento = 'link_publico'"
      app.save(docsCol)
    } catch (e) {
      console.log('Não foi possível ajustar regra de documentos:', e)
    }
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('company_onboarding_workflow')
      app.delete(collection)
    } catch (_) {}
  },
)

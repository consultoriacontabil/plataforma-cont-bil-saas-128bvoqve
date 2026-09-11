migrate(
  (app) => {
    // 1. Update users collection with avatar file field if not already present
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!users.fields.getByName('avatar')) {
      users.fields.add(
        new FileField({
          name: 'avatar',
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        }),
      )
      app.save(users)
    }

    // 2. Collection: tenants
    const tenants = new Collection({
      name: 'tenants',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: null,
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'cnpj', type: 'text' },
        { name: 'plano', type: 'select', values: ['starter', 'pro', 'enterprise'], maxSelect: 1 },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_tenants_created ON tenants (created DESC)'],
    })
    app.save(tenants)
    const tenantsId = tenants.id

    // 3. Collection: tenant_members
    const tenantMembers = new Collection({
      name: 'tenant_members',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'tenant_id',
          type: 'relation',
          required: true,
          collectionId: tenantsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'perfil',
          type: 'select',
          values: ['administrador', 'contador', 'auxiliar', 'consultor'],
          maxSelect: 1,
        },
        { name: 'status', type: 'select', values: ['ativo', 'convite_pendente'], maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_tenant_members_tenant ON tenant_members (tenant_id)',
        'CREATE INDEX idx_tenant_members_user ON tenant_members (user_id)',
      ],
    })
    app.save(tenantMembers)

    // 4. Collection: empresas
    const empresas = new Collection({
      name: 'empresas',
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
        { name: 'razao_social', type: 'text', required: true },
        { name: 'nome_fantasia', type: 'text' },
        { name: 'cnpj', type: 'text', required: true },
        { name: 'inscricao_estadual', type: 'text' },
        { name: 'inscricao_municipal', type: 'text' },
        {
          name: 'regime_tributario',
          type: 'select',
          values: ['simples_nacional', 'lucro_presumido', 'lucro_real', 'mei'],
          maxSelect: 1,
        },
        { name: 'porte', type: 'select', values: ['mei', 'me', 'epp', 'demais'], maxSelect: 1 },
        { name: 'data_abertura', type: 'date' },
        { name: 'cep', type: 'text' },
        { name: 'logradouro', type: 'text' },
        { name: 'numero', type: 'text' },
        { name: 'complemento', type: 'text' },
        { name: 'bairro', type: 'text' },
        { name: 'cidade', type: 'text' },
        { name: 'uf', type: 'text' },
        { name: 'pais', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'telefone', type: 'text' },
        { name: 'site', type: 'url' },
        { name: 'observacoes', type: 'text' },
        {
          name: 'status',
          type: 'select',
          values: ['ativo', 'inativo', 'pendente', 'encerrado'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_empresas_tenant_status ON empresas (tenant_id, status)',
        'CREATE INDEX idx_empresas_created ON empresas (created DESC)',
      ],
    })
    app.save(empresas)
    const empresasId = empresas.id

    // 5. Collection: documentos
    const documentos = new Collection({
      name: 'documentos',
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
          name: 'empresa_id',
          type: 'relation',
          required: true,
          collectionId: empresasId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'nome_arquivo', type: 'text', required: true },
        {
          name: 'tipo',
          type: 'select',
          values: [
            'contrato_social',
            'alteracao_contratual',
            'fatura',
            'nota_fiscal',
            'procuracoes',
            'relatorios',
            'outros',
          ],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          values: ['pendente', 'processado', 'rejeitado'],
          maxSelect: 1,
        },
        { name: 'observacoes', type: 'text' },
        {
          name: 'arquivo',
          type: 'file',
          maxSelect: 1,
          maxSize: 26214400,
          mimeTypes: [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          ],
        },
        {
          name: 'usuario_upload_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'data_upload', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_documentos_tenant_empresa ON documentos (tenant_id, empresa_id)',
        'CREATE INDEX idx_documentos_tipo_status ON documentos (tipo, status)',
        'CREATE INDEX idx_documentos_created ON documentos (created DESC)',
      ],
    })
    app.save(documentos)

    // 6. Collection: workflows
    const workflows = new Collection({
      name: 'workflows',
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
          name: 'empresa_id',
          type: 'relation',
          collectionId: empresasId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'tipo',
          type: 'select',
          values: [
            'abertura_empresa',
            'alteracao_contratual',
            'envio_obrigacao',
            'revisao_documento',
            'outros',
          ],
          maxSelect: 1,
        },
        { name: 'titulo', type: 'text', required: true },
        { name: 'descricao', type: 'text' },
        { name: 'prioridade', type: 'select', values: ['alta', 'media', 'baixa'], maxSelect: 1 },
        {
          name: 'status',
          type: 'select',
          values: ['pendente', 'em_andamento', 'concluido', 'cancelado'],
          maxSelect: 1,
        },
        { name: 'prazo', type: 'date' },
        { name: 'atribuido_id', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        {
          name: 'criado_por_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_workflows_tenant_status ON workflows (tenant_id, status)',
        'CREATE INDEX idx_workflows_prazo ON workflows (prazo ASC)',
      ],
    })
    app.save(workflows)
    const workflowsId = workflows.id

    // 7. Collection: workflow_activity
    const workflowActivity = new Collection({
      name: 'workflow_activity',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: null,
      deleteRule: null,
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
          name: 'workflow_id',
          type: 'relation',
          required: true,
          collectionId: workflowsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'usuario_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'acao', type: 'text', required: true },
        { name: 'comentario', type: 'text' },
        { name: 'data_atividade', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_wf_activity_workflow ON workflow_activity (workflow_id)',
        'CREATE INDEX idx_wf_activity_created ON workflow_activity (created DESC)',
      ],
    })
    app.save(workflowActivity)

    // 8. Collection: fiscal
    const fiscal = new Collection({
      name: 'fiscal',
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
          name: 'empresa_id',
          type: 'relation',
          required: true,
          collectionId: empresasId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'tipo_obrigacao',
          type: 'select',
          values: ['ecf', 'ecd', 'efd_contribuicoes', 'dctf', 'gia', 'pis_cofins', 'icms', 'iss'],
          maxSelect: 1,
        },
        { name: 'periodo_apuracao', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          values: ['pendente', 'em_andamento', 'entregue', 'aprovado', 'rejeitado'],
          maxSelect: 1,
        },
        { name: 'data_entrega', type: 'date' },
        {
          name: 'recibo_arquivo',
          type: 'file',
          maxSelect: 1,
          maxSize: 26214400,
          mimeTypes: ['application/pdf'],
        },
        { name: 'observacoes', type: 'text' },
        { name: 'responsavel_id', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_fiscal_tenant_status ON fiscal (tenant_id, status)',
        'CREATE INDEX idx_fiscal_empresa_tipo ON fiscal (empresa_id, tipo_obrigacao)',
        'CREATE INDEX idx_fiscal_created ON fiscal (created DESC)',
      ],
    })
    app.save(fiscal)

    // 9. Collection: audit_log
    const auditLog = new Collection({
      name: 'audit_log',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: null,
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
        { name: 'usuario_id', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'acao', type: 'text', required: true },
        { name: 'entidade_tipo', type: 'text', required: true },
        { name: 'entidade_id', type: 'text', required: true },
        { name: 'detalhes', type: 'text' },
        { name: 'data_evento', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_audit_log_tenant ON audit_log (tenant_id)',
        'CREATE INDEX idx_audit_log_entidade ON audit_log (entidade_tipo, entidade_id)',
        'CREATE INDEX idx_audit_log_created ON audit_log (created DESC)',
      ],
    })
    app.save(auditLog)

    // 10. Collection: agent_conversations
    const agentConversations = new Collection({
      name: 'agent_conversations',
      type: 'base',
      listRule: "@request.auth.id != '' && user_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && user_id = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && user_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user_id = @request.auth.id",
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
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'titulo', type: 'text' },
        { name: 'resumo', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_agent_conv_user ON agent_conversations (user_id)',
        'CREATE INDEX idx_agent_conv_tenant ON agent_conversations (tenant_id)',
      ],
    })
    app.save(agentConversations)
    const agentConversationsId = agentConversations.id

    // 11. Collection: agent_messages
    const agentMessages = new Collection({
      name: 'agent_messages',
      type: 'base',
      listRule: "@request.auth.id != '' && user_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && user_id = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: null,
      deleteRule: null,
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
          name: 'conversation_id',
          type: 'relation',
          required: true,
          collectionId: agentConversationsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'role', type: 'select', values: ['user', 'agent'], maxSelect: 1 },
        { name: 'conteudo', type: 'text', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_agent_msg_conv ON agent_messages (conversation_id)',
        'CREATE INDEX idx_agent_msg_created ON agent_messages (created ASC)',
      ],
    })
    app.save(agentMessages)
  },
  (app) => {
    const collections = [
      'agent_messages',
      'agent_conversations',
      'audit_log',
      'fiscal',
      'workflow_activity',
      'workflows',
      'documentos',
      'empresas',
      'tenant_members',
      'tenants',
    ]
    for (let i = 0; i < collections.length; i++) {
      try {
        const col = app.findCollectionByNameOrId(collections[i])
        app.delete(col)
      } catch (_) {}
    }
  },
)

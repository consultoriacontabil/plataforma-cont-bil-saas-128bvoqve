/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const empresas = app.findCollectionByNameOrId('empresas')
    const certificados = app.findCollectionByNameOrId('certificados_digitais')
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const documentos = app.findCollectionByNameOrId('documentos')

    const tenantsId = tenants.id
    const empresasId = empresas.id
    const certificadosId = certificados.id
    const usersId = users.id
    const documentosId = documentos.id

    // 1. Ampliar coleção documentos: adicionar origem_documento e chave_acesso_nfe se não existirem
    if (!documentos.fields.getByName('origem_documento')) {
      documentos.fields.add(
        new SelectField({
          name: 'origem_documento',
          required: false,
          values: ['upload_manual', 'busca_sefaz', 'integracao_rfb', 'sistema'],
          maxSelect: 1,
        }),
      )
    }
    if (!documentos.fields.getByName('chave_acesso_nfe')) {
      documentos.fields.add(
        new TextField({
          name: 'chave_acesso_nfe',
          required: false,
        }),
      )
      documentos.addIndex('idx_documentos_chave_nfe', false, 'empresa_id, chave_acesso_nfe', '')
    }
    app.save(documentos)

    // 2. Criar coleção nfe_config
    // Configurações de busca automática de NF-e por empresa
    // Regras de acesso: Cliente não acessa; Auxiliar pode visualizar; Contador e Administrador criam/editam
    const nfeConfig = new Collection({
      name: 'nfe_config',
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
          name: 'busca_automatica_ativa',
          type: 'bool',
        },
        {
          name: 'ambiente',
          type: 'select',
          required: true,
          values: ['producao', 'homologacao'],
          maxSelect: 1,
        },
        {
          name: 'certificado_a1',
          type: 'relation',
          collectionId: certificadosId,
          maxSelect: 1,
        },
        {
          name: 'senha_certificado',
          type: 'text',
        },
        {
          name: 'ultimo_nsu',
          type: 'text',
        },
        {
          name: 'max_nsu',
          type: 'text',
        },
        {
          name: 'auto_importar_ged',
          type: 'bool',
        },
        {
          name: 'auto_ciencia_operacao',
          type: 'bool',
        },
        {
          name: 'status_conexao',
          type: 'select',
          values: ['conectado', 'modo_supervisao', 'erro_credenciais', 'desconectado'],
          maxSelect: 1,
        },
        {
          name: 'ultimo_diagnostico_json',
          type: 'json',
        },
        {
          name: 'ultima_sincronizacao_em',
          type: 'date',
        },
        {
          name: 'total_notas_recebidas',
          type: 'number',
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_nfe_config_empresa ON nfe_config (empresa)',
        'CREATE INDEX idx_nfe_config_tenant ON nfe_config (tenant_id)',
        'CREATE INDEX idx_nfe_config_ativa ON nfe_config (busca_automatica_ativa)',
      ],
    })
    app.save(nfeConfig)

    // 3. Criar coleção nfe_recebidas
    // Notas fiscais recebidas contra o CNPJ da empresa
    const nfeRecebidas = new Collection({
      name: 'nfe_recebidas',
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
          name: 'chave_acesso',
          type: 'text',
          required: true,
        },
        {
          name: 'numero',
          type: 'text',
        },
        {
          name: 'serie',
          type: 'text',
        },
        {
          name: 'cnpj_emitente',
          type: 'text',
          required: true,
        },
        {
          name: 'razao_social_emitente',
          type: 'text',
          required: true,
        },
        {
          name: 'nome_fantasia_emitente',
          type: 'text',
        },
        {
          name: 'uf_emitente',
          type: 'text',
        },
        {
          name: 'data_emissao',
          type: 'date',
        },
        {
          name: 'data_autorizacao',
          type: 'date',
        },
        {
          name: 'valor_total',
          type: 'number',
        },
        {
          name: 'valor_icms',
          type: 'number',
        },
        {
          name: 'cfop_principal',
          type: 'text',
        },
        {
          name: 'natureza_operacao',
          type: 'text',
        },
        {
          name: 'nsu',
          type: 'text',
        },
        {
          name: 'tipo_operacao',
          type: 'select',
          values: ['0_entrada', '1_saida'],
          maxSelect: 1,
        },
        {
          name: 'status_sefaz',
          type: 'select',
          values: ['autorizada', 'cancelada', 'denegada'],
          maxSelect: 1,
        },
        {
          name: 'status_manifestacao',
          type: 'select',
          values: ['sem_manifestacao', 'ciencia', 'confirmada', 'desconhecida', 'nao_realizada'],
          maxSelect: 1,
        },
        {
          name: 'data_manifestacao',
          type: 'date',
        },
        {
          name: 'justificativa_manifestacao',
          type: 'text',
        },
        {
          name: 'manifestado_por',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
        },
        {
          name: 'documento_ged',
          type: 'relation',
          collectionId: documentosId,
          maxSelect: 1,
        },
        {
          name: 'xml_armazenado',
          type: 'text',
        },
        {
          name: 'origem_captura',
          type: 'select',
          values: ['busca_sefaz_auto', 'chave_manual_publica', 'importacao_xml'],
          maxSelect: 1,
        },
        {
          name: 'metadados_json',
          type: 'json',
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_nfe_recebidas_empresa_chave ON nfe_recebidas (empresa, chave_acesso)',
        'CREATE INDEX idx_nfe_recebidas_tenant ON nfe_recebidas (tenant_id)',
        'CREATE INDEX idx_nfe_recebidas_status_manif ON nfe_recebidas (status_manifestacao)',
        'CREATE INDEX idx_nfe_recebidas_data_emissao ON nfe_recebidas (data_emissao DESC)',
      ],
    })
    app.save(nfeRecebidas)

    // 4. Criar coleção nfe_sync_logs
    // Histórico de sincronizações da busca automática de NF-e
    const nfeSyncLogs = new Collection({
      name: 'nfe_sync_logs',
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
          name: 'origem_acionamento',
          type: 'select',
          required: true,
          values: ['manual', 'cron_diario', 'teste_credenciais', 'consulta_chave_manual'],
          maxSelect: 1,
        },
        {
          name: 'sucesso',
          type: 'bool',
        },
        {
          name: 'modo_operacao',
          type: 'select',
          values: ['sefaz_distribuicao_real', 'modo_supervisao', 'consulta_publica'],
          maxSelect: 1,
        },
        {
          name: 'notas_encontradas',
          type: 'number',
        },
        {
          name: 'notas_novas_importadas',
          type: 'number',
        },
        {
          name: 'ultimo_nsu_consultado',
          type: 'text',
        },
        {
          name: 'duracao_ms',
          type: 'number',
        },
        {
          name: 'mensagem',
          type: 'text',
          required: true,
        },
        {
          name: 'detalhes_json',
          type: 'json',
        },
        {
          name: 'executado_por',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_nfe_logs_empresa ON nfe_sync_logs (empresa, created DESC)',
        'CREATE INDEX idx_nfe_logs_tenant ON nfe_sync_logs (tenant_id)',
        'CREATE INDEX idx_nfe_logs_created ON nfe_sync_logs (created DESC)',
      ],
    })
    app.save(nfeSyncLogs)
  },
  (app) => {
    try {
      const nfeSyncLogs = app.findCollectionByNameOrId('nfe_sync_logs')
      app.delete(nfeSyncLogs)
    } catch (_) {}

    try {
      const nfeRecebidas = app.findCollectionByNameOrId('nfe_recebidas')
      app.delete(nfeRecebidas)
    } catch (_) {}

    try {
      const nfeConfig = app.findCollectionByNameOrId('nfe_config')
      app.delete(nfeConfig)
    } catch (_) {}

    try {
      const docs = app.findCollectionByNameOrId('documentos')
      if (docs.fields.getByName('chave_acesso_nfe')) {
        docs.removeIndex('idx_documentos_chave_nfe')
        docs.fields.removeByName('chave_acesso_nfe')
      }
      if (docs.fields.getByName('origem_documento')) {
        docs.fields.removeByName('origem_documento')
      }
      app.save(docs)
    } catch (_) {}
  },
)

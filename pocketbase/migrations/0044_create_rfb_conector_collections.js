/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const empresas = app.findCollectionByNameOrId('empresas')
    const certificados = app.findCollectionByNameOrId('certificados_digitais')
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    const tenantsId = tenants.id
    const empresasId = empresas.id
    const certificadosId = certificados.id
    const usersId = users.id

    // 1. Criar coleção rfb_config
    // Regra: Cliente não acessa; Auxiliar pode ler (ver status); Contador e Administrador editam
    const rfbConfig = new Collection({
      name: 'rfb_config',
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
          name: 'ativo',
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
          name: 'cnpj_contribuinte',
          type: 'text',
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
          name: 'contrato_dte_id',
          type: 'text',
        },
        {
          name: 'token_ambiente_rfb',
          type: 'text',
        },
        {
          name: 'sincronizacao_automatica',
          type: 'bool',
        },
        {
          name: 'sincronizar_certidoes',
          type: 'bool',
        },
        {
          name: 'sincronizar_ecac',
          type: 'bool',
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
          name: 'status_conexao',
          type: 'select',
          values: ['conectado', 'erro_credenciais', 'modo_supervisao', 'desconectado'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_rfb_config_empresa ON rfb_config (empresa)',
        'CREATE INDEX idx_rfb_config_tenant ON rfb_config (tenant_id)',
        'CREATE INDEX idx_rfb_config_ativo ON rfb_config (ativo)',
      ],
    })
    app.save(rfbConfig)

    // 2. Criar coleção rfb_sync_logs
    const rfbSyncLogs = new Collection({
      name: 'rfb_sync_logs',
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
          values: ['manual', 'cron_diario', 'teste_credenciais'],
          maxSelect: 1,
        },
        {
          name: 'sucesso',
          type: 'bool',
        },
        {
          name: 'modo_operacao',
          type: 'select',
          values: ['conector_real', 'modo_supervisao'],
          maxSelect: 1,
        },
        {
          name: 'comunicacoes_novas',
          type: 'number',
        },
        {
          name: 'certidoes_atualizadas',
          type: 'number',
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
        'CREATE INDEX idx_rfb_logs_empresa ON rfb_sync_logs (empresa, created DESC)',
        'CREATE INDEX idx_rfb_logs_tenant ON rfb_sync_logs (tenant_id)',
        'CREATE INDEX idx_rfb_logs_created ON rfb_sync_logs (created DESC)',
      ],
    })
    app.save(rfbSyncLogs)

    // 3. Adicionar identificador_rfb na coleção ecac_comunicacoes para anti-duplicidade precisa
    const ecacCol = app.findCollectionByNameOrId('ecac_comunicacoes')
    if (!ecacCol.fields.getByName('identificador_rfb')) {
      ecacCol.fields.add(
        new TextField({
          name: 'identificador_rfb',
          required: false,
        }),
      )
      ecacCol.addIndex('idx_ecac_identificador_rfb', false, 'empresa, identificador_rfb', '')
      app.save(ecacCol)
    }
  },
  (app) => {
    try {
      const ecacCol = app.findCollectionByNameOrId('ecac_comunicacoes')
      if (ecacCol.fields.getByName('identificador_rfb')) {
        ecacCol.removeIndex('idx_ecac_identificador_rfb')
        ecacCol.fields.removeByName('identificador_rfb')
        app.save(ecacCol)
      }
    } catch (_) {}

    try {
      const rfbSyncLogs = app.findCollectionByNameOrId('rfb_sync_logs')
      app.delete(rfbSyncLogs)
    } catch (_) {}

    try {
      const rfbConfig = app.findCollectionByNameOrId('rfb_config')
      app.delete(rfbConfig)
    } catch (_) {}
  },
)

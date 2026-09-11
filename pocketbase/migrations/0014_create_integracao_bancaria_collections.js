/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const empresas = app.findCollectionByNameOrId('empresas')
    const contasBancarias = app.findCollectionByNameOrId('contas_bancarias')
    const tenantsId = tenants.id
    const empresasId = empresas.id
    const contasBancariasId = contasBancarias.id

    // 1. Criar coleção: integracoes_bancarias
    // tenant_id, empresa, conta_bancaria, modo: 'manual' | 'automatico', frequencia: 'diaria' | 'semanal',
    // fonte_tipo: 'email' | 'pasta_sftp' | 'webhook_simulado' | 'arquivo_agendado',
    // fonte_identificador: string (ex: extratos@inovatech.com.br ou /var/extratos/itau),
    // status: 'ativo' | 'pausado' | 'erro',
    // ultima_execucao: date, proxima_execucao: date,
    // total_importados: number, total_conciliados: number,
    // created, updated
    const integracoesBancarias = new Collection({
      name: 'integracoes_bancarias',
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
          name: 'conta_bancaria',
          type: 'relation',
          required: true,
          collectionId: contasBancariasId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'modo',
          type: 'select',
          required: true,
          values: ['manual', 'automatico'],
          maxSelect: 1,
        },
        {
          name: 'frequencia',
          type: 'select',
          required: true,
          values: ['diaria', 'semanal'],
          maxSelect: 1,
        },
        {
          name: 'fonte_tipo',
          type: 'select',
          required: true,
          values: ['email', 'pasta_sftp', 'webhook_simulado', 'arquivo_agendado'],
          maxSelect: 1,
        },
        { name: 'fonte_identificador', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['ativo', 'pausado', 'erro'],
          maxSelect: 1,
        },
        { name: 'ultima_execucao', type: 'date' },
        { name: 'proxima_execucao', type: 'date' },
        { name: 'total_importados', type: 'number' },
        { name: 'total_conciliados', type: 'number' },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_integracoes_tenant_emp ON integracoes_bancarias (tenant_id, empresa)',
        'CREATE INDEX idx_integracoes_conta ON integracoes_bancarias (conta_bancaria)',
        'CREATE INDEX idx_integracoes_status_modo ON integracoes_bancarias (status, modo)',
        'CREATE INDEX idx_integracoes_created ON integracoes_bancarias (created DESC)',
      ],
    })
    app.save(integracoesBancarias)
    const integracoesBancariasId = integracoesBancarias.id

    // 2. Criar coleção: integracoes_logs
    // tenant_id, integracao, conta_bancaria, data_execucao, status: 'sucesso' | 'aviso' | 'falha',
    // linhas_lidas, linhas_importadas, linhas_duplicadas, linhas_conciliadas, mensagem, detalhes_json
    const integracoesLogs = new Collection({
      name: 'integracoes_logs',
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
          name: 'integracao',
          type: 'relation',
          required: true,
          collectionId: integracoesBancariasId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'conta_bancaria',
          type: 'relation',
          required: true,
          collectionId: contasBancariasId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'data_execucao', type: 'date', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['sucesso', 'aviso', 'falha'],
          maxSelect: 1,
        },
        { name: 'linhas_lidas', type: 'number' },
        { name: 'linhas_importadas', type: 'number' },
        { name: 'linhas_duplicadas', type: 'number' },
        { name: 'linhas_conciliadas', type: 'number' },
        { name: 'mensagem', type: 'text' },
        { name: 'detalhes_json', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_intlogs_tenant_int ON integracoes_logs (tenant_id, integracao)',
        'CREATE INDEX idx_intlogs_conta ON integracoes_logs (conta_bancaria)',
        'CREATE INDEX idx_intlogs_data ON integracoes_logs (data_execucao DESC)',
      ],
    })
    app.save(integracoesLogs)
  },
  (app) => {
    try {
      const il = app.findCollectionByNameOrId('integracoes_logs')
      app.delete(il)
    } catch (_) {}

    try {
      const ib = app.findCollectionByNameOrId('integracoes_bancarias')
      app.delete(ib)
    } catch (_) {}
  },
)

/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const empresas = app.findCollectionByNameOrId('empresas')
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    const tenantsId = tenants.id
    const empresasId = empresas.id
    const usersId = users.id

    // 1. Coleção: nfse_config (Configuração por tenant do canal WhatsApp Evolution API / Fiscal)
    const nfseConfig = new Collection({
      name: 'nfse_config',
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
          name: 'empresa_padrao',
          type: 'relation',
          required: false,
          collectionId: empresasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'webhook_token', type: 'text', required: true },
        { name: 'evolution_api_url', type: 'text' },
        { name: 'evolution_api_key', type: 'text' },
        { name: 'evolution_instance', type: 'text' },
        {
          name: 'modo_operacao',
          type: 'select',
          required: true,
          values: ['simulacao', 'producao'],
          maxSelect: 1,
        },
        { name: 'auto_aprovar_alta_confianca', type: 'bool' },
        { name: 'msg_saudacao', type: 'text' },
        { name: 'msg_recebimento', type: 'text' },
        { name: 'msg_aprovacao', type: 'text' },
        { name: 'msg_rejeicao', type: 'text' },
        { name: 'msg_nota_emitida', type: 'text' },
        { name: 'telefone_suporte', type: 'text' },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_nfse_cfg_tenant ON nfse_config (tenant_id)',
        'CREATE INDEX idx_nfse_cfg_token ON nfse_config (webhook_token)',
      ],
    })
    app.save(nfseConfig)

    // 2. Coleção: nfse_solicitacoes (Fila de supervisão e motor cognitivo IA)
    const nfseSolicitacoes = new Collection({
      name: 'nfse_solicitacoes',
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
          required: false,
          collectionId: empresasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'contato_nome', type: 'text', required: true },
        { name: 'contato_telefone', type: 'text', required: true },
        { name: 'origem_chat_jid', type: 'text' },
        { name: 'mensagem_original', type: 'text', required: true },
        { name: 'mensagem_id_externo', type: 'text' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['em_analise', 'aprovada', 'emitida', 'rejeitada', 'cancelada'],
          maxSelect: 1,
        },
        { name: 'score_confianca', type: 'number' },
        { name: 'tomador_nome', type: 'text' },
        { name: 'tomador_documento', type: 'text' },
        { name: 'tomador_email', type: 'text' },
        { name: 'tomador_endereco', type: 'text' },
        { name: 'descricao_servico', type: 'text' },
        { name: 'valor_servico', type: 'number' },
        { name: 'codigo_servico', type: 'text' },
        { name: 'dados_extraidos_json', type: 'json' },
        { name: 'alertas_json', type: 'json' },
        { name: 'motivo_rejeicao', type: 'text' },
        {
          name: 'revisado_por',
          type: 'relation',
          required: false,
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'data_revisao', type: 'date' },
        { name: 'resposta_enviada_whatsapp', type: 'bool' },
        { name: 'historico_mensagens_json', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_nfse_sol_tenant_status ON nfse_solicitacoes (tenant_id, status)',
        'CREATE INDEX idx_nfse_sol_empresa ON nfse_solicitacoes (tenant_id, empresa)',
        'CREATE INDEX idx_nfse_sol_telefone ON nfse_solicitacoes (contato_telefone)',
        'CREATE INDEX idx_nfse_sol_created ON nfse_solicitacoes (created DESC)',
      ],
    })
    app.save(nfseSolicitacoes)

    // 3. Coleção: nfse_notas_emitidas (Histórico de notas fiscais emitidas via WhatsApp/Painel)
    const contasFinanceiras = app.findCollectionByNameOrId('contas_financeiras')
    const certificadosDigitais = app.findCollectionByNameOrId('certificados_digitais')
    const nfseSolicitacoesId = nfseSolicitacoes.id
    const contasFinId = contasFinanceiras.id
    const certsId = certificadosDigitais.id

    const nfseNotasEmitidas = new Collection({
      name: 'nfse_notas_emitidas',
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
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'solicitacao',
          type: 'relation',
          required: false,
          collectionId: nfseSolicitacoesId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'numero_nota', type: 'number', required: true },
        { name: 'serie', type: 'text' },
        { name: 'codigo_verificacao', type: 'text', required: true },
        { name: 'chave_acesso', type: 'text' },
        { name: 'data_emissao', type: 'date', required: true },
        { name: 'competencia', type: 'text', required: true },
        { name: 'tomador_nome', type: 'text', required: true },
        { name: 'tomador_documento', type: 'text', required: true },
        { name: 'tomador_email', type: 'text' },
        { name: 'discriminacao_servicos', type: 'text', required: true },
        { name: 'codigo_servico_municipal', type: 'text' },
        { name: 'valor_servicos', type: 'number', required: true },
        { name: 'valor_deducoes', type: 'number' },
        { name: 'valor_pis', type: 'number' },
        { name: 'valor_cofins', type: 'number' },
        { name: 'valor_inss', type: 'number' },
        { name: 'valor_ir', type: 'number' },
        { name: 'valor_csll', type: 'number' },
        { name: 'valor_iss', type: 'number' },
        { name: 'aliquota_iss', type: 'number' },
        { name: 'valor_liquido', type: 'number', required: true },
        { name: 'iss_retido', type: 'bool' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['emitida', 'cancelada', 'substituida'],
          maxSelect: 1,
        },
        {
          name: 'modo_emissao',
          type: 'select',
          required: true,
          values: ['simulacao', 'nacional_gov', 'prefeitura_ws'],
          maxSelect: 1,
        },
        {
          name: 'certificado_usado',
          type: 'relation',
          required: false,
          collectionId: certsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'xml_conteudo', type: 'text' },
        { name: 'pdf_html_conteudo', type: 'text' },
        {
          name: 'titulo_financeiro',
          type: 'relation',
          required: false,
          collectionId: contasFinId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'whatsapp_destinatario', type: 'text' },
        { name: 'whatsapp_enviado_em', type: 'date' },
        {
          name: 'emitido_por',
          type: 'relation',
          required: false,
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'motivo_cancelamento', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_nfse_num_emp ON nfse_notas_emitidas (tenant_id, empresa, numero_nota)',
        'CREATE INDEX idx_nfse_verif ON nfse_notas_emitidas (codigo_verificacao)',
        'CREATE INDEX idx_nfse_status_comp ON nfse_notas_emitidas (tenant_id, status, competencia)',
        'CREATE INDEX idx_nfse_created ON nfse_notas_emitidas (created DESC)',
      ],
    })
    app.save(nfseNotasEmitidas)
  },
  (app) => {
    try {
      const colNotas = app.findCollectionByNameOrId('nfse_notas_emitidas')
      app.delete(colNotas)
    } catch (_) {}
    try {
      const colSol = app.findCollectionByNameOrId('nfse_solicitacoes')
      app.delete(colSol)
    } catch (_) {}
    try {
      const colCfg = app.findCollectionByNameOrId('nfse_config')
      app.delete(colCfg)
    } catch (_) {}
  },
)

/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const empresas = app.findCollectionByNameOrId('empresas')
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const contasFin = app.findCollectionByNameOrId('contas_financeiras')

    const tenantsId = tenants.id
    const empresasId = empresas.id
    const usersId = users.id
    const contasFinId = contasFin.id

    // Regra padrão da plataforma contábil:
    // Cliente não acessa; Auxiliar pode ler (view/list); Contador e Administrador editam (create/update/delete)
    const listRule =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'"
    const viewRule =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'"
    const writeRule =
      "@request.auth.id != '' && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')"

    // 1. Coleção guias_pagamentos
    const guiasPagamentos = new Collection({
      name: 'guias_pagamentos',
      type: 'base',
      listRule,
      viewRule,
      createRule: writeRule,
      updateRule: writeRule,
      deleteRule: writeRule,
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
          name: 'tipo_guia',
          type: 'select',
          required: true,
          values: ['darf', 'darf_previdenciario', 'dae_par', 'dctfweb', 'das', 'perdcomp'],
          maxSelect: 1,
        },
        {
          name: 'codigo_receita',
          type: 'text',
          required: true,
        },
        {
          name: 'periodo_apuracao',
          type: 'text', // MM/AAAA ou formato oficial RFB
          required: true,
        },
        {
          name: 'numero_referencia',
          type: 'text', // Código identificador, número de parcelamento ou DCOMP
        },
        {
          name: 'descricao',
          type: 'text',
        },
        {
          name: 'valor_original',
          type: 'number',
        },
        {
          name: 'acrescimos',
          type: 'number',
        },
        {
          name: 'valor_total',
          type: 'number',
          required: true,
        },
        {
          name: 'data_vencimento',
          type: 'date',
          required: true,
        },
        {
          name: 'data_pagamento',
          type: 'date',
        },
        {
          name: 'situacao',
          type: 'select',
          required: true,
          values: ['pendente', 'paga', 'vencida', 'em_parcelamento', 'compensada'],
          maxSelect: 1,
        },
        {
          name: 'comprovante_arquivo',
          type: 'file',
          maxSelect: 1,
          maxSize: 10485760, // 10MB
          mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
        },
        {
          name: 'origem',
          type: 'select',
          values: ['manual', 'dctfweb', 'fiscal', 'conector_rfb', 'perdcomp'],
          maxSelect: 1,
        },
        {
          name: 'titulo_financeiro',
          type: 'relation',
          collectionId: contasFinId,
          maxSelect: 1,
        },
        {
          name: 'autenticacao_bancaria',
          type: 'text',
        },
        {
          name: 'observacoes',
          type: 'text',
        },
        {
          name: 'criado_por',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_guias_tenant_empresa ON guias_pagamentos (tenant_id, empresa)',
        'CREATE INDEX idx_guias_vencimento ON guias_pagamentos (data_vencimento)',
        'CREATE INDEX idx_guias_situacao ON guias_pagamentos (situacao)',
        'CREATE INDEX idx_guias_receita_periodo ON guias_pagamentos (empresa, codigo_receita, periodo_apuracao)',
        'CREATE INDEX idx_guias_created ON guias_pagamentos (created DESC)',
      ],
    })
    app.save(guiasPagamentos)

    // 2. Coleção parcelamentos_federais (PAR / PER-DCOMP)
    const parcelamentosFederais = new Collection({
      name: 'parcelamentos_federais',
      type: 'base',
      listRule,
      viewRule,
      createRule: writeRule,
      updateRule: writeRule,
      deleteRule: writeRule,
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
          name: 'numero_parcelamento',
          type: 'text',
          required: true,
        },
        {
          name: 'modalidade',
          type: 'select',
          required: true,
          values: [
            'pert_sn', // Programa Especial de Regularização Tributária Simples Nacional
            'pert_demais', // PERT Geral
            'ordinario_rfb', // Parcelamento Ordinário da Receita Federal
            'simplificado_previdenciario', // Simplificado Previdenciário
            'transacao_tributaria_pgfn', // Transação Tributária PGFN / Dívida Ativa
            'perdcomp_compensacao', // Pedido Eletrônico de Restituição, Ressarcimento ou Reembolso e Declaração de Compensação
            'outros',
          ],
          maxSelect: 1,
        },
        {
          name: 'descricao_modalidade',
          type: 'text',
        },
        {
          name: 'data_adesao',
          type: 'date',
          required: true,
        },
        {
          name: 'total_parcelas',
          type: 'number',
          required: true,
        },
        {
          name: 'parcelas_quitadas',
          type: 'number',
          required: true,
        },
        {
          name: 'valor_total_consolidado',
          type: 'number',
        },
        {
          name: 'saldo_devedor',
          type: 'number',
          required: true,
        },
        {
          name: 'situacao_rfb',
          type: 'select',
          required: true,
          values: ['em_dia', 'parcela_a_vencer', 'em_atraso', 'liquidado', 'rescindido'],
          maxSelect: 1,
        },
        {
          name: 'proxima_parcela_numero',
          type: 'number',
        },
        {
          name: 'proxima_parcela_vencimento',
          type: 'date',
        },
        {
          name: 'proxima_parcela_valor',
          type: 'number',
        },
        {
          name: 'quadro_parcelas_json',
          type: 'json', // Lista de parcelas detalhadas: [{ numero, vencimento, valor_principal, juros_selic, valor_total, status: 'paga'|'aberta'|'atrasada', data_pagamento }]
        },
        {
          name: 'origem_captura',
          type: 'select',
          values: ['manual_contador', 'conector_rfb_dte'],
          maxSelect: 1,
        },
        {
          name: 'observacoes',
          type: 'text',
        },
        {
          name: 'criado_por',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_parc_tenant_empresa ON parcelamentos_federais (tenant_id, empresa)',
        'CREATE INDEX idx_parc_situacao ON parcelamentos_federais (situacao_rfb)',
        'CREATE INDEX idx_parc_prox_venc ON parcelamentos_federais (proxima_parcela_vencimento)',
        'CREATE INDEX idx_parc_numero ON parcelamentos_federais (empresa, numero_parcelamento)',
        'CREATE INDEX idx_parc_created ON parcelamentos_federais (created DESC)',
      ],
    })
    app.save(parcelamentosFederais)
  },
  (app) => {
    try {
      const parcelamentosFederais = app.findCollectionByNameOrId('parcelamentos_federais')
      app.delete(parcelamentosFederais)
    } catch (_) {}

    try {
      const guiasPagamentos = app.findCollectionByNameOrId('guias_pagamentos')
      app.delete(guiasPagamentos)
    } catch (_) {}
  },
)

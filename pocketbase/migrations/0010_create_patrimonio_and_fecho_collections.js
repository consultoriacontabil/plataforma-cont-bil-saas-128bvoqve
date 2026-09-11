/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const empresas = app.findCollectionByNameOrId('empresas')
    const planoContas = app.findCollectionByNameOrId('plano_contas')
    const tenantsId = tenants.id
    const empresasId = empresas.id
    const planoContasId = planoContas.id

    // 1. Garantir contas contábeis padrão de depreciação no plano_contas se não existirem
    // 1.2.1.09 - (-) Depreciação Acumulada (Ativo Redutora)
    // 4.2.4 - Despesas com Depreciação e Amortização (Despesa)
    // 1.2.1.02 - Veículos
    // 1.2.1.03 - Móveis e Utensílios
    // 1.2.1.04 - Computadores e Periféricos
    // (As contas serão seedadas na 0011)

    // 2. Collection: ativos (Bens Patrimoniais)
    // tenant_id (relation->tenants)
    // empresa (relation->empresas)
    // descricao (text)
    // categoria (select: maquinas_equipamentos | veiculos | moveis_utensilios | computadores_ti | instalacoes_imoveis | outros)
    // numero_nf (text)
    // fornecedor (text)
    // data_aquisicao (date)
    // valor_aquisicao (number)
    // valor_residual (number)
    // taxa_depreciacao_anual (number, %)
    // vida_util_meses (number)
    // conta_ativo (relation->plano_contas)
    // conta_depreciacao_acumulada (relation->plano_contas, optional)
    // conta_despesa_depreciacao (relation->plano_contas, optional)
    // status (select: ativo | depreciado | baixado)
    // depreciacao_acumulada_calculada (number)
    // ultima_competencia_depreciada (text, MM/YYYY)
    // observacoes (text)
    // created, updated (autodate)
    const ativos = new Collection({
      name: 'ativos',
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
        { name: 'descricao', type: 'text', required: true },
        {
          name: 'categoria',
          type: 'select',
          required: true,
          values: [
            'maquinas_equipamentos',
            'veiculos',
            'moveis_utensilios',
            'computadores_ti',
            'instalacoes_imoveis',
            'outros',
          ],
          maxSelect: 1,
        },
        { name: 'numero_nf', type: 'text' },
        { name: 'fornecedor', type: 'text' },
        { name: 'data_aquisicao', type: 'date', required: true },
        { name: 'valor_aquisicao', type: 'number', required: true, min: 0 },
        { name: 'valor_residual', type: 'number', min: 0 },
        { name: 'taxa_depreciacao_anual', type: 'number', required: true, min: 0, max: 100 },
        { name: 'vida_util_meses', type: 'number', min: 1 },
        {
          name: 'conta_ativo',
          type: 'relation',
          required: true,
          collectionId: planoContasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'conta_depreciacao_acumulada',
          type: 'relation',
          collectionId: planoContasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'conta_despesa_depreciacao',
          type: 'relation',
          collectionId: planoContasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['ativo', 'depreciado', 'baixado'],
          maxSelect: 1,
        },
        { name: 'depreciacao_acumulada_calculada', type: 'number', min: 0 },
        { name: 'ultima_competencia_depreciada', type: 'text' },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_ativos_tenant_empresa ON ativos (tenant_id, empresa)',
        'CREATE INDEX idx_ativos_categoria ON ativos (categoria)',
        'CREATE INDEX idx_ativos_status ON ativos (status)',
        'CREATE INDEX idx_ativos_created ON ativos (created DESC)',
      ],
    })
    app.save(ativos)
    const ativosId = ativos.id

    // 3. Collection: baixas_ativos (Histórico de baixas e alienação de ativos)
    // tenant_id, ativo relation, empresa relation, tipo_baixa (venda | obsolescencia | sucata | perda),
    // data_baixa date, valor_venda number, valor_contabil_residual number, ganho_perda number,
    // lote_contabil_id text, motivo text, usuario_id relation->_pb_users_auth_
    const baixasAtivos = new Collection({
      name: 'baixas_ativos',
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
          name: 'ativo',
          type: 'relation',
          required: true,
          collectionId: ativosId,
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
          name: 'tipo_baixa',
          type: 'select',
          required: true,
          values: ['venda', 'obsolescencia', 'sucata', 'perda'],
          maxSelect: 1,
        },
        { name: 'data_baixa', type: 'date', required: true },
        { name: 'valor_venda', type: 'number', min: 0 },
        { name: 'valor_contabil_residual', type: 'number' },
        { name: 'ganho_perda', type: 'number' },
        { name: 'lote_contabil_id', type: 'text' },
        { name: 'motivo', type: 'text' },
        {
          name: 'usuario_id',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_baixas_tenant_ativo ON baixas_ativos (tenant_id, ativo)',
        'CREATE INDEX idx_baixas_empresa ON baixas_ativos (empresa)',
        'CREATE INDEX idx_baixas_data ON baixas_ativos (data_baixa DESC)',
      ],
    })
    app.save(baixasAtivos)

    // 4. Collection: fechamento_competencia (Fecho mensal por empresa + competência)
    // tenant_id, empresa relation, competencia text (MM/YYYY), status (aberto | em_andamento | fechado),
    // data_fechamento date, fechado_por relation->_pb_users_auth_, observacoes text,
    // reaberto_em date, reaberto_por relation->_pb_users_auth_, motivo_reabertura text
    const fechamentoCompetencia = new Collection({
      name: 'fechamento_competencia',
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
        { name: 'competencia', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['aberto', 'em_andamento', 'fechado'],
          maxSelect: 1,
        },
        { name: 'data_fechamento', type: 'date' },
        {
          name: 'fechado_por',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'observacoes', type: 'text' },
        { name: 'reaberto_em', type: 'date' },
        {
          name: 'reaberto_por',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'motivo_reabertura', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_fechamento_tenant_emp_comp ON fechamento_competencia (tenant_id, empresa, competencia)',
        'CREATE INDEX idx_fechamento_status ON fechamento_competencia (status)',
        'CREATE INDEX idx_fechamento_comp ON fechamento_competencia (competencia)',
      ],
    })
    app.save(fechamentoCompetencia)
    const fechamentoId = fechamentoCompetencia.id

    // 5. Collection: fechamento_checklist_itens (Itens do checklist de fechamento por competência)
    // tenant_id, fechamento relation, empresa relation, competencia text,
    // codigo_item text (ex: conciliacao_bancaria, folha_paga, obrigacoes_entregues, lancamentos_confirmados, depreciacao_processada, balancete_conferido, documentos_arquivados),
    // titulo text, descricao text, ordem number, obrigatorio bool,
    // concluido bool, concluido_em date, responsavel relation->_pb_users_auth_,
    // status_automatico text (ex: ok | pendente | alerta), detalhe_automatico text
    const fechamentoChecklistItens = new Collection({
      name: 'fechamento_checklist_itens',
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
          name: 'fechamento',
          type: 'relation',
          required: true,
          collectionId: fechamentoId,
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
        { name: 'competencia', type: 'text', required: true },
        { name: 'codigo_item', type: 'text', required: true },
        { name: 'titulo', type: 'text', required: true },
        { name: 'descricao', type: 'text' },
        { name: 'ordem', type: 'number', min: 1 },
        { name: 'obrigatorio', type: 'bool' },
        { name: 'concluido', type: 'bool' },
        { name: 'concluido_em', type: 'date' },
        {
          name: 'responsavel',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'status_automatico', type: 'text' },
        { name: 'detalhe_automatico', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_chk_itens_fechamento ON fechamento_checklist_itens (fechamento)',
        'CREATE INDEX idx_chk_itens_emp_comp ON fechamento_checklist_itens (tenant_id, empresa, competencia)',
      ],
    })
    app.save(fechamentoChecklistItens)
  },
  (app) => {
    try {
      const fci = app.findCollectionByNameOrId('fechamento_checklist_itens')
      app.delete(fci)
    } catch (_) {}

    try {
      const fc = app.findCollectionByNameOrId('fechamento_competencia')
      app.delete(fc)
    } catch (_) {}

    try {
      const ba = app.findCollectionByNameOrId('baixas_ativos')
      app.delete(ba)
    } catch (_) {}

    try {
      const a = app.findCollectionByNameOrId('ativos')
      app.delete(a)
    } catch (_) {}
  },
)

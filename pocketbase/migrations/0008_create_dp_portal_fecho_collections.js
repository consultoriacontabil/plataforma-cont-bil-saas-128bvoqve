/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Atualizar tenant_members para incluir perfil 'cliente'
    const tenantMembersCol = app.findCollectionByNameOrId('tenant_members')
    const perfilField = tenantMembersCol.fields.getByName('perfil')
    if (perfilField) {
      perfilField.values = ['administrador', 'contador', 'auxiliar', 'consultor', 'cliente']
      perfilField.maxSelect = 1
      app.save(tenantMembersCol)
    }

    const tenants = app.findCollectionByNameOrId('tenants')
    const empresas = app.findCollectionByNameOrId('empresas')
    const documentos = app.findCollectionByNameOrId('documentos')
    const planoContas = app.findCollectionByNameOrId('plano_contas')
    const tenantsId = tenants.id
    const empresasId = empresas.id
    const documentosId = documentos.id
    const planoContasId = planoContas.id

    // 2. Collection: portal_acessos
    // tenant_id, empresa relation, email unique, nome_contato, user relation, ativo
    const portalAcessos = new Collection({
      name: 'portal_acessos',
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
        { name: 'email', type: 'email', required: true },
        { name: 'nome_contato', type: 'text', required: true },
        {
          name: 'user',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_portal_acessos_email ON portal_acessos (tenant_id, email)',
        'CREATE INDEX idx_portal_acessos_empresa ON portal_acessos (empresa)',
        'CREATE INDEX idx_portal_acessos_user ON portal_acessos (user)',
      ],
    })
    app.save(portalAcessos)

    // 3. Collection: mapeamento_contabil
    // tenant_id, origem [obrigacao/documento], chave/categoria, conta_debito relation, conta_credito relation, descricao
    const mapeamentoContabil = new Collection({
      name: 'mapeamento_contabil',
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
          name: 'origem',
          type: 'select',
          required: true,
          values: ['obrigacao', 'documento'],
          maxSelect: 1,
        },
        { name: 'chave', type: 'text', required: true },
        { name: 'descricao', type: 'text' },
        {
          name: 'conta_debito',
          type: 'relation',
          required: true,
          collectionId: planoContasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'conta_credito',
          type: 'relation',
          required: true,
          collectionId: planoContasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_map_contabil_tenant_origem ON mapeamento_contabil (tenant_id, origem, chave)',
      ],
    })
    app.save(mapeamentoContabil)

    // 4. Collection: funcionarios (DP)
    // tenant_id, empresa relation, nome_completo, cpf, cargo, data_admissao, data_demissao, salario, tipo [clt/pj/estagio], status [ativo/demitido/ferias/afastado], centro_custo
    const funcionarios = new Collection({
      name: 'funcionarios',
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
        { name: 'nome_completo', type: 'text', required: true },
        { name: 'cpf', type: 'text', required: true },
        { name: 'cargo', type: 'text', required: true },
        { name: 'data_admissao', type: 'date', required: true },
        { name: 'data_demissao', type: 'date' },
        { name: 'salario', type: 'number', required: true, min: 0 },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['clt', 'pj', 'estagio'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['ativo', 'demitido', 'ferias', 'afastado'],
          maxSelect: 1,
        },
        { name: 'centro_custo', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_funcionarios_tenant_emp ON funcionarios (tenant_id, empresa)',
        'CREATE INDEX idx_funcionarios_status ON funcionarios (status)',
        'CREATE INDEX idx_funcionarios_cpf ON funcionarios (tenant_id, cpf)',
      ],
    })
    app.save(funcionarios)
    const funcionariosId = funcionarios.id

    // 5. Collection: folha_pagamento (DP)
    // tenant_id, empresa relation, funcionario relation, competencia MM/AAAA, salario_base, proventos [json: array {descricao, valor}], descontos [json: array {descricao, valor}], inss, irrf, fgts, total_liquido, status [rascunho/processada/paga], pago_em
    const folhaPagamento = new Collection({
      name: 'folha_pagamento',
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
          name: 'funcionario',
          type: 'relation',
          required: true,
          collectionId: funcionariosId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'competencia', type: 'text', required: true },
        { name: 'salario_base', type: 'number', required: true, min: 0 },
        { name: 'proventos', type: 'json' },
        { name: 'descontos', type: 'json' },
        { name: 'inss', type: 'number', min: 0 },
        { name: 'irrf', type: 'number', min: 0 },
        { name: 'fgts', type: 'number', min: 0 },
        { name: 'total_liquido', type: 'number', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['rascunho', 'processada', 'paga'],
          maxSelect: 1,
        },
        { name: 'pago_em', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_folha_tenant_emp_comp ON folha_pagamento (tenant_id, empresa, competencia)',
        'CREATE INDEX idx_folha_funcionario ON folha_pagamento (funcionario)',
        'CREATE INDEX idx_folha_status ON folha_pagamento (status)',
      ],
    })
    app.save(folhaPagamento)

    // 6. Collection: eventos_dp (DP)
    // tenant_id, empresa relation, funcionario relation, tipo [admissao/demissao/ferias/afastado/alteracao_salarial], data_evento, descricao, anexo relation a documentos
    const eventosDp = new Collection({
      name: 'eventos_dp',
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
          name: 'funcionario',
          type: 'relation',
          required: true,
          collectionId: funcionariosId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['admissao', 'demissao', 'ferias', 'afastado', 'alteracao_salarial'],
          maxSelect: 1,
        },
        { name: 'data_evento', type: 'date', required: true },
        { name: 'descricao', type: 'text', required: true },
        {
          name: 'anexo',
          type: 'relation',
          collectionId: documentosId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_eventos_dp_func ON eventos_dp (funcionario)',
        'CREATE INDEX idx_eventos_dp_tenant_emp ON eventos_dp (tenant_id, empresa)',
        'CREATE INDEX idx_eventos_dp_data ON eventos_dp (data_evento DESC)',
      ],
    })
    app.save(eventosDp)
  },
  (app) => {
    try {
      const ed = app.findCollectionByNameOrId('eventos_dp')
      app.delete(ed)
    } catch (_) {}

    try {
      const fp = app.findCollectionByNameOrId('folha_pagamento')
      app.delete(fp)
    } catch (_) {}

    try {
      const f = app.findCollectionByNameOrId('funcionarios')
      app.delete(f)
    } catch (_) {}

    try {
      const mc = app.findCollectionByNameOrId('mapeamento_contabil')
      app.delete(mc)
    } catch (_) {}

    try {
      const pa = app.findCollectionByNameOrId('portal_acessos')
      app.delete(pa)
    } catch (_) {}
  },
)

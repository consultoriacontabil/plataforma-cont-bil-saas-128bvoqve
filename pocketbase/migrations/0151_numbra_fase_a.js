/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0151 — Fase A da integração Numbra: fundação de leitura.
 *
 * Escopo desta fase: ESPELHAR o que existe no Numbra (empresas e plano de
 * contas) e criar a tabela de correspondência entre o plano de contas local e
 * o do Numbra. Nada é escrito no Numbra aqui — só leitura.
 *
 * Por que isso vem antes de qualquer envio: a plataforma guarda
 * `conta_debito`/`conta_credito` como relação para o plano local, e o Numbra
 * exige `conta_id` NUMÉRICO do plano dele. Sem o mapa conta↔conta, nenhum
 * lançamento atravessa. É o alicerce.
 *
 * O token do Numbra vai para `credenciais_cofre` (AES-256-GCM), com o campo
 * aqui guardando apenas `__COFRE__`. Mesmo padrão das 52 credenciais que já
 * estão seladas.
 *
 * Rollback: apaga as quatro coleções. Nada do Numbra é afetado.
 */
migrate(
  (app) => {
    const tenantsId = app.findCollectionByNameOrId('tenants').id
    const empresasId = app.findCollectionByNameOrId('empresas').id
    const planoId = app.findCollectionByNameOrId('plano_contas').id

    const LEITURA =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id"
    const ESCRITA =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'"

    // 1. numbra_config — credencial e estado da conexão (um por escritório)
    const config = new Collection({
      name: 'numbra_config',
      type: 'base',
      listRule: LEITURA,
      viewRule: LEITURA,
      createRule: ESCRITA,
      updateRule: ESCRITA,
      deleteRule:
        "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && @request.auth.tenant_members_via_user_id.perfil ?= 'administrador'",
      fields: [
        {
          name: 'tenant_id',
          type: 'relation',
          required: true,
          collectionId: tenantsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'base_url', type: 'text', required: true },
        // guarda __COFRE__; o valor real vive cifrado em credenciais_cofre
        { name: 'token', type: 'text', required: false },
        // o Numbra expira o token (1 a 365 dias) — sem esta data a integração
        // para em silêncio no vencimento
        { name: 'token_expira_em', type: 'date', required: false },
        { name: 'somente_leitura', type: 'bool', required: false },
        { name: 'ativo', type: 'bool', required: false },
        {
          name: 'status_conexao',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['nao_configurado', 'conectado', 'token_expirado', 'erro'],
        },
        { name: 'ultimo_erro', type: 'text', required: false },
        { name: 'ultima_sincronizacao_em', type: 'date', required: false },
        { name: 'total_empresas', type: 'number', required: false },
        { name: 'total_contas', type: 'number', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_numbra_config_tenant ON numbra_config (tenant_id)'],
    })
    app.save(config)

    // 2. numbra_empresas — espelho das empresas do Numbra
    const emp = new Collection({
      name: 'numbra_empresas',
      type: 'base',
      listRule: LEITURA,
      viewRule: LEITURA,
      createRule: ESCRITA,
      updateRule: ESCRITA,
      deleteRule: ESCRITA,
      fields: [
        {
          name: 'tenant_id',
          type: 'relation',
          required: true,
          collectionId: tenantsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'numbra_id', type: 'number', required: true },
        { name: 'razao_social', type: 'text', required: false },
        { name: 'nome_fantasia', type: 'text', required: false },
        { name: 'cnpj_cpf', type: 'text', required: false },
        { name: 'regime_tributario', type: 'text', required: false },
        { name: 'status', type: 'text', required: false },
        { name: 'municipio', type: 'text', required: false },
        { name: 'uf', type: 'text', required: false },
        // vínculo com a empresa local — é o que liga os dois mundos
        {
          name: 'empresa_local',
          type: 'relation',
          required: false,
          collectionId: empresasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'sincronizado_em', type: 'date', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_numbra_emp_tenant_nid ON numbra_empresas (tenant_id, numbra_id)',
        'CREATE INDEX idx_numbra_emp_cnpj ON numbra_empresas (cnpj_cpf)',
      ],
    })
    app.save(emp)

    // 3. numbra_plano_contas — espelho do plano de contas do Numbra
    const plano = new Collection({
      name: 'numbra_plano_contas',
      type: 'base',
      listRule: LEITURA,
      viewRule: LEITURA,
      createRule: ESCRITA,
      updateRule: ESCRITA,
      deleteRule: ESCRITA,
      fields: [
        {
          name: 'tenant_id',
          type: 'relation',
          required: true,
          collectionId: tenantsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'numbra_id', type: 'number', required: true },
        { name: 'numbra_empresa_id', type: 'number', required: true },
        { name: 'codigo', type: 'text', required: false },
        { name: 'apelido', type: 'text', required: false },
        { name: 'descricao', type: 'text', required: false },
        { name: 'tipo', type: 'text', required: false },
        { name: 'natureza', type: 'text', required: false },
        { name: 'conta_pai_id', type: 'number', required: false },
        { name: 'nivel', type: 'number', required: false },
        { name: 'aceita_lancamento', type: 'bool', required: false },
        { name: 'ativa', type: 'bool', required: false },
        { name: 'sincronizado_em', type: 'date', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_numbra_pc_tenant_nid ON numbra_plano_contas (tenant_id, numbra_id)',
        'CREATE INDEX idx_numbra_pc_empresa ON numbra_plano_contas (tenant_id, numbra_empresa_id)',
        'CREATE INDEX idx_numbra_pc_codigo ON numbra_plano_contas (codigo)',
      ],
    })
    app.save(plano)

    // 4. numbra_mapa_contas — a correspondência conta local ↔ conta Numbra
    const mapa = new Collection({
      name: 'numbra_mapa_contas',
      type: 'base',
      listRule: LEITURA,
      viewRule: LEITURA,
      createRule: ESCRITA,
      updateRule: ESCRITA,
      deleteRule: ESCRITA,
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
          name: 'empresa_local',
          type: 'relation',
          required: true,
          collectionId: empresasId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'conta_local',
          type: 'relation',
          required: true,
          collectionId: planoId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'numbra_conta_id', type: 'number', required: true },
        { name: 'numbra_empresa_id', type: 'number', required: true },
        // como o vínculo foi feito: automático (código igual) ou manual
        {
          name: 'origem_vinculo',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['codigo_igual', 'manual'],
        },
        { name: 'confirmado', type: 'bool', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_numbra_mapa_local ON numbra_mapa_contas (empresa_local, conta_local)',
        'CREATE INDEX idx_numbra_mapa_numbra ON numbra_mapa_contas (tenant_id, numbra_conta_id)',
      ],
    })
    app.save(mapa)

    console.log('[0151] Fase A Numbra: 4 colecoes criadas (config, empresas, plano, mapa)')
  },
  (app) => {
    const nomes = ['numbra_mapa_contas', 'numbra_plano_contas', 'numbra_empresas', 'numbra_config']
    for (let i = 0; i < nomes.length; i++) {
      try {
        app.delete(app.findCollectionByNameOrId(nomes[i]))
      } catch (_) {}
    }
  },
)

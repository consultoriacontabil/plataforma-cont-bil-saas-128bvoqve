/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0148 — FASE 3: supervisão do agente operacional.
 *
 * Problema: o `operador-rumo` escrevia direto. Se alguém pedir "marca todas as
 * obrigações como entregues", ele faz. Para uso em equipe, ação sensível
 * precisa de aprovação humana antes de virar efeito.
 *
 * Desenho:
 *  1. `operador_acoes` — fila de ações propostas pelo agente. Cada linha é uma
 *     intenção concreta (coleção, registro, campo, valor novo) com o "de/para".
 *     O agente NÃO aplica nada: ele enfileira aqui e informa o protocolo.
 *  2. O humano aprova ou rejeita. Só na aprovação a alteração é aplicada, por
 *     um hook de servidor que valida coleção/campo contra uma lista fechada.
 *  3. Toda decisão vai para `audit_log`.
 *
 * Por que lista fechada de campos: o agente propõe o que quiser, mas o hook
 * de execução só aplica se (coleção, campo) estiver na ALLOWLIST. Isso impede
 * que uma proposta malformada escreva em lançamento contábil ou credencial.
 *
 * Rollback: apaga a coleção. `elliza_aprovacoes` não é tocada.
 */
migrate(
  (app) => {
    const tenantsId = app.findCollectionByNameOrId('tenants').id
    const usersId = '_pb_users_auth_'

    const collection = new Collection({
      name: 'operador_acoes',
      type: 'base',
      listRule:
        "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id",
      viewRule:
        "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id",
      createRule:
        "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'",
      updateRule:
        "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')",
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
        {
          name: 'solicitado_por',
          type: 'relation',
          required: false,
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        // coleção alvo — validada na execução contra ALLOWLIST
        { name: 'colecao', type: 'text', required: true },
        { name: 'registro_id', type: 'text', required: true },
        // campo alvo — validado na execução contra ALLOWLIST
        { name: 'campo', type: 'text', required: true },
        { name: 'valor_atual', type: 'text', required: false },
        { name: 'valor_proposto', type: 'text', required: true },
        { name: 'motivo', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['pendente', 'aprovada', 'rejeitada', 'executada', 'falhou'],
        },
        {
          name: 'decidido_por',
          type: 'relation',
          required: false,
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'decidido_em', type: 'date', required: false },
        { name: 'justificativa_decisao', type: 'text', required: false },
        { name: 'resultado_execucao', type: 'text', required: false },
        // conversation do agente, para rastrear qual diálogo propôs a ação
        { name: 'conversa_id', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_operador_acoes_tenant_status ON operador_acoes (tenant_id, status)',
        'CREATE INDEX idx_operador_acoes_registro ON operador_acoes (colecao, registro_id)',
        'CREATE INDEX idx_operador_acoes_created ON operador_acoes (created DESC)',
      ],
    })

    app.save(collection)
    console.log('[0148] operador_acoes criada (fila de aprovacao)')
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('operador_acoes'))
  },
)

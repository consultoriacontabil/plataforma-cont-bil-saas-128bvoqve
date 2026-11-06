/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0132 — Isolamento por tenant, LOTE 0 (uma única coleção)
 *
 * MÉTODO (aprendido com o incidente da 0129)
 * - Regra LITERAL escrita à mão. Nenhuma leitura de regra existente.
 * - Uma coleção só. Verificação por leitura antes de qualquer outro lote.
 * - Sem concatenação condicional, sem função auxiliar que possa devolver
 *   vazio: se a string não estivesse certa, o PocketBase recusa o save.
 *
 * COLEÇÃO: plano_contas
 * Escolhida por ser de baixo risco operacional (dados de referência contábil)
 * e por ter as cinco regras genéricas `@request.auth.id != ''`.
 *
 * SINTAXE
 * `@request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id`
 * Back-relation já comprovada em produção nesta mesma base, na coleção
 * `certificados_digitais` (usa `...tenant_members_via_user_id.perfil`).
 *
 * ROLLBACK
 * Volta exatamente as cinco regras originais.
 */

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('plano_contas')

    col.listRule =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id"
    col.viewRule =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id"
    col.createRule =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'"
    col.updateRule =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'"
    col.deleteRule =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'"

    app.save(col)
    console.log('[0132] plano_contas: isolamento por tenant aplicado (lote 0)')
  },
  (app) => {
    const col = app.findCollectionByNameOrId('plano_contas')
    col.listRule = "@request.auth.id != ''"
    col.viewRule = "@request.auth.id != ''"
    col.createRule = "@request.auth.id != ''"
    col.updateRule = "@request.auth.id != ''"
    col.deleteRule = "@request.auth.id != ''"
    app.save(col)
  },
)

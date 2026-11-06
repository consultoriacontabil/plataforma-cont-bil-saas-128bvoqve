/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0131 — Restaura as regras originais de certificados_digitais
 *
 * CONTEXTO
 * A 0129 não estava na lista de coleções de negócio, mas a 0130 restaurou
 * `certificados_digitais` com a regra genérica `@request.auth.id != ''`.
 * A regra original desta coleção era mais restrita: exigia que o usuário
 * NÃO fosse perfil 'cliente' para ler, e que fosse 'administrador' ou
 * 'contador' para escrever.
 *
 * Esta migration devolve exatamente as regras originais. É uma correção de
 * restauração: a 0130, ao restaurar em bloco, alargou esta coleção.
 */

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('certificados_digitais')

    col.listRule =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'"
    col.viewRule =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'"
    col.createRule =
      "@request.auth.id != '' && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')"
    col.updateRule =
      "@request.auth.id != '' && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')"
    col.deleteRule =
      "@request.auth.id != '' && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')"

    app.save(col)
    console.log('[0131] certificados_digitais restaurado ao estado original')
  },
  (app) => {
    // Down: volta ao genérico (estado em que a 0130 deixou)
    const col = app.findCollectionByNameOrId('certificados_digitais')
    col.listRule = "@request.auth.id != ''"
    col.viewRule = "@request.auth.id != ''"
    col.createRule = "@request.auth.id != ''"
    col.updateRule = "@request.auth.id != ''"
    col.deleteRule = "@request.auth.id != ''"
    app.save(col)
  },
)

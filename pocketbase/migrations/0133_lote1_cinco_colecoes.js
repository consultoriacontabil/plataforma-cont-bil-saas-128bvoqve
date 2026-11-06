/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0133 — Isolamento por tenant, LOTE 1 (5 coleções)
 *
 * Método: regra LITERAL por coleção, sem leitura de estado.
 * Validado antes no lote 0 (plano_contas), conferido por leitura.
 *
 * Coleções deste lote: contábeis de referência e patrimônio.
 * Todas tinham as cinco regras genéricas `@request.auth.id != ''`.
 *
 * Rollback: volta as cinco regras originais de cada uma.
 */

migrate(
  (app) => {
    const LEITURA =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id"
    const ESCRITA =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'"

    const COLECOES = [
      'mapeamento_contabil',
      'pre_lancamentos',
      'impostos_retidos',
      'ativos',
      'baixas_ativos',
    ]

    for (let i = 0; i < COLECOES.length; i++) {
      const col = app.findCollectionByNameOrId(COLECOES[i])
      col.listRule = LEITURA
      col.viewRule = LEITURA
      col.createRule = ESCRITA
      col.updateRule = ESCRITA
      col.deleteRule = ESCRITA
      app.save(col)
      console.log('[0133] isolado: ' + COLECOES[i])
    }
  },
  (app) => {
    const COLECOES = [
      'mapeamento_contabil',
      'pre_lancamentos',
      'impostos_retidos',
      'ativos',
      'baixas_ativos',
    ]
    for (let i = 0; i < COLECOES.length; i++) {
      const col = app.findCollectionByNameOrId(COLECOES[i])
      col.listRule = "@request.auth.id != ''"
      col.viewRule = "@request.auth.id != ''"
      col.createRule = "@request.auth.id != ''"
      col.updateRule = "@request.auth.id != ''"
      col.deleteRule = "@request.auth.id != ''"
      app.save(col)
    }
  },
)

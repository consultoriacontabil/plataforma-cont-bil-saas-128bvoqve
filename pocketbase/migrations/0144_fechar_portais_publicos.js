/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0144 — Fecha o acesso anônimo de pedidos de documentos e abertura.
 *
 * REGRA ANTIGA (as duas):
 *   pedidos_documentos          list/view/update: `@request.auth.id != '' || token_publico != ''`
 *   company_onboarding_workflow list/view:        `@request.auth.id != '' || token != ''`
 *
 * Os termos à direita do `||` não comparam com NADA da requisição — basta a
 * coluna estar preenchida no registro. Resultado: qualquer visitante, sem
 * login, listava todos os pedidos de documentos e todas as aberturas de
 * empresa de todos os escritórios, com CNPJ, sócios e dados cadastrais.
 *
 * REGRA NOVA: escritório vê o que é do seu tenant. O cliente público deixa de
 * falar com a coleção e passa a usar as rotas de servidor
 * `/backend/v1/publico/pedido` e `/backend/v1/publico/abertura` (+ /salvar),
 * que validam o token exato (hooks/portais_publicos_cliente.js).
 *
 * Rollback: restaura as regras antigas (inseguras).
 */
migrate(
  (app) => {
    const LEITURA =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id"
    const ESCRITA =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'"

    // pedidos_documentos
    const pedidos = app.findCollectionByNameOrId('pedidos_documentos')
    pedidos.listRule = LEITURA
    pedidos.viewRule = LEITURA
    pedidos.createRule = ESCRITA
    pedidos.updateRule = ESCRITA
    pedidos.deleteRule = ESCRITA
    app.save(pedidos)
    console.log('[0144] fechado: pedidos_documentos')

    // company_onboarding_workflow
    const wf = app.findCollectionByNameOrId('company_onboarding_workflow')
    wf.listRule = LEITURA
    wf.viewRule = LEITURA
    wf.createRule = ESCRITA
    wf.updateRule = ESCRITA
    wf.deleteRule = ESCRITA
    app.save(wf)
    console.log('[0144] fechado: company_onboarding_workflow')
  },
  (app) => {
    const pedidos = app.findCollectionByNameOrId('pedidos_documentos')
    pedidos.listRule = "@request.auth.id != '' || token_publico != ''"
    pedidos.viewRule = "@request.auth.id != '' || token_publico != ''"
    pedidos.createRule = "@request.auth.id != ''"
    pedidos.updateRule = "@request.auth.id != '' || token_publico != ''"
    pedidos.deleteRule = "@request.auth.id != ''"
    app.save(pedidos)

    const wf = app.findCollectionByNameOrId('company_onboarding_workflow')
    wf.listRule = "@request.auth.id != '' || token != ''"
    wf.viewRule = "@request.auth.id != '' || token != ''"
    wf.createRule = "@request.auth.id != ''"
    wf.updateRule = "@request.auth.id != '' || (token != '' && token = @request.body.token)"
    wf.deleteRule = "@request.auth.id != ''"
    app.save(wf)
  },
)

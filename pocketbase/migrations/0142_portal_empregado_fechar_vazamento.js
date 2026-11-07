/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0142 — Fecha o vazamento de `portal_empregado_acessos`.
 *
 * REGRA ANTIGA (list/view): `@request.auth.id != '' || token_acesso != ''`
 *
 * O segundo termo é um OR com uma condição que NÃO compara com o token da
 * requisição: basta a COLUNA existir não vazia no registro. Isso significa
 * que qualquer visitante, sem login, lista TODOS os acessos do portal —
 * com CPF, nome, telefone, hash de senha e token de acesso de cada
 * empregado de todos os escritórios. É o pior achado do isolamento até aqui.
 *
 * REGRA NOVA:
 *  - Escritório (logado): vê os acessos do próprio tenant.
 *  - Portal do empregado (sem login): a rota continua aberta, mas a consulta
 *    passa a ser por token exato na própria requisição
 *    (`token_acesso = @request.query.token_acesso`), e não "qualquer token".
 *    `senha_hash`, `codigo_temporario` e `token_acesso` não são mais
 *    listáveis por anônimo.
 *
 * A leitura por token exato é o que o portal do empregado já faz: ele chega
 * com o token na URL. Quem não trouxer o token certo não vê nada.
 *
 * Rollback: restaura a regra antiga (insegura) para permitir comparação.
 */
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('portal_empregado_acessos')

    // leitura: escritório vê o seu; anônimo só o registro do token que trouxe
    col.listRule =
      "(@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id) || (@request.auth.id = '' && token_acesso != '' && token_acesso = @request.query.token_acesso)"
    col.viewRule =
      "(@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id) || (@request.auth.id = '' && token_acesso != '' && token_acesso = @request.query.token_acesso)"

    // escrita continua exigindo vínculo com o escritório
    const ESCRITA =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'"
    col.createRule = ESCRITA
    col.deleteRule = ESCRITA
    // update: escritório ou o próprio empregado trocando a própria senha
    col.updateRule =
      ESCRITA +
      " || (@request.auth.id = '' && token_acesso != '' && token_acesso = @request.query.token_acesso)"

    app.save(col)
    console.log('[0142] portal_empregado_acessos fechado: token exato na requisicao')
  },
  (app) => {
    const col = app.findCollectionByNameOrId('portal_empregado_acessos')
    col.listRule = "@request.auth.id != '' || token_acesso != ''"
    col.viewRule = "@request.auth.id != '' || token_acesso != ''"
    col.createRule = "@request.auth.id != ''"
    col.updateRule =
      "@request.auth.id != '' || (token_acesso != '' && token_acesso = @request.body.token_acesso)"
    col.deleteRule = "@request.auth.id != ''"
    app.save(col)
  },
)

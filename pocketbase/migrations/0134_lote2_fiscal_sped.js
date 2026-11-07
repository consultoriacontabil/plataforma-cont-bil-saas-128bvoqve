/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0134 — Isolamento por tenant, LOTE 2 (fiscal / SPED)
 *
 * Método: regra LITERAL por coleção, sem leitura de estado (validado nos
 * lotes 0 e 1). Antes de incluir cada coleção aqui, as cinco regras foram
 * conferidas por inspeção: todas eram exatamente `@request.auth.id != ''`
 * e todas têm o campo `tenant_id`.
 *
 * ATENÇÃO — dados sensíveis neste lote:
 * `nfse_config` e `nfe_config` guardam credenciais em colunas de texto
 * (evolution_api_key, govbr_client_secret, betha_senha_token, ginfes_senha,
 * nfeio_api_key, senha_certificado, chave_pix_padrao). Hoje QUALQUER usuário
 * autenticado de qualquer escritório lê isso. Esta migration fecha a leitura
 * por tenant; mover esses valores para secret/vault é um passo separado.
 *
 * Rollback: volta as cinco regras originais de cada coleção.
 */

migrate(
  (app) => {
    const LEITURA =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id"
    const ESCRITA =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'"

    const COLECOES = [
      'fiscal',
      'sped_arquivos',
      'defis_declaracoes',
      'certidoes',
      'nfiscal',
      'nfse_solicitacoes',
      'nfse_notas_emitidas',
      'nfse_config',
      'nfe_config',
      'nfe_sync_logs',
    ]

    for (let i = 0; i < COLECOES.length; i++) {
      const col = app.findCollectionByNameOrId(COLECOES[i])
      col.listRule = LEITURA
      col.viewRule = LEITURA
      col.createRule = ESCRITA
      col.updateRule = ESCRITA
      col.deleteRule = ESCRITA
      app.save(col)
      console.log('[0134] isolado: ' + COLECOES[i])
    }
  },
  (app) => {
    const COLECOES = [
      'fiscal',
      'sped_arquivos',
      'defis_declaracoes',
      'certidoes',
      'nfiscal',
      'nfse_solicitacoes',
      'nfse_notas_emitidas',
      'nfse_config',
      'nfe_config',
      'nfe_sync_logs',
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

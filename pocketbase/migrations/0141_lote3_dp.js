/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0141 — Isolamento por tenant, LOTE 3 (Departamento Pessoal).
 *
 * Mesmo método dos lotes anteriores: regra LITERAL por coleção, sem ler o
 * estado atual (a lição do incidente 0129). Antes de escrever, as regras
 * foram conferidas por leitura: as 15 coleções abaixo tinham exatamente
 * `@request.auth.id != ''` e todas têm o campo `tenant_id`.
 *
 * Dado pessoal sensível neste lote: salário (historico_salarial,
 * folha_pagamento), CPF e endereço (funcionarios), rescisões, afastamentos
 * (eventos_dp) e eventos de e-Social/REINF. Hoje qualquer usuário
 * autenticado de qualquer escritório lê tudo isso.
 *
 * FORA deste lote, de propósito:
 *  - `verbas_catalogo`: já estava isolada por tenant.
 *  - `portal_empregado_acessos`: tem regra pública por token e exige
 *    tratamento próprio (migration separada), porque restringir por tenant
 *    quebraria o acesso do empregado sem login.
 *
 * Rollback: devolve a regra original de cada coleção.
 */
migrate(
  (app) => {
    const LEITURA =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id"
    const ESCRITA =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'"

    const COLECOES = [
      'funcionarios',
      'folha_pagamento',
      'eventos_dp',
      'verbas_lancamentos',
      'ferias_periodos',
      'decimo_terceiro',
      'rescisoes',
      'beneficios_concedidos',
      'convencoes_coletivas',
      'historico_salarial',
      'esocial_config',
      'esocial_eventos',
      'reinf_eventos',
      'dctfweb_declaracoes',
      'portal_acessos',
    ]

    for (let i = 0; i < COLECOES.length; i++) {
      const nome = COLECOES[i]
      try {
        const col = app.findCollectionByNameOrId(nome)
        col.listRule = LEITURA
        col.viewRule = LEITURA
        col.createRule = ESCRITA
        col.updateRule = ESCRITA
        col.deleteRule = ESCRITA
        app.save(col)
        console.log('[0141] isolado: ' + nome)
      } catch (err) {
        console.log('[0141] FALHA em ' + nome + ': ' + String(err))
        throw err
      }
    }

    console.log('[0141] lote DP concluido: ' + COLECOES.length + ' colecoes')
  },
  (app) => {
    const COLECOES = [
      'funcionarios',
      'folha_pagamento',
      'eventos_dp',
      'verbas_lancamentos',
      'ferias_periodos',
      'decimo_terceiro',
      'rescisoes',
      'beneficios_concedidos',
      'convencoes_coletivas',
      'historico_salarial',
      'esocial_config',
      'esocial_eventos',
      'reinf_eventos',
      'dctfweb_declaracoes',
      'portal_acessos',
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

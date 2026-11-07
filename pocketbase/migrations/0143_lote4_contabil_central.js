/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0143 — Isolamento por tenant, LOTE 4 (contábil central).
 *
 * Mesmo método dos lotes 0-3: regra LITERAL, sem ler estado (lição da 0129).
 * As 19 coleções abaixo foram conferidas por leitura antes desta migration:
 * todas tinham exatamente `@request.auth.id != ''` e todas têm `tenant_id`.
 *
 * O que este lote protege:
 *  - lançamentos contábeis e fechamentos (o coração do escritório)
 *  - extratos, contas bancárias e integrações bancárias (dado financeiro)
 *  - contratos de honorários e faturamento (receita do escritório)
 *  - demonstrativos e assinaturas
 *  - cadastro assistido e migrações de empresa (CNPJ, sócios, dados)
 *
 * FORA, de propósito — têm acesso público por token e serão fechadas na
 * migration seguinte, junto com a rota de servidor que substitui o acesso
 * direto: `pedidos_documentos`, `company_onboarding_workflow`.
 *
 * Rollback: devolve a regra original.
 */
migrate(
  (app) => {
    const LEITURA =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id"
    const ESCRITA =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'"

    const COLECOES = [
      'lancamentos_contabeis',
      'fechamento_competencia',
      'fechamento_checklist_itens',
      'contas_bancarias',
      'contas_financeiras',
      'extratos_bancarios',
      'integracoes_bancarias',
      'integracoes_logs',
      'demonstrativos',
      'assinaturas_demonstrativos',
      'contratos_honorarios',
      'patrimonio_transferencias',
      'cobrancas',
      'cobrancas_recorrentes',
      'faturamentos_recorrentes',
      'empresa_cadastro_assistido',
      'empresas_migracoes_lote',
      'empresas_migracoes_onboarding',
      'company_formation',
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
        console.log('[0143] isolado: ' + nome)
      } catch (err) {
        console.log('[0143] FALHA em ' + nome + ': ' + String(err))
        throw err
      }
    }

    console.log('[0143] lote contabil central: ' + COLECOES.length + ' colecoes')
  },
  (app) => {
    const COLECOES = [
      'lancamentos_contabeis',
      'fechamento_competencia',
      'fechamento_checklist_itens',
      'contas_bancarias',
      'contas_financeiras',
      'extratos_bancarios',
      'integracoes_bancarias',
      'integracoes_logs',
      'demonstrativos',
      'assinaturas_demonstrativos',
      'contratos_honorarios',
      'patrimonio_transferencias',
      'cobrancas',
      'cobrancas_recorrentes',
      'faturamentos_recorrentes',
      'empresa_cadastro_assistido',
      'empresas_migracoes_lote',
      'empresas_migracoes_onboarding',
      'company_formation',
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

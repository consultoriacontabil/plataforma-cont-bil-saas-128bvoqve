/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0145 — Núcleo, etapa 1: coleções periféricas.
 *
 * Fecha o isolamento das 39 coleções que NÃO são o núcleo de acesso
 * (`empresas`, `documentos`, `tenants`, `tenant_members`, `users` ficam para
 * as etapas 2 e 3). Método literal, sem ler estado — lição da 0129.
 *
 * GRUPO A — tinham `@request.auth.id != ''` puro: recebem a regra padrão.
 * GRUPO B — já filtravam por `perfil` mas SEM tenant (certificados_digitais,
 *   verbas_catalogo, publicacoes_legislativas, parametros_normativos,
 *   integra_contador_config, integra_contador_consumo): passam a exigir
 *   também o vínculo de tenant — hoje qualquer escritório lê os do outro.
 *
 * Rollback: devolve a regra original de cada grupo.
 */
migrate(
  (app) => {
    const LEITURA =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id"
    const ESCRITA =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'"

    // GRUPO A — regra genérica
    const A = [
      'audit_log',
      'whatsapp_leads_contatos',
      'whatsapp_templates',
      'simulacoes_reforma',
      'rankings_reforma_trimestral',
      'parametros_reforma',
      'ecac_comunicacoes',
      'rfb_config',
      'rfb_sync_logs',
      'guias_pagamentos',
      'parcelamentos_federais',
      'wa_atendimento_conversas',
      'wa_atendimento_mensagens',
      'nfe_recebidas',
      'exclusoes_empresa_backup',
      'whatsapp_notificacoes_autorizadas',
      'whatsapp_envios',
      'elliza_diretivas',
      'elliza_aprovacoes',
      'elliza_perfil',
      'backups_execucoes',
      'sops',
      'processos_operacionais',
      'processo_etapas',
      'elisa_jobs',
      'elisa_evidencias',
      'processo_pendencias',
      'elliza_agente_externo_chaves',
      'socios',
      'pro_labore_lancamentos',
      'prolabore_fator_r_alertas',
      'elliza_comandos',
      'pesquisas_tributarias',
    ]

    for (let i = 0; i < A.length; i++) {
      const nome = A[i]
      try {
        const col = app.findCollectionByNameOrId(nome)
        col.listRule = LEITURA
        col.viewRule = LEITURA
        col.createRule = ESCRITA
        col.updateRule = ESCRITA
        col.deleteRule = ESCRITA
        app.save(col)
        console.log('[0145] A isolado: ' + nome)
      } catch (err) {
        console.log('[0145] FALHA A em ' + nome + ': ' + String(err))
        throw err
      }
    }

    // GRUPO B — perfil sem tenant
    const B = [
      'certificados_digitais',
      'verbas_catalogo',
      'publicacoes_legislativas',
      'parametros_normativos',
      'integra_contador_config',
      'integra_contador_consumo',
    ]

    for (let i = 0; i < B.length; i++) {
      const nome = B[i]
      try {
        const col = app.findCollectionByNameOrId(nome)
        col.listRule = LEITURA
        col.viewRule = LEITURA
        col.createRule = ESCRITA
        col.updateRule = ESCRITA
        col.deleteRule = ESCRITA
        app.save(col)
        console.log('[0145] B isolado: ' + nome)
      } catch (err) {
        console.log('[0145] FALHA B em ' + nome + ': ' + String(err))
        throw err
      }
    }

    console.log('[0145] etapa 1: ' + (A.length + B.length) + ' colecoes')
  },
  (app) => {
    const A = [
      'audit_log',
      'whatsapp_leads_contatos',
      'whatsapp_templates',
      'simulacoes_reforma',
      'rankings_reforma_trimestral',
      'parametros_reforma',
      'ecac_comunicacoes',
      'rfb_config',
      'rfb_sync_logs',
      'guias_pagamentos',
      'parcelamentos_federais',
      'wa_atendimento_conversas',
      'wa_atendimento_mensagens',
      'nfe_recebidas',
      'exclusoes_empresa_backup',
      'whatsapp_notificacoes_autorizadas',
      'whatsapp_envios',
      'elliza_diretivas',
      'elliza_aprovacoes',
      'elliza_perfil',
      'backups_execucoes',
      'sops',
      'processos_operacionais',
      'processo_etapas',
      'elisa_jobs',
      'elisa_evidencias',
      'processo_pendencias',
      'elliza_agente_externo_chaves',
      'socios',
      'pro_labore_lancamentos',
      'prolabore_fator_r_alertas',
      'elliza_comandos',
      'pesquisas_tributarias',
    ]
    for (let i = 0; i < A.length; i++) {
      const col = app.findCollectionByNameOrId(A[i])
      col.listRule = "@request.auth.id != ''"
      col.viewRule = "@request.auth.id != ''"
      col.createRule = "@request.auth.id != ''"
      col.updateRule = "@request.auth.id != ''"
      col.deleteRule = "@request.auth.id != ''"
      app.save(col)
    }

    const POR_PERFIL = {
      certificados_digitais: "perfil ?!= 'cliente'",
      verbas_catalogo: "perfil ?!= 'cliente'",
      publicacoes_legislativas: "perfil ?!= 'cliente'",
      parametros_normativos: "perfil ?!= 'cliente'",
    }
    const nomesPerfil = Object.keys(POR_PERFIL)
    for (let i = 0; i < nomesPerfil.length; i++) {
      const n = nomesPerfil[i]
      const col = app.findCollectionByNameOrId(n)
      const r =
        "@request.auth.id != '' && @request.auth.tenant_members_via_user_id." + POR_PERFIL[n]
      col.listRule = r
      col.viewRule = r
      col.createRule = r
      col.updateRule = r
      col.deleteRule = r
      app.save(col)
    }

    // integra_contador_* tinha regra por perfil com lista de perfis
    const ics = app.findCollectionByNameOrId('integra_contador_config')
    ics.listRule =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'"
    ics.viewRule = ics.listRule
    ics.createRule =
      "@request.auth.id != '' && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')"
    ics.updateRule = ics.createRule
    ics.deleteRule = ics.createRule
    app.save(ics)

    const icc = app.findCollectionByNameOrId('integra_contador_consumo')
    icc.listRule = ics.listRule
    icc.viewRule = ics.listRule
    icc.createRule = ics.createRule
    icc.updateRule = ics.createRule
    icc.deleteRule = ics.createRule
    app.save(icc)
  },
)

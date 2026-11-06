/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0129 — Isolamento multi-tenant nas regras de acesso (Fase 1)
 *
 * PROBLEMA
 * A maior parte das coleções de negócio tinha regras do tipo:
 *     @request.auth.id != ''
 * o que libera leitura e escrita para QUALQUER usuário autenticado, de
 * qualquer escritório. O prompt dos agentes fala em "isolamento rigoroso",
 * mas quem impõe isso é a regra do banco, não o prompt.
 *
 * PRINCIPIO: SO ESTREITAR, NUNCA ALARGAR, e nunca gravar regra inválida.
 * Por coleção:
 *   - sem `tenant_id`  -> ignorada
 *   - regra nula       -> permanece nula (só superusuário)
 *   - fluxo público    -> PULADA (Fase 1b, exige ajuste de frontend)
 *   - regra genérica   -> vira a regra de tenant
 *   - regra específica -> composta `(original) && (tenant)`
 * Cada coleção roda em try/catch próprio: uma falha não derruba as outras.
 *
 * SINTAXE (PocketBase 0.36)
 * `@request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id`
 * back-relation; `?=` = "pelo menos um" (usuário pode ter mais de um vínculo).
 *
 * IMPACTO NO BACKEND
 * Hooks, jobs e agentes rodam como superusuário e não passam por RLS —
 * nenhuma rotina ou agente deixa de funcionar. Muda o acesso direto do
 * cliente (SDK no navegador).
 */

migrate(
  (app) => {
    const GENERICA = "@request.auth.id != ''"
    const VINCULO = '@request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id'
    const EH_STAFF = "@request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'"
    const R_LIST_VIEW = GENERICA + ' && ' + VINCULO
    const R_WRITE = GENERICA + ' && ' + VINCULO + ' && ' + EH_STAFF

    const COLECOES = [
      'empresas',
      'obrigacoes',
      'lancamentos_contabeis',
      'plano_contas',
      'mapeamento_contabil',
      'workflows',
      'workflow_activity',
      'fiscal',
      'funcionarios',
      'folha_pagamento',
      'eventos_dp',
      'verbas_lancamentos',
      'ferias_periodos',
      'decimo_terceiro',
      'rescisoes',
      'beneficios_concedidos',
      'historico_salarial',
      'convencoes_coletivas',
      'ativos',
      'baixas_ativos',
      'fechamento_competencia',
      'fechamento_checklist_itens',
      'contas_bancarias',
      'contas_financeiras',
      'extratos_bancarios',
      'integracoes_bancarias',
      'integracoes_logs',
      'demonstrativos',
      'assinaturas_demonstrativos',
      'impostos_retidos',
      'pre_lancamentos',
      'contratos_honorarios',
      'company_formation',
      'empresa_cadastro_assistido',
      'socios',
      'pro_labore_lancamentos',
      'prolabore_fator_r_alertas',
      'guias_pagamentos',
      'parcelamentos_federais',
      'sped_arquivos',
      'esocial_config',
      'esocial_eventos',
      'reinf_eventos',
      'dctfweb_declaracoes',
      'nfse_config',
      'nfse_solicitacoes',
      'nfse_notas_emitidas',
      'nfe_config',
      'nfe_recebidas',
      'nfe_sync_logs',
      'certidoes',
      'ecac_comunicacoes',
      'rfb_config',
      'rfb_sync_logs',
      'defis_declaracoes',
      'patrimonio_transferencias',
      'cobrancas',
      'cobrancas_recorrentes',
      'faturamentos_recorrentes',
      'elliza_aprovacoes',
      'elliza_diretivas',
      'elliza_perfil',
      'elisa_jobs',
      'elisa_evidencias',
      'processo_pendencias',
      'processos_operacionais',
      'processo_etapas',
      'whatsapp_leads_contatos',
      'whatsapp_templates',
      'whatsapp_notificacoes_autorizadas',
      'whatsapp_envios',
      'wa_atendimento_conversas',
      'wa_atendimento_mensagens',
      'simulacoes_reforma',
      'rankings_reforma_trimestral',
      'pesquisas_tributarias',
      'nfiscal',
      'elliza_comandos',
      'empresas_migracoes_lote',
      'empresas_migracoes_onboarding',
      'backups_execucoes',
      'exclusoes_empresa_backup',
    ]

    let alteradas = 0
    let ignoradas = 0
    let puladas = 0
    let falhas = 0

    for (let i = 0; i < COLECOES.length; i++) {
      const nome = COLECOES[i]

      try {
        let col
        try {
          col = app.findCollectionByNameOrId(nome)
        } catch (_) {
          ignoradas++
          continue
        }

        // Só faz sentido em coleção que tem o campo de tenant
        if (!col.fields.getByName('tenant_id')) {
          ignoradas++
          continue
        }

        const regras = [col.listRule, col.viewRule, col.createRule, col.updateRule, col.deleteRule]

        // Fluxo público em qualquer regra -> não tocar nesta fase
        let publica = false
        for (let r = 0; r < regras.length; r++) {
          const v = regras[r]
          if (v !== null && typeof v === 'string') {
            if (v === '' || v.indexOf('||') >= 0) publica = true
          }
        }
        if (publica) {
          console.log('[0129] PULADA fluxo publico: ' + nome)
          puladas++
          continue
        }

        // Função local: estreita sem nunca produzir string vazia
        const calc = function (atual, alvo) {
          if (atual === null || typeof atual !== 'string') return null
          if (atual === '') return null
          if (atual === GENERICA) return alvo
          if (atual.indexOf('||') >= 0) return atual
          const composta = '(' + atual + ') && (' + alvo + ')'
          return composta.length > 0 ? composta : null
        }

        const novoList = calc(col.listRule, R_LIST_VIEW)
        const novoView = calc(col.viewRule, R_LIST_VIEW)
        const novoCreate = calc(col.createRule, R_WRITE)
        const novoUpdate = calc(col.updateRule, R_WRITE)
        const novoDelete = calc(col.deleteRule, R_WRITE)

        col.listRule = novoList
        col.viewRule = novoView
        col.createRule = novoCreate
        col.updateRule = novoUpdate
        col.deleteRule = novoDelete

        app.save(col)
        alteradas++
      } catch (err) {
        falhas++
        console.log('[0129] FALHA em ' + nome + ': ' + err)
      }
    }

    // ---- documentos: GED com fluxo de link público em origem_documento
    try {
      const col = app.findCollectionByNameOrId('documentos')
      col.listRule = R_LIST_VIEW
      col.viewRule = GENERICA + ' && (' + R_LIST_VIEW + " || origem_documento = 'link_publico')"
      col.createRule =
        GENERICA + ' && (' + R_WRITE + " || @request.body.origem_documento = 'link_publico')"
      col.updateRule = R_WRITE
      col.deleteRule = GENERICA + ' && (' + R_WRITE + " || origem_documento = 'link_publico')"
      app.save(col)
      alteradas++
    } catch (err) {
      console.log('[0129] erro em documentos: ' + err)
    }

    // ---- tenants: enxerga apenas os escritórios a que pertence
    try {
      const col = app.findCollectionByNameOrId('tenants')
      col.listRule = GENERICA + ' && @request.auth.tenant_members_via_user_id.tenant_id ?= id'
      col.viewRule = GENERICA + ' && @request.auth.tenant_members_via_user_id.tenant_id ?= id'
      col.createRule = GENERICA
      col.updateRule =
        GENERICA +
        ' && @request.auth.tenant_members_via_user_id.tenant_id ?= id' +
        ' && ' +
        EH_STAFF
      col.deleteRule = null
      app.save(col)
      alteradas++
    } catch (err) {
      console.log('[0129] erro em tenants: ' + err)
    }

    // ---- tenant_members: vê os membros do próprio escritório
    try {
      const col = app.findCollectionByNameOrId('tenant_members')
      col.listRule = R_LIST_VIEW
      col.viewRule = R_LIST_VIEW
      col.createRule = R_WRITE
      col.updateRule = R_WRITE
      col.deleteRule = R_WRITE
      app.save(col)
      alteradas++
    } catch (err) {
      console.log('[0129] erro em tenant_members: ' + err)
    }

    // ---- audit_log: leitura por tenant; create preservado (link público)
    try {
      const col = app.findCollectionByNameOrId('audit_log')
      col.listRule = R_LIST_VIEW
      col.viewRule = R_LIST_VIEW
      col.updateRule = null
      col.deleteRule = R_WRITE
      app.save(col)
      alteradas++
    } catch (err) {
      console.log('[0129] erro em audit_log: ' + err)
    }

    console.log(
      '[0129] alteradas=' +
        alteradas +
        ' ignoradas=' +
        ignoradas +
        ' puladasPublicas=' +
        puladas +
        ' falhas=' +
        falhas,
    )
  },
  (app) => {
    const GENERICA = "@request.auth.id != ''"
    const COLECOES = [
      'empresas',
      'obrigacoes',
      'lancamentos_contabeis',
      'plano_contas',
      'mapeamento_contabil',
      'workflows',
      'workflow_activity',
      'fiscal',
      'funcionarios',
      'folha_pagamento',
      'eventos_dp',
      'verbas_lancamentos',
      'ferias_periodos',
      'decimo_terceiro',
      'rescisoes',
      'beneficios_concedidos',
      'historico_salarial',
      'convencoes_coletivas',
      'ativos',
      'baixas_ativos',
      'fechamento_competencia',
      'fechamento_checklist_itens',
      'contas_bancarias',
      'contas_financeiras',
      'extratos_bancarios',
      'integracoes_bancarias',
      'integracoes_logs',
      'demonstrativos',
      'assinaturas_demonstrativos',
      'impostos_retidos',
      'pre_lancamentos',
      'contratos_honorarios',
      'tenant_members',
      'company_formation',
      'empresa_cadastro_assistido',
      'socios',
      'pro_labore_lancamentos',
      'prolabore_fator_r_alertas',
      'guias_pagamentos',
      'parcelamentos_federais',
      'sped_arquivos',
      'esocial_config',
      'esocial_eventos',
      'reinf_eventos',
      'dctfweb_declaracoes',
      'nfse_config',
      'nfse_solicitacoes',
      'nfse_notas_emitidas',
      'nfe_config',
      'nfe_recebidas',
      'nfe_sync_logs',
      'certidoes',
      'ecac_comunicacoes',
      'rfb_config',
      'rfb_sync_logs',
      'defis_declaracoes',
      'patrimonio_transferencias',
      'cobrancas',
      'cobrancas_recorrentes',
      'faturamentos_recorrentes',
      'elliza_aprovacoes',
      'elliza_diretivas',
      'elliza_perfil',
      'elisa_jobs',
      'elisa_evidencias',
      'processo_pendencias',
      'processos_operacionais',
      'processo_etapas',
      'whatsapp_leads_contatos',
      'whatsapp_templates',
      'whatsapp_notificacoes_autorizadas',
      'whatsapp_envios',
      'wa_atendimento_conversas',
      'wa_atendimento_mensagens',
      'simulacoes_reforma',
      'rankings_reforma_trimestral',
      'pesquisas_tributarias',
      'nfiscal',
      'elliza_comandos',
      'empresas_migracoes_lote',
      'empresas_migracoes_onboarding',
      'backups_execucoes',
      'exclusoes_empresa_backup',
    ]

    for (let i = 0; i < COLECOES.length; i++) {
      try {
        const col = app.findCollectionByNameOrId(COLECOES[i])
        col.listRule = GENERICA
        col.viewRule = GENERICA
        col.createRule = GENERICA
        col.updateRule = GENERICA
        col.deleteRule = GENERICA
        app.save(col)
      } catch (_) {}
    }

    try {
      const col = app.findCollectionByNameOrId('documentos')
      col.listRule = GENERICA
      col.viewRule = GENERICA + " || origem_documento = 'link_publico'"
      col.createRule = GENERICA + " || @request.body.origem_documento = 'link_publico'"
      col.updateRule = GENERICA
      col.deleteRule = GENERICA + " || origem_documento = 'link_publico'"
      app.save(col)
    } catch (_) {}

    try {
      const col = app.findCollectionByNameOrId('tenants')
      col.listRule = GENERICA
      col.viewRule = GENERICA
      col.createRule = GENERICA
      col.updateRule = GENERICA
      col.deleteRule = null
      app.save(col)
    } catch (_) {}

    try {
      const col = app.findCollectionByNameOrId('audit_log')
      col.listRule = GENERICA
      col.viewRule = GENERICA
      col.updateRule = null
      col.deleteRule = GENERICA
      app.save(col)
    } catch (_) {}
  },
)

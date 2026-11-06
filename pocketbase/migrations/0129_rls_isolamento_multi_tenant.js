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
 * PRINCIPIO DE SEGURANCA DESTA MIGRATION: SO ESTREITAR, NUNCA ALARGAR.
 * Para cada uma das 5 regras de cada coleção:
 *   - regra era `null`   -> permanece `null` (já era superusuário apenas)
 *   - coleção tem fluxo público (regra vazia ou com `||`) -> PULADA, Fase 1b
 *   - regra era genérica -> substituída pela regra de tenant
 *   - regra era outra    -> composta: `(original) && (tenant)`
 * Assim nenhuma coleção passa a ser MAIS acessível do que era, e fluxos
 * públicos (link de token, portal) não são quebrados por esta migration.
 *
 * SINTAXE
 * `@request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id`
 * back-relation do PocketBase 0.36; `?=` = "pelo menos um", necessário
 * porque o usuário pode ter vínculo com mais de um escritório.
 *
 * IMPACTO NO BACKEND
 * Hooks, jobs e agentes rodam como superusuário ($app.*) e não passam por
 * RLS — nenhuma rotina, cron ou agente deixa de funcionar. O que muda é o
 * acesso direto do cliente (SDK no navegador).
 *
 * FORA DE ESCOPO (Fase 1b, exige ajuste de frontend)
 * - pedidos_documentos, company_onboarding_workflow e demais fluxos por token
 * - portal_acessos / portal_empregado_acessos
 * Coleções sem `tenant_id` são ignoradas automaticamente.
 */

const GENERICA = "@request.auth.id != ''"

const VINCULO = '@request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id'
const EH_STAFF = "@request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'"

const R_LIST_VIEW = GENERICA + ' && ' + VINCULO
const R_WRITE = GENERICA + ' && ' + VINCULO + ' && ' + EH_STAFF

const COLECOES_NEGOCIO = [
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
  'certificados_digitais',
  'company_formation',
  'company_onboarding_workflow',
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

/** Aplica a regra de tenant preservando o que já era mais restrito. */
function estreitar(atual, alvo) {
  if (atual === null) return null
  if (atual === '') return ''
  if (atual === GENERICA) return alvo
  return '(' + atual + ') && (' + alvo + ')'
}

/**
 * Detecta regra que concede acesso SEM autenticação (fluxo público):
 * regra vazia ou com `||` abre uma porta que o filtro de tenant quebraria.
 */
function temFluxoPublico(regra) {
  if (regra === null) return false
  if (regra === '') return true
  return regra.indexOf('||') >= 0
}

migrate(
  (app) => {
    let alteradas = 0
    let ignoradas = 0
    let publicas = 0

    for (const nome of COLECOES_NEGOCIO) {
      let col
      try {
        col = app.findCollectionByNameOrId(nome)
      } catch (_) {
        console.log('[0129] inexistente, ignorada: ' + nome)
        continue
      }

      if (!col.fields.getByName('tenant_id')) {
        console.log('[0129] sem tenant_id, ignorada: ' + nome)
        ignoradas++
        continue
      }

      const antes = {
        list: col.listRule,
        view: col.viewRule,
        create: col.createRule,
        update: col.updateRule,
        delete: col.deleteRule,
      }

      if (
        temFluxoPublico(antes.list) ||
        temFluxoPublico(antes.view) ||
        temFluxoPublico(antes.create) ||
        temFluxoPublico(antes.update) ||
        temFluxoPublico(antes.delete)
      ) {
        console.log('[0129] PULADA com fluxo publico (Fase 1b): ' + nome)
        publicas++
        continue
      }

      col.listRule = estreitar(antes.list, R_LIST_VIEW)
      col.viewRule = estreitar(antes.view, R_LIST_VIEW)
      col.createRule = estreitar(antes.create, R_WRITE)
      col.updateRule = estreitar(antes.update, R_WRITE)
      col.deleteRule = estreitar(antes.delete, R_WRITE)

      app.save(col)
      alteradas++
    }

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

    try {
      const col = app.findCollectionByNameOrId('audit_log')
      col.listRule = R_LIST_VIEW
      col.viewRule = R_LIST_VIEW
      col.updateRule = null
      col.deleteRule = R_WRITE
      // createRule preservado: fluxos de link público gravam auditoria
      app.save(col)
      alteradas++
    } catch (err) {
      console.log('[0129] erro em audit_log: ' + err)
    }

    console.log(
      '[0129] aplicado em ' +
        alteradas +
        ' colecoes; ' +
        ignoradas +
        ' sem tenant_id; ' +
        publicas +
        ' puladas por fluxo publico',
    )
  },
  (app) => {
    const todas = COLECOES_NEGOCIO.concat(['tenant_members'])
    for (const nome of todas) {
      try {
        const col = app.findCollectionByNameOrId(nome)
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

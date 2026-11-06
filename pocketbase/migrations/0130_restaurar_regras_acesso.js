/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0130 — RESTAURAÇÃO de emergência das regras de acesso
 *
 * CONTEXTO
 * A migration 0129 tentou ler a regra atual de cada coleção para decidir se
 * estreitava ou preservava. A leitura não funcionou como esperado dentro da
 * runtime de migration: o valor lido não chegou como string e o código
 * gravou `null` em todas as regras. No PocketBase, `null` significa
 * "somente superusuário" — ou seja, o acesso do cliente pela API ficou
 * bloqueado.
 *
 * O QUE ESTA MIGRATION FAZ
 * Restaura explicitamente, com strings literais (sem leitura de estado e sem
 * concatenação condicional), o estado anterior à 0129. É uma operação de
 * restauração de serviço, não uma melhoria.
 *
 * DEPOIS DESTA MIGRATION
 * O isolamento por tenant volta a ser um trabalho a ser feito com validação
 * em UMA coleção de teste antes de qualquer aplicação em lote.
 */

migrate(
  (app) => {
    // Regra original da maioria das coleções de negócio
    const ORIGINAL = "@request.auth.id != ''"

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

    let restauradas = 0
    let falhas = 0

    for (let i = 0; i < COLECOES.length; i++) {
      try {
        const col = app.findCollectionByNameOrId(COLECOES[i])
        col.listRule = ORIGINAL
        col.viewRule = ORIGINAL
        col.createRule = ORIGINAL
        col.updateRule = ORIGINAL
        col.deleteRule = ORIGINAL
        app.save(col)
        restauradas++
      } catch (err) {
        falhas++
        console.log('[0130] falha em ' + COLECOES[i] + ': ' + err)
      }
    }

    // ---- documentos: GED, com fluxo de link publico em origem_documento
    try {
      const col = app.findCollectionByNameOrId('documentos')
      col.listRule = "@request.auth.id != ''"
      col.viewRule = "@request.auth.id != '' || origem_documento = 'link_publico'"
      col.createRule = "@request.auth.id != '' || @request.body.origem_documento = 'link_publico'"
      col.updateRule = "@request.auth.id != ''"
      col.deleteRule = "@request.auth.id != '' || origem_documento = 'link_publico'"
      app.save(col)
      restauradas++
    } catch (err) {
      console.log('[0130] falha em documentos: ' + err)
    }

    // ---- tenants
    try {
      const col = app.findCollectionByNameOrId('tenants')
      col.listRule = "@request.auth.id != ''"
      col.viewRule = "@request.auth.id != ''"
      col.createRule = "@request.auth.id != ''"
      col.updateRule = "@request.auth.id != ''"
      col.deleteRule = null
      app.save(col)
      restauradas++
    } catch (err) {
      console.log('[0130] falha em tenants: ' + err)
    }

    // ---- audit_log: create publico (fluxos de link publico gravam auditoria),
    //      update restrito a superusuario
    try {
      const col = app.findCollectionByNameOrId('audit_log')
      col.listRule = "@request.auth.id != ''"
      col.viewRule = "@request.auth.id != ''"
      col.createRule = ''
      col.updateRule = null
      col.deleteRule = "@request.auth.id != ''"
      app.save(col)
      restauradas++
    } catch (err) {
      console.log('[0130] falha em audit_log: ' + err)
    }

    // ---- notificacoes: por destinatario, como era antes
    try {
      const col = app.findCollectionByNameOrId('notificacoes')
      col.listRule =
        "@request.auth.id != '' && (usuario_destino_id = @request.auth.id || usuario_destino_id = '')"
      col.viewRule =
        "@request.auth.id != '' && (usuario_destino_id = @request.auth.id || usuario_destino_id = '')"
      col.createRule = ''
      col.updateRule =
        "@request.auth.id != '' && (usuario_destino_id = @request.auth.id || usuario_destino_id = '')"
      col.deleteRule =
        "@request.auth.id != '' && (usuario_destino_id = @request.auth.id || usuario_destino_id = '')"
      app.save(col)
      restauradas++
    } catch (err) {
      console.log('[0130] falha em notificacoes: ' + err)
    }

    console.log('[0130] restauradas=' + restauradas + ' falhas=' + falhas)
  },
  (app) => {
    // Down: não há o que reverter com segurança aqui.
    // Reverter para o estado quebrado (regras null) seria pior.
  },
)

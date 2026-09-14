/// <reference path="../pb_data/types.d.ts" />
// Migration: 0069_cleanup_demo_test_data.js
// Exclui exclusivamente os dados artificiais de validação/demonstração criados durante os testes e seeds:
// Empresas de demonstração:
// 1. feb9h004jovi7xh - Inovatech Soluções Digitais Ltda (33456789000112 / 33.456.789/0001-12)
// 2. xgfoy8yifisdc0n - Café & Grãos Gourmet do Sul Comércio Ltda (18902345000188 / 18.902.345/0001-88)
// 3. 3eq6f6vfkztb3sa - LogPrime Transportes e Armazéns Gerais S/A (07654321000144 / 07.654.321/0001-44)
// 4. 83dseskbon9x496 - Dra. Beatriz Santos Clínica Médica Ltda (45123987000133 / 45.123.987/0001-33)
// 5. 8uhl7ybqbs2buay - Nova Era Tecnologia & Soluções Contábeis Ltda (11444777000161 / 11.444.777/0001-61)
// E também o usuário de teste cliente Ana Beatriz Silveira (rt523rf9gnvewq7 / contato.financeiro@inovatech.com.br).
//
// Preserva INTEGRALMENTE:
// - Todos os tenants (ex: Rumo Consultoria Contábil, Elissandro Contabilidade)
// - Usuários reais e de sistema (rumo@rumoconsultoriacontabil.com.br, carlos.silva@rumoconsultoria.com.br, elissandro.souza@icloud.com)
// - Empresas reais cadastradas pelo usuário (CNPJs 59696561000110, 63574549000100, 59344224000163, etc.)
// - Configurações de tenant, plano de contas padrão, modelos e templates globais.

migrate(
  (app) => {
    console.log('[CLEANUP_DEMO_DATA] Iniciando exclusão de dados de teste de validação...')

    // CNPJs das 5 empresas de demonstração
    const demoCnpjs = [
      '33456789000112',
      '33.456.789/0001-12',
      '18902345000188',
      '18.902.345/0001-88',
      '07654321000144',
      '07.654.321/0001-44',
      '45123987000133',
      '45.123.987/0001-33',
      '11444777000161',
      '11.444.777/0001-61',
    ]

    // IDs fixos conhecidos das empresas de demonstração
    const demoEmpresaIds = [
      'feb9h004jovi7xh',
      'xgfoy8yifisdc0n',
      '3eq6f6vfkztb3sa',
      '83dseskbon9x496',
      '8uhl7ybqbs2buay',
    ]

    const allEmpresaIdsSet = new Set(demoEmpresaIds)

    // Buscar no banco registros adicionais que possam coincidir com esses CNPJs
    for (const cnpj of demoCnpjs) {
      try {
        const found = app.findRecordsByFilter('empresas', `cnpj = '${cnpj}'`, '', 10, 0)
        for (const f of found) {
          allEmpresaIdsSet.add(f.id)
        }
      } catch (_) {}
    }

    const allEmpresaIds = Array.from(allEmpresaIdsSet)
    console.log('[CLEANUP_DEMO_DATA] Empresas de demonstração identificadas:', allEmpresaIds.length)

    // Formatar lista SQL para IN (...)
    const sqlIdsList = allEmpresaIds.map((id) => `'${id}'`).join(',')

    // Helper para executar delete e logar
    const deleteFromTable = (tableName, condition) => {
      try {
        const query = `DELETE FROM ${tableName} WHERE ${condition}`
        app.db().newQuery(query).execute()
        console.log(
          `[CLEANUP_DEMO_DATA] ${tableName}: limpos registros com condição (${condition})`,
        )
      } catch (err) {
        console.warn(
          `[CLEANUP_DEMO_DATA] Aviso ao limpar ${tableName}:`,
          err && err.message ? err.message : err,
        )
      }
    }

    // 1. Mensagens de WhatsApp do agente de atendimento
    deleteFromTable(
      'wa_atendimento_mensagens',
      `conversa IN (SELECT id FROM wa_atendimento_conversas WHERE empresa IN (${sqlIdsList}))`,
    )
    deleteFromTable('wa_atendimento_conversas', `empresa IN (${sqlIdsList})`)

    // 2. NFS-e e solicitações
    deleteFromTable('nfse_notas_emitidas', `empresa IN (${sqlIdsList})`)
    deleteFromTable('nfse_solicitacoes', `empresa IN (${sqlIdsList})`)

    // Se a nfse_config estiver apontando empresa_padrao para alguma empresa demo, desvincular
    try {
      app
        .db()
        .newQuery(
          `UPDATE nfse_config SET empresa_padrao = '' WHERE empresa_padrao IN (${sqlIdsList})`,
        )
        .execute()
    } catch (_) {}

    // 3. NFe recebidas e logs
    deleteFromTable('nfe_recebidas', `empresa IN (${sqlIdsList})`)
    deleteFromTable('nfe_sync_logs', `empresa IN (${sqlIdsList})`)
    deleteFromTable('nfe_config', `empresa IN (${sqlIdsList})`)

    // 4. SPED, CNDs / Certidões, e-CAC e Conector RFB
    deleteFromTable('sped_arquivos', `empresa IN (${sqlIdsList})`)
    deleteFromTable('certidoes', `empresa IN (${sqlIdsList})`)
    deleteFromTable('ecac_comunicacoes', `empresa IN (${sqlIdsList})`)
    deleteFromTable('rfb_sync_logs', `empresa IN (${sqlIdsList})`)
    deleteFromTable('rfb_config', `empresa IN (${sqlIdsList})`)

    // 5. Guias de pagamentos e parcelamentos federais
    deleteFromTable('guias_pagamentos', `empresa IN (${sqlIdsList})`)
    deleteFromTable('parcelamentos_federais', `empresa IN (${sqlIdsList})`)

    // 6. Departamento Pessoal & Benefícios & Convenções
    deleteFromTable('beneficios_concedidos', `empresa IN (${sqlIdsList})`)
    deleteFromTable('historico_salarial', `empresa IN (${sqlIdsList})`)
    deleteFromTable('convencoes_coletivas', `empresa IN (${sqlIdsList})`)
    deleteFromTable('rescisoes', `empresa IN (${sqlIdsList})`)
    deleteFromTable('decimo_terceiro', `empresa IN (${sqlIdsList})`)
    deleteFromTable('ferias_periodos', `empresa IN (${sqlIdsList})`)
    deleteFromTable('verbas_lancamentos', `empresa IN (${sqlIdsList})`)
    deleteFromTable('verbas_catalogo', `empresa IN (${sqlIdsList})`)
    deleteFromTable('folha_pagamento', `empresa IN (${sqlIdsList})`)
    deleteFromTable('eventos_dp', `empresa IN (${sqlIdsList})`)
    deleteFromTable('esocial_eventos', `empresa IN (${sqlIdsList})`)
    deleteFromTable('esocial_config', `empresa IN (${sqlIdsList})`)
    deleteFromTable('reinf_eventos', `empresa IN (${sqlIdsList})`)
    deleteFromTable('dctfweb_declaracoes', `empresa IN (${sqlIdsList})`)
    deleteFromTable('funcionarios', `empresa IN (${sqlIdsList})`)

    // 7. Simulações da Reforma Tributária vinculadas às empresas demo
    deleteFromTable('simulacoes_reforma', `empresa IN (${sqlIdsList})`)

    // Rankings de reforma trimestral de teste das seeds (2025-T4, etc.)
    deleteFromTable('rankings_reforma_trimestral', "periodo IN ('2025-T4', '2026-T1')")

    // 8. Faturamentos Recorrentes, Contratos de Honorários e Assinaturas
    deleteFromTable('faturamentos_recorrentes', `empresa IN (${sqlIdsList})`)
    deleteFromTable('assinaturas_demonstrativos', `empresa IN (${sqlIdsList})`)
    deleteFromTable('contratos_honorarios', `empresa IN (${sqlIdsList})`)

    // 9. Demonstrativos Contábeis, Impostos Retidos e Pré-Lançamentos
    deleteFromTable('impostos_retidos', `empresa IN (${sqlIdsList})`)
    deleteFromTable('demonstrativos', `empresa IN (${sqlIdsList})`)
    deleteFromTable('pre_lancamentos', `empresa IN (${sqlIdsList})`)

    // 10. Financeiro & Integrações Bancárias
    deleteFromTable(
      'integracoes_logs',
      `conta_bancaria IN (SELECT id FROM contas_bancarias WHERE empresa IN (${sqlIdsList}))`,
    )
    deleteFromTable('integracoes_bancarias', `empresa IN (${sqlIdsList})`)
    deleteFromTable('extratos_bancarios', `empresa IN (${sqlIdsList})`)
    deleteFromTable('contas_financeiras', `empresa IN (${sqlIdsList})`)
    deleteFromTable('contas_bancarias', `empresa IN (${sqlIdsList})`)

    // 11. Patrimônio & Fechamento de Competência
    deleteFromTable('baixas_ativos', `empresa IN (${sqlIdsList})`)
    deleteFromTable('ativos', `empresa IN (${sqlIdsList})`)
    deleteFromTable('fechamento_checklist_itens', `empresa IN (${sqlIdsList})`)
    deleteFromTable('fechamento_competencia', `empresa IN (${sqlIdsList})`)

    // 12. Contábil: lançamentos contábeis
    deleteFromTable('lancamentos_contabeis', `empresa IN (${sqlIdsList})`)

    // 13. Fiscal, Obrigações e Workflows
    deleteFromTable('fiscal', `empresa IN (${sqlIdsList})`)
    deleteFromTable('obrigacoes', `empresa IN (${sqlIdsList})`)
    deleteFromTable(
      'workflow_activity',
      `workflow_id IN (SELECT id FROM workflows WHERE empresa_id IN (${sqlIdsList}))`,
    )
    deleteFromTable('workflows', `empresa_id IN (${sqlIdsList})`)

    // 14. Documentos GED das empresas demo
    deleteFromTable('documentos', `empresa_id IN (${sqlIdsList})`)

    // 15. Certificados Digitais e Cadastro Assistido das empresas demo
    deleteFromTable('certificados_digitais', `empresa IN (${sqlIdsList})`)
    deleteFromTable('empresa_cadastro_assistido', `empresa IN (${sqlIdsList})`)

    // 16. Leads WhatsApp vinculados às empresas demo
    deleteFromTable('whatsapp_leads_contatos', `empresa_associada IN (${sqlIdsList})`)

    // 17. Portal de acessos:
    // Excluir acessos vinculados às empresas de teste
    deleteFromTable('portal_acessos', `empresa IN (${sqlIdsList})`)

    // 18. Audit Log de teste (registros de auditoria gerados nas seeds para as empresas demo)
    deleteFromTable('audit_log', `entidade_id IN (${sqlIdsList})`)

    // 19. Usuário de teste cliente (Ana Beatriz - Inovatech)
    // Preservar absolutamente: rumo@, carlos.silva@, elissandro.souza@icloud.com
    try {
      const userAna = app.findFirstRecordByData(
        'users',
        'email',
        'contato.financeiro@inovatech.com.br',
      )
      if (userAna) {
        deleteFromTable('tenant_members', `user_id = '${userAna.id}'`)
        deleteFromTable('portal_acessos', `user = '${userAna.id}'`)
        app.delete(userAna)
        console.log(
          '[CLEANUP_DEMO_DATA] Usuário de teste Ana Beatriz (Inovatech) excluído com sucesso.',
        )
      }
    } catch (_) {}

    // 20. Finalmente, excluir as empresas de demonstração
    deleteFromTable('empresas', `id IN (${sqlIdsList})`)
    console.log('[CLEANUP_DEMO_DATA] Empresas de demonstração excluídas com sucesso!')

    console.log('[CLEANUP_DEMO_DATA] Limpeza de dados de validação finalizada com sucesso.')
  },
  (app) => {
    console.log('[CLEANUP_DEMO_DATA] Rollback de limpeza.')
  },
)

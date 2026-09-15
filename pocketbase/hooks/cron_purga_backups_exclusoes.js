// Hook: cron_purga_backups_exclusoes.js
// Executa periodicamente (a cada 15 minutos) para localizar backups de empresas
// com status 'retido' e purga_em vencida (>= 24 horas após a solicitação),
// executando a purga definitiva física dos registros filhos e da empresa, com registro no audit_log.

cronAdd('purga_backups_24h_empresas', '*/15 * * * *', () => {
  try {
    console.log('[CRON_PURGA] Verificando backups com retenção vencida (> 24h)...')
    const nowIso = new Date().toISOString()

    // Buscar backups retidos cuja data de purga já passou
    let backupsVencidos = []
    try {
      backupsVencidos = $app.findRecordsByFilter(
        'exclusoes_empresa_backup',
        "status = 'retido' && purga_em <= '" + nowIso + "'",
        'purga_em',
        50,
        0,
      )
    } catch (errFilter) {
      console.log('[CRON_PURGA] Nenhum backup vencido encontrado ou erro no filtro:', errFilter)
      return
    }

    if (!backupsVencidos || backupsVencidos.length === 0) {
      console.log('[CRON_PURGA] Nenhum backup pendente de purga no momento.')
      return
    }

    console.log('[CRON_PURGA] Total de backups para purgar agora:', backupsVencidos.length)

    for (let b = 0; b < backupsVencidos.length; b++) {
      const backup = backupsVencidos[b]
      const backupId = backup.id
      const tenantId = backup.getString('tenant_id')
      const empresaId = backup.getString('empresa_id')
      const razaoSocial = backup.getString('razao_social')
      const cnpj = backup.getString('cnpj')

      console.log(
        '[CRON_PURGA] Iniciando purga da empresa ' +
          razaoSocial +
          ' (' +
          cnpj +
          ') - ID: ' +
          empresaId,
      )

      const sqlIdsList = "'" + empresaId + "'"

      const deleteFromTable = (tableName, condition) => {
        try {
          const query = 'DELETE FROM ' + tableName + ' WHERE ' + condition
          $app.db().newQuery(query).execute()
        } catch (err) {
          console.warn(
            '[CRON_PURGA] Aviso ao limpar ' + tableName + ':',
            err && err.message ? err.message : err,
          )
        }
      }

      // Purga em cascata de todos os filhos
      deleteFromTable(
        'wa_atendimento_mensagens',
        'conversa IN (SELECT id FROM wa_atendimento_conversas WHERE empresa IN (' +
          sqlIdsList +
          '))',
      )
      deleteFromTable('wa_atendimento_conversas', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('nfse_notas_emitidas', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('nfse_solicitacoes', 'empresa IN (' + sqlIdsList + ')')
      try {
        $app
          .db()
          .newQuery(
            "UPDATE nfse_config SET empresa_padrao = '' WHERE empresa_padrao IN (" +
              sqlIdsList +
              ')',
          )
          .execute()
      } catch (_) {}
      deleteFromTable('nfe_recebidas', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('nfe_sync_logs', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('nfe_config', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('sped_arquivos', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('certidoes', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('ecac_comunicacoes', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('rfb_sync_logs', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('rfb_config', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('guias_pagamentos', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('parcelamentos_federais', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('beneficios_concedidos', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('historico_salarial', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('convencoes_coletivas', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('rescisoes', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('decimo_terceiro', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('ferias_periodos', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('verbas_lancamentos', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('verbas_catalogo', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('folha_pagamento', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('eventos_dp', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('esocial_eventos', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('esocial_config', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('reinf_eventos', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('dctfweb_declaracoes', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('funcionarios', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('simulacoes_reforma', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('faturamentos_recorrentes', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('assinaturas_demonstrativos', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('contratos_honorarios', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('impostos_retidos', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('demonstrativos', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('pre_lancamentos', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable(
        'integracoes_logs',
        'conta_bancaria IN (SELECT id FROM contas_bancarias WHERE empresa IN (' + sqlIdsList + '))',
      )
      deleteFromTable('integracoes_bancarias', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('extratos_bancarios', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('contas_financeiras', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('contas_bancarias', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('baixas_ativos', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('ativos', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('fechamento_checklist_itens', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('fechamento_competencia', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('lancamentos_contabeis', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('fiscal', 'empresa_id IN (' + sqlIdsList + ')')
      deleteFromTable('obrigacoes', 'empresa_id IN (' + sqlIdsList + ')')
      deleteFromTable(
        'workflow_activity',
        'workflow_id IN (SELECT id FROM workflows WHERE empresa_id IN (' + sqlIdsList + '))',
      )
      deleteFromTable('workflows', 'empresa_id IN (' + sqlIdsList + ')')
      deleteFromTable('documentos', 'empresa_id IN (' + sqlIdsList + ')')
      deleteFromTable('certificados_digitais', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('empresa_cadastro_assistido', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('whatsapp_leads_contatos', 'empresa_associada IN (' + sqlIdsList + ')')
      deleteFromTable('portal_acessos', 'empresa IN (' + sqlIdsList + ')')
      deleteFromTable('audit_log', 'entidade_id IN (' + sqlIdsList + ')')

      // Exclusão física da empresa
      deleteFromTable('empresas', 'id IN (' + sqlIdsList + ')')

      // Atualiza o registro de backup para 'purgado'
      try {
        backup.set('status', 'purgado')
        backup.set('purgado_em', new Date().toISOString())
        $app.save(backup)
      } catch (errUpd) {
        console.warn('[CRON_PURGA] Erro ao atualizar status do backup:', errUpd)
      }

      // Registra evento de auditoria no audit_log
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_log')
        const auditRec = new Record(auditCol)
        auditRec.set('tenant_id', tenantId)
        auditRec.set('acao', 'Purga definitiva automática após 24h de retenção')
        auditRec.set('entidade_tipo', 'empresas')
        auditRec.set('entidade_id', empresaId)
        auditRec.set(
          'detalhes',
          'A empresa ' +
            razaoSocial +
            ' (CNPJ: ' +
            cnpj +
            ') e todos os seus registros vinculados foram purgados definitivamente da base após o término do período de 24h de retenção segura.',
        )
        $app.save(auditRec)
      } catch (errAudit) {
        console.warn('[CRON_PURGA] Erro ao registrar audit_log:', errAudit)
      }

      console.log('[CRON_PURGA] Purga concluída com sucesso para:', razaoSocial)
    }
  } catch (globalErr) {
    console.log('[CRON_PURGA] Falha geral no cron_purga_backups_exclusoes:', globalErr)
  }
})

// Hook: audit_logger_delete.js
// Fires on delete success for key business collections and logs to audit_log
onRecordAfterDeleteSuccess(
  (e) => {
    try {
      const record = e.record
      const collectionName = record.collection().name
      const tenantId = record.getString('tenant_id')
      if (!tenantId) {
        e.next()
        return
      }

      const auditCol = $app.findCollectionByNameOrId('audit_log')
      const log = new Record(auditCol)
      log.set('tenant_id', tenantId)
      log.set('entidade_tipo', collectionName)
      log.set('entidade_id', record.id)
      log.set('acao', 'Exclusão de ' + collectionName)
      log.set('detalhes', 'Registro removido do sistema (ID: ' + record.id + ')')
      $app.save(log)
    } catch (err) {
      console.log('Error logging audit delete:', err)
    }
    e.next()
  },
  'empresas',
  'documentos',
  'workflows',
  'fiscal',
  'tenant_members',
  'obrigacoes',
  'lancamentos_contabeis',
  'plano_contas',
  'funcionarios',
  'folha_pagamento',
  'eventos_dp',
  'portal_acessos',
  'mapeamento_contabil',
  'ativos',
  'baixas_ativos',
  'fechamento_competencia',
  'contas_financeiras',
  'contas_bancarias',
  'extratos_bancarios',
  'integracoes_bancarias',
  'integracoes_logs',
  'demonstrativos',
  'impostos_retidos',
  'pre_lancamentos',
  'assinaturas_demonstrativos',
  'contratos_honorarios',
)

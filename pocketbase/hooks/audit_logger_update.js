// Hook: audit_logger_update.js
// Fires on update success for key business collections and logs to audit_log
onRecordAfterUpdateSuccess(
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

      let userId = ''
      if (record.has('usuario_upload_id') && record.getString('usuario_upload_id')) {
        userId = record.getString('usuario_upload_id')
      } else if (record.has('criado_por_id') && record.getString('criado_por_id')) {
        userId = record.getString('criado_por_id')
      } else if (record.has('criado_por') && record.getString('criado_por')) {
        userId = record.getString('criado_por')
      } else if (record.has('user_id') && record.getString('user_id')) {
        userId = record.getString('user_id')
      }
      if (userId) {
        log.set('usuario_id', userId)
      }

      let acao = 'Atualização'
      let detalhes = 'Registro atualizado no sistema'

      if (collectionName === 'empresas') {
        acao = 'Atualização de empresa'
        detalhes =
          'Atualizou dados da empresa ' +
          (record.getString('nome_fantasia') || record.getString('razao_social')) +
          ' (status: ' +
          record.getString('status') +
          ')'
      } else if (collectionName === 'documentos') {
        acao = 'Atualização de documento'
        detalhes =
          'Atualizou status do documento ' +
          record.getString('nome_arquivo') +
          ' para ' +
          record.getString('status')
      } else if (collectionName === 'workflows') {
        acao = 'Atualização de workflow'
        detalhes =
          'Alterou o workflow "' +
          record.getString('titulo') +
          '" para status ' +
          record.getString('status')
      } else if (collectionName === 'fiscal') {
        acao = 'Atualização fiscal'
        detalhes =
          'Atualizou obrigação ' +
          record.getString('tipo_obrigacao').toUpperCase() +
          ' (' +
          record.getString('periodo_apuracao') +
          ') para status ' +
          record.getString('status')
      } else if (collectionName === 'tenant_members') {
        acao = 'Alteração de membro'
        detalhes =
          'Atualizou perfil para ' +
          record.getString('perfil') +
          ' (status: ' +
          record.getString('status') +
          ')'
      } else if (collectionName === 'obrigacoes') {
        acao = 'Atualização de obrigação'
        detalhes =
          'Atualizou obrigação ' +
          record.getString('tipo') +
          ' (' +
          record.getString('competencia') +
          ') para status ' +
          record.getString('status')
      } else if (collectionName === 'lancamentos_contabeis') {
        acao = 'Atualização de lançamento contábil'
        detalhes =
          'Alterou lançamento (' +
          record.getString('status') +
          ') de R$ ' +
          record.getFloat('valor').toFixed(2) +
          ' na competência ' +
          record.getString('competencia')
      } else if (collectionName === 'plano_contas') {
        acao = 'Atualização de conta contábil'
        detalhes = 'Alterou conta ' + record.getString('codigo') + ' - ' + record.getString('nome')
      } else if (collectionName === 'funcionarios') {
        acao = 'Atualização de funcionário'
        detalhes =
          'Atualizou colaborador ' +
          record.getString('nome_completo') +
          ' (status: ' +
          record.getString('status') +
          ')'
      } else if (collectionName === 'folha_pagamento') {
        acao = 'Atualização de folha'
        detalhes =
          'Atualizou folha comp. ' +
          record.getString('competencia') +
          ' para status ' +
          record.getString('status')
      } else if (collectionName === 'eventos_dp') {
        acao = 'Atualização de evento DP'
        detalhes = 'Alterou evento ' + record.getString('tipo')
      } else if (collectionName === 'portal_acessos') {
        acao = 'Atualização de acesso ao portal'
        detalhes =
          'Atualizou acesso ' +
          record.getString('email') +
          ' (ativo: ' +
          (record.getBool('ativo') ? 'sim' : 'não') +
          ')'
      } else if (collectionName === 'mapeamento_contabil') {
        acao = 'Atualização de mapeamento contábil'
        detalhes = 'Alterou regra de ' + record.getString('chave')
      } else if (collectionName === 'ativos') {
        acao = 'Atualização de bem patrimonial'
        detalhes =
          'Atualizou dados do bem ' +
          record.getString('descricao') +
          ' (status: ' +
          record.getString('status') +
          ')'
      } else if (collectionName === 'fechamento_competencia') {
        acao = 'Atualização de fechamento mensal'
        detalhes =
          'Competência ' +
          record.getString('competencia') +
          ' alterada para status: ' +
          record.getString('status')
      } else if (collectionName === 'contas_financeiras') {
        acao = 'Atualização de título financeiro'
        detalhes =
          'Título ' +
          record.getString('descricao') +
          ' alterado para status ' +
          record.getString('status')
      } else if (collectionName === 'contas_bancarias') {
        acao = 'Atualização de conta bancária'
        detalhes = 'Atualizou dados da conta ' + record.getString('banco')
      } else if (collectionName === 'extratos_bancarios') {
        acao = 'Conciliação de extrato'
        detalhes =
          'Extrato ' +
          record.getString('descricao') +
          ' alterado para status ' +
          record.getString('status')
      }

      log.set('acao', acao)
      log.set('detalhes', detalhes)
      $app.save(log)
    } catch (err) {
      console.log('Error logging audit update:', err)
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
)

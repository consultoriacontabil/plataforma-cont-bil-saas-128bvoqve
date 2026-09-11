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
)

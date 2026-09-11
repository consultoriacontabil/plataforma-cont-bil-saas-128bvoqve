// Hook: audit_logger_create.js
// Fires on create success for key business collections and logs to audit_log
onRecordAfterCreateSuccess(
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
      } else if (record.has('user_id') && record.getString('user_id')) {
        userId = record.getString('user_id')
      }
      if (userId) {
        log.set('usuario_id', userId)
      }

      let acao = 'Criação'
      let detalhes = 'Novo registro criado'

      if (collectionName === 'empresas') {
        acao = 'Cadastro de empresa'
        detalhes =
          'Cadastrou a empresa ' +
          (record.getString('nome_fantasia') || record.getString('razao_social')) +
          ' (CNPJ: ' +
          record.getString('cnpj') +
          ')'
      } else if (collectionName === 'documentos') {
        acao = 'Upload de documento'
        detalhes =
          'Armazenou o arquivo ' +
          record.getString('nome_arquivo') +
          ' (tipo: ' +
          record.getString('tipo') +
          ')'
      } else if (collectionName === 'workflows') {
        acao = 'Abertura de workflow'
        detalhes =
          'Criou o workflow "' +
          record.getString('titulo') +
          '" (prioridade: ' +
          record.getString('prioridade') +
          ')'
      } else if (collectionName === 'fiscal') {
        acao = 'Nova obrigação fiscal'
        detalhes =
          'Cadastrou obrigação ' +
          record.getString('tipo_obrigacao').toUpperCase() +
          ' período ' +
          record.getString('periodo_apuracao')
      } else if (collectionName === 'tenant_members') {
        acao = 'Membro vinculado'
        detalhes = 'Novo membro associado com perfil ' + record.getString('perfil')
      }

      log.set('acao', acao)
      log.set('detalhes', detalhes)
      $app.save(log)
    } catch (err) {
      console.log('Error logging audit create:', err)
    }
    e.next()
  },
  'empresas',
  'documentos',
  'workflows',
  'fiscal',
  'tenant_members',
)

// Hook: notifications_dp_and_portal.js
// Fires on create success for:
// 1. documentos: se enviado por usuário com perfil cliente, notificar o escritório
// 2. eventos_dp: notificar admissão, demissão ou afastamento no escritório
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

      const notificacoesCol = $app.findCollectionByNameOrId('notificacoes')

      if (collectionName === 'documentos') {
        const uploaderId = record.getString('usuario_upload_id')
        const nomeArquivo = record.getString('nome_arquivo')
        const empresaId = record.getString('empresa_id')

        let isCliente = false
        if (uploaderId) {
          try {
            const members = $app.findRecordsByFilter(
              'tenant_members',
              'tenant_id = {:t} && user_id = {:u}',
              '',
              1,
              0,
              { t: tenantId, u: uploaderId },
            )
            if (members.length > 0 && members[0].getString('perfil') === 'cliente') {
              isCliente = true
            }
          } catch (_) {}
        }

        if (isCliente) {
          let nomeEmpresa = 'Cliente'
          try {
            const empRec = $app.findRecordById('empresas', empresaId)
            nomeEmpresa = empRec.getString('nome_fantasia') || empRec.getString('razao_social')
          } catch (_) {}

          const notif = new Record(notificacoesCol)
          notif.set('tenant_id', tenantId)
          notif.set('titulo', 'Novo documento enviado pelo cliente')
          notif.set(
            'mensagem',
            'A empresa "' +
              nomeEmpresa +
              '" enviou o arquivo "' +
              nomeArquivo +
              '" através do Portal do Cliente.',
          )
          notif.set('tipo', 'sistema')
          notif.set('link', '/documentos')
          notif.set('lida', false)
          $app.save(notif)
        }
      } else if (collectionName === 'eventos_dp') {
        const tipo = record.getString('tipo')
        const desc = record.getString('descricao')
        if (tipo === 'admissao' || tipo === 'demissao' || tipo === 'ferias') {
          const notif = new Record(notificacoesCol)
          notif.set('tenant_id', tenantId)
          notif.set('titulo', 'DP: Novo evento de ' + tipo.toUpperCase())
          notif.set('mensagem', desc)
          notif.set('tipo', 'sistema')
          notif.set('link', '/departamento-pessoal')
          notif.set('lida', false)
          $app.save(notif)
        }
      }
    } catch (err) {
      console.log('[NOTIF_DP_PORTAL] Error in hook:', err)
    }
    e.next()
  },
  'documentos',
  'eventos_dp',
)

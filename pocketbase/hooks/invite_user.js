// Hook: invite_user.js
// Custom endpoint POST /backend/v1/invites
routerAdd(
  'POST',
  '/backend/v1/invites',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      const body = e.requestInfo().body || {}
      const email = (body.email || '').trim().toLowerCase()
      const name = (body.name || '').trim()
      const perfil = body.perfil || 'auxiliar'
      const tenantId = body.tenant_id

      if (!email || !name || !tenantId) {
        return e.badRequestError('Nome, email e tenant_id são obrigatórios')
      }

      // Verify caller is an administrator in this tenant
      let callerMember
      try {
        const records = $app.findRecordsByFilter(
          'tenant_members',
          `user_id = '${userId}' && tenant_id = '${tenantId}'`,
          '',
          1,
          0,
        )
        if (records.length > 0) callerMember = records[0]
      } catch (_) {}

      if (!callerMember || callerMember.getString('perfil') !== 'administrador') {
        return e.forbiddenError('Apenas administradores podem convidar usuários')
      }

      // Find or create user
      const usersCol = $app.findCollectionByNameOrId('_pb_users_auth_')
      let targetUser
      try {
        targetUser = $app.findAuthRecordByEmail('_pb_users_auth_', email)
      } catch (_) {
        targetUser = new Record(usersCol)
        targetUser.setEmail(email)
        targetUser.setPassword($security.randomString(16))
        targetUser.setVerified(true)
        targetUser.set('name', name)
        $app.save(targetUser)
      }

      // Check if membership exists
      let existingMembership
      try {
        const existing = $app.findRecordsByFilter(
          'tenant_members',
          `user_id = '${targetUser.id}' && tenant_id = '${tenantId}'`,
          '',
          1,
          0,
        )
        if (existing.length > 0) existingMembership = existing[0]
      } catch (_) {}

      if (existingMembership) {
        return e.json(200, {
          success: true,
          message: 'Usuário já vinculado ao escritório',
          member_id: existingMembership.id,
        })
      }

      const membersCol = $app.findCollectionByNameOrId('tenant_members')
      const newMember = new Record(membersCol)
      newMember.set('user_id', targetUser.id)
      newMember.set('tenant_id', tenantId)
      newMember.set('perfil', perfil)
      newMember.set('status', 'convite_pendente')
      $app.save(newMember)

      // Audit log
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_log')
        const log = new Record(auditCol)
        log.set('tenant_id', tenantId)
        log.set('usuario_id', userId)
        log.set('acao', 'Convite de usuário')
        log.set('entidade_tipo', 'tenant_members')
        log.set('entidade_id', newMember.id)
        log.set('detalhes', 'Convidou o usuário ' + name + ' (' + email + ') com perfil ' + perfil)
        $app.save(log)
      } catch (_) {}

      return e.json(201, {
        success: true,
        message: 'Convite enviado com sucesso',
        member_id: newMember.id,
        user_id: targetUser.id,
      })
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao processar convite' })
    }
  },
  $apis.requireAuth(),
)

// Hook: invite_user.js
// POST /backend/v1/invites
//
// CORREÇÃO 24/11/2026 — o convite não pode criar conta com senha própria.
//
// Antes: quando o e-mail não existia, o hook CRIAVA o usuário direto
// (`setPassword(randomString(16))`, `setVerified(true)`) e vinculava ao tenant.
// Com `users.createRule` aberto isso significava criação de conta por qualquer
// pessoa que soubesse o endpoint.
//
// Agora: o convite é um REGISTRO na coleção `convites`, com token, perfil,
// validade e status `pendente`. Quem aceita o convite é o fluxo de cadastro
// (hook tenant_signup), que só cria vínculo se houver convite pendente para o
// e-mail. Nenhuma senha é gerada aqui.
routerAdd(
  'POST',
  '/backend/v1/invites',
  (e) => {
    try {
      const userId = e.auth && e.auth.id ? e.auth.id : ''
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      const body = e.requestInfo().body || {}
      const email = String(body.email || '')
        .trim()
        .toLowerCase()
      const name = String(body.name || '').trim()
      const perfil = body.perfil || 'auxiliar'
      const tenantId = body.tenant_id

      const perfisPermitidos = ['administrador', 'contador', 'auxiliar', 'consultor', 'cliente']

      if (!email || !name || !tenantId) {
        return e.badRequestError('Nome, email e tenant_id são obrigatórios')
      }
      if (perfisPermitidos.indexOf(perfil) === -1) {
        return e.badRequestError('Perfil inválido para convite.')
      }

      // Só administrador do tenant convida — e ninguém convida acima do próprio nível.
      let callerMember = null
      try {
        const records = $app.findRecordsByFilter(
          'tenant_members',
          'user_id = {:u} && tenant_id = {:t}',
          '',
          1,
          0,
          { u: userId, t: tenantId },
        )
        if (records.length > 0) callerMember = records[0]
      } catch (_) {}

      const perfilChamador = callerMember ? callerMember.getString('perfil') : ''
      if (!callerMember || perfilChamador !== 'administrador') {
        return e.forbiddenError('Apenas administradores podem convidar usuários')
      }
      if (perfil === 'administrador' && perfilChamador !== 'administrador') {
        return e.forbiddenError('Somente administrador pode convidar outro administrador')
      }

      // Convite pendente já existente para este e-mail neste tenant?
      try {
        const existentes = $app.findRecordsByFilter(
          'convites',
          "email = {:e} && tenant_id = {:t} && status = 'pendente'",
          '',
          1,
          0,
          { e: email, t: tenantId },
        )
        if (existentes.length > 0) {
          return e.json(200, {
            success: true,
            message: 'Já existe convite pendente para este e-mail neste escritório.',
            convite_id: existentes[0].id,
            convite_pendente: true,
          })
        }
      } catch (_) {}

      const convitesCol = $app.findCollectionByNameOrId('convites')
      const convite = new Record(convitesCol)
      convite.set('tenant_id', tenantId)
      convite.set('email', email)
      convite.set('nome', name)
      convite.set('perfil', perfil)
      convite.set('status', 'pendente')
      convite.set('token', $security.randomString(48))
      convite.set('convidado_por', userId)
      const expira = new Date()
      expira.setDate(expira.getDate() + 7)
      convite.set('expira_em', expira.toISOString())
      $app.save(convite)

      // Se o e-mail já tem conta, o vínculo entra como convite_pendente e só
      // ativa pelo aceite — nunca como membro ativo direto.
      let vinculoId = ''
      try {
        const usuarioExistente = $app.findAuthRecordByEmail('_pb_users_auth_', email)
        if (usuarioExistente) {
          const membersCol = $app.findCollectionByNameOrId('tenant_members')
          const membro = new Record(membersCol)
          membro.set('user_id', usuarioExistente.id)
          membro.set('tenant_id', tenantId)
          membro.set('perfil', perfil)
          membro.set('status', 'convite_pendente')
          $app.save(membro)
          vinculoId = membro.id
        }
      } catch (_) {
        // E-mail ainda sem conta: o vínculo nasce na aceitação do convite.
      }

      try {
        const auditCol = $app.findCollectionByNameOrId('audit_log')
        const log = new Record(auditCol)
        log.set('tenant_id', tenantId)
        log.set('usuario_id', userId)
        log.set('acao', 'Convite de usuário')
        log.set('entidade_tipo', 'convites')
        log.set('entidade_id', convite.id)
        log.set(
          'detalhes',
          'Convidou ' +
            name +
            ' (' +
            email +
            ') com perfil ' +
            perfil +
            ' — convite válido por 7 dias, vinculado ao escritório',
        )
        $app.save(log)
      } catch (_) {}

      return e.json(201, {
        success: true,
        message:
          'Convite registrado. O acesso só é criado quando a pessoa aceitar o convite e se cadastrar.',
        convite_id: convite.id,
        member_id: vinculoId,
        expira_em: convite.get('expira_em'),
        conta_criada: false,
      })
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao processar convite' })
    }
  },
  $apis.requireAuth(),
)

// Hook: tenant_signup.js
//
// CORREÇÃO 24/11/2026 — o auto-cadastro criava escritório e administrador.
//
// Antes: QUALQUER usuário criado em `users` (inclusive pelo /signup público)
// ganhava automaticamente um tenant novo e um vínculo
// `perfil: administrador`. Bastava alguém se cadastrar para virar administrador.
//
// Agora: um usuário criado só recebe vínculo se existir CONVITE PENDENTE para o
// e-mail dele. O perfil vem do convite (nunca 'administrador' por padrão) e o
// convite é marcado como aceito. Sem convite, o usuário não recebe tenant nem
// vínculo — fica sem acesso e o fato é registrado no log do servidor.
onRecordAfterCreateSuccess((e) => {
  try {
    const user = e.record
    const email = (user.getString('email') || '').trim().toLowerCase()

    // Já tem vínculo? Não faz nada.
    let jaVinculado = []
    try {
      jaVinculado = $app.findRecordsByFilter('tenant_members', 'user_id = {:u}', '', 1, 0, {
        u: user.id,
      })
    } catch (_) {}
    if (jaVinculado.length > 0) {
      e.next()
      return
    }

    // Existe convite pendente para este e-mail?
    let convite = null
    try {
      const convites = $app.findRecordsByFilter(
        'convites',
        "email = {:e} && status = 'pendente'",
        '-created',
        1,
        0,
        { e: email },
      )
      if (convites.length > 0) convite = convites[0]
    } catch (errConv) {
      console.log('[SIGNUP] Consulta de convites indisponível:', errConv)
    }

    if (!convite) {
      console.log(
        '[SIGNUP] BLOQUEADO: usuário ' +
          email +
          ' criado sem convite válido. Nenhum tenant e nenhum vínculo foram criados; o usuário não tem acesso a dado algum.',
      )
      e.next()
      return
    }

    // Convite vencido não vale.
    const expira = convite.getString('expira_em')
    if (expira && new Date(expira).getTime() < Date.now()) {
      convite.set('status', 'expirado')
      $app.save(convite)
      console.log('[SIGNUP] Convite vencido recusado para ' + email)
      e.next()
      return
    }

    const tenantId = convite.getString('tenant_id')
    const perfil = convite.getString('perfil') || 'auxiliar'
    const nomeConvidado = convite.getString('nome') || ''

    if (!tenantId) {
      console.log('[SIGNUP] Convite sem tenant_id, ignorado: ' + convite.id)
      e.next()
      return
    }

    const membersCol = $app.findCollectionByNameOrId('tenant_members')
    const member = new Record(membersCol)
    member.set('user_id', user.id)
    member.set('tenant_id', tenantId)
    member.set('perfil', perfil)
    member.set('status', 'ativo')
    $app.save(member)

    convite.set('status', 'aceito')
    convite.set('aceito_em', new Date().toISOString())
    convite.set('usuario_id', user.id)
    $app.save(convite)

    if (nomeConvidado && !user.getString('name')) {
      try {
        user.set('name', nomeConvidado)
        $app.save(user)
      } catch (_) {}
    }

    try {
      const auditCol = $app.findCollectionByNameOrId('audit_log')
      const audit = new Record(auditCol)
      audit.set('tenant_id', tenantId)
      audit.set('usuario_id', user.id)
      audit.set('acao', 'aceite_convite_cadastro')
      audit.set('entidade_tipo', 'tenant_members')
      audit.set('entidade_id', member.id)
      audit.set(
        'detalhes',
        'Vínculo criado por convite válido (' +
          convite.id +
          ') com perfil ' +
          perfil +
          ' para o e-mail ' +
          email,
      )
      $app.save(audit)
    } catch (eAud) {
      console.log('[SIGNUP] Falha ao gravar auditoria do aceite:', eAud)
    }
  } catch (err) {
    console.log('Error in tenant signup hook:', err)
  }
  e.next()
}, 'users')

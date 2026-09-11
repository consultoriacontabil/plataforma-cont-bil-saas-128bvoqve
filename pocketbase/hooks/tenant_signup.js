// Hook: tenant_signup.js
// On new user created via signup, automatically setup tenant and tenant_members
onRecordAfterCreateSuccess((e) => {
  try {
    const user = e.record
    // Check if user already has a membership
    let existingMember
    try {
      existingMember = $app.findFirstRecordByData('tenant_members', 'user_id', user.id)
    } catch (_) {}

    if (existingMember) {
      e.next()
      return
    }

    // Default tenant name based on user name or fallback
    const userName = user.getString('name') || 'Novo Escritório'
    const tenantName =
      userName.includes('Cont') || userName.includes('Ltda') || userName.includes('S/A')
        ? userName
        : userName + ' Contabilidade'

    const tenantsCol = $app.findCollectionByNameOrId('tenants')
    const tenant = new Record(tenantsCol)
    tenant.set('nome', tenantName)
    tenant.set('plano', 'starter')
    tenant.set('ativo', true)
    $app.save(tenant)

    const membersCol = $app.findCollectionByNameOrId('tenant_members')
    const member = new Record(membersCol)
    member.set('user_id', user.id)
    member.set('tenant_id', tenant.id)
    member.set('perfil', 'administrador')
    member.set('status', 'ativo')
    $app.save(member)

    // Also create initial agent conversation for this user
    try {
      const convCol = $app.findCollectionByNameOrId('agent_conversations')
      const conv = new Record(convCol)
      conv.set('tenant_id', tenant.id)
      conv.set('user_id', user.id)
      conv.set('titulo', 'Boas-vindas ao Rumo Agent')
      conv.set('resumo', 'Apresentação do assistente virtual contábil.')
      $app.save(conv)

      const msgCol = $app.findCollectionByNameOrId('agent_messages')
      const msg = new Record(msgCol)
      msg.set('tenant_id', tenant.id)
      msg.set('conversation_id', conv.id)
      msg.set('user_id', user.id)
      msg.set('role', 'agent')
      msg.set(
        'conteudo',
        'Olá! Bem-vindo(a) à Rumo Consultoria Contábil. Sou o Rumo Agent e estou aqui para auxiliar você na gestão das suas empresas, documentos, workflows e obrigações fiscais. Como posso te ajudar hoje?',
      )
      $app.save(msg)
    } catch (_) {}
  } catch (err) {
    console.log('Error in tenant signup hook:', err)
  }
  e.next()
}, 'users')

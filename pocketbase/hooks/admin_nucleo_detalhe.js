/// <reference path="../pb_data/types.d.ts" />

/** Temporário: mostra QUAIS registros vazam (ids e tenant), para corrigir a regra. */
routerAdd('GET', '/backend/v1/admin/nucleo/detalhe', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!k || (e.request.url.query().get('key') || '') !== k) return e.json(403, { e: 1 })

  const TENANT = 'tlfa8ev464hy8n2'
  const senha = 'Detalhe!' + Date.now()
  const email = 'detalhe.' + Date.now() + '@teste-interno.local'
  const out = {}
  let userId = ''

  try {
    const u = new Record($app.findCollectionByNameOrId('users'))
    u.setEmail(email)
    u.setPassword(senha)
    u.set('name', 'Detalhe')
    u.set('verified', true)
    $app.save(u)
    userId = u.id

    const tm = new Record($app.findCollectionByNameOrId('tenant_members'))
    tm.set('user_id', userId)
    tm.set('tenant_id', TENANT)
    tm.set('perfil', 'cliente')
    tm.set('status', 'ativo')
    $app.save(tm)
  } catch (err) {
    return e.json(200, { erro: String(err) })
  }

  let token = ''
  try {
    const base = $secrets.get('PB_INSTANCE_URL')
    const r = $http.send({
      url: base + '/api/collections/users/auth-with-password',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: email, password: senha }),
      timeout: 15,
    })
    token = (r.json && r.json.token) || ''
  } catch (_) {}

  if (token) {
    const base = $secrets.get('PB_INSTANCE_URL')
    const COL = ['tenants', 'tenant_members']
    for (let i = 0; i < COL.length; i++) {
      const r = $http.send({
        url: base + '/api/collections/' + COL[i] + '/records?perPage=100&fields=id',
        method: 'GET',
        headers: { Authorization: token },
        timeout: 15,
      })
      let ids = []
      try {
        ids = (r.json.items || []).map(function (x) {
          return x.id
        })
      } catch (_) {}
      out[COL[i]] = { total: ids.length, ids: ids }
    }
  }

  // o que deveria aparecer
  const meuTM = $app.findRecordsByFilter('tenant_members', 'user_id = {:u}', '', 5, 0, {
    u: userId,
  })
  out.esperado = {
    tenant_do_usuario: TENANT,
    vinculos_do_usuario: meuTM.length,
    membros_desse_tenant: $app.findRecordsByFilter(
      'tenant_members',
      'tenant_id = {:t}',
      '',
      20,
      0,
      {
        t: TENANT,
      },
    ).length,
  }

  try {
    const tms = $app.findRecordsByFilter('tenant_members', 'user_id = {:u}', '', 10, 0, {
      u: userId,
    })
    for (let i = 0; i < tms.length; i++) $app.delete(tms[i])
    $app.delete($app.findRecordById('users', userId))
  } catch (_) {}

  return e.json(200, out)
})

/// <reference path="../pb_data/types.d.ts" />

/**
 * Teste de isolamento CRUZADO (temporário).
 *
 * Cria um usuário no tenant tlfa8ev464hy8n2 (que NÃO tem empresas) e verifica
 * se ele consegue ler as 23 empresas do tenant Rumo. Se conseguir, o
 * isolamento está furado e a regra precisa mudar.
 */
routerAdd('GET', '/backend/v1/admin/nucleo/cruzado', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!k || (e.request.url.query().get('key') || '') !== k) return e.json(403, { e: 1 })

  const TENANT_VAZIO = 'tlfa8ev464hy8n2'
  const senha = 'Cruzado!' + Date.now()
  const email = 'cruzado.' + Date.now() + '@teste-interno.local'
  const out = { passos: [] }
  let userId = ''

  try {
    const usersCol = $app.findCollectionByNameOrId('users')
    const u = new Record(usersCol)
    u.setEmail(email)
    u.setPassword(senha)
    u.set('name', 'Cruzado Teste')
    u.set('verified', true)
    $app.save(u)
    userId = u.id

    const tmCol = $app.findCollectionByNameOrId('tenant_members')
    const tm = new Record(tmCol)
    tm.set('user_id', userId)
    tm.set('tenant_id', TENANT_VAZIO)
    tm.set('perfil', 'cliente')
    tm.set('status', 'ativo')
    $app.save(tm)
    out.passos.push({ passo: 'criado', ok: true })
  } catch (err) {
    out.passos.push({ passo: 'criado', erro: String(err) })
    return e.json(200, out)
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
    out.passos.push({ passo: 'login', ok: !!token })
  } catch (err) {
    out.passos.push({ passo: 'login', erro: String(err) })
  }

  if (token) {
    const base = $secrets.get('PB_INSTANCE_URL')
    const COLS = [
      'empresas',
      'documentos',
      'lancamentos_contabeis',
      'obrigacoes',
      'tenants',
      'tenant_members',
    ]
    const leituras = {}
    for (let i = 0; i < COLS.length; i++) {
      const r = $http.send({
        url: base + '/api/collections/' + COLS[i] + '/records?perPage=100',
        method: 'GET',
        headers: { Authorization: token },
        timeout: 15,
      })
      let n = -1
      try {
        n = r.json.totalItems
      } catch (_) {}
      leituras[COLS[i]] = { status: r.statusCode, total: n }
    }
    out.leituras = leituras
    out.veredito =
      leituras.empresas && leituras.empresas.total === 0
        ? 'ISOLAMENTO OK'
        : 'VAZAMENTO: usuario de outro tenant ve empresas'
  }

  try {
    const tms = $app.findRecordsByFilter('tenant_members', 'user_id = {:u}', '', 10, 0, {
      u: userId,
    })
    for (let i = 0; i < tms.length; i++) $app.delete(tms[i])
    $app.delete($app.findRecordById('users', userId))
    out.passos.push({ passo: 'limpeza', ok: true })
  } catch (err) {
    out.passos.push({ passo: 'limpeza', erro: String(err) })
  }

  return e.json(200, out)
})

/// <reference path="../pb_data/types.d.ts" />

/**
 * Teste de fumaça AUTENTICADO real (temporário, depois removido).
 *
 * Cria um usuário de teste dentro do tenant Rumo, com perfil `cliente`
 * (o mais restrito), autentica pela API como ele e tenta ler as coleções do
 * núcleo. Depois apaga o usuário. Serve para provar que:
 *   - login funciona com as regras novas;
 *   - o usuário lê o que é do SEU tenant;
 *   - NÃO lê o de outro tenant.
 *
 * Rota: GET /backend/v1/admin/nucleo/smoke?key=...
 */
routerAdd('GET', '/backend/v1/admin/nucleo/smoke', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!k || (e.request.url.query().get('key') || '') !== k) return e.json(403, { e: 1 })

  const TENANT_RUMO = 'l91og8ybo9krtay'
  const senha = 'TesteSmoke!' + Date.now()
  const email = 'smoke.' + Date.now() + '@teste-interno.local'

  let userId = ''
  const out = { passos: [] }

  // 1. cria usuário de teste
  try {
    const usersCol = $app.findCollectionByNameOrId('users')
    const u = new Record(usersCol)
    u.setEmail(email)
    u.setPassword(senha)
    u.set('name', 'Smoke Teste')
    u.set('emailVisibility', true)
    u.set('verified', true)
    $app.save(u)
    userId = u.id
    out.passos.push({ passo: 'criar_usuario', ok: true })
  } catch (err) {
    out.passos.push({ passo: 'criar_usuario', ok: false, erro: String(err) })
    return e.json(200, out)
  }

  // 2. vincula ao tenant Rumo como 'cliente'
  try {
    const tmCol = $app.findCollectionByNameOrId('tenant_members')
    const tm = new Record(tmCol)
    tm.set('user_id', userId)
    tm.set('tenant_id', TENANT_RUMO)
    tm.set('perfil', 'cliente')
    tm.set('status', 'ativo')
    $app.save(tm)
    out.passos.push({ passo: 'vincular', ok: true })
  } catch (err) {
    out.passos.push({ passo: 'vincular', ok: false, erro: String(err) })
  }

  // 3. autentica pela API
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
    if (r.statusCode === 200 && r.json && r.json.token) {
      token = r.json.token
      out.passos.push({ passo: 'login', ok: true })
    } else {
      out.passos.push({ passo: 'login', ok: false, status: r.statusCode })
    }
  } catch (err) {
    out.passos.push({ passo: 'login', ok: false, erro: String(err) })
  }

  // 4. lê coleções como esse usuário
  if (token) {
    const base = $secrets.get('PB_INSTANCE_URL')
    const COLS = [
      'empresas',
      'documentos',
      'obrigacoes',
      'notificacoes',
      'lancamentos_contabeis',
      'tenant_members',
      'tenants',
    ]
    const leituras = {}
    for (let i = 0; i < COLS.length; i++) {
      try {
        const r = $http.send({
          url: base + '/api/collections/' + COLS[i] + '/records?perPage=50',
          method: 'GET',
          headers: { Authorization: token },
          timeout: 15,
        })
        let n = -1
        try {
          n = r.json.totalItems
        } catch (_) {}
        leituras[COLS[i]] = { status: r.statusCode, total: n }
      } catch (err) {
        leituras[COLS[i]] = { erro: String(err) }
      }
    }
    out.leituras = leituras
  }

  // 5. limpa: apaga vínculo e usuário
  try {
    const tms = $app.findRecordsByFilter('tenant_members', 'user_id = {:u}', '', 10, 0, {
      u: userId,
    })
    for (let i = 0; i < tms.length; i++) $app.delete(tms[i])
    const uu = $app.findRecordById('users', userId)
    $app.delete(uu)
    out.passos.push({ passo: 'limpeza', ok: true })
  } catch (err) {
    out.passos.push({ passo: 'limpeza', ok: false, erro: String(err) })
  }

  return e.json(200, out)
})

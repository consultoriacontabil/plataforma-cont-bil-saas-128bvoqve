/// <reference path="../pb_data/types.d.ts" />

/** Probe temporário: exercita a rota pública com o token REAL (só relata ok/erro). */
routerAdd('GET', '/backend/v1/admin/portais/testar', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!k || (e.request.url.query().get('key') || '') !== k) return e.json(403, { e: 1 })

  const out = {}

  // pedido
  try {
    const p = $app.findRecordsByFilter('pedidos_documentos', '', '', 1, 0)
    const token = p[0].getString('token_publico')
    const resp = $http.send({
      url: $secrets.get('PB_INSTANCE_URL') + '/backend/v1/publico/pedido',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token }),
      timeout: 10,
    })
    let ok = false
    let titulo = ''
    try {
      const j = resp.json
      ok = !!j.pedido
      titulo = j.pedido ? String(j.pedido.titulo || '').slice(0, 20) : ''
    } catch (_) {}
    out.pedido = { status: resp.statusCode, encontrou: ok, titulo: titulo }
  } catch (err) {
    out.pedido = { erro: String(err) }
  }

  // abertura
  try {
    const w = $app.findRecordsByFilter('company_onboarding_workflow', '', '', 1, 0)
    const token = w[0].getString('token')
    const resp = $http.send({
      url: $secrets.get('PB_INSTANCE_URL') + '/backend/v1/publico/abertura',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token }),
      timeout: 10,
    })
    let ok = false
    try {
      ok = !!resp.json.workflow
    } catch (_) {}
    out.abertura = { status: resp.statusCode, encontrou: ok }
  } catch (err) {
    out.abertura = { erro: String(err) }
  }

  return e.json(200, out)
})

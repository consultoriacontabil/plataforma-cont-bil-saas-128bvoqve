/// <reference path="../pb_data/types.d.ts" />

/** Probe temporário: testa as rotas públicas com tokens REAIS do banco. */
routerAdd('GET', '/backend/v1/admin/portais/probe', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!k || (e.request.url.query().get('key') || '') !== k) return e.json(403, { e: 1 })

  const out = { pedido: null, abertura: null }

  try {
    const p = $app.findRecordsByFilter('pedidos_documentos', '', '', 1, 0)
    if (p.length > 0) {
      out.pedido = { id: p[0].id, tem_token: !!p[0].getString('token_publico') }
    } else out.pedido = { nenhum: true }
  } catch (err) {
    out.pedido = { erro: String(err) }
  }

  try {
    const w = $app.findRecordsByFilter('company_onboarding_workflow', '', '', 1, 0)
    if (w.length > 0) {
      out.abertura = { id: w[0].id, tem_token: !!w[0].getString('token') }
    } else out.abertura = { nenhum: true }
  } catch (err) {
    out.abertura = { erro: String(err) }
  }

  return e.json(200, out)
})

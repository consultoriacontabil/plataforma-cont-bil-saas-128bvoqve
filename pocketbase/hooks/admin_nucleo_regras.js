/// <reference path="../pb_data/types.d.ts" />

/** Temporário: inspeciona as regras gravadas e testa variações de expressão. */
routerAdd('GET', '/backend/v1/admin/nucleo/regras', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!k || (e.request.url.query().get('key') || '') !== k) return e.json(403, { e: 1 })

  const out = {}
  const COLS = ['tenants', 'tenant_members', 'empresas', 'notificacoes', 'agent_conversations']
  for (let i = 0; i < COLS.length; i++) {
    try {
      const c = $app.findCollectionByNameOrId(COLS[i])
      out[COLS[i]] = { list: c.listRule, view: c.viewRule, create: c.createRule }
    } catch (err) {
      out[COLS[i]] = { erro: String(err) }
    }
  }
  return e.json(200, out)
})

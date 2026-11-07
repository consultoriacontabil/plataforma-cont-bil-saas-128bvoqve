/// <reference path="../pb_data/types.d.ts" />

/**
 * Diagnóstico temporário (somente leitura): mapeia TODAS as coleções e o
 * estado das regras. Serve para fechar o núcleo sem adivinhar o que falta.
 */
routerAdd('GET', '/backend/v1/admin/rls/mapa', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!k || (e.request.url.query().get('key') || '') !== k) return e.json(403, { e: 1 })

  const cols = $app.findAllCollections()
  const out = []

  for (let i = 0; i < cols.length; i++) {
    const c = cols[i]
    const nome = c.name
    if (nome.indexOf('_') === 0) {
      // coleções de sistema do PocketBase
      continue
    }

    const temTenant = !!c.fields.getByName('tenant_id')
    let regs = 0
    try {
      regs = $app.countRecords(nome)
    } catch (_) {}

    const r = c.listRule
    let estado = 'OUTRA'
    if (r === null) estado = 'BLOQUEADA'
    else if (r === '') estado = 'PUBLICA'
    else if (r === "@request.auth.id != ''") estado = 'GENERICA'
    else if (r.indexOf('tenant_members_via_user_id.tenant_id') >= 0) estado = 'ISOLADA'

    out.push({
      nome: nome,
      tipo: c.type,
      tenant: temTenant,
      regs: regs,
      estado: estado,
      list: r,
      create: c.createRule,
    })
  }

  out.sort(function (a, b) {
    return a.estado < b.estado ? -1 : a.estado > b.estado ? 1 : 0
  })

  return e.json(200, { total: out.length, colecoes: out })
})

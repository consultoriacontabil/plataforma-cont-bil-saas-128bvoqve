/// <reference path="../pb_data/types.d.ts" />

/** Diagnóstico temporário (somente leitura): regras atuais das coleções de DP. */
routerAdd('GET', '/backend/v1/admin/rls/dump', (e) => {
  const esperado = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!esperado || (e.request.url.query().get('key') || '') !== esperado) {
    return e.json(403, { error: 'Chave invalida.' })
  }

  const lista = String(e.request.url.query().get('cols') || '').split(',')
  const out = []

  for (let i = 0; i < lista.length; i++) {
    const nome = lista[i].trim()
    if (!nome) continue
    try {
      const c = $app.findCollectionByNameOrId(nome)
      const temTenant = !!c.fields.getByName('tenant_id')
      out.push({
        nome: nome,
        tem_tenant: temTenant,
        list: c.listRule,
        view: c.viewRule,
        create: c.createRule,
        update: c.updateRule,
        del: c.deleteRule,
      })
    } catch (err) {
      out.push({ nome: nome, erro: String(err) })
    }
  }

  return e.json(200, { colecoes: out })
})

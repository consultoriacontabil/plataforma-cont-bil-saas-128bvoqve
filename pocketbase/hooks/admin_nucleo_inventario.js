/// <reference path="../pb_data/types.d.ts" />

/** Temporário: inventário de tenants e seus membros (detecta órfão e vínculo duplicado). */
routerAdd('GET', '/backend/v1/admin/nucleo/inventario', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!k || (e.request.url.query().get('key') || '') !== k) return e.json(403, { e: 1 })

  const out = { tenants: [], usuarios_teste: [] }

  const ts = $app.findRecordsByFilter('tenants', '', '', 100, 0)
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i]
    const membros = $app.findRecordsByFilter('tenant_members', 'tenant_id = {:t}', '', 50, 0, {
      t: t.id,
    })
    const emps = $app.findRecordsByFilter('empresas', 'tenant_id = {:t}', '', 1, 0, { t: t.id })
    out.tenants.push({
      id: t.id,
      nome: t.getString('nome'),
      criado: t.getString('created'),
      membros: membros.length,
      empresas: emps.length,
      membros_detalhe: membros.map(function (m) {
        return {
          id: m.id,
          user: m.getString('user_id'),
          perfil: m.getString('perfil'),
          status: m.getString('status'),
        }
      }),
    })
  }

  // usuários de teste que sobraram
  const users = $app.findRecordsByFilter('users', '', '', 200, 0)
  for (let i = 0; i < users.length; i++) {
    const em = users[i].getString('email')
    if (
      em.indexOf('teste-interno.local') >= 0 ||
      em.indexOf('smoke.') === 0 ||
      em.indexOf('cruzado.') === 0 ||
      em.indexOf('detalhe.') === 0
    ) {
      out.usuarios_teste.push({ id: users[i].id, email: em })
    }
  }

  return e.json(200, out)
})

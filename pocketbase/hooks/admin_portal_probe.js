/// <reference path="../pb_data/types.d.ts" />

/** Probe temporário: existe algum acesso de portal para testar ponta a ponta? */
routerAdd('GET', '/backend/v1/admin/portal/probe', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!k || (e.request.url.query().get('key') || '') !== k) return e.json(403, { e: 1 })

  let a = []
  try {
    a = $app.findRecordsByFilter('portal_empregado_acessos', '', '-created', 3, 0)
  } catch (err) {
    return e.json(500, { err: String(err) })
  }

  return e.json(200, {
    total: a.length,
    amostra: a.map(function (r) {
      return {
        id: r.id,
        ativo: r.getBool('ativo'),
        tem_token: !!r.getString('token_acesso'),
        tem_codigo: !!r.getString('codigo_temporario'),
        cpf_len: r.getString('cpf').length,
        tem_funcionario: !!r.getString('funcionario_id'),
      }
    }),
  })
})

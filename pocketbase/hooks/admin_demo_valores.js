/// <reference path="../pb_data/types.d.ts" />

/** Temporário: mostra os empresa_id gravados nas 14 obrigações. */
routerAdd('GET', '/backend/v1/admin/demo/valores', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!k || (e.request.url.query().get('key') || '') !== k) return e.json(403, { e: 1 })

  const obs = $app.findRecordsByFilter('obrigacoes', '', '', 500, 0)
  const linhas = []
  const idsEmpresa = {}

  for (let i = 0; i < obs.length; i++) {
    const o = obs[i]
    const empId = o.getString('empresa_id')
    idsEmpresa[empId] = (idsEmpresa[empId] || 0) + 1
    linhas.push({
      id: o.id,
      empresa_id: empId,
      tipo: o.getString('tipo'),
      competencia: o.getString('competencia'),
      status: o.getString('status'),
      tenant: o.getString('tenant_id'),
    })
  }

  // ids reais de empresas
  const reais = $app.findRecordsByFilter('empresas', '', '', 30, 0).map(function (x) {
    return x.id
  })

  return e.json(200, {
    obrigacoes: linhas.slice(0, 14),
    ids_empresa_usados: Object.keys(idsEmpresa),
    empresas_reais: reais.slice(0, 10),
    alguma_coincide: Object.keys(idsEmpresa).some(function (x) {
      return reais.indexOf(x) >= 0
    }),
  })
})

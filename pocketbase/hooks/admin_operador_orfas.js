/// <reference path="../pb_data/types.d.ts" />

/** Temporário: detalha o campo empresa e o tenant das obrigações órfãs. */
routerAdd('GET', '/backend/v1/admin/operador/orfas', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!k || (e.request.url.query().get('key') || '') !== k) return e.json(403, { e: 1 })

  const obs = $app.findRecordsByFilter('obrigacoes', '', '', 20, 0)
  const linhas = []

  for (let i = 0; i < obs.length; i++) {
    const o = obs[i]
    const empId = o.getString('empresa')
    let existe = false
    try {
      if (empId) {
        $app.findRecordById('empresas', empId)
        existe = true
      }
    } catch (_) {}

    linhas.push({
      id: o.id,
      tenant: o.getString('tenant_id'),
      empresa_id: empId,
      empresa_existe: existe,
      tipo: o.getString('tipo_obrigacao'),
      status: o.getString('status'),
      competencia: o.getString('periodo_apuracao'),
    })
  }

  // empresas existentes com id e tenant, para comparar
  const emps = $app.findRecordsByFilter('empresas', '', '', 30, 0).map(function (x) {
    return { id: x.id, tenant: x.getString('tenant_id'), nome: x.getString('razao_social') }
  })

  return e.json(200, { obrigacoes: linhas, empresas: emps.slice(0, 8) })
})

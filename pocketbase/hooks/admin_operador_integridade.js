/// <reference path="../pb_data/types.d.ts" />

/** Temporário: as obrigações apontam para empresas válidas? */
routerAdd('GET', '/backend/v1/admin/operador/integridade', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!k || (e.request.url.query().get('key') || '') !== k) return e.json(403, { e: 1 })

  const out = { total: 0, resolvem: 0, orfas: 0, exemplo_orfa: '' }

  const obs = $app.findRecordsByFilter('obrigacoes', '', '', 500, 0)
  out.total = obs.length

  for (let i = 0; i < obs.length; i++) {
    const empId = obs[i].getString('empresa')
    if (!empId) {
      out.orfas++
      continue
    }
    try {
      $app.findRecordById('empresas', empId)
      out.resolvem++
    } catch (_) {
      out.orfas++
      if (!out.exemplo_orfa) out.exemplo_orfa = empId
    }
  }

  // confirma que essas empresas existem em algum tenant
  out.empresas_total = $app.findRecordsByFilter('empresas', '', '', 500, 0).length

  return e.json(200, out)
})

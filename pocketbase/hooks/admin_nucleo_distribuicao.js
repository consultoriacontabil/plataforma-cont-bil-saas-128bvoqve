/// <reference path="../pb_data/types.d.ts" />

/** Temporário: distribuição de empresas por tenant (detecta registro órfão). */
routerAdd('GET', '/backend/v1/admin/nucleo/distribuicao', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!k || (e.request.url.query().get('key') || '') !== k) return e.json(403, { e: 1 })

  const out = { por_tenant: {}, sem_tenant: 0, total: 0 }

  let emps = []
  try {
    emps = $app.findRecordsByFilter('empresas', '', '', 500, 0)
  } catch (err) {
    return e.json(500, { erro: String(err) })
  }

  for (let i = 0; i < emps.length; i++) {
    const t = emps[i].getString('tenant_id')
    if (!t) {
      out.sem_tenant++
      continue
    }
    out.por_tenant[t] = (out.por_tenant[t] || 0) + 1
    out.total++
  }

  // o mesmo para tenant_members e documentos
  const extra = {}
  const COLS = ['tenant_members', 'documentos', 'notificacoes']
  for (let c = 0; c < COLS.length; c++) {
    extra[COLS[c]] = { por_tenant: {}, sem_tenant: 0 }
    let regs = []
    try {
      regs = $app.findRecordsByFilter(COLS[c], '', '', 2000, 0)
    } catch (_) {
      continue
    }
    for (let i = 0; i < regs.length; i++) {
      const t = regs[i].getString('tenant_id')
      if (!t) {
        extra[COLS[c]].sem_tenant++
        continue
      }
      extra[COLS[c]].por_tenant[t] = (extra[COLS[c]].por_tenant[t] || 0) + 1
    }
  }

  return e.json(200, {
    empresas: out,
    outros: extra,
  })
})

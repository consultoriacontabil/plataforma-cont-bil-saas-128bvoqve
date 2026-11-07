/// <reference path="../pb_data/types.d.ts" />

/**
 * LIMPEZA (temporário) — remove os tenants órfãos criados pelos testes.
 *
 * Os testes de fumaça criaram usuários; o hook de signup criou um tenant
 * automático para cada um ("Smoke Teste", "Cruzado Teste", "Detalhe"). Como
 * os usuários foram apagados, sobraram tenants sem nenhum membro e sem
 * empresa. Remove SÓ esses, casando por nome + zero membros + zero empresas.
 */
routerAdd('GET', '/backend/v1/admin/nucleo/limpar', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!k || (e.request.url.query().get('key') || '') !== k) return e.json(403, { e: 1 })

  const PADROES = [
    'Smoke Teste Contabilidade',
    'Cruzado Teste Contabilidade',
    'Detalhe Contabilidade',
  ]
  const removidos = []
  const mantidos = []

  const ts = $app.findRecordsByFilter('tenants', '', '', 200, 0)
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i]
    const nome = t.getString('nome')
    if (PADROES.indexOf(nome) < 0) continue

    const membros = $app.findRecordsByFilter('tenant_members', 'tenant_id = {:t}', '', 5, 0, {
      t: t.id,
    })
    const emps = $app.findRecordsByFilter('empresas', 'tenant_id = {:t}', '', 5, 0, { t: t.id })

    if (membros.length > 0 || emps.length > 0) {
      mantidos.push({ id: t.id, nome: nome, motivo: 'tem membros ou empresas' })
      continue
    }

    try {
      $app.delete(t)
      removidos.push({ id: t.id, nome: nome })
    } catch (err) {
      mantidos.push({ id: t.id, nome: nome, motivo: String(err) })
    }
  }

  // estado final
  const restantes = $app.findRecordsByFilter('tenants', '', '', 200, 0).map(function (t) {
    return t.getString('nome')
  })

  return e.json(200, { removidos: removidos, mantidos: mantidos, tenants_restantes: restantes })
})

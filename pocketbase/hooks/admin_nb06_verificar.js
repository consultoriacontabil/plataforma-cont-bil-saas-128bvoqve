/// <reference path="../pb_data/types.d.ts" />

/** Verificação temporária: o POP-NB-06 ficou com a tela real? */
routerAdd('GET', '/backend/v1/admin/nb06/verificar', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!k || (e.request.url.query().get('key') || '') !== k) return e.json(403, { e: 1 })

  const achou = $app.findRecordsByFilter(
    'sops',
    "tenant_id = 'l91og8ybo9krtay' && codigo = 'NB-06'",
    '',
    1,
    0,
  )
  if (achou.length === 0) return e.json(404, { erro: 'nao encontrado' })

  const r = achou[0]
  let etapas = []
  try {
    etapas = JSON.parse(r.getString('etapas_template_json'))
  } catch (_) {}

  return e.json(200, {
    codigo: r.getString('codigo'),
    nivel: r.getString('nivel_autonomia'),
    total_etapas: Array.isArray(etapas) ? etapas.length : 0,
    etapas: etapas,
    regras: r.getString('regras_negocio').slice(0, 300),
    tem_guardar_recibos: r.getString('regras_negocio').indexOf('Guardar recibos') >= 0,
    tem_abas: r.getString('etapas_template_json').indexOf('Por prazo') >= 0,
  })
})

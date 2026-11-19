/// <reference path="../pb_data/types.d.ts" />

/** Verificação temporária: os POPs do Numbra entraram? */
routerAdd('GET', '/backend/v1/admin/sops/verificar', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!k || (e.request.url.query().get('key') || '') !== k) return e.json(403, { e: 1 })

  const todos = $app.findRecordsByFilter('sops', '', 'codigo', 300, 0)
  const nb = todos.filter(function (r) {
    return String(r.getString('codigo')).indexOf('NB-') === 0
  })

  return e.json(200, {
    total_sops: todos.length,
    pops_numbra: nb.length,
    lista: nb.map(function (r) {
      let etapas = 0
      try {
        const j = r.get('etapas_template_json')
        etapas = Array.isArray(j) ? j.length : 0
      } catch (_) {}
      return {
        codigo: r.getString('codigo'),
        nome: r.getString('nome'),
        area: r.getString('area'),
        nivel: r.getString('nivel_autonomia'),
        aprovacao: r.getBool('requer_aprovacao'),
        etapas: etapas,
        ativo: r.getBool('ativo'),
      }
    }),
  })
})

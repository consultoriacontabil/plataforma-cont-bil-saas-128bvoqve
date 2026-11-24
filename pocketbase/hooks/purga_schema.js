/// <reference path="../pb_data/types.d.ts" />

/**
 * METADADOS DE SCHEMA (read-only).
 * GET /backend/v1/purga/schema
 * Header: X-Purga-Token
 *
 * Para cada coleção: campos relevantes (relação, alvo, cascade, obrigatório),
 * regras de acesso e se é auth. Serve para calcular a ordem de exclusão e o
 * que o cascade arrasta junto.
 */
routerAdd('GET', '/backend/v1/purga/schema', (e) => {
  var esperado = $secrets.get('PURGA_TOKEN')
  var recebido = ''
  try {
    var info = e.requestInfo()
    recebido =
      (info.headers && (info.headers['x_purga_token'] || info.headers['x-purga-token'])) || ''
  } catch (_) {}
  if (!esperado || recebido !== esperado) {
    return e.json(401, { erro: 'token inválido' })
  }

  var app = e.app
  var out = []
  var cols = app.findAllCollections()
  for (var i = 0; i < cols.length; i++) {
    var c = cols[i]
    var campos = []
    var flds = c.fields
    for (var f = 0; f < flds.length; f++) {
      var fd = flds[f]
      if (fd.type === 'relation') {
        campos.push({
          nome: fd.name,
          tipo: 'relation',
          alvo: fd.collectionId,
          cascade: !!fd.cascadeDelete,
          obrigatorio: !!fd.required,
          maxSelect: fd.maxSelect,
        })
      } else if (fd.type === 'file') {
        campos.push({ nome: fd.name, tipo: 'file', maxSelect: fd.maxSelect, maxSize: fd.maxSize })
      }
    }
    out.push({
      nome: c.name,
      id: c.id,
      tipo: c.type,
      total: app.countRecords(c.name),
      regras: {
        list: c.listRule,
        view: c.viewRule,
        create: c.createRule,
        update: c.updateRule,
        delete: c.deleteRule,
      },
      campos: campos,
    })
  }
  return e.json(200, { colecoes: out })
})

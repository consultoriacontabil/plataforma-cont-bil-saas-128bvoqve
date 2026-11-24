/// <reference path="../pb_data/types.d.ts" />

/**
 * BACKUP — exporta uma coleção inteira em JSON (read-only).
 * GET /backend/v1/purga/backup/{colecao}
 * Header: X-Purga-Token
 *
 * Pagina por offset para não estourar memória. Devolve os registros crus,
 * incluindo campos sensíveis (necessários para restauração).
 */
routerAdd('GET', '/backend/v1/purga/backup/{colecao}', (e) => {
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

  var colecao = String(e.request.pathValue('colecao') || '')
  if (!colecao) return e.json(400, { erro: 'coleção obrigatória' })

  var offset = 0
  try {
    offset = Number(e.request.url.query().get('offset') || 0)
  } catch (_) {}
  var limite = 500
  try {
    var l = Number(e.request.url.query().get('limite') || 0)
    if (l > 0 && l <= 2000) limite = l
  } catch (_) {}

  var app = e.app
  var col
  try {
    col = app.findCollectionByNameOrId(colecao)
  } catch (errC) {
    return e.json(404, { erro: 'coleção inexistente: ' + colecao })
  }

  var total = 0
  try {
    total = app.countRecords(colecao)
  } catch (_) {}

  var registros = []
  try {
    var recs = app.findRecordsByFilter(colecao, '', 'id', limite, offset)
    var flds = col.fields
    for (var i = 0; i < recs.length; i++) {
      var rec = recs[i]
      var item = { id: rec.id }
      for (var f = 0; f < flds.length; f++) {
        var fd = flds[f]
        var nome = fd.name
        if (fd.type === 'autodate' || nome === 'id') {
          try {
            item[nome] = String(rec.get(nome) || '')
          } catch (_) {}
          continue
        }
        if (fd.type === 'file') {
          var arq = rec.get(nome)
          item[nome] = arq && arq.length ? arq : []
          continue
        }
        if (fd.type === 'json') {
          var bruto = rec.getString(nome)
          if (bruto) {
            try {
              item[nome] = JSON.parse(bruto)
            } catch (_) {
              item[nome] = bruto
            }
          } else {
            item[nome] = null
          }
          continue
        }
        var v = rec.get(nome)
        if (v === undefined || v === null) {
          item[nome] = null
        } else {
          item[nome] = v
        }
      }
      registros.push(item)
    }
  } catch (errR) {
    return e.json(500, { erro: 'falha ao ler ' + colecao + ': ' + String(errR) })
  }

  return e.json(200, {
    colecao: colecao,
    collection_id: col.id,
    total: total,
    offset: offset,
    limite: limite,
    retornados: registros.length,
    registros: registros,
  })
})

/// <reference path="../pb_data/types.d.ts" />

/**
 * BACKUP — inventário e credenciais de download dos arquivos do storage.
 * GET /backend/v1/purga/arquivos
 * Header: X-Purga-Token
 *
 * Para cada arquivo guardado: chave, tamanho, coleção, registro e um token de
 * download (newFileToken) quando o registro permitir. Serve para copiar os
 * binários (GED, .pfx, anexos) para fora do banco antes da purga.
 */
routerAdd('GET', '/backend/v1/purga/arquivos', (e) => {
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
  var arquivos = []

  // 1. inventário do storage
  var fsys = $app.newFilesystem()
  try {
    var lista = fsys.list('')
    for (var i = 0; i < lista.length; i++) {
      var it = lista[i]
      if (it.isDir) continue
      arquivos.push({ key: it.key, size: it.size, modTime: String(it.modTime), token: '', url: '' })
    }
  } catch (eL) {
    return e.json(500, { erro: 'falha ao listar storage: ' + String(eL) })
  } finally {
    try {
      fsys.close()
    } catch (_) {}
  }

  // 2. token de download por registro (quando houver)
  var porChave = {}
  for (var a = 0; a < arquivos.length; a++) porChave[arquivos[a].key] = arquivos[a]

  var cols = app.findAllCollections()
  for (var c = 0; c < cols.length; c++) {
    var col = cols[c]
    if (col.name.indexOf('_') === 0) continue
    var temArquivo = false
    for (var f = 0; f < col.fields.length; f++) {
      if (col.fields[f].type === 'file') temArquivo = true
    }
    if (!temArquivo) continue

    var recs = []
    try {
      recs = app.findRecordsByFilter(col.name, '', '', 500, 0)
    } catch (_) {
      continue
    }
    for (var r = 0; r < recs.length; r++) {
      var rec = recs[r]
      var token = ''
      try {
        token = String(rec.newFileToken() || '')
      } catch (_) {
        token = ''
      }
      var base = rec.baseFilesPath()
      for (var f2 = 0; f2 < col.fields.length; f2++) {
        var fd = col.fields[f2]
        if (fd.type !== 'file') continue
        var nomes = rec.get(fd.name)
        if (!nomes || !nomes.length) continue
        for (var n = 0; n < nomes.length; n++) {
          var chave = base + '/' + nomes[n]
          var alvo = porChave[chave]
          if (alvo) {
            alvo.colecao = col.name
            alvo.colecao_id = col.id
            alvo.registro_id = rec.id
            alvo.campo = fd.name
            alvo.token = token
            alvo.url = '/api/files/' + col.id + '/' + rec.id + '/' + encodeURIComponent(nomes[n])
          }
        }
      }
    }
  }

  return e.json(200, { total: arquivos.length, arquivos: arquivos })
})

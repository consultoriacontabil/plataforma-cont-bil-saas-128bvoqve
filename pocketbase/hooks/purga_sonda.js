/// <reference path="../pb_data/types.d.ts" />

// SONDA TEMPORÁRIA (read-only): descobre a API de arquivos disponível.
// GET /backend/v1/purga/sonda
routerAdd('GET', '/backend/v1/purga/sonda', (e) => {
  var esperado = $secrets.get('PURGA_TOKEN')
  var recebido = ''
  try {
    var info = e.requestInfo()
    recebido =
      (info.headers && (info.headers['x_purga_token'] || info.headers['x-purga-token'])) || ''
  } catch (_) {}
  if (!esperado || recebido !== esperado) return e.json(401, { erro: 'token inválido' })

  var out = { fsys: {}, record: {}, app: {} }
  var fsys = null
  try {
    fsys = $app.newFilesystem()
    var nomes = [
      'get',
      'read',
      'readFile',
      'list',
      'exists',
      'delete',
      'serve',
      'attributes',
      'open',
    ]
    for (var i = 0; i < nomes.length; i++) {
      out.fsys[nomes[i]] = typeof fsys[nomes[i]]
    }
    try {
      var lista = fsys.list('')
      out.fsys.list_count = lista ? lista.length : 0
      if (lista && lista.length) out.fsys.sample = lista.slice(0, 5)
    } catch (eL) {
      out.fsys.list_erro = String(eL)
    }
  } catch (eF) {
    out.fsys.erro = String(eF)
  } finally {
    try {
      if (fsys) fsys.close()
    } catch (_) {}
  }

  try {
    var rec = $app.findFirstRecordByData('certificados_digitais', 'tipo', 'a1')
    out.record.id = rec.id
    out.record.baseFilesPath = rec.baseFilesPath()
    out.record.newFileToken = typeof rec.newFileToken
    out.record.fileURL = typeof rec.fileURL
    out.record.getFileUrl = typeof rec.getFileUrl
    var nomes2 = rec.get('arquivo_pfx')
    out.record.arquivo_pfx = nomes2
  } catch (eR) {
    out.record.erro = String(eR)
  }

  out.app.newFilesystem = typeof $app.newFilesystem
  out.app.findAllCollections = typeof $app.findAllCollections
  return e.json(200, out)
})

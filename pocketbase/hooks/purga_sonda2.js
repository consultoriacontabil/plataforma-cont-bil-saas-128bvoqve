/// <reference path="../pb_data/types.d.ts" />

// SONDA 2 (read-only): como ler bytes de um arquivo do storage.
// GET /backend/v1/purga/sonda2
routerAdd('GET', '/backend/v1/purga/sonda2', (e) => {
  var esperado = $secrets.get('PURGA_TOKEN')
  var recebido = ''
  try {
    var info = e.requestInfo()
    recebido = (info.headers && (info.headers['x_purga_token'] || info.headers['x-purga-token'])) || ''
  } catch (_) {}
  if (!esperado || recebido !== esperado) return e.json(401, { erro: 'token inválido' })

  var out = {}
  var fsys = $app.newFilesystem()
  try {
    var key = 'pbc_2897935614/1jbuzxowvt7spdx/certificado_1777065055_6_s60s7jcxur.pfx'
    out.prototypes = Object.getOwnPropertyNames(Object.getPrototypeOf(fsys))
    try {
      var attrs = fsys.attributes(key)
      out.attrs = { size: attrs ? attrs.size : null, tipo: typeof attrs }
    } catch (eA) {
      out.attrs_erro = String(eA)
    }
    try {
      var blob = fsys.serve
      out.serve_type = typeof blob
    } catch (_) {}
    try {
      // tentativa: getReader / read?
      out.keys = Object.keys(fsys)
    } catch (_) {}
  } catch (eF) {
    out.erro = String(eF)
  } finally {
    try {
      fsys.close()
    } catch (_) {}
  }
  return e.json(200, out)
})

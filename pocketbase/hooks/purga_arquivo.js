/// <reference path="../pb_data/types.d.ts" />

/**
 * BACKUP — baixa um arquivo do storage pela chave.
 * GET /backend/v1/purga/arquivo?key=<chave no storage>
 * Header: X-Purga-Token
 *
 * Usado para copiar GED, anexos e certificados .pfx para fora do banco antes
 * da purga. A chave vem do inventário de /backend/v1/purga/arquivos.
 */
routerAdd('GET', '/backend/v1/purga/arquivo', (e) => {
  var esperado = $secrets.get('PURGA_TOKEN')
  var recebido = ''
  var chave = ''
  try {
    var info = e.requestInfo()
    recebido =
      (info.headers && (info.headers['x_purga_token'] || info.headers['x-purga-token'])) || ''
    chave = String((info.query && info.query['key']) || '')
  } catch (_) {}
  if (!esperado || recebido !== esperado) {
    return e.json(401, { erro: 'token inválido' })
  }
  if (!chave || chave.indexOf('..') >= 0) {
    return e.json(400, { erro: 'chave inválida' })
  }

  var nome = chave.split('/').pop()
  var fsys = $app.newFilesystem()
  var existia = false
  try {
    existia = fsys.exists(chave)
  } catch (errE) {
    existia = false
  }
  if (!existia) {
    try {
      fsys.close()
    } catch (_) {}
    return e.json(404, { erro: 'arquivo não encontrado: ' + chave })
  }

  e.response.header().set('Content-Disposition', 'attachment; filename="' + nome + '"')
  try {
    fsys.serve(e.response, e.request, chave, nome)
  } catch (errS) {
    try {
      fsys.close()
    } catch (_) {}
    return e.json(500, { erro: 'falha ao servir arquivo: ' + String(errS) })
  }
  try {
    fsys.close()
  } catch (_) {}
  return
})

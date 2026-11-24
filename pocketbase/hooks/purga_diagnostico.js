/// <reference path="../pb_data/types.d.ts" />

/**
 * DIAGNÓSTICO READ-ONLY da base (não grava e não apaga nada).
 * GET /backend/v1/purga/diagnostico
 * Header: X-Purga-Token: <PURGA_TOKEN do cofre>
 *
 * Devolve, por coleção: total de registros e quantos têm tenant_id preenchido.
 * Serve para medir o tamanho real da base antes de qualquer purga.
 */
routerAdd('GET', '/backend/v1/purga/diagnostico', (e) => {
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
  var nomes = []
  try {
    var cols = app.findAllCollections()
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i]
      var n = c.name
      if (n.indexOf('_') === 0) continue
      nomes.push(n)
    }
  } catch (err) {
    nomes = ['tenants', 'tenant_members', 'empresas']
  }
  nomes.sort()

  var porColecao = []
  var totalGeral = 0
  for (var j = 0; j < nomes.length; j++) {
    var nome = nomes[j]
    var total = 0
    var comTenant = 0
    var erro = ''
    try {
      total = app.countRecords(nome)
    } catch (errC) {
      erro = String(errC && errC.message ? errC.message : errC)
    }
    if (!erro && total > 0) {
      try {
        comTenant = app.countRecords(nome, "tenant_id != ''")
      } catch (_) {
        comTenant = -1
      }
    }
    totalGeral += total
    porColecao.push({ colecao: nome, registros: total, com_tenant: comTenant, erro: erro })
  }

  return e.json(200, {
    ambiente: 'preview',
    coletado_em: new Date().toISOString(),
    total_registros: totalGeral,
    colecoes: porColecao,
  })
})

/// <reference path="../pb_data/types.d.ts" />

/**
 * INSPEÇÃO READ-ONLY de entidades estruturais (não grava e não apaga nada).
 * GET /backend/v1/purga/inspecao
 * Header: X-Purga-Token
 *
 * Devolve tenants, tenant_members, users (sem hash de senha), certificados
 * digitais (sem senha do pfx) e configs de integração, para decidir o que
 * preservar antes da purga.
 */
routerAdd('GET', '/backend/v1/purga/inspecao', (e) => {
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

  function dump(nome, limite) {
    var out = []
    try {
      var recs = app.findRecordsByFilter(nome, '', 'created', limite || 200, 0)
      for (var i = 0; i < recs.length; i++) {
        var rec = recs[i]
        var item = { id: rec.id }
        var campos = rec.collection().fields
        for (var f = 0; f < campos.length; f++) {
          var campo = campos[f]
          var fn = campo.name
          if (campo.type === 'file') {
            var v = rec.get(fn)
            item[fn] = v && v.length ? '[arquivo:' + v[0] + ']' : ''
            continue
          }
          if (
            fn === 'senha' ||
            fn === 'senha_certificado' ||
            fn === 'ciphertext' ||
            fn === 'password'
          ) {
            item[fn] = rec.getString(fn) ? '***PRESENTE***' : ''
            continue
          }
          if (fn === 'snapshot_json' || fn === 'dados' || fn === 'payload') {
            item[fn] = '[omitido]'
            continue
          }
          item[fn] = rec.get(fn)
        }
        out.push(item)
      }
    } catch (err) {
      return { erro: String(err && err.message ? err.message : err) }
    }
    return out
  }

  return e.json(200, {
    ambiente: 'preview',
    tenants: dump('tenants'),
    tenant_members: dump('tenant_members'),
    users: dump('users'),
    certificados_digitais: dump('certificados_digitais'),
    rfb_config: dump('rfb_config'),
    esocial_config: dump('esocial_config'),
    nfe_config: dump('nfe_config'),
    nfse_config: dump('nfse_config'),
    integra_contador_config: dump('integra_contador_config'),
    credenciais_cofre: dump('credenciais_cofre', 200),
  })
})

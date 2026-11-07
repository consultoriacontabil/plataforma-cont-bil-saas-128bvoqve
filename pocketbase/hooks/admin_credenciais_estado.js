/// <reference path="../pb_data/types.d.ts" />

/**
 * VERIFICAÇÃO FINAL (somente leitura) — estado do cofre após a fase 2.
 *
 * Conta, por campo sensível, quantos registros estão selados (__COFRE__),
 * quantos ainda têm texto claro e quantos estão vazios. Nunca devolve valor.
 *
 * Rota: GET /backend/v1/admin/credenciais/estado?key=<CREDENTIALS_VAULT_KEY>
 */
routerAdd('GET', '/backend/v1/admin/credenciais/estado', (e) => {
  const esperado = $secrets.get('CREDENTIALS_VAULT_KEY')
  const recebido = e.request.url.query().get('key') || ''
  if (!esperado || recebido !== esperado) {
    return e.json(403, { error: 'Chave invalida.' })
  }

  const ALVOS = {
    certificados_digitais: ['senha'],
    nfe_config: ['senha_certificado'],
    rfb_config: ['senha_certificado'],
    esocial_config: ['senha_certificado'],
    integra_contador_config: ['senha_certificado', 'consumer_secret'],
    nfse_config: ['evolution_api_key'],
  }

  const resultado = []
  let textoClaroTotal = 0

  const nomes = Object.keys(ALVOS)
  for (let i = 0; i < nomes.length; i++) {
    const escopo = nomes[i]
    const campos = ALVOS[escopo]
    let registros = []
    try {
      registros = $app.findRecordsByFilter(escopo, '', '', 1000, 0)
    } catch (_) {
      continue
    }

    for (let c = 0; c < campos.length; c++) {
      const campo = campos[c]
      let selados = 0
      let textoClaro = 0
      let vazios = 0

      for (let r = 0; r < registros.length; r++) {
        const v = registros[r].getString(campo)
        if (v === '__COFRE__') selados++
        else if (v && v.trim().length > 0) textoClaro++
        else vazios++
      }

      textoClaroTotal += textoClaro
      resultado.push({
        campo: escopo + '.' + campo,
        total: registros.length,
        selados: selados,
        texto_claro: textoClaro,
        vazios: vazios,
      })
    }
  }

  // integridade: toda linha do cofre decifra?
  const linhas = $app.findRecordsByFilter('credenciais_cofre', '', '', 2000, 0)
  let decifram = 0
  let cifrasInvalidas = 0
  for (let i = 0; i < linhas.length; i++) {
    try {
      const claro = $security.decrypt(
        linhas[i].getString('ciphertext').replace(/^v1:/, ''),
        esperado,
      )
      if (claro && claro.length > 0) decifram++
      else cifrasInvalidas++
    } catch (_) {
      cifrasInvalidas++
    }
  }

  return e.json(200, {
    ok: textoClaroTotal === 0 && cifrasInvalidas === 0,
    campos: resultado,
    texto_claro_total: textoClaroTotal,
    cofre_linhas: linhas.length,
    cofre_decifram: decifram,
    cofre_invalidas: cifrasInvalidas,
  })
})

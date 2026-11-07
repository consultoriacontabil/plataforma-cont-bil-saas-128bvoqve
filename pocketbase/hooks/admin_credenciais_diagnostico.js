/// <reference path="../pb_data/types.d.ts" />

/**
 * DIAGNÓSTICO (somente leitura) — inventário de credenciais em texto claro.
 *
 * NÃO altera nada. Conta registros e quantos campos sensíveis estão
 * preenchidos, sem devolver nenhum valor. Serve para dimensionar a migração
 * para o cofre cifrado antes de tocar em dado de produção.
 *
 * Rota: GET /backend/v1/admin/credenciais/diagnostico
 * Uso: apenas superusuário/painel. Remover depois da migração.
 */

routerAdd('GET', '/backend/v1/admin/credenciais/diagnostico', (e) => {
  const esperado = $secrets.get('CREDENTIALS_VAULT_KEY')
  const recebido = e.request.url.query().get('key') || ''
  if (!esperado || recebido !== esperado) {
    return e.json(403, { error: 'Chave invalida.' })
  }

  // coleção -> campos que guardam segredo
  const ALVOS = {
    nfse_config: [
      'evolution_api_key',
      'govbr_client_secret',
      'betha_senha_token',
      'ginfes_senha',
      'nfeio_api_key',
      'chave_pix_padrao',
    ],
    nfe_config: ['senha_certificado'],
    rfb_config: ['senha_certificado', 'token_ambiente_rfb'],
    integra_contador_config: ['consumer_secret', 'senha_certificado'],
    certificados_digitais: ['senha'],
  }

  const relatorio = []
  let totalPreenchidos = 0

  const nomes = Object.keys(ALVOS)
  for (let i = 0; i < nomes.length; i++) {
    const nome = nomes[i]
    let registros = []
    try {
      registros = $app.findRecordsByFilter(nome, '', '', 500, 0)
    } catch (err) {
      relatorio.push({ colecao: nome, erro: String(err) })
      continue
    }

    const preenchimento = {}
    const campos = ALVOS[nome]
    for (let c = 0; c < campos.length; c++) preenchimento[campos[c]] = 0

    for (let r = 0; r < registros.length; r++) {
      const rec = registros[r]
      for (let c = 0; c < campos.length; c++) {
        const v = rec.getString(campos[c])
        if (v && v.trim().length > 0) {
          preenchimento[campos[c]]++
          totalPreenchidos++
        }
      }
    }

    relatorio.push({ colecao: nome, registros: registros.length, preenchidos: preenchimento })
  }

  return e.json(200, {
    ok: true,
    somente_leitura: true,
    total_campos_preenchidos: totalPreenchidos,
    relatorio: relatorio,
  })
})

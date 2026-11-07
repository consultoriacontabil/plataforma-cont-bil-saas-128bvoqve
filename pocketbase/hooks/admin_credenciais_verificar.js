/// <reference path="../pb_data/types.d.ts" />

/**
 * VERIFICAÇÃO (somente leitura) — o cofre decifra exatamente o valor original?
 *
 * Para cada linha do cofre: decifra com a chave mestra e compara com o valor
 * que ainda está no campo de origem. Não altera nada. Retorna só contagens e
 * o identificador do registro — nunca o valor do segredo.
 *
 * Rota: GET /backend/v1/admin/credenciais/verificar?key=<CREDENTIALS_VAULT_KEY>
 * Remover depois da virada.
 */

routerAdd('GET', '/backend/v1/admin/credenciais/verificar', (e) => {
  const esperado = $secrets.get('CREDENTIALS_VAULT_KEY')
  const recebido = e.request.url.query().get('key') || ''
  if (!esperado || recebido !== esperado) {
    return e.json(403, { error: 'Chave invalida.' })
  }

  const linhas = $app.findRecordsByFilter('credenciais_cofre', '', '', 1000, 0)

  const falhas = []
  let conferidos = 0
  let iguais = 0
  let origemVazia = 0
  let origemAusente = 0

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i]
    const escopo = l.getString('escopo')
    const registroId = l.getString('registro_id')
    const campo = l.getString('campo')
    const ct = l.getString('ciphertext')

    let claro
    try {
      claro = $security.decrypt(ct.replace(/^v1:/, ''), esperado)
    } catch (err) {
      falhas.push({
        escopo: escopo,
        registro_id: registroId,
        campo: campo,
        erro: 'decrypt: ' + String(err),
      })
      continue
    }

    let origem
    try {
      origem = $app.findRecordById(escopo, registroId)
    } catch (_) {
      origemAusente++
      continue
    }

    const original = origem.getString(campo)
    conferidos++

    if (!original || original.trim().length === 0) {
      origemVazia++
      continue
    }

    if (original === claro) {
      iguais++
    } else {
      falhas.push({
        escopo: escopo,
        registro_id: registroId,
        campo: campo,
        erro: 'valor divergente',
        tamanho_original: original.length,
        tamanho_decifrado: claro.length,
      })
    }
  }

  return e.json(200, {
    ok: falhas.length === 0,
    linhas_cofre: linhas.length,
    conferidos: conferidos,
    iguais: iguais,
    origem_vazia: origemVazia,
    origem_ausente: origemAusente,
    falhas: falhas,
  })
})

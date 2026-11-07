/// <reference path="../pb_data/types.d.ts" />

/**
 * VERIFICAÇÃO PÓS-SELAGEM (somente leitura).
 *
 * Depois que os campos de origem são marcados com `__COFRE__`, o valor claro
 * deixa de existir no banco. Esta rota confere:
 *  1. toda linha do cofre decifra com a chave mestra;
 *  2. o campo de origem está marcado como cofrado (ou seja, não sobrou texto claro);
 *  3. `rec.collection().name` funciona como escopo — é o que os hooks usam.
 *
 * Não devolve valor de segredo: só contagens, ids e tamanhos.
 * Rota: GET /backend/v1/admin/credenciais/verificar?key=<CREDENTIALS_VAULT_KEY>
 */

routerAdd('GET', '/backend/v1/admin/credenciais/verificar', (e) => {
  const esperado = $secrets.get('CREDENTIALS_VAULT_KEY')
  const recebido = e.request.url.query().get('key') || ''
  if (!esperado || recebido !== esperado) {
    return e.json(403, { error: 'Chave invalida.' })
  }

  const linhas = $app.findRecordsByFilter('credenciais_cofre', '', '', 2000, 0)

  const falhas = []
  let decifram = 0
  let marcados = 0
  let aindaEmTextoClaro = []

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i]
    const escopo = l.getString('escopo')
    const registroId = l.getString('registro_id')
    const campo = l.getString('campo')
    const ct = l.getString('ciphertext')

    let claro = ''
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
    if (!claro || claro.length === 0) {
      falhas.push({ escopo: escopo, registro_id: registroId, campo: campo, erro: 'decifrou vazio' })
      continue
    }
    decifram++

    let origem
    try {
      origem = $app.findRecordById(escopo, registroId)
    } catch (_) {
      falhas.push({ escopo: escopo, registro_id: registroId, campo: campo, erro: 'origem ausente' })
      continue
    }

    const atual = origem.getString(campo)
    if (atual === '__COFRE__') {
      marcados++
    } else if (atual && atual.trim().length > 0) {
      // ainda tem valor em texto claro neste campo
      aindaEmTextoClaro.push({ escopo: escopo, campo: campo, registro_id: registroId })
    } else {
      // campo ficou vazio: o hook cai no cofre de qualquer forma, mas registra
      aindaEmTextoClaro.push({
        escopo: escopo,
        campo: campo,
        registro_id: registroId,
        nota: 'vazio',
      })
    }
  }

  // Prova de que o escopo por `rec.collection().name` (usado nos hooks) funciona.
  let escopoDinamicoOk = false
  let escopoDinamicoNome = ''
  try {
    const algum = $app.findFirstRecordByData('credenciais_digitais', '', '')
    escopoDinamicoNome = algum.collection().name
    escopoDinamicoOk = escopoDinamicoNome === 'certificados_digitais'
  } catch (_) {
    try {
      const lista = $app.findRecordsByFilter('certificados_digitais', '', '', 1, 0)
      if (lista.length > 0) {
        escopoDinamicoNome = lista[0].collection().name
        escopoDinamicoOk = escopoDinamicoNome === 'certificados_digitais'
      }
    } catch (e2) {
      escopoDinamicoNome = 'erro: ' + String(e2)
    }
  }

  return e.json(200, {
    ok: falhas.length === 0 && aindaEmTextoClaro.length === 0 && escopoDinamicoOk,
    linhas_cofre: linhas.length,
    decifram: decifram,
    marcados_cofrados: marcados,
    ainda_em_texto_claro: aindaEmTextoClaro,
    escopo_dinamico_ok: escopoDinamicoOk,
    escopo_dinamico_nome: escopoDinamicoNome,
    falhas: falhas,
  })
})

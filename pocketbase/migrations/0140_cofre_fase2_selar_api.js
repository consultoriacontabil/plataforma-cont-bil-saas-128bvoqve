/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0140 — Fase 2 do cofre: sela os dois últimos segredos.
 *
 * `nfse_config.evolution_api_key` e `integra_contador_config.consumer_secret`
 * ficaram de fora da 0137 porque as telas liam o valor de volta. Isso foi
 * resolvido antes desta migration:
 *
 *  - Evolution: o teste passou a rodar no servidor (nfse_testar_evolution.js),
 *    lendo a chave do cofre; o campo na tela abre vazio = "manter a atual".
 *  - Integra Contador: consumer_secret e senha_certificado deixaram de ser
 *    carregados na tela; o hook decifra do cofre no servidor.
 *
 * As duas cifras já existem desde a 0136 (52 de 52 decifravam igual ao
 * original). Aqui só trocamos o texto claro pelo marcador __COFRE__.
 *
 * Idempotente. Rollback decifra e devolve o valor.
 */
migrate(
  (app) => {
    const chave = $secrets.get('CREDENTIALS_VAULT_KEY')
    if (!chave) throw new Error('[0140] CREDENTIALS_VAULT_KEY ausente.')

    const ALVOS = {
      nfse_config: ['evolution_api_key'],
      integra_contador_config: ['consumer_secret'],
    }

    let selados = 0
    let jaEstavam = 0
    let naoDecifra = 0
    let falhas = 0

    const nomes = Object.keys(ALVOS)
    for (let i = 0; i < nomes.length; i++) {
      const escopo = nomes[i]
      const campos = ALVOS[escopo]

      for (let c = 0; c < campos.length; c++) {
        const campo = campos[c]

        let linhas = []
        try {
          linhas = app.findRecordsByFilter(
            'credenciais_cofre',
            'escopo = {:e} && campo = {:c}',
            '',
            200,
            0,
            { e: escopo, c: campo },
          )
        } catch (eList) {
          console.log('[0140] falha ao listar cofre ' + escopo + '.' + campo + ': ' + String(eList))
          continue
        }

        for (let l = 0; l < linhas.length; l++) {
          const linha = linhas[l]
          const registroId = linha.getString('registro_id')

          // a cifra precisa estar integra antes de apagar o texto claro
          try {
            const claro = $security.decrypt(
              linha.getString('ciphertext').replace(/^v1:/, ''),
              chave,
            )
            if (!claro || claro.length === 0) {
              naoDecifra++
              continue
            }
          } catch (eDec) {
            naoDecifra++
            console.log('[0140] cifra invalida ' + escopo + '.' + campo + ': ' + String(eDec))
            continue
          }

          let atual = ''
          try {
            const rec = app.findRecordById(escopo, registroId)
            atual = rec.getString(campo)
          } catch (eRec) {
            continue
          }

          if (atual === '__COFRE__') {
            jaEstavam++
            continue
          }

          try {
            app
              .db()
              .newQuery('UPDATE ' + escopo + ' SET ' + campo + " = '__COFRE__' WHERE id = {:id}")
              .bind({ id: registroId })
              .execute()
            selados++
          } catch (eSql) {
            falhas++
            console.log('[0140] falha ao selar ' + escopo + '.' + campo + ': ' + String(eSql))
          }
        }
      }
    }

    console.log(
      '[0140] FASE2 selados=' +
        selados +
        ' ja_estavam=' +
        jaEstavam +
        ' nao_decifra=' +
        naoDecifra +
        ' falhas=' +
        falhas,
    )
  },
  (app) => {
    const chave = $secrets.get('CREDENTIALS_VAULT_KEY')
    if (!chave) return
    const ALVOS = { nfse_config: 'evolution_api_key', integra_contador_config: 'consumer_secret' }
    const nomes = Object.keys(ALVOS)
    for (let i = 0; i < nomes.length; i++) {
      const escopo = nomes[i]
      const campo = ALVOS[escopo]
      const linhas = app.findRecordsByFilter(
        'credenciais_cofre',
        'escopo = {:e} && campo = {:c}',
        '',
        200,
        0,
        { e: escopo, c: campo },
      )
      for (let l = 0; l < linhas.length; l++) {
        try {
          const claro = $security.decrypt(
            linhas[l].getString('ciphertext').replace(/^v1:/, ''),
            chave,
          )
          app
            .db()
            .newQuery('UPDATE ' + escopo + ' SET ' + campo + ' = {:s} WHERE id = {:id}')
            .bind({ s: claro, id: linhas[l].getString('registro_id') })
            .execute()
        } catch (_) {}
      }
    }
  },
)

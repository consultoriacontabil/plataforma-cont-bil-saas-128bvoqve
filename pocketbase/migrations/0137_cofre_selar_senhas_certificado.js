/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0137 — Sela as senhas de certificado A1 (virada).
 *
 * Depois da 0136, cada uma destas senhas existe em DOIS lugares: em texto
 * claro no campo original e cifrada no cofre. Esta migration apaga o texto
 * claro e deixa o marcador `__COFRE__`, que é o que faz cada hook buscar o
 * valor em `credenciais_cofre` e decifrar em memória.
 *
 * Escopo: 50 campos de senha, todos lidos exclusivamente por hooks
 * server-side — nenhum é exibido ao navegador.
 *   certificados_digitais.senha          (17)
 *   nfe_config.senha_certificado         (16)
 *   rfb_config.senha_certificado         (16)
 *   integra_contador_config.senha_certificado (1)
 *
 * FORA desta migration, de propósito (fase 2): `nfse_config.evolution_api_key`
 * e `integra_contador_config.consumer_secret` continuam em texto claro porque
 * a tela de configuração lê o valor de volta para exibir no campo; selar sem
 * antes trocar a tela por "digite para substituir" apagaria a credencial no
 * próximo Salvar.
 *
 * Rollback: decifra o cofre e devolve o valor ao campo original. Não perde
 * dado — por isso o rollback é seguro.
 */
migrate(
  (app) => {
    const chave = $secrets.get('CREDENTIALS_VAULT_KEY')
    if (!chave) {
      throw new Error('[0137] CREDENTIALS_VAULT_KEY ausente: configure o segredo antes.')
    }

    const ALVOS = {
      certificados_digitais: ['senha'],
      nfe_config: ['senha_certificado'],
      rfb_config: ['senha_certificado'],
      integra_contador_config: ['senha_certificado'],
    }

    let selados = 0
    let semCofre = 0
    let falharam = 0

    const nomes = Object.keys(ALVOS)
    for (let i = 0; i < nomes.length; i++) {
      const escopo = nomes[i]
      const campos = ALVOS[escopo]
      let registros = []
      try {
        registros = app.findRecordsByFilter(escopo, '', '', 500, 0)
      } catch (e) {
        console.log('[0137] falha ao listar ' + escopo + ': ' + String(e))
        continue
      }

      for (let r = 0; r < registros.length; r++) {
        const rec = registros[r]
        for (let c = 0; c < campos.length; c++) {
          const campo = campos[c]
          const atual = rec.getString(campo)
          if (atual === '__COFRE__') continue

          // sem linha no cofre, não sela — nunca perder o único exemplar
          let existe = 0
          try {
            existe = app.findRecordsByFilter(
              'credenciais_cofre',
              'escopo = {:e} && registro_id = {:r} && campo = {:c}',
              '',
              1,
              0,
              { e: escopo, r: rec.id, c: campo },
            ).length
          } catch (_) {
            existe = 0
          }

          if (existe === 0) {
            if (atual && atual.trim().length > 0) {
              semCofre++
              console.log(
                '[0137] SEM cofre, mantido como esta: ' + escopo + '.' + campo + ' ' + rec.id,
              )
            }
            continue
          }

          // Alguns registros de configuração apontam para uma empresa que já
          // não existe; o PocketBase revalida a relação no save e recusaria a
          // gravação inteira. Isola por registro: quem falhar fica como está
          // (texto claro preservado) em vez de abortar a migration toda.
          const anterior = atual
          rec.set(campo, '__COFRE__')
          try {
            app.save(rec)
            selados++
          } catch (eSave) {
            try {
              rec.set(campo, anterior)
            } catch (_) {}
            falharam++
            console.log(
              '[0137] save recusado, mantido em texto claro: ' +
                escopo +
                '.' +
                campo +
                ' ' +
                rec.id +
                ' -> ' +
                String(eSave),
            )
          }
        }
      }
    }

    console.log('[0137] senhas seladas: ' + selados + ', preservadas sem cofre: ' + semCofre)
  },
  (app) => {
    const chave = $secrets.get('CREDENTIALS_VAULT_KEY')
    const linhas = app.findRecordsByFilter('credenciais_cofre', '', '', 2000, 0)
    let restaurados = 0
    if (!chave) return
    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i]
      const escopo = l.getString('escopo')
      const campo = l.getString('campo')
      if (campo !== 'senha' && campo !== 'senha_certificado') continue
      try {
        const rec = app.findRecordById(escopo, l.getString('registro_id'))
        const claro = $security.decrypt(l.getString('ciphertext').replace(/^v1:/, ''), chave)
        rec.set(campo, claro)
        app.save(rec)
        restaurados++
      } catch (_) {}
    }
    console.log('[0137 rollback] senhas restauradas: ' + restaurados)
  },
)

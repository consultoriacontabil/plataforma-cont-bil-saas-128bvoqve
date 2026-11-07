/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0139 — Varredura final de senhas de certificado.
 *
 * A 0137 selou 49 e a 0138 a última presa por relação órfã. Esta faz a
 * varredura de fechamento por duas razões:
 *
 *  1. `esocial_config.senha_certificado` ficou FORA do inventário inicial
 *     (o diagnóstico de 0136 não listou essa coleção) e recebe a senha por
 *     cópia no hook de certificado. Precisa ser selada como as demais.
 *  2. Qualquer registro criado entre uma migration e outra pode ter voltado
 *     a gravar senha em texto claro. Aqui a senha é cifrada na hora e o campo
 *     recebe o marcador, então rodar sempre converge para o estado seguro.
 *
 * Idempotente: campo com `__COFRE__` é ignorado; campo vazio não gera linha.
 *
 * Rollback: decifra e devolve o valor. Nada é perdido.
 */
migrate(
  (app) => {
    const chave = $secrets.get('CREDENTIALS_VAULT_KEY')
    if (!chave) throw new Error('[0139] CREDENTIALS_VAULT_KEY ausente.')

    // coleção -> campo de senha de certificado
    const ALVOS = {
      certificados_digitais: 'senha',
      nfe_config: 'senha_certificado',
      rfb_config: 'senha_certificado',
      esocial_config: 'senha_certificado',
      integra_contador_config: 'senha_certificado',
    }

    let selados = 0
    let cifradosNovos = 0

    const nomes = Object.keys(ALVOS)
    for (let i = 0; i < nomes.length; i++) {
      const escopo = nomes[i]
      const campo = ALVOS[escopo]

      let registros = []
      try {
        registros = app.findRecordsByFilter(escopo, '', '', 1000, 0)
      } catch (e) {
        console.log('[0139] nao foi possivel listar ' + escopo + ': ' + String(e))
        continue
      }

      for (let r = 0; r < registros.length; r++) {
        const rec = registros[r]
        const atual = rec.getString(campo)
        if (!atual || atual === '__COFRE__') continue

        let linha = null
        try {
          const achou = app.findRecordsByFilter(
            'credenciais_cofre',
            'escopo = {:e} && registro_id = {:r} && campo = {:c}',
            '',
            1,
            0,
            { e: escopo, r: rec.id, c: campo },
          )
          if (achou.length > 0) linha = achou[0]
        } catch (_) {}

        if (!linha) {
          try {
            linha = new Record(app.findCollectionByNameOrId('credenciais_cofre'))
            linha.set('tenant_id', rec.getString('tenant_id'))
            linha.set('escopo', escopo)
            linha.set('registro_id', rec.id)
            linha.set('campo', campo)
            cifradosNovos++
          } catch (eNovo) {
            console.log('[0139] falha ao preparar cofre para ' + escopo + ': ' + String(eNovo))
            continue
          }
        }

        linha.set('ciphertext', 'v1:' + $security.encrypt(atual, chave))
        linha.set('key_version', 1)
        try {
          app.save(linha)
        } catch (eCofre) {
          console.log('[0139] falha no cofre ' + escopo + '.' + campo + ': ' + String(eCofre))
          continue
        }

        // SQL direto: registros com relação órfã nao passam pelo app.save()
        try {
          app
            .db()
            .newQuery('UPDATE ' + escopo + ' SET ' + campo + " = '__COFRE__' WHERE id = {:id}")
            .bind({ id: rec.id })
            .execute()
          selados++
        } catch (eSql) {
          console.log('[0139] falha ao marcar ' + escopo + '.' + campo + ': ' + String(eSql))
        }
      }
    }

    console.log(
      '[0139] varredura: ' +
        selados +
        ' senhas seladas, ' +
        cifradosNovos +
        ' cifras novas no cofre',
    )
  },
  (app) => {
    const chave = $secrets.get('CREDENTIALS_VAULT_KEY')
    if (!chave) return
    const nomes = [
      'certificados_digitais',
      'nfe_config',
      'rfb_config',
      'esocial_config',
      'integra_contador_config',
    ]
    for (let i = 0; i < nomes.length; i++) {
      const linhas = app.findRecordsByFilter(
        'credenciais_cofre',
        'escopo = {:e} && (campo = {:s} || campo = {:t})',
        '',
        1000,
        0,
        { e: nomes[i], s: 'senha', t: 'senha_certificado' },
      )
      for (let l = 0; l < linhas.length; l++) {
        try {
          const claro = $security.decrypt(
            linhas[l].getString('ciphertext').replace(/^v1:/, ''),
            chave,
          )
          app
            .db()
            .newQuery(
              'UPDATE ' +
                nomes[i] +
                ' SET ' +
                linhas[l].getString('campo') +
                ' = {:s} WHERE id = {:id}',
            )
            .bind({ s: claro, id: linhas[l].getString('registro_id') })
            .execute()
        } catch (_) {}
      }
    }
  },
)

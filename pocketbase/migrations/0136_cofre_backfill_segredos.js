/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0136 — Copia os segredos em texto claro para o cofre cifrado.
 *
 * Nesta etapa NADA é apagado nem alterado nas coleções de origem. O objetivo é
 * ter uma cópia cifrada verificável: a próxima migration (0137) decifra o
 * cofre e compara com o valor original campo a campo. Só depois de tudo bater
 * é que a virada acontece.
 *
 * Inventário medido em produção/preview antes desta migration (diagnóstico
 * GET /backend/v1/admin/credenciais/diagnostico): 52 campos preenchidos.
 *
 *   nfse_config               evolution_api_key(1)
 *   nfe_config                senha_certificado(16)
 *   rfb_config                senha_certificado(16)
 *   integra_contador_config   consumer_secret(1), senha_certificado(1)
 *   certificados_digitais     senha(17)
 *
 * Uma credencial cujo texto original esteja vazio não gera linha no cofre.
 * Também não gera linha um valor que já pareça ciphertext do próprio cofre
 * (prefixo "v1:"), para a migration poder ser reaplicada sem duplo ciframento.
 *
 * Rollback: apaga as linhas criadas pelo cofre. Os originais continuam
 * intactos, então o rollback é seguro por construção.
 */
migrate(
  (app) => {
    const chave = $secrets.get('CREDENTIALS_VAULT_KEY')
    if (!chave) {
      throw new Error('[0136] CREDENTIALS_VAULT_KEY ausente: configure o segredo antes.')
    }

    // escopo -> [campos]
    const MAPA = {
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

    const cofre = app.findCollectionByNameOrId('credenciais_cofre')
    let gravados = 0
    let puladosVazios = 0

    const nomes = Object.keys(MAPA)
    for (let i = 0; i < nomes.length; i++) {
      const escopo = nomes[i]
      const campos = MAPA[escopo]
      let registros = []
      try {
        registros = app.findRecordsByFilter(escopo, '', '', 500, 0)
      } catch (e) {
        console.log('[0136] falha ao listar ' + escopo + ': ' + String(e))
        continue
      }

      for (let r = 0; r < registros.length; r++) {
        const rec = registros[r]
        const tenantId = rec.getString('tenant_id')
        if (!tenantId) continue

        for (let c = 0; c < campos.length; c++) {
          const campo = campos[c]
          const valor = rec.getString(campo)
          if (!valor || valor.trim().length === 0) {
            puladosVazios++
            continue
          }
          // nunca cifrar duas vezes
          if (valor.indexOf('v1:') === 0) continue

          let existente = null
          try {
            const achados = app.findRecordsByFilter(
              'credenciais_cofre',
              'escopo = {:e} && registro_id = {:r} && campo = {:c}',
              '',
              1,
              0,
              { e: escopo, r: rec.id, c: campo },
            )
            if (achados.length > 0) existente = achados[0]
          } catch (_) {
            existente = null
          }

          const cifrado = $security.encrypt(valor, chave)
          const linha = existente || new Record(cofre)

          linha.set('tenant_id', tenantId)
          linha.set('escopo', escopo)
          linha.set('registro_id', rec.id)
          linha.set('campo', campo)
          linha.set('ciphertext', 'v1:' + cifrado)
          linha.set('key_version', 1)
          app.save(linha)
          gravados++
        }
      }
    }

    console.log(
      '[0136] cofre populado: ' +
        gravados +
        ' segredos cifrados, ' +
        puladosVazios +
        ' campos vazios ignorados',
    )
  },
  (app) => {
    const linhas = app.findRecordsByFilter('credenciais_cofre', '', '', 1000, 0)
    for (let i = 0; i < linhas.length; i++) app.delete(linhas[i])
  },
)

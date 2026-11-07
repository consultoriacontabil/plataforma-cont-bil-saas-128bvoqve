/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0138 — Sela a senha remanescente em texto claro.
 *
 * A 0137 selou 49 de 50 senhas. Uma ficou de fora
 * (certificados_digitais id `mqgwarithkvahhq`) porque o registro aponta para
 * uma empresa que não existe mais e o `app.save()` revalida a relação,
 * recusando a gravação. O cofre já tem a cifra desse registro; falta só
 * trocar o texto claro pelo marcador.
 *
 * Usa SQL direto porque o objetivo é justamente não passar pela validação de
 * relação do PocketBase. Só toca a própria tabela e só o valor do marcador —
 * nenhum dado estrutural muda. Idempotente: rodar de novo não faz nada.
 *
 * Rollback: decifra o cofre e devolve o valor ao campo.
 */
migrate(
  (app) => {
    const chave = $secrets.get('CREDENTIALS_VAULT_KEY')
    if (!chave) throw new Error('[0138] CREDENTIALS_VAULT_KEY ausente.')

    // Toda senha de certificado com cifra no cofre pode receber o marcador.
    const linhas = app.findRecordsByFilter(
      'credenciais_cofre',
      'escopo = {:e} && campo = {:c}',
      '',
      500,
      0,
      { e: 'certificados_digitais', c: 'senha' },
    )

    let marcados = 0
    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i]
      const rid = l.getString('registro_id')
      try {
        app
          .db()
          .newQuery(
            "UPDATE certificados_digitais SET senha = '__COFRE__' WHERE id = {:id} AND senha != '__COFRE__'",
          )
          .bind({ id: rid })
          .execute()
        marcados++
      } catch (e) {
        console.log('[0138] falha ao marcar ' + rid + ': ' + String(e))
      }
    }

    console.log('[0138] senhas de certificado marcadas via SQL: ' + marcados)
  },
  (app) => {
    const chave = $secrets.get('CREDENTIALS_VAULT_KEY')
    if (!chave) return
    const linhas = app.findRecordsByFilter(
      'credenciais_cofre',
      'escopo = {:e} && campo = {:c}',
      '',
      500,
      0,
      { e: 'certificados_digitais', c: 'senha' },
    )
    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i]
      try {
        const claro = $security.decrypt(l.getString('ciphertext').replace(/^v1:/, ''), chave)
        app
          .db()
          .newQuery('UPDATE certificados_digitais SET senha = {:s} WHERE id = {:id}')
          .bind({ s: claro, id: l.getString('registro_id') })
          .execute()
      } catch (_) {}
    }
  },
)

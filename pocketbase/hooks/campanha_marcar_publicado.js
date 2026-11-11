/// <reference path="../pb_data/types.d.ts" />

/** Marca a mídia da campanha como publicada (temporário, removido depois). */
routerAdd('POST', '/backend/v1/campanha/marcar_publicado', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  const body = e.requestInfo().body || {}
  if (!k || String(body.key || '') !== k) return e.json(403, { erro: 'Chave invalida.' })

  const campanha = String(body.campanha || 'reforma-2027')
  const postId = String(body.post_id || '')
  const permalink = String(body.permalink || '')

  const registros = $app.findRecordsByFilter('midia_campanha', 'campanha = {:c}', 'ordem', 20, 0, {
    c: campanha,
  })

  let marcados = 0
  for (let i = 0; i < registros.length; i++) {
    const r = registros[i]
    r.set('status', 'publicado')
    r.set('publicado_em', new Date().toISOString())
    r.set('post_id', postId)
    r.set('permalink', permalink)
    $app.save(r)
    marcados++
  }

  return e.json(200, { ok: true, marcados: marcados })
})

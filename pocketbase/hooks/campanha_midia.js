/// <reference path="../pb_data/types.d.ts" />

/**
 * Hospeda a arte da campanha no Numbra... não: no Numbra não. Aqui.
 *
 * O Instagram não aceita upload de bytes: as rotas de container exigem uma
 * `image_url` pública que a Meta consegue buscar. O arquivo gerado no
 * workspace não é público. Esta rota grava a imagem em `midia_campanha`
 * (leitura pública, migration 0150) e devolve a URL que a Meta busca.
 *
 * Também marca publicados os registros da mesma campanha.
 *
 * Rotas:
 *   POST /backend/v1/campanha/midia            { campanha, ordem, nome_arquivo, arquivo_base64 }
 *   POST /backend/v1/campanha/marcar_publicado { campanha, post_id, permalink }
 */

routerAdd('POST', '/backend/v1/campanha/midia', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  const body = e.requestInfo().body || {}
  if (!k || String(body.key || '') !== k) return e.json(403, { erro: 'Chave invalida.' })

  const campanha = String(body.campanha || '').trim()
  const ordem = parseInt(String(body.ordem || '0'), 10) || 0
  const b64 = String(body.arquivo_base64 || '')
  const nome = String(body.nome_arquivo || 'arte.jpg')
  const tenantId = String(body.tenant_id || 'l91og8ybo9krtay')
  const legenda = String(body.legenda || '')

  if (!campanha || !b64) return e.json(400, { erro: 'campanha e arquivo_base64 obrigatorios.' })

  try {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)

    const file = $filesystem.fileFromBytes(bytes, nome)
    const col = $app.findCollectionByNameOrId('midia_campanha')

    // reaproveita o registro da mesma campanha+ordem, se já existir
    let rec = null
    try {
      const achou = $app.findRecordsByFilter(
        'midia_campanha',
        'campanha = {:c} && ordem = {:o}',
        '',
        1,
        0,
        { c: campanha, o: ordem },
      )
      if (achou.length > 0) rec = achou[0]
    } catch (_) {}

    if (!rec) rec = new Record(col)

    rec.set('tenant_id', tenantId)
    rec.set('campanha', campanha)
    rec.set('ordem', ordem)
    rec.set('legenda', legenda)
    rec.set('status', 'rascunho')
    rec.set('arquivo', file)
    $app.save(rec)

    const url =
      $secrets.get('PB_INSTANCE_URL') +
      '/api/files/' +
      col.id +
      '/' +
      rec.id +
      '/' +
      rec.getString('arquivo')

    return e.json(200, { ok: true, id: rec.id, url: url })
  } catch (err) {
    return e.json(500, { erro: String(err) })
  }
})

routerAdd('POST', '/backend/v1/campanha/marcar_publicado', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  const body = e.requestInfo().body || {}
  if (!k || String(body.key || '') !== k) return e.json(403, { erro: 'Chave invalida.' })

  const campanha = String(body.campanha || '')
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

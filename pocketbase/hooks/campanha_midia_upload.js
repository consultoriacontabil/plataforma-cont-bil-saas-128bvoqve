/// <reference path="../pb_data/types.d.ts" />

/**
 * Publica a arte da campanha: recebe o arquivo em base64, grava em
 * `midia_campanha` e devolve a URL pública que a Meta vai buscar.
 *
 * Existe porque o arquivo gerado no workspace não é público, e o Instagram não
 * aceita upload de bytes nas rotas de container — só uma URL acessível.
 *
 * Rota: POST /backend/v1/campanha/midia
 * Corpo: { campanha, ordem, legenda, arquivo_base64, nome_arquivo }
 * Autenticado com a chave do cofre (uso administrativo interno).
 */
routerAdd('POST', '/backend/v1/campanha/midia', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  const body = e.requestInfo().body || {}
  if (!k || String(body.key || '') !== k) return e.json(403, { erro: 'Chave invalida.' })

  const campanha = String(body.campanha || '').trim()
  const ordem = parseInt(String(body.ordem || '0'), 10) || 0
  const legenda = String(body.legenda || '')
  const b64 = String(body.arquivo_base64 || '')
  const nome = String(body.nome_arquivo || 'arte.jpg')
  const tenantId = String(body.tenant_id || 'l91og8ybo9krtay')

  if (!campanha || !b64) return e.json(400, { erro: 'campanha e arquivo_base64 obrigatorios.' })

  try {
    // decodifica base64 -> bytes
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)

    const file = $filesystem.fileFromBytes(bytes, nome)

    const col = $app.findCollectionByNameOrId('midia_campanha')
    const rec = new Record(col)
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

    return e.json(200, { ok: true, id: rec.id, url: url, arquivo: rec.getString('arquivo') })
  } catch (err) {
    return e.json(500, { erro: String(err) })
  }
})

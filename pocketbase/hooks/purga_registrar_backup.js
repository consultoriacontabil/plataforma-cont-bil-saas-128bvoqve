/// <reference path="../pb_data/types.d.ts" />

/**
 * BACKUP — registra a execução do backup no log (`backups_execucoes`).
 * POST /backend/v1/purga/registrar-backup
 * Header: X-Purga-Token
 * Body: { ref, contagem: {colecao: n}, total_registros, total_arquivos, total_bytes, destino, observacao }
 *
 * A referência `ref` é o hash do pacote de backup gravado fora do banco.
 * A rotina de purga exige essa referência no log para poder apagar.
 */
routerAdd('POST', '/backend/v1/purga/registrar-backup', (e) => {
  var esperado = $secrets.get('PURGA_TOKEN')
  var recebido = ''
  var corpo = {}
  try {
    var info = e.requestInfo()
    recebido =
      (info.headers && (info.headers['x_purga_token'] || info.headers['x-purga-token'])) || ''
    corpo = info.body || {}
  } catch (_) {}
  if (!esperado || recebido !== esperado) {
    return e.json(401, { erro: 'token inválido' })
  }

  var ref = String(corpo.ref || '')
  if (ref.length < 8) return e.json(400, { erro: 'ref (hash) do backup obrigatória' })

  var app = e.app
  var dono = null
  try {
    dono = app.findAuthRecordByEmail(
      'users',
      String(corpo.owner_email || 'rumo@rumoconsultoriacontabil.com.br'),
    )
  } catch (_) {
    dono = null
  }

  // o log é por tenant; usa o do dono quando existir
  var tenantId = String(corpo.tenant_id || '')
  if (!tenantId && dono) {
    try {
      var vin = app.findFirstRecordByData('tenant_members', 'user_id', dono.id)
      tenantId = vin.getString('tenant_id')
    } catch (_) {}
  }
  if (!tenantId) return e.json(412, { erro: 'tenant_id não resolvido para o log de backup' })

  var col = app.findCollectionByNameOrId('backups_execucoes')

  // idempotência: mesmo ref não gera dois registros
  try {
    var jaTem = app.findRecordsByFilter('backups_execucoes', 'mensagem ~ {:r}', '', 1, 0, {
      r: ref,
    })
    if (jaTem.length > 0) {
      return e.json(200, { ok: true, ja_registrado: true, id: jaTem[0].id })
    }
  } catch (_) {}

  var rec = new Record(col)
  rec.set('tenant_id', tenantId)
  rec.set('data_execucao', new Date().toISOString())
  rec.set('tipo', 'manual')
  rec.set('status', 'sucesso')
  rec.set('retencao_dias', 365)
  if (dono) rec.set('executado_por', dono.id)
  if (corpo.contagem) rec.set('contagem_registros', corpo.contagem)
  if (corpo.colecoes) rec.set('colecoes_exportadas', corpo.colecoes)
  if (corpo.total_bytes) rec.set('tamanho_estimado_bytes', Number(corpo.total_bytes))
  rec.set(
    'mensagem',
    'BACKUP COMPLETO PRÉ-PURGA (ref ' +
      ref +
      '): ' +
      String(corpo.total_registros || 0) +
      ' registros em ' +
      String((corpo.colecoes || []).length) +
      ' coleções e ' +
      String(corpo.total_arquivos || 0) +
      ' arquivos (' +
      String(corpo.total_bytes || 0) +
      ' bytes). Destino: ' +
      String(corpo.destino || 'workspace do agente') +
      '. ' +
      String(corpo.observacao || ''),
  )
  app.save(rec)

  return e.json(200, { ok: true, id: rec.id, ref: ref, tenant_id: tenantId })
})

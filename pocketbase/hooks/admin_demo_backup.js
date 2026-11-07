/// <reference path="../pb_data/types.d.ts" />

/**
 * BACKUP lógico antes da limpeza (somente leitura).
 *
 * Devolve o conteúdo completo de `obrigacoes` e `notificacoes` em JSON, para
 * ficar salvo fora do banco antes de qualquer exclusão. Nada é alterado.
 *
 * Rota: GET /backend/v1/admin/demo/backup?key=...&offset=N&limite=M
 */
routerAdd('GET', '/backend/v1/admin/demo/backup', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!k || (e.request.url.query().get('key') || '') !== k) return e.json(403, { e: 1 })

  const q = e.request.url.query()
  const offset = parseInt(q.get('offset') || '0', 10) || 0
  const limite = Math.min(parseInt(q.get('limite') || '300', 10) || 300, 500)

  const saida = {
    obrigacoes: [],
    notificacoes: [],
    total_notificacoes: 0,
    offset: offset,
    limite: limite,
  }

  try {
    const obs = $app.findRecordsByFilter('obrigacoes', '', 'created', 500, 0)
    saida.obrigacoes = obs.map(function (o) {
      return {
        id: o.id,
        tenant_id: o.getString('tenant_id'),
        empresa_id: o.getString('empresa_id'),
        tipo: o.getString('tipo'),
        competencia: o.getString('competencia'),
        vencimento: o.getString('vencimento'),
        status: o.getString('status'),
        valor: o.get('valor'),
        observacoes: o.getString('observacoes'),
        data_entrega: o.getString('data_entrega'),
        created: o.getString('created'),
      }
    })
  } catch (err) {
    saida.erro_obrigacoes = String(err)
  }

  try {
    const todas = $app.findRecordsByFilter('notificacoes', '', 'created', 5000, 0)
    saida.total_notificacoes = todas.length
    const fatia = todas.slice(offset, offset + limite)
    saida.notificacoes = fatia.map(function (n) {
      return {
        id: n.id,
        tenant_id: n.getString('tenant_id'),
        usuario_destino_id: n.getString('usuario_destino_id'),
        titulo: n.getString('titulo'),
        mensagem: n.getString('mensagem'),
        tipo: n.getString('tipo'),
        link: n.getString('link'),
        lida: n.getBool('lida'),
        created: n.getString('created'),
      }
    })
  } catch (err) {
    saida.erro_notificacoes = String(err)
  }

  return e.json(200, saida)
})

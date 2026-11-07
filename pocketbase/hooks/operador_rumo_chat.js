/// <reference path="../pb_data/types.d.ts" />

/**
 * Chat do agente operacional — rota autenticada.
 *
 * Segue o padrão de `elliza_agent_chat.js`: identidade vem de `e.auth.id`,
 * nunca do corpo da requisição. O runtime do agente aplica as regras de
 * coleção como esse usuário, então o isolamento por tenant que está no banco
 * (v0.0.208) vale para toda tool — o agente não alcança outro escritório.
 *
 * Rotas:
 *   POST /backend/v1/operador/chat        { message, conversation_id? }
 *   GET  /backend/v1/operador/historico   ?limit=20
 */

routerAdd(
  'POST',
  '/backend/v1/operador/chat',
  (e) => {
    const userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('Autenticação necessária.')

    const body = e.requestInfo().body || {}
    const message = String(body.message || '').trim()
    if (!message) return e.badRequestError('message é obrigatório.')
    if (message.length > 4000) return e.badRequestError('Mensagem muito longa (máx. 4000).')

    try {
      const result = $ai.agent('operador-rumo').chat({
        user_id: userId,
        conversation_id: body.conversation_id || null,
        message: message,
      })

      // registra a interação na auditoria do escritório do próprio usuário
      try {
        let tenantId = ''
        const vinculos = $app.findRecordsByFilter(
          'tenant_members',
          "user_id = {:u} && status = 'ativo'",
          '',
          1,
          0,
          { u: userId },
        )
        if (vinculos.length > 0) tenantId = vinculos[0].getString('tenant_id')

        if (tenantId) {
          const audit = new Record($app.findCollectionByNameOrId('audit_log'))
          audit.set('tenant_id', tenantId)
          audit.set('usuario_id', userId)
          audit.set('acao', 'agente_operador_chat')
          audit.set('entidade_tipo', 'operador-rumo')
          audit.set('entidade_id', result.conversation_id || '')
          audit.set('detalhes', 'Mensagem enviada ao Operador Rumo (' + message.length + ' chars).')
          $app.save(audit)
        }
      } catch (_) {
        // auditoria é registro, não bloqueia a resposta
      }

      return e.json(200, {
        content: result.content,
        conversation_id: result.conversation_id,
      })
    } catch (err) {
      console.log('[OPERADOR] erro no chat:', err)
      return e.json(500, { error: 'Falha ao falar com o agente: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'GET',
  '/backend/v1/operador/historico',
  (e) => {
    const userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('Autenticação necessária.')

    const limit = Math.min(parseInt(e.request.url.query().get('limit') || '20', 10) || 20, 50)

    try {
      const convs = $ai.agent('operador-rumo').listConversations({ user_id: userId, limit: limit })
      return e.json(200, { conversas: convs })
    } catch (err) {
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)

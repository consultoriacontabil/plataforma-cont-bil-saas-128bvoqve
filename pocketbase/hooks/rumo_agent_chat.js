// Hook: rumo_agent_chat.js
// Custom endpoint POST /backend/v1/rumo-agent/chat with Skip Cloud Agent
routerAdd(
  'POST',
  '/backend/v1/rumo-agent/chat',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      const body = e.requestInfo().body || {}
      const message = (body.message || '').trim()
      const conversationId = body.conversation_id || null
      const tenantId = body.tenant_id

      if (!message) {
        return e.badRequestError('A mensagem não pode estar vazia')
      }

      // Resolve conversation
      const conv = $ai.agent('rumo-agent').getOrCreateConversation({
        user_id: userId,
        id: conversationId,
        title: message.length > 40 ? message.slice(0, 40) + '...' : message,
      })

      // Also persist in agent_conversations and agent_messages for client display
      if (tenantId) {
        try {
          const convCol = $app.findCollectionByNameOrId('agent_conversations')
          let appConv
          try {
            appConv = $app.findFirstRecordByData('agent_conversations', 'id', conv.id)
          } catch (_) {
            appConv = new Record(convCol)
            appConv.set('id', conv.id)
            appConv.set('tenant_id', tenantId)
            appConv.set('user_id', userId)
            appConv.set('titulo', message.length > 40 ? message.slice(0, 40) + '...' : message)
            $app.save(appConv)
          }

          const msgCol = $app.findCollectionByNameOrId('agent_messages')
          const userMsg = new Record(msgCol)
          userMsg.set('tenant_id', tenantId)
          userMsg.set('conversation_id', conv.id)
          userMsg.set('user_id', userId)
          userMsg.set('role', 'user')
          userMsg.set('conteudo', message)
          $app.save(userMsg)
        } catch (err) {
          console.log('Error recording user message:', err)
        }
      }

      const iter = $ai.agent('rumo-agent').chat({
        user_id: userId,
        conversation_id: conv.id,
        message: message,
        stream: true,
      })

      e.response.header().set('Content-Type', 'text/event-stream')
      e.response.header().set('Cache-Control', 'no-cache')
      e.response.header().set('X-Conversation-Id', conv.id)

      $response.stream(e, iter)
    } catch (err) {
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'Serviço de IA temporariamente indisponível' })
      }
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, {
          error: status >= 500 ? 'Falha na requisição ao assistente' : err.message,
        })
      }
      if (err instanceof SkipAiError) {
        const status = err.status || 502
        return e.json(status, { error: status >= 500 ? 'Serviço de IA indisponível' : err.message })
      }
      return e.json(500, { error: err.message || 'Erro interno no chat' })
    }
  },
  $apis.requireAuth(),
)

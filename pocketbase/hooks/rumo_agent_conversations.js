// Hook: rumo_agent_conversations.js
// Custom endpoint POST /backend/v1/rumo-agent/conversations
routerAdd(
  'POST',
  '/backend/v1/rumo-agent/conversations',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      const body = e.requestInfo().body || {}
      const title = (body.title || 'Nova conversa').trim()
      const tenantId = body.tenant_id

      const conv = $ai.agent('rumo-agent').getOrCreateConversation({
        user_id: userId,
        title: title,
      })

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
            appConv.set('titulo', title)
            $app.save(appConv)
          }
        } catch (err) {
          console.log('Error creating app conversation record:', err)
        }
      }

      return e.json(200, {
        id: conv.id,
        title: conv.title || title,
        created: conv.created,
      })
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao criar conversa' })
    }
  },
  $apis.requireAuth(),
)

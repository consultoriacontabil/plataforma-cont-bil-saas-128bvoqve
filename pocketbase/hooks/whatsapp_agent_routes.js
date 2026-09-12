/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook para simular e testar o Agente Nativo de WhatsApp (Skip Cloud Agent)
 * Endpoint: POST /backend/v1/whatsapp-agent/test
 * Requer autenticação do usuário do tenant
 */
routerAdd(
  'POST',
  '/backend/v1/whatsapp-agent/test',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) {
        return e.unauthorizedError('Autenticação necessária para testar o agente.')
      }

      const body = e.requestInfo().body || {}
      const mensagem = (body.mensagem || '').trim()
      const tenantId = body.tenant_id
      const empresaId = body.empresa_id

      if (!mensagem) {
        return e.badRequestError('A mensagem de teste é obrigatória.')
      }

      // 1. Obter informações da empresa e tenant para contexto
      let infoContexto = ''
      if (empresaId) {
        try {
          const emp = $app.findFirstRecordByData('empresas', 'id', empresaId)
          infoContexto +=
            'Empresa: ' +
            emp.getString('razao_social') +
            ' | CNPJ: ' +
            emp.getString('cnpj') +
            ' | Regime: ' +
            emp.getString('regime_tributario') +
            '\n'
        } catch (_) {}
      }

      // 2. Chamar o agente nativo 'whatsapp-agent'
      const promptEnriquecido =
        '[Ambiente de Simulação do Painel do Contador / Tenant]\n' +
        (infoContexto ? infoContexto : 'Empresa padrão do tenant em consulta.\n') +
        'Pergunta recebida via WhatsApp: "' +
        mensagem +
        '"\n\n' +
        'Consulte os dados reais do escritório (obrigacoes, guias_pagamentos, parcelamentos, documentos, etc.) para responder. Se for ato fiscal (como emitir NFS-e), esclareça que deve ser direcionado para conferência contábil no modo assistivo.'

      let resultadoAgent = null
      try {
        resultadoAgent = $ai.agent('whatsapp-agent').chat({
          user_id: userId,
          message: promptEnriquecido,
        })
      } catch (errAi) {
        console.log('[WHATSAPP-AGENT-TEST] Erro no Agente Nativo:', errAi)
        return e.json(500, {
          error: 'Falha na execução do agente nativo: ' + (errAi.message || 'Erro desconhecido'),
        })
      }

      return e.json(200, {
        sucesso: true,
        resposta: resultadoAgent.content,
        citacoes: resultadoAgent.citations || [],
        conversation_id: resultadoAgent.conversation_id,
        message_id: resultadoAgent.message_id,
        tempo_resposta: new Date().toISOString(),
      })
    } catch (err) {
      console.log('[WHATSAPP-AGENT-TEST] Erro geral:', err)
      return e.json(500, { error: err.message || 'Erro ao processar teste do agente' })
    }
  },
  $apis.requireAuth(),
)

/**
 * Hook para enviar ou aprovar mensagem de resposta no WhatsApp
 * Endpoint: POST /backend/v1/whatsapp-agent/mensagens/enviar
 */
routerAdd(
  'POST',
  '/backend/v1/whatsapp-agent/mensagens/enviar',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) {
        return e.unauthorizedError('Autenticação necessária.')
      }

      const body = e.requestInfo().body || {}
      const conversaId = body.conversa_id
      const conteudo = (body.conteudo || '').trim()
      const mensagemId = body.mensagem_id // opcional, se for aprovação de sugestão da IA

      if (!conversaId || !conteudo) {
        return e.badRequestError('ID da conversa e conteúdo da mensagem são obrigatórios.')
      }

      const convCol = $app.findCollectionByNameOrId('wa_atendimento_conversas')
      const msgCol = $app.findCollectionByNameOrId('wa_atendimento_mensagens')
      const conv = $app.findFirstRecordByData('wa_atendimento_conversas', 'id', conversaId)
      const tenantId = conv.getString('tenant_id')

      let msgRecord = null
      if (mensagemId) {
        try {
          msgRecord = $app.findFirstRecordByData('wa_atendimento_mensagens', 'id', mensagemId)
          msgRecord.set('conteudo', conteudo)
          msgRecord.set('status_envio', 'enviada')
          msgRecord.set('aprovado_por', userId)
          $app.save(msgRecord)
        } catch (_) {}
      }

      if (!msgRecord) {
        msgRecord = new Record(msgCol)
        msgRecord.set('tenant_id', tenantId)
        msgRecord.set('conversa', conversaId)
        msgRecord.set('remetente_tipo', 'humano')
        msgRecord.set('conteudo', conteudo)
        msgRecord.set('status_envio', 'enviada')
        msgRecord.set('aprovado_por', userId)
        $app.save(msgRecord)
      }

      // Atualizar contadores da conversa
      conv.set('ultima_mensagem', conteudo.slice(0, 200))
      conv.set('ultima_interacao', new Date().toISOString())
      conv.set('total_mensagens', (conv.getInt('total_mensagens') || 0) + 1)
      conv.set('total_respostas_humano', (conv.getInt('total_respostas_humano') || 0) + 1)
      conv.set('status', 'em_atendimento')
      conv.set('atendente_humano', userId)
      $app.save(conv)

      // Despacho via Evolution API se configurada
      let cfgRec = null
      try {
        cfgRec = $app.findFirstRecordByData('nfse_config', 'tenant_id', tenantId)
      } catch (_) {}

      let evoDispatch = 'simulado_sem_servidor'
      if (cfgRec) {
        let evoUrl = cfgRec.getString('evolution_api_url')
        const evoKey = cfgRec.getString('evolution_api_key')
        const evoInstance = cfgRec.getString('evolution_instance')
        let dest = conv.getString('origem_chat_jid') || conv.getString('contato_telefone')
        if (dest && !dest.includes('@')) dest += '@s.whatsapp.net'

        if (evoUrl && evoKey && evoInstance && dest) {
          if (evoUrl.endsWith('/')) evoUrl = evoUrl.slice(0, -1)
          try {
            const sendEndpoint = evoUrl + '/message/sendText/' + encodeURIComponent(evoInstance)
            $http.send({
              url: sendEndpoint,
              method: 'POST',
              headers: { 'Content-Type': 'application/json', apikey: evoKey },
              body: JSON.stringify({
                number: dest,
                text: conteudo,
                options: { delay: 500 },
              }),
              timeout: 10,
            })
            evoDispatch = 'enviado_real'
          } catch (errEvo) {
            console.log('[WHATSAPP-AGENT-ENVIAR] Erro envio Evolution:', errEvo)
          }
        }
      }

      return e.json(200, {
        sucesso: true,
        mensagem_id: msgRecord.id,
        evolution_dispatch: evoDispatch,
      })
    } catch (err) {
      console.log('[WHATSAPP-AGENT-ENVIAR] Erro:', err)
      return e.json(500, { error: err.message || 'Erro ao enviar mensagem' })
    }
  },
  $apis.requireAuth(),
)

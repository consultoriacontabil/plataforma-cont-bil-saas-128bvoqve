/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoint para envio de mensagem / atualização de status via WhatsApp (Etapa 8)
 * Rota autenticada: POST /api/nfse/enviar-whatsapp
 */
routerAdd(
  'POST',
  '/backend/v1/nfse/enviar-whatsapp',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.unauthorizedError('Autenticação necessária')
      }

      const body = e.requestInfo().body || {}
      const solicitacaoId = body.solicitacao_id
      const mensagemTexto = (body.mensagem || '').trim()

      if (!solicitacaoId || !mensagemTexto) {
        return e.badRequestError('solicitacao_id e mensagem são obrigatórios')
      }

      const solRec = $app.findRecordById('nfse_solicitacoes', solicitacaoId)
      const tenantId = solRec.getString('tenant_id')

      let configRec = null
      try {
        configRec = $app.findFirstRecordByData('nfse_config', 'tenant_id', tenantId)
      } catch (_) {}

      // Atualizar histórico de mensagens na solicitação
      let historico = []
      try {
        const rawHist = solRec.get('historico_mensagens_json')
        if (Array.isArray(rawHist)) {
          historico = rawHist
        }
      } catch (_) {}

      const agora = new Date().toISOString()
      historico.push({
        origem: 'escritorio_bot',
        texto: mensagemTexto,
        data: agora,
      })

      solRec.set('historico_mensagens_json', historico)
      $app.save(solRec)

      // Se houver Evolution API configurada, tentar envio real
      let enviadoReal = false
      if (configRec) {
        let evoUrl = configRec.getString('evolution_api_url')
        const evoKey = configRec.getString('evolution_api_key')
        const evoInstance = configRec.getString('evolution_instance')
        const remoteJid =
          solRec.getString('origem_chat_jid') || solRec.getString('contato_telefone')

        if (evoUrl && evoKey && evoInstance && remoteJid) {
          if (evoUrl.endsWith('/')) evoUrl = evoUrl.slice(0, -1)
          try {
            const sendEndpoint = evoUrl + '/message/sendText/' + evoInstance
            $http.send({
              url: sendEndpoint,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: evoKey,
              },
              body: JSON.stringify({
                number: remoteJid,
                text: mensagemTexto,
              }),
              timeout: 10,
            })
            enviadoReal = true
          } catch (errHttp) {
            console.log(
              '[NFSE-ENVIO-WA] Servidor Evolution indisponível, registrado em modo simulado:',
              errHttp,
            )
          }
        }
      }

      return e.json(200, {
        status: 'sucesso',
        enviado_real: enviadoReal,
        modo: enviadoReal ? 'evolution_api' : 'simulado_registrado',
        mensagem: mensagemTexto,
        data: agora,
      })
    } catch (err) {
      console.log('[NFSE-ENVIO-WA] Erro:', err)
      return e.json(500, { error: err.message || 'Erro ao enviar mensagem WhatsApp' })
    }
  },
  $apis.requireAuth(),
)

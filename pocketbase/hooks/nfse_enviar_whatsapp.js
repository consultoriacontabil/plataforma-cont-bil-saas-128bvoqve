/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoint para envio de mensagem / atualização de status via WhatsApp (Etapa 8)
 * Rota autenticada: POST /backend/v1/nfse/enviar-whatsapp
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
        } else if (typeof rawHist === 'string' && rawHist.trim().startsWith('[')) {
          historico = JSON.parse(rawHist)
        }
      } catch (_) {}

      const agora = new Date().toISOString()
      historico.push({
        origem: 'escritorio_bot',
        texto: mensagemTexto,
        data: agora,
      })

      solRec.set('historico_mensagens_json', JSON.stringify(historico))
      $app.save(solRec)

      // Se houver Evolution API configurada, tentar envio real
      let enviadoReal = false
      let respostaEvo = null
      let detalheEnvio = ''

      if (configRec) {
        let evoUrl = configRec.getString('evolution_api_url')
        const evoKey = configRec.getString('evolution_api_key')
        const evoInstance = configRec.getString('evolution_instance')

        // Destinatário pode ser o JID salvo ou o telefone sanitizado
        let destinatario = solRec.getString('origem_chat_jid')
        if (!destinatario || !destinatario.includes('@')) {
          const tel = (solRec.getString('contato_telefone') || '').replace(/\D/g, '')
          if (tel) {
            destinatario = tel.includes('@') ? tel : tel + '@s.whatsapp.net'
          }
        }

        if (evoUrl && evoKey && evoInstance && destinatario) {
          if (evoUrl.endsWith('/')) evoUrl = evoUrl.slice(0, -1)
          try {
            const sendEndpoint = evoUrl + '/message/sendText/' + encodeURIComponent(evoInstance)
            const resp = $http.send({
              url: sendEndpoint,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: evoKey,
              },
              body: JSON.stringify({
                number: destinatario,
                text: mensagemTexto,
                options: {
                  delay: 800,
                  presence: 'composing',
                  linkPreview: true,
                },
              }),
              timeout: 12,
            })

            if (resp.statusCode >= 200 && resp.statusCode < 300) {
              enviadoReal = true
              respostaEvo = resp.json
              detalheEnvio =
                'Mensagem despachada com sucesso para o WhatsApp real via Evolution API'
            } else {
              detalheEnvio =
                'Evolution API retornou status ' + resp.statusCode + ': ' + (resp.rawText || '')
            }
          } catch (errHttp) {
            detalheEnvio =
              'Falha ao conectar com servidor Evolution API: ' +
              (errHttp.message || String(errHttp))
            console.log(
              '[NFSE-ENVIO-WA] Servidor Evolution indisponível, fallback para simulação controlada:',
              errHttp,
            )
          }
        } else {
          detalheEnvio =
            'Evolution API não configurada neste tenant — mensagem registrada internamente'
        }
      }

      return e.json(200, {
        status: 'sucesso',
        enviado_real: enviadoReal,
        modo: enviadoReal ? 'evolution_api_real' : 'simulado_registrado',
        mensagem: mensagemTexto,
        detalhe: detalheEnvio,
        resposta_evolution: respostaEvo,
        data: agora,
      })
    } catch (err) {
      console.log('[NFSE-ENVIO-WA] Erro:', err)
      return e.json(500, { error: err.message || 'Erro ao enviar mensagem WhatsApp' })
    }
  },
  $apis.requireAuth(),
)

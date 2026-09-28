/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook de Envio Ativo por WhatsApp via Evolution API (Modo Real / Modo Supervisão)
 * Rota: POST /backend/v1/whatsapp-ativo/disparar
 * Body:
 * {
 *   tenant_id: string,
 *   empresa_id: string,
 *   tipo: 'aviso' | 'guia' | 'demonstrativo' | 'previa' | 'documento',
 *   referencia?: string,
 *   destinatario: string,
 *   mensagem: string,
 *   origem?: 'manual' | 'elliza' | 'agendador'
 * }
 */
routerAdd(
  'POST',
  '/backend/v1/whatsapp-ativo/disparar',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.unauthorizedError('Autenticação necessária')
      }

      const body = e.requestInfo().body || {}
      const tenantId = body.tenant_id
      const empresaId = body.empresa_id
      const tipo = body.tipo
      const referencia = (body.referencia || '').trim()
      const rawDestinatario = (body.destinatario || '').trim()
      const mensagem = (body.mensagem || '').trim()
      const origem = body.origem || 'manual'

      if (!tenantId || !empresaId || !tipo || !rawDestinatario || !mensagem) {
        return e.badRequestError(
          'Campos tenant_id, empresa_id, tipo, destinatario e mensagem são obrigatórios',
        )
      }

      const cleanPhone = rawDestinatario.replace(/\D/g, '')
      if (cleanPhone.length < 10) {
        return e.badRequestError('Número de telefone do destinatário inválido')
      }

      // Buscar credenciais da Evolution API configuradas no tenant (em nfse_config)
      let configRec = null
      try {
        configRec = $app.findFirstRecordByData('nfse_config', 'tenant_id', tenantId)
      } catch (_) {}

      const evoUrl = configRec ? configRec.getString('evolution_api_url') : ''
      const evoKey = configRec ? configRec.getString('evolution_api_key') : ''
      const evoInstance = configRec ? configRec.getString('evolution_instance') : ''

      const hasValidCredentials = Boolean(
        evoUrl &&
        evoKey &&
        evoInstance &&
        evoUrl.trim() !== '' &&
        !evoUrl.includes('.internal') &&
        !evoUrl.includes('localhost'),
      )

      const enviosCol = $app.findCollectionByNameOrId('whatsapp_envios')
      const envioRecord = new Record(enviosCol)
      envioRecord.set('tenant_id', tenantId)
      envioRecord.set('empresa', empresaId)
      envioRecord.set('tipo', tipo)
      envioRecord.set('referencia', referencia)
      envioRecord.set('destinatario', cleanPhone)
      envioRecord.set('mensagem', mensagem)
      envioRecord.set('origem', origem)

      if (!hasValidCredentials) {
        // MODO SUPERVISÃO: Não simular envio bem-sucedido
        envioRecord.set('status', 'aguardando_credenciais')
        envioRecord.set(
          'erro',
          'Modo Supervisão ativo: Evolution API não configurada com credenciais externas ativas. Configure em Integrações -> NFS-e & WhatsApp.',
        )
        envioRecord.set('detalhes_json', {
          modo: 'supervisao',
          status_motivo: 'aguardando_credenciais',
          evolution_api_url: evoUrl || 'não configurada',
          evolution_instance: evoInstance || 'não configurada',
          mensagem_preview: mensagem.slice(0, 100),
        })
        $app.save(envioRecord)

        return e.json(200, {
          sucesso: true,
          status: 'aguardando_credenciais',
          modo: 'supervisao',
          envio_id: envioRecord.id,
          mensagem:
            'Mensagem registrada em fila no Modo Supervisão (Aguardando Credenciais da Evolution API). Nada foi transmitido externamente.',
        })
      }

      // DISPARO REAL: Tentar POST /message/sendText/{instance}
      let baseUrl = evoUrl.trim()
      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1)
      const sendEndpoint = baseUrl + '/message/sendText/' + encodeURIComponent(evoInstance.trim())

      let destJid = cleanPhone
      if (!destJid.includes('@')) destJid = destJid + '@s.whatsapp.net'

      try {
        const resp = $http.send({
          url: sendEndpoint,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: evoKey.trim(),
          },
          body: JSON.stringify({
            number: destJid,
            text: mensagem,
            options: {
              delay: 800,
              presence: 'composing',
              linkPreview: true,
            },
          }),
          timeout: 12,
        })

        if (resp.statusCode >= 200 && resp.statusCode < 300) {
          envioRecord.set('status', 'enviado')
          envioRecord.set('detalhes_json', {
            statusCode: resp.statusCode,
            resposta_evolution: resp.json,
          })
          $app.save(envioRecord)

          return e.json(200, {
            sucesso: true,
            status: 'enviado',
            modo: 'producao_real',
            envio_id: envioRecord.id,
            mensagem: 'Mensagem enviada com sucesso para o WhatsApp via Evolution API!',
          })
        } else {
          const rawErr = resp.rawText || ''
          envioRecord.set('status', 'falhou')
          envioRecord.set(
            'erro',
            'Evolution API retornou status ' + resp.statusCode + ': ' + rawErr,
          )
          envioRecord.set('detalhes_json', {
            statusCode: resp.statusCode,
            resposta_erro: rawErr,
          })
          $app.save(envioRecord)

          return e.json(200, {
            sucesso: false,
            status: 'falhou',
            envio_id: envioRecord.id,
            erro: 'Falha no servidor Evolution API (' + resp.statusCode + ')',
          })
        }
      } catch (errHttp) {
        const msgErr = errHttp.message || String(errHttp)
        envioRecord.set('status', 'falhou')
        envioRecord.set('erro', 'Falha na conexão HTTP com Evolution API: ' + msgErr)
        $app.save(envioRecord)

        return e.json(200, {
          sucesso: false,
          status: 'falhou',
          envio_id: envioRecord.id,
          erro: 'Conexão indisponível com a Evolution API: ' + msgErr,
        })
      }
    } catch (errGeral) {
      console.log('[WHATSAPP-ATIVO-DISPARAR] Erro geral:', errGeral)
      return e.json(500, {
        error: errGeral.message || 'Erro interno ao processar disparo WhatsApp ativo',
      })
    }
  },
  $apis.requireAuth(),
)

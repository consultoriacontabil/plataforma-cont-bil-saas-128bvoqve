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

      solRec.set('historico_mensagens_json', historico)
      $app.save(solRec)

      // A plataforma NUNCA envia WhatsApp direto (Evolution API descartada por
      // decisão do usuário). A mensagem vira TAREFA em wa_whats_disparos
      // (origem 'documento'), executada pelo conector Rumo Whats (Baileys/QR)
      // via GET /backend/v1/rumo-whats/fila-disparos.
      let statusEnfileiramento = ''
      try {
        // Destinatário pode ser o JID salvo ou o telefone sanitizado
        let destinatario = solRec.getString('origem_chat_jid')
        if (!destinatario || !destinatario.includes('@')) {
          const tel = (solRec.getString('contato_telefone') || '').replace(/\D/g, '')
          if (tel) destinatario = tel + '@s.whatsapp.net'
        }
        const telefoneDestino = (destinatario || '')
          .replace('@s.whatsapp.net', '')
          .replace(/\D/g, '')

        if (!telefoneDestino) {
          statusEnfileiramento = 'sem_destinatario'
        } else {
          const disp = new Record($app.findCollectionByNameOrId('wa_whats_disparos'))
          disp.set('tenant_id', tenantId)
          disp.set('origem', 'documento')
          disp.set('modulo_origem', 'atendimento')
          disp.set('documento_nome', 'Atendimento NFS-e — mensagem do escritório')
          disp.set('origem_id', solRec.id)
          disp.set('destinatario_nome', solRec.getString('contato_nome') || '')
          disp.set('telefone', telefoneDestino)
          disp.set('mensagem', mensagemTexto)
          disp.set('status', 'pendente')
          $app.save(disp)
          statusEnfileiramento = 'enfileirado_rumo_whats'
        }
      } catch (errDisp) {
        console.log('[NFSE-ENVIO-WA] Falha ao enfileirar disparo Rumo Whats:', errDisp)
        statusEnfileiramento = 'falha_enfileiramento'
      }

      return e.json(200, {
        status: 'sucesso',
        enfileirado: statusEnfileiramento === 'enfileirado_rumo_whats',
        modo: 'fila_rumo_whats',
        mensagem: mensagemTexto,
        detalhe:
          statusEnfileiramento === 'enfileirado_rumo_whats'
            ? 'Mensagem enfileirada em wa_whats_disparos — será despachada pelo conector Rumo Whats'
            : 'Não foi possível enfileirar (' + statusEnfileiramento + ')',
        data: agora,
      })
    } catch (err) {
      console.log('[NFSE-ENVIO-WA] Erro:', err)
      return e.json(500, { error: err.message || 'Erro ao enviar mensagem WhatsApp' })
    }
  },
  $apis.requireAuth(),
)

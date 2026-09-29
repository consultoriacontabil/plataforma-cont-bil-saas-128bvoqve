/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook de disparo de mensagens por WhatsApp via Evolution API.
 * Toda a lógica interna está encapsulada dentro do callback (regra JSVM da Skip Cloud).
 */

routerAdd('POST', '/backend/v1/whatsapp-ativo/disparar', (e) => {
  const auth = e.auth
  if (!auth) {
    return e.json(401, { erro: 'Requer autenticação' })
  }

  const app = e.app
  let body = {}
  try {
    body = e.requestInfo().body
  } catch (_) {
    return e.json(400, { erro: 'Corpo da requisição inválido' })
  }

  const tenantId = body.tenant_id
  const empresaId = body.empresa_id
  const tipo = body.tipo || 'aviso'
  const referencia = body.referencia || ''
  const destinatario = body.destinatario
  const mensagem = body.mensagem
  const origem = body.origem || 'manual'

  if (!tenantId || !empresaId || !destinatario || !mensagem) {
    return e.json(400, {
      erro: 'Campos obrigatórios ausentes: tenant_id, empresa_id, destinatario, mensagem',
    })
  }

  // 1. Obter usuário de serviço ELLIZA para auditoria
  let ellizaUserId = null
  try {
    const u = app.findAuthRecordByEmail('_pb_users_auth_', 'elliza@rumo.contabil')
    ellizaUserId = u.id
  } catch (_) {
    try {
      const u2 = app.findFirstRecordByData('_pb_users_auth_', 'name', 'ELLIZA Contábil (IA)')
      ellizaUserId = u2.id
    } catch (__) {}
  }

  // 2. Verificação de Diretiva Operacional para disparos automatizados da ELLIZA
  if (origem === 'elliza' || origem === 'agendador') {
    const atividadeAlvo = tipo === 'cobranca' ? 'cobranca' : 'whatsapp_envio'
    let dir = null
    try {
      dir = app.findFirstRecordByFilter(
        'elliza_diretivas',
        `tenant_id = '${tenantId}' && atividade = '${atividadeAlvo}'`,
      )
    } catch (_) {}

    if (dir) {
      const ativo = dir.getBool('ativo')
      const nivel = dir.getString('nivel_autonomia')
      const jIni = dir.getString('janela_inicio')
      const jFim = dir.getString('janela_fim')

      if (!ativo) {
        return e.json(403, {
          erro: `Atividade '${atividadeAlvo}' desativada nas diretivas operacionais da ELLIZA.`,
          status: 'bloqueado_por_diretiva',
        })
      }

      if (nivel === 'somente_leitura') {
        return e.json(403, {
          erro: `Atividade '${atividadeAlvo}' configurada em 'somente_leitura' nas diretivas da ELLIZA.`,
          status: 'bloqueado_por_diretiva',
        })
      }

      if (jIni && jFim) {
        const now = new Date()
        const brHours = (now.getUTCHours() - 3 + 24) % 24
        const horaAtual =
          String(brHours).padStart(2, '0') + ':' + String(now.getUTCMinutes()).padStart(2, '0')
        if (jIni <= jFim && (horaAtual < jIni || horaAtual > jFim)) {
          return e.json(403, {
            erro: `Horário atual fora da janela permitida (${jIni} às ${jFim}).`,
            status: 'bloqueado_por_diretiva',
          })
        }
      }

      if (nivel === 'executar_com_aprovacao') {
        const colAprov = app.findCollectionByNameOrId('elliza_aprovacoes')
        const recAprov = new Record(colAprov)
        recAprov.set('tenant_id', tenantId)
        recAprov.set('atividade', atividadeAlvo)
        recAprov.set('titulo', `Disparo WhatsApp (${tipo}): ${destinatario}`)
        recAprov.set('descricao', `Disparo aguardando liberação humana conforme diretiva.`)
        recAprov.set('entidade_tipo', 'whatsapp_envios')
        recAprov.set('entidade_id', referencia)
        recAprov.set('status', 'pendente')
        recAprov.set('payload_acao', {
          tenant_id: tenantId,
          empresa_id: empresaId,
          tipo,
          referencia,
          destinatario,
          mensagem,
          origem,
        })
        app.save(recAprov)

        return e.json(202, {
          sucesso: false,
          status: 'aguardando_aprovacao',
          aprovacao_id: recAprov.id,
          mensagem:
            'Ação enfileirada na fila de aprovação da ELLIZA (Diretiva: Executar com Aprovação).',
        })
      }
    }
  }

  // 3. Verificar autorização ativa por empresa em whatsapp_notificacoes_autorizadas
  try {
    const autoriz = app.findFirstRecordByFilter(
      'whatsapp_notificacoes_autorizadas',
      `tenant_id = '${tenantId}' && empresa = '${empresaId}'`,
    )
    if (autoriz && !autoriz.getBool('ativo')) {
      return e.json(403, {
        erro: 'Notificações por WhatsApp estão desativadas para esta empresa.',
      })
    }
    if (autoriz) {
      if (tipo === 'aviso' && !autoriz.getBool('permitir_avisos')) {
        return e.json(403, { erro: 'Avisos gerais não autorizados para esta empresa.' })
      }
      if (tipo === 'guia' && !autoriz.getBool('permitir_guias')) {
        return e.json(403, { erro: 'Envio de guias não autorizado para esta empresa.' })
      }
      if (tipo === 'previa' && !autoriz.getBool('permitir_previas')) {
        return e.json(403, { erro: 'Prévias de fechamento não autorizadas para esta empresa.' })
      }
      if (tipo === 'demonstrativo' && !autoriz.getBool('permitir_demonstrativos')) {
        return e.json(403, { erro: 'Demonstrativos não autorizados para esta empresa.' })
      }
      if (tipo === 'cobranca' && !autoriz.getBool('permitir_cobrancas')) {
        return e.json(403, { erro: 'Envio de cobranças não autorizado para esta empresa.' })
      }
    }
  } catch (_) {}

  // 4. Obter configurações da Evolution API em nfse_config
  let evoUrl = ''
  let evoKey = ''
  let evoInstance = ''
  try {
    const cfg = app.findFirstRecordByData('nfse_config', 'tenant_id', tenantId)
    evoUrl = cfg.getString('evolution_api_url')
    evoKey = cfg.getString('evolution_api_key')
    evoInstance = cfg.getString('evolution_instance')
  } catch (_) {}

  // 5. Limpar número de telefone
  let cleanDest = String(destinatario).replace(/\D/g, '')
  if (cleanDest.length === 10 || cleanDest.length === 11) {
    cleanDest = '55' + cleanDest
  }

  // 6. Se credenciais não configuradas, grava em Modo Supervisão
  const enviosCol = app.findCollectionByNameOrId('whatsapp_envios')
  const envioRecord = new Record(enviosCol)
  envioRecord.set('tenant_id', tenantId)
  envioRecord.set('empresa', empresaId)
  envioRecord.set('tipo', tipo)
  envioRecord.set('referencia', referencia)
  envioRecord.set('destinatario', cleanDest)
  envioRecord.set('mensagem', mensagem)
  envioRecord.set('origem', origem)

  if (!evoUrl || !evoKey || !evoInstance) {
    envioRecord.set('status', 'aguardando_credenciais')
    envioRecord.set('erro', 'Evolution API não configurada em nfse_config. Modo Supervisão ativo.')
    envioRecord.set('detalhes_json', {
      aviso:
        'Envio registrado no sistema. Configure a Evolution API para entrega direta ao WhatsApp.',
      timestamp: new Date().toISOString(),
    })
    app.save(envioRecord)

    if (origem === 'elliza' || origem === 'agendador') {
      try {
        const aCol = app.findCollectionByNameOrId('audit_log')
        const aRec = new Record(aCol)
        aRec.set('tenant_id', tenantId)
        if (ellizaUserId) aRec.set('usuario_id', ellizaUserId)
        aRec.set('acao', 'ELLIZA_ENFILEIROU_WHATSAPP')
        aRec.set('entidade_tipo', 'whatsapp_envios')
        aRec.set('entidade_id', envioRecord.id)
        aRec.set(
          'detalhes',
          JSON.stringify({ tipo, destinatario: cleanDest, modo: 'aguardando_credenciais' }),
        )
        app.save(aRec)
      } catch (_) {}
    }

    return e.json(200, {
      sucesso: false,
      status: 'aguardando_credenciais',
      mensagem:
        'Mensagem registrada com sucesso no painel (Modo Supervisão). Para envio real pelo WhatsApp, informe a URL, Token e Instância da Evolution API em Configurações.',
      envio_id: envioRecord.id,
    })
  }

  // 7. Envio real HTTP na Evolution API
  try {
    const endpoint = `${evoUrl.replace(/\/+$/, '')}/message/sendText/${evoInstance}`
    const payload = {
      number: cleanDest,
      text: mensagem,
    }

    const res = $http.send({
      url: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: evoKey,
      },
      data: JSON.stringify(payload),
      timeout: 15,
    })

    if (res.statusCode >= 200 && res.statusCode < 300) {
      envioRecord.set('status', 'enviado')
      envioRecord.set('detalhes_json', {
        response_status: res.statusCode,
        response_body: res.json,
        enviado_em: new Date().toISOString(),
      })
      app.save(envioRecord)

      if (origem === 'elliza' || origem === 'agendador') {
        try {
          const aCol = app.findCollectionByNameOrId('audit_log')
          const aRec = new Record(aCol)
          aRec.set('tenant_id', tenantId)
          if (ellizaUserId) aRec.set('usuario_id', ellizaUserId)
          aRec.set('acao', 'ELLIZA_DISPAROU_WHATSAPP')
          aRec.set('entidade_tipo', 'whatsapp_envios')
          aRec.set('entidade_id', envioRecord.id)
          aRec.set('detalhes', JSON.stringify({ tipo, destinatario: cleanDest, status: 'enviado' }))
          app.save(aRec)
        } catch (_) {}
      }

      return e.json(200, {
        sucesso: true,
        status: 'enviado',
        mensagem: 'Mensagem transmitida via Evolution API com sucesso.',
        envio_id: envioRecord.id,
      })
    } else {
      envioRecord.set('status', 'falhou')
      envioRecord.set('erro', `Evolution API retornou HTTP ${res.statusCode}`)
      app.save(envioRecord)

      return e.json(502, {
        sucesso: false,
        status: 'falhou',
        erro: `Falha ao transmitir para o provedor Evolution API (HTTP ${res.statusCode}).`,
        envio_id: envioRecord.id,
      })
    }
  } catch (err) {
    envioRecord.set('status', 'falhou')
    envioRecord.set('erro', `Erro de conexão: ${String(err)}`)
    app.save(envioRecord)

    return e.json(500, {
      sucesso: false,
      status: 'falhou',
      erro: `Erro interno de conexão: ${String(err)}`,
      envio_id: envioRecord.id,
    })
  }
})

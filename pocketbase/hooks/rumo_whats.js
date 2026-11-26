/// <reference path="../pb_data/types.d.ts" />

/**
 * Rumo Whats — webhook de recebimento + laço de envio (fila) para o conector Node.
 *
 * IMPORTANTE PocketBase JSVM: funções top-level NÃO são visíveis dentro das
 * callbacks de routerAdd — todo o helpers foram movidos para dentro de cada rota.
 *
 * POST /backend/v1/rumo-whats/webhook
 *   - Valida WA_WEBHOOK_TOKEN (header x-rumo-token ou ?token=)
 *   - Grava antes de processar (persiste a mensagem bruta antes de qualquer validação)
 *   - Deduplica pelo wamid
 *   - Atualiza o status da conversa SEM regredir
 *   - Preserva a mensagem apagada no aparelho (mensagem_apagada = true)
 *   - Requer wa_canais com modo "qr" e status "conectado" — sem esse registro descarta.
 *
 * GET /backend/v1/rumo-whats/fila
 *   - Conector lê mensagens com status_envio = "pendente"
 *
 * POST /backend/v1/rumo-whats/fila/{id}/confirmar
 *   - Conector grava o wamid de volta (ou marca falha)
 */

routerAdd('POST', '/backend/v1/rumo-whats/webhook', (e) => {
  const ordem = {
    aberta: 0,
    em_atendimento: 1,
    escalada_humano: 2,
    resolvida_ia: 3,
    encerrada: 4,
  }

  function jidParaTelefone(jid) {
    if (!jid) return ''
    return String(jid)
      .split('@')[0]
      .replace(/[^0-9]/g, '')
  }

  function tokenValido(e) {
    const token = $os.getenv('WA_WEBHOOK_TOKEN') || ''
    if (!token) return false
    const header = e.request.header.get('x-rumo-token') || ''
    const query = e.request.url().query().get('token') || ''
    return header === token || query === token
  }

  function statusNaoRegride(atual, novo) {
    const a = ordem[atual] !== undefined ? ordem[atual] : -1
    const b = ordem[novo] !== undefined ? ordem[novo] : -1
    return b > a
  }

  let gravadoAntes = false

  try {
    const body = e.requestInfo().body || {}

    const convCol = $app.findCollectionByNameOrId('wa_atendimento_conversas')
    const msgCol = $app.findCollectionByNameOrId('wa_atendimento_mensagens')

    // Canal: registro em wa_canais — modo "qr" + status "conectado".
    const canalId = String(body.canal_id || $os.getenv('RUMO_CANAL_ID') || '')
    let canal = null
    if (canalId) {
      try {
        canal = $app.findRecordById('wa_canais', canalId)
      } catch (_) {}
    }
    if (!canal) {
      try {
        canal = $app.findFirstRecordByFilter('wa_canais', "modo = 'qr' && status = 'conectado'", {})
      } catch (_) {}
    }

    const wamid = String(body.wamid || body.message_id || '').trim()
    const remetenteTipo = body.remetente_tipo === 'sistema' ? 'sistema' : 'cliente'
    const conteudo = String(body.conteudo || '').trim()
    const chatJid = String(body.chat_jid || body.jid || '').trim()
    const telefone = jidParaTelefone(chatJid) || String(body.telefone || '').trim()
    const contatoNome = String(body.contato_nome || body.pushname || 'Cliente').trim()
    const apagada = !!body.apagada
    const tenantId = canal ? canal.getString('tenant_id') : ''

    // 1. GRAVA ANTES DE PROCESSAR — persiste a mensagem bruta antes de qualquer validação
    const bruto = new Record(msgCol)
    if (tenantId) bruto.set('tenant_id', tenantId)
    bruto.set('remetente_tipo', remetenteTipo)
    bruto.set('conteudo', conteudo || '[mensagem sem conteúdo]')
    bruto.set('wamid', wamid)
    bruto.set('status_envio', 'recebida')
    bruto.set('mensagem_apagada', apagada)
    bruto.set('citacoes_json', JSON.stringify({ bruto: true, body: body }))
    if (canal) bruto.set('canal', canal.id)
    try {
      $app.save(bruto)
      gravadoAntes = true
    } catch (errBruto) {
      console.log('[RUMO-WHATS] Falha ao gravar bruto antes de processar: ' + errBruto)
    }

    // 2. Token — validado depois do bruto gravado
    if (!tokenValido(e)) {
      return e.unauthorizedError('Token do webhook inválido ou ausente.')
    }

    if (!gravadoAntes) {
      return e.json(500, { error: 'Falha ao gravar mensagem antes de processar.' })
    }

    // 3. Canal obrigatório — sem wa_canais modo qr conectado, descarta (aviso explícito)
    if (!canal) {
      return e.json(422, {
        error:
          'Nenhum canal wa_canais em modo "qr" com status "conectado". Registre o número (RUMO_CANAL_ID) para o webhook aceitar mensagens.',
      })
    }
    if (canal.getString('status') !== 'conectado' || canal.getString('modo') !== 'qr') {
      return e.json(422, {
        error: 'Canal registrado não está com modo "qr" e status "conectado".',
      })
    }
    if (!tenantId) {
      return e.json(422, { error: 'Canal sem tenant_id.' })
    }

    // 4. Deduplicação pelo wamid
    if (wamid) {
      let duplicada = false
      try {
        $app.findFirstRecordByFilter('wa_atendimento_mensagens', 'wamid = {:wamid}', {
          wamid: wamid,
        })
        duplicada = true
      } catch (_) {}
      if (duplicada) {
        try {
          $app.delete(bruto)
        } catch (_) {}
        return e.json(200, { ok: true, deduplicado: true, wamid: wamid })
      }
    }

    // 5. Conversa — busca ou cria pelo telefone (mesmo tenant)
    let conversa = null
    try {
      conversa = $app.findFirstRecordByFilter(
        'wa_atendimento_conversas',
        'tenant_id = {:t} && contato_telefone = {:tel}',
        { t: tenantId, tel: telefone },
      )
    } catch (_) {}

    if (!conversa) {
      conversa = new Record(convCol)
      conversa.set('tenant_id', tenantId)
      conversa.set('contato_nome', contatoNome || 'Cliente')
      conversa.set('contato_telefone', telefone)
      conversa.set('origem_chat_jid', chatJid)
      conversa.set('status', 'aberta')
      conversa.set('total_mensagens', 0)
      conversa.set('total_respostas_ia', 0)
      conversa.set('total_respostas_humano', 0)
      try {
        $app.save(conversa)
      } catch (errConv) {
        console.log('[RUMO-WHATS] Falha ao criar conversa: ' + errConv)
        return e.json(500, { error: 'Falha ao criar conversa.' })
      }
    }

    // 6. Mensagem definitiva vinculada à conversa
    const mensagem = new Record(msgCol)
    mensagem.set('tenant_id', tenantId)
    mensagem.set('conversa', conversa.id)
    mensagem.set('remetente_tipo', remetenteTipo)
    mensagem.set('conteudo', apagada ? '[mensagem apagada no aparelho]' : conteudo)
    mensagem.set('wamid', wamid)
    mensagem.set('status_envio', 'recebida')
    mensagem.set('mensagem_apagada', apagada)
    if (canal) mensagem.set('canal', canal.id)
    if (body.citacoes) {
      mensagem.set('citacoes_json', JSON.stringify(body.citacoes))
    }
    try {
      $app.save(mensagem)
    } catch (errMsg) {
      console.log('[RUMO-WHATS] Falha ao gravar mensagem: ' + errMsg)
      return e.json(500, { error: 'Falha ao gravar mensagem.' })
    }

    // 7. Atualiza a conversa — status nunca regredi
    conversa.set(
      'ultima_mensagem',
      apagada ? '[mensagem apagada no aparelho]' : conteudo.slice(0, 200),
    )
    conversa.set('ultima_interacao', new Date().toISOString())
    conversa.set('total_mensagens', (conversa.getInt('total_mensagens') || 0) + 1)
    if (remetenteTipo === 'sistema') {
      conversa.set('total_respostas_ia', (conversa.getInt('total_respostas_ia') || 0) + 1)
    }
    const statusNovo = String(body.novo_status || 'aberta')
    const statusAtual = conversa.getString('status') || 'aberta'
    if (statusNaoRegride(statusAtual, statusNovo)) {
      conversa.set('status', statusNovo)
    }
    try {
      $app.save(conversa)
    } catch (errConvUpd) {
      console.log('[RUMO-WHATS] Falha ao atualizar conversa: ' + errConvUpd)
    }

    return e.json(200, {
      ok: true,
      deduplicado: false,
      conversa_id: conversa.id,
      mensagem_id: mensagem.id,
    })
  } catch (err) {
    console.log('[RUMO-WHATS] Erro no webhook: ' + err)
    return e.json(500, { error: (err && err.message) || 'Erro no webhook Rumo Whats' })
  }
})

// ---------------------------------------------------------------------------
// Laço de envio: fila lida pelo conector Node
// ---------------------------------------------------------------------------
routerAdd('GET', '/backend/v1/rumo-whats/fila', (e) => {
  function tokenValido(e) {
    const token = $os.getenv('WA_WEBHOOK_TOKEN') || ''
    if (!token) return false
    const header = e.request.header.get('x-rumo-token') || ''
    const query = e.request.url().query().get('token') || ''
    return header === token || query === token
  }

  try {
    if (!tokenValido(e)) {
      return e.unauthorizedError('Token inválido.')
    }
    const registros = $app.findRecordsByFilter(
      'wa_atendimento_mensagens',
      "status_envio = 'pendente'",
      'created',
      50,
      0,
    )
    const itens = []
    for (const r of registros) {
      let conv = null
      try {
        conv = $app.findRecordById('wa_atendimento_conversas', r.getString('conversa'))
      } catch (_) {}
      if (!conv) continue
      let destino = conv.getString('origem_chat_jid') || conv.getString('contato_telefone')
      if (destino && !destino.includes('@')) destino = destino + '@s.whatsapp.net'
      itens.push({
        id: r.id,
        conversa_id: conv.id,
        destino_jid: destino,
        conteudo: r.getString('conteudo'),
      })
    }
    return e.json(200, { itens: itens })
  } catch (err) {
    console.log('[RUMO-WHATS] Erro na fila: ' + err)
    return e.json(500, { error: (err && err.message) || 'Erro ao listar fila de envio' })
  }
})

routerAdd('POST', '/backend/v1/rumo-whats/fila/{id}/confirmar', (e) => {
  function tokenValido(e) {
    const token = $os.getenv('WA_WEBHOOK_TOKEN') || ''
    if (!token) return false
    const header = e.request.header.get('x-rumo-token') || ''
    const query = e.request.url().query().get('token') || ''
    return header === token || query === token
  }

  try {
    if (!tokenValido(e)) {
      return e.unauthorizedError('Token inválido.')
    }
    const id = e.request.pathValue('id')
    const body = e.requestInfo().body || {}
    const msg = $app.findRecordById('wa_atendimento_mensagens', id)
    if (body.sucesso === false) {
      msg.set('status_envio', 'falha')
      if (body.erro) msg.set('citacoes_json', JSON.stringify({ erro_envio: body.erro }))
    } else {
      msg.set('status_envio', 'enviada')
      if (body.wamid) msg.set('wamid', body.wamid)
    }
    $app.save(msg)
    return e.json(200, { ok: true, id: id, status_envio: msg.getString('status_envio') })
  } catch (err) {
    console.log('[RUMO-WHATS] Erro ao confirmar envio: ' + err)
    return e.json(500, { error: (err && err.message) || 'Erro ao confirmar envio' })
  }
})

/// <reference path="../pb_data/types.d.ts" />

/**
 * Webhook Evolution API para Emissão Inteligente de NFS-e (Etapas 1, 2, 3 e 8)
 * Rota pública protegida por token de tenant: /api/nfse/webhook/{token}
 */
routerAdd('POST', '/backend/v1/nfse/webhook/{token}', (e) => {
  try {
    const token = e.request.pathValue('token')
    if (!token) {
      return e.json(400, { error: 'Token de webhook obrigatório' })
    }

    // 1. Localizar configuração do tenant pelo token
    let configRec = null
    try {
      configRec = $app.findFirstRecordByData('nfse_config', 'webhook_token', token)
    } catch (_) {
      return e.json(404, { error: 'Webhook não configurado ou token inválido' })
    }

    if (!configRec.getBool('ativo')) {
      return e.json(403, {
        error: 'Canal de emissão de NFS-e via WhatsApp desativado neste tenant',
      })
    }

    const tenantId = configRec.getString('tenant_id')
    const empresaPadraoId = configRec.getString('empresa_padrao')

    // 2. Extrair payload da Evolution API ou Baileys
    const body = e.requestInfo().body || {}

    // Formatos comuns da Evolution API:
    // data.message.conversation OU data.message.extendedTextMessage.text
    // data.key.remoteJid (ex: 5511999999999@s.whatsapp.net)
    // data.pushName (ex: Carlos Silva)
    let textoMensagem = ''
    let remoteJid = ''
    let pushName = ''
    let messageId = ''

    if (body.data) {
      const d = body.data
      remoteJid = (d.key && d.key.remoteJid) || ''
      messageId = (d.key && d.key.id) || ''
      pushName = d.pushName || ''

      if (d.message) {
        if (typeof d.message === 'string') {
          textoMensagem = d.message
        } else if (d.message.conversation) {
          textoMensagem = d.message.conversation
        } else if (d.message.extendedTextMessage && d.message.extendedTextMessage.text) {
          textoMensagem = d.message.extendedTextMessage.text
        }
      }
    } else if (body.message && typeof body.message === 'string') {
      // Formato simplificado direto
      textoMensagem = body.message
      remoteJid = body.remoteJid || body.telefone || ''
      pushName = body.nome || ''
      messageId = body.messageId || ''
    } else if (body.text) {
      textoMensagem = body.text
      remoteJid = body.from || body.phone || ''
      pushName = body.senderName || ''
      messageId = body.id || ''
    }

    textoMensagem = (textoMensagem || '').trim()
    if (!textoMensagem) {
      return e.json(200, { status: 'ignorado', motivo: 'Mensagem vazia ou sem texto legível' })
    }

    // Se for mensagem de status ou disparada pelo próprio bot (fromMe), ignorar
    if (body.data && body.data.key && body.data.key.fromMe) {
      return e.json(200, { status: 'ignorado', motivo: 'Mensagem enviada pelo próprio bot' })
    }

    const telefoneLimpo = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '')

    // 3. MOTOR COGNITIVO DETERMINÍSTICO (ETAPA 2)
    // Funções de validação e extração embutidas inline:

    // Validação de CNPJ
    const validarCnpj = (cnpjStr) => {
      const clean = cnpjStr.replace(/\D/g, '')
      if (clean.length !== 14) return false
      if (/^(\d)\1{13}$/.test(clean)) return false
      let size = clean.length - 2
      let numbers = clean.substring(0, size)
      const digits = clean.substring(size)
      let sum = 0
      let pos = size - 7
      for (let i = size; i >= 1; i--) {
        sum += parseInt(numbers.charAt(size - i), 10) * pos--
        if (pos < 2) pos = 9
      }
      let result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
      if (result !== parseInt(digits.charAt(0), 10)) return false
      size = size + 1
      numbers = clean.substring(0, size)
      sum = 0
      pos = size - 7
      for (let i = size; i >= 1; i--) {
        sum += parseInt(numbers.charAt(size - i), 10) * pos--
        if (pos < 2) pos = 9
      }
      result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
      return result === parseInt(digits.charAt(1), 10)
    }

    // Validação de CPF
    const validarCpf = (cpfStr) => {
      const clean = cpfStr.replace(/\D/g, '')
      if (clean.length !== 11) return false
      if (/^(\d)\1{10}$/.test(clean)) return false
      let sum = 0
      for (let i = 0; i < 9; i++) {
        sum += parseInt(clean.charAt(i), 10) * (10 - i)
      }
      let rev = 11 - (sum % 11)
      if (rev === 10 || rev === 11) rev = 0
      if (rev !== parseInt(clean.charAt(9), 10)) return false
      sum = 0
      for (let i = 0; i < 10; i++) {
        sum += parseInt(clean.charAt(i), 10) * (11 - i)
      }
      rev = 11 - (sum % 11)
      if (rev === 10 || rev === 11) rev = 0
      return rev === parseInt(clean.charAt(10), 10)
    }

    // Extrair CNPJ
    let tomadorDocumento = ''
    let tipoDocumento = ''
    let documentoValido = false

    const cnpjMatch = textoMensagem.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/)
    if (cnpjMatch) {
      tomadorDocumento = cnpjMatch[0]
      tipoDocumento = 'CNPJ'
      documentoValido = validarCnpj(tomadorDocumento)
    } else {
      const cpfMatch = textoMensagem.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/)
      if (cpfMatch) {
        tomadorDocumento = cpfMatch[0]
        tipoDocumento = 'CPF'
        documentoValido = validarCpf(tomadorDocumento)
      }
    }

    // Extrair E-mail
    let tomadorEmail = ''
    const emailMatch = textoMensagem.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
    if (emailMatch) {
      tomadorEmail = emailMatch[0].toLowerCase()
    }

    // Extrair Valor em R$
    let valorServico = 0
    const valorReaisMatch = textoMensagem.match(
      /R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})|[0-9]+(?:,[0-9]{2})?)/i,
    )
    if (valorReaisMatch) {
      const valStr = valorReaisMatch[1].replace(/\./g, '').replace(',', '.')
      valorServico = parseFloat(valStr) || 0
    } else {
      // Tentar padrão numérico isolado com "reais"
      const valNumReaisMatch = textoMensagem.match(/(\d+(?:\.\d{3})*(?:,\d{2})?)\s*reais/i)
      if (valNumReaisMatch) {
        const valStr = valNumReaisMatch[1].replace(/\./g, '').replace(',', '.')
        valorServico = parseFloat(valStr) || 0
      } else if (/mil\s+e\s+quinhentos/i.test(textoMensagem)) {
        valorServico = 1500.0
      } else if (/dois\s+mil/i.test(textoMensagem)) {
        valorServico = 2000.0
      } else if (/três\s+mil/i.test(textoMensagem) || /tres\s+mil/i.test(textoMensagem)) {
        valorServico = 3000.0
      }
    }

    // Extrair Código de Serviço (ex: 01.07, 1.07, 01.06, 14.01)
    let codigoServico = ''
    const codMatch = textoMensagem.match(
      /\b(?:código|item|lc|serviço)?\s*([0-9]{1,2}\.[0-9]{2})\b/i,
    )
    if (codMatch) {
      codigoServico = codMatch[1]
    } else {
      codigoServico = '01.07' // Padrão desenvolvimento de sistemas / assessoria
    }

    // Extrair Tomador (Razão Social / Nome)
    let tomadorNome = ''
    const tomadorMatch = textoMensagem.match(
      /(?:para\s+(?:o\s+cliente\s+|a\s+empresa\s+|a\s+|o\s+)?|tomador:\s*|cliente:\s*)([A-Z0-9\s&.\-–]+?)(?:,|\.|\bCNPJ\b|\bCPF\b|\bno\s+valor\b|\bvalor\b|\bserviço\b|\bserviços\b|$)/i,
    )
    if (tomadorMatch && tomadorMatch[1]) {
      tomadorNome = tomadorMatch[1].trim()
      // Limpeza de palavras espúrias
      tomadorNome = tomadorNome.replace(/^(a\s+|o\s+|empresa\s+|cliente\s+)/i, '').trim()
    }

    if (!tomadorNome && pushName) {
      tomadorNome = pushName
    }

    // Extrair Descrição dos Serviços
    let descricaoServico = ''
    const descMatch = textoMensagem.match(
      /(?:serviço\s+de\s+|serviços\s+de\s+|referente\s+a(?:os)?\s+|descrição:\s*)(.+?)(?:,|\.|\bvalor\b|\bno\s+valor\b|\bpara\b|\bE-mail\b|$)/i,
    )
    if (descMatch && descMatch[1]) {
      descricaoServico = descMatch[1].trim()
    } else {
      descricaoServico = 'Prestação de serviços técnicos especializados de consultoria e suporte.'
    }

    // Montar Alertas
    const alertas = []
    let score = 100

    if (!tomadorDocumento) {
      alertas.push({
        campo: 'tomador_documento',
        tipo: 'campo_ausente',
        mensagem: 'CPF ou CNPJ do tomador não foi identificado na mensagem.',
        severidade: 'bloqueante',
      })
      score -= 30
    } else if (!documentoValido) {
      alertas.push({
        campo: 'tomador_documento',
        tipo: 'erro_validacao',
        mensagem:
          tipoDocumento +
          ' ' +
          tomadorDocumento +
          ' possui dígito verificador inválido pela Receita Federal.',
        severidade: 'bloqueante',
      })
      score -= 35
    }

    if (!valorServico || valorServico <= 0) {
      alertas.push({
        campo: 'valor_servico',
        tipo: 'campo_ausente',
        mensagem: 'Valor do serviço não identificado ou zerado.',
        severidade: 'bloqueante',
      })
      score -= 30
    }

    if (!tomadorNome || tomadorNome.length < 3) {
      alertas.push({
        campo: 'tomador_nome',
        tipo: 'campo_ausente',
        mensagem: 'Nome ou Razão Social do tomador não claramente identificado.',
        severidade: 'atencao',
      })
      score -= 15
    }

    if (!tomadorEmail) {
      alertas.push({
        campo: 'tomador_email',
        tipo: 'campo_ausente',
        mensagem: 'E-mail do tomador ausente (necessário para envio de DANFSE).',
        severidade: 'atencao',
      })
      score -= 10
    }

    if (score < 10) score = 10

    // 4. Salvar Solicitação na Fila de Supervisão (nfse_solicitacoes)
    const solCol = $app.findCollectionByNameOrId('nfse_solicitacoes')
    const solicitacao = new Record(solCol)
    solicitacao.set('tenant_id', tenantId)
    if (empresaPadraoId) solicitacao.set('empresa', empresaPadraoId)
    solicitacao.set('contato_nome', pushName || 'Contato WhatsApp')
    solicitacao.set('contato_telefone', telefoneLimpo || remoteJid)
    solicitacao.set('origem_chat_jid', remoteJid)
    solicitacao.set('mensagem_original', textoMensagem)
    solicitacao.set('mensagem_id_externo', messageId || 'msg_' + $security.randomString(12))
    solicitacao.set('status', 'em_analise')
    solicitacao.set('score_confianca', score)
    solicitacao.set('tomador_nome', tomadorNome)
    solicitacao.set('tomador_documento', tomadorDocumento)
    solicitacao.set('tomador_email', tomadorEmail)
    solicitacao.set('descricao_servico', descricaoServico)
    solicitacao.set('valor_servico', valorServico)
    solicitacao.set('codigo_servico', codigoServico)
    solicitacao.set('dados_extraidos_json', {
      tomador_nome: tomadorNome,
      tomador_documento: tomadorDocumento,
      tipo_documento: tipoDocumento,
      documento_valido: documentoValido,
      valor_servico: valorServico,
      descricao_servico: descricaoServico,
      codigo_servico: codigoServico,
      tomador_email: tomadorEmail,
    })
    solicitacao.set('alertas_json', alertas)

    const agora = new Date().toISOString()
    const msgRecebimentoTexto =
      configRec.getString('msg_recebimento') ||
      'Recebi seus dados com sucesso! 📝 Sua solicitação de NFS-e foi estruturada pela nossa IA e está na fila do Painel de Supervisão para conferência do contador responsável. Você receberá o PDF/XML assim que aprovada.'

    solicitacao.set('historico_mensagens_json', [
      {
        origem: 'cliente',
        texto: textoMensagem,
        data: agora,
      },
      {
        origem: 'bot',
        texto: msgRecebimentoTexto,
        data: agora,
      },
    ])
    solicitacao.set('resposta_enviada_whatsapp', true)
    $app.save(solicitacao)

    // 5. Criar notificação no sino para a equipe contábil do tenant
    try {
      const notifCol = $app.findCollectionByNameOrId('notificacoes')
      const notif = new Record(notifCol)
      notif.set('tenant_id', tenantId)
      notif.set(
        'titulo',
        'Nova solicitação de NFS-e via WhatsApp (' + (pushName || telefoneLimpo) + ')',
      )
      notif.set(
        'mensagem',
        'Solicitação de emissão de NFS-e recebida via WhatsApp para ' +
          (tomadorNome || 'Tomador') +
          ' no valor de R$ ' +
          valorServico.toFixed(2) +
          '. Score IA: ' +
          score +
          '%. Aguardando supervisão.',
      )
      notif.set('tipo', 'sistema')
      notif.set('link', '/nfse-whatsapp')
      notif.set('lida', false)
      $app.save(notif)
    } catch (errNotif) {
      console.log('[NFSE-WEBHOOK] Erro ao criar notificação:', errNotif)
    }

    // 6. Resposta de volta ao WhatsApp (Etapa 8 - Ponto de extensão Evolution API)
    // Se a Evolution API estiver configurada com URL e Key, despachar HTTP POST para sendMessage
    let evoUrl = configRec.getString('evolution_api_url')
    const evoKey = configRec.getString('evolution_api_key')
    const evoInstance = configRec.getString('evolution_instance')
    let respostaHttp = null

    if (evoUrl && evoKey && evoInstance && remoteJid) {
      if (evoUrl.endsWith('/')) evoUrl = evoUrl.slice(0, -1)
      try {
        const sendEndpoint = evoUrl + '/message/sendText/' + evoInstance
        respostaHttp = $http.send({
          url: sendEndpoint,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: evoKey,
          },
          body: JSON.stringify({
            number: remoteJid,
            text: msgRecebimentoTexto,
            options: {
              delay: 1200,
              presence: 'composing',
            },
          }),
          timeout: 10,
        })
        console.log('[NFSE-WEBHOOK] Resposta enviada à Evolution API:', sendEndpoint)
      } catch (errEvo) {
        console.log('[NFSE-WEBHOOK] Fallback gracioso: Evolution API offline ou simulada:', errEvo)
      }
    }

    return e.json(200, {
      status: 'sucesso',
      solicitacao_id: solicitacao.id,
      score_confianca: score,
      alertas_count: alertas.length,
      resposta_simulada_ou_enviada: msgRecebimentoTexto,
      evolution_dispatch: respostaHttp ? 'enviado' : 'simulado_sem_servidor',
    })
  } catch (errGlobal) {
    console.log('[NFSE-WEBHOOK] Erro interno:', errGlobal)
    return e.json(500, { error: errGlobal.message || 'Erro interno ao processar webhook' })
  }
})

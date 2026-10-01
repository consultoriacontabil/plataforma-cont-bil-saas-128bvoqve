/// <reference path="../pb_data/types.d.ts" />

/**
 * Webhook Evolution API para Emissão Inteligente de NFS-e e Atendimento IA via WhatsApp
 * Rota pública protegida por token de tenant: /backend/v1/nfse/webhook/{token}
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
        error: 'Canal de atendimento e NFS-e via WhatsApp desativado neste tenant',
      })
    }

    const tenantId = configRec.getString('tenant_id')
    const empresaPadraoId = configRec.getString('empresa_padrao')
    const iaAtiva = configRec.getBool('ia_ativa')
    const iaModoOperacao = configRec.getString('ia_modo_operacao') || 'supervisionado' // supervisionado | autonomo_duvidas
    const iaMsgBoasVindas = configRec.getString('ia_mensagem_boas_vindas')
    const iaHoraInicio = configRec.getString('ia_horario_inicio') || '08:30'
    const iaHoraFim = configRec.getString('ia_horario_fim') || '18:00'
    const iaMsgForaHorario = configRec.getString('ia_mensagem_fora_horario')

    // 2. Detectar se é Webhook NFE.io
    // NFE.io envia header X-Hook-Event: service_invoice e body { action: "issued_successfully" | "issued_failed" | "cancelled", ... }
    const headers = e.requestInfo().headers || {}
    const hookEvent = headers['x-hook-event'] || headers['X-Hook-Event'] || ''
    const body = e.requestInfo().body || {}

    if (hookEvent === 'service_invoice' || body.action || body.serviceInvoice) {
      // PROCESSAMENTO DE WEBHOOK NFE.IO
      const action = body.action || (body.serviceInvoice && body.serviceInvoice.status) || ''
      const invoice = body.serviceInvoice || body.data || body

      const invoiceId = invoice.id || body.id || ''
      const numeroNota = invoice.number || body.number || 0
      const checkCode = invoice.checkCode || body.checkCode || ''
      const flowStatus = invoice.flowStatus || invoice.status || ''
      const companyId = invoice.companyId || body.companyId || ''
      const errorMessage =
        invoice.errorMessage ||
        (invoice.flowMessage && invoice.flowMessage.message) ||
        body.errorMessage ||
        ''

      console.log(
        `[NFEIO-WEBHOOK] Ação: ${action}, Invoice: ${invoiceId}, Número: ${numeroNota}, Status: ${flowStatus}`,
      )

      // 2.1. Localizar nota fiscal emitida vinculada ou solicitação
      let notaRec = null
      try {
        if (invoiceId) {
          const notas = $app.findRecordsByFilter(
            'nfse_notas_emitidas',
            `tenant_id = "${tenantId}" && (chave_acesso = "${invoiceId}" || protocolo_autorizacao = "${invoiceId}")`,
            '-created',
            1,
            0,
          )
          if (notas.length > 0) notaRec = notas[0]
        }
      } catch (_) {}

      let solicitacaoRec = null
      if (notaRec) {
        const solId = notaRec.getString('solicitacao')
        if (solId) {
          try {
            solicitacaoRec = $app.findCollectionByNameOrId('nfse_solicitacoes').getRecord(solId)
          } catch (_) {}
        }
      }

      const empresaIdNota = (notaRec && notaRec.getString('empresa')) || empresaPadraoId

      // 2.2. issued_successfully: nota vira emitida, grava XML/PDF no GED (documentos), audit_log
      if (
        action === 'issued_successfully' ||
        flowStatus === 'Issued' ||
        action === 'IssuedSuccessfully'
      ) {
        if (notaRec) {
          notaRec.set('status', 'emitida')
          if (numeroNota) notaRec.set('numero_nota', Number(numeroNota))
          if (checkCode) notaRec.set('codigo_verificacao', checkCode)
          if (invoice.xml) notaRec.set('xml_conteudo', invoice.xml)
          if (invoice.uri) notaRec.set('url_consulta_nfse', invoice.uri)

          // Inserir ou atualizar documento no GED da empresa
          try {
            const docsCol = $app.findCollectionByNameOrId('documentos')
            const docGed = new Record(docsCol)
            docGed.set('tenant_id', tenantId)
            if (empresaIdNota) docGed.set('empresa_id', empresaIdNota)
            docGed.set(
              'nome_arquivo',
              `NFS-e_${numeroNota || notaRec.getInt('numero_nota')}_NFEIO.xml`,
            )
            docGed.set('tipo', 'nota_fiscal')
            docGed.set('status', 'processado')
            docGed.set('origem_documento', 'sistema')
            docGed.set(
              'observacoes',
              `NFS-e autorizada via NFE.io. Cód. Verificação: ${checkCode || notaRec.getString('codigo_verificacao')}. Ref ID: ${invoiceId}`,
            )
            $app.save(docGed)

            notaRec.set('ged_documento_id', docGed.id)
          } catch (errGed) {
            console.log('[NFEIO-WEBHOOK] Erro ao gravar GED:', errGed)
          }

          $app.save(notaRec)
        }

        if (solicitacaoRec) {
          solicitacaoRec.set('status', 'emitida')
          $app.save(solicitacaoRec)
        }

        // Registrar no audit_log
        try {
          const auditCol = $app.findCollectionByNameOrId('audit_log')
          const audit = new Record(auditCol)
          audit.set('tenant_id', tenantId)
          audit.set('acao', 'NFSE_EMITIDA_NFEIO_WEBHOOK')
          audit.set('entidade_tipo', 'nfse_notas_emitidas')
          audit.set('entidade_id', notaRec ? notaRec.id : invoiceId)
          audit.set(
            'detalhes',
            JSON.stringify({
              action,
              numero_nota: numeroNota,
              codigo_verificacao: checkCode,
              empresa_id: empresaIdNota,
              invoice_id: invoiceId,
            }),
          )
          $app.save(audit)
        } catch (_) {}

        return e.json(200, {
          status: 'processado',
          action: 'issued_successfully',
          nota_id: notaRec ? notaRec.id : null,
        })
      }

      // 2.3. issued_failed: vira erro_emissao com mensagem
      if (action === 'issued_failed' || flowStatus === 'Failed' || action === 'IssuedFailed') {
        if (notaRec) {
          notaRec.set('status', 'erro_emissao')
          $app.save(notaRec)
        }

        if (solicitacaoRec) {
          solicitacaoRec.set('status', 'erro_emissao')
          solicitacaoRec.set(
            'ultimo_erro_emissao',
            errorMessage || 'Rejeição informada pela NFE.io',
          )
          $app.save(solicitacaoRec)
        }

        try {
          const auditCol = $app.findCollectionByNameOrId('audit_log')
          const audit = new Record(auditCol)
          audit.set('tenant_id', tenantId)
          audit.set('acao', 'NFSE_ERRO_EMISSAO_NFEIO_WEBHOOK')
          audit.set('entidade_tipo', 'nfse_notas_emitidas')
          audit.set('entidade_id', notaRec ? notaRec.id : invoiceId)
          audit.set(
            'detalhes',
            JSON.stringify({
              action,
              erro: errorMessage,
              empresa_id: empresaIdNota,
              invoice_id: invoiceId,
            }),
          )
          $app.save(audit)
        } catch (_) {}

        return e.json(200, {
          status: 'processado',
          action: 'issued_failed',
          mensagem: errorMessage,
        })
      }

      // 2.4. cancelled: cancelada
      if (action === 'cancelled' || flowStatus === 'Cancelled' || action === 'Cancelled') {
        if (notaRec) {
          notaRec.set('status', 'cancelada')
          notaRec.set('data_cancelamento', new Date().toISOString())
          notaRec.set(
            'motivo_cancelamento',
            errorMessage || 'Cancelamento processado via NFE.io Webhook',
          )
          $app.save(notaRec)
        }

        try {
          const auditCol = $app.findCollectionByNameOrId('audit_log')
          const audit = new Record(auditCol)
          audit.set('tenant_id', tenantId)
          audit.set('acao', 'NFSE_CANCELADA_NFEIO_WEBHOOK')
          audit.set('entidade_tipo', 'nfse_notas_emitidas')
          audit.set('entidade_id', notaRec ? notaRec.id : invoiceId)
          audit.set(
            'detalhes',
            JSON.stringify({
              action,
              invoice_id: invoiceId,
            }),
          )
          $app.save(audit)
        } catch (_) {}

        return e.json(200, {
          status: 'processado',
          action: 'cancelled',
          nota_id: notaRec ? notaRec.id : null,
        })
      }

      return e.json(200, {
        status: 'ignorado',
        motivo: `Ação ${action} não mapeada para alteração de estado`,
      })
    }

    // 2. Extrair payload da Evolution API ou Baileys

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

    // Se for mensagem disparada pelo próprio bot (fromMe), ignorar
    if (body.data && body.data.key && body.data.key.fromMe) {
      return e.json(200, { status: 'ignorado', motivo: 'Mensagem enviada pelo próprio bot' })
    }

    const telefoneLimpo = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '')

    // Identificar empresa pelo telefone ou manter empresa padrão
    let empresaIdIdentificada = empresaPadraoId
    try {
      const empresas = $app.findRecordsByFilter(
        'empresas',
        'tenant_id = "' + tenantId + '" && status = "ativo"',
        '-created',
        50,
        0,
      )
      for (const emp of empresas) {
        const empTel = (emp.getString('telefone') || '').replace(/\D/g, '')
        if (
          empTel &&
          telefoneLimpo &&
          (empTel.includes(telefoneLimpo) || telefoneLimpo.includes(empTel))
        ) {
          empresaIdIdentificada = emp.id
          break
        }
      }
    } catch (_) {}

    // Obter ou criar registro de conversa (wa_atendimento_conversas)
    const convCol = $app.findCollectionByNameOrId('wa_atendimento_conversas')
    const msgCol = $app.findCollectionByNameOrId('wa_atendimento_mensagens')
    let conversaRec = null

    try {
      const existingConvs = $app.findRecordsByFilter(
        'wa_atendimento_conversas',
        'tenant_id = "' +
          tenantId +
          '" && contato_telefone = "' +
          (telefoneLimpo || remoteJid) +
          '"',
        '-updated',
        1,
        0,
      )
      if (existingConvs.length > 0) {
        conversaRec = existingConvs[0]
      }
    } catch (_) {}

    if (!conversaRec) {
      conversaRec = new Record(convCol)
      conversaRec.set('tenant_id', tenantId)
      if (empresaIdIdentificada) conversaRec.set('empresa', empresaIdIdentificada)
      conversaRec.set('contato_nome', pushName || 'Cliente WhatsApp')
      conversaRec.set('contato_telefone', telefoneLimpo || remoteJid)
      conversaRec.set('origem_chat_jid', remoteJid)
      conversaRec.set('status', 'aberta')
      conversaRec.set('total_mensagens', 0)
      conversaRec.set('total_respostas_ia', 0)
      conversaRec.set('total_respostas_humano', 0)
    }

    conversaRec.set(
      'ultima_mensagem',
      textoMensagem.length > 250 ? textoMensagem.slice(0, 250) + '...' : textoMensagem,
    )
    conversaRec.set('ultima_interacao', new Date().toISOString())
    conversaRec.set('total_mensagens', (conversaRec.getInt('total_mensagens') || 0) + 1)
    $app.save(conversaRec)

    // Registrar mensagem do cliente (wa_atendimento_mensagens)
    const msgCliente = new Record(msgCol)
    msgCliente.set('tenant_id', tenantId)
    msgCliente.set('conversa', conversaRec.id)
    msgCliente.set('remetente_tipo', 'cliente')
    msgCliente.set('conteudo', textoMensagem)
    msgCliente.set('status_envio', 'enviada')
    msgCliente.set('mensagem_id_externo', messageId || '')
    $app.save(msgCliente)

    // Helper: Enviar resposta via Evolution API se configurada
    const despacharWhatsapp = (textoParaEnviar) => {
      let evoUrl = configRec.getString('evolution_api_url')
      const evoKey = configRec.getString('evolution_api_key')
      const evoInstance = configRec.getString('evolution_instance')
      let destinatario = remoteJid
      if (!destinatario || !destinatario.includes('@')) {
        if (telefoneLimpo) destinatario = telefoneLimpo + '@s.whatsapp.net'
      }

      if (evoUrl && evoKey && evoInstance && destinatario) {
        if (evoUrl.endsWith('/')) evoUrl = evoUrl.slice(0, -1)
        try {
          const sendEndpoint = evoUrl + '/message/sendText/' + encodeURIComponent(evoInstance)
          $http.send({
            url: sendEndpoint,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: evoKey,
            },
            body: JSON.stringify({
              number: destinatario,
              text: textoParaEnviar,
              options: { delay: 1000, presence: 'composing' },
            }),
            timeout: 12,
          })
          return 'enviado_real'
        } catch (errEvo) {
          console.log('[NFSE-WEBHOOK] Fallback gracioso: Evolution API offline:', errEvo)
        }
      }
      return 'simulado_sem_servidor'
    }

    // 3. DETECTAR SE É ATO FISCAL (PEDIDO DE EMISSÃO DE NFS-E OU AÇÃO FISCAL)
    const ehPedidoNfse =
      /emitir\s+(?:uma\s+)?(?:nota|nf|nfs-?e)|emiss[aã]o\s+de\s+(?:nota|nfs-?e)|gerar\s+(?:uma\s+)?(?:nota|nf|nfs-?e)|faturar|solicito\s+nota/i.test(
        textoMensagem,
      ) ||
      (/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/.test(textoMensagem) &&
        /R\$\s*\d+|\breais\b|\bserviço\b/i.test(textoMensagem))

    if (ehPedidoNfse) {
      // MOTOR COGNITIVO DETERMINÍSTICO DE NFS-E (Reaproveitamento integral da infraestrutura)
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

      const validarCpf = (cpfStr) => {
        const clean = cpfStr.replace(/\D/g, '')
        if (clean.length !== 11) return false
        if (/^(\d)\1{10}$/.test(clean)) return false
        let sum = 0
        for (let i = 0; i < 9; i++) sum += parseInt(clean.charAt(i), 10) * (10 - i)
        let rev = 11 - (sum % 11)
        if (rev === 10 || rev === 11) rev = 0
        if (rev !== parseInt(clean.charAt(9), 10)) return false
        sum = 0
        for (let i = 0; i < 10; i++) sum += parseInt(clean.charAt(i), 10) * (11 - i)
        rev = 11 - (sum % 11)
        if (rev === 10 || rev === 11) rev = 0
        return rev === parseInt(clean.charAt(10), 10)
      }

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

      let tomadorEmail = ''
      const emailMatch = textoMensagem.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
      if (emailMatch) tomadorEmail = emailMatch[0].toLowerCase()

      let valorServico = 0
      const valorReaisMatch = textoMensagem.match(
        /R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})|[0-9]+(?:,[0-9]{2})?)/i,
      )
      if (valorReaisMatch) {
        const valStr = valorReaisMatch[1].replace(/\./g, '').replace(',', '.')
        valorServico = parseFloat(valStr) || 0
      } else {
        const valNumReaisMatch = textoMensagem.match(/(\d+(?:\.\d{3})*(?:,\d{2})?)\s*reais/i)
        if (valNumReaisMatch) {
          const valStr = valNumReaisMatch[1].replace(/\./g, '').replace(',', '.')
          valorServico = parseFloat(valStr) || 0
        } else if (/mil\s+e\s+quinhentos/i.test(textoMensagem)) {
          valorServico = 1500.0
        } else if (/dois\s+mil/i.test(textoMensagem)) {
          valorServico = 2000.0
        } else if (/três\s+mil|tres\s+mil/i.test(textoMensagem)) {
          valorServico = 3000.0
        }
      }

      let codigoServico = '01.07'
      const codMatch = textoMensagem.match(
        /\b(?:código|item|lc|serviço)?\s*([0-9]{1,2}\.[0-9]{2})\b/i,
      )
      if (codMatch) codigoServico = codMatch[1]

      let tomadorNome = ''
      const tomadorMatch = textoMensagem.match(
        /(?:para\s+(?:o\s+cliente\s+|a\s+empresa\s+|a\s+|o\s+)?|tomador:\s*|cliente:\s*)([A-Z0-9\s&.\-–]+?)(?:,|\.|\bCNPJ\b|\bCPF\b|\bno\s+valor\b|\bvalor\b|\bserviço\b|\bserviços\b|$)/i,
      )
      if (tomadorMatch && tomadorMatch[1]) {
        tomadorNome = tomadorMatch[1]
          .trim()
          .replace(/^(a\s+|o\s+|empresa\s+|cliente\s+)/i, '')
          .trim()
      }
      if (!tomadorNome && pushName) tomadorNome = pushName

      let descricaoServico = ''
      const descMatch = textoMensagem.match(
        /(?:serviço\s+de\s+|serviços\s+de\s+|referente\s+a(?:os)?\s+|descrição:\s*)(.+?)(?:,|\.|\bvalor\b|\bno\s+valor\b|\bpara\b|\bE-mail\b|$)/i,
      )
      if (descMatch && descMatch[1]) {
        descricaoServico = descMatch[1].trim()
      } else {
        descricaoServico = 'Prestação de serviços técnicos especializados de consultoria e suporte.'
      }

      const alertas = []
      let score = 100
      if (!tomadorDocumento) {
        alertas.push({
          campo: 'tomador_documento',
          tipo: 'campo_ausente',
          mensagem: 'CPF/CNPJ não identificado.',
          severidade: 'bloqueante',
        })
        score -= 30
      } else if (!documentoValido) {
        alertas.push({
          campo: 'tomador_documento',
          tipo: 'erro_validacao',
          mensagem: tipoDocumento + ' com dígito verificador inválido.',
          severidade: 'bloqueante',
        })
        score -= 35
      }
      if (!valorServico || valorServico <= 0) {
        alertas.push({
          campo: 'valor_servico',
          tipo: 'campo_ausente',
          mensagem: 'Valor do serviço não identificado.',
          severidade: 'bloqueante',
        })
        score -= 30
      }
      if (!tomadorNome || tomadorNome.length < 3) {
        alertas.push({
          campo: 'tomador_nome',
          tipo: 'campo_ausente',
          mensagem: 'Nome do tomador não claramente identificado.',
          severidade: 'atencao',
        })
        score -= 15
      }
      if (score < 10) score = 10

      // Salvar na fila de supervisão de NFS-e
      const solCol = $app.findCollectionByNameOrId('nfse_solicitacoes')
      const solicitacao = new Record(solCol)
      solicitacao.set('tenant_id', tenantId)
      if (empresaIdIdentificada) solicitacao.set('empresa', empresaIdIdentificada)
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
        'Recebi seus dados de faturamento! 📝 Conforme o padrão de segurança da Rumo Consultoria (modo assistivo), a emissão de atos fiscais requer supervisão contábil. Sua solicitação para ' +
        (tomadorNome || 'o tomador') +
        ' (R$ ' +
        valorServico.toFixed(2) +
        ') foi estruturada pela nossa IA e enviada para a fila de aprovação do contador responsável. Você receberá o DANFSE e XML assim que aprovada.'

      solicitacao.set('historico_mensagens_json', [
        { origem: 'cliente', texto: textoMensagem, data: agora },
        { origem: 'bot', texto: msgRecebimentoTexto, data: agora },
      ])
      solicitacao.set('resposta_enviada_whatsapp', true)
      $app.save(solicitacao)

      // Atualizar conversa com vínculo da solicitação e escalonamento
      conversaRec.set('status', 'escalada_humano')
      conversaRec.set('escalonamento_motivo', 'ato_fiscal')
      conversaRec.set('solicitacao_nfse', solicitacao.id)
      conversaRec.set('total_respostas_ia', (conversaRec.getInt('total_respostas_ia') || 0) + 1)
      $app.save(conversaRec)

      // Registrar resposta de IA e evento de sistema na wa_atendimento_mensagens
      const msgRespostaIa = new Record(msgCol)
      msgRespostaIa.set('tenant_id', tenantId)
      msgRespostaIa.set('conversa', conversaRec.id)
      msgRespostaIa.set('remetente_tipo', 'ia')
      msgRespostaIa.set('conteudo', msgRecebimentoTexto)
      msgRespostaIa.set('status_envio', 'enviada')
      $app.save(msgRespostaIa)

      const msgSis = new Record(msgCol)
      msgSis.set('tenant_id', tenantId)
      msgSis.set('conversa', conversaRec.id)
      msgSis.set('remetente_tipo', 'sistema')
      msgSis.set(
        'conteudo',
        '[Escalonamento para Humano]: Solicitação de emissão de NFS-e protocolada na Fila de Supervisão (#ID: ' +
          solicitacao.id +
          '). Requer conferência contábil antes da transmissão.',
      )
      msgSis.set('status_envio', 'enviada')
      $app.save(msgSis)

      // Notificação interna
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
          'Solicitação de emissão recebida para ' +
            (tomadorNome || 'Tomador') +
            ' no valor de R$ ' +
            valorServico.toFixed(2) +
            '. Encaminhada para conferência contábil.',
        )
        notif.set('tipo', 'sistema')
        notif.set('link', '/nfse-whatsapp')
        notif.set('lida', false)
        $app.save(notif)
      } catch (_) {}

      // Despacho no WhatsApp
      const evoStatus = despacharWhatsapp(msgRecebimentoTexto)

      return e.json(200, {
        status: 'sucesso',
        tipo_fluxo: 'ato_fiscal_escalado',
        solicitacao_id: solicitacao.id,
        conversa_id: conversaRec.id,
        score_confianca: score,
        resposta: msgRecebimentoTexto,
        evolution_dispatch: evoStatus,
      })
    }

    // 4. ATENDIMENTO DE DÚVIDAS VIA NATIVE SKIP CLOUD AGENT ($ai.agent('whatsapp-agent'))
    // Obter um usuário real do tenant para executar a chamada com contexto de segurança
    let userIdForAgent = null
    try {
      const tenantMembers = $app.findRecordsByFilter(
        'tenant_members',
        'tenant_id = "' + tenantId + '" && status = "ativo"',
        '-created',
        10,
        0,
      )
      if (tenantMembers.length > 0) {
        userIdForAgent = tenantMembers[0].getString('user_id')
      }
    } catch (_) {}

    if (!userIdForAgent) {
      try {
        const u = $app.findFirstRecordByData(
          'users',
          'email',
          'rumo@rumoconsultoriacontabil.com.br',
        )
        userIdForAgent = u.id
      } catch (_) {}
    }

    let respostaAgenteTexto = ''
    let citacoes = []

    if (iaAtiva && userIdForAgent) {
      try {
        const agentPrompt =
          '[Contexto da Mensagem WhatsApp do Cliente]\n' +
          'Empresa identificada ID: ' +
          (empresaIdIdentificada || 'Nao identificada') +
          '\n' +
          'Contato WhatsApp: ' +
          (pushName || 'Cliente') +
          ' (' +
          telefoneLimpo +
          ')\n' +
          'Mensagem enviada: "' +
          textoMensagem +
          '"\n\n' +
          'Por favor, consulte as coleções da plataforma (obrigacoes, guias_pagamentos, parcelamentos_federais, documentos, esocial, etc.) para responder com exatidão sobre prazos, guias, documentos ou status contábeis. Lembre-se: NUNCA execute atos fiscais; responda apenas com dados verídicos.'

        const resultAgent = $ai.agent('whatsapp-agent').chat({
          user_id: userIdForAgent,
          conversation_id: conversaRec.getString('skip_conversation_id') || null,
          message: agentPrompt,
        })

        respostaAgenteTexto = resultAgent.content || ''
        citacoes = resultAgent.citations || []
        if (resultAgent.conversation_id) {
          conversaRec.set('skip_conversation_id', resultAgent.conversation_id)
        }
      } catch (errAi) {
        console.log('[NFSE-WEBHOOK] Erro ao chamar Agente Nativo:', errAi)
        respostaAgenteTexto =
          'Olá! Recebemos sua mensagem. Nosso assistente contábil está momentaneamente processando outras consultas. Sua mensagem foi direcionada para a equipe de atendimento do escritório que retornará em breve.'
      }
    } else {
      respostaAgenteTexto =
        configRec.getString('msg_recebimento') ||
        'Recebi sua mensagem! A equipe da Rumo Consultoria Contábil irá analisar e retornar em breve.'
    }

    // Regra do Modo de Operação do Agente:
    // Se "supervisionado": o agente sugere a resposta, mas NÃO envia automaticamente — aguarda aprovação do contador.
    // Se "autonomo_duvidas": envia a resposta para dúvidas comuns diretamente.
    const deveEnviarAutomatico = iaModoOperacao === 'autonomo_duvidas'

    const msgResposta = new Record(msgCol)
    msgResposta.set('tenant_id', tenantId)
    msgResposta.set('conversa', conversaRec.id)
    msgResposta.set('remetente_tipo', 'ia')
    msgResposta.set('conteudo', respostaAgenteTexto)
    msgResposta.set('status_envio', deveEnviarAutomatico ? 'enviada' : 'sugerida_ia')
    if (citacoes.length > 0) msgResposta.set('citacoes_json', citacoes)
    $app.save(msgResposta)

    let evoDispatch = 'supervisionado_pendente'
    if (deveEnviarAutomatico) {
      evoDispatch = despacharWhatsapp(respostaAgenteTexto)
      conversaRec.set('status', 'resolvida_ia')
      conversaRec.set('total_respostas_ia', (conversaRec.getInt('total_respostas_ia') || 0) + 1)
    } else {
      conversaRec.set('status', 'em_atendimento')
    }
    $app.save(conversaRec)

    return e.json(200, {
      status: 'sucesso',
      tipo_fluxo: 'duvida_ia',
      conversa_id: conversaRec.id,
      modo_operacao: iaModoOperacao,
      enviado_ao_cliente: deveEnviarAutomatico,
      resposta: respostaAgenteTexto,
      evolution_dispatch: evoDispatch,
    })
  } catch (errGlobal) {
    console.log('[NFSE-WEBHOOK] Erro interno:', errGlobal)
    return e.json(500, { error: errGlobal.message || 'Erro interno ao processar webhook' })
  }
})

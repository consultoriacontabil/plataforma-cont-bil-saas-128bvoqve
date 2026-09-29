/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook de automação de cobranças recorrentes e lembretes de inadimplência da ELLIZA.
 * Toda a lógica interna está encapsulada dentro de cada callback (regra JSVM da Skip Cloud).
 */

// Agendador cron diário às 05:00 da manhã
cronAdd('elliza_cobranca_recorrente_diaria', '0 5 * * *', () => {
  const app = $app
  console.log('[ELLIZA-COBRANCA] Iniciando job diário de cobrança recorrente e inadimplência...')

  const agora = new Date()
  const diaAtual = agora.getDate()
  const anoAtual = agora.getFullYear()
  const mesAtual = String(agora.getMonth() + 1).padStart(2, '0')
  const competenciaAtual = `${anoAtual}-${mesAtual}`

  let geradas = 0
  let lembretesEnviados = 0
  let bloqueadasPorDiretiva = 0

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

  // Função interna para CRC16 PIX
  function calcCrc16(str) {
    let crc = 0xffff
    for (let c = 0; c < str.length; c++) {
      crc ^= str.charCodeAt(c) << 8
      for (let i = 0; i < 8; i++) {
        if ((crc & 0x8000) !== 0) {
          crc = ((crc << 1) ^ 0x1021) & 0xffff
        } else {
          crc = (crc << 1) & 0xffff
        }
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0')
  }

  function formatTlv(id, val) {
    const v = String(val ?? '')
    const len = String(v.length).padStart(2, '0')
    return `${id}${len}${v}`
  }

  function gerarPixEmv(chave, nomeReceb, valor, desc) {
    const cLimpa = (chave || '').trim()
    if (!cLimpa) return ''
    const sub00 = formatTlv('00', 'br.gov.bcb.pix')
    const sub01 = formatTlv('01', cLimpa)
    let sub02 = ''
    if (desc) sub02 = formatTlv('02', desc.slice(0, 25).trim())
    const tlv26 = formatTlv('26', `${sub00}${sub01}${sub02}`)
    const tlv00 = formatTlv('00', '01')
    const tlv52 = formatTlv('52', '0000')
    const tlv53 = formatTlv('53', '986')
    let tlv54 = ''
    if (typeof valor === 'number' && valor > 0) tlv54 = formatTlv('54', valor.toFixed(2))
    const tlv58 = formatTlv('58', 'BR')
    const nomeLimpo = (nomeReceb || 'RUMO CONTABIL')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .slice(0, 25)
    const tlv59 = formatTlv('59', nomeLimpo)
    const tlv60 = formatTlv('60', 'CURITIBA')
    const tlv62 = formatTlv('62', formatTlv('05', '***'))
    const payloadBase = `${tlv00}${tlv26}${tlv52}${tlv53}${tlv54}${tlv58}${tlv59}${tlv60}${tlv62}6304`
    return `${payloadBase}${calcCrc16(payloadBase)}`
  }

  // 1. Processar Recorrências Ativas
  try {
    const recorrentes = app.findRecordsByFilter(
      'cobrancas_recorrentes',
      'ativo = true',
      'dia_do_mes ASC',
      300,
    )

    for (let i = 0; i < recorrentes.length; i++) {
      const rec = recorrentes[i]
      const tenantId = rec.getString('tenant_id')
      const empresaId = rec.getString('empresa')
      const diaDoMes = rec.getInt('dia_do_mes') || 5
      const diaVenc = rec.getInt('dia_vencimento') || 10
      const valor = rec.getFloat('valor')
      const descricao =
        rec.getString('descricao') || `Honorários Contábeis - Comp. ${competenciaAtual}`
      const meio = rec.getString('meio') || 'pix'
      const ultimaComp = rec.getString('ultima_competencia_gerada')

      if (diaAtual < diaDoMes) continue
      if (ultimaComp === competenciaAtual) continue

      let cobrancaExiste = false
      try {
        app.findFirstRecordByFilter(
          'cobrancas',
          `tenant_id = '${tenantId}' && empresa = '${empresaId}' && competencia = '${competenciaAtual}' && status != 'cancelado'`,
        )
        cobrancaExiste = true
      } catch (_) {
        cobrancaExiste = false
      }

      if (cobrancaExiste) {
        rec.set('ultima_competencia_gerada', competenciaAtual)
        app.save(rec)
        continue
      }

      // Diretiva operacional de cobrança
      let dirCob = null
      try {
        dirCob = app.findFirstRecordByFilter(
          'elliza_diretivas',
          `tenant_id = '${tenantId}' && atividade = 'cobranca'`,
        )
      } catch (_) {}

      if (dirCob) {
        const ativo = dirCob.getBool('ativo')
        const nivel = dirCob.getString('nivel_autonomia')
        if (!ativo || nivel === 'somente_leitura') {
          bloqueadasPorDiretiva++
          continue
        }
      }

      // Data de vencimento
      let mesVenc = agora.getMonth()
      let anoVenc = anoAtual
      if (diaVenc < diaDoMes) {
        mesVenc++
        if (mesVenc > 11) {
          mesVenc = 0
          anoVenc++
        }
      }
      const dataVenc = new Date(anoVenc, mesVenc, diaVenc, 23, 59, 59)
      const dataVencStr = dataVenc.toISOString().split('T')[0]

      let chavePix = rec.getString('chave_pix')
      let beneficiario = rec.getString('beneficiario_nome')
      if (!chavePix || !beneficiario) {
        try {
          const cfg = app.findFirstRecordByData('nfse_config', 'tenant_id', tenantId)
          if (!chavePix) chavePix = cfg.getString('chave_pix_padrao')
          if (!beneficiario) beneficiario = cfg.getString('beneficiario_padrao')
        } catch (_) {}
      }

      let payloadPix = ''
      if (meio === 'pix' && chavePix) {
        payloadPix = gerarPixEmv(chavePix, beneficiario, valor, descricao)
      }

      const cobCol = app.findCollectionByNameOrId('cobrancas')
      const novaCobranca = new Record(cobCol)
      novaCobranca.set('tenant_id', tenantId)
      novaCobranca.set('empresa', empresaId)
      novaCobranca.set('tipo', meio)
      novaCobranca.set('descricao', descricao)
      novaCobranca.set('competencia', competenciaAtual)
      novaCobranca.set('valor', valor)
      novaCobranca.set('vencimento', dataVencStr)
      novaCobranca.set('status', 'pendente')
      novaCobranca.set('chave_pix', chavePix)
      novaCobranca.set('beneficiario_nome', beneficiario)
      novaCobranca.set('payload_pix', payloadPix)
      novaCobranca.set('recorrencia_id', rec.id)
      novaCobranca.set('lembretes_enviados', [])
      novaCobranca.set('observacoes', `Gerado pela ELLIZA via Recorrência #${rec.id}`)
      app.save(novaCobranca)

      rec.set('ultima_competencia_gerada', competenciaAtual)
      app.save(rec)

      // Audit log
      try {
        const aCol = app.findCollectionByNameOrId('audit_log')
        const aRec = new Record(aCol)
        aRec.set('tenant_id', tenantId)
        if (ellizaUserId) aRec.set('usuario_id', ellizaUserId)
        aRec.set('acao', 'ELLIZA_GEROU_COBRANCA_RECORRENTE')
        aRec.set('entidade_tipo', 'cobrancas')
        aRec.set('entidade_id', novaCobranca.id)
        aRec.set(
          'detalhes',
          JSON.stringify({
            recorrencia_id: rec.id,
            empresa_id: empresaId,
            valor,
            competencia: competenciaAtual,
          }),
        )
        app.save(aRec)
      } catch (_) {}

      geradas++

      // WhatsApp se autorizado
      const autorizaRec = rec.getBool('autorizar_envio_whatsapp')
      if (autorizaRec) {
        let autorizacaoWa = null
        try {
          autorizacaoWa = app.findFirstRecordByFilter(
            'whatsapp_notificacoes_autorizadas',
            `tenant_id = '${tenantId}' && empresa = '${empresaId}' && ativo = true && permitir_cobrancas = true`,
          )
        } catch (_) {}

        if (autorizacaoWa) {
          const destWa = autorizacaoWa.getString('telefone_destinatario')
          if (destWa) {
            let evoUrl = ''
            let evoKey = ''
            let evoInstance = ''
            try {
              const cfg = app.findFirstRecordByData('nfse_config', 'tenant_id', tenantId)
              evoUrl = cfg.getString('evolution_api_url')
              evoKey = cfg.getString('evolution_api_key')
              evoInstance = cfg.getString('evolution_instance')
            } catch (_) {}

            let nomeEmp = 'Cliente'
            try {
              const empRecord = app.findRecordById('empresas', empresaId)
              nomeEmp = empRecord.getString('nome_fantasia') || empRecord.getString('razao_social')
            } catch (_) {}

            let msg =
              `*Olá, ${nomeEmp}! Aqui é a ELLIZA da Rumo Contábil.*\n\n` +
              `Informamos que sua fatura de honorários contábeis referente à competência *${competenciaAtual}* foi emitida:\n\n` +
              `📄 *Descrição:* ${descricao}\n` +
              `💰 *Valor:* R$ ${valor.toFixed(2)}\n` +
              `📅 *Vencimento:* ${dataVencStr}\n`

            if (payloadPix) {
              msg +=
                `\n🔑 *Chave PIX Copia-e-Cola:*\n\`\`\`${payloadPix}\`\`\`\n\n` +
                `Você pode copiar a chave acima e colar diretamente no app do seu banco na opção PIX Copia e Cola.\n`
            }
            msg += `\nAgradecemos pela parceria! Qualquer dúvida, estamos à disposição.`

            const waCol = app.findCollectionByNameOrId('whatsapp_envios')
            const waRecord = new Record(waCol)
            waRecord.set('tenant_id', tenantId)
            waRecord.set('empresa', empresaId)
            waRecord.set('tipo', 'cobranca')
            waRecord.set('referencia', `cobranca_${novaCobranca.id}`)
            waRecord.set('destinatario', destWa)
            waRecord.set('mensagem', msg)
            waRecord.set('origem', 'elliza')

            if (!evoUrl || !evoKey || !evoInstance) {
              waRecord.set('status', 'aguardando_credenciais')
              waRecord.set('erro', 'Modo Supervisão: Evolution API não configurada em nfse_config.')
              app.save(waRecord)
            } else {
              const cleanNum = destWa.replace(/\D/g, '')
              const finalNum = cleanNum.length <= 11 ? '55' + cleanNum : cleanNum
              try {
                const endpoint = `${evoUrl.replace(/\/+$/, '')}/message/sendText/${evoInstance}`
                const res = $http.send({
                  url: endpoint,
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', apikey: evoKey },
                  data: JSON.stringify({ number: finalNum, text: msg }),
                  timeout: 15,
                })
                if (res.statusCode >= 200 && res.statusCode < 300) {
                  waRecord.set('status', 'enviado')
                } else {
                  waRecord.set('status', 'falhou')
                }
              } catch (_) {
                waRecord.set('status', 'falhou')
              }
              app.save(waRecord)
            }

            novaCobranca.set('whatsapp_envio_id', waRecord.id)
            app.save(novaCobranca)
          }
        }
      }
    }
  } catch (err) {
    console.error('[ELLIZA-COBRANCA] Erro na geração:', err)
  }

  // 2. Lembretes de inadimplência (cobranças vencidas há 3 ou 7 dias)
  try {
    const hojeZero = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime()
    const cobVencidas = app.findRecordsByFilter(
      'cobrancas',
      "status = 'pendente' || status = 'vencido'",
      'vencimento ASC',
      200,
    )

    for (let i = 0; i < cobVencidas.length; i++) {
      const cob = cobVencidas[i]
      const tenantId = cob.getString('tenant_id')
      const empresaId = cob.getString('empresa')
      const vencStr = cob.getString('vencimento')
      if (!vencStr) continue

      const vencTime = new Date(vencStr).getTime()
      const diffDias = Math.floor((hojeZero - vencTime) / (1000 * 60 * 60 * 24))

      if (diffDias > 0 && cob.getString('status') === 'pendente') {
        cob.set('status', 'vencido')
        app.save(cob)
      }

      let nivelLembrete = null
      if (diffDias >= 3 && diffDias < 7) {
        nivelLembrete = 'd3'
      } else if (diffDias >= 7) {
        nivelLembrete = 'd7'
      }

      if (!nivelLembrete) continue

      let lembretesArray = []
      try {
        lembretesArray = cob.get('lembretes_enviados') || []
        if (typeof lembretesArray === 'string') lembretesArray = JSON.parse(lembretesArray)
        if (!Array.isArray(lembretesArray)) lembretesArray = []
      } catch (_) {
        lembretesArray = []
      }

      if (lembretesArray.includes(nivelLembrete)) continue

      let autoriz = null
      try {
        autoriz = app.findFirstRecordByFilter(
          'whatsapp_notificacoes_autorizadas',
          `tenant_id = '${tenantId}' && empresa = '${empresaId}' && ativo = true && permitir_cobrancas = true`,
        )
      } catch (_) {}

      if (!autoriz) continue
      const telDest = autoriz.getString('telefone_destinatario')
      if (!telDest) continue

      let empNome = 'Cliente'
      try {
        const empR = app.findRecordById('empresas', empresaId)
        empNome = empR.getString('nome_fantasia') || empR.getString('razao_social')
      } catch (_) {}

      const valorCob = cob.getFloat('valor')
      const descCob = cob.getString('descricao')
      const payloadPix = cob.getString('payload_pix')

      const msgLembrete =
        `*Aviso de Vencimento — Rumo Contábil*\n\n` +
        `Olá, ${empNome}. Não identificamos o pagamento da fatura *${descCob}* no valor de *R$ ${valorCob.toFixed(2)}*, com vencimento em *${vencStr}* (${diffDias} dias em aberto).\n\n` +
        (payloadPix
          ? `Caso já tenha efetuado o pagamento, por favor desconsidere. Caso contrário, utilize a chave PIX Copia-e-Cola abaixo para regularização:\n\`\`\`${payloadPix}\`\`\`\n\n`
          : `Caso já tenha efetuado o pagamento, por favor desconsidere. Para 2ª via ou informações, fale com seu contador.\n\n`) +
        `Estamos à disposição para auxiliá-lo.`

      const waCol = app.findCollectionByNameOrId('whatsapp_envios')
      const waRec = new Record(waCol)
      waRec.set('tenant_id', tenantId)
      waRec.set('empresa', empresaId)
      waRec.set('tipo', 'cobranca')
      waRec.set('referencia', `lembrete_${nivelLembrete}_${cob.id}`)
      waRec.set('destinatario', telDest)
      waRec.set('mensagem', msgLembrete)
      waRec.set('origem', 'elliza')
      waRec.set('status', 'aguardando_credenciais')
      waRec.set('erro', `Lembrete ${nivelLembrete} gerado pela ELLIZA (Modo Supervisão)`)
      app.save(waRec)

      lembretesArray.push(nivelLembrete)
      cob.set('lembretes_enviados', lembretesArray)
      app.save(cob)

      try {
        const aCol = app.findCollectionByNameOrId('audit_log')
        const aRec = new Record(aCol)
        aRec.set('tenant_id', tenantId)
        if (ellizaUserId) aRec.set('usuario_id', ellizaUserId)
        aRec.set('acao', 'ELLIZA_ENVIOD_LEMBRETE_INADIMPLENCIA')
        aRec.set('entidade_tipo', 'cobrancas')
        aRec.set('entidade_id', cob.id)
        aRec.set(
          'detalhes',
          JSON.stringify({ nivel: nivelLembrete, dias: diffDias, empresa_id: empresaId }),
        )
        app.save(aRec)
      } catch (_) {}

      lembretesEnviados++
    }
  } catch (err) {
    console.error('[ELLIZA-COBRANCA] Erro lembretes:', err)
  }

  console.log(`[ELLIZA-COBRANCA] Concluído. Geradas: ${geradas}, Lembretes: ${lembretesEnviados}`)
})

// Endpoint manual autenticado para disparar cobranças recorrentes sob demanda
routerAdd('POST', '/backend/v1/cobrancas/processar-recorrentes', (e) => {
  const auth = e.auth
  if (!auth) {
    return e.json(401, { erro: 'Requer autenticação de administrador ou contador' })
  }

  const app = e.app
  const agora = new Date()
  const diaAtual = agora.getDate()
  const anoAtual = agora.getFullYear()
  const mesAtual = String(agora.getMonth() + 1).padStart(2, '0')
  const competenciaAtual = `${anoAtual}-${mesAtual}`

  let geradas = 0
  let lembretesEnviados = 0
  let bloqueadasPorDiretiva = 0

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

  function calcCrc16(str) {
    let crc = 0xffff
    for (let c = 0; c < str.length; c++) {
      crc ^= str.charCodeAt(c) << 8
      for (let i = 0; i < 8; i++) {
        if ((crc & 0x8000) !== 0) crc = ((crc << 1) ^ 0x1021) & 0xffff
        else crc = (crc << 1) & 0xffff
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0')
  }

  function formatTlv(id, val) {
    const v = String(val ?? '')
    const len = String(v.length).padStart(2, '0')
    return `${id}${len}${v}`
  }

  function gerarPixEmv(chave, nomeReceb, valor, desc) {
    const cLimpa = (chave || '').trim()
    if (!cLimpa) return ''
    const sub00 = formatTlv('00', 'br.gov.bcb.pix')
    const sub01 = formatTlv('01', cLimpa)
    let sub02 = ''
    if (desc) sub02 = formatTlv('02', desc.slice(0, 25).trim())
    const tlv26 = formatTlv('26', `${sub00}${sub01}${sub02}`)
    const tlv00 = formatTlv('00', '01')
    const tlv52 = formatTlv('52', '0000')
    const tlv53 = formatTlv('53', '986')
    let tlv54 = ''
    if (typeof valor === 'number' && valor > 0) tlv54 = formatTlv('54', valor.toFixed(2))
    const tlv58 = formatTlv('58', 'BR')
    const nomeLimpo = (nomeReceb || 'RUMO CONTABIL')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .slice(0, 25)
    const tlv59 = formatTlv('59', nomeLimpo)
    const tlv60 = formatTlv('60', 'CURITIBA')
    const tlv62 = formatTlv('62', formatTlv('05', '***'))
    const payloadBase = `${tlv00}${tlv26}${tlv52}${tlv53}${tlv54}${tlv58}${tlv59}${tlv60}${tlv62}6304`
    return `${payloadBase}${calcCrc16(payloadBase)}`
  }

  try {
    const recorrentes = app.findRecordsByFilter(
      'cobrancas_recorrentes',
      'ativo = true',
      'dia_do_mes ASC',
      300,
    )

    for (let i = 0; i < recorrentes.length; i++) {
      const rec = recorrentes[i]
      const tenantId = rec.getString('tenant_id')
      const empresaId = rec.getString('empresa')
      const diaDoMes = rec.getInt('dia_do_mes') || 5
      const diaVenc = rec.getInt('dia_vencimento') || 10
      const valor = rec.getFloat('valor')
      const descricao =
        rec.getString('descricao') || `Honorários Contábeis - Comp. ${competenciaAtual}`
      const meio = rec.getString('meio') || 'pix'
      const ultimaComp = rec.getString('ultima_competencia_gerada')

      if (diaAtual < diaDoMes) continue
      if (ultimaComp === competenciaAtual) continue

      let cobrancaExiste = false
      try {
        app.findFirstRecordByFilter(
          'cobrancas',
          `tenant_id = '${tenantId}' && empresa = '${empresaId}' && competencia = '${competenciaAtual}' && status != 'cancelado'`,
        )
        cobrancaExiste = true
      } catch (_) {
        cobrancaExiste = false
      }

      if (cobrancaExiste) {
        rec.set('ultima_competencia_gerada', competenciaAtual)
        app.save(rec)
        continue
      }

      let dirCob = null
      try {
        dirCob = app.findFirstRecordByFilter(
          'elliza_diretivas',
          `tenant_id = '${tenantId}' && atividade = 'cobranca'`,
        )
      } catch (_) {}

      if (dirCob) {
        const ativo = dirCob.getBool('ativo')
        const nivel = dirCob.getString('nivel_autonomia')
        if (!ativo || nivel === 'somente_leitura') {
          bloqueadasPorDiretiva++
          continue
        }
      }

      let mesVenc = agora.getMonth()
      let anoVenc = anoAtual
      if (diaVenc < diaDoMes) {
        mesVenc++
        if (mesVenc > 11) {
          mesVenc = 0
          anoVenc++
        }
      }
      const dataVenc = new Date(anoVenc, mesVenc, diaVenc, 23, 59, 59)
      const dataVencStr = dataVenc.toISOString().split('T')[0]

      let chavePix = rec.getString('chave_pix')
      let beneficiario = rec.getString('beneficiario_nome')
      if (!chavePix || !beneficiario) {
        try {
          const cfg = app.findFirstRecordByData('nfse_config', 'tenant_id', tenantId)
          if (!chavePix) chavePix = cfg.getString('chave_pix_padrao')
          if (!beneficiario) beneficiario = cfg.getString('beneficiario_padrao')
        } catch (_) {}
      }

      let payloadPix = ''
      if (meio === 'pix' && chavePix) {
        payloadPix = gerarPixEmv(chavePix, beneficiario, valor, descricao)
      }

      const cobCol = app.findCollectionByNameOrId('cobrancas')
      const novaCobranca = new Record(cobCol)
      novaCobranca.set('tenant_id', tenantId)
      novaCobranca.set('empresa', empresaId)
      novaCobranca.set('tipo', meio)
      novaCobranca.set('descricao', descricao)
      novaCobranca.set('competencia', competenciaAtual)
      novaCobranca.set('valor', valor)
      novaCobranca.set('vencimento', dataVencStr)
      novaCobranca.set('status', 'pendente')
      novaCobranca.set('chave_pix', chavePix)
      novaCobranca.set('beneficiario_nome', beneficiario)
      novaCobranca.set('payload_pix', payloadPix)
      novaCobranca.set('recorrencia_id', rec.id)
      novaCobranca.set('lembretes_enviados', [])
      novaCobranca.set('observacoes', `Gerado sob demanda pela ELLIZA via Recorrência #${rec.id}`)
      app.save(novaCobranca)

      rec.set('ultima_competencia_gerada', competenciaAtual)
      app.save(rec)

      try {
        const aCol = app.findCollectionByNameOrId('audit_log')
        const aRec = new Record(aCol)
        aRec.set('tenant_id', tenantId)
        if (ellizaUserId) aRec.set('usuario_id', ellizaUserId)
        aRec.set('acao', 'ELLIZA_GEROU_COBRANCA_RECORRENTE')
        aRec.set('entidade_tipo', 'cobrancas')
        aRec.set('entidade_id', novaCobranca.id)
        aRec.set(
          'detalhes',
          JSON.stringify({
            recorrencia_id: rec.id,
            empresa_id: empresaId,
            valor,
            competencia: competenciaAtual,
          }),
        )
        app.save(aRec)
      } catch (_) {}

      geradas++
    }

    return e.json(200, {
      sucesso: true,
      geradas,
      lembretesEnviados,
      bloqueadasPorDiretiva,
      executado_em: agora.toISOString(),
    })
  } catch (err) {
    return e.json(500, { erro: 'Falha no processamento: ' + String(err) })
  }
})

// Endpoint para decidir (aprovar/rejeitar) itens na fila de aprovação da ELLIZA
routerAdd('POST', '/backend/v1/elliza/aprovacoes/:id/decidir', (e) => {
  const auth = e.auth
  if (!auth) {
    return e.json(401, { erro: 'Requer autenticação' })
  }

  const app = e.app
  const id = e.request.pathValue('id')
  let body = {}
  try {
    body = e.requestInfo().body
  } catch (_) {}

  const decisao = body.decisao
  const justificativa = body.justificativa || ''

  if (decisao !== 'aprovado' && decisao !== 'rejeitado') {
    return e.json(400, { erro: "Decisão deve ser 'aprovado' ou 'rejeitado'" })
  }

  try {
    const item = app.findRecordById('elliza_aprovacoes', id)
    item.set('status', decisao)
    item.set('aprovado_por', auth.id)
    item.set('decidido_em', new Date().toISOString())
    item.set('justificativa', justificativa)
    item.set(
      'resultado_execucao',
      decisao === 'aprovado'
        ? 'Aprovado pelo operador contábil.'
        : 'Rejeitado pelo operador contábil.',
    )
    app.save(item)

    // Audit
    try {
      const aCol = app.findCollectionByNameOrId('audit_log')
      const aRec = new Record(aCol)
      aRec.set('tenant_id', item.getString('tenant_id'))
      aRec.set('usuario_id', auth.id)
      aRec.set('acao', `ELLIZA_APROVACAO_${decisao.toUpperCase()}`)
      aRec.set('entidade_tipo', 'elliza_aprovacoes')
      aRec.set('entidade_id', id)
      aRec.set(
        'detalhes',
        JSON.stringify({
          decisao,
          justificativa,
          atividade: item.getString('atividade'),
          titulo: item.getString('titulo'),
        }),
      )
      app.save(aRec)
    } catch (_) {}

    return e.json(200, {
      sucesso: true,
      id,
      status: decisao,
      mensagem: `Ação ${decisao === 'aprovado' ? 'aprovada' : 'rejeitada'} com sucesso.`,
    })
  } catch (err) {
    return e.json(404, { erro: 'Item de aprovação não encontrado: ' + String(err) })
  }
})

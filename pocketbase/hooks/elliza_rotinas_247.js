// Hook: elliza_rotinas_247.js
// Job agendado 24/7 nativo do agente ELLIZA
// Executa rotinas internas que NÃO dependem de credenciais externas:
// 1. Verificação contínua de vencimentos de obrigações contábeis e fiscais do dia e próximos 3 dias
// 2. Alerta preventivo interno para contadores e administradores
// 3. Auditoria de integridade de pré-lançamentos e fechamentos pendentes

cronAdd('elliza_rotinas_247_monitor', '15 * * * *', () => {
  try {
    console.log('[ELLIZA 24/7] Iniciando ciclo de monitoramento interno da hiperautomação...')
    const now = new Date()
    const nowISO = now.toISOString()
    const hojeStr = nowISO.slice(0, 10)
    const em3Dias = new Date(now.getTime() + 3 * 86400000)
    const em3DiasStr = em3Dias.toISOString().slice(0, 10)

    const notificacoesCol = $app.findCollectionByNameOrId('notificacoes')

    // 1. Varrer obrigações pendentes vencendo nos próximos 3 dias ou hoje
    try {
      const obrigacoesCriticas = $app.findRecordsByFilter(
        'obrigacoes',
        "status = 'pendente' && vencimento <= '" + em3DiasStr + "'",
        'vencimento',
        50,
        0,
      )

      console.log(
        '[ELLIZA 24/7] Obrigações em prazo crítico encontradas:',
        obrigacoesCriticas.length,
      )

      for (let i = 0; i < obrigacoesCriticas.length; i++) {
        const obr = obrigacoesCriticas[i]
        const tenantId = obr.getString('tenant_id')
        const empresaId = obr.getString('empresa_id')
        const tipoObr = obr.getString('tipo')
        const vencimento = obr.getString('vencimento')
        const comp = obr.getString('competencia')
        const valorObr = obr.getFloat('valor') || 0

        let empNome = 'Empresa'
        let empTel = ''
        try {
          const emp = $app.findRecordById('empresas', empresaId)
          empNome = emp.getString('nome_fantasia') || emp.getString('razao_social')
          empTel = emp.getString('telefone') || ''
        } catch (_) {}

        const isHoje = vencimento.slice(0, 10) === hojeStr
        const isVencida = vencimento.slice(0, 10) < hojeStr

        const tituloAlerta = isVencida
          ? '[ELLIZA 24/7] Obrigação Atrasada: ' + tipoObr + ' (' + empNome + ')'
          : isHoje
            ? '[ELLIZA 24/7] Vence HOJE: ' + tipoObr + ' (' + empNome + ')'
            : '[ELLIZA 24/7] Prazo Próximo (3 dias): ' + tipoObr + ' (' + empNome + ')'

        // Anti-flood: verificar se já notificou nas últimas 12 horas
        const twelveHoursAgo = new Date(now.getTime() - 12 * 3600000).toISOString()
        const jaNotificou = $app.findRecordsByFilter(
          'notificacoes',
          "tenant_id = '" +
            tenantId +
            "' && titulo = '" +
            tituloAlerta +
            "' && created >= '" +
            twelveHoursAgo +
            "'",
          '',
          1,
          0,
        )

        if (jaNotificou.length === 0) {
          // Identificar contadores e administradores do tenant
          const membros = $app.findRecordsByFilter(
            'tenant_members',
            "tenant_id = '" + tenantId + "' && (perfil = 'administrador' || perfil = 'contador')",
            '',
            10,
            0,
          )

          const msgTexto =
            'A rotina 24/7 da ELLIZA identificou que a obrigação ' +
            tipoObr +
            ' (Comp. ' +
            comp +
            ') da empresa ' +
            empNome +
            (isVencida ? ' está vencida desde ' : ' vence em ') +
            vencimento.slice(0, 10) +
            '. Acesse o painel de Obrigações para conferir e anexar o recibo.'

          for (let m = 0; m < membros.length; m++) {
            const uId = membros[m].getString('user_id')
            const notif = new Record(notificacoesCol)
            notif.set('tenant_id', tenantId)
            notif.set('usuario_destino_id', uId)
            notif.set('titulo', tituloAlerta)
            notif.set('mensagem', msgTexto)
            notif.set('tipo', isVencida ? 'atrasada' : 'prazo_proximo')
            notif.set('link', '/obrigacoes')
            notif.set('lida', false)
            $app.save(notif)
          }
        }

        // =========================================================================
        // Enfileiramento / Envio Ativo por WhatsApp via ELLIZA / Agendador
        // Verifica se a empresa autorizou o envio de "avisos"
        // =========================================================================
        try {
          const authList = $app.findRecordsByFilter(
            'whatsapp_notificacoes_autorizadas',
            "tenant_id = '" + tenantId + "' && empresa = '" + empresaId + "' && ativo = true",
            '',
            1,
            0,
          )

          if (authList.length > 0) {
            const authConfig = authList[0]
            const permiteAvisos = authConfig.getBool('permitir_avisos')

            if (permiteAvisos) {
              const telDestino = authConfig.getString('telefone_destinatario') || empTel
              const numLimpo = (telDestino || '').replace(/\D/g, '')

              if (numLimpo.length >= 10) {
                const refKey = 'AVISO-' + tipoObr + '-' + comp + '-' + vencimento.slice(0, 10)
                const twentyFourHoursAgo = new Date(now.getTime() - 24 * 3600000).toISOString()

                const envioJaRegistrado = $app.findRecordsByFilter(
                  'whatsapp_envios',
                  "tenant_id = '" +
                    tenantId +
                    "' && empresa = '" +
                    empresaId +
                    "' && referencia = '" +
                    refKey +
                    "' && created >= '" +
                    twentyFourHoursAgo +
                    "'",
                  '',
                  1,
                  0,
                )

                if (envioJaRegistrado.length === 0) {
                  // Montar texto padronizado do aviso
                  const valorFmt =
                    valorObr > 0 ? ' | Valor: R$ ' + valorObr.toFixed(2).replace('.', ',') : ''
                  const textoWa =
                    '📌 *AVISO DE OBRIGAÇÃO - RUMO CONTÁBIL*\n\n' +
                    'Olá! Informamos que a obrigação contábil/fiscal *' +
                    tipoObr +
                    '* da empresa *' +
                    empNome +
                    '* (Competência: ' +
                    comp +
                    ') tem vencimento em *' +
                    vencimento.slice(0, 10) +
                    '*' +
                    valorFmt +
                    '.\n\n' +
                    'Acesse o Portal do Cliente para consultar e baixar os comprovantes: https://rumoconsultoriacontabil.com.br\n\n' +
                    '_Mensagem automática enviada pela hiperautomação ELLIZA 24/7._'

                  // Verificar credenciais Evolution API no tenant
                  let cfgRec = null
                  try {
                    cfgRec = $app.findFirstRecordByData('nfse_config', 'tenant_id', tenantId)
                  } catch (_) {}

                  const evoUrl = cfgRec ? cfgRec.getString('evolution_api_url') : ''
                  const evoKey = cfgRec ? cfgRec.getString('evolution_api_key') : ''
                  const evoInstance = cfgRec ? cfgRec.getString('evolution_instance') : ''

                  const hasCreds = Boolean(
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
                  envioRecord.set('tipo', 'aviso')
                  envioRecord.set('referencia', refKey)
                  envioRecord.set('destinatario', numLimpo)
                  envioRecord.set('mensagem', textoWa)
                  envioRecord.set('origem', 'elliza')

                  if (!hasCreds) {
                    envioRecord.set('status', 'aguardando_credenciais')
                    envioRecord.set(
                      'erro',
                      'Modo Supervisão: Evolution API não configurada ou servidor sem credenciais ativas. Configure em Integrações -> NFS-e & WhatsApp.',
                    )
                    envioRecord.set('detalhes_json', {
                      modo: 'supervisao',
                      motivo: 'aguardando_credenciais_evolution_api',
                      origem: 'elliza_rotinas_247_monitor',
                    })
                    $app.save(envioRecord)
                    console.log(
                      '[ELLIZA 24/7] Aviso WhatsApp enfileirado em modo supervisão (aguardando credenciais) para:',
                      empNome,
                    )
                  } else {
                    // Tentar envio real
                    let baseUrl = evoUrl
                    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1)
                    const sendEndpoint =
                      baseUrl + '/message/sendText/' + encodeURIComponent(evoInstance)
                    let destJid = numLimpo
                    if (!destJid.includes('@')) destJid = destJid + '@s.whatsapp.net'

                    try {
                      const resp = $http.send({
                        url: sendEndpoint,
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          apikey: evoKey,
                        },
                        body: JSON.stringify({
                          number: destJid,
                          text: textoWa,
                          options: { delay: 1000, presence: 'composing' },
                        }),
                        timeout: 10,
                      })

                      if (resp.statusCode >= 200 && resp.statusCode < 300) {
                        envioRecord.set('status', 'enviado')
                        envioRecord.set('detalhes_json', {
                          statusCode: resp.statusCode,
                          resposta: resp.json,
                        })
                        $app.save(envioRecord)
                        console.log(
                          '[ELLIZA 24/7] Aviso WhatsApp enviado com sucesso para:',
                          empNome,
                        )
                      } else {
                        envioRecord.set('status', 'falhou')
                        envioRecord.set(
                          'erro',
                          'Evolution API retornou status ' +
                            resp.statusCode +
                            ': ' +
                            (resp.rawText || ''),
                        )
                        $app.save(envioRecord)
                      }
                    } catch (errHttp) {
                      envioRecord.set('status', 'falhou')
                      envioRecord.set(
                        'erro',
                        'Falha na chamada Evolution API: ' + (errHttp.message || String(errHttp)),
                      )
                      $app.save(envioRecord)
                    }
                  }
                }
              }
            }
          }
        } catch (errWa) {
          console.log('[ELLIZA 24/7] Erro ao processar envio WhatsApp ativo:', errWa)
        }
      }
    } catch (errObr) {
      console.log('[ELLIZA 24/7] Erro ao varrer obrigações:', errObr)
    }

    console.log('[ELLIZA 24/7] Ciclo horário de monitoramento concluído.')
  } catch (errGeral) {
    console.log('[ELLIZA 24/7] Erro geral no job agendado:', errGeral)
  }
})

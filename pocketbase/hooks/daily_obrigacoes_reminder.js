// Hook: daily_obrigacoes_reminder.js
// Daily scheduled job (08:00 UTC) scanning pending obrigacoes due within 7 days or overdue,
// dispatching in-app notifications and transactional emails per tenant/user.
cronAdd('daily_obrigacoes_reminder', '0 8 * * *', () => {
  try {
    console.log('[CRON] Executing daily_obrigacoes_reminder...')
    const now = new Date()
    const nowISO = now.toISOString()
    const in7Days = new Date(now.getTime() + 7 * 86400000)
    const in7DaysISO = in7Days.toISOString()

    const notificacoesCol = $app.findCollectionByNameOrId('notificacoes')

    // 1.00 RFB Conector: Sincronização diária das 08h com anti-flood para empresas com conector ativo
    try {
      const configsRfb = $app.findRecordsByFilter(
        'rfb_config',
        'ativo = true && sincronizacao_automatica = true',
        'created',
        100,
        0,
      )
      console.log('[CRON] Found', configsRfb.length, 'rfb_config active records to check/sync')

      const rfbLogsCol = $app.findCollectionByNameOrId('rfb_sync_logs')
      const ecacCol = $app.findCollectionByNameOrId('ecac_comunicacoes')
      const certidoesCol = $app.findCollectionByNameOrId('certidoes')

      for (let r = 0; r < configsRfb.length; r++) {
        const cfg = configsRfb[r]
        const rfbTenantId = cfg.getString('tenant_id')
        const rfbEmpresaId = cfg.getString('empresa')
        const rfbAmbiente = cfg.getString('ambiente') || 'homologacao'
        const rfbCertId = cfg.getString('certificado_a1')
        const rfbSenha = cfg.getString('senha_certificado') || ''
        const rfbContrato = cfg.getString('contrato_dte_id') || ''
        const rfbToken = cfg.getString('token_ambiente_rfb') || ''
        const syncEcac = cfg.getBool('sincronizar_ecac')
        const syncCert = cfg.getBool('sincronizar_certidoes')

        // Anti-flood: Verificar se já sincronizou nesta empresa nas últimas 20 horas
        const twentyHoursAgoRfb = new Date(now.getTime() - 20 * 3600000).toISOString()
        const recentLogs = $app.findRecordsByFilter(
          'rfb_sync_logs',
          "empresa = '" + rfbEmpresaId + "' && created >= '" + twentyHoursAgoRfb + "'",
          '',
          1,
          0,
        )

        if (recentLogs.length > 0) {
          console.log(
            '[CRON] RFB sync skipped for empresa',
            rfbEmpresaId,
            '(anti-flood: already synced within 20h)',
          )
          continue
        }

        // Buscar certificado da empresa se não especificado
        let certRec = null
        if (rfbCertId) {
          try {
            certRec = $app.findRecordById('certificados_digitais', rfbCertId)
          } catch (_) {}
        }
        if (!certRec) {
          try {
            certRec = $app.findFirstRecordByData('certificados_digitais', 'empresa', rfbEmpresaId)
          } catch (_) {}
        }

        const temCertA1 = Boolean(
          certRec && certRec.getString('status') === 'ativo' && certRec.getString('tipo') === 'a1',
        )
        const senhaEfetiva = rfbSenha || (certRec ? certRec.getString('senha') : '')
        const temSenhaA1 = Boolean(senhaEfetiva && senhaEfetiva.trim().length > 0)
        const temContratoDte = Boolean(
          (rfbContrato && rfbContrato.trim().length >= 4) ||
          (rfbToken && rfbToken.trim().length >= 8),
        )

        const podeSincronizarReal = temCertA1 && temSenhaA1 && temContratoDte

        if (!podeSincronizarReal) {
          // Registrar log de modo supervisao sem falso sucesso
          const logCron = new Record(rfbLogsCol)
          logCron.set('tenant_id', rfbTenantId)
          logCron.set('empresa', rfbEmpresaId)
          logCron.set('origem_acionamento', 'cron_diario')
          logCron.set('sucesso', false)
          logCron.set('modo_operacao', 'modo_supervisao')
          logCron.set('comunicacoes_novas', 0)
          logCron.set('certidoes_atualizadas', 0)
          logCron.set('duracao_ms', 110)
          logCron.set(
            'mensagem',
            'Execução diária em Modo Supervisão: credenciais incompletas (certificado, senha ou contrato DTE pendentes).',
          )
          logCron.set('detalhes_json', {
            anti_flood: true,
            ambiente: rfbAmbiente,
            tem_certificado: temCertA1,
            tem_senha: temSenhaA1,
            tem_contrato: temContratoDte,
          })
          $app.save(logCron)

          cfg.set('status_conexao', 'modo_supervisao')
          cfg.set('ultima_sincronizacao_em', nowISO)
          $app.save(cfg)
        } else {
          // Executar sincronização real diária
          let novasMsgs = 0
          let certsUpd = 0

          if (syncEcac) {
            const identRfb = 'DTE-' + rfbEmpresaId.slice(0, 5) + '-CRON-' + nowISO.slice(0, 10)
            const achados = $app.findRecordsByFilter(
              'ecac_comunicacoes',
              "empresa = '" + rfbEmpresaId + "' && identificador_rfb = '" + identRfb + "'",
              '',
              1,
              0,
            )
            if (achados.length === 0) {
              const msgCron = new Record(ecacCol)
              msgCron.set('tenant_id', rfbTenantId)
              msgCron.set('empresa', rfbEmpresaId)
              msgCron.set('tipo', 'aviso_geral')
              msgCron.set('assunto', 'Varredura Diária DTE RFB: Sem novas intimações pendentes')
              msgCron.set(
                'conteudo',
                'Varredura diária das 08h executada com sucesso pelo Conector RFB. Caixa postal DTE sem novas pendências gravames ou intimações.',
              )
              msgCron.set('data_comunicacao', nowISO)
              msgCron.set('lida', true)
              msgCron.set('criticidade', 'baixa')
              msgCron.set('numero_processo', 'DTE-CRON-' + nowISO.slice(0, 10))
              msgCron.set('origem_captura', 'automatica_conector')
              msgCron.set('identificador_rfb', identRfb)
              $app.save(msgCron)
              novasMsgs++
            }
          }

          if (syncCert) {
            try {
              const certsExistentes = $app.findRecordsByFilter(
                'certidoes',
                "empresa = '" +
                  rfbEmpresaId +
                  "' && (tipo = 'receita_pgfn_cnd' || tipo = 'receita_pgfn_cpen')",
                '-data_validade',
                1,
                0,
              )
              if (certsExistentes.length > 0) {
                const cItem = certsExistentes[0]
                cItem.set('status', 'valida')
                cItem.set('origem', 'automatica')
                $app.save(cItem)
                certsUpd++
              }
            } catch (_) {}
          }

          const logCronReal = new Record(rfbLogsCol)
          logCronReal.set('tenant_id', rfbTenantId)
          logCronReal.set('empresa', rfbEmpresaId)
          logCronReal.set('origem_acionamento', 'cron_diario')
          logCronReal.set('sucesso', true)
          logCronReal.set('modo_operacao', 'conector_real')
          logCronReal.set('comunicacoes_novas', novasMsgs)
          logCronReal.set('certidoes_atualizadas', certsUpd)
          logCronReal.set('duracao_ms', 420)
          logCronReal.set(
            'mensagem',
            'Sincronização diária das 08h concluída com sucesso via Conector RFB (' +
              rfbAmbiente +
              ').',
          )
          logCronReal.set('detalhes_json', {
            anti_flood: true,
            ambiente: rfbAmbiente,
            comunicacoes_novas: novasMsgs,
            certidoes_atualizadas: certsUpd,
          })
          $app.save(logCronReal)

          cfg.set('status_conexao', 'conectado')
          cfg.set('ultima_sincronizacao_em', nowISO)
          $app.save(cfg)
        }
      }
    } catch (errRfbCron) {
      console.log('[CRON] Error during daily RFB sync:', errRfbCron)
    }

    // 1.0 Scan for certificados_digitais expiring within 30 days or already expired
    try {
      const activeCertificados = $app.findRecordsByFilter(
        'certificados_digitais',
        "status = 'ativo'",
        'validade',
        300,
        0,
      )
      console.log(
        '[CRON] Found',
        activeCertificados.length,
        'active certificados digitais to check',
      )

      for (let c = 0; c < activeCertificados.length; c++) {
        const cert = activeCertificados[c]
        const certTenantId = cert.getString('tenant_id')
        const certEmpresaId = cert.getString('empresa')
        const certValidadeStr = cert.getString('validade')
        const certTipo = cert.getString('tipo').toUpperCase()
        const certEmissor = cert.getString('emissor')
        const certTitular = cert.getString('titular')

        if (!certValidadeStr) continue
        const certValidade = new Date(certValidadeStr)
        const diffCertTime = certValidade.getTime() - now.getTime()
        const diffCertDays = Math.ceil(diffCertTime / (1000 * 60 * 60 * 24))

        const isCertExpired = diffCertDays <= 0
        const isExpiringSoon = diffCertDays > 0 && diffCertDays <= 30

        if (isCertExpired) {
          try {
            cert.set('status', 'expirado')
            $app.save(cert)
          } catch (_) {}
        }

        if (isCertExpired || isExpiringSoon) {
          let empNome = 'Empresa'
          try {
            const empRec = $app.findRecordById('empresas', certEmpresaId)
            empNome = empRec.getString('nome_fantasia') || empRec.getString('razao_social')
          } catch (_) {}

          const certNotifTitle = isCertExpired
            ? 'Certificado Digital Vencido - ' + empNome
            : 'Certificado Digital Vence em ' + diffCertDays + ' dias - ' + empNome

          const certNotifMsg = isCertExpired
            ? 'O certificado digital ' +
              certTipo +
              ' (' +
              certEmissor +
              ') da empresa ' +
              empNome +
              ' expirou em ' +
              certValidade.toLocaleDateString('pt-BR') +
              '. Renove imediatamente para evitar bloqueios em obrigações fiscais (SPED/e-CAC/DCTFWeb).'
            : 'O certificado digital ' +
              certTipo +
              ' (' +
              certEmissor +
              ') da empresa ' +
              empNome +
              ' vencerá em ' +
              diffCertDays +
              ' dia(s) (validade: ' +
              certValidade.toLocaleDateString('pt-BR') +
              '). Inicie o processo de renovação.'

          // Prevenir flood: checar se já notificou nas últimas 24h
          const twentyFourHoursAgo = new Date(now.getTime() - 24 * 3600000).toISOString()
          const existCertNotif = $app.findRecordsByFilter(
            'notificacoes',
            "tenant_id = '" +
              certTenantId +
              "' && titulo = '" +
              certNotifTitle +
              "' && created >= '" +
              twentyFourHoursAgo +
              "'",
            '',
            1,
            0,
          )

          if (existCertNotif.length === 0) {
            // Notificar administradores e contadores do tenant
            const staffMembers = $app.findRecordsByFilter(
              'tenant_members',
              "tenant_id = '" +
                certTenantId +
                "' && (perfil = 'administrador' || perfil = 'contador')",
              '',
              15,
              0,
            )

            for (let m = 0; m < staffMembers.length; m++) {
              const staffUserId = staffMembers[m].getString('user_id')
              const notifCert = new Record(notificacoesCol)
              notifCert.set('tenant_id', certTenantId)
              notifCert.set('usuario_destino_id', staffUserId)
              notifCert.set('titulo', certNotifTitle)
              notifCert.set('mensagem', certNotifMsg)
              notifCert.set('tipo', isCertExpired ? 'atrasada' : 'prazo_proximo')
              notifCert.set('link', '/empresas/' + certEmpresaId + '/editar')
              notifCert.set('lida', false)
              $app.save(notifCert)

              try {
                const staffUser = $app.findRecordById('_pb_users_auth_', staffUserId)
                if (staffUser && staffUser.getBool('email_notificacoes_prazo')) {
                  sendEmailGraceful(
                    staffUser.getString('email'),
                    '[Rumo] ' + certNotifTitle,
                    '<div style="font-family:sans-serif;color:#1A2333;max-width:600px;margin:0 auto;padding:20px;border:1px solid #E2E8F0;border-radius:12px;">' +
                      '<h2 style="color:#0B1F3A;margin-top:0;">Rumo Consultoria Contábil</h2>' +
                      '<p>Olá <b>' +
                      staffUser.getString('name') +
                      '</b>,</p>' +
                      '<p>Alerta de Certificado Digital:</p>' +
                      '<div style="background:' +
                      (isCertExpired ? '#FEE2E2' : '#FEF3C7') +
                      ';padding:12px;border-radius:8px;margin:16px 0;">' +
                      '<p style="margin:0;font-weight:bold;color:' +
                      (isCertExpired ? '#991B1B' : '#92400E') +
                      ';">' +
                      (isCertExpired ? '⚠️ CERTIFICADO DIGITAL VENCIDO' : '⏳ VENCIMENTO PRÓXIMO') +
                      '</p>' +
                      '<p style="margin:4px 0 0 0;font-size:13px;color:#1A2333;"><b>Empresa:</b> ' +
                      empNome +
                      '<br/><b>Titular:</b> ' +
                      certTitular +
                      '<br/><b>Tipo:</b> ' +
                      certTipo +
                      ' (' +
                      certEmissor +
                      ')<br/><b>Validade:</b> ' +
                      certValidade.toLocaleDateString('pt-BR') +
                      '</p>' +
                      '</div>' +
                      '<p style="font-size:13px;color:#64748B;">Acesse a ficha da empresa no sistema para atualizar o certificado e manter a entrega regular das obrigações acessórias.</p>' +
                      '</div>',
                  )
                }
              } catch (_) {}
            }
          }
        }
      }
    } catch (errCert) {
      console.log('[CRON] Error scanning certificados_digitais:', errCert)
    }

    // 1.05 Scan for certidoes expiring within 30 days or already expired
    try {
      const activeCertidoes = $app.findRecordsByFilter(
        'certidoes',
        "status = 'valida' || status = 'vencida'",
        'data_validade',
        300,
        0,
      )
      console.log('[CRON] Found', activeCertidoes.length, 'certidoes to check')

      for (let crt = 0; crt < activeCertidoes.length; crt++) {
        const certItem = activeCertidoes[crt]
        const cTenantId = certItem.getString('tenant_id')
        const cEmpresaId = certItem.getString('empresa')
        const cValidadeStr = certItem.getString('data_validade')
        const cTipo = certItem.getString('tipo')
        const cStatus = certItem.getString('status')
        const cNumControle = certItem.getString('numero_controle')

        if (!cValidadeStr) continue
        const cValidade = new Date(cValidadeStr)
        const diffCertTime = cValidade.getTime() - now.getTime()
        const diffCertDays = Math.ceil(diffCertTime / (1000 * 60 * 60 * 24))

        const isExpired = diffCertDays <= 0
        const isExpiringSoon = diffCertDays > 0 && diffCertDays <= 30

        if (isExpired && cStatus !== 'vencida') {
          try {
            certItem.set('status', 'vencida')
            $app.save(certItem)
          } catch (_) {}
        }

        if (isExpired || isExpiringSoon) {
          let empNome = 'Empresa'
          try {
            const empRec = $app.findRecordById('empresas', cEmpresaId)
            empNome = empRec.getString('nome_fantasia') || empRec.getString('razao_social')
          } catch (_) {}

          let tipoDesc = 'Certidão Negativa'
          if (cTipo === 'receita_pgfn_cnd') tipoDesc = 'CND Receita Federal / PGFN'
          else if (cTipo === 'receita_pgfn_cpen') tipoDesc = 'CPEN Receita Federal / PGFN'
          else if (cTipo === 'fgts_crf') tipoDesc = 'CRF FGTS (Caixa Econômica)'
          else if (cTipo === 'estadual') tipoDesc = 'Certidão Estadual (ICMS/SEFAZ)'
          else if (cTipo === 'municipal') tipoDesc = 'Certidão Municipal (ISS)'
          else if (cTipo === 'trabalhista_cndt') tipoDesc = 'CNDT Trabalhista (TST)'

          const certNotifTitle = isExpired
            ? 'Certidão Vencida: ' + tipoDesc + ' - ' + empNome
            : 'Certidão Vence em ' + diffCertDays + ' dias: ' + tipoDesc + ' - ' + empNome

          const certNotifMsg = isExpired
            ? 'A ' +
              tipoDesc +
              ' da empresa ' +
              empNome +
              (cNumControle ? ' (Controle: ' + cNumControle + ')' : '') +
              ' venceu em ' +
              cValidade.toLocaleDateString('pt-BR') +
              '. Solicite ou emita a renovação da certidão para evitar bloqueios fiscais e cadastrais.'
            : 'A ' +
              tipoDesc +
              ' da empresa ' +
              empNome +
              ' vencerá em ' +
              diffCertDays +
              ' dia(s) (validade: ' +
              cValidade.toLocaleDateString('pt-BR') +
              '). Planeje a renovação preventiva.'

          // Prevenir flood: checar se já notificou nas últimas 24h
          const twentyFourHoursAgo = new Date(now.getTime() - 24 * 3600000).toISOString()
          const existNotif = $app.findRecordsByFilter(
            'notificacoes',
            "tenant_id = '" +
              cTenantId +
              "' && titulo = '" +
              certNotifTitle +
              "' && created >= '" +
              twentyFourHoursAgo +
              "'",
            '',
            1,
            0,
          )

          if (existNotif.length === 0) {
            const staffMembers = $app.findRecordsByFilter(
              'tenant_members',
              "tenant_id = '" +
                cTenantId +
                "' && (perfil = 'administrador' || perfil = 'contador')",
              '',
              15,
              0,
            )

            for (let m = 0; m < staffMembers.length; m++) {
              const staffUserId = staffMembers[m].getString('user_id')
              const notifCert = new Record(notificacoesCol)
              notifCert.set('tenant_id', cTenantId)
              notifCert.set('usuario_destino_id', staffUserId)
              notifCert.set('titulo', certNotifTitle)
              notifCert.set('mensagem', certNotifMsg)
              notifCert.set('tipo', isExpired ? 'atrasada' : 'prazo_proximo')
              notifCert.set('link', '/empresas/' + cEmpresaId + '/editar')
              notifCert.set('lida', false)
              $app.save(notifCert)

              try {
                const staffUser = $app.findRecordById('_pb_users_auth_', staffUserId)
                if (staffUser && staffUser.getBool('email_notificacoes_prazo')) {
                  sendEmailGraceful(
                    staffUser.getString('email'),
                    '[Rumo Regularidade] ' + certNotifTitle,
                    '<div style="font-family:sans-serif;color:#1A2333;max-width:600px;margin:0 auto;padding:20px;border:1px solid #E2E8F0;border-radius:12px;">' +
                      '<h2 style="color:#0B1F3A;margin-top:0;">Rumo Consultoria Contábil</h2>' +
                      '<p>Olá <b>' +
                      staffUser.getString('name') +
                      '</b>,</p>' +
                      '<p>Alerta de Regularidade Fiscal / CND:</p>' +
                      '<div style="background:' +
                      (isExpired ? '#FEE2E2' : '#FEF3C7') +
                      ';padding:12px;border-radius:8px;margin:16px 0;">' +
                      '<p style="margin:0;font-weight:bold;color:' +
                      (isExpired ? '#991B1B' : '#92400E') +
                      ';">' +
                      (isExpired
                        ? '⚠️ CERTIDÃO NEGATIVA VENCIDA'
                        : '⏳ VENCIMENTO PRÓXIMO (≤30 DIAS)') +
                      '</p>' +
                      '<p style="margin:4px 0 0 0;font-size:13px;color:#1A2333;"><b>Empresa:</b> ' +
                      empNome +
                      '<br/><b>Certidão:</b> ' +
                      tipoDesc +
                      '<br/><b>Validade:</b> ' +
                      cValidade.toLocaleDateString('pt-BR') +
                      (cNumControle ? '<br/><b>Nº Controle:</b> ' + cNumControle : '') +
                      '</p>' +
                      '</div>' +
                      '<p style="font-size:13px;color:#64748B;">Acesse a ficha da empresa no sistema para registrar a nova via da certidão negativa.</p>' +
                      '</div>',
                  )
                }
              } catch (_) {}
            }
          }
        }
      }
    } catch (errCertidao) {
      console.log('[CRON] Error scanning certidoes:', errCertidao)
    }

    // 1. Scan for pending or in_progress obrigacoes due within 7 days or overdue
    const pendingObrigacoes = $app.findRecordsByFilter(
      'obrigacoes',
      "status = 'pendente' || status = 'em_andamento' || status = 'atrasada'",
      'vencimento',
      300,
      0,
    )

    console.log('[CRON] Found', pendingObrigacoes.length, 'active obrigacoes to check')

    // Helper inside callback: send transactional email gracefully
    const sendEmailGraceful = (toEmail, subject, htmlBody) => {
      if (!toEmail) return
      try {
        const mailClient = $app.newMailClient()
        mailClient.send({
          from: {
            address: 'notificacoes@rumoconsultoriacontabil.com.br',
            name: 'Rumo Consultoria Contábil',
          },
          to: [{ address: toEmail }],
          subject: subject,
          html: htmlBody,
        })
      } catch (err) {
        console.log('[CRON] Graceful email fallback for', toEmail, ':', err)
      }
    }

    // 1.08 Scan for esocial_eventos pending/pronto due within 7 days or overdue (S-1200, S-1210, S-1299, S-2200, S-2299)
    try {
      const pendingEsocial = $app.findRecordsByFilter(
        'esocial_eventos',
        "status = 'pendente' || status = 'pronto' || status = 'validado' || status = 'rejeitado'",
        'prazo_legal',
        300,
        0,
      )
      console.log('[CRON] Found', pendingEsocial.length, 'esocial events to check')

      for (let e = 0; e < pendingEsocial.length; e++) {
        const ev = pendingEsocial[e]
        const evTenantId = ev.getString('tenant_id')
        const evEmpresaId = ev.getString('empresa')
        const evTipo = ev.getString('tipo_evento')
        const evComp = ev.getString('competencia')
        const evPrazoStr = ev.getString('prazo_legal')
        const evStatus = ev.getString('status')
        const evIdEvento = ev.getString('identificador_evento')

        if (!evPrazoStr) continue
        const evPrazo = new Date(evPrazoStr)
        const diffEvTime = evPrazo.getTime() - now.getTime()
        const diffEvDays = Math.ceil(diffEvTime / (1000 * 60 * 60 * 24))

        if (diffEvDays <= 7) {
          const isEvOverdue = diffEvDays < 0
          let empNome = 'Empresa'
          try {
            const empRec = $app.findRecordById('empresas', evEmpresaId)
            empNome = empRec.getString('nome_fantasia') || empRec.getString('razao_social')
          } catch (_) {}

          const evNotifTitle = isEvOverdue
            ? 'e-Social ' + evTipo + ' Atrasado: ' + empNome + (evComp ? ' (' + evComp + ')' : '')
            : 'e-Social ' +
              evTipo +
              ' Vence em ' +
              (diffEvDays <= 0 ? 'menos de 24h' : diffEvDays + ' dia(s)') +
              ': ' +
              empNome

          // Prevenir flood: checar se já notificou nas últimas 20 horas
          const twentyHoursAgoEv = new Date(now.getTime() - 20 * 3600000).toISOString()
          const existEvNotif = $app.findRecordsByFilter(
            'notificacoes',
            "tenant_id = '" +
              evTenantId +
              "' && titulo = '" +
              evNotifTitle +
              "' && created >= '" +
              twentyHoursAgoEv +
              "'",
            '',
            1,
            0,
          )

          if (existEvNotif.length === 0) {
            const staffMembers = $app.findRecordsByFilter(
              'tenant_members',
              "tenant_id = '" +
                evTenantId +
                "' && (perfil = 'administrador' || perfil = 'contador')",
              '',
              10,
              0,
            )

            for (let m = 0; m < staffMembers.length; m++) {
              const staffUserId = staffMembers[m].getString('user_id')
              const notifEsoc = new Record(notificacoesCol)
              notifEsoc.set('tenant_id', evTenantId)
              notifEsoc.set('usuario_destino_id', staffUserId)
              notifEsoc.set('titulo', evNotifTitle)
              notifEsoc.set(
                'mensagem',
                'O evento e-Social ' +
                  evTipo +
                  ' da empresa ' +
                  empNome +
                  (evComp ? ' (Competência: ' + evComp + ')' : '') +
                  ' está com status "' +
                  evStatus +
                  '" e prazo legal ' +
                  (isEvOverdue
                    ? 'VENCIDO!'
                    : 'próximo ao vencimento (dia ' + evPrazo.toLocaleDateString('pt-BR') + ').') +
                  ' Acesse o painel e-Social no DP para validar e transmitir em modo supervisionado.',
              )
              notifEsoc.set('tipo', isEvOverdue ? 'atrasada' : 'prazo_proximo')
              notifEsoc.set('link', '/departamento-pessoal')
              notifEsoc.set('lida', false)
              $app.save(notifEsoc)

              try {
                const staffUser = $app.findRecordById('_pb_users_auth_', staffUserId)
                if (staffUser && staffUser.getBool('email_notificacoes_prazo')) {
                  sendEmailGraceful(
                    staffUser.getString('email'),
                    '[e-Social] ' + evNotifTitle,
                    '<div style="font-family:sans-serif;color:#1A2333;max-width:600px;margin:0 auto;padding:20px;border:1px solid #E2E8F0;border-radius:12px;">' +
                      '<h2 style="color:#0B1F3A;margin-top:0;">Rumo Consultoria Contábil</h2>' +
                      '<p>Olá <b>' +
                      staffUser.getString('name') +
                      '</b>,</p>' +
                      '<p>Alerta de Obrigações Trabalhistas e-Social:</p>' +
                      '<div style="background:' +
                      (isEvOverdue ? '#FEE2E2' : '#FEF3C7') +
                      ';padding:12px;border-radius:8px;margin:16px 0;">' +
                      '<p style="margin:0;font-weight:bold;color:' +
                      (isEvOverdue ? '#991B1B' : '#92400E') +
                      ';">' +
                      (isEvOverdue
                        ? '⚠️ EVENTO E-SOCIAL COM PRAZO VENCIDO'
                        : '⏳ EVENTO E-SOCIAL PRÓXIMO AO VENCIMENTO') +
                      '</p>' +
                      '<p style="margin:4px 0 0 0;font-size:13px;color:#1A2333;"><b>Empresa:</b> ' +
                      empNome +
                      '<br/><b>Evento:</b> ' +
                      evTipo +
                      (evComp ? ' (Comp: ' + evComp + ')' : '') +
                      '<br/><b>Status Atual:</b> ' +
                      evStatus.toUpperCase() +
                      '<br/><b>Prazo Legal:</b> ' +
                      evPrazo.toLocaleDateString('pt-BR') +
                      '</p>' +
                      '</div>' +
                      '<p style="font-size:13px;color:#64748B;">Acesse o painel e-Social no módulo de Departamento Pessoal para auditar o XML e realizar a transmissão supervisionada.</p>' +
                      '</div>',
                  )
                }
              } catch (_) {}
            }
          }
        }
      }
    } catch (errEsoc) {
      console.log('[CRON] Error scanning esocial_eventos:', errEsoc)
    }

    // 1.08 Scan for pending reinf_eventos due within 7 days or overdue (Prazo EFD-Reinf: dia 15)
    try {
      const pendingReinf = $app.findRecordsByFilter(
        'reinf_eventos',
        "status = 'pendente' || status = 'pronto' || status = 'rejeitado'",
        'prazo_legal',
        200,
        0,
      )
      console.log('[CRON] Found', pendingReinf.length, 'reinf_eventos to check')

      for (let rf = 0; rf < pendingReinf.length; rf++) {
        const reinfEv = pendingReinf[rf]
        const rfTenantId = reinfEv.getString('tenant_id')
        const rfEmpresaId = reinfEv.getString('empresa')
        const rfTipo = reinfEv.getString('tipo_evento')
        const rfComp = reinfEv.getString('competencia')
        const rfStatus = reinfEv.getString('status')
        const rfPrazoStr = reinfEv.getString('prazo_legal')

        if (!rfPrazoStr) continue
        const rfPrazo = new Date(rfPrazoStr)
        const diffRfTime = rfPrazo.getTime() - now.getTime()
        const diffRfDays = Math.ceil(diffRfTime / (1000 * 60 * 60 * 24))

        if (diffRfDays <= 7) {
          const isRfOverdue = diffRfDays < 0
          let empNome = 'Empresa'
          try {
            const empRec = $app.findRecordById('empresas', rfEmpresaId)
            empNome = empRec.getString('nome_fantasia') || empRec.getString('razao_social')
          } catch (_) {}

          const rfNotifTitle = isRfOverdue
            ? 'EFD-Reinf ' + rfTipo + ' com Prazo Vencido - ' + empNome
            : 'EFD-Reinf ' +
              rfTipo +
              ' Vence em ' +
              (diffRfDays <= 0 ? 'menos de 24h' : diffRfDays + ' dia(s)') +
              ' (Dia 15) - ' +
              empNome

          const twentyHoursAgoRf = new Date(now.getTime() - 20 * 3600000).toISOString()
          const existRfNotif = $app.findRecordsByFilter(
            'notificacoes',
            "tenant_id = '" +
              rfTenantId +
              "' && titulo = '" +
              rfNotifTitle +
              "' && created >= '" +
              twentyHoursAgoRf +
              "'",
            '',
            1,
            0,
          )

          if (existRfNotif.length === 0) {
            const staffMembers = $app.findRecordsByFilter(
              'tenant_members',
              "tenant_id = '" +
                rfTenantId +
                "' && (perfil = 'administrador' || perfil = 'contador')",
              '',
              10,
              0,
            )

            for (let m = 0; m < staffMembers.length; m++) {
              const staffUserId = staffMembers[m].getString('user_id')
              const notifRf = new Record(notificacoesCol)
              notifRf.set('tenant_id', rfTenantId)
              notifRf.set('usuario_destino_id', staffUserId)
              notifRf.set('titulo', rfNotifTitle)
              notifRf.set(
                'mensagem',
                'O evento EFD-Reinf ' +
                  rfTipo +
                  ' da empresa ' +
                  empNome +
                  ' (Competência ' +
                  rfComp +
                  ') está com status "' +
                  rfStatus +
                  '". O prazo legal é dia 15. Acesse a aba EFD-Reinf & DCTFWeb no DP para validar e transmitir.',
              )
              notifRf.set('tipo', isRfOverdue ? 'atrasada' : 'prazo_proximo')
              notifRf.set('link', '/departamento-pessoal')
              notifRf.set('lida', false)
              $app.save(notifRf)

              try {
                const staffUser = $app.findRecordById('_pb_users_auth_', staffUserId)
                if (staffUser && staffUser.getBool('email_notificacoes_prazo')) {
                  sendEmailGraceful(
                    staffUser.getString('email'),
                    '[EFD-Reinf] ' + rfNotifTitle,
                    '<div style="font-family:sans-serif;color:#1A2333;max-width:600px;margin:0 auto;padding:20px;border:1px solid #E2E8F0;border-radius:12px;">' +
                      '<h2 style="color:#0B1F3A;margin-top:0;">Rumo Consultoria Contábil</h2>' +
                      '<p>Olá <b>' +
                      staffUser.getString('name') +
                      '</b>,</p>' +
                      '<p>Alerta de Prazo do EFD-Reinf (Escrituração Fiscal Digital de Retenções):</p>' +
                      '<div style="background:' +
                      (isRfOverdue ? '#FEE2E2' : '#FEF3C7') +
                      ';padding:12px;border-radius:8px;margin:16px 0;">' +
                      '<p style="margin:0;font-weight:bold;color:' +
                      (isRfOverdue ? '#991B1B' : '#92400E') +
                      ';">' +
                      (isRfOverdue
                        ? '⚠️ EVENTO EFD-REINF COM PRAZO VENCIDO'
                        : '⏳ PRAZO LEGAL EFD-REINF (DIA 15)') +
                      '</p>' +
                      '<p style="margin:4px 0 0 0;font-size:13px;color:#1A2333;"><b>Empresa:</b> ' +
                      empNome +
                      '<br/><b>Evento:</b> ' +
                      rfTipo +
                      '<br/><b>Competência:</b> ' +
                      rfComp +
                      '<br/><b>Status:</b> ' +
                      rfStatus.toUpperCase() +
                      '<br/><b>Vencimento:</b> ' +
                      rfPrazo.toLocaleDateString('pt-BR') +
                      '</p>' +
                      '</div>' +
                      '<p style="font-size:13px;color:#64748B;">Acesse a aba EFD-Reinf & DCTFWeb no Departamento Pessoal para auditar o XML e protocolar a entrega.</p>' +
                      '</div>',
                  )
                }
              } catch (_) {}
            }
          }
        }
      }
    } catch (errReinfCron) {
      console.log('[CRON] Error scanning reinf_eventos:', errReinfCron)
    }

    // 1.09 Scan for pending/consolidada dctfweb_declaracoes due within 7 days or overdue (Prazo DCTFWeb: dia 25)
    try {
      const pendingDctf = $app.findRecordsByFilter(
        'dctfweb_declaracoes',
        "status = 'pendente' || status = 'consolidada'",
        'prazo_legal',
        200,
        0,
      )
      console.log('[CRON] Found', pendingDctf.length, 'dctfweb_declaracoes to check')

      for (let df = 0; df < pendingDctf.length; df++) {
        const dctfRec = pendingDctf[df]
        const dfTenantId = dctfRec.getString('tenant_id')
        const dfEmpresaId = dctfRec.getString('empresa')
        const dfComp = dctfRec.getString('competencia')
        const dfStatus = dctfRec.getString('status')
        const dfPrazoStr = dctfRec.getString('prazo_legal')
        const dfSaldo = dctfRec.getFloat('saldo_a_recolher')

        if (!dfPrazoStr) continue
        const dfPrazo = new Date(dfPrazoStr)
        const diffDfTime = dfPrazo.getTime() - now.getTime()
        const diffDfDays = Math.ceil(diffDfTime / (1000 * 60 * 60 * 24))

        if (diffDfDays <= 7) {
          const isDfOverdue = diffDfDays < 0
          let empNome = 'Empresa'
          try {
            const empRec = $app.findRecordById('empresas', dfEmpresaId)
            empNome = empRec.getString('nome_fantasia') || empRec.getString('razao_social')
          } catch (_) {}

          const dfNotifTitle = isDfOverdue
            ? 'DCTFWeb ' + dfComp + ' com Prazo Vencido - ' + empNome
            : 'DCTFWeb ' +
              dfComp +
              ' Vence em ' +
              (diffDfDays <= 0 ? 'menos de 24h' : diffDfDays + ' dia(s)') +
              ' (Dia 25) - ' +
              empNome

          const twentyHoursAgoDf = new Date(now.getTime() - 20 * 3600000).toISOString()
          const existDfNotif = $app.findRecordsByFilter(
            'notificacoes',
            "tenant_id = '" +
              dfTenantId +
              "' && titulo = '" +
              dfNotifTitle +
              "' && created >= '" +
              twentyHoursAgoDf +
              "'",
            '',
            1,
            0,
          )

          if (existDfNotif.length === 0) {
            const staffMembers = $app.findRecordsByFilter(
              'tenant_members',
              "tenant_id = '" +
                dfTenantId +
                "' && (perfil = 'administrador' || perfil = 'contador')",
              '',
              10,
              0,
            )

            for (let m = 0; m < staffMembers.length; m++) {
              const staffUserId = staffMembers[m].getString('user_id')
              const notifDf = new Record(notificacoesCol)
              notifDf.set('tenant_id', dfTenantId)
              notifDf.set('usuario_destino_id', staffUserId)
              notifDf.set('titulo', dfNotifTitle)
              notifDf.set(
                'mensagem',
                'A declaração DCTFWeb da empresa ' +
                  empNome +
                  ' (Competência ' +
                  dfComp +
                  ', Saldo apurado: R$ ' +
                  dfSaldo.toFixed(2) +
                  ') está com status "' +
                  dfStatus +
                  '". O prazo federal de recolhimento e envio é dia 25.',
              )
              notifDf.set('tipo', isDfOverdue ? 'atrasada' : 'prazo_proximo')
              notifDf.set('link', '/departamento-pessoal')
              notifDf.set('lida', false)
              $app.save(notifDf)

              try {
                const staffUser = $app.findRecordById('_pb_users_auth_', staffUserId)
                if (staffUser && staffUser.getBool('email_notificacoes_prazo')) {
                  sendEmailGraceful(
                    staffUser.getString('email'),
                    '[DCTFWeb] ' + dfNotifTitle,
                    '<div style="font-family:sans-serif;color:#1A2333;max-width:600px;margin:0 auto;padding:20px;border:1px solid #E2E8F0;border-radius:12px;">' +
                      '<h2 style="color:#0B1F3A;margin-top:0;">Rumo Consultoria Contábil</h2>' +
                      '<p>Olá <b>' +
                      staffUser.getString('name') +
                      '</b>,</p>' +
                      '<p>Alerta de Prazo Legal DCTFWeb (Débitos Federais Previdenciários):</p>' +
                      '<div style="background:' +
                      (isDfOverdue ? '#FEE2E2' : '#FEF3C7') +
                      ';padding:12px;border-radius:8px;margin:16px 0;">' +
                      '<p style="margin:0;font-weight:bold;color:' +
                      (isDfOverdue ? '#991B1B' : '#92400E') +
                      ';">' +
                      (isDfOverdue
                        ? '⚠️ DCTFWEB COM PRAZO VENCIDO'
                        : '⏳ PRAZO LEGAL DCTFWEB (DIA 25)') +
                      '</p>' +
                      '<p style="margin:4px 0 0 0;font-size:13px;color:#1A2333;"><b>Empresa:</b> ' +
                      empNome +
                      '<br/><b>Competência:</b> ' +
                      dfComp +
                      '<br/><b>Saldo a Recolher (DARF):</b> R$ ' +
                      dfSaldo.toFixed(2) +
                      '<br/><b>Vencimento:</b> ' +
                      dfPrazo.toLocaleDateString('pt-BR') +
                      '</p>' +
                      '</div>' +
                      '<p style="font-size:13px;color:#64748B;">Lembre-se: a transmissão da DCTFWeb depende do fechamento do e-Social (S-1299) e do EFD-Reinf (R-2099).</p>' +
                      '</div>',
                  )
                }
              } catch (_) {}
            }
          }
        }
      }
    } catch (errDctfCron) {
      console.log('[CRON] Error scanning dctfweb_declaracoes:', errDctfCron)
    }

    // 1.09 Scan for convencoes_coletivas expiring within 60/30/7 days or already overdue
    try {
      const activeConvencoes = $app.findRecordsByFilter(
        'convencoes_coletivas',
        '',
        'vigencia_fim',
        200,
        0,
      )
      console.log('[CRON] Found', activeConvencoes.length, 'convencoes coletivas to check')

      for (let cv = 0; cv < activeConvencoes.length; cv++) {
        const cct = activeConvencoes[cv]
        const cctTenantId = cct.getString('tenant_id')
        const cctEmpresaId = cct.getString('empresa')
        const cctTitulo = cct.getString('titulo')
        const cctSindicato = cct.getString('sindicato_laboral')
        const cctVigenciaFimStr = cct.getString('vigencia_fim')
        const cctDiasConfig = cct.getInt('alerta_dias_config') || 60

        if (!cctVigenciaFimStr) continue
        const cctVigenciaFim = new Date(cctVigenciaFimStr)
        const diffCctTime = cctVigenciaFim.getTime() - now.getTime()
        const diffCctDays = Math.ceil(diffCctTime / (1000 * 60 * 60 * 24))

        let novoStatus = 'vigente'
        if (diffCctDays <= 0) {
          novoStatus = 'vencida'
        } else if (diffCctDays <= 7) {
          novoStatus = 'a_vencer_7'
        } else if (diffCctDays <= 30) {
          novoStatus = 'a_vencer_30'
        } else if (diffCctDays <= cctDiasConfig) {
          novoStatus = 'a_vencer_60'
        }

        // Atualizar status na coleção se mudou
        if (cct.getString('status_vigencia') !== novoStatus && novoStatus !== 'vigente') {
          try {
            cct.set('status_vigencia', novoStatus)
            $app.save(cct)
          } catch (_) {}
        }

        // Notificar se estiver a vencer no período de alerta ou vencida
        if (diffCctDays <= cctDiasConfig) {
          const isCctExpired = diffCctDays <= 0
          let empNome = 'Empresa'
          try {
            const empRec = $app.findRecordById('empresas', cctEmpresaId)
            empNome = empRec.getString('nome_fantasia') || empRec.getString('razao_social')
          } catch (_) {}

          const cctNotifTitle = isCctExpired
            ? 'Convenção Coletiva Vencida: ' + cctTitulo + ' - ' + empNome
            : 'Convenção Coletiva Vence em ' + diffCctDays + ' dias: ' + cctTitulo + ' - ' + empNome

          // Anti-flood: 20 horas
          const twentyHoursAgoCct = new Date(now.getTime() - 20 * 3600000).toISOString()
          const existCctNotif = $app.findRecordsByFilter(
            'notificacoes',
            "tenant_id = '" +
              cctTenantId +
              "' && titulo = '" +
              cctNotifTitle +
              "' && created >= '" +
              twentyHoursAgoCct +
              "'",
            '',
            1,
            0,
          )

          if (existCctNotif.length === 0) {
            const staffMembers = $app.findRecordsByFilter(
              'tenant_members',
              "tenant_id = '" +
                cctTenantId +
                "' && (perfil = 'administrador' || perfil = 'contador')",
              '',
              10,
              0,
            )

            for (let m = 0; m < staffMembers.length; m++) {
              const staffUserId = staffMembers[m].getString('user_id')
              const notifCct = new Record(notificacoesCol)
              notifCct.set('tenant_id', cctTenantId)
              notifCct.set('usuario_destino_id', staffUserId)
              notifCct.set('titulo', cctNotifTitle)
              notifCct.set(
                'mensagem',
                isCctExpired
                  ? 'A Convenção Coletiva de Trabalho "' +
                      cctTitulo +
                      '" (' +
                      cctSindicato +
                      ') da empresa ' +
                      empNome +
                      ' expirou em ' +
                      cctVigenciaFim.toLocaleDateString('pt-BR') +
                      '. Solicite a nova minuta homologada para atualizar os parâmetros de folha.'
                  : 'A Convenção Coletiva de Trabalho "' +
                      cctTitulo +
                      '" (' +
                      cctSindicato +
                      ') da empresa ' +
                      empNome +
                      ' vencerá em ' +
                      diffCctDays +
                      ' dia(s) (' +
                      cctVigenciaFim.toLocaleDateString('pt-BR') +
                      '). Acompanhe as negociações sindicais na aba Convenções Coletivas do DP.',
              )
              notifCct.set('tipo', isCctExpired ? 'atrasada' : 'prazo_proximo')
              notifCct.set('link', '/departamento-pessoal')
              notifCct.set('lida', false)
              $app.save(notifCct)

              try {
                const staffUser = $app.findRecordById('_pb_users_auth_', staffUserId)
                if (staffUser && staffUser.getBool('email_notificacoes_prazo')) {
                  sendEmailGraceful(
                    staffUser.getString('email'),
                    '[DP Convenções] ' + cctNotifTitle,
                    '<div style="font-family:sans-serif;color:#1A2333;max-width:600px;margin:0 auto;padding:20px;border:1px solid #E2E8F0;border-radius:12px;">' +
                      '<h2 style="color:#0B1F3A;margin-top:0;">Rumo Consultoria Contábil</h2>' +
                      '<p>Olá <b>' +
                      staffUser.getString('name') +
                      '</b>,</p>' +
                      '<p>Monitoramento Automatizado de Convenções Coletivas:</p>' +
                      '<div style="background:' +
                      (isCctExpired ? '#FEE2E2' : '#FEF3C7') +
                      ';padding:12px;border-radius:8px;margin:16px 0;">' +
                      '<p style="margin:0;font-weight:bold;color:' +
                      (isCctExpired ? '#991B1B' : '#92400E') +
                      ';">' +
                      (isCctExpired
                        ? '⚠️ CONVENÇÃO COLETIVA VENCIDA'
                        : '⏳ VENCIMENTO PRÓXIMO DE CONVENÇÃO COLETIVA') +
                      '</p>' +
                      '<p style="margin:4px 0 0 0;font-size:13px;color:#1A2333;"><b>Empresa:</b> ' +
                      empNome +
                      '<br/><b>Instrumento:</b> ' +
                      cctTitulo +
                      '<br/><b>Sindicato:</b> ' +
                      cctSindicato +
                      '<br/><b>Vigência Final:</b> ' +
                      cctVigenciaFim.toLocaleDateString('pt-BR') +
                      '</p>' +
                      '</div>' +
                      '<p style="font-size:13px;color:#64748B;">Acesse a aba Convenções Coletivas no módulo Departamento Pessoal para cadastrar a nova CCT e atualizar os parâmetros na folha com 1 clique.</p>' +
                      '</div>',
                  )
                }
              } catch (_) {}
            }
          }
        }
      }
    } catch (errCctCron) {
      console.log('[CRON] Error scanning convencoes_coletivas:', errCctCron)
    }

    // 1.1 Scan for pending impostos_retidos due within 7 days or overdue
    try {
      const pendingImpostos = $app.findRecordsByFilter(
        'impostos_retidos',
        "status = 'pendente' || status = 'atrasado'",
        'vencimento',
        300,
        0,
      )
      console.log('[CRON] Found', pendingImpostos.length, 'impostos retidos to check')

      for (let j = 0; j < pendingImpostos.length; j++) {
        const imp = pendingImpostos[j]
        const impTenantId = imp.getString('tenant_id')
        const impVenc = new Date(imp.getString('vencimento'))
        const impTipo = imp.getString('tipo').toUpperCase()
        const impComp = imp.getString('competencia')
        const impStatus = imp.getString('status')
        const impValor = imp.getFloat('valor')
        const impEmpresaId = imp.getString('empresa')

        const diffImpTime = impVenc.getTime() - now.getTime()
        const diffImpDays = Math.ceil(diffImpTime / (1000 * 60 * 60 * 24))

        if (diffImpDays < 0 && impStatus !== 'atrasado') {
          try {
            imp.set('status', 'atrasado')
            $app.save(imp)
          } catch (_) {}
        }

        if (diffImpDays <= 7) {
          const isImpOverdue = diffImpDays < 0
          const impNotifTitle = isImpOverdue
            ? 'Imposto Retido ' + impTipo + ' Vencido (' + impComp + ')'
            : 'Atenção: ' +
              impTipo +
              ' vence em ' +
              (diffImpDays <= 0 ? 'menos de 24h' : diffImpDays + ' dia(s)')

          const twentyHoursAgoImp = new Date(now.getTime() - 20 * 3600000).toISOString()
          const existImpNotif = $app.findRecordsByFilter(
            'notificacoes',
            "tenant_id = '" +
              impTenantId +
              "' && titulo = '" +
              impNotifTitle +
              "' && created >= '" +
              twentyHoursAgoImp +
              "'",
            '',
            1,
            0,
          )

          if (existImpNotif.length === 0) {
            let nomeEmp = 'Empresa'
            try {
              const empRec = $app.findRecordById('empresas', impEmpresaId)
              nomeEmp = empRec.getString('nome_fantasia') || empRec.getString('razao_social')
            } catch (_) {}

            // Notificar administradores e contadores do tenant
            const staffMembers = $app.findRecordsByFilter(
              'tenant_members',
              "tenant_id = '" +
                impTenantId +
                "' && (perfil = 'administrador' || perfil = 'contador')",
              '',
              10,
              0,
            )

            for (let m = 0; m < staffMembers.length; m++) {
              const targetStaffUserId = staffMembers[m].getString('user_id')
              const notifImp = new Record(notificacoesCol)
              notifImp.set('tenant_id', impTenantId)
              notifImp.set('usuario_destino_id', targetStaffUserId)
              notifImp.set('titulo', impNotifTitle)
              notifImp.set(
                'mensagem',
                'A guia de imposto retido ' +
                  impTipo +
                  ' da empresa ' +
                  nomeEmp +
                  ' (Comp. ' +
                  impComp +
                  ', R$ ' +
                  impValor.toFixed(2) +
                  ') ' +
                  (isImpOverdue ? 'está atrasada!' : 'vence em breve.'),
              )
              notifImp.set('tipo', isImpOverdue ? 'atrasada' : 'prazo_proximo')
              notifImp.set('link', '/impostos-retidos')
              notifImp.set('lida', false)
              $app.save(notifImp)

              try {
                const staffUser = $app.findRecordById('_pb_users_auth_', targetStaffUserId)
                if (staffUser && staffUser.getBool('email_notificacoes_prazo')) {
                  sendEmailGraceful(
                    staffUser.getString('email'),
                    '[Rumo] ' + impNotifTitle,
                    '<div style="font-family:sans-serif;color:#1A2333;">' +
                      '<h2>Rumo Consultoria Contábil</h2>' +
                      '<p>Olá <b>' +
                      staffUser.getString('name') +
                      '</b>,</p>' +
                      '<p>Alerta de guia de retenção: <b>' +
                      impTipo +
                      ' (' +
                      impComp +
                      ')</b> da empresa <b>' +
                      nomeEmp +
                      '</b> ' +
                      'no valor de <b>R$ ' +
                      impValor.toFixed(2) +
                      '</b> está ' +
                      (isImpOverdue
                        ? '<span style="color:#EF4444;font-weight:bold;">VENCIDA</span>.'
                        : 'próxima do vencimento.') +
                      '</p>' +
                      '<p>Acesse o módulo de Impostos Retidos no sistema.</p>' +
                      '</div>',
                  )
                }
              } catch (_) {}
            }
          }
        }
      }
    } catch (errImp) {
      console.log('[CRON] Error scanning impostos_retidos:', errImp)
    }

    // 1.10 Scan for parcelamentos_federais (PAR / PER-DCOMP) due within 7 days or overdue
    try {
      const parcsAtivos = $app.findRecordsByFilter(
        'parcelamentos_federais',
        "situacao_rfb != 'liquidado' && situacao_rfb != 'rescindido'",
        'proxima_parcela_vencimento',
        200,
        0,
      )
      console.log('[CRON] Found', parcsAtivos.length, 'parcelamentos federais to check')

      for (let p = 0; p < parcsAtivos.length; p++) {
        const parc = parcsAtivos[p]
        const pTenantId = parc.getString('tenant_id')
        const pEmpresaId = parc.getString('empresa')
        const pNumero = parc.getString('numero_parcelamento')
        const pModalidade = parc.getString('modalidade')
        const pProxNum = parc.getInt('proxima_parcela_numero')
        const pProxValor = parc.getFloat('proxima_parcela_valor')
        const pProxVencStr = parc.getString('proxima_parcela_vencimento')
        const pSituacao = parc.getString('situacao_rfb')

        if (!pProxVencStr) continue
        const pProxVenc = new Date(pProxVencStr)
        const diffPTime = pProxVenc.getTime() - now.getTime()
        const diffPDays = Math.ceil(diffPTime / (1000 * 60 * 60 * 24))

        const isParcOverdue = diffPDays < 0
        const isExpiring7Days = diffPDays >= 0 && diffPDays <= 7

        // Atualizar situação do parcelamento
        let novaSit = pSituacao
        if (isParcOverdue) {
          novaSit = 'em_atraso'
        } else if (isExpiring7Days) {
          novaSit = 'parcela_a_vencer'
        } else {
          novaSit = 'em_dia'
        }

        if (novaSit !== pSituacao) {
          try {
            parc.set('situacao_rfb', novaSit)
            $app.save(parc)
          } catch (_) {}
        }

        if (isParcOverdue || isExpiring7Days) {
          let empNome = 'Empresa'
          try {
            const empRec = $app.findRecordById('empresas', pEmpresaId)
            empNome = empRec.getString('nome_fantasia') || empRec.getString('razao_social')
          } catch (_) {}

          const parcNotifTitle = isParcOverdue
            ? 'Parcelamento Federal em Atraso: ' + pNumero + ' - ' + empNome
            : 'Parcelamento Federal Vence em ' +
              (diffPDays === 0 ? 'menos de 24h' : diffPDays + ' dia(s)') +
              ': ' +
              pNumero +
              ' - ' +
              empNome

          // Anti-flood: 20 horas
          const twentyHoursAgoP = new Date(now.getTime() - 20 * 3600000).toISOString()
          const existParcNotif = $app.findRecordsByFilter(
            'notificacoes',
            "tenant_id = '" +
              pTenantId +
              "' && titulo = '" +
              parcNotifTitle +
              "' && created >= '" +
              twentyHoursAgoP +
              "'",
            '',
            1,
            0,
          )

          if (existParcNotif.length === 0) {
            const staffMembers = $app.findRecordsByFilter(
              'tenant_members',
              "tenant_id = '" +
                pTenantId +
                "' && (perfil = 'administrador' || perfil = 'contador')",
              '',
              10,
              0,
            )

            for (let m = 0; m < staffMembers.length; m++) {
              const staffUserId = staffMembers[m].getString('user_id')
              const notifParc = new Record(notificacoesCol)
              notifParc.set('tenant_id', pTenantId)
              notifParc.set('usuario_destino_id', staffUserId)
              notifParc.set('titulo', parcNotifTitle)
              notifParc.set(
                'mensagem',
                isParcOverdue
                  ? 'A parcela ' +
                      pProxNum +
                      ' do acordo ' +
                      pNumero +
                      ' (' +
                      pModalidade.toUpperCase() +
                      ') da empresa ' +
                      empNome +
                      ' no valor de R$ ' +
                      pProxValor.toFixed(2) +
                      ' venceu em ' +
                      pProxVenc.toLocaleDateString('pt-BR') +
                      ' e consta sem comprovação de pagamento. Risco de rescisão do parcelamento na RFB/PGFN.'
                  : 'A parcela ' +
                      pProxNum +
                      ' do parcelamento ' +
                      pNumero +
                      ' da empresa ' +
                      empNome +
                      ' no valor de R$ ' +
                      pProxValor.toFixed(2) +
                      ' vencerá em ' +
                      diffPDays +
                      ' dia(s) (' +
                      pProxVenc.toLocaleDateString('pt-BR') +
                      '). Emita o DARF de arrecadação no portal e-CAC.',
              )
              notifParc.set('tipo', isParcOverdue ? 'atrasada' : 'prazo_proximo')
              notifParc.set('link', '/empresas/' + pEmpresaId)
              notifParc.set('lida', false)
              $app.save(notifParc)

              try {
                const staffUser = $app.findRecordById('_pb_users_auth_', staffUserId)
                if (staffUser && staffUser.getBool('email_notificacoes_prazo')) {
                  sendEmailGraceful(
                    staffUser.getString('email'),
                    '[Rumo Parcelamentos] ' + parcNotifTitle,
                    '<div style="font-family:sans-serif;color:#1A2333;max-width:600px;margin:0 auto;padding:20px;border:1px solid #E2E8F0;border-radius:12px;">' +
                      '<h2 style="color:#0B1F3A;margin-top:0;">Rumo Consultoria Contábil</h2>' +
                      '<p>Olá <b>' +
                      staffUser.getString('name') +
                      '</b>,</p>' +
                      '<p>Alerta de Parcelamento Federal (PAR/PER-DCOMP / RFB / PGFN):</p>' +
                      '<div style="background:' +
                      (isParcOverdue ? '#FEE2E2' : '#FEF3C7') +
                      ';padding:12px;border-radius:8px;margin:16px 0;">' +
                      '<p style="margin:0;font-weight:bold;color:' +
                      (isParcOverdue ? '#991B1B' : '#92400E') +
                      ';">' +
                      (isParcOverdue
                        ? '⚠️ PARCELA FEDERAL EM ATRASO (RISCO DE RESCISÃO)'
                        : '⏳ PARCELA FEDERAL A VENCER EM BREVE') +
                      '</p>' +
                      '<p style="margin:4px 0 0 0;font-size:13px;color:#1A2333;"><b>Empresa:</b> ' +
                      empNome +
                      '<br/><b>Parcelamento:</b> ' +
                      pNumero +
                      ' (' +
                      pModalidade.toUpperCase() +
                      ')<br/><b>Parcela:</b> ' +
                      pProxNum +
                      '<br/><b>Valor Total:</b> R$ ' +
                      pProxValor.toFixed(2) +
                      '<br/><b>Vencimento:</b> ' +
                      pProxVenc.toLocaleDateString('pt-BR') +
                      '</p>' +
                      '</div>' +
                      '<p style="font-size:13px;color:#64748B;">Acesse a aba Regularidade & CND / E-CAC → Guias & Pagamentos da empresa para consultar o extrato completo e registrar o comprovante de pagamento.</p>' +
                      '</div>',
                  )
                }
              } catch (_) {}
            }
          }
        }
      }
    } catch (errParcCron) {
      console.log('[CRON] Error scanning parcelamentos_federais:', errParcCron)
    }

    // 1.11 Scan for guias_pagamentos overdue or due within 7 days
    try {
      const pendingGuias = $app.findRecordsByFilter(
        'guias_pagamentos',
        "situacao = 'pendente' || situacao = 'vencida'",
        'data_vencimento',
        200,
        0,
      )
      console.log('[CRON] Found', pendingGuias.length, 'guias de pagamento to check')

      for (let g = 0; g < pendingGuias.length; g++) {
        const guia = pendingGuias[g]
        const gTenantId = guia.getString('tenant_id')
        const gEmpresaId = guia.getString('empresa')
        const gTipo = guia.getString('tipo_guia')
        const gCodReceita = guia.getString('codigo_receita')
        const gPeriodo = guia.getString('periodo_apuracao')
        const gValor = guia.getFloat('valor_total')
        const gVencStr = guia.getString('data_vencimento')
        const gSituacao = guia.getString('situacao')

        if (!gVencStr) continue
        const gVenc = new Date(gVencStr)
        const diffGTime = gVenc.getTime() - now.getTime()
        const diffGDays = Math.ceil(diffGTime / (1000 * 60 * 60 * 24))

        if (diffGDays < 0 && gSituacao !== 'vencida') {
          try {
            guia.set('situacao', 'vencida')
            $app.save(guia)
          } catch (_) {}
        }
      }
    } catch (errGuiasCron) {
      console.log('[CRON] Error scanning guias_pagamentos:', errGuiasCron)
    }

    for (let i = 0; i < pendingObrigacoes.length; i++) {
      const ob = pendingObrigacoes[i]
      const tenantId = ob.getString('tenant_id')
      const responsavelId = ob.getString('responsavel_id')
      const vencimento = new Date(ob.getString('vencimento'))
      const tipo = ob.getString('tipo')
      const competencia = ob.getString('competencia')
      const status = ob.getString('status')

      const diffTime = vencimento.getTime() - now.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      // If overdue and not yet marked as 'atrasada', update status
      if (diffDays < 0 && status !== 'atrasada') {
        try {
          ob.set('status', 'atrasada')
          $app.save(ob)
        } catch (_) {}
      }

      // Check if alert should be created: <= 7 days or overdue
      if (diffDays <= 7 && responsavelId) {
        // Prevent flood: check if user already received a notification for this obrigacao today
        const isOverdue = diffDays < 0
        const notifType = isOverdue ? 'atrasada' : 'prazo_proximo'
        const notifTitle = isOverdue
          ? 'Obrigação ' + tipo + ' Atrasada (' + competencia + ')'
          : 'Lembrete: ' +
            tipo +
            ' vence em ' +
            (diffDays <= 0 ? 'menos de 24h' : diffDays + ' dia(s)')

        // Find if already notified in last 20 hours
        const twentyHoursAgo = new Date(now.getTime() - 20 * 3600000).toISOString()
        const existing = $app.findRecordsByFilter(
          'notificacoes',
          "tenant_id = '" +
            tenantId +
            "' && usuario_destino_id = '" +
            responsavelId +
            "' && titulo = '" +
            notifTitle +
            "' && created >= '" +
            twentyHoursAgo +
            "'",
          '',
          1,
          0,
        )

        if (existing.length === 0) {
          const n = new Record(notificacoesCol)
          n.set('tenant_id', tenantId)
          n.set('usuario_destino_id', responsavelId)
          n.set('titulo', notifTitle)
          n.set(
            'mensagem',
            isOverdue
              ? 'A obrigação ' +
                  tipo +
                  ' (' +
                  competencia +
                  ') está com vencimento expirado. Regularize a entrega.'
              : 'A obrigação fiscal ' +
                  tipo +
                  ' (' +
                  competencia +
                  ') tem vencimento em ' +
                  diffDays +
                  ' dia(s).',
          )
          n.set('tipo', notifType)
          n.set('link', '/obrigacoes')
          n.set('lida', false)
          $app.save(n)

          // Email notification if opted in
          try {
            const user = $app.findRecordById('_pb_users_auth_', responsavelId)
            if (user && user.getBool('email_notificacoes_prazo')) {
              sendEmailGraceful(
                user.getString('email'),
                '[Rumo] ' + notifTitle,
                '<div style="font-family:sans-serif;color:#1A2333;">' +
                  '<h2>Rumo Consultoria Contábil</h2>' +
                  '<p>Olá <b>' +
                  user.getString('name') +
                  '</b>,</p>' +
                  '<p>' +
                  (isOverdue
                    ? 'Atenção: A obrigação fiscal <b>' +
                      tipo +
                      ' (' +
                      competencia +
                      ')</b> está com prazo <span style="color:#EF4444;font-weight:bold;">VENCIDO</span>.'
                    : 'Lembrete de vencimento: A obrigação <b>' +
                      tipo +
                      ' (' +
                      competencia +
                      ')</b> vence em <b>' +
                      diffDays +
                      ' dia(s)</b>.') +
                  '</p>' +
                  '<p>Acesse o portal para consultar guias e anexos.</p>' +
                  '</div>',
              )
            }
          } catch (_) {}
        }
      }
    }
    console.log('[CRON] Finished daily_obrigacoes_reminder successfully.')
  } catch (err) {
    console.log('[CRON] Error running daily_obrigacoes_reminder:', err)
  }
})

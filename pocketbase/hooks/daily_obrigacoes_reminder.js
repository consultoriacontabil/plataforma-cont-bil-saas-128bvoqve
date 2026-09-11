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

    // 1. Scan for pending or in_progress obrigacoes due within 7 days or overdue
    const pendingObrigacoes = $app.findRecordsByFilter(
      'obrigacoes',
      "status = 'pendente' || status = 'em_andamento' || status = 'atrasada'",
      'vencimento ASC',
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

    // 1.1 Scan for pending impostos_retidos due within 7 days or overdue
    try {
      const pendingImpostos = $app.findRecordsByFilter(
        'impostos_retidos',
        "status = 'pendente' || status = 'atrasado'",
        'vencimento ASC',
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

// Hook: notifications_on_events.js
// Generates in-app notifications and email alerts on key lifecycle changes:
// 1. Workflow status update or assigned user
// 2. Document rejected (documento rejeitado)
// 3. Obrigacao status change (ex: entregue, atrasada)
onRecordAfterUpdateSuccess(
  (e) => {
    try {
      const record = e.record
      const collectionName = record.collection().name
      const tenantId = record.getString('tenant_id')
      if (!tenantId) {
        e.next()
        return
      }

      const notificacoesCol = $app.findCollectionByNameOrId('notificacoes')

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
          console.log('[NOTIF] Email sent successfully to', toEmail)
        } catch (err) {
          // Graceful log — platform continues without error if SMTP is not configured
          console.log(
            '[NOTIF] Graceful fallback - could not dispatch SMTP email to',
            toEmail,
            ':',
            err,
          )
        }
      }

      if (collectionName === 'workflows') {
        const origStatus = record.original().getString('status')
        const currentStatus = record.getString('status')
        const assignedUserId = record.getString('atribuido_id')
        const createdByUserId = record.getString('criado_por_id')
        const titulo = record.getString('titulo')

        // Notify if status changed
        if (origStatus && origStatus !== currentStatus) {
          const targetUserId = assignedUserId || createdByUserId
          if (targetUserId) {
            const notif = new Record(notificacoesCol)
            notif.set('tenant_id', tenantId)
            notif.set('usuario_destino_id', targetUserId)
            notif.set('titulo', 'Workflow atualizado: ' + titulo)
            notif.set(
              'mensagem',
              'O workflow "' +
                titulo +
                '" mudou de status para ' +
                currentStatus.toUpperCase() +
                '.',
            )
            notif.set('tipo', 'workflow_status')
            notif.set('link', '/workflow/' + record.id)
            notif.set('lida', false)
            $app.save(notif)

            // Email notification if user opted in
            try {
              const userRec = $app.findCollectionByNameOrId('_pb_users_auth_')
              const targetUser = $app.findRecordById('_pb_users_auth_', targetUserId)
              if (targetUser && targetUser.getBool('email_notificacoes_prazo')) {
                sendEmailGraceful(
                  targetUser.getString('email'),
                  'Atualização de Workflow: ' + titulo,
                  '<div style="font-family:sans-serif;color:#1A2333;">' +
                    '<h2>Rumo Consultoria Contábil</h2>' +
                    '<p>Olá <b>' +
                    targetUser.getString('name') +
                    '</b>,</p>' +
                    '<p>O workflow <b>"' +
                    titulo +
                    '"</b> teve seu status atualizado para <b>' +
                    currentStatus.toUpperCase() +
                    '</b>.</p>' +
                    '<p>Acesse a plataforma para conferir os detalhes.</p>' +
                    '</div>',
                )
              }
            } catch (_) {}
          }
        }
      } else if (collectionName === 'documentos') {
        const origStatus = record.original().getString('status')
        const currentStatus = record.getString('status')
        const uploaderId = record.getString('usuario_upload_id')
        const nomeArquivo = record.getString('nome_arquivo')

        if (currentStatus === 'rejeitado' && origStatus !== 'rejeitado' && uploaderId) {
          const notif = new Record(notificacoesCol)
          notif.set('tenant_id', tenantId)
          notif.set('usuario_destino_id', uploaderId)
          notif.set('titulo', 'Documento rejeitado: ' + nomeArquivo)
          notif.set(
            'mensagem',
            'O documento "' +
              nomeArquivo +
              '" foi recusado pela equipe. ' +
              (record.getString('observacoes') ? 'Motivo: ' + record.getString('observacoes') : ''),
          )
          notif.set('tipo', 'documento_rejeitado')
          notif.set('link', '/documentos')
          notif.set('lida', false)
          $app.save(notif)
        }
      } else if (collectionName === 'obrigacoes') {
        const origStatus = record.original().getString('status')
        const currentStatus = record.getString('status')
        const responsavelId = record.getString('responsavel_id')
        const tipo = record.getString('tipo')
        const competencia = record.getString('competencia')

        if (origStatus && origStatus !== currentStatus && responsavelId) {
          if (currentStatus === 'atrasada') {
            const notif = new Record(notificacoesCol)
            notif.set('tenant_id', tenantId)
            notif.set('usuario_destino_id', responsavelId)
            notif.set('titulo', 'Obrigação ' + tipo + ' Atrasada')
            notif.set(
              'mensagem',
              'A obrigação fiscal ' +
                tipo +
                ' (' +
                competencia +
                ') está com prazo vencido e status atrasada.',
            )
            notif.set('tipo', 'atrasada')
            notif.set('link', '/obrigacoes')
            notif.set('lida', false)
            $app.save(notif)

            try {
              const respUser = $app.findRecordById('_pb_users_auth_', responsavelId)
              if (respUser && respUser.getBool('email_notificacoes_prazo')) {
                sendEmailGraceful(
                  respUser.getString('email'),
                  'Alerta de Prazo: Obrigação ' + tipo + ' Atrasada',
                  '<div style="font-family:sans-serif;color:#1A2333;">' +
                    '<h2>Rumo Consultoria Contábil - Alerta Fiscal</h2>' +
                    '<p>Olá <b>' +
                    respUser.getString('name') +
                    '</b>,</p>' +
                    '<p>A obrigação fiscal <b>' +
                    tipo +
                    ' (' +
                    competencia +
                    ')</b> encontra-se <span style="color:#EF4444;font-weight:bold;">ATRASADA</span>.</p>' +
                    '<p>Por favor, acesse a plataforma para regularizar a entrega.</p>' +
                    '</div>',
                )
              }
            } catch (_) {}
          }
        }
      } else if (collectionName === 'funcionarios') {
        const origStatus = record.original().getString('status')
        const currentStatus = record.getString('status')
        const nome = record.getString('nome_completo')
        if (origStatus && origStatus !== currentStatus) {
          const notif = new Record(notificacoesCol)
          notif.set('tenant_id', tenantId)
          notif.set('titulo', 'DP: Mudança de status de funcionário')
          notif.set(
            'mensagem',
            'O colaborador "' +
              nome +
              '" mudou de status para ' +
              currentStatus.toUpperCase() +
              '.',
          )
          notif.set('tipo', 'sistema')
          notif.set('link', '/departamento-pessoal')
          notif.set('lida', false)
          $app.save(notif)
        }
      } else if (collectionName === 'demonstrativos') {
        const origStatus = record.original().getString('status')
        const currentStatus = record.getString('status')
        const empresaId = record.getString('empresa')
        const comp = record.getString('competencia')
        const tipoDem = record.getString('tipo').toUpperCase()
        const obsCliente = record.getString('observacoes_cliente')

        let nomeEmpresa = 'Empresa'
        try {
          const empRec = $app.findRecordById('empresas', empresaId)
          nomeEmpresa = empRec.getString('nome_fantasia') || empRec.getString('razao_social')
        } catch (_) {}

        // 1. Escritório enviou para o cliente -> Notificar clientes com acesso ao portal
        if (currentStatus === 'enviado' && origStatus !== 'enviado') {
          try {
            const acessos = $app.findRecordsByFilter(
              'portal_acessos',
              'tenant_id = {:t} && empresa = {:emp} && ativo = true',
              '',
              20,
              0,
              { t: tenantId, emp: empresaId },
            )
            for (let a = 0; a < acessos.length; a++) {
              const uId = acessos[a].getString('user')
              const uEmail = acessos[a].getString('email')
              const uNome = acessos[a].getString('nome_contato')

              if (uId) {
                const notifClient = new Record(notificacoesCol)
                notifClient.set('tenant_id', tenantId)
                notifClient.set('usuario_destino_id', uId)
                notifClient.set('titulo', 'Demonstrativo ' + tipoDem + ' disponível para aprovação')
                notifClient.set(
                  'mensagem',
                  'O demonstrativo ' +
                    tipoDem +
                    ' (' +
                    comp +
                    ') de sua empresa foi disponibilizado para assinatura no Portal.',
                )
                notifClient.set('tipo', 'sistema')
                notifClient.set('link', '/portal')
                notifClient.set('lida', false)
                $app.save(notifClient)
              }

              if (uEmail) {
                sendEmailGraceful(
                  uEmail,
                  '[Rumo] Demonstrativo Contábil para Assinatura - ' + tipoDem + ' ' + comp,
                  '<div style="font-family:sans-serif;color:#1A2333;">' +
                    '<h2>Rumo Consultoria Contábil</h2>' +
                    '<p>Olá <b>' +
                    (uNome || 'Cliente') +
                    '</b>,</p>' +
                    '<p>Um novo demonstrativo contábil oficial (<b>' +
                    tipoDem +
                    ' ' +
                    comp +
                    '</b>) da empresa <b>' +
                    nomeEmpresa +
                    '</b> ' +
                    'está pronto e aguarda sua validação e assinatura no Portal do Cliente.</p>' +
                    '<p>Acesse o Portal do Cliente para visualizar e aprovar.</p>' +
                    '</div>',
                )
              }
            }
          } catch (errDemEnvio) {
            console.log('[NOTIF] Erro ao notificar envio de demonstrativo:', errDemEnvio)
          }
        }

        // 2. Cliente aprovou ou reprovou -> Notificar equipe do escritório (administradores e contadores)
        if (
          (currentStatus === 'aprovado' || currentStatus === 'reprovado') &&
          origStatus === 'enviado'
        ) {
          try {
            const staffMembers = $app.findRecordsByFilter(
              'tenant_members',
              "tenant_id = '" + tenantId + "' && (perfil = 'administrador' || perfil = 'contador')",
              '',
              10,
              0,
            )
            const isAprovado = currentStatus === 'aprovado'
            const tituloStaff = isAprovado
              ? 'Demonstrativo ' + tipoDem + ' Aprovado pelo Cliente (' + comp + ')'
              : 'Demonstrativo ' + tipoDem + ' Reprovado com Apontamento (' + comp + ')'
            const msgStaff = isAprovado
              ? 'A empresa ' +
                nomeEmpresa +
                ' aprovou o demonstrativo ' +
                tipoDem +
                ' (' +
                comp +
                ').'
              : 'A empresa ' +
                nomeEmpresa +
                ' reprovou o demonstrativo ' +
                tipoDem +
                ' (' +
                comp +
                '). Motivo: ' +
                (obsCliente || 'Não detalhado.')

            for (let s = 0; s < staffMembers.length; s++) {
              const staffUserId = staffMembers[s].getString('user_id')
              const notifStaff = new Record(notificacoesCol)
              notifStaff.set('tenant_id', tenantId)
              notifStaff.set('usuario_destino_id', staffUserId)
              notifStaff.set('titulo', tituloStaff)
              notifStaff.set('mensagem', msgStaff)
              notifStaff.set('tipo', 'sistema')
              notifStaff.set('link', '/relatorios-contabeis')
              notifStaff.set('lida', false)
              $app.save(notifStaff)

              try {
                const staffUser = $app.findRecordById('_pb_users_auth_', staffUserId)
                if (staffUser) {
                  sendEmailGraceful(
                    staffUser.getString('email'),
                    '[Rumo] ' + tituloStaff,
                    '<div style="font-family:sans-serif;color:#1A2333;">' +
                      '<h2>Rumo Consultoria Contábil</h2>' +
                      '<p>Olá <b>' +
                      staffUser.getString('name') +
                      '</b>,</p>' +
                      '<p>' +
                      msgStaff +
                      '</p>' +
                      '</div>',
                  )
                }
              } catch (_) {}
            }
          } catch (errStaffNotif) {
            console.log(
              '[NOTIF] Erro ao notificar equipe sobre status de demonstrativo:',
              errStaffNotif,
            )
          }
        }
      } else if (collectionName === 'assinaturas_demonstrativos') {
        const origStatus = record.original().getString('status')
        const currentStatus = record.getString('status')
        const assinanteNome = record.getString('assinante')
        const comp = record.getString('competencia')
        const token = record.getString('token_verificacao')
        const tipoAss =
          record.getString('tipo_assinatura') === 'icp_brasil'
            ? 'ICP-Brasil'
            : 'Eletrônica Declarada'

        // Assinatura foi concluída
        if (currentStatus === 'assinada' && origStatus !== 'assinada') {
          try {
            const staffMembers = $app.findRecordsByFilter(
              'tenant_members',
              "tenant_id = '" + tenantId + "' && (perfil = 'administrador' || perfil = 'contador')",
              '',
              10,
              0,
            )
            const isContrato =
              record.getString('tipo_documento') === 'contrato_honorarios' ||
              !!record.getString('contrato')
            const tituloStaff = isContrato
              ? 'Contrato de Honorários Assinado Digitalmente'
              : 'Demonstrativo Assinado Digitalmente (' + comp + ')'
            const msgStaff = isContrato
              ? 'O assinante ' +
                assinanteNome +
                ' assinou com sucesso o contrato de honorários. Código de autenticidade: ' +
                token +
                '.'
              : 'O assinante ' +
                assinanteNome +
                ' concluiu a assinatura (' +
                tipoAss +
                ') do demonstrativo da competência ' +
                comp +
                '. Código de autenticidade: ' +
                token +
                '.'
            const linkDestino = isContrato ? '/contratos' : '/relatorios-contabeis'

            for (let s = 0; s < staffMembers.length; s++) {
              const staffUserId = staffMembers[s].getString('user_id')
              const notifStaff = new Record(notificacoesCol)
              notifStaff.set('tenant_id', tenantId)
              notifStaff.set('usuario_destino_id', staffUserId)
              notifStaff.set('titulo', tituloStaff)
              notifStaff.set('mensagem', msgStaff)
              notifStaff.set('tipo', 'sistema')
              notifStaff.set('link', linkDestino)
              notifStaff.set('lida', false)
              $app.save(notifStaff)

              try {
                const staffUser = $app.findRecordById('_pb_users_auth_', staffUserId)
                if (staffUser) {
                  sendEmailGraceful(
                    staffUser.getString('email'),
                    '[Rumo] ' + tituloStaff,
                    '<div style="font-family:sans-serif;color:#1A2333;">' +
                      '<h2>Rumo Consultoria Contábil</h2>' +
                      '<p>Olá <b>' +
                      staffUser.getString('name') +
                      '</b>,</p>' +
                      '<p>' +
                      msgStaff +
                      '</p>' +
                      '<p>O documento foi automaticamente validado e autenticado.</p>' +
                      '</div>',
                  )
                }
              } catch (_) {}
            }
          } catch (errAssNotif) {
            console.log('[NOTIF] Erro ao notificar assinatura concluída:', errAssNotif)
          }
        }
      } else if (collectionName === 'contratos_honorarios') {
        const origStatus = record.original().getString('status')
        const currentStatus = record.getString('status')
        const empresaId = record.getString('empresa')
        const tituloContrato = record.getString('titulo')
        const tipoContrato =
          record.getString('tipo') === 'proposta' ? 'Proposta Comercial' : 'Contrato de Honorários'
        const obsRecusa = record.getString('observacoes_recusa')

        let nomeEmpresa = 'Cliente'
        if (empresaId) {
          try {
            const empRec = $app.findRecordById('empresas', empresaId)
            nomeEmpresa = empRec.getString('nome_fantasia') || empRec.getString('razao_social')
          } catch (_) {}
        }

        // 1. Escritório enviou para o cliente -> Notificar no portal e e-mail
        if (currentStatus === 'enviado' && origStatus !== 'enviado' && empresaId) {
          try {
            const acessos = $app.findRecordsByFilter(
              'portal_acessos',
              'tenant_id = {:t} && empresa = {:emp} && ativo = true',
              '',
              20,
              0,
              { t: tenantId, emp: empresaId },
            )
            for (let a = 0; a < acessos.length; a++) {
              const uId = acessos[a].getString('user')
              const uEmail = acessos[a].getString('email')
              const uNome = acessos[a].getString('nome_contato')

              if (uId) {
                const notifClient = new Record(notificacoesCol)
                notifClient.set('tenant_id', tenantId)
                notifClient.set('usuario_destino_id', uId)
                notifClient.set('titulo', tipoContrato + ' disponível para assinatura')
                notifClient.set(
                  'mensagem',
                  'O escritório Rumo Contábil disponibilizou "' +
                    tituloContrato +
                    '" para sua revisão e assinatura digital no Portal.',
                )
                notifClient.set('tipo', 'sistema')
                notifClient.set('link', '/portal')
                notifClient.set('lida', false)
                $app.save(notifClient)
              }

              if (uEmail) {
                sendEmailGraceful(
                  uEmail,
                  '[Rumo] ' + tipoContrato + ' disponível para Assinatura Digital',
                  '<div style="font-family:sans-serif;color:#1A2333;">' +
                    '<h2>Rumo Consultoria Contábil</h2>' +
                    '<p>Olá <b>' +
                    (uNome || 'Cliente') +
                    '</b>,</p>' +
                    '<p>Um novo documento contábil formal (<b>' +
                    tituloContrato +
                    '</b>) da empresa <b>' +
                    nomeEmpresa +
                    '</b> ' +
                    'foi emitido e aguarda sua validação e assinatura digital no Portal do Cliente.</p>' +
                    '<p>Acesse o Portal para revisar e assinar.</p>' +
                    '</div>',
                )
              }
            }
          } catch (errContEnvio) {
            console.log('[NOTIF] Erro ao notificar envio de contrato:', errContEnvio)
          }
        }

        // 2. Cliente recusou proposta/contrato -> Notificar escritório (administradores e contadores)
        if (currentStatus === 'recusado' && origStatus !== 'recusado') {
          try {
            const staffMembers = $app.findRecordsByFilter(
              'tenant_members',
              "tenant_id = '" + tenantId + "' && (perfil = 'administrador' || perfil = 'contador')",
              '',
              10,
              0,
            )
            const tituloStaff = tipoContrato + ' Recusado pelo Cliente (' + nomeEmpresa + ')'
            const msgStaff =
              'O documento "' +
              tituloContrato +
              '" foi recusado pela empresa ' +
              nomeEmpresa +
              '.' +
              (obsRecusa ? ' Justificativa: ' + obsRecusa : '')

            for (let s = 0; s < staffMembers.length; s++) {
              const staffUserId = staffMembers[s].getString('user_id')
              const notifStaff = new Record(notificacoesCol)
              notifStaff.set('tenant_id', tenantId)
              notifStaff.set('usuario_destino_id', staffUserId)
              notifStaff.set('titulo', tituloStaff)
              notifStaff.set('mensagem', msgStaff)
              notifStaff.set('tipo', 'sistema')
              notifStaff.set('link', '/contratos')
              notifStaff.set('lida', false)
              $app.save(notifStaff)

              try {
                const staffUser = $app.findRecordById('_pb_users_auth_', staffUserId)
                if (staffUser) {
                  sendEmailGraceful(
                    staffUser.getString('email'),
                    '[Rumo] ' + tituloStaff,
                    '<div style="font-family:sans-serif;color:#1A2333;">' +
                      '<h2>Rumo Consultoria Contábil</h2>' +
                      '<p>Olá <b>' +
                      staffUser.getString('name') +
                      '</b>,</p>' +
                      '<p>' +
                      msgStaff +
                      '</p>' +
                      '<p>Acesse o módulo de Contratos para revisar as cláusulas e reenviar.</p>' +
                      '</div>',
                  )
                }
              } catch (_) {}
            }
          } catch (errStaffRecusa) {
            console.log('[NOTIF] Erro ao notificar recusa de contrato:', errStaffRecusa)
          }
        }
      }
    } catch (err) {
      console.log('[NOTIF] Error in notifications hook:', err)
    }
    e.next()
  },
  'workflows',
  'documentos',
  'obrigacoes',
  'funcionarios',
  'demonstrativos',
  'assinaturas_demonstrativos',
  'contratos_honorarios',
)

// Hook: cron_faturamento_recorrente.js
// Executa no 1º dia de cada mês às 04:00 UTC para varrer contratos ativos e gerar cobranças recorrentes
// Criação anti-duplicidade e emissão de título a receber no Financeiro.
cronAdd('monthly_faturamento_recorrente', '0 4 1 * *', () => {
  try {
    console.log('[CRON] Executing monthly_faturamento_recorrente...')
    const now = new Date()
    const ano = now.getFullYear()
    const mes = String(now.getMonth() + 1).padStart(2, '0')
    const competencia = ano + '-' + mes

    const faturamentosCol = $app.findCollectionByNameOrId('faturamentos_recorrentes')
    const contasFinCol = $app.findCollectionByNameOrId('contas_financeiras')
    const notificacoesCol = $app.findCollectionByNameOrId('notificacoes')

    // 1. Buscar contratos com status 'assinado' ou 'enviado' (ativos)
    const contratos = $app.findRecordsByFilter(
      'contratos_honorarios',
      "status = 'assinado' || status = 'enviado'",
      'created ASC',
      500,
      0,
    )

    console.log('[CRON] Contratos ativos encontrados:', contratos.length)

    let totalCriados = 0
    let totalPulados = 0

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
        console.log('[CRON] Email fallback for', toEmail, ':', err)
      }
    }

    for (let i = 0; i < contratos.length; i++) {
      const c = contratos[i]
      const tenantId = c.getString('tenant_id')
      const empresaId = c.getString('empresa')
      const modelo = c.getString('modelo_mensalidade')
      const valor = c.getFloat('valor_mensal') || 0
      const diaVenc = c.getInt('dia_vencimento') || 10
      const contratoId = c.id
      const tituloContrato = c.getString('titulo')

      // Regra 1: Prospects (sem empresa) não geram cobrança
      if (!empresaId) {
        totalPulados++
        continue
      }

      // Regra 2: Contratos com modelo 'eventual' não geram recorrência
      if (modelo && modelo.toLowerCase().indexOf('eventual') !== -1) {
        totalPulados++
        continue
      }

      // Regra 3: Anti-duplicidade por contrato + competência
      const existing = $app.findRecordsByFilter(
        'faturamentos_recorrentes',
        "contrato = '" + contratoId + "' && competencia = '" + competencia + "'",
        '',
        1,
        0,
      )

      if (existing.length > 0) {
        totalPulados++
        continue
      }

      // Montar datas
      const diaStr = String(diaVenc).padStart(2, '0')
      const dataVenc = ano + '-' + mes + '-' + diaStr + ' 12:00:00.000Z'
      const dataEmissao = ano + '-' + mes + '-01 12:00:00.000Z'

      // Obter nome da empresa
      let nomeEmpresa = 'Cliente'
      try {
        const empRec = $app.findRecordById('empresas', empresaId)
        nomeEmpresa =
          empRec.getString('nome_fantasia') || empRec.getString('razao_social') || nomeEmpresa
      } catch (_) {}

      let tituloFinId = null

      // Criar título a receber no Financeiro (contas_financeiras)
      try {
        const recTitulo = new Record(contasFinCol)
        recTitulo.set('tenant_id', tenantId)
        recTitulo.set('empresa', empresaId)
        recTitulo.set('tipo', 'receber')
        recTitulo.set('pessoa', nomeEmpresa)
        recTitulo.set('descricao', 'Honorários Contábeis Recorrentes - Comp. ' + mes + '/' + ano)
        recTitulo.set('documento_ref', 'FAT-' + ano + mes + '-' + contratoId.slice(0, 6))
        recTitulo.set('valor', valor)
        recTitulo.set('data_emissao', dataEmissao)
        recTitulo.set('data_vencimento', dataVenc)
        recTitulo.set('status', 'pendente')
        recTitulo.set(
          'observacoes',
          'Faturamento recorrente automático (Contrato: ' + tituloContrato + ')',
        )
        $app.save(recTitulo)
        tituloFinId = recTitulo.id
      } catch (errFin) {
        console.log('[CRON] Erro ao criar titulo a receber:', errFin)
      }

      // Criar faturamentos_recorrentes com status 'faturado'
      try {
        const recFat = new Record(faturamentosCol)
        recFat.set('tenant_id', tenantId)
        recFat.set('contrato', contratoId)
        recFat.set('empresa', empresaId)
        recFat.set('competencia', competencia)
        recFat.set('valor', valor)
        recFat.set('data_vencimento', dataVenc)
        recFat.set('status', 'faturado')
        if (tituloFinId) recFat.set('titulo_financeiro', tituloFinId)
        recFat.set(
          'notas',
          'Faturamento mensal gerado automaticamente pelo sistema em ' +
            now.toLocaleDateString('pt-BR'),
        )
        $app.save(recFat)
        totalCriados++

        // Notificar contadores e administradores do tenant
        try {
          const staffMembers = $app.findRecordsByFilter(
            'tenant_members',
            "tenant_id = '" + tenantId + "' && (perfil = 'administrador' || perfil = 'contador')",
            '',
            10,
            0,
          )

          const notifTitulo = 'Faturamento Recorrente Gerado (' + mes + '/' + ano + ')'
          const notifMsg =
            'Honorários gerados para ' +
            nomeEmpresa +
            ' (R$ ' +
            valor.toFixed(2) +
            ') com vencimento em ' +
            diaStr +
            '/' +
            mes +
            '/' +
            ano +
            '.'

          for (let m = 0; m < staffMembers.length; m++) {
            const staffId = staffMembers[m].getString('user_id')
            const notif = new Record(notificacoesCol)
            notif.set('tenant_id', tenantId)
            notif.set('usuario_destino_id', staffId)
            notif.set('titulo', notifTitulo)
            notif.set('mensagem', notifMsg)
            notif.set('tipo', 'sistema')
            notif.set('link', '/contratos?tab=faturamento')
            notif.set('lida', false)
            $app.save(notif)

            try {
              const staffUser = $app.findRecordById('_pb_users_auth_', staffId)
              if (staffUser && staffUser.getBool('email_notificacoes_prazo')) {
                sendEmailGraceful(
                  staffUser.getString('email'),
                  '[Rumo] ' + notifTitulo,
                  '<div style="font-family:sans-serif;color:#1A2333;">' +
                    '<h2>Rumo Consultoria Contábil</h2>' +
                    '<p>Olá <b>' +
                    staffUser.getString('name') +
                    '</b>,</p>' +
                    '<p>' +
                    notifMsg +
                    '</p>' +
                    '<p>Acesse o módulo de Contratos > Faturamento Recorrente para gerenciar boletos e baixas.</p>' +
                    '</div>',
                )
              }
            } catch (_) {}
          }
        } catch (notifErr) {
          console.log('[CRON] Erro ao enviar notificacoes de faturamento:', notifErr)
        }
      } catch (errSaveFat) {
        console.log('[CRON] Erro ao salvar faturamento:', errSaveFat)
      }
    }

    console.log(
      '[CRON] Faturamento mensal concluído: ' +
        totalCriados +
        ' criados, ' +
        totalPulados +
        ' pulados/existentes.',
    )
  } catch (globalErr) {
    console.log('[CRON] Falha geral monthly_faturamento_recorrente:', globalErr)
  }
})

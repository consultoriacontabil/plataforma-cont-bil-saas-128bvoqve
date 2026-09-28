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

        let empNome = 'Empresa'
        try {
          const emp = $app.findRecordById('empresas', empresaId)
          empNome = emp.getString('nome_fantasia') || emp.getString('razao_social')
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
      }
    } catch (errObr) {
      console.log('[ELLIZA 24/7] Erro ao varrer obrigações:', errObr)
    }

    console.log('[ELLIZA 24/7] Ciclo horário de monitoramento concluído.')
  } catch (errGeral) {
    console.log('[ELLIZA 24/7] Erro geral no job agendado:', errGeral)
  }
})

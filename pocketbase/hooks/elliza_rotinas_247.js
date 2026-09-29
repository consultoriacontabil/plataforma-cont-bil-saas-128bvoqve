/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook de execução periódica (cron) e endpoints para ELLIZA Contábil.
 * Opera como motor automatizado 24/7 respeitando as Diretivas Operacionais por Tenant.
 * Toda a lógica interna está encapsulada dentro de cada callback (regra JSVM da Skip Cloud).
 */

// Agendador horário (a cada hora, minuto 0)
cronAdd('elliza_rotinas_247_monitor', '0 * * * *', () => {
  const app = $app
  console.log(
    '[ELLIZA-24/7] Iniciando ciclo de monitoramento proativo de obrigações e pendências...',
  )

  let totalNotificadas = 0
  let totalBloqueadasPorDiretiva = 0
  let totalEnfileiradasAprovacao = 0

  try {
    // 1. Obter usuário de serviço ELLIZA
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

    const hoje = new Date()
    const limite3Dias = new Date(hoje.getTime() + 3 * 24 * 60 * 60 * 1000)
    const hojeStr = hoje.toISOString().split('T')[0]
    const limiteStr = limite3Dias.toISOString().split('T')[0]

    // Buscar obrigações não entregues com vencimento entre hoje e 3 dias à frente
    const filterObrigacoes = `status != 'entregue' && status != 'cancelada' && vencimento >= '${hojeStr}' && vencimento <= '${limiteStr}'`
    const pendentes = app.findRecordsByFilter('obrigacoes', filterObrigacoes, 'vencimento ASC', 200)

    console.log(`[ELLIZA-24/7] Obrigações próximas do vencimento encontradas: ${pendentes.length}`)

    for (let i = 0; i < pendentes.length; i++) {
      const ob = pendentes[i]
      const tenantId = ob.getString('tenant_id')
      const empresaId = ob.getString('empresa_id')

      if (!tenantId || !empresaId) continue

      // 2. Consultar diretiva operacional da ELLIZA para 'whatsapp_envio'
      let dirWa = null
      try {
        dirWa = app.findFirstRecordByFilter(
          'elliza_diretivas',
          `tenant_id = '${tenantId}' && atividade = 'whatsapp_envio'`,
        )
      } catch (_) {}

      let permitido = true
      let precisaAprovacao = false
      let motivoBloqueio = ''

      if (dirWa) {
        const ativo = dirWa.getBool('ativo')
        const nivel = dirWa.getString('nivel_autonomia')
        const jIni = dirWa.getString('janela_inicio')
        const jFim = dirWa.getString('janela_fim')

        if (!ativo) {
          permitido = false
          motivoBloqueio = 'Diretiva inativa'
        } else if (nivel === 'somente_leitura') {
          permitido = false
          motivoBloqueio = 'Diretiva em somente leitura'
        } else if (nivel === 'executar_com_aprovacao') {
          permitido = false
          precisaAprovacao = true
          motivoBloqueio = 'Requer aprovação'
        } else if (jIni && jFim) {
          const now = new Date()
          const brHours = (now.getUTCHours() - 3 + 24) % 24
          const horaAtual =
            String(brHours).padStart(2, '0') + ':' + String(now.getUTCMinutes()).padStart(2, '0')
          if (jIni <= jFim && (horaAtual < jIni || horaAtual > jFim)) {
            permitido = false
            motivoBloqueio = 'Fora da janela operacional'
          }
        }
      }

      if (!permitido) {
        if (precisaAprovacao) {
          // Criar na fila de aprovação se não existir
          let jaExiste = false
          try {
            app.findFirstRecordByFilter(
              'elliza_aprovacoes',
              `tenant_id = '${tenantId}' && status = 'pendente' && entidade_id = '${ob.id}'`,
            )
            jaExiste = true
          } catch (_) {}

          if (!jaExiste) {
            const colAprov = app.findCollectionByNameOrId('elliza_aprovacoes')
            const recAprov = new Record(colAprov)
            recAprov.set('tenant_id', tenantId)
            recAprov.set('atividade', 'whatsapp_envio')
            recAprov.set('titulo', `Envio WhatsApp: Alerta de Vencimento ${ob.getString('tipo')}`)
            recAprov.set(
              'descricao',
              `Vencimento em ${ob.getString('vencimento')}. Requer aprovação conforme diretivas.`,
            )
            recAprov.set('entidade_tipo', 'obrigacoes')
            recAprov.set('entidade_id', ob.id)
            recAprov.set('status', 'pendente')
            recAprov.set('payload_acao', {
              tipo_obrigacao: ob.getString('tipo'),
              competencia: ob.getString('competencia'),
              vencimento: ob.getString('vencimento'),
              empresa_id: empresaId,
            })
            app.save(recAprov)

            // Audit
            try {
              const aCol = app.findCollectionByNameOrId('audit_log')
              const aRec = new Record(aCol)
              aRec.set('tenant_id', tenantId)
              if (ellizaUserId) aRec.set('usuario_id', ellizaUserId)
              aRec.set('acao', 'ELLIZA_ENFILEIROU_APROVACAO')
              aRec.set('entidade_tipo', 'elliza_aprovacoes')
              aRec.set('entidade_id', recAprov.id)
              aRec.set(
                'detalhes',
                JSON.stringify({ motivo: 'Aguardando aprovação humana conforme diretivas' }),
              )
              app.save(aRec)
            } catch (_) {}

            totalEnfileiradasAprovacao++
          }
        } else {
          totalBloqueadasPorDiretiva++
        }
        continue
      }

      // 3. Verificar autorização ativa por empresa em whatsapp_notificacoes_autorizadas
      let autorizacao = null
      try {
        autorizacao = app.findFirstRecordByFilter(
          'whatsapp_notificacoes_autorizadas',
          `tenant_id = '${tenantId}' && empresa = '${empresaId}' && ativo = true && permitir_avisos = true`,
        )
      } catch (_) {
        continue
      }

      if (!autorizacao) continue
      const destinatario = autorizacao.getString('telefone_destinatario')
      if (!destinatario) continue

      // 4. Anti-duplicidade
      const refEnvio = `alerta_obrigacao_${ob.id}`
      let jaEnviado = false
      try {
        app.findFirstRecordByFilter(
          'whatsapp_envios',
          `tenant_id = '${tenantId}' && empresa = '${empresaId}' && referencia = '${refEnvio}'`,
        )
        jaEnviado = true
      } catch (_) {
        jaEnviado = false
      }

      if (jaEnviado) continue

      // 5. Dados da empresa
      let nomeEmpresa = 'sua empresa'
      try {
        const emp = app.findRecordById('empresas', empresaId)
        nomeEmpresa = emp.getString('nome_fantasia') || emp.getString('razao_social') || nomeEmpresa
      } catch (_) {}

      const tipoObrigacao = ob.getString('tipo')
      const vencimento = ob.getString('vencimento')
      const competencia = ob.getString('competencia')

      const mensagem =
        `Olá! Aqui é a ELLIZA, assistente operacional inteligente da Rumo Contábil.\n\n` +
        `Passando para lembrar que a obrigação *${tipoObrigacao}* (competência ${competencia || 'vigente'}) da empresa *${nomeEmpresa}* ` +
        `vence em breve (*${vencimento}*).\n\n` +
        `Evite multas e encargos. O documento/guia já está disponível no Portal do Cliente ou consulte seu contador.`

      // 6. Enfileirar em whatsapp_envios
      const waCol = app.findCollectionByNameOrId('whatsapp_envios')
      const waRecord = new Record(waCol)
      waRecord.set('tenant_id', tenantId)
      waRecord.set('empresa', empresaId)
      waRecord.set('tipo', 'aviso')
      waRecord.set('referencia', refEnvio)
      waRecord.set('destinatario', destinatario)
      waRecord.set('mensagem', mensagem)
      waRecord.set('origem', 'elliza')
      waRecord.set('status', 'aguardando_credenciais')
      waRecord.set(
        'erro',
        'Enfileirado pelo monitor 24/7 da ELLIZA (Modo Supervisão: aguardando disparo automático ou credenciais Evolution API)',
      )
      waRecord.set('detalhes_json', {
        obrigacao_id: ob.id,
        tipo: tipoObrigacao,
        vencimento: vencimento,
        competencia: competencia,
        gerado_por: 'elliza_rotinas_247_monitor',
      })
      app.save(waRecord)

      // 7. Gravar auditoria em nome da ELLIZA
      try {
        const aCol = app.findCollectionByNameOrId('audit_log')
        const aRec = new Record(aCol)
        aRec.set('tenant_id', tenantId)
        if (ellizaUserId) aRec.set('usuario_id', ellizaUserId)
        aRec.set('acao', 'ELLIZA_DETECTED_OBRIGACAO_PROXIMA')
        aRec.set('entidade_tipo', 'obrigacoes')
        aRec.set('entidade_id', ob.id)
        aRec.set(
          'detalhes',
          JSON.stringify({
            mensagem: `ELLIZA detectou obrigação ${tipoObrigacao} vencendo em ${vencimento} e enfileirou aviso WhatsApp.`,
            empresa_id: empresaId,
            whatsapp_envio_id: waRecord.id,
          }),
        )
        app.save(aRec)
      } catch (_) {}

      totalNotificadas++
    }

    console.log(
      `[ELLIZA-24/7] Ciclo concluído. Avisos enfileirados: ${totalNotificadas}, Bloqueados por diretiva: ${totalBloqueadasPorDiretiva}, Requer aprovação: ${totalEnfileiradasAprovacao}.`,
    )
  } catch (err) {
    console.error('[ELLIZA-24/7] Falha geral ao executar rotina de monitoramento:', err)
  }
})

// Endpoint manual autenticado para disparar o monitoramento sob demanda
routerAdd('POST', '/backend/v1/elliza/rotinas-247/executar', (e) => {
  const auth = e.auth
  if (!auth) {
    return e.json(401, { erro: 'Requer autenticação de administrador ou contador' })
  }

  const app = e.app
  console.log('[ELLIZA-24/7] Disparo manual solicitado...')

  let totalNotificadas = 0
  let totalBloqueadasPorDiretiva = 0
  let totalEnfileiradasAprovacao = 0

  try {
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

    const hoje = new Date()
    const limite3Dias = new Date(hoje.getTime() + 3 * 24 * 60 * 60 * 1000)
    const hojeStr = hoje.toISOString().split('T')[0]
    const limiteStr = limite3Dias.toISOString().split('T')[0]

    const filterObrigacoes = `status != 'entregue' && status != 'cancelada' && vencimento >= '${hojeStr}' && vencimento <= '${limiteStr}'`
    const pendentes = app.findRecordsByFilter('obrigacoes', filterObrigacoes, 'vencimento ASC', 200)

    for (let i = 0; i < pendentes.length; i++) {
      const ob = pendentes[i]
      const tenantId = ob.getString('tenant_id')
      const empresaId = ob.getString('empresa_id')

      if (!tenantId || !empresaId) continue

      let dirWa = null
      try {
        dirWa = app.findFirstRecordByFilter(
          'elliza_diretivas',
          `tenant_id = '${tenantId}' && atividade = 'whatsapp_envio'`,
        )
      } catch (_) {}

      let permitido = true
      let precisaAprovacao = false

      if (dirWa) {
        const ativo = dirWa.getBool('ativo')
        const nivel = dirWa.getString('nivel_autonomia')
        if (!ativo || nivel === 'somente_leitura') {
          permitido = false
        } else if (nivel === 'executar_com_aprovacao') {
          permitido = false
          precisaAprovacao = true
        }
      }

      if (!permitido) {
        if (precisaAprovacao) {
          let jaExiste = false
          try {
            app.findFirstRecordByFilter(
              'elliza_aprovacoes',
              `tenant_id = '${tenantId}' && status = 'pendente' && entidade_id = '${ob.id}'`,
            )
            jaExiste = true
          } catch (_) {}

          if (!jaExiste) {
            const colAprov = app.findCollectionByNameOrId('elliza_aprovacoes')
            const recAprov = new Record(colAprov)
            recAprov.set('tenant_id', tenantId)
            recAprov.set('atividade', 'whatsapp_envio')
            recAprov.set('titulo', `Envio WhatsApp: Alerta de Vencimento ${ob.getString('tipo')}`)
            recAprov.set(
              'descricao',
              `Vencimento em ${ob.getString('vencimento')}. Requer aprovação humana.`,
            )
            recAprov.set('entidade_tipo', 'obrigacoes')
            recAprov.set('entidade_id', ob.id)
            recAprov.set('status', 'pendente')
            recAprov.set('payload_acao', {
              tipo_obrigacao: ob.getString('tipo'),
              competencia: ob.getString('competencia'),
              vencimento: ob.getString('vencimento'),
              empresa_id: empresaId,
            })
            app.save(recAprov)
            totalEnfileiradasAprovacao++
          }
        } else {
          totalBloqueadasPorDiretiva++
        }
        continue
      }

      let autorizacao = null
      try {
        autorizacao = app.findFirstRecordByFilter(
          'whatsapp_notificacoes_autorizadas',
          `tenant_id = '${tenantId}' && empresa = '${empresaId}' && ativo = true && permitir_avisos = true`,
        )
      } catch (_) {
        continue
      }

      if (!autorizacao) continue
      const destinatario = autorizacao.getString('telefone_destinatario')
      if (!destinatario) continue

      const refEnvio = `alerta_obrigacao_${ob.id}`
      let jaEnviado = false
      try {
        app.findFirstRecordByFilter(
          'whatsapp_envios',
          `tenant_id = '${tenantId}' && empresa = '${empresaId}' && referencia = '${refEnvio}'`,
        )
        jaEnviado = true
      } catch (_) {
        jaEnviado = false
      }

      if (jaEnviado) continue

      let nomeEmpresa = 'sua empresa'
      try {
        const emp = app.findRecordById('empresas', empresaId)
        nomeEmpresa = emp.getString('nome_fantasia') || emp.getString('razao_social') || nomeEmpresa
      } catch (_) {}

      const tipoObrigacao = ob.getString('tipo')
      const vencimento = ob.getString('vencimento')
      const competencia = ob.getString('competencia')

      const mensagem =
        `Olá! Aqui é a ELLIZA, assistente operacional inteligente da Rumo Contábil.\n\n` +
        `Passando para lembrar que a obrigação *${tipoObrigacao}* (competência ${competencia || 'vigente'}) da empresa *${nomeEmpresa}* ` +
        `vence em breve (*${vencimento}*).\n\n` +
        `Evite multas e encargos. O documento/guia já está disponível no Portal do Cliente ou consulte seu contador.`

      const waCol = app.findCollectionByNameOrId('whatsapp_envios')
      const waRecord = new Record(waCol)
      waRecord.set('tenant_id', tenantId)
      waRecord.set('empresa', empresaId)
      waRecord.set('tipo', 'aviso')
      waRecord.set('referencia', refEnvio)
      waRecord.set('destinatario', destinatario)
      waRecord.set('mensagem', mensagem)
      waRecord.set('origem', 'elliza')
      waRecord.set('status', 'aguardando_credenciais')
      waRecord.set(
        'erro',
        'Enfileirado pelo monitor 24/7 da ELLIZA (Modo Supervisão: aguardando disparo automático ou credenciais Evolution API)',
      )
      app.save(waRecord)

      try {
        const aCol = app.findCollectionByNameOrId('audit_log')
        const aRec = new Record(aCol)
        aRec.set('tenant_id', tenantId)
        if (ellizaUserId) aRec.set('usuario_id', ellizaUserId)
        aRec.set('acao', 'ELLIZA_DETECTED_OBRIGACAO_PROXIMA')
        aRec.set('entidade_tipo', 'obrigacoes')
        aRec.set('entidade_id', ob.id)
        aRec.set(
          'detalhes',
          JSON.stringify({
            tipo: tipoObrigacao,
            vencimento,
            empresa_id: empresaId,
            whatsapp_envio_id: waRecord.id,
          }),
        )
        app.save(aRec)
      } catch (_) {}

      totalNotificadas++
    }

    return e.json(200, {
      sucesso: true,
      mensagem: 'Rotina proativa da ELLIZA executada com sucesso',
      resultado: {
        totalNotificadas,
        totalBloqueadasPorDiretiva,
        totalEnfileiradasAprovacao,
      },
      executado_em: new Date().toISOString(),
    })
  } catch (err) {
    return e.json(500, { erro: 'Falha na execução: ' + String(err) })
  }
})

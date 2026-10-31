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
    // 1. Obter identificador do Perfil Operacional ou conta de serviço ELLIZA
    let ellizaUserId = null
    try {
      const p = app.findFirstRecordByFilter('elliza_perfil', 'status = "ativo"')
      ellizaUserId = p.id
    } catch (_) {
      try {
        const u = app.findAuthRecordByEmail('_pb_users_auth_', 'elliza@rumo.contabil')
        ellizaUserId = u.id
      } catch (__) {}
    }
    const hoje = new Date()
    const limite3Dias = new Date(hoje.getTime() + 3 * 24 * 60 * 60 * 1000)
    const hojeStr = hoje.toISOString().split('T')[0]
    const limiteStr = limite3Dias.toISOString().split('T')[0]

    // Buscar obrigações não entregues com vencimento entre hoje e 3 dias à frente
    const filterObrigacoes = `status != 'entregue' && status != 'cancelada' && vencimento >= '${hojeStr}' && vencimento <= '${limiteStr}'`
    const pendentes = app.findRecordsByFilter('obrigacoes', filterObrigacoes, 'vencimento', 200)

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

  // 8. Varredura ativa de expiração de comandos da ELLIZA (Parada Honesta)
  try {
    const nowIsoVarredura = new Date().toISOString()
    const filtroComandosVencidos = `(status = 'pendente' || status = 'aceito' || status = 'em_execucao') && expira_em != '' && expira_em != null && expira_em < '${nowIsoVarredura}'`
    const comandosVencidos = app.findRecordsByFilter(
      'elliza_comandos',
      filtroComandosVencidos,
      'created',
      100,
      0,
    )

    console.log(
      `[ELLIZA-24/7] Varredura de comandos: ${comandosVencidos.length} comando(s) vencido(s) encontrado(s).`,
    )

    for (let cIdx = 0; cIdx < comandosVencidos.length; cIdx++) {
      const cmd = comandosVencidos[cIdx]
      const statusAnterior = cmd.getString('status')
      const cmdTenantId = cmd.getString('tenant_id')
      let cmdEmpresaId = cmd.getString('empresa_id')
      const cmdNonce = cmd.getString('nonce')
      const cmdTipo = cmd.getString('tipo')
      const cmdAgente = cmd.getString('agente') || 'elliza-desktop-rpa'
      const cmdExpiraEm = cmd.getString('expira_em')
      const payloadCmd = cmd.get('payload') || {}

      if (!cmdEmpresaId && payloadCmd.empresa_id) {
        cmdEmpresaId = String(payloadCmd.empresa_id).trim()
      }

      // Localizar processo_id e empresa_id obrigatórios para criar pendência em processo_pendencias
      let procId = ''
      try {
        const procs = app.findRecordsByFilter(
          'processos_operacionais',
          `tenant_id = '${cmdTenantId}'`,
          '-created',
          1,
          0,
        )
        if (procs && procs.length > 0) {
          procId = procs[0].id
          if (!cmdEmpresaId) {
            cmdEmpresaId = procs[0].getString('empresa_id')
          }
        }
      } catch (_) {}

      // Se empresa_id ainda estiver vazia, buscar a empresa recente do tenant
      if (!cmdEmpresaId && cmdTenantId) {
        try {
          const empFallback = app.findRecordsByFilter(
            'empresas',
            `tenant_id = '${cmdTenantId}'`,
            '-created',
            1,
            0,
          )
          if (empFallback && empFallback.length > 0) {
            cmdEmpresaId = empFallback[0].id
          }
        } catch (_) {}
      }

      // Idempotência: Checar se já existe pendência estruturada para este comando/nonce
      let pendenciaExistente = null
      try {
        const pExistentes = app.findRecordsByFilter(
          'processo_pendencias',
          `tenant_id = '${cmdTenantId}' && (por_que_parou ~ '${cmdNonce}' || titulo ~ '${cmdNonce}' || por_que_parou ~ '${cmd.id}')`,
          '-created',
          1,
          0,
        )
        if (pExistentes && pExistentes.length > 0) {
          pendenciaExistente = pExistentes[0]
        }
      } catch (_) {}

      let pendRecId = pendenciaExistente ? pendenciaExistente.id : null

      if (!pendenciaExistente && procId && cmdEmpresaId) {
        try {
          const pendCol = app.findCollectionByNameOrId('processo_pendencias')
          const pendRec = new Record(pendCol)
          pendRec.set('tenant_id', cmdTenantId)
          pendRec.set('processo_id', procId)
          pendRec.set('empresa_id', cmdEmpresaId)

          const tituloPendencia = `Comando ${cmdTipo} expirou sem conclusão (Parada Honesta - Nonce ${cmdNonce})`
          const motivoExp = `Comando ${cmdTipo} (id: ${cmd.id}, nonce: ${cmdNonce}) atingiu o prazo de expiração (${cmdExpiraEm}) com status '${statusAnterior}' e não foi concluído pelo agente desktop '${cmdAgente}'.`
          const oQueFoiExecutado = `Comando foi enfileirado na collection elliza_comandos em ${cmd.getString('created')}, aguardando processamento da ELLIZA desktop.`
          const oQueFalta = `Verificar disponibilidade do agente local '${cmdAgente}', avaliar se a instrução deve ser reemitida ou cancelada.`
          const decisaoNecessaria = `Decidir se reabre o comando com novo prazo de expiração ou se encerra a solicitação operacional no Modo Humano.`

          pendRec.set('titulo', tituloPendencia)
          pendRec.set('por_que_parou', motivoExp)
          pendRec.set('o_que_foi_executado', oQueFoiExecutado)
          pendRec.set('o_que_falta', oQueFalta)
          pendRec.set('decisao_necessaria', decisaoNecessaria)
          pendRec.set('status', 'aberta')
          app.save(pendRec)
          pendRecId = pendRec.id
        } catch (errPend) {
          console.error(
            `[ELLIZA-24/7] Erro ao criar pendência estruturada para comando ${cmd.id}:`,
            errPend,
          )
        }
      }

      // Atualizar comando para status 'expirado' e erro estruturado COMANDO_EXPIRADO
      try {
        cmd.set('status', 'expirado')
        cmd.set('erro', {
          codigo: 'COMANDO_EXPIRADO',
          motivo: `Comando expirou em ${cmdExpiraEm} antes da conclusão (status anterior: ${statusAnterior}). Parada honesta registrada.`,
          referencia_pendencia: pendRecId,
          timestamp: nowIsoVarredura,
        })
        app.save(cmd)
      } catch (errCmd) {
        console.error(
          `[ELLIZA-24/7] Erro ao atualizar status do comando ${cmd.id} para expirado:`,
          errCmd,
        )
      }

      // Registrar no audit_log
      try {
        const aCol = app.findCollectionByNameOrId('audit_log')
        const aRec = new Record(aCol)
        aRec.set('tenant_id', cmdTenantId)
        aRec.set('acao', 'COMANDO_EXPIRADO_PARADA_HONESTA')
        aRec.set('entidade_tipo', 'elliza_comandos')
        aRec.set('entidade_id', cmd.id)
        aRec.set(
          'detalhes',
          JSON.stringify({
            nonce: cmdNonce,
            tipo: cmdTipo,
            agente: cmdAgente,
            status_anterior: statusAnterior,
            status_novo: 'expirado',
            expira_em: cmdExpiraEm,
            pendencia_id: pendRecId,
            timestamp: nowIsoVarredura,
          }),
        )
        app.save(aRec)
      } catch (errAudit) {
        console.error(
          `[ELLIZA-24/7] Erro ao registrar audit_log para comando expirado ${cmd.id}:`,
          errAudit,
        )
      }
    }
  } catch (errVarredura) {
    console.error('[ELLIZA-24/7] Falha na varredura de comandos expirados:', errVarredura)
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
      const p = app.findFirstRecordByFilter('elliza_perfil', 'status = "ativo"')
      ellizaUserId = p.id
    } catch (_) {
      try {
        const u = app.findAuthRecordByEmail('_pb_users_auth_', 'elliza@rumo.contabil')
        ellizaUserId = u.id
      } catch (__) {}
    }
    const hoje = new Date()
    const limite3Dias = new Date(hoje.getTime() + 3 * 24 * 60 * 60 * 1000)
    const hojeStr = hoje.toISOString().split('T')[0]
    const limiteStr = limite3Dias.toISOString().split('T')[0]

    const filterObrigacoes = `status != 'entregue' && status != 'cancelada' && vencimento >= '${hojeStr}' && vencimento <= '${limiteStr}'`
    const pendentes = app.findRecordsByFilter('obrigacoes', filterObrigacoes, 'vencimento', 200)

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

    // 8. Varredura ativa de comandos expirados (Parada Honesta sob demanda)
    let totalComandosExpirados = 0
    try {
      const nowIsoVarredura = new Date().toISOString()
      const filtroComandosVencidos = `(status = 'pendente' || status = 'aceito' || status = 'em_execucao') && expira_em != '' && expira_em != null && expira_em < '${nowIsoVarredura}'`
      const comandosVencidos = app.findRecordsByFilter(
        'elliza_comandos',
        filtroComandosVencidos,
        'created',
        100,
        0,
      )

      for (let cIdx = 0; cIdx < comandosVencidos.length; cIdx++) {
        const cmd = comandosVencidos[cIdx]
        const statusAnterior = cmd.getString('status')
        const cmdTenantId = cmd.getString('tenant_id')
        let cmdEmpresaId = cmd.getString('empresa_id')
        const cmdNonce = cmd.getString('nonce')
        const cmdTipo = cmd.getString('tipo')
        const cmdAgente = cmd.getString('agente') || 'elliza-desktop-rpa'
        const cmdExpiraEm = cmd.getString('expira_em')
        const payloadCmd = cmd.get('payload') || {}

        if (!cmdEmpresaId && payloadCmd.empresa_id) {
          cmdEmpresaId = String(payloadCmd.empresa_id).trim()
        }

        let procId = ''
        try {
          const procs = app.findRecordsByFilter(
            'processos_operacionais',
            `tenant_id = '${cmdTenantId}'`,
            '-created',
            1,
            0,
          )
          if (procs && procs.length > 0) {
            procId = procs[0].id
            if (!cmdEmpresaId) {
              cmdEmpresaId = procs[0].getString('empresa_id')
            }
          }
        } catch (_) {}

        if (!cmdEmpresaId && cmdTenantId) {
          try {
            const empFallback = app.findRecordsByFilter(
              'empresas',
              `tenant_id = '${cmdTenantId}'`,
              '-created',
              1,
              0,
            )
            if (empFallback && empFallback.length > 0) {
              cmdEmpresaId = empFallback[0].id
            }
          } catch (_) {}
        }

        // Idempotência: Checar pendência existente
        let pendenciaExistente = null
        try {
          const pExistentes = app.findRecordsByFilter(
            'processo_pendencias',
            `tenant_id = '${cmdTenantId}' && (por_que_parou ~ '${cmdNonce}' || titulo ~ '${cmdNonce}' || por_que_parou ~ '${cmd.id}')`,
            '-created',
            1,
            0,
          )
          if (pExistentes && pExistentes.length > 0) {
            pendenciaExistente = pExistentes[0]
          }
        } catch (_) {}

        let pendRecId = pendenciaExistente ? pendenciaExistente.id : null

        if (!pendenciaExistente && procId && cmdEmpresaId) {
          try {
            const pendCol = app.findCollectionByNameOrId('processo_pendencias')
            const pendRec = new Record(pendCol)
            pendRec.set('tenant_id', cmdTenantId)
            pendRec.set('processo_id', procId)
            pendRec.set('empresa_id', cmdEmpresaId)

            const tituloPendencia = `Comando ${cmdTipo} expirou sem conclusão (Parada Honesta - Nonce ${cmdNonce})`
            const motivoExp = `Comando ${cmdTipo} (id: ${cmd.id}, nonce: ${cmdNonce}) atingiu o prazo de expiração (${cmdExpiraEm}) com status '${statusAnterior}' e não foi concluído pelo agente desktop '${cmdAgente}'.`
            const oQueFoiExecutado = `Comando foi enfileirado na collection elliza_comandos em ${cmd.getString('created')}, aguardando processamento da ELLIZA desktop.`
            const oQueFalta = `Verificar disponibilidade do agente local '${cmdAgente}', avaliar se a instrução deve ser reemitida ou cancelada.`
            const decisaoNecessaria = `Decidir se reabre o comando com novo prazo de expiração ou se encerra a solicitação operacional no Modo Humano.`

            pendRec.set('titulo', tituloPendencia)
            pendRec.set('por_que_parou', motivoExp)
            pendRec.set('o_que_foi_executado', oQueFoiExecutado)
            pendRec.set('o_que_falta', oQueFalta)
            pendRec.set('decisao_necessaria', decisaoNecessaria)
            pendRec.set('status', 'aberta')
            app.save(pendRec)
            pendRecId = pendRec.id
          } catch (errPend) {
            console.error(
              `[ELLIZA-24/7] Erro ao criar pendência estruturada para comando ${cmd.id}:`,
              errPend,
            )
          }
        }

        try {
          cmd.set('status', 'expirado')
          cmd.set('erro', {
            codigo: 'COMANDO_EXPIRADO',
            motivo: `Comando expirou em ${cmdExpiraEm} antes da conclusão (status anterior: ${statusAnterior}). Parada honesta registrada.`,
            referencia_pendencia: pendRecId,
            timestamp: nowIsoVarredura,
          })
          app.save(cmd)
          totalComandosExpirados++
        } catch (errCmd) {
          console.error(
            `[ELLIZA-24/7] Erro ao atualizar status do comando ${cmd.id} para expirado:`,
            errCmd,
          )
        }

        try {
          const aCol = app.findCollectionByNameOrId('audit_log')
          const aRec = new Record(aCol)
          aRec.set('tenant_id', cmdTenantId)
          aRec.set('acao', 'COMANDO_EXPIRADO_PARADA_HONESTA')
          aRec.set('entidade_tipo', 'elliza_comandos')
          aRec.set('entidade_id', cmd.id)
          aRec.set(
            'detalhes',
            JSON.stringify({
              nonce: cmdNonce,
              tipo: cmdTipo,
              agente: cmdAgente,
              status_anterior: statusAnterior,
              status_novo: 'expirado',
              expira_em: cmdExpiraEm,
              pendencia_id: pendRecId,
              timestamp: nowIsoVarredura,
            }),
          )
          app.save(aRec)
        } catch (errAudit) {
          console.error(
            `[ELLIZA-24/7] Erro ao registrar audit_log para comando expirado ${cmd.id}:`,
            errAudit,
          )
        }
      }
    } catch (errVarredura) {
      console.error(
        '[ELLIZA-24/7] Falha na varredura de comandos expirados (manual):',
        errVarredura,
      )
    }

    return e.json(200, {
      sucesso: true,
      mensagem: 'Rotina proativa da ELLIZA executada com sucesso',
      resultado: {
        totalNotificadas,
        totalBloqueadasPorDiretiva,
        totalEnfileiradasAprovacao,
        totalComandosExpirados,
      },
      executado_em: new Date().toISOString(),
    })
  } catch (err) {
    return e.json(500, { erro: 'Falha na execução: ' + String(err) })
  }
})

migrate(
  (app) => {
    console.log(
      '[MIGRATION-0127] Iniciando varredura e expiração de comandos vencidos em elliza_comandos...',
    )

    const nowIso = new Date().toISOString()
    const filtro = `(status = 'pendente' || status = 'aceito' || status = 'em_execucao') && expira_em != '' && expira_em != null && expira_em < '${nowIso}'`

    let comandosVencidos = []
    try {
      comandosVencidos = app.findRecordsByFilter('elliza_comandos', filtro, 'created', 200, 0)
    } catch (err) {
      console.warn('[MIGRATION-0127] Nenhum comando vencido ou erro na consulta:', err)
      return
    }

    console.log(`[MIGRATION-0127] Comandos vencidos a processar: ${comandosVencidos.length}`)

    for (let i = 0; i < comandosVencidos.length; i++) {
      const cmd = comandosVencidos[i]
      const statusAnterior = cmd.getString('status')
      const tenantId = cmd.getString('tenant_id')
      let empresaId = cmd.getString('empresa_id')
      const nonce = cmd.getString('nonce')
      const tipo = cmd.getString('tipo')
      const agente = cmd.getString('agente') || 'elliza-desktop-rpa'
      const expiraEm = cmd.getString('expira_em')
      const payload = cmd.get('payload') || {}

      if (!empresaId && payload.empresa_id) {
        empresaId = String(payload.empresa_id).trim()
      }

      if (!empresaId && tenantId) {
        try {
          const empFallback = app.findRecordsByFilter(
            'empresas',
            `tenant_id = '${tenantId}'`,
            '-created',
            1,
            0,
          )
          if (empFallback && empFallback.length > 0) {
            empresaId = empFallback[0].id
          }
        } catch (_) {}
      }

      // Idempotência: verificar se já existe pendência estruturada para este comando/nonce
      let pendenciaExistente = null
      try {
        const pExistentes = app.findRecordsByFilter(
          'processo_pendencias',
          `tenant_id = '${tenantId}' && (por_que_parou ~ '${nonce}' || titulo ~ '${nonce}' || por_que_parou ~ '${cmd.id}')`,
          '-created',
          1,
          0,
        )
        if (pExistentes && pExistentes.length > 0) {
          pendenciaExistente = pExistentes[0]
        }
      } catch (_) {}

      let pendRecId = pendenciaExistente ? pendenciaExistente.id : null

      if (!pendenciaExistente) {
        try {
          const pendCol = app.findCollectionByNameOrId('processo_pendencias')
          const pendRec = new Record(pendCol)
          pendRec.set('tenant_id', tenantId)
          if (empresaId) {
            pendRec.set('empresa_id', empresaId)
          }

          const titulo = `Comando ${tipo} expirou sem conclusão (Parada Honesta - Nonce ${nonce})`
          const motivoExp = `Comando ${tipo} (id: ${cmd.id}, nonce: ${nonce}) atingiu o prazo de expiração (${expiraEm}) com status '${statusAnterior}' e não foi concluído pelo agente desktop '${agente}'.`
          const oQueFoiExecutado = `Comando foi enfileirado na collection elliza_comandos em ${cmd.getString('created')}, aguardando processamento da ELLIZA desktop.`
          const oQueFalta = `Verificar disponibilidade do agente local '${agente}', avaliar se a instrução deve ser reemitida ou cancelada.`
          const decisaoNecessaria = `Decidir se reabre o comando com novo prazo de expiração ou se encerra a solicitação operacional no Modo Humano.`

          pendRec.set('titulo', titulo)
          pendRec.set('por_que_parou', motivoExp)
          pendRec.set('o_que_foi_executado', oQueFoiExecutado)
          pendRec.set('o_que_falta', oQueFalta)
          pendRec.set('decisao_necessaria', decisaoNecessaria)
          pendRec.set('status', 'aberta')
          app.save(pendRec)
          pendRecId = pendRec.id
        } catch (errPend) {
          console.warn(`[MIGRATION-0127] Falha ao criar pendência para comando ${cmd.id}:`, errPend)
        }
      }

      // Atualizar o comando
      try {
        cmd.set('status', 'expirado')
        cmd.set('erro', {
          codigo: 'COMANDO_EXPIRADO',
          motivo: `Comando expirou em ${expiraEm} antes da conclusão (status anterior: ${statusAnterior}). Parada honesta registrada.`,
          referencia_pendencia: pendRecId,
          timestamp: nowIso,
        })
        app.save(cmd)
      } catch (errCmd) {
        console.warn(`[MIGRATION-0127] Falha ao atualizar comando ${cmd.id}:`, errCmd)
      }

      // Registrar no audit_log
      try {
        const aCol = app.findCollectionByNameOrId('audit_log')
        const aRec = new Record(aCol)
        aRec.set('tenant_id', tenantId)
        aRec.set('acao', 'COMANDO_EXPIRADO_PARADA_HONESTA')
        aRec.set('entidade_tipo', 'elliza_comandos')
        aRec.set('entidade_id', cmd.id)
        aRec.set(
          'detalhes',
          JSON.stringify({
            nonce: nonce,
            tipo: tipo,
            agente: agente,
            status_anterior: statusAnterior,
            status_novo: 'expirado',
            expira_em: expiraEm,
            pendencia_id: pendRecId,
            timestamp: nowIso,
          }),
        )
        app.save(aRec)
      } catch (errAudit) {
        console.warn(`[MIGRATION-0127] Falha ao registrar audit_log para ${cmd.id}:`, errAudit)
      }
    }

    console.log('[MIGRATION-0127] Varredura e expiração de comandos concluída com sucesso.')
  },
  (app) => {
    // Reversão no-op idempotente
  },
)

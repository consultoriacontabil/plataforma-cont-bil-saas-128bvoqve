migrate(
  (app) => {
    console.log(
      '[MIGRATION-0128] Garantindo pendência estruturada e vínculo para comando khv76xe7itf7gyf...',
    )

    const cmdId = 'khv76xe7itf7gyf'
    let cmd = null
    try {
      cmd = app.findRecordById('elliza_comandos', cmdId)
    } catch (err) {
      console.warn('[MIGRATION-0128] Comando não encontrado:', err)
      return
    }

    const tenantId = cmd.getString('tenant_id')
    const nonce = cmd.getString('nonce')
    const expiraEm = cmd.getString('expira_em')
    const agente = cmd.getString('agente') || 'elliza-desktop-rpa'
    const tipo = cmd.getString('tipo') || 'pesquisa_tributaria'

    // Buscar processo operacional do tenant para satisfazer relation required processo_id
    let procId = ''
    let empId = cmd.getString('empresa_id')

    try {
      const procs = app.findRecordsByFilter(
        'processos_operacionais',
        `tenant_id = '${tenantId}'`,
        '-created',
        1,
        0,
      )
      if (procs && procs.length > 0) {
        procId = procs[0].id
        if (!empId) {
          empId = procs[0].getString('empresa_id')
        }
      }
    } catch (_) {}

    if (!empId) {
      try {
        const emps = app.findRecordsByFilter(
          'empresas',
          `tenant_id = '${tenantId}'`,
          '-created',
          1,
          0,
        )
        if (emps && emps.length > 0) {
          empId = emps[0].id
        }
      } catch (_) {}
    }

    // Verificar se já existe pendência
    let pendExistente = null
    try {
      const pList = app.findRecordsByFilter(
        'processo_pendencias',
        `tenant_id = '${tenantId}' && (por_que_parou ~ '${nonce}' || titulo ~ '${nonce}' || por_que_parou ~ '${cmdId}')`,
        '-created',
        1,
        0,
      )
      if (pList && pList.length > 0) {
        pendExistente = pList[0]
      }
    } catch (_) {}

    let pendId = pendExistente ? pendExistente.id : null

    if (!pendExistente && procId && empId) {
      const pendCol = app.findCollectionByNameOrId('processo_pendencias')
      const pendRec = new Record(pendCol)
      pendRec.set('tenant_id', tenantId)
      pendRec.set('processo_id', procId)
      pendRec.set('empresa_id', empId)
      pendRec.set(
        'titulo',
        `Comando ${tipo} expirou sem conclusão (Parada Honesta - Nonce ${nonce})`,
      )
      pendRec.set(
        'por_que_parou',
        `Comando ${tipo} (id: ${cmd.id}, nonce: ${nonce}) atingiu o prazo de expiração (${expiraEm}) com status pendente e não foi concluído pelo agente desktop '${agente}'.`,
      )
      pendRec.set(
        'o_que_foi_executado',
        `Comando foi enfileirado na collection elliza_comandos em ${cmd.getString('created')}, aguardando processamento da ELLIZA desktop.`,
      )
      pendRec.set(
        'o_que_falta',
        `Verificar disponibilidade do agente local '${agente}', avaliar se a instrução deve ser reemitida ou cancelada.`,
      )
      pendRec.set(
        'decisao_necessaria',
        `Decidir se reabre o comando com novo prazo de expiração ou se encerra a solicitação operacional no Modo Humano.`,
      )
      pendRec.set('status', 'aberta')
      app.save(pendRec)
      pendId = pendRec.id
    }

    // Atualizar comando com a referência à pendência
    cmd.set('status', 'expirado')
    cmd.set('erro', {
      codigo: 'COMANDO_EXPIRADO',
      motivo: `Comando expirou em ${expiraEm} antes da conclusão. Parada honesta registrada.`,
      referencia_pendencia: pendId,
      timestamp: new Date().toISOString(),
    })
    app.save(cmd)

    // Auditoria
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
          status_novo: 'expirado',
          expira_em: expiraEm,
          pendencia_id: pendId,
          timestamp: new Date().toISOString(),
        }),
      )
      app.save(aRec)
    } catch (_) {}

    console.log('[MIGRATION-0128] Pendência e comando khv76xe7itf7gyf atualizados com sucesso.')
  },
  (app) => {
    // no-op
  },
)

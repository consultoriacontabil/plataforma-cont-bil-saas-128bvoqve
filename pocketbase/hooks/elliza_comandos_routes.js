/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoints do Canal de Comandos da ELLIZA Desktop (RPA / Scanner / Local)
 * Contrato de integração Rumo ⇄ ELLIZA desktop:
 * - Base: /backend/v1/elliza-agente/comandos/
 * - Autenticação: X-Elliza-Api-Key ou Authorization: Bearer <chave>
 *
 * PocketBase JSVM: todas as funções e variáveis devem ficar estritamente DENTRO do corpo de cada callback routerAdd.
 *
 * Endpoints:
 * 1. GET  /backend/v1/elliza-agente/comandos/assinar  - Stream SSE de comandos pendentes do tenant (fallback polling)
 * 2. GET  /backend/v1/elliza-agente/comandos/obter    - Polling com suporte a filtro por nonce e limit
 * 3. POST /backend/v1/elliza-agente/comandos/aceitar  - Marca em_execucao com lock idempotente (nonce); expirado responde expirado e não executa
 * 4. POST /backend/v1/elliza-agente/comandos/concluir - Recebe resultado + evidencias; Regra de Ouro: sem evidência vira erro honesto;
 *                                                       para tipo extrair_documento: validação dura e gravação em nfiscal
 * 5. POST /backend/v1/elliza-agente/comandos/erro     - Erro honesto: grava pendência estruturada em processo_pendencias, status erro
 */

// 1. GET /backend/v1/elliza-agente/comandos/assinar
routerAdd('GET', '/backend/v1/elliza-agente/comandos/assinar', function (e) {
  var req = e.requestInfo()
  var headers = req.headers || {}

  var apiKey = ''
  if (headers['x-elliza-api-key']) {
    apiKey = String(headers['x-elliza-api-key']).trim()
  } else if (headers['authorization']) {
    var authHeader = String(headers['authorization']).trim()
    if (authHeader.toLowerCase().indexOf('bearer ') === 0) {
      apiKey = authHeader.slice(7).trim()
    } else {
      apiKey = authHeader
    }
  }

  if (!apiKey) {
    return e.json(401, {
      sucesso: false,
      erro: 'Chave de API não fornecida no cabeçalho X-Elliza-Api-Key ou Authorization: Bearer <chave>',
    })
  }

  var app = e.app || $app
  var hash = $security.sha256(apiKey)

  var records = []
  try {
    records = app.findRecordsByFilter(
      'elliza_agente_externo_chaves',
      "api_key_hash = '" + hash + "' && status = 'ativo'",
      '',
      1,
      0,
    )
  } catch (err) {
    return e.json(500, {
      sucesso: false,
      erro: 'Erro ao consultar chaves de agente: ' + String(err),
    })
  }

  if (!records || records.length === 0) {
    return e.json(401, {
      sucesso: false,
      erro: 'Credenciais de agente externo inválidas ou revogadas.',
    })
  }

  var ag = records[0]
  var tenantId = ag.getString('tenant_id')
  try {
    ag.set('ultimo_acesso_em', new Date().toISOString())
    app.save(ag)
  } catch (_) {}

  var accept = String(headers['accept'] || '').toLowerCase()
  var nowIso = new Date().toISOString()

  // Buscar comandos pendentes não expirados (filtro estrito por expira_em)
  var filter =
    "tenant_id = '" +
    tenantId +
    "' && status = 'pendente' && (expira_em = '' || expira_em = null || expira_em > '" +
    nowIso +
    "')"
  var comandos = []
  try {
    comandos = app.findRecordsByFilter('elliza_comandos', filter, '-prioridade,created', 20, 0)
  } catch (err) {
    return e.json(500, {
      sucesso: false,
      erro: 'Erro ao consultar comandos pendentes: ' + String(err),
    })
  }

  var pendentesValidos = []
  for (var i = 0; i < comandos.length; i++) {
    var cmd = comandos[i]
    var expiraEm = cmd.getString('expira_em')
    if (!expiraEm || expiraEm > nowIso) {
      pendentesValidos.push({
        id: cmd.id,
        tenant_id: cmd.getString('tenant_id'),
        empresa_id: cmd.getString('empresa_id'),
        agente: cmd.getString('agente') || 'elliza-desktop-rpa',
        tipo: cmd.getString('tipo'),
        payload: cmd.get('payload') || {},
        prioridade: cmd.getInt('prioridade') || 3,
        status: cmd.getString('status'),
        nonce: cmd.getString('nonce'),
        expira_em: cmd.getString('expira_em'),
        created: cmd.getString('created'),
      })
    }
  }

  // Se o cliente pediu text/event-stream, emitir formato SSE
  if (accept.indexOf('text/event-stream') !== -1) {
    var ssePayload =
      'event: comandos\ndata: ' +
      JSON.stringify({
        sucesso: true,
        timestamp: nowIso,
        total_pendentes: pendentesValidos.length,
        comandos: pendentesValidos,
      }) +
      '\n\n'

    return e.string(200, ssePayload)
  }

  // Fallback Polling / JSON
  return e.json(200, {
    sucesso: true,
    modo: 'polling_fallback',
    timestamp: nowIso,
    total_pendentes: pendentesValidos.length,
    comandos: pendentesValidos,
  })
})

// 2. GET /backend/v1/elliza-agente/comandos/obter
routerAdd('GET', '/backend/v1/elliza-agente/comandos/obter', function (e) {
  var req = e.requestInfo()
  var headers = req.headers || {}

  var apiKey = ''
  if (headers['x-elliza-api-key']) {
    apiKey = String(headers['x-elliza-api-key']).trim()
  } else if (headers['authorization']) {
    var authHeader = String(headers['authorization']).trim()
    if (authHeader.toLowerCase().indexOf('bearer ') === 0) {
      apiKey = authHeader.slice(7).trim()
    } else {
      apiKey = authHeader
    }
  }

  if (!apiKey) {
    return e.json(401, {
      sucesso: false,
      erro: 'Chave de API não fornecida no cabeçalho X-Elliza-Api-Key ou Authorization: Bearer <chave>',
    })
  }

  var app = e.app || $app
  var hash = $security.sha256(apiKey)

  var records = []
  try {
    records = app.findRecordsByFilter(
      'elliza_agente_externo_chaves',
      "api_key_hash = '" + hash + "' && status = 'ativo'",
      '',
      1,
      0,
    )
  } catch (err) {
    return e.json(500, {
      sucesso: false,
      erro: 'Erro ao consultar chaves de agente: ' + String(err),
    })
  }

  if (!records || records.length === 0) {
    return e.json(401, {
      sucesso: false,
      erro: 'Credenciais de agente externo inválidas ou revogadas.',
    })
  }

  var ag = records[0]
  var tenantId = ag.getString('tenant_id')
  try {
    ag.set('ultimo_acesso_em', new Date().toISOString())
    app.save(ag)
  } catch (_) {}

  var query = req.query || {}
  var nonce = String(query['nonce'] || '').trim()
  var status = String(query['status'] || 'pendente').trim()
  var limit = parseInt(query['limit'], 10) || 50
  if (limit > 100) limit = 100

  var nowIso = new Date().toISOString()
  var filter = "tenant_id = '" + tenantId + "'"
  if (nonce) {
    filter += " && nonce = '" + nonce + "'"
  } else if (status) {
    filter += " && status = '" + status + "'"
    // Se o cliente pediu comandos entregáveis (pendente/aceito/em_execucao), nunca entregar expirados
    if (status === 'pendente' || status === 'aceito' || status === 'em_execucao') {
      filter += " && (expira_em = '' || expira_em = null || expira_em > '" + nowIso + "')"
    }
  }

  var listRecords = []
  try {
    listRecords = app.findRecordsByFilter(
      'elliza_comandos',
      filter,
      '-prioridade,-created',
      limit,
      0,
    )
  } catch (err) {
    return e.json(500, { sucesso: false, erro: 'Erro ao consultar comandos: ' + String(err) })
  }

  var lista = []
  for (var i = 0; i < listRecords.length; i++) {
    var cmd = listRecords[i]
    var expiraEm = cmd.getString('expira_em')
    var st = cmd.getString('status')

    // Se foi buscado por nonce específico e já expirou no tempo, atualizar st
    if (
      expiraEm &&
      expiraEm < nowIso &&
      (st === 'pendente' || st === 'aceito' || st === 'em_execucao')
    ) {
      st = 'expirado'
    }

    lista.push({
      id: cmd.id,
      tenant_id: cmd.getString('tenant_id'),
      empresa_id: cmd.getString('empresa_id'),
      agente: cmd.getString('agente'),
      tipo: cmd.getString('tipo'),
      payload: cmd.get('payload') || {},
      prioridade: cmd.getInt('prioridade'),
      status: st,
      nonce: cmd.getString('nonce'),
      expira_em: cmd.getString('expira_em'),
      resultado: cmd.get('resultado') || null,
      evidencias: cmd.get('evidencias') || null,
      erro: cmd.get('erro') || null,
      created: cmd.getString('created'),
      updated: cmd.getString('updated'),
    })
  }

  return e.json(200, {
    sucesso: true,
    total: lista.length,
    comandos: lista,
  })
})

// 3. POST /backend/v1/elliza-agente/comandos/aceitar
routerAdd('POST', '/backend/v1/elliza-agente/comandos/aceitar', function (e) {
  var req = e.requestInfo()
  var headers = req.headers || {}

  var apiKey = ''
  if (headers['x-elliza-api-key']) {
    apiKey = String(headers['x-elliza-api-key']).trim()
  } else if (headers['authorization']) {
    var authHeader = String(headers['authorization']).trim()
    if (authHeader.toLowerCase().indexOf('bearer ') === 0) {
      apiKey = authHeader.slice(7).trim()
    } else {
      apiKey = authHeader
    }
  }

  if (!apiKey) {
    return e.json(401, {
      sucesso: false,
      erro: 'Chave de API não fornecida no cabeçalho X-Elliza-Api-Key ou Authorization: Bearer <chave>',
    })
  }

  var app = e.app || $app
  var hash = $security.sha256(apiKey)

  var records = []
  try {
    records = app.findRecordsByFilter(
      'elliza_agente_externo_chaves',
      "api_key_hash = '" + hash + "' && status = 'ativo'",
      '',
      1,
      0,
    )
  } catch (err) {
    return e.json(500, {
      sucesso: false,
      erro: 'Erro ao consultar chaves de agente: ' + String(err),
    })
  }

  if (!records || records.length === 0) {
    return e.json(401, {
      sucesso: false,
      erro: 'Credenciais de agente externo inválidas ou revogadas.',
    })
  }

  var ag = records[0]
  var tenantId = ag.getString('tenant_id')
  var agentIdent = ag.getString('identificador_agente')
  try {
    ag.set('ultimo_acesso_em', new Date().toISOString())
    app.save(ag)
  } catch (_) {}

  var body = req.body || {}
  var nonce = String(body.nonce || '').trim()
  var comandoId = String(body.comando_id || body.id || '').trim()

  if (!nonce && !comandoId) {
    return e.json(400, { sucesso: false, erro: 'Parâmetro nonce ou comando_id é obrigatório.' })
  }

  var cmd = null
  try {
    if (nonce) {
      var found = app.findRecordsByFilter(
        'elliza_comandos',
        "tenant_id = '" + tenantId + "' && nonce = '" + nonce + "'",
        '',
        1,
        0,
      )
      if (found && found.length > 0) cmd = found[0]
    } else if (comandoId) {
      cmd = app.findRecordById('elliza_comandos', comandoId)
      if (cmd.getString('tenant_id') !== tenantId) cmd = null
    }
  } catch (_) {}

  if (!cmd) {
    return e.json(404, { sucesso: false, erro: 'Comando não encontrado para este escritório.' })
  }

  var statusAtual = cmd.getString('status')
  var nowIso = new Date().toISOString()
  var expiraEm = cmd.getString('expira_em')

  // Checar se já expirou
  if (statusAtual === 'expirado' || (expiraEm && expiraEm < nowIso)) {
    if (statusAtual !== 'expirado') {
      try {
        cmd.set('status', 'expirado')
        cmd.set('erro', {
          codigo: 'CMD_EXPIRADO',
          motivo: 'Comando expirado. Reentrega ou tentativa de aceite recusada.',
          referencia_pendencia: null,
        })
        app.save(cmd)
      } catch (_) {}
    }
    return e.json(410, {
      sucesso: false,
      status: 'expirado',
      erro: 'Comando expirado. Não pode ser aceito nem executado.',
      comando_id: cmd.id,
      nonce: cmd.getString('nonce'),
    })
  }

  // Idempotência: Se já foi aceito ou está em_execucao pelo mesmo nonce, devolve sucesso idempotente sem reexecutar
  if (statusAtual === 'aceito' || statusAtual === 'em_execucao') {
    return e.json(200, {
      sucesso: true,
      mensagem: 'Comando já se encontra em execução (aceite idempotente por nonce).',
      status: statusAtual,
      comando_id: cmd.id,
      nonce: cmd.getString('nonce'),
      tipo: cmd.getString('tipo'),
      payload: cmd.get('payload') || {},
    })
  }

  // Se já está concluído ou com erro, não permite reabrir
  if (statusAtual === 'concluido' || statusAtual === 'erro') {
    return e.json(409, {
      sucesso: false,
      erro:
        'Comando já finalizado com status: ' +
        statusAtual +
        '. Reexecução negada (idempotência garantida).',
      status: statusAtual,
      comando_id: cmd.id,
      nonce: cmd.getString('nonce'),
    })
  }

  // Transição para em_execucao
  cmd.set('status', 'em_execucao')
  cmd.set('agente', agentIdent)
  app.save(cmd)

  // Auditoria da transição de status
  try {
    var aCol = app.findCollectionByNameOrId('audit_log')
    var aRec = new Record(aCol)
    aRec.set('tenant_id', tenantId)
    aRec.set('acao', 'COMANDO_ACEITO_EM_EXECUCAO')
    aRec.set('entidade_tipo', 'elliza_comandos')
    aRec.set('entidade_id', cmd.id)
    aRec.set(
      'detalhes',
      JSON.stringify({
        nonce: cmd.getString('nonce'),
        tipo: cmd.getString('tipo'),
        agente: agentIdent,
        status_anterior: statusAtual,
        status_novo: 'em_execucao',
        timestamp: nowIso,
      }),
    )
    app.save(aRec)
  } catch (_) {}

  return e.json(200, {
    sucesso: true,
    mensagem: 'Comando aceito com lock de execução adquirido.',
    status: 'em_execucao',
    comando_id: cmd.id,
    nonce: cmd.getString('nonce'),
    tipo: cmd.getString('tipo'),
    payload: cmd.get('payload') || {},
  })
})

// 4. POST /backend/v1/elliza-agente/comandos/concluir
routerAdd('POST', '/backend/v1/elliza-agente/comandos/concluir', function (e) {
  var req = e.requestInfo()
  var headers = req.headers || {}

  var apiKey = ''
  if (headers['x-elliza-api-key']) {
    apiKey = String(headers['x-elliza-api-key']).trim()
  } else if (headers['authorization']) {
    var authHeader = String(headers['authorization']).trim()
    if (authHeader.toLowerCase().indexOf('bearer ') === 0) {
      apiKey = authHeader.slice(7).trim()
    } else {
      apiKey = authHeader
    }
  }

  if (!apiKey) {
    return e.json(401, {
      sucesso: false,
      erro: 'Chave de API não fornecida no cabeçalho X-Elliza-Api-Key ou Authorization: Bearer <chave>',
    })
  }

  var app = e.app || $app
  var hash = $security.sha256(apiKey)

  var records = []
  try {
    records = app.findRecordsByFilter(
      'elliza_agente_externo_chaves',
      "api_key_hash = '" + hash + "' && status = 'ativo'",
      '',
      1,
      0,
    )
  } catch (err) {
    return e.json(500, {
      sucesso: false,
      erro: 'Erro ao consultar chaves de agente: ' + String(err),
    })
  }

  if (!records || records.length === 0) {
    return e.json(401, {
      sucesso: false,
      erro: 'Credenciais de agente externo inválidas ou revogadas.',
    })
  }

  var ag = records[0]
  var tenantId = ag.getString('tenant_id')
  var agentIdent = ag.getString('identificador_agente')
  try {
    ag.set('ultimo_acesso_em', new Date().toISOString())
    app.save(ag)
  } catch (_) {}

  var body = req.body || {}
  var nonce = String(body.nonce || '').trim()
  var comandoId = String(body.comando_id || body.id || '').trim()
  var resultado = body.resultado || {}
  var evidencias = body.evidencias || []

  if (!nonce && !comandoId) {
    return e.json(400, { sucesso: false, erro: 'Parâmetro nonce ou comando_id obrigatório.' })
  }

  var cmd = null
  try {
    if (nonce) {
      var found = app.findRecordsByFilter(
        'elliza_comandos',
        "tenant_id = '" + tenantId + "' && nonce = '" + nonce + "'",
        '',
        1,
        0,
      )
      if (found && found.length > 0) cmd = found[0]
    } else if (comandoId) {
      cmd = app.findRecordById('elliza_comandos', comandoId)
      if (cmd.getString('tenant_id') !== tenantId) cmd = null
    }
  } catch (_) {}

  if (!cmd) {
    return e.json(404, { sucesso: false, erro: 'Comando não encontrado.' })
  }

  // Idempotência: Se já está concluído com o mesmo nonce, retorna sucesso sem reprocessar
  if (cmd.getString('status') === 'concluido') {
    return e.json(200, {
      sucesso: true,
      mensagem: 'Comando já se encontra concluído previamente (idempotência por nonce).',
      status: 'concluido',
      comando_id: cmd.id,
      nonce: cmd.getString('nonce'),
      resultado: cmd.get('resultado'),
    })
  }

  var tipoComando = cmd.getString('tipo')
  var empresaId = cmd.getString('empresa_id')
  var payloadCmd = cmd.get('payload') || {}
  if (!empresaId && payloadCmd.empresa_id) {
    empresaId = String(payloadCmd.empresa_id).trim()
  }

  // REGRA DE OURO 1: Evidência real obrigatória para concluir
  var evidenciasArray = []
  if (Array.isArray(evidencias)) {
    evidenciasArray = evidencias
  } else if (typeof evidencias === 'string' && evidencias) {
    evidenciasArray = [evidencias]
  } else if (body.evidencia_id) {
    evidenciasArray = [body.evidencia_id]
  }

  var nowIso = new Date().toISOString()

  // Se não tem evidência real, parada honesta: NÃO conclui, vira erro honesto
  if (evidenciasArray.length === 0) {
    var motivoSemEvidencia =
      'Regra de Ouro violada: tentativa de concluir comando sem evidência auditável real anexada.'

    var pendCol = app.findCollectionByNameOrId('processo_pendencias')
    var pendRec = new Record(pendCol)
    pendRec.set('tenant_id', tenantId)
    if (empresaId) pendRec.set('empresa_id', empresaId)
    pendRec.set('titulo', 'Comando ' + tipoComando + ' finalizado sem evidência (Regra de Ouro)')
    pendRec.set('por_que_parou', motivoSemEvidencia)
    pendRec.set(
      'o_que_foi_executado',
      'ELLIZA desktop tentou finalizar o comando ' +
        cmd.id +
        ' (' +
        tipoComando +
        ') sem submeter a lista de IDs de evidência.',
    )
    pendRec.set(
      'o_que_falta',
      'Anexar evidência real (screenshot, protocolo ou hash da execução) e reenviar conclusão.',
    )
    pendRec.set(
      'decisao_necessaria',
      'Verificar logs da ELLIZA desktop e anexar evidência do processo.',
    )
    pendRec.set('status', 'aberta')
    app.save(pendRec)

    cmd.set('status', 'erro')
    cmd.set('erro', {
      codigo: 'SEM_EVIDENCIA',
      motivo: motivoSemEvidencia,
      referencia_pendencia: pendRec.id,
      timestamp: nowIso,
    })
    app.save(cmd)

    try {
      var aCol = app.findCollectionByNameOrId('audit_log')
      var aRec = new Record(aCol)
      aRec.set('tenant_id', tenantId)
      aRec.set('acao', 'COMANDO_ERRO_SEM_EVIDENCIA')
      aRec.set('entidade_tipo', 'elliza_comandos')
      aRec.set('entidade_id', cmd.id)
      aRec.set(
        'detalhes',
        JSON.stringify({
          nonce: cmd.getString('nonce'),
          motivo: motivoSemEvidencia,
          pendencia_id: pendRec.id,
        }),
      )
      app.save(aRec)
    } catch (_) {}

    return e.json(422, {
      sucesso: false,
      status: 'erro',
      parada_honesta: true,
      erro: motivoSemEvidencia,
      codigo_erro: 'SEM_EVIDENCIA',
      pendencia_id: pendRec.id,
      comando_id: cmd.id,
      nonce: cmd.getString('nonce'),
    })
  }

  // PILOTO MARCO 3: se tipo for pesquisa_tributaria, validação dura de relatório técnico e persistência em pesquisas_tributarias
  var pesquisaTributariaId = null
  if (tipoComando === 'pesquisa_tributaria') {
    var dadosPesq = resultado || {}
    var relatorioTecnico = String(
      dadosPesq.relatorio_tecnico || dadosPesq.relatorio || dadosPesq.parecer || '',
    ).trim()
    var conclusoes = String(
      dadosPesq.conclusoes || dadosPesq.conclusao || dadosPesq.sintese || '',
    ).trim()
    var fontes = dadosPesq.fontes || []
    var contextoResultado = dadosPesq.contexto || payloadCmd.contexto || {}

    var perguntaTexto = String(
      payloadCmd.pergunta || payloadCmd.objetivo || dadosPesq.pergunta || '',
    ).trim()

    var errosValidacaoPesquisa = []
    if (!perguntaTexto) {
      errosValidacaoPesquisa.push('pergunta/objetivo da pesquisa tributária')
    }
    // Regra de ouro: relatório técnico não pode ser vazio ou genérico trivial (mínimo 50 caracteres de análise técnica)
    if (!relatorioTecnico || relatorioTecnico.length < 50) {
      errosValidacaoPesquisa.push(
        'relatorio_tecnico estruturado com fundamentação real (mínimo 50 caracteres)',
      )
    }

    if (errosValidacaoPesquisa.length > 0) {
      var motivoPesquisaInvalida =
        'Parada honesta: conclusão de pesquisa_tributaria rejeitada. Conteúdo técnico ausente ou insuficiente: ' +
        errosValidacaoPesquisa.join(', ') +
        '.'

      var pendColPesq = app.findCollectionByNameOrId('processo_pendencias')
      var pendRecPesq = new Record(pendColPesq)
      pendRecPesq.set('tenant_id', tenantId)
      if (empresaId) pendRecPesq.set('empresa_id', empresaId)
      pendRecPesq.set(
        'titulo',
        'Pesquisa Tributária sem relatório técnico consistente (Regra de Ouro)',
      )
      pendRecPesq.set('por_que_parou', motivoPesquisaInvalida)
      pendRecPesq.set(
        'o_que_foi_executado',
        'ELLIZA desktop tentou finalizar o comando de pesquisa tributária ' +
          cmd.id +
          ', mas não forneceu relatório técnico fundamentado.',
      )
      pendRecPesq.set(
        'o_que_falta',
        'ELLIZA desktop deve executar a pesquisa normativa completa e retornar o relatório técnico fundamentado (Markdown) com fontes.',
      )
      pendRecPesq.set(
        'decisao_necessaria',
        'Verificar conectividade com fontes da RFB/SEFAZ na ELLIZA desktop e reenviar conclusão com relatório real.',
      )
      pendRecPesq.set('status', 'aberta')
      app.save(pendRecPesq)

      cmd.set('status', 'erro')
      cmd.set('resultado', resultado)
      cmd.set('evidencias', evidenciasArray)
      cmd.set('erro', {
        codigo: 'RELATORIO_TECNICO_INSUFICIENTE',
        motivo: motivoPesquisaInvalida,
        erros_validacao: errosValidacaoPesquisa,
        referencia_pendencia: pendRecPesq.id,
        timestamp: nowIso,
      })
      app.save(cmd)

      try {
        var aColPesqErr = app.findCollectionByNameOrId('audit_log')
        var aRecPesqErr = new Record(aColPesqErr)
        aRecPesqErr.set('tenant_id', tenantId)
        aRecPesqErr.set('acao', 'PESQUISA_TRIBUTARIA_REJEITADA_PARADA_HONESTA')
        aRecPesqErr.set('entidade_tipo', 'elliza_comandos')
        aRecPesqErr.set('entidade_id', cmd.id)
        aRecPesqErr.set(
          'detalhes',
          JSON.stringify({
            nonce: cmd.getString('nonce'),
            erros: errosValidacaoPesquisa,
            pendencia_id: pendRecPesq.id,
          }),
        )
        app.save(aRecPesqErr)
      } catch (_) {}

      return e.json(422, {
        sucesso: false,
        status: 'erro',
        parada_honesta: true,
        erro: motivoPesquisaInvalida,
        codigo_erro: 'RELATORIO_TECNICO_INSUFICIENTE',
        erros_validacao: errosValidacaoPesquisa,
        pendencia_id: pendRecPesq.id,
        comando_id: cmd.id,
        nonce: cmd.getString('nonce'),
      })
    }

    // Conteúdo técnico válido: persistir em `pesquisas_tributarias`
    var pesqCol = app.findCollectionByNameOrId('pesquisas_tributarias')
    var pesqRec = new Record(pesqCol)
    pesqRec.set('tenant_id', tenantId)
    if (empresaId) pesqRec.set('empresa_id', empresaId)
    pesqRec.set('pergunta', perguntaTexto)
    pesqRec.set('contexto', contextoResultado)
    pesqRec.set('relatorio_tecnico', relatorioTecnico)
    pesqRec.set('fontes', fontes)
    pesqRec.set('conclusoes', conclusoes || 'Análise técnica finalizada pela ELLIZA desktop.')
    pesqRec.set('status', 'concluida')
    pesqRec.set('criado_por_comando_id', cmd.id)
    pesqRec.set('evidencias', evidenciasArray)
    pesqRec.set('metadados_json', {
      comando_id: cmd.id,
      nonce: cmd.getString('nonce'),
      agente: agentIdent,
      concluido_em: nowIso,
      tempo_processamento: dadosPesq.tempo_processamento || null,
    })
    app.save(pesqRec)
    pesquisaTributariaId = pesqRec.id

    try {
      var aColPesqOk = app.findCollectionByNameOrId('audit_log')
      var aRecPesqOk = new Record(aColPesqOk)
      aRecPesqOk.set('tenant_id', tenantId)
      aRecPesqOk.set('acao', 'PESQUISA_TRIBUTARIA_CONCLUIDA_ELLIZA_DESKTOP')
      aRecPesqOk.set('entidade_tipo', 'pesquisas_tributarias')
      aRecPesqOk.set('entidade_id', pesqRec.id)
      aRecPesqOk.set(
        'detalhes',
        JSON.stringify({
          comando_id: cmd.id,
          pesquisa_id: pesqRec.id,
          pergunta: perguntaTexto,
          empresa_id: empresaId,
          agente: agentIdent,
        }),
      )
      app.save(aRecPesqOk)
    } catch (_) {}
  }

  // PILOTO MARCO 2: se tipo for extrair_documento, validação dura e gravação em nfiscal
  var nfiscalId = null
  if (tipoComando === 'extrair_documento') {
    var dados = resultado || {}
    var numero = String(dados.numero || '').trim()
    var serie = String(dados.serie || '').trim()
    var cnpjEmitente = String(dados.cnpj_emitente || '').replace(/\D/g, '')
    var cnpjDestinatario = String(dados.cnpj_destinatario || '').replace(/\D/g, '')
    var rawValor = dados.valor_total
    var valorTotal = parseFloat(rawValor)
    var cfop = String(dados.cfop || '').trim()
    var competencia = String(dados.competencia || '').trim()
    var itens = dados.itens || []
    var documentoId = String(dados.documento_id || payloadCmd.documento_id || '').trim()

    var camposFaltantes = []
    if (!numero) camposFaltantes.push('numero')
    if (!cnpjEmitente || cnpjEmitente.length !== 14)
      camposFaltantes.push('cnpj_emitente (14 dígitos)')
    if (!cnpjDestinatario || cnpjDestinatario.length !== 14)
      camposFaltantes.push('cnpj_destinatario (14 dígitos)')
    if (isNaN(valorTotal) || valorTotal <= 0) camposFaltantes.push('valor_total (> 0)')
    if (!competencia || !/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia))
      camposFaltantes.push('competencia (formato AAAA-MM)')

    // Validação dura: campos essenciais ausentes = NÃO grava nada em nfiscal, cria pendência e marca erro honesto
    if (camposFaltantes.length > 0) {
      var motivoDivergencia =
        'Validação dura falhou para extrair_documento. Campos fiscais essenciais ausentes ou inválidos: ' +
        camposFaltantes.join(', ') +
        '.'

      var pendColDura = app.findCollectionByNameOrId('processo_pendencias')
      var pendRecDura = new Record(pendColDura)
      pendRecDura.set('tenant_id', tenantId)
      if (empresaId) pendRecDura.set('empresa_id', empresaId)
      pendRecDura.set('titulo', 'Inconsistência na extração fiscal (Scanner ELLIZA Desktop)')
      pendRecDura.set('por_que_parou', motivoDivergencia)
      pendRecDura.set(
        'o_que_foi_executado',
        'ELLIZA desktop executou OCR/Scanner local sobre o documento ' +
          (documentoId || 'não especificado') +
          ', mas os dados estruturados retornados violam a validação dura.',
      )
      pendRecDura.set(
        'o_que_falta',
        'Preenchimento ou conferência manual dos campos: ' + camposFaltantes.join(', ') + '.',
      )
      pendRecDura.set(
        'decisao_necessaria',
        'Conferir documento original no GED e complementar dados fiscais faltantes.',
      )
      pendRecDura.set('status', 'aberta')
      app.save(pendRecDura)

      cmd.set('status', 'erro')
      cmd.set('resultado', resultado)
      cmd.set('evidencias', evidenciasArray)
      cmd.set('erro', {
        codigo: 'DADOS_FISCAIS_INCOMPLETOS',
        motivo: motivoDivergencia,
        campos_faltantes: camposFaltantes,
        referencia_pendencia: pendRecDura.id,
        timestamp: nowIso,
      })
      app.save(cmd)

      try {
        var aCol2 = app.findCollectionByNameOrId('audit_log')
        var aRec2 = new Record(aCol2)
        aRec2.set('tenant_id', tenantId)
        aRec2.set('acao', 'EXTRAIR_DOCUMENTO_VALIDACAO_DURA_FALHOU')
        aRec2.set('entidade_tipo', 'elliza_comandos')
        aRec2.set('entidade_id', cmd.id)
        aRec2.set(
          'detalhes',
          JSON.stringify({
            nonce: cmd.getString('nonce'),
            campos_faltantes: camposFaltantes,
            pendencia_id: pendRecDura.id,
          }),
        )
        app.save(aRec2)
      } catch (_) {}

      return e.json(422, {
        sucesso: false,
        status: 'erro',
        parada_honesta: true,
        erro: motivoDivergencia,
        codigo_erro: 'DADOS_FISCAIS_INCOMPLETOS',
        campos_faltantes: camposFaltantes,
        pendencia_id: pendRecDura.id,
        comando_id: cmd.id,
        nonce: cmd.getString('nonce'),
      })
    }

    // Campos completos: Gravar registro em `nfiscal`
    if (!empresaId) {
      try {
        var empMatch = app.findRecordsByFilter(
          'empresas',
          "tenant_id = '" +
            tenantId +
            "' && (cnpj = '" +
            cnpjDestinatario +
            "' || cnpj = '" +
            cnpjEmitente +
            "')",
          '',
          1,
          0,
        )
        if (empMatch && empMatch.length > 0) empresaId = empMatch[0].id
      } catch (_) {}
    }

    if (!empresaId) {
      try {
        var empPadrao = app.findRecordsByFilter(
          'empresas',
          "tenant_id = '" + tenantId + "'",
          '-created',
          1,
          0,
        )
        if (empPadrao && empPadrao.length > 0) empresaId = empPadrao[0].id
      } catch (_) {}
    }

    var nfCol = app.findCollectionByNameOrId('nfiscal')
    var nfRec = new Record(nfCol)
    nfRec.set('tenant_id', tenantId)
    nfRec.set('empresa_id', empresaId)
    nfRec.set('numero', numero)
    if (serie) nfRec.set('serie', serie)
    nfRec.set('cnpj_emitente', cnpjEmitente)
    nfRec.set('cnpj_destinatario', cnpjDestinatario)
    nfRec.set('valor_total', valorTotal)
    if (cfop) nfRec.set('cfop', cfop)
    nfRec.set('competencia', competencia)
    nfRec.set('origem', 'elliza_desktop')
    if (documentoId) nfRec.set('documento_id', documentoId)
    if (itens && Array.isArray(itens)) nfRec.set('itens', itens)
    nfRec.set('metadados_json', {
      comando_id: cmd.id,
      nonce: cmd.getString('nonce'),
      agente: agentIdent,
      extraido_em: nowIso,
      evidencias: evidenciasArray,
    })
    app.save(nfRec)
    nfiscalId = nfRec.id

    if (documentoId) {
      try {
        var dRec = app.findRecordById('documentos', documentoId)
        dRec.set('status', 'processado')
        dRec.set(
          'observacoes',
          (dRec.getString('observacoes') || '') +
            ' [Processado via Scanner ELLIZA desktop - NF-e ' +
            numero +
            ']',
        )
        app.save(dRec)
      } catch (_) {}
    }

    try {
      var aColFiscal = app.findCollectionByNameOrId('audit_log')
      var aRecFiscal = new Record(aColFiscal)
      aRecFiscal.set('tenant_id', tenantId)
      aRecFiscal.set('acao', 'NFISCAL_GRAVADA_ELLIZA_DESKTOP')
      aRecFiscal.set('entidade_tipo', 'nfiscal')
      aRecFiscal.set('entidade_id', nfRec.id)
      aRecFiscal.set(
        'detalhes',
        JSON.stringify({
          comando_id: cmd.id,
          numero: numero,
          cnpj_emitente: cnpjEmitente,
          valor_total: valorTotal,
          competencia: competencia,
          origem: 'elliza_desktop',
        }),
      )
      app.save(aRecFiscal)
    } catch (_) {}
  }

  cmd.set('status', 'concluido')
  cmd.set('resultado', resultado)
  cmd.set('evidencias', evidenciasArray)
  cmd.set('erro', null)
  app.save(cmd)

  try {
    var aColEnd = app.findCollectionByNameOrId('audit_log')
    var aRecEnd = new Record(aColEnd)
    aRecEnd.set('tenant_id', tenantId)
    aRecEnd.set('acao', 'COMANDO_CONCLUIDO')
    aRecEnd.set('entidade_tipo', 'elliza_comandos')
    aRecEnd.set('entidade_id', cmd.id)
    aRecEnd.set(
      'detalhes',
      JSON.stringify({
        nonce: cmd.getString('nonce'),
        tipo: tipoComando,
        agente: agentIdent,
        nfiscal_id: nfiscalId,
        evidencias_count: evidenciasArray.length,
      }),
    )
    app.save(aRecEnd)
  } catch (_) {}

  return e.json(200, {
    sucesso: true,
    mensagem: 'Comando concluído com êxito e evidências auditadas.',
    status: 'concluido',
    comando_id: cmd.id,
    nonce: cmd.getString('nonce'),
    tipo: tipoComando,
    nfiscal_id: nfiscalId,
    pesquisa_tributaria_id: pesquisaTributariaId,
    evidencias: evidenciasArray,
  })
})

// 5. POST /backend/v1/elliza-agente/comandos/erro
routerAdd('POST', '/backend/v1/elliza-agente/comandos/erro', function (e) {
  var req = e.requestInfo()
  var headers = req.headers || {}

  var apiKey = ''
  if (headers['x-elliza-api-key']) {
    apiKey = String(headers['x-elliza-api-key']).trim()
  } else if (headers['authorization']) {
    var authHeader = String(headers['authorization']).trim()
    if (authHeader.toLowerCase().indexOf('bearer ') === 0) {
      apiKey = authHeader.slice(7).trim()
    } else {
      apiKey = authHeader
    }
  }

  if (!apiKey) {
    return e.json(401, {
      sucesso: false,
      erro: 'Chave de API não fornecida no cabeçalho X-Elliza-Api-Key ou Authorization: Bearer <chave>',
    })
  }

  var app = e.app || $app
  var hash = $security.sha256(apiKey)

  var records = []
  try {
    records = app.findRecordsByFilter(
      'elliza_agente_externo_chaves',
      "api_key_hash = '" + hash + "' && status = 'ativo'",
      '',
      1,
      0,
    )
  } catch (err) {
    return e.json(500, {
      sucesso: false,
      erro: 'Erro ao consultar chaves de agente: ' + String(err),
    })
  }

  if (!records || records.length === 0) {
    return e.json(401, {
      sucesso: false,
      erro: 'Credenciais de agente externo inválidas ou revogadas.',
    })
  }

  var ag = records[0]
  var tenantId = ag.getString('tenant_id')
  var agentIdent = ag.getString('identificador_agente')
  try {
    ag.set('ultimo_acesso_em', new Date().toISOString())
    app.save(ag)
  } catch (_) {}

  var body = req.body || {}
  var nonce = String(body.nonce || '').trim()
  var comandoId = String(body.comando_id || body.id || '').trim()
  var codigoErro = String(body.codigo || body.codigo_erro || 'ERRO_EXECUCAO').trim()
  var motivo = String(
    body.motivo || body.mensagem || body.erro || 'Falha reportada pelo agente local.',
  ).trim()
  var oQueFoiExecutado = String(
    body.o_que_foi_executado || 'Execução automatizada no cliente desktop.',
  ).trim()
  var oQueFalta = String(body.o_que_falta || 'Análise da falha ou intervenção humana.').trim()
  var decisaoNecessaria = String(
    body.decisao_necessaria || 'Verificar causa raiz e reprocessar comando se aplicável.',
  ).trim()
  var detalhes = body.detalhes || {}

  if (!nonce && !comandoId) {
    return e.json(400, { sucesso: false, erro: 'Parâmetro nonce ou comando_id obrigatório.' })
  }

  var cmd = null
  try {
    if (nonce) {
      var found = app.findRecordsByFilter(
        'elliza_comandos',
        "tenant_id = '" + tenantId + "' && nonce = '" + nonce + "'",
        '',
        1,
        0,
      )
      if (found && found.length > 0) cmd = found[0]
    } else if (comandoId) {
      cmd = app.findRecordById('elliza_comandos', comandoId)
      if (cmd.getString('tenant_id') !== tenantId) cmd = null
    }
  } catch (_) {}

  if (!cmd) {
    return e.json(404, { sucesso: false, erro: 'Comando não encontrado.' })
  }

  var tipoComando = cmd.getString('tipo')
  var empresaId = cmd.getString('empresa_id')
  var nowIso = new Date().toISOString()

  var pendCol = app.findCollectionByNameOrId('processo_pendencias')
  var pendRec = new Record(pendCol)
  pendRec.set('tenant_id', tenantId)
  if (empresaId) pendRec.set('empresa_id', empresaId)
  pendRec.set('titulo', 'Erro no comando ' + tipoComando + ': ' + codigoErro)
  pendRec.set('por_que_parou', motivo)
  pendRec.set('o_que_foi_executado', oQueFoiExecutado)
  pendRec.set('o_que_falta', oQueFalta)
  pendRec.set('decisao_necessaria', decisaoNecessaria)
  pendRec.set('status', 'aberta')
  app.save(pendRec)

  cmd.set('status', 'erro')
  cmd.set('erro', {
    codigo: codigoErro,
    motivo: motivo,
    referencia_pendencia: pendRec.id,
    detalhes: detalhes,
    timestamp: nowIso,
  })
  app.save(cmd)

  try {
    var aCol = app.findCollectionByNameOrId('audit_log')
    var aRec = new Record(aCol)
    aRec.set('tenant_id', tenantId)
    aRec.set('acao', 'COMANDO_PARADA_HONESTA_ERRO')
    aRec.set('entidade_tipo', 'elliza_comandos')
    aRec.set('entidade_id', cmd.id)
    aRec.set(
      'detalhes',
      JSON.stringify({
        nonce: cmd.getString('nonce'),
        tipo: tipoComando,
        codigo: codigoErro,
        motivo: motivo,
        pendencia_id: pendRec.id,
        agente: agentIdent,
      }),
    )
    app.save(aRec)
  } catch (_) {}

  return e.json(200, {
    sucesso: true,
    mensagem:
      'Erro honesto registrado com sucesso. Pendência estruturada aberta para o escritório.',
    status: 'erro',
    comando_id: cmd.id,
    nonce: cmd.getString('nonce'),
    codigo_erro: codigoErro,
    motivo: motivo,
    pendencia_id: pendRec.id,
  })
})

/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoints de Integração para Agente Externo (RPA / Playwright + Computer Use / Python)
 * Operando sobre a Fila Operacional da Elliza com Privilégio Mínimo e Trilha de Auditoria.
 * PocketBase JSVM: todas as funções auxiliares ficam estritamente dentro dos callbacks.
 *
 * Rotas expostas:
 * 1. POST /backend/v1/elliza-agente/auth/validar
 * 2. GET  /backend/v1/elliza-agente/tarefas-aprovadas
 * 3. POST /backend/v1/elliza-agente/tarefas/:id/iniciar
 * 4. POST /backend/v1/elliza-agente/tarefas/:id/concluir
 * 5. POST /backend/v1/elliza-agente/tarefas/:id/evidencias
 * 6. POST /backend/v1/elliza-agente/tarefas/:id/reportar-erro
 */

// 1. POST /backend/v1/elliza-agente/auth/validar
routerAdd('POST', '/backend/v1/elliza-agente/auth/validar', function (e) {
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

  try {
    var clientIp = req.remoteIp || req.headers['x-forwarded-for'] || ''
    ag.set('ultimo_acesso_em', new Date().toISOString())
    if (clientIp) ag.set('ip_origem_recente', String(clientIp).slice(0, 60))
    app.save(ag)
  } catch (_) {}

  return e.json(200, {
    sucesso: true,
    mensagem: 'Autenticação de Agente Externo validada com sucesso.',
    agente: {
      id: ag.id,
      identificador: ag.getString('identificador_agente'),
      nome: ag.getString('nome'),
      tipo_integracao: ag.getString('tipo_integracao'),
      status: ag.getString('status'),
      permite_execucao: ag.getBool('permite_execucao'),
      permite_evidencia: ag.getBool('permite_evidencia'),
      limitar_areas: ag.get('limitar_areas_json') || [],
      total_tarefas_executadas: ag.getInt('total_tarefas_executadas'),
    },
    tenant_id: ag.getString('tenant_id'),
    timestamp: new Date().toISOString(),
  })
})

// 2. GET /backend/v1/elliza-agente/tarefas-aprovadas
routerAdd('GET', '/backend/v1/elliza-agente/tarefas-aprovadas', function (e) {
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

  var agent = records[0]
  var tenantId = agent.getString('tenant_id')
  var agentIdent = agent.getString('identificador_agente')

  // Privilégio mínimo: tarefas APROVADAS atribuídas a este agente OU sem agente atribuído
  var filter = "tenant_id = '" + tenantId + "' && status = 'APROVADO'"

  var areasPermitidas = agent.get('limitar_areas_json') || []
  if (Array.isArray(areasPermitidas) && areasPermitidas.length > 0) {
    var areaParts = []
    for (var i = 0; i < areasPermitidas.length; i++) {
      areaParts.push("area = '" + areasPermitidas[i] + "'")
    }
    filter += ' && (' + areaParts.join(' || ') + ')'
  }

  filter += " && (agente_externo_id = '' || agente_externo_id = '" + agentIdent + "')"

  var jobs = []
  try {
    jobs = app.findRecordsByFilter('elisa_jobs', filter, '-prioridade,prazo,-created', 50, 0)
  } catch (err) {
    return e.json(500, { sucesso: false, erro: 'Falha ao buscar jobs: ' + String(err) })
  }

  var tarefasEstruturadas = []
  for (var j = 0; j < jobs.length; j++) {
    var job = jobs[j]
    var empId = job.getString('empresa_id')
    var procId = job.getString('processo_id')
    var etapaId = job.getString('etapa_id')

    var empresaInfo = { id: empId, razao_social: '', nome_fantasia: '', cnpj: '' }
    try {
      var empRec = app.findRecordById('empresas', empId)
      empresaInfo.razao_social = empRec.getString('razao_social')
      empresaInfo.nome_fantasia = empRec.getString('nome_fantasia')
      empresaInfo.cnpj = empRec.getString('cnpj')
    } catch (_) {}

    var processoInfo = { id: procId, titulo: '', codigo_sop: '', area: '', sop_id: '' }
    try {
      var procRec = app.findRecordById('processos_operacionais', procId)
      processoInfo.titulo = procRec.getString('titulo')
      processoInfo.codigo_sop = procRec.getString('codigo_sop')
      processoInfo.area = procRec.getString('area')
      processoInfo.sop_id = procRec.getString('sop_id')
    } catch (_) {}

    var etapaInfo = {
      id: etapaId,
      ordem: 0,
      titulo: job.getString('etapa_atual_nome'),
      acao: job.getString('proxima_acao'),
      criterio_sucesso: '',
      criterio_erro: '',
      proxima_etapa_nome: '',
    }

    if (etapaId) {
      try {
        var etRec = app.findRecordById('processo_etapas', etapaId)
        etapaInfo.ordem = etRec.getInt('ordem')
        etapaInfo.titulo = etRec.getString('titulo') || etapaInfo.titulo
        etapaInfo.acao = etRec.getString('acao') || etapaInfo.acao
        etapaInfo.criterio_sucesso = etRec.getString('criterio_sucesso')
        etapaInfo.criterio_erro = etRec.getString('criterio_erro')
        etapaInfo.proxima_etapa_nome = etRec.getString('proxima_etapa_nome')
      } catch (_) {}
    }

    var payload = job.get('payload_execucao_json') || {}
    var criterioSucesso =
      etapaInfo.criterio_sucesso ||
      (payload && payload.criterio_sucesso) ||
      'Operação validada sem divergências.'
    var criterioErro =
      etapaInfo.criterio_erro ||
      (payload && payload.criterio_erro) ||
      'Falha de comunicação ou rejeição de formulário no portal.'
    var orientacaoErro =
      'Em caso de erro, chamar POST /tarefas/:id/reportar-erro com detalhes estruturados. NUNCA adivinhar dados críticos.'

    tarefasEstruturadas.push({
      job_id: job.id,
      job_codigo: job.getString('job_codigo'),
      cliente: empresaInfo,
      competencia: job.getString('competencia'),
      area: job.getString('area'),
      processo: processoInfo,
      pop_relacionado: job.getString('pop_relacionado') || processoInfo.codigo_sop,
      etapa_atual: etapaInfo,
      proxima_acao: job.getString('proxima_acao'),
      criterio_sucesso: criterioSucesso,
      criterio_erro: criterioErro,
      o_que_fazer_em_caso_de_erro: orientacaoErro,
      prazo: job.getString('prazo'),
      prioridade: job.getString('prioridade'),
      nivel_autonomia: job.getString('nivel_autonomia'),
      status: job.getString('status'),
      payload_execucao: payload,
      atribuido_ao_agente: agentIdent,
    })
  }

  try {
    agent.set('ultima_busca_em', new Date().toISOString())
    app.save(agent)
  } catch (_) {}

  return e.json(200, {
    sucesso: true,
    total_tarefas_aprovadas: tarefasEstruturadas.length,
    agente: agentIdent,
    tarefas: tarefasEstruturadas,
  })
})

// 3. POST /backend/v1/elliza-agente/tarefas/:id/iniciar
routerAdd('POST', '/backend/v1/elliza-agente/tarefas/{id}/iniciar', function (e) {
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

  var agent = records[0]
  var tenantId = agent.getString('tenant_id')
  var agentIdent = agent.getString('identificador_agente')
  var jobId = req.params.id

  var job = null
  try {
    job = app.findRecordById('elisa_jobs', jobId)
  } catch (_) {
    return e.json(404, { sucesso: false, erro: 'Job com ID ' + jobId + ' não encontrado.' })
  }

  if (job.getString('tenant_id') !== tenantId) {
    return e.json(403, { sucesso: false, erro: 'Job pertence a outro escritório.' })
  }

  var statusAtual = job.getString('status')
  if (statusAtual !== 'APROVADO' && statusAtual !== 'ENFILEIRADO') {
    return e.json(400, {
      sucesso: false,
      erro:
        'Apenas jobs com status APROVADO ou ENFILEIRADO podem ser iniciados. Status atual: ' +
        statusAtual,
    })
  }

  var nowIso = new Date().toISOString()
  job.set('status', 'EM_EXECUCAO')
  job.set('agente_responsavel', agent.getString('nome'))
  job.set('executado_por_agente_externo', true)
  job.set('agente_externo_id', agentIdent)
  job.set('agente_externo_nome', agent.getString('nome'))
  job.set('data_inicio_execucao', nowIso)
  job.set('resultado', 'Em execução pelo Agente Externo (' + agent.getString('nome') + ')')
  app.save(job)

  var procId = job.getString('processo_id')
  if (procId) {
    try {
      var proc = app.findRecordById('processos_operacionais', procId)
      proc.set('status', 'EM_EXECUCAO')
      proc.set('agente_responsavel', agent.getString('nome'))
      proc.set(
        'ultima_acao_executada',
        'Início da execução pelo agente externo: ' + agent.getString('nome'),
      )
      app.save(proc)
    } catch (_) {}
  }

  var etapaId = job.getString('etapa_id')
  if (etapaId) {
    try {
      var et = app.findRecordById('processo_etapas', etapaId)
      et.set('status', 'EM_EXECUCAO')
      et.set('responsavel_tipo', 'Elliza')
      et.set('data_inicio', nowIso)
      et.set('resultado', 'Execução iniciada pelo agente externo (' + agentIdent + ')')
      app.save(et)
    } catch (_) {}
  }

  try {
    var auditCol = app.findCollectionByNameOrId('audit_log')
    var aRec = new Record(auditCol)
    aRec.set('tenant_id', tenantId)
    aRec.set('acao', 'AGENTE_EXTERNO_INICIOU_JOB')
    aRec.set('entidade_tipo', 'elisa_jobs')
    aRec.set('entidade_id', jobId)
    aRec.set(
      'detalhes',
      JSON.stringify({
        agente_id: agentIdent,
        agente_nome: agent.getString('nome'),
        job_codigo: job.getString('job_codigo'),
        etapa: job.getString('etapa_atual_nome'),
        iniciado_em: nowIso,
      }),
    )
    app.save(aRec)
  } catch (errAudit) {
    console.warn('[AGENTE_EXTERNO] Falha ao registrar audit_log de início:', errAudit)
  }

  return e.json(200, {
    sucesso: true,
    mensagem: 'Job iniciado com sucesso. Status alterado para EM_EXECUCAO.',
    job_id: jobId,
    job_codigo: job.getString('job_codigo'),
    status: 'EM_EXECUCAO',
    data_inicio_execucao: nowIso,
  })
})

// 4. POST /backend/v1/elliza-agente/tarefas/:id/concluir
routerAdd('POST', '/backend/v1/elliza-agente/tarefas/{id}/concluir', function (e) {
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

  var agent = records[0]
  var tenantId = agent.getString('tenant_id')
  var agentIdent = agent.getString('identificador_agente')
  var jobId = req.params.id

  var body = {}
  try {
    body = req.body || {}
  } catch (_) {}

  var resultadoTexto = String(
    body.resultado || 'Execução concluída com sucesso pelo agente externo.',
  ).trim()
  var criterioSucessoValidado = Boolean(body.criterio_sucesso_validado)
  var tempoExecucaoSegundos = Number(body.tempo_execucao_segundos) || 0

  var job = null
  try {
    job = app.findRecordById('elisa_jobs', jobId)
  } catch (_) {
    return e.json(404, { sucesso: false, erro: 'Job com ID ' + jobId + ' não encontrado.' })
  }

  if (job.getString('tenant_id') !== tenantId) {
    return e.json(403, { sucesso: false, erro: 'Job pertence a outro escritório.' })
  }

  if (!criterioSucessoValidado) {
    return e.json(400, {
      sucesso: false,
      erro: 'Regra de Ouro: critério de sucesso deve ser explicitamente validado (criterio_sucesso_validado: true) para transição para CONCLUIDO.',
    })
  }

  var nowIso = new Date().toISOString()
  var procId = job.getString('processo_id')
  var etapaId = job.getString('etapa_id')

  var etapaAtualRec = null
  if (etapaId) {
    try {
      etapaAtualRec = app.findRecordById('processo_etapas', etapaId)
      etapaAtualRec.set('status', 'CONCLUIDO')
      etapaAtualRec.set('data_conclusao', nowIso)
      etapaAtualRec.set('resultado', resultadoTexto)
      app.save(etapaAtualRec)
    } catch (_) {}
  }

  var proximaEtapaRec = null
  var todasEtapas = []
  if (procId) {
    try {
      todasEtapas = app.findRecordsByFilter(
        'processo_etapas',
        "processo_id = '" + procId + "'",
        'ordem',
        50,
        0,
      )
    } catch (_) {}
  }

  if (etapaAtualRec && todasEtapas.length > 0) {
    var ordemAtual = etapaAtualRec.getInt('ordem')
    for (var k = 0; k < todasEtapas.length; k++) {
      if (todasEtapas[k].getInt('ordem') === ordemAtual + 1) {
        proximaEtapaRec = todasEtapas[k]
        break
      }
    }
  }

  var processoConcluido = false
  if (proximaEtapaRec) {
    proximaEtapaRec.set('status', 'ENFILEIRADO')
    app.save(proximaEtapaRec)

    try {
      var procRec = app.findRecordById('processos_operacionais', procId)
      var totalEt = todasEtapas.length || 1
      var concluidasCount = 0
      for (var c = 0; c < todasEtapas.length; c++) {
        if (todasEtapas[c].getString('status') === 'CONCLUIDO' || todasEtapas[c].id === etapaId) {
          concluidasCount++
        }
      }
      var progresso = Math.min(100, Math.round((concluidasCount / totalEt) * 100))
      procRec.set('status', 'ENFILEIRADO')
      procRec.set('etapa_atual_numero', proximaEtapaRec.getInt('ordem'))
      procRec.set('etapa_atual_nome', proximaEtapaRec.getString('titulo'))
      procRec.set('progresso_percentual', progresso)
      procRec.set(
        'ultima_acao_executada',
        'Etapa ' + etapaAtualRec.getInt('ordem') + ' concluída com sucesso pelo Agente Externo.',
      )
      procRec.set('resultado_ultima_acao', resultadoTexto)
      procRec.set('proxima_acao', proximaEtapaRec.getString('acao') || 'Executar próxima etapa')
      procRec.set('criterio_sucesso_atual', proximaEtapaRec.getString('criterio_sucesso') || '')
      app.save(procRec)
    } catch (_) {}

    job.set('status', 'CONCLUIDO')
    job.set('resultado', resultadoTexto)
    job.set('data_fim_execucao', nowIso)
    if (tempoExecucaoSegundos > 0) job.set('tempo_execucao_segundos', tempoExecucaoSegundos)
    app.save(job)
  } else {
    processoConcluido = true
    try {
      var pRec = app.findRecordById('processos_operacionais', procId)
      pRec.set('status', 'CONCLUIDO')
      pRec.set('progresso_percentual', 100)
      pRec.set('data_conclusao', nowIso)
      pRec.set('ultima_acao_executada', 'Todas as etapas foram finalizadas e chanceladas.')
      pRec.set('resultado_ultima_acao', resultadoTexto)
      pRec.set('proxima_acao', 'Nenhuma (Processo Encerrado com Êxito)')
      app.save(pRec)
    } catch (_) {}

    job.set('status', 'CONCLUIDO')
    job.set('resultado', resultadoTexto)
    job.set('data_fim_execucao', nowIso)
    if (tempoExecucaoSegundos > 0) job.set('tempo_execucao_segundos', tempoExecucaoSegundos)
    app.save(job)
  }

  try {
    var totalAtual = agent.getInt('total_tarefas_executadas') || 0
    agent.set('total_tarefas_executadas', totalAtual + 1)
    agent.set('ultima_execucao_em', nowIso)
    app.save(agent)
  } catch (_) {}

  try {
    var aCol = app.findCollectionByNameOrId('audit_log')
    var aRecord = new Record(aCol)
    aRecord.set('tenant_id', tenantId)
    aRecord.set('acao', 'AGENTE_EXTERNO_CONCLUIU_JOB')
    aRecord.set('entidade_tipo', 'elisa_jobs')
    aRecord.set('entidade_id', jobId)
    aRecord.set(
      'detalhes',
      JSON.stringify({
        agente_id: agentIdent,
        job_codigo: job.getString('job_codigo'),
        criterio_sucesso_validado: true,
        proxima_etapa: proximaEtapaRec
          ? proximaEtapaRec.getString('titulo')
          : 'NENHUMA (PROCESSO CONCLUIDO)',
        processo_concluido: processoConcluido,
        duracao_segundos: tempoExecucaoSegundos,
      }),
    )
    app.save(aRecord)
  } catch (errAudit) {
    console.warn('[AGENTE_EXTERNO] Erro ao gravar audit_log de conclusão:', errAudit)
  }

  return e.json(200, {
    sucesso: true,
    mensagem: 'Job concluído e validado com sucesso.',
    job_id: jobId,
    job_codigo: job.getString('job_codigo'),
    etapa_concluida_id: etapaId,
    proxima_etapa: proximaEtapaRec
      ? {
          id: proximaEtapaRec.id,
          ordem: proximaEtapaRec.getInt('ordem'),
          titulo: proximaEtapaRec.getString('titulo'),
          acao: proximaEtapaRec.getString('acao'),
        }
      : null,
    processo_concluido: processoConcluido,
  })
})

// 5. POST /backend/v1/elliza-agente/tarefas/:id/evidencias
routerAdd('POST', '/backend/v1/elliza-agente/tarefas/{id}/evidencias', function (e) {
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

  var agent = records[0]
  var tenantId = agent.getString('tenant_id')
  var agentIdent = agent.getString('identificador_agente')
  var jobId = req.params.id

  var job = null
  try {
    job = app.findRecordById('elisa_jobs', jobId)
  } catch (_) {
    return e.json(404, { sucesso: false, erro: 'Job com ID ' + jobId + ' não encontrado.' })
  }

  if (job.getString('tenant_id') !== tenantId) {
    return e.json(403, { sucesso: false, erro: 'Job pertence a outro escritório.' })
  }

  var body = {}
  try {
    body = req.body || {}
  } catch (_) {}

  var titulo = String(body.titulo || 'Evidência de Execução de Agente Externo').trim()
  var tipo = String(body.tipo || 'screenshot').toLowerCase()
  var protocolo = String(body.protocolo_numero || '').trim()
  var numeroOperacao = String(
    body.numero_operacao || 'OP-EXT-' + Date.now().toString().slice(-8),
  ).trim()
  var hashSha256 = String(body.hash_sha256 || '').trim()
  var descricao = String(body.descricao || '').trim()
  var resultadoObtido = String(
    body.resultado_obtido || 'Evidência capturada e validada pelo agente externo.',
  ).trim()
  var salvarNoGed = Boolean(body.salvar_no_ged)
  var nomeArquivo = String(body.nome_arquivo || '').trim()

  if (!hashSha256) {
    hashSha256 = $security.sha256(
      jobId + '|' + numeroOperacao + '|' + new Date().toISOString() + '|' + agentIdent,
    )
  }

  var validTypes = [
    'screenshot',
    'documento_ged',
    'protocolo',
    'recibo',
    'log_operacao',
    'hash_assinatura',
  ]
  if (validTypes.indexOf(tipo) === -1) {
    tipo = 'protocolo'
  }

  var procId = job.getString('processo_id')
  var empId = job.getString('empresa_id')
  var etapaId = job.getString('etapa_id')

  var evidCol = app.findCollectionByNameOrId('elisa_evidencias')
  var evRec = new Record(evidCol)
  evRec.set('tenant_id', tenantId)
  evRec.set('processo_id', procId)
  evRec.set('job_id', jobId)
  if (etapaId) evRec.set('etapa_id', etapaId)
  evRec.set('empresa_id', empId)
  evRec.set('tipo', tipo)
  evRec.set('titulo', titulo)
  evRec.set('descricao', descricao)
  evRec.set('protocolo_numero', protocolo || numeroOperacao)
  evRec.set('numero_operacao', numeroOperacao)
  evRec.set('hash_sha256', hashSha256)
  evRec.set('executado_por', agent.getString('nome') + ' (' + agentIdent + ')')
  evRec.set('resultado_obtido', resultadoObtido)
  evRec.set('dados_tecnicos_json', {
    agente_identificador: agentIdent,
    agente_tipo: agent.getString('tipo_integracao'),
    job_codigo: job.getString('job_codigo'),
    timestamp: new Date().toISOString(),
    payload_enviado: body.dados_adicionais || {},
  })
  app.save(evRec)

  var docGedId = null
  if (salvarNoGed && empId) {
    try {
      var docCol = app.findCollectionByNameOrId('documentos')
      var docRec = new Record(docCol)
      docRec.set('tenant_id', tenantId)
      docRec.set('empresa_id', empId)
      docRec.set('nome_arquivo', nomeArquivo || 'comprovante_' + numeroOperacao + '.pdf')
      docRec.set('tipo', 'outros')
      docRec.set('status', 'processado')
      docRec.set('origem_documento', 'sistema')
      docRec.set(
        'observacoes',
        'Gerado via RPA Agente Externo (' +
          agent.getString('nome') +
          '). Protocolo: ' +
          (protocolo || numeroOperacao) +
          ' | SHA-256: ' +
          hashSha256,
      )
      app.save(docRec)
      docGedId = docRec.id
    } catch (errGed) {
      console.warn('[AGENTE_EXTERNO] Aviso: não foi possível criar documento no GED:', errGed)
    }
  }

  try {
    job.set(
      'evidencia_resumo',
      'Evidência gravada: ' +
        titulo +
        ' (Protocolo: ' +
        (protocolo || numeroOperacao) +
        ', Hash: ' +
        hashSha256.slice(0, 16) +
        '...)',
    )
    app.save(job)
  } catch (_) {}

  try {
    var aCol = app.findCollectionByNameOrId('audit_log')
    var aRec = new Record(aCol)
    aRec.set('tenant_id', tenantId)
    aRec.set('acao', 'AGENTE_EXTERNO_ENVIOU_EVIDENCIA')
    aRec.set('entidade_tipo', 'elisa_evidencias')
    aRec.set('entidade_id', evRec.id)
    aRec.set(
      'detalhes',
      JSON.stringify({
        agente_id: agentIdent,
        job_id: jobId,
        job_codigo: job.getString('job_codigo'),
        titulo: titulo,
        tipo: tipo,
        hash_sha256: hashSha256,
        protocolo: protocolo || numeroOperacao,
        documento_ged_id: docGedId,
      }),
    )
    app.save(aRec)
  } catch (errAudit) {
    console.warn('[AGENTE_EXTERNO] Erro ao gravar audit_log de evidência:', errAudit)
  }

  return e.json(201, {
    sucesso: true,
    mensagem: 'Evidência auditável registrada com sucesso.',
    evidencia_id: evRec.id,
    protocolo_numero: protocolo || numeroOperacao,
    hash_sha256: hashSha256,
    documento_ged_id: docGedId,
    vinculacao: {
      tenant_id: tenantId,
      empresa_id: empId,
      processo_id: procId,
      job_id: jobId,
      etapa_id: etapaId,
    },
  })
})

// 6. POST /backend/v1/elliza-agente/tarefas/:id/reportar-erro
routerAdd('POST', '/backend/v1/elliza-agente/tarefas/{id}/reportar-erro', function (e) {
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

  var agent = records[0]
  var tenantId = agent.getString('tenant_id')
  var agentIdent = agent.getString('identificador_agente')
  var jobId = req.params.id

  var body = {}
  try {
    body = req.body || {}
  } catch (_) {}

  var porQueParou = String(body.por_que_parou || '').trim()
  var oQueFoiExecutado = String(body.o_que_foi_executado || '').trim()
  var oQueFalta = String(body.o_que_falta || '').trim()
  var decisaoNecessaria = String(body.decisao_necessaria || '').trim()
  var tituloPendencia = String(
    body.titulo || 'Exceção reportada por Agente Externo (' + agent.getString('nome') + ')',
  ).trim()
  var statusDestino = String(body.status_processo || 'BLOQUEADO').toUpperCase()

  if (!porQueParou || !decisaoNecessaria) {
    return e.json(400, {
      sucesso: false,
      erro: 'Campos por_que_parou e decisao_necessaria são obrigatórios para reportar exceção honesta.',
    })
  }

  if (statusDestino !== 'BLOQUEADO' && statusDestino !== 'AGUARDANDO_CONFERENCIA') {
    statusDestino = 'BLOQUEADO'
  }

  var job = null
  try {
    job = app.findRecordById('elisa_jobs', jobId)
  } catch (_) {
    return e.json(404, { sucesso: false, erro: 'Job com ID ' + jobId + ' não encontrado.' })
  }

  if (job.getString('tenant_id') !== tenantId) {
    return e.json(403, { sucesso: false, erro: 'Job pertence a outro escritório.' })
  }

  var procId = job.getString('processo_id')
  var empId = job.getString('empresa_id')
  var etapaId = job.getString('etapa_id')

  var pendCol = app.findCollectionByNameOrId('processo_pendencias')
  var pendRec = new Record(pendCol)
  pendRec.set('tenant_id', tenantId)
  pendRec.set('processo_id', procId)
  if (etapaId) pendRec.set('etapa_id', etapaId)
  pendRec.set('job_id', jobId)
  pendRec.set('empresa_id', empId)
  pendRec.set('titulo', tituloPendencia)
  pendRec.set('por_que_parou', porQueParou)
  pendRec.set(
    'o_que_foi_executado',
    oQueFoiExecutado || 'Execução automatizada em tela iniciada via Playwright.',
  )
  pendRec.set('o_que_falta', oQueFalta || 'Intervenção humana para resolução do bloqueio.')
  pendRec.set('decisao_necessaria', decisaoNecessaria)
  pendRec.set('status', 'aberta')
  app.save(pendRec)

  job.set(
    'status',
    statusDestino === 'AGUARDANDO_CONFERENCIA' ? 'AGUARDANDO_CONFERENCIA' : 'BLOQUEADO',
  )
  job.set('erro_mensagem', porQueParou)
  job.set('resultado', 'Retido com segurança: ' + porQueParou)
  app.save(job)

  if (procId) {
    try {
      var proc = app.findRecordById('processos_operacionais', procId)
      proc.set('status', statusDestino)
      proc.set('motivo_parada_ou_erro', porQueParou)
      proc.set('decisao_necessaria_humana', decisaoNecessaria)
      proc.set('resultado_ultima_acao', 'Exceção retida pelo Agente Externo: ' + porQueParou)
      app.save(proc)
    } catch (_) {}
  }

  if (etapaId) {
    try {
      var et = app.findRecordById('processo_etapas', etapaId)
      et.set('status', statusDestino)
      et.set('resultado', 'Parada reportada: ' + porQueParou)
      app.save(et)
    } catch (_) {}
  }

  try {
    var aCol = app.findCollectionByNameOrId('audit_log')
    var aRec = new Record(aCol)
    aRec.set('tenant_id', tenantId)
    aRec.set('acao', 'AGENTE_EXTERNO_REPORTOU_ERRO')
    aRec.set('entidade_tipo', 'processo_pendencias')
    aRec.set('entidade_id', pendRec.id)
    aRec.set(
      'detalhes',
      JSON.stringify({
        agente_id: agentIdent,
        job_id: jobId,
        job_codigo: job.getString('job_codigo'),
        por_que_parou: porQueParou,
        decisao_necessaria: decisaoNecessaria,
        status_processo_resultante: statusDestino,
      }),
    )
    app.save(aRec)
  } catch (errAudit) {
    console.warn('[AGENTE_EXTERNO] Erro ao gravar audit_log de erro:', errAudit)
  }

  return e.json(201, {
    sucesso: true,
    mensagem:
      'Exceção registrada com sucesso no Modo Humano. Processo pausado com segurança sem adivinhação.',
    pendencia_id: pendRec.id,
    processo_status: statusDestino,
    job_status: job.getString('status'),
  })
})

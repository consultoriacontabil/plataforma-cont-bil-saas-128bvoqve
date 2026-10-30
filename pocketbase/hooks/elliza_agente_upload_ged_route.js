/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoint de Upload de Documentos para o Agente Externo ELLIZA Desktop (RPA)
 * Rota: POST /backend/v1/elliza-agente/upload-documento
 *
 * Contrato:
 * - Autenticação por Header: X-Elliza-Api-Key ou Authorization: Bearer <chave>
 * - Content-Type: multipart/form-data
 * - Campos esperados no form:
 *     - arquivo: arquivo binário (PDF, XML, XLSX, etc.)
 *     - cnpj: CNPJ da empresa (com ou sem pontuação, extraído determinísticamente da pasta CNPJ\AAAA-MM)
 *     - competencia: competência no formato AAAA-MM (extraída determinísticamente da pasta)
 *     - hash_sha256: hash SHA-256 obrigatório do arquivo calculado pela ELLIZA Desktop
 *     - nome_arquivo: (opcional) nome do arquivo original
 *     - tipo_documento: (opcional) classificação sugerida (extrato_bancario, nfse, nfe, sped, etc. Padrão: 'outros')
 *     - job_id: (opcional) ID do elisa_job em execução
 *
 * Regras de Negócio e Trilha RPA v1.0:
 * 1. Autenticação e tenant escopado à chave da ELLIZA desktop.
 * 2. Validação determinística do CNPJ: empresa DEVE existir e pertencer ao tenant da chave.
 * 3. Validação determinística da competência: formato estrito AAAA-MM (ex: 2026-09).
 * 4. Hash SHA-256 obrigatório: se ausente ou inválido, parada honesta.
 * 5. Deduplicação por hash: se já existir documento para a mesma empresa com o mesmo hash_sha256,
 *    responde status 'deduplicado' com os dados do documento existente, SEM duplicar.
 * 6. Parada Honesta: se CNPJ for inexistente/inválido ou competência for inválida ou arquivo ausente,
 *    responde erro 400/422 com motivo exato e registra pendência humana na collection 'processo_pendencias'.
 * 7. Gravação e Auditoria: em caso de arquivo novo, salva na collection 'documentos', vincula à empresa,
 *    registra hash_sha256 e competencia e gera evento no 'audit_log'.
 */

routerAdd('POST', '/backend/v1/elliza-agente/upload-documento', function (e) {
  var req = e.requestInfo()
  var headers = req.headers || {}

  // 1. Extração da API Key
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
  var keyHash = $security.sha256(apiKey)

  var agentRecords = []
  try {
    agentRecords = app.findRecordsByFilter(
      'elliza_agente_externo_chaves',
      "api_key_hash = '" + keyHash + "' && status = 'ativo'",
      '',
      1,
      0,
    )
  } catch (errAuth) {
    return e.json(500, {
      sucesso: false,
      erro: 'Erro interno ao validar credenciais do agente: ' + String(errAuth),
    })
  }

  if (!agentRecords || agentRecords.length === 0) {
    return e.json(401, {
      sucesso: false,
      erro: 'Credenciais de agente externo inválidas ou revogadas.',
    })
  }

  var agent = agentRecords[0]
  var tenantId = agent.getString('tenant_id')
  var agentIdent = agent.getString('identificador_agente')
  var agentNome = agent.getString('nome')

  // 2. Extração dos parâmetros multipart/form-data e/ou JSON
  var body = {}
  try {
    body = req.body || {}
  } catch (_) {}

  var rawCnpj = String(body.cnpj || '').trim()
  var cleanCnpj = rawCnpj.replace(/\D/g, '')

  var competencia = String(body.competencia || '').trim()
  var hashSha256 = String(body.hash_sha256 || body.hash || '')
    .trim()
    .toLowerCase()
  var nomeArquivo = String(body.nome_arquivo || '').trim()
  var tipoDoc = String(body.tipo_documento || body.tipo || 'outros').trim()
  var jobId = String(body.job_id || '').trim()

  // Arquivo binário do multipart
  var uploadedFiles = []
  try {
    uploadedFiles = e.findUploadedFiles('arquivo')
  } catch (_) {}
  if (!uploadedFiles || uploadedFiles.length === 0) {
    try {
      uploadedFiles = e.findUploadedFiles('file')
    } catch (_) {}
  }

  // Helper para registrar Parada Honesta e pendência humana
  function registrarParadaHonesta(motivo, decisaoNecessaria, httpStatus) {
    var pendRecId = ''
    try {
      var pendCol = app.findCollectionByNameOrId('processo_pendencias')
      var p = new Record(pendCol)
      p.set('tenant_id', tenantId)
      p.set(
        'titulo',
        'Arquivo não classificável na Sincronização Pasta → GED (' +
          (nomeArquivo || 'sem_nome') +
          ')',
      )
      p.set('por_que_parou', motivo)
      p.set(
        'o_que_foi_executado',
        'ELLIZA Desktop varreu a pasta local e tentou classificar o arquivo ' +
          (nomeArquivo || 'desconhecido') +
          ' via rota /upload-documento.',
      )
      p.set('o_que_falta', 'Classificação manual e atribuição à empresa e competência corretas.')
      p.set('decisao_necessaria', decisaoNecessaria)
      p.set('status', 'aberta')
      if (jobId) p.set('job_id', jobId)
      app.save(p)
      pendRecId = p.id
    } catch (errPend) {
      console.warn('[UPLOAD-GED] Erro ao criar pendência:', errPend)
    }

    // Se temos job_id, registrar nas estatísticas de rejeição do job
    if (jobId) {
      try {
        var job = app.findRecordById('elisa_jobs', jobId)
        if (job && job.getString('tenant_id') === tenantId) {
          var payload = job.get('payload_execucao_json') || {}
          var stats = payload.estatisticas || {
            arquivados: 0,
            deduplicados: 0,
            rejeitados: 0,
            arquivos_rejeitados_detalhes: [],
          }
          stats.rejeitados = (stats.rejeitados || 0) + 1
          if (!Array.isArray(stats.arquivos_rejeitados_detalhes)) {
            stats.arquivos_rejeitados_detalhes = []
          }
          stats.arquivos_rejeitados_detalhes.push({
            nome_arquivo: nomeArquivo || 'arquivo_sem_nome',
            cnpj: rawCnpj || 'não informado',
            competencia: competencia || 'não informada',
            hash_sha256: hashSha256 || 'não calculado',
            motivo: motivo,
            data: new Date().toISOString(),
          })
          payload.estatisticas = stats
          job.set('payload_execucao_json', payload)
          // Se tiver rejeição, podemos sinalizar erro_mensagem no job sem bloquear totalmente
          if (!job.getString('erro_mensagem')) {
            job.set('erro_mensagem', 'Existem arquivos rejeitados na pasta: ' + motivo)
          }
          app.save(job)
        }
      } catch (_) {}
    }

    return e.json(httpStatus || 422, {
      sucesso: false,
      status: 'rejeitado',
      parada_honesta: true,
      motivo: motivo,
      decisao_necessaria: decisaoNecessaria,
      pendencia_id: pendRecId,
      arquivo: nomeArquivo || 'desconhecido',
    })
  }

  // 3. Validação: Hash SHA-256 obrigatório
  if (!hashSha256 || hashSha256.length < 32) {
    return registrarParadaHonesta(
      'Hash SHA-256 do arquivo ausente ou inválido. O contrato da ELLIZA Desktop exige cálculo de hash prévio para garantia de integridade e deduplicação.',
      'Calcular o hash SHA-256 do arquivo na máquina local antes de reenviar.',
      400,
    )
  }

  // 4. Validação determinística do CNPJ (14 dígitos)
  if (!cleanCnpj || cleanCnpj.length !== 14) {
    return registrarParadaHonesta(
      'CNPJ inválido ou fora do padrão de 14 dígitos (recebido: "' +
        rawCnpj +
        '"). A estrutura de pastas deve seguir determinísticamente o padrão CNPJ\\AAAA-MM.',
      'Mover o arquivo para uma subpasta com CNPJ válido de 14 dígitos cadastrado na Rumo Contábil.',
      422,
    )
  }

  // 5. Validação determinística da competência (formato AAAA-MM)
  var competenciaRegex = /^\d{4}-(0[1-9]|1[0-2])$/
  if (!competencia || !competenciaRegex.test(competencia)) {
    return registrarParadaHonesta(
      'Competência inválida ou fora do formato AAAA-MM (recebido: "' +
        competencia +
        '"). Exemplo correto: 2026-09. A estrutura de pastas exige CNPJ\\AAAA-MM.',
      'Organizar a pasta da competência no formato AAAA-MM (exemplo: 2026-09) antes de reenviar.',
      422,
    )
  }

  // 6. Validação: Empresa existe e pertence ao tenant
  var empresa = null
  try {
    var empresasMatch = app.findRecordsByFilter(
      'empresas',
      "tenant_id = '" + tenantId + "' && (cnpj = '" + cleanCnpj + "' || cnpj = '" + rawCnpj + "')",
      '',
      1,
      0,
    )
    if (empresasMatch && empresasMatch.length > 0) {
      empresa = empresasMatch[0]
    }
  } catch (errEmp) {
    console.warn('[UPLOAD-GED] Erro ao buscar empresa:', errEmp)
  }

  if (!empresa) {
    return registrarParadaHonesta(
      'Empresa com CNPJ ' +
        rawCnpj +
        ' não foi encontrada no escritório (tenant ' +
        tenantId +
        '). Regra de ouro da Rumo: parada honesta sem adivinhar destino.',
      'Cadastrar a empresa na plataforma Rumo ou corrigir o CNPJ da pasta local.',
      404,
    )
  }

  var empresaId = empresa.id
  var razaoSocial = empresa.getString('razao_social')

  // 7. DEDUPLICAÇÃO POR HASH: Consultar se já existe documento com este hash para esta empresa
  try {
    var docsExistentes = app.findRecordsByFilter(
      'documentos',
      "empresa_id = '" + empresaId + "' && hash_sha256 = '" + hashSha256 + "'",
      '-created',
      1,
      0,
    )
    if (docsExistentes && docsExistentes.length > 0) {
      var docEx = docsExistentes[0]

      // Atualizar estatísticas do job se houver
      if (jobId) {
        try {
          var jobSync = app.findRecordById('elisa_jobs', jobId)
          if (jobSync && jobSync.getString('tenant_id') === tenantId) {
            var pSync = jobSync.get('payload_execucao_json') || {}
            var sSync = pSync.estatisticas || {
              arquivados: 0,
              deduplicados: 0,
              rejeitados: 0,
              documentos_ged_ids: [],
            }
            sSync.deduplicados = (sSync.deduplicados || 0) + 1
            pSync.estatisticas = sSync
            jobSync.set('payload_execucao_json', pSync)
            app.save(jobSync)
          }
        } catch (_) {}
      }

      // Auditoria da deduplicação
      try {
        var aColDedup = app.findCollectionByNameOrId('audit_log')
        var aRecDedup = new Record(aColDedup)
        aRecDedup.set('tenant_id', tenantId)
        aRecDedup.set('acao', 'GED_DOCUMENTO_DEDUPLICADO')
        aRecDedup.set('entidade_tipo', 'documentos')
        aRecDedup.set('entidade_id', docEx.id)
        aRecDedup.set(
          'detalhes',
          JSON.stringify({
            agente_id: agentIdent,
            empresa_id: empresaId,
            empresa_razao_social: razaoSocial,
            hash_sha256: hashSha256,
            nome_arquivo: nomeArquivo || docEx.getString('nome_arquivo'),
            competencia: competencia,
            mensagem: 'Documento idêntico já existia no GED da empresa. Nenhuma duplicata criada.',
          }),
        )
        app.save(aRecDedup)
      } catch (_) {}

      return e.json(200, {
        sucesso: true,
        status: 'deduplicado',
        mensagem:
          'Arquivo já arquivado previamente no GED desta empresa com o mesmo hash SHA-256. Nenhuma cópia duplicada foi criada.',
        documento_id: docEx.id,
        hash_sha256: hashSha256,
        empresa_id: empresaId,
        empresa_razao_social: razaoSocial,
        competencia: docEx.getString('competencia') || competencia,
        nome_arquivo: docEx.getString('nome_arquivo'),
      })
    }
  } catch (errDedup) {
    console.warn('[UPLOAD-GED] Erro ao consultar deduplicação:', errDedup)
  }

  // 8. Validação: Arquivo binário presente
  if (!uploadedFiles || uploadedFiles.length === 0) {
    return registrarParadaHonesta(
      'Nenhum arquivo binário foi enviado no campo multipart "arquivo" (ou "file").',
      'Fornecer o arquivo binário em multipart/form-data na requisição de upload.',
      400,
    )
  }

  var fileObj = uploadedFiles[0]
  var finalNomeArquivo = nomeArquivo || fileObj.name || 'documento_sincronizado'

  // 9. Gravar novo Documento no GED
  var docCol = app.findCollectionByNameOrId('documentos')
  var docRec = new Record(docCol)
  docRec.set('tenant_id', tenantId)
  docRec.set('empresa_id', empresaId)
  docRec.set('nome_arquivo', finalNomeArquivo)
  docRec.set('tipo', tipoDoc || 'outros')
  docRec.set('competencia', competencia)
  docRec.set('hash_sha256', hashSha256)
  docRec.set('origem_documento', 'agente_elliza_desktop')
  docRec.set('status', 'processado')
  docRec.set('data_upload', new Date().toISOString())
  docRec.set(
    'observacoes',
    'Sincronizado automaticamente da pasta local via ELLIZA Desktop RPA (' + agentIdent + ').',
  )
  docRec.set('arquivo', fileObj)

  try {
    app.save(docRec)
  } catch (errSaveDoc) {
    return e.json(500, {
      sucesso: false,
      erro: 'Falha ao salvar documento no GED: ' + String(errSaveDoc),
    })
  }

  // 10. Atualizar estatísticas do elisa_job e elisa_evidencias se jobId fornecido
  if (jobId) {
    try {
      var jobObj = app.findRecordById('elisa_jobs', jobId)
      if (jobObj && jobObj.getString('tenant_id') === tenantId) {
        var pJob = jobObj.get('payload_execucao_json') || {}
        var sJob = pJob.estatisticas || {
          arquivados: 0,
          deduplicados: 0,
          rejeitados: 0,
          documentos_ged_ids: [],
        }
        sJob.arquivados = (sJob.arquivados || 0) + 1
        if (!Array.isArray(sJob.documentos_ged_ids)) {
          sJob.documentos_ged_ids = []
        }
        sJob.documentos_ged_ids.push(docRec.id)
        pJob.estatisticas = sJob
        jobObj.set('payload_execucao_json', pJob)
        app.save(jobObj)
      }
    } catch (_) {}

    // Registrar evidência de upload
    try {
      var evCol = app.findCollectionByNameOrId('elisa_evidencias')
      var evRec = new Record(evCol)
      evRec.set('tenant_id', tenantId)
      evRec.set('job_id', jobId)
      evRec.set('tipo', 'log_execucao')
      evRec.set('titulo', 'Documento arquivado no GED: ' + finalNomeArquivo)
      evRec.set('hash_sha256', hashSha256)
      evRec.set('executado_por', agentNome + ' (' + agentIdent + ')')
      evRec.set('payload_dados_json', {
        documento_id: docRec.id,
        empresa_id: empresaId,
        cnpj: cleanCnpj,
        competencia: competencia,
        nome_arquivo: finalNomeArquivo,
        tipo: tipoDoc,
        status: 'arquivado',
      })
      app.save(evRec)
    } catch (_) {}
  }

  // 11. Auditoria no audit_log
  try {
    var aCol = app.findCollectionByNameOrId('audit_log')
    var aRec = new Record(aCol)
    aRec.set('tenant_id', tenantId)
    aRec.set('acao', 'GED_DOCUMENTO_ARQUIVADO_RPA')
    aRec.set('entidade_tipo', 'documentos')
    aRec.set('entidade_id', docRec.id)
    aRec.set(
      'detalhes',
      JSON.stringify({
        agente_id: agentIdent,
        empresa_id: empresaId,
        empresa_razao_social: razaoSocial,
        cnpj: cleanCnpj,
        competencia: competencia,
        hash_sha256: hashSha256,
        nome_arquivo: finalNomeArquivo,
        tipo: tipoDoc,
        job_id: jobId || null,
      }),
    )
    app.save(aRec)
  } catch (errAudit) {
    console.warn('[UPLOAD-GED] Erro ao gravar audit_log:', errAudit)
  }

  return e.json(201, {
    sucesso: true,
    status: 'arquivado',
    mensagem:
      'Documento arquivado com sucesso no GED da empresa ' +
      razaoSocial +
      ' na competência ' +
      competencia +
      '.',
    documento_id: docRec.id,
    hash_sha256: hashSha256,
    empresa_id: empresaId,
    empresa_razao_social: razaoSocial,
    cnpj: cleanCnpj,
    competencia: competencia,
    nome_arquivo: finalNomeArquivo,
    tipo: tipoDoc,
  })
})

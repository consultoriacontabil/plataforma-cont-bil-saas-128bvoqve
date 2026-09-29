/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook de automação de backup independente e rotas de gestão de snapshots.
 * Toda a lógica interna é encapsulada DENTRO de cada callback (regra de escopo JSVM Skip Cloud).
 */

// 1. Cron diário às 03:30 UTC
cronAdd('daily_backup_snapshot_independente', '30 3 * * *', () => {
  var app = $app
  console.log(
    '[BACKUP_CRON] Iniciando snapshot agendado independente do banco e GED (03:30 UTC)...',
  )

  var CORE_COLLECTIONS = [
    'empresas',
    'documentos',
    'lancamentos_contabeis',
    'plano_contas',
    'folha_pagamento',
    'funcionarios',
    'eventos_dp',
    'obrigacoes',
    'fiscal',
    'whatsapp_envios',
    'whatsapp_notificacoes_autorizadas',
    'cobrancas',
    'cobrancas_recorrentes',
    'contas_financeiras',
    'contas_bancarias',
    'extratos_bancarios',
    'demonstrativos',
    'contratos_honorarios',
    'assinaturas_demonstrativos',
    'certificados_digitais',
    'certidoes',
    'ecac_comunicacoes',
    'ativos',
    'baixas_ativos',
    'fechamento_competencia',
    'fechamento_checklist_itens',
    'company_formation',
    'company_onboarding_workflow',
    'audit_log',
  ]

  function runTenantExport(tId) {
    var dados = {}
    var contagens = {}
    var colecoesExportadas = []
    var colecoesComErro = []
    var totalRegistros = 0
    var totalGed = 0

    for (var i = 0; i < CORE_COLLECTIONS.length; i++) {
      var colName = CORE_COLLECTIONS[i]
      try {
        try {
          app.findCollectionByNameOrId(colName)
        } catch (_) {
          continue
        }

        var filter = "tenant_id = '" + tId + "'"
        var records = app.findRecordsByFilter(colName, filter, '-created', 2000, 0)
        var rows = []
        for (var r = 0; r < records.length; r++) {
          var rec = records[r]
          var item = { id: rec.id }
          var fieldNames = rec.collection().fields.map((f) => f.name)
          for (var f = 0; f < fieldNames.length; f++) {
            var fName = fieldNames[f]
            if (fName === 'senha' || fName === 'senha_certificado') {
              item[fName] = '***PROTEGIDO***'
            } else {
              item[fName] = rec.get(fName)
            }
          }
          rows.push(item)
        }

        dados[colName] = rows
        contagens[colName] = rows.length
        colecoesExportadas.push(colName)
        totalRegistros += rows.length

        if (colName === 'documentos') {
          totalGed = rows.length
        }
      } catch (errCol) {
        console.warn('[BACKUP_CRON] Erro ao exportar colecao ' + colName + ':', errCol)
        colecoesComErro.push(
          colName + ': ' + (errCol && errCol.message ? errCol.message : String(errCol)),
        )
        contagens[colName] = 0
      }
    }

    return {
      dados: dados,
      contagens: contagens,
      colecoesExportadas: colecoesExportadas,
      colecoesComErro: colecoesComErro,
      totalRegistros: totalRegistros,
      totalGed: totalGed,
    }
  }

  function runRetencao(tId, limite) {
    var lim = limite || 7
    try {
      var backups = app.findRecordsByFilter(
        'backups_execucoes',
        "tenant_id = '" + tId + "'",
        '-data_execucao',
        100,
        0,
      )

      if (backups && backups.length > lim) {
        var backupsAntigos = backups.slice(lim)
        for (var b = 0; b < backupsAntigos.length; b++) {
          var bkp = backupsAntigos[b]
          var bkpId = bkp.id
          var bkpData = bkp.getString('data_execucao')
          app.delete(bkp)

          try {
            var aCol = app.findCollectionByNameOrId('audit_log')
            var aRec = new Record(aCol)
            aRec.set('tenant_id', tId)
            aRec.set('acao', 'BACKUP_RETENCAO_PURGA')
            aRec.set('entidade_tipo', 'backups_execucoes')
            aRec.set('entidade_id', bkpId)
            aRec.set(
              'detalhes',
              'Backup de ' +
                bkpData +
                ' purgado pela retenção automática (limite: ' +
                lim +
                ' snapshots).',
            )
            app.save(aRec)
          } catch (_) {}
        }
      }
    } catch (errRet) {
      console.warn('[BACKUP_CRON] Erro na retenção:', errRet)
    }
  }

  try {
    var tenants = app.findRecordsByFilter('tenants', 'ativo = true', 'created', 100, 0)
    for (var t = 0; t < tenants.length; t++) {
      var tenant = tenants[t]
      var tenantId = tenant.id
      var tenantNome = tenant.getString('nome')

      var agora = new Date()
      var exportResult = runTenantExport(tenantId)

      var status = 'sucesso'
      if (exportResult.colecoesComErro.length > 0) {
        status = exportResult.colecoesExportadas.length > 0 ? 'parcial' : 'falhou'
      }

      var jsonPayload = {
        meta: {
          versao_plataforma: '0.0.94',
          tenant_id: tenantId,
          tenant_nome: tenantNome,
          data_geracao: agora.toISOString(),
          tipo: 'agendado',
          status: status,
          aviso_lgpd:
            'ATENÇÃO (LGPD): Este backup contém dados contábeis, fiscais, salariais e cadastrais sensíveis. Armazene o arquivo em local criptografado com acesso restrito.',
          formato:
            'Exportação independente JSON de coleções relacionais e metadados do Acervo GED.',
        },
        contagens: exportResult.contagens,
        colecoes_com_erro: exportResult.colecoesComErro,
        dados: exportResult.dados,
      }

      var jsonString = JSON.stringify(jsonPayload)
      var tamanhoEstimado = jsonString.length

      var bkpCol = app.findCollectionByNameOrId('backups_execucoes')
      var bkpRec = new Record(bkpCol)
      bkpRec.set('tenant_id', tenantId)
      bkpRec.set('data_execucao', agora.toISOString())
      bkpRec.set('tipo', 'agendado')
      bkpRec.set('status', status)
      bkpRec.set('tamanho_estimado_bytes', tamanhoEstimado)
      bkpRec.set('contagem_registros', exportResult.contagens)
      bkpRec.set('colecoes_exportadas', exportResult.colecoesExportadas)
      bkpRec.set('colecoes_com_erro', exportResult.colecoesComErro)
      bkpRec.set('total_documentos_ged', exportResult.totalGed)
      bkpRec.set('retencao_dias', 7)
      bkpRec.set(
        'mensagem',
        'Snapshot diário agendado ' +
          (status === 'sucesso' ? 'concluído com sucesso' : 'com ressalvas') +
          '. ' +
          exportResult.totalRegistros +
          ' registros em ' +
          exportResult.colecoesExportadas.length +
          ' coleções.',
      )
      if (exportResult.colecoesComErro.length > 0) {
        bkpRec.set('erro_detalhe', exportResult.colecoesComErro.join('; '))
      }
      bkpRec.set('snapshot_json', jsonPayload)
      app.save(bkpRec)

      try {
        var aCol = app.findCollectionByNameOrId('audit_log')
        var aRec = new Record(aCol)
        aRec.set('tenant_id', tenantId)
        aRec.set('acao', 'BACKUP_SNAPSHOT_AGENDADO')
        aRec.set('entidade_tipo', 'backups_execucoes')
        aRec.set('entidade_id', bkpRec.id)
        aRec.set(
          'detalhes',
          'Snapshot agendado gerado com status ' +
            status +
            '. ' +
            exportResult.totalRegistros +
            ' registros, tamanho: ' +
            (tamanhoEstimado / 1024).toFixed(1) +
            ' KB.',
        )
        app.save(aRec)
      } catch (errA) {}

      runRetencao(tenantId, 7)
    }
  } catch (errGeral) {
    console.error('[BACKUP_CRON] Falha geral no backup independente:', errGeral)
  }
})

// 2. Rota POST /backend/v1/backups/executar-agora
routerAdd('POST', '/backend/v1/backups/executar-agora', (e) => {
  var auth = e.auth
  if (!auth) {
    return e.json(401, { erro: 'Requer autenticação.' })
  }

  var app = e.app
  var body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {}

  var tenantId = body.tenant_id
  if (!tenantId) {
    try {
      var member = app.findFirstRecordByFilter(
        'tenant_members',
        "user_id = '" + auth.id + "' && status = 'ativo'",
      )
      tenantId = member.getString('tenant_id')
    } catch (_) {}
  }

  if (!tenantId) {
    return e.json(400, { erro: 'tenant_id é obrigatório.' })
  }

  try {
    var memberAdmin = app.findFirstRecordByFilter(
      'tenant_members',
      "user_id = '" + auth.id + "' && tenant_id = '" + tenantId + "' && status = 'ativo'",
    )
    var perfil = memberAdmin.getString('perfil')
    if (perfil !== 'administrador') {
      return e.json(403, {
        erro: 'Acesso negado: apenas Administradores do escritório podem gerar snapshots manuais.',
      })
    }
  } catch (errMem) {
    return e.json(403, { erro: 'Usuário não tem acesso a este tenant: ' + String(errMem) })
  }

  var tenantNome = 'Escritório'
  try {
    var tenantRecord = app.findRecordById('tenants', tenantId)
    tenantNome = tenantRecord.getString('nome')
  } catch (_) {}

  var CORE_COLLECTIONS = [
    'empresas',
    'documentos',
    'lancamentos_contabeis',
    'plano_contas',
    'folha_pagamento',
    'funcionarios',
    'eventos_dp',
    'obrigacoes',
    'fiscal',
    'whatsapp_envios',
    'whatsapp_notificacoes_autorizadas',
    'cobrancas',
    'cobrancas_recorrentes',
    'contas_financeiras',
    'contas_bancarias',
    'extratos_bancarios',
    'demonstrativos',
    'contratos_honorarios',
    'assinaturas_demonstrativos',
    'certificados_digitais',
    'certidoes',
    'ecac_comunicacoes',
    'ativos',
    'baixas_ativos',
    'fechamento_competencia',
    'fechamento_checklist_itens',
    'company_formation',
    'company_onboarding_workflow',
    'audit_log',
  ]

  var dados = {}
  var contagens = {}
  var colecoesExportadas = []
  var colecoesComErro = []
  var totalRegistros = 0
  var totalGed = 0

  for (var i = 0; i < CORE_COLLECTIONS.length; i++) {
    var colName = CORE_COLLECTIONS[i]
    try {
      try {
        app.findCollectionByNameOrId(colName)
      } catch (_) {
        continue
      }

      var filter = "tenant_id = '" + tenantId + "'"
      var records = app.findRecordsByFilter(colName, filter, '-created', 2000, 0)
      var rows = []
      for (var r = 0; r < records.length; r++) {
        var rec = records[r]
        var item = { id: rec.id }
        var fieldNames = rec.collection().fields.map((f) => f.name)
        for (var f = 0; f < fieldNames.length; f++) {
          var fName = fieldNames[f]
          if (fName === 'senha' || fName === 'senha_certificado') {
            item[fName] = '***PROTEGIDO***'
          } else {
            item[fName] = rec.get(fName)
          }
        }
        rows.push(item)
      }

      dados[colName] = rows
      contagens[colName] = rows.length
      colecoesExportadas.push(colName)
      totalRegistros += rows.length

      if (colName === 'documentos') {
        totalGed = rows.length
      }
    } catch (errCol) {
      console.warn('[BACKUP_MANUAL] Erro ao exportar colecao ' + colName + ':', errCol)
      colecoesComErro.push(
        colName + ': ' + (errCol && errCol.message ? errCol.message : String(errCol)),
      )
      contagens[colName] = 0
    }
  }

  var agora = new Date()
  var status = 'sucesso'
  if (colecoesComErro.length > 0) {
    status = colecoesExportadas.length > 0 ? 'parcial' : 'falhou'
  }

  var jsonPayload = {
    meta: {
      versao_plataforma: '0.0.94',
      tenant_id: tenantId,
      tenant_nome: tenantNome,
      data_geracao: agora.toISOString(),
      tipo: 'manual',
      status: status,
      gerado_por: {
        id: auth.id,
        email: auth.email(),
      },
      aviso_lgpd:
        'ATENÇÃO (LGPD): Este arquivo contém dados contábeis, fiscais, salariais e cadastrais sensíveis. O armazenamento deve ser em dispositivo ou repositório criptografado com controle restrito de acesso.',
      formato: 'Exportação independente JSON de coleções relacionais e metadados do Acervo GED.',
    },
    contagens: contagens,
    colecoes_com_erro: colecoesComErro,
    dados: dados,
  }

  var jsonString = JSON.stringify(jsonPayload)
  var tamanhoEstimado = jsonString.length

  var bkpCol = app.findCollectionByNameOrId('backups_execucoes')
  var bkpRec = new Record(bkpCol)
  bkpRec.set('tenant_id', tenantId)
  bkpRec.set('data_execucao', agora.toISOString())
  bkpRec.set('tipo', 'manual')
  bkpRec.set('status', status)
  bkpRec.set('tamanho_estimado_bytes', tamanhoEstimado)
  bkpRec.set('contagem_registros', contagens)
  bkpRec.set('colecoes_exportadas', colecoesExportadas)
  bkpRec.set('colecoes_com_erro', colecoesComErro)
  bkpRec.set('total_documentos_ged', totalGed)
  bkpRec.set('executado_por', auth.id)
  bkpRec.set('retencao_dias', 7)
  bkpRec.set(
    'mensagem',
    'Snapshot manual gerado por ' +
      (auth.getString('name') || auth.email()) +
      '. ' +
      totalRegistros +
      ' registros em ' +
      colecoesExportadas.length +
      ' coleções.',
  )
  if (colecoesComErro.length > 0) {
    bkpRec.set('erro_detalhe', colecoesComErro.join('; '))
  }
  bkpRec.set('snapshot_json', jsonPayload)
  app.save(bkpRec)

  // Gravar no audit_log
  try {
    var aCol = app.findCollectionByNameOrId('audit_log')
    var aRec = new Record(aCol)
    aRec.set('tenant_id', tenantId)
    aRec.set('usuario_id', auth.id)
    aRec.set('acao', 'BACKUP_SNAPSHOT_MANUAL_SOLICITADO')
    aRec.set('entidade_tipo', 'backups_execucoes')
    aRec.set('entidade_id', bkpRec.id)
    aRec.set(
      'detalhes',
      'Administrador ' +
        auth.email() +
        ' gerou snapshot manual sob demanda. Status: ' +
        status +
        ', tamanho: ' +
        (tamanhoEstimado / 1024).toFixed(1) +
        ' KB.',
    )
    app.save(aRec)
  } catch (_) {}

  // Política de retenção: remover mais antigos que o limite 7
  try {
    var backups = app.findRecordsByFilter(
      'backups_execucoes',
      "tenant_id = '" + tenantId + "'",
      '-data_execucao',
      100,
      0,
    )
    if (backups && backups.length > 7) {
      var backupsAntigos = backups.slice(7)
      for (var b = 0; b < backupsAntigos.length; b++) {
        var oldBkp = backupsAntigos[b]
        var oldId = oldBkp.id
        var oldData = oldBkp.getString('data_execucao')
        app.delete(oldBkp)

        try {
          var aCol2 = app.findCollectionByNameOrId('audit_log')
          var aRec2 = new Record(aCol2)
          aRec2.set('tenant_id', tenantId)
          aRec2.set('acao', 'BACKUP_RETENCAO_PURGA')
          aRec2.set('entidade_tipo', 'backups_execucoes')
          aRec2.set('entidade_id', oldId)
          aRec2.set(
            'detalhes',
            'Backup de ' + oldData + ' purgado pela retenção automática (limite 7 snapshots).',
          )
          app.save(aRec2)
        } catch (_) {}
      }
    }
  } catch (_) {}

  return e.json(200, {
    sucesso: true,
    backup_id: bkpRec.id,
    status: status,
    total_registros: totalRegistros,
    total_ged: totalGed,
    tamanho_bytes: tamanhoEstimado,
    contagem: contagens,
    colecoes_com_erro: colecoesComErro,
    data_execucao: agora.toISOString(),
  })
})

// 3. Rota GET /backend/v1/backups/download/{id}
routerAdd('GET', '/backend/v1/backups/download/{id}', (e) => {
  var auth = e.auth
  if (!auth) {
    return e.json(401, { erro: 'Requer autenticação.' })
  }

  var app = e.app
  var backupId = e.request.pathValue('id')

  try {
    var bkpRec = app.findRecordById('backups_execucoes', backupId)
    var tenantId = bkpRec.getString('tenant_id')

    var memberAdmin = app.findFirstRecordByFilter(
      'tenant_members',
      "user_id = '" + auth.id + "' && tenant_id = '" + tenantId + "' && status = 'ativo'",
    )
    if (memberAdmin.getString('perfil') !== 'administrador') {
      return e.json(403, {
        erro: 'Apenas Administradores do escritório podem baixar snapshots de banco de dados.',
      })
    }

    var snapshotData = bkpRec.get('snapshot_json')
    if (!snapshotData) {
      return e.json(404, { erro: 'Conteúdo do snapshot não encontrado para este registro.' })
    }

    try {
      var aCol = app.findCollectionByNameOrId('audit_log')
      var aRec = new Record(aCol)
      aRec.set('tenant_id', tenantId)
      aRec.set('usuario_id', auth.id)
      aRec.set('acao', 'BACKUP_SNAPSHOT_DOWNLOAD')
      aRec.set('entidade_tipo', 'backups_execucoes')
      aRec.set('entidade_id', backupId)
      aRec.set(
        'detalhes',
        'Download do snapshot ' +
          backupId +
          ' realizado por ' +
          auth.email() +
          ' (Ressalva LGPD de dados sensíveis emitida).',
      )
      app.save(aRec)
    } catch (_) {}

    return e.json(200, snapshotData)
  } catch (err) {
    return e.json(404, { erro: 'Backup não localizado: ' + String(err) })
  }
})

// 4. Rota GET /backend/v1/backups/ged-manifest
routerAdd('GET', '/backend/v1/backups/ged-manifest', (e) => {
  var auth = e.auth
  if (!auth) {
    return e.json(401, { erro: 'Requer autenticação.' })
  }

  var app = e.app
  var tenantId = e.request.url.query().get('tenant_id')
  if (!tenantId) {
    try {
      var member = app.findFirstRecordByFilter(
        'tenant_members',
        "user_id = '" + auth.id + "' && status = 'ativo'",
      )
      tenantId = member.getString('tenant_id')
    } catch (_) {}
  }

  if (!tenantId) {
    return e.json(400, { erro: 'tenant_id é obrigatório.' })
  }

  try {
    var memberAdmin = app.findFirstRecordByFilter(
      'tenant_members',
      "user_id = '" + auth.id + "' && tenant_id = '" + tenantId + "' && status = 'ativo'",
    )
    if (memberAdmin.getString('perfil') !== 'administrador') {
      return e.json(403, {
        erro: 'Apenas Administradores podem exportar o acervo GED em lote.',
      })
    }
  } catch (errMem) {
    return e.json(403, { erro: 'Acesso negado ao tenant: ' + String(errMem) })
  }

  try {
    var empresasList = app.findRecordsByFilter(
      'empresas',
      "tenant_id = '" + tenantId + "'",
      'razao_social',
      500,
      0,
    )
    var empresasMap = {}
    for (var empIdx = 0; empIdx < empresasList.length; empIdx++) {
      var emp = empresasList[empIdx]
      empresasMap[emp.id] = {
        razao_social: emp.getString('razao_social'),
        nome_fantasia: emp.getString('nome_fantasia'),
        cnpj: emp.getString('cnpj'),
      }
    }

    var docsList = app.findRecordsByFilter(
      'documentos',
      "tenant_id = '" + tenantId + "' && arquivo != ''",
      '-created',
      1500,
      0,
    )

    var documentosManifest = []
    for (var d = 0; d < docsList.length; d++) {
      var doc = docsList[d]
      var empId = doc.getString('empresa_id')
      var empInfo = empresasMap[empId] || { razao_social: 'Geral', cnpj: '00000000000000' }
      var arquivoNome = doc.getString('arquivo')

      documentosManifest.push({
        id: doc.id,
        nome_arquivo: doc.getString('nome_arquivo'),
        arquivo_storage: arquivoNome,
        tipo: doc.getString('tipo'),
        status: doc.getString('status'),
        created: doc.getString('created'),
        empresa_id: empId,
        empresa_razao: empInfo.razao_social,
        empresa_cnpj: empInfo.cnpj,
      })
    }

    try {
      var aCol = app.findCollectionByNameOrId('audit_log')
      var aRec = new Record(aCol)
      aRec.set('tenant_id', tenantId)
      aRec.set('usuario_id', auth.id)
      aRec.set('acao', 'GED_EXPORT_LOTE_SOLICITADO')
      aRec.set('entidade_tipo', 'documentos')
      aRec.set('entidade_id', tenantId)
      aRec.set(
        'detalhes',
        'Administrador ' +
          auth.email() +
          ' solicitou manifesto de exportação em lote do GED (' +
          documentosManifest.length +
          ' documentos).',
      )
      app.save(aRec)
    } catch (_) {}

    return e.json(200, {
      sucesso: true,
      tenant_id: tenantId,
      total_documentos: documentosManifest.length,
      documentos: documentosManifest,
    })
  } catch (errGed) {
    return e.json(500, { erro: 'Falha ao gerar manifesto GED: ' + String(errGed) })
  }
})

/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook de Envio Ativo de WhatsApp com integração ao Agente Externo (ZAP da ELLIZA Desktop)
 * e Governança por Diretivas da ELLIZA.
 *
 * DECISÃO DO USUÁRIO (Rumo v0.0.137):
 * - Evolution API está DESCONTINUADA como canal de disparo.
 * - Todo disparo real ocorre via ZAP da ELLIZA Desktop (RPA Local instalado no PC do usuário).
 * - Envios autorizados são registrados em whatsapp_envios (para auditoria) e despachados
 *   como tarefas aprovadas na Fila da Elliza (elisa_jobs) para consumo via polling
 *   pelo Agente Externo (/backend/v1/elliza-agente/buscar-aprovadas).
 */

routerAdd('POST', '/backend/v1/whatsapp-ativo/disparar', (e) => {
  const req = e.requestInfo()
  const body = req.body || {}
  const app = e.app

  const tenantId = body.tenant_id
  const empresaId = body.empresa_id
  const tipo = body.tipo || 'aviso' // aviso | guia | previa | demonstrativo | documento | cobranca | teste
  const referencia = body.referencia || ''
  const destinatario = body.destinatario
  const mensagem = body.mensagem
  const origem = body.origem || 'manual' // manual | elliza | agendador

  if (!tenantId || !empresaId || !destinatario || !mensagem) {
    return e.json(400, {
      erro: 'Campos obrigatórios ausentes: tenant_id, empresa_id, destinatario, mensagem.',
    })
  }

  // 1. Identificar usuário ELLIZA para trilha de auditoria
  let ellizaUserId = null
  try {
    const ellizaRec = app.findFirstRecordByData('users', 'email', 'elliza@rumo.contabil')
    if (ellizaRec) ellizaUserId = ellizaRec.id
  } catch (_) {}

  // 2. Verificar Governança de Diretivas da ELLIZA
  if (origem === 'elliza' || origem === 'agendador') {
    const atividadeAlvo = tipo === 'cobranca' ? 'cobranca' : 'whatsapp_envio'
    let dir = null
    try {
      dir = app.findFirstRecordByFilter(
        'elliza_diretivas',
        `tenant_id = '${tenantId}' && atividade = '${atividadeAlvo}'`,
      )
    } catch (_) {}

    if (dir && dir.getBool('ativa')) {
      const nivel = dir.getString('nivel_autonomia')
      const jIni = dir.getString('janela_horario_inicio')
      const jFim = dir.getString('janela_horario_fim')

      if (nivel === 'bloqueado') {
        return e.json(403, {
          erro: `Envios de ${atividadeAlvo} estão bloqueados pela Governança da ELLIZA.`,
          status: 'bloqueado_por_diretiva',
        })
      }

      if (nivel === 'somente_leitura') {
        return e.json(403, {
          erro: `ELLIZA operando em modo Somente Leitura para ${atividadeAlvo}.`,
          status: 'somente_leitura',
        })
      }

      if (jIni && jFim) {
        const now = new Date()
        const brHours = (now.getUTCHours() - 3 + 24) % 24
        const horaAtual =
          String(brHours).padStart(2, '0') + ':' + String(now.getUTCMinutes()).padStart(2, '0')
        if (jIni <= jFim && (horaAtual < jIni || horaAtual > jFim)) {
          return e.json(403, {
            erro: `Horário atual fora da janela permitida (${jIni} às ${jFim}).`,
            status: 'bloqueado_por_diretiva',
          })
        }
      }

      if (nivel === 'executar_com_aprovacao') {
        const colAprov = app.findCollectionByNameOrId('elliza_aprovacoes')
        const recAprov = new Record(colAprov)
        recAprov.set('tenant_id', tenantId)
        recAprov.set('atividade', atividadeAlvo)
        recAprov.set('titulo', `Disparo WhatsApp (${tipo}): ${destinatario}`)
        recAprov.set('descricao', `Disparo aguardando liberação humana conforme diretiva.`)
        recAprov.set('entidade_tipo', 'whatsapp_envios')
        recAprov.set('entidade_id', referencia)
        recAprov.set('status', 'pendente')
        recAprov.set('payload_acao', {
          tenant_id: tenantId,
          empresa_id: empresaId,
          tipo,
          referencia,
          destinatario,
          mensagem,
          origem,
        })
        app.save(recAprov)

        return e.json(202, {
          sucesso: false,
          status: 'aguardando_aprovacao',
          aprovacao_id: recAprov.id,
          mensagem:
            'Ação enfileirada na fila de aprovação da ELLIZA (Diretiva: Executar com Aprovação).',
        })
      }
    }
  }

  // 3. Verificar autorização ativa por empresa em whatsapp_notificacoes_autorizadas
  try {
    const autoriz = app.findFirstRecordByFilter(
      'whatsapp_notificacoes_autorizadas',
      `tenant_id = '${tenantId}' && empresa = '${empresaId}'`,
    )
    if (autoriz && !autoriz.getBool('ativo')) {
      return e.json(403, {
        erro: 'Notificações por WhatsApp estão desativadas para esta empresa.',
      })
    }
    if (autoriz) {
      if (tipo === 'aviso' && !autoriz.getBool('permitir_avisos')) {
        return e.json(403, { erro: 'Avisos gerais não autorizados para esta empresa.' })
      }
      if (tipo === 'guia' && !autoriz.getBool('permitir_guias')) {
        return e.json(403, { erro: 'Envio de guias não autorizado para esta empresa.' })
      }
      if (tipo === 'previa' && !autoriz.getBool('permitir_previas')) {
        return e.json(403, { erro: 'Prévias de fechamento não autorizadas para esta empresa.' })
      }
      if (tipo === 'demonstrativo' && !autoriz.getBool('permitir_demonstrativos')) {
        return e.json(403, { erro: 'Demonstrativos não autorizados para esta empresa.' })
      }
      if (tipo === 'documento' && !autoriz.getBool('permitir_documentos')) {
        return e.json(403, {
          erro: 'Solicitações e envios de documentos não autorizados para esta empresa.',
        })
      }
      if (tipo === 'cobranca' && !autoriz.getBool('permitir_cobrancas')) {
        return e.json(403, { erro: 'Envio de cobranças não autorizado para esta empresa.' })
      }
    }
  } catch (_) {}

  // 4. Limpar número de telefone
  let cleanDest = String(destinatario).replace(/\D/g, '')
  if (cleanDest.length === 10 || cleanDest.length === 11) {
    cleanDest = '55' + cleanDest
  }

  // 5. Gravar registro em whatsapp_envios para trilha de auditoria
  const enviosCol = app.findCollectionByNameOrId('whatsapp_envios')
  const envioRecord = new Record(enviosCol)
  envioRecord.set('tenant_id', tenantId)
  envioRecord.set('empresa', empresaId)
  envioRecord.set('tipo', tipo)
  envioRecord.set('referencia', referencia)
  envioRecord.set('destinatario', cleanDest)
  envioRecord.set('mensagem', mensagem)
  envioRecord.set('origem', origem)
  envioRecord.set('status', 'fila')
  envioRecord.set('detalhes_json', {
    canal: 'zap_elliza_desktop',
    agente_externo: 'elliza-desktop-rpa',
    evolution_api_descontinuada: true,
    enfileirado_em: new Date().toISOString(),
  })
  app.save(envioRecord)

  // 6. Enfileirar tarefa na Fila da Elliza (elisa_jobs) atribuída ao Agente Externo ELLIZA Desktop
  let createdJobId = ''
  let jobCodigo = 'JOB-WA-' + Date.now().toString().slice(-6)
  try {
    const jobsCol = app.findCollectionByNameOrId('elisa_jobs')
    let procId = ''
    try {
      const p = app.findFirstRecordByFilter(
        'processos_operacionais',
        `tenant_id = '${tenantId}' && empresa_id = '${empresaId}'`,
      )
      if (p) procId = p.id
    } catch (_) {}

    if (!procId) {
      try {
        const pGen = app.findFirstRecordByFilter(
          'processos_operacionais',
          `tenant_id = '${tenantId}'`,
        )
        if (pGen) procId = pGen.id
      } catch (_) {}
    }

    if (procId) {
      const waJob = new Record(jobsCol)
      waJob.set('tenant_id', tenantId)
      waJob.set('processo_id', procId)
      waJob.set('empresa_id', empresaId)
      waJob.set('job_codigo', jobCodigo)
      waJob.set('competencia', new Date().toISOString().slice(0, 7))
      waJob.set('area', 'atendimento')
      waJob.set(
        'processo_nome',
        `Envio de Notificação WhatsApp (${tipo.toUpperCase()}) via ZAP ELLIZA Desktop`,
      )
      waJob.set('pop_relacionado', 'POP-AT-01')
      waJob.set('etapa_atual_nome', `Disparar mensagem no ZAP para ${cleanDest}`)
      waJob.set(
        'proxima_acao',
        'Executar envio pelo ZAP da ELLIZA Desktop, anexar comprovante e devolver hash SHA-256.',
      )
      waJob.set('prioridade', 'alta')
      waJob.set('prazo', new Date(Date.now() + 86400000).toISOString())
      waJob.set('status', 'APROVADO')
      waJob.set('agente_responsavel', 'ELLIZA Desktop (ZAP Local)')
      waJob.set('nivel_autonomia', 'nivel_2_supervisionado')
      waJob.set('necessita_aprovacao', false)
      waJob.set(
        'resultado',
        'Despachado para o canal ZAP da ELLIZA Desktop. Pronto para polling do agente externo.',
      )
      waJob.set('evidencia_resumo', 'Aguardando execução pelo RPA local ELLIZA Desktop.')
      waJob.set('executado_por_agente_externo', true)
      waJob.set('agente_externo_id', 'elliza-desktop-rpa')
      waJob.set('agente_externo_nome', 'ELLIZA Desktop (RPA PC Local)')
      waJob.set('data_atribuicao_agente', new Date().toISOString())
      waJob.set('payload_execucao_json', {
        tipo_operacao: 'WHATSAPP_ENVIO_ZAP',
        canal: 'zap_elliza_desktop',
        whatsapp_envio_id: envioRecord.id,
        destinatario: cleanDest,
        mensagem: mensagem,
        tipo_notificacao: tipo,
        referencia: referencia,
        criterio_sucesso: 'Mensagem transmitida pelo ZAP da ELLIZA com recibo de envio validado.',
        criterio_erro: 'Falha de conexão com ZAP local da ELLIZA ou número inválido.',
      })
      app.save(waJob)
      createdJobId = waJob.id
    }
  } catch (errJob) {
    console.warn('[WHATSAPP_DISPARO] Falha ao enfileirar job em elisa_jobs:', errJob)
  }

  // Auditoria do despacho para o Agente Externo
  try {
    const aCol = app.findCollectionByNameOrId('audit_log')
    const aRec = new Record(aCol)
    aRec.set('tenant_id', tenantId)
    if (ellizaUserId) aRec.set('usuario_id', ellizaUserId)
    aRec.set('acao', 'DESPACHO_WHATSAPP_AGENTE_EXTERNO_ZAP')
    aRec.set('entidade_tipo', 'whatsapp_envios')
    aRec.set('entidade_id', envioRecord.id)
    aRec.set(
      'detalhes',
      JSON.stringify({
        tipo,
        destinatario: cleanDest,
        canal: 'zap_elliza_desktop',
        job_codigo: jobCodigo,
        job_id: createdJobId,
        canal_evolution_descontinuado: true,
      }),
    )
    app.save(aRec)
  } catch (_) {}

  return e.json(200, {
    sucesso: true,
    status: 'fila',
    canal: 'zap_elliza_desktop',
    mensagem:
      'Envio despachado com sucesso para a Fila do Agente Externo (ZAP da ELLIZA Desktop). A execução será realizada no próximo ciclo de polling do PC local.',
    envio_id: envioRecord.id,
    job_id: createdJobId,
    job_codigo: jobCodigo,
  })
})

/**
 * Endpoint para despachar a fila retida para o Agente Externo ELLIZA Desktop (ZAP)
 * Rota: POST /backend/v1/whatsapp-ativo/despachar-fila
 */
routerAdd('POST', '/backend/v1/whatsapp-ativo/despachar-fila', (e) => {
  const auth = e.auth
  if (!auth) {
    return e.json(401, { erro: 'Requer autenticação' })
  }

  const app = e.app
  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {}

  const tenantId = body.tenant_id
  if (!tenantId) {
    return e.json(400, { erro: 'tenant_id é obrigatório' })
  }

  // 1. Despacho da fila para o Agente Externo ELLIZA Desktop (ZAP)
  let pendentes = []
  try {
    pendentes = app.findRecordsByFilter(
      'whatsapp_envios',
      `tenant_id = '${tenantId}' && (status = 'aguardando_credenciais' || status = 'fila')`,
      '-created',
      50,
      0,
    )
  } catch (err) {
    return e.json(500, { erro: 'Erro ao consultar fila: ' + String(err) })
  }

  if (pendentes.length === 0) {
    return e.json(200, {
      sucesso: true,
      mensagem: 'Nenhum item pendente na fila de envios de WhatsApp.',
      total_processados: 0,
      total_enviados: 0,
      total_falhas: 0,
    })
  }

  let totalProcessados = 0
  const jobsCol = app.findCollectionByNameOrId('elisa_jobs')
  for (let i = 0; i < pendentes.length; i++) {
    const item = pendentes[i]
    try {
      const dest = item.getString('destinatario')
      const msg = item.getString('mensagem')
      const empId = item.getString('empresa')
      const tipo = item.getString('tipo')
      const jobCodigo = 'JOB-WA-RET-' + Date.now().toString().slice(-6) + '-' + i

      let procId = ''
      try {
        const p = app.findFirstRecordByFilter(
          'processos_operacionais',
          `tenant_id = '${tenantId}' && empresa_id = '${empId}'`,
        )
        if (p) procId = p.id
      } catch (_) {}

      if (!procId) {
        try {
          const pGen = app.findFirstRecordByFilter(
            'processos_operacionais',
            `tenant_id = '${tenantId}'`,
          )
          if (pGen) procId = pGen.id
        } catch (_) {}
      }

      if (procId) {
        const waJob = new Record(jobsCol)
        waJob.set('tenant_id', tenantId)
        waJob.set('processo_id', procId)
        waJob.set('empresa_id', empId)
        waJob.set('job_codigo', jobCodigo)
        waJob.set('competencia', new Date().toISOString().slice(0, 7))
        waJob.set('area', 'atendimento')
        waJob.set(
          'processo_nome',
          `Disparo WhatsApp Retido (${tipo.toUpperCase()}) via ZAP ELLIZA Desktop`,
        )
        waJob.set('pop_relacionado', 'POP-AT-01')
        waJob.set('etapa_atual_nome', `Disparar mensagem retida no ZAP para ${dest}`)
        waJob.set(
          'proxima_acao',
          'Executar envio pelo ZAP da ELLIZA Desktop, anexar comprovante e devolver hash SHA-256.',
        )
        waJob.set('prioridade', 'alta')
        waJob.set('prazo', new Date(Date.now() + 86400000).toISOString())
        waJob.set('status', 'APROVADO')
        waJob.set('agente_responsavel', 'ELLIZA Desktop (ZAP Local)')
        waJob.set('nivel_autonomia', 'nivel_2_supervisionado')
        waJob.set('necessita_aprovacao', false)
        waJob.set(
          'resultado',
          'Despachado para o canal ZAP da ELLIZA Desktop. Pronto para polling do agente externo.',
        )
        waJob.set('evidencia_resumo', 'Aguardando execução pelo RPA local ELLIZA Desktop.')
        waJob.set('executado_por_agente_externo', true)
        waJob.set('agente_externo_id', 'elliza-desktop-rpa')
        waJob.set('agente_externo_nome', 'ELLIZA Desktop (RPA PC Local)')
        waJob.set('data_atribuicao_agente', new Date().toISOString())
        waJob.set('payload_execucao_json', {
          tipo_operacao: 'WHATSAPP_ENVIO_ZAP',
          canal: 'zap_elliza_desktop',
          whatsapp_envio_id: item.id,
          destinatario: dest,
          mensagem: msg,
          tipo_notificacao: tipo,
          referencia: item.getString('referencia'),
          criterio_sucesso: 'Mensagem transmitida pelo ZAP da ELLIZA com recibo de envio validado.',
          criterio_erro: 'Falha de conexão com ZAP local da ELLIZA ou número inválido.',
        })
        app.save(waJob)
      }

      item.set('status', 'fila')
      item.set('erro', '')
      item.set('detalhes_json', {
        canal: 'zap_elliza_desktop',
        agente_externo: 'elliza-desktop-rpa',
        evolution_api_descontinuada: true,
        despachado_para_agente_em: new Date().toISOString(),
      })
      app.save(item)
      totalProcessados++
    } catch (errItem) {
      console.warn('[WHATSAPP_DESPACHAR_FILA] Erro ao processar item:', errItem)
    }
  }

  // Auditoria
  try {
    const aCol = app.findCollectionByNameOrId('audit_log')
    const aRec = new Record(aCol)
    aRec.set('tenant_id', tenantId)
    aRec.set('usuario_id', auth.id)
    aRec.set('acao', 'DESPACHO_FILA_WHATSAPP_AGENTE_EXTERNO')
    aRec.set('entidade_tipo', 'whatsapp_envios')
    aRec.set(
      'detalhes',
      JSON.stringify({
        total_despachados: totalProcessados,
        canal: 'zap_elliza_desktop',
        agente_externo: 'elliza-desktop-rpa',
      }),
    )
    app.save(aRec)
  } catch (_) {}

  return e.json(200, {
    sucesso: true,
    mensagem: `Fila despachada com sucesso para o Agente Externo ELLIZA Desktop (ZAP): ${totalProcessados} item(ns) enfileirados como tarefas para polling local.`,
    total_processados: totalProcessados,
    total_enviados: totalProcessados,
    total_falhas: 0,
  })
})

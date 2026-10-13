/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    console.log('[MIGRATION-0119] Registrando ELLIZA Desktop como Agente Externo Oficial...')

    const tenants = app.findCollectionByNameOrId('tenants')
    const keysCol = app.findCollectionByNameOrId('elliza_agente_externo_chaves')

    // 1. Garantir que tipo_integracao suporte 'rpa_desktop' se necessário ou manter valores válidos
    const tipoField = keysCol.fields.getByName('tipo_integracao')
    if (tipoField) {
      const vals = tipoField.values || []
      if (!vals.includes('rpa_desktop')) {
        tipoField.values = [
          'playwright_computer_use',
          'rpa_script_python',
          'custom_agent',
          'webhook_runner',
          'rpa_desktop',
        ]
        app.save(keysCol)
      }
    }

    // 2. Buscar tenant principal (ex.: 'rumo' ou primeiro tenant)
    let tenantId = 'l91og8ybo9krtay'
    try {
      const t = app.findFirstRecordByFilter('tenants', "slug = 'rumo' || id != ''")
      if (t) tenantId = t.id
    } catch (_) {}

    // 3. Cadastrar ou atualizar registro oficial "ELLIZA Desktop"
    const desktopAgentId = 'elliza-desktop-rpa'
    let desktopKeyRec = null
    try {
      desktopKeyRec = app.findFirstRecordByFilter(
        'elliza_agente_externo_chaves',
        `tenant_id = '${tenantId}' && identificador_agente = '${desktopAgentId}'`,
      )
    } catch (_) {}

    // Gerar API key dedicada para a ELLIZA Desktop
    const rawDesktopKey = 'elliza_agt_live_desktop_c89a24fe10bb73e921'
    const desktopKeyHash = $security.sha256(rawDesktopKey)
    const prefixo = 'elliza_agt_live_desktop_c89a...'

    if (!desktopKeyRec) {
      desktopKeyRec = new Record(keysCol)
      desktopKeyRec.set('tenant_id', tenantId)
      desktopKeyRec.set('nome', 'ELLIZA Desktop (RPA PC Local)')
      desktopKeyRec.set('identificador_agente', desktopAgentId)
      desktopKeyRec.set('api_key_hash', desktopKeyHash)
      desktopKeyRec.set('api_key_prefixo', prefixo)
      desktopKeyRec.set('tipo_integracao', 'rpa_desktop')
      desktopKeyRec.set('status', 'ativo')
      desktopKeyRec.set('permite_execucao', true)
      desktopKeyRec.set('permite_evidencia', true)
      desktopKeyRec.set('limitar_areas_json', [
        'fiscal',
        'contabil',
        'pessoal',
        'societario',
        'atendimento',
        'geral',
      ])
      desktopKeyRec.set('total_tarefas_executadas', 0)
      desktopKeyRec.set('ultima_busca_em', new Date().toISOString())
      desktopKeyRec.set('ultimo_acesso_em', new Date().toISOString())
      app.save(desktopKeyRec)
      console.log('[MIGRATION-0119] Registro ELLIZA Desktop criado com sucesso.')
    } else {
      desktopKeyRec.set('nome', 'ELLIZA Desktop (RPA PC Local)')
      desktopKeyRec.set('tipo_integracao', 'rpa_desktop')
      desktopKeyRec.set('status', 'ativo')
      desktopKeyRec.set('permite_execucao', true)
      desktopKeyRec.set('permite_evidencia', true)
      desktopKeyRec.set('limitar_areas_json', [
        'fiscal',
        'contabil',
        'pessoal',
        'societario',
        'atendimento',
        'geral',
      ])
      app.save(desktopKeyRec)
      console.log('[MIGRATION-0119] Registro ELLIZA Desktop atualizado com sucesso.')
    }

    // 4. Também garantir que elisa_jobs e whatsapp_envios estejam aptos para tarefas de WhatsApp atribuídas ao agente
    // Criar um Job demo de WhatsApp atribuído à ELLIZA Desktop caso não exista
    const jobsCol = app.findCollectionByNameOrId('elisa_jobs')
    let waJobDemo = null
    try {
      waJobDemo = app.findFirstRecordByFilter(
        'elisa_jobs',
        `tenant_id = '${tenantId}' && job_codigo = 'JOB-092026-WA-ZAP01'`,
      )
    } catch (_) {}

    if (!waJobDemo) {
      let empresaDemo = null
      try {
        empresaDemo = app.findFirstRecordByFilter('empresas', `tenant_id = '${tenantId}'`)
      } catch (_) {}

      let procDemo = null
      try {
        procDemo = app.findFirstRecordByFilter(
          'processos_operacionais',
          `tenant_id = '${tenantId}' && (codigo_sop = 'POP-AT-01' || id != '')`,
        )
      } catch (_) {}

      if (empresaDemo && procDemo) {
        const newWaJob = new Record(jobsCol)
        newWaJob.set('tenant_id', tenantId)
        newWaJob.set('processo_id', procDemo.id)
        newWaJob.set('empresa_id', empresaDemo.id)
        newWaJob.set('job_codigo', 'JOB-092026-WA-ZAP01')
        newWaJob.set('competencia', '09/2026')
        newWaJob.set('area', 'atendimento')
        newWaJob.set(
          'processo_nome',
          'Envio Ativo de Notificação WhatsApp via ZAP da ELLIZA Desktop',
        )
        newWaJob.set('pop_relacionado', 'POP-AT-01')
        newWaJob.set(
          'etapa_atual_nome',
          'Disparar mensagem pelo ZAP local da ELLIZA e capturar confirmação',
        )
        newWaJob.set(
          'proxima_acao',
          'Executar envio pelo ZAP da ELLIZA Desktop, anexar comprovante de entrega e devolver hash SHA-256.',
        )
        newWaJob.set('prioridade', 'alta')
        newWaJob.set('prazo', '2026-10-20T23:59:59Z')
        newWaJob.set('status', 'APROVADO')
        newWaJob.set('agente_responsavel', 'ELLIZA Desktop (ZAP Local)')
        newWaJob.set('nivel_autonomia', 'nivel_2_supervisionado')
        newWaJob.set('necessita_aprovacao', false)
        newWaJob.set(
          'resultado',
          'Despachado para o canal ZAP da ELLIZA Desktop. Pronto para polling do agente externo.',
        )
        newWaJob.set('evidencia_resumo', 'Aguardando execução pelo RPA local ELLIZA Desktop.')
        newWaJob.set('executado_por_agente_externo', true)
        newWaJob.set('agente_externo_id', desktopAgentId)
        newWaJob.set('agente_externo_nome', 'ELLIZA Desktop (RPA PC Local)')
        newWaJob.set('data_atribuicao_agente', new Date().toISOString())
        newWaJob.set('payload_execucao_json', {
          tipo_operacao: 'WHATSAPP_ENVIO_ZAP',
          canal: 'zap_elliza_desktop',
          destinatario: empresaDemo.getString('telefone') || '5541999999999',
          mensagem:
            'Aviso de fechamento contábil Rumo: sua guia DAS está disponível para conferência.',
          criterio_sucesso: 'Mensagem transmitida pelo ZAP da ELLIZA com recibo de envio validado.',
          criterio_erro: 'Falha de conexão com ZAP local da ELLIZA ou número inválido.',
          timeout_segundos: 60,
        })
        app.save(newWaJob)
        console.log(
          '[MIGRATION-0119] Job demo de WhatsApp criado para ELLIZA Desktop: JOB-092026-WA-ZAP01',
        )
      }
    }
  },
  (app) => {
    try {
      const keysCol = app.findCollectionByNameOrId('elliza_agente_externo_chaves')
      const rec = app.findFirstRecordByFilter(
        'elliza_agente_externo_chaves',
        "identificador_agente = 'elliza-desktop-rpa'",
      )
      if (rec) app.delete(rec)
    } catch (_) {}
  },
)

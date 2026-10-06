/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    console.log(
      '[MIGRATION-0113] Iniciando criação da coleção elliza_agente_externo_chaves e campos de agente externo...',
    )

    const tenants = app.findCollectionByNameOrId('tenants')
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const tenantsId = tenants.id
    const usersId = users.id

    // 1. Atualizar campos do elisa_jobs para incluir status APROVADO se necessário e campos de agente externo
    const jobsCol = app.findCollectionByNameOrId('elisa_jobs')

    // Atualizar select de status no elisa_jobs para incluir APROVADO
    const statusField = jobsCol.fields.getByName('status')
    if (statusField) {
      statusField.values = [
        'ENFILEIRADO',
        'EM_EXECUCAO',
        'AGUARDANDO_APROVACAO',
        'APROVADO',
        'AGUARDANDO_CLIENTE',
        'AGUARDANDO_CONFERENCIA',
        'CONCLUIDO',
        'ERRO',
        'BLOQUEADO',
        'CANCELADO',
      ]
    }

    // Adicionar campos no elisa_jobs para atribuição a agente externo
    if (!jobsCol.fields.getByName('executado_por_agente_externo')) {
      jobsCol.fields.add(
        new BoolField({
          name: 'executado_por_agente_externo',
        }),
      )
    }

    if (!jobsCol.fields.getByName('agente_externo_id')) {
      jobsCol.fields.add(
        new TextField({
          name: 'agente_externo_id',
        }),
      )
    }

    if (!jobsCol.fields.getByName('agente_externo_nome')) {
      jobsCol.fields.add(
        new TextField({
          name: 'agente_externo_nome',
        }),
      )
    }

    if (!jobsCol.fields.getByName('data_atribuicao_agente')) {
      jobsCol.fields.add(
        new DateField({
          name: 'data_atribuicao_agente',
        }),
      )
    }

    app.save(jobsCol)
    console.log(
      '[MIGRATION-0113] elisa_jobs atualizado com status APROVADO e campos de agente externo.',
    )

    // 2. Criar coleção `elliza_agente_externo_chaves`
    try {
      app.findCollectionByNameOrId('elliza_agente_externo_chaves')
      console.log('[MIGRATION-0113] Coleção elliza_agente_externo_chaves já existe.')
    } catch (_) {
      const keysCol = new Collection({
        name: 'elliza_agente_externo_chaves',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'tenant_id',
            type: 'relation',
            required: true,
            collectionId: tenantsId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'nome', type: 'text', required: true },
          { name: 'identificador_agente', type: 'text', required: true },
          { name: 'api_key_hash', type: 'text', required: true },
          { name: 'api_key_prefixo', type: 'text', required: true },
          {
            name: 'tipo_integracao',
            type: 'select',
            required: true,
            values: [
              'playwright_computer_use',
              'rpa_script_python',
              'custom_agent',
              'webhook_runner',
            ],
            maxSelect: 1,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['ativo', 'revogado', 'pausado'],
            maxSelect: 1,
          },
          { name: 'permite_execucao', type: 'bool' },
          { name: 'permite_evidencia', type: 'bool' },
          { name: 'limitar_areas_json', type: 'json' },
          { name: 'ultimo_acesso_em', type: 'date' },
          { name: 'ultima_busca_em', type: 'date' },
          { name: 'ultima_execucao_em', type: 'date' },
          { name: 'total_tarefas_executadas', type: 'number' },
          { name: 'ip_origem_recente', type: 'text' },
          { name: 'criado_por', type: 'relation', collectionId: usersId, maxSelect: 1 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_agente_key_hash ON elliza_agente_externo_chaves (api_key_hash)',
          'CREATE INDEX idx_agente_tenant_status ON elliza_agente_externo_chaves (tenant_id, status)',
          'CREATE UNIQUE INDEX idx_agente_identificador ON elliza_agente_externo_chaves (tenant_id, identificador_agente)',
        ],
      })
      app.save(keysCol)
      console.log('[MIGRATION-0113] Coleção elliza_agente_externo_chaves criada com sucesso.')
    }

    // 3. Seed demo de uma chave de serviço de demonstração
    let tenantId = 'l91og8ybo9krtay'
    try {
      const t = app.findFirstRecordByFilter('tenants', "slug = 'rumo' || id != ''")
      if (t) tenantId = t.id
    } catch (_) {}

    const keysCollection = app.findCollectionByNameOrId('elliza_agente_externo_chaves')
    const demoAgentId = 'rpa-playwright-computeruse-01'
    let demoKeyRec = null
    try {
      demoKeyRec = app.findFirstRecordByFilter(
        'elliza_agente_externo_chaves',
        `tenant_id = '${tenantId}' && identificador_agente = '${demoAgentId}'`,
      )
    } catch (_) {}

    const demoRawKey = 'elliza_agt_live_99482fbc71a340e58832a884ef'
    const demoKeyHash = $security.sha256(demoRawKey)

    if (!demoKeyRec) {
      demoKeyRec = new Record(keysCollection)
      demoKeyRec.set('tenant_id', tenantId)
      demoKeyRec.set('nome', 'Agente Playwright + Computer Use (Portais Fiscais)')
      demoKeyRec.set('identificador_agente', demoAgentId)
      demoKeyRec.set('api_key_hash', demoKeyHash)
      demoKeyRec.set('api_key_prefixo', 'elliza_agt_live_9948...')
      demoKeyRec.set('tipo_integracao', 'playwright_computer_use')
      demoKeyRec.set('status', 'ativo')
      demoKeyRec.set('permite_execucao', true)
      demoKeyRec.set('permite_evidencia', true)
      demoKeyRec.set('limitar_areas_json', ['fiscal', 'contabil', 'geral', 'societario'])
      demoKeyRec.set('total_tarefas_executadas', 1)
      demoKeyRec.set('ultima_busca_em', new Date().toISOString())
      demoKeyRec.set('ultima_execucao_em', new Date().toISOString())
      demoKeyRec.set('ultimo_acesso_em', new Date().toISOString())
      app.save(demoKeyRec)
      console.log('[MIGRATION-0113] Chave de agente externo demo cadastrada.')
    }

    // 4. Seed demo: Uma tarefa APROVADA na fila atribuída a agente externo para demonstração do ciclo completo
    // Buscar se já existe tarefa APROVADA demo
    let jobDemoAprovado = null
    try {
      jobDemoAprovado = app.findFirstRecordByFilter(
        'elisa_jobs',
        `tenant_id = '${tenantId}' && job_codigo = 'JOB-092026-RPA-EXT01'`,
      )
    } catch (_) {}

    if (!jobDemoAprovado) {
      // Buscar empresa de demonstração
      let empresaDemo = null
      try {
        empresaDemo = app.findFirstRecordByFilter('empresas', `tenant_id = '${tenantId}'`)
      } catch (_) {}

      // Buscar processo POP-03 ou primeiro processo
      let procDemo = null
      try {
        procDemo = app.findFirstRecordByFilter(
          'processos_operacionais',
          `tenant_id = '${tenantId}' && (codigo_sop = 'POP-03' || id != '')`,
        )
      } catch (_) {}

      if (empresaDemo && procDemo) {
        // Criar Job com status APROVADO atribuído a agente externo
        const newJob = new Record(jobsCol)
        newJob.set('tenant_id', tenantId)
        newJob.set('processo_id', procDemo.id)
        newJob.set('empresa_id', empresaDemo.id)
        newJob.set('job_codigo', 'JOB-092026-RPA-EXT01')
        newJob.set('competencia', '09/2026')
        newJob.set('area', 'fiscal')
        newJob.set(
          'processo_nome',
          'Emissão e Captura de Comprovante DAS Simples Nacional — RPA e-CAC',
        )
        newJob.set('pop_relacionado', 'POP-03')
        newJob.set(
          'etapa_atual_nome',
          '4. Acessar portal PGDAS-D / e-CAC via Playwright e gerar comprovante',
        )
        newJob.set(
          'proxima_acao',
          'Executar navegação no portal PGDAS-D, emitir DAS com código de barras e devolver screenshot com protocolo.',
        )
        newJob.set('prioridade', 'alta')
        newJob.set('prazo', '2026-10-15T23:59:59Z')
        newJob.set('status', 'APROVADO')
        newJob.set('agente_responsavel', 'Playwright + Computer Use (RPA Externo)')
        newJob.set('nivel_autonomia', 'nivel_3_aprovacao_obrigatoria')
        newJob.set('necessita_aprovacao', true)
        newJob.set(
          'resultado',
          'Aprovado pelo Contador Responsável no Modo Humano. Pronto para coleta pelo Agente Externo.',
        )
        newJob.set('evidencia_resumo', 'Aguardando execução pelo agente RPA externo credenciado.')
        newJob.set('executado_por_agente_externo', true)
        newJob.set('agente_externo_id', demoAgentId)
        newJob.set('agente_externo_nome', 'Agente Playwright + Computer Use (Portais Fiscais)')
        newJob.set('data_atribuicao_agente', new Date().toISOString())
        newJob.set('payload_execucao_json', {
          url_alvo: 'https://cav.receita.fazenda.gov.br/autenticacao/login',
          tipo_operacao: 'GERAR_DAS_PGDASD',
          competencia: '09/2026',
          cnpj_alvo: empresaDemo.getString('cnpj') || '12345678000190',
          criterio_sucesso: 'Comprovante DAS gerado com linha digitável válida e protocolo SEFAZ.',
          criterio_erro:
            'Tela de erro no e-CAC, sessão expirada ou CNPJ sem declaração no período.',
          timeout_segundos: 120,
        })
        app.save(newJob)
        console.log('[MIGRATION-0113] Job demo APROVADO criado na fila: JOB-092026-RPA-EXT01')
      }
    }
  },
  (app) => {
    try {
      const keysCol = app.findCollectionByNameOrId('elliza_agente_externo_chaves')
      app.delete(keysCol)
    } catch (_) {}
  },
)

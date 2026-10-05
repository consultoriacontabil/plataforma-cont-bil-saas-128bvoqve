/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const empresas = app.findCollectionByNameOrId('empresas')
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    const tenantsId = tenants.id
    const empresasId = empresas.id
    const usersId = users.id

    // 1. Coleção `sops`: Biblioteca de Procedimentos Operacionais Estruturados (SOPs Executáveis derivados dos POPs)
    const sops = new Collection({
      name: 'sops',
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
        { name: 'codigo', type: 'text', required: true }, // ex: POP-01, POP-04, POP-08, POP-13, POP-18
        { name: 'nome', type: 'text', required: true },
        {
          name: 'area',
          type: 'select',
          required: true,
          values: ['fiscal', 'contabil', 'pessoal', 'societario', 'atendimento', 'geral'],
          maxSelect: 1,
        },
        { name: 'versao', type: 'text', required: true },
        { name: 'objetivo', type: 'text', required: false },
        { name: 'gatilho', type: 'text', required: false },
        { name: 'pre_condicoes', type: 'text', required: false },
        { name: 'entradas', type: 'text', required: false },
        { name: 'sistemas_utilizados', type: 'text', required: false },
        { name: 'responsavel_cargo', type: 'text', required: false },
        { name: 'agente_nome', type: 'text', required: false }, // ELISA
        {
          name: 'nivel_autonomia',
          type: 'select',
          required: true,
          values: ['nivel_1_automatico', 'nivel_2_supervisionado', 'nivel_3_aprovacao_obrigatoria'],
          maxSelect: 1,
        },
        { name: 'etapas_template_json', type: 'json', required: false },
        { name: 'regras_negocio', type: 'text', required: false },
        { name: 'criterios_sucesso', type: 'text', required: false },
        { name: 'criterios_erro', type: 'text', required: false },
        { name: 'excecoes', type: 'text', required: false },
        { name: 'requer_aprovacao', type: 'bool' },
        { name: 'saida', type: 'text', required: false },
        { name: 'proximo_processo', type: 'text', required: false },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_sops_tenant_cod ON sops (tenant_id, codigo)',
        'CREATE INDEX idx_sops_area ON sops (tenant_id, area)',
      ],
    })
    app.save(sops)
    const sopsId = sops.id

    // 2. Coleção `processos_operacionais`: Instâncias de Processos em Execução (para Cliente + Competência + SOP)
    const processos = new Collection({
      name: 'processos_operacionais',
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
        {
          name: 'empresa_id',
          type: 'relation',
          required: true,
          collectionId: empresasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'sop_id',
          type: 'relation',
          required: false,
          collectionId: sopsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'codigo_sop', type: 'text', required: false },
        { name: 'titulo', type: 'text', required: true },
        {
          name: 'area',
          type: 'select',
          required: true,
          values: ['fiscal', 'contabil', 'pessoal', 'societario', 'atendimento', 'geral'],
          maxSelect: 1,
        },
        { name: 'competencia', type: 'text', required: true }, // ex: "09/2026", "10/2026"
        {
          name: 'status',
          type: 'select',
          required: true,
          values: [
            'CRIADO',
            'AGUARDANDO',
            'ENFILEIRADO',
            'EM_EXECUCAO',
            'AGUARDANDO_DOCUMENTO',
            'AGUARDANDO_CLIENTE',
            'AGUARDANDO_CONFERENCIA',
            'AGUARDANDO_APROVACAO',
            'APROVADO',
            'CONCLUIDO',
            'ERRO',
            'BLOQUEADO',
            'CANCELADO',
          ],
          maxSelect: 1,
        },
        {
          name: 'prioridade',
          type: 'select',
          required: true,
          values: ['urgente', 'alta', 'media', 'baixa'],
          maxSelect: 1,
        },
        {
          name: 'nivel_autonomia',
          type: 'select',
          required: true,
          values: ['nivel_1_automatico', 'nivel_2_supervisionado', 'nivel_3_aprovacao_obrigatoria'],
          maxSelect: 1,
        },
        { name: 'etapa_atual_numero', type: 'number', required: false },
        { name: 'etapa_atual_nome', type: 'text', required: false },
        { name: 'total_etapas', type: 'number', required: false },
        { name: 'progresso_percentual', type: 'number', required: false },
        { name: 'agente_responsavel', type: 'text', required: false }, // "ELISA" | "Humano" | "Misto"
        {
          name: 'responsavel_humano_id',
          type: 'relation',
          required: false,
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'prazo', type: 'date', required: false },
        { name: 'data_inicio', type: 'date', required: false },
        { name: 'data_conclusao', type: 'date', required: false },
        { name: 'ultima_acao_executada', type: 'text', required: false },
        { name: 'resultado_ultima_acao', type: 'text', required: false },
        { name: 'proxima_acao', type: 'text', required: false },
        { name: 'criterio_sucesso_atual', type: 'text', required: false },
        { name: 'motivo_parada_ou_erro', type: 'text', required: false },
        { name: 'decisao_necessaria_humana', type: 'text', required: false },
        { name: 'metadados_json', type: 'json', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_proc_tenant_status ON processos_operacionais (tenant_id, status)',
        'CREATE INDEX idx_proc_empresa ON processos_operacionais (tenant_id, empresa_id, competencia)',
        'CREATE INDEX idx_proc_prazo ON processos_operacionais (tenant_id, prazo ASC)',
      ],
    })
    app.save(processos)
    const processosId = processos.id

    // 3. Coleção `processo_etapas`: Itens do Checklist Executável de cada Processo
    const etapas = new Collection({
      name: 'processo_etapas',
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
        {
          name: 'processo_id',
          type: 'relation',
          required: true,
          collectionId: processosId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'ordem', type: 'number', required: true },
        { name: 'titulo', type: 'text', required: true },
        { name: 'descricao', type: 'text', required: false },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: [
            'CRIADO',
            'AGUARDANDO',
            'ENFILEIRADO',
            'EM_EXECUCAO',
            'AGUARDANDO_DOCUMENTO',
            'AGUARDANDO_CLIENTE',
            'AGUARDANDO_CONFERENCIA',
            'AGUARDANDO_APROVACAO',
            'APROVADO',
            'CONCLUIDO',
            'ERRO',
            'BLOQUEADO',
            'CANCELADO',
          ],
          maxSelect: 1,
        },
        { name: 'responsavel_tipo', type: 'text', required: false }, // "ELISA" ou "Humano"
        {
          name: 'responsavel_usuario_id',
          type: 'relation',
          required: false,
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'entrada', type: 'text', required: false },
        { name: 'acao', type: 'text', required: false },
        { name: 'criterio_sucesso', type: 'text', required: false },
        { name: 'criterio_erro', type: 'text', required: false },
        { name: 'proxima_etapa_nome', type: 'text', required: false },
        { name: 'requer_aprovacao', type: 'bool' },
        { name: 'aprovado_por', type: 'text', required: false },
        { name: 'data_inicio', type: 'date', required: false },
        { name: 'data_conclusao', type: 'date', required: false },
        { name: 'resultado', type: 'text', required: false },
        { name: 'evidencia_id', type: 'text', required: false },
        { name: 'observacao', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_etapas_proc ON processo_etapas (processo_id, ordem ASC)',
        'CREATE INDEX idx_etapas_tenant_status ON processo_etapas (tenant_id, status)',
      ],
    })
    app.save(etapas)
    const etapasId = etapas.id

    // 4. Coleção `elisa_jobs`: Fila Operacional da ELISA (Jobs atômicos executados ou enfileirados)
    const jobs = new Collection({
      name: 'elisa_jobs',
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
        {
          name: 'processo_id',
          type: 'relation',
          required: true,
          collectionId: processosId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'etapa_id',
          type: 'relation',
          required: false,
          collectionId: etapasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'empresa_id',
          type: 'relation',
          required: true,
          collectionId: empresasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'job_codigo', type: 'text', required: true }, // ex: "JOB-2026-09-001"
        { name: 'competencia', type: 'text', required: true },
        {
          name: 'area',
          type: 'select',
          required: true,
          values: ['fiscal', 'contabil', 'pessoal', 'societario', 'atendimento', 'geral'],
          maxSelect: 1,
        },
        { name: 'processo_nome', type: 'text', required: true },
        { name: 'pop_relacionado', type: 'text', required: false },
        { name: 'etapa_atual_nome', type: 'text', required: true },
        { name: 'proxima_acao', type: 'text', required: true },
        {
          name: 'prioridade',
          type: 'select',
          required: true,
          values: ['urgente', 'alta', 'media', 'baixa'],
          maxSelect: 1,
        },
        { name: 'prazo', type: 'date', required: false },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: [
            'ENFILEIRADO',
            'EM_EXECUCAO',
            'AGUARDANDO_APROVACAO',
            'AGUARDANDO_CLIENTE',
            'AGUARDANDO_CONFERENCIA',
            'CONCLUIDO',
            'ERRO',
            'BLOQUEADO',
            'CANCELADO',
          ],
          maxSelect: 1,
        },
        { name: 'agente_responsavel', type: 'text', required: true }, // "ELISA"
        {
          name: 'nivel_autonomia',
          type: 'select',
          required: true,
          values: ['nivel_1_automatico', 'nivel_2_supervisionado', 'nivel_3_aprovacao_obrigatoria'],
          maxSelect: 1,
        },
        { name: 'necessita_aprovacao', type: 'bool' },
        { name: 'evidencia_resumo', type: 'text', required: false },
        { name: 'resultado', type: 'text', required: false },
        { name: 'erro_mensagem', type: 'text', required: false },
        { name: 'tempo_execucao_segundos', type: 'number', required: false },
        { name: 'data_inicio_execucao', type: 'date', required: false },
        { name: 'data_fim_execucao', type: 'date', required: false },
        { name: 'dependencias_json', type: 'json', required: false },
        { name: 'payload_execucao_json', type: 'json', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_jobs_tenant_status ON elisa_jobs (tenant_id, status, prioridade)',
        'CREATE INDEX idx_jobs_empresa ON elisa_jobs (tenant_id, empresa_id, competencia)',
        'CREATE INDEX idx_jobs_prazo ON elisa_jobs (tenant_id, prazo ASC)',
      ],
    })
    app.save(jobs)
    const jobsId = jobs.id

    // 5. Coleção `elisa_evidencias`: Registro de Evidências Auditáveis de cada Etapa/Job
    const evidencias = new Collection({
      name: 'elisa_evidencias',
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
        {
          name: 'processo_id',
          type: 'relation',
          required: true,
          collectionId: processosId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'job_id',
          type: 'relation',
          required: false,
          collectionId: jobsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'etapa_id',
          type: 'relation',
          required: false,
          collectionId: etapasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'empresa_id',
          type: 'relation',
          required: true,
          collectionId: empresasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: [
            'screenshot',
            'documento_ged',
            'protocolo',
            'recibo',
            'log_operacao',
            'hash_assinatura',
          ],
          maxSelect: 1,
        },
        { name: 'titulo', type: 'text', required: true },
        { name: 'descricao', type: 'text', required: false },
        { name: 'protocolo_numero', type: 'text', required: false },
        { name: 'numero_operacao', type: 'text', required: false },
        { name: 'hash_sha256', type: 'text', required: false },
        { name: 'executado_por', type: 'text', required: true }, // "ELISA" ou nome do usuário
        { name: 'arquivo_evidencia', type: 'file', required: false },
        { name: 'dados_tecnicos_json', type: 'json', required: false },
        { name: 'resultado_obtido', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_evid_processo ON elisa_evidencias (processo_id, created DESC)',
        'CREATE INDEX idx_evid_tenant_emp ON elisa_evidencias (tenant_id, empresa_id)',
      ],
    })
    app.save(evidencias)

    // 6. Coleção `processo_pendencias`: Tratamento de Exceções estruturado (Modo Humano)
    const pendencias = new Collection({
      name: 'processo_pendencias',
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
        {
          name: 'processo_id',
          type: 'relation',
          required: true,
          collectionId: processosId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'etapa_id',
          type: 'relation',
          required: false,
          collectionId: etapasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'job_id',
          type: 'relation',
          required: false,
          collectionId: jobsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'empresa_id',
          type: 'relation',
          required: true,
          collectionId: empresasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'titulo', type: 'text', required: true },
        { name: 'por_que_parou', type: 'text', required: true },
        { name: 'o_que_foi_executado', type: 'text', required: true },
        { name: 'o_que_falta', type: 'text', required: true },
        { name: 'decisao_necessaria', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: [
            'aberta',
            'em_analise',
            'resolvida',
            'devolvida_elisa',
            'rejeitada',
            'cancelada',
          ],
          maxSelect: 1,
        },
        {
          name: 'responsavel_humano_id',
          type: 'relation',
          required: false,
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'resolucao_descricao', type: 'text', required: false },
        { name: 'resolvido_em', type: 'date', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_pend_proc ON processo_pendencias (processo_id, status)',
        'CREATE INDEX idx_pend_tenant_status ON processo_pendencias (tenant_id, status)',
      ],
    })
    app.save(pendencias)
  },
  (app) => {
    try {
      const p = app.findCollectionByNameOrId('processo_pendencias')
      app.delete(p)
    } catch (_) {}
    try {
      const ev = app.findCollectionByNameOrId('elisa_evidencias')
      app.delete(ev)
    } catch (_) {}
    try {
      const j = app.findCollectionByNameOrId('elisa_jobs')
      app.delete(j)
    } catch (_) {}
    try {
      const pe = app.findCollectionByNameOrId('processo_etapas')
      app.delete(pe)
    } catch (_) {}
    try {
      const pr = app.findCollectionByNameOrId('processos_operacionais')
      app.delete(pr)
    } catch (_) {}
    try {
      const s = app.findCollectionByNameOrId('sops')
      app.delete(s)
    } catch (_) {}
  },
)

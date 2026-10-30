/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    console.log(
      '[MIGRATION-0122] Adicionando hash_sha256 e competencia em documentos, criando SOP POP-EX-03 e Job Sincronização Pasta → GED...',
    )

    // 1. Expandir coleção documentos com campos hash_sha256 e competencia (se ainda não existirem)
    const docCol = app.findCollectionByNameOrId('documentos')
    if (!docCol.fields.getByName('hash_sha256')) {
      docCol.fields.add(
        new TextField({
          name: 'hash_sha256',
          required: false,
        }),
      )
    }
    if (!docCol.fields.getByName('competencia')) {
      docCol.fields.add(
        new TextField({
          name: 'competencia',
          required: false,
        }),
      )
    }
    // Adicionar índice para busca rápida por hash e empresa
    try {
      docCol.addIndex('idx_documentos_hash_empresa', false, 'empresa_id, hash_sha256', '')
    } catch (_) {}
    app.save(docCol)
    console.log(
      '[MIGRATION-0122] Campos hash_sha256 e competencia adicionados à collection documentos.',
    )

    // 2. Identificar Tenant Principal (Rumo)
    let tenantId = 'l91og8ybo9krtay'
    try {
      const t = app.findFirstRecordByFilter('tenants', "slug = 'rumo' || id != ''")
      if (t) tenantId = t.id
    } catch (_) {}

    const sopsCol = app.findCollectionByNameOrId('sops')
    const jobsCol = app.findCollectionByNameOrId('elisa_jobs')

    // 3. Atualizar aditivamente POP-EX-01 (v2026.4) com a nova rotina de sincronização Pasta Local -> GED
    let popEx01Rec = null
    try {
      popEx01Rec = app.findFirstRecordByFilter('sops', "codigo = 'POP-EX-01' && versao = '2026.4'")
    } catch (_) {}

    const PB_HOST = 'https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev'

    const etapasPopEx01Novas = [
      {
        ordem: 1,
        titulo: 'Verificação da Conexão e Polling de Tarefas Aprovadas',
        descricao: `Efetuar requisição GET ${PB_HOST}/backend/v1/elliza-agente/buscar-aprovadas com cabeçalho X-Elliza-Api-Key a cada 30-60 segundos.`,
        acao: 'Consultar fila e selecionar job de maior prioridade disponível.',
        criterio_sucesso:
          'Resposta HTTP 200 com array de jobs ou array vazio (quando sem demanda imediata).',
        criterio_erro: 'Erro HTTP 401 (chave inválida) ou 5xx (indisponibilidade).',
        responsavel_tipo: 'Elliza',
      },
      {
        ordem: 2,
        titulo: 'Assunção e Início da Execução do Job',
        descricao: `Efetuar requisição POST ${PB_HOST}/backend/v1/elliza-agente/iniciar enviando job_id no body.`,
        acao: 'Mudar status do job para EM_EXECUCAO no servidor e iniciar cronômetro.',
        criterio_sucesso: 'Resposta HTTP 200 com status EM_EXECUCAO confirmado.',
        criterio_erro: 'Job cancelado ou já assumido por outro agente.',
        responsavel_tipo: 'Elliza',
      },
      {
        ordem: 3,
        titulo: 'Sincronização Determinística Pasta Local → GED e Coleta de Evidências',
        descricao: `Varrer pasta local CNPJ\\AAAA-MM, enviar arquivos via POST ${PB_HOST}/backend/v1/elliza-agente/upload-documento com hash SHA-256 (deduplicação automática) e registrar evidências via POST ${PB_HOST}/backend/v1/elliza-agente/evidencias.`,
        acao: 'Upload com deduplicação, parada honesta em não classificáveis e persistência de IDs do GED.',
        criterio_sucesso:
          'Evidência registrada com sucesso com payload_dados_json estruturado e hash do arquivo.',
        criterio_erro: 'Falha na captura ou geração de hash.',
        responsavel_tipo: 'Elliza',
      },
      {
        ordem: 4,
        titulo: 'Conclusão Estrita pela Regra de Ouro',
        descricao: `Homologar encerramento via POST ${PB_HOST}/backend/v1/elliza-agente/concluir com criterio_sucesso_validado:true.`,
        acao: 'Confirmar indicador #rpa-status-conclusao[data-rpa-state="success"] e devolver conclusão.',
        criterio_sucesso: 'Status transicionado para CONCLUIDO e avanço para a próxima etapa.',
        criterio_erro: 'Tentativa de conclusão sem validação (HTTP 400).',
        responsavel_tipo: 'Elliza',
      },
    ]

    if (popEx01Rec) {
      const regrasAtualizadas = `${popEx01Rec.getString('regras_negocio')}

Sincronização Pasta Local → GED (v1.0):
- Rotina determinística de polling (30-60s) ou watch de diretórios locais organizados no padrão: <PASTA_RAIZ>\\<CNPJ>\\<AAAA-MM>\\<arquivos>.
- Endpoint de envio: POST ${PB_HOST}/backend/v1/elliza-agente/upload-documento (multipart/form-data com X-Elliza-Api-Key).
- Deduplicação por hash SHA-256: arquivos já arquivados no GED da empresa com o mesmo hash retornam status 'deduplicado' e não geram duplicidade.
- Parada honesta: documentos com CNPJ inexistente/inválido, competência fora do formato AAAA-MM ou hash ausente NUNCA são arquivados com suposição. São rejeitados com motivo preciso e geram pendência na Fila Humana.`

      popEx01Rec.set('regras_negocio', regrasAtualizadas)
      popEx01Rec.set('etapas_template_json', etapasPopEx01Novas)
      app.save(popEx01Rec)
      console.log(
        '[MIGRATION-0122] POP-EX-01 atualizado aditivamente com a rotina de Sincronização Pasta → GED.',
      )
    }

    // 4. Criar POP-EX-03: Sincronização de Pasta Local → GED (versão 2026.4, ativo)
    let popEx03Rec = null
    try {
      popEx03Rec = app.findFirstRecordByFilter('sops', "codigo = 'POP-EX-03' && versao = '2026.4'")
    } catch (_) {}

    const etapasPopEx03 = [
      {
        ordem: 1,
        titulo: 'Varredura da Pasta Local e Extração de Metadados da Estrutura CNPJ\\AAAA-MM',
        descricao:
          'Identificar novos arquivos depositados no diretório monitorado do computador do escritório.',
        entrada: 'Estrutura de pastas locais <PASTA_RAIZ>\\<CNPJ>\\<AAAA-MM>\\<arquivos>',
        acao: 'Extrair CNPJ e competência determinísticos pelo caminho da pasta e ler arquivo binário.',
        criterio_sucesso:
          'CNPJ com 14 dígitos e competência no formato AAAA-MM extraídos com exatidão.',
        criterio_erro: 'Estrutura fora do padrão determinístico CNPJ\\AAAA-MM.',
        proxima_etapa_nome: 'Cálculo de Hash SHA-256 e Envio ao Endpoint /upload-documento',
        requer_aprovacao: false,
        responsavel_tipo: 'Elliza',
      },
      {
        ordem: 2,
        titulo: 'Cálculo de Hash SHA-256 e Envio ao Endpoint /upload-documento',
        descricao: 'Calcular hash SHA-256 do arquivo e enviar com autenticação X-Elliza-Api-Key.',
        entrada: 'Arquivo binário + CNPJ + competência + hash SHA-256',
        acao: `POST ${PB_HOST}/backend/v1/elliza-agente/upload-documento (multipart/form-data).`,
        criterio_sucesso:
          'HTTP 200/201 confirmando arquivamento no GED ou deduplicação automática.',
        criterio_erro: 'Falha de comunicação ou rejeição por validação cadastral.',
        proxima_etapa_nome: 'Tratamento de Deduplicação e Parada Honesta em Não Classificáveis',
        requer_aprovacao: false,
        responsavel_tipo: 'Elliza',
      },
      {
        ordem: 3,
        titulo: 'Tratamento de Deduplicação e Parada Honesta em Não Classificáveis',
        descricao:
          'Se o hash já existe no GED da empresa, reconhecer deduplicado; se inválido, reter com segurança.',
        entrada: 'Resposta estruturada da API com status arquivado / deduplicado / rejeitado',
        acao: 'Registrar evidência com lista de IDs e contadores; em caso de rejeição, reter tarefa para validação humana.',
        criterio_sucesso:
          'Documentos arquivados ou deduplicados confirmados sem duplicidade no GED.',
        criterio_erro:
          'Arquivo com CNPJ inexistente ou competência inválida retido sem adivinhação.',
        proxima_etapa_nome: 'Homologação de Conclusão com Regra de Ouro',
        requer_aprovacao: false,
        responsavel_tipo: 'Elliza',
      },
      {
        ordem: 4,
        titulo: 'Homologação de Conclusão com Regra de Ouro',
        descricao:
          'Concluir tarefa via POST /concluir somente se houver evidência real e critério validado.',
        entrada: 'Resumo com contadores arquivados/deduplicados/rejeitados e IDs do GED',
        acao: 'POST /concluir com criterio_sucesso_validado: true.',
        criterio_sucesso: 'Tarefa concluída com sucesso e audit_log registrado.',
        criterio_erro: 'Conclusão impedida caso existam arquivos rejeitados sem tratamento.',
        proxima_etapa_nome: 'Processo Concluído',
        requer_aprovacao: false,
        responsavel_tipo: 'Elliza',
      },
    ]

    if (!popEx03Rec) {
      popEx03Rec = new Record(sopsCol)
      popEx03Rec.set('tenant_id', tenantId)
      popEx03Rec.set('codigo', 'POP-EX-03')
      popEx03Rec.set('nome', 'Sincronização Pasta Local → GED — Agente Externo ELLIZA Desktop')
      popEx03Rec.set('area', 'geral')
      popEx03Rec.set('versao', '2026.4')
      popEx03Rec.set('ativo', true)
      popEx03Rec.set(
        'objetivo',
        'Sincronização automatizada de arquivos entre pasta local monitorada na máquina da ELLIZA Desktop e o GED da Plataforma Rumo, com deduplicação por hash SHA-256, classificação determinística por CNPJ e competência, e parada honesta em arquivos não classificáveis.',
      )
      popEx03Rec.set(
        'gatilho',
        'Detecção de arquivos novos em pastas locais no padrão CNPJ\\AAAA-MM pelo loop de polling da ELLIZA Desktop (30-60s) ou tarefa agendada na Fila da Elliza.',
      )
      popEx03Rec.set(
        'pre_condicoes',
        `Software ELLIZA Desktop configurado com API Key válida apontando para a Base URL oficial ${PB_HOST}. Pastas locais estruturadas no padrão <PASTA_RAIZ>\\<CNPJ>\\<AAAA-MM>\\*.`,
      )
      popEx03Rec.set(
        'entradas',
        'Arquivos binários depositados em pastas locais, CNPJ da empresa (14 dígitos), competência (AAAA-MM), nome do arquivo e hash SHA-256.',
      )
      popEx03Rec.set(
        'sistemas_utilizados',
        'ELLIZA Desktop (Daemon de Sincronização Local), GED Inteligente da Rumo, Fila da Elliza e Trilha RPA v1.0.',
      )
      popEx03Rec.set(
        'responsavel_cargo',
        'ELLIZA Desktop (elliza-desktop-rpa) / Supervisor Técnico',
      )
      popEx03Rec.set('agente_nome', 'Elliza Desktop')
      popEx03Rec.set('nivel_autonomia', 'nivel_2_supervisionado')
      popEx03Rec.set('requer_aprovacao', false)
      popEx03Rec.set(
        'saida',
        'Arquivos novos arquivados no GED contábil da empresa e competência corretas, arquivos repetidos identificados como deduplicados e evidência auditável com hashes SHA-256.',
      )
      popEx03Rec.set('proximo_processo', 'POP-04, POP-05, POP-EX-02')
      popEx03Rec.set(
        'regras_negocio',
        `A classificação é determinística pela pasta CNPJ\\AAAA-MM. Antes de gravar no GED, o sistema consulta se o par (empresa_id, hash_sha256) já existe: se sim, responde status deduplicado sem criar segunda cópia. Arquivo com CNPJ inexistente no tenant, competência inválida ou hash ausente é imediatamente rejeitado com motivo descritivo, gerando pendência humana para validação (parada honesta: nada de adivinhar destino).`,
      )
      popEx03Rec.set(
        'criterios_sucesso',
        'Arquivos válidos arquivados no GED com hash gravado, duplicatas sinalizadas como deduplicadas e evidência com IDs persistida.',
      )
      popEx03Rec.set(
        'criterios_erro',
        'Tentativa de arquivamento com CNPJ inexistente, competência malformada ou hash ausente. Retenção segura via /erro.',
      )
      popEx03Rec.set(
        'excecoes',
        'Arquivos corrompidos ou em diretórios fora da hierarquia CNPJ\\AAAA-MM são movidos para quarentena local e reportados como pendência.',
      )
      popEx03Rec.set('etapas_template_json', etapasPopEx03)
      app.save(popEx03Rec)
      console.log('[MIGRATION-0122] POP-EX-03 criado com sucesso.')
    }

    // 5. Criar Job Template/Ativo na Fila da Elliza: Sincronização Pasta → GED
    let syncJobDemo = null
    try {
      syncJobDemo = app.findFirstRecordByFilter(
        'elisa_jobs',
        `tenant_id = '${tenantId}' && job_codigo = 'JOB-092026-SYNC-GED01'`,
      )
    } catch (_) {}

    // Empresa demo
    let empresaDemoId = '8p0e1w9y7szvtyy'
    try {
      const e = app.findFirstRecordByFilter('empresas', `tenant_id = '${tenantId}'`)
      if (e) empresaDemoId = e.id
    } catch (_) {}

    let processoDemoId = ''
    try {
      const p = app.findFirstRecordByFilter('processos_operacionais', `tenant_id = '${tenantId}'`)
      if (p) processoDemoId = p.id
    } catch (_) {}

    if (!syncJobDemo) {
      syncJobDemo = new Record(jobsCol)
      syncJobDemo.set('tenant_id', tenantId)
      if (processoDemoId) syncJobDemo.set('processo_id', processoDemoId)
      syncJobDemo.set('empresa_id', empresaDemoId)
      syncJobDemo.set('job_codigo', 'JOB-092026-SYNC-GED01')
      syncJobDemo.set('competencia', '09/2026')
      syncJobDemo.set('area', 'geral')
      syncJobDemo.set('processo_nome', 'Sincronização de Pasta Local → GED (ELLIZA Desktop)')
      syncJobDemo.set('pop_relacionado', 'POP-EX-03')
      syncJobDemo.set(
        'etapa_atual_nome',
        'Varrer pasta local CNPJ\\AAAA-MM, deduplicar por SHA-256 e sincronizar com o GED',
      )
      syncJobDemo.set(
        'proxima_acao',
        'Efetuar varredura na pasta local configurada, enviar arquivos via POST /upload-documento com hash SHA-256 e confirmar arquivamento.',
      )
      syncJobDemo.set('prioridade', 'alta')
      syncJobDemo.set('prazo', '2026-10-31T23:59:59Z')
      syncJobDemo.set('status', 'APROVADO')
      syncJobDemo.set('agente_responsavel', 'ELLIZA Desktop (Sincronizador Local)')
      syncJobDemo.set('nivel_autonomia', 'nivel_2_supervisionado')
      syncJobDemo.set('necessita_aprovacao', false)
      syncJobDemo.set(
        'resultado',
        'Tarefa de sincronização Pasta → GED aprovada e pronta para coleta pela ELLIZA desktop.',
      )
      syncJobDemo.set(
        'evidencia_resumo',
        'Aguardando varredura local e confirmação de upload pelo agente desktop.',
      )
      syncJobDemo.set('executado_por_agente_externo', true)
      syncJobDemo.set('agente_externo_id', 'elliza-desktop-rpa')
      syncJobDemo.set('agente_externo_nome', 'ELLIZA Desktop (RPA PC Local)')
      syncJobDemo.set('data_atribuicao_agente', new Date().toISOString())
      syncJobDemo.set('payload_execucao_json', {
        tipo_operacao: 'SINCRONIZACAO_PASTA_GED',
        tipo_tarefa: 'sincronizacao_pasta_ged',
        diretorio_base_sugerido: 'C:\\RumoContabil\\Documentos\\GED',
        padrao_pastas: 'CNPJ\\AAAA-MM',
        endpoint_upload: '/backend/v1/elliza-agente/upload-documento',
        deduplicacao_hash_obrigatoria: true,
        parada_honesta_em_nao_classificavel: true,
        estatisticas: {
          arquivados: 0,
          deduplicados: 0,
          rejeitados: 0,
          arquivos_rejeitados_detalhes: [],
          documentos_ged_ids: [],
        },
        criterio_sucesso:
          'Todos os arquivos da pasta local processados: novos gravados no GED, duplicados sinalizados e evidência com lista de IDs devolvida.',
        criterio_erro:
          'Estrutura de pastas inválida, CNPJ desconhecido ou hash ausente gera retenção com motivo descritivo sem adivinhação.',
        timeout_segundos: 180,
      })
      app.save(syncJobDemo)
      console.log('[MIGRATION-0122] Job demo de sincronização criado: JOB-092026-SYNC-GED01')
    }
  },
  (app) => {
    try {
      const sopsCol = app.findCollectionByNameOrId('sops')
      const rec = app.findFirstRecordByFilter('sops', "codigo = 'POP-EX-03'")
      if (rec) app.delete(rec)
    } catch (_) {}
  },
)

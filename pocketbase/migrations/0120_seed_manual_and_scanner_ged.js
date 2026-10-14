/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    console.log(
      '[MIGRATION-0120] Criando SOPs POP-EX-01 e POP-EX-02, autorização WhatsApp e Job Scanner->GED...',
    )

    // 1. Identificar Tenant Principal (Rumo)
    let tenantId = 'l91og8ybo9krtay'
    try {
      const t = app.findFirstRecordByFilter('tenants', "slug = 'rumo' || id != ''")
      if (t) tenantId = t.id
    } catch (_) {}

    const sopsCol = app.findCollectionByNameOrId('sops')
    const jobsCol = app.findCollectionByNameOrId('elisa_jobs')
    const procCol = app.findCollectionByNameOrId('processos_operacionais')

    // 2. Criar POP-EX-01: Manual de Operação — Agente Externo ELLIZA desktop (versão 2026.4, ativo)
    let popEx01Rec = null
    try {
      popEx01Rec = app.findFirstRecordByFilter('sops', `codigo = 'POP-EX-01' && versao = '2026.4'`)
    } catch (_) {}

    const regrasNegocioPopEx01 = `Contrato Trilha RPA v1.0. Privilégios mínimos: endpoints /backend/v1/elliza-agente/* com header X-Elliza-Api-Key.
Ciclo (30-60s): 1. Polling GET /buscar-aprovadas -> 2. Ler tarefa + blueprint -> 3. Navegar e ler telemetria #rpa-* -> 4. Executar no PC -> 5. Capturar evidência SHA-256 -> 6. POST /iniciar, /evidencias, /concluir ou /erro -> 7. Reiniciar polling.
Regra de Ouro: conclusão exige #rpa-status-conclusao[data-rpa-state="success"] E criterio_sucesso_validado:true. Sem isso retorna 400. Parada honesta: dado divergente ou ausente ("—") reportar via /erro.
Telemetria contratada: #rpa-step, #rpa-btn-executar, #rpa-grid-balancete, #rpa-grid-lancamentos, #rpa-grid-conciliacao, #rpa-status-conclusao, #rpa-empresa-ficha, #rpa-grid-qsa, #rpa-grid-documentos.
WhatsApp somente via ZAP local da ELLIZA desktop (Evolution API descontinuada). Scanner->GED: OCR, identificação da empresa/pedido e anexo com SHA-256.`

    const etapasPopEx01 = [
      {
        ordem: 1,
        titulo: 'Autenticação e Polling no Endpoint /buscar-aprovadas',
        descricao: 'Consultar tarefas com header X-Elliza-Api-Key a cada 30-60s.',
        acao: 'Efetuar GET /backend/v1/elliza-agente/buscar-aprovadas e recuperar tarefas APROVADAS.',
        criterio_sucesso: 'HTTP 200 com array de tarefas estruturadas contendo job_id e payload.',
        criterio_erro: 'HTTP 401 por credencial inválida ou ausente.',
        responsavel_tipo: 'Elliza',
      },
      {
        ordem: 2,
        titulo: 'Leitura Determinística da Tela por Atributos RPA',
        descricao: 'Navegar à tela e ler estado via data-step-code, data-step-status e grids.',
        acao: 'Inspecionar elementos #rpa-* sem scraping frágil de texto visual.',
        criterio_sucesso: 'Atributos lidos com sucesso refletindo o estado da esteira.',
        criterio_erro: 'Seletor ausente ou divergente.',
        responsavel_tipo: 'Elliza',
      },
      {
        ordem: 3,
        titulo: 'Execução Local e Captura de Evidência com Hash SHA-256',
        descricao: 'Executar ação no PC e capturar screenshot/recibo gerando hash SHA-256.',
        acao: 'Registrar evidência via POST /evidencias e anexar ao GED quando aplicável.',
        criterio_sucesso: 'Evidência persistida com hash SHA-256 e protocolo auditável.',
        criterio_erro: 'Falha na captura ou geração de hash.',
        responsavel_tipo: 'Elliza',
      },
      {
        ordem: 4,
        titulo: 'Conclusão Estrita pela Regra de Ouro',
        descricao: 'Homologar encerramento via POST /concluir com criterio_sucesso_validado:true.',
        acao: 'Confirmar indicador #rpa-status-conclusao[data-rpa-state="success"] e devolver conclusão.',
        criterio_sucesso: 'Status transicionado para CONCLUIDO e avanço para a próxima etapa.',
        criterio_erro: 'Tentativa de conclusão sem validação (HTTP 400).',
        responsavel_tipo: 'Elliza',
      },
    ]

    if (!popEx01Rec) {
      popEx01Rec = new Record(sopsCol)
      popEx01Rec.set('tenant_id', tenantId)
      popEx01Rec.set('codigo', 'POP-EX-01')
      popEx01Rec.set('nome', 'Manual de Operação — Agente Externo ELLIZA desktop')
      popEx01Rec.set('area', 'geral')
      popEx01Rec.set('versao', '2026.4')
      popEx01Rec.set('ativo', true)
      popEx01Rec.set(
        'objetivo',
        'Manual de Operação e Diretrizes de Execução do Agente Externo ELLIZA Desktop (elliza-desktop-rpa) integrado à Fila da Elliza e à Trilha RPA v1.0.',
      )
      popEx01Rec.set(
        'gatilho',
        'Inicialização do agente desktop no PC local, polling contínuo (30-60s) e execução de tarefas aprovadas pela supervisão humana.',
      )
      popEx01Rec.set(
        'pre_condicoes',
        'API key dedicada configurada no software ELLIZA Desktop e acesso aos endpoints /backend/v1/elliza-agente/*.',
      )
      popEx01Rec.set(
        'entradas',
        'Tarefas aprovadas retornadas pelo endpoint /buscar-aprovadas, payloads de execução e atributos de telemetria da Trilha RPA v1.0.',
      )
      popEx01Rec.set(
        'sistemas_utilizados',
        'ELLIZA Desktop (PC Local), Fila da Elliza, Trilha RPA v1.0, WhatsApp via ZAP Local, Módulo GED e Scanner.',
      )
      popEx01Rec.set('responsavel_cargo', 'Agente Externo ELLIZA Desktop / Supervisor Técnico')
      popEx01Rec.set('agente_nome', 'Elliza Desktop')
      popEx01Rec.set('nivel_autonomia', 'nivel_2_supervisionado')
      popEx01Rec.set('requer_aprovacao', true)
      popEx01Rec.set(
        'saida',
        'Tarefas executadas com evidência auditável (screenshot + hash SHA-256) e conclusão validada pela Regra de Ouro.',
      )
      popEx01Rec.set('proximo_processo', 'POP-04, POP-05, POP-AT-01, POP-EX-02')
      popEx01Rec.set('regras_negocio', regrasNegocioPopEx01)
      popEx01Rec.set(
        'criterios_sucesso',
        'Indicador inequívoco (#rpa-status-conclusao com success), criterio_sucesso_validado:true e evidência com SHA-256.',
      )
      popEx01Rec.set(
        'criterios_erro',
        'Parada honesta: dado divergente ou ausente ("—") gera retenção com segurança e acionamento de POST /erro.',
      )
      popEx01Rec.set(
        'excecoes',
        'Qualquer indisponibilidade ou dúvida técnica deve reter a tarefa como BLOQUEADO sem adivinhações.',
      )
      popEx01Rec.set('etapas_template_json', etapasPopEx01)
      app.save(popEx01Rec)
      console.log('[MIGRATION-0120] POP-EX-01 criado com sucesso.')
    }

    // 3. Criar POP-EX-02: Scanner → GED — Digitalização e Classificação de Documentos (versão 2026.4, ativo)
    let popEx02Rec = null
    try {
      popEx02Rec = app.findFirstRecordByFilter('sops', `codigo = 'POP-EX-02' && versao = '2026.4'`)
    } catch (_) {}

    const etapasPopEx02 = [
      {
        ordem: 1,
        titulo: 'Captura e Digitalização Física do Documento',
        descricao: 'Digitalizar o documento do cliente usando scanner físico ou captura da ELLIZA.',
        entrada: 'Documento impresso do cliente (extrato, contrato, nota ou recibo)',
        acao: 'Acionar scanner local ou importar arquivo bruto para o módulo de processamento da ELLIZA desktop.',
        criterio_sucesso:
          'Arquivo digitalizado gerado em formato PDF/imagem com resolução legível (>= 300 DPI).',
        criterio_erro: 'Falha de comunicação com scanner local ou imagem corrompida.',
        proxima_etapa_nome: 'OCR e Classificação Automática do Tipo Documental',
        requer_aprovacao: false,
        responsavel_tipo: 'Elliza',
      },
      {
        ordem: 2,
        titulo: 'OCR e Classificação Automática do Tipo Documental',
        descricao:
          'Extrair texto por OCR e reconhecer tipo (extrato_bancario, nota_fiscal, contrato_social, fatura_cartao, outros).',
        entrada: 'Arquivo PDF/imagem digitalizado',
        acao: 'Processar motor OCR da ELLIZA e classificar tipologia conforme catálogo de documentos.',
        criterio_sucesso: 'Texto extraído e documento categorizado em tipologia válida.',
        criterio_erro: 'Documento ilegível ou inconclusivo.',
        proxima_etapa_nome: 'Identificação da Empresa e Localização do Pedido de Documentos',
        requer_aprovacao: false,
        responsavel_tipo: 'Elliza',
      },
      {
        ordem: 3,
        titulo: 'Identificação da Empresa e Localização do Pedido de Documentos',
        descricao:
          'Identificar CNPJ/Razão Social no documento e localizar o pedido em aberto correspondente.',
        entrada: 'CNPJ reconhecido e competência do documento',
        acao: 'Consultar empresa e pedido de documentos pendente em /pedidos-documentos via telemetria #rpa-grid-documentos.',
        criterio_sucesso:
          'Empresa vinculada e pedido de documentos identificado com status pendente ou parcialmente_atendido.',
        criterio_erro: 'Empresa não cadastrada na carteira ou ausência de pedido correspondente.',
        proxima_etapa_nome: 'Anexação no GED e Vinculação ao Pedido com Hash SHA-256',
        requer_aprovacao: false,
        responsavel_tipo: 'Elliza',
      },
      {
        ordem: 4,
        titulo: 'Anexação no GED e Vinculação ao Pedido com Hash SHA-256',
        descricao:
          'Gravar arquivo na collection documentos, atualizar item do pedido e gerar hash SHA-256.',
        acao: 'Realizar upload no GED vinculando empresa_id, calcular hash SHA-256 e registrar protocolo.',
        criterio_sucesso: 'Documento arquivado no GED e item do pedido marcado como recebido.',
        criterio_erro: 'Falha no upload do arquivo ou timeout de rede.',
        proxima_etapa_nome: 'Reportar Evidência e Conclusão com Regra de Ouro',
        requer_aprovacao: false,
        responsavel_tipo: 'Elliza',
      },
      {
        ordem: 5,
        titulo: 'Reportar Evidência e Conclusão com Regra de Ouro',
        descricao:
          'Chamar POST /evidencias com hash SHA-256 e finalizar com POST /concluir (criterio_sucesso_validado: true).',
        acao: 'Enviar comprovante e notificar plataforma sobre o fechamento do job de digitalização.',
        criterio_sucesso:
          'Evidência persistida em elisa_evidencias e job finalizado com status CONCLUIDO.',
        criterio_erro: 'Falha na resposta da API ou critério de sucesso não atendido.',
        proxima_etapa_nome: 'Processo Concluído',
        requer_aprovacao: false,
        responsavel_tipo: 'Elliza',
      },
    ]

    if (!popEx02Rec) {
      popEx02Rec = new Record(sopsCol)
      popEx02Rec.set('tenant_id', tenantId)
      popEx02Rec.set('codigo', 'POP-EX-02')
      popEx02Rec.set('nome', 'Scanner → GED — Digitalização e Classificação de Documentos')
      popEx02Rec.set('area', 'geral')
      popEx02Rec.set('versao', '2026.4')
      popEx02Rec.set('ativo', true)
      popEx02Rec.set(
        'objetivo',
        'Mapeamento determinístico do robô Scanner → GED: digitalização física pelo PC local da ELLIZA Desktop, OCR e classificação inteligente, vinculação ao pedido de documentos do cliente e arquivamento auditável no GED com hash SHA-256.',
      )
      popEx02Rec.set(
        'gatilho',
        'Recepção de malote físico no escritório, acionamento do scanner da ELLIZA desktop ou coleta de documentos digitalizados em pasta local.',
      )
      popEx02Rec.set(
        'pre_condicoes',
        'Scanner ou alimentador configurado na máquina local da ELLIZA e pedido de documentos cadastrado na plataforma.',
      )
      popEx02Rec.set(
        'entradas',
        'Documentos físicos do cliente (extratos bancários, faturas, notas, contratos, recibos) e metadados de competência.',
      )
      popEx02Rec.set(
        'sistemas_utilizados',
        'ELLIZA Desktop (Módulo Scanner & OCR), GED Contábil da Rumo, Módulo de Pedidos de Documentos (#rpa-grid-documentos) e Trilha RPA v1.0.',
      )
      popEx02Rec.set('responsavel_cargo', 'ELLIZA Desktop (RPA PC Local) / Operador de GED')
      popEx02Rec.set('agente_nome', 'Elliza Desktop')
      popEx02Rec.set('nivel_autonomia', 'nivel_2_supervisionado')
      popEx02Rec.set('requer_aprovacao', false)
      popEx02Rec.set(
        'saida',
        'Documentos arquivados no GED vinculados à empresa e ao pedido correspondente, com hash SHA-256 e evidência auditável.',
      )
      popEx02Rec.set(
        'proximo_processo',
        'POP-04 (Fechamento Contábil) e POP-05 (Conciliação Bancária)',
      )
      popEx02Rec.set(
        'regras_negocio',
        'O robô Scanner → GED opera sob o Manual de Operação RUMO: após a digitalização física ou recepção em pasta monitorada, aplica OCR determinístico, reconhece CNPJ e competência, busca o pedido correspondente via telemetria #rpa-grid-documentos, anexa o PDF ao GED e homologa a conclusão com criterio_sucesso_validado:true e hash SHA-256. Em caso de documento sem empresa identificada ou ilegível, aciona parada honesta POST /erro com retenção segura.',
      )
      popEx02Rec.set(
        'criterios_sucesso',
        'Documento digitalizado com resolução legível, tipo classificado corretamente, anexo indexado no GED com hash SHA-256 e pedido de documentos atualizado.',
      )
      popEx02Rec.set(
        'criterios_erro',
        'Documento ilegível, empresa não identificada ou falha de anexação no GED.',
      )
      popEx02Rec.set(
        'excecoes',
        'Documentos não identificados são retidos na pasta de quarentena do GED para conferência humana.',
      )
      popEx02Rec.set('etapas_template_json', etapasPopEx02)
      app.save(popEx02Rec)
      console.log('[MIGRATION-0120] POP-EX-02 criado com sucesso.')
    }

    // 4. Garantir que a empresa do job demo JOB-092026-WA-ZAP01 tenha autorização ativa em whatsapp_notificacoes_autorizadas
    // e criar registro em whatsapp_envios referenciando o job
    let waJobDemo = null
    try {
      waJobDemo = app.findFirstRecordByFilter(
        'elisa_jobs',
        `tenant_id = '${tenantId}' && job_codigo = 'JOB-092026-WA-ZAP01'`,
      )
    } catch (_) {}

    let empresaDemoId = '8p0e1w9y7szvtyy'
    let processoBaseId = 'v04ob933ewm9dt5'
    if (waJobDemo) {
      empresaDemoId = waJobDemo.getString('empresa_id') || empresaDemoId
      processoBaseId = waJobDemo.getString('processo_id') || processoBaseId
    }

    try {
      const autCol = app.findCollectionByNameOrId('whatsapp_notificacoes_autorizadas')
      let autRec = null
      try {
        autRec = app.findFirstRecordByFilter(
          'whatsapp_notificacoes_autorizadas',
          `tenant_id = '${tenantId}' && empresa = '${empresaDemoId}'`,
        )
      } catch (_) {}

      if (!autRec) {
        autRec = new Record(autCol)
        autRec.set('tenant_id', tenantId)
        autRec.set('empresa', empresaDemoId)
        autRec.set('canal_preferencial', 'zap_elliza_desktop')
        autRec.set('autorizado', true)
        autRec.set('autorizado_por', 'Diretoria Rumo (Conforme Contrato de Honorários)')
        autRec.set('telefone_notificacao', '5541999999999')
        autRec.set('tipos_permitidos_json', [
          'aviso',
          'guia',
          'folha',
          'demonstrativo',
          'documento',
        ])
        autRec.set('horario_inicio', '08:00')
        autRec.set('horario_fim', '18:00')
        autRec.set('dias_semana_json', ['seg', 'ter', 'qua', 'qui', 'sex'])
        autRec.set(
          'observacoes',
          'Autorização formal homologada para disparos via ZAP da ELLIZA Desktop.',
        )
        app.save(autRec)
        console.log('[MIGRATION-0120] Autorização WhatsApp criada para empresa demo.')
      } else {
        autRec.set('autorizado', true)
        autRec.set('canal_preferencial', 'zap_elliza_desktop')
        app.save(autRec)
      }
    } catch (errAut) {
      console.warn('[MIGRATION-0120] Erro ao assegurar autorização WhatsApp:', errAut)
    }

    // Garantir registro em whatsapp_envios com referência ao job demo
    try {
      const enviosCol = app.findCollectionByNameOrId('whatsapp_envios')
      let envioJob = null
      try {
        envioJob = app.findFirstRecordByFilter(
          'whatsapp_envios',
          `tenant_id = '${tenantId}' && referencia = 'JOB-092026-WA-ZAP01'`,
        )
      } catch (_) {}

      if (!envioJob) {
        envioJob = new Record(enviosCol)
        envioJob.set('tenant_id', tenantId)
        envioJob.set('empresa', empresaDemoId)
        envioJob.set('destinatario', '5541999999999')
        envioJob.set(
          'mensagem',
          'Aviso de fechamento contábil Rumo: sua guia DAS referente a 09/2026 está disponível para conferência.',
        )
        envioJob.set('tipo', 'aviso')
        envioJob.set('origem', 'elliza_desktop_zap')
        envioJob.set('status', 'enfileirado')
        envioJob.set('referencia', 'JOB-092026-WA-ZAP01')
        envioJob.set('detalhes_json', {
          job_codigo: 'JOB-092026-WA-ZAP01',
          canal: 'zap_elliza_desktop',
          agente: 'elliza-desktop-rpa',
          autorizacao_verificada: true,
          autorizacao_rota: '/portal-acessos (aba Envio Ativo WhatsApp)',
          observacao: 'Aguardando execução pelo ZAP local da ELLIZA desktop no PC do usuário.',
        })
        app.save(envioJob)
        console.log(
          '[MIGRATION-0120] Registro de envio criado em whatsapp_envios para JOB-092026-WA-ZAP01.',
        )
      }

      // Atualizar payload do job demo no elisa_jobs para incluir as referências exatas
      if (waJobDemo) {
        waJobDemo.set('status', 'APROVADO')
        waJobDemo.set('agente_externo_id', 'elliza-desktop-rpa')
        waJobDemo.set('payload_execucao_json', {
          tipo_operacao: 'WHATSAPP_ENVIO_ZAP',
          canal: 'zap_elliza_desktop',
          destinatario: '5541999999999',
          mensagem:
            'Aviso de fechamento contábil Rumo: sua guia DAS referente a 09/2026 está disponível para conferência.',
          referencia_autorizacao: '/portal-acessos (Aba Envio Ativo WhatsApp)',
          whatsapp_envio_id: envioJob ? envioJob.id : '',
          whatsapp_envio_referencia: 'JOB-092026-WA-ZAP01',
          criterio_sucesso: 'Mensagem transmitida pelo ZAP da ELLIZA com recibo de envio validado.',
          criterio_erro: 'Falha de conexão com ZAP local da ELLIZA ou número inválido.',
          timeout_segundos: 60,
        })
        app.save(waJobDemo)
        console.log(
          '[MIGRATION-0120] Job demo JOB-092026-WA-ZAP01 atualizado com payload enriquecido.',
        )
      }
    } catch (errEnv) {
      console.warn('[MIGRATION-0120] Erro ao assegurar registro em whatsapp_envios:', errEnv)
    }

    // 5. Criar Job Template/Modelo aprovável para o Robô Scanner → GED: JOB-092026-SCAN-GED01
    let scanJobDemo = null
    try {
      scanJobDemo = app.findFirstRecordByFilter(
        'elisa_jobs',
        `tenant_id = '${tenantId}' && job_codigo = 'JOB-092026-SCAN-GED01'`,
      )
    } catch (_) {}

    // Buscar um processo operacional válido para o campo relation processo_id
    let procScanId = processoBaseId
    try {
      const p = app.findFirstRecordByFilter('processos_operacionais', `tenant_id = '${tenantId}'`)
      if (p) procScanId = p.id
    } catch (_) {}

    if (!scanJobDemo) {
      scanJobDemo = new Record(jobsCol)
      scanJobDemo.set('tenant_id', tenantId)
      scanJobDemo.set('processo_id', procScanId)
      scanJobDemo.set('empresa_id', empresaDemoId)
      scanJobDemo.set('job_codigo', 'JOB-092026-SCAN-GED01')
      scanJobDemo.set('competencia', '09/2026')
      scanJobDemo.set('area', 'geral')
      scanJobDemo.set(
        'processo_nome',
        'Digitalização e Arquivamento de Extratos no GED — Scanner → GED',
      )
      scanJobDemo.set('pop_relacionado', 'POP-EX-02')
      scanJobDemo.set(
        'etapa_atual_nome',
        'Digitalizar extratos bancários físicos, aplicar OCR e anexar ao Pedido de Documentos no GED',
      )
      scanJobDemo.set(
        'proxima_acao',
        'Acionar scanner local, extrair texto via OCR, indexar no GED do cliente e anexar ao pedido com hash SHA-256.',
      )
      scanJobDemo.set('prioridade', 'alta')
      scanJobDemo.set('prazo', '2026-10-25T23:59:59Z')
      scanJobDemo.set('status', 'APROVADO')
      scanJobDemo.set('agente_responsavel', 'ELLIZA Desktop (Scanner Local)')
      scanJobDemo.set('nivel_autonomia', 'nivel_2_supervisionado')
      scanJobDemo.set('necessita_aprovacao', false)
      scanJobDemo.set(
        'resultado',
        'Tarefa de digitalização Scanner → GED aprovada e pronta para coleta pelo agente externo.',
      )
      scanJobDemo.set('evidencia_resumo', 'Aguardando processamento pelo robô Scanner → GED local.')
      scanJobDemo.set('executado_por_agente_externo', true)
      scanJobDemo.set('agente_externo_id', 'elliza-desktop-rpa')
      scanJobDemo.set('agente_externo_nome', 'ELLIZA Desktop (RPA PC Local)')
      scanJobDemo.set('data_atribuicao_agente', new Date().toISOString())
      scanJobDemo.set('payload_execucao_json', {
        tipo_operacao: 'SCANNER_GED_DIGITALIZACAO',
        robo_codigo: 'ROBO-01-SCANNER-GED',
        empresa_id: empresaDemoId,
        competencia: '09/2026',
        pedido_documentos_id: 'f3z8c3j8tv2p6kx',
        categoria_documento: 'extrato_bancario',
        resolucao_dpi_minima: 300,
        arquivos_esperados: [
          {
            nome_sugerido: 'extrato_bancario_itau_092026.pdf',
            descricao: 'Extrato bancário conta corrente Itaú Setembro/2026',
            tipo: 'extrato_bancario',
            obrigatorio: true,
          },
        ],
        criterio_sucesso:
          'Documento digitalizado anexado ao GED, item do pedido marcado como recebido e evidência com hash SHA-256 devolvida.',
        criterio_erro: 'Falha no scanner, imagem ilegível ou erro ao indexar no GED contábil.',
        timeout_segundos: 120,
      })
      app.save(scanJobDemo)
      console.log(
        '[MIGRATION-0120] Job demo Scanner → GED criado para ELLIZA Desktop: JOB-092026-SCAN-GED01',
      )
    }
  },
  (app) => {
    try {
      const sopsCol = app.findCollectionByNameOrId('sops')
      const rec1 = app.findFirstRecordByFilter('sops', "codigo = 'POP-EX-01'")
      if (rec1) app.delete(rec1)
      const rec2 = app.findFirstRecordByFilter('sops', "codigo = 'POP-EX-02'")
      if (rec2) app.delete(rec2)
    } catch (_) {}
  },
)

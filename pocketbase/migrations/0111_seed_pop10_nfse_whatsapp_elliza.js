/**
 * Migration 0111:
 * 1. SOP POP-10: Emissão Inteligente de NFS-e via WhatsApp (Elliza opera o atendimento e ciclo completo sem API externa de emissão)
 * 2. Processo operacional demo da competência 09/2026 para o POP-10:
 *    - Pedido recebido via WhatsApp da empresa cliente (LRN Serviços Médicos / Inovatech)
 *    - Identificação automática do cliente e competência (Etapa 1 - Nível 1 - Concluída)
 *    - Validação dos dados fiscais do tomador, discriminação e alíquota municipal (Etapa 2 - Nível 1 - Concluída)
 *    - Montagem do rascunho determinístico da NFS-e e formalização no GED (Etapa 3 - Nível 2 - Concluída)
 *    - Conferência e aprovação Nível 3 privativa do Contador (Etapa 4 - Nível 3 - AGUARDANDO_APROVACAO com pendência no Modo Humano)
 *    - Emissão ou formalização no GED + envio pelo WhatsApp ao cliente (Etapa 5 e 6)
 * 3. Solicitação demo em nfse_solicitacoes para sincronia perfeita com a esteira /nfse-whatsapp
 */

migrate(
  (app) => {
    console.log('[MIGRATION-0111] Criando POP-10 e processo demo de emissão inteligente...')

    // 1. Obter tenant principal
    let tenantId = 'l91og8ybo9krtay'
    try {
      const t = app.findFirstRecordByFilter('tenants', "slug = 'rumo' || id != ''")
      if (t) tenantId = t.id
    } catch (_) {}

    // Obter empresa principal
    let empresaId = 'ncr47r3gf2eaz91'
    try {
      const emp = app.findFirstRecordByFilter(
        'empresas',
        `tenant_id = '${tenantId}' && status = 'ativo'`,
      )
      if (emp) empresaId = emp.id
    } catch (_) {}

    const sopsCol = app.findCollectionByNameOrId('sops')
    const procsCol = app.findCollectionByNameOrId('processos_operacionais')
    const etapasCol = app.findCollectionByNameOrId('processo_etapas')
    const jobsCol = app.findCollectionByNameOrId('elisa_jobs')
    const evidCol = app.findCollectionByNameOrId('elisa_evidencias')
    const pendCol = app.findCollectionByNameOrId('processo_pendencias')
    const docsCol = app.findCollectionByNameOrId('documentos')
    const solCol = app.findCollectionByNameOrId('nfse_solicitacoes')
    const auditCol = app.findCollectionByNameOrId('audit_log')

    // ==========================================
    // PARTE 1: SOP POP-10 NO CATÁLOGO
    // ==========================================
    let sopPop10 = null
    try {
      sopPop10 = app.findFirstRecordByFilter(
        'sops',
        `tenant_id = '${tenantId}' && codigo = 'POP-10'`,
      )
    } catch (_) {}

    const etapasPop10Template = [
      {
        ordem: 1,
        titulo: '1. Receber e decodificar pedido via WhatsApp',
        descricao:
          'Receber mensagem do cliente pelo canal de WhatsApp, identificar número de telefone, extrair intenção e abrir solicitação de NFS-e.',
        responsavel_tipo: 'Elliza',
        entrada: 'Mensagem de texto ou áudio recebida via webhook do WhatsApp.',
        acao: 'Analisar intenção, identificar a empresa remetente autorizada e cadastrar solicitação estruturada.',
        criterio_sucesso:
          'Solicitação registrada com contato, empresa vinculada e competência 09/2026.',
        criterio_erro: 'Telefone não vinculado a nenhuma empresa ativa ou sem autorização prévia.',
        proxima_etapa_nome: '2. Validar dados fiscais do tomador e tributos municipais',
        requer_aprovacao: false,
      },
      {
        ordem: 2,
        titulo: '2. Validar dados fiscais (Tomador, Discriminação e Alíquota Municipal)',
        descricao:
          'Conferir CNPJ/CPF do tomador, endereço, descrição da prestação de serviços, código de serviço e alíquota de ISS.',
        responsavel_tipo: 'Elliza',
        entrada: 'Dados extraídos do pedido + Cadastro municipal de serviços.',
        acao: 'Verificar dígito verificador do tomador, checar retenções federais (PIS/COFINS/CSLL/IRRF) e alíquota de ISS.',
        criterio_sucesso:
          'Tomador regular, valores calculados com exatidão e sem divergências cadastrais.',
        criterio_erro: 'Documento do tomador inválido ou dados insuficientes.',
        proxima_etapa_nome: '3. Montar rascunho determinístico da NFS-e e formalizar no GED',
        requer_aprovacao: false,
      },
      {
        ordem: 3,
        titulo: '3. Montar rascunho da NFS-e e formalizar no GED interno',
        descricao:
          'Gerar a estrutura completa da nota fiscal de serviços, espelho de cálculo e arquivar rascunho probatório no GED.',
        responsavel_tipo: 'Elliza',
        entrada: 'Dados validados da etapa anterior + Parâmetros fiscais da empresa prestadora.',
        acao: 'Compilar XML preliminar, gerar preview da DANFSE e gravar registro seguro na plataforma.',
        criterio_sucesso:
          'Rascunho gravado no GED com hash SHA-256 e título financeiro provisionado.',
        criterio_erro: 'Falha ao serializar XML ou erro de permissão no GED.',
        proxima_etapa_nome: '4. Validação e autorização privativa do Contador (Nível 3)',
        requer_aprovacao: true,
      },
      {
        ordem: 4,
        titulo: '4. Conferência técnica e aprovação privativa do Contador (Nível 3)',
        descricao:
          'O contador responsável revisa o rascunho, valida retenções e concede autorização expressa para emissão/formalização.',
        responsavel_tipo: 'Humano',
        entrada: 'Rascunho da nota montado pela Elliza + Alertas fiscais.',
        acao: 'Aprovar a emissão no Modo Humano, rejeitar com apontamento para retificação ou devolver para a Elliza.',
        criterio_sucesso: 'Chancela digital do contador registrada na trilha de auditoria CFC.',
        criterio_erro: 'Divergência técnica no código de tributação municipal.',
        proxima_etapa_nome: '5. Transmissão municipal ou formalização no GED',
        requer_aprovacao: true,
      },
      {
        ordem: 5,
        titulo: '5. Transmissão oficial ou formalização no GED (Sem dependência de API externa)',
        descricao:
          'Se houver provedor fiscal configurado, transmite ao WS municipal; se não houver, formaliza o documento no GED com validade jurídica interna.',
        responsavel_tipo: 'Elliza',
        entrada: 'Autorização do Contador + Rascunho homologado.',
        acao: 'Processar emissão ou consolidar no repositório digital contábil com número de controle e hash.',
        criterio_sucesso: 'Nota emitida ou formalizada no GED com código de verificação.',
        criterio_erro: 'Rejeição no provedor municipal (quando configurado).',
        proxima_etapa_nome: '6. Envio da nota e retorno ao cliente via WhatsApp com evidência',
        requer_aprovacao: false,
      },
      {
        ordem: 6,
        titulo: '6. Devolução da nota ao cliente pelo WhatsApp e registro de evidência',
        descricao:
          'Disparar mensagem no WhatsApp com link da DANFSE/PDF, resumo fiscal e gravar evidência SHA-256.',
        responsavel_tipo: 'Elliza',
        entrada: 'Nota emitida/formalizada + Canal de WhatsApp.',
        acao: 'Notificar o solicitante pelo motor de envios ativos e arquivar recibo na auditoria.',
        criterio_sucesso: 'Mensagem confirmada, comprovante entregue e protocolo final registrado.',
        criterio_erro: 'Falha no envio de mensagem ao WhatsApp.',
        proxima_etapa_nome: 'Processo Concluído',
        requer_aprovacao: false,
      },
    ]

    if (!sopPop10) {
      sopPop10 = new Record(sopsCol)
      sopPop10.set('tenant_id', tenantId)
      sopPop10.set('codigo', 'POP-10')
      sopPop10.set('nome', 'Emissão Inteligente de NFS-e via WhatsApp')
      sopPop10.set('area', 'fiscal')
      sopPop10.set('versao', '2026.3')
      sopPop10.set(
        'objetivo',
        'Receber pedidos de NFS-e via WhatsApp, decodificar intenção, estruturar rascunho com dados fiscais completos, validar retenções e operar o atendimento sem depender de API externa de emissão.',
      )
      sopPop10.set(
        'gatilho',
        'Mensagem de solicitação de nota fiscal enviada pelo cliente no WhatsApp ou pedido manual na esteira.',
      )
      sopPop10.set(
        'pre_condicoes',
        'Empresa prestadora com alíquota de ISS configurada e autorização ativa para recebimento de WhatsApp.',
      )
      sopPop10.set(
        'entradas',
        'Mensagem do solicitante, dados cadastrais do tomador, discriminação dos serviços e valor bruto.',
      )
      sopPop10.set('nivel_autonomia', 'nivel_3_aprovacao_obrigatoria')
      sopPop10.set('agente_nome', 'Elliza')
      sopPop10.set('etapas_template_json', etapasPop10Template)
      sopPop10.set(
        'regras_negocio',
        'A Elliza opera 100% do atendimento, decodificação e rascunho internamente. Caso não haja provedor de API externa de emissão conectado, a nota é formalizada no GED da empresa com rascunho técnico auditável. Nenhuma transmissão fiscal ou formalização ocorre sem aprovação prévia do Contador (Nível 3).',
      )
      sopPop10.set(
        'criterios_sucesso',
        'Atendimento concluído com rascunho conferido, aprovação humana registrada e nota/espelho devolvido no WhatsApp.',
      )
      sopPop10.set(
        'criterios_erro',
        'Dados do tomador inconsistentes ou ausência de chancela contábil no Modo Humano.',
      )
      sopPop10.set(
        'excecoes',
        'Quando houver instabilidade no provedor municipal externo, o atendimento pelo WhatsApp não é interrompido: o rascunho permanece salvo no GED com protocolo interno.',
      )
      sopPop10.set('requer_aprovacao', true)
      sopPop10.set(
        'saida',
        'Rascunho de NFS-e no GED, espelho de cálculo de tributos, registro no Financeiro e envio confirmado no WhatsApp.',
      )
      sopPop10.set('proximo_processo', 'POP-08 (Contas a Receber e Cobrança)')
      sopPop10.set('ativo', true)
      app.save(sopPop10)
      console.log('[MIGRATION-0111] POP-10 criado no catálogo de SOPs com sucesso!')
    }

    // ==========================================
    // PARTE 2: PROCESSO DEMO DA COMPETÊNCIA 09/2026
    // ==========================================
    const procNfseExistente = app.findRecordsByFilter(
      'processos_operacionais',
      `tenant_id = '${tenantId}' && codigo_sop = 'POP-10' && competencia = '09/2026'`,
      '',
      1,
    )

    if (procNfseExistente.length === 0) {
      const procNfse = new Record(procsCol)
      procNfse.set('tenant_id', tenantId)
      procNfse.set('empresa_id', empresaId)
      procNfse.set('sop_id', sopPop10.id)
      procNfse.set('codigo_sop', 'POP-10')
      procNfse.set('titulo', 'Emissão Inteligente de NFS-e via WhatsApp — 09/2026')
      procNfse.set('area', 'fiscal')
      procNfse.set('competencia', '09/2026')
      procNfse.set('status', 'AGUARDANDO_APROVACAO')
      procNfse.set('prioridade', 'urgente')
      procNfse.set('nivel_autonomia', 'nivel_3_aprovacao_obrigatoria')
      procNfse.set('etapa_atual_numero', 4)
      procNfse.set(
        'etapa_atual_nome',
        '4. Conferência técnica e aprovação privativa do Contador (Nível 3)',
      )
      procNfse.set('total_etapas', 6)
      procNfse.set('progresso_percentual', 65)
      procNfse.set('agente_responsavel', 'Elliza')
      procNfse.set('prazo', '2026-10-15 23:59:59.000Z')
      procNfse.set('data_inicio', '2026-10-06 09:15:00.000Z')
      procNfse.set(
        'ultima_acao_executada',
        'Rascunho da NFS-e montado determinística e formalizado no GED com cálculo de ISS, PIS/COFINS e retenções.',
      )
      procNfse.set(
        'resultado_ultima_acao',
        'Rascunho de R$ 4.850,00 arquivado no GED. Retido de forma segura para aprovação no Modo Humano.',
      )
      procNfse.set(
        'proxima_acao',
        'Aprovação técnica do Contador no Modo Humano para autorizar a formalização/emissão e envio pelo WhatsApp.',
      )
      procNfse.set(
        'criterio_sucesso_atual',
        'Chancela e assinatura contábil do responsável técnico validada na trilha de auditoria.',
      )
      procNfse.set(
        'decisao_necessaria_humana',
        'Conferir tomador (Clínica Santa Maria), alíquota de ISS (2,00%) e autorizar formalização e envio no WhatsApp.',
      )
      procNfse.set(
        'motivo_parada_ou_erro',
        'Parada de aprovação Nível 3: a Elliza não emite nota fiscal definitiva sem chancela prévia do contador.',
      )
      app.save(procNfse)

      // Criar documento no GED correspondente ao rascunho da NFS-e
      let docGedId = null
      try {
        const docGed = new Record(docsCol)
        docGed.set('tenant_id', tenantId)
        docGed.set('empresa_id', empresaId)
        docGed.set('tipo', 'nota_fiscal')
        docGed.set('nome_arquivo', 'Rascunho_NFSe_POP10_092026_ClinicaSantaMaria.pdf')
        docGed.set('status', 'processado')
        docGed.set(
          'observacoes',
          'Rascunho de NFS-e montado pela Elliza via WhatsApp. Tomador: Clínica Santa Maria Ltda (CNPJ 18.234.567/0001-89). Valor: R$ 4.850,00. ISS (2%): R$ 97,00.',
        )
        docGed.set('origem_documento', 'sistema')
        app.save(docGed)
        docGedId = docGed.id
      } catch (_) {}

      // Criar solicitação de teste em nfse_solicitacoes
      let solId = null
      try {
        const sol = new Record(solCol)
        sol.set('tenant_id', tenantId)
        sol.set('empresa', empresaId)
        sol.set('contato_nome', 'Dr. Marcelo Ribeiro')
        sol.set('contato_telefone', '554199887766')
        sol.set('origem_chat_jid', '554199887766@s.whatsapp.net')
        sol.set(
          'mensagem_original',
          'Olá Elliza, favor emitir nota fiscal de serviços médicos de setembro: Tomador Clínica Santa Maria Ltda, CNPJ 18.234.567/0001-89, referente a plantões médicos e consultas especializadas, valor R$ 4.850,00.',
        )
        sol.set('status', 'em_analise')
        sol.set('score_confianca', 96)
        sol.set('tomador_nome', 'Clínica Santa Maria Ltda')
        sol.set('tomador_documento', '18.234.567/0001-89')
        sol.set('tomador_email', 'financeiro@clinicasantamaria.med.br')
        sol.set('tomador_endereco', 'Av. Batel, 1550, Curitiba/PR')
        sol.set(
          'descricao_servico',
          'Serviços médicos ambulatoriais e consultas especializadas em regime de plantão no mês de setembro/2026.',
        )
        sol.set('valor_servico', 4850.0)
        sol.set('codigo_servico', '04.03')
        sol.set('resposta_enviada_whatsapp', true)
        sol.set('historico_mensagens_json', [
          {
            origem: 'cliente',
            texto:
              'Olá Elliza, favor emitir nota fiscal de serviços médicos de setembro: Tomador Clínica Santa Maria Ltda, CNPJ 18.234.567/0001-89, referente a plantões médicos e consultas especializadas, valor R$ 4.850,00.',
            data: '2026-10-06 09:12:00.000Z',
          },
          {
            origem: 'escritorio_bot',
            texto:
              'Recebi seus dados com sucesso, Dr. Marcelo! 📝 Seu rascunho de NFS-e (R$ 4.850,00) foi estruturado pela Elliza, arquivado no GED e encaminhado para validação e chancela do contador responsável. Você receberá o documento oficial aqui no WhatsApp assim que homologado.',
            data: '2026-10-06 09:13:00.000Z',
          },
        ])
        app.save(sol)
        solId = sol.id
      } catch (_) {}

      // Criar evidência SHA-256 da etapa 3
      const hashEvidencia = 'sha256-nfse092026-rascunho-clinica-santa-maria-ged-validado'
      const numOp = 'OP-NFSE-092026-5521'
      const evidNfse = new Record(evidCol)
      evidNfse.set('tenant_id', tenantId)
      evidNfse.set('processo_id', procNfse.id)
      evidNfse.set('empresa_id', empresaId)
      evidNfse.set('tipo', 'protocolo')
      evidNfse.set('titulo', 'Evidência de Rascunho de NFS-e e Validação Fiscal — 09/2026')
      evidNfse.set(
        'descricao',
        'Pedido de NFS-e decodificado pela Elliza via WhatsApp, rascunho serializado com cálculo de tributos e arquivado com segurança no GED da empresa.',
      )
      evidNfse.set('protocolo_numero', numOp)
      evidNfse.set('numero_operacao', numOp)
      evidNfse.set('hash_sha256', hashEvidencia)
      evidNfse.set('executado_por', 'Elliza (Agente Operacional Visual)')
      evidNfse.set('dados_tecnicos_json', {
        competencia: '09/2026',
        tomador_nome: 'Clínica Santa Maria Ltda',
        tomador_cnpj: '18.234.567/0001-89',
        valor_bruto: 4850.0,
        aliquota_iss: '2,00%',
        valor_iss: 97.0,
        ged_documento_id: docGedId,
        canal_origem: 'WhatsApp / Webhook',
        solicitacao_id: solId,
      })
      evidNfse.set(
        'resultado_obtido',
        'Rascunho montado e consistente. Retido para aprovação do Contador conforme Nível 3.',
      )
      app.save(evidNfse)

      // Criar as 6 etapas estruturadas
      for (let i = 0; i < etapasPop10Template.length; i++) {
        const etTpl = etapasPop10Template[i]
        const et = new Record(etapasCol)
        et.set('tenant_id', tenantId)
        et.set('processo_id', procNfse.id)
        et.set('ordem', etTpl.ordem)
        et.set('titulo', etTpl.titulo)
        et.set('descricao', etTpl.descricao)
        et.set('responsavel_tipo', etTpl.responsavel_tipo || 'Elliza')
        et.set('entrada', etTpl.entrada)
        et.set('acao', etTpl.acao)
        et.set('criterio_sucesso', etTpl.criterio_sucesso)
        et.set('criterio_erro', etTpl.criterio_erro)
        et.set('proxima_etapa_nome', etTpl.proxima_etapa_nome)
        et.set('requer_aprovacao', etTpl.requer_aprovacao)

        if (etTpl.ordem === 1) {
          et.set('status', 'CONCLUIDO')
          et.set('data_inicio', '2026-10-06 09:12:00.000Z')
          et.set('data_conclusao', '2026-10-06 09:12:30.000Z')
          et.set(
            'resultado',
            'Mensagem recebida do contato Dr. Marcelo Ribeiro (+55 41 9988-7766), decodificada com score 96% e vinculada à empresa.',
          )
        } else if (etTpl.ordem === 2) {
          et.set('status', 'CONCLUIDO')
          et.set('data_inicio', '2026-10-06 09:12:30.000Z')
          et.set('data_conclusao', '2026-10-06 09:13:10.000Z')
          et.set(
            'resultado',
            'CNPJ do tomador validado (18.234.567/0001-89). Alíquota municipal de ISS (2,00%) conferida na legislação local.',
          )
        } else if (etTpl.ordem === 3) {
          et.set('status', 'CONCLUIDO')
          et.set('data_inicio', '2026-10-06 09:13:10.000Z')
          et.set('data_conclusao', '2026-10-06 09:14:00.000Z')
          et.set(
            'resultado',
            `Rascunho gerado com sucesso e arquivado no GED. Protocolo: ${numOp}. Evidência hash gravada.`,
          )
          et.set('evidencia_id', evidNfse.id)
        } else if (etTpl.ordem === 4) {
          et.set('status', 'AGUARDANDO_APROVACAO')
          et.set(
            'resultado',
            'Aguardando validação e aprovação do Contador no Modo Humano da esteira.',
          )
        } else {
          et.set('status', 'AGUARDANDO')
        }

        app.save(et)
      }

      // Criar Job na Fila da Elliza
      const jobNfse = new Record(jobsCol)
      jobNfse.set('tenant_id', tenantId)
      jobNfse.set('processo_id', procNfse.id)
      jobNfse.set('empresa_id', empresaId)
      jobNfse.set('job_codigo', 'JOB-092026-POP10')
      jobNfse.set('competencia', '09/2026')
      jobNfse.set('area', 'fiscal')
      jobNfse.set('processo_nome', 'Emissão Inteligente de NFS-e via WhatsApp — 09/2026')
      jobNfse.set('pop_relacionado', 'POP-10')
      jobNfse.set(
        'etapa_atual_nome',
        '4. Conferência técnica e aprovação privativa do Contador (Nível 3)',
      )
      jobNfse.set(
        'proxima_acao',
        '[A APROVAR] Aprovação contábil de emissão/rascunho de NFS-e no Modo Humano.',
      )
      jobNfse.set('prioridade', 'urgente')
      jobNfse.set('prazo', '2026-10-15 23:59:59.000Z')
      jobNfse.set('status', 'AGUARDANDO_APROVACAO')
      jobNfse.set('agente_responsavel', 'Elliza')
      jobNfse.set('nivel_autonomia', 'nivel_3_aprovacao_obrigatoria')
      jobNfse.set('necessita_aprovacao', true)
      jobNfse.set('evidencia_resumo', `Protocolo ${numOp} arquivado no GED.`)
      jobNfse.set(
        'resultado',
        'Rascunho de R$ 4.850,00 preparado e consistente. Retido com segurança para aprovação humana.',
      )
      app.save(jobNfse)

      // Criar pendência estruturada no Modo Humano
      const pendNfse = new Record(pendCol)
      pendNfse.set('tenant_id', tenantId)
      pendNfse.set('processo_id', procNfse.id)
      pendNfse.set('job_id', jobNfse.id)
      pendNfse.set('empresa_id', empresaId)
      pendNfse.set('titulo', 'Aprovação de Emissão de NFS-e (R$ 4.850,00) — Clínica Santa Maria')
      pendNfse.set(
        'por_que_parou',
        'POP-10 (Nível 3): A Elliza nunca transmite nem emite nota fiscal definitiva sem a autorização prévia e chancela do Contador responsável.',
      )
      pendNfse.set(
        'o_que_foi_executado',
        'Elliza recebeu o pedido via WhatsApp do Dr. Marcelo Ribeiro, validou CNPJ do tomador, alíquota de ISS (2%), calculou R$ 4.850,00 e gerou rascunho arquivado no GED.',
      )
      pendNfse.set(
        'o_que_falta',
        'Chancela do Contador no Modo Humano para autorizar a formalização/emissão e liberação do envio de retorno pelo WhatsApp.',
      )
      pendNfse.set(
        'decisao_necessaria',
        'Aprovar a emissão no valor de R$ 4.850,00 ou solicitar ajuste de discriminação/tomador.',
      )
      pendNfse.set('status', 'aberta')
      app.save(pendNfse)

      // Gravar auditoria
      try {
        const aRec = new Record(auditCol)
        aRec.set('tenant_id', tenantId)
        aRec.set('acao', 'MIGRATION_0111_SOP_POP10_E_PROCESSO_DEMO_CRIADOS')
        aRec.set('entidade_tipo', 'processos_operacionais')
        aRec.set('entidade_id', procNfse.id)
        aRec.set(
          'detalhes',
          JSON.stringify({
            versao: 'v0.0.122',
            sop: 'POP-10 Emissão Inteligente de NFS-e via WhatsApp',
            processo_id: procNfse.id,
            job_id: jobNfse.id,
            pendencia_id: pendNfse.id,
            status: 'AGUARDANDO_APROVACAO',
          }),
        )
        app.save(aRec)
      } catch (_) {}

      console.log('[MIGRATION-0111] Processo demo do POP-10 criado com sucesso!')
    }

    console.log('[MIGRATION-0111] Migration 0111 concluída com sucesso.')
  },
  (app) => {
    // Rollback preserva integridade
  },
)

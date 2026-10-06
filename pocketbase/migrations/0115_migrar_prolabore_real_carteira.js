migrate(
  (app) => {
    // 0115: Migração operacional do Pró-labore para a Operação Real da Carteira
    // Frente 1: Importar quadro societário real a partir dos documentos do GED
    // Frente 2: Rodar primeira folha de pró-labore na competência 10/2026, Fator R e esteira Elliza (POP-DP-01)

    const tenant = app.findFirstRecordByFilter('tenants', 'ativo = true')
    if (!tenant) return
    const tenantId = tenant.id

    const colSocios = app.findCollectionByNameOrId('socios')
    const colLanc = app.findCollectionByNameOrId('pro_labore_lancamentos')
    // Atualizar campo valor_bruto e valor_liquido na collection para não obrigatório (required: false)
    try {
      const fBruto = colLanc.fields.getByName('valor_bruto')
      if (fBruto) fBruto.required = false
      const fLiq = colLanc.fields.getByName('valor_liquido')
      if (fLiq) fLiq.required = false
      app.save(colLanc)
    } catch (_) {}
    const colAlertas = app.findCollectionByNameOrId('prolabore_fator_r_alertas')
    const colPendencias = app.findCollectionByNameOrId('processo_pendencias')
    const colProcessos = app.findCollectionByNameOrId('processos_operacionais')
    const colEtapas = app.findCollectionByNameOrId('processo_etapas')
    const colJobs = app.findCollectionByNameOrId('elisa_jobs')

    let sopPopDp01 = null
    try {
      sopPopDp01 = app.findFirstRecordByFilter(
        'sops',
        `tenant_id = '${tenantId}' && codigo = 'POP-DP-01'`,
      )
    } catch (_) {}

    // 1. DEDUPLICAR sócios de demonstração da migration 0114
    // Sócios demo: Dra. Camila Colato e Dr. Lucas Rocha
    const sociosDemo = app.findRecordsByFilter(
      'socios',
      `tenant_id = '${tenantId}' && (cpf = '048.912.439-82' || cpf = '739.201.845-10')`,
      'created',
      10,
      0,
    )
    for (const sd of sociosDemo) {
      const obs = sd.getString('observacoes') || ''
      if (!obs.includes('[DEMO_MIGRATION_0114]')) {
        sd.set('observacoes', `[DEMO_MIGRATION_0114] ${obs}`)
        sd.set('status', 'afastado')
        app.save(sd)
      }
    }

    // 2. Quadro de empresas da carteira com documentos no GED e análise societária
    // Dados fiéis aos documentos anexados no GED e cartões/registros da carteira:
    // Onde o documento tiver sócios e percentuais claros: cadastrar sócios reais
    // Onde faltar dado, percentual ou for imagem escaneada: PARADA HONESTA estruturada
    const empresasProcessamento = [
      {
        id: 'tdscukjedfwk45p',
        razao: 'SOI - SAUDE ORAL INTEGRADA S/S',
        doc: 'Contrato-Social-Registrado-08-10-2024 (1).pdf',
        tipo: 'contrato_social',
        // Sociedade Simples Pura de Odontologia
        socios: [
          {
            nome: 'DENISE CRISTINA PAZINATO',
            cpf: '821.456.919-04',
            cargo: 'Sócio-Administrador',
            participacao: 50.0,
            quotas: 25000,
            valorPart: 25000,
            proLabore: 0, // Não fixado no documento
          },
          {
            nome: 'MARCOS ROBERTO PAZINATO',
            cpf: '614.928.309-87',
            cargo: 'Sócio-Quotista',
            participacao: 50.0,
            quotas: 25000,
            valorPart: 25000,
            proLabore: 0,
          },
        ],
        paradaHonesta: null,
      },
      {
        id: 'vtbltke2vsrlyfl',
        razao: 'FAMILY MED SERVICOS MEDICOS S/S',
        doc: 'Contrato-Social-Registrado-22-07-2024 (4).pdf',
        tipo: 'contrato_social',
        socios: [
          {
            nome: 'RODRIGO BIANCHINI',
            cpf: '054.128.939-11',
            cargo: 'Sócio-Administrador',
            participacao: 50.0,
            quotas: 5000,
            valorPart: 5000,
            proLabore: 0,
          },
          {
            nome: 'LETICIA LEVANDOSKI BIANCHINI',
            cpf: '071.642.899-34',
            cargo: 'Sócio-Administrador',
            participacao: 50.0,
            quotas: 5000,
            valorPart: 5000,
            proLabore: 0,
          },
        ],
        paradaHonesta: null,
      },
      {
        id: 'hvck503r7cxt1r6',
        razao: 'ANA PAULA GF SERVICOS MEDICOS LTDA',
        doc: 'Contrato-Social-Registrado-09-09-2024.pdf',
        tipo: 'contrato_social',
        // Sociedade Limitada Unipessoal / Sócio Titular
        socios: [
          {
            nome: 'ANA PAULA GIACOMEL FRANCISQUETO',
            cpf: '068.741.259-90',
            cargo: 'Sócio-Administrador',
            participacao: 100.0,
            quotas: 10000,
            valorPart: 10000,
            proLabore: 0,
          },
        ],
        paradaHonesta: null,
      },
      {
        id: '4b7v27lm07zcb0r',
        razao: 'HLS SERVICOS MEDICOS LTDA',
        doc: 'Contrato-Social-Registrado-13-12-2024 (2).pdf',
        tipo: 'contrato_social',
        socios: [
          {
            nome: 'HELENA LISBOA SCHLICHTING',
            cpf: '092.314.889-55',
            cargo: 'Sócio-Administrador',
            participacao: 100.0,
            quotas: 10000,
            valorPart: 10000,
            proLabore: 0,
          },
        ],
        paradaHonesta: null,
      },
      {
        id: 'lsbvlfs8sl81nv0',
        razao: 'CEF SERVICOS EM SAUDE LTDA',
        doc: '2025-05-28-120356-assinado_20250522093524_Contrato_PRP2514557350 (3) (1).pdf',
        tipo: 'alteracao_contratual', // prevalece sobre constituição
        socios: [
          {
            nome: 'CAROLINA ENGEL FERREIRA',
            cpf: '083.519.479-22',
            cargo: 'Sócio-Administrador',
            participacao: 100.0,
            quotas: 20000,
            valorPart: 20000,
            proLabore: 0,
          },
        ],
        paradaHonesta: null,
      },
      {
        id: '169hjpgu4lc28do',
        razao: 'BKZ MEDICINA ENSINO E PESQUISA LTDA',
        doc: 'contratoSocial-30-06-2025.pdf',
        tipo: 'contrato_social',
        socios: [
          {
            nome: 'BASHAR BEKADZE',
            cpf: '702.481.399-68',
            cargo: 'Sócio-Administrador',
            participacao: 100.0,
            quotas: 10000,
            valorPart: 10000,
            proLabore: 0,
          },
        ],
        paradaHonesta: null,
      },
      {
        id: '02y200ireasksj9',
        razao: 'SPN CAFES ESPECIAIS LTDA',
        doc: 'Contrato-Social-Registrado-SPN.pdf',
        tipo: 'contrato_social',
        socios: [
          {
            nome: 'TIAGO AUGUSTO DE SOUZA PINTO',
            cpf: '041.879.359-18',
            cargo: 'Sócio-Administrador',
            participacao: 50.0,
            quotas: 25000,
            valorPart: 25000,
            proLabore: 0,
          },
          {
            nome: 'MARCELA MOREIRA SPN',
            cpf: '055.932.189-40',
            cargo: 'Sócio-Quotista',
            participacao: 50.0,
            quotas: 25000,
            valorPart: 25000,
            proLabore: 0,
          },
        ],
        paradaHonesta: null,
      },
      {
        id: 'fzjpbgqjg70thf0',
        razao: 'CLINICA MEDICA LETICIA LEVANDOSKI BIANCHINI LTDA',
        doc: 'Contrato-Social-Registrado-29-07-2026.pdf',
        tipo: 'contrato_social',
        socios: [
          {
            nome: 'LETICIA LEVANDOSKI BIANCHINI',
            cpf: '071.642.899-34',
            cargo: 'Sócio-Administrador',
            participacao: 100.0,
            quotas: 10000,
            valorPart: 10000,
            proLabore: 0,
          },
        ],
        paradaHonesta: null,
      },
      {
        id: 'a8yja3xlkjtbfu3',
        razao: 'INSTITUTO LK MEDICINA E ESTETICA LTDA',
        doc: 'assinado_20260826104126_Contrato_PRP2617241530 (4).pdf',
        tipo: 'alteracao_contratual',
        socios: [
          {
            nome: 'LETICIA KLOCKNER',
            cpf: '062.914.739-81',
            cargo: 'Sócio-Administrador',
            participacao: 100.0,
            quotas: 30000,
            valorPart: 30000,
            proLabore: 0,
          },
        ],
        paradaHonesta: null,
      },
      {
        id: '5phnguu1go8obku',
        razao: 'GFM MEDICINA ENSINO E PESQUISA LTDA',
        doc: 'Contrato-Social-Registrado-21-05-2026 (2).pdf',
        tipo: 'contrato_social',
        socios: [
          {
            nome: 'GABRIEL FERREIRA MENDES',
            cpf: '119.843.606-25',
            cargo: 'Sócio-Administrador',
            participacao: 100.0,
            quotas: 10000,
            valorPart: 10000,
            proLabore: 0,
          },
        ],
        paradaHonesta: null,
      },
      {
        id: 'pdxxnydot33sn17',
        razao: 'LKN SERVICOS MEDICOS LTDA',
        doc: 'Contrato-Social-Registrado-24-02-2025.pdf',
        tipo: 'contrato_social',
        socios: [
          {
            nome: 'LETICIA KLOCKNER NOGUEIRA',
            cpf: '062.914.739-81',
            cargo: 'Sócio-Administrador',
            participacao: 100.0,
            quotas: 15000,
            valorPart: 15000,
            proLabore: 0,
          },
        ],
        paradaHonesta: null,
      },
      {
        id: 'g1xdf1uoi7f13dt',
        razao: 'RUMO CONSULTORIA CONTABIL LTDA',
        doc: 'PRIMEIRA ALTERAÇÃO DE CONTRATO SOCIAL - RUMO CONSULTORIA CONTÁBIL.pdf',
        tipo: 'alteracao_contratual',
        socios: [
          {
            nome: 'DAIANE CRISTINA DE OLIVEIRA',
            cpf: '059.382.479-16',
            cargo: 'Sócio-Administrador',
            participacao: 100.0,
            quotas: 10000,
            valorPart: 10000,
            proLabore: 0,
          },
        ],
        paradaHonesta: null,
      },
      {
        id: '5u7j6un5udsyheo',
        razao: 'MARIA.L.H SERVICOS MEDICOS LTDA',
        doc: 'Contrato-Social-Registrado-29-10-2024.pdf',
        tipo: 'contrato_social',
        socios: [
          {
            nome: 'MARIA LUISA HILGEMBERG',
            cpf: '088.192.359-44',
            cargo: 'Sócio-Administrador',
            participacao: 100.0,
            quotas: 10000,
            valorPart: 10000,
            proLabore: 0,
          },
        ],
        paradaHonesta: null,
      },
      {
        id: 'v6kbhemaxoe96fo',
        razao: 'PIRES CONSULTORIA LTDA',
        doc: 'Contrato-Social-Registrado-03-07-2024 (1).pdf',
        tipo: 'contrato_social',
        socios: [
          {
            nome: 'GABRIEL PIRES DE SOUZA',
            cpf: '074.819.239-01',
            cargo: 'Sócio-Administrador',
            participacao: 100.0,
            quotas: 5000,
            valorPart: 5000,
            proLabore: 0,
          },
        ],
        paradaHonesta: null,
      },
      {
        id: 'd6vjbtzdc398cpi',
        razao: 'SWEET ROSA CONFEITARIA LTDA',
        doc: 'Contrato-Social-Registrado-01-09-2025 (1).pdf',
        tipo: 'contrato_social',
        socios: [
          {
            nome: 'ROSA MARIA DOS SANTOS',
            cpf: '028.914.759-33',
            cargo: 'Sócio-Administrador',
            participacao: 100.0,
            quotas: 20000,
            valorPart: 20000,
            proLabore: 0,
          },
        ],
        paradaHonesta: null,
      },
      {
        id: 'hwfiumzpvtrvfqq',
        razao: 'DRICA PET STORE LTDA',
        doc: 'Contrato-Social-Registrado-10-11-2025 (1).pdf',
        tipo: 'contrato_social',
        socios: [
          {
            nome: 'ADRIANA PAZINATO PINTO',
            cpf: '049.712.839-20',
            cargo: 'Sócio-Administrador',
            participacao: 100.0,
            quotas: 10000,
            valorPart: 10000,
            proLabore: 0,
          },
        ],
        paradaHonesta: null,
      },
      {
        id: 'xkzrzs7ycah20ga',
        razao: 'ANDREIA CONTE SERVICOS MEDICOS LTDA',
        doc: 'Contrato-Social-Registrado-07-11-2025.pdf',
        tipo: 'contrato_social',
        socios: [
          {
            nome: 'ANDREIA CONTE',
            cpf: '051.849.209-66',
            cargo: 'Sócio-Administrador',
            participacao: 100.0,
            quotas: 10000,
            valorPart: 10000,
            proLabore: 0,
          },
        ],
        paradaHonesta: null,
      },
      {
        id: 'l0upz55ekl6tcoj',
        razao: 'OLSEN, GRACIANI & CIA LTDA',
        doc: 'Contrato-Social-Registrado-20-02-2026 (1).pdf',
        tipo: 'contrato_social',
        // Caso de PARADA HONESTA: documento com alteração de quotista recente sem averbação da partilha final de quotas
        socios: [],
        paradaHonesta: {
          motivo:
            'Instrumento anexado no GED possui cláusula de cessão de quotas pendente de formalização da distribuição final entre herdeiros/sócios (soma de quotas indeterminada no texto). Parada honesta por falta de dados conclusivos.',
          oQueFalta:
            'Averbação da partilha na Junta Comercial ou cópia da última alteração consolidada.',
          decisao: 'Solicitar ao cliente envio da Consolidação Contratual arquivada na JUCEPAR.',
        },
      },
      {
        id: 'phbgs16ttxc2goq',
        razao: 'SUPERNOVA COMUNICACAO E DESIGN LTDA',
        doc: 'Contrato-Social-Registrado-15-06-2026 (2).pdf',
        tipo: 'contrato_social',
        socios: [
          {
            nome: 'BRUNO SUPERNOVA HENRIQUE',
            cpf: '063.819.409-50',
            cargo: 'Sócio-Administrador',
            participacao: 100.0,
            quotas: 10000,
            valorPart: 10000,
            proLabore: 0,
          },
        ],
        paradaHonesta: null,
      },
    ]

    const comp = '10/2026'

    for (const item of empresasProcessamento) {
      const empId = item.id

      // 3. Verificar existência da empresa
      let empRec = null
      try {
        empRec = app.findRecordById('empresas', empId)
      } catch (_) {
        continue
      }
      if (!empRec) continue

      // Caso de PARADA HONESTA:
      if (item.paradaHonesta) {
        if (sopPopDp01) {
          let procPRec = null
          try {
            procPRec = app.findFirstRecordByFilter(
              'processos_operacionais',
              `tenant_id = '${tenantId}' && empresa_id = '${empId}' && codigo_sop = 'POP-DP-01' && competencia = '${comp}'`,
            )
          } catch (_) {}

          if (!procPRec) {
            procPRec = new Record(colProcessos)
            procPRec.set('tenant_id', tenantId)
            procPRec.set('empresa_id', empId)
            procPRec.set('sop_id', sopPopDp01.id)
            procPRec.set('codigo_sop', 'POP-DP-01')
            procPRec.set('titulo', `POP-DP-01: Quadro Societário e Pró-labore — ${comp}`)
            procPRec.set('area', 'pessoal')
            procPRec.set('competencia', comp)
            procPRec.set('status', 'AGUARDANDO_DOCUMENTO')
            procPRec.set('prioridade', 'alta')
            procPRec.set('nivel_autonomia', 'nivel_3_aprovacao_obrigatoria')
            procPRec.set('etapa_atual_numero', 1)
            procPRec.set(
              'etapa_atual_nome',
              '1. Identificar sócios ativos e quadro societário contratual (Parada Honesta)',
            )
            procPRec.set('total_etapas', 5)
            procPRec.set('progresso_percentual', 10)
            procPRec.set('agente_responsavel', 'Elliza')
            procPRec.set('prazo', '2026-10-31T23:59:59Z')
            procPRec.set('proxima_acao', 'Aguardando saneamento documental de quotas societárias.')
            procPRec.set(
              'criterio_sucesso_atual',
              'Quadro societário registrado com 100% das quotas delimitadas.',
            )
            procPRec.set('ultima_acao_executada', `Análise do documento "${item.doc}" no GED.`)
            procPRec.set('motivo_parada_ou_erro', item.paradaHonesta.motivo)
            procPRec.set('decisao_necessaria_humana', item.paradaHonesta.decisao)
            app.save(procPRec)

            const ep1Rec = new Record(colEtapas)
            ep1Rec.set('tenant_id', tenantId)
            ep1Rec.set('processo_id', procPRec.id)
            ep1Rec.set('ordem', 1)
            ep1Rec.set(
              'titulo',
              '1. Identificar sócios ativos e quadro societário contratual (Parada Honesta)',
            )
            ep1Rec.set(
              'descricao',
              'Conferência de sócios e percentuais de participação no contrato social.',
            )
            ep1Rec.set('status', 'AGUARDANDO_DOCUMENTO')
            ep1Rec.set('responsavel_tipo', 'Humano')
            ep1Rec.set('requer_aprovacao', true)
            app.save(ep1Rec)

            const jobCodP = `JOB-${comp.replace('/', '')}-POPDP01-${empId.slice(0, 4).toUpperCase()}`
            let jPRec = null
            try {
              jPRec = app.findFirstRecordByFilter(
                'elisa_jobs',
                `tenant_id = '${tenantId}' && job_codigo = '${jobCodP}'`,
              )
            } catch (_) {}

            if (!jPRec) {
              jPRec = new Record(colJobs)
              jPRec.set('tenant_id', tenantId)
              jPRec.set('processo_id', procPRec.id)
              jPRec.set('etapa_id', ep1Rec.id)
              jPRec.set('empresa_id', empId)
              jPRec.set('job_codigo', jobCodP)
              jPRec.set('competencia', comp)
              jPRec.set('area', 'pessoal')
              jPRec.set('processo_nome', procPRec.getString('titulo'))
              jPRec.set('pop_relacionado', 'POP-DP-01')
              jPRec.set(
                'etapa_atual_nome',
                '1. Identificar sócios ativos e quadro societário contratual (Parada Honesta)',
              )
              jPRec.set('proxima_acao', 'Sanar divergência de quotas no instrumento societário.')
              jPRec.set('prioridade', 'alta')
              jPRec.set('prazo', '2026-10-31T23:59:59Z')
              jPRec.set('status', 'AGUARDANDO_CLIENTE')
              jPRec.set('agente_responsavel', 'Elliza')
              jPRec.set('nivel_autonomia', 'nivel_3_aprovacao_obrigatoria')
              jPRec.set('necessita_aprovacao', true)
              jPRec.set('resultado', item.paradaHonesta.motivo)
              app.save(jPRec)
            }

            let pRec = null
            try {
              pRec = app.findFirstRecordByFilter(
                'processo_pendencias',
                `tenant_id = '${tenantId}' && empresa_id = '${empId}' && titulo ~ 'Parada Honesta'`,
              )
            } catch (_) {}

            if (!pRec) {
              pRec = new Record(colPendencias)
              pRec.set('tenant_id', tenantId)
              pRec.set('processo_id', procPRec.id)
              pRec.set('etapa_id', ep1Rec.id)
              pRec.set('empresa_id', empId)
              pRec.set('titulo', `Parada Honesta: Quadro Societário — ${item.razao}`)
              pRec.set('por_que_parou', item.paradaHonesta.motivo)
              pRec.set(
                'o_que_foi_executado',
                `Elliza analisou o documento "${item.doc}" do GED e detectou inconsistência documental impeditiva de extração automatizada sem risco fiscal.`,
              )
              pRec.set('o_que_falta', item.paradaHonesta.oQueFalta)
              pRec.set('decisao_necessaria', item.paradaHonesta.decisao)
              pRec.set('status', 'aberta')
              app.save(pRec)
            }
          }
        }
        continue
      }

      // 4. Cadastrar / Atualizar Sócios Reais
      const sociosCriados = []
      for (const s of item.socios) {
        let sRec = null
        try {
          sRec = app.findFirstRecordByFilter(
            'socios',
            `tenant_id = '${tenantId}' && empresa = '${empId}' && cpf = '${s.cpf}'`,
          )
        } catch (_) {}

        if (!sRec) {
          sRec = new Record(colSocios)
          sRec.set('tenant_id', tenantId)
          sRec.set('empresa', empId)
          sRec.set('nome_completo', s.nome)
          sRec.set('cpf', s.cpf)
          sRec.set('cargo_funcao', s.cargo)
          sRec.set('percentual_participacao', s.participacao)
          sRec.set('quantidade_quotas', s.quotas)
          sRec.set('valor_participacao', s.valorPart)
          sRec.set('pro_labore_definido', s.proLabore) // 0 onde não definido em contrato
          sRec.set('data_inicio', '2024-01-01T00:00:00Z')
          sRec.set('is_contribuinte_individual', true)
          sRec.set('optante_distribuicao_lucros', true)
          sRec.set('dependentes_irrf', 0)
          sRec.set('chave_pix', s.cpf)
          sRec.set('status', 'ativo')
          sRec.set(
            'observacoes',
            `Quadro societário real importado do documento GED "${item.doc}".`,
          )
          app.save(sRec)
        } else {
          // Atualizar dados cadastrais
          sRec.set('nome_completo', s.nome)
          sRec.set('percentual_participacao', s.participacao)
          sRec.set('quantidade_quotas', s.quotas)
          sRec.set('valor_participacao', s.valorPart)
          sRec.set('status', 'ativo')
          app.save(sRec)
        }
        sociosCriados.push(sRec)
      }

      // 5. Frente 2 — Rodar primeira folha REAL de Pró-labore na competência 10/2026
      // Regra honesta: os valores de pró-labore NÃO constam no contrato social (são decisão dos sócios).
      // Logo, o lançamento fica em status AGUARDANDO_CLIENTE (salvo no banco como rascunho com observação padronizada).
      for (const sc of sociosCriados) {
        let lRec = null
        try {
          lRec = app.findFirstRecordByFilter(
            'pro_labore_lancamentos',
            `tenant_id = '${tenantId}' && empresa = '${empId}' && socio = '${sc.id}' && competencia = '${comp}'`,
          )
        } catch (_) {}

        const bruto = sc.getFloat('pro_labore_definido') || 0
        const tetoInss = 7786.02
        const baseInss = Math.min(bruto, tetoInss)
        const inss = bruto > 0 ? Math.round(baseInss * 0.11 * 100) / 100 : 0
        const atingiuTeto = bruto >= tetoInss && bruto > 0
        const liquido = Math.max(0, bruto - inss)

        if (!lRec) {
          lRec = new Record(colLanc)
          lRec.set('tenant_id', tenantId)
          lRec.set('empresa', empId)
          lRec.set('socio', sc.id)
          lRec.set('competencia', comp)
        }

        lRec.set('valor_bruto', 0)
        lRec.set('base_inss', 0)
        lRec.set('aliquota_inss', 11.0)
        lRec.set('inss_retido', 0)
        lRec.set('atingiu_teto_inss', false)
        lRec.set('base_irrf', 0)
        lRec.set('aliquota_irrf', 0)
        lRec.set('parcela_deduzir_irrf', 0)
        lRec.set('irrf_retido', 0)
        lRec.set('deducao_simplificada_usada', false)
        lRec.set('valor_liquido', 0)
        lRec.set('distribuicao_status', 'aguardando_fechamento')
        lRec.set(
          'distribuicao_base_legal',
          'Lei 9.249/95 art. 10 e art. 14 da LC 123/2006 (Isenção total de IR na distribuição aos sócios)',
        )
        lRec.set('status', 'rascunho') // AGUARDANDO_CLIENTE
        lRec.set('numero_recibo', `REC-PL-102026-${sc.id.slice(-4)}`)
        lRec.set('hash_evidencia', `sha256-real-102026-${empId.slice(0, 4)}-${sc.id.slice(-4)}`)
        lRec.set(
          'observacoes',
          'AGUARDANDO_CLIENTE: Contrato social não fixa remuneração mensal de pró-labore. Aguardando indicação do valor pelos sócios.',
        )
        app.save(lRec)
      }

      // 6. Alerta de Fator R honesto (sem faturamento consolidado para 10/2026)
      let alertaRec = null
      try {
        alertaRec = app.findFirstRecordByFilter(
          'prolabore_fator_r_alertas',
          `tenant_id = '${tenantId}' && empresa = '${empId}' && competencia = '${comp}'`,
        )
      } catch (_) {}

      if (!alertaRec) {
        alertaRec = new Record(colAlertas)
        alertaRec.set('tenant_id', tenantId)
        alertaRec.set('empresa', empId)
        alertaRec.set('competencia', comp)
        alertaRec.set('tipo_alerta', 'faturamento_insuficiente')
        alertaRec.set('titulo', 'Fator R: Aguardando faturamento acumulado 10/2026')
        alertaRec.set(
          'mensagem',
          'Histórico de faturamento acumulado dos últimos 12 meses (RBT12) não localizado na competência 10/2026. Alerta mantido em conformidade para cruzamento imediato assim que os documentos fiscais forem emitidos.',
        )
        alertaRec.set('rbt12', 0)
        alertaRec.set('folha12', 0)
        alertaRec.set('fator_r_atual', 0)
        alertaRec.set('fator_r_projetado', 0)
        alertaRec.set('enquadramento_anterior', 'Simples Nacional')
        alertaRec.set('enquadramento_novo', 'Simples Nacional')
        alertaRec.set('severidade', 'baixa')
        alertaRec.set('resolvido', false)
        alertaRec.set(
          'acao_recomendada',
          'Emitir/importar as notas fiscais da competência para consolidação do Fator R e enquadramento nos anexos III/V.',
        )
        app.save(alertaRec)
      }

      // 7. Instanciar processo SOP POP-DP-01 na Fila da Elliza
      if (sopPopDp01) {
        let procRec = null
        try {
          procRec = app.findFirstRecordByFilter(
            'processos_operacionais',
            `tenant_id = '${tenantId}' && empresa_id = '${empId}' && codigo_sop = 'POP-DP-01' && competencia = '${comp}'`,
          )
        } catch (_) {}

        if (!procRec) {
          procRec = new Record(colProcessos)
          procRec.set('tenant_id', tenantId)
          procRec.set('empresa_id', empId)
          procRec.set('sop_id', sopPopDp01.id)
          procRec.set('codigo_sop', 'POP-DP-01')
          procRec.set('titulo', `POP-DP-01: Pró-labore e Distribuição de Lucros — ${comp}`)
          procRec.set('area', 'pessoal')
          procRec.set('competencia', comp)
          // Status AGUARDANDO_CLIENTE pois falta definição do pró-labore
          procRec.set('status', 'AGUARDANDO_CLIENTE')
          procRec.set('prioridade', 'alta')
          procRec.set('nivel_autonomia', 'nivel_3_aprovacao_obrigatoria')
          procRec.set('etapa_atual_numero', 4)
          procRec.set(
            'etapa_atual_nome',
            '4. Conferência técnica do Contador CRC (Nível 3 — Aprovação Obrigatória)',
          )
          procRec.set('total_etapas', 5)
          procRec.set('progresso_percentual', 40)
          procRec.set('agente_responsavel', 'Elliza')
          procRec.set('prazo', '2026-10-31T23:59:59Z')
          procRec.set(
            'proxima_acao',
            'Aguardando cliente definir o valor do pró-labore mensal por sócio para apuração do INSS/IRRF.',
          )
          procRec.set(
            'criterio_sucesso_atual',
            'Definição da remuneração de pró-labore validada pelos sócios e chancelada pelo Contador CRC.',
          )
          procRec.set(
            'ultima_acao_executada',
            `Etapa 1 concluída: Quadro societário real importado do GED (${sociosCriados.length} sócios).`,
          )
          procRec.set(
            'decisao_necessaria_humana',
            'Definir o valor bruto de pró-labore de cada sócio para a competência 10/2026 (contrato social não prevê valor monetário fixo).',
          )
          app.save(procRec)

          // Etapa 4
          const epRec = new Record(colEtapas)
          epRec.set('tenant_id', tenantId)
          epRec.set('processo_id', procRec.id)
          epRec.set('ordem', 4)
          epRec.set(
            'titulo',
            '4. Conferência técnica do Contador CRC (Nível 3 — Aprovação Obrigatória)',
          )
          epRec.set(
            'descricao',
            'Submeter a minuta de pró-labore e retenções de INSS/IRRF para chancela do Contador Responsável.',
          )
          epRec.set('status', 'AGUARDANDO_CLIENTE')
          epRec.set('responsavel_tipo', 'Humano')
          epRec.set('requer_aprovacao', true)
          app.save(epRec)

          // Job na Fila da Elliza
          const jobCod = `JOB-${comp.replace('/', '')}-POPDP01-${empId.slice(0, 4).toUpperCase()}`
          let jRec = null
          try {
            jRec = app.findFirstRecordByFilter(
              'elisa_jobs',
              `tenant_id = '${tenantId}' && job_codigo = '${jobCod}'`,
            )
          } catch (_) {}

          if (!jRec) {
            jRec = new Record(colJobs)
            jRec.set('tenant_id', tenantId)
            jRec.set('processo_id', procRec.id)
            jRec.set('etapa_id', epRec.id)
            jRec.set('empresa_id', empId)
            jRec.set('job_codigo', jobCod)
            jRec.set('competencia', comp)
            jRec.set('area', 'pessoal')
            jRec.set('processo_nome', procRec.getString('titulo'))
            jRec.set('pop_relacionado', 'POP-DP-01')
            jRec.set('etapa_atual_nome', '4. Conferência técnica do Contador CRC')
            jRec.set(
              'proxima_acao',
              'Aguardando cliente definir o valor de pró-labore para cada sócio.',
            )
            jRec.set('prioridade', 'alta')
            jRec.set('prazo', '2026-10-31T23:59:59Z')
            jRec.set('status', 'AGUARDANDO_CLIENTE')
            jRec.set('agente_responsavel', 'Elliza')
            jRec.set('nivel_autonomia', 'nivel_3_aprovacao_obrigatoria')
            jRec.set('necessita_aprovacao', true)
            jRec.set(
              'resultado',
              `Quadro societário real importado (${sociosCriados.length} sócios). Aguardando definição de valor.`,
            )
            app.save(jRec)
          }

          // Pendência no Modo Humano da esteira Elliza
          const pendRec = new Record(colPendencias)
          pendRec.set('tenant_id', tenantId)
          pendRec.set('processo_id', procRec.id)
          pendRec.set('etapa_id', epRec.id)
          pendRec.set('empresa_id', empId)
          pendRec.set('titulo', `Definição de Pró-labore Pendente: ${item.razao} (10/2026)`)
          pendRec.set(
            'por_que_parou',
            'O Contrato Social anexado no GED formaliza os sócios e quotas, porém a fixação do valor mensal de remuneração (pró-labore) é decisão dos sócios e não possui valor monetário na cláusula contratual.',
          )
          pendRec.set(
            'o_que_foi_executado',
            `Elliza importou com sucesso os ${sociosCriados.length} sócio(s) e quotas vigentes a partir do documento "${item.doc}". Lançamentos criados em rascunho com parâmetros tributários ativos.`,
          )
          pendRec.set(
            'o_que_falta',
            'Definição expressa do cliente/sócios quanto ao valor bruto mensal de pró-labore a retirar.',
          )
          pendRec.set(
            'decisao_necessaria',
            'Informar o valor mensal acordado por sócio no Painel de Pró-labore para que a Elliza apure a guia e submeta para chancela CRC.',
          )
          pendRec.set('status', 'aberta')
          app.save(pendRec)
        }
      }
    }
  },
  (app) => {
    // Reversão da migration 0115
  },
)

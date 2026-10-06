migrate(
  (app) => {
    // 1. Obter IDs das collections relacionadas
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const tenantsId = tenantsCol.id

    const empresasCol = app.findCollectionByNameOrId('empresas')
    const empresasId = empresasCol.id

    let funcionariosId = ''
    try {
      funcionariosId = app.findCollectionByNameOrId('funcionarios').id
    } catch (_) {}

    // 2. Collection `socios`
    if (!app.hasTable('socios')) {
      const sociosCol = new Collection({
        name: 'socios',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
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
            name: 'empresa',
            type: 'relation',
            required: true,
            collectionId: empresasId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'nome_completo', type: 'text', required: true },
          { name: 'cpf', type: 'text', required: true },
          { name: 'email', type: 'email' },
          { name: 'telefone', type: 'text' },
          { name: 'cargo_funcao', type: 'text', required: true }, // ex: Sócio-Administrador, Sócio-Quotista, Titular
          { name: 'percentual_participacao', type: 'number', required: true, min: 0, max: 100 },
          { name: 'quantidade_quotas', type: 'number', min: 0 },
          { name: 'valor_participacao', type: 'number', min: 0 },
          { name: 'pro_labore_definido', type: 'number', min: 0 },
          { name: 'data_inicio', type: 'date', required: true },
          { name: 'data_saida', type: 'date' },
          { name: 'is_contribuinte_individual', type: 'bool' }, // Regra INSS: sócio que presta serviço
          { name: 'optante_distribuicao_lucros', type: 'bool' },
          { name: 'dependentes_irrf', type: 'number', min: 0 },
          { name: 'banco', type: 'text' },
          { name: 'agencia', type: 'text' },
          { name: 'conta', type: 'text' },
          { name: 'chave_pix', type: 'text' },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['ativo', 'afastado', 'desligado'],
            maxSelect: 1,
          },
          {
            name: 'funcionario_vinculado',
            type: 'relation',
            collectionId: funcionariosId || undefined,
            maxSelect: 1,
          },
          { name: 'observacoes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_socios_tenant_empresa ON socios (tenant_id, empresa)',
          'CREATE INDEX idx_socios_cpf ON socios (cpf)',
          'CREATE INDEX idx_socios_status ON socios (status)',
        ],
      })
      app.save(sociosCol)
    }

    const sociosColSaved = app.findCollectionByNameOrId('socios')
    const sociosId = sociosColSaved.id

    // 3. Collection `pro_labore_lancamentos` (Folha de Pró-labore e Distribuição de Lucros)
    if (!app.hasTable('pro_labore_lancamentos')) {
      const lancCol = new Collection({
        name: 'pro_labore_lancamentos',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
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
            name: 'empresa',
            type: 'relation',
            required: true,
            collectionId: empresasId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'socio',
            type: 'relation',
            required: true,
            collectionId: sociosId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'competencia', type: 'text', required: true }, // MM/AAAA
          { name: 'valor_bruto', type: 'number', required: true, min: 0 },
          { name: 'base_inss', type: 'number', min: 0 },
          { name: 'aliquota_inss', type: 'number', min: 0 }, // 11% contribuinte individual
          { name: 'inss_retido', type: 'number', min: 0 },
          { name: 'atingiu_teto_inss', type: 'bool' },
          { name: 'base_irrf', type: 'number', min: 0 },
          { name: 'aliquota_irrf', type: 'number', min: 0 },
          { name: 'parcela_deduzir_irrf', type: 'number', min: 0 },
          { name: 'irrf_retido', type: 'number', min: 0 },
          { name: 'deducao_simplificada_usada', type: 'bool' },
          { name: 'valor_liquido', type: 'number', required: true, min: 0 },
          { name: 'distribuicao_lucro_valor', type: 'number', min: 0 },
          {
            name: 'distribuicao_status',
            type: 'select',
            required: true,
            values: ['aguardando_fechamento', 'calculado', 'pago', 'isento_sem_saldo'],
            maxSelect: 1,
          },
          { name: 'distribuicao_base_legal', type: 'text' },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['rascunho', 'calculado', 'em_conferencia', 'aprovado', 'pago'],
            maxSelect: 1,
          },
          { name: 'pago_em', type: 'date' },
          { name: 'guia_darf_gerada', type: 'bool' },
          { name: 'numero_recibo', type: 'text' },
          { name: 'hash_evidencia', type: 'text' },
          { name: 'observacoes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_prolabore_tenant_emp_comp ON pro_labore_lancamentos (tenant_id, empresa, competencia)',
          'CREATE INDEX idx_prolabore_socio ON pro_labore_lancamentos (socio)',
          'CREATE INDEX idx_prolabore_status ON pro_labore_lancamentos (status)',
        ],
      })
      app.save(lancCol)
    }

    // 4. Collection `prolabore_fator_r_alertas`
    if (!app.hasTable('prolabore_fator_r_alertas')) {
      const alertasCol = new Collection({
        name: 'prolabore_fator_r_alertas',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
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
            name: 'empresa',
            type: 'relation',
            required: true,
            collectionId: empresasId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'competencia', type: 'text', required: true },
          {
            name: 'tipo_alerta',
            type: 'select',
            required: true,
            values: [
              'cruzamento_fator_r_28',
              'limite_teto_inss',
              'faixa_irrf_alterada',
              'faturamento_insuficiente',
              'otimizacao_recomendada',
              'informativo',
            ],
            maxSelect: 1,
          },
          { name: 'titulo', type: 'text', required: true },
          { name: 'mensagem', type: 'text', required: true },
          { name: 'rbt12', type: 'number' },
          { name: 'folha12', type: 'number' },
          { name: 'fator_r_atual', type: 'number' }, // percentual, ex: 24.50 ou 29.80
          { name: 'fator_r_projetado', type: 'number' },
          { name: 'enquadramento_anterior', type: 'text' }, // Anexo III ou Anexo V
          { name: 'enquadramento_novo', type: 'text' },
          {
            name: 'severidade',
            type: 'select',
            required: true,
            values: ['baixa', 'media', 'alta', 'critica'],
            maxSelect: 1,
          },
          { name: 'resolvido', type: 'bool' },
          { name: 'resolvido_em', type: 'date' },
          { name: 'resolvido_por', type: 'text' },
          { name: 'processo_id', type: 'text' },
          { name: 'acao_recomendada', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_fator_r_tenant_emp_comp ON prolabore_fator_r_alertas (tenant_id, empresa, competencia)',
          'CREATE INDEX idx_fator_r_severidade ON prolabore_fator_r_alertas (severidade)',
        ],
      })
      app.save(alertasCol)
    }

    // 5. Garantir que o Catálogo de Verbas possua a verba de Pró-labore (código 1010)
    try {
      const verbasCol = app.findCollectionByNameOrId('verbas_catalogo')
      const tenants = app.findRecordsByFilter('tenants', 'ativo = true', 'created', 10, 0)
      for (const t of tenants) {
        const tId = t.id
        const emps = app.findRecordsByFilter(
          'empresas',
          `tenant_id = '${tId}' && status = 'ativo'`,
          'created',
          20,
          0,
        )
        for (const emp of emps) {
          const empId = emp.id
          let verbaExist = null
          try {
            const arr = app.findRecordsByFilter(
              'verbas_catalogo',
              `tenant_id = '${tId}' && empresa = '${empId}' && codigo = '1010'`,
              '',
              1,
              0,
            )
            if (arr.length > 0) verbaExist = arr[0]
          } catch (_) {}

          if (!verbaExist) {
            const vRec = new Record(verbasCol)
            vRec.set('tenant_id', tId)
            vRec.set('empresa', empId)
            vRec.set('codigo', '1010')
            vRec.set('descricao', 'Pró-Labore Sócio / Titular (Contribuinte Individual)')
            vRec.set('tipo', 'provento')
            vRec.set('rubrica_esocial', '1000')
            vRec.set('unidade', 'valor_fixo')
            vRec.set('valor_padrao', 0)
            vRec.set('incide_inss', true)
            vRec.set('incide_irrf', true)
            vRec.set('incide_fgts', false) // Sócio não recolhe FGTS obrigatório
            vRec.set('integra_salario_contrib', true)
            vRec.set('reflexo_dsr', false)
            vRec.set('reflexo_ferias_13', false)
            vRec.set('ativo', true)
            vRec.set(
              'observacoes',
              'Remuneração de sócios e administradores com recolhimento de INSS e IRRF retido na fonte.',
            )
            app.save(vRec)
          }
        }
      }
    } catch (errVerbas) {
      console.warn('Aviso ao semear verba 1010:', errVerbas)
    }

    // 6. Cadastrar o SOP "POP-DP-01: Pró-labore e Distribuição de Lucros"
    const sopsCol = app.findCollectionByNameOrId('sops')
    const processosCol = app.findCollectionByNameOrId('processos_operacionais')
    const etapasCol = app.findCollectionByNameOrId('processo_etapas')
    const jobsCol = app.findCollectionByNameOrId('elisa_jobs')

    const sopTemplate = {
      codigo: 'POP-DP-01',
      nome: 'Pró-labore e Distribuição de Lucros com Monitoramento do Fator R',
      area: 'pessoal',
      versao: '2026.1',
      objetivo:
        'Ciclo mensal completo de apuração do Pró-labore dos sócios e distribuição de lucros isentos com base na apuração de resultado e conformidade societária: conferência de sócios, cálculo de INSS (11% contribuinte individual) e IRRF (Lei 14.663/2023), monitoramento do Fator R (limiar de 28% no Simples Nacional), conferência técnica do contador (Nível 3) e formalização com evidências auditadas no GED.',
      gatilho:
        'Fechamento mensal da folha de pagamento e apuração do resultado contábil da competência.',
      pre_condicoes:
        'Sócios cadastrados na plataforma com quota de participação e valor contratual do pró-labore fixado.',
      entradas:
        'Cadastro de sócios, remuneração mensal acordada, parâmetros normativos de INSS/IRRF, faturamento acumulado 12 meses (RBT12) e resultado líquido do balancete.',
      sistemas_utilizados:
        'Plataforma Rumo Módulo DP, Motor Unificado Normativo, DCTFWeb, DARF Previdenciário, GED Contábil.',
      responsavel_cargo: 'Contador Responsável CRC / Analista de DP',
      agente_nome: 'Elliza',
      nivel_autonomia: 'nivel_3_aprovacao_obrigatoria',
      requer_aprovacao: true,
      saida:
        'Recibos de pró-labore gerados, guias de INSS/IRRF integradas ao financeiro, demonstrativo de distribuição de lucros arquivado e Fator R recalculado.',
      proximo_processo: 'POP-04 (Fechamento Contábil Mensal) e POP-02 (Folha de Pagamento CLT)',
      regras_negocio:
        'Cálculo de INSS à alíquota de 11% limitado ao teto do salário de contribuição vigente. IRRF calculado com tabela progressiva e comparação automática com o desconto simplificado mensal (R$ 564,80). Distribuição de lucros 100% isenta respeitando a proporção de quotas e dependendo do resultado contábil da competência (se indisponível, status AGUARDANDO_FECHAMENTO). Alerta imediato se a proporção folha/faturamento do Fator R mudar de anexo ou exigir recálculo da alíquota do DAS.',
      criterios_sucesso:
        '100% dos sócios ativos apurados, alertas de Fator R gerados preventivamente, comprovantes de pró-labore arquivados com hash SHA-256 e aprovação CRC registrada.',
      criterios_erro:
        'Sócio sem CPF ou quota zerada, valor do pró-labore abaixo do salário mínimo sem respaldo legal ou divergência nas quotas contratuais.',
      excecoes:
        'Se o balancete da competência não estiver fechado, a apuração do pró-labore conclui normalmente e a distribuição de lucros permanece no status AGUARDANDO_FECHAMENTO sem travar a folha.',
      etapas: [
        {
          ordem: 1,
          titulo: 'Identificar sócios ativos e quadro societário contratual',
          descricao:
            'Carregar a lista de sócios ativos por empresa, validando percentual de quotas, vínculo empregatício opcional e opção por distribuição de lucros.',
          entrada: 'Cadastro de Sócios + Contrato Social registrado no GED',
          acao: 'Validar consistência cadastral dos sócios e vigência das quotas.',
          criterio_sucesso: 'Todos os sócios ativos identificados e quotas somando até 100%.',
          criterio_erro: 'Soma de quotas incompatível ou dados de CPF faltantes.',
          proxima_etapa_nome: 'Calcular pró-labore com INSS e IRRF',
          requer_aprovacao: false,
          responsavel_tipo: 'Elliza',
        },
        {
          ordem: 2,
          titulo: 'Calcular pró-labore mensal dos sócios (INSS 11% e IRRF)',
          descricao:
            'Aplicar alíquota de 11% de contribuinte individual (respeitando o teto de contribuição) e tabela progressiva de IRRF Lei 14.663/2023 com desconto simplificado.',
          entrada: 'Remuneração contratual de pró-labore + Parâmetros INSS/IRRF vigentes',
          acao: 'Executar motor normativo e apurar valor líquido a pagar.',
          criterio_sucesso: 'Valores de INSS, IRRF e líquido apurados com exatidão matemática.',
          criterio_erro: 'Erro de cálculo ou pró-labore nulo não parametrizado.',
          proxima_etapa_nome: 'Validar limites fiscais e monitorar Fator R',
          requer_aprovacao: false,
          responsavel_tipo: 'Elliza',
        },
        {
          ordem: 3,
          titulo: 'Validar limites fiscais e emitir alertas do Fator R (28%)',
          descricao:
            'Calcular a relação Folha/Faturamento dos últimos 12 meses (RBT12) e disparar alertas se o pró-labore cruzar o limiar de 28% do Simples Nacional ou atingir teto de INSS.',
          entrada: 'Faturamento RBT12 + Total de folha e pró-labore projetados',
          acao: 'Comparar Fator R atual e projetado e registrar alertas de recálculo da alíquota do DAS.',
          criterio_sucesso:
            'Alerta emitido ou certificação de regularidade sem transição de anexo.',
          criterio_erro: 'Inconsistência nos acumulados de faturamento.',
          proxima_etapa_nome: 'Conferência técnica e aprovação pelo Contador CRC',
          requer_aprovacao: false,
          responsavel_tipo: 'Elliza',
        },
        {
          ordem: 4,
          titulo: 'Conferência técnica do Contador CRC (Nível 3 — Aprovação Obrigatória)',
          descricao:
            'Submeter a minuta de pró-labore, as retenções de INSS/IRRF e o enquadramento do Fator R para chancela do Contador Responsável antes de formalizar.',
          entrada: 'Minuta da folha de pró-labore + Painel de Alertas de Fator R',
          acao: 'Revisar apuração e chancelar formalmente no Modo Humano.',
          criterio_sucesso: 'Aprovação técnica registrada com justificativa e CRC.',
          criterio_erro: 'Rejeição fundamentada pelo contador solicitando ajuste.',
          proxima_etapa_nome: 'Registrar comprovantes no GED e distribuir lucros',
          requer_aprovacao: true,
          responsavel_tipo: 'Humano',
        },
        {
          ordem: 5,
          titulo: 'Registrar comprovantes no GED e apurar distribuição de lucros',
          descricao:
            'Emitir recibos de pró-labore com protocolo SHA-256 no GED, enfileirar guia DARF no Financeiro e distribuir o resultado apurado da competência aos quotistas.',
          entrada: 'Folha de pró-labore chancelada + Resultado DRE do período',
          acao: 'Gravar evidência auditada no cofre e atualizar status da distribuição de lucros.',
          criterio_sucesso: 'Recibos com hash registrados, DARF provisionada e lucros integrados.',
          criterio_erro: 'Falha na gravação do comprovante no GED.',
          proxima_etapa_nome: 'Processo Concluído',
          requer_aprovacao: false,
          responsavel_tipo: 'Elliza',
        },
      ],
    }

    // 7. Semear SOP em todos os tenants ativos
    const allTenants = app.findRecordsByFilter('tenants', 'ativo = true', 'created', 10, 0)
    for (const t of allTenants) {
      const tenantId = t.id
      let sopRec = null
      try {
        sopRec = app.findFirstRecordByFilter(
          'sops',
          `tenant_id = '${tenantId}' && codigo = '${sopTemplate.codigo}'`,
        )
      } catch (_) {}

      if (!sopRec) {
        sopRec = new Record(sopsCol)
        sopRec.set('tenant_id', tenantId)
        sopRec.set('codigo', sopTemplate.codigo)
        sopRec.set('nome', sopTemplate.nome)
        sopRec.set('area', sopTemplate.area)
        sopRec.set('versao', sopTemplate.versao)
        sopRec.set('objetivo', sopTemplate.objetivo)
        sopRec.set('gatilho', sopTemplate.gatilho)
        sopRec.set('pre_condicoes', sopTemplate.pre_condicoes)
        sopRec.set('entradas', sopTemplate.entradas)
        sopRec.set('sistemas_utilizados', sopTemplate.sistemas_utilizados)
        sopRec.set('responsavel_cargo', sopTemplate.responsavel_cargo)
        sopRec.set('agente_nome', sopTemplate.agente_nome)
        sopRec.set('nivel_autonomia', sopTemplate.nivel_autonomia)
        sopRec.set('etapas_template_json', sopTemplate.etapas)
        sopRec.set('regras_negocio', sopTemplate.regras_negocio)
        sopRec.set('criterios_sucesso', sopTemplate.criterios_sucesso)
        sopRec.set('criterios_erro', sopTemplate.criterios_erro)
        sopRec.set('excecoes', sopTemplate.excecoes)
        sopRec.set('requer_aprovacao', sopTemplate.requer_aprovacao)
        sopRec.set('saida', sopTemplate.saida)
        sopRec.set('proximo_processo', sopTemplate.proximo_processo)
        sopRec.set('ativo', true)
        app.save(sopRec)
      }

      // Buscar empresa ativa para semear demonstração
      let emp = null
      try {
        emp = app.findFirstRecordByFilter(
          'empresas',
          `tenant_id = '${tenantId}' && status = 'ativo'`,
        )
      } catch (_) {}

      if (emp) {
        const empId = emp.id
        const comp = '09/2026'

        // 8. Semear sócios de demonstração se não existirem
        const sociosDemo = [
          {
            nome: 'Dra. Camila Colato',
            cpf: '048.912.439-82',
            email: 'camila.colato@medicina.com.br',
            telefone: '(41) 98877-6655',
            cargo: 'Sócio-Administrador',
            participacao: 60,
            quotas: 30000,
            valorPart: 30000,
            proLabore: 8500.0, // Acima do teto INSS (R$ 7.786,02) para testar teto e alerta Fator R
            optanteDist: true,
            isCi: true,
            dependentes: 1,
          },
          {
            nome: 'Dr. Lucas Rocha',
            cpf: '739.201.845-10',
            email: 'lucas.rocha@medicina.com.br',
            telefone: '(41) 99988-1122',
            cargo: 'Sócio-Quotista',
            participacao: 40,
            quotas: 20000,
            valorPart: 20000,
            proLabore: 4500.0,
            optanteDist: true,
            isCi: true,
            dependentes: 0,
          },
        ]

        const sociosCriados = []
        for (const s of sociosDemo) {
          let sRec = null
          try {
            const arrS = app.findRecordsByFilter(
              'socios',
              `tenant_id = '${tenantId}' && empresa = '${empId}' && cpf = '${s.cpf}'`,
              '',
              1,
              0,
            )
            if (arrS.length > 0) sRec = arrS[0]
          } catch (_) {}

          if (!sRec) {
            sRec = new Record(sociosColSaved)
            sRec.set('tenant_id', tenantId)
            sRec.set('empresa', empId)
            sRec.set('nome_completo', s.nome)
            sRec.set('cpf', s.cpf)
            sRec.set('email', s.email)
            sRec.set('telefone', s.telefone)
            sRec.set('cargo_funcao', s.cargo)
            sRec.set('percentual_participacao', s.participacao)
            sRec.set('quantidade_quotas', s.quotas)
            sRec.set('valor_participacao', s.valorPart)
            sRec.set('pro_labore_definido', s.proLabore)
            sRec.set('data_inicio', '2025-01-15T00:00:00Z')
            sRec.set('is_contribuinte_individual', s.isCi)
            sRec.set('optante_distribuicao_lucros', s.optanteDist)
            sRec.set('dependentes_irrf', s.dependentes)
            sRec.set('status', 'ativo')
            sRec.set('banco', 'Banco Itaú (341)')
            sRec.set('agencia', '0450')
            sRec.set('conta', '12890-4')
            sRec.set('chave_pix', s.cpf)
            sRec.set('observacoes', 'Contrato social registrado na Junta Comercial.')
            app.save(sRec)
          }
          sociosCriados.push(sRec)
        }

        // 9. Semear lançamentos de pró-labore calculados para 09/2026
        const lancColSaved = app.findCollectionByNameOrId('pro_labore_lancamentos')
        for (const sc of sociosCriados) {
          let lRec = null
          try {
            const arrL = app.findRecordsByFilter(
              'pro_labore_lancamentos',
              `tenant_id = '${tenantId}' && empresa = '${empId}' && socio = '${sc.id}' && competencia = '${comp}'`,
              '',
              1,
              0,
            )
            if (arrL.length > 0) lRec = arrL[0]
          } catch (_) {}

          if (!lRec) {
            const bruto = sc.getFloat('pro_labore_definido') || 5000.0
            const tetoInss = 7786.02
            const baseInss = Math.min(bruto, tetoInss)
            const inss = Math.round(baseInss * 0.11 * 100) / 100
            const atingiuTeto = bruto >= tetoInss

            // IRRF (Tabela progressiva)
            const dependentes = sc.getInt('dependentes_irrf') || 0
            const deducaoDependentes = dependentes * 189.59
            const baseLegal = Math.max(0, bruto - inss - deducaoDependentes)
            const baseSimplificada = Math.max(0, bruto - 564.8)

            const calcIrrf = (base) => {
              if (base <= 2259.2) return { imposto: 0, aliq: 0, ded: 0 }
              if (base <= 2826.65)
                return {
                  imposto: Math.max(0, Math.round((base * 0.075 - 169.44) * 100) / 100),
                  aliq: 0.075,
                  ded: 169.44,
                }
              if (base <= 3751.05)
                return {
                  imposto: Math.max(0, Math.round((base * 0.15 - 381.44) * 100) / 100),
                  aliq: 0.15,
                  ded: 381.44,
                }
              if (base <= 4664.68)
                return {
                  imposto: Math.max(0, Math.round((base * 0.225 - 662.77) * 100) / 100),
                  aliq: 0.225,
                  ded: 662.77,
                }
              return {
                imposto: Math.max(0, Math.round((base * 0.275 - 896.0) * 100) / 100),
                aliq: 0.275,
                ded: 896.0,
              }
            }

            const cLegal = calcIrrf(baseLegal)
            const cSimp = calcIrrf(baseSimplificada)
            const usaSimp = cSimp.imposto < cLegal.imposto
            const cFinal = usaSimp ? cSimp : cLegal
            const baseFinal = usaSimp ? baseSimplificada : baseLegal
            const irrf = cFinal.imposto
            const liquido = Math.round((bruto - inss - irrf) * 100) / 100

            // Lucro proporcional estimado para o mês (ex: resultado R$ 25.000,00 * quota)
            const perc = sc.getFloat('percentual_participacao') || 50
            const lucroEstimado = Math.round(25000 * (perc / 100) * 100) / 100

            lRec = new Record(lancColSaved)
            lRec.set('tenant_id', tenantId)
            lRec.set('empresa', empId)
            lRec.set('socio', sc.id)
            lRec.set('competencia', comp)
            lRec.set('valor_bruto', bruto)
            lRec.set('base_inss', baseInss)
            lRec.set('aliquota_inss', 11.0)
            lRec.set('inss_retido', inss)
            lRec.set('atingiu_teto_inss', atingiuTeto)
            lRec.set('base_irrf', Math.round(baseFinal * 100) / 100)
            lRec.set('aliquota_irrf', cFinal.aliq * 100)
            lRec.set('parcela_deduzir_irrf', cFinal.ded)
            lRec.set('irrf_retido', irrf)
            lRec.set('deducao_simplificada_usada', usaSimp)
            lRec.set('valor_liquido', liquido)
            lRec.set('distribuicao_lucro_valor', lucroEstimado)
            lRec.set('distribuicao_status', 'aguardando_fechamento')
            lRec.set(
              'distribuicao_base_legal',
              'Lei 9.249/95 art. 10 e art. 14 da LC 123/2006 (Isenção total de IR na distribuição)',
            )
            lRec.set('status', 'calculado')
            lRec.set('guia_darf_gerada', false)
            lRec.set('numero_recibo', `REC-PL-${comp.replace('/', '')}-${sc.id.slice(-4)}`)
            lRec.set('hash_evidencia', `sha256-demo-${Date.now().toString(16)}`)
            lRec.set(
              'observacoes',
              'Pró-labore mensal apurado pela Elliza conforme regras de Contribuinte Individual e IRRF vigente.',
            )
            app.save(lRec)
          }
        }

        // 10. Semear alertas de Fator R para teste imediato do usuário
        const alertasColSaved = app.findCollectionByNameOrId('prolabore_fator_r_alertas')
        let alertaExist = null
        try {
          const arrA = app.findRecordsByFilter(
            'prolabore_fator_r_alertas',
            `tenant_id = '${tenantId}' && empresa = '${empId}' && competencia = '${comp}'`,
            '',
            1,
            0,
          )
          if (arrA.length > 0) alertaExist = arrA[0]
        } catch (_) {}

        if (!alertaExist) {
          const aRec = new Record(alertasColSaved)
          aRec.set('tenant_id', tenantId)
          aRec.set('empresa', empId)
          aRec.set('competencia', comp)
          aRec.set('tipo_alerta', 'cruzamento_fator_r_28')
          aRec.set('titulo', 'Pró-labore atingiu limite que exige recálculo do Fator R')
          aRec.set(
            'mensagem',
            'O pró-labore da competência 09/2026 (R$ 13.000,00 total sócios) elevou a relação Folha/Faturamento de 24,10% para 28,65%, cruzando o limiar legal de 28%. A empresa passa a ser tributada pelo Anexo III em vez do Anexo V, gerando redução tributária na alíquota efetiva do DAS. Recalcular alíquota efetiva do DAS antes de fechar a competência.',
          )
          aRec.set('rbt12', 450000.0)
          aRec.set('folha12', 128925.0)
          aRec.set('fator_r_atual', 24.1)
          aRec.set('fator_r_projetado', 28.65)
          aRec.set('enquadramento_anterior', 'Anexo V (Alíquota inicial ~15.5%)')
          aRec.set('enquadramento_novo', 'Anexo III (Alíquota inicial 6.0%) — Economia Tributária')
          aRec.set('severidade', 'alta')
          aRec.set('resolvido', false)
          aRec.set(
            'acao_recomendada',
            'Recalcular a alíquota efetiva do DAS no Simples Nacional e chancelar o pró-labore no Modo Humano antes do encerramento da competência.',
          )
          app.save(aRec)
        }

        // 11. Instanciar processo demo no catálogo da esteira Elliza parado em AGUARDANDO_APROVACAO
        let procExistente = null
        try {
          procExistente = app.findFirstRecordByFilter(
            'processos_operacionais',
            `tenant_id = '${tenantId}' && empresa_id = '${empId}' && codigo_sop = '${sopTemplate.codigo}' && competencia = '${comp}'`,
          )
        } catch (_) {}

        if (!procExistente) {
          const procRec = new Record(processosCol)
          procRec.set('tenant_id', tenantId)
          procRec.set('empresa_id', empId)
          procRec.set('sop_id', sopRec.id)
          procRec.set('codigo_sop', sopTemplate.codigo)
          procRec.set('titulo', `${sopTemplate.nome} — ${comp}`)
          procRec.set('area', 'pessoal')
          procRec.set('competencia', comp)
          // Parado exatamente na Etapa 4 em AGUARDANDO_APROVACAO (Modo Humano) conforme requisito do usuário
          procRec.set('status', 'AGUARDANDO_APROVACAO')
          procRec.set('prioridade', 'urgente')
          procRec.set('nivel_autonomia', 'nivel_3_aprovacao_obrigatoria')
          procRec.set('etapa_atual_numero', 4)
          procRec.set(
            'etapa_atual_nome',
            '4. Conferência técnica do Contador CRC (Nível 3 — Aprovação Obrigatória)',
          )
          procRec.set('total_etapas', sopTemplate.etapas.length)
          procRec.set('progresso_percentual', 60)
          procRec.set('agente_responsavel', 'Elliza')
          procRec.set('prazo', '2026-10-15T23:59:59Z')
          procRec.set(
            'proxima_acao',
            'Aguardando validação e chancela CRC do Contador Responsável para a folha de pró-labore e alerta de Fator R.',
          )
          procRec.set(
            'criterio_sucesso_atual',
            'Aprovação técnica registrada com parecer e certificação CRC.',
          )
          procRec.set(
            'ultima_acao_executada',
            'Etapa 3 concluída: Alerta de cruzamento de 28% no Fator R emitido com sucesso (Anexo V -> Anexo III).',
          )
          procRec.set(
            'resultado_ultima_acao',
            'Cálculos conferidos pela Elliza sem divergências aritméticas. Aguardando chancela do contador.',
          )
          procRec.set(
            'decisao_necessaria_humana',
            'Etapa 4: "Conferência técnica do Contador CRC" preparada pela Elliza. Requer conferência e aprovação para formalizar recibos e DARF.',
          )
          app.save(procRec)

          // Criar etapas do checklist
          let etapa4Rec = null
          for (let i = 0; i < sopTemplate.etapas.length; i++) {
            const et = sopTemplate.etapas[i]
            const epRec = new Record(etapasCol)
            epRec.set('tenant_id', tenantId)
            epRec.set('processo_id', procRec.id)
            epRec.set('ordem', et.ordem)
            epRec.set('titulo', `${et.ordem}. ${et.titulo}`)
            epRec.set('descricao', et.descricao)
            epRec.set('responsavel_tipo', et.responsavel_tipo)
            epRec.set('entrada', et.entrada)
            epRec.set('acao', et.acao)
            epRec.set('criterio_sucesso', et.criterio_sucesso)
            epRec.set('criterio_erro', et.criterio_erro)
            epRec.set('proxima_etapa_nome', et.proxima_etapa_nome)
            epRec.set('requer_aprovacao', et.requer_aprovacao)

            if (et.ordem < 4) {
              epRec.set('status', 'CONCLUIDO')
              epRec.set('resultado', 'Executado e validado pela Elliza com paridade normativa.')
            } else if (et.ordem === 4) {
              epRec.set('status', 'AGUARDANDO_APROVACAO')
              epRec.set(
                'resultado',
                'Folha de pró-labore apurada e limites validados. Pronto para chancela CRC.',
              )
              etapa4Rec = epRec
            } else {
              epRec.set('status', 'AGUARDANDO')
            }
            app.save(epRec)
          }

          // Criar Job na Fila da Elliza
          const jobCodigo = `JOB-092026-POPDP01`
          let jobExistente = null
          try {
            jobExistente = app.findFirstRecordByFilter(
              'elisa_jobs',
              `tenant_id = '${tenantId}' && job_codigo = '${jobCodigo}'`,
            )
          } catch (_) {}

          if (!jobExistente) {
            const jobRec = new Record(jobsCol)
            jobRec.set('tenant_id', tenantId)
            jobRec.set('processo_id', procRec.id)
            if (etapa4Rec) jobRec.set('etapa_id', etapa4Rec.id)
            jobRec.set('empresa_id', empId)
            jobRec.set('job_codigo', jobCodigo)
            jobRec.set('competencia', comp)
            jobRec.set('area', 'pessoal')
            jobRec.set('processo_nome', `${sopTemplate.nome} — ${comp}`)
            jobRec.set('pop_relacionado', sopTemplate.codigo)
            jobRec.set(
              'etapa_atual_nome',
              '4. Conferência técnica do Contador CRC (Nível 3 — Aprovação Obrigatória)',
            )
            jobRec.set(
              'proxima_acao',
              'Aguardando validação e chancela CRC do Contador Responsável para a folha de pró-labore.',
            )
            jobRec.set('prioridade', 'urgente')
            jobRec.set('prazo', '2026-10-15T23:59:59Z')
            jobRec.set('status', 'AGUARDANDO_APROVACAO')
            jobRec.set('agente_responsavel', 'Elliza')
            jobRec.set('nivel_autonomia', 'nivel_3_aprovacao_obrigatoria')
            jobRec.set('necessita_aprovacao', true)
            jobRec.set(
              'resultado',
              'Cálculos de INSS/IRRF e alerta de Fator R prontos. Requer aprovação no Modo Humano.',
            )
            app.save(jobRec)
          }

          // Criar pendência na central de Modo Humano
          try {
            const pendCol = app.findCollectionByNameOrId('processo_pendencias')
            const pendRec = new Record(pendCol)
            pendRec.set('tenant_id', tenantId)
            pendRec.set('processo_id', procRec.id)
            if (etapa4Rec) pendRec.set('etapa_id', etapa4Rec.id)
            pendRec.set('empresa_id', empId)
            pendRec.set(
              'titulo',
              'Aprovação Necessária: Folha de Pró-labore e Alerta Fator R (09/2026)',
            )
            pendRec.set(
              'por_que_parou',
              'Etapa parametrizada com Nível 3 (Aprovação Obrigatória por conformidade legal/CFC antes da emissão de comprovantes).',
            )
            pendRec.set(
              'o_que_foi_executado',
              'Elliza calculou INSS e IRRF dos sócios e detectou transição do Fator R de 24,10% para 28,65% (mudança favorável de enquadramento para o Anexo III).',
            )
            pendRec.set(
              'o_que_falta',
              'Chancela técnica do Contador Responsável para validar recálculo da alíquota do DAS e formalizar recibos.',
            )
            pendRec.set(
              'decisao_necessaria',
              'Revisar apuração de pró-labore e aprovar para emissão dos comprovantes no GED.',
            )
            pendRec.set('status', 'aberta')
            app.save(pendRec)
          } catch (_) {}

          // Criar evidência auditada da Etapa 3
          try {
            const evidCol = app.findCollectionByNameOrId('elisa_evidencias')
            const evidRec = new Record(evidCol)
            evidRec.set('tenant_id', tenantId)
            evidRec.set('processo_id', procRec.id)
            evidRec.set('empresa_id', empId)
            evidRec.set('tipo', 'protocolo')
            evidRec.set('titulo', 'Evidência de Execução — Etapa 3: Alerta Fator R Disparado')
            evidRec.set(
              'descricao',
              'Elliza executou validação dos limites de Fator R da competência 09/2026 para a empresa.',
            )
            evidRec.set('protocolo_numero', 'OP-FATORR-092026-01')
            evidRec.set('numero_operacao', 'OP-FATORR-092026-01')
            evidRec.set('hash_sha256', 'sha256-fator-r-prolabore-202609-sucesso')
            evidRec.set('executado_por', 'Elliza')
            evidRec.set(
              'resultado_obtido',
              'Fator R projetado em 28,65% com cruzamento do limiar de 28% confirmado. Alerta preventivo gerado.',
            )
            app.save(evidRec)
          } catch (_) {}
        }
      }
    }
  },
  (app) => {
    // Reversão limpa
    try {
      const colAlertas = app.findCollectionByNameOrId('prolabore_fator_r_alertas')
      app.delete(colAlertas)
    } catch (_) {}
    try {
      const colLanc = app.findCollectionByNameOrId('pro_labore_lancamentos')
      app.delete(colLanc)
    } catch (_) {}
    try {
      const colSocios = app.findCollectionByNameOrId('socios')
      app.delete(colSocios)
    } catch (_) {}
  },
)

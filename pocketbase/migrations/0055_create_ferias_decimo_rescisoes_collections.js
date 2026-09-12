/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const empresas = app.findCollectionByNameOrId('empresas')
    const funcionarios = app.findCollectionByNameOrId('funcionarios')
    const tenantsId = tenants.id
    const empresasId = empresas.id
    const funcionariosId = funcionarios.id

    // 1. Coleção 'ferias_periodos'
    // Gerencia o período aquisitivo, concessivo, dias de gozo, abono pecuniário (venda de até 1/3 = 10 dias),
    // média das verbas variáveis com reflexo_ferias_13, adicional de 1/3 constitucional, descontos de INSS/IRRF e status
    if (!app.hasTable('ferias_periodos')) {
      const feriasCol = new Collection({
        name: 'ferias_periodos',
        type: 'base',
        listRule:
          "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'",
        viewRule:
          "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'",
        createRule:
          "@request.auth.id != '' && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')",
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
            name: 'funcionario',
            type: 'relation',
            required: true,
            collectionId: funcionariosId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'competencia', type: 'text', required: true }, // MM/AAAA em que entra na folha
          { name: 'periodo_aquisitivo_inicio', type: 'date', required: true },
          { name: 'periodo_aquisitivo_fim', type: 'date', required: true },
          { name: 'data_inicio_gozo', type: 'date', required: true },
          { name: 'data_fim_gozo', type: 'date', required: true },
          { name: 'dias_gozo', type: 'number', required: true }, // 10 a 30 dias
          { name: 'vender_abono', type: 'bool' }, // abono pecuniário opcional
          { name: 'dias_abono', type: 'number' }, // até 10 dias (1/3 legal)
          { name: 'adiantar_13', type: 'bool' }, // adiantar 1ª parcela do 13º nas férias (art. 137 CLT)
          { name: 'salario_base', type: 'number', required: true },
          { name: 'media_variaveis', type: 'number' }, // apurada pelas verbas variáveis reflexo_ferias_13
          { name: 'remuneracao_base_ferias', type: 'number', required: true }, // salário + média
          { name: 'valor_ferias_gozo', type: 'number', required: true }, // proporcional aos dias de gozo
          { name: 'terco_constitucional_ferias', type: 'number', required: true }, // 1/3 sobre férias
          { name: 'valor_abono_pecuniario', type: 'number' }, // dias abono * remuneração/30
          { name: 'terco_constitucional_abono', type: 'number' }, // 1/3 do abono (isento INSS/IRRF)
          { name: 'total_bruto', type: 'number', required: true },
          { name: 'base_inss', type: 'number' },
          { name: 'inss', type: 'number' },
          { name: 'base_irrf', type: 'number' },
          { name: 'irrf', type: 'number' },
          { name: 'total_descontos', type: 'number' },
          { name: 'total_liquido', type: 'number', required: true },
          { name: 'data_limite_pagamento', type: 'date' }, // CLT art. 145: até 2 dias antes do início do gozo
          { name: 'mapa_medias_json', type: 'json' }, // detalhamento de onde veio cada média por competência
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['calculado', 'aprovado', 'pago', 'cancelado'],
            maxSelect: 1,
          },
          { name: 'integrado_folha', type: 'bool' },
          { name: 'pago_em', type: 'date' },
          { name: 'observacoes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_ferias_tenant_emp ON ferias_periodos (tenant_id, empresa)',
          'CREATE INDEX idx_ferias_func ON ferias_periodos (funcionario)',
          'CREATE INDEX idx_ferias_status ON ferias_periodos (status)',
          'CREATE INDEX idx_ferias_comp ON ferias_periodos (competencia)',
        ],
      })
      app.save(feriasCol)
    }

    // 2. Coleção 'decimo_terceiro'
    // Gerencia o cálculo de 1ª parcela (adiantamento sem descontos), 2ª parcela (com descontos de INSS e IRRF anual)
    // ou parcela única / rescisória, com apuração de avos (art. 146 CLT - mês > 14 dias conta avo inteiro),
    // média das verbas variáveis com reflexo_ferias_13, salário-maternidade dedutível e guia 2172
    if (!app.hasTable('decimo_terceiro')) {
      const decimoCol = new Collection({
        name: 'decimo_terceiro',
        type: 'base',
        listRule:
          "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'",
        viewRule:
          "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'",
        createRule:
          "@request.auth.id != '' && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')",
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
            name: 'funcionario',
            type: 'relation',
            required: true,
            collectionId: funcionariosId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'ano', type: 'number', required: true },
          { name: 'competencia', type: 'text', required: true }, // ex: "11/2026" (1ª) ou "12/2026" (2ª)
          {
            name: 'parcela',
            type: 'select',
            required: true,
            values: ['primeira_parcela', 'segunda_parcela', 'parcela_unica'],
            maxSelect: 1,
          },
          { name: 'meses_trabalhados', type: 'number', required: true }, // avos (ex: 12/12, 8/12)
          { name: 'salario_base', type: 'number', required: true },
          { name: 'media_variaveis', type: 'number' }, // média das verbas do ano até competência
          { name: 'salario_maternidade_abatimento', type: 'number' }, // responsabilidade INSS
          { name: 'remuneracao_base_calculo', type: 'number', required: true },
          { name: 'valor_bruto', type: 'number', required: true },
          { name: 'adiantamento_pago', type: 'number' }, // descontado na 2ª parcela
          { name: 'base_inss', type: 'number' },
          { name: 'inss', type: 'number' }, // tabela progressiva do 13º (exclusiva na 2ª parcela)
          { name: 'base_irrf', type: 'number' },
          { name: 'irrf', type: 'number' }, // tributação exclusiva fonte na 2ª parcela (cód. 0561)
          { name: 'fgts', type: 'number' }, // 8% sobre a remuneração apurada
          { name: 'total_descontos', type: 'number' },
          { name: 'total_liquido', type: 'number', required: true },
          { name: 'mapa_medias_json', type: 'json' },
          { name: 'codigo_receita_inss', type: 'text' }, // '2172' para INSS do 13º salário
          { name: 'vencimento_guia_inss', type: 'date' }, // vencimento 20/12
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['calculado', 'aprovado', 'pago', 'cancelado'],
            maxSelect: 1,
          },
          { name: 'integrado_folha', type: 'bool' },
          { name: 'pago_em', type: 'date' },
          { name: 'observacoes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_decimo_tenant_emp ON decimo_terceiro (tenant_id, empresa)',
          'CREATE INDEX idx_decimo_func_ano ON decimo_terceiro (funcionario, ano)',
          'CREATE INDEX idx_decimo_status ON decimo_terceiro (status)',
          'CREATE INDEX idx_decimo_comp ON decimo_terceiro (competencia)',
        ],
      })
      app.save(decimoCol)
    }

    // 3. Coleção 'rescisoes'
    // Gerencia o desligamento completo com motivos de desligamento e-Social (S-2299),
    // aviso prévio proporcional da Lei 12.506/2011 (30 dias + 3 por ano trabalhado, até 90),
    // saldo de salário, férias vencidas e proporcionais + 1/3, 13º proporcional,
    // multa do FGTS (40% saldo depositado), saque autorizado e alertas legais (prazo art. 477)
    if (!app.hasTable('rescisoes')) {
      const rescisoesCol = new Collection({
        name: 'rescisoes',
        type: 'base',
        listRule:
          "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'",
        viewRule:
          "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'",
        createRule:
          "@request.auth.id != '' && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')",
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
            name: 'funcionario',
            type: 'relation',
            required: true,
            collectionId: funcionariosId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'motivo_desligamento',
            type: 'select',
            required: true,
            values: [
              'sem_justa_causa_empregador', // cód e-Social 02
              'justa_causa_empregador', // cód e-Social 01
              'pedido_demissao', // cód e-Social 07
              'acordo_consensual_art_484_a', // cód e-Social 33
              'termino_contrato_experiencia', // cód e-Social 04
              'rescisao_indireta', // cód e-Social 03
              'aposentadoria', // cód e-Social 09
            ],
            maxSelect: 1,
          },
          { name: 'codigo_afastamento_esocial', type: 'text', required: true },
          { name: 'data_aviso_previo', type: 'date' },
          {
            name: 'tipo_aviso_previo',
            type: 'select',
            required: true,
            values: ['trabalhado', 'indenizado', 'dispensado', 'nao_aplicavel'],
            maxSelect: 1,
          },
          { name: 'dias_aviso_previo', type: 'number', required: true }, // 30 + 3 por ano trabalhado, máx 90
          { name: 'data_desligamento', type: 'date', required: true },
          { name: 'data_projecao_aviso', type: 'date' }, // data final computando aviso trabalhado/indenizado
          { name: 'dias_saldo_salario', type: 'number', required: true }, // dias trabalhados no mês
          { name: 'salario_base', type: 'number', required: true },
          { name: 'media_variaveis', type: 'number' },
          { name: 'saldo_salario_valor', type: 'number', required: true },
          { name: 'aviso_previo_indenizado_valor', type: 'number' },
          { name: 'decimo_terceiro_proporcional_valor', type: 'number', required: true },
          { name: 'decimo_terceiro_indenizado_aviso', type: 'number' },
          { name: 'ferias_vencidas_valor', type: 'number' },
          { name: 'terco_ferias_vencidas', type: 'number' },
          { name: 'ferias_proporcionais_valor', type: 'number', required: true },
          { name: 'terco_ferias_proporcionais', type: 'number', required: true },
          { name: 'ferias_indenizadas_aviso', type: 'number' },
          { name: 'salario_familia_proporcional', type: 'number' },
          { name: 'outros_proventos', type: 'number' },
          { name: 'total_bruto_rescisao', type: 'number', required: true },
          // Descontos
          { name: 'desconto_inss', type: 'number' },
          { name: 'desconto_irrf', type: 'number' },
          { name: 'desconto_aviso_previo_nao_cumprido', type: 'number' },
          { name: 'desconto_adiantamento', type: 'number' },
          { name: 'outros_descontos', type: 'number' },
          { name: 'total_descontos_rescisao', type: 'number', required: true },
          { name: 'total_liquido_rescisao', type: 'number', required: true },
          // FGTS e Multa Rescisória
          { name: 'saldo_fgts_para_fins_rescisorios', type: 'number' },
          { name: 'aliquota_multa_fgts', type: 'number' }, // 40% (sem justa causa) ou 20% (acordo art 484-A)
          { name: 'valor_multa_rescisoria_fgts', type: 'number' },
          { name: 'saque_fgts_autorizado', type: 'bool' },
          { name: 'codigo_saque_fgts', type: 'text' }, // "01" (sem justa causa)
          { name: 'prazo_pagamento_limite', type: 'date', required: true }, // CLT art. 477 §6º: 10 dias corridos
          { name: 'alertas_conformidade_clt', type: 'json' }, // lista de alertas CLT acionáveis
          { name: 'mapa_medias_json', type: 'json' },
          { name: 'verbas_rescisorias_detalhadas', type: 'json' }, // proventos e descontos para TRCT
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['simulada', 'pendente_aprovacao', 'concluida', 'cancelada'],
            maxSelect: 1,
          },
          { name: 'evento_s2299_gerado_id', type: 'text' },
          { name: 'chave_conectividade_emitida', type: 'bool' },
          { name: 'concluido_em', type: 'date' },
          {
            name: 'concluido_por',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
          },
          { name: 'observacoes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_rescisoes_tenant_emp ON rescisoes (tenant_id, empresa)',
          'CREATE INDEX idx_rescisoes_func ON rescisoes (funcionario)',
          'CREATE INDEX idx_rescisoes_status ON rescisoes (status)',
          'CREATE INDEX idx_rescisoes_data ON rescisoes (data_desligamento)',
        ],
      })
      app.save(rescisoesCol)
    }
  },
  (app) => {
    try {
      const r = app.findCollectionByNameOrId('rescisoes')
      app.delete(r)
    } catch (_) {}

    try {
      const dt = app.findCollectionByNameOrId('decimo_terceiro')
      app.delete(dt)
    } catch (_) {}

    try {
      const fp = app.findCollectionByNameOrId('ferias_periodos')
      app.delete(fp)
    } catch (_) {}
  },
)

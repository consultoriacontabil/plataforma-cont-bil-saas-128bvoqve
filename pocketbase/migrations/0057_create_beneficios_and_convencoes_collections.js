/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const empresas = app.findCollectionByNameOrId('empresas')
    const funcionarios = app.findCollectionByNameOrId('funcionarios')
    const tenantsId = tenants.id
    const empresasId = empresas.id
    const funcionariosId = funcionarios.id

    // 1. Coleção 'beneficios_concedidos'
    // Gerencia benefícios concedidos por colaborador / competência:
    // VT (Vale Transporte), VA (Vale Alimentação), VR (Vale Refeição)
    // Regras CLT: VT teto 6% salário base (Lei 7.418/85), não incidência de INSS/IRRF/FGTS
    if (!app.hasTable('beneficios_concedidos')) {
      const beneficiosCol = new Collection({
        name: 'beneficios_concedidos',
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
          { name: 'competencia', type: 'text', required: true }, // MM/AAAA
          {
            name: 'tipo',
            type: 'select',
            required: true,
            values: ['vale_transporte', 'vale_alimentacao', 'vale_refeicao'],
            maxSelect: 1,
          },
          { name: 'dias_uteis', type: 'number' }, // ex: 22 dias
          { name: 'quantidade_dia', type: 'number' }, // ex: 2 passagens/dia ou 1 ticket/dia
          { name: 'valor_unitario', type: 'number' }, // ex: R$ 5,00 por passagem ou R$ 35,00 por dia
          { name: 'valor_total_beneficio', type: 'number', required: true }, // custo total concedido
          { name: 'desconto_colaborador', type: 'number' }, // parte descontada do colaborador (ex: VT até 6% ou coparticipação VA/VR)
          { name: 'custo_empresa', type: 'number' }, // valor_total - desconto_colaborador
          { name: 'operadora', type: 'text' }, // ex: "Alelo", "Sodexo / Pluxee", "Ticket", "VR Benefícios", "SPTrans / Bilhete Único"
          { name: 'numero_cartao', type: 'text' }, // últimos dígitos ou número do cartão do benefício
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['pendente', 'entregue', 'cancelado'],
            maxSelect: 1,
          },
          { name: 'data_entrega', type: 'date' },
          { name: 'observacoes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_beneficios_tenant_emp_comp ON beneficios_concedidos (tenant_id, empresa, competencia)',
          'CREATE INDEX idx_beneficios_func_comp ON beneficios_concedidos (funcionario, competencia)',
          'CREATE INDEX idx_beneficios_tipo ON beneficios_concedidos (tipo)',
        ],
      })
      app.save(beneficiosCol)
    }

    // 2. Coleção 'convencoes_coletivas'
    // Gestão de CCTs / ACTs por sindicato/categoria com monitoramento de vigência e parâmetros
    if (!app.hasTable('convencoes_coletivas')) {
      const convencoesCol = new Collection({
        name: 'convencoes_coletivas',
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
          { name: 'titulo', type: 'text', required: true }, // ex: "CCT SINDPD-SP 2026/2027"
          { name: 'sindicato_laboral', type: 'text', required: true }, // ex: "SINDPD - Sindicato dos Trabalhadores em TI"
          { name: 'sindicato_patronal', type: 'text' }, // ex: "SEPROSP"
          { name: 'categoria_profissional', type: 'text', required: true }, // ex: "Trabalhadores em Tecnologia da Informação"
          { name: 'numero_registro_mte', type: 'text' }, // ex: "SP002341/2026"
          { name: 'data_base', type: 'text', required: true }, // ex: "01/01" ou "01/05" ou "Maio"
          { name: 'vigencia_inicio', type: 'date', required: true },
          { name: 'vigencia_fim', type: 'date', required: true },
          { name: 'arquivo_pdf', type: 'file', maxSize: 20971520, mimeTypes: ['application/pdf'] },
          // Principais parâmetros estruturados
          { name: 'piso_salarial', type: 'number' },
          { name: 'percentual_reajuste', type: 'number' }, // ex: 5.5%
          { name: 'data_aplicacao_reajuste', type: 'date' },
          { name: 'adicional_hora_extra', type: 'number' }, // ex: 60%
          { name: 'adicional_noturno', type: 'number' }, // ex: 25%
          { name: 'adicional_insalubridade_minimo', type: 'number' },
          { name: 'ticket_refeicao_diario', type: 'number' }, // ex: 38.50
          { name: 'auxilio_creche', type: 'number' }, // ex: 450.00
          { name: 'parametros_adicionais_json', type: 'json' }, // lista flexível [{ nome, valor, tipo, unidade }]
          {
            name: 'status_vigencia',
            type: 'select',
            required: true,
            values: [
              'vigente',
              'a_vencer_60',
              'a_vencer_30',
              'a_vencer_7',
              'vencida',
              'em_negociacao',
            ],
            maxSelect: 1,
          },
          { name: 'alerta_dias_config', type: 'number' }, // configurável: padrão 60
          { name: 'ultima_aplicacao_em', type: 'date' },
          { name: 'observacoes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_convencoes_tenant_emp ON convencoes_coletivas (tenant_id, empresa)',
          'CREATE INDEX idx_convencoes_vigencia ON convencoes_coletivas (vigencia_fim)',
          'CREATE INDEX idx_convencoes_status ON convencoes_coletivas (status_vigencia)',
        ],
      })
      app.save(convencoesCol)
    }

    const convencoesColObj = app.findCollectionByNameOrId('convencoes_coletivas')
    const convencoesId = convencoesColObj.id

    // 3. Coleção 'historico_salarial'
    // Registra alterações salariais individuais ou em massa decorrentes de convenção coletiva,
    // permitindo auditoria detalhada e reversão (rollback) em caso de necessidade.
    if (!app.hasTable('historico_salarial')) {
      const histCol = new Collection({
        name: 'historico_salarial',
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
            name: 'convencao_origem',
            type: 'relation',
            collectionId: convencoesId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'data_alteracao', type: 'date', required: true },
          { name: 'competencia_vigencia', type: 'text', required: true }, // MM/AAAA a partir de quando vigora
          {
            name: 'motivo',
            type: 'select',
            required: true,
            values: [
              'reajuste_convencao_coletiva',
              'promocao',
              'merito',
              'enquadramento_piso',
              'reversao_rollback',
            ],
            maxSelect: 1,
          },
          { name: 'salario_anterior', type: 'number', required: true },
          { name: 'salario_novo', type: 'number', required: true },
          { name: 'percentual_aplicado', type: 'number' },
          { name: 'diferenca_mensal', type: 'number' },
          { name: 'retroativo_sugerido', type: 'number' }, // cálculo da diferença em meses retroativos
          { name: 'meses_retroativos', type: 'number' },
          { name: 'lote_reajuste_id', type: 'text' }, // agrupa operações em massa para facilitar reversão
          { name: 'revertido', type: 'bool' },
          { name: 'data_reversao', type: 'date' },
          { name: 'detalhes_json', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_histsal_tenant_emp ON historico_salarial (tenant_id, empresa)',
          'CREATE INDEX idx_histsal_func ON historico_salarial (funcionario)',
          'CREATE INDEX idx_histsal_lote ON historico_salarial (lote_reajuste_id)',
          'CREATE INDEX idx_histsal_convencao ON historico_salarial (convencao_origem)',
        ],
      })
      app.save(histCol)
    }
  },
  (app) => {
    try {
      const hs = app.findCollectionByNameOrId('historico_salarial')
      app.delete(hs)
    } catch (_) {}

    try {
      const cc = app.findCollectionByNameOrId('convencoes_coletivas')
      app.delete(cc)
    } catch (_) {}

    try {
      const bc = app.findCollectionByNameOrId('beneficios_concedidos')
      app.delete(bc)
    } catch (_) {}
  },
)

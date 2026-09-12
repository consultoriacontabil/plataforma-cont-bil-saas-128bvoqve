/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const empresas = app.findCollectionByNameOrId('empresas')
    const contasFinanceiras = app.findCollectionByNameOrId('contas_financeiras')
    const obrigacoes = app.findCollectionByNameOrId('obrigacoes')

    const tenantsId = tenants.id
    const empresasId = empresas.id
    const contasFinanceirasId = contasFinanceiras.id
    const obrigacoesId = obrigacoes.id

    // 1. Coleção 'reinf_eventos' (EFD-Reinf - Escrituração Fiscal Digital de Retenções e Outras Informações Fiscais)
    // Tipos de Eventos:
    // - R-1000 (Informações do Contribuinte)
    // - R-1070 (Tabela de Processos Administrativos/Judiciais)
    // - R-2010 (Retenção Contribuição Previdenciária - Tomadores de Serviços)
    // - R-2020 (Retenção Contribuição Previdenciária - Prestadores de Serviços)
    // - R-2030 (Recursos Recebidos por Associação Desportiva)
    // - R-2040 (Recursos Repassados para Associação Desportiva)
    // - R-2050 (Comercialização da Produção por Produtor Rural PJ/Agroindústria)
    // - R-2060 (Contribuição Previdenciária sobre a Receita Bruta - CPRB)
    // - R-2098 (Reabertura dos Eventos Periódicos)
    // - R-2099 (Fechamento dos Eventos Periódicos)
    // - R-3010 (Receita de Espetáculo Desportivo)
    if (!app.hasTable('reinf_eventos')) {
      const reinfCol = new Collection({
        name: 'reinf_eventos',
        type: 'base',
        listRule:
          "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'",
        viewRule:
          "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'",
        createRule:
          "@request.auth.id != '' && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador' || @request.auth.tenant_members_via_user_id.perfil ?= 'auxiliar')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')",
        deleteRule:
          "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?= 'administrador'",
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
            name: 'tipo_evento',
            type: 'select',
            required: true,
            values: [
              'R-1000',
              'R-1070',
              'R-2010',
              'R-2020',
              'R-2030',
              'R-2040',
              'R-2050',
              'R-2060',
              'R-2098',
              'R-2099',
              'R-3010',
            ],
            maxSelect: 1,
          },
          { name: 'competencia', type: 'text' }, // MM/AAAA
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['pendente', 'pronto', 'validado', 'transmitido', 'rejeitado', 'fechado'],
            maxSelect: 1,
          },
          { name: 'identificador_evento', type: 'text' },
          { name: 'prestador_cnpj_cpf', type: 'text' },
          { name: 'prestador_razao_social', type: 'text' },
          { name: 'numero_documento', type: 'text' },
          { name: 'valor_bruto', type: 'number' },
          { name: 'base_calculo', type: 'number' },
          { name: 'valor_retencao', type: 'number' },
          { name: 'codigo_receita', type: 'text' }, // Ex: 111-0, 1708, 5952, etc.
          { name: 'prazo_legal', type: 'date' }, // Dia 15 do mês seguinte
          { name: 'xml_gerado', type: 'text' },
          { name: 'erros_validacao', type: 'json' },
          { name: 'protocolo_envio', type: 'text' },
          { name: 'recibo_entrega', type: 'text' },
          { name: 'data_transmissao', type: 'date' },
          { name: 'duracao_transmissao_ms', type: 'number' },
          { name: 'modo_envio', type: 'text' }, // supervisao | producao
          { name: 'resposta_governo_json', type: 'json' },
          { name: 'motivo_reabertura', type: 'text' },
          { name: 'justificativa', type: 'text' },
          {
            name: 'titulo_financeiro',
            type: 'relation',
            collectionId: contasFinanceirasId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_reinf_eventos_tenant_emp ON reinf_eventos (tenant_id, empresa)',
          'CREATE INDEX idx_reinf_eventos_comp ON reinf_eventos (competencia)',
          'CREATE INDEX idx_reinf_eventos_tipo ON reinf_eventos (tipo_evento)',
          'CREATE INDEX idx_reinf_eventos_status ON reinf_eventos (status)',
          'CREATE INDEX idx_reinf_eventos_prazo ON reinf_eventos (prazo_legal)',
        ],
      })
      app.save(reinfCol)
    }

    // 2. Coleção 'dctfweb_declaracoes' (Declaração de Débitos e Créditos Tributários Federais Previdenciários)
    // Consolida e-Social (S-1200/S-1299) e EFD-Reinf (R-2010/R-2020)
    if (!app.hasTable('dctfweb_declaracoes')) {
      const dctfwebCol = new Collection({
        name: 'dctfweb_declaracoes',
        type: 'base',
        listRule:
          "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'",
        viewRule:
          "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'",
        createRule:
          "@request.auth.id != '' && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador' || @request.auth.tenant_members_via_user_id.perfil ?= 'auxiliar')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')",
        deleteRule:
          "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?= 'administrador'",
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
          { name: 'competencia', type: 'text' }, // MM/AAAA
          {
            name: 'tipo_declaracao',
            type: 'select',
            required: true,
            values: ['geral', '13_salario', 'diaria', 'espetaculo_desportivo'],
            maxSelect: 1,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['pendente', 'consolidada', 'transmitida', 'rejeitada'],
            maxSelect: 1,
          },
          { name: 'debitos_json', type: 'json' }, // Tabela de débitos por código de receita
          { name: 'total_debitos', type: 'number' },
          { name: 'total_deducoes', type: 'number' },
          { name: 'saldo_a_recolher', type: 'number' },
          { name: 'esocial_status_fechamento', type: 'text' }, // 'fechado' | 'pendente' | 'reaberto'
          { name: 'reinf_status_fechamento', type: 'text' }, // 'fechado' | 'pendente' | 'reaberto'
          { name: 'pronta_para_transmitir', type: 'bool' },
          { name: 'pendencias_bloqueantes', type: 'json' }, // Lista de pendências que impedem transmissão
          { name: 'protocolo_envio', type: 'text' },
          { name: 'recibo_entrega', type: 'text' },
          { name: 'numero_declaracao', type: 'text' },
          { name: 'data_transmissao', type: 'date' },
          { name: 'prazo_legal', type: 'date' }, // Dia 25 do mês subsequente (ou dia útil anterior)
          { name: 'modo_envio', type: 'text' }, // supervisao | producao
          {
            name: 'obrigacao_vinculada',
            type: 'relation',
            collectionId: obrigacoesId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'titulo_financeiro',
            type: 'relation',
            collectionId: contasFinanceirasId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_dctfweb_tenant_emp ON dctfweb_declaracoes (tenant_id, empresa)',
          'CREATE INDEX idx_dctfweb_comp ON dctfweb_declaracoes (competencia)',
          'CREATE INDEX idx_dctfweb_status ON dctfweb_declaracoes (status)',
          'CREATE INDEX idx_dctfweb_prazo ON dctfweb_declaracoes (prazo_legal)',
        ],
      })
      app.save(dctfwebCol)
    }
  },
  (app) => {
    try {
      const d = app.findCollectionByNameOrId('dctfweb_declaracoes')
      app.delete(d)
    } catch (_) {}

    try {
      const r = app.findCollectionByNameOrId('reinf_eventos')
      app.delete(r)
    } catch (_) {}
  },
)

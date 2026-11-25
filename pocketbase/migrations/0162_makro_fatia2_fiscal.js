/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0162 — Fatia 2 do modelo Makro: módulo FISCAL.
 *
 * Coleções do núcleo fiscal (todas com tenant_id e regras RLS por tenant,
 * no padrão da migration 0161). As criações usam `new Collection` literal,
 * em ordem de dependência, para o validador enxergar cada coleção antes
 * de qualquer referência a ela:
 *  1. fiscais_produtos    — cadastro de produtos auto-preenchido dos XMLs
 *  2. fiscais_fornecedores— fornecedores/prestadores extraídos dos XMLs
 *  3. fiscais_movimentos  — cabeçalho de cada nota (entrada/saída/serviços)
 *  4. fiscais_itens       — itens de cada movimento (CFOP, NCM, ICMS…)
 *  5. fiscal_apuracoes    — apuração da competência por regime tributário
 */

const REGRAS_TENANT_LEITURA =
  "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id"
const REGRAS_TENANT_ESCRITA =
  "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'"
const REGRAS_TENANT_ADMIN =
  "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && @request.auth.tenant_members_via_user_id.perfil ?= 'administrador'"

migrate(
  (app) => {
    const tenantsId = app.findCollectionByNameOrId('tenants').id
    const empresasId = app.findCollectionByNameOrId('empresas').id
    const usersId = '_pb_users_auth_'

    const campoTenant = {
      name: 'tenant_id',
      type: 'relation',
      required: true,
      collectionId: tenantsId,
      cascadeDelete: true,
      maxSelect: 1,
    }
    const campoEmpresa = {
      name: 'empresa_id',
      type: 'relation',
      required: true,
      collectionId: empresasId,
      maxSelect: 1,
    }
    const autodatas = [
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ]

    const existe = (nome) => {
      try {
        return app.findCollectionByNameOrId(nome)
      } catch (_) {
        return null
      }
    }

    // ------------------------------------------------------------------
    // 1. fiscais_produtos
    // ------------------------------------------------------------------
    let fiscaisProdutos = existe('fiscais_produtos')
    if (!fiscaisProdutos) {
      fiscaisProdutos = new Collection({
        name: 'fiscais_produtos',
        type: 'base',
        listRule: REGRAS_TENANT_LEITURA,
        viewRule: REGRAS_TENANT_LEITURA,
        createRule: REGRAS_TENANT_ESCRITA,
        updateRule: REGRAS_TENANT_ESCRITA,
        deleteRule: REGRAS_TENANT_ADMIN,
        fields: [
          campoTenant,
          campoEmpresa,
          { name: 'codigo', type: 'text', required: false },
          { name: 'descricao', type: 'text', required: true },
          { name: 'ncm', type: 'text', required: false },
          { name: 'cfop_padrao', type: 'text', required: false },
          { name: 'unidade', type: 'text', required: false },
          { name: 'valor_unitario', type: 'number', required: false },
          {
            name: 'origem',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['xml', 'manual'],
          },
          {
            name: 'criado_por',
            type: 'relation',
            required: false,
            collectionId: usersId,
            maxSelect: 1,
          },
          ...autodatas,
        ],
        indexes: [],
      })
      app.save(fiscaisProdutos)
      console.log('[0162] fiscais_produtos criada')
    } else {
      console.log('[0162] fiscais_produtos já existe — mantendo estrutura atual')
    }

    // ------------------------------------------------------------------
    // 2. fiscais_fornecedores
    // ------------------------------------------------------------------
    let fiscaisFornecedores = existe('fiscais_fornecedores')
    if (!fiscaisFornecedores) {
      fiscaisFornecedores = new Collection({
        name: 'fiscais_fornecedores',
        type: 'base',
        listRule: REGRAS_TENANT_LEITURA,
        viewRule: REGRAS_TENANT_LEITURA,
        createRule: REGRAS_TENANT_ESCRITA,
        updateRule: REGRAS_TENANT_ESCRITA,
        deleteRule: REGRAS_TENANT_ADMIN,
        fields: [
          campoTenant,
          campoEmpresa,
          { name: 'cnpj_cpf', type: 'text', required: false },
          { name: 'nome_razao_social', type: 'text', required: true },
          { name: 'inscricao_estadual', type: 'text', required: false },
          { name: 'uf', type: 'text', required: false },
          { name: 'municipio', type: 'text', required: false },
          {
            name: 'origem',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['xml', 'manual'],
          },
          {
            name: 'criado_por',
            type: 'relation',
            required: false,
            collectionId: usersId,
            maxSelect: 1,
          },
          ...autodatas,
        ],
        indexes: [],
      })
      app.save(fiscaisFornecedores)
      console.log('[0162] fiscais_fornecedores criada')
    } else {
      console.log('[0162] fiscais_fornecedores já existe — mantendo estrutura atual')
    }

    // ------------------------------------------------------------------
    // 3. fiscais_movimentos
    // ------------------------------------------------------------------
    let fiscaisMovimentos = existe('fiscais_movimentos')
    if (!fiscaisMovimentos) {
      fiscaisMovimentos = new Collection({
        name: 'fiscais_movimentos',
        type: 'base',
        listRule: REGRAS_TENANT_LEITURA,
        viewRule: REGRAS_TENANT_LEITURA,
        createRule: REGRAS_TENANT_ESCRITA,
        updateRule: REGRAS_TENANT_ESCRITA,
        deleteRule: REGRAS_TENANT_ADMIN,
        fields: [
          campoTenant,
          campoEmpresa,
          {
            name: 'tipo_movimento',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['entrada', 'saida', 'servico_prestado', 'servico_tomado'],
          },
          {
            name: 'modelo_documento',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['nfe', 'nfce', 'cte', 'nfse'],
          },
          { name: 'numero_nota', type: 'text', required: false },
          { name: 'serie', type: 'text', required: false },
          { name: 'chave_acesso', type: 'text', required: false },
          { name: 'data_emissao', type: 'date', required: false },
          { name: 'competencia', type: 'text', required: true }, // AAAA-MM
          { name: 'emitente_cnpj_cpf', type: 'text', required: false },
          { name: 'emitente_nome', type: 'text', required: false },
          { name: 'destinatario_cnpj_cpf', type: 'text', required: false },
          { name: 'destinatario_nome', type: 'text', required: false },
          { name: 'uf_emitente', type: 'text', required: false },
          { name: 'municipio_emitente', type: 'text', required: false },
          { name: 'valor_produtos', type: 'number', required: false },
          { name: 'valor_servicos', type: 'number', required: false },
          { name: 'valor_total', type: 'number', required: false },
          { name: 'valor_icms', type: 'number', required: false },
          { name: 'valor_icms_st', type: 'number', required: false },
          { name: 'valor_fcp_st', type: 'number', required: false },
          { name: 'valor_isentas', type: 'number', required: false },
          { name: 'valor_pis', type: 'number', required: false },
          { name: 'valor_cofins', type: 'number', required: false },
          { name: 'valor_iss', type: 'number', required: false },
          { name: 'natureza_operacao', type: 'text', required: false },
          {
            name: 'origem',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['xml_upload', 'xml_ged', 'manual'],
          },
          { name: 'arquivo_nome', type: 'text', required: false },
          { name: 'documento_ged_id', type: 'text', required: false },
          {
            name: 'importado_por',
            type: 'relation',
            required: false,
            collectionId: usersId,
            maxSelect: 1,
          },
          { name: 'observacao', type: 'text', required: false },
          ...autodatas,
        ],
        indexes: [],
      })
      app.save(fiscaisMovimentos)
      console.log('[0162] fiscais_movimentos criada')
    } else {
      console.log('[0162] fiscais_movimentos já existe — mantendo estrutura atual')
    }
    const movimentosId = fiscaisMovimentos.id
    const produtosId = fiscaisProdutos.id

    // ------------------------------------------------------------------
    // 4. fiscais_itens
    // ------------------------------------------------------------------
    if (!existe('fiscais_itens')) {
      const fiscaisItens = new Collection({
        name: 'fiscais_itens',
        type: 'base',
        listRule: REGRAS_TENANT_LEITURA,
        viewRule: REGRAS_TENANT_LEITURA,
        createRule: REGRAS_TENANT_ESCRITA,
        updateRule: REGRAS_TENANT_ESCRITA,
        deleteRule: REGRAS_TENANT_ADMIN,
        fields: [
          campoTenant,
          {
            name: 'movimento_id',
            type: 'relation',
            required: true,
            collectionId: movimentosId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'produto_id',
            type: 'relation',
            required: false,
            collectionId: produtosId,
            maxSelect: 1,
          },
          { name: 'numero_item', type: 'number', required: false, onlyInt: true },
          { name: 'codigo_produto', type: 'text', required: false },
          { name: 'descricao', type: 'text', required: false },
          { name: 'ncm', type: 'text', required: false },
          { name: 'cfop', type: 'text', required: false },
          { name: 'unidade', type: 'text', required: false },
          { name: 'quantidade', type: 'number', required: false },
          { name: 'valor_unitario', type: 'number', required: false },
          { name: 'valor_total', type: 'number', required: false },
          { name: 'valor_bc_icms', type: 'number', required: false },
          { name: 'aliquota_icms', type: 'number', required: false },
          { name: 'valor_icms', type: 'number', required: false },
          { name: 'valor_icms_st', type: 'number', required: false },
          { name: 'valor_isentas', type: 'number', required: false },
          { name: 'origem_arquivo', type: 'text', required: false },
          ...autodatas,
        ],
        indexes: ['CREATE INDEX idx_fitens_mov ON fiscais_itens (movimento_id)'],
      })
      app.save(fiscaisItens)
      console.log('[0162] fiscais_itens criada')
    } else {
      console.log('[0162] fiscais_itens já existe — mantendo estrutura atual')
    }

    // ------------------------------------------------------------------
    // 5. fiscal_apuracoes
    // ------------------------------------------------------------------
    if (!existe('fiscal_apuracoes')) {
      const fiscalApuracoes = new Collection({
        name: 'fiscal_apuracoes',
        type: 'base',
        listRule: REGRAS_TENANT_LEITURA,
        viewRule: REGRAS_TENANT_LEITURA,
        createRule: REGRAS_TENANT_ESCRITA,
        updateRule: REGRAS_TENANT_ESCRITA,
        deleteRule: REGRAS_TENANT_ADMIN,
        fields: [
          campoTenant,
          campoEmpresa,
          { name: 'competencia', type: 'text', required: true }, // AAAA-MM
          {
            name: 'regime',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['simples_nacional', 'lucro_presumido', 'lucro_real'],
          },
          { name: 'receita_tributavel', type: 'number', required: false },
          { name: 'receita_isenta', type: 'number', required: false },
          { name: 'rbt12', type: 'number', required: false },
          { name: 'anexo_simples', type: 'text', required: false },
          { name: 'detalhes_json', type: 'json', required: false, maxSize: 2000000 },
          { name: 'total_tributos', type: 'number', required: false },
          { name: 'guias_geradas', type: 'number', required: false, onlyInt: true },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['rascunho', 'confirmada'],
          },
          {
            name: 'usuario_id',
            type: 'relation',
            required: false,
            collectionId: usersId,
            maxSelect: 1,
          },
          ...autodatas,
        ],
        indexes: [],
      })
      app.save(fiscalApuracoes)
      console.log('[0162] fiscal_apuracoes criada')
    } else {
      console.log('[0162] fiscal_apuracoes já existe — mantendo estrutura atual')
    }
  },
  (app) => {
    const apagar = (nome) => {
      try {
        app.delete(app.findCollectionByNameOrId(nome))
        console.log(`[0162-down] ${nome} removida`)
      } catch (_) {
        /* já não existe */
      }
    }
    apagar('fiscal_apuracoes')
    apagar('fiscais_itens')
    apagar('fiscais_movimentos')
    apagar('fiscais_fornecedores')
    apagar('fiscais_produtos')
  },
)

/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0162 — Fatia 2 do modelo Makro: módulo FISCAL.
 *
 * Coleções do núcleo fiscal (todas com tenant_id e regras RLS por tenant,
 * no padrão da migration 0161):
 *  - fiscais_produtos   : cadastro de produtos preenchido automaticamente
 *                         a partir dos XMLs importados (dedupe por código).
 *  - fiscais_fornecedores: cadastro de fornecedores/prestadores criado a
 *                         partir do emitente/remetente do XML.
 *  - fiscais_movimentos : cabeçalho de cada nota importada (entrada/saída/
 *                         serviço prestado/tomado), com emitente, valores
 *                         e chave de acesso (dedupe por tenant+chave).
 *  - fiscais_itens      : itens de cada movimento (CFOP, NCM, valores, ICMS).
 *  - fiscal_apuracoes   : apuração da competência por regime tributário
 *                         (Simples/Presumido/Real) + guias geradas como
 *                         lançamento (origem 'apuracao_makro').
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

    const criar = (nome, campos, indexes) => {
      let colecao
      try {
        colecao = app.findCollectionByNameOrId(nome)
        console.log(`[0162] ${nome} já existe — mantendo estrutura atual`)
        return colecao
      } catch (_) {
        colecao = new Collection({
          name: nome,
          type: 'base',
          listRule: REGRAS_TENANT_LEITURA,
          viewRule: REGRAS_TENANT_LEITURA,
          createRule: REGRAS_TENANT_ESCRITA,
          updateRule: REGRAS_TENANT_ESCRITA,
          deleteRule: REGRAS_TENANT_ADMIN,
          fields: campos,
          indexes,
        })
        app.save(colecao)
        console.log(`[0162] ${nome} criada`)
        return colecao
      }
    }

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

    // ------------------------------------------------------------------
    // 1. fiscais_produtos
    // ------------------------------------------------------------------
    criar(
      'fiscais_produtos',
      [
        campoTenant,
        campoEmpresa,
        { name: 'codigo', type: 'text', required: false },
        { name: 'descricao', type: 'text', required: true },
        { name: 'ncm', type: 'text', required: false },
        { name: 'cfop_padrao', type: 'text', required: false },
        { name: 'unidade', type: 'text', required: false },
        { name: 'valor_unitario', type: 'number', required: false },
        { name: 'origem', type: 'select', required: true, maxSelect: 1, values: ['xml', 'manual'] },
        {
          name: 'criado_por',
          type: 'relation',
          required: false,
          collectionId: usersId,
          maxSelect: 1,
        },
        ...autodatas,
      ],
      [
        'CREATE INDEX idx_fprod_tenant ON fiscais_produtos (tenant_id)',
        'CREATE UNIQUE INDEX idx_fprod_empresa_codigo ON fiscais_produtos (empresa_id, codigo) WHERE codigo != ""',
      ],
    )

    // ------------------------------------------------------------------
    // 2. fiscais_fornecedores
    // ------------------------------------------------------------------
    criar(
      'fiscais_fornecedores',
      [
        campoTenant,
        campoEmpresa,
        { name: 'cnpj_cpf', type: 'text', required: false },
        { name: 'nome_razao_social', type: 'text', required: true },
        { name: 'inscricao_estadual', type: 'text', required: false },
        { name: 'uf', type: 'text', required: false },
        { name: 'municipio', type: 'text', required: false },
        { name: 'origem', type: 'select', required: true, maxSelect: 1, values: ['xml', 'manual'] },
        {
          name: 'criado_por',
          type: 'relation',
          required: false,
          collectionId: usersId,
          maxSelect: 1,
        },
        ...autodatas,
      ],
      [
        'CREATE INDEX idx_fforn_tenant ON fiscais_fornecedores (tenant_id)',
        'CREATE UNIQUE INDEX idx_fforn_empresa_cnpj ON fiscais_fornecedores (empresa_id, cnpj_cpf) WHERE cnpj_cpf != ""',
      ],
    )

    // ------------------------------------------------------------------
    // 3. fiscais_movimentos
    // ------------------------------------------------------------------
    criar(
      'fiscais_movimentos',
      [
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
      [
        'CREATE INDEX idx_fmov_tenant ON fiscais_movimentos (tenant_id)',
        'CREATE INDEX idx_fmov_empresa_comp ON fiscais_movimentos (tenant_id, empresa_id, competencia)',
        'CREATE UNIQUE INDEX idx_fmov_chave ON fiscais_movimentos (tenant_id, chave_acesso) WHERE chave_acesso != ""',
      ],
    )

    // ------------------------------------------------------------------
    // 4. fiscais_itens
    // ------------------------------------------------------------------
    const movimentosId = criar('fiscais_movimentos', [], []).id

    criar(
      'fiscais_itens',
      [
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
          collectionId: app.findCollectionByNameOrId('fiscais_produtos').id,
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
      [
        'CREATE INDEX idx_fitens_tenant ON fiscais_itens (tenant_id)',
        'CREATE INDEX idx_fitens_mov ON fiscais_itens (movimento_id)',
      ],
    )

    // ------------------------------------------------------------------
    // 5. fiscal_apuracoes
    // ------------------------------------------------------------------
    criar(
      'fiscal_apuracoes',
      [
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
      [
        'CREATE INDEX idx_fapu_tenant ON fiscal_apuracoes (tenant_id)',
        'CREATE UNIQUE INDEX idx_fapu_empresa_comp ON fiscal_apuracoes (tenant_id, empresa_id, competencia, regime)',
      ],
    )
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

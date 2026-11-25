/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0163 — Fatia 3 do modelo Makro: FINANCEIRO DO ESCRITÓRIO.
 *
 * Gestão financeira interna do escritório contábil (não do cliente):
 *  1. financeiro_contas      — caixa e bancos do escritório (saldo inicial)
 *  2. financeiro_categorias  — categorias de receita/despesa + seed padrão
 *  3. financeiro_honorarios  — honorários mensais fixos por cliente (empresa)
 *  4. financeiro_titulos     — títulos a receber/a pagar (com origem)
 *  5. financeiro_movimentos  — extrato do caixa/banco
 *
 * Padrão de RLS por tenant, igual às migrations 0161/0162.
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
      required: false,
      collectionId: empresasId,
      maxSelect: 1,
    }
    const campoUsuario = {
      name: 'usuario_id',
      type: 'relation',
      required: false,
      collectionId: usersId,
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

    const criarSeNaoExiste = (nome, fabricar) => {
      if (existe(nome)) {
        console.log(`[0163] ${nome} já existe — mantendo estrutura atual`)
        return existe(nome)
      }
      const col = new Collection(fabricar())
      app.save(col)
      console.log(`[0163] ${nome} criada`)
      return col
    }

    // ------------------------------------------------------------------
    // 1. financeiro_contas — caixa e bancos do escritório
    // ------------------------------------------------------------------
    // Criação com `new Collection` literal (padrão 0162): o validador exige que
    // cada coleção exista antes de qualquer referência de relation a ela.
    let financeiroContas = existe('financeiro_contas')
    if (!financeiroContas) {
      financeiroContas = new Collection({
        name: 'financeiro_contas',
        type: 'base',
        listRule: REGRAS_TENANT_LEITURA,
        viewRule: REGRAS_TENANT_LEITURA,
        createRule: REGRAS_TENANT_ESCRITA,
        updateRule: REGRAS_TENANT_ESCRITA,
        deleteRule: REGRAS_TENANT_ADMIN,
        fields: [
          campoTenant,
          { name: 'nome', type: 'text', required: true },
          {
            name: 'tipo',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['caixa', 'banco', 'pix'],
          },
          { name: 'agencia', type: 'text', required: false },
          { name: 'conta_numero', type: 'text', required: false },
          { name: 'saldo_inicial', type: 'number', required: false },
          { name: 'ativo', type: 'bool', required: false },
          campoUsuario,
          ...autodatas,
        ],
        indexes: [],
      })
      app.save(financeiroContas)
      console.log('[0163] financeiro_contas criada')
    } else {
      console.log('[0163] financeiro_contas já existe — mantendo estrutura atual')
    }
    const contasId = financeiroContas.id

    // ------------------------------------------------------------------
    // 2. financeiro_categorias — receita/despesa do escritório
    // ------------------------------------------------------------------
    let financeiroCategorias = existe('financeiro_categorias')
    if (!financeiroCategorias) {
      financeiroCategorias = new Collection({
        name: 'financeiro_categorias',
        type: 'base',
        listRule: REGRAS_TENANT_LEITURA,
        viewRule: REGRAS_TENANT_LEITURA,
        createRule: REGRAS_TENANT_ESCRITA,
        updateRule: REGRAS_TENANT_ESCRITA,
        deleteRule: REGRAS_TENANT_ADMIN,
        fields: [
          campoTenant,
          { name: 'nome', type: 'text', required: true },
          {
            name: 'tipo',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['receita', 'despesa'],
          },
          { name: 'descricao', type: 'text', required: false },
          { name: 'cor', type: 'text', required: false },
          ...autodatas,
        ],
        indexes: [],
      })
      app.save(financeiroCategorias)
      console.log('[0163] financeiro_categorias criada')
    } else {
      console.log('[0163] financeiro_categorias já existe — mantendo estrutura atual')
    }
    const categoriasId = financeiroCategorias.id

    // ------------------------------------------------------------------
    // 3. financeiro_honorarios — honorários mensais fixos por cliente
    // ------------------------------------------------------------------
    let financeiroHonorarios = existe('financeiro_honorarios')
    if (!financeiroHonorarios) {
      financeiroHonorarios = new Collection({
        name: 'financeiro_honorarios',
        type: 'base',
        listRule: REGRAS_TENANT_LEITURA,
        viewRule: REGRAS_TENANT_LEITURA,
        createRule: REGRAS_TENANT_ESCRITA,
        updateRule: REGRAS_TENANT_ESCRITA,
        deleteRule: REGRAS_TENANT_ADMIN,
        fields: [
          campoTenant,
          { ...campoEmpresa, required: true },
          { name: 'descricao', type: 'text', required: false },
          { name: 'valor_mensal', type: 'number', required: true },
          { name: 'dia_vencimento', type: 'number', required: false, onlyInt: true },
          { name: 'ativo', type: 'bool', required: false },
          {
            name: 'origem',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['manual', 'contrato'],
          },
          { name: 'contrato_id', type: 'text', required: false },
          campoUsuario,
          ...autodatas,
        ],
        indexes: [],
      })
      app.save(financeiroHonorarios)
      console.log('[0163] financeiro_honorarios criada')
    } else {
      console.log('[0163] financeiro_honorarios já existe — mantendo estrutura atual')
    }
    const honorariosId = financeiroHonorarios.id

    // ------------------------------------------------------------------
    // 4. financeiro_titulos — a receber / a pagar
    // ------------------------------------------------------------------
    let financeiroTitulos = existe('financeiro_titulos')
    if (!financeiroTitulos) {
      financeiroTitulos = new Collection({
        name: 'financeiro_titulos',
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
            name: 'tipo',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['receber', 'pagar'],
          },
          {
            name: 'origem',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: [
              'honorario_fixo',
              'receita_avulsa',
              'despesa_fixa',
              'despesa_avulsa',
              'manual',
            ],
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['aberto', 'pago'],
          },
          { name: 'descricao', type: 'text', required: true },
          { name: 'competencia', type: 'text', required: true }, // AAAA-MM
          { name: 'vencimento', type: 'date', required: false },
          { name: 'valor', type: 'number', required: true },
          { name: 'data_baixa', type: 'date', required: false },
          { name: 'valor_baixado', type: 'number', required: false },
          {
            name: 'conta_id',
            type: 'relation',
            required: false,
            collectionId: contasId,
            maxSelect: 1,
          },
          {
            name: 'categoria_id',
            type: 'relation',
            required: false,
            collectionId: categoriasId,
            maxSelect: 1,
          },
          {
            name: 'honorario_id',
            type: 'relation',
            required: false,
            collectionId: app.findCollectionByNameOrId('financeiro_honorarios').id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          campoUsuario,
          ...autodatas,
        ],
        indexes: [],
      })
      app.save(financeiroTitulos)
      console.log('[0163] financeiro_titulos criada')
    } else {
      console.log('[0163] financeiro_titulos já existe — mantendo estrutura atual')
    }
    const titulosId = financeiroTitulos.id

    // ------------------------------------------------------------------
    // 5. financeiro_movimentos — extrato do caixa/banco
    // ------------------------------------------------------------------
    if (!existe('financeiro_movimentos')) {
      const financeiroMovimentos = new Collection({
        name: 'financeiro_movimentos',
        type: 'base',
        listRule: REGRAS_TENANT_LEITURA,
        viewRule: REGRAS_TENANT_LEITURA,
        createRule: REGRAS_TENANT_ESCRITA,
        updateRule: REGRAS_TENANT_ESCRITA,
        deleteRule: REGRAS_TENANT_ADMIN,
        fields: [
          campoTenant,
          {
            name: 'conta_id',
            type: 'relation',
            required: true,
            collectionId: contasId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'titulo_id',
            type: 'relation',
            required: false,
            collectionId: titulosId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'natureza',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['entrada', 'saida'],
          },
          { name: 'descricao', type: 'text', required: true },
          { name: 'competencia', type: 'text', required: true }, // AAAA-MM
          { name: 'data', type: 'date', required: false },
          { name: 'valor', type: 'number', required: true },
          {
            name: 'categoria_id',
            type: 'relation',
            required: false,
            collectionId: categoriasId,
            maxSelect: 1,
          },
          campoUsuario,
          ...autodatas,
        ],
        indexes: ['CREATE INDEX idx_finmov_conta ON financeiro_movimentos (conta_id)'],
      })
      app.save(financeiroMovimentos)
      console.log('[0163] financeiro_movimentos criada')
    } else {
      console.log('[0163] financeiro_movimentos já existe — mantendo estrutura atual')
    }

    // ------------------------------------------------------------------
    // Seed de categorias padrão (por tenant existente)
    // ------------------------------------------------------------------
    const CATEGORIAS_PADRAO = [
      {
        nome: 'Honorários contábeis',
        tipo: 'receita',
        descricao: 'Mensalidades de honorários dos clientes',
      },
      {
        nome: 'Serviços extras',
        tipo: 'receita',
        descricao: 'Serviços avulsos, alterações contratuais e parcelamentos',
      },
      { nome: 'Outras receitas', tipo: 'receita', descricao: 'Receitas diversas do escritório' },
      {
        nome: 'Folha de pagamento',
        tipo: 'despesa',
        descricao: 'Salários, encargos e benefícios da equipe',
      },
      { nome: 'Aluguel e condomínio', tipo: 'despesa', descricao: 'Ocupação do escritório' },
      { nome: 'Água, luz, telefone e internet', tipo: 'despesa', descricao: 'Utilidades' },
      {
        nome: 'Softwares e sistemas',
        tipo: 'despesa',
        descricao: 'Licenças (Domínio, NFe.io, Skip etc.)',
      },
      {
        nome: 'Impostos do escritório',
        tipo: 'despesa',
        descricao: 'DAS e tributos do próprio CNPJ',
      },
      { nome: 'Marketing', tipo: 'despesa', descricao: 'Divulgação e aquisição' },
      { nome: 'Outras despesas', tipo: 'despesa', descricao: 'Despesas diversas' },
    ]

    const tenants = app.findCollectionByNameOrId('tenants')
    let registros = null
    try {
      registros = app.findRecordsByFilter('tenants', 'id != ""', '-created', 500, 0)
    } catch (_) {
      registros = null
    }
    if (registros) {
      for (const t of registros) {
        for (const cat of CATEGORIAS_PADRAO) {
          const existentes = app.findRecordsByFilter(
            'financeiro_categorias',
            `tenant_id = "${t.id}" && nome = "${cat.nome}"`,
            '',
            1,
            0,
          )
          if (existentes.length > 0) continue
          const r = new Record(financeiroCategorias)
          r.set('tenant_id', t.id)
          r.set('nome', cat.nome)
          r.set('tipo', cat.tipo)
          r.set('descricao', cat.descricao)
          app.save(r)
        }
      }
      console.log('[0163] seed de categorias padrão concluído')
    }
  },
  (app) => {
    const apagar = (nome) => {
      try {
        app.delete(app.findCollectionByNameOrId(nome))
        console.log(`[0163-down] ${nome} removida`)
      } catch (_) {
        /* já não existe */
      }
    }
    apagar('financeiro_movimentos')
    apagar('financeiro_titulos')
    apagar('financeiro_honorarios')
    apagar('financeiro_categorias')
    apagar('financeiro_contas')
  },
)

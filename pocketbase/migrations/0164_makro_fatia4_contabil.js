/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0164 — Fatia 4 do modelo Makro: CONTÁBIL.
 *
 * Reaproveita as collections já existentes `plano_contas` e
 * `lancamentos_contabeis` (RLS por tenant, schema.json) e adiciona:
 *  1. contabil_extratos    — linhas de extrato bancário (OFX/TXT) para conciliação
 *  2. contabil_fechamentos — fechamento de competência (totais DRE/balancete)
 * e popula o plano de contas padrão (classes 1–5 da estrutura brasileira)
 * para cada tenant que ainda não o possuir.
 *
 * Padrão de RLS por tenant, igual às migrations 0161/0162/0163.
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
      cascadeDelete: true,
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

    // ------------------------------------------------------------------
    // 1. contabil_extratos — linhas de extrato (OFX/TXT) p/ conciliação
    // ------------------------------------------------------------------
    if (!existe('contabil_extratos')) {
      const extratos = new Collection({
        name: 'contabil_extratos',
        type: 'base',
        listRule: REGRAS_TENANT_LEITURA,
        viewRule: REGRAS_TENANT_LEITURA,
        createRule: REGRAS_TENANT_ESCRITA,
        updateRule: REGRAS_TENANT_ESCRITA,
        deleteRule: REGRAS_TENANT_ADMIN,
        fields: [
          campoTenant,
          campoEmpresa,
          { name: 'data', type: 'date', required: true },
          { name: 'descricao', type: 'text', required: true },
          { name: 'documento_numero', type: 'text', required: false },
          { name: 'valor', type: 'number', required: true },
          {
            name: 'tipo',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['credito', 'debito'],
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['pendente', 'conciliado', 'ignorado'],
          },
          { name: 'lote_contabil_id', type: 'text', required: false },
          { name: 'arquivo_nome', type: 'text', required: false },
          campoUsuario,
          ...autodatas,
        ],
        indexes: [],
      })
      app.save(extratos)
      console.log('[0164] contabil_extratos criada')
    } else {
      console.log('[0164] contabil_extratos já existe — mantendo estrutura atual')
    }

    // ------------------------------------------------------------------
    // 2. contabil_fechamentos — fechamento de competência
    // ------------------------------------------------------------------
    if (!existe('contabil_fechamentos')) {
      const fechamentos = new Collection({
        name: 'contabil_fechamentos',
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
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['rascunho', 'fechado'],
          },
          { name: 'receitas', type: 'number', required: false },
          { name: 'despesas', type: 'number', required: false },
          { name: 'resultado', type: 'number', required: false },
          { name: 'detalhes_json', type: 'json', required: false, maxSize: 2000000 },
          campoUsuario,
          ...autodatas,
        ],
        indexes: [],
      })
      app.save(fechamentos)
      console.log('[0164] contabil_fechamentos criada')
    } else {
      console.log('[0164] contabil_fechamentos já existe — mantendo estrutura atual')
    }

    // ------------------------------------------------------------------
    // Seed do plano de contas padrão (classes 1–5) por tenant
    // ------------------------------------------------------------------
    const PLANO_PADRAO = [
      { codigo: '1', nome: 'Ativo', tipo: 'ativo', nivel: 1 },
      { codigo: '1.1', nome: 'Ativo Circulante', tipo: 'ativo', nivel: 2 },
      { codigo: '1.1.1', nome: 'Caixa Geral', tipo: 'ativo', nivel: 3 },
      { codigo: '1.1.2', nome: 'Bancos Conta Movimento', tipo: 'ativo', nivel: 3 },
      { codigo: '1.1.3', nome: 'Clientes a Receber', tipo: 'ativo', nivel: 3 },
      { codigo: '1.2', nome: 'Ativo Não Circulante', tipo: 'ativo', nivel: 2 },
      { codigo: '1.2.1', nome: 'Imobilizado', tipo: 'ativo', nivel: 3 },
      { codigo: '2', nome: 'Passivo', tipo: 'passivo', nivel: 1 },
      { codigo: '2.1', nome: 'Passivo Circulante', tipo: 'passivo', nivel: 2 },
      { codigo: '2.1.1', nome: 'Fornecedores', tipo: 'passivo', nivel: 3 },
      { codigo: '2.1.2', nome: 'Obrigações Trabalhistas', tipo: 'passivo', nivel: 3 },
      { codigo: '2.1.3', nome: 'Obrigações Tributárias', tipo: 'passivo', nivel: 3 },
      { codigo: '2.2', nome: 'Passivo Não Circulante', tipo: 'passivo', nivel: 2 },
      { codigo: '2.2.1', nome: 'Empréstimos e Financiamentos', tipo: 'passivo', nivel: 3 },
      { codigo: '3', nome: 'Patrimônio Líquido', tipo: 'patrimonio', nivel: 1 },
      { codigo: '3.1', nome: 'Capital Social', tipo: 'patrimonio', nivel: 2 },
      { codigo: '3.2', nome: 'Lucros ou Prejuízos Acumulados', tipo: 'patrimonio', nivel: 2 },
      { codigo: '4', nome: 'Receitas', tipo: 'receita', nivel: 1 },
      { codigo: '4.1', nome: 'Receitas de Vendas', tipo: 'receita', nivel: 2 },
      { codigo: '4.1.1', nome: 'Vendas de Mercadorias', tipo: 'receita', nivel: 3 },
      { codigo: '4.2', nome: 'Receitas de Serviços', tipo: 'receita', nivel: 2 },
      { codigo: '4.2.1', nome: 'Serviços Prestados', tipo: 'receita', nivel: 3 },
      { codigo: '5', nome: 'Despesas e Custos', tipo: 'despesa', nivel: 1 },
      { codigo: '5.1', nome: 'Custos', tipo: 'despesa', nivel: 2 },
      { codigo: '5.1.1', nome: 'Custo das Mercadorias Vendidas', tipo: 'despesa', nivel: 3 },
      { codigo: '5.2', nome: 'Despesas Operacionais', tipo: 'despesa', nivel: 2 },
      { codigo: '5.2.1', nome: 'Despesas com Pessoal', tipo: 'despesa', nivel: 3 },
      { codigo: '5.2.2', nome: 'Despesas Administrativas', tipo: 'despesa', nivel: 3 },
      { codigo: '5.2.3', nome: 'Despesas com Tributos', tipo: 'despesa', nivel: 3 },
    ]

    const planoCollection = existe('plano_contas')
    let tenantsRegistros = null
    try {
      tenantsRegistros = app.findRecordsByFilter('tenants', 'id != ""', '-created', 500, 0)
    } catch (_) {
      tenantsRegistros = null
    }
    if (planoCollection && tenantsRegistros) {
      let criadas = 0
      for (const t of tenantsRegistros) {
        for (const conta of PLANO_PADRAO) {
          const existentes = app.findRecordsByFilter(
            'plano_contas',
            `tenant_id = "${t.id}" && codigo = "${conta.codigo}"`,
            '',
            1,
            0,
          )
          if (existentes.length > 0) continue
          const r = new Record(planoCollection)
          r.set('tenant_id', t.id)
          r.set('codigo', conta.codigo)
          r.set('nome', conta.nome)
          r.set('tipo', conta.tipo)
          r.set('nivel', conta.nivel)
          r.set('ativa', true)
          app.save(r)
          criadas++
        }
      }
      console.log(`[0164] seed do plano de contas padrão concluído (${criadas} contas criadas)`)
    }
  },
  (app) => {
    const apagar = (nome) => {
      try {
        app.delete(app.findCollectionByNameOrId(nome))
        console.log(`[0164-down] ${nome} removida`)
      } catch (_) {
        /* já não existe */
      }
    }
    // plano_contas e lancamentos_contabeis são pré-existentes — não removidas
    apagar('contabil_fechamentos')
    apagar('contabil_extratos')
  },
)

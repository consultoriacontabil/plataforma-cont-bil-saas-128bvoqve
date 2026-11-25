/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0161 — Fatia 1 do modelo Makro.
 *
 * 1. `tarefas_equipe`: CRUD de tarefas internas do escritório
 *    (painel de tarefas da equipe), isolado por tenant.
 * 2. `agenda_tributaria`: catálogo de obrigações legais por perfil de
 *    empresa (Simples Nacional, Lucro Presumido etc.), com vencimento
 *    típico dentro do padrão brasileiro conhecido. Semeadura idempotente
 *    por (tenant_id, perfil, codigo): se já existir, pula.
 *
 * Regras: leitura e escrita restritas a membros do tenant; delete de
 * tarefas restrito a administrador. Catálogo da agenda: delete só admin.
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
    const usersId = '_pb_users_auth_'
    const empresasId = app.findCollectionByNameOrId('empresas').id

    // ------------------------------------------------------------------
    // 1. tarefas_equipe
    // ------------------------------------------------------------------
    let colecaoTarefas
    try {
      colecaoTarefas = app.findCollectionByNameOrId('tarefas_equipe')
      console.log('[0161] tarefas_equipe já existe — mantendo estrutura atual')
    } catch (_) {
      colecaoTarefas = new Collection({
        name: 'tarefas_equipe',
        type: 'base',
        listRule: REGRAS_TENANT_LEITURA,
        viewRule: REGRAS_TENANT_LEITURA,
        createRule: REGRAS_TENANT_ESCRITA,
        updateRule: REGRAS_TENANT_ESCRITA,
        deleteRule: REGRAS_TENANT_ADMIN,
        fields: [
          {
            name: 'tenant_id',
            type: 'relation',
            required: true,
            collectionId: tenantsId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'titulo', type: 'text', required: true },
          { name: 'descricao', type: 'text', required: false },
          {
            name: 'responsavel_id',
            type: 'relation',
            required: false,
            collectionId: usersId,
            maxSelect: 1,
          },
          {
            name: 'empresa_id',
            type: 'relation',
            required: false,
            collectionId: empresasId,
            maxSelect: 1,
          },
          { name: 'vencimento', type: 'date', required: false },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['pendente', 'em_andamento', 'concluida'],
          },
          {
            name: 'prioridade',
            type: 'select',
            required: false,
            maxSelect: 1,
            values: ['baixa', 'media', 'alta'],
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_tarefas_equipe_tenant ON tarefas_equipe (tenant_id)',
          'CREATE INDEX idx_tarefas_equipe_status ON tarefas_equipe (tenant_id, status)',
          'CREATE INDEX idx_tarefas_equipe_resp ON tarefas_equipe (responsavel_id)',
        ],
      })
      app.save(colecaoTarefas)
      console.log('[0161] tarefas_equipe criada (painel de tarefas da equipe)')
    }

    // ------------------------------------------------------------------
    // 2. agenda_tributaria (catálogo por perfil de empresa)
    // ------------------------------------------------------------------
    let colecaoAgenda
    try {
      colecaoAgenda = app.findCollectionByNameOrId('agenda_tributaria')
      console.log('[0161] agenda_tributaria já existe — mantendo estrutura atual')
    } catch (_) {
      colecaoAgenda = new Collection({
        name: 'agenda_tributaria',
        type: 'base',
        listRule: REGRAS_TENANT_LEITURA,
        viewRule: REGRAS_TENANT_LEITURA,
        createRule: REGRAS_TENANT_ESCRITA,
        updateRule: REGRAS_TENANT_ESCRITA,
        deleteRule: REGRAS_TENANT_ADMIN,
        fields: [
          {
            name: 'tenant_id',
            type: 'relation',
            required: true,
            collectionId: tenantsId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'codigo', type: 'text', required: true },
          {
            name: 'perfil',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['simples_nacional', 'lucro_presumido', 'lucro_real', 'mei', 'todas'],
          },
          { name: 'obrigacao', type: 'text', required: true },
          { name: 'departamento', type: 'text', required: true },
          {
            name: 'vencimento_dia',
            type: 'number',
            required: false,
            onlyInt: true,
          },
          {
            name: 'periodicidade',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['mensal', 'trimestral', 'anual'],
          },
          { name: 'mes_referencia', type: 'number', required: false, onlyInt: true },
          { name: 'observacao', type: 'text', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_agenda_trib_tenant ON agenda_tributaria (tenant_id)',
          'CREATE UNIQUE INDEX idx_agenda_trib_unico ON agenda_tributaria (tenant_id, perfil, codigo)',
        ],
      })
      app.save(colecaoAgenda)
      console.log('[0161] agenda_tributaria criada (catálogo por perfil de empresa)')
    }

    // ------------------------------------------------------------------
    // 3. Semeadura idempotente do catálogo padrão (vencimentos típicos BR)
    // ------------------------------------------------------------------
    const seed = (registro) => {
      const filtro = `tenant_id = "${registro.tenant_id}" && perfil = "${registro.perfil}" && codigo = "${registro.codigo}"`
      const existentes = app.findRecordsByFilter(colecaoAgenda.id, filtro, '', 1, 0)
      if (existentes.length > 0) return
      const rec = new Record(colecaoAgenda)
      rec.set('tenant_id', registro.tenant_id)
      rec.set('codigo', registro.codigo)
      rec.set('perfil', registro.perfil)
      rec.set('obrigacao', registro.obrigacao)
      rec.set('departamento', registro.departamento)
      rec.set('vencimento_dia', registro.vencimento_dia)
      rec.set('periodicidade', registro.periodicidade)
      if (registro.mes_referencia) rec.set('mes_referencia', registro.mes_referencia)
      if (registro.observacao) rec.set('observacao', registro.observacao)
      app.save(rec)
    }

    // Catálogo padrão brasileiro, focado na carteira Rumo
    // (maioria Simples Nacional / Lucro Presumido).
    const catalogo = [
      // Simples Nacional
      {
        perfil: 'simples_nacional',
        codigo: 'PGDAS_D',
        obrigacao: 'Apuração Simples Nacional (PGDAS-D)',
        departamento: 'Fiscal',
        vencimento_dia: 20,
        periodicidade: 'mensal',
        observacao: 'Apuração e declaração do mês anterior',
      },
      {
        perfil: 'simples_nacional',
        codigo: 'DAS',
        obrigacao: 'Guia DAS (Simples Nacional)',
        departamento: 'Fiscal',
        vencimento_dia: 20,
        periodicidade: 'mensal',
        observacao: 'Pagamento da guia consolidada',
      },
      {
        perfil: 'simples_nacional',
        codigo: 'FGTS_DCTF',
        obrigacao: 'FGTS e DCTFWeb (eSocial)',
        departamento: 'Pessoal',
        vencimento_dia: 20,
        periodicidade: 'mensal',
        observacao: 'Folha do mês anterior',
      },
      {
        perfil: 'simples_nacional',
        codigo: 'ESOCIAL_PERIODO',
        obrigacao: 'Envio de eventos periódicos eSocial (S-1200/S-1210)',
        departamento: 'Pessoal',
        vencimento_dia: 15,
        periodicidade: 'mensal',
        observacao: 'Folha do mês anterior',
      },
      {
        perfil: 'simples_nacional',
        codigo: 'DEFIS',
        obrigacao: 'DEFIS (Declaração de Informações Socioeconômicas e Fiscais)',
        departamento: 'Fiscal',
        vencimento_dia: 31,
        periodicidade: 'anual',
        mes_referencia: 3,
        observacao: 'Ano-calendário anterior',
      },
      {
        perfil: 'simples_nacional',
        codigo: 'DIRPF_PJ',
        obrigacao: 'Declaração de Imposto de Renda PJ (DITR)',
        departamento: 'Fiscal',
        vencimento_dia: 31,
        periodicidade: 'anual',
        mes_referencia: 5,
      },
      // Lucro Presumido
      {
        perfil: 'lucro_presumido',
        codigo: 'IRPJ_CSLL_PRESUMIDO',
        obrigacao: 'IRPJ e CSLL — Presumido (PIS/COFINS)',
        departamento: 'Fiscal',
        vencimento_dia: 20,
        periodicidade: 'mensal',
        observacao: 'Último dia útil do mês seguinte',
      },
      {
        perfil: 'lucro_presumido',
        codigo: 'SINTEGRA',
        obrigacao: 'Declarações estaduais (Sintegra/SEFISC)',
        departamento: 'Fiscal',
        vencimento_dia: 20,
        periodicidade: 'mensal',
      },
      {
        perfil: 'lucro_presumido',
        codigo: 'FGTS_DCTF',
        obrigacao: 'FGTS e DCTFWeb (eSocial)',
        departamento: 'Pessoal',
        vencimento_dia: 20,
        periodicidade: 'mensal',
      },
      {
        perfil: 'lucro_presumido',
        codigo: 'ESOCIAL_PERIODO',
        obrigacao: 'Envio de eventos periódicos eSocial (S-1200/S-1210)',
        departamento: 'Pessoal',
        vencimento_dia: 15,
        periodicidade: 'mensal',
      },
      {
        perfil: 'lucro_presumido',
        codigo: 'ECD',
        obrigacao: 'ECD (Escrituração Contábil Digital)',
        departamento: 'Contábil',
        vencimento_dia: 31,
        periodicidade: 'anual',
        mes_referencia: 5,
      },
      {
        perfil: 'lucro_presumido',
        codigo: 'ECF',
        obrigacao: 'ECF (Escrituração Fiscal Digital da Pessoa Jurídica)',
        departamento: 'Contábil',
        vencimento_dia: 31,
        periodicidade: 'anual',
        mes_referencia: 7,
      },
      // Lucro Real
      {
        perfil: 'lucro_real',
        codigo: 'IRPJ_TRIM_REAL',
        obrigacao: 'IRPJ/CSLL — Estimativa mensal ou trimestral',
        departamento: 'Fiscal',
        vencimento_dia: 20,
        periodicidade: 'mensal',
      },
      {
        perfil: 'lucro_real',
        codigo: 'ECD',
        obrigacao: 'ECD (Escrituração Contábil Digital)',
        departamento: 'Contábil',
        vencimento_dia: 31,
        periodicidade: 'anual',
        mes_referencia: 5,
      },
      {
        perfil: 'lucro_real',
        codigo: 'ECF',
        obrigacao: 'ECF (Escrituração Fiscal Digital da Pessoa Jurídica)',
        departamento: 'Contábil',
        vencimento_dia: 31,
        periodicidade: 'anual',
        mes_referencia: 7,
      },
      {
        perfil: 'lucro_real',
        codigo: 'ESOCIAL_PERIODO',
        obrigacao: 'Envio de eventos periódicos eSocial (S-1200/S-1210)',
        departamento: 'Pessoal',
        vencimento_dia: 15,
        periodicidade: 'mensal',
      },
      {
        perfil: 'lucro_real',
        codigo: 'FGTS_DCTF',
        obrigacao: 'FGTS e DCTFWeb (eSocial)',
        departamento: 'Pessoal',
        vencimento_dia: 20,
        periodicidade: 'mensal',
      },
      // MEI
      {
        perfil: 'mei',
        codigo: 'DAS_MEI',
        obrigacao: 'DAS-MEI (Simples Nacional MEI)',
        departamento: 'Fiscal',
        vencimento_dia: 20,
        periodicidade: 'mensal',
      },
      {
        perfil: 'mei',
        codigo: 'DASN_SIMEI',
        obrigacao: 'DASN-SIMEI (Declaração Anual do MEI)',
        departamento: 'Fiscal',
        vencimento_dia: 31,
        periodicidade: 'anual',
        mes_referencia: 5,
      },
      // Todas
      {
        perfil: 'todas',
        codigo: 'CND',
        obrigacao: 'Controle de Certidões Negativas (CNDs)',
        departamento: 'Administrar',
        vencimento_dia: null,
        periodicidade: 'mensal',
        observacao: 'Renovação conforme validade de cada certidão',
      },
      {
        perfil: 'todas',
        codigo: 'PGT_DARE',
        obrigacao: 'Guias de pagamentos estaduais/municipais',
        departamento: 'Fiscal',
        vencimento_dia: 20,
        periodicidade: 'mensal',
      },
    ]

    const todos = app.findRecordsByFilter('tenants', '', '', 0, 0)
    let semeadas = 0
    for (const tenant of todos) {
      for (const item of catalogo) {
        const antes = semeadas
        seed({ ...item, tenant_id: tenant.id })
        semeadas += 1
      }
    }
    console.log(
      `[0161] catálogo padrão da agenda tributária verificado em ${todos.length} tenant(s)`,
    )
  },
  (app) => {
    // Down: apaga apenas as coleções criadas aqui (dados de seed vão junto).
    const apagar = (nome) => {
      try {
        app.delete(app.findCollectionByNameOrId(nome))
        console.log(`[0161-down] ${nome} removida`)
      } catch (_) {
        /* já não existe */
      }
    }
    apagar('agenda_tributaria')
    apagar('tarefas_equipe')
  },
)

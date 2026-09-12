/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const empresas = app.findCollectionByNameOrId('empresas')
    const funcionarios = app.findCollectionByNameOrId('funcionarios')
    const tenantsId = tenants.id
    const empresasId = empresas.id
    const funcionariosId = funcionarios.id

    // 1. Criar coleção 'verbas_catalogo' (Catálogo de verbas/eventos remuneratórios e descontos da empresa)
    if (!app.hasTable('verbas_catalogo')) {
      const verbasCatalogo = new Collection({
        name: 'verbas_catalogo',
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
          { name: 'codigo', type: 'text', required: true }, // ex: "1020", "0050", "2010"
          { name: 'descricao', type: 'text', required: true },
          {
            name: 'tipo',
            type: 'select',
            required: true,
            values: ['provento', 'desconto'],
            maxSelect: 1,
          },
          { name: 'rubrica_esocial', type: 'text', required: true }, // ex: "1000", "1020", "1040", "9901", "9902", "9903", "9904"
          {
            name: 'unidade',
            type: 'select',
            required: true,
            values: ['horas', 'dias', 'valor_fixo', 'percentual'],
            maxSelect: 1,
          },
          { name: 'valor_padrao', type: 'number' }, // percentual ou valor base sugerido
          { name: 'incide_inss', type: 'bool' },
          { name: 'incide_irrf', type: 'bool' },
          { name: 'incide_fgts', type: 'bool' },
          { name: 'integra_salario_contrib', type: 'bool' },
          { name: 'reflexo_dsr', type: 'bool' },
          { name: 'reflexo_ferias_13', type: 'bool' },
          { name: 'ativo', type: 'bool' },
          { name: 'observacoes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_verbas_cat_tenant_emp ON verbas_catalogo (tenant_id, empresa)',
          'CREATE INDEX idx_verbas_cat_codigo ON verbas_catalogo (codigo)',
          'CREATE INDEX idx_verbas_cat_tipo ON verbas_catalogo (tipo)',
        ],
      })
      app.save(verbasCatalogo)
    }

    const verbasCatalogoCol = app.findCollectionByNameOrId('verbas_catalogo')
    const verbasCatalogoId = verbasCatalogoCol.id

    // 2. Criar coleção 'verbas_lancamentos' (Lançamentos de verbas por funcionário e competência)
    if (!app.hasTable('verbas_lancamentos')) {
      const verbasLancamentos = new Collection({
        name: 'verbas_lancamentos',
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
            name: 'verba',
            type: 'relation',
            required: true,
            collectionId: verbasCatalogoId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'competencia', type: 'text', required: true }, // MM/AAAA
          { name: 'quantidade', type: 'number' }, // Ex: 10 horas, 2 dias, 1 (fixo)
          { name: 'aliquota_percentual', type: 'number' }, // Ex: 50% (HE), 20% (noturno), 6% (VT)
          { name: 'valor_calculado', type: 'number', required: true },
          { name: 'referencia_detalhe', type: 'text' }, // Ex: "10h a 50% (Salário R$ 12.500/220h)"
          { name: 'alertas_clt', type: 'json' }, // Alertas de conformidade gerados
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_verbas_lanc_tenant_emp_comp ON verbas_lancamentos (tenant_id, empresa, competencia)',
          'CREATE INDEX idx_verbas_lanc_func_comp ON verbas_lancamentos (funcionario, competencia)',
          'CREATE INDEX idx_verbas_lanc_verba ON verbas_lancamentos (verba)',
        ],
      })
      app.save(verbasLancamentos)
    }
  },
  (app) => {
    try {
      const vl = app.findCollectionByNameOrId('verbas_lancamentos')
      app.delete(vl)
    } catch (_) {}

    try {
      const vc = app.findCollectionByNameOrId('verbas_catalogo')
      app.delete(vc)
    } catch (_) {}
  },
)

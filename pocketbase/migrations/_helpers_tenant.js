/// <reference path="../pb_data/types.d.ts" />

/**
 * Helpers centralizados para collections RLS por tenant (padrão 0161/0162).
 * Importados pelas migrations que criam coleções do modelo Makro.
 */

const REGRAS_TENANT_LEITURA =
  "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id"
const REGRAS_TENANT_ESCRITA =
  "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'"
const REGRAS_TENANT_ADMIN =
  "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && @request.auth.tenant_members_via_user_id.perfil ?= 'administrador'"

const CAMPO_TENANT = {
  name: 'tenant_id',
  type: 'relation',
  required: true,
  collectionId: null, // preenchido pelo chamador com o id da collection tenants
  cascadeDelete: true,
  maxSelect: 1,
}

const CAMPO_EMPRESA = {
  name: 'empresa_id',
  type: 'relation',
  required: true,
  collectionId: null,
  maxSelect: 1,
}

const AUTODATAS = [
  { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
  { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
]

/**
 * Cria (ou mantém) uma collection com regras RLS por tenant.
 * `app` e `Collection` vêm do escopo das migrations.
 */
function criarCollectionTenant(app, Collection, { nome, campos, indexes, idTenants, idEmpresas }) {
  try {
    const existente = app.findCollectionByNameOrId(nome)
    console.log(`[tenant-helper] ${nome} já existe — mantendo estrutura atual`)
    return existente
  } catch (_) {
    const camposResolvidos = campos.map((c) => {
      if (c.name === 'tenant_id') return { ...c, collectionId: idTenants }
      if (c.name === 'empresa_id') return { ...c, collectionId: idEmpresas }
      return c
    })
    const colecao = new Collection({
      name: nome,
      type: 'base',
      listRule: REGRAS_TENANT_LEITURA,
      viewRule: REGRAS_TENANT_LEITURA,
      createRule: REGRAS_TENANT_ESCRITA,
      updateRule: REGRAS_TENANT_ESCRITA,
      deleteRule: REGRAS_TENANT_ADMIN,
      fields: camposResolvidos,
      indexes: indexes || [],
    })
    app.save(colecao)
    console.log(`[tenant-helper] ${nome} criada`)
    return colecao
  }
}

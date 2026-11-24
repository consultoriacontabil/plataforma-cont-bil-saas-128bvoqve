/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0156 — Fecha o auto-cadastro e cria a coleção de convites.
 *
 * MOTIVO (24/11/2026)
 * `users.createRule` estava vazio (""), o que no PocketBase significa "qualquer
 * pessoa, inclusive sem autenticação, pode criar conta". Combinado com o hook
 * tenant_signup (que criava tenant + vínculo de administrador a cada usuário
 * novo), qualquer visitante do /signup virava administrador de um escritório.
 *
 * O QUE ESTA MIGRATION FAZ
 * 1) Cria a coleção `convites`: o único caminho para entrar numa organização
 *    passa a ser um convite emitido por administrador/contador.
 * 2) Fecha `users.createRule` para `null` (somente servidor/painel cria conta).
 *    Login, refresh de token e recuperação de senha NÃO são afetados.
 *
 * REVERSÃO
 * Devolve a regra antiga ("" = público) e remove `convites`.
 * Reverter reabre o auto-cadastro: só faça de forma consciente.
 */

migrate(
  (app) => {
    const tenantsId = app.findCollectionByNameOrId('tenants').id

    let jaExiste = true
    try {
      app.findCollectionByNameOrId('convites')
    } catch (_) {
      jaExiste = false
    }

    if (!jaExiste) {
      const convites = new Collection({
        name: 'convites',
        type: 'base',
        fields: [
          {
            name: 'tenant_id',
            type: 'relation',
            required: true,
            collectionId: tenantsId,
            maxSelect: 1,
            cascadeDelete: true,
          },
          { name: 'email', type: 'email', required: true },
          { name: 'nome', type: 'text', required: false, max: 0, min: 0 },
          {
            name: 'perfil',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['administrador', 'contador', 'auxiliar', 'consultor', 'cliente'],
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['pendente', 'aceito', 'cancelado', 'expirado'],
          },
          { name: 'token', type: 'text', required: false, max: 0, min: 0, hidden: true },
          { name: 'aceito_em', type: 'date', required: false },
          {
            name: 'usuario_id',
            type: 'relation',
            required: false,
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
            cascadeDelete: false,
          },
          {
            name: 'convidado_por',
            type: 'relation',
            required: false,
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
            cascadeDelete: false,
          },
          { name: 'expira_em', type: 'date', required: false },
        ],
        listRule:
          "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id",
        viewRule:
          "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id",
        createRule:
          "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')",
        updateRule:
          "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')",
        deleteRule:
          "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')",
      })
      app.save(convites)

      const criada = app.findCollectionByNameOrId('convites')
      criada.addIndex('idx_convites_email_status', false, 'email, status', '')
      criada.addIndex('idx_convites_tenant', false, 'tenant_id', '')
      app.save(criada)
      console.log('[0156] coleção convites criada')
    } else {
      console.log('[0156] coleção convites já existia')
    }

    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.createRule = null
    app.save(users)
    console.log('[0156] users.createRule fechado (somente servidor/painel cria conta)')
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.createRule = ''
    app.save(users)

    try {
      app.delete(app.findCollectionByNameOrId('convites'))
    } catch (_) {}
  },
)

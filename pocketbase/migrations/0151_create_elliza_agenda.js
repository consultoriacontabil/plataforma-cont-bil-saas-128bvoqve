/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0151 — agenda de compromissos da Elliza.
 *
 * Havia chamadas `GET /api/collections/elliza_agenda/records` retornando 404
 * porque a coleção nunca foi criada. Nenhuma coleção existente cobre agenda
 * de compromissos, então criamos uma coleção mínima, isolada por tenant.
 *
 * Regras: leitura e escrita restritas a membros do tenant (perfil que não seja
 * `cliente`); delete restrito a administrador.
 */
migrate(
  (app) => {
    const tenantsId = app.findCollectionByNameOrId('tenants').id

    const collection = new Collection({
      name: 'elliza_agenda',
      type: 'base',
      listRule:
        "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id",
      viewRule:
        "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id",
      createRule:
        "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'",
      updateRule:
        "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'",
      deleteRule:
        "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && @request.auth.tenant_members_via_user_id.perfil ?= 'administrador'",
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
        { name: 'data_hora', type: 'date', required: true },
        {
          name: 'status',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['agendado', 'concluido', 'cancelado'],
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_elliza_agenda_tenant ON elliza_agenda (tenant_id)',
        'CREATE INDEX idx_elliza_agenda_data ON elliza_agenda (data_hora)',
      ],
    })

    app.save(collection)
    console.log('[0151] elliza_agenda criada (agenda de compromissos por tenant)')
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('elliza_agenda'))
  },
)

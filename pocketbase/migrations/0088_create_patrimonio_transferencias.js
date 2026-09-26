/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Atualizar a coleção 'ativos' com campos de localização física
    try {
      const ativosCol = app.findCollectionByNameOrId('ativos')

      if (!ativosCol.fields.getByName('setor_localizacao')) {
        ativosCol.fields.add(
          new TextField({
            name: 'setor_localizacao',
            required: false,
          }),
        )
      }

      if (!ativosCol.fields.getByName('filial_unidade')) {
        ativosCol.fields.add(
          new TextField({
            name: 'filial_unidade',
            required: false,
          }),
        )
      }

      if (!ativosCol.fields.getByName('responsavel_bem')) {
        ativosCol.fields.add(
          new TextField({
            name: 'responsavel_bem',
            required: false,
          }),
        )
      }

      app.save(ativosCol)
      console.log('[MIGRATION_0088] Campos de localização física adicionados à coleção ativos.')
    } catch (err) {
      console.log('[MIGRATION_0088] Aviso ao atualizar coleção ativos:', err)
    }

    // 2. Criar coleção 'patrimonio_transferencias'
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const ativosCol = app.findCollectionByNameOrId('ativos')
    const usersCol = app.findCollectionByNameOrId('users')

    const transferenciasCol = new Collection({
      name: 'patrimonio_transferencias',
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
          collectionId: tenantsCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'empresa',
          type: 'relation',
          required: true,
          collectionId: empresasCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'ativo',
          type: 'relation',
          required: true,
          collectionId: ativosCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'data_transferencia',
          type: 'date',
          required: true,
        },
        {
          name: 'origem_setor',
          type: 'text',
        },
        {
          name: 'origem_filial',
          type: 'text',
        },
        {
          name: 'origem_responsavel',
          type: 'text',
        },
        {
          name: 'destino_setor',
          type: 'text',
          required: true,
        },
        {
          name: 'destino_filial',
          type: 'text',
        },
        {
          name: 'destino_responsavel',
          type: 'text',
          required: true,
        },
        {
          name: 'motivo',
          type: 'text',
        },
        {
          name: 'observacao',
          type: 'text',
        },
        {
          name: 'usuario_id',
          type: 'relation',
          collectionId: usersCol.id,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_patr_transf_ativo ON patrimonio_transferencias (ativo)',
        'CREATE INDEX idx_patr_transf_empresa ON patrimonio_transferencias (empresa)',
        'CREATE INDEX idx_patr_transf_tenant ON patrimonio_transferencias (tenant_id)',
        'CREATE INDEX idx_patr_transf_data ON patrimonio_transferencias (data_transferencia DESC)',
      ],
    })
    app.save(transferenciasCol)
    console.log('[MIGRATION_0088] Coleção patrimonio_transferencias criada com sucesso.')
  },
  (app) => {
    try {
      const transCol = app.findCollectionByNameOrId('patrimonio_transferencias')
      app.delete(transCol)
    } catch (_) {}

    try {
      const ativosCol = app.findCollectionByNameOrId('ativos')
      if (ativosCol.fields.getByName('setor_localizacao')) {
        ativosCol.fields.removeByName('setor_localizacao')
      }
      if (ativosCol.fields.getByName('filial_unidade')) {
        ativosCol.fields.removeByName('filial_unidade')
      }
      if (ativosCol.fields.getByName('responsavel_bem')) {
        ativosCol.fields.removeByName('responsavel_bem')
      }
      app.save(ativosCol)
    } catch (_) {}
  },
)

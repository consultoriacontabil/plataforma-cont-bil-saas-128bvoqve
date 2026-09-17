/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Adicionar o campo modo_offline (bool) na collection tenants
    // Regra: padrão falso (offline OFF)
    // Atenção: em PocketBase booleans não devem ser marcados com required: true pois false é considerado valor em branco.
    const tenants = app.findCollectionByNameOrId('tenants')

    if (!tenants.fields.getByName('modo_offline')) {
      tenants.fields.add(
        new BoolField({
          name: 'modo_offline',
          required: false,
        }),
      )
    }

    app.save(tenants)

    // Garantir que registros existentes tenham modo_offline = false (padrão desligado)
    try {
      app
        .db()
        .newQuery('UPDATE tenants SET modo_offline = FALSE WHERE modo_offline IS NULL')
        .execute()
    } catch (_) {}
  },
  (app) => {
    try {
      const tenants = app.findCollectionByNameOrId('tenants')
      if (tenants.fields.getByName('modo_offline')) {
        tenants.fields.removeByName('modo_offline')
      }
      app.save(tenants)
    } catch (_) {}
  },
)

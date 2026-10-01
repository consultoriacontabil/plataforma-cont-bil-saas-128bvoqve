/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const guias = app.findCollectionByNameOrId('guias_pagamentos')
    const origemField = guias.fields.getByName('origem')
    if (origemField && origemField.values) {
      if (!origemField.values.includes('integra_contador')) {
        origemField.values.push('integra_contador')
        app.save(guias)
      }
    }

    const ecac = app.findCollectionByNameOrId('ecac_comunicacoes')
    const origemCapturaField = ecac.fields.getByName('origem_captura')
    if (origemCapturaField && origemCapturaField.values) {
      if (!origemCapturaField.values.includes('oficial_integra_contador')) {
        origemCapturaField.values.push('oficial_integra_contador')
        app.save(ecac)
      }
    }
  },
  (app) => {
    // rollback
  },
)

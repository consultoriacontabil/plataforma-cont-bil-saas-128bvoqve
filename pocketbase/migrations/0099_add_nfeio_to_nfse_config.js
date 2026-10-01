/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0099:
 * Estende nfse_config para suportar provedor 'nfeio':
 * - Atualiza select provedor_fiscal com valores: ['governacional', 'betha', 'ginfes', 'nfeio']
 * - Adiciona nfeio_api_key (text)
 * - Adiciona nfeio_company_id (text)
 */
migrate(
  (app) => {
    const nfseConfig = app.findCollectionByNameOrId('nfse_config')

    // Atualizar campo provedor_fiscal para incluir 'nfeio'
    const provField = nfseConfig.fields.getByName('provedor_fiscal')
    if (provField) {
      provField.values = ['governacional', 'betha', 'ginfes', 'nfeio']
    } else {
      nfseConfig.fields.add(
        new SelectField({
          name: 'provedor_fiscal',
          required: false,
          values: ['governacional', 'betha', 'ginfes', 'nfeio'],
          maxSelect: 1,
        }),
      )
    }

    if (!nfseConfig.fields.getByName('nfeio_api_key')) {
      nfseConfig.fields.add(
        new TextField({
          name: 'nfeio_api_key',
          required: false,
        }),
      )
    }

    if (!nfseConfig.fields.getByName('nfeio_company_id')) {
      nfseConfig.fields.add(
        new TextField({
          name: 'nfeio_company_id',
          required: false,
        }),
      )
    }

    app.save(nfseConfig)
  },
  (app) => {
    try {
      const nfseConfig = app.findCollectionByNameOrId('nfse_config')
      const provField = nfseConfig.fields.getByName('provedor_fiscal')
      if (provField) {
        provField.values = ['governacional', 'betha', 'ginfes']
      }
      nfseConfig.fields.removeByName('nfeio_api_key')
      nfseConfig.fields.removeByName('nfeio_company_id')
      app.save(nfseConfig)
    } catch (_) {}
  },
)

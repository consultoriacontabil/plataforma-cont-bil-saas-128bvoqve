/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Atualizar nfse_config para suportar Provedores Fiscais e Credenciais
    const nfseConfig = app.findCollectionByNameOrId('nfse_config')

    if (!nfseConfig.fields.getByName('provedor_fiscal')) {
      nfseConfig.fields.add(
        new SelectField({
          name: 'provedor_fiscal',
          required: false,
          values: ['governacional', 'betha', 'ginfes'],
          maxSelect: 1,
        }),
      )
    }

    if (!nfseConfig.fields.getByName('provedor_ambiente')) {
      nfseConfig.fields.add(
        new SelectField({
          name: 'provedor_ambiente',
          required: false,
          values: ['producao', 'homologacao'],
          maxSelect: 1,
        }),
      )
    }

    if (!nfseConfig.fields.getByName('govbr_client_id')) {
      nfseConfig.fields.add(
        new TextField({
          name: 'govbr_client_id',
          required: false,
        }),
      )
    }

    if (!nfseConfig.fields.getByName('govbr_client_secret')) {
      nfseConfig.fields.add(
        new TextField({
          name: 'govbr_client_secret',
          required: false,
        }),
      )
    }

    if (!nfseConfig.fields.getByName('govbr_api_url')) {
      nfseConfig.fields.add(
        new TextField({
          name: 'govbr_api_url',
          required: false,
        }),
      )
    }

    if (!nfseConfig.fields.getByName('provedor_municipio_ibge')) {
      nfseConfig.fields.add(
        new TextField({
          name: 'provedor_municipio_ibge',
          required: false,
        }),
      )
    }

    if (!nfseConfig.fields.getByName('ultimo_teste_provedor')) {
      nfseConfig.fields.add(
        new JSONField({
          name: 'ultimo_teste_provedor',
          required: false,
        }),
      )
    }

    if (!nfseConfig.fields.getByName('ultimo_teste_evolution')) {
      nfseConfig.fields.add(
        new JSONField({
          name: 'ultimo_teste_evolution',
          required: false,
        }),
      )
    }

    app.save(nfseConfig)

    // 2. Atualizar nfse_notas_emitidas para registrar provedor, url de consulta e erros de transmissão
    const nfseNotas = app.findCollectionByNameOrId('nfse_notas_emitidas')

    if (!nfseNotas.fields.getByName('provedor_usado')) {
      nfseNotas.fields.add(
        new TextField({
          name: 'provedor_usado',
          required: false,
        }),
      )
    }

    if (!nfseNotas.fields.getByName('url_consulta_nfse')) {
      nfseNotas.fields.add(
        new TextField({
          name: 'url_consulta_nfse',
          required: false,
        }),
      )
    }

    if (!nfseNotas.fields.getByName('protocolo_autorizacao')) {
      nfseNotas.fields.add(
        new TextField({
          name: 'protocolo_autorizacao',
          required: false,
        }),
      )
    }

    if (!nfseNotas.fields.getByName('ged_documento_id')) {
      const docsCol = app.findCollectionByNameOrId('documentos')
      nfseNotas.fields.add(
        new RelationField({
          name: 'ged_documento_id',
          required: false,
          collectionId: docsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    app.save(nfseNotas)

    // 3. Atualizar nfse_solicitacoes para suportar status de erro e retentativa
    // Coleção já possui status: ['em_analise', 'aprovada', 'emitida', 'rejeitada', 'cancelada']
    // Atualizar os values do status para incluir 'erro_emissao'
    const nfseSol = app.findCollectionByNameOrId('nfse_solicitacoes')
    const statusField = nfseSol.fields.getByName('status')
    if (statusField) {
      statusField.values = [
        'em_analise',
        'aprovada',
        'emitida',
        'rejeitada',
        'cancelada',
        'erro_emissao',
      ]
    }

    if (!nfseSol.fields.getByName('ultimo_erro_emissao')) {
      nfseSol.fields.add(
        new TextField({
          name: 'ultimo_erro_emissao',
          required: false,
        }),
      )
    }

    if (!nfseSol.fields.getByName('tentativas_emissao')) {
      nfseSol.fields.add(
        new NumberField({
          name: 'tentativas_emissao',
          required: false,
        }),
      )
    }

    app.save(nfseSol)
  },
  (app) => {
    // Reverter campos se necessário
    try {
      const nfseConfig = app.findCollectionByNameOrId('nfse_config')
      nfseConfig.fields.removeByName('provedor_fiscal')
      nfseConfig.fields.removeByName('provedor_ambiente')
      nfseConfig.fields.removeByName('govbr_client_id')
      nfseConfig.fields.removeByName('govbr_client_secret')
      nfseConfig.fields.removeByName('govbr_api_url')
      nfseConfig.fields.removeByName('provedor_municipio_ibge')
      nfseConfig.fields.removeByName('ultimo_teste_provedor')
      nfseConfig.fields.removeByName('ultimo_teste_evolution')
      app.save(nfseConfig)
    } catch (_) {}
  },
)

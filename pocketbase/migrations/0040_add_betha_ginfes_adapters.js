/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const nfseConfig = app.findCollectionByNameOrId('nfse_config')

    // 1. Campos específicos para Betha Sistemas no nfse_config
    if (!nfseConfig.fields.getByName('betha_usuario')) {
      nfseConfig.fields.add(
        new TextField({
          name: 'betha_usuario',
          required: false,
        }),
      )
    }

    if (!nfseConfig.fields.getByName('betha_senha_token')) {
      nfseConfig.fields.add(
        new TextField({
          name: 'betha_senha_token',
          required: false,
        }),
      )
    }

    if (!nfseConfig.fields.getByName('betha_api_url')) {
      nfseConfig.fields.add(
        new TextField({
          name: 'betha_api_url',
          required: false,
        }),
      )
    }

    // 2. Campos específicos para Ginfes no nfse_config
    if (!nfseConfig.fields.getByName('ginfes_usuario')) {
      nfseConfig.fields.add(
        new TextField({
          name: 'ginfes_usuario',
          required: false,
        }),
      )
    }

    if (!nfseConfig.fields.getByName('ginfes_senha')) {
      nfseConfig.fields.add(
        new TextField({
          name: 'ginfes_senha',
          required: false,
        }),
      )
    }

    if (!nfseConfig.fields.getByName('ginfes_api_url')) {
      nfseConfig.fields.add(
        new TextField({
          name: 'ginfes_api_url',
          required: false,
        }),
      )
    }

    // 3. Configurações fiscais por empresa (JSON para override de provedor, credenciais e webservice por empresa)
    if (!nfseConfig.fields.getByName('provedores_empresas_json')) {
      nfseConfig.fields.add(
        new JSONField({
          name: 'provedores_empresas_json',
          required: false,
        }),
      )
    }

    app.save(nfseConfig)

    // 4. Seed de exemplo com empresa usando Betha e empresa usando Ginfes
    // Encontrar empresas existentes
    let defaultTenant = null
    try {
      const tenants = app.findRecordsByFilter('tenants', '', 'created', 1, 0)
      if (tenants && tenants.length > 0) {
        defaultTenant = tenants[0]
      }
    } catch (_) {}

    if (defaultTenant) {
      let cfgRecord = null
      try {
        cfgRecord = app.findFirstRecordByData('nfse_config', 'tenant_id', defaultTenant.id)
      } catch (_) {}

      // Buscar empresas
      let inovatech = null
      let graosSul = null
      let logPrime = null
      try {
        inovatech = app.findFirstRecordByData('empresas', 'cnpj', '33.456.789/0001-12')
      } catch (_) {}
      try {
        graosSul = app.findFirstRecordByData('empresas', 'cnpj', '18.902.345/0001-88')
      } catch (_) {}
      try {
        logPrime = app.findFirstRecordByData('empresas', 'cnpj', '07.654.321/0001-44')
      } catch (_) {}

      if (cfgRecord) {
        // Mapa por empresa com Betha e Ginfes parametrizados (públicos/padrão ABRASF, sem segredos reais)
        const provedoresEmpresas = {}

        if (inovatech) {
          provedoresEmpresas[inovatech.id] = {
            provedor: 'governacional',
            ambiente: 'producao',
            municipioIbge: '3550308', // São Paulo
            apiUrl: 'https://nfse.receita.fazenda.gov.br/portalnfse',
            clientId: '',
            clientSecret: '',
          }
        }

        if (graosSul) {
          // Curitiba ou município Betha
          provedoresEmpresas[graosSul.id] = {
            provedor: 'betha',
            ambiente: 'producao',
            municipioIbge: '4106902', // Curitiba/PR
            apiUrl: 'https://e-gov.betha.com.br/e-nota-contribuinte-ws/nfseWS',
            usuario: 'betha_graos_sul',
            senhaToken: '',
          }
        }

        if (logPrime) {
          // Campinas ou município Ginfes
          provedoresEmpresas[logPrime.id] = {
            provedor: 'ginfes',
            ambiente: 'producao',
            municipioIbge: '3509502', // Campinas/SP
            apiUrl: 'https://homologacao.ginfes.com.br/ServiceGinfesImpl',
            usuario: 'ginfes_logprime',
            senha: '',
          }
        }

        cfgRecord.set('provedores_empresas_json', provedoresEmpresas)
        // Defaults gerais nos novos campos
        cfgRecord.set('betha_api_url', 'https://e-gov.betha.com.br/e-nota-contribuinte-ws/nfseWS')
        cfgRecord.set('ginfes_api_url', 'https://homologacao.ginfes.com.br/ServiceGinfesImpl')
        app.save(cfgRecord)
      }
    }
  },
  (app) => {
    try {
      const nfseConfig = app.findCollectionByNameOrId('nfse_config')
      nfseConfig.fields.removeByName('betha_usuario')
      nfseConfig.fields.removeByName('betha_senha_token')
      nfseConfig.fields.removeByName('betha_api_url')
      nfseConfig.fields.removeByName('ginfes_usuario')
      nfseConfig.fields.removeByName('ginfes_senha')
      nfseConfig.fields.removeByName('ginfes_api_url')
      nfseConfig.fields.removeByName('provedores_empresas_json')
      app.save(nfseConfig)
    } catch (_) {}
  },
)

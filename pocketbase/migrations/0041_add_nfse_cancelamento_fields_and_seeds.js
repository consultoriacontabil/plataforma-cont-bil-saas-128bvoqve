/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const nfseNotas = app.findCollectionByNameOrId('nfse_notas_emitidas')
    const nfseConfig = app.findCollectionByNameOrId('nfse_config')

    // 1. Novos campos em nfse_notas_emitidas para Cancelamento e Substituição
    if (!nfseNotas.fields.getByName('codigo_cancelamento')) {
      nfseNotas.fields.add(
        new TextField({
          name: 'codigo_cancelamento',
          required: false,
        }),
      )
    }

    if (!nfseNotas.fields.getByName('data_cancelamento')) {
      nfseNotas.fields.add(
        new DateField({
          name: 'data_cancelamento',
          required: false,
        }),
      )
    }

    if (!nfseNotas.fields.getByName('cancelado_por')) {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      nfseNotas.fields.add(
        new RelationField({
          name: 'cancelado_por',
          required: false,
          collectionId: usersCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    if (!nfseNotas.fields.getByName('protocolo_cancelamento')) {
      nfseNotas.fields.add(
        new TextField({
          name: 'protocolo_cancelamento',
          required: false,
        }),
      )
    }

    if (!nfseNotas.fields.getByName('xml_cancelamento')) {
      nfseNotas.fields.add(
        new TextField({
          name: 'xml_cancelamento',
          required: false,
        }),
      )
    }

    if (!nfseNotas.fields.getByName('ged_cancelamento_doc_id')) {
      const docsCol = app.findCollectionByNameOrId('documentos')
      nfseNotas.fields.add(
        new RelationField({
          name: 'ged_cancelamento_doc_id',
          required: false,
          collectionId: docsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    if (!nfseNotas.fields.getByName('nota_substituta_id')) {
      nfseNotas.fields.add(
        new RelationField({
          name: 'nota_substituta_id',
          required: false,
          collectionId: nfseNotas.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    if (!nfseNotas.fields.getByName('nota_substituida_id')) {
      nfseNotas.fields.add(
        new RelationField({
          name: 'nota_substituida_id',
          required: false,
          collectionId: nfseNotas.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    app.save(nfseNotas)

    // 2. Novo campo em nfse_config para prazo municipal configurável de cancelamento (em dias)
    if (!nfseConfig.fields.getByName('prazo_dias_cancelamento')) {
      nfseConfig.fields.add(
        new NumberField({
          name: 'prazo_dias_cancelamento',
          required: false,
        }),
      )
    }
    app.save(nfseConfig)

    // 3. Atualizar configuração do tenant padrão com prazo padrão (ex: 30 dias)
    let defaultTenant = null
    try {
      const tenants = app.findRecordsByFilter('tenants', '', 'created', 1, 0)
      if (tenants && tenants.length > 0) {
        defaultTenant = tenants[0]
      }
    } catch (_) {}

    if (defaultTenant) {
      try {
        const cfg = app.findFirstRecordByData('nfse_config', 'tenant_id', defaultTenant.id)
        if (cfg) {
          cfg.set('prazo_dias_cancelamento', 30)
          app.save(cfg)
        }
      } catch (_) {}

      // 4. Semear notas fiscais autorizadas para Grãos do Sul (Betha) e LogPrime (Ginfes)
      // para permitir teste imediato dos 3 provedores na tela
      let graosSul = null
      let logPrime = null
      let inovatech = null
      let adminUser = null

      try {
        graosSul = app.findFirstRecordByData('empresas', 'cnpj', '18.902.345/0001-88')
      } catch (_) {}
      try {
        logPrime = app.findFirstRecordByData('empresas', 'cnpj', '07.654.321/0001-44')
      } catch (_) {}
      try {
        inovatech = app.findFirstRecordByData('empresas', 'cnpj', '33.456.789/0001-12')
      } catch (_) {}
      try {
        adminUser = app.findAuthRecordByEmail(
          '_pb_users_auth_',
          'rumo@rumoconsultoriacontabil.com.br',
        )
      } catch (_) {}

      // Atualizar a nota existente da Inovatech para registrar provedor_usado='governacional'
      try {
        const notaInovatech = app.findFirstRecordByData(
          'nfse_notas_emitidas',
          'numero_nota',
          2026001,
        )
        if (notaInovatech && !notaInovatech.getString('provedor_usado')) {
          notaInovatech.set('provedor_usado', 'governacional')
          app.save(notaInovatech)
        }
      } catch (_) {}

      // Semear nota para Grãos do Sul (Betha / Curitiba)
      if (graosSul) {
        let notaBetha = null
        try {
          notaBetha = app.findFirstRecordByData(
            'nfse_notas_emitidas',
            'codigo_verificacao',
            'BETH-77A1-44C2',
          )
        } catch (_) {}

        if (!notaBetha) {
          const novaBetha = new Record(nfseNotas)
          novaBetha.set('tenant_id', defaultTenant.id)
          novaBetha.set('empresa', graosSul.id)
          novaBetha.set('numero_nota', 4001)
          novaBetha.set('serie', 'E')
          novaBetha.set('codigo_verificacao', 'BETH-77A1-44C2')
          novaBetha.set('chave_acesso', '4126091890234500018856001000000400199228833')
          novaBetha.set('data_emissao', '2026-09-10 10:30:00.000Z')
          novaBetha.set('competencia', '2026-09')
          novaBetha.set('tomador_nome', 'Distribuidora Paranaense de Alimentos Ltda')
          novaBetha.set('tomador_documento', '76.543.210/0001-89')
          novaBetha.set('tomador_email', 'compras@distparanaense.com.br')
          novaBetha.set(
            'discriminacao_servicos',
            'Serviços de moagem especializada, seleção e torrefação de grãos de café arábica especial.',
          )
          novaBetha.set('codigo_servico_municipal', '14.05')
          novaBetha.set('valor_servicos', 4800.0)
          novaBetha.set('valor_deducoes', 0.0)
          novaBetha.set('valor_pis', 0.0)
          novaBetha.set('valor_cofins', 0.0)
          novaBetha.set('valor_inss', 0.0)
          novaBetha.set('valor_ir', 0.0)
          novaBetha.set('valor_csll', 0.0)
          novaBetha.set('valor_iss', 96.0)
          novaBetha.set('aliquota_iss', 2.0)
          novaBetha.set('valor_liquido', 4800.0)
          novaBetha.set('iss_retido', false)
          novaBetha.set('status', 'emitida')
          novaBetha.set('modo_emissao', 'simulacao')
          novaBetha.set('provedor_usado', 'betha')
          novaBetha.set('protocolo_autorizacao', 'PROT-BETH-20260910-001')
          novaBetha.set(
            'url_consulta_nfse',
            'https://e-gov.betha.com.br/e-nota/consultaNfse.faces?mun=4106902&num=4001&cod=BETH-77A1-44C2',
          )
          if (adminUser) novaBetha.set('emitido_por', adminUser.id)
          novaBetha.set('whatsapp_destinatario', '5541988887777')
          novaBetha.set('whatsapp_enviado_em', '2026-09-10 10:30:15.000Z')
          app.save(novaBetha)
        }
      }

      // Semear nota para LogPrime (Ginfes / Campinas)
      if (logPrime) {
        let notaGinfes = null
        try {
          notaGinfes = app.findFirstRecordByData(
            'nfse_notas_emitidas',
            'codigo_verificacao',
            'GINF-98B2-11D5',
          )
        } catch (_) {}

        if (!notaGinfes) {
          const novaGinfes = new Record(nfseNotas)
          novaGinfes.set('tenant_id', defaultTenant.id)
          novaGinfes.set('empresa', logPrime.id)
          novaGinfes.set('numero_nota', 8501)
          novaGinfes.set('serie', 'E')
          novaGinfes.set('codigo_verificacao', 'GINF-98B2-11D5')
          novaGinfes.set('chave_acesso', '3526090765432100014456001000000850111223344')
          novaGinfes.set('data_emissao', '2026-09-09 14:15:00.000Z')
          novaGinfes.set('competencia', '2026-09')
          novaGinfes.set('tomador_nome', 'Indústria Química Paulistana S/A')
          novaGinfes.set('tomador_documento', '45.678.901/0001-23')
          novaGinfes.set('tomador_email', 'contabilidade@quimicapaulistana.com.br')
          novaGinfes.set(
            'discriminacao_servicos',
            'Serviços de armazenagem e movimentação logística de insumos industriais com controle de lote e rastreabilidade.',
          )
          novaGinfes.set('codigo_servico_municipal', '11.04')
          novaGinfes.set('valor_servicos', 8500.0)
          novaGinfes.set('valor_deducoes', 0.0)
          novaGinfes.set('valor_pis', 55.25)
          novaGinfes.set('valor_cofins', 255.0)
          novaGinfes.set('valor_inss', 0.0)
          novaGinfes.set('valor_ir', 127.5)
          novaGinfes.set('valor_csll', 85.0)
          novaGinfes.set('valor_iss', 170.0)
          novaGinfes.set('aliquota_iss', 2.0)
          novaGinfes.set('valor_liquido', 7977.25)
          novaGinfes.set('iss_retido', false)
          novaGinfes.set('status', 'emitida')
          novaGinfes.set('modo_emissao', 'simulacao')
          novaGinfes.set('provedor_usado', 'ginfes')
          novaGinfes.set('protocolo_autorizacao', 'PROT-GINF-20260909-042')
          novaGinfes.set(
            'url_consulta_nfse',
            'https://visualizar.ginfes.com.br/nota?cod=GINF-98B2-11D5&num=8501&ibge=3509502',
          )
          if (adminUser) novaGinfes.set('emitido_por', adminUser.id)
          novaGinfes.set('whatsapp_destinatario', '5519977778888')
          novaGinfes.set('whatsapp_enviado_em', '2026-09-09 14:15:20.000Z')
          app.save(novaGinfes)
        }
      }
    }
  },
  (app) => {
    try {
      const nfseNotas = app.findCollectionByNameOrId('nfse_notas_emitidas')
      nfseNotas.fields.removeByName('codigo_cancelamento')
      nfseNotas.fields.removeByName('data_cancelamento')
      nfseNotas.fields.removeByName('cancelado_por')
      nfseNotas.fields.removeByName('protocolo_cancelamento')
      nfseNotas.fields.removeByName('xml_cancelamento')
      nfseNotas.fields.removeByName('ged_cancelamento_doc_id')
      nfseNotas.fields.removeByName('nota_substituta_id')
      nfseNotas.fields.removeByName('nota_substituida_id')
      app.save(nfseNotas)
    } catch (_) {}

    try {
      const nfseConfig = app.findCollectionByNameOrId('nfse_config')
      nfseConfig.fields.removeByName('prazo_dias_cancelamento')
      app.save(nfseConfig)
    } catch (_) {}
  },
)

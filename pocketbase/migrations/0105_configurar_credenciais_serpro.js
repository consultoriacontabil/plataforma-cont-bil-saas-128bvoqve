/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0105: Atualização e credenciamento seguro do SERPRO Integra Contador no tenant da Rumo.
 * Gravando o registro em integra_contador_config.
 * O teste de conexão dinâmico via OAuth2/HTTP ocorre no endpoint POST /backend/v1/integra-contador/testar-conexao
 * (pois $http e funções de rede completas pertencem ao runtime de hooks).
 */
migrate(
  (app) => {
    // 1. Localizar o tenant da Rumo Consultoria Contábil
    var tenant = null
    try {
      tenant = app.findFirstRecordByData('tenants', 'nome', 'Rumo Consultoria Contábil')
    } catch (_) {
      try {
        var tList = app.findRecordsByFilter('tenants', 'ativo = true', 'created', 1, 0)
        if (tList.length > 0) tenant = tList[0]
      } catch (_) {}
    }

    if (!tenant) {
      console.log('[MIGRATION 0105] Tenant não localizado, pulando configuração.')
      return
    }

    var tenantId = tenant.id

    // 2. Localizar certificado A1 da Rumo no cofre (se existir)
    var certA1Id = ''
    try {
      var certs = app.findRecordsByFilter(
        'certificados_digitais',
        "tenant_id = '" + tenantId + "' && titular ~ '55614455000199' && status = 'ativo'",
        '-created',
        1,
        0,
      )
      if (certs.length > 0) {
        certA1Id = certs[0].id
      }
    } catch (_) {}

    // 3. Credenciais da Loja SERPRO geradas pelo usuário
    var cKey = 'qaS_lT6JRREGM3KzgoDyoVJY8d4a'
    var cSecret = 'LxAZKZfP5vkj_iEwun__Sjfff6ga'

    // 4. Diagnóstico inicial gravado no banco
    var diagnostico = {
      sucesso: true,
      credenciado: true,
      modo_supervisao: true,
      status_conexao: 'modo_supervisao',
      diagnostico_tipo: 'proxy_mtls_ausente',
      ambiente: 'trial',
      mensagem:
        'Credenciais SERPRO registradas com sucesso no cofre da aplicação! Modo supervisão ativo até configuração do proxy mTLS.',
      itens: [
        {
          item: 'Chaves de API SERPRO',
          status: 'ok',
          detalhe: 'Chaves SERPRO gravadas (qaS_l***).',
        },
        {
          item: 'CNPJ do Contratante',
          status: 'ok',
          detalhe: 'Contratante informado: 55614455000199',
        },
        {
          item: 'Certificado Digital e-CNPJ A1',
          status: certA1Id ? 'ok' : 'alerta',
          detalhe: certA1Id
            ? 'Certificado A1 Rumo Consultoria vinculado.'
            : 'Nenhum certificado vinculado.',
        },
        {
          item: 'Túnel / Proxy mTLS',
          status: 'alerta',
          detalhe:
            'Proxy mTLS não configurado. PocketBase opera em Modo Supervisão honesta sem handshake TLS cliente nativo.',
        },
      ],
      verificado_em: new Date().toISOString(),
    }

    // 5. Atualizar ou Criar registro em integra_contador_config
    var config = null
    try {
      config = app.findFirstRecordByData('integra_contador_config', 'tenant_id', tenantId)
    } catch (_) {}

    var col = app.findCollectionByNameOrId('integra_contador_config')
    var isNew = false
    if (!config) {
      config = new Record(col)
      config.set('tenant_id', tenantId)
      isNew = true
    }

    config.set('ativo', true)
    config.set('ambiente', 'trial')
    config.set('consumer_key', cKey)
    config.set('consumer_secret', cSecret)
    config.set('contratante_cnpj', '55.614.455/0001-99')
    config.set('autor_pedido_dados_numero', '55.614.455/0001-99')
    if (certA1Id) {
      config.set('certificado_a1', certA1Id)
      config.set('senha_certificado', 'eykbA7ZX')
    }
    config.set('sincronizacao_automatica', true)
    config.set('sincronizar_situacao_fiscal', true)
    config.set('sincronizar_caixa_postal', true)
    config.set('sincronizar_dctfweb', true)
    config.set('sincronizar_pgdas', true)
    config.set('status_conexao', 'modo_supervisao')
    config.set('ultimo_diagnostico_json', diagnostico)

    app.save(config)
    console.log(
      '[MIGRATION 0105] Configuração SERPRO salva com sucesso para tenant ' +
        tenantId +
        ' (isNew=' +
        isNew +
        ')',
    )
  },
  (app) => {
    try {
      var tenant = app.findFirstRecordByData('tenants', 'nome', 'Rumo Consultoria Contábil')
      if (tenant) {
        var config = app.findFirstRecordByData('integra_contador_config', 'tenant_id', tenant.id)
        if (config) {
          config.set('ativo', false)
          config.set('consumer_key', '')
          config.set('consumer_secret', '')
          config.set('status_conexao', 'desconectado')
          app.save(config)
        }
      }
    } catch (_) {}
  },
)

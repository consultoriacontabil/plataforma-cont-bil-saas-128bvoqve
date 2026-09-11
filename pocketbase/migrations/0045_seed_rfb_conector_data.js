/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const rfbConfigCol = app.findCollectionByNameOrId('rfb_config')
    const rfbLogsCol = app.findCollectionByNameOrId('rfb_sync_logs')

    let tenantId = 'l91og8ybo9krtay'
    try {
      const t = app.findFirstRecordByData('tenants', 'cnpj', '12.345.678/0001-90')
      tenantId = t.id
    } catch (_) {}

    // Empresa 2: Grãos do Sul Cafeteria (xgfoy8yifisdc0n)
    // Deixar configurada em homologação, sem credenciais reais completas -> exibindo Modo Supervisão
    let graosDoSulId = 'xgfoy8yifisdc0n'
    let graosCnpj = '18.902.345/0001-88'
    let certGraosId = ''

    try {
      const e2 = app.findFirstRecordByData('empresas', 'cnpj', graosCnpj)
      graosDoSulId = e2.id
    } catch (_) {}

    try {
      const cert = app.findFirstRecordByData('certificados_digitais', 'empresa', graosDoSulId)
      certGraosId = cert.id
    } catch (_) {}

    // Seed rfb_config para Grãos do Sul
    try {
      app.findFirstRecordByData('rfb_config', 'empresa', graosDoSulId)
    } catch (_) {
      const configRecord = new Record(rfbConfigCol)
      configRecord.set('tenant_id', tenantId)
      configRecord.set('empresa', graosDoSulId)
      configRecord.set('ativo', true)
      configRecord.set('ambiente', 'homologacao')
      configRecord.set('cnpj_contribuinte', graosCnpj)
      if (certGraosId) {
        configRecord.set('certificado_a1', certGraosId)
      }
      configRecord.set('senha_certificado', '') // Senha não preenchida propositalmente para demonstrar Modo Supervisão transparente
      configRecord.set('contrato_dte_id', 'DTE-HOMOLOG-2026-9921')
      configRecord.set('token_ambiente_rfb', '')
      configRecord.set('sincronizacao_automatica', true)
      configRecord.set('sincronizar_certidoes', true)
      configRecord.set('sincronizar_ecac', true)
      configRecord.set('status_conexao', 'modo_supervisao')
      configRecord.set('ultimo_diagnostico_json', {
        status: 'pendente_credenciais',
        mensagem:
          'Certificado e-CNPJ A1 detectado, porém senha da chave privada (.pfx) não configurada. Conector operando em Modo Supervisão com controle de prazos assistido.',
        data_verificacao: new Date().toISOString(),
        itens_checados: {
          certificado_vinculado: true,
          senha_configurada: false,
          contrato_dte_informado: true,
          ambiente: 'homologacao',
        },
      })
      app.save(configRecord)
    }

    // Seed log histórico para Grãos do Sul
    try {
      const existingLogs = app.findRecordsByFilter(
        'rfb_sync_logs',
        "empresa = '" + graosDoSulId + "'",
        '',
        1,
        0,
      )
      if (existingLogs.length === 0) {
        const log = new Record(rfbLogsCol)
        log.set('tenant_id', tenantId)
        log.set('empresa', graosDoSulId)
        log.set('origem_acionamento', 'manual')
        log.set('sucesso', false)
        log.set('modo_operacao', 'modo_supervisao')
        log.set('comunicacoes_novas', 0)
        log.set('certidoes_atualizadas', 0)
        log.set('duracao_ms', 140)
        log.set(
          'mensagem',
          'Sincronização executada em Modo Supervisão: 2 comunicações E-CAC e 3 certidões monitoradas manualmente no painel.',
        )
        log.set('detalhes_json', {
          motivo: 'Credenciais completas não fornecidas (senha do certificado A1 pendente).',
          sugestao: 'Vincule a senha do arquivo A1 para habilitar requisições diretas ao DTE RFB.',
        })
        app.save(log)
      }
    } catch (_) {}

    // Inovatech Soluções Digitais Ltda (feb9h004jovi7xh) propositalmente SEM conector criado,
    // para demonstrar o estado de conector não configurado / inativo.
  },
  (app) => {
    try {
      app
        .db()
        .newQuery("DELETE FROM rfb_sync_logs WHERE mensagem LIKE '%Modo Supervisão%'")
        .execute()
    } catch (_) {}

    try {
      app
        .db()
        .newQuery("DELETE FROM rfb_config WHERE contrato_dte_id = 'DTE-HOMOLOG-2026-9921'")
        .execute()
    } catch (_) {}
  },
)

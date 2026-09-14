/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const nfeConfigCol = app.findCollectionByNameOrId('nfe_config')
    const nfeRecebidasCol = app.findCollectionByNameOrId('nfe_recebidas')
    const nfeLogsCol = app.findCollectionByNameOrId('nfe_sync_logs')
    const documentosCol = app.findCollectionByNameOrId('documentos')

    let tenantId = 'l91og8ybo9krtay'
    try {
      const t = app.findFirstRecordByData('tenants', 'cnpj', '12.345.678/0001-90')
      tenantId = t.id
    } catch (_) {}

    let contadorUserId = '5loguqf8bqyguo3'
    try {
      const u = app.findFirstRecordByData(
        '_pb_users_auth_',
        'email',
        'rumo@rumoconsultoriacontabil.com.br',
      )
      contadorUserId = u.id
    } catch (_) {}

    // ==========================================
    // CENÁRIO 1: Grãos do Sul Cafeteria (xgfoy8yifisdc0n)
    // Empresa com busca ativa, sincronização histórica concluída e 4 NF-es recebidas de fornecedores com metadados e manifestações variadas
    // ==========================================
    let graosEmpresaId = 'xgfoy8yifisdc0n'
    let graosCnpj = '18.902.345/0001-88'
    let certGraosId = ''

    try {
      const empGraos = app.findFirstRecordByData('empresas', 'cnpj', graosCnpj)
      graosEmpresaId = empGraos.id
    } catch (_) {}

    try {
      const certGraos = app.findFirstRecordByData(
        'certificados_digitais',
        'empresa',
        graosEmpresaId,
      )
      certGraosId = certGraos.id
    } catch (_) {}

    // 1.1 Configuração NFe para Grãos do Sul
    try {
      app.findFirstRecordByData('nfe_config', 'empresa', graosEmpresaId)
    } catch (_) {
      const cfgGraos = new Record(nfeConfigCol)
      cfgGraos.set('tenant_id', tenantId)
      cfgGraos.set('empresa', graosEmpresaId)
      cfgGraos.set('busca_automatica_ativa', true)
      cfgGraos.set('ambiente', 'producao')
      if (certGraosId) {
        cfgGraos.set('certificado_a1', certGraosId)
      }
      cfgGraos.set('senha_certificado', 'Graos#Pass2026')
      cfgGraos.set('ultimo_nsu', '000000000004520')
      cfgGraos.set('max_nsu', '000000000004520')
      cfgGraos.set('auto_importar_ged', true)
      cfgGraos.set('auto_ciencia_operacao', true)
      cfgGraos.set('status_conexao', 'conectado')
      cfgGraos.set('total_notas_recebidas', 4)
      cfgGraos.set('ultima_sincronizacao_em', new Date().toISOString())
      cfgGraos.set('ultimo_diagnostico_json', {
        status: 'conectado',
        mensagem:
          'Certificado e-CNPJ A1 válido. Conexão com SEFAZ Ambiente Nacional DFe homologada e sincronizada.',
        data_verificacao: new Date().toISOString(),
        itens_checados: {
          certificado_vinculado: true,
          senha_configurada: true,
          certificado_valido: true,
          ambiente: 'producao',
          comunicacao_sefaz: '200 OK - Servico em Operacao (nfeDistDFeInteresse)',
        },
      })
      app.save(cfgGraos)
    }

    // 1.2 Log histórico concluído para Grãos do Sul
    try {
      const existingLogs = app.findRecordsByFilter(
        'nfe_sync_logs',
        "empresa = '" + graosEmpresaId + "'",
        '',
        1,
        0,
      )
      if (existingLogs.length === 0) {
        const logOk = new Record(nfeLogsCol)
        logOk.set('tenant_id', tenantId)
        logOk.set('empresa', graosEmpresaId)
        logOk.set('origem_acionamento', 'cron_diario')
        logOk.set('sucesso', true)
        logOk.set('modo_operacao', 'sefaz_distribuicao_real')
        logOk.set('notas_encontradas', 4)
        logOk.set('notas_novas_importadas', 4)
        logOk.set('ultimo_nsu_consultado', '000000000004520')
        logOk.set('duracao_ms', 1840)
        logOk.set(
          'mensagem',
          'Sincronização SEFAZ DFe concluída com sucesso. 4 notas fiscais recebidas importadas automaticamente para o GED.',
        )
        logOk.set('detalhes_json', {
          cStat: 138,
          xMotivo: 'Documento localizado para o destinatario',
          ultNSU: '000000000004520',
          maxNSU: '000000000004520',
          notas_processadas: 4,
          importadas_ged: 4,
        })
        logOk.set('executado_por', contadorUserId)
        app.save(logOk)
      }
    } catch (_) {}

    // 1.3 Quatro NF-es recebidas para Grãos do Sul com GED integrado
    const notasGraos = [
      {
        chave: '41260305882194000185550010000412891823749102',
        numero: '41289',
        serie: '1',
        cnpj_emit: '05.882.194/0001-85',
        razao_emit: 'Torrefação e Moagem Cafezal das Gerais Ltda',
        nome_emit: 'Café Cafezal Minas',
        uf_emit: 'MG',
        data_emissao: '2026-03-01 10:30:00.000Z',
        data_aut: '2026-03-01 10:32:15.000Z',
        valor_total: 12450.0,
        valor_icms: 1494.0,
        cfop: '6.102',
        natureza: 'Venda de mercadoria adquirida de terceiros',
        nsu: '000000000004517',
        status_manif: 'confirmada',
        data_manif: '2026-03-02 14:15:00.000Z',
        justif: 'Mercadoria recebida e conferida conforme pedido de compra #8812.',
        nome_arquivo: 'NFe_41260305882194000185550010000412891823749102.xml',
      },
      {
        chave: '41260312984512000133550020000182441982736451',
        numero: '18244',
        serie: '2',
        cnpj_emit: '12.984.512/0001-33',
        razao_emit: 'Laticínios Vale da Serra S/A',
        nome_emit: 'Laticínios Vale da Serra',
        uf_emit: 'PR',
        data_emissao: '2026-03-05 08:45:00.000Z',
        data_aut: '2026-03-05 08:47:00.000Z',
        valor_total: 3890.5,
        valor_icms: 466.86,
        cfop: '5.102',
        natureza: 'Venda de produção própria (Leite e Derivados)',
        nsu: '000000000004518',
        status_manif: 'ciencia',
        data_manif: '2026-03-05 09:10:00.000Z',
        justif: '',
        nome_arquivo: 'NFe_41260312984512000133550020000182441982736451.xml',
      },
      {
        chave: '41260324889123000177550010000094121543219876',
        numero: '9412',
        serie: '1',
        cnpj_emit: '24.889.123/0001-77',
        razao_emit: 'Embalagens Ecológicas e Descartáveis Brasil Ltda',
        nome_emit: 'EcoEmbalagens',
        uf_emit: 'SP',
        data_emissao: '2026-03-08 14:20:00.000Z',
        data_aut: '2026-03-08 14:22:40.000Z',
        valor_total: 2150.0,
        valor_icms: 258.0,
        cfop: '6.102',
        natureza: 'Venda de copos térmicos e embalagens biodegradáveis',
        nsu: '000000000004519',
        status_manif: 'sem_manifestacao',
        data_manif: null,
        justif: '',
        nome_arquivo: 'NFe_41260324889123000177550010000094121543219876.xml',
      },
      {
        chave: '41260399887766000101550010000031891092837465',
        numero: '3189',
        serie: '1',
        cnpj_emit: '99.887.766/0001-01',
        razao_emit: 'Distribuidora Fantasma Equipamentos Industriais Eireli',
        nome_emit: 'Distribuidora Fantasma',
        uf_emit: 'RJ',
        data_emissao: '2026-03-09 16:00:00.000Z',
        data_aut: '2026-03-09 16:02:10.000Z',
        valor_total: 18500.0,
        valor_icms: 2220.0,
        cfop: '6.102',
        natureza: 'Venda de Máquina Moedora Industrial',
        nsu: '000000000004520',
        status_manif: 'desconhecida',
        data_manif: '2026-03-10 11:00:00.000Z',
        justif:
          'Operação não solicitada pela cafeteria. Nenhuma compra ou pedido emitido para este fornecedor.',
        nome_arquivo: 'NFe_41260399887766000101550010000031891092837465.xml',
      },
    ]

    for (let i = 0; i < notasGraos.length; i++) {
      const item = notasGraos[i]
      let docGedId = ''

      // Verificar se o documento GED já existe
      try {
        const docExist = app.findFirstRecordByData('documentos', 'chave_acesso_nfe', item.chave)
        docGedId = docExist.id
      } catch (_) {
        const doc = new Record(documentosCol)
        doc.set('tenant_id', tenantId)
        doc.set('empresa_id', graosEmpresaId)
        doc.set('nome_arquivo', item.nome_arquivo)
        doc.set('tipo', 'nota_fiscal')
        doc.set('status', 'processado')
        doc.set('origem_documento', 'busca_sefaz')
        doc.set('chave_acesso_nfe', item.chave)
        doc.set(
          'observacoes',
          'Importado automaticamente via Busca SEFAZ (DFe). Emitente: ' +
            item.razao_emit +
            ' | NF nº ' +
            item.numero +
            ' | Valor R$ ' +
            item.valor_total.toFixed(2),
        )
        doc.set('usuario_upload_id', contadorUserId)
        app.save(doc)
        docGedId = doc.id
      }

      // Inserir registro na nfe_recebidas
      try {
        app.findFirstRecordByData('nfe_recebidas', 'chave_acesso', item.chave)
      } catch (_) {
        const nfeRec = new Record(nfeRecebidasCol)
        nfeRec.set('tenant_id', tenantId)
        nfeRec.set('empresa', graosEmpresaId)
        nfeRec.set('chave_acesso', item.chave)
        nfeRec.set('numero', item.numero)
        nfeRec.set('serie', item.serie)
        nfeRec.set('cnpj_emitente', item.cnpj_emit)
        nfeRec.set('razao_social_emitente', item.razao_emit)
        nfeRec.set('nome_fantasia_emitente', item.nome_emit)
        nfeRec.set('uf_emitente', item.uf_emit)
        nfeRec.set('data_emissao', item.data_emissao)
        nfeRec.set('data_autorizacao', item.data_aut)
        nfeRec.set('valor_total', item.valor_total)
        nfeRec.set('valor_icms', item.valor_icms)
        nfeRec.set('cfop_principal', item.cfop)
        nfeRec.set('natureza_operacao', item.natureza)
        nfeRec.set('nsu', item.nsu)
        nfeRec.set('tipo_operacao', '0_entrada')
        nfeRec.set('status_sefaz', 'autorizada')
        nfeRec.set('status_manifestacao', item.status_manif)
        if (item.data_manif) {
          nfeRec.set('data_manifestacao', item.data_manif)
          nfeRec.set('manifestado_por', contadorUserId)
        }
        if (item.justif) {
          nfeRec.set('justificativa_manifestacao', item.justif)
        }
        if (docGedId) {
          nfeRec.set('documento_ged', docGedId)
        }
        nfeRec.set('origem_captura', 'busca_sefaz_auto')
        nfeRec.set('metadados_json', {
          ambiente: 'producao',
          cStat: 100,
          xMotivo: 'Autorizado o uso da NF-e',
          destinatario_cnpj: graosCnpj,
          destinatario_xNome: 'Café & Grãos Gourmet do Sul Comércio Ltda',
        })
        app.save(nfeRec)
      }
    }

    // ==========================================
    // CENÁRIO 2: Inovatech Soluções Digitais Ltda (feb9h004jovi7xh)
    // Estado "credenciais pendentes" com badge de Modo Supervisão e diagnóstico transparente
    // ==========================================
    let inovaEmpresaId = 'feb9h004jovi7xh'
    let inovaCnpj = '33.456.789/0001-12'
    let certInovaId = ''

    try {
      const empInova = app.findFirstRecordByData('empresas', 'cnpj', inovaCnpj)
      inovaEmpresaId = empInova.id
    } catch (_) {}

    try {
      const certInova = app.findFirstRecordByData(
        'certificados_digitais',
        'empresa',
        inovaEmpresaId,
      )
      certInovaId = certInova.id
    } catch (_) {}

    try {
      app.findFirstRecordByData('nfe_config', 'empresa', inovaEmpresaId)
    } catch (_) {
      const cfgInova = new Record(nfeConfigCol)
      cfgInova.set('tenant_id', tenantId)
      cfgInova.set('empresa', inovaEmpresaId)
      cfgInova.set('busca_automatica_ativa', true)
      cfgInova.set('ambiente', 'homologacao')
      if (certInovaId) {
        cfgInova.set('certificado_a1', certInovaId)
      }
      cfgInova.set('senha_certificado', '') // Senha propositalmente não informada para acionar Modo Supervisão
      cfgInova.set('ultimo_nsu', '000000000000000')
      cfgInova.set('max_nsu', '000000000000000')
      cfgInova.set('auto_importar_ged', true)
      cfgInova.set('auto_ciencia_operacao', false)
      cfgInova.set('status_conexao', 'modo_supervisao')
      cfgInova.set('total_notas_recebidas', 0)
      cfgInova.set('ultima_sincronizacao_em', new Date().toISOString())
      cfgInova.set('ultimo_diagnostico_json', {
        status: 'pendente_credenciais',
        mensagem:
          'Certificado e-CNPJ A1 vinculado na ficha, porém a senha da chave privada não foi informada ou o arquivo .pfx precisa de recadastro. Operando em Modo Supervisão com suporte à consulta pública por chave de 44 dígitos.',
        data_verificacao: new Date().toISOString(),
        itens_checados: {
          certificado_detectado: true,
          senha_configurada: false,
          ambiente: 'homologacao',
          acesso_distribuicao_dfe: false,
          consulta_chave_manual_publica: true,
        },
      })
      app.save(cfgInova)
    }

    // Log histórico em Modo Supervisão para Inovatech
    try {
      const inovaLogs = app.findRecordsByFilter(
        'nfe_sync_logs',
        "empresa = '" + inovaEmpresaId + "'",
        '',
        1,
        0,
      )
      if (inovaLogs.length === 0) {
        const logSup = new Record(nfeLogsCol)
        logSup.set('tenant_id', tenantId)
        logSup.set('empresa', inovaEmpresaId)
        logSup.set('origem_acionamento', 'manual')
        logSup.set('sucesso', false)
        logSup.set('modo_operacao', 'modo_supervisao')
        logSup.set('notas_encontradas', 0)
        logSup.set('notas_novas_importadas', 0)
        logSup.set('ultimo_nsu_consultado', '000000000000000')
        logSup.set('duracao_ms', 110)
        logSup.set(
          'mensagem',
          'Sincronização executada em Modo Supervisão: Credenciais e-CNPJ pendentes. Utilize a consulta pública por chave de 44 dígitos ou configure a senha do certificado.',
        )
        logSup.set('detalhes_json', {
          motivo: 'Certificado sem senha informada para descriptografia de chave privada A1.',
          acao_recomendada:
            'Preencha a senha do certificado na aba NF-e Recebidas para habilitar nfeDistDFeInteresse.',
        })
        logSup.set('executado_por', contadorUserId)
        app.save(logSup)
      }
    } catch (_) {}
  },
  (app) => {
    try {
      app
        .db()
        .newQuery(
          "DELETE FROM nfe_recebidas WHERE chave_acesso IN ('41260305882194000185550010000412891823749102', '41260312984512000133550020000182441982736451', '41260324889123000177550010000094121543219876', '41260399887766000101550010000031891092837465')",
        )
        .execute()
    } catch (_) {}

    try {
      app
        .db()
        .newQuery(
          "DELETE FROM documentos WHERE chave_acesso_nfe IN ('41260305882194000185550010000412891823749102', '41260312984512000133550020000182441982736451', '41260324889123000177550010000094121543219876', '41260399887766000101550010000031891092837465')",
        )
        .execute()
    } catch (_) {}

    try {
      app
        .db()
        .newQuery(
          "DELETE FROM nfe_sync_logs WHERE mensagem LIKE '%Sincronização SEFAZ DFe%' OR mensagem LIKE '%Modo Supervisão%'",
        )
        .execute()
    } catch (_) {}
  },
)

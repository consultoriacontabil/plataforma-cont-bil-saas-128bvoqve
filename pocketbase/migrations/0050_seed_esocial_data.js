/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const funcsCol = app.findCollectionByNameOrId('funcionarios')
    const certsCol = app.findCollectionByNameOrId('certificados_digitais')
    const esocialConfigCol = app.findCollectionByNameOrId('esocial_config')
    const esocialEventosCol = app.findCollectionByNameOrId('esocial_eventos')
    const auditLogCol = app.findCollectionByNameOrId('audit_log')

    let tenant = null
    try {
      tenant = app.findFirstRecordByData('tenants', 'cnpj', '12.345.678/0001-90')
    } catch (_) {
      try {
        const tList = app.findRecordsByFilter('tenants', '', '', 1, 0)
        if (tList.length > 0) tenant = tList[0]
      } catch (_) {}
    }
    if (!tenant) return

    const tenantId = tenant.id

    // Buscar Inovatech e Grãos do Sul
    let empInovatech = null
    let empGraos = null
    try {
      empInovatech = app.findFirstRecordByData('empresas', 'cnpj', '33.456.789/0001-12')
    } catch (_) {}
    try {
      empGraos = app.findFirstRecordByData('empresas', 'cnpj', '18.902.345/0001-88')
    } catch (_) {}

    // 1. Atualizar colaboradores da Inovatech com dados completos e-Social (Empresa Modelo Conforme)
    if (empInovatech) {
      const funcsInova = app.findRecordsByFilter(
        'funcionarios',
        "empresa = '" + empInovatech.id + "'",
        'created',
        10,
        0,
      )

      if (funcsInova.length > 0) {
        // Lucas Medeiros Albuquerque
        const f1 = funcsInova[0]
        f1.set('nis_pis', '120.45892.33-1')
        f1.set('ctps_numero', '0459821')
        f1.set('ctps_serie', '0040')
        f1.set('ctps_uf', 'SP')
        f1.set('cbo', '2124-05') // Analista de desenvolvimento de sistemas
        f1.set('grau_instrucao', 'superior_completo')
        f1.set('raca_cor', 'branca')
        f1.set('estado_civil', 'casado')
        f1.set('sexo', 'M')
        f1.set('data_nascimento', '1990-05-14 00:00:00.000Z')
        f1.set('nome_mae', 'Maria de Fátima Albuquerque')
        f1.set('pcd', false)
        f1.set('dependentes_irrf', 2)
        f1.set('regime_tributario_trabalhador', 'CLT - Contrato por prazo indeterminado')
        f1.set('categoria_trabalhador', '101')
        f1.set('matricula_esocial', 'EMP-INOVA-001')
        app.save(f1)
      }

      if (funcsInova.length > 1) {
        // Mariana Duarte Souza
        const f2 = funcsInova[1]
        f2.set('nis_pis', '135.88219.44-8')
        f2.set('ctps_numero', '0891234')
        f2.set('ctps_serie', '0010')
        f2.set('ctps_uf', 'SP')
        f2.set('cbo', '2122-15') // Engenheiro de sistemas operacionais
        f2.set('grau_instrucao', 'pos_graduacao')
        f2.set('raca_cor', 'parda')
        f2.set('estado_civil', 'solteiro')
        f2.set('sexo', 'F')
        f2.set('data_nascimento', '1992-11-20 00:00:00.000Z')
        f2.set('nome_mae', 'Helena Duarte Souza')
        f2.set('pcd', false)
        f2.set('dependentes_irrf', 1)
        f2.set('regime_tributario_trabalhador', 'CLT - Contrato por prazo indeterminado')
        f2.set('categoria_trabalhador', '101')
        f2.set('matricula_esocial', 'EMP-INOVA-002')
        app.save(f2)
      }

      if (funcsInova.length > 2) {
        // Guilherme Ramos Castro
        const f3 = funcsInova[2]
        f3.set('nis_pis', '160.99812.55-2')
        f3.set('ctps_numero', '0345678')
        f3.set('ctps_serie', '0020')
        f3.set('ctps_uf', 'SP')
        f3.set('cbo', '3171-10') // Programador de sistemas de informação
        f3.set('grau_instrucao', 'superior_completo')
        f3.set('raca_cor', 'branca')
        f3.set('estado_civil', 'solteiro')
        f3.set('sexo', 'M')
        f3.set('data_nascimento', '1996-03-08 00:00:00.000Z')
        f3.set('nome_mae', 'Sônia Ramos Castro')
        f3.set('pcd', false)
        f3.set('dependentes_irrf', 0)
        f3.set('regime_tributario_trabalhador', 'CLT - Contrato por prazo indeterminado')
        f3.set('categoria_trabalhador', '101')
        f3.set('matricula_esocial', 'EMP-INOVA-003')
        app.save(f3)
      }
    }

    // 2. Grãos do Sul Cafeteria: Manter dados incompletos propositalmente para demonstrar alertas de conformidade
    if (empGraos) {
      const funcsGraos = app.findRecordsByFilter(
        'funcionarios',
        "empresa = '" + empGraos.id + "'",
        'created',
        5,
        0,
      )
      if (funcsGraos.length > 0) {
        const fg1 = funcsGraos[0]
        // Preencher parcialmente para ver pendências (falta NIS/PIS, CBO, raça/cor, mãe)
        fg1.set('ctps_numero', '012984')
        fg1.set('matricula_esocial', 'GRAOS-001')
        app.save(fg1)
      }
    }

    // 3. Seed esocial_config para Inovatech (com certificado A1 conectado)
    if (empInovatech) {
      try {
        app.findFirstRecordByData('esocial_config', 'empresa', empInovatech.id)
      } catch (_) {
        let certInova = null
        try {
          certInova = app.findFirstRecordByData('certificados_digitais', 'empresa', empInovatech.id)
        } catch (_) {}

        const cfgInova = new Record(esocialConfigCol)
        cfgInova.set('tenant_id', tenantId)
        cfgInova.set('empresa', empInovatech.id)
        cfgInova.set('ambiente', 'producao_restrita')
        if (certInova) {
          cfgInova.set('certificado_a1', certInova.id)
          cfgInova.set('senha_certificado', certInova.getString('senha') || 'Inova@Cert2026')
        }
        cfgInova.set('transmissor_cnpj', empInovatech.getString('cnpj') || '33.456.789/0001-12')
        cfgInova.set('tipo_inscricao', 'cnpj')
        cfgInova.set('versao_layout', 'v_s1_1')
        cfgInova.set('modo_operacao', 'supervisao')
        cfgInova.set('status_conexao', 'apto')
        cfgInova.set('auto_gerar_eventos', true)
        cfgInova.set('ultimo_diagnostico_json', {
          certificado_ok: true,
          certificado_emissor: 'AC SERASA RFB v5',
          certificado_validade: '2027-05-09',
          senha_ok: true,
          ambiente_comunicacao: 'producao_restrita',
          transmissor_valido: true,
          status_geral: 'Pronto para transmissão supervisionada com certificado e-CNPJ A1',
        })
        cfgInova.set('ultima_verificacao_em', new Date().toISOString())
        app.save(cfgInova)
      }
    }

    // 4. Seed esocial_config para Grãos do Sul (Modo supervisão com pendências de credenciais)
    if (empGraos) {
      try {
        app.findFirstRecordByData('esocial_config', 'empresa', empGraos.id)
      } catch (_) {
        const cfgGraos = new Record(esocialConfigCol)
        cfgGraos.set('tenant_id', tenantId)
        cfgGraos.set('empresa', empGraos.id)
        cfgGraos.set('ambiente', 'homologacao')
        cfgGraos.set('transmissor_cnpj', empGraos.getString('cnpj') || '18.902.345/0001-88')
        cfgGraos.set('tipo_inscricao', 'cnpj')
        cfgGraos.set('versao_layout', 'v_s1_1')
        cfgGraos.set('modo_operacao', 'supervisao')
        cfgGraos.set('status_conexao', 'pendente')
        cfgGraos.set('auto_gerar_eventos', true)
        cfgGraos.set('ultimo_diagnostico_json', {
          certificado_ok: false,
          certificado_emissor: 'AC CERTISIGN Multipla v5',
          certificado_validade: '2026-09-25 (próximo ao vencimento)',
          senha_ok: true,
          ambiente_comunicacao: 'homologacao',
          transmissor_valido: true,
          status_geral: 'Atenção: Certificado digital próximo da expiração. Modo Supervisão ativo.',
        })
        cfgGraos.set('ultima_verificacao_em', new Date().toISOString())
        app.save(cfgGraos)
      }
    }

    // 5. Seed Eventos e-Social demonstrativos para Inovatech (S-2200 validado/pronto, S-1200 pronto, S-1210 pronto, S-1299 fechado)
    if (empInovatech) {
      const funcsInova = app.findRecordsByFilter(
        'funcionarios',
        "empresa = '" + empInovatech.id + "'",
        'created',
        3,
        0,
      )
      const funcLucas = funcsInova[0]
      const funcMariana = funcsInova.length > 1 ? funcsInova[1] : null

      // S-2200 Lucas (Transmitido com recibo)
      try {
        app.findFirstRecordByData('esocial_eventos', 'identificador_evento', 'ID1-S2200-INOVA-001')
      } catch (_) {
        const evS2200 = new Record(esocialEventosCol)
        evS2200.set('tenant_id', tenantId)
        evS2200.set('empresa', empInovatech.id)
        if (funcLucas) evS2200.set('funcionario', funcLucas.id)
        evS2200.set('tipo_evento', 'S-2200')
        evS2200.set('competencia', '02/2023')
        evS2200.set('status', 'transmitido')
        evS2200.set('identificador_evento', 'ID1-S2200-INOVA-001')
        evS2200.set('prazo_legal', '2023-02-14 23:59:59.000Z')
        evS2200.set('protocolo_envio', '1.2.202302.00000412891')
        evS2200.set('recibo_entrega', '1.2.202302.00000412891-REC-01')
        evS2200.set('data_transmissao', '2023-02-14 14:22:10.000Z')
        evS2200.set('duracao_transmissao_ms', 1420)
        evS2200.set('modo_envio', 'supervisao')
        evS2200.set(
          'xml_gerado',
          '<?xml version="1.0" encoding="UTF-8"?>\n<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtAdmissao/v_S_01_01_00">\n  <evtAdmissao Id="ID1334567890001122023021414221000001">\n    <ideEvento>\n      <tpAmb>2</tpAmb>\n      <procEmi>1</procEmi>\n      <verProc>Rumo-eSocial-1.0</verProc>\n    </ideEvento>\n    <ideEmpregador>\n      <tpInsc>1</tpInsc>\n      <nrInsc>33456789000112</nrInsc>\n    </ideEmpregador>\n    <trabalhador>\n      <cpfTrab>23456789011</cpfTrab>\n      <nmTrab>Lucas Medeiros Albuquerque</nmTrab>\n      <sexo>M</sexo>\n      <racaCor>1</racaCor>\n      <grauInstr>09</grauInstr>\n    </trabalhador>\n    <vinculo>\n      <matricula>EMP-INOVA-001</matricula>\n      <tpRegTrab>1</tpRegTrab>\n      <tpRegPrev>1</tpRegPrev>\n      <cadIni>S</cadIni>\n      <infoRegimeDTP>\n        <remuneracao>\n          <vrSalFx>12500.00</vrSalFx>\n          <undSalFixo>7</undSalFixo>\n        </remuneracao>\n      </infoRegimeDTP>\n    </vinculo>\n  </evtAdmissao>\n</eSocial>',
        )
        evS2200.set('resposta_governo_json', {
          codigo: 201,
          descricao: 'Lote processado com sucesso pelo ambiente de recepção e-Social.',
          recibo: '1.2.202302.00000412891-REC-01',
          dataRecepcao: '2023-02-14T14:22:11.420Z',
        })
        app.save(evS2200)
      }

      // S-1200 Remuneração 09/2026 (Pronto para envio)
      try {
        app.findFirstRecordByData(
          'esocial_eventos',
          'identificador_evento',
          'ID1-S1200-INOVA-092026',
        )
      } catch (_) {
        const evS1200 = new Record(esocialEventosCol)
        evS1200.set('tenant_id', tenantId)
        evS1200.set('empresa', empInovatech.id)
        if (funcLucas) evS1200.set('funcionario', funcLucas.id)
        evS1200.set('tipo_evento', 'S-1200')
        evS1200.set('competencia', '09/2026')
        evS1200.set('status', 'pronto')
        evS1200.set('identificador_evento', 'ID1-S1200-INOVA-092026')
        evS1200.set('prazo_legal', '2026-10-15 23:59:59.000Z')
        evS1200.set(
          'xml_gerado',
          '<?xml version="1.0" encoding="UTF-8"?>\n<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtRemun/v_S_01_01_00">\n  <evtRemun Id="ID1334567890001122026091210000000001">\n    <ideEvento>\n      <indRetif>1</indRetif>\n      <perApur>2026-09</perApur>\n      <tpAmb>2</tpAmb>\n      <procEmi>1</procEmi>\n      <verProc>Rumo-eSocial-1.0</verProc>\n    </ideEvento>\n    <ideEmpregador>\n      <tpInsc>1</tpInsc>\n      <nrInsc>33456789000112</nrInsc>\n    </ideEmpregador>\n    <ideTrabalhador>\n      <cpfTrab>23456789011</cpfTrab>\n      <infoComplem>\n        <nmTrab>Lucas Medeiros Albuquerque</nmTrab>\n      </infoComplem>\n    </ideTrabalhador>\n    <dmDev>\n      <ideDmDev>DMDEV-092026-001</ideDmDev>\n      <infoPerApur>\n        <ideEstabLot>\n          <tpInsc>1</tpInsc>\n          <nrInsc>33456789000112</nrInsc>\n          <remunPerApur>\n            <matricula>EMP-INOVA-001</matricula>\n            <itensRemun>\n              <codRubr>1000</codRubr>\n              <ideTabRubr>TAB1</ideTabRubr>\n              <vrRubr>12500.00</vrRubr>\n            </itensRemun>\n          </remunPerApur>\n        </ideEstabLot>\n      </infoPerApur>\n    </dmDev>\n  </evtRemun>\n</eSocial>',
        )
        app.save(evS1200)
      }

      // S-1210 Pagamentos 09/2026 (Validado)
      try {
        app.findFirstRecordByData(
          'esocial_eventos',
          'identificador_evento',
          'ID1-S1210-INOVA-092026',
        )
      } catch (_) {
        const evS1210 = new Record(esocialEventosCol)
        evS1210.set('tenant_id', tenantId)
        evS1210.set('empresa', empInovatech.id)
        if (funcLucas) evS1210.set('funcionario', funcLucas.id)
        evS1210.set('tipo_evento', 'S-1210')
        evS1210.set('competencia', '09/2026')
        evS1210.set('status', 'validado')
        evS1210.set('identificador_evento', 'ID1-S1210-INOVA-092026')
        evS1210.set('prazo_legal', '2026-10-15 23:59:59.000Z')
        evS1210.set(
          'xml_gerado',
          '<?xml version="1.0" encoding="UTF-8"?>\n<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtPgtos/v_S_01_01_00">\n  <evtPgtos Id="ID1334567890001122026091210000000002">\n    <ideEvento>\n      <indRetif>1</indRetif>\n      <perApur>2026-09</perApur>\n      <tpAmb>2</tpAmb>\n      <procEmi>1</procEmi>\n      <verProc>Rumo-eSocial-1.0</verProc>\n    </ideEvento>\n    <ideEmpregador>\n      <tpInsc>1</tpInsc>\n      <nrInsc>33456789000112</nrInsc>\n    </ideEmpregador>\n    <ideBenef>\n      <cpfBenef>23456789011</cpfBenef>\n      <infoPgto>\n        <dtPgto>2026-10-05</dtPgto>\n        <tpPgto>1</tpPgto>\n        <perRef>2026-09</perRef>\n        <ideDmDev>DMDEV-092026-001</ideDmDev>\n        <vrLiq>10537.45</vrLiq>\n      </infoPgto>\n    </ideBenef>\n  </evtPgtos>\n</eSocial>',
        )
        app.save(evS1210)
      }

      // S-1299 Fechamento Competência 08/2026 (Transmitido / Fechado)
      try {
        app.findFirstRecordByData(
          'esocial_eventos',
          'identificador_evento',
          'ID1-S1299-INOVA-082026',
        )
      } catch (_) {
        const evS1299 = new Record(esocialEventosCol)
        evS1299.set('tenant_id', tenantId)
        evS1299.set('empresa', empInovatech.id)
        evS1299.set('tipo_evento', 'S-1299')
        evS1299.set('competencia', '08/2026')
        evS1299.set('status', 'fechado')
        evS1299.set('identificador_evento', 'ID1-S1299-INOVA-082026')
        evS1299.set('prazo_legal', '2026-09-15 23:59:59.000Z')
        evS1299.set('protocolo_envio', '1.2.202609.00000881920')
        evS1299.set('recibo_entrega', '1.2.202609.00000881920-REC-FECH')
        evS1299.set('data_transmissao', '2026-09-02 18:05:00.000Z')
        evS1299.set('duracao_transmissao_ms', 980)
        evS1299.set('modo_envio', 'supervisao')
        evS1299.set(
          'xml_gerado',
          '<?xml version="1.0" encoding="UTF-8"?>\n<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtFechaEvPer/v_S_01_01_00">\n  <evtFechaEvPer Id="ID1334567890001122026090218050000001">\n    <ideEvento>\n      <indRetif>1</indRetif>\n      <perApur>2026-08</perApur>\n      <tpAmb>2</tpAmb>\n      <procEmi>1</procEmi>\n      <verProc>Rumo-eSocial-1.0</verProc>\n    </ideEvento>\n    <ideEmpregador>\n      <tpInsc>1</tpInsc>\n      <nrInsc>33456789000112</nrInsc>\n    </ideEmpregador>\n    <infoFecha>\n      <evtRemun>S</evtRemun>\n      <evtPgtos>S</evtPgtos>\n      <evtAqProd>N</evtAqProd>\n      <evtComProd>N</evtComProd>\n      <evtContratAvNP>N</evtContratAvNP>\n      <evtInfoComplPer>N</evtInfoComplPer>\n    </infoFecha>\n  </evtFechaEvPer>\n</eSocial>',
        )
        app.save(evS1299)
      }
    }

    // 6. Seed Eventos e-Social com Pendências/Erros para Grãos do Sul (demonstrar alertas acionáveis)
    if (empGraos) {
      const funcsGraos = app.findRecordsByFilter(
        'funcionarios',
        "empresa = '" + empGraos.id + "'",
        'created',
        2,
        0,
      )
      const funcCarla = funcsGraos[0]

      try {
        app.findFirstRecordByData('esocial_eventos', 'identificador_evento', 'ID1-S2200-GRAOS-001')
      } catch (_) {
        const evRejeitado = new Record(esocialEventosCol)
        evRejeitado.set('tenant_id', tenantId)
        evRejeitado.set('empresa', empGraos.id)
        if (funcCarla) evRejeitado.set('funcionario', funcCarla.id)
        evRejeitado.set('tipo_evento', 'S-2200')
        evRejeitado.set('competencia', '06/2021')
        evRejeitado.set('status', 'rejeitado')
        evRejeitado.set('identificador_evento', 'ID1-S2200-GRAOS-001')
        evRejeitado.set('prazo_legal', '2021-06-14 23:59:59.000Z')
        evRejeitado.set('erros_validacao', [
          {
            campo: 'nis_pis',
            mensagem: 'PIS/NIS/PASEP não cadastrado na ficha do colaborador.',
            acao: 'Acessar cadastro do colaborador e preencher número do PIS válido (11 dígitos).',
          },
          {
            campo: 'cbo',
            mensagem: 'Código CBO obrigatório ausente para o cargo informado.',
            acao: 'Informar CBO oficial correspondente (Tabela CBO do MTE).',
          },
          {
            campo: 'nome_mae',
            mensagem: 'Filiação materna ausente para o evento S-2200.',
            acao: 'Preencher o nome completo da mãe no cadastro do colaborador.',
          },
        ])
        app.save(evRejeitado)
      }

      // S-1200 Pendente
      try {
        app.findFirstRecordByData(
          'esocial_eventos',
          'identificador_evento',
          'ID1-S1200-GRAOS-092026',
        )
      } catch (_) {
        const evPendente = new Record(esocialEventosCol)
        evPendente.set('tenant_id', tenantId)
        evPendente.set('empresa', empGraos.id)
        if (funcCarla) evPendente.set('funcionario', funcCarla.id)
        evPendente.set('tipo_evento', 'S-1200')
        evPendente.set('competencia', '09/2026')
        evPendente.set('status', 'pendente')
        evPendente.set('identificador_evento', 'ID1-S1200-GRAOS-092026')
        evPendente.set('prazo_legal', '2026-10-15 23:59:59.000Z')
        evPendente.set('erros_validacao', [
          {
            campo: 'cadastro_incompleto',
            mensagem: 'Colaborador possui pendências de cadastro que impedem validação do S-1200.',
            acao: 'Regularizar campos CBO e NIS/PIS na aba Colaboradores.',
          },
        ])
        app.save(evPendente)
      }
    }

    // 7. Registrar log de auditoria
    const auditRecord = new Record(auditLogCol)
    auditRecord.set('tenant_id', tenantId)
    auditRecord.set('acao', 'esocial_seed_setup')
    auditRecord.set('entidade_tipo', 'esocial_config')
    auditRecord.set('entidade_id', empInovatech ? empInovatech.id : 'sistema')
    auditRecord.set(
      'detalhes',
      'Configurações e eventos e-Social criados para Inovatech (conforme) e Grãos do Sul (com alertas para supervisão).',
    )
    app.save(auditRecord)
  },
  (app) => {
    // Revert
  },
)

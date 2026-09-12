/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const reinfCol = app.findCollectionByNameOrId('reinf_eventos')
    const dctfwebCol = app.findCollectionByNameOrId('dctfweb_declaracoes')
    const contasFinCol = app.findCollectionByNameOrId('contas_financeiras')
    const obrigacoesCol = app.findCollectionByNameOrId('obrigacoes')
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

    let empInovatech = null
    let empGraos = null
    try {
      empInovatech = app.findFirstRecordByData('empresas', 'cnpj', '33.456.789/0001-12')
    } catch (_) {}
    try {
      empGraos = app.findFirstRecordByData('empresas', 'cnpj', '18.902.345/0001-88')
    } catch (_) {}

    // ==========================================
    // 1. INOVATECH (Ciclo 100% Conforme)
    // Competência 08/2026:
    // - R-1000 Transmitido
    // - R-2010 Serviços Tomados Transmitido (Retenção INSS 11% sobre NF de infraestrutura)
    // - R-2020 Serviços Prestados Transmitido
    // - R-2099 Fechamento Transmitido/Fechado
    // - e-Social S-1299 já fechado
    // - DCTFWeb 08/2026 Consolidada e Transmitida (Recibo oficial RFB)
    // Competência 09/2026:
    // - R-1000 Transmitido
    // - R-2010 Validado / Pronto (Retenção INSS R$ 385,00)
    // - DCTFWeb 09/2026 Consolidada e Pronta para Transmissão
    // ==========================================
    if (empInovatech) {
      // R-1000 Inovatech
      try {
        app.findFirstRecordByData('reinf_eventos', 'identificador_evento', 'ID1-R1000-INOVA-001')
      } catch (_) {
        const r1000 = new Record(reinfCol)
        r1000.set('tenant_id', tenantId)
        r1000.set('empresa', empInovatech.id)
        r1000.set('tipo_evento', 'R-1000')
        r1000.set('competencia', '01/2023')
        r1000.set('status', 'transmitido')
        r1000.set('identificador_evento', 'ID1-R1000-INOVA-001')
        r1000.set('prazo_legal', '2023-01-15 23:59:59.000Z')
        r1000.set('protocolo_envio', '2.202301.00001882901')
        r1000.set('recibo_entrega', '2.202301.00001882901-REC-01')
        r1000.set('data_transmissao', '2023-01-10 10:15:00.000Z')
        r1000.set('duracao_transmissao_ms', 1150)
        r1000.set('modo_envio', 'supervisao')
        r1000.set(
          'xml_gerado',
          '<?xml version="1.0" encoding="UTF-8"?>\n<Reinf xmlns="http://www.reinf.esocial.gov.br/schemas/evtInfoContribuinte/v2_01_02">\n  <evtInfoContri id="ID1334567890001122023011010150000001">\n    <ideEvento>\n      <tpAmb>2</tpAmb>\n      <procEmi>1</procEmi>\n      <verProc>Rumo-Reinf-2.1</verProc>\n    </ideEvento>\n    <ideContri>\n      <tpInsc>1</tpInsc>\n      <nrInsc>33456789000112</nrInsc>\n      <infoContri>\n        <inclusao>\n          <idePeriodo>\n            <iniValid>2023-01</iniValid>\n          </idePeriodo>\n          <infoCadastro>\n            <classTrib>01</classTrib>\n            <indEscrituracao>0</indEscrituracao>\n            <indDesoneracao>0</indDesoneracao>\n            <indAcordoIsenMulta>0</indAcordoIsenMulta>\n          </infoCadastro>\n        </inclusao>\n      </infoContri>\n    </ideContri>\n  </evtInfoContri>\n</Reinf>',
        )
        r1000.set('resposta_governo_json', {
          codigo: 201,
          descricao: 'Cadastro do contribuinte aceito com sucesso no EFD-Reinf.',
          recibo: '2.202301.00001882901-REC-01',
        })
        app.save(r1000)
      }

      // R-2010 Inovatech Comp 08/2026 (Transmitido)
      try {
        app.findFirstRecordByData('reinf_eventos', 'identificador_evento', 'ID1-R2010-INOVA-082026')
      } catch (_) {
        const r2010_08 = new Record(reinfCol)
        r2010_08.set('tenant_id', tenantId)
        r2010_08.set('empresa', empInovatech.id)
        r2010_08.set('tipo_evento', 'R-2010')
        r2010_08.set('competencia', '08/2026')
        r2010_08.set('status', 'transmitido')
        r2010_08.set('identificador_evento', 'ID1-R2010-INOVA-082026')
        r2010_08.set('prestador_cnpj_cpf', '12.987.654/0001-99')
        r2010_08.set('prestador_razao_social', 'DataCenter & Hosting Brasil Ltda')
        r2010_08.set('numero_documento', 'NFS-e 44921')
        r2010_08.set('valor_bruto', 4500.0)
        r2010_08.set('base_calculo', 4500.0)
        r2010_08.set('valor_retencao', 495.0)
        r2010_08.set('codigo_receita', '111-0')
        r2010_08.set('prazo_legal', '2026-09-15 23:59:59.000Z')
        r2010_08.set('protocolo_envio', '2.202609.00009948123')
        r2010_08.set('recibo_entrega', '2.202609.00009948123-REC-01')
        r2010_08.set('data_transmissao', '2026-09-02 18:00:00.000Z')
        r2010_08.set('duracao_transmissao_ms', 1080)
        r2010_08.set('modo_envio', 'supervisao')
        r2010_08.set(
          'xml_gerado',
          '<?xml version="1.0" encoding="UTF-8"?>\n<Reinf xmlns="http://www.reinf.esocial.gov.br/schemas/evtTomadServicos/v2_01_02">\n  <evtServTom id="ID1334567890001122026090218000000001">\n    <ideEvento>\n      <perApur>2026-08</perApur>\n      <tpAmb>2</tpAmb>\n      <procEmi>1</procEmi>\n      <verProc>Rumo-Reinf-2.1</verProc>\n    </ideEvento>\n    <ideContri>\n      <tpInsc>1</tpInsc>\n      <nrInsc>33456789000112</nrInsc>\n    </ideContri>\n    <infoServTom>\n      <idePrestServ>\n        <cnpjPrestador>12987654000199</cnpjPrestador>\n        <vlrTotalBruto>4500.00</vlrTotalBruto>\n        <vlrTotalBaseRet>4500.00</vlrTotalBaseRet>\n        <vlrTotalRetPrinc>495.00</vlrTotalRetPrinc>\n        <nfs>\n          <numDocto>44921</numDocto>\n          <dtEmisNF>2026-08-20</dtEmisNF>\n          <vlrBruto>4500.00</vlrBruto>\n        </nfs>\n      </idePrestServ>\n    </infoServTom>\n  </evtServTom>\n</Reinf>',
        )
        app.save(r2010_08)
      }

      // R-2099 Fechamento Inovatech Comp 08/2026 (Fechado)
      try {
        app.findFirstRecordByData('reinf_eventos', 'identificador_evento', 'ID1-R2099-INOVA-082026')
      } catch (_) {
        const r2099_08 = new Record(reinfCol)
        r2099_08.set('tenant_id', tenantId)
        r2099_08.set('empresa', empInovatech.id)
        r2099_08.set('tipo_evento', 'R-2099')
        r2099_08.set('competencia', '08/2026')
        r2099_08.set('status', 'fechado')
        r2099_08.set('identificador_evento', 'ID1-R2099-INOVA-082026')
        r2099_08.set('prazo_legal', '2026-09-15 23:59:59.000Z')
        r2099_08.set('protocolo_envio', '2.202609.00009948999')
        r2099_08.set('recibo_entrega', '2.202609.00009948999-REC-FECH')
        r2099_08.set('data_transmissao', '2026-09-02 18:04:00.000Z')
        r2099_08.set('duracao_transmissao_ms', 940)
        r2099_08.set('modo_envio', 'supervisao')
        r2099_08.set(
          'xml_gerado',
          '<?xml version="1.0" encoding="UTF-8"?>\n<Reinf xmlns="http://www.reinf.esocial.gov.br/schemas/evtFechamento/v2_01_02">\n  <evtFechaEvPer id="ID1334567890001122026090218040000001">\n    <ideEvento>\n      <perApur>2026-08</perApur>\n      <tpAmb>2</tpAmb>\n      <procEmi>1</procEmi>\n      <verProc>Rumo-Reinf-2.1</verProc>\n    </ideEvento>\n    <ideContri>\n      <tpInsc>1</tpInsc>\n      <nrInsc>33456789000112</nrInsc>\n    </ideContri>\n    <infoFecha>\n      <evtServTm>S</evtServTm>\n      <evtServPr>N</evtServPr>\n      <evtAssDesp>N</evtAssDesp>\n      <evtComProd>N</evtComProd>\n      <evtCPRB>N</evtCPRB>\n      <evtPgtos>N</evtPgtos>\n    </infoFecha>\n  </evtFechaEvPer>\n</Reinf>',
        )
        app.save(r2099_08)
      }

      // DCTFWeb 08/2026 Inovatech (Transmitida)
      try {
        app.findFirstRecordByData(
          'dctfweb_declaracoes',
          'numero_declaracao',
          'DCTFWEB-INOVA-202608-01',
        )
      } catch (_) {
        const dctf_08 = new Record(dctfwebCol)
        dctf_08.set('tenant_id', tenantId)
        dctf_08.set('empresa', empInovatech.id)
        dctf_08.set('competencia', '08/2026')
        dctf_08.set('tipo_declaracao', 'geral')
        dctf_08.set('status', 'transmitida')
        dctf_08.set('numero_declaracao', 'DCTFWEB-INOVA-202608-01')
        dctf_08.set('debitos_json', [
          {
            origem: 'e-Social (S-1200/S-1299)',
            codigo_receita: '111-0',
            descricao: 'Contribuição Previdenciária - Segurados Empregados e Avulsos',
            base_calculo: 24500.0,
            aliquota: 11.0,
            valor_apurado: 2695.0,
            deducoes: 0,
            saldo_pagar: 2695.0,
          },
          {
            origem: 'e-Social (S-1200/S-1299)',
            codigo_receita: '0561',
            descricao: 'IRRF - Rendimentos do Trabalho Assalariado',
            base_calculo: 24500.0,
            aliquota: 15.0,
            valor_apurado: 1980.5,
            deducoes: 0,
            saldo_pagar: 1980.5,
          },
          {
            origem: 'EFD-Reinf (R-2010)',
            codigo_receita: '111-0',
            descricao: 'Retenção INSS Lei 9.711/98 - Cessão de Mão de Obra / Serviços Tomados',
            base_calculo: 4500.0,
            aliquota: 11.0,
            valor_apurado: 495.0,
            deducoes: 0,
            saldo_pagar: 495.0,
          },
        ])
        dctf_08.set('total_debitos', 5170.5)
        dctf_08.set('total_deducoes', 0)
        dctf_08.set('saldo_a_recolher', 5170.5)
        dctf_08.set('esocial_status_fechamento', 'fechado')
        dctf_08.set('reinf_status_fechamento', 'fechado')
        dctf_08.set('pronta_para_transmitir', true)
        dctf_08.set('pendencias_bloqueantes', [])
        dctf_08.set('protocolo_envio', 'DCTFWEB.202609.991204881')
        dctf_08.set('recibo_entrega', 'DCTFWEB.202609.991204881-RECIBO-OFICIAL')
        dctf_08.set('data_transmissao', '2026-09-02 18:10:00.000Z')
        dctf_08.set('prazo_legal', '2026-09-25 23:59:59.000Z')
        dctf_08.set('modo_envio', 'supervisao')
        app.save(dctf_08)
      }

      // R-2010 Inovatech Comp 09/2026 (Validado / Pronto)
      try {
        app.findFirstRecordByData('reinf_eventos', 'identificador_evento', 'ID1-R2010-INOVA-092026')
      } catch (_) {
        const r2010_09 = new Record(reinfCol)
        r2010_09.set('tenant_id', tenantId)
        r2010_09.set('empresa', empInovatech.id)
        r2010_09.set('tipo_evento', 'R-2010')
        r2010_09.set('competencia', '09/2026')
        r2010_09.set('status', 'validado')
        r2010_09.set('identificador_evento', 'ID1-R2010-INOVA-092026')
        r2010_09.set('prestador_cnpj_cpf', '11.222.333/0001-44')
        r2010_09.set('prestador_razao_social', 'Segurança Digital & Suporte TI Ltda')
        r2010_09.set('numero_documento', 'NFSe 1092')
        r2010_09.set('valor_bruto', 3500.0)
        r2010_09.set('base_calculo', 3500.0)
        r2010_09.set('valor_retencao', 385.0)
        r2010_09.set('codigo_receita', '111-0')
        r2010_09.set('prazo_legal', '2026-10-15 23:59:59.000Z')
        r2010_09.set(
          'xml_gerado',
          '<?xml version="1.0" encoding="UTF-8"?>\n<Reinf xmlns="http://www.reinf.esocial.gov.br/schemas/evtTomadServicos/v2_01_02">\n  <evtServTom id="ID1334567890001122026091211000000001">\n    <ideEvento>\n      <perApur>2026-09</perApur>\n      <tpAmb>2</tpAmb>\n      <procEmi>1</procEmi>\n      <verProc>Rumo-Reinf-2.1</verProc>\n    </ideEvento>\n    <ideContri>\n      <tpInsc>1</tpInsc>\n      <nrInsc>33456789000112</nrInsc>\n    </ideContri>\n    <infoServTom>\n      <idePrestServ>\n        <cnpjPrestador>11222333000144</cnpjPrestador>\n        <vlrTotalBruto>3500.00</vlrTotalBruto>\n        <vlrTotalBaseRet>3500.00</vlrTotalBaseRet>\n        <vlrTotalRetPrinc>385.00</vlrTotalRetPrinc>\n        <nfs>\n          <numDocto>1092</numDocto>\n          <dtEmisNF>2026-09-08</dtEmisNF>\n          <vlrBruto>3500.00</vlrBruto>\n        </nfs>\n      </idePrestServ>\n    </infoServTom>\n  </evtServTom>\n</Reinf>',
        )
        app.save(r2010_09)
      }

      // DCTFWeb 09/2026 Inovatech (Consolidada)
      try {
        app.findFirstRecordByData(
          'dctfweb_declaracoes',
          'numero_declaracao',
          'DCTFWEB-INOVA-202609-01',
        )
      } catch (_) {
        const dctf_09 = new Record(dctfwebCol)
        dctf_09.set('tenant_id', tenantId)
        dctf_09.set('empresa', empInovatech.id)
        dctf_09.set('competencia', '09/2026')
        dctf_09.set('tipo_declaracao', 'geral')
        dctf_09.set('status', 'consolidada')
        dctf_09.set('numero_declaracao', 'DCTFWEB-INOVA-202609-01')
        dctf_09.set('debitos_json', [
          {
            origem: 'e-Social (S-1200/S-1210)',
            codigo_receita: '111-0',
            descricao: 'Contribuição Previdenciária - Segurados Empregados e Avulsos',
            base_calculo: 25000.0,
            aliquota: 11.0,
            valor_apurado: 2750.0,
            deducoes: 0,
            saldo_pagar: 2750.0,
          },
          {
            origem: 'e-Social (S-1200/S-1210)',
            codigo_receita: '0561',
            descricao: 'IRRF - Rendimentos do Trabalho Assalariado',
            base_calculo: 25000.0,
            aliquota: 15.0,
            valor_apurado: 2150.2,
            deducoes: 0,
            saldo_pagar: 2150.2,
          },
          {
            origem: 'EFD-Reinf (R-2010)',
            codigo_receita: '111-0',
            descricao: 'Retenção INSS Lei 9.711/98 - Cessão de Mão de Obra / Serviços Tomados',
            base_calculo: 3500.0,
            aliquota: 11.0,
            valor_apurado: 385.0,
            deducoes: 0,
            saldo_pagar: 385.0,
          },
          {
            origem: 'EFD-Reinf (R-4020/Serviços)',
            codigo_receita: '5952',
            descricao: 'CSRF - Retenção Contribuições Sociais (CSLL/PIS/COFINS 4,65%)',
            base_calculo: 3500.0,
            aliquota: 4.65,
            valor_apurado: 162.75,
            deducoes: 0,
            saldo_pagar: 162.75,
          },
        ])
        dctf_09.set('total_debitos', 5447.95)
        dctf_09.set('total_deducoes', 0)
        dctf_09.set('saldo_a_recolher', 5447.95)
        dctf_09.set('esocial_status_fechamento', 'pendente') // S-1299 ainda não foi fechado em 09/2026
        dctf_09.set('reinf_status_fechamento', 'pendente') // R-2099 ainda não foi fechado em 09/2026
        dctf_09.set('pronta_para_transmitir', false)
        dctf_09.set('pendencias_bloqueantes', [
          {
            modulo: 'e-Social',
            tipo_evento: 'S-1299',
            motivo:
              'Evento de Fechamento da Folha S-1299 não foi transmitido para a competência 09/2026.',
            acao: 'Acessar aba e-Social (S-1.1), validar os eventos S-1200 e transmitir o Fechamento S-1299.',
          },
          {
            modulo: 'EFD-Reinf',
            tipo_evento: 'R-2099',
            motivo:
              'Evento de Fechamento de Retenções R-2099 não foi transmitido para a competência 09/2026.',
            acao: 'Acessar aba EFD-Reinf & DCTFWeb, revisar o evento R-2010 e transmitir o Fechamento R-2099.',
          },
        ])
        dctf_09.set('prazo_legal', '2026-10-25 23:59:59.000Z')
        dctf_09.set('modo_envio', 'supervisao')
        app.save(dctf_09)
      }
    }

    // ==========================================
    // 2. GRÃOS DO SUL (Com Bloqueio Visível e Pendências Acionáveis)
    // Competência 09/2026:
    // - R-2010 com Inconsistência (CNPJ do prestador sem retenção informada corretamente)
    // - S-1200 pendente / rejeitado (CBO e NIS ausentes)
    // - DCTFWeb 09/2026 bloqueada por ausência de fechamento
    // ==========================================
    if (empGraos) {
      // R-1000 Grãos do Sul (Pendente com Alerta de Certificado)
      try {
        app.findFirstRecordByData('reinf_eventos', 'identificador_evento', 'ID1-R1000-GRAOS-001')
      } catch (_) {
        const r1000g = new Record(reinfCol)
        r1000g.set('tenant_id', tenantId)
        r1000g.set('empresa', empGraos.id)
        r1000g.set('tipo_evento', 'R-1000')
        r1000g.set('competencia', '09/2026')
        r1000g.set('status', 'pendente')
        r1000g.set('identificador_evento', 'ID1-R1000-GRAOS-001')
        r1000g.set('prazo_legal', '2026-10-15 23:59:59.000Z')
        r1000g.set('erros_validacao', [
          {
            campo: 'certificado_a1',
            mensagem: 'Certificado digital com alerta de validade próxima da expiração.',
            acao: 'Renovar o certificado digital e-CNPJ na aba Regularidade Fiscal.',
          },
        ])
        r1000g.set('modo_envio', 'supervisao')
        app.save(r1000g)
      }

      // R-2010 Grãos do Sul (Rejeitado/Inconsistente)
      try {
        app.findFirstRecordByData('reinf_eventos', 'identificador_evento', 'ID1-R2010-GRAOS-092026')
      } catch (_) {
        const r2010g = new Record(reinfCol)
        r2010g.set('tenant_id', tenantId)
        r2010g.set('empresa', empGraos.id)
        r2010g.set('tipo_evento', 'R-2010')
        r2010g.set('competencia', '09/2026')
        r2010g.set('status', 'rejeitado')
        r2010g.set('identificador_evento', 'ID1-R2010-GRAOS-092026')
        r2010g.set('prestador_cnpj_cpf', '00.000.000/0000-00')
        r2010g.set('prestador_razao_social', 'Serviços Gerais e Manutenção Ltda')
        r2010g.set('numero_documento', 'NF 8812')
        r2010g.set('valor_bruto', 1850.0)
        r2010g.set('base_calculo', 0)
        r2010g.set('valor_retencao', 0)
        r2010g.set('codigo_receita', '111-0')
        r2010g.set('prazo_legal', '2026-10-15 23:59:59.000Z')
        r2010g.set('erros_validacao', [
          {
            campo: 'prestador_cnpj_cpf',
            mensagem: 'CNPJ do prestador de serviço zerado ou inválido para validação do R-2010.',
            acao: 'Informar CNPJ válido do fornecedor emitente da nota de prestação de serviço.',
          },
          {
            campo: 'valor_retencao',
            mensagem: 'Alíquota de retenção de 11% (INSS) não aplicada sobre a base de cálculo.',
            acao: 'Revisar notas fiscais com retenção e recalcular a base retida.',
          },
        ])
        app.save(r2010g)
      }

      // DCTFWeb Grãos do Sul Comp 09/2026 (Pendente Bloqueada)
      try {
        app.findFirstRecordByData(
          'dctfweb_declaracoes',
          'numero_declaracao',
          'DCTFWEB-GRAOS-202609-01',
        )
      } catch (_) {
        const dctfG = new Record(dctfwebCol)
        dctfG.set('tenant_id', tenantId)
        dctfG.set('empresa', empGraos.id)
        dctfG.set('competencia', '09/2026')
        dctfG.set('tipo_declaracao', 'geral')
        dctfG.set('status', 'pendente')
        dctfG.set('numero_declaracao', 'DCTFWEB-GRAOS-202609-01')
        dctfG.set('debitos_json', [
          {
            origem: 'e-Social (S-1200)',
            codigo_receita: '111-0',
            descricao: 'Contribuição Previdenciária - Segurados Empregados (Pendente)',
            base_calculo: 1450.0,
            aliquota: 11.0,
            valor_apurado: 159.5,
            deducoes: 0,
            saldo_pagar: 159.5,
          },
          {
            origem: 'EFD-Reinf (R-2010)',
            codigo_receita: '111-0',
            descricao: 'Retenções sobre Serviços Tomados (Rejeitado)',
            base_calculo: 1850.0,
            aliquota: 0,
            valor_apurado: 0,
            deducoes: 0,
            saldo_pagar: 0,
          },
        ])
        dctfG.set('total_debitos', 159.5)
        dctfG.set('total_deducoes', 0)
        dctfG.set('saldo_a_recolher', 159.5)
        dctfG.set('esocial_status_fechamento', 'pendente')
        dctfG.set('reinf_status_fechamento', 'pendente')
        dctfG.set('pronta_para_transmitir', false)
        dctfG.set('pendencias_bloqueantes', [
          {
            modulo: 'e-Social',
            tipo_evento: 'S-2200 / S-1200',
            motivo: 'O evento S-2200 do colaborador está rejeitado por ausência de PIS e CBO.',
            acao: 'Corrigir a ficha cadastral do colaborador no DP para possibilitar o envio do S-1200.',
          },
          {
            modulo: 'e-Social',
            tipo_evento: 'S-1299',
            motivo: 'Competência 09/2026 não possui fechamento de folha S-1299 protocolado.',
            acao: 'Transmitir o evento S-1299 na aba e-Social antes de transmitir a DCTFWeb.',
          },
          {
            modulo: 'EFD-Reinf',
            tipo_evento: 'R-2010',
            motivo: 'Existem eventos de retenção com status REJEITADO (CNPJ prestador inválido).',
            acao: 'Corrigir as informações da nota de serviço e revalidar o evento R-2010.',
          },
          {
            modulo: 'EFD-Reinf',
            tipo_evento: 'R-2099',
            motivo: 'Evento de fechamento periódicos R-2099 não foi transmitido.',
            acao: 'Fechar os eventos periódicos do EFD-Reinf.',
          },
        ])
        dctfG.set('prazo_legal', '2026-10-25 23:59:59.000Z')
        dctfG.set('modo_envio', 'supervisao')
        app.save(dctfG)
      }
    }

    // Registrar auditoria
    const auditRecord = new Record(auditLogCol)
    auditRecord.set('tenant_id', tenantId)
    auditRecord.set('acao', 'reinf_dctfweb_seed_setup')
    auditRecord.set('entidade_tipo', 'dctfweb_declaracoes')
    auditRecord.set('entidade_id', empInovatech ? empInovatech.id : 'sistema')
    auditRecord.set(
      'detalhes',
      'Estruturas e seeds do EFD-Reinf e DCTFWeb criados com conformidade completa para Inovatech e bloqueio visível para Grãos do Sul.',
    )
    app.save(auditRecord)
  },
  (app) => {
    try {
      app
        .db()
        .newQuery("DELETE FROM dctfweb_declaracoes WHERE numero_declaracao LIKE 'DCTFWEB-%'")
        .execute()
      app
        .db()
        .newQuery("DELETE FROM reinf_eventos WHERE identificador_evento LIKE 'ID1-R%'")
        .execute()
    } catch (_) {}
  },
)

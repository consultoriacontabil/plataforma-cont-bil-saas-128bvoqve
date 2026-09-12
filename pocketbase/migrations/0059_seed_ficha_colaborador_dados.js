/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const funcsCol = app.findCollectionByNameOrId('funcionarios')
    const feriasCol = app.findCollectionByNameOrId('ferias_periodos')
    const eventosDpCol = app.findCollectionByNameOrId('eventos_dp')
    const esocialCol = app.findCollectionByNameOrId('esocial_eventos')

    // 1. Localizar Lucas Medeiros Albuquerque (Inovatech)
    let funcLucas = null
    try {
      funcLucas = app.findFirstRecordByData('funcionarios', 'cpf', '234.567.890-11')
    } catch (_) {}

    if (funcLucas) {
      const tenantId = funcLucas.get('tenant_id')
      const empresaId = funcLucas.get('empresa')

      // A) Férias Concedidas/Pagas para Lucas (Período aquisitivo 2024/2025 - gozo em Jan/2026)
      try {
        const existLucasFerias = app.findRecordsByFilter(
          'ferias_periodos',
          "funcionario = '" + funcLucas.id + "'",
          '',
          1,
          0,
        )
        if (existLucasFerias.length === 0) {
          const recFerias = new Record(feriasCol)
          recFerias.set('tenant_id', tenantId)
          recFerias.set('empresa', empresaId)
          recFerias.set('funcionario', funcLucas.id)
          recFerias.set('competencia', '01/2026')
          recFerias.set('periodo_aquisitivo_inicio', '2024-02-15 00:00:00.000Z')
          recFerias.set('periodo_aquisitivo_fim', '2025-02-14 00:00:00.000Z')
          recFerias.set('data_inicio_gozo', '2026-01-08 00:00:00.000Z')
          recFerias.set('data_fim_gozo', '2026-01-27 00:00:00.000Z')
          recFerias.set('dias_gozo', 20)
          recFerias.set('vender_abono', true)
          recFerias.set('dias_abono', 10)
          recFerias.set('adiantar_13', false)
          recFerias.set('salario_base', 11814.74)
          recFerias.set('media_variaveis', 680)
          recFerias.set('remuneracao_base_ferias', 12494.74)
          recFerias.set('valor_ferias_gozo', 8329.83)
          recFerias.set('terco_constitucional_ferias', 2776.61)
          recFerias.set('valor_abono_pecuniario', 4164.91)
          recFerias.set('terco_constitucional_abono', 1388.3)
          recFerias.set('total_bruto', 16659.65)
          recFerias.set('base_inss', 11106.44)
          recFerias.set('inss', 908.85)
          recFerias.set('base_irrf', 10197.59)
          recFerias.set('irrf', 1908.34)
          recFerias.set('total_descontos', 2817.19)
          recFerias.set('total_liquido', 13842.46)
          recFerias.set('data_limite_pagamento', '2026-01-06 00:00:00.000Z')
          recFerias.set(
            'mapa_medias_json',
            JSON.stringify([
              { competencia: '10/2025', verba: 'Horas Extras 50%', codigo: '1020', valor: 650 },
              { competencia: '11/2025', verba: 'Horas Extras 50%', codigo: '1020', valor: 710 },
              {
                competencia: 'Média Apurada',
                verba: 'Média de Horas Extras e DSR',
                codigo: 'MED',
                valor: 680,
              },
            ]),
          )
          recFerias.set('status', 'pago')
          recFerias.set('integrado_folha', true)
          recFerias.set('pago_em', '2026-01-06 10:00:00.000Z')
          recFerias.set(
            'observacoes',
            'Férias gozadas de 20 dias + abono pecuniário de 10 dias quitadas regularmente 2 dias antes do início do gozo (CLT art. 145).',
          )
          app.save(recFerias)
        }
      } catch (_) {}

      // B) Evento S-2230 Afastamento Temporário (Férias) transmitido
      try {
        const existS2230 = app.findRecordsByFilter(
          'esocial_eventos',
          "funcionario = '" + funcLucas.id + "' && tipo_evento = 'S-2230'",
          '',
          1,
          0,
        )
        if (existS2230.length === 0) {
          const recS2230 = new Record(esocialCol)
          recS2230.set('tenant_id', tenantId)
          recS2230.set('empresa', empresaId)
          recS2230.set('funcionario', funcLucas.id)
          recS2230.set('tipo_evento', 'S-2230')
          recS2230.set('competencia', '01/2026')
          recS2230.set('status', 'transmitido')
          recS2230.set('identificador_evento', 'ID1-S2230-INOVA-001')
          recS2230.set('prazo_legal', '2026-02-15 23:59:59.000Z')
          recS2230.set('data_transmissao', '2026-01-08 11:30:00.000Z')
          recS2230.set('duracao_transmissao_ms', 1120)
          recS2230.set('protocolo_envio', '1.2.202601.00000918231')
          recS2230.set('recibo_entrega', '1.2.202601.00000918231-REC-01')
          recS2230.set('modo_envio', 'supervisao')
          recS2230.set(
            'resposta_governo_json',
            JSON.stringify({
              codigo: 201,
              dataRecepcao: '2026-01-08T11:30:01.120Z',
              descricao: 'Afastamento temporário por férias processado com sucesso no e-Social.',
              recibo: '1.2.202601.00000918231-REC-01',
            }),
          )
          recS2230.set(
            'xml_gerado',
            `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtAfastTemp/v_S_01_01_00">
  <evtAfastTemp Id="ID1334567890001122026010811300000001">
    <ideEvento>
      <tpAmb>2</tpAmb>
      <procEmi>1</procEmi>
      <verProc>1.0.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>33456789000112</nrInsc>
    </ideEmpregador>
    <ideVinculo>
      <cpfTrab>23456789011</cpfTrab>
      <matricula>EMP-INOVA-001</matricula>
    </ideVinculo>
    <infoAfastamento>
      <iniAfastamento>
        <dtIniAfast>2026-01-08</dtIniAfast>
        <codMotAfast>15</codMotAfast>
      </iniAfastamento>
      <infoTermAfast>
        <dtTermAfast>2026-01-27</dtTermAfast>
      </infoTermAfast>
    </infoAfastamento>
  </evtAfastTemp>
</eSocial>`,
          )
          app.save(recS2230)
        }
      } catch (_) {}

      // C) Evento S-2205 Alteração de Dados Cadastrais transmitido
      try {
        const existS2205 = app.findRecordsByFilter(
          'esocial_eventos',
          "funcionario = '" + funcLucas.id + "' && tipo_evento = 'S-2205'",
          '',
          1,
          0,
        )
        if (existS2205.length === 0) {
          const recS2205 = new Record(esocialCol)
          recS2205.set('tenant_id', tenantId)
          recS2205.set('empresa', empresaId)
          recS2205.set('funcionario', funcLucas.id)
          recS2205.set('tipo_evento', 'S-2205')
          recS2205.set('competencia', '05/2025')
          recS2205.set('status', 'transmitido')
          recS2205.set('identificador_evento', 'ID1-S2205-INOVA-001')
          recS2205.set('prazo_legal', '2025-06-15 23:59:59.000Z')
          recS2205.set('data_transmissao', '2025-05-20 16:40:00.000Z')
          recS2205.set('duracao_transmissao_ms', 980)
          recS2205.set('protocolo_envio', '1.2.202505.00000781290')
          recS2205.set('recibo_entrega', '1.2.202505.00000781290-REC-01')
          recS2205.set('modo_envio', 'supervisao')
          recS2205.set(
            'resposta_governo_json',
            JSON.stringify({
              codigo: 201,
              dataRecepcao: '2025-05-20T16:40:01.000Z',
              descricao:
                'Alteração de dados cadastrais (inclusão de 2º dependente IRRF) processada com sucesso.',
              recibo: '1.2.202505.00000781290-REC-01',
            }),
          )
          recS2205.set(
            'xml_gerado',
            `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtAltCadastral/v_S_01_01_00">
  <evtAltCadastral Id="ID1334567890001122025052016400000001">
    <ideEvento>
      <tpAmb>2</tpAmb>
      <procEmi>1</procEmi>
      <verProc>1.0.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>33456789000112</nrInsc>
    </ideEmpregador>
    <ideTrabalhador>
      <cpfTrab>23456789011</cpfTrab>
    </ideTrabalhador>
    <alteracao>
      <dtAlteracao>2025-05-20</dtAlteracao>
      <dadosTrabalhador>
        <nmTrab>Lucas Medeiros Albuquerque</nmTrab>
        <sexo>M</sexo>
        <racaCor>1</racaCor>
        <estCiv>2</estCiv>
        <grauInstr>09</grauInstr>
      </dadosTrabalhador>
    </alteracao>
  </evtAltCadastral>
</eSocial>`,
          )
          app.save(recS2205)
        }
      } catch (_) {}

      // D) Eventos adicionais na timeline de DP de Lucas (Promoção e Alteração Salarial CCT)
      try {
        const existAltSal = app.findRecordsByFilter(
          'eventos_dp',
          "funcionario = '" + funcLucas.id + "' && tipo = 'alteracao_salarial'",
          '',
          1,
          0,
        )
        if (existAltSal.length === 0) {
          const ev1 = new Record(eventosDpCol)
          ev1.set('tenant_id', tenantId)
          ev1.set('empresa', empresaId)
          ev1.set('funcionario', funcLucas.id)
          ev1.set('tipo', 'alteracao_salarial')
          ev1.set('data_evento', '2026-01-05 10:00:00.000Z')
          ev1.set(
            'descricao',
            'Reajuste salarial de 5,8% conforme CCT SINDPD-SP 2026/2027. Salário base atualizado de R$ 11.814,74 para R$ 12.500,00.',
          )
          app.save(ev1)

          const ev2 = new Record(eventosDpCol)
          ev2.set('tenant_id', tenantId)
          ev2.set('empresa', empresaId)
          ev2.set('funcionario', funcLucas.id)
          ev2.set('tipo', 'ferias')
          ev2.set('data_evento', '2026-01-08 00:00:00.000Z')
          ev2.set(
            'descricao',
            'Gozo regular de férias de 20 dias (08/01 a 27/01/2026) com abono pecuniário de 10 dias. Período aquisitivo 2024/2025.',
          )
          app.save(ev2)
        }
      } catch (_) {}
    }
  },
  () => {},
)

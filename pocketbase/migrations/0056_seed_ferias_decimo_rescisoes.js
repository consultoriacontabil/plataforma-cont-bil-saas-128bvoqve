/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const funcsCol = app.findCollectionByNameOrId('funcionarios')
    const feriasCol = app.findCollectionByNameOrId('ferias_periodos')
    const decimoCol = app.findCollectionByNameOrId('decimo_terceiro')
    const rescisoesCol = app.findCollectionByNameOrId('rescisoes')
    const auditLogCol = app.findCollectionByNameOrId('audit_log')
    const esocialEventosCol = app.findCollectionByNameOrId('esocial_eventos')

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

    // Buscar Inovatech Soluções Digitais Ltda
    let empInovatech = null
    try {
      empInovatech = app.findFirstRecordByData('empresas', 'cnpj', '33.456.789/0001-12')
    } catch (_) {}

    // Buscar Grãos do Sul
    let empGraos = null
    try {
      empGraos = app.findFirstRecordByData('empresas', 'cnpj', '18.902.345/0001-88')
    } catch (_) {}

    // 1. SEEDS INOVATECH
    if (empInovatech) {
      const empresaId = empInovatech.id

      // A) Colaborador em Férias Calculadas: Mariana Duarte Souza (Tech Lead, R$ 15.000,00)
      let funcMariana = null
      try {
        funcMariana = app.findFirstRecordByData('funcionarios', 'cpf', '345.678.901-22')
      } catch (_) {}

      if (funcMariana) {
        // Férias de 20 dias com abono pecuniário de 10 dias (venda de 1/3 legal)
        // Salário base: 15.000,00. Média de variáveis: 450,00. Remuneração base: 15.450,00
        // Gozo 20 dias: 15.450 * (20/30) = 10.300,00. Terço: 3.433,33. Total gozo: 13.733,33
        // Abono 10 dias: 15.450 * (10/30) = 5.150,00. Terço abono: 1.716,67. Total abono: 6.866,67
        // Total bruto: 20.600,00
        // INSS teto: 908,85. IRRF (sobre gozo tributável 13.733,33 - 908,85 - 1 dep 189,59 = 12.634,89 a 27.5% - 896 = 2.578,59)
        // Líquido: 17.112,56
        let existFerias = null
        try {
          const list = app.findRecordsByFilter(
            'ferias_periodos',
            "funcionario = '" + funcMariana.id + "'",
            '',
            1,
            0,
          )
          if (list.length > 0) existFerias = list[0]
        } catch (_) {}

        if (!existFerias) {
          const recF = new Record(feriasCol)
          recF.set('tenant_id', tenantId)
          recF.set('empresa', empresaId)
          recF.set('funcionario', funcMariana.id)
          recF.set('competencia', '10/2026')
          recF.set('periodo_aquisitivo_inicio', '2025-08-01 00:00:00.000Z')
          recF.set('periodo_aquisitivo_fim', '2026-07-31 00:00:00.000Z')
          recF.set('data_inicio_gozo', '2026-10-05 00:00:00.000Z')
          recF.set('data_fim_gozo', '2026-10-24 00:00:00.000Z')
          recF.set('dias_gozo', 20)
          recF.set('vender_abono', true)
          recF.set('dias_abono', 10)
          recF.set('adiantar_13', false)
          recF.set('salario_base', 15000)
          recF.set('media_variaveis', 450)
          recF.set('remuneracao_base_ferias', 15450)
          recF.set('valor_ferias_gozo', 10300)
          recF.set('terco_constitucional_ferias', 3433.33)
          recF.set('valor_abono_pecuniario', 5150)
          recF.set('terco_constitucional_abono', 1716.67)
          recF.set('total_bruto', 20600)
          recF.set('base_inss', 13733.33)
          recF.set('inss', 908.85)
          recF.set('base_irrf', 12634.89)
          recF.set('irrf', 2578.59)
          recF.set('total_descontos', 3487.44)
          recF.set('total_liquido', 17112.56)
          recF.set('data_limite_pagamento', '2026-10-02 00:00:00.000Z')
          recF.set(
            'mapa_medias_json',
            JSON.stringify([
              {
                competencia: '07/2026',
                verba: 'Plantão Sobaviso Cloud',
                codigo: '1035',
                valor: 500,
              },
              {
                competencia: '08/2026',
                verba: 'Plantão Sobaviso Cloud',
                codigo: '1035',
                valor: 400,
              },
              {
                competencia: 'Média Apurada',
                verba: 'Divisão por 12 meses do período aquisitivo',
                codigo: 'MED',
                valor: 450,
              },
            ]),
          )
          recF.set('status', 'calculado')
          recF.set('integrado_folha', false)
          recF.set(
            'observacoes',
            'Férias programadas de 20 dias com abono de 10 dias. Pagamento devido até 02/10/2026 conforme CLT art. 145.',
          )
          app.save(recF)
        }

        // B) 13º Salário (1ª Parcela Paga): Lucas Medeiros Albuquerque (Engenheiro Sênior, R$ 12.500,00)
        let funcLucas = null
        try {
          funcLucas = app.findFirstRecordByData('funcionarios', 'cpf', '234.567.890-11')
        } catch (_) {}

        if (funcLucas) {
          let existDecimo = null
          try {
            const listD = app.findRecordsByFilter(
              'decimo_terceiro',
              "funcionario = '" + funcLucas.id + "' && parcela = 'primeira_parcela'",
              '',
              1,
              0,
            )
            if (listD.length > 0) existDecimo = listD[0]
          } catch (_) {}

          if (!existDecimo) {
            // Salário: 12.500,00. Médias variáveis (HE 50% e Noturno comp. 01 a 10): R$ 1.022,72
            // Remuneração base: 13.522,72. 1ª Parcela (50% sem descontos): R$ 6.761,36
            const recD = new Record(decimoCol)
            recD.set('tenant_id', tenantId)
            recD.set('empresa', empresaId)
            recD.set('funcionario', funcLucas.id)
            recD.set('ano', 2026)
            recD.set('competencia', '11/2026')
            recD.set('parcela', 'primeira_parcela')
            recD.set('meses_trabalhados', 12)
            recD.set('salario_base', 12500)
            recD.set('media_variaveis', 1022.72)
            recD.set('salario_maternidade_abatimento', 0)
            recD.set('remuneracao_base_calculo', 13522.72)
            recD.set('valor_bruto', 6761.36)
            recD.set('adiantamento_pago', 0)
            recD.set('base_inss', 0)
            recD.set('inss', 0) // Sem descontos na 1ª parcela conforme CLT
            recD.set('base_irrf', 0)
            recD.set('irrf', 0)
            recD.set('fgts', 540.91) // 8% sobre a parcela
            recD.set('total_descontos', 0)
            recD.set('total_liquido', 6761.36)
            recD.set(
              'mapa_medias_json',
              JSON.stringify([
                {
                  competencia: '09/2026',
                  verba: 'Horas Extras 50%',
                  codigo: '1020',
                  valor: 852.27,
                },
                {
                  competencia: '09/2026',
                  verba: 'Adicional Noturno 20%',
                  codigo: '1030',
                  valor: 170.45,
                },
                {
                  competencia: 'Média Anual',
                  verba: 'Média das verbas reflexo_ferias_13',
                  codigo: 'MED',
                  valor: 1022.72,
                },
              ]),
            )
            recD.set('codigo_receita_inss', '2172')
            recD.set('vencimento_guia_inss', '2026-12-20 00:00:00.000Z')
            recD.set('status', 'pago')
            recD.set('integrado_folha', true)
            recD.set('pago_em', '2026-11-28 10:00:00.000Z')
            recD.set(
              'observacoes',
              'Primeira parcela de 13º salário paga em 28/11/2026. Sem retenção de INSS/IRRF (descontos ocorrerão na 2ª parcela em 20/12).',
            )
            app.save(recD)
          }

          // C) Rescisão sem justa causa concluída na Inovatech
          // Guilherme Ramos Castro (Analista de QA, admitido em 10/01/2024, demitido em 15/09/2026)
          // Tempo de casa: 2 anos e 8 meses (2 anos completos => aviso prévio = 30 + 6 = 36 dias Lei 12.506/2011)
          let funcGuilherme = null
          try {
            funcGuilherme = app.findFirstRecordByData('funcionarios', 'cpf', '456.789.012-33')
          } catch (_) {}

          if (funcGuilherme) {
            let existResc = null
            try {
              const listR = app.findRecordsByFilter(
                'rescisoes',
                "funcionario = '" + funcGuilherme.id + "'",
                '',
                1,
                0,
              )
              if (listR.length > 0) existResc = listR[0]
            } catch (_) {}

            if (!existResc) {
              const recR = new Record(rescisoesCol)
              recR.set('tenant_id', tenantId)
              recR.set('empresa', empresaId)
              recR.set('funcionario', funcGuilherme.id)
              recR.set('motivo_desligamento', 'sem_justa_causa_empregador')
              recR.set('codigo_afastamento_esocial', '02')
              recR.set('data_aviso_previo', '2026-09-01 00:00:00.000Z')
              recR.set('tipo_aviso_previo', 'indenizado')
              recR.set('dias_aviso_previo', 36) // 30 + 3*2
              recR.set('data_desligamento', '2026-09-15 00:00:00.000Z')
              recR.set('data_projecao_aviso', '2026-10-21 00:00:00.000Z')
              recR.set('dias_saldo_salario', 15)
              recR.set('salario_base', 6200)
              recR.set('media_variaveis', 200)
              recR.set('saldo_salario_valor', 3100) // 15 dias de 6.200
              recR.set('aviso_previo_indenizado_valor', 7680) // 36 dias de (6.200+200)/30 = 213.33 * 36
              recR.set('decimo_terceiro_proporcional_valor', 4800) // 9/12 de 6.400
              recR.set('decimo_terceiro_indenizado_aviso', 533.33) // 1/12 da projeção aviso
              recR.set('ferias_vencidas_valor', 0)
              recR.set('terco_ferias_vencidas', 0)
              recR.set('ferias_proporcionais_valor', 4266.67) // 8/12 de 6.400
              recR.set('terco_ferias_proporcionais', 1422.22)
              recR.set('ferias_indenizadas_aviso', 711.11) // 1/12 com 1/3 do aviso indenizado
              recR.set('salario_familia_proporcional', 0)
              recR.set('outros_proventos', 0)
              recR.set('total_bruto_rescisao', 22513.33)
              recR.set('desconto_inss', 279) // INSS s/ saldo de salário 3.100
              recR.set('desconto_irrf', 38.86)
              recR.set('desconto_aviso_previo_nao_cumprido', 0)
              recR.set('desconto_adiantamento', 0)
              recR.set('outros_descontos', 0)
              recR.set('total_descontos_rescisao', 317.86)
              recR.set('total_liquido_rescisao', 22195.47)
              recR.set('saldo_fgts_para_fins_rescisorios', 14880) // ~24 meses de depósitos
              recR.set('aliquota_multa_fgts', 40)
              recR.set('valor_multa_rescisoria_fgts', 5952) // 40% de 14.880
              recR.set('saque_fgts_autorizado', true)
              recR.set('codigo_saque_fgts', '01')
              recR.set('prazo_pagamento_limite', '2026-09-25 00:00:00.000Z') // CLT 477 §6º: 10 dias
              recR.set(
                'alertas_conformidade_clt',
                JSON.stringify([
                  {
                    tipo: 'informativo',
                    regra: 'Lei nº 12.506/2011',
                    mensagem:
                      'Aviso prévio proporcional calculado: 30 dias base + 6 dias por 2 anos completos de serviço (Total: 36 dias).',
                  },
                  {
                    tipo: 'informativo',
                    regra: 'CLT Art. 477 §6º',
                    mensagem:
                      'Prazo improrrogável de pagamento da rescisão: até 25/09/2026 (10 dias corridos).',
                  },
                  {
                    tipo: 'informativo',
                    regra: 'Lei nº 8.036/90 Art. 18 §1º',
                    mensagem:
                      'Multa de 40% do FGTS sobre os depósitos atualizados (R$ 5.952,00). Adicional de 10% da LC 110/01 extinto pela Lei 13.932/2019.',
                  },
                ]),
              )
              recR.set(
                'mapa_medias_json',
                JSON.stringify([
                  {
                    competencia: '06/2026',
                    verba: 'Horas Extras 50%',
                    codigo: '1020',
                    valor: 150,
                  },
                  {
                    competencia: '07/2026',
                    verba: 'Horas Extras 50%',
                    codigo: '1020',
                    valor: 250,
                  },
                  {
                    competencia: 'Média Apurada',
                    verba: 'Média de horas extras variáveis',
                    codigo: 'MED',
                    valor: 200,
                  },
                ]),
              )
              recR.set(
                'verbas_rescisorias_detalhadas',
                JSON.stringify([
                  {
                    rubrica: '01',
                    descricao: 'Saldo de Salário (15 dias)',
                    tipo: 'provento',
                    valor: 3100,
                  },
                  {
                    rubrica: '02',
                    descricao: 'Aviso Prévio Indenizado (36 dias)',
                    tipo: 'provento',
                    valor: 7680,
                  },
                  {
                    rubrica: '03',
                    descricao: '13º Salário Proporcional (9/12)',
                    tipo: 'provento',
                    valor: 4800,
                  },
                  {
                    rubrica: '04',
                    descricao: '13º Salário sobre Aviso Indenizado (1/12)',
                    tipo: 'provento',
                    valor: 533.33,
                  },
                  {
                    rubrica: '05',
                    descricao: 'Férias Proporcionais (8/12)',
                    tipo: 'provento',
                    valor: 4266.67,
                  },
                  {
                    rubrica: '06',
                    descricao: '1/3 Constitucional sobre Férias Proporcionais',
                    tipo: 'provento',
                    valor: 1422.22,
                  },
                  {
                    rubrica: '07',
                    descricao: 'Férias Indenizadas Projeção Aviso (1/12 + 1/3)',
                    tipo: 'provento',
                    valor: 711.11,
                  },
                  {
                    rubrica: '9901',
                    descricao: 'INSS sobre Saldo de Salário',
                    tipo: 'desconto',
                    valor: 279,
                  },
                  {
                    rubrica: '9902',
                    descricao: 'IRRF Retido Rescisão',
                    tipo: 'desconto',
                    valor: 38.86,
                  },
                ]),
              )
              recR.set('status', 'concluida')
              recR.set('chave_conectividade_emitida', true)
              recR.set('concluido_em', '2026-09-15 16:30:00.000Z')
              recR.set(
                'observacoes',
                'Rescisão contratual sem justa causa homologada e quitada no prazo legal de 10 dias. TRCT gerado e e-Social S-2299 transmitido.',
              )
              app.save(recR)
            }
          }
        }
      }
    }

    // 2. SEEDS GRÃOS DO SUL (Rescisão pendente com alertas CLT para demonstrar avisos)
    if (empGraos) {
      const empresaId = empGraos.id

      // Colaborador Rodrigo Pires Nogueira (Barista Líder, R$ 3.200,00, admitido em 01/11/2023)
      let funcRodrigo = null
      try {
        funcRodrigo = app.findFirstRecordByData('funcionarios', 'cpf', '678.901.234-55')
      } catch (_) {}

      if (funcRodrigo) {
        let existRescGraos = null
        try {
          const listRG = app.findRecordsByFilter(
            'rescisoes',
            "funcionario = '" + funcRodrigo.id + "'",
            '',
            1,
            0,
          )
          if (listRG.length > 0) existRescGraos = listRG[0]
        } catch (_) {}

        if (!existRescGraos) {
          const recG = new Record(rescisoesCol)
          recG.set('tenant_id', tenantId)
          recG.set('empresa', empresaId)
          recG.set('funcionario', funcRodrigo.id)
          recG.set('motivo_desligamento', 'sem_justa_causa_empregador')
          recG.set('codigo_afastamento_esocial', '02')
          recG.set('data_aviso_previo', '') // ALERTA: Aviso prévio não informado!
          recG.set('tipo_aviso_previo', 'indenizado')
          recG.set('dias_aviso_previo', 36) // 30 + 3*2 anos
          recG.set('data_desligamento', '2026-09-20 00:00:00.000Z')
          recG.set('data_projecao_aviso', '2026-10-26 00:00:00.000Z')
          recG.set('dias_saldo_salario', 20)
          recG.set('salario_base', 3200)
          recG.set('media_variaveis', 0)
          recG.set('saldo_salario_valor', 2133.33)
          recG.set('aviso_previo_indenizado_valor', 3840) // 36 dias de 3.200/30
          recG.set('decimo_terceiro_proporcional_valor', 2400) // 9/12
          recG.set('decimo_terceiro_indenizado_aviso', 266.67)
          recG.set('ferias_vencidas_valor', 3200) // ALERTA: período aquisitivo vencido!
          recG.set('terco_ferias_vencidas', 1066.67)
          recG.set('ferias_proporcionais_valor', 2666.67)
          recG.set('terco_ferias_proporcionais', 888.89)
          recG.set('ferias_indenizadas_aviso', 355.56)
          recG.set('salario_familia_proporcional', 0)
          recG.set('outros_proventos', 0)
          recG.set('total_bruto_rescisao', 16821.79)
          recG.set('desconto_inss', 170.83)
          recG.set('desconto_irrf', 0)
          recG.set('desconto_aviso_previo_nao_cumprido', 0)
          recG.set('desconto_adiantamento', 0)
          recG.set('outros_descontos', 0)
          recG.set('total_descontos_rescisao', 170.83)
          recG.set('total_liquido_rescisao', 16650.96)
          recG.set('saldo_fgts_para_fins_rescisorios', 8700)
          recG.set('aliquota_multa_fgts', 40)
          recG.set('valor_multa_rescisoria_fgts', 3480)
          recG.set('saque_fgts_autorizado', true)
          recG.set('codigo_saque_fgts', '01')
          recG.set('prazo_pagamento_limite', '2026-09-30 00:00:00.000Z')
          recG.set(
            'alertas_conformidade_clt',
            JSON.stringify([
              {
                tipo: 'infracao',
                regra: 'CLT Art. 487 / Lei 12.506/2011',
                mensagem:
                  'Data de comunicação do aviso prévio não foi informada na dispensa sem justa causa. Risco de nulidade ou pagamento em dobro.',
                sugestao: 'Registre a data formal em que o colaborador tomou ciência por escrito.',
              },
              {
                tipo: 'aviso',
                regra: 'CLT Art. 134 e 137',
                mensagem:
                  'Constam férias vencidas não gozadas no período concessivo. Verifique se incide a dobra legal do art. 137.',
                sugestao: 'Confirmar se o período concessivo expirou antes do desligamento.',
              },
              {
                tipo: 'aviso',
                regra: 'CLT Art. 477 §8º',
                mensagem:
                  'Prazo limite de pagamento da rescisão expira em 30/09/2026. Atraso gera multa obrigatória de 1 salário contratual (R$ 3.200,00).',
                sugestao: 'Agende a quitação bancária e transmissão do S-2299 antes do vencimento.',
              },
            ]),
          )
          recG.set('mapa_medias_json', JSON.stringify([]))
          recG.set(
            'verbas_rescisorias_detalhadas',
            JSON.stringify([
              {
                rubrica: '01',
                descricao: 'Saldo de Salário (20 dias)',
                tipo: 'provento',
                valor: 2133.33,
              },
              {
                rubrica: '02',
                descricao: 'Aviso Prévio Indenizado (36 dias)',
                tipo: 'provento',
                valor: 3840,
              },
              {
                rubrica: '03',
                descricao: '13º Salário Proporcional (9/12)',
                tipo: 'provento',
                valor: 2400,
              },
              {
                rubrica: '04',
                descricao: '13º Indenizado Projeção Aviso',
                tipo: 'provento',
                valor: 266.67,
              },
              {
                rubrica: '05',
                descricao: 'Férias Vencidas Integrais',
                tipo: 'provento',
                valor: 3200,
              },
              {
                rubrica: '06',
                descricao: '1/3 Constitucional sobre Férias Vencidas',
                tipo: 'provento',
                valor: 1066.67,
              },
              {
                rubrica: '07',
                descricao: 'Férias Proporcionais',
                tipo: 'provento',
                valor: 2666.67,
              },
              {
                rubrica: '08',
                descricao: '1/3 Constitucional sobre Férias Proporcionais',
                tipo: 'provento',
                valor: 888.89,
              },
              {
                rubrica: '09',
                descricao: 'Férias Indenizadas Projeção Aviso + 1/3',
                tipo: 'provento',
                valor: 355.56,
              },
              {
                rubrica: '9901',
                descricao: 'INSS sobre Saldo de Salário',
                tipo: 'desconto',
                valor: 170.83,
              },
            ]),
          )
          recG.set('status', 'pendente_aprovacao')
          recG.set('chave_conectividade_emitida', false)
          recG.set(
            'observacoes',
            'Rescisão pendente de aprovação com 3 alertas de conformidade CLT para revisão da supervisão.',
          )
          app.save(recG)
        }
      }
    }
  },
  (app) => {
    // Reversão das seeds caso necessário
  },
)

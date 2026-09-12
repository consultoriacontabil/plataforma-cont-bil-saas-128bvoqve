/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
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

    if (!empInovatech) return

    const empresaInovaId = empInovatech.id

    // Coleções
    const beneficiosCol = app.findCollectionByNameOrId('beneficios_concedidos')
    const convencoesCol = app.findCollectionByNameOrId('convencoes_coletivas')
    const histSalCol = app.findCollectionByNameOrId('historico_salarial')

    // Funcionários Inovatech
    const funcsInova = app.findRecordsByFilter(
      'funcionarios',
      "empresa = '" + empresaInovaId + "'",
      'created',
      5,
      0,
    )

    const lucasFunc =
      funcsInova.find((f) => f.getString('nome_completo').includes('Lucas')) || funcsInova[0]
    const marianaFunc =
      funcsInova.find((f) => f.getString('nome_completo').includes('Mariana')) || funcsInova[1]
    const guilhermeFunc =
      funcsInova.find((f) => f.getString('nome_completo').includes('Guilherme')) || funcsInova[2]

    // 1. Semear Benefícios Concedidos (VT / VA / VR) para a competência 09/2026
    // Competência 09/2026 - 22 dias úteis
    if (lucasFunc) {
      // Lucas: VT + VR (Alelo e Ticket)
      // VT: 22 dias úteis, 2 passagens/dia de R$ 5,00 = R$ 220,00 concedido.
      // Teto 6% salário (12.500 * 6% = 750,00). Desconto colaborador: R$ 220,00 (pois custo é menor que 6%). Custo empresa: R$ 0,00.
      try {
        const existVtLucas = app.findRecordsByFilter(
          'beneficios_concedidos',
          "funcionario = '" +
            lucasFunc.id +
            "' && competencia = '09/2026' && tipo = 'vale_transporte'",
          '',
          1,
          0,
        )
        if (existVtLucas.length === 0) {
          const b1 = new Record(beneficiosCol)
          b1.set('tenant_id', tenantId)
          b1.set('empresa', empresaInovaId)
          b1.set('funcionario', lucasFunc.id)
          b1.set('competencia', '09/2026')
          b1.set('tipo', 'vale_transporte')
          b1.set('dias_uteis', 22)
          b1.set('quantidade_dia', 2)
          b1.set('valor_unitario', 5.0)
          b1.set('valor_total_beneficio', 220.0)
          b1.set('desconto_colaborador', 220.0) // menor entre teto 6% (750) e custo real (220)
          b1.set('custo_empresa', 0.0)
          b1.set('operadora', 'SPTrans / Bilhete Único')
          b1.set('numero_cartao', '9841-****-1029')
          b1.set('status', 'entregue')
          b1.set('data_entrega', '2026-09-01 08:00:00.000Z')
          b1.set(
            'observacoes',
            'Recarga mensal automática via cartão de transporte metropolitano SPTrans.',
          )
          app.save(b1)
        }
      } catch (_) {}

      // Lucas: VR (Vale Refeição): 22 dias úteis x R$ 42,00 = R$ 924,00
      try {
        const existVrLucas = app.findRecordsByFilter(
          'beneficios_concedidos',
          "funcionario = '" +
            lucasFunc.id +
            "' && competencia = '09/2026' && tipo = 'vale_refeicao'",
          '',
          1,
          0,
        )
        if (existVrLucas.length === 0) {
          const b2 = new Record(beneficiosCol)
          b2.set('tenant_id', tenantId)
          b2.set('empresa', empresaInovaId)
          b2.set('funcionario', lucasFunc.id)
          b2.set('competencia', '09/2026')
          b2.set('tipo', 'vale_refeicao')
          b2.set('dias_uteis', 22)
          b2.set('quantidade_dia', 1)
          b2.set('valor_unitario', 42.0)
          b2.set('valor_total_beneficio', 924.0)
          b2.set('desconto_colaborador', 46.2) // coparticipação padrão 5%
          b2.set('custo_empresa', 877.8)
          b2.set('operadora', 'Ticket Restaurante')
          b2.set('numero_cartao', '6032-****-5541')
          b2.set('status', 'entregue')
          b2.set('data_entrega', '2026-09-01 08:30:00.000Z')
          b2.set('observacoes', 'Crédito mensal disponibilizado no 1º dia útil.')
          app.save(b2)
        }
      } catch (_) {}
    }

    if (marianaFunc) {
      // Mariana: VA (Vale Alimentação) - Sodexo / Pluxee: R$ 850,00 fixo mensal
      try {
        const existVaMariana = app.findRecordsByFilter(
          'beneficios_concedidos',
          "funcionario = '" +
            marianaFunc.id +
            "' && competencia = '09/2026' && tipo = 'vale_alimentacao'",
          '',
          1,
          0,
        )
        if (existVaMariana.length === 0) {
          const b3 = new Record(beneficiosCol)
          b3.set('tenant_id', tenantId)
          b3.set('empresa', empresaInovaId)
          b3.set('funcionario', marianaFunc.id)
          b3.set('competencia', '09/2026')
          b3.set('tipo', 'vale_alimentacao')
          b3.set('dias_uteis', 22)
          b3.set('quantidade_dia', 1)
          b3.set('valor_unitario', 38.64)
          b3.set('valor_total_beneficio', 850.0)
          b3.set('desconto_colaborador', 42.5) // 5%
          b3.set('custo_empresa', 807.5)
          b3.set('operadora', 'Sodexo / Pluxee')
          b3.set('numero_cartao', '5020-****-9912')
          b3.set('status', 'entregue')
          b3.set('data_entrega', '2026-09-01 09:00:00.000Z')
          b3.set('observacoes', 'Disponibilizado conforme convenção coletiva.')
          app.save(b3)
        }
      } catch (_) {}
    }

    if (guilhermeFunc) {
      // Guilherme: VT (Vale Transporte)
      // Salário R$ 6.200 -> teto 6% = R$ 372,00. VT gasto: 22 dias x 2 passagens x R$ 5,00 = R$ 220,00
      try {
        const existVtGui = app.findRecordsByFilter(
          'beneficios_concedidos',
          "funcionario = '" +
            guilhermeFunc.id +
            "' && competencia = '09/2026' && tipo = 'vale_transporte'",
          '',
          1,
          0,
        )
        if (existVtGui.length === 0) {
          const b4 = new Record(beneficiosCol)
          b4.set('tenant_id', tenantId)
          b4.set('empresa', empresaInovaId)
          b4.set('funcionario', guilhermeFunc.id)
          b4.set('competencia', '09/2026')
          b4.set('tipo', 'vale_transporte')
          b4.set('dias_uteis', 22)
          b4.set('quantidade_dia', 2)
          b4.set('valor_unitario', 5.0)
          b4.set('valor_total_beneficio', 220.0)
          b4.set('desconto_colaborador', 220.0)
          b4.set('custo_empresa', 0.0)
          b4.set('operadora', 'EMTU / Bilhete Metropolitano')
          b4.set('numero_cartao', '8120-****-3310')
          b4.set('status', 'entregue')
          b4.set('data_entrega', '2026-09-01 08:00:00.000Z')
          b4.set(
            'observacoes',
            'Lançamento do benefício de deslocamento com desconto limitado a 6%.',
          )
          app.save(b4)
        }
      } catch (_) {}

      // Guilherme: VR Alelo Refeição: 22 dias x R$ 35,00 = R$ 770,00
      try {
        const existVrGui = app.findRecordsByFilter(
          'beneficios_concedidos',
          "funcionario = '" +
            guilhermeFunc.id +
            "' && competencia = '09/2026' && tipo = 'vale_refeicao'",
          '',
          1,
          0,
        )
        if (existVrGui.length === 0) {
          const b5 = new Record(beneficiosCol)
          b5.set('tenant_id', tenantId)
          b5.set('empresa', empresaInovaId)
          b5.set('funcionario', guilhermeFunc.id)
          b5.set('competencia', '09/2026')
          b5.set('tipo', 'vale_refeicao')
          b5.set('dias_uteis', 22)
          b5.set('quantidade_dia', 1)
          b5.set('valor_unitario', 35.0)
          b5.set('valor_total_beneficio', 770.0)
          b5.set('desconto_colaborador', 38.5)
          b5.set('custo_empresa', 731.5)
          b5.set('operadora', 'Alelo Refeição')
          b5.set('numero_cartao', '6504-****-7812')
          b5.set('status', 'entregue')
          b5.set('data_entrega', '2026-09-01 08:30:00.000Z')
          b5.set('observacoes', 'Entrega regular competência 09/2026.')
          app.save(b5)
        }
      } catch (_) {}
    }

    // 2. Semear Convenções Coletivas realistas
    // Convenção 1: Inovatech -> SINDPD-SP (Sindicato dos Trabalhadores em Processamento de Dados de SP)
    // Data base: Janeiro (01/01). Vigência: 01/01/2026 a 31/12/2026.
    let cctInova = null
    try {
      const existCctInova = app.findRecordsByFilter(
        'convencoes_coletivas',
        "empresa = '" + empresaInovaId + "' && sindicato_laboral ~ 'SINDPD'",
        '',
        1,
        0,
      )
      if (existCctInova.length > 0) {
        cctInova = existCctInova[0]
      }
    } catch (_) {}

    if (!cctInova) {
      cctInova = new Record(convencoesCol)
      cctInova.set('tenant_id', tenantId)
      cctInova.set('empresa', empresaInovaId)
      cctInova.set('titulo', 'CCT SINDPD-SP / SEPROSP 2026/2027')
      cctInova.set(
        'sindicato_laboral',
        'SINDPD - Sindicato dos Trabalhadores em Processamento de Dados e TI do Estado de SP',
      )
      cctInova.set(
        'sindicato_patronal',
        'SEPROSP - Sindicato das Empresas de Processamento de Dados do Estado de SP',
      )
      cctInova.set(
        'categoria_profissional',
        'Empregados em Empresas de Informática, Software e Tecnologia',
      )
      cctInova.set('numero_registro_mte', 'SP001428/2026')
      cctInova.set('data_base', '01/01')
      cctInova.set('vigencia_inicio', '2026-01-01 00:00:00.000Z')
      cctInova.set('vigencia_fim', '2026-12-31 23:59:59.000Z') // vence no fim do ano (monitoramento ativo)
      cctInova.set('piso_salarial', 2850.0)
      cctInova.set('percentual_reajuste', 5.8) // 5.8% de reajuste
      cctInova.set('data_aplicacao_reajuste', '2026-01-01 00:00:00.000Z')
      cctInova.set('adicional_hora_extra', 60.0) // 60% primeiras 2 horas
      cctInova.set('adicional_noturno', 25.0) // 25% (superior aos 20% da CLT)
      cctInova.set('adicional_insalubridade_minimo', 20.0)
      cctInova.set('ticket_refeicao_diario', 42.0)
      cctInova.set('auxilio_creche', 520.0)
      cctInova.set('parametros_adicionais_json', [
        { nome: 'Auxílio Creche até 4 anos', valor: 520.0, tipo: 'valor_fixo', unidade: 'R$/mês' },
        { nome: 'Reembolso KM / Deslocamento', valor: 1.45, tipo: 'valor_fixo', unidade: 'R$/km' },
        {
          nome: 'Seguro de Vida em Grupo Capital Mínimo',
          valor: 65000.0,
          tipo: 'valor_fixo',
          unidade: 'R$',
        },
        {
          nome: 'Estabilidade Gestante Adicional',
          valor: 60,
          tipo: 'dias',
          unidade: 'dias pós retorno',
        },
      ])
      cctInova.set('status_vigencia', 'vigente')
      cctInova.set('alerta_dias_config', 60)
      cctInova.set(
        'observacoes',
        'Convenção Coletiva de Trabalho homologada no MTE. Vigente até 31/12/2026. Monitoramento de renovação ativo para disparo aos 60 dias do vencimento.',
      )
      app.save(cctInova)
    }

    // Convenção 2: Grãos do Sul Cafeteria -> SINTHORESP (Trabalhadores em Hotéis, Restaurantes e Bares)
    // Próxima do vencimento (a vencer em 25 dias) para disparar alerta amarelo no monitoramento!
    if (empGraos) {
      let cctGraos = null
      try {
        const existCctGraos = app.findRecordsByFilter(
          'convencoes_coletivas',
          "empresa = '" + empGraos.id + "' && sindicato_laboral ~ 'Gastronomia'",
          '',
          1,
          0,
        )
        if (existCctGraos.length > 0) cctGraos = existCctGraos[0]
      } catch (_) {}

      if (!cctGraos) {
        cctGraos = new Record(convencoesCol)
        cctGraos.set('tenant_id', tenantId)
        cctGraos.set('empresa', empGraos.id)
        cctGraos.set('titulo', 'CCT Gastronomia e Cafeterias PR 2025/2026')
        cctGraos.set(
          'sindicato_laboral',
          'Sindicato dos Trabalhadores no Comércio Hoteleiro e Gastronomia do PR',
        )
        cctGraos.set(
          'sindicato_patronal',
          'Sindicato de Hotéis, Restaurantes, Bares e Similares de Curitiba',
        )
        cctGraos.set(
          'categoria_profissional',
          'Atendentes, Baristas, Garçons e Auxiliares de Cafeteria',
        )
        cctGraos.set('numero_registro_mte', 'PR000892/2025')
        cctGraos.set('data_base', '01/10')
        cctGraos.set('vigencia_inicio', '2025-10-01 00:00:00.000Z')
        // Vencimento em 25 dias: 2026-10-06 (status a_vencer_30)
        cctGraos.set('vigencia_fim', '2026-10-05 23:59:59.000Z')
        cctGraos.set('piso_salarial', 2150.0)
        cctGraos.set('percentual_reajuste', 4.9)
        cctGraos.set('data_aplicacao_reajuste', '2025-10-01 00:00:00.000Z')
        cctGraos.set('adicional_hora_extra', 55.0)
        cctGraos.set('adicional_noturno', 20.0)
        cctGraos.set('adicional_insalubridade_minimo', 20.0)
        cctGraos.set('ticket_refeicao_diario', 28.0)
        cctGraos.set('auxilio_creche', 350.0)
        cctGraos.set('parametros_adicionais_json', [
          { nome: 'Adicional de Quebra de Caixa', valor: 10.0, tipo: 'percentual', unidade: '%' },
          {
            nome: 'Uniforme e Lavanderia Fornecido',
            valor: 150.0,
            tipo: 'valor_fixo',
            unidade: 'R$/mês',
          },
        ])
        cctGraos.set('status_vigencia', 'a_vencer_30')
        cctGraos.set('alerta_dias_config', 60)
        cctGraos.set(
          'observacoes',
          'Atenção: Convenção Coletiva vence em menos de 30 dias (data-base Outubro). Contatar o sindicato para minuta de renovação.',
        )
        app.save(cctGraos)
      }
    }

    // 3. Semear Histórico Salarial inicial de auditoria para os colaboradores
    if (lucasFunc && cctInova) {
      try {
        const existHistLucas = app.findRecordsByFilter(
          'historico_salarial',
          "funcionario = '" + lucasFunc.id + "'",
          '',
          1,
          0,
        )
        if (existHistLucas.length === 0) {
          const h1 = new Record(histSalCol)
          h1.set('tenant_id', tenantId)
          h1.set('empresa', empresaInovaId)
          h1.set('funcionario', lucasFunc.id)
          h1.set('convencao_origem', cctInova.id)
          h1.set('data_alteracao', '2026-01-05 10:00:00.000Z')
          h1.set('competencia_vigencia', '01/2026')
          h1.set('motivo', 'reajuste_convencao_coletiva')
          h1.set('salario_anterior', 11814.74)
          h1.set('salario_novo', 12500.0)
          h1.set('percentual_aplicado', 5.8)
          h1.set('diferenca_mensal', 685.26)
          h1.set('retroativo_sugerido', 0)
          h1.set('meses_retroativos', 0)
          h1.set('lote_reajuste_id', 'LOTE-CCT-2026-01')
          h1.set('revertido', false)
          h1.set('detalhes_json', {
            cct_titulo: 'CCT SINDPD-SP / SEPROSP 2026/2027',
            motivo_detalhado: 'Aplicação integral do índice inflacionário pactuado de 5,8%.',
          })
          app.save(h1)
        }
      } catch (_) {}
    }
  },
  (app) => {
    // Reversão de dados semeados
  },
)

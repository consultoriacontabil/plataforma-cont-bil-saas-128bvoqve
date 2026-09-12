/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const funcsCol = app.findCollectionByNameOrId('funcionarios')
    const verbasCatCol = app.findCollectionByNameOrId('verbas_catalogo')
    const verbasLancCol = app.findCollectionByNameOrId('verbas_lancamentos')
    const folhaCol = app.findCollectionByNameOrId('folha_pagamento')
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

    // Buscar Inovatech
    let empInovatech = null
    try {
      empInovatech = app.findFirstRecordByData('empresas', 'cnpj', '33.456.789/0001-12')
    } catch (_) {}
    if (!empInovatech) return

    const empresaId = empInovatech.id

    // 1. Catálogo Padrão CLT da Legislação Trabalhista
    const verbasPadrao = [
      {
        codigo: '1020',
        descricao: 'Horas Extras 50% (CLT art. 59)',
        tipo: 'provento',
        rubrica_esocial: '1020',
        unidade: 'horas',
        valor_padrao: 50,
        incide_inss: true,
        incide_irrf: true,
        incide_fgts: true,
        integra_salario_contrib: true,
        reflexo_dsr: true,
        reflexo_ferias_13: true,
        ativo: true,
        observacoes: 'Hora extra padrão CLT: adicional mínimo constitucional de 50%.',
      },
      {
        codigo: '1021',
        descricao: 'Horas Extras 100% (Domingos e Feriados)',
        tipo: 'provento',
        rubrica_esocial: '1020',
        unidade: 'horas',
        valor_padrao: 100,
        incide_inss: true,
        incide_irrf: true,
        incide_fgts: true,
        integra_salario_contrib: true,
        reflexo_dsr: true,
        reflexo_ferias_13: true,
        ativo: true,
        observacoes:
          'Horas trabalhadas em repouso semanal remunerado ou feriados sem folga compensatória.',
      },
      {
        codigo: '1030',
        descricao: 'Adicional Noturno 20% (CLT art. 73)',
        tipo: 'provento',
        rubrica_esocial: '1000',
        unidade: 'horas',
        valor_padrao: 20,
        incide_inss: true,
        incide_irrf: true,
        incide_fgts: true,
        integra_salario_contrib: true,
        reflexo_dsr: true,
        reflexo_ferias_13: true,
        ativo: true,
        observacoes: 'Jornada urbana entre 22h e 5h. Hora ficta noturna reduzida de 52min30s.',
      },
      {
        codigo: '1040',
        descricao: 'DSR sobre Horas Extras / Noturno (Lei 605/49)',
        tipo: 'provento',
        rubrica_esocial: '1040',
        unidade: 'valor_fixo',
        valor_padrao: 0,
        incide_inss: true,
        incide_irrf: true,
        incide_fgts: true,
        integra_salario_contrib: true,
        reflexo_dsr: false,
        reflexo_ferias_13: true,
        ativo: true,
        observacoes: 'Reflexo das verbas variáveis habituais no repouso semanal remunerado.',
      },
      {
        codigo: '1055',
        descricao: 'Adicional de Insalubridade (CLT art. 192)',
        tipo: 'provento',
        rubrica_esocial: '1000',
        unidade: 'percentual',
        valor_padrao: 20,
        incide_inss: true,
        incide_irrf: true,
        incide_fgts: true,
        integra_salario_contrib: true,
        reflexo_dsr: false,
        reflexo_ferias_13: true,
        ativo: true,
        observacoes: 'Graus mínimo 10%, médio 20%, máximo 40% sobre o salário mínimo nacional.',
      },
      {
        codigo: '1056',
        descricao: 'Adicional de Periculosidade 30% (CLT art. 193)',
        tipo: 'provento',
        rubrica_esocial: '1000',
        unidade: 'percentual',
        valor_padrao: 30,
        incide_inss: true,
        incide_irrf: true,
        incide_fgts: true,
        integra_salario_contrib: true,
        reflexo_dsr: false,
        reflexo_ferias_13: true,
        ativo: true,
        observacoes:
          '30% sobre o salário base para atividades perigosas (inflamáveis, explosivos, elétrica).',
      },
      {
        codigo: '1070',
        descricao: 'Comissões / Gratificações (CLT art. 457 §1º)',
        tipo: 'provento',
        rubrica_esocial: '1000',
        unidade: 'valor_fixo',
        valor_padrao: 0,
        incide_inss: true,
        incide_irrf: true,
        incide_fgts: true,
        integra_salario_contrib: true,
        reflexo_dsr: true,
        reflexo_ferias_13: true,
        ativo: true,
        observacoes: 'Verba remuneratória integrante do salário de contribuição.',
      },
      {
        codigo: '1080',
        descricao: 'Salário-Família (Previdenciário)',
        tipo: 'provento',
        rubrica_esocial: '1000',
        unidade: 'valor_fixo',
        valor_padrao: 62.04,
        incide_inss: false,
        incide_irrf: false,
        incide_fgts: false,
        integra_salario_contrib: false,
        reflexo_dsr: false,
        reflexo_ferias_13: false,
        ativo: true,
        observacoes: 'Benefício previdenciário pago pela empresa e dedutível da guia de INSS.',
      },
      {
        codigo: '1085',
        descricao: 'Salário-Maternidade (Previdenciário)',
        tipo: 'provento',
        rubrica_esocial: '1000',
        unidade: 'valor_fixo',
        valor_padrao: 0,
        incide_inss: false, // isento de encargo previdenciário empregador / recuperável
        incide_irrf: true,
        incide_fgts: true,
        integra_salario_contrib: false,
        reflexo_dsr: false,
        reflexo_ferias_13: true,
        ativo: true,
        observacoes:
          'Licença-maternidade CLT. Empresa paga e compensa integralmente no e-Social/DCTFWeb.',
      },
      {
        codigo: '9001',
        descricao: 'Desconto Vale Transporte (Lei 7.418/85 - Teto 6%)',
        tipo: 'desconto',
        rubrica_esocial: '9904',
        unidade: 'percentual',
        valor_padrao: 6,
        incide_inss: false,
        incide_irrf: false,
        incide_fgts: false,
        integra_salario_contrib: false,
        reflexo_dsr: false,
        reflexo_ferias_13: false,
        ativo: true,
        observacoes:
          'Desconto legal limitado a 6% do salário-base ou valor real fornecido (o menor).',
      },
      {
        codigo: '9002',
        descricao: 'Adiantamento Salarial / Vale (CLT art. 462)',
        tipo: 'desconto',
        rubrica_esocial: '9901',
        unidade: 'valor_fixo',
        valor_padrao: 0,
        incide_inss: false,
        incide_irrf: false,
        incide_fgts: false,
        integra_salario_contrib: false,
        reflexo_dsr: false,
        reflexo_ferias_13: false,
        ativo: true,
        observacoes: 'Adiantamento quinzenal concedido ao colaborador.',
      },
      {
        codigo: '9003',
        descricao: 'Faltas Injustificadas e Atrasos (CLT art. 473)',
        tipo: 'desconto',
        rubrica_esocial: '9901',
        unidade: 'dias',
        valor_padrao: 0,
        incide_inss: false,
        incide_irrf: false,
        incide_fgts: false,
        integra_salario_contrib: false,
        reflexo_dsr: true,
        reflexo_ferias_13: true,
        ativo: true,
        observacoes:
          'Desconta o dia não trabalhado proporcional e acarreta perda do DSR da semana.',
      },
      {
        codigo: '9004',
        descricao: 'Desconto DSR por Falta na Semana',
        tipo: 'desconto',
        rubrica_esocial: '9901',
        unidade: 'dias',
        valor_padrao: 1,
        incide_inss: false,
        incide_irrf: false,
        incide_fgts: false,
        integra_salario_contrib: false,
        reflexo_dsr: false,
        reflexo_ferias_13: false,
        ativo: true,
        observacoes:
          'Perda da remuneração do repouso semanal decorrente de faltas sem justificativa legal.',
      },
      {
        codigo: '9005',
        descricao: 'Pensão Alimentícia Judicial',
        tipo: 'desconto',
        rubrica_esocial: '9902',
        unidade: 'valor_fixo',
        valor_padrao: 0,
        incide_inss: false,
        incide_irrf: false,
        incide_fgts: false,
        integra_salario_contrib: false,
        reflexo_dsr: false,
        reflexo_ferias_13: false,
        ativo: true,
        observacoes: 'Determinação judicial dedutível da base de cálculo do IRRF.',
      },
      {
        codigo: '9006',
        descricao: 'Plano de Saúde / Coparticipação',
        tipo: 'desconto',
        rubrica_esocial: '9901',
        unidade: 'valor_fixo',
        valor_padrao: 0,
        incide_inss: false,
        incide_irrf: false,
        incide_fgts: false,
        integra_salario_contrib: false,
        reflexo_dsr: false,
        reflexo_ferias_13: false,
        ativo: true,
        observacoes: 'Coparticipação médica assistencial sem incidência fiscal.',
      },
    ]

    const catalogoMap = new Map()

    for (const v of verbasPadrao) {
      let rec = null
      try {
        const exist = app.findRecordsByFilter(
          'verbas_catalogo',
          "tenant_id = '" +
            tenantId +
            "' && empresa = '" +
            empresaId +
            "' && codigo = '" +
            v.codigo +
            "'",
          '',
          1,
          0,
        )
        if (exist.length > 0) rec = exist[0]
      } catch (_) {}

      if (!rec) {
        rec = new Record(verbasCatCol)
        rec.set('tenant_id', tenantId)
        rec.set('empresa', empresaId)
        rec.set('codigo', v.codigo)
        rec.set('descricao', v.descricao)
        rec.set('tipo', v.tipo)
        rec.set('rubrica_esocial', v.rubrica_esocial)
        rec.set('unidade', v.unidade)
        rec.set('valor_padrao', v.valor_padrao)
        rec.set('incide_inss', v.incide_inss)
        rec.set('incide_irrf', v.incide_irrf)
        rec.set('incide_fgts', v.incide_fgts)
        rec.set('integra_salario_contrib', v.integra_salario_contrib)
        rec.set('reflexo_dsr', v.reflexo_dsr)
        rec.set('reflexo_ferias_13', v.reflexo_ferias_13)
        rec.set('ativo', v.ativo)
        rec.set('observacoes', v.observacoes)
        app.save(rec)
      }
      catalogoMap.set(v.codigo, rec)
    }

    // 2. Semear lançamentos realistas para Lucas Medeiros Albuquerque (Engenheiro Inovatech) na competência 09/2026
    // Salário base de Lucas: R$ 12.500,00 (220h/mês = R$ 56,82/hora)
    // Lançamentos do mês:
    // a) 10 Horas Extras a 50%: 10 * 56.82 * 1.5 = R$ 852.27
    // b) Adicional Noturno: 15 horas noturnas a 20%: 15 * 56.82 * 0.20 = R$ 170.45
    // c) DSR sobre HE e Noturno: (852.27 + 170.45) / 25 * 5 = R$ 204.54
    // d) Desconto Adiantamento Salarial: R$ 2.500,00
    // e) Desconto VT (teto 6% do salário base ou vale emitido, ex: R$ 450,00): R$ 450,00

    const funcsInova = app.findRecordsByFilter(
      'funcionarios',
      "empresa = '" + empresaId + "'",
      'created',
      1,
      0,
    )
    if (funcsInova.length > 0) {
      const funcLucas = funcsInova[0]
      const funcId = funcLucas.id
      const competencia = '09/2026'

      const lancamentosLucas = [
        {
          codigoVerba: '1020',
          quantidade: 10,
          aliquota_percentual: 50,
          valor_calculado: 852.27,
          referencia_detalhe:
            '10 horas extras com adicional constitucional de 50% (Hora base: R$ 56,82)',
          alertas_clt: [],
        },
        {
          codigoVerba: '1030',
          quantidade: 15,
          aliquota_percentual: 20,
          valor_calculado: 170.45,
          referencia_detalhe: '15 horas noturnas reduzidas a 20% (CLT art. 73)',
          alertas_clt: [],
        },
        {
          codigoVerba: '1040',
          quantidade: 1,
          aliquota_percentual: 0,
          valor_calculado: 204.54,
          referencia_detalhe:
            'Reflexo de DSR Lei 605/49 s/ variáveis (5 dias de repouso / 25 úteis)',
          alertas_clt: [],
        },
        {
          codigoVerba: '9002',
          quantidade: 1,
          aliquota_percentual: 0,
          valor_calculado: 2500.0,
          referencia_detalhe: 'Adiantamento salarial quitado em 20/09',
          alertas_clt: [],
        },
        {
          codigoVerba: '9001',
          quantidade: 1,
          aliquota_percentual: 3.6,
          valor_calculado: 450.0,
          referencia_detalhe:
            'Vale transporte fornecido R$ 450,00 (dentro do teto legal de 6% = R$ 750,00)',
          alertas_clt: [],
        },
      ]

      for (const lanc of lancamentosLucas) {
        const verbaObj = catalogoMap.get(lanc.codigoVerba)
        if (!verbaObj) continue

        let existLanc = null
        try {
          const lList = app.findRecordsByFilter(
            'verbas_lancamentos',
            "tenant_id = '" +
              tenantId +
              "' && funcionario = '" +
              funcId +
              "' && verba = '" +
              verbaObj.id +
              "' && competencia = '" +
              competencia +
              "'",
            '',
            1,
            0,
          )
          if (lList.length > 0) existLanc = lList[0]
        } catch (_) {}

        if (!existLanc) {
          const rLanc = new Record(verbasLancCol)
          rLanc.set('tenant_id', tenantId)
          rLanc.set('empresa', empresaId)
          rLanc.set('funcionario', funcId)
          rLanc.set('verba', verbaObj.id)
          rLanc.set('competencia', competencia)
          rLanc.set('quantidade', lanc.quantidade)
          rLanc.set('aliquota_percentual', lanc.aliquota_percentual)
          rLanc.set('valor_calculado', lanc.valor_calculado)
          rLanc.set('referencia_detalhe', lanc.referencia_detalhe)
          rLanc.set('alertas_clt', lanc.alertas_clt)
          app.save(rLanc)
        }
      }

      // Atualizar a folha de pagamento de Lucas com as novas verbas detalhadas e totais CLT
      // Salário Base: R$ 12.500,00
      // Proventos adicionais: 852.27 + 170.45 + 204.54 = R$ 1.227,26
      // Bruto Total: 12.500,00 + 1.227,26 = R$ 13.727,26
      // Base INSS: R$ 13.727,26 -> Teto INSS vigente R$ 908,85 (ou R$ 951,63 na tabela 2024/2026)
      // Base IRRF: R$ 13.727,26 - INSS (908,85) - 2 dependentes (2 * 189,59 = 379,18) = R$ 12.439,23
      // IRRF (27.5% - 896.00 dedução): 12.439.23 * 0.275 - 896.00 = R$ 2.524,79
      // FGTS (8% sobre 13.727,26): R$ 1.098,18
      // Descontos variáveis: Adiantamento (R$ 2.500,00) + VT (R$ 450,00) = R$ 2.950,00
      // Total descontos: 908.85 + 2524.79 + 2950.00 = R$ 6.383,64
      // Salário Líquido: 13.727,26 - 6.383,64 = R$ 7.343,62
      try {
        const folhasLucas = app.findRecordsByFilter(
          'folha_pagamento',
          "funcionario = '" + funcId + "' && competencia = '" + competencia + "'",
          '',
          1,
          0,
        )
        if (folhasLucas.length > 0) {
          const fLucas = folhasLucas[0]
          fLucas.set('salario_base', 12500)
          fLucas.set('proventos', [
            { descricao: 'Salário Base Contratual', valor: 12500 },
            { descricao: 'Horas Extras 50% (10h)', valor: 852.27, rubrica_esocial: '1020' },
            { descricao: 'Adicional Noturno 20% (15h)', valor: 170.45, rubrica_esocial: '1000' },
            {
              descricao: 'DSR sobre Horas Extras / Noturno',
              valor: 204.54,
              rubrica_esocial: '1040',
            },
          ])
          fLucas.set('descontos', [
            { descricao: 'INSS Previdência (Teto CLT)', valor: 908.85, rubrica_esocial: '9901' },
            { descricao: 'IRRF Retido na Fonte (2 dep.)', valor: 2524.79, rubrica_esocial: '9902' },
            { descricao: 'Adiantamento Salarial / Vale', valor: 2500.0, rubrica_esocial: '9901' },
            { descricao: 'Desconto Vale Transporte', valor: 450.0, rubrica_esocial: '9904' },
          ])
          fLucas.set('inss', 908.85)
          fLucas.set('irrf', 2524.79)
          fLucas.set('fgts', 1098.18)
          fLucas.set('total_liquido', 7343.62)
          app.save(fLucas)
        }
      } catch (errFolha) {
        console.warn('Erro ao atualizar folha de Lucas:', errFolha)
      }
    }

    // 3. Auditoria
    try {
      const auditRec = new Record(auditLogCol)
      auditRec.set('tenant_id', tenantId)
      auditRec.set('acao', 'verbas_seed_setup')
      auditRec.set('entidade_tipo', 'verbas_catalogo')
      auditRec.set('entidade_id', empresaId)
      auditRec.set(
        'detalhes',
        'Catálogo de verbas CLT e lançamentos da competência 09/2026 semeados com sucesso para a Inovatech.',
      )
      app.save(auditRec)
    } catch (_) {}
  },
  (app) => {
    // Reversão
  },
)

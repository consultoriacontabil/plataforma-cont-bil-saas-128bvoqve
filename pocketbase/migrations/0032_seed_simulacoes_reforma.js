migrate(
  (app) => {
    const simCol = app.findCollectionByNameOrId('simulacoes_reforma')
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    // Tenant padrão do Rumo
    let tenantId = ''
    try {
      const tenantRecord = app.findFirstRecordByData('tenants', 'cnpj', '12.345.678/0001-90')
      tenantId = tenantRecord.id
    } catch (_) {
      try {
        const records = app.findRecordsByFilter('tenants', '', '-created', 1, 0)
        if (records.length > 0) tenantId = records[0].id
      } catch (_) {}
    }

    if (!tenantId) return

    let userId = ''
    try {
      const userRecord = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'rumo@rumoconsultoriacontabil.com.br',
      )
      userId = userRecord.id
    } catch (_) {}

    // 1. Simulação para Inovatech (Simples Nacional, Serviços de TI)
    try {
      const inovatech = app.findFirstRecordByData('empresas', 'cnpj', '33.456.789/0001-12')

      // Verificar idempotência
      try {
        app.findFirstRecordByData(
          'simulacoes_reforma',
          'titulo',
          'Cenário Base 2026-2033 - Inovatech Software',
        )
      } catch (_) {
        const sim1 = new Record(simCol)
        sim1.set('tenant_id', tenantId)
        sim1.set('empresa', inovatech.id)
        sim1.set('titulo', 'Cenário Base 2026-2033 - Inovatech Software')
        sim1.set('razao_social', 'Inovatech Soluções Digitais Ltda')
        sim1.set('cnpj', '33.456.789/0001-12')
        sim1.set('regime_atual', 'simples_nacional')
        sim1.set('setor_atividade', 'tecnologia_software')
        sim1.set('faturamento_anual', 1800000)
        sim1.set('aliquota_atual_estimada', 12.0)
        sim1.set('percentual_creditos', 15)
        sim1.set('reducao_setorial_60', false)
        sim1.set('vende_cesta_basica', false)
        sim1.set('compartilhado_portal', true)
        if (userId) sim1.set('criado_por', userId)

        const inputs1 = {
          empresaId: inovatech.id,
          razaoSocial: 'Inovatech Soluções Digitais Ltda',
          regimeAtual: 'simples_nacional',
          faturamentoAnual: 1800000,
          percentualCreditosInsumos: 15,
          setorAtividade: 'tecnologia_software',
          reducaoSetorial60: false,
          vendeCestaBasica: false,
          percentualCestaBasica: 0,
          aliquotaAtualEstimada: 12.0,
          permanecerNoSimplesNaTransicao: true,
          anoBase: 2026,
        }

        const tabela1 = [
          { ano: 2026, cargaAtual: 216000, cargaProjetada: 216000, diferenca: 0, difPerc: 0 },
          { ano: 2027, cargaAtual: 216000, cargaProjetada: 220320, diferenca: 4320, difPerc: 2.0 },
          { ano: 2028, cargaAtual: 216000, cargaProjetada: 220320, diferenca: 4320, difPerc: 2.0 },
          { ano: 2029, cargaAtual: 216000, cargaProjetada: 226800, diferenca: 10800, difPerc: 5.0 },
          {
            ano: 2030,
            cargaAtual: 216000,
            cargaProjetada: 237600,
            diferenca: 21600,
            difPerc: 10.0,
          },
          {
            ano: 2031,
            cargaAtual: 216000,
            cargaProjetada: 248400,
            diferenca: 32400,
            difPerc: 15.0,
          },
          {
            ano: 2032,
            cargaAtual: 216000,
            cargaProjetada: 259200,
            diferenca: 43200,
            difPerc: 20.0,
          },
          {
            ano: 2033,
            cargaAtual: 216000,
            cargaProjetada: 270000,
            diferenca: 54000,
            difPerc: 25.0,
          },
        ]

        sim1.set('inputs_json', inputs1)
        sim1.set('resultado_json', {
          tabelaResumida: tabela1,
          impactoTotalAcumuladoReais: 166320,
          recomendacaoPrincipal:
            'Manter a opção pelo Simples Nacional com teto de 50% de redução até 2032.',
        })

        app.save(sim1)
      }
    } catch (_) {}

    // 2. Simulação para Dra. Beatriz Santos Clínica Médica Ltda (Lucro Presumido, Serviços de Saúde com redução de 60%)
    try {
      const clinica = app.findFirstRecordByData('empresas', 'cnpj', '45.123.987/0001-33')

      try {
        app.findFirstRecordByData(
          'simulacoes_reforma',
          'titulo',
          'Cenário Saúde 60% Redução - Clínica Bem Viver',
        )
      } catch (_) {
        const sim2 = new Record(simCol)
        sim2.set('tenant_id', tenantId)
        sim2.set('empresa', clinica.id)
        sim2.set('titulo', 'Cenário Saúde 60% Redução - Clínica Bem Viver')
        sim2.set('razao_social', 'Dra. Beatriz Santos Clínica Médica Ltda')
        sim2.set('cnpj', '45.123.987/0001-33')
        sim2.set('regime_atual', 'lucro_presumido')
        sim2.set('setor_atividade', 'servicos_saude')
        sim2.set('faturamento_anual', 2400000)
        sim2.set('aliquota_atual_estimada', 11.5)
        sim2.set('percentual_creditos', 25)
        sim2.set('reducao_setorial_60', true)
        sim2.set('vende_cesta_basica', false)
        sim2.set('compartilhado_portal', false)
        if (userId) sim2.set('criado_por', userId)

        const inputs2 = {
          empresaId: clinica.id,
          razaoSocial: 'Dra. Beatriz Santos Clínica Médica Ltda',
          regimeAtual: 'lucro_presumido',
          faturamentoAnual: 2400000,
          percentualCreditosInsumos: 25,
          setorAtividade: 'servicos_saude',
          reducaoSetorial60: true,
          vendeCestaBasica: false,
          percentualCestaBasica: 0,
          aliquotaAtualEstimada: 11.5,
          permanecerNoSimplesNaTransicao: false,
          anoBase: 2026,
        }

        sim2.set('inputs_json', inputs2)
        sim2.set('resultado_json', {
          impactoTotalAcumuladoReais: -12800,
          recomendacaoPrincipal:
            'Setor elegível à redução de 60% (LC 214/2025). Alíquota efetiva de IBS/CBS fica em ~10,6%, mantendo estabilidade tributária.',
        })

        app.save(sim2)
      }
    } catch (_) {}
  },
  (app) => {
    try {
      const records = app.findRecordsByFilter('simulacoes_reforma', "titulo ~ 'Cenário'", '', 10, 0)
      for (const rec of records) {
        app.delete(rec)
      }
    } catch (_) {}
  },
)

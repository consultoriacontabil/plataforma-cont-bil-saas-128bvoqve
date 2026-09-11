migrate(
  (app) => {
    const rankCol = app.findCollectionByNameOrId('rankings_reforma_trimestral')
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

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

    // Idempotência
    try {
      app.findFirstRecordByData('rankings_reforma_trimestral', 'periodo', '2025-T4')
      return // Já inserido
    } catch (_) {}

    // Seed: Rodada anterior demonstrativa (2025-T4) para gerar comparativo imediato no painel
    const dataAnterior = new Date(Date.now() - 90 * 86400000).toISOString() // ~3 meses atrás

    const recordAnterior = new Record(rankCol)
    recordAnterior.set('tenant_id', tenantId)
    recordAnterior.set('periodo', '2025-T4')
    recordAnterior.set('ano', 2025)
    recordAnterior.set('trimestre', 4)
    recordAnterior.set('data_execucao', dataAnterior)
    recordAnterior.set('executado_por_tipo', 'cron_trimestral')
    if (userId) recordAnterior.set('executado_por', userId)
    recordAnterior.set('total_empresas', 5)
    recordAnterior.set('total_suficientes', 5)
    recordAnterior.set('faturamento_total', 15600000)
    recordAnterior.set('impacto_total_acumulado', 1845000)
    recordAnterior.set('variacao_media_percentual', 11.8)
    recordAnterior.set('versao_normativa', 'EC 132/2023 e LC 214/2025 (Ref. Preliminar 2025)')

    // Snapshot simplificado das principais empresas para comparação
    const snapshotEmpresas = [
      {
        cnpj: '33.456.789/0001-12',
        razaoSocial: 'Inovatech Soluções Digitais Ltda',
        nomeFantasia: 'Inovatech Software',
        setor: 'tecnologia_software',
        setorNome: 'Tecnologia da Informação & Licenciamento de Software',
        regime: 'simples_nacional',
        faturamentoBase: 1800000,
        cargaAtualReais: 216000,
        carga2033Reais: 270000,
        impactoAcumuladoReais: 166320,
        variacao2033Percentual: 25.0,
      },
      {
        cnpj: '45.123.987/0001-33',
        razaoSocial: 'Dra. Beatriz Santos Clínica Médica Ltda',
        nomeFantasia: 'Clínica Bem Viver',
        setor: 'servicos_saude',
        setorNome: 'Serviços de Saúde Humana (Clínicas, Hospitais, Laboratórios)',
        regime: 'lucro_presumido',
        faturamentoBase: 2400000,
        cargaAtualReais: 276000,
        carga2033Reais: 263200,
        impactoAcumuladoReais: -12800,
        variacao2033Percentual: -4.6,
      },
      {
        cnpj: '07.654.321/0001-44',
        razaoSocial: 'LogPrime Transportes e Armazéns Gerais S/A',
        nomeFantasia: 'LogPrime Express',
        setor: 'transporte_coletivo',
        setorNome: 'Transporte Coletivo de Passageiros',
        regime: 'lucro_presumido',
        faturamentoBase: 6000000,
        cargaAtualReais: 540000,
        carga2033Reais: 636000,
        impactoAcumuladoReais: 576000,
        variacao2033Percentual: 17.8,
      },
      {
        cnpj: '18.902.345/0001-88',
        razaoSocial: 'Café & Grãos Gourmet do Sul Comércio Ltda',
        nomeFantasia: 'Grãos do Sul Cafeteria',
        setor: 'comercio_geral',
        setorNome: 'Comércio Varejista e Atacadista Geral',
        regime: 'simples_nacional',
        faturamentoBase: 2400000,
        cargaAtualReais: 288000,
        carga2033Reais: 360000,
        impactoAcumuladoReais: 396000,
        variacao2033Percentual: 25.0,
      },
      {
        cnpj: '11.444.777/0001-61',
        razaoSocial: 'Nova Era Tecnologia & Soluções Contábeis Ltda',
        nomeFantasia: 'Nova Era Tech',
        setor: 'servicos_geral',
        setorNome: 'Serviços em Geral / Consultoria / BPO',
        regime: 'simples_nacional',
        faturamentoBase: 600000,
        cargaAtualReais: 57000,
        carga2033Reais: 71250,
        impactoAcumuladoReais: 78500,
        variacao2033Percentual: 25.0,
      },
    ]

    recordAnterior.set('resultado_json', {
      rankingEmpresas: snapshotEmpresas,
      totalEmpresasAnalisadas: 5,
      totalEmpresasSuficientes: 5,
      impactoTotalCarteiraAcumuladoReais: 1204020,
    })
    recordAnterior.set('alertas_variacao_json', [])

    app.save(recordAnterior)
  },
  (app) => {
    try {
      const records = app.findRecordsByFilter(
        'rankings_reforma_trimestral',
        "periodo = '2025-T4'",
        '',
        1,
        0,
      )
      for (const r of records) {
        app.delete(r)
      }
    } catch (_) {}
  },
)

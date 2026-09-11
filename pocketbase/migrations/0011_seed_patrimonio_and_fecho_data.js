/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const tenantList = app.findRecordsByFilter('tenants', 'ativo = true', '-created', 10, 0)
    if (!tenantList || tenantList.length === 0) return

    const primaryTenant = tenantList[0]
    const planoContasCol = app.findCollectionByNameOrId('plano_contas')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const ativosCol = app.findCollectionByNameOrId('ativos')
    const lancamentosCol = app.findCollectionByNameOrId('lancamentos_contabeis')
    const fechamentoCol = app.findCollectionByNameOrId('fechamento_competencia')
    const checklistCol = app.findCollectionByNameOrId('fechamento_checklist_itens')

    // Find staff user
    let staffUser
    try {
      staffUser = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'carlos.silva@rumoconsultoria.com.br',
      )
    } catch (_) {
      try {
        staffUser = app.findAuthRecordByEmail(
          '_pb_users_auth_',
          'rumo@rumoconsultoriacontabil.com.br',
        )
      } catch (_) {}
    }

    // 1. Complementar Plano de Contas com contas essenciais para imobilizado e depreciação
    // Contas a adicionar/verificar:
    // 1.2.1.02 - Veículos (Ativo Imobilizado)
    // 1.2.1.03 - Móveis e Utensílios
    // 1.2.1.04 - Computadores e Periféricos
    // 1.2.1.09 - (-) Depreciação Acumulada
    // 4.2.4 - Despesas com Depreciação e Amortização
    // 3.1.9 - Outras Receitas Operacionais / Alienação de Bens
    const contasExtras = [
      {
        codigo: '1.2.1.02',
        nome: 'Veículos de Transporte',
        tipo: 'ativo',
        nivel: 4,
        paiCodigo: '1.2.1',
      },
      {
        codigo: '1.2.1.03',
        nome: 'Móveis, Utensílios e Instalações',
        tipo: 'ativo',
        nivel: 4,
        paiCodigo: '1.2.1',
      },
      {
        codigo: '1.2.1.04',
        nome: 'Computadores e Equipamentos de Informática',
        tipo: 'ativo',
        nivel: 4,
        paiCodigo: '1.2.1',
      },
      {
        codigo: '1.2.1.09',
        nome: '(-) Depreciação Acumulada do Imobilizado',
        tipo: 'ativo',
        nivel: 4,
        paiCodigo: '1.2.1',
      },
      {
        codigo: '4.2.4',
        nome: 'Despesas com Depreciação e Amortização',
        tipo: 'despesa',
        nivel: 3,
        paiCodigo: '4.2',
      },
      {
        codigo: '4.2.5',
        nome: 'Perdas de Capital na Baixa de Ativos',
        tipo: 'despesa',
        nivel: 3,
        paiCodigo: '4.2',
      },
      {
        codigo: '3.1.9',
        nome: 'Ganhos de Capital na Alienação de Ativos',
        tipo: 'receita',
        nivel: 3,
        paiCodigo: '3.1',
      },
    ]

    const mapContas = {}
    // Carregar contas existentes
    const todasContas = app.findRecordsByFilter(
      'plano_contas',
      `tenant_id = '${primaryTenant.id}'`,
      'codigo',
      100,
      0,
    )
    todasContas.forEach((c) => {
      mapContas[c.getString('codigo')] = c.id
    })

    for (let i = 0; i < contasExtras.length; i++) {
      const ce = contasExtras[i]
      if (!mapContas[ce.codigo]) {
        const rec = new Record(planoContasCol)
        rec.set('tenant_id', primaryTenant.id)
        rec.set('codigo', ce.codigo)
        rec.set('nome', ce.nome)
        rec.set('tipo', ce.tipo)
        rec.set('nivel', ce.nivel)
        rec.set('ativa', true)
        if (ce.paiCodigo && mapContas[ce.paiCodigo]) {
          rec.set('pai', mapContas[ce.paiCodigo])
        }
        app.save(rec)
        mapContas[ce.codigo] = rec.id
      }
    }

    // 2. Buscar empresas
    const empresas = app.findRecordsByFilter(
      'empresas',
      `tenant_id = '${primaryTenant.id}'`,
      '-created',
      10,
      0,
    )
    if (!empresas || empresas.length === 0) return

    const empInovatech =
      empresas.find((e) => e.getString('cnpj') === '33.456.789/0001-12') || empresas[0]
    const empGraos =
      empresas.find((e) => e.getString('cnpj') === '18.902.345/0001-88') ||
      empresas[1] ||
      empresas[0]

    // 3. Seed Ativos Patrimoniais
    // Bens para Inovatech e Grãos do Sul
    const seedAtivos = [
      {
        tenant_id: primaryTenant.id,
        empresa: empInovatech.id,
        descricao: 'Servidores Dell PowerEdge R750 Cloud Host',
        categoria: 'computadores_ti',
        numero_nf: 'NF-e 88201',
        fornecedor: 'Dell Computadores do Brasil Ltda',
        data_aquisicao: '2025-01-15 10:00:00.000Z',
        valor_aquisicao: 48000.0,
        valor_residual: 4800.0, // 10%
        taxa_depreciacao_anual: 20.0, // 20% a.a. (vida útil 5 anos)
        vida_util_meses: 60,
        conta_ativo: mapContas['1.2.1.04'] || mapContas['1.2.1.01'],
        conta_depreciacao_acumulada: mapContas['1.2.1.09'] || mapContas['1.2.1.01'],
        conta_despesa_depreciacao: mapContas['4.2.4'] || mapContas['4.2.1'],
        status: 'ativo',
        depreciacao_acumulada_calculada: 14400.0, // 20 meses x 720
        ultima_competencia_depreciada: '08/2026',
        observacoes: 'Infraestrutura central de produção e staging na nuvem privada',
      },
      {
        tenant_id: primaryTenant.id,
        empresa: empInovatech.id,
        descricao: 'Estações de Trabalho Mac Studio M2 Max (Lote 5 unidades)',
        categoria: 'computadores_ti',
        numero_nf: 'NF-e 91040',
        fornecedor: 'Apple Computer Brasil Ltda',
        data_aquisicao: '2025-06-10 14:00:00.000Z',
        valor_aquisicao: 75000.0,
        valor_residual: 7500.0,
        taxa_depreciacao_anual: 20.0,
        vida_util_meses: 60,
        conta_ativo: mapContas['1.2.1.04'] || mapContas['1.2.1.01'],
        conta_depreciacao_acumulada: mapContas['1.2.1.09'] || mapContas['1.2.1.01'],
        conta_despesa_depreciacao: mapContas['4.2.4'] || mapContas['4.2.1'],
        status: 'ativo',
        depreciacao_acumulada_calculada: 16875.0, // ~15 meses x 1.125
        ultima_competencia_depreciada: '08/2026',
        observacoes: 'Utilizado pela equipe de engenharia e inteligência artificial',
      },
      {
        tenant_id: primaryTenant.id,
        empresa: empInovatech.id,
        descricao: 'Mobiliário Ergonômico Herman Miller Escritório Paulista',
        categoria: 'moveis_utensilios',
        numero_nf: 'NF-e 44320',
        fornecedor: 'Atec Original Design Mobiliário',
        data_aquisicao: '2024-03-01 09:00:00.000Z',
        valor_aquisicao: 36000.0,
        valor_residual: 3600.0,
        taxa_depreciacao_anual: 10.0, // 10% a.a. (vida útil 10 anos)
        vida_util_meses: 120,
        conta_ativo: mapContas['1.2.1.03'] || mapContas['1.2.1.01'],
        conta_depreciacao_acumulada: mapContas['1.2.1.09'] || mapContas['1.2.1.01'],
        conta_despesa_depreciacao: mapContas['4.2.4'] || mapContas['4.2.1'],
        status: 'ativo',
        depreciacao_acumulada_calculada: 8100.0, // 30 meses x 270
        ultima_competencia_depreciada: '08/2026',
        observacoes: 'Mesas com regulagem de altura e cadeiras ergonômicas',
      },
      {
        tenant_id: primaryTenant.id,
        empresa: empGraos.id,
        descricao: 'Máquina de Café Espresso Profissional La Marzocco Strada 3G',
        categoria: 'maquinas_equipamentos',
        numero_nf: 'NF-e 11980',
        fornecedor: 'Pasquali Máquinas Especiais do Brasil',
        data_aquisicao: '2024-08-20 11:30:00.000Z',
        valor_aquisicao: 85000.0,
        valor_residual: 8500.0,
        taxa_depreciacao_anual: 10.0,
        vida_util_meses: 120,
        conta_ativo: mapContas['1.2.1.01'],
        conta_depreciacao_acumulada: mapContas['1.2.1.09'] || mapContas['1.2.1.01'],
        conta_despesa_depreciacao: mapContas['4.2.4'] || mapContas['4.2.1'],
        status: 'ativo',
        depreciacao_acumulada_calculada: 15300.0, // 24 meses x 637.50
        ultima_competencia_depreciada: '08/2026',
        observacoes: 'Principal equipamento da cafeteria matriz no calçadão XV de Novembro',
      },
      {
        tenant_id: primaryTenant.id,
        empresa: empGraos.id,
        descricao: 'Furgão Utilitário Renault Master 2.3 dCi Furgão L3H2',
        categoria: 'veiculos',
        numero_nf: 'NF-e 76512',
        fornecedor: 'Concessionária Renault Curitiba Sul',
        data_aquisicao: '2023-11-05 16:00:00.000Z',
        valor_aquisicao: 160000.0,
        valor_residual: 32000.0, // 20%
        taxa_depreciacao_anual: 20.0, // 5 anos
        vida_util_meses: 60,
        conta_ativo: mapContas['1.2.1.02'] || mapContas['1.2.1.01'],
        conta_depreciacao_acumulada: mapContas['1.2.1.09'] || mapContas['1.2.1.01'],
        conta_despesa_depreciacao: mapContas['4.2.4'] || mapContas['4.2.1'],
        status: 'ativo',
        depreciacao_acumulada_calculada: 70400.0, // 33 meses x 2133.33
        ultima_competencia_depreciada: '08/2026',
        observacoes: 'Veículo para distribuição de cafés especiais torrados para filiais',
      },
    ]

    const savedAtivos = []
    for (let i = 0; i < seedAtivos.length; i++) {
      const sa = seedAtivos[i]
      try {
        const exist = app.findRecordsByFilter(
          'ativos',
          `tenant_id = '${sa.tenant_id}' && descricao = '${sa.descricao}'`,
          '',
          1,
          0,
        )
        if (exist.length > 0) {
          savedAtivos.push(exist[0])
          continue
        }
      } catch (_) {}

      const rec = new Record(ativosCol)
      rec.set('tenant_id', sa.tenant_id)
      rec.set('empresa', sa.empresa)
      rec.set('descricao', sa.descricao)
      rec.set('categoria', sa.categoria)
      rec.set('numero_nf', sa.numero_nf)
      rec.set('fornecedor', sa.fornecedor)
      rec.set('data_aquisicao', sa.data_aquisicao)
      rec.set('valor_aquisicao', sa.valor_aquisicao)
      rec.set('valor_residual', sa.valor_residual)
      rec.set('taxa_depreciacao_anual', sa.taxa_depreciacao_anual)
      rec.set('vida_util_meses', sa.vida_util_meses)
      rec.set('conta_ativo', sa.conta_ativo)
      if (sa.conta_depreciacao_acumulada)
        rec.set('conta_depreciacao_acumulada', sa.conta_depreciacao_acumulada)
      if (sa.conta_despesa_depreciacao)
        rec.set('conta_despesa_depreciacao', sa.conta_despesa_depreciacao)
      rec.set('status', sa.status)
      rec.set('depreciacao_acumulada_calculada', sa.depreciacao_acumulada_calculada)
      rec.set('ultima_competencia_depreciada', sa.ultima_competencia_depreciada)
      rec.set('observacoes', sa.observacoes)
      app.save(rec)
      savedAtivos.push(rec)
    }

    // 4. Seed Lançamento Contábil de Depreciação já processada na competência 08/2026
    // Ex: Inovatech competência 08/2026:
    // Depreciação Servidores: (48000 - 4800) * 0.20 / 12 = R$ 720,00
    // Depreciação Macs: (75000 - 7500) * 0.20 / 12 = R$ 1.125,00
    // Depreciação Móveis: (36000 - 3600) * 0.10 / 12 = R$ 270,00
    // Total depreciação Inovatech 08/2026: R$ 2.115,00
    const loteDeprec08 = 'LOTE-DEP-INOVATECH-08-2026'
    try {
      const existDep = app.findRecordsByFilter(
        'lancamentos_contabeis',
        `tenant_id = '${primaryTenant.id}' && lote_id = '${loteDeprec08}'`,
        '',
        1,
        0,
      )
      if (existDep.length === 0 && mapContas['4.2.4'] && mapContas['1.2.1.09']) {
        // Débito em Despesa com Depreciação
        const deb = new Record(lancamentosCol)
        deb.set('tenant_id', primaryTenant.id)
        deb.set('empresa', empInovatech.id)
        deb.set('data', '2026-08-31 23:59:59.000Z')
        deb.set('tipo', 'debito')
        deb.set('conta_contabil', mapContas['4.2.4'])
        deb.set('contrapartida', mapContas['1.2.1.09'])
        deb.set('valor', 2115.0)
        deb.set(
          'historico',
          'Depreciação mensal do ativo imobilizado linear ref. competência 08/2026',
        )
        deb.set('competencia', '08/2026')
        deb.set('status', 'confirmado')
        deb.set('lote_id', loteDeprec08)
        if (staffUser) deb.set('criado_por', staffUser.id)
        app.save(deb)

        // Crédito em Depreciação Acumulada
        const cred = new Record(lancamentosCol)
        cred.set('tenant_id', primaryTenant.id)
        cred.set('empresa', empInovatech.id)
        cred.set('data', '2026-08-31 23:59:59.000Z')
        cred.set('tipo', 'credito')
        cred.set('conta_contabil', mapContas['1.2.1.09'])
        cred.set('contrapartida', mapContas['4.2.4'])
        cred.set('valor', 2115.0)
        cred.set(
          'historico',
          'Depreciação mensal do ativo imobilizado linear ref. competência 08/2026',
        )
        cred.set('competencia', '08/2026')
        cred.set('status', 'confirmado')
        cred.set('lote_id', loteDeprec08)
        if (staffUser) cred.set('criado_por', staffUser.id)
        app.save(cred)
      }
    } catch (_) {}

    // 5. Seed Fecho Mensal e Checklist
    // Competência 08/2026 Fechada para Inovatech
    // Competência 09/2026 Aberta / Em Andamento para Inovatech e Grãos do Sul
    const seedChecklistPadrao = [
      {
        codigo_item: 'conciliacao_bancaria',
        titulo: 'Conciliação Bancária Concluída',
        descricao: 'Conferir extratos OFX de todas as contas correntes com lançamentos bancários',
        ordem: 1,
        obrigatorio: true,
      },
      {
        codigo_item: 'folha_paga',
        titulo: 'Folha de Pagamento Calculada e Paga',
        descricao: 'Verificar holerites, pró-labore, GPS/INSS e FGTS processados do mês',
        ordem: 2,
        obrigatorio: true,
      },
      {
        codigo_item: 'obrigacoes_entregues',
        titulo: 'Obrigações Fiscais e Acessórias Entregues',
        descricao: 'Confirmar entrega de DAS, SPED, DCTF e demais guias com recibos arquivados',
        ordem: 3,
        obrigatorio: true,
      },
      {
        codigo_item: 'lancamentos_confirmados',
        titulo: 'Lançamentos Contábeis Confirmados',
        descricao: 'Garantir que nenhum lançamento do mês esteja em status de rascunho',
        ordem: 4,
        obrigatorio: true,
      },
      {
        codigo_item: 'depreciacao_processada',
        titulo: 'Depreciação do Imobilizado Processada',
        descricao:
          'Calcular e contabilizar as quotas de depreciação linear de todos os ativos da empresa',
        ordem: 5,
        obrigatorio: true,
      },
      {
        codigo_item: 'balancete_conferido',
        titulo: 'Balancete de Verificação Conferido',
        descricao: 'Assegurar que Total Débitos = Total Créditos sem diferença de partida dobrada',
        ordem: 6,
        obrigatorio: true,
      },
      {
        codigo_item: 'documentos_arquivados',
        titulo: 'Documentos do Mês Arquivados no GED',
        descricao: 'Notas fiscais de entrada/saída, faturas e comprovantes devidamente organizados',
        ordem: 7,
        obrigatorio: false,
      },
    ]

    // A) Fechamento Inovatech 08/2026 (FECHADO)
    try {
      let f8
      const existF8 = app.findRecordsByFilter(
        'fechamento_competencia',
        `tenant_id = '${primaryTenant.id}' && empresa = '${empInovatech.id}' && competencia = '08/2026'`,
        '',
        1,
        0,
      )
      if (existF8.length > 0) {
        f8 = existF8[0]
      } else {
        f8 = new Record(fechamentoCol)
        f8.set('tenant_id', primaryTenant.id)
        f8.set('empresa', empInovatech.id)
        f8.set('competencia', '08/2026')
        f8.set('status', 'fechado')
        f8.set('data_fechamento', '2026-09-02 18:00:00.000Z')
        if (staffUser) f8.set('fechado_por', staffUser.id)
        f8.set(
          'observacoes',
          'Competência 08/2026 fechada e auditada com êxito pela controladoria.',
        )
        app.save(f8)

        // Itens todos concluídos
        seedChecklistPadrao.forEach((item) => {
          const ci = new Record(checklistCol)
          ci.set('tenant_id', primaryTenant.id)
          ci.set('fechamento', f8.id)
          ci.set('empresa', empInovatech.id)
          ci.set('competencia', '08/2026')
          ci.set('codigo_item', item.codigo_item)
          ci.set('titulo', item.titulo)
          ci.set('descricao', item.descricao)
          ci.set('ordem', item.ordem)
          ci.set('obrigatorio', item.obrigatorio)
          ci.set('concluido', true)
          ci.set('concluido_em', '2026-09-02 17:30:00.000Z')
          if (staffUser) ci.set('responsavel', staffUser.id)
          ci.set('status_automatico', 'ok')
          ci.set('detalhe_automatico', 'Verificado e validado automaticamente')
          app.save(ci)
        })
      }
    } catch (_) {}

    // B) Fechamento Inovatech 09/2026 (EM ANDAMENTO - 4/7 concluídos)
    try {
      const existF9 = app.findRecordsByFilter(
        'fechamento_competencia',
        `tenant_id = '${primaryTenant.id}' && empresa = '${empInovatech.id}' && competencia = '09/2026'`,
        '',
        1,
        0,
      )
      if (existF9.length === 0) {
        const f9 = new Record(fechamentoCol)
        f9.set('tenant_id', primaryTenant.id)
        f9.set('empresa', empInovatech.id)
        f9.set('competencia', '09/2026')
        f9.set('status', 'em_andamento')
        f9.set(
          'observacoes',
          'Encerramento em execução. Pendente processar depreciação e confirmação final.',
        )
        app.save(f9)

        seedChecklistPadrao.forEach((item, idx) => {
          const ci = new Record(checklistCol)
          ci.set('tenant_id', primaryTenant.id)
          ci.set('fechamento', f9.id)
          ci.set('empresa', empInovatech.id)
          ci.set('competencia', '09/2026')
          ci.set('codigo_item', item.codigo_item)
          ci.set('titulo', item.titulo)
          ci.set('descricao', item.descricao)
          ci.set('ordem', item.ordem)
          ci.set('obrigatorio', item.obrigatorio)

          // 3 primeiros concluídos, outros pendentes
          const isDone = idx < 3
          ci.set('concluido', isDone)
          if (isDone) {
            ci.set('concluido_em', '2026-09-10 14:00:00.000Z')
            if (staffUser) ci.set('responsavel', staffUser.id)
            ci.set('status_automatico', 'ok')
            ci.set('detalhe_automatico', 'Atividade concluída com sucesso')
          } else {
            ci.set(
              'status_automatico',
              item.codigo_item === 'lancamentos_confirmados' ? 'alerta' : 'pendente',
            )
            ci.set(
              'detalhe_automatico',
              item.codigo_item === 'lancamentos_confirmados'
                ? 'Há 1 lançamento em rascunho'
                : 'Aguardando ação',
            )
          }
          app.save(ci)
        })
      }
    } catch (_) {}

    // C) Fechamento Grãos do Sul 09/2026 (ABERTO - 2/7 concluídos)
    try {
      const existFG9 = app.findRecordsByFilter(
        'fechamento_competencia',
        `tenant_id = '${primaryTenant.id}' && empresa = '${empGraos.id}' && competencia = '09/2026'`,
        '',
        1,
        0,
      )
      if (existFG9.length === 0) {
        const fg9 = new Record(fechamentoCol)
        fg9.set('tenant_id', primaryTenant.id)
        fg9.set('empresa', empGraos.id)
        fg9.set('competencia', '09/2026')
        fg9.set('status', 'aberto')
        fg9.set('observacoes', 'Aguardando fechamento da primeira quinzena.')
        app.save(fg9)

        seedChecklistPadrao.forEach((item, idx) => {
          const ci = new Record(checklistCol)
          ci.set('tenant_id', primaryTenant.id)
          ci.set('fechamento', fg9.id)
          ci.set('empresa', empGraos.id)
          ci.set('competencia', '09/2026')
          ci.set('codigo_item', item.codigo_item)
          ci.set('titulo', item.titulo)
          ci.set('descricao', item.descricao)
          ci.set('ordem', item.ordem)
          ci.set('obrigatorio', item.obrigatorio)

          const isDone = idx === 0
          ci.set('concluido', isDone)
          if (isDone) {
            ci.set('concluido_em', '2026-09-08 10:00:00.000Z')
            if (staffUser) ci.set('responsavel', staffUser.id)
            ci.set('status_automatico', 'ok')
            ci.set('detalhe_automatico', 'Extrato conciliado')
          } else {
            ci.set('status_automatico', 'pendente')
            ci.set('detalhe_automatico', 'Pendente')
          }
          app.save(ci)
        })
      }
    } catch (_) {}
  },
  (app) => {
    // down rollback
  },
)

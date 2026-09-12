/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const empresas = app.findCollectionByNameOrId('empresas')
    const guiasCol = app.findCollectionByNameOrId('guias_pagamentos')
    const parcCol = app.findCollectionByNameOrId('parcelamentos_federais')
    const contasFinCol = app.findCollectionByNameOrId('contas_financeiras')

    // Localizar Inovatech e Grãos do Sul
    let inova = null
    let graos = null
    try {
      inova = app.findFirstRecordByData('empresas', 'nome_fantasia', 'Inovatech Software')
    } catch (_) {
      try {
        inova = app.findFirstRecordByData('empresas', 'cnpj', '33.456.789/0001-12')
      } catch (_) {}
    }

    try {
      graos = app.findFirstRecordByData('empresas', 'nome_fantasia', 'Grãos do Sul Cafeteria')
    } catch (_) {
      try {
        graos = app.findFirstRecordByData('empresas', 'cnpj', '18.902.345/0001-88')
      } catch (_) {}
    }

    if (!inova || !graos) {
      console.log('[SEED-0061] Empresas não encontradas, pulando seed.')
      return
    }

    const tenantId = inova.getString('tenant_id')

    // 1. SEED INOVATECH SOFTWARE
    // 1.1 Guia DARF Previdenciário gerado da DCTFWeb (refletido)
    try {
      app.findFirstRecordByData('guias_pagamentos', 'numero_referencia', 'DCTFWEB-INOVA-202608-01')
    } catch (_) {
      const gInova = new Record(guiasCol)
      gInova.set('tenant_id', tenantId)
      gInova.set('empresa', inova.id)
      gInova.set('tipo_guia', 'darf_previdenciario')
      gInova.set('codigo_receita', '111-0')
      gInova.set('periodo_apuracao', '08/2026')
      gInova.set('numero_referencia', 'DCTFWEB-INOVA-202608-01')
      gInova.set('descricao', 'DARF Previdenciário Consolidado DCTFWeb Comp. 08/2026')
      gInova.set('valor_original', 5170.5)
      gInova.set('acrescimos', 0)
      gInova.set('valor_total', 5170.5)
      gInova.set('data_vencimento', '2026-09-25 23:59:59.000Z')
      gInova.set('data_pagamento', '2026-09-20 14:30:00.000Z')
      gInova.set('situacao', 'paga')
      gInova.set('origem', 'dctfweb')
      gInova.set('autenticacao_bancaria', 'BCO-BRASIL-AUT-99281204-OK')
      gInova.set(
        'observacoes',
        'Guia recolhida e quitada no prazo legal. Conciliada automaticamente via extrato bancário.',
      )
      app.save(gInova)
    }

    // 1.2 Guia DARF IRPJ da Inovatech regular/paga
    try {
      app.findFirstRecordByData('guias_pagamentos', 'numero_referencia', 'DARF-INOVA-202607-IRPJ')
    } catch (_) {
      const gDarf = new Record(guiasCol)
      gDarf.set('tenant_id', tenantId)
      gDarf.set('empresa', inova.id)
      gDarf.set('tipo_guia', 'darf')
      gDarf.set('codigo_receita', '2089')
      gDarf.set('periodo_apuracao', '07/2026')
      gDarf.set('numero_referencia', 'DARF-INOVA-202607-IRPJ')
      gDarf.set('descricao', 'DARF IRPJ - Lucro Presumido Apuração 2º Trimestre')
      gDarf.set('valor_original', 2850.0)
      gDarf.set('acrescimos', 0)
      gDarf.set('valor_total', 2850.0)
      gDarf.set('data_vencimento', '2026-07-31 23:59:59.000Z')
      gDarf.set('data_pagamento', '2026-07-28 10:15:00.000Z')
      gDarf.set('situacao', 'paga')
      gDarf.set('origem', 'fiscal')
      gDarf.set('autenticacao_bancaria', 'BCO-ITAU-AUT-33491204')
      gDarf.set('observacoes', 'Guia recolhida no vencimento.')
      app.save(gDarf)
    }

    // 1.3 Parcelamento Federal Adimplente da Inovatech (PAR Simples Nacional - Faltando 3 parcelas de 12)
    try {
      app.findFirstRecordByData(
        'parcelamentos_federais',
        'numero_parcelamento',
        'PAR-RFB-2025-009182',
      )
    } catch (_) {
      const pInova = new Record(parcCol)
      pInova.set('tenant_id', tenantId)
      pInova.set('empresa', inova.id)
      pInova.set('numero_parcelamento', 'PAR-RFB-2025-009182')
      pInova.set('modalidade', 'pert_sn')
      pInova.set(
        'descricao_modalidade',
        'Parcelamento Ordinário Simples Nacional (Art. 9º Res. CGSN 140/2018)',
      )
      pInova.set('data_adesao', '2025-10-15 00:00:00.000Z')
      pInova.set('total_parcelas', 12)
      pInova.set('parcelas_quitadas', 9) // Faltam 3 parcelas
      pInova.set('valor_total_consolidado', 18450.0)
      pInova.set('saldo_devedor', 4612.5) // 3 * 1537.50
      pInova.set('situacao_rfb', 'em_dia')
      pInova.set('proxima_parcela_numero', 10)
      pInova.set('proxima_parcela_vencimento', '2026-10-31 23:59:59.000Z')
      pInova.set('proxima_parcela_valor', 1537.5)
      pInova.set('origem_captura', 'conector_rfb_dte')
      pInova.set(
        'observacoes',
        'Contribuinte com pagamentos regulares rigorosamente em dia. Faltam 3 parcelas para quitação total.',
      )

      // Quadro detalhado com 12 parcelas
      const parcelas = []
      for (let i = 1; i <= 12; i++) {
        const isQuitada = i <= 9
        const isProxima = i === 10
        let mes = 10 + i - 1
        let ano = 2025
        if (mes > 12) {
          mes = mes - 12
          ano = 2026
        }
        const mesStr = String(mes).padStart(2, '0')
        const dataVenc = `${ano}-${mesStr}-28T23:59:59.000Z`

        parcelas.push({
          numero: i,
          vencimento: dataVenc,
          valor_principal: 1500.0,
          juros_selic: 37.5,
          valor_total: 1537.5,
          status: isQuitada ? 'paga' : isProxima ? 'aberta' : 'aberta',
          data_pagamento: isQuitada ? `${ano}-${mesStr}-25T14:00:00.000Z` : null,
          codigo_barras: '8583000000153750038202609009182000001' + i,
        })
      }
      pInova.set('quadro_parcelas_json', parcelas)
      app.save(pInova)
    }

    // 2. SEED GRÃOS DO SUL CAFETERIA
    // 2.1 Guia Vencida (DARF Previdenciário ou DAS do Simples)
    try {
      app.findFirstRecordByData('guias_pagamentos', 'numero_referencia', 'DAS-GRAOS-202608-01')
    } catch (_) {
      const gGraos = new Record(guiasCol)
      gGraos.set('tenant_id', tenantId)
      gGraos.set('empresa', graos.id)
      gGraos.set('tipo_guia', 'das')
      gGraos.set('codigo_receita', 'PGDAS-D')
      gGraos.set('periodo_apuracao', '08/2026')
      gGraos.set('numero_referencia', 'DAS-GRAOS-202608-01')
      gGraos.set(
        'descricao',
        'Documento de Arrecadação do Simples Nacional (DAS) - Competência 08/2026',
      )
      gGraos.set('valor_original', 3120.8)
      gGraos.set('acrescimos', 156.04) // Multa/juros moratórios
      gGraos.set('valor_total', 3276.84)
      gGraos.set('data_vencimento', '2026-09-17 23:59:59.000Z') // Vencida
      gGraos.set('data_pagamento', null)
      gGraos.set('situacao', 'vencida')
      gGraos.set('origem', 'fiscal')
      gGraos.set(
        'observacoes',
        'Guia do Simples Nacional não quitada até a data limite. Sujeita a inclusão em dívida ativa e perda de benefícios se não regularizada.',
      )
      app.save(gGraos)
    }

    // 2.2 Outra guia da Grãos do Sul em aberto (DCTFWeb pendente)
    try {
      app.findFirstRecordByData('guias_pagamentos', 'numero_referencia', 'DARF-GRAOS-DCTF-202609')
    } catch (_) {
      const gDctf = new Record(guiasCol)
      gDctf.set('tenant_id', tenantId)
      gDctf.set('empresa', graos.id)
      gDctf.set('tipo_guia', 'darf_previdenciario')
      gDctf.set('codigo_receita', '111-0')
      gDctf.set('periodo_apuracao', '09/2026')
      gDctf.set('numero_referencia', 'DARF-GRAOS-DCTF-202609')
      gDctf.set('descricao', 'DARF Previdenciário DCTFWeb Comp. 09/2026')
      gDctf.set('valor_original', 159.5)
      gDctf.set('acrescimos', 0)
      gDctf.set('valor_total', 159.5)
      gDctf.set('data_vencimento', '2026-10-25 23:59:59.000Z')
      gDctf.set('data_pagamento', null)
      gDctf.set('situacao', 'pendente')
      gDctf.set('origem', 'dctfweb')
      gDctf.set('observacoes', 'Aguardando validação dos eventos de fechamento.')
      app.save(gDctf)
    }

    // 2.3 Parcelamento da Grãos do Sul com Parcela em Atraso (Inadimplente 🔴)
    try {
      app.findFirstRecordByData(
        'parcelamentos_federais',
        'numero_parcelamento',
        'PAR-PGFN-2024-884210',
      )
    } catch (_) {
      const pGraos = new Record(parcCol)
      pGraos.set('tenant_id', tenantId)
      pGraos.set('empresa', graos.id)
      pGraos.set('numero_parcelamento', 'PAR-PGFN-2024-884210')
      pGraos.set('modalidade', 'transacao_tributaria_pgfn')
      pGraos.set(
        'descricao_modalidade',
        'Transação Tributária por Adesão - PGFN Dívida Ativa da União',
      )
      pGraos.set('data_adesao', '2024-11-20 00:00:00.000Z')
      pGraos.set('total_parcelas', 36)
      pGraos.set('parcelas_quitadas', 21)
      pGraos.set('valor_total_consolidado', 43200.0)
      pGraos.set('saldo_devedor', 18000.0)
      pGraos.set('situacao_rfb', 'em_atraso') // 🔴 Inadimplente / Parcela atrasada
      pGraos.set('proxima_parcela_numero', 22)
      pGraos.set('proxima_parcela_vencimento', '2026-09-10 23:59:59.000Z') // Atrasada!
      pGraos.set('proxima_parcela_valor', 1248.5)
      pGraos.set('origem_captura', 'manual_contador')
      pGraos.set(
        'observacoes',
        'ATENÇÃO: Parcela 22/36 com vencimento em 10/09/2026 não identificada como paga. Risco de rescisão do acordo da Transação Tributária PGFN após 3 parcelas não pagas ou 90 dias.',
      )

      // Quadro detalhado de parcelas
      const parcelasGraos = []
      for (let j = 1; j <= 36; j++) {
        const isQuitada = j <= 21
        const isAtrasada = j === 22
        let anoP = 2024 + Math.floor((10 + j) / 12)
        let mesP = ((10 + j) % 12) + 1
        const mesStr = String(mesP).padStart(2, '0')
        const dataVenc =
          j === 22 ? '2026-09-10T23:59:59.000Z' : `${anoP}-${mesStr}-10T23:59:59.000Z`

        parcelasGraos.push({
          numero: j,
          vencimento: dataVenc,
          valor_principal: 1200.0,
          juros_selic: isAtrasada ? 48.5 : 35.0,
          valor_total: isAtrasada ? 1248.5 : 1235.0,
          status: isQuitada ? 'paga' : isAtrasada ? 'atrasada' : 'aberta',
          data_pagamento: isQuitada ? `${anoP}-${mesStr}-08T11:00:00.000Z` : null,
          codigo_barras: '8587000000124850028202609088421000001' + j,
        })
      }
      pGraos.set('quadro_parcelas_json', parcelasGraos)
      app.save(pGraos)
    }

    console.log('[SEED-0061] Seeds de guias e parcelamentos federais aplicados com sucesso!')
  },
  (app) => {
    // Reverter seeds inseridos
    try {
      const guias = app.findRecordsByFilter(
        'guias_pagamentos',
        "numero_referencia = 'DCTFWEB-INOVA-202608-01' || numero_referencia = 'DARF-INOVA-202607-IRPJ' || numero_referencia = 'DAS-GRAOS-202608-01' || numero_referencia = 'DARF-GRAOS-DCTF-202609'",
        '',
        10,
        0,
      )
      for (let i = 0; i < guias.length; i++) {
        app.delete(guias[i])
      }
    } catch (_) {}

    try {
      const parcs = app.findRecordsByFilter(
        'parcelamentos_federais',
        "numero_parcelamento = 'PAR-RFB-2025-009182' || numero_parcelamento = 'PAR-PGFN-2024-884210'",
        '',
        10,
        0,
      )
      for (let j = 0; j < parcs.length; j++) {
        app.delete(parcs[j])
      }
    } catch (_) {}
  },
)

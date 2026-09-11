/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findRecordsByFilter('tenants', 'ativo = true', '-created', 1, 0)
    if (!tenants || tenants.length === 0) return
    const primaryTenant = tenants[0]

    const users = app.findRecordsByFilter('_pb_users_auth_', '', '-created', 1, 0)
    const adminUser = users.length > 0 ? users[0] : null

    // Buscar contratos com empresa vinculada
    const contratos = app.findRecordsByFilter(
      'contratos_honorarios',
      `tenant_id = '${primaryTenant.id}' && empresa != ''`,
      '-created',
      10,
      0,
    )

    if (contratos.length === 0) return

    const faturamentosCol = app.findCollectionByNameOrId('faturamentos_recorrentes')
    const contasFinCol = app.findCollectionByNameOrId('contas_financeiras')

    // Competências de exemplo: 2026-08, 2026-09, 2026-10
    const seeds = [
      {
        contratoIdx: 0,
        competencia: '2026-08',
        diaVenc: 10,
        status: 'pago',
        pagoOffsetDias: 2,
        notas: 'Honorários de Agosto/2026 liquidados via transferência bancária.',
      },
      {
        contratoIdx: 0,
        competencia: '2026-09',
        diaVenc: 10,
        status: 'faturado',
        notas: 'Cobrança emitida e enviada ao cliente com boleto bancário.',
      },
      {
        contratoIdx: 0,
        competencia: '2026-10',
        diaVenc: 10,
        status: 'previsto',
        notas: 'Competência corrente prevista conforme contrato ativo.',
      },
    ]

    // Se houver mais de um contrato, adicionar para o segundo também
    if (contratos.length > 1) {
      seeds.push(
        {
          contratoIdx: 1,
          competencia: '2026-08',
          diaVenc: 15,
          status: 'pago',
          pagoOffsetDias: 1,
          notas: 'Honorários de Agosto/2026 quitados.',
        },
        {
          contratoIdx: 1,
          competencia: '2026-09',
          diaVenc: 15,
          status: 'faturado',
          notas: 'Faturado com título em aberto aguardando liquidação.',
        },
      )
    }

    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i]
      const contrato = contratos[s.contratoIdx % contratos.length]
      const empresaId = contrato.getString('empresa')
      const valor = contrato.getFloat('valor_mensal') || 2500

      // Anti-duplicidade
      const exists = app.findRecordsByFilter(
        'faturamentos_recorrentes',
        `contrato = '${contrato.id}' && competencia = '${s.competencia}'`,
        '',
        1,
        0,
      )
      if (exists.length > 0) continue

      let tituloFinanceiroId = null

      // Se for faturado ou pago, criar também o título a receber no Financeiro
      if (s.status === 'faturado' || s.status === 'pago') {
        try {
          const compParts = s.competencia.split('-')
          const ano = compParts[0]
          const mes = compParts[1]
          const dia = String(contrato.getInt('dia_vencimento') || s.diaVenc).padStart(2, '0')
          const dataVenc = `${ano}-${mes}-${dia} 12:00:00.000Z`
          const dataEmissao = `${ano}-${mes}-01 12:00:00.000Z`

          let empNome = 'Cliente'
          try {
            const empRec = app.findRecordById('empresas', empresaId)
            empNome = empRec.getString('nome_fantasia') || empRec.getString('razao_social')
          } catch (_) {}

          const recTitulo = new Record(contasFinCol)
          recTitulo.set('tenant_id', primaryTenant.id)
          recTitulo.set('empresa', empresaId)
          recTitulo.set('tipo', 'receber')
          recTitulo.set('pessoa', empNome)
          recTitulo.set('descricao', `Honorários Contábeis Recorrentes - Comp. ${mes}/${ano}`)
          recTitulo.set('documento_ref', `FAT-${ano}${mes}-${contrato.id.slice(0, 6)}`)
          recTitulo.set('valor', valor)
          recTitulo.set('data_emissao', dataEmissao)
          recTitulo.set('data_vencimento', dataVenc)

          if (s.status === 'pago') {
            const dataPag = `${ano}-${mes}-${String(Number(dia) + (s.pagoOffsetDias || 0)).padStart(2, '0')} 15:00:00.000Z`
            recTitulo.set('status', 'pago')
            recTitulo.set('data_pagamento', dataPag)
          } else {
            recTitulo.set('status', 'pendente')
          }

          recTitulo.set(
            'observacoes',
            `Gerado automaticamente pelo módulo de Faturamento Recorrente (Contrato: ${contrato.getString('titulo')})`,
          )
          app.save(recTitulo)
          tituloFinanceiroId = recTitulo.id
        } catch (errTit) {
          console.log('Erro ao criar titulo financeiro para seed de faturamento:', errTit)
        }
      }

      try {
        const compParts = s.competencia.split('-')
        const ano = compParts[0]
        const mes = compParts[1]
        const dia = String(contrato.getInt('dia_vencimento') || s.diaVenc).padStart(2, '0')
        const dataVenc = `${ano}-${mes}-${dia} 12:00:00.000Z`

        const fatRec = new Record(faturamentosCol)
        fatRec.set('tenant_id', primaryTenant.id)
        fatRec.set('contrato', contrato.id)
        fatRec.set('empresa', empresaId)
        fatRec.set('competencia', s.competencia)
        fatRec.set('valor', valor)
        fatRec.set('data_vencimento', dataVenc)
        fatRec.set('status', s.status)
        if (tituloFinanceiroId) fatRec.set('titulo_financeiro', tituloFinanceiroId)
        fatRec.set('notas', s.notas)
        if (adminUser) fatRec.set('criado_por', adminUser.id)
        app.save(fatRec)
      } catch (errFat) {
        console.log('Erro ao salvar faturamento recorrente seed:', errFat)
      }
    }
  },
  (app) => {
    try {
      app
        .db()
        .newQuery(
          "DELETE FROM faturamentos_recorrentes WHERE competencia IN ('2026-08', '2026-09', '2026-10')",
        )
        .execute()
    } catch (_) {}
  },
)

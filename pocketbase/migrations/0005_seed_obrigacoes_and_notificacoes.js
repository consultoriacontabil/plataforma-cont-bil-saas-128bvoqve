/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenant = app.findFirstRecordByData('tenants', 'nome', 'Rumo Consultoria Contábil')
    const adminUser = app.findAuthRecordByEmail(
      '_pb_users_auth_',
      'rumo@rumoconsultoriacontabil.com.br',
    )
    const contadorUser = app.findAuthRecordByEmail(
      '_pb_users_auth_',
      'carlos.silva@rumoconsultoria.com.br',
    )

    // Enable email_notificacoes_prazo by default for existing users
    try {
      adminUser.set('email_notificacoes_prazo', true)
      app.save(adminUser)
    } catch (_) {}
    try {
      contadorUser.set('email_notificacoes_prazo', true)
      app.save(contadorUser)
    } catch (_) {}

    const empInovatech = app.findFirstRecordByData('empresas', 'cnpj', '33.456.789/0001-12')
    const empGraos = app.findFirstRecordByData('empresas', 'cnpj', '18.902.345/0001-88')
    const empLogPrime = app.findFirstRecordByData('empresas', 'cnpj', '07.654.321/0001-44')
    const empClinica = app.findFirstRecordByData('empresas', 'cnpj', '45.123.987/0001-33')

    const obrigacoesCol = app.findCollectionByNameOrId('obrigacoes')
    const notificacoesCol = app.findCollectionByNameOrId('notificacoes')

    // Today relative helper
    const now = new Date()
    const y = now.getUTCFullYear()
    const m = String(now.getUTCMonth() + 1).padStart(2, '0')
    const compAtual = `${m}/${y}`
    const compAnterior = `${String(now.getUTCMonth() === 0 ? 12 : now.getUTCMonth()).padStart(2, '0')}/${now.getUTCMonth() === 0 ? y - 1 : y}`

    const formatDateStr = (d) => {
      const year = d.getUTCFullYear()
      const month = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      return `${year}-${month}-${day} 12:00:00.000Z`
    }

    const dPast5 = new Date(Date.now() - 5 * 86400000)
    const dPast2 = new Date(Date.now() - 2 * 86400000)
    const dFuture3 = new Date(Date.now() + 3 * 86400000)
    const dFuture6 = new Date(Date.now() + 6 * 86400000)
    const dFuture12 = new Date(Date.now() + 12 * 86400000)
    const dFuture20 = new Date(Date.now() + 20 * 86400000)

    const seedObrigacoes = [
      {
        empresa_id: empInovatech.id,
        tipo: 'DAS',
        competencia: compAnterior,
        vencimento: formatDateStr(dFuture3),
        status: 'pendente',
        responsavel_id: contadorUser.id,
        valor: 4320.5,
        observacoes: 'Guia do Simples Nacional gerada no PGDAS-D. Próximo do vencimento.',
      },
      {
        empresa_id: empInovatech.id,
        tipo: 'EFD',
        competencia: compAnterior,
        vencimento: formatDateStr(dPast2),
        status: 'atrasada',
        responsavel_id: contadorUser.id,
        valor: 0,
        observacoes: 'EFD-Reinf pendente de validação dos eventos R-4020.',
      },
      {
        empresa_id: empInovatech.id,
        tipo: 'FGTS',
        competencia: compAnterior,
        vencimento: formatDateStr(dPast5),
        status: 'entregue',
        responsavel_id: adminUser.id,
        valor: 1850.0,
        observacoes: 'FGTS Digital transmitido com guia recolhida via Pix.',
        data_entrega: formatDateStr(dPast5),
      },
      {
        empresa_id: empGraos.id,
        tipo: 'DAS',
        competencia: compAnterior,
        vencimento: formatDateStr(dFuture6),
        status: 'em_andamento',
        responsavel_id: contadorUser.id,
        valor: 3120.8,
        observacoes: 'Apuração das receitas das 3 lojas e cafeteria.',
      },
      {
        empresa_id: empGraos.id,
        tipo: 'INSS',
        competencia: compAtual,
        vencimento: formatDateStr(dFuture20),
        status: 'pendente',
        responsavel_id: contadorUser.id,
        valor: 1450.0,
        observacoes: 'DCTFWeb da folha de pagamento quinzenal.',
      },
      {
        empresa_id: empLogPrime.id,
        tipo: 'SPED',
        competencia: compAnterior,
        vencimento: formatDateStr(dFuture12),
        status: 'pendente',
        responsavel_id: contadorUser.id,
        valor: 0,
        observacoes: 'SPED Fiscal ICMS/IPI filial Campinas e matriz.',
      },
      {
        empresa_id: empLogPrime.id,
        tipo: 'DARF',
        competencia: compAnterior,
        vencimento: formatDateStr(dPast5),
        status: 'atrasada',
        responsavel_id: adminUser.id,
        valor: 12450.0,
        observacoes: 'DARF IRPJ/CSLL trimestral pendente de conciliação bancária.',
      },
      {
        empresa_id: empLogPrime.id,
        tipo: 'DCTF',
        competencia: compAnterior,
        vencimento: formatDateStr(dPast2),
        status: 'entregue',
        responsavel_id: contadorUser.id,
        valor: 0,
        observacoes: 'Declaração transmitida via Receitanet.',
        data_entrega: formatDateStr(dPast2),
      },
      {
        empresa_id: empClinica.id,
        tipo: 'DMED',
        competencia: `${y - 1}`,
        vencimento: formatDateStr(dFuture20),
        status: 'em_andamento',
        responsavel_id: contadorUser.id,
        valor: 0,
        observacoes: 'Declaração de Serviços Médicos e de Saúde - conferência de recibos.',
      },
      {
        empresa_id: empClinica.id,
        tipo: 'DARF',
        competencia: compAtual,
        vencimento: formatDateStr(dFuture3),
        status: 'pendente',
        responsavel_id: adminUser.id,
        valor: 2840.2,
        observacoes: 'PIS/COFINS retido na fonte por operadoras de plano de saúde.',
      },
    ]

    for (let i = 0; i < seedObrigacoes.length; i++) {
      const item = seedObrigacoes[i]
      try {
        const filter = `empresa_id = '${item.empresa_id}' && tipo = '${item.tipo}' && competencia = '${item.competencia}'`
        const existing = app.findRecordsByFilter('obrigacoes', filter, '', 1, 0)
        if (existing.length > 0) continue
      } catch (_) {}

      const rec = new Record(obrigacoesCol)
      rec.set('tenant_id', tenant.id)
      for (const k in item) {
        rec.set(k, item[k])
      }
      app.save(rec)
    }

    // Seed Notificações (in-app initial entries)
    const seedNotificacoes = [
      {
        tenant_id: tenant.id,
        usuario_destino_id: contadorUser.id,
        titulo: 'Obrigação DAS vence em 3 dias',
        mensagem:
          'A guia do DAS (competência ' +
          compAnterior +
          ') da Inovatech Soluções Digitais vence em 3 dias.',
        tipo: 'prazo_proximo',
        link: '/obrigacoes',
        lida: false,
      },
      {
        tenant_id: tenant.id,
        usuario_destino_id: contadorUser.id,
        titulo: 'Obrigação EFD Atrasada',
        mensagem: 'A entrega da EFD da Inovatech Soluções Digitais está com prazo vencido.',
        tipo: 'atrasada',
        link: '/obrigacoes',
        lida: false,
      },
      {
        tenant_id: tenant.id,
        usuario_destino_id: adminUser.id,
        titulo: 'DARF LogPrime Atrasada',
        mensagem:
          'O recolhimento do DARF IRPJ/CSLL de LogPrime Transportes está pendente e atrasado.',
        tipo: 'atrasada',
        link: '/obrigacoes',
        lida: false,
      },
      {
        tenant_id: tenant.id,
        usuario_destino_id: adminUser.id,
        titulo: 'Workflow em andamento',
        mensagem: 'Carlos Silva assumiu o workflow "Alteração do Contrato Social - Inovatech".',
        tipo: 'workflow_status',
        link: '/workflow',
        lida: true,
      },
    ]

    for (let i = 0; i < seedNotificacoes.length; i++) {
      const n = seedNotificacoes[i]
      try {
        const existing = app.findRecordsByFilter(
          'notificacoes',
          `tenant_id = '${n.tenant_id}' && titulo = '${n.titulo}'`,
          '',
          1,
          0,
        )
        if (existing.length > 0) continue
      } catch (_) {}

      const notifRec = new Record(notificacoesCol)
      for (const k in n) {
        notifRec.set(k, n[k])
      }
      app.save(notifRec)
    }
  },
  (app) => {
    // down rollback
  },
)

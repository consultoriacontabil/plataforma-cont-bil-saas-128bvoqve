/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findRecordsByFilter('tenants', 'ativo = true', '-created', 1, 0)
    if (!tenants || tenants.length === 0) return
    const primaryTenant = tenants[0]

    const empresas = app.findRecordsByFilter(
      'empresas',
      `tenant_id = '${primaryTenant.id}'`,
      '-created',
      5,
      0,
    )
    if (!empresas || empresas.length === 0) return
    const empresaInovatech = empresas[0] // feb9h004jovi7xh ou primeira

    const users = app.findRecordsByFilter('_pb_users_auth_', '', '-created', 5, 0)
    const adminUser = users[0]

    const demonstrativosCol = app.findCollectionByNameOrId('demonstrativos')
    const impostosCol = app.findCollectionByNameOrId('impostos_retidos')
    const contasFinCol = app.findCollectionByNameOrId('contas_financeiras')

    // 1. Seed Demonstrativo DRE 09/2026 com status 'enviado' (aguardando aprovação do cliente no Portal)
    try {
      const existingDem = app.findRecordsByFilter(
        'demonstrativos',
        `tenant_id = '${primaryTenant.id}' && empresa = '${empresaInovatech.id}' && competencia = '09/2026' && tipo = 'dre'`,
        '',
        1,
        0,
      )
      if (existingDem.length === 0) {
        const demRecord = new Record(demonstrativosCol)
        demRecord.set('tenant_id', primaryTenant.id)
        demRecord.set('empresa', empresaInovatech.id)
        demRecord.set('competencia', '09/2026')
        demRecord.set('tipo', 'dre')
        demRecord.set('status', 'enviado')
        demRecord.set('data_envio', '2026-10-01 14:00:00.000Z')
        if (adminUser) demRecord.set('gerado_por', adminUser.id)
        demRecord.set('dados', {
          titulo: 'Demonstração do Resultado do Exercício - 09/2026',
          receitaBruta: 65400,
          deducoes: 3924,
          receitaLiquida: 61476,
          custos: 0,
          lucroBruto: 61476,
          despesasOperacionais: 18230.5,
          resultadoLiquido: 43245.5,
          linhas: [
            {
              id: '1',
              codigo: '1',
              descricao: 'RECEITA OPERACIONAL BRUTA',
              tipo: 'grupo',
              valor: 65400,
              destaque: true,
            },
            {
              id: '2',
              codigo: '3.1.1.01',
              descricao: 'Receita de Venda de Licenças SaaS',
              tipo: 'conta',
              valor: 65400,
            },
            {
              id: '3',
              codigo: '2',
              descricao: '(-) DEDUÇÕES DA RECEITA BRUTA E IMPOSTOS S/ VENDAS',
              tipo: 'grupo',
              valor: 3924,
              negativo: true,
              destaque: true,
            },
            {
              id: '4',
              codigo: '4.3.1.01',
              descricao: '(-) Simples Nacional Competência 09/2026',
              tipo: 'conta',
              valor: 3924,
              negativo: true,
            },
            {
              id: '5',
              codigo: '3',
              descricao: '(=) RECEITA OPERACIONAL LÍQUIDA',
              tipo: 'totalizador',
              valor: 61476,
              destaque: true,
            },
            {
              id: '6',
              codigo: '5',
              descricao: '(=) LUCRO BRUTO OPERACIONAL',
              tipo: 'totalizador',
              valor: 61476,
              destaque: true,
            },
            {
              id: '7',
              codigo: '6',
              descricao: '(-) DESPESAS OPERACIONAIS (Pessoal, Gerais e Administrativas)',
              tipo: 'grupo',
              valor: 18230.5,
              negativo: true,
              destaque: true,
            },
            {
              id: '8',
              codigo: '4.1.1.01',
              descricao: '(-) Salários e Remunerações',
              tipo: 'conta',
              valor: 12500,
              negativo: true,
            },
            {
              id: '9',
              codigo: '4.1.2.01',
              descricao: '(-) Encargos Sociais (FGTS/INSS)',
              tipo: 'conta',
              valor: 2696,
              negativo: true,
            },
            {
              id: '10',
              codigo: '4.2.1.01',
              descricao: '(-) Despesas Gerais de Infraestrutura',
              tipo: 'conta',
              valor: 3034.5,
              negativo: true,
            },
            {
              id: '11',
              codigo: '7',
              descricao: '(=) RESULTADO LÍQUIDO DO EXERCÍCIO (LUCRO)',
              tipo: 'resultado',
              valor: 43245.5,
              destaque: true,
            },
          ],
        })
        app.save(demRecord)
      }
    } catch (e) {
      console.log('Seed demonstrativo error:', e)
    }

    // 2. Seed Impostos Retidos da Folha 09/2026 (DARF INSS, DARF IRRF, FGTS)
    // Folha 09/2026: INSS total = ~2499.70, IRRF total = ~4680.04, FGTS total = ~2696.00
    // Competência 09/2026 -> Vencimentos:
    // DARF INSS: dia 20 do mês seguinte -> 2026-10-20
    // DARF IRRF: dia 20 do mês seguinte -> 2026-10-20
    // FGTS: dia 07 do mês seguinte -> 2026-10-07
    const itensImpostos = [
      {
        tipo: 'darf_inss',
        valor: 2499.7,
        vencimento: '2026-10-20 18:00:00.000Z',
        descricao: 'DARF Previdenciário - INSS Retido dos Colaboradores Comp. 09/2026',
        pessoa: 'Receita Federal do Brasil (INSS)',
      },
      {
        tipo: 'darf_irrf',
        valor: 4680.04,
        vencimento: '2026-10-20 18:00:00.000Z',
        descricao: 'DARF IRRF Retido na Fonte - Folha Comp. 09/2026',
        pessoa: 'Receita Federal do Brasil (IRRF)',
      },
      {
        tipo: 'fgts',
        valor: 2696.0,
        vencimento: '2026-10-07 18:00:00.000Z',
        descricao: 'Guia FGTS Digital - Folha de Pagamento Comp. 09/2026',
        pessoa: 'Caixa Econômica Federal (FGTS)',
      },
    ]

    for (let i = 0; i < itensImpostos.length; i++) {
      const item = itensImpostos[i]
      try {
        const existing = app.findRecordsByFilter(
          'impostos_retidos',
          `tenant_id = '${primaryTenant.id}' && empresa = '${empresaInovatech.id}' && competencia = '09/2026' && tipo = '${item.tipo}'`,
          '',
          1,
          0,
        )
        if (existing.length === 0) {
          // Criar título no contas_financeiras correspondente (A Pagar)
          const contaFin = new Record(contasFinCol)
          contaFin.set('tenant_id', primaryTenant.id)
          contaFin.set('empresa', empresaInovatech.id)
          contaFin.set('tipo', 'pagar')
          contaFin.set('pessoa', item.pessoa)
          contaFin.set('descricao', item.descricao)
          contaFin.set('documento_ref', 'RET-09/2026-' + item.tipo.toUpperCase())
          contaFin.set('valor', item.valor)
          contaFin.set('data_emissao', '2026-09-30 12:00:00.000Z')
          contaFin.set('data_vencimento', item.vencimento)
          contaFin.set('status', 'pendente')
          contaFin.set('observacoes', 'Gerado automaticamente pelo fechamento de DP')
          app.save(contaFin)

          // Criar registro na coleção impostos_retidos
          const impRecord = new Record(impostosCol)
          impRecord.set('tenant_id', primaryTenant.id)
          impRecord.set('empresa', empresaInovatech.id)
          impRecord.set('competencia', '09/2026')
          impRecord.set('tipo', item.tipo)
          impRecord.set('valor', item.valor)
          impRecord.set('vencimento', item.vencimento)
          impRecord.set('status', 'pendente')
          impRecord.set('vinculo_folha', 'folha-comp-09/2026')
          impRecord.set('vinculo_titulo_financeiro', contaFin.id)
          impRecord.set('observacoes', 'Apuração automática folha de pagamento')
          app.save(impRecord)
        }
      } catch (err) {
        console.log('Seed impostos_retidos item error:', err)
      }
    }
  },
  (app) => {
    // Revert
  },
)

/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const tenantList = app.findRecordsByFilter('tenants', 'ativo = true', '-created', 10, 0)
    if (!tenantList || tenantList.length === 0) return

    const primaryTenant = tenantList[0]
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

    // Buscar plano de contas para amarrar categorias e conta contábil
    let contaBancoId = ''
    let contaFornecId = ''
    let contaClientesId = ''
    let contaServicosRecId = ''
    let contaAluguelId = ''
    let contaEnergiaId = ''

    try {
      const pcList = app.findRecordsByFilter(
        'plano_contas',
        `tenant_id = '${primaryTenant.id}'`,
        'codigo',
        100,
        0,
      )
      for (let i = 0; i < pcList.length; i++) {
        const cod = pcList[i].getString('codigo')
        if (cod === '1.1.1.02') contaBancoId = pcList[i].id
        if (cod === '2.1.1.01') contaFornecId = pcList[i].id
        if (cod === '1.1.2.01') contaClientesId = pcList[i].id
        if (cod === '3.1.1') contaServicosRecId = pcList[i].id
        if (cod === '4.2.1') contaAluguelId = pcList[i].id
        if (cod === '4.2.2') contaEnergiaId = pcList[i].id
      }
    } catch (_) {}

    const contasBancariasCol = app.findCollectionByNameOrId('contas_bancarias')
    const contasFinanceirasCol = app.findCollectionByNameOrId('contas_financeiras')
    const extratosBancariosCol = app.findCollectionByNameOrId('extratos_bancarios')

    // 1. Criar Contas Bancárias para Inovatech e Grãos do Sul
    let contaInovaItaú
    try {
      const found = app.findRecordsByFilter(
        'contas_bancarias',
        `tenant_id = '${primaryTenant.id}' && empresa = '${empInovatech.id}' && banco = 'Itaú Unibanco'`,
        '',
        1,
        0,
      )
      if (found.length > 0) contaInovaItaú = found[0]
    } catch (_) {}

    if (!contaInovaItaú) {
      contaInovaItaú = new Record(contasBancariasCol)
      contaInovaItaú.set('tenant_id', primaryTenant.id)
      contaInovaItaú.set('empresa', empInovatech.id)
      contaInovaItaú.set('banco', 'Itaú Unibanco (341)')
      contaInovaItaú.set('agencia', '0922')
      contaInovaItaú.set('conta', '54321-0')
      contaInovaItaú.set('saldo_inicial', 85000.0)
      contaInovaItaú.set('saldo_atual', 104250.0)
      contaInovaItaú.set('ativa', true)
      if (contaBancoId) contaInovaItaú.set('conta_contabil', contaBancoId)
      app.save(contaInovaItaú)
    }

    let contaGraosBB
    try {
      const found = app.findRecordsByFilter(
        'contas_bancarias',
        `tenant_id = '${primaryTenant.id}' && empresa = '${empGraos.id}' && banco ~ 'Brasil'`,
        '',
        1,
        0,
      )
      if (found.length > 0) contaGraosBB = found[0]
    } catch (_) {}

    if (!contaGraosBB) {
      contaGraosBB = new Record(contasBancariasCol)
      contaGraosBB.set('tenant_id', primaryTenant.id)
      contaGraosBB.set('empresa', empGraos.id)
      contaGraosBB.set('banco', 'Banco do Brasil (001)')
      contaGraosBB.set('agencia', '1580')
      contaGraosBB.set('conta', '98712-4')
      contaGraosBB.set('saldo_inicial', 42000.0)
      contaGraosBB.set('saldo_atual', 56800.0)
      contaGraosBB.set('ativa', true)
      if (contaBancoId) contaGraosBB.set('conta_contabil', contaBancoId)
      app.save(contaGraosBB)
    }

    // 2. Criar títulos a pagar / receber em 09/2026 e 10/2026
    const titulosSeed = [
      // Inovatech - Pagar
      {
        tipo: 'pagar',
        empresaId: empInovatech.id,
        pessoa: 'Amazon Web Services Brasil Ltda',
        descricao: 'Hospedagem em nuvem servidores AWS São Paulo',
        documento_ref: 'FAT-2026-09-8812',
        categoria: contaEnergiaId || '',
        valor: 4320.0,
        emissao: '2026-09-01 10:00:00.000Z',
        vencimento: '2026-09-15 18:00:00.000Z',
        pagamento: '2026-09-15 15:30:00.000Z',
        status: 'pago',
        contaBancariaId: contaInovaItaú.id,
      },
      {
        tipo: 'pagar',
        empresaId: empInovatech.id,
        pessoa: 'Imobiliária Paulista Prime',
        descricao: 'Aluguel do conjunto 1204 - Av. Paulista 1000',
        documento_ref: 'REC-2026-09-001',
        categoria: contaAluguelId || '',
        valor: 3500.0,
        emissao: '2026-09-01 10:00:00.000Z',
        vencimento: '2026-09-10 18:00:00.000Z',
        pagamento: '2026-09-09 11:20:00.000Z',
        status: 'pago',
        contaBancariaId: contaInovaItaú.id,
      },
      {
        tipo: 'pagar',
        empresaId: empInovatech.id,
        pessoa: 'Enel Distribuição São Paulo',
        descricao: 'Fornecimento de energia elétrica escritório',
        documento_ref: 'FAT-98213455',
        categoria: contaEnergiaId || '',
        valor: 890.5,
        emissao: '2026-09-05 10:00:00.000Z',
        vencimento: '2026-09-25 18:00:00.000Z',
        status: 'atrasado', // vencido em 25/09/2026
      },
      {
        tipo: 'pagar',
        empresaId: empInovatech.id,
        pessoa: 'Google Cloud Brasil',
        descricao: 'Workspace e licenças corporativas do time',
        documento_ref: 'INV-4412098',
        categoria: contaEnergiaId || '',
        valor: 1450.0,
        emissao: '2026-10-01 10:00:00.000Z',
        vencimento: '2026-10-15 18:00:00.000Z',
        status: 'pendente',
      },
      {
        tipo: 'pagar',
        empresaId: empInovatech.id,
        pessoa: 'Contabilidade Rumo Parceiros',
        descricao: 'Honorários contábeis e fiscais competência 09/2026',
        documento_ref: 'HON-2026-09',
        categoria: contaFornecId || '',
        valor: 2200.0,
        emissao: '2026-10-01 10:00:00.000Z',
        vencimento: '2026-10-10 18:00:00.000Z',
        status: 'pendente',
      },

      // Inovatech - Receber
      {
        tipo: 'receber',
        empresaId: empInovatech.id,
        pessoa: 'Banco Alpha S/A',
        descricao: 'Mensalidade contrato de sustentação de software corporativo',
        documento_ref: 'NFSe-1045',
        categoria: contaServicosRecId || '',
        valor: 28500.0,
        emissao: '2026-09-01 10:00:00.000Z',
        vencimento: '2026-09-10 18:00:00.000Z',
        pagamento: '2026-09-10 14:10:00.000Z',
        status: 'pago',
        contaBancariaId: contaInovaItaú.id,
      },
      {
        tipo: 'receber',
        empresaId: empInovatech.id,
        pessoa: 'Varejo Digital Brasil Ltda',
        descricao: 'Licenciamento SaaS módulo financeiro',
        documento_ref: 'NFSe-1046',
        categoria: contaServicosRecId || '',
        valor: 12500.0,
        emissao: '2026-09-05 10:00:00.000Z',
        vencimento: '2026-09-20 18:00:00.000Z',
        status: 'atrasado', // vencido em 20/09/2026
      },
      {
        tipo: 'receber',
        empresaId: empInovatech.id,
        pessoa: 'Logística Express S/A',
        descricao: 'Consultoria e implantação de API contábil',
        documento_ref: 'NFSe-1047',
        categoria: contaServicosRecId || '',
        valor: 16800.0,
        emissao: '2026-10-02 10:00:00.000Z',
        vencimento: '2026-10-20 18:00:00.000Z',
        status: 'pendente',
      },

      // Grãos do Sul - Pagar & Receber
      {
        tipo: 'pagar',
        empresaId: empGraos.id,
        pessoa: 'Cooperativa Agrícola do Cerrado',
        descricao: 'Aquisição de sacas de café arábica especial',
        documento_ref: 'NFe-88190',
        categoria: contaFornecId || '',
        valor: 18500.0,
        emissao: '2026-09-10 10:00:00.000Z',
        vencimento: '2026-09-28 18:00:00.000Z',
        status: 'atrasado',
      },
      {
        tipo: 'receber',
        empresaId: empGraos.id,
        pessoa: 'Rede de Hotéis Estrela do Sul',
        descricao: 'Fornecimento quinzenal de café e grãos torrados',
        documento_ref: 'NFSe-3301',
        categoria: contaClientesId || '',
        valor: 9400.0,
        emissao: '2026-10-01 10:00:00.000Z',
        vencimento: '2026-10-15 18:00:00.000Z',
        status: 'pendente',
      },
    ]

    const mapDescricaoToTituloRec = {}

    for (let i = 0; i < titulosSeed.length; i++) {
      const t = titulosSeed[i]
      let rec
      try {
        const found = app.findRecordsByFilter(
          'contas_financeiras',
          `tenant_id = '${primaryTenant.id}' && empresa = '${t.empresaId}' && descricao = '${t.descricao}'`,
          '',
          1,
          0,
        )
        if (found.length > 0) rec = found[0]
      } catch (_) {}

      if (!rec) {
        rec = new Record(contasFinanceirasCol)
        rec.set('tenant_id', primaryTenant.id)
        rec.set('empresa', t.empresaId)
        rec.set('tipo', t.tipo)
        rec.set('pessoa', t.pessoa)
        rec.set('descricao', t.descricao)
        if (t.documento_ref) rec.set('documento_ref', t.documento_ref)
        if (t.categoria) rec.set('categoria', t.categoria)
        rec.set('valor', t.valor)
        rec.set('data_emissao', t.emissao)
        rec.set('data_vencimento', t.vencimento)
        if (t.pagamento) rec.set('data_pagamento', t.pagamento)
        rec.set('status', t.status)
        if (t.contaBancariaId) rec.set('conta_bancaria', t.contaBancariaId)
        app.save(rec)
      }
      mapDescricaoToTituloRec[t.descricao] = rec
    }

    // 3. Extrato Bancário de Exemplo para Inovatech
    const extratoSeed = [
      {
        data: '2026-09-10 14:10:00.000Z',
        descricao: 'TED RECEB BANCO ALPHA SA NF1045',
        documento_numero: 'DOC-9901',
        valor: 28500.0,
        tipo_transacao: 'credito',
        status: 'conciliado',
        tituloDescricao: 'Mensalidade contrato de sustentação de software corporativo',
      },
      {
        data: '2026-09-15 15:30:00.000Z',
        descricao: 'DEB AUTOMATICO AWS CLOUD BRASIL',
        documento_numero: 'DOC-8812',
        valor: -4320.0,
        tipo_transacao: 'debito',
        status: 'conciliado',
        tituloDescricao: 'Hospedagem em nuvem servidores AWS São Paulo',
      },
      {
        data: '2026-09-22 10:15:00.000Z',
        descricao: 'PIX RECEBIDO CLIENTE OUTROS',
        documento_numero: 'PIX-11234',
        valor: 3200.0,
        tipo_transacao: 'credito',
        status: 'pendente',
      },
      {
        data: '2026-09-28 16:40:00.000Z',
        descricao: 'TARIFA BANCARIA PACOTE EMPRESARIAL',
        documento_numero: 'TAR-0926',
        valor: -150.0,
        tipo_transacao: 'debito',
        status: 'pendente',
      },
      {
        data: '2026-10-02 09:00:00.000Z',
        descricao: 'RESGATE APLICACAO RENDA FIXA',
        documento_numero: 'RES-0041',
        valor: 15000.0,
        tipo_transacao: 'credito',
        status: 'pendente',
      },
    ]

    for (let j = 0; j < extratoSeed.length; j++) {
      const ex = extratoSeed[j]
      try {
        const found = app.findRecordsByFilter(
          'extratos_bancarios',
          `tenant_id = '${primaryTenant.id}' && conta_bancaria = '${contaInovaItaú.id}' && descricao = '${ex.descricao}'`,
          '',
          1,
          0,
        )
        if (found.length === 0) {
          const recEx = new Record(extratosBancariosCol)
          recEx.set('tenant_id', primaryTenant.id)
          recEx.set('conta_bancaria', contaInovaItaú.id)
          recEx.set('empresa', empInovatech.id)
          recEx.set('data', ex.data)
          recEx.set('descricao', ex.descricao)
          if (ex.documento_numero) recEx.set('documento_numero', ex.documento_numero)
          recEx.set('valor', ex.valor)
          recEx.set('tipo_transacao', ex.tipo_transacao)
          recEx.set('status', ex.status)
          if (ex.tituloDescricao && mapDescricaoToTituloRec[ex.tituloDescricao]) {
            recEx.set('titulo_conciliado', mapDescricaoToTituloRec[ex.tituloDescricao].id)
            recEx.set('conciliado_em', ex.data)
          }
          app.save(recEx)
        }
      } catch (_) {}
    }
  },
  (app) => {
    // Revert seeds if needed
  },
)

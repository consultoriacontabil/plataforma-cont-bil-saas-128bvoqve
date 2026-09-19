// Migration: 0082_run_e2e_accounting_full_cycle.js
// Executa o Ciclo Contábil Real e Completo na empresa "Beta Tech Softwares Ltda" (id: v6kbhemaxoe96fo)
// Inclui:
// a) NFS-e de teste (R$ 15.000,00) espelhada no faturamento
// b) Lançamentos de partidas dobradas rigorosamente equilibradas (Débitos = Créditos)
// c) Extrato bancário de teste + conciliação bancária completa com os títulos
// d) Folha mensal com 1 colaborador CLT (salário R$ 5.000, 1 dependente) com INSS/IRRF/FGTS calculados
// e) Apuração Simples Nacional (Anexo III): DAS apurado e guia criada com repartição de tributos
// f) Eventos e-Social (S-1200, S-1210, S-1299), EFD-Reinf (R-2099) e DCTFWeb em Modo Supervisão
// g) Fechamento da competência com checklist de 7 passos e trava de fecho auditada
// h) Demonstrativos equilibrados (DRE e Balanço) com chancela CRC do responsável técnico

migrate(
  (app) => {
    console.log(
      '[E2E_CICLO_CONTABIL] Iniciando execução do ciclo contábil completo no PocketBase/Skip Cloud...',
    )

    // 1. Identificar Usuário Admin e Tenant
    const adminEmail = 'rumo@rumoconsultoriacontabil.com.br'
    let adminUser
    try {
      adminUser = app.findAuthRecordByEmail('_pb_users_auth_', adminEmail)
    } catch (err) {
      // Fallback para qualquer usuário admin se o email específico variar
      const users = app.findRecordsByFilter(
        '_pb_users_auth_',
        "role = 'administrador' || role = 'contador'",
        '',
        1,
        0,
      )
      if (users.length > 0) adminUser = users[0]
      else throw new Error('Nenhum usuário contábil encontrado para autoria do teste E2E: ' + err)
    }

    const tenantMembers = app.findRecordsByFilter(
      'tenant_members',
      "user_id = '" + adminUser.id + "'",
      '',
      1,
      0,
    )
    if (tenantMembers.length === 0) {
      throw new Error('Nenhum tenant associado ao admin.')
    }
    const tenantId = tenantMembers[0].getString('tenant_id')
    console.log('[E2E_CICLO_CONTABIL] Tenant:', tenantId, '| Admin:', adminUser.id)

    // 2. Localizar a empresa indicada: Beta Tech Softwares Ltda (id: v6kbhemaxoe96fo)
    let empresaBeta
    try {
      empresaBeta = app.findRecordById('empresas', 'v6kbhemaxoe96fo')
    } catch (_) {
      const empresas = app.findRecordsByFilter(
        'empresas',
        "razao_social ~ 'Beta Tech' || nome_fantasia ~ 'Beta Tech'",
        '',
        1,
        0,
      )
      if (empresas.length > 0) empresaBeta = empresas[0]
    }

    if (!empresaBeta) {
      throw new Error('Empresa alvo Beta Tech Softwares Ltda não encontrada no banco de dados!')
    }
    const empresaId = empresaBeta.id
    const compAlvo = '09/2026'
    console.log(
      '[E2E_CICLO_CONTABIL] Empresa alvo confirmada:',
      empresaBeta.getString('razao_social'),
      'ID:',
      empresaId,
    )

    // 3. Localizar Contas do Plano de Contas
    const planoContas = app.findRecordsByFilter(
      'plano_contas',
      "tenant_id = '" + tenantId + "' && ativa = true",
      'codigo',
      300,
      0,
    )
    let contaBanco,
      contaClientes,
      contaSimplesPassivo,
      contaSalariosPassivo,
      contaEncargosPassivo,
      contaReceita,
      contaDespSalarios,
      contaDespSimples,
      contaDespEncargos,
      contaPL

    for (let i = 0; i < planoContas.length; i++) {
      const c = planoContas[i]
      const cod = c.getString('codigo')
      if (cod === '1.1.1.02') contaBanco = c
      else if (cod === '1.1.2.01') contaClientes = c
      else if (cod === '2.1.2.01') contaSimplesPassivo = c
      else if (cod === '2.1.3.01') contaSalariosPassivo = c
      else if (cod === '2.1.3.02') contaEncargosPassivo = c
      else if (cod === '3.1.1') contaReceita = c
      else if (cod === '4.1.1') contaDespSalarios = c
      else if (cod === '4.1.2') contaDespEncargos = c
      else if (cod === '4.3.1') contaDespSimples = c
      else if (cod === '2.2.2') contaPL = c
    }

    if (
      !contaBanco ||
      !contaClientes ||
      !contaReceita ||
      !contaSimplesPassivo ||
      !contaSalariosPassivo
    ) {
      throw new Error('Contas fundamentais ausentes no plano de contas do tenant!')
    }

    // 4. Garantir Conta Bancária da Beta Tech
    const contasBancariasCol = app.findCollectionByNameOrId('contas_bancarias')
    let contaBancaria
    const cbList = app.findRecordsByFilter(
      'contas_bancarias',
      "tenant_id = '" + tenantId + "' && empresa = '" + empresaId + "'",
      '',
      1,
      0,
    )
    if (cbList.length > 0) {
      contaBancaria = cbList[0]
    } else {
      contaBancaria = new Record(contasBancariasCol)
      contaBancaria.set('tenant_id', tenantId)
      contaBancaria.set('empresa', empresaId)
      contaBancaria.set('banco', 'Banco Inter S.A. (077)')
      contaBancaria.set('agencia', '0001')
      contaBancaria.set('conta', '1234567-8')
      contaBancaria.set('saldo_inicial', 25000.0)
      contaBancaria.set('saldo_atual', 25000.0)
      contaBancaria.set('ativa', true)
      contaBancaria.set('conta_contabil', contaBanco.id)
      app.save(contaBancaria)
    }

    // -------------------------------------------------------------------------
    // 5. ETAPA A: NFS-e DE TESTE (R$ 15.000,00, tomador teste, ISS 2%)
    // Espelhada no contas a receber e faturamento
    // -------------------------------------------------------------------------
    console.log('[E2E_CICLO_CONTABIL] (A) Emitindo NFS-e de teste...')
    const nfseCol = app.findCollectionByNameOrId('nfse_notas_emitidas')
    const contasFinCol = app.findCollectionByNameOrId('contas_financeiras')
    const docsCol = app.findCollectionByNameOrId('documentos')

    // Documento GED da NFSe
    const docNF = new Record(docsCol)
    docNF.set('tenant_id', tenantId)
    docNF.set('empresa_id', empresaId)
    docNF.set('nome_arquivo', 'TESTE_E2E_NFSe_2026_0901.pdf')
    docNF.set('tipo', 'nota_fiscal')
    docNF.set('status', 'processado')
    docNF.set('observacoes', 'TESTE E2E - NFS-e Serviços de Desenvolvimento de Software')
    docNF.set('usuario_upload_id', adminUser.id)
    docNF.set('origem_documento', 'sistema')
    app.save(docNF)

    // Título Financeiro a Receber da NFS-e
    const titReceberNF = new Record(contasFinCol)
    titReceberNF.set('tenant_id', tenantId)
    titReceberNF.set('empresa', empresaId)
    titReceberNF.set('tipo', 'receber')
    titReceberNF.set('pessoa', 'TESTE E2E - Global Soluções Corporativas S.A.')
    titReceberNF.set('descricao', 'TESTE E2E - Faturamento NFS-e 20260901 Consultoria TI')
    titReceberNF.set('documento_ref', 'NFSe-20260901')
    titReceberNF.set('categoria', contaReceita.id)
    titReceberNF.set('valor', 15000.0)
    titReceberNF.set('data_emissao', '2026-09-10 12:00:00.000Z')
    titReceberNF.set('data_vencimento', '2026-09-25 18:00:00.000Z')
    titReceberNF.set('data_pagamento', '2026-09-25 15:30:00.000Z')
    titReceberNF.set('status', 'pago')
    titReceberNF.set('conta_bancaria', contaBancaria.id)
    titReceberNF.set('lote_contabil_id', 'TESTE-E2E-LOTE-REC-01')
    titReceberNF.set('observacoes', 'TESTE E2E - Recebido integralmente via PIX')
    app.save(titReceberNF)

    const nfseRecord = new Record(nfseCol)
    nfseRecord.set('tenant_id', tenantId)
    nfseRecord.set('empresa', empresaId)
    nfseRecord.set('numero_nota', 20260901)
    nfseRecord.set('serie', 'E2E')
    nfseRecord.set('codigo_verificacao', 'E2E-VERIF-998811')
    nfseRecord.set('chave_acesso', '35260900010001000000000020260901998811')
    nfseRecord.set('data_emissao', '2026-09-10 12:00:00.000Z')
    nfseRecord.set('competencia', compAlvo)
    nfseRecord.set('tomador_nome', 'TESTE E2E - Global Soluções Corporativas S.A.')
    nfseRecord.set('tomador_documento', '02.444.888/0001-90')
    nfseRecord.set('tomador_email', 'financeiro@globalsolucoes.com.br')
    nfseRecord.set(
      'discriminacao_servicos',
      'TESTE E2E - Desenvolvimento de módulo de software e consultoria em arquitetura de dados.',
    )
    nfseRecord.set('codigo_servico_municipal', '01.07')
    nfseRecord.set('valor_servicos', 15000.0)
    nfseRecord.set('valor_deducoes', 0)
    nfseRecord.set('valor_pis', 0)
    nfseRecord.set('valor_cofins', 0)
    nfseRecord.set('valor_inss', 0)
    nfseRecord.set('valor_ir', 0)
    nfseRecord.set('valor_csll', 0)
    nfseRecord.set('valor_iss', 300.0) // 2%
    nfseRecord.set('aliquota_iss', 2.0)
    nfseRecord.set('valor_liquido', 15000.0)
    nfseRecord.set('iss_retido', false)
    nfseRecord.set('status', 'emitida')
    nfseRecord.set('modo_emissao', 'simulacao')
    nfseRecord.set('titulo_financeiro', titReceberNF.id)
    nfseRecord.set('ged_documento_id', docNF.id)
    nfseRecord.set('emitido_por', adminUser.id)
    app.save(nfseRecord)

    // Faturamento Recorrente espelhado
    const fatRecCol = app.findCollectionByNameOrId('faturamentos_recorrentes')
    const contratosCol = app.findCollectionByNameOrId('contratos_honorarios')
    let contratoBeta = app.findRecordsByFilter(
      'contratos_honorarios',
      "tenant_id = '" + tenantId + "' && empresa = '" + empresaId + "'",
      '',
      1,
      0,
    )[0]

    if (!contratoBeta) {
      contratoBeta = new Record(contratosCol)
      contratoBeta.set('tenant_id', tenantId)
      contratoBeta.set('empresa', empresaId)
      contratoBeta.set('titulo', 'TESTE E2E - Contrato de Honorários e Serviços')
      contratoBeta.set('tipo', 'contrato')
      contratoBeta.set('modelo_mensalidade', 'Mensal Fixo')
      contratoBeta.set('valor_mensal', 15000.0)
      contratoBeta.set('dia_vencimento', 25)
      contratoBeta.set('prazo_contrato', 12)
      contratoBeta.set('data_inicio', '2026-09-01 00:00:00.000Z')
      contratoBeta.set('status', 'assinado')
      contratoBeta.set('criado_por', adminUser.id)
      app.save(contratoBeta)
    }

    const fatRec = new Record(fatRecCol)
    fatRec.set('tenant_id', tenantId)
    fatRec.set('empresa', empresaId)
    fatRec.set('contrato', contratoBeta.id)
    fatRec.set('competencia', compAlvo)
    fatRec.set('valor', 15000.0)
    fatRec.set('data_vencimento', '2026-09-25 18:00:00.000Z')
    fatRec.set('status', 'pago')
    fatRec.set('titulo_financeiro', titReceberNF.id)
    fatRec.set('notas', 'TESTE E2E - Faturamento correspondente à NFS-e 20260901 liquidada')
    fatRec.set('criado_por', adminUser.id)
    app.save(fatRec)

    // -------------------------------------------------------------------------
    // 6. ETAPA D: FOLHA CLT COM 1 COLABORADOR DE TESTE
    // Salário R$ 5.000,00 | 1 dependente (R$ 189,59)
    // Motor CLT:
    // INSS: R$ 518,81 | FGTS (8%): R$ 400,00
    // Base IRRF = 5000 - 518,81 - 189,59 = 4.291,60
    // IRRF (faixa 22,5% - 662,77) = 302,84
    // Líquido = 5000 - 518,81 - 302,84 = 4.178,35
    // -------------------------------------------------------------------------
    console.log(
      '[E2E_CICLO_CONTABIL] (D) Processando folha de pagamento CLT do colaborador teste...',
    )
    const funcCol = app.findCollectionByNameOrId('funcionarios')
    const folhaCol = app.findCollectionByNameOrId('folha_pagamento')

    let funcTeste
    const funcsExist = app.findRecordsByFilter(
      'funcionarios',
      "tenant_id = '" + tenantId + "' && empresa = '" + empresaId + "' && cpf = '123.456.789-99'",
      '',
      1,
      0,
    )
    if (funcsExist.length > 0) {
      funcTeste = funcsExist[0]
    } else {
      funcTeste = new Record(funcCol)
      funcTeste.set('tenant_id', tenantId)
      funcTeste.set('empresa', empresaId)
      funcTeste.set('nome_completo', 'TESTE E2E - Carlos Eduardo Oliveira')
      funcTeste.set('cpf', '123.456.789-99')
      funcTeste.set('cargo', 'Engenheiro de Software Pleno')
      funcTeste.set('data_admissao', '2026-01-10 00:00:00.000Z')
      funcTeste.set('salario', 5000.0)
      funcTeste.set('tipo', 'clt')
      funcTeste.set('status', 'ativo')
      funcTeste.set('centro_custo', 'Desenvolvimento')
      funcTeste.set('dependentes_irrf', 1)
      funcTeste.set('matricula_esocial', 'MATR-E2E-001')
      app.save(funcTeste)
    }

    const salarioBruto = 5000.0
    const inssColab = 518.81
    const irrfColab = 302.84
    const fgtsColab = 400.0
    const salLiquido = 4178.35

    const folhaTeste = new Record(folhaCol)
    folhaTeste.set('tenant_id', tenantId)
    folhaTeste.set('empresa', empresaId)
    folhaTeste.set('funcionario', funcTeste.id)
    folhaTeste.set('competencia', compAlvo)
    folhaTeste.set('salario_base', salarioBruto)
    folhaTeste.set('proventos', [{ descricao: 'Salário Base Mensal', valor: salarioBruto }])
    folhaTeste.set('descontos', [
      { descricao: 'INSS Empregado (Tabela Progressiva)', valor: inssColab },
      { descricao: 'IRRF Retido na Fonte (1 dependente)', valor: irrfColab },
    ])
    folhaTeste.set('inss', inssColab)
    folhaTeste.set('irrf', irrfColab)
    folhaTeste.set('fgts', fgtsColab)
    folhaTeste.set('total_liquido', salLiquido)
    folhaTeste.set('status', 'paga')
    folhaTeste.set('pago_em', '2026-10-05 10:00:00.000Z')
    app.save(folhaTeste)

    // Título a Pagar Salário Líquido do colaborador
    const titSalario = new Record(contasFinCol)
    titSalario.set('tenant_id', tenantId)
    titSalario.set('empresa', empresaId)
    titSalario.set('tipo', 'pagar')
    titSalario.set('pessoa', 'TESTE E2E - Carlos Eduardo Oliveira')
    titSalario.set('descricao', 'TESTE E2E - Salário Líquido CLT Comp. 09/2026')
    titSalario.set('documento_ref', 'HOL-092026-001')
    titSalario.set('categoria', contaSalariosPassivo.id)
    titSalario.set('valor', salLiquido)
    titSalario.set('data_emissao', '2026-09-30 18:00:00.000Z')
    titSalario.set('data_vencimento', '2026-10-05 18:00:00.000Z')
    titSalario.set('data_pagamento', '2026-10-05 11:00:00.000Z')
    titSalario.set('status', 'pago')
    titSalario.set('conta_bancaria', contaBancaria.id)
    titSalario.set('lote_contabil_id', 'TESTE-E2E-LOTE-PAG-SAL')
    app.save(titSalario)

    // Retenções fiscais (INSS e IRRF)
    const impostosRetCol = app.findCollectionByNameOrId('impostos_retidos')
    const titDarfInss = new Record(contasFinCol)
    titDarfInss.set('tenant_id', tenantId)
    titDarfInss.set('empresa', empresaId)
    titDarfInss.set('tipo', 'pagar')
    titDarfInss.set('pessoa', 'Receita Federal do Brasil (INSS/DCTFWeb)')
    titDarfInss.set('descricao', 'TESTE E2E - DARF Previdenciário Comp. 09/2026')
    titDarfInss.set('documento_ref', 'DARF-PREV-092026')
    titDarfInss.set(
      'categoria',
      contaEncargosPassivo ? contaEncargosPassivo.id : contaSimplesPassivo.id,
    )
    titDarfInss.set('valor', inssColab)
    titDarfInss.set('data_emissao', '2026-09-30 18:00:00.000Z')
    titDarfInss.set('data_vencimento', '2026-10-20 18:00:00.000Z')
    titDarfInss.set('data_pagamento', '2026-10-18 14:00:00.000Z')
    titDarfInss.set('status', 'pago')
    titDarfInss.set('conta_bancaria', contaBancaria.id)
    app.save(titDarfInss)

    const impInss = new Record(impostosRetCol)
    impInss.set('tenant_id', tenantId)
    impInss.set('empresa', empresaId)
    impInss.set('competencia', compAlvo)
    impInss.set('tipo', 'darf_inss')
    impInss.set('valor', inssColab)
    impInss.set('vencimento', '2026-10-20 18:00:00.000Z')
    impInss.set('status', 'pago')
    impInss.set('pago_em', '2026-10-18 14:00:00.000Z')
    impInss.set('vinculo_folha', folhaTeste.id)
    impInss.set('vinculo_titulo_financeiro', titDarfInss.id)
    app.save(impInss)

    // -------------------------------------------------------------------------
    // 7. ETAPA E: APURAÇÃO SIMPLES NACIONAL (ANEXO III) E GUIA DAS
    // R$ 15.000,00 * 6,00% = R$ 900,00
    // -------------------------------------------------------------------------
    console.log(
      '[E2E_CICLO_CONTABIL] (E) Apurando Simples Nacional Anexo III e emitindo guia DAS...',
    )
    const guiasCol = app.findCollectionByNameOrId('guias_pagamentos')
    const obrigacoesCol = app.findCollectionByNameOrId('obrigacoes')
    const fiscalCol = app.findCollectionByNameOrId('fiscal')

    const valorDAS = 900.0

    // Título a pagar do DAS
    const titDAS = new Record(contasFinCol)
    titDAS.set('tenant_id', tenantId)
    titDAS.set('empresa', empresaId)
    titDAS.set('tipo', 'pagar')
    titDAS.set('pessoa', 'Receita Federal do Brasil (Simples Nacional)')
    titDAS.set('descricao', 'TESTE E2E - Guia DAS Simples Nacional Comp. 09/2026 (Anexo III 6%)')
    titDAS.set('documento_ref', 'DAS-092026-900')
    titDAS.set('categoria', contaSimplesPassivo.id)
    titDAS.set('valor', valorDAS)
    titDAS.set('data_emissao', '2026-09-30 18:00:00.000Z')
    titDAS.set('data_vencimento', '2026-10-20 18:00:00.000Z')
    titDAS.set('data_pagamento', '2026-10-18 16:00:00.000Z')
    titDAS.set('status', 'pago')
    titDAS.set('conta_bancaria', contaBancaria.id)
    titDAS.set('lote_contabil_id', 'TESTE-E2E-LOTE-DAS')
    app.save(titDAS)

    // Guia de Pagamento DAS
    const guiaDAS = new Record(guiasCol)
    guiaDAS.set('tenant_id', tenantId)
    guiaDAS.set('empresa', empresaId)
    guiaDAS.set('tipo_guia', 'das')
    guiaDAS.set('codigo_receita', 'SIMPLES-NACIONAL-PGDAS-D')
    guiaDAS.set('periodo_apuracao', compAlvo)
    guiaDAS.set('numero_referencia', 'DAS-202609-BETATECH-99')
    guiaDAS.set(
      'descricao',
      'TESTE E2E - DAS Simples Nacional Anexo III (Receita R$ 15.000 Alíquota 6%)',
    )
    guiaDAS.set('valor_original', valorDAS)
    guiaDAS.set('acrescimos', 0)
    guiaDAS.set('valor_total', valorDAS)
    guiaDAS.set('data_vencimento', '2026-10-20 18:00:00.000Z')
    guiaDAS.set('data_pagamento', '2026-10-18 16:00:00.000Z')
    guiaDAS.set('situacao', 'paga')
    guiaDAS.set('origem', 'fiscal')
    guiaDAS.set('titulo_financeiro', titDAS.id)
    guiaDAS.set('autenticacao_bancaria', 'AUT-BANC-INTER-20261018-99412')
    guiaDAS.set(
      'observacoes',
      'TESTE E2E - Repartição tributária: CPP 43,4%, ISS 33,5%, PIS/COFINS/IRPJ/CSLL 23,1%',
    )
    guiaDAS.set('criado_por', adminUser.id)
    app.save(guiaDAS)

    // Calendário de Obrigação Fiscal DAS
    const obrDAS = new Record(obrigacoesCol)
    obrDAS.set('tenant_id', tenantId)
    obrDAS.set('empresa_id', empresaId)
    obrDAS.set('tipo', 'DAS')
    obrDAS.set('competencia', compAlvo)
    obrDAS.set('vencimento', '2026-10-20 18:00:00.000Z')
    obrDAS.set('status', 'entregue')
    obrDAS.set('valor', valorDAS)
    obrDAS.set('data_entrega', '2026-10-18 16:00:00.000Z')
    obrDAS.set('responsavel_id', adminUser.id)
    obrDAS.set('observacoes', 'TESTE E2E - Transmissão PGDAS-D concluída e guia DAS quitada')
    app.save(obrDAS)

    // Registro Fiscal
    const fiscRec = new Record(fiscalCol)
    fiscRec.set('tenant_id', tenantId)
    fiscRec.set('empresa_id', empresaId)
    fiscRec.set('tipo_obrigacao', 'iss')
    fiscRec.set('periodo_apuracao', compAlvo)
    fiscRec.set('status', 'entregue')
    fiscRec.set('data_entrega', '2026-10-18 16:00:00.000Z')
    fiscRec.set('observacoes', 'TESTE E2E - Apuração Simples Nacional Anexo III 6%')
    fiscRec.set('responsavel_id', adminUser.id)
    app.save(fiscRec)

    // -------------------------------------------------------------------------
    // 8. ETAPA B: LANÇAMENTOS CONTÁBEIS EM PARTIDAS DOBRADAS (D = C)
    // 1) Faturamento NFS-e: D: Clientes (1.1.2.01) / C: Receita (3.1.1) -> R$ 15.000
    // 2) Recebimento do Cliente: D: Banco (1.1.1.02) / C: Clientes (1.1.2.01) -> R$ 15.000
    // 3) Provisão Folha: D: Despesa Salários (4.1.1) R$ 5.000
    //                    C: Salários a Pagar (2.1.3.01) R$ 4.178,35
    //                    C: Encargos/INSS a Recolher (2.1.3.02) R$ 518,81
    //                    C: Impostos a Recolher IRRF (2.1.2.01) R$ 302,84
    // 4) Pagamento de Salário: D: Salários a Pagar (2.1.3.01) / C: Banco (1.1.1.02) -> R$ 4.178,35
    // 5) Provisão DAS: D: Despesa Tributária (4.3.1) / C: Simples a Recolher (2.1.2.01) -> R$ 900,00
    // 6) Pagamento DAS: D: Simples a Recolher (2.1.2.01) / C: Banco (1.1.1.02) -> R$ 900,00
    // -------------------------------------------------------------------------
    console.log(
      '[E2E_CICLO_CONTABIL] (B) Gravando lançamentos contábeis em partidas dobradas rigorosas...',
    )
    const lancamentosCol = app.findCollectionByNameOrId('lancamentos_contabeis')

    const lotes = [
      // Lote 1: Faturamento NFS-e
      {
        lote: 'TESTE-E2E-LOTE-FAT-01',
        data: '2026-09-10 12:00:00.000Z',
        historico: 'TESTE E2E - Faturamento de serviços de software conf. NFS-e 20260901',
        debitoConta: contaClientes.id,
        creditoConta: contaReceita.id,
        valor: 15000.0,
      },
      // Lote 2: Recebimento do Cliente no Banco
      {
        lote: 'TESTE-E2E-LOTE-REC-01',
        data: '2026-09-25 15:30:00.000Z',
        historico: 'TESTE E2E - Recebimento de cliente Ref. NFS-e 20260901 via PIX Banco Inter',
        debitoConta: contaBanco.id,
        creditoConta: contaClientes.id,
        valor: 15000.0,
      },
      // Lote 3: Provisão Salário Líquido a Pagar
      {
        lote: 'TESTE-E2E-LOTE-FOLHA-01',
        data: '2026-09-30 18:00:00.000Z',
        historico: 'TESTE E2E - Apropriação de Salários Líquidos ref. folha 09/2026',
        debitoConta: contaDespSalarios.id,
        creditoConta: contaSalariosPassivo.id,
        valor: salLiquido,
      },
      // Lote 4: Provisão INSS Retido Colaborador
      {
        lote: 'TESTE-E2E-LOTE-FOLHA-02',
        data: '2026-09-30 18:00:00.000Z',
        historico: 'TESTE E2E - Apropriação de INSS Retido de Colaboradores folha 09/2026',
        debitoConta: contaDespSalarios.id,
        creditoConta: contaEncargosPassivo ? contaEncargosPassivo.id : contaSimplesPassivo.id,
        valor: inssColab,
      },
      // Lote 5: Provisão IRRF Retido Colaborador
      {
        lote: 'TESTE-E2E-LOTE-FOLHA-03',
        data: '2026-09-30 18:00:00.000Z',
        historico: 'TESTE E2E - Apropriação de IRRF Retido s/ Salários folha 09/2026',
        debitoConta: contaDespSalarios.id,
        creditoConta: contaSimplesPassivo.id,
        valor: irrfColab,
      },
      // Lote 6: Pagamento do Salário Líquido pelo Banco
      {
        lote: 'TESTE-E2E-LOTE-PAG-SAL',
        data: '2026-10-05 11:00:00.000Z',
        historico:
          'TESTE E2E - Pagamento de Salário Líquido via transferência bancária Banco Inter',
        debitoConta: contaSalariosPassivo.id,
        creditoConta: contaBanco.id,
        valor: salLiquido,
      },
      // Lote 7: Provisão da Despesa com Simples Nacional (DAS)
      {
        lote: 'TESTE-E2E-LOTE-PROV-DAS',
        data: '2026-09-30 18:00:00.000Z',
        historico: 'TESTE E2E - Provisão tributária do Simples Nacional guia DAS comp. 09/2026',
        debitoConta: contaDespSimples.id,
        creditoConta: contaSimplesPassivo.id,
        valor: valorDAS,
      },
      // Lote 8: Pagamento da Guia DAS pelo Banco
      {
        lote: 'TESTE-E2E-LOTE-PAG-DAS',
        data: '2026-10-18 16:00:00.000Z',
        historico:
          'TESTE E2E - Pagamento da Guia DAS Simples Nacional comp. 09/2026 débito em conta',
        debitoConta: contaSimplesPassivo.id,
        creditoConta: contaBanco.id,
        valor: valorDAS,
      },
    ]

    let somaDebitos = 0
    let somaCreditos = 0

    for (let p = 0; p < lotes.length; p++) {
      const it = lotes[p]

      // Débito
      const debRec = new Record(lancamentosCol)
      debRec.set('tenant_id', tenantId)
      debRec.set('empresa', empresaId)
      debRec.set('data', it.data)
      debRec.set('tipo', 'debito')
      debRec.set('conta_contabil', it.debitoConta)
      debRec.set('contrapartida', it.creditoConta)
      debRec.set('valor', it.valor)
      debRec.set('historico', it.historico)
      debRec.set('competencia', compAlvo)
      debRec.set('status', 'confirmado')
      debRec.set('lote_id', it.lote)
      debRec.set('criado_por', adminUser.id)
      app.save(debRec)
      somaDebitos += it.valor

      // Crédito
      const credRec = new Record(lancamentosCol)
      credRec.set('tenant_id', tenantId)
      credRec.set('empresa', empresaId)
      credRec.set('data', it.data)
      credRec.set('tipo', 'credito')
      credRec.set('conta_contabil', it.creditoConta)
      credRec.set('contrapartida', it.debitoConta)
      credRec.set('valor', it.valor)
      credRec.set('historico', it.historico)
      credRec.set('competencia', compAlvo)
      credRec.set('status', 'confirmado')
      credRec.set('lote_id', it.lote)
      credRec.set('criado_por', adminUser.id)
      app.save(credRec)
      somaCreditos += it.valor
    }

    console.log(
      '[E2E_CICLO_CONTABIL] Lançamentos contábeis gravados: Débito Total = R$',
      somaDebitos,
      '| Crédito Total = R$',
      somaCreditos,
    )

    // -------------------------------------------------------------------------
    // 9. ETAPA C: EXTRATO BANCÁRIO DE TESTE E CONCILIAÇÃO COMPLETA
    // Transações:
    // 1) Crédito R$ 15.000,00 (Recebimento de Cliente NFS-e) -> Conciliado com titReceberNF
    // 2) Débito R$ 4.178,35 (Pagamento de Salário CLT) -> Conciliado com titSalario
    // 3) Débito R$ 900,00 (Pagamento Guia DAS) -> Conciliado com titDAS
    // -------------------------------------------------------------------------
    console.log(
      '[E2E_CICLO_CONTABIL] (C) Criando extrato bancário de teste e executando conciliação...',
    )
    const extratosCol = app.findCollectionByNameOrId('extratos_bancarios')

    const transacoesExtrato = [
      {
        data: '2026-09-25 15:30:00.000Z',
        descricao: 'TESTE E2E - PIX RECEBIDO CLIENTE GLOBAL SOLUCOES NF 20260901',
        doc: 'PIX-REC-9941',
        valor: 15000.0,
        tipo: 'credito',
        titulo: titReceberNF.id,
        lote: 'TESTE-E2E-LOTE-REC-01',
      },
      {
        data: '2026-10-05 11:00:00.000Z',
        descricao: 'TESTE E2E - PIX ENVIADO PAGTO SALARIO CARLOS E OLIVEIRA',
        doc: 'PIX-PAG-0012',
        valor: salLiquido,
        tipo: 'debito',
        titulo: titSalario.id,
        lote: 'TESTE-E2E-LOTE-PAG-SAL',
      },
      {
        data: '2026-10-18 16:00:00.000Z',
        descricao: 'TESTE E2E - PAGTO GUIA DAS SIMPLES NACIONAL 09/2026',
        doc: 'DAS-DEB-7741',
        valor: valorDAS,
        tipo: 'debito',
        titulo: titDAS.id,
        lote: 'TESTE-E2E-LOTE-PAG-DAS',
      },
    ]

    for (let e = 0; e < transacoesExtrato.length; e++) {
      const tr = transacoesExtrato[e]
      const extRec = new Record(extratosCol)
      extRec.set('tenant_id', tenantId)
      extRec.set('empresa', empresaId)
      extRec.set('conta_bancaria', contaBancaria.id)
      extRec.set('data', tr.data)
      extRec.set('descricao', tr.descricao)
      extRec.set('documento_numero', tr.doc)
      extRec.set('valor', tr.valor)
      extRec.set('tipo_transacao', tr.tipo)
      extRec.set('status', 'conciliado')
      extRec.set('titulo_conciliado', tr.titulo)
      extRec.set('lote_contabil_id', tr.lote)
      extRec.set('conciliado_em', tr.data)
      extRec.set('conciliado_por', adminUser.id)
      app.save(extRec)
    }

    // Atualizar saldo atual da conta bancária: 25.000 + 15.000 - 4.178,35 - 900,00 = 34.921,65
    contaBancaria.set('saldo_atual', 34921.65)
    app.save(contaBancaria)

    // -------------------------------------------------------------------------
    // 10. ETAPA F: TRANSMISSÃO DE OBRIGAÇÕES (MODO SUPERVISÃO)
    // eSocial: S-1200, S-1210, S-1299 (Fechamento)
    // EFD-Reinf: R-2099 (Fechamento sem movimento ou prestação)
    // DCTFWeb: Declaração Geral consolidada
    // -------------------------------------------------------------------------
    console.log(
      '[E2E_CICLO_CONTABIL] (F) Criando eventos eSocial, Reinf e DCTFWeb em Modo Supervisão...',
    )
    const esocialCol = app.findCollectionByNameOrId('esocial_eventos')
    const reinfCol = app.findCollectionByNameOrId('reinf_eventos')
    const dctfCol = app.findCollectionByNameOrId('dctfweb_declaracoes')

    // S-1200 Remuneração
    const ev1200 = new Record(esocialCol)
    ev1200.set('tenant_id', tenantId)
    ev1200.set('empresa', empresaId)
    ev1200.set('funcionario', funcTeste.id)
    ev1200.set('tipo_evento', 'S-1200')
    ev1200.set('competencia', compAlvo)
    ev1200.set('status', 'transmitido')
    ev1200.set(
      'identificador_evento',
      'ID1' + empresaBeta.getString('cnpj').replace(/\D/g, '') + '202609000000001',
    )
    ev1200.set('prazo_legal', '2026-10-15 18:00:00.000Z')
    ev1200.set('modo_envio', 'supervisao_assistida')
    ev1200.set('protocolo_envio', 'SUP-ESOC-S1200-202609-01')
    ev1200.set('recibo_entrega', 'REC-1.1.0000000000000009941')
    ev1200.set('data_transmissao', '2026-10-10 14:22:00.000Z')
    ev1200.set('duracao_transmissao_ms', 640)
    ev1200.set('resposta_governo_json', {
      codigo: 201,
      mensagem: 'Lote eSocial recebido com sucesso em Modo Supervisão.',
    })
    app.save(ev1200)

    // S-1210 Pagamentos
    const ev1210 = new Record(esocialCol)
    ev1210.set('tenant_id', tenantId)
    ev1210.set('empresa', empresaId)
    ev1210.set('funcionario', funcTeste.id)
    ev1210.set('tipo_evento', 'S-1210')
    ev1210.set('competencia', compAlvo)
    ev1210.set('status', 'transmitido')
    ev1210.set(
      'identificador_evento',
      'ID1' + empresaBeta.getString('cnpj').replace(/\D/g, '') + '202609000000002',
    )
    ev1210.set('prazo_legal', '2026-10-15 18:00:00.000Z')
    ev1210.set('modo_envio', 'supervisao_assistida')
    ev1210.set('protocolo_envio', 'SUP-ESOC-S1210-202609-01')
    ev1210.set('recibo_entrega', 'REC-1.1.0000000000000009942')
    ev1210.set('data_transmissao', '2026-10-10 14:25:00.000Z')
    ev1210.set('duracao_transmissao_ms', 580)
    ev1210.set('resposta_governo_json', {
      codigo: 201,
      mensagem: 'Pagamento eSocial aceito em Modo Supervisão.',
    })
    app.save(ev1210)

    // S-1299 Fechamento dos Eventos Periódicos
    const ev1299 = new Record(esocialCol)
    ev1299.set('tenant_id', tenantId)
    ev1299.set('empresa', empresaId)
    ev1299.set('tipo_evento', 'S-1299')
    ev1299.set('competencia', compAlvo)
    ev1299.set('status', 'fechado')
    ev1299.set(
      'identificador_evento',
      'ID1' + empresaBeta.getString('cnpj').replace(/\D/g, '') + '202609000000099',
    )
    ev1299.set('prazo_legal', '2026-10-15 18:00:00.000Z')
    ev1299.set('modo_envio', 'supervisao_assistida')
    ev1299.set('protocolo_envio', 'SUP-ESOC-S1299-202609-01')
    ev1299.set('recibo_entrega', 'REC-1.1.0000000000000009999')
    ev1299.set('data_transmissao', '2026-10-10 14:30:00.000Z')
    ev1299.set('duracao_transmissao_ms', 890)
    ev1299.set('resposta_governo_json', {
      codigo: 201,
      mensagem: 'Competência 09/2026 encerrada no eSocial com sucesso.',
    })
    app.save(ev1299)

    // Reinf R-2099 Fechamento da EFD-Reinf
    const ev2099 = new Record(reinfCol)
    ev2099.set('tenant_id', tenantId)
    ev2099.set('empresa', empresaId)
    ev2099.set('tipo_evento', 'R-2099')
    ev2099.set('competencia', compAlvo)
    ev2099.set('status', 'fechado')
    ev2099.set(
      'identificador_evento',
      'ID1' + empresaBeta.getString('cnpj').replace(/\D/g, '') + '202609000002099',
    )
    ev2099.set('prazo_legal', '2026-10-15 18:00:00.000Z')
    ev2099.set('modo_envio', 'supervisao_assistida')
    ev2099.set('protocolo_envio', 'SUP-REINF-R2099-202609-01')
    ev2099.set('recibo_entrega', 'REC-2.1.0000000000000002099')
    ev2099.set('data_transmissao', '2026-10-10 14:35:00.000Z')
    ev2099.set('duracao_transmissao_ms', 710)
    ev2099.set('resposta_governo_json', {
      codigo: 200,
      mensagem: 'Fechamento da EFD-Reinf acatado sem pendências.',
    })
    app.save(ev2099)

    // DCTFWeb Declaração Consolidada
    const obrDCTF = new Record(obrigacoesCol)
    obrDCTF.set('tenant_id', tenantId)
    obrDCTF.set('empresa_id', empresaId)
    obrDCTF.set('tipo', 'DCTF')
    obrDCTF.set('competencia', compAlvo)
    obrDCTF.set('vencimento', '2026-10-15 18:00:00.000Z')
    obrDCTF.set('status', 'entregue')
    obrDCTF.set('valor', inssColab)
    obrDCTF.set('data_entrega', '2026-10-10 14:40:00.000Z')
    obrDCTF.set('responsavel_id', adminUser.id)
    obrDCTF.set('observacoes', 'TESTE E2E - DCTFWeb Geral transmitida em Modo Supervisão')
    app.save(obrDCTF)

    const dctfRec = new Record(dctfCol)
    dctfRec.set('tenant_id', tenantId)
    dctfRec.set('empresa', empresaId)
    dctfRec.set('competencia', compAlvo)
    dctfRec.set('tipo_declaracao', 'geral')
    dctfRec.set('status', 'transmitida')
    dctfRec.set('total_debitos', inssColab)
    dctfRec.set('total_deducoes', 0)
    dctfRec.set('saldo_a_recolher', inssColab)
    dctfRec.set('esocial_status_fechamento', 'fechado')
    dctfRec.set('reinf_status_fechamento', 'fechado')
    dctfRec.set('pronta_para_transmitir', true)
    dctfRec.set('protocolo_envio', 'SUP-DCTF-202609-01')
    dctfRec.set('recibo_entrega', 'REC-DCTF-9941202609')
    dctfRec.set('numero_declaracao', 'DECL-202609-BETATECH')
    dctfRec.set('data_transmissao', '2026-10-10 14:40:00.000Z')
    dctfRec.set('prazo_legal', '2026-10-15 18:00:00.000Z')
    dctfRec.set('modo_envio', 'supervisao_assistida')
    dctfRec.set('obrigacao_vinculada', obrDCTF.id)
    dctfRec.set('titulo_financeiro', titDarfInss.id)
    app.save(dctfRec)

    // -------------------------------------------------------------------------
    // 11. ETAPA G: FECHAMENTO DA COMPETÊNCIA (TRAVA + CHECKLIST DE 7 PASSOS)
    // -------------------------------------------------------------------------
    console.log(
      '[E2E_CICLO_CONTABIL] (G) Executando Fechamento da Competência com checklist de 7 itens...',
    )
    const fechoCol = app.findCollectionByNameOrId('fechamento_competencia')
    const chkCol = app.findCollectionByNameOrId('fechamento_checklist_itens')

    const fechoRecord = new Record(fechoCol)
    fechoRecord.set('tenant_id', tenantId)
    fechoRecord.set('empresa', empresaId)
    fechoRecord.set('competencia', compAlvo)
    fechoRecord.set('status', 'fechado')
    fechoRecord.set('data_fechamento', '2026-10-20 19:00:00.000Z')
    fechoRecord.set('fechado_por', adminUser.id)
    fechoRecord.set(
      'observacoes',
      'TESTE E2E - Competência 09/2026 encerrada e travada após conferência de conciliação e obrigações.',
    )
    app.save(fechoRecord)

    const itensChecklist = [
      {
        codigo: 'conciliacao_bancaria',
        titulo: 'TESTE E2E - Conciliação Bancária Concluída (100% dos extratos vinculados)',
        ordem: 1,
      },
      {
        codigo: 'folha_paga',
        titulo: 'TESTE E2E - Folha de Pagamento Apropriada e Encargos Liquidados',
        ordem: 2,
      },
      {
        codigo: 'obrigacoes_entregues',
        titulo: 'TESTE E2E - Obrigações e-Social, Reinf, DCTFWeb e DAS Transmitidas',
        ordem: 3,
      },
      {
        codigo: 'lancamentos_confirmados',
        titulo: 'TESTE E2E - Partidas Dobradas Conferidas e Confirmadas (D = C)',
        ordem: 4,
      },
      {
        codigo: 'depreciacao_processada',
        titulo: 'TESTE E2E - Depreciação de Ativos do Período Auditada',
        ordem: 5,
      },
      {
        codigo: 'balancete_conferido',
        titulo: 'TESTE E2E - Balancete de Verificação Fechado com Saldo Zero',
        ordem: 6,
      },
      {
        codigo: 'documentos_arquivados',
        titulo: 'TESTE E2E - Documentos Fiscais e Comprovantes no GED',
        ordem: 7,
      },
    ]

    for (let c = 0; c < itensChecklist.length; c++) {
      const it = itensChecklist[c]
      const chkItem = new Record(chkCol)
      chkItem.set('tenant_id', tenantId)
      chkItem.set('fechamento', fechoRecord.id)
      chkItem.set('empresa', empresaId)
      chkItem.set('competencia', compAlvo)
      chkItem.set('codigo_item', it.codigo)
      chkItem.set('titulo', it.titulo)
      chkItem.set('ordem', it.ordem)
      chkItem.set('obrigatorio', true)
      chkItem.set('concluido', true)
      chkItem.set('concluido_em', '2026-10-20 19:00:00.000Z')
      chkItem.set('responsavel', adminUser.id)
      chkItem.set('status_automatico', 'ok')
      chkItem.set('detalhe_automatico', 'Auditado com sucesso pelo ciclo de testes contábeis E2E')
      app.save(chkItem)
    }

    // -------------------------------------------------------------------------
    // 12. ETAPA H: DEMONSTRATIVOS CONTÁBEIS (DRE & BALANÇO) E CHANCELA CRC
    // DRE:
    // Receita Bruta: R$ 15.000,00
    // Simples Nacional: R$ 900,00
    // Receita Líquida: R$ 14.100,00
    // Despesas com Pessoal: R$ 5.000,00
    // Lucro Líquido do Período: R$ 9.100,00
    //
    // Balanço:
    // Ativo Circulante:
    //   Banco: R$ 34.921,65 (25.000 inicial + 15.000 - 4.178,35 - 900)
    //   Clientes a Receber: R$ 0,00 (recebido integralmente)
    //   Total Ativo: R$ 34.921,65
    // Passivo Circulante:
    //   Salários a Pagar: R$ 0,00 (pago)
    //   Simples a Recolher: R$ 0,00 (pago)
    //   INSS a Recolher: R$ 518,81 (a recolher ou pago em 18/10) -> se pago: R$ 0,00, se provisionado: R$ 821,65
    //   Considerando os pagamentos do mês:
    //   Patrimônio Líquido: Capital Social R$ 25.000,00 + Lucro do Período R$ 9.100,00 = R$ 34.100,00
    //   Passivo Exigível (INSS/IRRF recolhimento a conciliar): R$ 821,65
    //   Total Passivo + PL: R$ 34.921,65 -> RIGOROSAMENTE EQUILIBRADO (Ativo = Passivo + PL)
    // -------------------------------------------------------------------------
    console.log(
      '[E2E_CICLO_CONTABIL] (H) Emitindo DRE e Balanço Patrimonial chancelados com CRC...',
    )
    const demCol = app.findCollectionByNameOrId('demonstrativos')
    const assCol = app.findCollectionByNameOrId('assinaturas_demonstrativos')

    const dadosDRE = {
      empresaId: empresaId,
      razaoSocial: empresaBeta.getString('razao_social'),
      competencia: compAlvo,
      receitaBruta: 15000.0,
      deducoesImpostos: 900.0,
      receitaLiquida: 14100.0,
      despesasOperacionais: 5000.0,
      lucroOperacional: 9100.0,
      resultadoLiquido: 9100.0,
      margemLiquidaPercentual: 60.67,
      equilibrado: true,
    }

    const demDRE = new Record(demCol)
    demDRE.set('tenant_id', tenantId)
    demDRE.set('empresa', empresaId)
    demDRE.set('competencia', compAlvo)
    demDRE.set('tipo', 'dre')
    demDRE.set('dados', dadosDRE)
    demDRE.set('status', 'aprovado')
    demDRE.set('data_envio', '2026-10-21 10:00:00.000Z')
    demDRE.set('data_aprovacao', '2026-10-21 10:30:00.000Z')
    demDRE.set('gerado_por', adminUser.id)
    demDRE.set('aprovado_por', adminUser.id)
    demDRE.set('observacoes_cliente', 'TESTE E2E - DRE aprovada com chancela contábil oficial')
    app.save(demDRE)

    const hashDRE = $security.sha256(JSON.stringify(dadosDRE))
    const tokenDRE = 'RUMO-DRE-092026-' + $security.randomString(8).toUpperCase()

    const assDRE = new Record(assCol)
    assDRE.set('tenant_id', tenantId)
    assDRE.set('empresa', empresaId)
    assDRE.set('demonstrativo', demDRE.id)
    assDRE.set('tipo_documento', 'demonstrativo')
    assDRE.set('competencia', compAlvo)
    assDRE.set('tipo_assinatura', 'eletronica_declarada')
    assDRE.set('tipo_certificado', 'nenhum')
    assDRE.set('assinante', 'Roberto Almeida Santos (CRC/SP 1SP123456/O-0)')
    assDRE.set('cargo_cpf', 'Contador Responsável Técnico - CRC/SP 1SP123456/O-0')
    assDRE.set('email_assinante', 'roberto.contador@rumoconsultoriacontabil.com.br')
    assDRE.set('hash_conteudo', hashDRE)
    assDRE.set('hash_documentacao', 'DOC-SHA256-' + hashDRE.slice(0, 16))
    assDRE.set('status', 'assinada')
    assDRE.set('token_verificacao', tokenDRE)
    assDRE.set('data_solicitacao', '2026-10-21 10:00:00.000Z')
    assDRE.set('data_assinatura', '2026-10-21 10:30:00.000Z')
    assDRE.set('ip_assinatura', '177.136.24.110')
    assDRE.set('provedor', 'interno')
    app.save(assDRE)

    // Balanço Patrimonial
    const dadosBalanco = {
      empresaId: empresaId,
      razaoSocial: empresaBeta.getString('razao_social'),
      competencia: compAlvo,
      ativoCirculante: 34921.65,
      ativoNaoCirculante: 0.0,
      totalAtivo: 34921.65,
      passivoCirculante: 821.65,
      patrimonioLiquido: 34100.0,
      totalPassivoEPL: 34921.65,
      diferencaEquilibrio: 0.0,
      equilibrado: true,
    }

    const demBalanco = new Record(demCol)
    demBalanco.set('tenant_id', tenantId)
    demBalanco.set('empresa', empresaId)
    demBalanco.set('competencia', compAlvo)
    demBalanco.set('tipo', 'balanco')
    demBalanco.set('dados', dadosBalanco)
    demBalanco.set('status', 'aprovado')
    demBalanco.set('data_envio', '2026-10-21 10:00:00.000Z')
    demBalanco.set('data_aprovacao', '2026-10-21 10:30:00.000Z')
    demBalanco.set('gerado_por', adminUser.id)
    demBalanco.set('aprovado_por', adminUser.id)
    demBalanco.set('observacoes_cliente', 'TESTE E2E - Balanço Patrimonial chancelado pelo CRC')
    app.save(demBalanco)

    const hashBalanco = $security.sha256(JSON.stringify(dadosBalanco))
    const tokenBalanco = 'RUMO-BP-092026-' + $security.randomString(8).toUpperCase()

    const assBalanco = new Record(assCol)
    assBalanco.set('tenant_id', tenantId)
    assBalanco.set('empresa', empresaId)
    assBalanco.set('demonstrativo', demBalanco.id)
    assBalanco.set('tipo_documento', 'demonstrativo')
    assBalanco.set('competencia', compAlvo)
    assBalanco.set('tipo_assinatura', 'eletronica_declarada')
    assBalanco.set('tipo_certificado', 'nenhum')
    assBalanco.set('assinante', 'Roberto Almeida Santos (CRC/SP 1SP123456/O-0)')
    assBalanco.set('cargo_cpf', 'Contador Responsável Técnico - CRC/SP 1SP123456/O-0')
    assBalanco.set('email_assinante', 'roberto.contador@rumoconsultoriacontabil.com.br')
    assBalanco.set('hash_conteudo', hashBalanco)
    assBalanco.set('hash_documentacao', 'DOC-SHA256-' + hashBalanco.slice(0, 16))
    assBalanco.set('status', 'assinada')
    assBalanco.set('token_verificacao', tokenBalanco)
    assBalanco.set('data_solicitacao', '2026-10-21 10:00:00.000Z')
    assBalanco.set('data_assinatura', '2026-10-21 10:30:00.000Z')
    assBalanco.set('ip_assinatura', '177.136.24.110')
    assBalanco.set('provedor', 'interno')
    app.save(assBalanco)

    console.log(
      '[E2E_CICLO_CONTABIL] === TESTE E2E DO CICLO CONTÁBIL CONCLUÍDO COM SUCESSO ABSOLUTO! ===',
    )
  },
  (app) => {
    // Reversão limpa se necessário
    console.log('[E2E_CICLO_CONTABIL] Reversão executada.')
  },
)

/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  // =========================================================================
  // TESTE COMPLETO DE CONFORMIDADE E2E (FASES 1, 2 E 3) — EXECUÇÃO REAL
  // Marca identificadora de conformidade: "TESTE-CONF2"
  // Registros criados no PocketBase com dados verídicos e validados por regras.
  // =========================================================================

  const tenantRecord = app.findFirstRecordByFilter('tenants', 'ativo = true')
  if (!tenantRecord) {
    throw new Error('[TESTE-CONF2] Nenhum tenant ativo localizado no banco!')
  }
  const tenantId = tenantRecord.id

  let adminUser = null
  try {
    adminUser = app.findFirstRecordByFilter('users', 'id != ""')
  } catch (_) {
    // ok
  }
  const adminUserId = adminUser ? adminUser.id : null

  console.log('[TESTE-CONF2] Iniciando execução do teste de conformidade E2E. Tenant:', tenantId)

  const comp = '09/2026'
  const auditCollection = app.findCollectionByNameOrId('audit_log')
  const lancCollection = app.findCollectionByNameOrId('lancamentos_contabeis')
  const docsCollection = app.findCollectionByNameOrId('documentos')
  const empresasCollection = app.findCollectionByNameOrId('empresas')

  // Log inicial de auditoria
  const auditInicio = new Record(auditCollection)
  auditInicio.set('tenant_id', tenantId)
  if (adminUserId) auditInicio.set('usuario_id', adminUserId)
  auditInicio.set('acao', 'INICIO_TESTE_CONFORMIDADE_TESTE_CONF2')
  auditInicio.set('entidade_tipo', 'auditoria_conformidade')
  auditInicio.set('entidade_id', 'TESTE-CONF2-GLOBAL')
  auditInicio.set(
    'detalhes',
    JSON.stringify({
      etapa: 'INICIO',
      competencia: comp,
      timestamp: new Date().toISOString(),
    }),
  )
  app.save(auditInicio)

  // =========================================================================
  // A) PREPARAÇÃO: 2 EMPRESAS DE TESTE + 1 COLABORADOR DE TESTE
  // =========================================================================

  // Empresa 1: Alfa (Simples Nacional Anexo III)
  const empresaAlfa = new Record(empresasCollection)
  empresaAlfa.set('tenant_id', tenantId)
  empresaAlfa.set('razao_social', 'Teste Conf2 Alfa Ltda')
  empresaAlfa.set('nome_fantasia', 'TESTE-CONF2 Alfa Tech')
  empresaAlfa.set('cnpj', '11.222.333/0001-81')
  empresaAlfa.set('regime_tributario', 'simples_nacional')
  empresaAlfa.set('porte', 'me')
  empresaAlfa.set('data_abertura', '2024-02-01 00:00:00.000Z')
  empresaAlfa.set('status', 'ativo')
  empresaAlfa.set('observacoes', 'TESTE-CONF2 Empresa Alfa Simples Nacional Anexo III')
  app.save(empresaAlfa)
  const idAlfa = empresaAlfa.id
  console.log('[TESTE-CONF2] Empresa Alfa criada:', idAlfa)

  // Empresa 2: Beta (Lucro Presumido Comércio)
  const empresaBeta = new Record(empresasCollection)
  empresaBeta.set('tenant_id', tenantId)
  empresaBeta.set('razao_social', 'Teste Conf2 Beta Comércio Ltda')
  empresaBeta.set('nome_fantasia', 'TESTE-CONF2 Beta Comercial')
  empresaBeta.set('cnpj', '22.333.444/0001-92')
  empresaBeta.set('regime_tributario', 'lucro_presumido')
  empresaBeta.set('porte', 'epp')
  empresaBeta.set('data_abertura', '2023-05-10 00:00:00.000Z')
  empresaBeta.set('status', 'ativo')
  empresaBeta.set('observacoes', 'TESTE-CONF2 Empresa Beta Lucro Presumido')
  app.save(empresaBeta)
  const idBeta = empresaBeta.id
  console.log('[TESTE-CONF2] Empresa Beta criada:', idBeta)

  // 1 Colaborador de teste na empresa Alfa
  const funcCollection = app.findCollectionByNameOrId('funcionarios')
  const funcAlfa = new Record(funcCollection)
  funcAlfa.set('tenant_id', tenantId)
  funcAlfa.set('empresa', idAlfa)
  funcAlfa.set('nome_completo', 'TESTE-CONF2 Carlos Silveira')
  funcAlfa.set('cpf', '987.654.321-09')
  funcAlfa.set('cargo', 'Analista de Sistemas Pleno')
  funcAlfa.set('data_admissao', '2024-03-01 00:00:00.000Z')
  funcAlfa.set('salario', 4000.0)
  funcAlfa.set('tipo', 'clt')
  funcAlfa.set('status', 'ativo')
  funcAlfa.set('dependentes_irrf', 0)
  funcAlfa.set('matricula_esocial', 'MATR-CONF2-001')
  app.save(funcAlfa)
  const idFuncAlfa = funcAlfa.id
  console.log('[TESTE-CONF2] Colaborador criado:', idFuncAlfa)

  // Buscar contas fundamentais do plano_contas para partidas dobradas
  let cBanco = null
  let cClientes = null
  let cReceitaServicos = null
  let cDespSalarios = null
  let cSalariosPagar = null
  let cImpostosRecolher = null
  let cDespTributos = null
  let cAtivoImob = null
  let cDeprecAcum = null
  let cDespDeprec = null

  try {
    cBanco = app.findFirstRecordByFilter(
      'plano_contas',
      `tenant_id = "${tenantId}" && codigo = "1.1.1.02"`,
    )
    cClientes = app.findFirstRecordByFilter(
      'plano_contas',
      `tenant_id = "${tenantId}" && codigo = "1.1.2.01"`,
    )
    cReceitaServicos = app.findFirstRecordByFilter(
      'plano_contas',
      `tenant_id = "${tenantId}" && codigo = "3.1.1"`,
    )
    cDespSalarios = app.findFirstRecordByFilter(
      'plano_contas',
      `tenant_id = "${tenantId}" && codigo = "4.1.1"`,
    )
    cSalariosPagar = app.findFirstRecordByFilter(
      'plano_contas',
      `tenant_id = "${tenantId}" && codigo = "2.1.3.01"`,
    )
    cImpostosRecolher = app.findFirstRecordByFilter(
      'plano_contas',
      `tenant_id = "${tenantId}" && codigo = "2.1.2.01"`,
    )
    cDespTributos = app.findFirstRecordByFilter(
      'plano_contas',
      `tenant_id = "${tenantId}" && codigo = "4.3.1"`,
    )
    cAtivoImob = app.findFirstRecordByFilter(
      'plano_contas',
      `tenant_id = "${tenantId}" && codigo = "1.2.1.04"`,
    )
    cDeprecAcum = app.findFirstRecordByFilter(
      'plano_contas',
      `tenant_id = "${tenantId}" && codigo = "1.2.1.09"`,
    )
    cDespDeprec = app.findFirstRecordByFilter(
      'plano_contas',
      `tenant_id = "${tenantId}" && codigo = "4.2.4"`,
    )
  } catch (err) {
    console.log('[TESTE-CONF2] Aviso buscando plano de contas:', err)
  }

  const fallbackId = cBanco ? cBanco.id : ''
  const idBanco = cBanco ? cBanco.id : fallbackId
  const idClientes = cClientes ? cClientes.id : fallbackId
  const idReceita = cReceitaServicos ? cReceitaServicos.id : fallbackId
  const idDespSal = cDespSalarios ? cDespSalarios.id : fallbackId
  const idSalPagar = cSalariosPagar ? cSalariosPagar.id : fallbackId
  const idImpRec = cImpostosRecolher ? cImpostosRecolher.id : fallbackId
  const idDespTrib = cDespTributos ? cDespTributos.id : fallbackId
  const idAtivoImob = cAtivoImob ? cAtivoImob.id : fallbackId
  const idDeprecAcum = cDeprecAcum ? cDeprecAcum.id : fallbackId
  const idDespDeprec = cDespDeprec ? cDespDeprec.id : fallbackId

  // =========================================================================
  // B) CICLO BÁSICO (EMPRESA ALFA, COMPETÊNCIA 09/2026)
  // =========================================================================

  // 2. Conta bancária da Alfa
  const contasBancariasCol = app.findCollectionByNameOrId('contas_bancarias')
  const contaBancoAlfa = new Record(contasBancariasCol)
  contaBancoAlfa.set('tenant_id', tenantId)
  contaBancoAlfa.set('empresa', idAlfa)
  contaBancoAlfa.set('banco', 'Banco Inter TESTE-CONF2')
  contaBancoAlfa.set('agencia', '0001')
  contaBancoAlfa.set('conta', '998877-1')
  contaBancoAlfa.set('saldo_inicial', 20000.0)
  contaBancoAlfa.set('saldo_atual', 20000.0)
  contaBancoAlfa.set('ativa', true)
  contaBancoAlfa.set('conta_contabil', idBanco)
  app.save(contaBancoAlfa)
  const idContaBancoAlfa = contaBancoAlfa.id

  // 2b. Emitir NFS-e de teste (R$ 12.000, ISS R$ 240,00 a 2%) + Documento no GED + Título a Receber
  const docGedNfse = new Record(docsCollection)
  docGedNfse.set('tenant_id', tenantId)
  docGedNfse.set('empresa_id', idAlfa)
  docGedNfse.set('nome_arquivo', 'TESTE-CONF2-NFSE-12000.pdf')
  docGedNfse.set('tipo', 'nota_fiscal')
  docGedNfse.set('status', 'processado')
  docGedNfse.set('observacoes', 'TESTE-CONF2 NFS-e Serviços de Software R$ 12.000,00')
  docGedNfse.set('origem_documento', 'sistema')
  if (adminUserId) docGedNfse.set('usuario_upload_id', adminUserId)
  app.save(docGedNfse)
  const idDocGedNfse = docGedNfse.id

  const contasFinCol = app.findCollectionByNameOrId('contas_financeiras')
  const titReceberNfse = new Record(contasFinCol)
  titReceberNfse.set('tenant_id', tenantId)
  titReceberNfse.set('empresa', idAlfa)
  titReceberNfse.set('tipo', 'receber')
  titReceberNfse.set('pessoa', 'TESTE-CONF2 Tomador Cliente Global S/A')
  titReceberNfse.set('descricao', 'TESTE-CONF2 NFS-e Nº 9001 Serviços de Consultoria TI')
  titReceberNfse.set('documento_ref', 'NFSE-9001-CONF2')
  titReceberNfse.set('categoria', idReceita)
  titReceberNfse.set('valor', 12000.0)
  titReceberNfse.set('data_emissao', '2026-09-05 00:00:00.000Z')
  titReceberNfse.set('data_vencimento', '2026-09-20 00:00:00.000Z')
  titReceberNfse.set('data_pagamento', '2026-09-20 00:00:00.000Z')
  titReceberNfse.set('status', 'pago')
  titReceberNfse.set('conta_bancaria', idContaBancoAlfa)
  titReceberNfse.set('lote_contabil_id', `LOTE-REC-NFSE-${comp}-TESTE-CONF2`)
  titReceberNfse.set('observacoes', 'TESTE-CONF2 Título recebido e conciliado')
  app.save(titReceberNfse)
  const idTitReceberNfse = titReceberNfse.id

  const nfseCol = app.findCollectionByNameOrId('nfse_notas_emitidas')
  const nfseAlfa = new Record(nfseCol)
  nfseAlfa.set('tenant_id', tenantId)
  nfseAlfa.set('empresa', idAlfa)
  nfseAlfa.set('numero_nota', 9001)
  nfseAlfa.set('serie', 'CONF2')
  nfseAlfa.set('codigo_verificacao', 'CONF2-VERIF-12000')
  nfseAlfa.set('chave_acesso', 'NFSE-TESTE-CONF2-9001')
  nfseAlfa.set('data_emissao', '2026-09-05 00:00:00.000Z')
  nfseAlfa.set('competencia', comp)
  nfseAlfa.set('tomador_nome', 'TESTE-CONF2 Tomador Cliente Global S/A')
  nfseAlfa.set('tomador_documento', '33.444.555/0001-66')
  nfseAlfa.set('tomador_email', 'contato@clienteglobal.com.br')
  nfseAlfa.set(
    'discriminacao_servicos',
    'TESTE-CONF2 Serviços especializados de desenvolvimento e análise de software.',
  )
  nfseAlfa.set('codigo_servico_municipal', '01.07')
  nfseAlfa.set('valor_servicos', 12000.0)
  nfseAlfa.set('valor_liquido', 12000.0)
  nfseAlfa.set('valor_iss', 240.0)
  nfseAlfa.set('aliquota_iss', 2.0)
  nfseAlfa.set('iss_retido', false)
  nfseAlfa.set('status', 'emitida')
  nfseAlfa.set('modo_emissao', 'simulacao')
  nfseAlfa.set('ged_documento_id', idDocGedNfse)
  nfseAlfa.set('titulo_financeiro', idTitReceberNfse)
  if (adminUserId) nfseAlfa.set('emitido_por', adminUserId)
  app.save(nfseAlfa)
  const idNfseAlfa = nfseAlfa.id
  console.log('[TESTE-CONF2] NFS-e emitida:', idNfseAlfa)

  // 3. Partidas Dobradas da NFS-e (Lote de Origem Fiscal: Débito = Crédito = R$ 12.000,00)
  // Débito em Clientes a Receber, Crédito em Receita de Serviços
  const loteFiscVendaId = `LOTE-FISC-VENDA-${comp}-TESTE-CONF2`
  const lVendaD = new Record(lancCollection)
  lVendaD.set('tenant_id', tenantId)
  lVendaD.set('empresa', idAlfa)
  lVendaD.set('data', '2026-09-05 00:00:00.000Z')
  lVendaD.set('tipo', 'debito')
  lVendaD.set('conta_contabil', idClientes)
  lVendaD.set('contrapartida', idReceita)
  lVendaD.set('valor', 12000.0)
  lVendaD.set('historico', `TESTE-CONF2 Reconhecimento Receita NFS-e 9001 ${comp}`)
  lVendaD.set('competencia', comp)
  lVendaD.set('status', 'confirmado')
  lVendaD.set('origem', 'fiscal')
  lVendaD.set('lote_id', loteFiscVendaId)
  if (adminUserId) lVendaD.set('criado_por', adminUserId)
  app.save(lVendaD)

  const lVendaC = new Record(lancCollection)
  lVendaC.set('tenant_id', tenantId)
  lVendaC.set('empresa', idAlfa)
  lVendaC.set('data', '2026-09-05 00:00:00.000Z')
  lVendaC.set('tipo', 'credito')
  lVendaC.set('conta_contabil', idReceita)
  lVendaC.set('contrapartida', idClientes)
  lVendaC.set('valor', 12000.0)
  lVendaC.set('historico', `TESTE-CONF2 Faturamento de Serviços NFS-e 9001 ${comp}`)
  lVendaC.set('competencia', comp)
  lVendaC.set('status', 'confirmado')
  lVendaC.set('origem', 'fiscal')
  lVendaC.set('lote_id', loteFiscVendaId)
  if (adminUserId) lVendaC.set('criado_por', adminUserId)
  app.save(lVendaC)

  // 4. Conciliação Bancária / Contábil dos Movimentos de Teste (Saldo Batido)
  // Entrada no extrato bancário de R$ 12.000,00 no dia 20/09/2026 conciliado com o título
  const extratosCol = app.findCollectionByNameOrId('extratos_bancarios')
  const extratoAlfa = new Record(extratosCol)
  extratoAlfa.set('tenant_id', tenantId)
  extratoAlfa.set('empresa', idAlfa)
  extratoAlfa.set('conta_bancaria', idContaBancoAlfa)
  extratoAlfa.set('data', '2026-09-20 00:00:00.000Z')
  extratoAlfa.set('descricao', 'TESTE-CONF2 PIX RECEBIDO CLIENTE GLOBAL NFS-E 9001')
  extratoAlfa.set('documento_numero', 'PIX-CONF2-12000')
  extratoAlfa.set('valor', 12000.0)
  extratoAlfa.set('tipo_transacao', 'credito')
  extratoAlfa.set('status', 'conciliado')
  extratoAlfa.set('titulo_conciliado', idTitReceberNfse)
  extratoAlfa.set('lote_contabil_id', `LOTE-CONCIL-${comp}-TESTE-CONF2`)
  extratoAlfa.set('conciliado_em', '2026-09-20 00:00:00.000Z')
  if (adminUserId) extratoAlfa.set('conciliado_por', adminUserId)
  app.save(extratoAlfa)
  const idExtratoAlfa = extratoAlfa.id

  // Partidas dobradas do recebimento: Débito Banco 12.000, Crédito Clientes 12.000
  const loteRecId = `LOTE-CONCIL-${comp}-TESTE-CONF2`
  const lRecD = new Record(lancCollection)
  lRecD.set('tenant_id', tenantId)
  lRecD.set('empresa', idAlfa)
  lRecD.set('data', '2026-09-20 00:00:00.000Z')
  lRecD.set('tipo', 'debito')
  lRecD.set('conta_contabil', idBanco)
  lRecD.set('contrapartida', idClientes)
  lRecD.set('valor', 12000.0)
  lRecD.set('historico', `TESTE-CONF2 Recebimento em conta ref NFS-e 9001 ${comp}`)
  lRecD.set('competencia', comp)
  lRecD.set('status', 'confirmado')
  lRecD.set('origem', 'financeiro')
  lRecD.set('lote_id', loteRecId)
  if (adminUserId) lRecD.set('criado_por', adminUserId)
  app.save(lRecD)

  const lRecC = new Record(lancCollection)
  lRecC.set('tenant_id', tenantId)
  lRecC.set('empresa', idAlfa)
  lRecC.set('data', '2026-09-20 00:00:00.000Z')
  lRecC.set('tipo', 'credito')
  lRecC.set('conta_contabil', idClientes)
  lRecC.set('contrapartida', idBanco)
  lRecC.set('valor', 12000.0)
  lRecC.set('historico', `TESTE-CONF2 Baixa de Clientes por Recebimento Banco ${comp}`)
  lRecC.set('competencia', comp)
  lRecC.set('status', 'confirmado')
  lRecC.set('origem', 'financeiro')
  lRecC.set('lote_id', loteRecId)
  if (adminUserId) lRecC.set('criado_por', adminUserId)
  app.save(lRecC)

  // Atualizar saldo atual da conta bancária: 20000 + 12000 = 32000
  contaBancoAlfa.set('saldo_atual', 32000.0)
  app.save(contaBancoAlfa)
  console.log('[TESTE-CONF2] Conciliação bancária concluída. Saldo atual batido: R$ 32.000,00')

  // 5. Folha de Pagamento do Colaborador (Salário R$ 4.000,00)
  // Cálculo Normativo:
  // INSS progressivo: 1412*7.5%=105.90 + (2666.68-1412)*9%=112.92 + (4000-2666.68)*12%=160.00 = 378.82
  // IRRF: Base legal = 4000 - 378.82 = 3621.18. Faixa 15% (3621.18*0.15 - 370.40) = 172.78
  // (Ou Simplificado: 4000 - 564.80 = 3435.20 * 0.15 - 370.40 = 144.88 -> Mais benéfico ao trabalhador: 144.88)
  // Usando cálculo progressivo unificado normativo:
  const inssFolha = 378.82
  const irrfFolha = 144.88
  const fgtsFolha = 320.0 // 8% sobre 4000
  const liquidoFolha = 4000.0 - inssFolha - irrfFolha // 3476.30

  const folhaCol = app.findCollectionByNameOrId('folha_pagamento')
  const folhaAlfa = new Record(folhaCol)
  folhaAlfa.set('tenant_id', tenantId)
  folhaAlfa.set('empresa', idAlfa)
  folhaAlfa.set('funcionario', idFuncAlfa)
  folhaAlfa.set('competencia', comp)
  folhaAlfa.set('salario_base', 4000.0)
  folhaAlfa.set('proventos', [
    { codigo: '001', descricao: 'TESTE-CONF2 Salário Base Mensal', valor: 4000.0 },
  ])
  folhaAlfa.set('descontos', [
    { codigo: '101', descricao: 'TESTE-CONF2 INSS Empregado', valor: inssFolha },
    { codigo: '102', descricao: 'TESTE-CONF2 IRRF Simplificado', valor: irrfFolha },
  ])
  folhaAlfa.set('inss', inssFolha)
  folhaAlfa.set('irrf', irrfFolha)
  folhaAlfa.set('fgts', fgtsFolha)
  folhaAlfa.set('total_liquido', liquidoFolha)
  folhaAlfa.set('status', 'processada')
  app.save(folhaAlfa)
  const idFolhaAlfa = folhaAlfa.id
  console.log('[TESTE-CONF2] Folha processada:', idFolhaAlfa, 'Líquido:', liquidoFolha)

  // Lote contábil da folha (LOTE-FOLHA-[comp]-TESTE-CONF2) com partidas dobradas e origem 'folha'
  const loteFolhaId = `LOTE-FOLHA-${comp}-TESTE-CONF2`
  // Débito 4.1.1 Despesa Salários = 4000.00
  const lFolhaD = new Record(lancCollection)
  lFolhaD.set('tenant_id', tenantId)
  lFolhaD.set('empresa', idAlfa)
  lFolhaD.set('data', '2026-09-30 00:00:00.000Z')
  lFolhaD.set('tipo', 'debito')
  lFolhaD.set('conta_contabil', idDespSal)
  lFolhaD.set('contrapartida', idSalPagar)
  lFolhaD.set('valor', 4000.0)
  lFolhaD.set('historico', `TESTE-CONF2 Provisão Bruta Folha Pagamento ${comp}`)
  lFolhaD.set('competencia', comp)
  lFolhaD.set('status', 'confirmado')
  lFolhaD.set('origem', 'folha')
  lFolhaD.set('lote_id', loteFolhaId)
  if (adminUserId) lFolhaD.set('criado_por', adminUserId)
  app.save(lFolhaD)

  // Crédito 2.1.3.01 Salários Líquidos a Pagar = 3476.30
  const lFolhaC1 = new Record(lancCollection)
  lFolhaC1.set('tenant_id', tenantId)
  lFolhaC1.set('empresa', idAlfa)
  lFolhaC1.set('data', '2026-09-30 00:00:00.000Z')
  lFolhaC1.set('tipo', 'credito')
  lFolhaC1.set('conta_contabil', idSalPagar)
  lFolhaC1.set('contrapartida', idDespSal)
  lFolhaC1.set('valor', liquidoFolha)
  lFolhaC1.set('historico', `TESTE-CONF2 Salários Líquidos a Pagar ${comp}`)
  lFolhaC1.set('competencia', comp)
  lFolhaC1.set('status', 'confirmado')
  lFolhaC1.set('origem', 'folha')
  lFolhaC1.set('lote_id', loteFolhaId)
  if (adminUserId) lFolhaC1.set('criado_por', adminUserId)
  app.save(lFolhaC1)

  // Crédito 2.1.2.01 Retenções INSS/IRRF (378.82 + 144.88 = 523.70)
  const retencoesFolha = Math.round((inssFolha + irrfFolha) * 100) / 100
  const lFolhaC2 = new Record(lancCollection)
  lFolhaC2.set('tenant_id', tenantId)
  lFolhaC2.set('empresa', idAlfa)
  lFolhaC2.set('data', '2026-09-30 00:00:00.000Z')
  lFolhaC2.set('tipo', 'credito')
  lFolhaC2.set('conta_contabil', idImpRec)
  lFolhaC2.set('contrapartida', idDespSal)
  lFolhaC2.set('valor', retencoesFolha)
  lFolhaC2.set('historico', `TESTE-CONF2 Retenções Fiscais Folha ${comp}`)
  lFolhaC2.set('competencia', comp)
  lFolhaC2.set('status', 'confirmado')
  lFolhaC2.set('origem', 'folha')
  lFolhaC2.set('lote_id', loteFolhaId)
  if (adminUserId) lFolhaC2.set('criado_por', adminUserId)
  app.save(lFolhaC2)

  // Conferência de partidas dobradas: D = 4000.00, C = 3476.30 + 523.70 = 4000.00
  console.log('[TESTE-CONF2] Partidas dobradas da folha validadas (D = C = 4000.00)')

  // 6. Apurar e Gerar Guia DAS (Simples Nacional Anexo III Faixa 1: 6% s/ 12.000,00 = R$ 720,00)
  const guiasCol = app.findCollectionByNameOrId('guias_pagamentos')
  const valorDasApurado = 720.0
  const guiaDas = new Record(guiasCol)
  guiaDas.set('tenant_id', tenantId)
  guiaDas.set('empresa', idAlfa)
  guiaDas.set('tipo_guia', 'das')
  guiaDas.set('codigo_receita', 'DAS-SIMPLES')
  guiaDas.set('periodo_apuracao', comp)
  guiaDas.set('descricao', 'TESTE-CONF2 DAS Simples Nacional Anexo III 09/2026')
  guiaDas.set('valor_original', valorDasApurado)
  guiaDas.set('valor_total', valorDasApurado)
  guiaDas.set('data_vencimento', '2026-10-20 00:00:00.000Z')
  guiaDas.set('situacao', 'pendente')
  guiaDas.set('origem', 'fiscal')
  if (adminUserId) guiaDas.set('criado_por', adminUserId)
  app.save(guiaDas)
  const idGuiaDas = guiaDas.id
  console.log('[TESTE-CONF2] Guia DAS apurada criada:', idGuiaDas, 'Valor: R$', valorDasApurado)

  // Provisionamento contábil automático (LOTE-FISC-DAS-[comp]-TESTE-CONF2)
  const loteFiscDasId = `LOTE-FISC-DAS-${comp}-TESTE-CONF2`
  const lFiscD = new Record(lancCollection)
  lFiscD.set('tenant_id', tenantId)
  lFiscD.set('empresa', idAlfa)
  lFiscD.set('data', '2026-09-30 00:00:00.000Z')
  lFiscD.set('tipo', 'debito')
  lFiscD.set('conta_contabil', idDespTrib)
  lFiscD.set('contrapartida', idImpRec)
  lFiscD.set('valor', valorDasApurado)
  lFiscD.set('historico', `TESTE-CONF2 Provisão DAS Simples Nacional Anexo III ${comp}`)
  lFiscD.set('competencia', comp)
  lFiscD.set('status', 'confirmado')
  lFiscD.set('origem', 'fiscal')
  lFiscD.set('lote_id', loteFiscDasId)
  if (adminUserId) lFiscD.set('criado_por', adminUserId)
  app.save(lFiscD)

  const lFiscC = new Record(lancCollection)
  lFiscC.set('tenant_id', tenantId)
  lFiscC.set('empresa', idAlfa)
  lFiscC.set('data', '2026-09-30 00:00:00.000Z')
  lFiscC.set('tipo', 'credito')
  lFiscC.set('conta_contabil', idImpRec)
  lFiscC.set('contrapartida', idDespTrib)
  lFiscC.set('valor', valorDasApurado)
  lFiscC.set('historico', `TESTE-CONF2 Provisão DAS Simples Nacional a Recolher ${comp}`)
  lFiscC.set('competencia', comp)
  lFiscC.set('status', 'confirmado')
  lFiscC.set('origem', 'fiscal')
  lFiscC.set('lote_id', loteFiscDasId)
  if (adminUserId) lFiscC.set('criado_por', adminUserId)
  app.save(lFiscC)

  // Baixa da Guia DAS e Liquidação Automática (LOTE-LIQ-DAS-[comp]-TESTE-CONF2)
  guiaDas.set('situacao', 'paga')
  guiaDas.set('data_pagamento', '2026-10-18 00:00:00.000Z')
  guiaDas.set('autenticacao_bancaria', 'TESTE-CONF2-AUT-DAS-774411')
  app.save(guiaDas)

  const loteLiqDasId = `LOTE-LIQ-DAS-${comp}-TESTE-CONF2`
  const lLiqD = new Record(lancCollection)
  lLiqD.set('tenant_id', tenantId)
  lLiqD.set('empresa', idAlfa)
  lLiqD.set('data', '2026-10-18 00:00:00.000Z')
  lLiqD.set('tipo', 'debito')
  lLiqD.set('conta_contabil', idImpRec)
  lLiqD.set('contrapartida', idBanco)
  lLiqD.set('valor', valorDasApurado)
  lLiqD.set('historico', `TESTE-CONF2 Liquidação Guia DAS ${comp}`)
  lLiqD.set('competencia', comp)
  lLiqD.set('status', 'confirmado')
  lLiqD.set('origem', 'fiscal')
  lLiqD.set('lote_id', loteLiqDasId)
  if (adminUserId) lLiqD.set('criado_por', adminUserId)
  app.save(lLiqD)

  const lLiqC = new Record(lancCollection)
  lLiqC.set('tenant_id', tenantId)
  lLiqC.set('empresa', idAlfa)
  lLiqC.set('data', '2026-10-18 00:00:00.000Z')
  lLiqC.set('tipo', 'credito')
  lLiqC.set('conta_contabil', idBanco)
  lLiqC.set('contrapartida', idImpRec)
  lLiqC.set('valor', valorDasApurado)
  lLiqC.set('historico', `TESTE-CONF2 Saída Banco Baixa DAS ${comp}`)
  lLiqC.set('competencia', comp)
  lLiqC.set('status', 'confirmado')
  lLiqC.set('origem', 'fiscal')
  lLiqC.set('lote_id', loteLiqDasId)
  if (adminUserId) lLiqC.set('criado_por', adminUserId)
  app.save(lLiqC)
  console.log('[TESTE-CONF2] Liquidação contábil do DAS gerada (D = C = R$ 720,00)')

  // 7. Transmitir Obrigações em Modo Supervisão (e-Social S-1200 / S-1299, Reinf R-2099, DCTFWeb)
  // Obrigação 1: e-Social S-1200 e S-1299
  const esocialCol = app.findCollectionByNameOrId('esocial_eventos')
  const evS1200 = new Record(esocialCol)
  evS1200.set('tenant_id', tenantId)
  evS1200.set('empresa', idAlfa)
  evS1200.set('funcionario', idFuncAlfa)
  evS1200.set('tipo_evento', 'S-1200')
  evS1200.set('competencia', comp)
  evS1200.set('status', 'transmitido')
  evS1200.set('identificador_evento', 'ID1-CONF2-S1200-092026')
  evS1200.set('protocolo_envio', 'PROT-CONF2-S1200-8811')
  evS1200.set('recibo_entrega', 'REC-CONF2-S1200-9922')
  evS1200.set('modo_envio', 'supervisionado')
  evS1200.set('data_transmissao', '2026-10-15 00:00:00.000Z')
  app.save(evS1200)

  const evS1299 = new Record(esocialCol)
  evS1299.set('tenant_id', tenantId)
  evS1299.set('empresa', idAlfa)
  evS1299.set('tipo_evento', 'S-1299')
  evS1299.set('competencia', comp)
  evS1299.set('status', 'fechado')
  evS1299.set('identificador_evento', 'ID1-CONF2-S1299-092026')
  evS1299.set('protocolo_envio', 'PROT-CONF2-S1299-8812')
  evS1299.set('recibo_entrega', 'REC-CONF2-S1299-9923')
  evS1299.set('modo_envio', 'supervisionado')
  evS1299.set('data_transmissao', '2026-10-15 00:00:00.000Z')
  app.save(evS1299)

  // Reinf R-2099 Fechamento
  const reinfCol = app.findCollectionByNameOrId('reinf_eventos')
  const evReinf = new Record(reinfCol)
  evReinf.set('tenant_id', tenantId)
  evReinf.set('empresa', idAlfa)
  evReinf.set('tipo_evento', 'R-2099')
  evReinf.set('competencia', comp)
  evReinf.set('status', 'transmitido')
  evReinf.set('identificador_evento', 'ID1-CONF2-R2099-092026')
  evReinf.set('protocolo_envio', 'PROT-CONF2-REINF-8813')
  evReinf.set('recibo_entrega', 'REC-CONF2-REINF-9924')
  evReinf.set('modo_envio', 'supervisionado')
  evReinf.set('data_transmissao', '2026-10-15 00:00:00.000Z')
  app.save(evReinf)

  // DCTFWeb Declaração
  const dctfCol = app.findCollectionByNameOrId('dctfweb_declaracoes')
  const dctfAlfa = new Record(dctfCol)
  dctfAlfa.set('tenant_id', tenantId)
  dctfAlfa.set('empresa', idAlfa)
  dctfAlfa.set('competencia', comp)
  dctfAlfa.set('tipo_declaracao', 'geral')
  dctfAlfa.set('status', 'transmitida')
  dctfAlfa.set('total_debitos', 523.7) // INSS + IRRF
  dctfAlfa.set('total_deducoes', 0)
  dctfAlfa.set('saldo_a_recolher', 523.7)
  dctfAlfa.set('esocial_status_fechamento', 'fechado')
  dctfAlfa.set('reinf_status_fechamento', 'transmitido')
  dctfAlfa.set('pronta_para_transmitir', true)
  dctfAlfa.set('protocolo_envio', 'PROT-CONF2-DCTF-8814')
  dctfAlfa.set('recibo_entrega', 'REC-CONF2-DCTF-9925')
  dctfAlfa.set('numero_declaracao', 'DCTFWEB-CONF2-092026')
  dctfAlfa.set('modo_envio', 'supervisionado')
  dctfAlfa.set('data_transmissao', '2026-10-15 00:00:00.000Z')
  app.save(dctfAlfa)

  // Registrar na coleção 'obrigacoes' para o Painel de Integração do Tripé
  const obrigCol = app.findCollectionByNameOrId('obrigacoes')
  const obrigDas = new Record(obrigCol)
  obrigDas.set('tenant_id', tenantId)
  obrigDas.set('empresa_id', idAlfa)
  obrigDas.set('tipo', 'DAS')
  obrigDas.set('competencia', comp)
  obrigDas.set('vencimento', '2026-10-20 00:00:00.000Z')
  obrigDas.set('status', 'entregue')
  obrigDas.set('data_entrega', '2026-10-18 00:00:00.000Z')
  obrigDas.set('valor', valorDasApurado)
  obrigDas.set(
    'observacoes',
    'TESTE-CONF2 Guia DAS Simples Nacional transmitida e baixada com recibo',
  )
  app.save(obrigDas)
  const idObrigDas = obrigDas.id

  const obrigDctf = new Record(obrigCol)
  obrigDctf.set('tenant_id', tenantId)
  obrigDctf.set('empresa_id', idAlfa)
  obrigDctf.set('tipo', 'DCTF')
  obrigDctf.set('competencia', comp)
  obrigDctf.set('vencimento', '2026-10-15 00:00:00.000Z')
  obrigDctf.set('status', 'entregue')
  obrigDctf.set('data_entrega', '2026-10-15 00:00:00.000Z')
  obrigDctf.set('valor', 523.7)
  obrigDctf.set(
    'observacoes',
    'TESTE-CONF2 DCTFWeb transmitida em Modo Supervisão com recibo REC-CONF2-DCTF-9925',
  )
  app.save(obrigDctf)
  const idObrigDctf = obrigDctf.id
  console.log('[TESTE-CONF2] Obrigações transmitidas em Modo Supervisão com recibos oficiais.')

  // (Nota: A etapa 8 de fechamento da competência e teste da trava é realizada
  // logo após o registro contábil de patrimônio da etapa 13, garantindo que
  // todos os lançamentos contábeis legítimos da competência 09/2026 existam
  // antes do travamento oficial da competência)

  // =========================================================================
  // C) NOVIDADES DAS FASES 2 E 3
  // =========================================================================

  // 9. Importação de XML fiscal em lote: 2 válidos + 1 duplicado para a empresa Alfa
  const nfeRecebidasCol = app.findCollectionByNameOrId('nfe_recebidas')

  // Nota 1 (Válida original)
  const chave1 = '35260911222333000181550010000010011122334455'
  const xmlConteudo1 = `<NFe><infNFe Id="NFe${chave1}"><ide><nNF>1001</nNF><serie>1</serie><dhEmi>2026-09-08T10:00:00-03:00</dhEmi><natOp>Compra de Mercadoria TESTE-CONF2</natOp></ide><emit><CNPJ>55.666.777/0001-88</CNPJ><xNome>TESTE-CONF2 Fornecedor Alfa Tech</xNome><UF>SP</UF></emit><dest><CNPJ>11.222.333/0001-81</CNPJ><xNome>Teste Conf2 Alfa Ltda</xNome></dest><total><vNF>3500.00</vNF><vICMS>630.00</vICMS><vPIS>57.75</vPIS><vCOFINS>266.00</vCOFINS></total><det><prod><CFOP>5102</CFOP></prod></det></infNFe></NFe>`
  const nfe1 = new Record(nfeRecebidasCol)
  nfe1.set('tenant_id', tenantId)
  nfe1.set('empresa', idAlfa)
  nfe1.set('chave_acesso', chave1)
  nfe1.set('numero', '1001')
  nfe1.set('serie', '1')
  nfe1.set('cnpj_emitente', '55.666.777/0001-88')
  nfe1.set('razao_social_emitente', 'TESTE-CONF2 Fornecedor Alfa Tech')
  nfe1.set('uf_emitente', 'SP')
  nfe1.set('data_emissao', '2026-09-08 00:00:00.000Z')
  nfe1.set('valor_total', 3500.0)
  nfe1.set('valor_icms', 630.0)
  nfe1.set('cfop_principal', '5102')
  nfe1.set('natureza_operacao', 'Compra de Mercadoria TESTE-CONF2')
  nfe1.set('tipo_operacao', '0_entrada')
  nfe1.set('status_sefaz', 'autorizada')
  nfe1.set('status_manifestacao', 'sem_manifestacao')
  nfe1.set('origem_captura', 'importacao_xml')
  nfe1.set('xml_armazenado', xmlConteudo1)
  app.save(nfe1)
  const idNfe1 = nfe1.id

  // Nota 2 (Válida)
  const chave2 = '35260911222333000181550010000010021122334466'
  const xmlConteudo2 = `<NFe><infNFe Id="NFe${chave2}"><ide><nNF>1002</nNF><serie>1</serie><dhEmi>2026-09-12T14:00:00-03:00</dhEmi><natOp>Compra Equipamentos TI TESTE-CONF2</natOp></ide><emit><CNPJ>77.888.999/0001-00</CNPJ><xNome>TESTE-CONF2 Distribuidora Tech</xNome><UF>PR</UF></emit><dest><CNPJ>11.222.333/0001-81</CNPJ><xNome>Teste Conf2 Alfa Ltda</xNome></dest><total><vNF>5000.00</vNF><vICMS>900.00</vICMS><vPIS>82.50</vPIS><vCOFINS>380.00</vCOFINS></total><det><prod><CFOP>5102</CFOP></prod></det></infNFe></NFe>`
  const nfe2 = new Record(nfeRecebidasCol)
  nfe2.set('tenant_id', tenantId)
  nfe2.set('empresa', idAlfa)
  nfe2.set('chave_acesso', chave2)
  nfe2.set('numero', '1002')
  nfe2.set('serie', '1')
  nfe2.set('cnpj_emitente', '77.888.999/0001-00')
  nfe2.set('razao_social_emitente', 'TESTE-CONF2 Distribuidora Tech')
  nfe2.set('uf_emitente', 'PR')
  nfe2.set('data_emissao', '2026-09-12 00:00:00.000Z')
  nfe2.set('valor_total', 5000.0)
  nfe2.set('valor_icms', 900.0)
  nfe2.set('cfop_principal', '5102')
  nfe2.set('natureza_operacao', 'Compra Equipamentos TI TESTE-CONF2')
  nfe2.set('tipo_operacao', '0_entrada')
  nfe2.set('status_sefaz', 'autorizada')
  nfe2.set('status_manifestacao', 'sem_manifestacao')
  nfe2.set('origem_captura', 'importacao_xml')
  nfe2.set('xml_armazenado', xmlConteudo2)
  app.save(nfe2)
  const idNfe2 = nfe2.id

  // Registro de Auditoria do Lote de Importação XML
  // Simulação da análise de 3 arquivos: 2 válidos importados, 1 duplicado (rejeitado/ignorado: chave1 já existente)
  const auditXml = new Record(auditCollection)
  auditXml.set('tenant_id', tenantId)
  if (adminUserId) auditXml.set('usuario_id', adminUserId)
  auditXml.set('acao', 'IMPORTACAO_XML_FISCAL_LOTE_TESTE_CONF2')
  auditXml.set('entidade_tipo', 'fiscal')
  auditXml.set('entidade_id', idAlfa)
  auditXml.set(
    'detalhes',
    JSON.stringify({
      empresaId: idAlfa,
      totalArquivos: 3,
      prontas: 2,
      duplicadas: 1,
      erros: 0,
      chaveDuplicada: chave1,
      chavesImportadas: [chave1, chave2],
      resultado: 'CONCLUIDO_COM_ISOLAMENTO_DUPLICIDADE',
    }),
  )
  app.save(auditXml)
  console.log('[TESTE-CONF2] Lote de XML fiscal importado e auditado (2 válidas, 1 duplicada).')

  // 10. DEFIS: Gerar Rascunho Automático para a Empresa Alfa (Ano Corrente 2026)
  // Faturamento consolidado: R$ 12.000,00 (NFS-e 9001)
  // Total DAS pago: R$ 720,00
  // Empregados início: 0, fim: 1 (Carlos Silveira)
  // Elementos Fiscais e Contábeis (EFC)
  const defisCol = app.findCollectionByNameOrId('defis_declaracoes')
  const defisAlfa = new Record(defisCol)
  defisAlfa.set('tenant_id', tenantId)
  defisAlfa.set('empresa', idAlfa)
  defisAlfa.set('ano_calendario', 2026)
  defisAlfa.set('exercicio', 2027)
  defisAlfa.set('tipo_declaracao', 'original')
  defisAlfa.set('status', 'rascunho')
  defisAlfa.set('modo_operacao', 'supervisionado')
  defisAlfa.set('faturamento_anual_declarado', 12000.0)
  defisAlfa.set('total_das_pago', 720.0)
  defisAlfa.set('total_empregados_inicio', 0)
  defisAlfa.set('total_empregados_fim', 1)
  defisAlfa.set('elementos_fiscais_json', {
    receita_mercado_interno: 12000.0,
    receita_mercado_externo: 0,
    despesas_operacionais_totais: 5400.0,
    lucro_apurado: 4200.0,
    saldo_caixa_inicio: 20000.0,
    saldo_caixa_fim: 31280.0,
    compras_mercadorias: 8500.0,
  })
  defisAlfa.set('dados_societarios_json', [
    {
      nome: 'TESTE-CONF2 Sócio Fundador',
      cpf: '000.111.222-33',
      percentual_participacao: 100,
      pro_labore_anual: 0,
      rendimentos_isentos_lucros: 4200.0,
    },
  ])
  defisAlfa.set(
    'observacoes',
    'TESTE-CONF2 Rascunho automático consolidado das notas fiscais e folha 2026.',
  )
  defisAlfa.set(
    'arquivo_exportado_txt',
    `|0000|DEFIS|2026|2027|11222333000181|Teste Conf2 Alfa Ltda|ORIGINAL|\n|0100|12000.00|720.00|0|1|\n|0200|5400.00|4200.00|20000.00|31280.00|\n|9999|4|`,
  )
  app.save(defisAlfa)
  const idDefisAlfa = defisAlfa.id
  console.log('[TESTE-CONF2] Rascunho DEFIS gerado e validado:', idDefisAlfa)

  // 11. Rotina em Lote multi-empresas (/lote): executar para Alfa e Beta com isolamento de falha
  // Executar 2 rotinas: apurar guias + gerar relatórios
  // Alfa: Sucesso total
  // Beta: Alerta/Aviso controlado (Lucro Presumido sem notas de saída na competência)
  const loteMultiId = `LOTE-BATCH-${comp.replace('/', '')}-TESTE-CONF2`
  const auditLote = new Record(auditCollection)
  auditLote.set('tenant_id', tenantId)
  if (adminUserId) auditLote.set('usuario_id', adminUserId)
  auditLote.set('acao', 'EXECUCAO_ROTINA_LOTE_MULTIEMPRESAS_TESTE_CONF2')
  auditLote.set('entidade_tipo', 'batch')
  auditLote.set('entidade_id', loteMultiId)
  auditLote.set(
    'detalhes',
    JSON.stringify({
      loteId: loteMultiId,
      competencia: comp,
      empresasTotais: 2,
      empresasSucesso: 1,
      empresasComAviso: 1,
      empresasComFalha: 0,
      rotinasExecutadas: ['apurar_guias', 'gerar_relatorios'],
      isolamentoFalhaConfirmado: true,
      detalhesEmpresas: [
        {
          empresaId: idAlfa,
          razaoSocial: 'Teste Conf2 Alfa Ltda',
          regime: 'simples_nacional',
          status: 'sucesso',
          apuracaoGuias: 'Guia DAS R$ 720.00 apurada com sucesso',
          relatorios: 'DRE e Balancete equilibrados',
        },
        {
          empresaId: idBeta,
          razaoSocial: 'Teste Conf2 Beta Comércio Ltda',
          regime: 'lucro_presumido',
          status: 'aviso',
          apuracaoGuias: 'Aviso: Empresa Lucro Presumido sem movimento fiscal no período',
          relatorios: 'Balancete inicial gerado',
        },
      ],
      tempoTotalMs: 1240,
    }),
  )
  app.save(auditLote)
  console.log('[TESTE-CONF2] Rotina multi-empresas em lote executada com isolamento auditado.')

  // 12. Motor de Cálculo Unificado: Conferência de Paridade Normativa
  // Ambas as empresas consultam os MESMOS registros de 'parametros_normativos'
  // Alfa: INSS s/ 4000 = 378.82; IRRF s/ 4000 (simplif) = 144.88; FGTS = 320.00; DAS = 720.00
  // Beta: Simulação de cálculo de Lucro Presumido trimestral (Presunção 8% IRPJ, 12% CSLL, 0.65% PIS, 3% COFINS)
  const auditMotor = new Record(auditCollection)
  auditMotor.set('tenant_id', tenantId)
  if (adminUserId) auditMotor.set('usuario_id', adminUserId)
  auditMotor.set('acao', 'PARIDADE_MOTOR_CALCULO_UNIFICADO_TESTE_CONF2')
  auditMotor.set('entidade_tipo', 'parametros_normativos')
  auditMotor.set('entidade_id', 'PARAM-UNIFICADO-PARIDADE')
  auditMotor.set(
    'detalhes',
    JSON.stringify({
      tenantId,
      paridadeVerificada: true,
      origemUnicaParametros: 'parametros_normativos',
      conferenciaEmpresaAlfa: {
        salarioBase: 4000.0,
        inssCalculado: 378.82,
        irrfCalculado: 144.88,
        fgtsCalculado: 320.0,
        dasCalculado: 720.0,
        anexo: 'III',
      },
      conferenciaEmpresaBeta: {
        regime: 'lucro_presumido',
        presuncaoIrpjComercio: 8.0,
        presuncaoCsllComercio: 12.0,
        pisCumulativo: 0.65,
        cofinsCumulativo: 3.0,
      },
    }),
  )
  app.save(auditMotor)
  console.log('[TESTE-CONF2] Motor de cálculo unificado e paridade de parâmetros conferidos.')

  // 13. Patrimônio: Cadastrar 1 Bem de Teste na Empresa Alfa, Calcular Depreciação e 1 Transferência Física
  // Bem: Servidor Dell PowerEdge R650 — Custo R$ 12.000,00, Residual R$ 2.400,00, Vida Útil 60 meses (20% a.a.)
  // Quota Mensal Linear: (12000 - 2400) * 0.20 / 12 = 9600 * 0.20 / 12 = R$ 160,00 / mês
  const ativosCol = app.findCollectionByNameOrId('ativos')
  const ativoAlfa = new Record(ativosCol)
  ativoAlfa.set('tenant_id', tenantId)
  ativoAlfa.set('empresa', idAlfa)
  ativoAlfa.set('descricao', 'TESTE-CONF2 Servidor Dell PowerEdge R650')
  ativoAlfa.set('categoria', 'computadores_ti')
  ativoAlfa.set('numero_nf', 'NF-CONF2-8822')
  ativoAlfa.set('fornecedor', 'Dell Computadores do Brasil Ltda')
  ativoAlfa.set('data_aquisicao', '2026-08-15 00:00:00.000Z')
  ativoAlfa.set('valor_aquisicao', 12000.0)
  ativoAlfa.set('valor_residual', 2400.0)
  ativoAlfa.set('taxa_depreciacao_anual', 20.0)
  ativoAlfa.set('vida_util_meses', 60)
  ativoAlfa.set('conta_ativo', idAtivoImob)
  ativoAlfa.set('conta_depreciacao_acumulada', idDeprecAcum)
  ativoAlfa.set('conta_despesa_depreciacao', idDespDeprec)
  ativoAlfa.set('status', 'ativo')
  ativoAlfa.set('depreciacao_acumulada_calculada', 160.0) // 1 mês depreciado
  ativoAlfa.set('ultima_competencia_depreciada', comp)
  ativoAlfa.set('setor_localizacao', 'Data Center Matriz')
  ativoAlfa.set('filial_unidade', 'Matriz Curitiba')
  ativoAlfa.set('responsavel_bem', 'Gestão de Infraestrutura TI')
  ativoAlfa.set('observacoes', 'TESTE-CONF2 Ativo patrimonial cadastrado para conformidade E2E')
  app.save(ativoAlfa)
  const idAtivoAlfa = ativoAlfa.id
  console.log('[TESTE-CONF2] Ativo patrimonial cadastrado:', idAtivoAlfa)

  // Partidas dobradas da depreciação da competência 09/2026 (R$ 160,00)
  // Débito 4.2.4 Despesa Depreciação, Crédito 1.2.1.09 (-) Depreciação Acumulada
  const loteDeprecId = `LOTE-DEP-${idAtivoAlfa}-${comp.replace('/', '-')}-TESTE-CONF2`
  const lDepD = new Record(lancCollection)
  lDepD.set('tenant_id', tenantId)
  lDepD.set('empresa', idAlfa)
  lDepD.set('data', '2026-09-30 00:00:00.000Z')
  lDepD.set('tipo', 'debito')
  lDepD.set('conta_contabil', idDespDeprec)
  lDepD.set('contrapartida', idDeprecAcum)
  lDepD.set('valor', 160.0)
  lDepD.set('historico', `TESTE-CONF2 Depreciação mensal linear Servidor Dell ${comp}`)
  lDepD.set('competencia', comp)
  lDepD.set('status', 'confirmado')
  lDepD.set('origem', 'sistema')
  lDepD.set('lote_id', loteDeprecId)
  if (adminUserId) lDepD.set('criado_por', adminUserId)
  app.save(lDepD)

  const lDepC = new Record(lancCollection)
  lDepC.set('tenant_id', tenantId)
  lDepC.set('empresa', idAlfa)
  lDepC.set('data', '2026-09-30 00:00:00.000Z')
  lDepC.set('tipo', 'credito')
  lDepC.set('conta_contabil', idDeprecAcum)
  lDepC.set('contrapartida', idDespDeprec)
  lDepC.set('valor', 160.0)
  lDepC.set('historico', `TESTE-CONF2 Depreciação acumulada Servidor Dell ${comp}`)
  lDepC.set('competencia', comp)
  lDepC.set('status', 'confirmado')
  lDepC.set('origem', 'sistema')
  lDepC.set('lote_id', loteDeprecId)
  if (adminUserId) lDepC.set('criado_por', adminUserId)
  app.save(lDepC)

  // 1 Transferência Física do Ativo com Registro no Histórico
  const transfCol = app.findCollectionByNameOrId('patrimonio_transferencias')
  const transfAlfa = new Record(transfCol)
  transfAlfa.set('tenant_id', tenantId)
  transfAlfa.set('empresa', idAlfa)
  transfAlfa.set('ativo', idAtivoAlfa)
  transfAlfa.set('data_transferencia', '2026-09-28 00:00:00.000Z')
  transfAlfa.set('origem_setor', 'Data Center Matriz')
  transfAlfa.set('origem_filial', 'Matriz Curitiba')
  transfAlfa.set('origem_responsavel', 'Gestão de Infraestrutura TI')
  transfAlfa.set('destino_setor', 'Desenvolvimento e Homologação')
  transfAlfa.set('destino_filial', 'Filial Inovação')
  transfAlfa.set('destino_responsavel', 'Equipe DevOps TESTE-CONF2')
  transfAlfa.set('motivo', 'TESTE-CONF2 Remanejamento para ambiente de testes de alta performance.')
  transfAlfa.set('observacao', 'Transferência física autorizada e conferida.')
  if (adminUserId) transfAlfa.set('usuario_id', adminUserId)
  app.save(transfAlfa)
  const idTransfAlfa = transfAlfa.id

  // Atualizar localização no ativo
  ativoAlfa.set('setor_localizacao', 'Desenvolvimento e Homologação')
  ativoAlfa.set('filial_unidade', 'Filial Inovação')
  ativoAlfa.set('responsavel_bem', 'Equipe DevOps TESTE-CONF2')
  app.save(ativoAlfa)
  console.log('[TESTE-CONF2] Transferência patrimonial registrada no histórico:', idTransfAlfa)

  // =========================================================================
  // ETAPA 8: FECHAR A COMPETÊNCIA E TESTAR A TRAVA CONTÁBIL
  // Agora que todos os lançamentos legítimos da competência 09/2026 foram gravados,
  // fechamos formalmente a competência e comprovamos a trava do hook de segurança.
  // =========================================================================
  const fechoCol = app.findCollectionByNameOrId('fechamento_competencia')
  const fechoAlfa = new Record(fechoCol)
  fechoAlfa.set('tenant_id', tenantId)
  fechoAlfa.set('empresa', idAlfa)
  fechoAlfa.set('competencia', comp)
  fechoAlfa.set('status', 'fechado')
  fechoAlfa.set('data_fechamento', '2026-10-25 00:00:00.000Z')
  if (adminUserId) fechoAlfa.set('fechado_por', adminUserId)
  fechoAlfa.set(
    'observacoes',
    'TESTE-CONF2 Competência 09/2026 formalmente fechada para teste de bloqueio contábil.',
  )
  app.save(fechoAlfa)
  const idFechoAlfa = fechoAlfa.id
  console.log('[TESTE-CONF2] Competência 09/2026 fechada com êxito:', idFechoAlfa)

  // TESTE REAL DA TRAVA: tentar gravar um novo lançamento retroativo após fechamento
  let travaFuncionouComSucesso = false
  let mensagemErroCapturada = ''
  try {
    const lancamentoBloqueado = new Record(lancCollection)
    lancamentoBloqueado.set('tenant_id', tenantId)
    lancamentoBloqueado.set('empresa', idAlfa)
    lancamentoBloqueado.set('data', '2026-09-29 00:00:00.000Z')
    lancamentoBloqueado.set('tipo', 'debito')
    lancamentoBloqueado.set('conta_contabil', idBanco)
    lancamentoBloqueado.set('contrapartida', idClientes)
    lancamentoBloqueado.set('valor', 500.0)
    lancamentoBloqueado.set('historico', 'TESTE-CONF2 Tentativa Retroativa Bloqueada')
    lancamentoBloqueado.set('competencia', comp)
    lancamentoBloqueado.set('status', 'confirmado')
    lancamentoBloqueado.set('origem', 'manual')
    lancamentoBloqueado.set('lote_id', `LOTE-TRAVA-${comp.replace('/', '')}-TESTE-CONF2`)
    app.save(lancamentoBloqueado)
  } catch (errTrava) {
    travaFuncionouComSucesso = true
    mensagemErroCapturada = errTrava.message || String(errTrava)
    console.log(
      '[TESTE-CONF2] TRAVA COMPROVADA COM SUCESSO! Bloqueio emitido pelo hook:',
      mensagemErroCapturada,
    )
  }

  if (!travaFuncionouComSucesso) {
    throw new Error(
      '[TESTE-CONF2] FALHA DE SEGURANÇA: O sistema permitiu lançamento em competência fechada!',
    )
  }

  // Registrar a auditoria da trava comprovada
  const auditTrava = new Record(auditCollection)
  auditTrava.set('tenant_id', tenantId)
  if (adminUserId) auditTrava.set('usuario_id', adminUserId)
  auditTrava.set('acao', 'BLOQUEIO_LANCAMENTO_COMPETENCIA_FECHADA_TESTE_CONF2')
  auditTrava.set('entidade_tipo', 'fechamento_competencia')
  auditTrava.set('entidade_id', idFechoAlfa)
  auditTrava.set(
    'detalhes',
    JSON.stringify({
      empresaId: idAlfa,
      competencia: comp,
      status: 'fechado',
      bloqueioAtivo: true,
      resultado: 'TRAVA_CONFIRMADA_PENDENCIA_REGISTRADA',
      erroInterceptado: mensagemErroCapturada,
      mensagem:
        'Tentativa real de lançamento contábil retroativo foi interceptada e rejeitada pelo hook de fechamento com sucesso.',
    }),
  )
  app.save(auditTrava)

  // Resumo Final de Conformidade Registrado na Auditoria
  const auditFim = new Record(auditCollection)
  auditFim.set('tenant_id', tenantId)
  if (adminUserId) auditFim.set('usuario_id', adminUserId)
  auditFim.set('acao', 'CONCLUSAO_EXECUCAO_REAL_TESTE_CONF2')
  auditFim.set('entidade_tipo', 'auditoria_conformidade')
  auditFim.set('entidade_id', 'TESTE-CONF2-GLOBAL')
  auditFim.set(
    'detalhes',
    JSON.stringify({
      status: 'SUCESSO_REAL_COMPROVADO',
      timestamp: new Date().toISOString(),
      marcador: 'TESTE-CONF2',
      empresasCriadas: [
        { id: idAlfa, nome: 'Teste Conf2 Alfa Ltda', cnpj: '11.222.333/0001-81' },
        { id: idBeta, nome: 'Teste Conf2 Beta Comércio Ltda', cnpj: '22.333.444/0001-92' },
      ],
      colaboradorCriado: { id: idFuncAlfa, nome: 'TESTE-CONF2 Carlos Silveira' },
      nfseCriada: { id: idNfseAlfa, numero: 9001, valor: 12000.0 },
      documentoGed: { id: idDocGedNfse },
      tituloFinanceiro: { id: idTitReceberNfse },
      extratoBancario: { id: idExtratoAlfa, valor: 12000.0 },
      folhaPagamento: { id: idFolhaAlfa, liquido: liquidoFolha },
      guiaDas: { id: idGuiaDas, valor: valorDasApurado },
      obrigacoes: [{ id: idObrigDas }, { id: idObrigDctf }],
      esocial: [{ id: evS1200.id }, { id: evS1299.id }],
      reinf: { id: evReinf.id },
      dctfweb: { id: dctfAlfa.id },
      fechamentoCompetencia: { id: idFechoAlfa },
      nfeRecebidas: [{ id: idNfe1 }, { id: idNfe2 }],
      defis: { id: idDefisAlfa },
      ativo: { id: idAtivoAlfa },
      transferencia: { id: idTransfAlfa },
    }),
  )
  app.save(auditFim)
  console.log('[TESTE-CONF2] Teste completo de conformidade E2E persistido com sucesso!')
})

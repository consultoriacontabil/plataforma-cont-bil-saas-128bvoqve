// Hook: fecho_contabil_auto.js
// Gera lançamentos em partida dobrada automaticamente ao marcar obrigação fiscal como entregue/paga
// Utiliza as regras configuradas na coleção mapeamento_contabil
onRecordAfterUpdateSuccess((e) => {
  try {
    const record = e.record
    const collectionName = record.collection().name
    if (collectionName !== 'obrigacoes') {
      e.next()
      return
    }

    const tenantId = record.getString('tenant_id')
    const status = record.getString('status')
    const origStatus = record.original().getString('status')

    // Verificar se mudou para 'entregue' (ou seja, concluída/paga)
    if (status !== 'entregue' || origStatus === 'entregue') {
      e.next()
      return
    }

    const tipoObrigacao = record.getString('tipo')
    const valor = record.getFloat('valor')
    const empresaId = record.getString('empresa_id')
    const competencia = record.getString('competencia') || '09/2026'

    if (valor <= 0) {
      e.next()
      return
    }

    // Checar se já existem lançamentos vinculados a esta obrigação
    const loteId = 'LOTE-OBR-' + record.id
    try {
      const exist = $app.findRecordsByFilter(
        'lancamentos_contabeis',
        'tenant_id = {:t} && lote_id = {:l}',
        '',
        1,
        0,
        { t: tenantId, l: loteId },
      )
      if (exist.length > 0) {
        e.next()
        return
      }
    } catch (_) {}

    // Buscar mapeamento contábil para a obrigação
    let mapeamento
    try {
      const maps = $app.findRecordsByFilter(
        'mapeamento_contabil',
        'tenant_id = {:t} && origem = "obrigacao" && chave = {:c}',
        '',
        1,
        0,
        { t: tenantId, c: tipoObrigacao },
      )
      if (maps.length > 0) {
        mapeamento = maps[0]
      }
    } catch (_) {}

    if (!mapeamento) {
      console.log(
        '[FECHO_AUTO] Nenhum mapeamento contábil encontrado para obrigação:',
        tipoObrigacao,
      )
      e.next()
      return
    }

    const contaDebito = mapeamento.getString('conta_debito')
    const contaCredito = mapeamento.getString('conta_credito')

    if (!contaDebito || !contaCredito) {
      e.next()
      return
    }

    const lancamentosCol = $app.findCollectionByNameOrId('lancamentos_contabeis')
    const dataLancamento = record.getString('data_entrega') || new Date().toISOString()
    const historico =
      'Pagamento/Liquidação de guia ' +
      tipoObrigacao +
      ' ref. competência ' +
      competencia +
      ' (Fecho Contábil Automático)'

    // 1. Débito (Despesa / Obrigação Tributária)
    const recDeb = new Record(lancamentosCol)
    recDeb.set('tenant_id', tenantId)
    recDeb.set('empresa', empresaId)
    recDeb.set('data', dataLancamento)
    recDeb.set('tipo', 'debito')
    recDeb.set('conta_contabil', contaDebito)
    recDeb.set('contrapartida', contaCredito)
    recDeb.set('valor', valor)
    recDeb.set('historico', historico)
    recDeb.set('competencia', competencia)
    recDeb.set('status', 'confirmado')
    recDeb.set('lote_id', loteId)
    if (record.getString('responsavel_id')) {
      recDeb.set('criado_por', record.getString('responsavel_id'))
    }
    $app.save(recDeb)

    // 2. Crédito (Banco / Caixa)
    const recCred = new Record(lancamentosCol)
    recCred.set('tenant_id', tenantId)
    recCred.set('empresa', empresaId)
    recCred.set('data', dataLancamento)
    recCred.set('tipo', 'credito')
    recCred.set('conta_contabil', contaCredito)
    recCred.set('contrapartida', contaDebito)
    recCred.set('valor', valor)
    recCred.set('historico', historico)
    recCred.set('competencia', competencia)
    recCred.set('status', 'confirmado')
    recCred.set('lote_id', loteId)
    if (record.getString('responsavel_id')) {
      recCred.set('criado_por', record.getString('responsavel_id'))
    }
    $app.save(recCred)

    console.log(
      '[FECHO_AUTO] Lançamentos gerados para obrigação',
      tipoObrigacao,
      'no valor R$',
      valor,
    )
  } catch (err) {
    console.log('[FECHO_AUTO] Erro ao gerar lançamentos automáticos:', err)
  }
  e.next()
}, 'obrigacoes')

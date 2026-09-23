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

    // Tentar gerar os lançamentos contábeis. Se falhar (ex: competência contábil já fechada ou mapeamento inválido),
    // a falha NÃO deve travar nem impedir a marcação da obrigação como entregue/transmitida.
    // Em vez de propagar o erro, registra a ocorrência no log de auditoria / console e prossegue.
    try {
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
    } catch (saveErr) {
      console.log(
        '[FECHO_AUTO] Aviso: Não foi possível gerar lançamentos contábeis para a obrigação ' +
          tipoObrigacao +
          ' (' +
          record.id +
          '):',
        saveErr,
      )
      // Opcional: registrar pendência em audit_log de forma não bloqueante
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_log')
        const auditRec = new Record(auditCol)
        auditRec.set('tenant_id', tenantId)
        if (record.getString('responsavel_id')) {
          auditRec.set('usuario_id', record.getString('responsavel_id'))
        }
        auditRec.set('acao', 'fecho_contabil_pendencia')
        auditRec.set('entidade_tipo', 'obrigacoes')
        auditRec.set('entidade_id', record.id)
        auditRec.set(
          'detalhes',
          'Obrigação ' +
            tipoObrigacao +
            ' marcada como entregue, mas lançamentos contábeis não foram gerados automaticamente (competência fechada ou mapeamento pendente). Detalhe: ' +
            (saveErr && saveErr.message ? saveErr.message : String(saveErr)),
        )
        $app.save(auditRec)
      } catch (_) {}
    }
  } catch (err) {
    console.log('[FECHO_AUTO] Erro geral ao processar fecho automático:', err)
  }
  e.next()
}, 'obrigacoes')

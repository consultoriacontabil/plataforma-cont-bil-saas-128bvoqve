// Hook: validate_lancamento_competencia_fechada.js
// Valida server-side se a competência da empresa já foi fechada antes de permitir
// criação ou atualização de lançamentos contábeis.
// Retorna erro claro em pt-BR impedindo fraudes ou alterações após encerramento oficial.

onRecordValidate((e) => {
  try {
    const record = e.record
    const collectionName = record.collection().name
    if (collectionName !== 'lancamentos_contabeis') {
      e.next()
      return
    }

    const tenantId = record.getString('tenant_id')
    const empresaId = record.getString('empresa')
    const competencia = record.getString('competencia')

    if (!tenantId || !empresaId || !competencia) {
      e.next()
      return
    }

    // Buscar se há registro de fechamento marcado como 'fechado' para esta empresa e competência
    try {
      const fechamentos = $app.findRecordsByFilter(
        'fechamento_competencia',
        'tenant_id = {:t} && empresa = {:emp} && competencia = {:comp} && status = "fechado"',
        '',
        1,
        0,
        { t: tenantId, emp: empresaId, comp: competencia },
      )

      if (fechamentos.length > 0) {
        let nomeEmpresa = 'a empresa selecionada'
        try {
          const empRec = $app.findRecordById('empresas', empresaId)
          nomeEmpresa =
            empRec.getString('nome_fantasia') || empRec.getString('razao_social') || nomeEmpresa
        } catch (_) {}

        throw new BadRequestError(
          'Competência ' +
            competencia +
            ' fechada para a empresa ' +
            nomeEmpresa +
            '. Operação não permitida.',
        )
      }
    } catch (err) {
      if (err.status === 400 || (err.message && err.message.indexOf('Competência') !== -1)) {
        throw err
      }
    }
  } catch (err) {
    if (err.status === 400 || (err.message && err.message.indexOf('Competência') !== -1)) {
      throw err
    }
    console.log('[VALIDATE_LANCAMENTO] Erro na validação de competência fechada:', err)
  }

  e.next()
}, 'lancamentos_contabeis')

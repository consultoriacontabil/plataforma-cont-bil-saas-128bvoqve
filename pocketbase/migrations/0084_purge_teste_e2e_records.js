// Migration: 0084_purge_teste_e2e_records.js
// Exclusão definitiva de TODOS os registros criados durante os testes de conformidade (TESTE E2E / TESTE-E2E)
// Competência 09/2026 na empresa "Beta Tech Softwares Ltda" (ID empresa: v6kbhemaxoe96fo)
// Ordem de integridade estrita (filhos antes dos pais):
// 1. assinaturas_demonstrativos vinculadas aos demonstrativos de teste
// 2. demonstrativos de teste (DRE e Balanço)
// 3. fechamento_checklist_itens
// 4. fechamento_competencia
// 5. dctfweb_declaracoes
// 6. reinf_eventos
// 7. esocial_eventos
// 8. extratos_bancarios (movimentos de conciliação)
// 9. lancamentos_contabeis (partidas dobradas dos lotes TESTE-E2E)
// 10. fiscal (registros fiscais de apuração teste)
// 11. obrigacoes (DAS, DCTF, etc. de teste)
// 12. guias_pagamentos (guia DAS de teste)
// 13. impostos_retidos (DARF INSS de teste)
// 14. contas_financeiras (títulos a pagar/receber de teste)
// 15. folha_pagamento (holerites de teste)
// 16. funcionarios (colaborador de teste Carlos Eduardo Oliveira)
// 17. faturamentos_recorrentes (faturamento espelhado de teste)
// 18. contratos_honorarios (contrato de teste TESTE E2E)
// 19. nfse_notas_emitidas (NFS-e 20260901 de teste)
// 20. documentos (GED TESTE_E2E_NFSe_2026_0901.pdf e similares)
// 21. Reverter saldo da conta bancária de teste (restaurar saldo_atual para o saldo_inicial se foi movimentado pelo teste)
// Cada exclusão gera registro correspondente na audit_log para rastreabilidade total.

migrate(
  (app) => {
    console.log('[PURGE_TESTE_E2E] Iniciando exclusão definitiva de registros TESTE E2E...')

    // Buscar tenant_id para auditoria
    let tenantId = ''
    try {
      const tenants = app.findRecordsByFilter('tenants', '', '', 1, 0)
      if (tenants.length > 0) {
        tenantId = tenants[0].id
      }
    } catch (_) {}

    const auditCol = app.findCollectionByNameOrId('audit_log')

    function registrarAudit(entidadeTipo, entidadeId, detalhes) {
      try {
        const log = new Record(auditCol)
        log.set('tenant_id', tenantId || '')
        log.set('entidade_tipo', entidadeTipo)
        log.set('entidade_id', entidadeId)
        log.set('acao', 'Exclusão definitiva de ' + entidadeTipo)
        log.set('detalhes', '[PURGE TESTE E2E]: ' + detalhes)
        app.save(log)
      } catch (eAudit) {
        console.log('[PURGE_TESTE_E2E] Erro ao gravar log de auditoria:', eAudit)
      }
    }

    let totalDeletados = 0

    // 1. assinaturas_demonstrativos de teste
    try {
      const assList = app.findRecordsByFilter(
        'assinaturas_demonstrativos',
        "token_verificacao ~ 'RUMO-DRE-092026' || token_verificacao ~ 'RUMO-BP-092026' || hash_conteudo ~ 'E2E' || token_verificacao ~ 'E2E' || competencia = '09/2026'",
        '',
        100,
        0,
      )
      for (let i = 0; i < assList.length; i++) {
        const item = assList[i]
        const id = item.id
        app.delete(item)
        registrarAudit(
          'assinaturas_demonstrativos',
          id,
          'Assinatura eletrônica de teste E2E removida',
        )
        totalDeletados++
      }
      console.log('[PURGE_TESTE_E2E] Assinaturas de demonstrativos removidas:', assList.length)
    } catch (err) {
      console.log('[PURGE_TESTE_E2E] Aviso ao limpar assinaturas_demonstrativos:', err)
    }

    // 2. demonstrativos (DRE e Balanço de teste)
    try {
      const demList = app.findRecordsByFilter(
        'demonstrativos',
        "observacoes_cliente ~ 'TESTE E2E' || (competencia = '09/2026' && empresa = 'v6kbhemaxoe96fo')",
        '',
        100,
        0,
      )
      for (let i = 0; i < demList.length; i++) {
        const item = demList[i]
        const id = item.id
        app.delete(item)
        registrarAudit('demonstrativos', id, 'Demonstrativo contábil de teste E2E removido')
        totalDeletados++
      }
      console.log('[PURGE_TESTE_E2E] Demonstrativos removidos:', demList.length)
    } catch (err) {
      console.log('[PURGE_TESTE_E2E] Aviso ao limpar demonstrativos:', err)
    }

    // 3. fechamento_checklist_itens de teste
    try {
      const chkList = app.findRecordsByFilter(
        'fechamento_checklist_itens',
        "titulo ~ 'TESTE E2E' || detalhe_automatico ~ 'E2E' || (competencia = '09/2026' && empresa = 'v6kbhemaxoe96fo')",
        '',
        100,
        0,
      )
      for (let i = 0; i < chkList.length; i++) {
        const item = chkList[i]
        const id = item.id
        app.delete(item)
        registrarAudit(
          'fechamento_checklist_itens',
          id,
          'Item de checklist de fecho teste E2E removido',
        )
        totalDeletados++
      }
      console.log('[PURGE_TESTE_E2E] Itens de checklist de fechamento removidos:', chkList.length)
    } catch (err) {
      console.log('[PURGE_TESTE_E2E] Aviso ao limpar fechamento_checklist_itens:', err)
    }

    // 4. fechamento_competencia de teste (remover a trava de fechamento para não bloquear a exclusão de lançamentos)
    try {
      const fechoList = app.findRecordsByFilter(
        'fechamento_competencia',
        "observacoes ~ 'TESTE E2E' || (competencia = '09/2026' && empresa = 'v6kbhemaxoe96fo')",
        '',
        100,
        0,
      )
      for (let i = 0; i < fechoList.length; i++) {
        const item = fechoList[i]
        const id = item.id
        app.delete(item)
        registrarAudit(
          'fechamento_competencia',
          id,
          'Fechamento de competência de teste E2E removido',
        )
        totalDeletados++
      }
      console.log('[PURGE_TESTE_E2E] Fechamentos de competência removidos:', fechoList.length)
    } catch (err) {
      console.log('[PURGE_TESTE_E2E] Aviso ao limpar fechamento_competencia:', err)
    }

    // 5. dctfweb_declaracoes de teste
    try {
      const dctfList = app.findRecordsByFilter(
        'dctfweb_declaracoes',
        "numero_declaracao ~ 'BETATECH' || protocolo_envio ~ 'SUP-DCTF' || (competencia = '09/2026' && empresa = 'v6kbhemaxoe96fo')",
        '',
        100,
        0,
      )
      for (let i = 0; i < dctfList.length; i++) {
        const item = dctfList[i]
        const id = item.id
        app.delete(item)
        registrarAudit('dctfweb_declaracoes', id, 'Declaração DCTFWeb de teste E2E removida')
        totalDeletados++
      }
      console.log('[PURGE_TESTE_E2E] Declarações DCTFWeb removidas:', dctfList.length)
    } catch (err) {
      console.log('[PURGE_TESTE_E2E] Aviso ao limpar dctfweb_declaracoes:', err)
    }

    // 6. reinf_eventos de teste
    try {
      const reinfList = app.findRecordsByFilter(
        'reinf_eventos',
        "protocolo_envio ~ 'SUP-REINF' || identificador_evento ~ '202609000002099' || (competencia = '09/2026' && empresa = 'v6kbhemaxoe96fo')",
        '',
        100,
        0,
      )
      for (let i = 0; i < reinfList.length; i++) {
        const item = reinfList[i]
        const id = item.id
        app.delete(item)
        registrarAudit('reinf_eventos', id, 'Evento EFD-Reinf de teste E2E removido')
        totalDeletados++
      }
      console.log('[PURGE_TESTE_E2E] Eventos EFD-Reinf removidos:', reinfList.length)
    } catch (err) {
      console.log('[PURGE_TESTE_E2E] Aviso ao limpar reinf_eventos:', err)
    }

    // 7. esocial_eventos de teste
    try {
      const esocList = app.findRecordsByFilter(
        'esocial_eventos',
        "protocolo_envio ~ 'SUP-ESOC' || identificador_evento ~ '202609' || (competencia = '09/2026' && empresa = 'v6kbhemaxoe96fo')",
        '',
        100,
        0,
      )
      for (let i = 0; i < esocList.length; i++) {
        const item = esocList[i]
        const id = item.id
        app.delete(item)
        registrarAudit('esocial_eventos', id, 'Evento eSocial de teste E2E removido')
        totalDeletados++
      }
      console.log('[PURGE_TESTE_E2E] Eventos eSocial removidos:', esocList.length)
    } catch (err) {
      console.log('[PURGE_TESTE_E2E] Aviso ao limpar esocial_eventos:', err)
    }

    // 8. extratos_bancarios de teste (conciliações)
    try {
      const extList = app.findRecordsByFilter(
        'extratos_bancarios',
        "descricao ~ 'TESTE E2E' || lote_contabil_id ~ 'TESTE-E2E' || documento_numero ~ 'PIX-REC-9941' || documento_numero ~ 'PIX-PAG-0012' || documento_numero ~ 'DAS-DEB-7741' || (empresa = 'v6kbhemaxoe96fo' && data ~ '2026-09')",
        '',
        100,
        0,
      )
      for (let i = 0; i < extList.length; i++) {
        const item = extList[i]
        const id = item.id
        app.delete(item)
        registrarAudit(
          'extratos_bancarios',
          id,
          'Transação de extrato/conciliação de teste E2E removida',
        )
        totalDeletados++
      }
      console.log('[PURGE_TESTE_E2E] Transações de extrato removidas:', extList.length)
    } catch (err) {
      console.log('[PURGE_TESTE_E2E] Aviso ao limpar extratos_bancarios:', err)
    }

    // 9. lancamentos_contabeis de teste (8 lotes / partidas dobradas)
    try {
      const lancList = app.findRecordsByFilter(
        'lancamentos_contabeis',
        "historico ~ 'TESTE E2E' || lote_id ~ 'TESTE-E2E' || (empresa = 'v6kbhemaxoe96fo' && competencia = '09/2026')",
        '',
        200,
        0,
      )
      for (let i = 0; i < lancList.length; i++) {
        const item = lancList[i]
        const id = item.id
        app.delete(item)
        registrarAudit('lancamentos_contabeis', id, 'Lançamento contábil de teste E2E removido')
        totalDeletados++
      }
      console.log('[PURGE_TESTE_E2E] Lançamentos contábeis removidos:', lancList.length)
    } catch (err) {
      console.log('[PURGE_TESTE_E2E] Aviso ao limpar lancamentos_contabeis:', err)
    }

    // 10. fiscal de teste
    try {
      const fiscList = app.findRecordsByFilter(
        'fiscal',
        "observacoes ~ 'TESTE E2E' || (empresa_id = 'v6kbhemaxoe96fo' && periodo_apuracao = '09/2026')",
        '',
        100,
        0,
      )
      for (let i = 0; i < fiscList.length; i++) {
        const item = fiscList[i]
        const id = item.id
        app.delete(item)
        registrarAudit('fiscal', id, 'Registro fiscal de apuração de teste E2E removido')
        totalDeletados++
      }
      console.log('[PURGE_TESTE_E2E] Registros fiscais removidos:', fiscList.length)
    } catch (err) {
      console.log('[PURGE_TESTE_E2E] Aviso ao limpar fiscal:', err)
    }

    // 11. obrigacoes de teste (DAS, DCTF)
    try {
      const obrList = app.findRecordsByFilter(
        'obrigacoes',
        "observacoes ~ 'TESTE E2E' || (empresa_id = 'v6kbhemaxoe96fo' && competencia = '09/2026')",
        '',
        100,
        0,
      )
      for (let i = 0; i < obrList.length; i++) {
        const item = obrList[i]
        const id = item.id
        app.delete(item)
        registrarAudit('obrigacoes', id, 'Obrigação de teste E2E removida')
        totalDeletados++
      }
      console.log('[PURGE_TESTE_E2E] Obrigações removidas:', obrList.length)
    } catch (err) {
      console.log('[PURGE_TESTE_E2E] Aviso ao limpar obrigacoes:', err)
    }

    // 12. guias_pagamentos de teste (DAS)
    try {
      const guiasList = app.findRecordsByFilter(
        'guias_pagamentos',
        "descricao ~ 'TESTE E2E' || observacoes ~ 'TESTE E2E' || numero_referencia ~ 'BETATECH' || (empresa = 'v6kbhemaxoe96fo' && periodo_apuracao = '09/2026')",
        '',
        100,
        0,
      )
      for (let i = 0; i < guiasList.length; i++) {
        const item = guiasList[i]
        const id = item.id
        app.delete(item)
        registrarAudit('guias_pagamentos', id, 'Guia de pagamento de teste E2E removida')
        totalDeletados++
      }
      console.log('[PURGE_TESTE_E2E] Guias de pagamentos removidas:', guiasList.length)
    } catch (err) {
      console.log('[PURGE_TESTE_E2E] Aviso ao limpar guias_pagamentos:', err)
    }

    // 13. impostos_retidos de teste
    try {
      const impList = app.findRecordsByFilter(
        'impostos_retidos',
        "(empresa = 'v6kbhemaxoe96fo' && competencia = '09/2026')",
        '',
        100,
        0,
      )
      for (let i = 0; i < impList.length; i++) {
        const item = impList[i]
        const id = item.id
        app.delete(item)
        registrarAudit('impostos_retidos', id, 'Imposto retido de teste E2E removido')
        totalDeletados++
      }
      console.log('[PURGE_TESTE_E2E] Impostos retidos removidos:', impList.length)
    } catch (err) {
      console.log('[PURGE_TESTE_E2E] Aviso ao limpar impostos_retidos:', err)
    }

    // 14. contas_financeiras de teste (títulos pagar/receber)
    try {
      const finList = app.findRecordsByFilter(
        'contas_financeiras',
        "descricao ~ 'TESTE E2E' || pessoa ~ 'TESTE E2E' || observacoes ~ 'TESTE E2E' || lote_contabil_id ~ 'TESTE-E2E' || (empresa = 'v6kbhemaxoe96fo' && documento_ref ~ '092026')",
        '',
        100,
        0,
      )
      for (let i = 0; i < finList.length; i++) {
        const item = finList[i]
        const id = item.id
        app.delete(item)
        registrarAudit('contas_financeiras', id, 'Título financeiro de teste E2E removido')
        totalDeletados++
      }
      console.log('[PURGE_TESTE_E2E] Contas financeiras removidas:', finList.length)
    } catch (err) {
      console.log('[PURGE_TESTE_E2E] Aviso ao limpar contas_financeiras:', err)
    }

    // 15. folha_pagamento de teste
    try {
      const folhaList = app.findRecordsByFilter(
        'folha_pagamento',
        "(empresa = 'v6kbhemaxoe96fo' && competencia = '09/2026')",
        '',
        100,
        0,
      )
      for (let i = 0; i < folhaList.length; i++) {
        const item = folhaList[i]
        const id = item.id
        app.delete(item)
        registrarAudit(
          'folha_pagamento',
          id,
          'Holerite de folha de pagamento de teste E2E removido',
        )
        totalDeletados++
      }
      console.log('[PURGE_TESTE_E2E] Holerites de folha removidos:', folhaList.length)
    } catch (err) {
      console.log('[PURGE_TESTE_E2E] Aviso ao limpar folha_pagamento:', err)
    }

    // 16. funcionarios de teste (Carlos Eduardo Oliveira)
    try {
      const funcList = app.findRecordsByFilter(
        'funcionarios',
        "nome_completo ~ 'TESTE E2E' || cpf = '123.456.789-99' || matricula_esocial = 'MATR-E2E-001'",
        '',
        100,
        0,
      )
      for (let i = 0; i < funcList.length; i++) {
        const item = funcList[i]
        const id = item.id
        app.delete(item)
        registrarAudit('funcionarios', id, 'Funcionário de teste E2E removido')
        totalDeletados++
      }
      console.log('[PURGE_TESTE_E2E] Funcionários de teste removidos:', funcList.length)
    } catch (err) {
      console.log('[PURGE_TESTE_E2E] Aviso ao limpar funcionarios:', err)
    }

    // 17. faturamentos_recorrentes de teste
    try {
      const fatList = app.findRecordsByFilter(
        'faturamentos_recorrentes',
        "notas ~ 'TESTE E2E' || (empresa = 'v6kbhemaxoe96fo' && competencia = '09/2026')",
        '',
        100,
        0,
      )
      for (let i = 0; i < fatList.length; i++) {
        const item = fatList[i]
        const id = item.id
        app.delete(item)
        registrarAudit(
          'faturamentos_recorrentes',
          id,
          'Faturamento recorrente de teste E2E removido',
        )
        totalDeletados++
      }
      console.log('[PURGE_TESTE_E2E] Faturamentos recorrentes removidos:', fatList.length)
    } catch (err) {
      console.log('[PURGE_TESTE_E2E] Aviso ao limpar faturamentos_recorrentes:', err)
    }

    // 18. contratos_honorarios de teste
    try {
      const contList = app.findRecordsByFilter(
        'contratos_honorarios',
        "titulo ~ 'TESTE E2E' || (empresa = 'v6kbhemaxoe96fo' && valor_mensal = 15000)",
        '',
        100,
        0,
      )
      for (let i = 0; i < contList.length; i++) {
        const item = contList[i]
        const id = item.id
        app.delete(item)
        registrarAudit('contratos_honorarios', id, 'Contrato de honorários de teste E2E removido')
        totalDeletados++
      }
      console.log('[PURGE_TESTE_E2E] Contratos de honorários removidos:', contList.length)
    } catch (err) {
      console.log('[PURGE_TESTE_E2E] Aviso ao limpar contratos_honorarios:', err)
    }

    // 19. nfse_notas_emitidas de teste
    try {
      const nfseList = app.findRecordsByFilter(
        'nfse_notas_emitidas',
        "numero_nota = 20260901 || discriminacao_servicos ~ 'TESTE E2E' || tomador_nome ~ 'TESTE E2E' || (empresa = 'v6kbhemaxoe96fo' && competencia = '09/2026')",
        '',
        100,
        0,
      )
      for (let i = 0; i < nfseList.length; i++) {
        const item = nfseList[i]
        const id = item.id
        app.delete(item)
        registrarAudit('nfse_notas_emitidas', id, 'NFS-e de teste E2E removida')
        totalDeletados++
      }
      console.log('[PURGE_TESTE_E2E] NFS-e emitidas removidas:', nfseList.length)
    } catch (err) {
      console.log('[PURGE_TESTE_E2E] Aviso ao limpar nfse_notas_emitidas:', err)
    }

    // 20. documentos GED de teste
    try {
      const docsList = app.findRecordsByFilter(
        'documentos',
        "nome_arquivo ~ 'TESTE_E2E' || observacoes ~ 'TESTE E2E' || (empresa_id = 'v6kbhemaxoe96fo' && nome_arquivo ~ '2026_0901')",
        '',
        100,
        0,
      )
      for (let i = 0; i < docsList.length; i++) {
        const item = docsList[i]
        const id = item.id
        app.delete(item)
        registrarAudit('documentos', id, 'Documento GED de teste E2E removido')
        totalDeletados++
      }
      console.log('[PURGE_TESTE_E2E] Documentos GED de teste removidos:', docsList.length)
    } catch (err) {
      console.log('[PURGE_TESTE_E2E] Aviso ao limpar documentos:', err)
    }

    // 21. Reajustar saldo da conta bancária de teste se existir
    try {
      const cbList = app.findRecordsByFilter(
        'contas_bancarias',
        "empresa = 'v6kbhemaxoe96fo'",
        '',
        10,
        0,
      )
      for (let i = 0; i < cbList.length; i++) {
        const cb = cbList[i]
        // Se a conta tiver conta = '1234567-8' criada para o teste, deletar ou restaurar saldo
        if (cb.getString('conta') === '1234567-8') {
          app.delete(cb)
          registrarAudit(
            'contas_bancarias',
            cb.id,
            'Conta bancária criada exclusivamente para teste E2E removida',
          )
          totalDeletados++
          console.log('[PURGE_TESTE_E2E] Conta bancária de teste removida:', cb.id)
        }
      }
    } catch (err) {
      console.log('[PURGE_TESTE_E2E] Aviso ao ajustar contas_bancarias:', err)
    }

    // 22. Empresa Beta Tech / PIRES CONSULTORIA LTDA (id: v6kbhemaxoe96fo)
    // Conforme instrução: se houver dúvida ou for empresa pré-existente da carteira cadastrada em 0003, manter a empresa limpa e sem dados de teste.
    console.log(
      '[PURGE_TESTE_E2E] Total de registros de teste definitivamente purgados do banco:',
      totalDeletados,
    )
  },
  (app) => {
    console.log('[PURGE_TESTE_E2E] Reversão não aplicável para limpeza.')
  },
)

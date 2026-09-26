/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  // =========================================================================
  // LIMPEZA TOTAL DOS REGISTROS DE TESTE COM MARCA TESTE-CONF2
  // Ordem estrita de integridade referencial: filhos antes de pais.
  // Registro de cada exclusão na auditoria do sistema.
  // =========================================================================

  const tenantRecord = app.findFirstRecordByFilter('tenants', 'ativo = true')
  const tenantId = tenantRecord ? tenantRecord.id : 'l91og8ybo9krtay'

  let adminUser = null
  try {
    adminUser = app.findFirstRecordByFilter('users', 'id != ""')
  } catch (_) {}
  const adminUserId = adminUser ? adminUser.id : null

  const auditCol = app.findCollectionByNameOrId('audit_log')

  function logAuditExclusao(entidadeTipo, entidadeId, detalhes) {
    try {
      const rec = new Record(auditCol)
      rec.set('tenant_id', tenantId)
      if (adminUserId) rec.set('usuario_id', adminUserId)
      rec.set('acao', 'EXCLUSAO_LIMPEZA_TESTE_CONF2')
      rec.set('entidade_tipo', entidadeTipo)
      rec.set('entidade_id', entidadeId)
      rec.set('detalhes', JSON.stringify(detalhes))
      app.save(rec)
    } catch (e) {
      console.log('[TESTE-CONF2] Erro ao gravar audit exclusão:', e)
    }
  }

  // 1. Localizar as empresas criadas no teste
  const empresasTeste = app.findRecordsByFilter(
    'empresas',
    'razao_social ~ "TESTE-CONF2" || nome_fantasia ~ "TESTE-CONF2" || observacoes ~ "TESTE-CONF2"',
  )

  const empresaIds = empresasTeste.map((e) => e.id)
  console.log('[TESTE-CONF2] Empresas de teste a limpar:', empresaIds)

  // 2. Excluir transferências de patrimônio
  for (const empId of empresaIds) {
    const transfList = app.findRecordsByFilter(
      'patrimonio_transferencias',
      `empresa = "${empId}" || motivo ~ "TESTE-CONF2"`,
    )
    for (const t of transfList) {
      logAuditExclusao('patrimonio_transferencias', t.id, {
        motivo: 'Limpeza TESTE-CONF2',
        empresa: empId,
      })
      app.delete(t)
    }
  }

  // 3. Excluir ativos de patrimônio
  for (const empId of empresaIds) {
    const ativosList = app.findRecordsByFilter(
      'ativos',
      `empresa = "${empId}" || descricao ~ "TESTE-CONF2"`,
    )
    for (const a of ativosList) {
      logAuditExclusao('ativos', a.id, {
        motivo: 'Limpeza TESTE-CONF2',
        descricao: a.getString('descricao'),
      })
      app.delete(a)
    }
  }

  // 4. Excluir DEFIS
  for (const empId of empresaIds) {
    const defisList = app.findRecordsByFilter('defis_declaracoes', `empresa = "${empId}"`)
    for (const d of defisList) {
      logAuditExclusao('defis_declaracoes', d.id, {
        motivo: 'Limpeza TESTE-CONF2',
        ano: d.getInt('ano_calendario'),
      })
      app.delete(d)
    }
  }

  // 5. Excluir NFe Recebidas
  for (const empId of empresaIds) {
    const nfeList = app.findRecordsByFilter(
      'nfe_recebidas',
      `empresa = "${empId}" || natureza_operacao ~ "TESTE-CONF2"`,
    )
    for (const n of nfeList) {
      logAuditExclusao('nfe_recebidas', n.id, {
        motivo: 'Limpeza TESTE-CONF2',
        chave: n.getString('chave_acesso'),
      })
      app.delete(n)
    }
  }

  // 6. Abrir fechamento de competência antes de apagar lançamentos contábeis
  for (const empId of empresaIds) {
    const fechoList = app.findRecordsByFilter('fechamento_competencia', `empresa = "${empId}"`)
    for (const f of fechoList) {
      // Reabrir primeiro para que hooks não impeçam exclusões
      f.set('status', 'aberto')
      app.save(f)
      logAuditExclusao('fechamento_competencia', f.id, {
        motivo: 'Limpeza TESTE-CONF2',
        competencia: f.getString('competencia'),
      })
      app.delete(f)
    }
  }

  // 7. Excluir Lançamentos Contábeis
  for (const empId of empresaIds) {
    const lancList = app.findRecordsByFilter(
      'lancamentos_contabeis',
      `empresa = "${empId}" || historico ~ "TESTE-CONF2" || lote_id ~ "TESTE-CONF2"`,
    )
    for (const l of lancList) {
      logAuditExclusao('lancamentos_contabeis', l.id, {
        motivo: 'Limpeza TESTE-CONF2',
        historico: l.getString('historico'),
        lote: l.getString('lote_id'),
      })
      app.delete(l)
    }
  }

  // 8. Excluir Obrigações
  for (const empId of empresaIds) {
    const obrigList = app.findRecordsByFilter(
      'obrigacoes',
      `empresa_id = "${empId}" || observacoes ~ "TESTE-CONF2"`,
    )
    for (const o of obrigList) {
      logAuditExclusao('obrigacoes', o.id, {
        motivo: 'Limpeza TESTE-CONF2',
        tipo: o.getString('tipo'),
      })
      app.delete(o)
    }
  }

  // 9. Excluir DCTFWeb
  for (const empId of empresaIds) {
    const dctfList = app.findRecordsByFilter(
      'dctfweb_declaracoes',
      `empresa = "${empId}" || numero_declaracao ~ "TESTE-CONF2"`,
    )
    for (const dc of dctfList) {
      logAuditExclusao('dctfweb_declaracoes', dc.id, {
        motivo: 'Limpeza TESTE-CONF2',
        numero: dc.getString('numero_declaracao'),
      })
      app.delete(dc)
    }
  }

  // 10. Excluir Reinf
  for (const empId of empresaIds) {
    const reinfList = app.findRecordsByFilter(
      'reinf_eventos',
      `empresa = "${empId}" || identificador_evento ~ "TESTE-CONF2"`,
    )
    for (const r of reinfList) {
      logAuditExclusao('reinf_eventos', r.id, {
        motivo: 'Limpeza TESTE-CONF2',
        evento: r.getString('tipo_evento'),
      })
      app.delete(r)
    }
  }

  // 11. Excluir eSocial
  for (const empId of empresaIds) {
    const esocialList = app.findRecordsByFilter(
      'esocial_eventos',
      `empresa = "${empId}" || identificador_evento ~ "TESTE-CONF2"`,
    )
    for (const es of esocialList) {
      logAuditExclusao('esocial_eventos', es.id, {
        motivo: 'Limpeza TESTE-CONF2',
        evento: es.getString('tipo_evento'),
      })
      app.delete(es)
    }
  }

  // 12. Excluir Guias de Pagamento
  for (const empId of empresaIds) {
    const guiasList = app.findRecordsByFilter(
      'guias_pagamentos',
      `empresa = "${empId}" || descricao ~ "TESTE-CONF2" || autenticacao_bancaria ~ "TESTE-CONF2"`,
    )
    for (const g of guiasList) {
      logAuditExclusao('guias_pagamentos', g.id, {
        motivo: 'Limpeza TESTE-CONF2',
        descricao: g.getString('descricao'),
      })
      app.delete(g)
    }
  }

  // 13. Excluir Folha de Pagamento
  for (const empId of empresaIds) {
    const folhaList = app.findRecordsByFilter('folha_pagamento', `empresa = "${empId}"`)
    for (const fo of folhaList) {
      logAuditExclusao('folha_pagamento', fo.id, {
        motivo: 'Limpeza TESTE-CONF2',
        competencia: fo.getString('competencia'),
      })
      app.delete(fo)
    }
  }

  // 14. Excluir Extratos Bancários
  for (const empId of empresaIds) {
    const extratosList = app.findRecordsByFilter(
      'extratos_bancarios',
      `empresa = "${empId}" || descricao ~ "TESTE-CONF2"`,
    )
    for (const ex of extratosList) {
      logAuditExclusao('extratos_bancarios', ex.id, {
        motivo: 'Limpeza TESTE-CONF2',
        descricao: ex.getString('descricao'),
      })
      app.delete(ex)
    }
  }

  // 15. Excluir NFSe emitidas
  for (const empId of empresaIds) {
    const nfseList = app.findRecordsByFilter(
      'nfse_notas_emitidas',
      `empresa = "${empId}" || serie = "CONF2" || chave_acesso ~ "TESTE-CONF2"`,
    )
    for (const nf of nfseList) {
      logAuditExclusao('nfse_notas_emitidas', nf.id, {
        motivo: 'Limpeza TESTE-CONF2',
        numero: nf.getInt('numero_nota'),
      })
      app.delete(nf)
    }
  }

  // 16. Excluir Contas Financeiras (Títulos a Receber/Pagar)
  for (const empId of empresaIds) {
    const contasFinList = app.findRecordsByFilter(
      'contas_financeiras',
      `empresa = "${empId}" || descricao ~ "TESTE-CONF2" || observacoes ~ "TESTE-CONF2"`,
    )
    for (const cf of contasFinList) {
      logAuditExclusao('contas_financeiras', cf.id, {
        motivo: 'Limpeza TESTE-CONF2',
        descricao: cf.getString('descricao'),
      })
      app.delete(cf)
    }
  }

  // 17. Excluir Contas Bancárias
  for (const empId of empresaIds) {
    const contasBanList = app.findRecordsByFilter(
      'contas_bancarias',
      `empresa = "${empId}" || banco ~ "TESTE-CONF2"`,
    )
    for (const cb of contasBanList) {
      logAuditExclusao('contas_bancarias', cb.id, {
        motivo: 'Limpeza TESTE-CONF2',
        banco: cb.getString('banco'),
      })
      app.delete(cb)
    }
  }

  // 18. Excluir Documentos GED
  for (const empId of empresaIds) {
    const docsList = app.findRecordsByFilter(
      'documentos',
      `empresa_id = "${empId}" || nome_arquivo ~ "TESTE-CONF2" || observacoes ~ "TESTE-CONF2"`,
    )
    for (const doc of docsList) {
      logAuditExclusao('documentos', doc.id, {
        motivo: 'Limpeza TESTE-CONF2',
        arquivo: doc.getString('nome_arquivo'),
      })
      app.delete(doc)
    }
  }

  // 19. Excluir Colaboradores/Funcionários
  for (const empId of empresaIds) {
    const funcList = app.findRecordsByFilter(
      'funcionarios',
      `empresa = "${empId}" || nome_completo ~ "TESTE-CONF2"`,
    )
    for (const fn of funcList) {
      logAuditExclusao('funcionarios', fn.id, {
        motivo: 'Limpeza TESTE-CONF2',
        nome: fn.getString('nome_completo'),
      })
      app.delete(fn)
    }
  }

  // 20. Excluir as Empresas (Pais)
  for (const emp of empresasTeste) {
    logAuditExclusao('empresas', emp.id, {
      motivo: 'Limpeza TESTE-CONF2',
      razao: emp.getString('razao_social'),
    })
    app.delete(emp)
  }

  // Log final de auditoria comprovando limpeza
  const auditFimLimpeza = new Record(auditCol)
  auditFimLimpeza.set('tenant_id', tenantId)
  if (adminUserId) auditFimLimpeza.set('usuario_id', adminUserId)
  auditFimLimpeza.set('acao', 'CONCLUSAO_LIMPEZA_TOTAL_TESTE_CONF2')
  auditFimLimpeza.set('entidade_tipo', 'auditoria_conformidade')
  auditFimLimpeza.set('entidade_id', 'TESTE-CONF2-GLOBAL')
  auditFimLimpeza.set(
    'detalhes',
    JSON.stringify({
      status: 'LIMPEZA_CONCLUIDA_COM_SUCESSO',
      timestamp: new Date().toISOString(),
      marcador: 'TESTE-CONF2',
      empresasExcluidas: empresaIds,
      mensagem: 'Todos os registros de teste foram removidos em ordem de integridade e auditados.',
    }),
  )
  app.save(auditFimLimpeza)
  console.log('[TESTE-CONF2] Limpeza total realizada e auditada com sucesso!')
})

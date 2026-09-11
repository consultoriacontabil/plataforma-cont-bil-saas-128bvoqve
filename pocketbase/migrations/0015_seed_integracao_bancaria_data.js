/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findRecordsByFilter('tenants', 'ativo = true', '-created', 10, 0)
    if (!tenants || tenants.length === 0) return
    const primaryTenant = tenants[0]

    const contas = app.findRecordsByFilter(
      'contas_bancarias',
      `tenant_id = '${primaryTenant.id}'`,
      '-created',
      10,
      0,
    )
    if (!contas || contas.length === 0) return

    const contaItau = contas.find((c) => c.getString('banco').includes('Itaú')) || contas[0]
    const contaBB =
      contas.find((c) => c.getString('banco').includes('Brasil')) || contas[1] || contas[0]

    const integracoesCol = app.findCollectionByNameOrId('integracoes_bancarias')
    const logsCol = app.findCollectionByNameOrId('integracoes_logs')

    // 1. Configurar integração Itaú (Automática / Diária)
    let intItau
    try {
      const found = app.findRecordsByFilter(
        'integracoes_bancarias',
        `tenant_id = '${primaryTenant.id}' && conta_bancaria = '${contaItau.id}'`,
        '',
        1,
        0,
      )
      if (found.length > 0) intItau = found[0]
    } catch (_) {}

    if (!intItau) {
      intItau = new Record(integracoesCol)
      intItau.set('tenant_id', primaryTenant.id)
      intItau.set('empresa', contaItau.getString('empresa'))
      intItau.set('conta_bancaria', contaItau.id)
      intItau.set('modo', 'automatico')
      intItau.set('frequencia', 'diaria')
      intItau.set('fonte_tipo', 'email')
      intItau.set('fonte_identificador', 'extratos-itau@inovatech.com.br')
      intItau.set('status', 'ativo')
      intItau.set('ultima_execucao', '2026-10-02 06:00:00.000Z')
      intItau.set('proxima_execucao', '2026-10-03 06:00:00.000Z')
      intItau.set('total_importados', 24)
      intItau.set('total_conciliados', 22)
      intItau.set('observacoes', 'Caixa postal monitorada diariamente às 06h via rotina agendada.')
      app.save(intItau)

      // Logs de execução para o Itaú
      const log1 = new Record(logsCol)
      log1.set('tenant_id', primaryTenant.id)
      log1.set('integracao', intItau.id)
      log1.set('conta_bancaria', contaItau.id)
      log1.set('data_execucao', '2026-10-02 06:00:15.000Z')
      log1.set('status', 'sucesso')
      log1.set('linhas_lidas', 5)
      log1.set('linhas_importadas', 3)
      log1.set('linhas_duplicadas', 2)
      log1.set('linhas_conciliadas', 2)
      log1.set(
        'mensagem',
        'Processamento diário concluído. 3 novas movimentações importadas e conciliadas.',
      )
      log1.set('detalhes_json', {
        arquivo_fonte: 'extrato_itau_20261002.csv',
        origem: 'email',
        tempo_execucao_ms: 412,
      })
      app.save(log1)

      const log2 = new Record(logsCol)
      log2.set('tenant_id', primaryTenant.id)
      log2.set('integracao', intItau.id)
      log2.set('conta_bancaria', contaItau.id)
      log2.set('data_execucao', '2026-09-28 06:00:12.000Z')
      log2.set('status', 'sucesso')
      log2.set('linhas_lidas', 8)
      log2.set('linhas_importadas', 8)
      log2.set('linhas_duplicadas', 0)
      log2.set('linhas_conciliadas', 7)
      log2.set('mensagem', 'Processamento agendado com sucesso. Extrato OFX processado.')
      log2.set('detalhes_json', {
        arquivo_fonte: 'itau_corrente_20260928.ofx',
        origem: 'pasta_sftp',
        tempo_execucao_ms: 530,
      })
      app.save(log2)
    }

    // 2. Configurar integração Banco do Brasil (Manual / Agendamento Semanal)
    if (contaBB && contaBB.id !== contaItau.id) {
      let intBB
      try {
        const found = app.findRecordsByFilter(
          'integracoes_bancarias',
          `tenant_id = '${primaryTenant.id}' && conta_bancaria = '${contaBB.id}'`,
          '',
          1,
          0,
        )
        if (found.length > 0) intBB = found[0]
      } catch (_) {}

      if (!intBB) {
        intBB = new Record(integracoesCol)
        intBB.set('tenant_id', primaryTenant.id)
        intBB.set('empresa', contaBB.getString('empresa'))
        intBB.set('conta_bancaria', contaBB.id)
        intBB.set('modo', 'manual')
        intBB.set('frequencia', 'semanal')
        intBB.set('fonte_tipo', 'pasta_sftp')
        intBB.set('fonte_identificador', '/var/bancos/graos-bb/extratos/')
        intBB.set('status', 'ativo')
        intBB.set('ultima_execucao', '2026-09-30 08:30:00.000Z')
        intBB.set('proxima_execucao', '2026-10-07 08:30:00.000Z')
        intBB.set('total_importados', 12)
        intBB.set('total_conciliados', 10)
        intBB.set('observacoes', 'Importação agendada semanalmente às segundas-feiras.')
        app.save(intBB)

        const logBB = new Record(logsCol)
        logBB.set('tenant_id', primaryTenant.id)
        logBB.set('integracao', intBB.id)
        logBB.set('conta_bancaria', contaBB.id)
        logBB.set('data_execucao', '2026-09-30 08:30:22.000Z')
        logBB.set('status', 'sucesso')
        logBB.set('linhas_lidas', 4)
        logBB.set('linhas_importadas', 4)
        logBB.set('linhas_duplicadas', 0)
        logBB.set('linhas_conciliadas', 3)
        logBB.set('mensagem', 'Lote de extrato semanal importado com êxito.')
        logBB.set('detalhes_json', {
          arquivo_fonte: 'bb_extrato_semanal_set26.csv',
          origem: 'pasta_sftp',
          tempo_execucao_ms: 388,
        })
        app.save(logBB)
      }
    }
  },
  (app) => {
    // revert
  },
)

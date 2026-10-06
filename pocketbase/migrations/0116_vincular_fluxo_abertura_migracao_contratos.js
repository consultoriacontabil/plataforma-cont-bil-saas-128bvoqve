migrate(
  (app) => {
    // 0116: Vinculação de Fluxo de Abertura / Migração a Contratos & Propostas de Honorários
    // Permite execução em trilhas paralelas (Proposta e Solicitação de Documentos) com responsabilidade Cliente / Contabilidade

    const contratosCol = app.findCollectionByNameOrId('contratos_honorarios')
    const onboardingCol = app.findCollectionByNameOrId('company_onboarding_workflow')
    const migracoesCol = app.findCollectionByNameOrId('empresas_migracoes_onboarding')

    // 1. Campos em contratos_honorarios
    if (!contratosCol.fields.getByName('fluxo_tipo')) {
      contratosCol.fields.add(
        new SelectField({
          name: 'fluxo_tipo',
          required: false,
          values: ['nenhum', 'abertura', 'migracao_entrada', 'migracao_saida'],
          maxSelect: 1,
        }),
      )
    }

    if (!contratosCol.fields.getByName('fluxo_abertura_id')) {
      contratosCol.fields.add(
        new RelationField({
          name: 'fluxo_abertura_id',
          required: false,
          collectionId: onboardingCol.id,
          maxSelect: 1,
        }),
      )
    }

    if (!contratosCol.fields.getByName('fluxo_migracao_id')) {
      contratosCol.fields.add(
        new RelationField({
          name: 'fluxo_migracao_id',
          required: false,
          collectionId: migracoesCol.id,
          maxSelect: 1,
        }),
      )
    }

    if (!contratosCol.fields.getByName('trilha_documentos_json')) {
      contratosCol.fields.add(
        new JSONField({
          name: 'trilha_documentos_json',
          required: false,
        }),
      )
    }

    if (!contratosCol.fields.getByName('pedido_documento_id')) {
      const pedidosCol = app.findCollectionByNameOrId('pedidos_documentos')
      contratosCol.fields.add(
        new RelationField({
          name: 'pedido_documento_id',
          required: false,
          collectionId: pedidosCol.id,
          maxSelect: 1,
        }),
      )
    }

    if (!contratosCol.fields.getByName('elliza_processo_id')) {
      const procsCol = app.findCollectionByNameOrId('processos_operacionais')
      contratosCol.fields.add(
        new RelationField({
          name: 'elliza_processo_id',
          required: false,
          collectionId: procsCol.id,
          maxSelect: 1,
        }),
      )
    }

    app.save(contratosCol)

    // 2. Campo em company_onboarding_workflow (abertura) para enxergar contrato/proposta vinculada
    if (!onboardingCol.fields.getByName('contrato_honorario_id')) {
      onboardingCol.fields.add(
        new RelationField({
          name: 'contrato_honorario_id',
          required: false,
          collectionId: contratosCol.id,
          maxSelect: 1,
        }),
      )
      app.save(onboardingCol)
    }

    // 3. Campo em empresas_migracoes_onboarding (migração) para enxergar contrato/proposta vinculada
    if (!migracoesCol.fields.getByName('contrato_honorario_id')) {
      migracoesCol.fields.add(
        new RelationField({
          name: 'contrato_honorario_id',
          required: false,
          collectionId: contratosCol.id,
          maxSelect: 1,
        }),
      )
      app.save(migracoesCol)
    }

    // Índices de busca rápida
    try {
      contratosCol.addIndex('idx_contratos_fluxo_abertura', false, 'fluxo_abertura_id', '')
      contratosCol.addIndex('idx_contratos_fluxo_migracao', false, 'fluxo_migracao_id', '')
      contratosCol.addIndex('idx_contratos_fluxo_tipo', false, 'fluxo_tipo', '')
      app.save(contratosCol)
    } catch (_) {}

    console.log('[MIGRATION-0116] Vinculação de fluxo e paralelismo aplicada com sucesso!')
  },
  (app) => {
    // Rollback defensivo
    try {
      const contratosCol = app.findCollectionByNameOrId('contratos_honorarios')
      const onboardingCol = app.findCollectionByNameOrId('company_onboarding_workflow')
      const migracoesCol = app.findCollectionByNameOrId('empresas_migracoes_onboarding')

      if (contratosCol.fields.getByName('fluxo_tipo'))
        contratosCol.fields.removeByName('fluxo_tipo')
      if (contratosCol.fields.getByName('fluxo_abertura_id'))
        contratosCol.fields.removeByName('fluxo_abertura_id')
      if (contratosCol.fields.getByName('fluxo_migracao_id'))
        contratosCol.fields.removeByName('fluxo_migracao_id')
      if (contratosCol.fields.getByName('trilha_documentos_json'))
        contratosCol.fields.removeByName('trilha_documentos_json')
      if (contratosCol.fields.getByName('pedido_documento_id'))
        contratosCol.fields.removeByName('pedido_documento_id')
      if (contratosCol.fields.getByName('elliza_processo_id'))
        contratosCol.fields.removeByName('elliza_processo_id')
      app.save(contratosCol)

      if (onboardingCol.fields.getByName('contrato_honorario_id')) {
        onboardingCol.fields.removeByName('contrato_honorario_id')
        app.save(onboardingCol)
      }

      if (migracoesCol.fields.getByName('contrato_honorario_id')) {
        migracoesCol.fields.removeByName('contrato_honorario_id')
        app.save(migracoesCol)
      }
    } catch (_) {}
  },
)

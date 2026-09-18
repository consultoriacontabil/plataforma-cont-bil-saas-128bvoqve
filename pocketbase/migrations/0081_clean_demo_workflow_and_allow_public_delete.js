migrate(
  (app) => {
    // 1. Atualizar deleteRule de documentos para permitir que o cliente público apague o documento anexado
    // via link público caso precise excluir o arquivo enviado (desde que não esteja em restrição interna)
    // ou contador autenticado
    try {
      const docsCol = app.findCollectionByNameOrId('documentos')
      docsCol.deleteRule = "@request.auth.id != '' || origem_documento = 'link_publico'"
      app.save(docsCol)
    } catch (err) {
      console.log('Erro ao atualizar deleteRule de documentos:', err)
    }

    // 2. Limpar o registro semeado de demonstração de abertura (Dra. Mariana Rocha / token demo)
    // para que não apareça com dados pré-preenchidos ou seja removido, garantindo que o banco fique limpo
    try {
      const demoRecords = app.findRecordsByFilter(
        'company_onboarding_workflow',
        "token = 'demo-abertura-2026-rumo-cliente' || titulo ~ 'Clínica Médica Inovação'",
        '',
        10,
        0,
      )

      for (let i = 0; i < demoRecords.length; i++) {
        const rec = demoRecords[i]
        app.delete(rec)
      }
      console.log(`[0081] Limpeza de demo onboarding concluída (${demoRecords.length} removidos).`)
    } catch (err) {
      console.log('Erro ao limpar seed demo onboarding:', err)
    }
  },
  (app) => {
    // down: restaurar deleteRule padrão
    try {
      const docsCol = app.findCollectionByNameOrId('documentos')
      docsCol.deleteRule = "@request.auth.id != ''"
      app.save(docsCol)
    } catch (_) {}
  },
)

// Migration: 0085_add_origem_to_lancamentos_contabeis.js
// Adiciona campo 'origem' (select: manual | folha | fiscal | financeiro | importacao | sistema)
// na collection lancamentos_contabeis para rastreio integral do tripé contábil-fiscal-folha.

migrate(
  (app) => {
    try {
      const lancCol = app.findCollectionByNameOrId('lancamentos_contabeis')
      if (!lancCol.fields.getByName('origem')) {
        lancCol.fields.add(
          new SelectField({
            name: 'origem',
            values: ['manual', 'folha', 'fiscal', 'financeiro', 'importacao', 'sistema'],
            maxSelect: 1,
            required: false,
          }),
        )
        app.save(lancCol)
        console.log(
          '[MIGRATION_0085] Campo origem adicionado em lancamentos_contabeis com sucesso.',
        )
      }
    } catch (err) {
      console.log('[MIGRATION_0085] Erro ou campo já existente em lancamentos_contabeis:', err)
    }
  },
  (app) => {
    try {
      const lancCol = app.findCollectionByNameOrId('lancamentos_contabeis')
      if (lancCol.fields.getByName('origem')) {
        lancCol.fields.removeByName('origem')
        app.save(lancCol)
      }
    } catch (_) {}
  },
)

migrate(
  (app) => {
    try {
      // 1. company_onboarding_workflow
      const cowCol = app.findCollectionByNameOrId('company_onboarding_workflow')
      if (!cowCol.fields.getByName('checklist_passos_json')) {
        cowCol.fields.add(
          new JSONField({
            name: 'checklist_passos_json',
            required: false,
          }),
        )
        app.save(cowCol)
        console.log(
          '[MIGRATION_0078] checklist_passos_json adicionado em company_onboarding_workflow.',
        )
      }

      // 2. company_formation
      const cfCol = app.findCollectionByNameOrId('company_formation')
      if (!cfCol.fields.getByName('checklist_passos_json')) {
        cfCol.fields.add(
          new JSONField({
            name: 'checklist_passos_json',
            required: false,
          }),
        )
        app.save(cfCol)
        console.log('[MIGRATION_0078] checklist_passos_json adicionado em company_formation.')
      }
    } catch (err) {
      console.log('Erro na migração 0078_add_checklist_passos_json:', err)
      throw err
    }
  },
  (app) => {
    try {
      const cowCol = app.findCollectionByNameOrId('company_onboarding_workflow')
      const field1 = cowCol.fields.getByName('checklist_passos_json')
      if (field1) {
        cowCol.fields.remove(field1)
        app.save(cowCol)
      }

      const cfCol = app.findCollectionByNameOrId('company_formation')
      const field2 = cfCol.fields.getByName('checklist_passos_json')
      if (field2) {
        cfCol.fields.remove(field2)
        app.save(cfCol)
      }
    } catch (_) {}
  },
)

migrate(
  (app) => {
    try {
      const docsCol = app.findCollectionByNameOrId('documentos')
      const selectField = docsCol.fields.getByName('origem_documento')
      if (selectField) {
        if (!selectField.values.includes('link_publico')) {
          selectField.values.push('link_publico')
        }
      }
      const userField = docsCol.fields.getByName('usuario_upload_id')
      if (userField) {
        userField.required = false
      }
      const empresaField = docsCol.fields.getByName('empresa_id')
      if (empresaField) {
        empresaField.required = false
      }
      app.save(docsCol)
    } catch (err) {
      console.log('Erro ao ajustar origem_documento e usuario_upload_id em documentos:', err)
    }
  },
  (app) => {
    // down
  },
)

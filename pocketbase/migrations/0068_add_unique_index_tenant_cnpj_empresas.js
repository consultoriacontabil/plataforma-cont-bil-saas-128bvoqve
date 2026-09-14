/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Normalizar todos os CNPJs existentes removendo pontuação para garantir consistência
    // PocketBase SQLite: substitui caracteres não-numéricos
    const records = app.findRecordsByFilter('empresas', 'id != ""', '', 0, 0)
    for (let i = 0; i < records.length; i++) {
      const rec = records[i]
      const rawCnpj = rec.getString('cnpj')
      const cleanCnpj = rawCnpj ? rawCnpj.replace(/\D/g, '') : ''
      if (cleanCnpj && cleanCnpj !== rawCnpj) {
        rec.set('cnpj', cleanCnpj)
        app.save(rec)
      }
    }

    // 2. Se houver registros duplicados de CNPJ dentro do mesmo tenant, remover duplicatas mantendo a mais antiga
    app
      .db()
      .newQuery(`
      DELETE FROM empresas 
      WHERE id NOT IN (
        SELECT MIN(id) FROM empresas GROUP BY tenant_id, cnpj
      )
    `)
      .execute()

    // 3. Adicionar índice único composto por tenant_id e cnpj
    const empresasCol = app.findCollectionByNameOrId('empresas')
    empresasCol.addIndex('idx_empresas_tenant_cnpj', true, 'tenant_id, cnpj', '')
    app.save(empresasCol)
  },
  (app) => {
    try {
      const empresasCol = app.findCollectionByNameOrId('empresas')
      empresasCol.removeIndex('idx_empresas_tenant_cnpj')
      app.save(empresasCol)
    } catch (_) {}
  },
)

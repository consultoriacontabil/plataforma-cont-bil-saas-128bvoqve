/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findRecordsByFilter('tenants', 'ativo = true', '-created', 1, 0)
    if (!tenants || tenants.length === 0) return
    const primaryTenant = tenants[0]

    const demonstrativos = app.findRecordsByFilter(
      'demonstrativos',
      `tenant_id = '${primaryTenant.id}' && competencia = '09/2026'`,
      '-created',
      5,
      0,
    )
    if (!demonstrativos || demonstrativos.length === 0) return
    const dem = demonstrativos[0]

    const assinaturasCol = app.findCollectionByNameOrId('assinaturas_demonstrativos')

    try {
      const existing = app.findRecordsByFilter(
        'assinaturas_demonstrativos',
        `tenant_id = '${primaryTenant.id}' && demonstrativo = '${dem.id}'`,
        '',
        1,
        0,
      )
      if (existing.length === 0) {
        // Obter dados congelados e calcular hash SHA-256
        const dadosRaw = dem.getString('dados') || JSON.stringify(dem.get('dados'))
        const hashConteudo = $security.sha256(dadosRaw)
        const tokenVerificacao = 'RUMO-202609-' + $security.randomString(8).toUpperCase()

        const assRecord = new Record(assinaturasCol)
        assRecord.set('tenant_id', primaryTenant.id)
        assRecord.set('demonstrativo', dem.id)
        assRecord.set('empresa', dem.getString('empresa'))
        assRecord.set('competencia', '09/2026')
        assRecord.set('tipo_assinatura', 'eletronica_declarada')
        assRecord.set('tipo_certificado', 'nenhum')
        assRecord.set('assinante', 'Carlos Eduardo Silva')
        assRecord.set('cargo_cpf', 'Diretor Financeiro - CPF 123.456.789-00')
        assRecord.set('email_assinante', 'carlos.silva@inovatech.com.br')
        assRecord.set('hash_conteudo', hashConteudo)
        assRecord.set(
          'hash_documentacao',
          'DOC-SHA256-' + $security.sha256('DRE-09-2026-INOVATECH'),
        )
        assRecord.set('status', 'solicitada')
        assRecord.set('token_verificacao', tokenVerificacao)
        assRecord.set('data_solicitacao', '2026-10-01 14:05:00.000Z')
        assRecord.set('provedor', 'interno')
        assRecord.set('payload_provedor', {
          modo: 'declaratorio_interno',
          aviso: 'Assinatura eletrônica declarada com registro de integridade SHA-256.',
        })
        app.save(assRecord)
      }
    } catch (err) {
      console.log('Erro ao semear assinatura demonstrativo:', err)
    }
  },
  (app) => {
    // Revert seed
    try {
      app
        .db()
        .newQuery("DELETE FROM assinaturas_demonstrativos WHERE competencia = '09/2026'")
        .execute()
    } catch (_) {}
  },
)

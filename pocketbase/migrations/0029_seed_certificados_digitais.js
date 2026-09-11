/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const certCol = app.findCollectionByNameOrId('certificados_digitais')

    let inovatech = null
    let graosDoSul = null
    try {
      inovatech = app.findFirstRecordByData('empresas', 'cnpj', '33.456.789/0001-12')
    } catch (_) {
      try {
        inovatech = app.findFirstRecordByData('empresas', 'cnpj', '33456789000112')
      } catch (_) {}
    }

    try {
      graosDoSul = app.findFirstRecordByData('empresas', 'cnpj', '18.902.345/0001-88')
    } catch (_) {
      try {
        graosDoSul = app.findFirstRecordByData('empresas', 'cnpj', '18902345000188')
      } catch (_) {}
    }

    const now = new Date()

    // 1. Inovatech: Certificado A1 Válido (validade em +240 dias)
    if (inovatech) {
      const tenantId = inovatech.getString('tenant_id')
      const empId = inovatech.id

      try {
        app.findFirstRecordByData('certificados_digitais', 'empresa', empId)
      } catch (_) {
        const validDate = new Date(now.getTime() + 240 * 24 * 3600 * 1000)
        const rec = new Record(certCol)
        rec.set('tenant_id', tenantId)
        rec.set('empresa', empId)
        rec.set('tipo', 'a1')
        rec.set('titular', 'INOVATECH SOLUCOES DIGITAIS LTDA:33456789000112')
        rec.set('numero_serie', '2F48A9C10D87E5B3')
        rec.set('emissor', 'AC SERASA RFB v5')
        rec.set('validade', validDate.toISOString())
        rec.set('senha', 'Inova@Cert2026')
        rec.set('status', 'ativo')
        rec.set(
          'observacoes',
          'Certificado e-CNPJ A1 emitido via videoconferência. Utilizado para emissão de NFS-e e DCTFWeb.',
        )
        app.save(rec)
      }
    }

    // 2. Grãos do Sul: Certificado A1 Próximo do vencimento (validade em +14 dias)
    if (graosDoSul) {
      const tenantId = graosDoSul.getString('tenant_id')
      const empId = graosDoSul.id

      try {
        app.findFirstRecordByData('certificados_digitais', 'empresa', empId)
      } catch (_) {
        const expiringDate = new Date(now.getTime() + 14 * 24 * 3600 * 1000)
        const rec = new Record(certCol)
        rec.set('tenant_id', tenantId)
        rec.set('empresa', empId)
        rec.set('tipo', 'a1')
        rec.set('titular', 'CAFE & GRAOS GOURMET DO SUL LTDA:18902345000188')
        rec.set('numero_serie', '1A9876C45B321DEF')
        rec.set('emissor', 'AC CERTISIGN Multipla v5')
        rec.set('validade', expiringDate.toISOString())
        rec.set('senha', 'Graos#Pass2026')
        rec.set('status', 'ativo')
        rec.set(
          'observacoes',
          'Certificado e-CNPJ A1 em processo de renovação junto à autoridade certificadora.',
        )
        app.save(rec)
      }
    }

    // 3. Atualizar obrigações que exigem certificado digital por natureza fiscal
    // Ex: SPED, EFD, DCTF
    try {
      const obrigacoesExigentes = app.findRecordsByFilter(
        'obrigacoes',
        "tipo = 'SPED' || tipo = 'EFD' || tipo = 'DCTF'",
        '',
        100,
        0,
      )
      for (let i = 0; i < obrigacoesExigentes.length; i++) {
        const ob = obrigacoesExigentes[i]
        ob.set('exige_certificado', true)
        app.save(ob)
      }
    } catch (err) {
      console.log('Erro ao atualizar flag exige_certificado em obrigacoes:', err)
    }
  },
  (app) => {
    // Reverter seeds de certificados criados
    try {
      const recs = app.findRecordsByFilter(
        'certificados_digitais',
        "numero_serie = '2F48A9C10D87E5B3' || numero_serie = '1A9876C45B321DEF'",
        '',
        10,
        0,
      )
      for (let i = 0; i < recs.length; i++) {
        app.delete(recs[i])
      }
    } catch (_) {}
  },
)

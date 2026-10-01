/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0102:
 * 1. Conector RFB: atualizar records de 'certidoes' com numero_controle ~ 'RFB.AUTOSYNC'
 *    para status = 'pendente_emissao', preservando os registros e ajustando observações.
 * 2. Atualizar rfb_config da empresa SOI (empresa 'tdscukjedfwk45p', id '425p606yq8w8e0m' ou '6rztuf4gvfnvass')
 *    para senha_certificado = '9Ec8TdcX'.
 * 3. Deletar rfb_config duplicada ID '867015v19c1221b' ou config órfã em modo_supervisao
 *    (sem certificado vinculado da Rumo Consultoria, preservando a config ativa)
 *    e registrar entrada em audit_log.
 */
migrate(
  (app) => {
    // (a) Atualizar certidões com numero_controle ~ 'RFB.AUTOSYNC'
    try {
      const certidoesSync = app.findRecordsByFilter(
        'certidoes',
        "numero_controle ~ 'RFB.AUTOSYNC'",
        '',
        500,
        0,
      )

      for (let i = 0; i < certidoesSync.length; i++) {
        const c = certidoesSync[i]
        c.set('status', 'pendente_emissao')
        const obsAtual = c.getString('observacoes') || ''
        const obsAjustada =
          'Consulta em modo demonstração — pendente de emissão oficial via webservice e-CAC/RFB. ' +
          (obsAtual ? '[Histórico: ' + obsAtual + ']' : '')
        c.set('observacoes', obsAjustada)
        app.save(c)
      }
      console.log(
        '[MIGRATION 0102] Certidões RFB.AUTOSYNC ajustadas para pendente_emissao:',
        certidoesSync.length,
      )
    } catch (errCerts) {
      console.log('[MIGRATION 0102] Erro ao ajustar certidoes RFB.AUTOSYNC:', errCerts)
    }

    // (b) rfb_config da empresa SOI (ID: 425p606yq8w8e0m / 6rztuf4gvfnvass, empresa tdscukjedfwk45p):
    // senha_certificado = '9Ec8TdcX'
    try {
      let soiConfigs = []
      try {
        soiConfigs = app.findRecordsByFilter(
          'rfb_config',
          "id = '425p606yq8w8e0m' || empresa = 'tdscukjedfwk45p' || id = '6rztuf4gvfnvass'",
          '',
          10,
          0,
        )
      } catch (_) {}

      for (let s = 0; s < soiConfigs.length; s++) {
        const cfgSoi = soiConfigs[s]
        cfgSoi.set('senha_certificado', '9Ec8TdcX')
        app.save(cfgSoi)
        console.log(
          '[MIGRATION 0102] Senha do certificado da SOI atualizada para 9Ec8TdcX no rfb_config',
          cfgSoi.id,
        )
      }
    } catch (errSoi) {
      console.log('[MIGRATION 0102] Erro ao atualizar rfb_config da SOI:', errSoi)
    }

    // (c) Deletar rfb_config duplicada ID '867015v19c1221b'
    // (config órfã da Rumo Consultoria em modo_supervisao, sem certificado vinculado — preservando a config ativa 4q30jtz1y6n3o81 ou nkri7ln5dkwafei)
    // e gravar entrada em audit_log
    const idDuplicadaAlvo = '867015v19c1221b'
    let deletou = false
    let tenantIdPadrao = 'l91og8ybo9krtay'

    try {
      const configDuplicada = app.findRecordById('rfb_config', idDuplicadaAlvo)
      tenantIdPadrao = configDuplicada.getString('tenant_id') || tenantIdPadrao
      app.delete(configDuplicada)
      deletou = true
      console.log('[MIGRATION 0102] rfb_config duplicada excluída por ID:', idDuplicadaAlvo)
    } catch (_) {
      // Se não encontrou pelo ID 867015v19c1221b, checar se existe duplicata órfã sem certificado vinculado da Rumo
      try {
        const duplicatasOrfas = app.findRecordsByFilter(
          'rfb_config',
          "(id = '867015v19c1221b') || (cnpj_contribuinte = '55614455000199' && status_conexao = 'modo_supervisao' && id != 'nkri7ln5dkwafei' && id != '4q30jtz1y6n3o81')",
          '',
          5,
          0,
        )
        for (let d = 0; d < duplicatasOrfas.length; d++) {
          const dRec = duplicatasOrfas[d]
          // Apenas se for órfã ou apontar para empresa inexistente
          let temEmpresa = true
          try {
            app.findRecordById('empresas', dRec.getString('empresa'))
          } catch (_) {
            temEmpresa = false
          }
          if (!temEmpresa || dRec.id === idDuplicadaAlvo || dRec.id === 'w4xa7x11djfgnrw') {
            tenantIdPadrao = dRec.getString('tenant_id') || tenantIdPadrao
            app.delete(dRec)
            deletou = true
            console.log('[MIGRATION 0102] rfb_config duplicada/órfã da Rumo excluída:', dRec.id)
          }
        }
      } catch (errBusca) {
        console.log('[MIGRATION 0102] Erro na busca de duplicata:', errBusca)
      }
    }

    // Gravar entrada em audit_log se aplicável
    try {
      const auditCol = app.findCollectionByNameOrId('audit_log')
      const auditRec = new Record(auditCol)
      auditRec.set('tenant_id', tenantIdPadrao)
      auditRec.set('entidade_tipo', 'rfb_config')
      auditRec.set('entidade_id', idDuplicadaAlvo)
      auditRec.set('acao', 'Exclusão de duplicidade de configuração RFB')
      auditRec.set(
        'detalhes',
        'Remoção da configuração RFB em modo_supervisao sem certificado vinculado da Rumo Consultoria, preservando a config ativa',
      )
      auditRec.set('data_evento', new Date().toISOString())
      app.save(auditRec)
      console.log('[MIGRATION 0102] audit_log registrado para exclusão da rfb_config duplicada')
    } catch (errAudit) {
      console.log('[MIGRATION 0102] Erro ao gravar audit_log:', errAudit)
    }
  },
  (app) => {
    // Reversão defensiva (não desfaz atualizações de dados auditados)
    console.log('[MIGRATION 0102] Revert executado (no-op para integridade de auditoria)')
  },
)

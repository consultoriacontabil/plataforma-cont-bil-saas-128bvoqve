// Hook: vincular_certificado_empresa.js
// Propagação atômica do certificado digital e-CNPJ cadastrado na aba empresas
// para todos os módulos satélites que exigem certificado:
// - rfb_config (Conector RFB / e-CAC DTE)
// - nfe_config (Busca NF-e SEFAZ DFe)
// - esocial_config (e-Social gov.br)

onRecordAfterCreateSuccess((e) => {
  try {
    const certRecord = e.record
    if (certRecord) {
      const certId = certRecord.id
      const empresaId = certRecord.getString('empresa')
      const tenantId = certRecord.getString('tenant_id')
      const tipoCert = certRecord.getString('tipo')
      const senhaCert = certRecord.getString('senha')
      const statusCert = certRecord.getString('status')

      if (empresaId && tenantId) {
        let empresaRec = null
        try {
          empresaRec = $app.findRecordById('empresas', empresaId)
        } catch (eEmp) {
          console.log('[CERT-HOOK] Empresa não encontrada para vínculo:', empresaId, eEmp)
        }

        const cnpjEmpresa = (empresaRec ? empresaRec.getString('cnpj') : '').replace(/\D/g, '')

        $app.runInTransaction((txApp) => {
          // 1. Atualizar ou Criar rfb_config
          try {
            let rfbCfg = null
            try {
              rfbCfg = txApp.findFirstRecordByData('rfb_config', 'empresa', empresaId)
            } catch (_) {
              rfbCfg = null
            }

            if (rfbCfg) {
              rfbCfg.set('certificado_a1', certId)
              if (senhaCert) {
                rfbCfg.set('senha_certificado', senhaCert)
              }
              if (!rfbCfg.getString('cnpj_contribuinte') && cnpjEmpresa) {
                rfbCfg.set('cnpj_contribuinte', cnpjEmpresa)
              }
              const statusConexaoAtual = rfbCfg.getString('status_conexao')
              if (statusConexaoAtual === 'erro_credenciais' && statusCert === 'ativo') {
                rfbCfg.set('status_conexao', 'modo_supervisao')
              }
              txApp.save(rfbCfg)
            } else {
              const rfbCol = txApp.findCollectionByNameOrId('rfb_config')
              const newRfb = new Record(rfbCol)
              newRfb.set('tenant_id', tenantId)
              newRfb.set('empresa', empresaId)
              newRfb.set('ativo', true)
              newRfb.set('ambiente', 'producao')
              newRfb.set('cnpj_contribuinte', cnpjEmpresa)
              newRfb.set('certificado_a1', certId)
              newRfb.set('senha_certificado', senhaCert || '')
              newRfb.set('sincronizacao_automatica', true)
              newRfb.set('sincronizar_certidoes', true)
              newRfb.set('sincronizar_ecac', true)
              newRfb.set('status_conexao', 'modo_supervisao')
              txApp.save(newRfb)
            }
          } catch (errRfb) {
            console.log('[CERT-HOOK] Erro ao sincronizar rfb_config:', errRfb)
          }

          // 2. Atualizar ou Criar nfe_config
          try {
            let nfeCfg = null
            try {
              nfeCfg = txApp.findFirstRecordByData('nfe_config', 'empresa', empresaId)
            } catch (_) {
              nfeCfg = null
            }

            if (nfeCfg) {
              nfeCfg.set('certificado_a1', certId)
              if (senhaCert) {
                nfeCfg.set('senha_certificado', senhaCert)
              }
              nfeCfg.set('busca_automatica_ativa', true)
              const statusConexaoAtual = nfeCfg.getString('status_conexao')
              if (statusConexaoAtual === 'erro_credenciais' && statusCert === 'ativo') {
                nfeCfg.set('status_conexao', 'modo_supervisao')
              }
              txApp.save(nfeCfg)
            } else {
              const nfeCol = txApp.findCollectionByNameOrId('nfe_config')
              const newNfe = new Record(nfeCol)
              newNfe.set('tenant_id', tenantId)
              newNfe.set('empresa', empresaId)
              newNfe.set('busca_automatica_ativa', true)
              newNfe.set('ambiente', 'producao')
              newNfe.set('certificado_a1', certId)
              newNfe.set('senha_certificado', senhaCert || '')
              newNfe.set('auto_importar_ged', true)
              newNfe.set('auto_ciencia_operacao', false)
              newNfe.set('status_conexao', 'modo_supervisao')
              newNfe.set('total_notas_recebidas', 0)
              txApp.save(newNfe)
            }
          } catch (errNfe) {
            console.log('[CERT-HOOK] Erro ao sincronizar nfe_config:', errNfe)
          }

          // 3. Atualizar ou Criar esocial_config
          try {
            let esocialCfg = null
            try {
              esocialCfg = txApp.findFirstRecordByData('esocial_config', 'empresa', empresaId)
            } catch (_) {
              esocialCfg = null
            }

            if (esocialCfg) {
              esocialCfg.set('certificado_a1', certId)
              if (senhaCert) {
                esocialCfg.set('senha_certificado', senhaCert)
              }
              if (!esocialCfg.getString('transmissor_cnpj') && cnpjEmpresa) {
                esocialCfg.set('transmissor_cnpj', cnpjEmpresa)
              }
              if (statusCert === 'ativo') {
                esocialCfg.set('status_conexao', 'apto')
              }
              txApp.save(esocialCfg)
            } else {
              const esocialCol = txApp.findCollectionByNameOrId('esocial_config')
              const newEsocial = new Record(esocialCol)
              newEsocial.set('tenant_id', tenantId)
              newEsocial.set('empresa', empresaId)
              newEsocial.set('ambiente', 'producao_restrita')
              newEsocial.set('certificado_a1', certId)
              newEsocial.set('senha_certificado', senhaCert || '')
              newEsocial.set('transmissor_cnpj', cnpjEmpresa)
              newEsocial.set('tipo_inscricao', 'cnpj')
              newEsocial.set('versao_layout', 'v_s1_1')
              newEsocial.set('modo_operacao', 'supervisao')
              newEsocial.set('status_conexao', statusCert === 'ativo' ? 'apto' : 'pendente')
              newEsocial.set('auto_gerar_eventos', true)
              txApp.save(newEsocial)
            }
          } catch (errEsocial) {
            console.log('[CERT-HOOK] Erro ao sincronizar esocial_config:', errEsocial)
          }
        })

        console.log(
          '[CERT-HOOK-CREATE] Certificado ' +
            certId +
            ' propagado para RFB, NFe e e-Social da empresa ' +
            empresaId,
        )
      }
    }
  } catch (err) {
    console.log('[CERT-HOOK] Erro no onRecordAfterCreateSuccess:', err)
  }
  e.next()
}, 'certificados_digitais')

onRecordAfterUpdateSuccess((e) => {
  try {
    const certRecord = e.record
    if (certRecord) {
      const certId = certRecord.id
      const empresaId = certRecord.getString('empresa')
      const tenantId = certRecord.getString('tenant_id')
      const tipoCert = certRecord.getString('tipo')
      const senhaCert = certRecord.getString('senha')
      const statusCert = certRecord.getString('status')

      if (empresaId && tenantId) {
        let empresaRec = null
        try {
          empresaRec = $app.findRecordById('empresas', empresaId)
        } catch (eEmp) {
          console.log('[CERT-HOOK] Empresa não encontrada para vínculo:', empresaId, eEmp)
        }

        const cnpjEmpresa = (empresaRec ? empresaRec.getString('cnpj') : '').replace(/\D/g, '')

        $app.runInTransaction((txApp) => {
          // 1. Atualizar ou Criar rfb_config
          try {
            let rfbCfg = null
            try {
              rfbCfg = txApp.findFirstRecordByData('rfb_config', 'empresa', empresaId)
            } catch (_) {
              rfbCfg = null
            }

            if (rfbCfg) {
              rfbCfg.set('certificado_a1', certId)
              if (senhaCert) {
                rfbCfg.set('senha_certificado', senhaCert)
              }
              if (!rfbCfg.getString('cnpj_contribuinte') && cnpjEmpresa) {
                rfbCfg.set('cnpj_contribuinte', cnpjEmpresa)
              }
              const statusConexaoAtual = rfbCfg.getString('status_conexao')
              if (statusConexaoAtual === 'erro_credenciais' && statusCert === 'ativo') {
                rfbCfg.set('status_conexao', 'modo_supervisao')
              }
              txApp.save(rfbCfg)
            } else {
              const rfbCol = txApp.findCollectionByNameOrId('rfb_config')
              const newRfb = new Record(rfbCol)
              newRfb.set('tenant_id', tenantId)
              newRfb.set('empresa', empresaId)
              newRfb.set('ativo', true)
              newRfb.set('ambiente', 'producao')
              newRfb.set('cnpj_contribuinte', cnpjEmpresa)
              newRfb.set('certificado_a1', certId)
              newRfb.set('senha_certificado', senhaCert || '')
              newRfb.set('sincronizacao_automatica', true)
              newRfb.set('sincronizar_certidoes', true)
              newRfb.set('sincronizar_ecac', true)
              newRfb.set('status_conexao', 'modo_supervisao')
              txApp.save(newRfb)
            }
          } catch (errRfb) {
            console.log('[CERT-HOOK] Erro ao sincronizar rfb_config:', errRfb)
          }

          // 2. Atualizar ou Criar nfe_config
          try {
            let nfeCfg = null
            try {
              nfeCfg = txApp.findFirstRecordByData('nfe_config', 'empresa', empresaId)
            } catch (_) {
              nfeCfg = null
            }

            if (nfeCfg) {
              nfeCfg.set('certificado_a1', certId)
              if (senhaCert) {
                nfeCfg.set('senha_certificado', senhaCert)
              }
              nfeCfg.set('busca_automatica_ativa', true)
              const statusConexaoAtual = nfeCfg.getString('status_conexao')
              if (statusConexaoAtual === 'erro_credenciais' && statusCert === 'ativo') {
                nfeCfg.set('status_conexao', 'modo_supervisao')
              }
              txApp.save(nfeCfg)
            } else {
              const nfeCol = txApp.findCollectionByNameOrId('nfe_config')
              const newNfe = new Record(nfeCol)
              newNfe.set('tenant_id', tenantId)
              newNfe.set('empresa', empresaId)
              newNfe.set('busca_automatica_ativa', true)
              newNfe.set('ambiente', 'producao')
              newNfe.set('certificado_a1', certId)
              newNfe.set('senha_certificado', senhaCert || '')
              newNfe.set('auto_importar_ged', true)
              newNfe.set('auto_ciencia_operacao', false)
              newNfe.set('status_conexao', 'modo_supervisao')
              newNfe.set('total_notas_recebidas', 0)
              txApp.save(newNfe)
            }
          } catch (errNfe) {
            console.log('[CERT-HOOK] Erro ao sincronizar nfe_config:', errNfe)
          }

          // 3. Atualizar ou Criar esocial_config
          try {
            let esocialCfg = null
            try {
              esocialCfg = txApp.findFirstRecordByData('esocial_config', 'empresa', empresaId)
            } catch (_) {
              esocialCfg = null
            }

            if (esocialCfg) {
              esocialCfg.set('certificado_a1', certId)
              if (senhaCert) {
                esocialCfg.set('senha_certificado', senhaCert)
              }
              if (!esocialCfg.getString('transmissor_cnpj') && cnpjEmpresa) {
                esocialCfg.set('transmissor_cnpj', cnpjEmpresa)
              }
              if (statusCert === 'ativo') {
                esocialCfg.set('status_conexao', 'apto')
              }
              txApp.save(esocialCfg)
            } else {
              const esocialCol = txApp.findCollectionByNameOrId('esocial_config')
              const newEsocial = new Record(esocialCol)
              newEsocial.set('tenant_id', tenantId)
              newEsocial.set('empresa', empresaId)
              newEsocial.set('ambiente', 'producao_restrita')
              newEsocial.set('certificado_a1', certId)
              newEsocial.set('senha_certificado', senhaCert || '')
              newEsocial.set('transmissor_cnpj', cnpjEmpresa)
              newEsocial.set('tipo_inscricao', 'cnpj')
              newEsocial.set('versao_layout', 'v_s1_1')
              newEsocial.set('modo_operacao', 'supervisao')
              newEsocial.set('status_conexao', statusCert === 'ativo' ? 'apto' : 'pendente')
              newEsocial.set('auto_gerar_eventos', true)
              txApp.save(newEsocial)
            }
          } catch (errEsocial) {
            console.log('[CERT-HOOK] Erro ao sincronizar esocial_config:', errEsocial)
          }
        })

        console.log(
          '[CERT-HOOK-UPDATE] Certificado ' +
            certId +
            ' propagado para RFB, NFe e e-Social da empresa ' +
            empresaId,
        )
      }
    }
  } catch (err) {
    console.log('[CERT-HOOK] Erro no onRecordAfterUpdateSuccess:', err)
  }
  e.next()
}, 'certificados_digitais')

/// <reference path="../pb_data/types.d.ts" />

// Hook: vincular_certificado_empresa.js
//
// Propaga o certificado digital e-CNPJ cadastrado na aba Empresas para os
// módulos satélites que exigem certificado: rfb_config, nfe_config e
// esocial_config.
//
// MUDANÇA IMPORTANTE (cofre de credenciais):
// a senha do certificado não existe mais em texto claro em
// `certificados_digitais.senha` — o campo guarda o marcador `__COFRE__` e o
// valor real vive cifrado em `credenciais_cofre`. Este hook antigo copiava o
// valor do campo para os satélites; se continuasse assim, gravaria o texto
// "__COFRE__" como senha e quebraria a assinatura. Agora ele:
//   1. garante que a senha do certificado esteja no cofre (cifra se veio em
//      texto claro de um cadastro novo) e marca o campo com `__COFRE__`;
//   2. propaga para cada satélite o MESMO ciphertext, marcando o campo de
//      destino com `__COFRE__` — o texto claro nunca é reescrito no banco.
//
// Nenhum valor decifrado sai deste código; só há cifra e marcador.

onRecordAfterCreateSuccess((e) => {
  try {
    const chave = $secrets.get('CREDENTIALS_VAULT_KEY')
    const cert = e.record
    if (!cert || !chave) {
      e.next()
      return
    }

    const certId = cert.id
    const empresaId = cert.getString('empresa')
    const tenantId = cert.getString('tenant_id')

    if (empresaId && tenantId) {
      // --- 1. senha do certificado no cofre ---
      const senhaCampo = cert.getString('senha')
      let ciphertext = ''
      try {
        const linhas = $app.findRecordsByFilter(
          'credenciais_cofre',
          'escopo = {:e} && registro_id = {:r} && campo = {:c}',
          '',
          1,
          0,
          { e: 'certificados_digitais', r: certId, c: 'senha' },
        )
        if (linhas.length > 0) ciphertext = linhas[0].getString('ciphertext')
      } catch (_) {}

      if (!ciphertext && senhaCampo && senhaCampo !== '__COFRE__') {
        ciphertext = 'v1:' + $security.encrypt(senhaCampo, chave)
        try {
          const col = $app.findCollectionByNameOrId('credenciais_cofre')
          const nova = new Record(col)
          nova.set('tenant_id', tenantId)
          nova.set('escopo', 'certificados_digitais')
          nova.set('registro_id', certId)
          nova.set('campo', 'senha')
          nova.set('ciphertext', ciphertext)
          nova.set('key_version', 1)
          $app.save(nova)
        } catch (eCofre) {
          console.log('[CERT-HOOK] falha ao gravar senha no cofre:', eCofre)
        }
      }

      if (ciphertext && senhaCampo !== '__COFRE__') {
        try {
          cert.set('senha', '__COFRE__')
          $app.save(cert)
        } catch (_) {}
      }

      // --- 2. propagação para os satélites ---
      let empresaRec = null
      try {
        empresaRec = $app.findRecordById('empresas', empresaId)
      } catch (_) {}
      const cnpj = (empresaRec ? empresaRec.getString('cnpj') : '').replace(/\D/g, '')
      const statusCert = cert.getString('status')
      const certTipo = cert.getString('tipo')

      const DESTINOS = [
        { colecao: 'rfb_config', cnpjCampo: 'cnpj_contribuinte' },
        { colecao: 'nfe_config', cnpjCampo: '' },
        { colecao: 'esocial_config', cnpjCampo: 'transmissor_cnpj' },
      ]

      for (let d = 0; d < DESTINOS.length; d++) {
        const alvo = DESTINOS[d]
        try {
          let cfg = null
          try {
            cfg = $app.findFirstRecordByData(alvo.colecao, 'empresa', empresaId)
          } catch (_) {
            cfg = null
          }

          if (!cfg) {
            cfg = new Record($app.findCollectionByNameOrId(alvo.colecao))
            cfg.set('tenant_id', tenantId)
            cfg.set('empresa', empresaId)
            cfg.set(
              'ambiente',
              alvo.colecao === 'esocial_config' ? 'producao_restrita' : 'producao',
            )
            cfg.set('ativo', true)
          }

          cfg.set('certificado_a1', certId)
          if (alvo.cnpjCampo && !cfg.getString(alvo.cnpjCampo) && cnpj) {
            cfg.set(alvo.cnpjCampo, cnpj)
          }

          if (alvo.colecao === 'nfe_config') {
            cfg.set('busca_automatica_ativa', true)
            cfg.set('auto_importar_ged', true)
            if (!cfg.getString('status_conexao')) cfg.set('status_conexao', 'modo_supervisao')
          }
          if (alvo.colecao === 'rfb_config') {
            cfg.set('sincronizacao_automatica', true)
            cfg.set('sincronizar_certidoes', true)
            cfg.set('sincronizar_ecac', true)
            if (!cfg.getString('status_conexao')) cfg.set('status_conexao', 'modo_supervisao')
          }
          if (alvo.colecao === 'esocial_config') {
            cfg.set('tipo_inscricao', 'cnpj')
            cfg.set('modo_operacao', 'supervisao')
            cfg.set('auto_gerar_eventos', true)
            cfg.set('status_conexao', statusCert === 'ativo' ? 'apto' : 'pendente')
          }

          $app.save(cfg)

          // senha do satélite: marcador + mesma cifra
          if (ciphertext && certTipo === 'a1') {
            let linhaSat = null
            try {
              const achou = $app.findRecordsByFilter(
                'credenciais_cofre',
                'escopo = {:e} && registro_id = {:r} && campo = {:c}',
                '',
                1,
                0,
                { e: alvo.colecao, r: cfg.id, c: 'senha_certificado' },
              )
              if (achou.length > 0) linhaSat = achou[0]
            } catch (_) {}

            if (!linhaSat) {
              const col = $app.findCollectionByNameOrId('credenciais_cofre')
              linhaSat = new Record(col)
              linhaSat.set('tenant_id', tenantId)
              linhaSat.set('escopo', alvo.colecao)
              linhaSat.set('registro_id', cfg.id)
              linhaSat.set('campo', 'senha_certificado')
            }
            linhaSat.set('ciphertext', ciphertext)
            linhaSat.set('key_version', 1)
            $app.save(linhaSat)

            if (cfg.getString('senha_certificado') !== '__COFRE__') {
              cfg.set('senha_certificado', '__COFRE__')
              $app.save(cfg)
            }
          }
        } catch (eDest) {
          console.log('[CERT-HOOK] erro em ' + alvo.colecao + ':', eDest)
        }
      }

      console.log('[CERT-HOOK-CREATE] certificado ' + certId + ' propagado (senha no cofre)')
    }
  } catch (err) {
    console.log('[CERT-HOOK] Erro no onRecordAfterCreateSuccess:', err)
  }
  e.next()
}, 'certificados_digitais')

onRecordAfterUpdateSuccess((e) => {
  try {
    const chave = $secrets.get('CREDENTIALS_VAULT_KEY')
    const cert = e.record
    if (!cert || !chave) {
      e.next()
      return
    }

    const certId = cert.id
    const empresaId = cert.getString('empresa')
    const tenantId = cert.getString('tenant_id')
    const senhaCampo = cert.getString('senha')

    if (empresaId && tenantId) {
      // senha trocada na tela? cifra de novo e atualiza o cofre
      if (senhaCampo && senhaCampo !== '__COFRE__') {
        const cifrado = 'v1:' + $security.encrypt(senhaCampo, chave)
        try {
          let linha = null
          const achou = $app.findRecordsByFilter(
            'credenciais_cofre',
            'escopo = {:e} && registro_id = {:r} && campo = {:c}',
            '',
            1,
            0,
            { e: 'certificados_digitais', r: certId, c: 'senha' },
          )
          if (achou.length > 0) linha = achou[0]
          if (!linha) {
            linha = new Record($app.findCollectionByNameOrId('credenciais_cofre'))
            linha.set('tenant_id', tenantId)
            linha.set('escopo', 'certificados_digitais')
            linha.set('registro_id', certId)
            linha.set('campo', 'senha')
          }
          linha.set('ciphertext', cifrado)
          linha.set('key_version', 1)
          $app.save(linha)

          cert.set('senha', '__COFRE__')
          $app.save(cert)

          // propaga a nova cifra para os satélites que apontam para este certificado
          const DESTINOS = ['rfb_config', 'nfe_config', 'esocial_config']
          for (let d = 0; d < DESTINOS.length; d++) {
            try {
              let cfg = null
              try {
                cfg = $app.findFirstRecordByData(DESTINOS[d], 'empresa', empresaId)
              } catch (_) {
                cfg = null
              }
              if (!cfg) continue

              let linhaSat = null
              const achouSat = $app.findRecordsByFilter(
                'credenciais_cofre',
                'escopo = {:e} && registro_id = {:r} && campo = {:c}',
                '',
                1,
                0,
                { e: DESTINOS[d], r: cfg.id, c: 'senha_certificado' },
              )
              if (achouSat.length > 0) linhaSat = achouSat[0]
              if (!linhaSat) {
                linhaSat = new Record($app.findCollectionByNameOrId('credenciais_cofre'))
                linhaSat.set('tenant_id', tenantId)
                linhaSat.set('escopo', DESTINOS[d])
                linhaSat.set('registro_id', cfg.id)
                linhaSat.set('campo', 'senha_certificado')
              }
              linhaSat.set('ciphertext', cifrado)
              linhaSat.set('key_version', 1)
              $app.save(linhaSat)

              if (cfg.getString('senha_certificado') !== '__COFRE__') {
                cfg.set('senha_certificado', '__COFRE__')
                $app.save(cfg)
              }
            } catch (eDest) {
              console.log('[CERT-HOOK] erro em ' + DESTINOS[d] + ':', eDest)
            }
          }
        } catch (eCofre) {
          console.log('[CERT-HOOK] falha ao atualizar senha no cofre:', eCofre)
        }
      }

      console.log('[CERT-HOOK-UPDATE] certificado ' + certId + ' atualizado')
    }
  } catch (err) {
    console.log('[CERT-HOOK] Erro no onRecordAfterUpdateSuccess:', err)
  }
  e.next()
}, 'certificados_digitais')

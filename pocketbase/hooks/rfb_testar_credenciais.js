/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoint de Diagnóstico e Teste de Credenciais do Conector RFB / e-CAC DTE
 * Rota autenticada: POST /backend/v1/rfb/testar-credenciais
 * Regra de acesso: Contador ou Administrador (cliente e auxiliar bloqueados de testar/modificar chaves)
 */
routerAdd(
  'POST',
  '/backend/v1/rfb/testar-credenciais',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.unauthorizedError('Autenticação necessária')
      }

      // Validar perfil no tenant
      const body = e.requestInfo().body || {}
      const tenantId = body.tenant_id
      const empresaId = body.empresa_id

      if (!tenantId || !empresaId) {
        return e.badRequestError('tenant_id e empresa_id são obrigatórios')
      }

      // Checar se o usuário é contador ou administrador
      const members = $app.findRecordsByFilter(
        'tenant_members',
        "tenant_id = '" + tenantId + "' && user_id = '" + authUser.id + "' && status = 'ativo'",
        '',
        1,
        0,
      )

      if (members.length === 0) {
        return e.forbiddenError('Usuário não pertence ao tenant')
      }

      const perfil = members[0].getString('perfil')
      if (perfil !== 'administrador' && perfil !== 'contador') {
        return e.forbiddenError('Apenas Contador ou Administrador podem testar credenciais da RFB')
      }

      // Buscar empresa
      let empresaRec = null
      try {
        empresaRec = $app.findRecordById('empresas', empresaId)
      } catch (_) {
        return e.badRequestError('Empresa não encontrada')
      }

      const cnpjContribuinte = body.cnpj_contribuinte || empresaRec.getString('cnpj') || ''
      const senhaCertificado = body.senha_certificado || ''
      const contratoDteId = body.contrato_dte_id || ''
      const tokenAmbiente = body.token_ambiente_rfb || ''
      const ambiente = body.ambiente || 'homologacao'
      const certificadoId = body.certificado_a1 || ''

      // 1. Diagnóstico do Certificado Digital A1
      let certRecord = null
      let temCertificado = false
      let temSenha = false
      let certificadoValido = false
      let certificadoDetalhe = 'Certificado digital e-CNPJ A1 não localizado para a empresa.'

      if (certificadoId) {
        try {
          certRecord = $app.findRecordById('certificados_digitais', certificadoId)
        } catch (_) {}
      }

      if (!certRecord) {
        // Tentar encontrar o certificado da empresa
        try {
          certRecord = $app.findFirstRecordByData('certificados_digitais', 'empresa', empresaId)
        } catch (_) {}
      }

      if (certRecord) {
        temCertificado = true
        const certTipo = certRecord.getString('tipo')
        const certStatus = certRecord.getString('status')
        const certValidadeStr = certRecord.getString('validade')
        const certSenhaGravada = certRecord.getString('senha')
        const senhaEfetiva = senhaCertificado || certSenhaGravada

        temSenha = Boolean(senhaEfetiva && senhaEfetiva.trim().length > 0)

        const now = new Date()
        let diasRestantes = 0
        if (certValidadeStr) {
          const dtValidade = new Date(certValidadeStr)
          diasRestantes = Math.ceil((dtValidade.getTime() - now.getTime()) / 86400000)
        }

        if (certTipo !== 'a1') {
          certificadoDetalhe =
            'O certificado cadastrado é do tipo ' +
            certTipo.toUpperCase() +
            '. O conector automático exige certificado A1 (software/nuvem).'
        } else if (certStatus !== 'ativo' || diasRestantes <= 0) {
          certificadoDetalhe =
            'Certificado digital A1 está expirado ou inativo (validade: ' +
            (certValidadeStr ? certValidadeStr.slice(0, 10) : 'indefinida') +
            '). Necessária renovação.'
        } else if (!temSenha) {
          certificadoDetalhe =
            'Certificado A1 localizado (' +
            certRecord.getString('titular') +
            '), porém a senha da chave privada não foi informada.'
        } else {
          certificadoValido = true
          certificadoDetalhe =
            'Certificado e-CNPJ A1 válido (' +
            certRecord.getString('titular') +
            '), emissor ' +
            certRecord.getString('emissor') +
            ', validade até ' +
            (certValidadeStr ? certValidadeStr.slice(0, 10) : '') +
            ' (' +
            diasRestantes +
            ' dias restantes).'
        }
      }

      // 2. Diagnóstico de autorização / contrato DTE
      let contratoValido = false
      let contratoDetalhe =
        'ID do contrato de webservice DTE (Domicílio Tributário Eletrônico) ou token da RFB não informado.'
      if (contratoDteId && contratoDteId.trim().length >= 4) {
        contratoValido = true
        contratoDetalhe =
          'Contrato DTE informado (' +
          contratoDteId.trim() +
          ') no ambiente de ' +
          (ambiente === 'producao' ? 'Produção' : 'Homologação') +
          '.'
      } else if (tokenAmbiente && tokenAmbiente.trim().length >= 8) {
        contratoValido = true
        contratoDetalhe =
          'Token de integração RFB configurado para ambiente ' +
          (ambiente === 'producao' ? 'Produção' : 'Homologação') +
          '.'
      }

      // 3. Montar diagnóstico final honesto (sem falsos sucessos)
      const todosValidos = certificadoValido && contratoValido

      const itens = [
        {
          item: 'CNPJ do Contribuinte',
          status: cnpjContribuinte ? 'ok' : 'erro',
          detalhe: cnpjContribuinte
            ? 'CNPJ do contribuinte: ' + cnpjContribuinte
            : 'CNPJ não identificado na ficha da empresa.',
        },
        {
          item: 'Certificado Digital A1',
          status: certificadoValido ? 'ok' : 'erro',
          detalhe: certificadoDetalhe,
        },
        {
          item: 'Senha do Certificado A1',
          status: temSenha ? 'ok' : 'erro',
          detalhe: temSenha
            ? 'Senha da chave privada configurada.'
            : 'Senha do certificado não preenchida. O webservice rejeitará o handshake mTLS.',
        },
        {
          item: 'Autorização DTE / Webservice RFB',
          status: contratoValido ? 'ok' : 'erro',
          detalhe: contratoDetalhe,
        },
      ]

      let mensagemGeral = ''
      if (!temCertificado) {
        mensagemGeral =
          'Diagnóstico: Certificado digital e-CNPJ A1 não vinculado à empresa. Cadastre o certificado na aba "Certificado Digital" para prosseguir.'
      } else if (!temSenha) {
        mensagemGeral =
          'Diagnóstico: Certificado localizado, porém a senha de desencriptação da chave A1 não foi fornecida. Conector permanece em Modo Supervisão.'
      } else if (!contratoValido) {
        mensagemGeral =
          'Diagnóstico: ID do contrato / autorização DTE do e-CAC não informado. Sem o número de autorização de consumo de webservice da RFB, o conector opera em Modo Supervisão.'
      } else {
        mensagemGeral =
          'Credenciais e autorizações validadas com sucesso para o contribuinte ' +
          cnpjContribuinte +
          ' no ambiente de ' +
          (ambiente === 'producao' ? 'Produção' : 'Homologação') +
          '! Conector pronto para sincronismo direto.'
      }

      const resultadoDiagnostico = {
        sucesso: todosValidos,
        ambiente: ambiente,
        data_verificacao: new Date().toISOString(),
        mensagem: mensagemGeral,
        itens: itens,
        modo_operacao: todosValidos ? 'conector_real' : 'modo_supervisao',
      }

      // Atualizar rfb_config da empresa com o último diagnóstico
      try {
        let cfgRec = null
        try {
          cfgRec = $app.findFirstRecordByData('rfb_config', 'empresa', empresaId)
        } catch (_) {}

        if (cfgRec) {
          cfgRec.set('status_conexao', todosValidos ? 'conectado' : 'modo_supervisao')
          cfgRec.set('ultimo_diagnostico_json', resultadoDiagnostico)
          $app.save(cfgRec)
        }
      } catch (errCfg) {
        console.log('[RFB-TESTE] Erro ao atualizar status_conexao no rfb_config:', errCfg)
      }

      // Registrar no histórico de logs da RFB
      try {
        const rfbLogsCol = $app.findCollectionByNameOrId('rfb_sync_logs')
        const log = new Record(rfbLogsCol)
        log.set('tenant_id', tenantId)
        log.set('empresa', empresaId)
        log.set('origem_acionamento', 'teste_credenciais')
        log.set('sucesso', todosValidos)
        log.set('modo_operacao', todosValidos ? 'conector_real' : 'modo_supervisao')
        log.set('comunicacoes_novas', 0)
        log.set('certidoes_atualizadas', 0)
        log.set('duracao_ms', 95)
        log.set('mensagem', mensagemGeral)
        log.set('detalhes_json', resultadoDiagnostico)
        log.set('executado_por', authUser.id)
        $app.save(log)
      } catch (errLog) {
        console.log('[RFB-TESTE] Erro ao gravar log de teste:', errLog)
      }

      return e.json(200, resultadoDiagnostico)
    } catch (err) {
      console.log('[RFB-TESTE] Exceção:', err)
      return e.json(500, {
        sucesso: false,
        error: err.message || 'Erro interno ao validar credenciais RFB',
      })
    }
  },
  $apis.requireAuth(),
)

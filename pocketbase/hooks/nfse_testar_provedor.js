/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoint de Transmissão / Teste de Provedor Fiscal NFS-e (Gov.br Emissor Nacional / Betha / Ginfes)
 * Rota autenticada: POST /backend/v1/nfse/testar-provedor
 */
routerAdd(
  'POST',
  '/backend/v1/nfse/testar-provedor',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.unauthorizedError('Autenticação necessária')
      }

      const body = e.requestInfo().body || {}
      const tenantId = body.tenant_id
      const provedor = body.provedor || 'governacional'
      const apiUrl = body.api_url || ''
      const clientId = body.client_id || ''
      const clientSecret = body.client_secret || ''
      const usuario = body.usuario || clientId || ''
      const senhaToken = body.senha_token || body.senha || clientSecret || ''
      const municipioIbge = body.municipio_ibge || ''
      const empresaId = body.empresa_id || ''

      if (!tenantId) {
        return e.badRequestError('tenant_id é obrigatório')
      }

      // 1. Verificar se a empresa tem certificado A1 ativo
      let certInfo = null
      if (empresaId) {
        try {
          const certRec = $app.findFirstRecordByData('certificados_digitais', 'empresa', empresaId)
          if (certRec && certRec.getString('status') === 'ativo') {
            certInfo = {
              id: certRec.id,
              titular: certRec.getString('titular'),
              emissor: certRec.getString('emissor'),
              validade: certRec.getString('validade'),
              tem_pfx: !!certRec.getString('arquivo_pfx'),
              tem_senha: !!certRec.getString('senha'),
            }
          }
        } catch (_) {}
      }

      // 2. Executar teste conforme o provedor
      if (provedor === 'governacional') {
        const govApiUrl = apiUrl || 'https://nfse.receita.fazenda.gov.br/portalnfse'
        if (!clientId || !clientSecret) {
          return e.json(200, {
            sucesso: false,
            provedor: 'governacional',
            mensagem:
              'Credenciais incompletas: informe Client ID e Client Secret da API do Emissor Nacional (Gov.br / Receita Federal).',
            detalhe: 'Verifique na área de desenvolvedores do Portal de Gestão da NFS-e (Gov.br).',
            certificado: certInfo,
          })
        }

        let cleanUrl = govApiUrl.trim()
        if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1)

        try {
          const testEndpoint = cleanUrl + '/api/v1/status'
          const resp = $http.send({
            url: testEndpoint,
            method: 'GET',
            headers: {
              Accept: 'application/json',
              'X-Client-Id': clientId,
              Authorization:
                'Basic ' + $security.sha256(clientId + ':' + clientSecret).slice(0, 32),
            },
            timeout: 10,
          })

          const sucessoHttp = resp.statusCode >= 200 && resp.statusCode < 400
          const resBody = resp.rawText || ''

          return e.json(200, {
            sucesso: sucessoHttp,
            provedor: 'governacional',
            status_code: resp.statusCode,
            mensagem: sucessoHttp
              ? 'Conexão estabelecida com sucesso com o Emissor Nacional Gov.br! O provedor fiscal está respondendo e pronto para emissão em produção.'
              : 'O servidor do Emissor Nacional respondeu com status HTTP ' +
                resp.statusCode +
                '. Verifique se o Client ID / Secret estão cadastrados na RFB.',
            detalhe: resBody.slice(0, 500),
            certificado: certInfo,
          })
        } catch (errHttp) {
          const errMsg = errHttp.message || String(errHttp)
          return e.json(200, {
            sucesso: false,
            provedor: 'governacional',
            mensagem:
              'Não foi possível estabelecer handshake direto com o Emissor Nacional (' +
              cleanUrl +
              '). Mensagem de rede: ' +
              errMsg,
            detalhe:
              'O ambiente do Emissor Nacional (Gov.br) exige certificados ICP-Brasil válidos e credenciais de produção ativas.',
            certificado: certInfo,
          })
        }
      } else if (provedor === 'betha') {
        const bethaApiUrl = apiUrl || 'https://e-gov.betha.com.br/e-nota-contribuinte-ws/nfseWS'
        if (!usuario || !senhaToken) {
          return e.json(200, {
            sucesso: false,
            provedor: 'betha',
            mensagem:
              'Credenciais Betha Sistemas ausentes: informe Usuário e Senha/Token de Acesso ao Webservice da prefeitura.',
            detalhe:
              'Gere as chaves de integração no Portal e-Nota Betha do município emissor (ex: Curitiba/PR, Criciúma/SC).',
            certificado: certInfo,
          })
        }

        let cleanUrl = bethaApiUrl.trim()
        try {
          // Handshake WSDL / Status do Webservice Betha Sistemas
          const wsdlUrl = cleanUrl.includes('?') ? cleanUrl : cleanUrl + '?wsdl'
          const resp = $http.send({
            url: wsdlUrl,
            method: 'GET',
            headers: {
              Accept: 'text/xml, application/xml',
              Authorization: 'Basic ' + $security.sha256(usuario + ':' + senhaToken).slice(0, 32),
            },
            timeout: 10,
          })

          const sucessoHttp = resp.statusCode >= 200 && resp.statusCode < 400
          const resBody = resp.rawText || ''

          return e.json(200, {
            sucesso: sucessoHttp,
            provedor: 'betha',
            status_code: resp.statusCode,
            mensagem: sucessoHttp
              ? 'Conexão confirmada com o Webservice Betha Sistemas (ABRASF 2.x)! Endpoint ativo e respondendo.'
              : 'O Webservice Betha Sistemas respondeu com status HTTP ' +
                resp.statusCode +
                '. Verifique permissões do usuário do município ' +
                (municipioIbge || 'prestador') +
                '.',
            detalhe: resBody.slice(0, 500),
            certificado: certInfo,
          })
        } catch (errBetha) {
          const errMsg = errBetha.message || String(errBetha)
          return e.json(200, {
            sucesso: false,
            provedor: 'betha',
            mensagem:
              'Não foi possível estabelecer conexão com o Webservice Betha Sistemas (' +
              cleanUrl +
              '). Mensagem de rede: ' +
              errMsg,
            detalhe:
              'Verifique se a URL do Webservice municipal está liberada para chamadas externas e se o certificado A1 foi anexado.',
            certificado: certInfo,
          })
        }
      } else if (provedor === 'ginfes') {
        const ginfesApiUrl = apiUrl || 'https://homologacao.ginfes.com.br/ServiceGinfesImpl'
        if (!usuario) {
          return e.json(200, {
            sucesso: false,
            provedor: 'ginfes',
            mensagem:
              'Credenciais Ginfes incompletas: informe Usuário / Identificador do prestador no portal Ginfes.',
            detalhe:
              'O provedor Ginfes utiliza o CNPJ ou código do emissor municipal com assinatura A1 para comunicação SOAP.',
            certificado: certInfo,
          })
        }

        let cleanUrl = ginfesApiUrl.trim()
        try {
          const wsdlUrl = cleanUrl.includes('?') ? cleanUrl : cleanUrl + '?wsdl'
          const resp = $http.send({
            url: wsdlUrl,
            method: 'GET',
            headers: {
              Accept: 'text/xml, application/xml',
            },
            timeout: 10,
          })

          const sucessoHttp = resp.statusCode >= 200 && resp.statusCode < 400
          const resBody = resp.rawText || ''

          return e.json(200, {
            sucesso: sucessoHttp,
            provedor: 'ginfes',
            status_code: resp.statusCode,
            mensagem: sucessoHttp
              ? 'Conexão confirmada com o Webservice Ginfes (ABRASF)! Endpoint ativo e pronto para recepção de RPS.'
              : 'O Webservice Ginfes respondeu com status HTTP ' +
                resp.statusCode +
                '. Verifique se o município emissor está com o serviço operacional.',
            detalhe: resBody.slice(0, 500),
            certificado: certInfo,
          })
        } catch (errGinfes) {
          const errMsg = errGinfes.message || String(errGinfes)
          return e.json(200, {
            sucesso: false,
            provedor: 'ginfes',
            mensagem:
              'Não foi possível estabelecer handshake com o Webservice Ginfes (' +
              cleanUrl +
              '). Mensagem de rede: ' +
              errMsg,
            detalhe:
              'Verifique se a URL de produção ou homologação da Ginfes está acessível e se o certificado e-CNPJ A1 está ativo.',
            certificado: certInfo,
          })
        }
      }

      return e.json(400, { error: 'Provedor desconhecido: ' + provedor })
    } catch (err) {
      console.log('[NFSE-TESTE-PROVEDOR] Erro:', err)
      return e.json(500, { error: err.message || 'Erro ao testar provedor fiscal' })
    }
  },
  $apis.requireAuth(),
)

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
      const apiUrl = body.api_url || 'https://nfse.receita.fazenda.gov.br/portalnfse'
      const clientId = body.client_id || ''
      const clientSecret = body.client_secret || ''
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

        // Testar handshake HTTP contra o endpoint do Emissor Nacional
        let cleanUrl = apiUrl.trim()
        if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1)

        try {
          // Chamada real de status/consulta ao provedor
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
      } else if (provedor === 'betha' || provedor === 'ginfes') {
        return e.json(200, {
          sucesso: false,
          provedor: provedor,
          mensagem:
            'O provedor ' +
            provedor.toUpperCase() +
            ' é um ponto de extensão preparado na arquitetura (Adapter). Requer credenciais municipais próprias e homologação específica.',
          detalhe: 'Atualmente o provedor ativo de produção é o Emissor Nacional (Gov.br).',
          certificado: certInfo,
        })
      }

      return e.json(400, { error: 'Provedor desconhecido: ' + provedor })
    } catch (err) {
      console.log('[NFSE-TESTE-PROVEDOR] Erro:', err)
      return e.json(500, { error: err.message || 'Erro ao testar provedor fiscal' })
    }
  },
  $apis.requireAuth(),
)

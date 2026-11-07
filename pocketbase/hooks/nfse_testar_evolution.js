/// <reference path="../pb_data/types.d.ts" />

/**
 * Teste de conexão da Evolution API — feito NO SERVIDOR.
 *
 * Antes, a tela chamava a Evolution direto do navegador com a chave lida de
 * `nfse_config.evolution_api_key`. Depois que a chave vai para o cofre, o
 * navegador não tem mais como fazer esse teste (o campo não devolve valor).
 * Esta rota assume o papel: lê a chave do cofre, chama a Evolution e devolve
 * apenas o resultado — a chave nunca volta para o cliente.
 *
 * Rota: POST /backend/v1/nfse/testar-evolution
 * Corpo: { tenant_id, url?, instance?, api_key? }
 *   - url/instance podem vir do formulário (não são segredo).
 *   - api_key, se vier, é usada só para o teste e descartada; senão usa o cofre.
 */

routerAdd(
  'POST',
  '/backend/v1/nfse/testar-evolution',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) return e.unauthorizedError('Autenticação necessária')

      const body = e.requestInfo().body || {}
      const tenantId = String(body.tenant_id || '').trim()
      if (!tenantId) return e.badRequestError('tenant_id é obrigatório')

      // vínculo com o escritório
      const members = $app.findRecordsByFilter(
        'tenant_members',
        "tenant_id = '" + tenantId + "' && user_id = '" + authUser.id + "' && status = 'ativo'",
        '',
        1,
        0,
      )
      if (members.length === 0) return e.forbiddenError('Usuário não pertence ao escritório')
      const perfil = members[0].getString('perfil')
      if (perfil !== 'administrador' && perfil !== 'contador') {
        return e.forbiddenError('Apenas Administrador ou Contador podem testar a conexão.')
      }

      // configuração do tenant
      let config = null
      try {
        config = $app.findFirstRecordByData('nfse_config', 'tenant_id', tenantId)
      } catch (_) {
        config = null
      }

      const chave = $secrets.get('CREDENTIALS_VAULT_KEY')

      // lê um segredo do cofre quando o campo está marcado com __COFRE__
      const doCofre = (rec, campo) => {
        if (!rec) return ''
        const direto = rec.getString(campo)
        if (direto && direto.indexOf('__COFRE__') !== 0) return direto
        if (!chave) return ''
        try {
          const linhas = $app.findRecordsByFilter(
            'credenciais_cofre',
            'escopo = {:e} && registro_id = {:r} && campo = {:c}',
            '',
            1,
            0,
            { e: 'nfse_config', r: rec.id, c: campo },
          )
          if (linhas.length === 0) return ''
          return $security.decrypt(linhas[0].getString('ciphertext').replace(/^v1:/, ''), chave)
        } catch (_) {
          return ''
        }
      }

      const url = String(
        body.url || (config ? config.getString('evolution_api_url') : '') || '',
      ).trim()
      const instancia = String(
        body.instance || (config ? config.getString('evolution_instance') : '') || '',
      ).trim()
      const informada = String(body.api_key || '').trim()
      const apiKey = informada || doCofre(config, 'evolution_api_key')

      if (!url || !instancia) {
        return e.json(200, {
          sucesso: false,
          status: 'incompleta',
          mensagem: 'Informe a URL da Evolution API e o nome da instância.',
        })
      }
      if (!apiKey) {
        return e.json(200, {
          sucesso: false,
          status: 'incompleta',
          mensagem:
            'API Key não configurada. Informe a chave no campo para testar, ou salve a configuração antes.',
        })
      }

      const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url
      const endpoint = cleanUrl + '/instance/connectionState/' + encodeURIComponent(instancia)

      let resp
      try {
        resp = $http.send({
          url: endpoint,
          method: 'GET',
          headers: { apikey: apiKey, Accept: 'application/json' },
          timeout: 10,
        })
      } catch (errHttp) {
        return e.json(200, {
          sucesso: false,
          status: 'url_inalcancavel',
          mensagem:
            'URL inalcançável: falha de rede/DNS ou timeout ao conectar com a Evolution API.',
          detalhe: (errHttp && errHttp.message) || String(errHttp),
        })
      }

      if (resp.statusCode >= 200 && resp.statusCode < 400) {
        let estado = 'open'
        try {
          const j = resp.json || {}
          estado = (j.instance && j.instance.state) || j.state || 'open'
        } catch (_) {}
        return e.json(200, {
          sucesso: true,
          status: 'conectada',
          mensagem:
            'Instância "' +
            instancia +
            '" conectada com sucesso! Estado atual: ' +
            String(estado).toUpperCase(),
          detalhe: (resp.rawText || '').slice(0, 800),
        })
      }

      if (resp.statusCode === 401 || resp.statusCode === 403) {
        return e.json(200, {
          sucesso: false,
          status: 'falha_autenticacao',
          mensagem:
            'Falha de autenticação (HTTP ' +
            resp.statusCode +
            '): a chave de API é inválida ou não autorizada na Evolution API.',
        })
      }

      if (resp.statusCode === 404) {
        return e.json(200, {
          sucesso: false,
          status: 'instancia_nao_encontrada',
          mensagem: 'Instância "' + instancia + '" não encontrada na Evolution API (HTTP 404).',
        })
      }

      return e.json(200, {
        sucesso: false,
        status: 'url_inalcancavel',
        mensagem: 'A Evolution API respondeu com status HTTP ' + resp.statusCode + '.',
        detalhe: (resp.rawText || '').slice(0, 500),
      })
    } catch (err) {
      console.log('[NFSE-TESTAR-EVOLUTION] Erro:', err)
      return e.json(500, { error: (err && err.message) || 'Erro ao testar a Evolution API' })
    }
  },
  $apis.requireAuth(),
)

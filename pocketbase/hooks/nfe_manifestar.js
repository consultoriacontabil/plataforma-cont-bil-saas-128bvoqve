/// <reference path="../pb_data/types.d.ts" />

/**
 * POST /backend/v1/nfe/manifestar
 *
 * CORREÇÃO 24/11/2026 — remoção de protocolo fabricado.
 *
 * A versão anterior gravava `protocolo_sefaz = '135' + Date.now()` e
 * `xMotivo = 'Evento registrado e vinculado a NF-e'` sempre que havia
 * certificado A1 com senha, sem nunca ter falado com a SEFAZ. Isso é
 * fabricação de comprovante fiscal: o código 135 é o cStat oficial de
 * "Evento registrado e vinculado a NF-e" devolvido pelo webservice.
 *
 * Agora:
 *  - a decisão do usuário é registrada como INTENÇÃO INTERNA (status_manifestacao
 *    e justificativa), que é o que o sistema realmente controla;
 *  - nenhum protocolo, cStat ou xMotivo é inventado;
 *  - o retorno declara `transmitido_para_sefaz: false` e explica o motivo;
 *  - o evento enviado à SEFAZ exige serviço com mTLS (mesma limitação do
 *    nfe_sincronizar.js): sem NFE_DFE_PROXY_URL não há transmissão.
 */
routerAdd(
  'POST',
  '/backend/v1/nfe/manifestar',
  (e) => {
    // Adaptador para a API do PocketBase v0.36 — ver comentário em nfe_sincronizar.js.
    // O handler foi escrito na forma pré-0.23 (`c.get('authRecord')`, `c.json`),
    // que não existe neste runtime; `$apis.activityLogger` no middleware nem é
    // função, e era isso que impedia o arquivo de carregar (rota em 404).
    const c = {
      json: (status, corpo) => e.json(status, corpo),
      get: (chave) => {
        if (chave === 'authRecord') return e.auth
        if (chave === 'body') return e.requestInfo().body || {}
        return undefined
      },
    }
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { error: 'Não autorizado.' })
    }

    let body = {}
    try {
      body = c.get('body') || {}
    } catch (_) {
      body = {}
    }

    const nfeId = body.nfe_id
    const tipoManifestacao = body.tipo_manifestacao
    const justificativa = String(body.justificativa || '').trim()

    if (!nfeId || !tipoManifestacao) {
      return c.json(400, { error: 'nfe_id e tipo_manifestacao são obrigatórios.' })
    }

    const tiposPermitidos = ['ciencia', 'confirmada', 'desconhecida', 'nao_realizada']
    if (tiposPermitidos.indexOf(tipoManifestacao) === -1) {
      return c.json(400, { error: 'Tipo de manifestação inválido.' })
    }

    // Operação Não Realizada e Desconhecimento exigem justificativa na SEFAZ.
    if (
      (tipoManifestacao === 'nao_realizada' || tipoManifestacao === 'desconhecida') &&
      justificativa.length < 15
    ) {
      return c.json(400, {
        error:
          'A manifestação "' +
          (tipoManifestacao === 'nao_realizada'
            ? 'Operação Não Realizada'
            : 'Desconhecimento da Operação') +
          '" exige justificativa com no mínimo 15 caracteres.',
      })
    }

    let nfe = null
    try {
      nfe = $app.findRecordById('nfe_recebidas', nfeId)
    } catch (_) {
      nfe = null
    }
    if (!nfe) {
      return c.json(404, {
        error: 'NF-e não encontrada para o id informado. Nenhuma manifestação foi registrada.',
        nfe_id: nfeId,
        nada_foi_gravado: true,
      })
    }

    try {
      const chaveAcesso = nfe.getString('chave_acesso')
      const tenantId = nfe.getString('tenant_id')

      const descricoes = {
        ciencia: 'Ciência da Operação (210210)',
        confirmada: 'Confirmação da Operação (210200)',
        desconhecida: 'Desconhecimento da Operação (210220)',
        nao_realizada: 'Operação não Realizada (210240)',
      }

      // Canal de transmissão: só existe com o serviço intermediário configurado.
      const proxyUrl = ($secrets.get('NFE_DFE_PROXY_URL') || '').replace(/\/+$/, '')
      const proxyToken = $secrets.get('NFE_DFE_PROXY_TOKEN') || ''
      let transmitido = false
      let erroTransmissao = ''

      if (proxyUrl) {
        try {
          const res = $http.send({
            url: proxyUrl + '/dfe/manifestar',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Nfe-Token': proxyToken,
            },
            body: JSON.stringify({
              chave_acesso: chaveAcesso,
              tipo_evento: tipoManifestacao,
              justificativa: justificativa,
            }),
            timeout: 60,
          })
          if (res.statusCode === 200) {
            let retorno = {}
            try {
              retorno = res.json || {}
            } catch (_) {}
            // Só considera transmitido com protocolo real devolvido pela SEFAZ.
            if (retorno && retorno.protocolo) {
              transmitido = true
              let meta = {}
              try {
                meta = nfe.get('metadados_json') || {}
              } catch (_) {
                meta = {}
              }
              meta.ultimo_evento_manifestacao = {
                tipo_evento: tipoManifestacao,
                descricao_evento: descricoes[tipoManifestacao],
                protocolo_sefaz: String(retorno.protocolo),
                cStat: String(retorno.cStat || ''),
                xMotivo: String(retorno.xMotivo || ''),
                data_registro: new Date().toISOString(),
                usuario_responsavel: authRecord.getString('name') || authRecord.getString('email'),
                modo: 'sefaz_oficial',
              }
              nfe.set('metadados_json', meta)
            } else {
              erroTransmissao =
                'Serviço DFe respondeu sem protocolo de evento (nada foi considerado transmitido).'
            }
          } else {
            erroTransmissao =
              'Serviço DFe respondeu HTTP ' + res.statusCode + ' (evento não transmitido).'
          }
        } catch (eHttp) {
          erroTransmissao = 'Falha de comunicação com o serviço DFe: ' + String(eHttp)
        }
      } else {
        erroTransmissao =
          'Serviço de transmissão DFe (NFE_DFE_PROXY_URL) não configurado: a SEFAZ exige mTLS com o certificado A1, que este runtime não apresenta na conexão.'
      }

      // Registra a intenção do usuário — sem inventar protocolo.
      nfe.set('status_manifestacao', tipoManifestacao)
      nfe.set('data_manifestacao', new Date().toISOString())
      nfe.set('manifestado_por', authRecord.id)
      if (justificativa) {
        nfe.set('justificativa_manifestacao', justificativa)
      }

      let meta2 = {}
      try {
        meta2 = nfe.get('metadados_json') || {}
      } catch (_) {
        meta2 = {}
      }
      meta2.manifestacao_interna = {
        tipo_evento: tipoManifestacao,
        descricao_evento: descricoes[tipoManifestacao],
        data_registro: new Date().toISOString(),
        usuario_responsavel: authRecord.getString('name') || authRecord.getString('email'),
        transmitido_para_sefaz: transmitido,
        protocolo_sefaz: null,
        observacao: transmitido
          ? 'Evento transmitido pelo serviço DFe configurado.'
          : 'Intenção registrada internamente. NÃO houve transmissão à SEFAZ: ' + erroTransmissao,
      }
      nfe.set('metadados_json', meta2)
      $app.save(nfe)

      try {
        const auditLogCol = $app.findCollectionByNameOrId('audit_log')
        const audit = new Record(auditLogCol)
        audit.set('tenant_id', tenantId)
        audit.set('usuario_id', authRecord.id)
        audit.set('acao', 'manifestacao_destinatario_nfe')
        audit.set('entidade_tipo', 'nfe_recebidas')
        audit.set('entidade_id', nfeId)
        audit.set(
          'detalhes',
          'Manifestação "' +
            descricoes[tipoManifestacao] +
            '" registrada para NF-e ' +
            chaveAcesso +
            '. Transmitida à SEFAZ: ' +
            (transmitido ? 'sim' : 'NÃO') +
            (transmitido ? '' : ' — ' + erroTransmissao) +
            (justificativa ? ' | Justificativa: ' + justificativa : ''),
        )
        $app.save(audit)
      } catch (eAud) {
        console.log('[NFE] Falha ao gravar auditoria da manifestação:', eAud)
      }

      return c.json(200, {
        sucesso: true,
        transmitido_para_sefaz: transmitido,
        mensagem: transmitido
          ? 'Manifestação "' +
            descricoes[tipoManifestacao] +
            '" transmitida ao serviço DFe e registrada na nota.'
          : 'Manifestação "' +
            descricoes[tipoManifestacao] +
            '" registrada como intenção interna. Ela NÃO foi transmitida à SEFAZ: ' +
            erroTransmissao +
            ' A nota permanece com a manifestação pendente de transmissão oficial.',
        evento: {
          tipo_evento: tipoManifestacao,
          descricao_evento: descricoes[tipoManifestacao],
          data_registro: new Date().toISOString(),
          transmitido_para_sefaz: transmitido,
          protocolo_sefaz: null,
        },
      })
    } catch (err) {
      console.log('[NFE] Erro ao registrar manifestacao:', err)
      return c.json(500, { error: 'Falha ao registrar manifestação: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)

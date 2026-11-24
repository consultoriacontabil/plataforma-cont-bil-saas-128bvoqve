/// <reference path="../pb_data/types.d.ts" />

/**
 * POST /backend/v1/nfe/testar-credenciais
 *
 * CORREÇÃO 24/11/2026 — o diagnóstico declarava "conexão testada com sucesso".
 *
 * Antes: com certificado A1 e senha presentes, o hook marcava
 * status_conexao = 'conectado', imprimia "canal mTLS homologado" e gravava
 * `comunicacao_sefaz_dist_dfe: true` — sem nunca ter feito uma conexão. Além
 * disso `duracao_ms` era fixo em 145 (número inventado).
 *
 * Agora o teste é honesto em camadas:
 *  1. Verifica o que o sistema REALMENTE sabe (certificado cadastrado, tipo,
 *     validade, senha presente). Isso não é conexão.
 *  2. Só declara comunicação com a SEFAZ quando existe serviço DFe configurado
 *     (NFE_DFE_PROXY_URL) e ele responde OK — com cStat real na resposta.
 *  3. Sem esse serviço, o status é `modo_supervisao` e a mensagem diz que a
 *     SEFAZ não foi consultada, porque o runtime não apresenta o certificado
 *     A1 na conexão TLS.
 */
routerAdd(
  'POST',
  '/backend/v1/nfe/testar-credenciais',
  (c) => {
    const start = Date.now()
    const authRecord = c.get('authRecord')
    if (!authRecord) {
      return c.json(401, { error: 'Não autorizado.' })
    }

    let body = {}
    try {
      body = c.get('body') || $apis.requestInfo(c).data || {}
    } catch (_) {
      body = {}
    }

    const tenantId = body.tenant_id
    const empresaId = body.empresa_id
    const senhaInformada = body.senha_certificado || ''
    const ambiente = body.ambiente || 'producao'

    if (!empresaId) {
      return c.json(400, { error: 'empresa_id é obrigatório.' })
    }

    const cofreLer = (rec, campo) => {
      if (!rec) return ''
      const direto = rec.getString(campo)
      if (direto && direto.indexOf('__COFRE__') !== 0) return direto
      const chaveCofre = $secrets.get('CREDENTIALS_VAULT_KEY')
      if (!chaveCofre) return ''
      try {
        const linhas = $app.findRecordsByFilter(
          'credenciais_cofre',
          'escopo = {:e} && registro_id = {:r} && campo = {:c}',
          '',
          1,
          0,
          { e: 'certificados_digitais', r: rec.id, c: campo },
        )
        if (linhas.length === 0) return ''
        return $security.decrypt(linhas[0].getString('ciphertext').replace(/^v1:/, ''), chaveCofre)
      } catch (_) {
        return ''
      }
    }

    try {
      const empresa = $app.findRecordById('empresas', empresaId)
      const cnpjEmpresa = empresa.getString('cnpj')

      let certificadoRecord = null
      if (body.certificado_a1) {
        try {
          certificadoRecord = $app.findRecordById('certificados_digitais', body.certificado_a1)
        } catch (_) {}
      }
      if (!certificadoRecord) {
        try {
          certificadoRecord = $app.findFirstRecordByData(
            'certificados_digitais',
            'empresa',
            empresaId,
          )
        } catch (_) {}
      }

      let temArquivoPfx = false
      let titularCert = ''
      let emissorCert = ''
      let diasRestantes = null
      let certificadoVencido = false

      if (certificadoRecord) {
        titularCert = certificadoRecord.getString('titular')
        emissorCert = certificadoRecord.getString('emissor')
        temArquivoPfx = !!certificadoRecord.getString('arquivo_pfx')
        const validadeStr = certificadoRecord.getString('validade')
        if (validadeStr) {
          const d = new Date(validadeStr).getTime()
          if (isFinite(d)) {
            diasRestantes = Math.round((d - Date.now()) / 86400000)
            certificadoVencido = diasRestantes <= 0
          }
        }
      }

      const senhaGravada = cofreLer(certificadoRecord, 'senha')
      const senhaEfetiva = senhaInformada || senhaGravada

      const temCertificado = !!certificadoRecord
      const temSenha = !!senhaEfetiva && senhaEfetiva.trim().length > 0
      const isA1 = certificadoRecord ? certificadoRecord.getString('tipo') === 'a1' : false

      const proxyUrl = ($secrets.get('NFE_DFE_PROXY_URL') || '').replace(/\/+$/, '')
      const proxyToken = $secrets.get('NFE_DFE_PROXY_TOKEN') || ''

      let statusConexao = 'modo_supervisao'
      let mensagem = ''
      let comunicacaoReal = false
      let cStatReal = ''
      let xMotivoReal = ''

      const preRequisitosOk = temCertificado && isA1 && temSenha && !certificadoVencido

      if (!temCertificado) {
        statusConexao = 'erro_credenciais'
        mensagem =
          'Nenhum certificado digital cadastrado para esta empresa. A consulta SEFAZ DFe exige e-CNPJ A1. Nenhuma consulta à SEFAZ foi realizada neste teste.'
      } else if (!isA1) {
        statusConexao = 'modo_supervisao'
        mensagem =
          'O certificado cadastrado é A3 (token/smartcard). Ele não pode ser usado por um serviço em nuvem. Nenhuma consulta à SEFAZ foi realizada.'
      } else if (certificadoVencido) {
        statusConexao = 'erro_credenciais'
        mensagem = 'O certificado e-CNPJ A1 está vencido. Nenhuma consulta à SEFAZ foi realizada.'
      } else if (!temSenha) {
        statusConexao = 'modo_supervisao'
        mensagem =
          'Certificado A1 localizado, mas a senha da chave privada não está configurada. Nenhuma consulta à SEFAZ foi realizada.'
      } else if (!proxyUrl) {
        statusConexao = 'modo_supervisao'
        mensagem =
          'Certificado A1 e senha estão presentes, mas NÃO existe canal de consulta configurado. ' +
          'O Skip não apresenta o certificado A1 na conexão TLS exigida pelo webservice NFeDistribuicaoDFe, ' +
          'portanto este teste apenas conferiu o cadastro do certificado — a SEFAZ não foi consultada. ' +
          'Para consultar de verdade, configure o serviço DFe do escritório.'
      } else {
        // Existe canal: tentar de verdade.
        try {
          const res = $http.send({
            url: proxyUrl + '/dfe/ping',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Nfe-Token': proxyToken,
            },
            body: JSON.stringify({
              cnpj: cnpjEmpresa.replace(/\D/g, ''),
              ambiente: ambiente,
            }),
            timeout: 45,
          })
          let retorno = {}
          try {
            retorno = res.json || {}
          } catch (_) {}
          cStatReal = String(retorno.cStat || '')
          xMotivoReal = String(retorno.xMotivo || '')
          if (res.statusCode === 200 && retorno.sucesso === true) {
            comunicacaoReal = true
            statusConexao = 'conectado'
            mensagem =
              'Serviço DFe respondeu para o CNPJ ' +
              cnpjEmpresa +
              (cStatReal ? ' (cStat ' + cStatReal + ')' : '') +
              '. O certificado A1 está em uso pelo serviço do escritório — o Skip continua sem apresentar o certificado na conexão TLS.'
          } else {
            statusConexao = 'erro_credenciais'
            mensagem =
              'O serviço DFe respondeu HTTP ' +
              res.statusCode +
              ' sem sucesso' +
              (cStatReal ? ' (cStat ' + cStatReal + ')' : '') +
              '. A SEFAZ não confirmou a comunicação.'
          }
        } catch (eHttp) {
          statusConexao = 'erro_credenciais'
          mensagem = 'Falha de comunicação com o serviço DFe: ' + String(eHttp)
        }
      }

      const resultado = {
        status: statusConexao,
        mensagem: mensagem,
        data_verificacao: new Date().toISOString(),
        comunicacao_sefaz_testada: !!proxyUrl && preRequisitosOk,
        comunicacao_sefaz_confirmada: comunicacaoReal,
        itens_checados: {
          empresa_cnpj: cnpjEmpresa,
          certificado_detectado: temCertificado,
          certificado_tipo_a1: isA1,
          certificado_arquivo_pfx: temArquivoPfx,
          certificado_vencido: certificadoVencido,
          dias_restantes: diasRestantes,
          titular: titularCert,
          emissor: emissorCert,
          senha_presente: temSenha,
          servico_consulta_configurado: !!proxyUrl,
          ambiente: ambiente,
          cStat_retornado: cStatReal,
          xMotivo_retornado: xMotivoReal,
          mTLS_direto_indisponivel: 'runtime não aceita certificado de cliente em $http.send',
        },
        duracao_ms: Date.now() - start,
      }

      try {
        let configRec = null
        try {
          configRec = $app.findFirstRecordByData('nfe_config', 'empresa', empresaId)
        } catch (_) {}
        if (configRec) {
          configRec.set('status_conexao', statusConexao)
          configRec.set('ultimo_diagnostico_json', resultado)
          // Grava a senha apenas se veio do formulário e ainda não havia nenhuma.
          if (senhaInformada && !configRec.getString('senha_certificado')) {
            configRec.set('senha_certificado', senhaInformada)
          }
          if (certificadoRecord && !configRec.getString('certificado_a1')) {
            configRec.set('certificado_a1', certificadoRecord.id)
          }
          $app.save(configRec)
        }
      } catch (eConfig) {
        console.log('[NFE] Erro ao atualizar nfe_config com diagnostico:', eConfig)
      }

      try {
        const logsCol = $app.findCollectionByNameOrId('nfe_sync_logs')
        const log = new Record(logsCol)
        log.set('tenant_id', tenantId || empresa.getString('tenant_id'))
        log.set('empresa', empresaId)
        log.set('origem_acionamento', 'teste_credenciais')
        log.set('sucesso', comunicacaoReal)
        log.set('modo_operacao', comunicacaoReal ? 'sefaz_distribuicao_real' : 'modo_supervisao')
        log.set('notas_encontradas', 0)
        log.set('notas_novas_importadas', 0)
        log.set('ultimo_nsu_consultado', '0')
        log.set('duracao_ms', resultado.duracao_ms)
        log.set('mensagem', mensagem)
        log.set('detalhes_json', resultado)
        log.set('executado_por', authRecord.id)
        $app.save(log)
      } catch (eLog) {
        console.log('[NFE] Erro ao salvar log de teste:', eLog)
      }

      try {
        const auditCol = $app.findCollectionByNameOrId('audit_log')
        const audit = new Record(auditCol)
        audit.set('tenant_id', tenantId || empresa.getString('tenant_id'))
        audit.set('usuario_id', authRecord.id)
        audit.set('acao', 'diagnostico_credenciais_nfe')
        audit.set('entidade_tipo', 'nfe_config')
        audit.set('entidade_id', empresaId)
        audit.set(
          'detalhes',
          'Diagnóstico de credenciais NF-e: status ' +
            statusConexao +
            '; comunicação com a SEFAZ confirmada: ' +
            (comunicacaoReal ? 'sim' : 'NÃO'),
        )
        $app.save(audit)
      } catch (_) {}

      return c.json(200, resultado)
    } catch (err) {
      console.log('[NFE] Erro no teste de credenciais:', err)
      return c.json(500, {
        status: 'erro_credenciais',
        mensagem: 'Erro interno ao processar validação de credenciais: ' + String(err),
      })
    }
  },
  $apis.activityLogger($app),
)

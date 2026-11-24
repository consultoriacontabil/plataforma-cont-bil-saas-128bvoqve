/// <reference path="../pb_data/types.d.ts" />

/**
 * POST /backend/v1/nfe/sincronizar
 * Busca de NF-e do destinatário (SEFAZ DFe — nfeDistDFeInteresse).
 *
 * CORREÇÃO 24/11/2026 — remoção da fabricação de notas.
 *
 * Este endpoint NÃO inventa nota fiscal. Ele só grava em `nfe_recebidas` o que
 * vier de um retorno real de webservice.
 *
 * Por que não há consulta direta da SEFAZ aqui: o webservice NFeDistribuicaoDFe
 * exige mTLS, isto é, o certificado e-CNPJ A1 tem de ser apresentado na própria
 * conexão TLS. O `$http.send` do PocketBase (v0.36) não aceita certificado de
 * cliente, portanto o Skip Cloud não consegue falar com a SEFAZ sozinho.
 *
 * A consulta real passa a existir apenas quando um serviço intermediário for
 * configurado nos segredos do projeto:
 *   NFE_DFE_PROXY_URL    — URL do serviço que executa a consulta com o A1
 *   NFE_DFE_PROXY_TOKEN  — valor enviado no header X-Nfe-Token
 * O serviço deve responder JSON:
 *   { "sucesso": true, "cStat": "138", "ultNSU": "...", "maxNSU": "...",
 *     "documentos": [ { "nsu": "000000000000123", "xml": "<nfeProc>..." } ] }
 *
 * Sem esse serviço configurado, ou sem certificado A1 com senha, a resposta é
 * sempre `modo_operacao: "modo_supervisao"`, `sucesso: false` e ZERO notas
 * gravadas. Nunca há valor fixo, chave sintética, CNPJ fictício ou NSU inventado.
 */
routerAdd(
  'POST',
  '/backend/v1/nfe/sincronizar',
  (e) => {
    // Adaptador para a API do PocketBase v0.36.
    // A lógica abaixo foi escrita na forma pré-0.23 (`c.get('authRecord')`,
    // `c.get('body')`, `c.json(...)`), que não existe mais neste runtime:
    // `c.get('authRecord')` devolve undefined, `$apis.requestInfo` não existe e
    // `$apis.activityLogger` (que estava no middleware da rota) nem é função —
    // era isso que fazia o arquivo falhar ao carregar e a rota responder 404.
    // O adaptador traduz apenas esses três pontos; o corpo do handler, já
    // auditado, não foi reescrito.
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

    const start = Date.now()
    let body = {}
    try {
      body = c.get('body') || {}
    } catch (_) {
      body = {}
    }

    const tenantId = body.tenant_id
    const empresaId = body.empresa_id
    const origem = body.origem || 'manual' // 'manual' | 'cron_diario'

    if (!empresaId) {
      return c.json(400, { error: 'empresa_id é obrigatório.' })
    }

    // Helper local: lê o segredo do cofre cifrado quando o campo está marcado
    // como cofrado; enquanto o valor original estiver no campo, usa direto.
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
          { e: rec.collection().name, r: rec.id, c: campo },
        )
        if (linhas.length === 0) return ''
        const ct = linhas[0].getString('ciphertext')
        return $security.decrypt(ct.replace(/^v1:/, ''), chaveCofre)
      } catch (_) {
        return ''
      }
    }

    const registrarAuditoria = (tenant, usuario, acao, detalhes) => {
      if (!tenant) return
      try {
        const auditLogCol = $app.findCollectionByNameOrId('audit_log')
        const audit = new Record(auditLogCol)
        audit.set('tenant_id', tenant)
        audit.set('usuario_id', usuario)
        audit.set('acao', acao)
        audit.set('entidade_tipo', 'nfe_config')
        audit.set('entidade_id', empresaId)
        audit.set('detalhes', detalhes)
        $app.save(audit)
      } catch (eAud) {
        console.log('[NFE] Falha ao gravar auditoria:', eAud)
      }
    }

    try {
      const empresa = $app.findRecordById('empresas', empresaId)
      const cnpjEmpresa = empresa.getString('cnpj')
      const razaoSocialEmpresa = empresa.getString('razao_social')
      const effectiveTenantId = tenantId || empresa.getString('tenant_id')

      let config = null
      try {
        config = $app.findFirstRecordByData('nfe_config', 'empresa', empresaId)
      } catch (_) {}

      let certRecord = null
      if (config && config.getString('certificado_a1')) {
        try {
          certRecord = $app.findRecordById(
            'certificados_digitais',
            config.getString('certificado_a1'),
          )
        } catch (_) {}
      }
      if (!certRecord) {
        try {
          certRecord = $app.findFirstRecordByData('certificados_digitais', 'empresa', empresaId)
        } catch (_) {}
      }

      const senhaCert = cofreLer(config, 'senha_certificado') || cofreLer(certRecord, 'senha')
      const temCertificadoA1Valido =
        !!certRecord &&
        certRecord.getString('tipo') === 'a1' &&
        !!senhaCert &&
        senhaCert.trim().length > 0

      // Canal real de consulta: só existe se o serviço intermediário estiver configurado.
      const proxyUrl = ($secrets.get('NFE_DFE_PROXY_URL') || '').replace(/\/+$/, '')
      const proxyToken = $secrets.get('NFE_DFE_PROXY_TOKEN') || ''

      const nfeRecebidasCol = $app.findCollectionByNameOrId('nfe_recebidas')
      const nfeLogsCol = $app.findCollectionByNameOrId('nfe_sync_logs')

      if (!temCertificadoA1Valido || !proxyUrl) {
        // ---------- MODO SUPERVISÃO: nada é gravado em nfe_recebidas ----------
        const duracao = Date.now() - start
        const motivos = []
        if (!certRecord) motivos.push('certificado digital não localizado para a empresa')
        else if (certRecord.getString('tipo') !== 'a1')
          motivos.push('certificado cadastrado não é A1 (A3 não é acessível pela nuvem)')
        else if (!senhaCert || !senhaCert.trim()) motivos.push('senha do certificado A1 ausente')
        if (!proxyUrl) motivos.push('serviço de consulta DFe (NFE_DFE_PROXY_URL) não configurado')

        const msgSupervisao =
          'Modo Supervisão: nenhuma consulta à SEFAZ foi executada e nenhuma nota foi importada. ' +
          'Motivo: ' +
          motivos.join('; ') +
          '. O Skip não apresenta o certificado A1 na conexão TLS exigida pelo webservice ' +
          'NFeDistribuicaoDFe, por isso a busca automática depende de um serviço intermediário ' +
          'com o certificado. Alternativas disponíveis agora: importar o XML da NF-e ou lançar a ' +
          'nota pela chave de acesso informando os valores do próprio documento.'

        if (config) {
          try {
            config.set('status_conexao', 'modo_supervisao')
            config.set('ultima_sincronizacao_em', new Date().toISOString())
            config.set('ultimo_diagnostico_json', {
              status: 'modo_supervisao',
              mensagem: msgSupervisao,
              data_verificacao: new Date().toISOString(),
              notas_gravadas: 0,
              itens_checados: {
                certificado_detectado: !!certRecord,
                certificado_tipo: certRecord ? certRecord.getString('tipo') : '',
                senha_configurada: !!senhaCert,
                servico_consulta_configurado: !!proxyUrl,
                ambiente: config.getString('ambiente'),
                acesso_distribuicao_dfe: false,
              },
            })
            $app.save(config)
          } catch (eCfg) {
            console.log('[NFE] Falha ao atualizar nfe_config no modo supervisão:', eCfg)
          }
        }

        try {
          const log = new Record(nfeLogsCol)
          log.set('tenant_id', effectiveTenantId)
          log.set('empresa', empresaId)
          log.set('origem_acionamento', origem)
          log.set('sucesso', false)
          log.set('modo_operacao', 'modo_supervisao')
          log.set('notas_encontradas', 0)
          log.set('notas_novas_importadas', 0)
          log.set('ultimo_nsu_consultado', config ? config.getString('ultimo_nsu') || '0' : '0')
          log.set('duracao_ms', duracao)
          log.set('mensagem', msgSupervisao)
          log.set('detalhes_json', {
            motivos: motivos,
            notas_gravadas: 0,
            chave_sefaz_direta_indisponivel: 'mTLS com certificado A1 não suportado pelo runtime',
          })
          log.set('executado_por', authRecord.id)
          $app.save(log)
        } catch (eLog) {
          console.log('[NFE] Falha ao gravar log de sincronização:', eLog)
        }

        registrarAuditoria(
          effectiveTenantId,
          authRecord.id,
          'sincronizacao_nfe_modo_supervisao',
          'Tentativa de sincronização NF-e sem consulta real à SEFAZ (' +
            motivos.join('; ') +
            '). Nenhuma nota foi gravada. Empresa: ' +
            razaoSocialEmpresa,
        )

        return c.json(200, {
          sucesso: false,
          modo_operacao: 'modo_supervisao',
          notas_encontradas: 0,
          notas_novas_importadas: 0,
          mensagem: msgSupervisao,
          duracao_ms: duracao,
        })
      }

      // ---------- CANAL REAL CONFIGURADO: consulta de verdade ----------
      const ultimoNsuStr = (config && config.getString('ultimo_nsu')) || '000000000000000'
      const ambiente = (config && config.getString('ambiente')) || 'producao'

      let resposta = null
      let erroTransporte = ''
      try {
        const res = $http.send({
          url: proxyUrl + '/dfe/distribuicao',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Nfe-Token': proxyToken,
          },
          body: JSON.stringify({
            cnpj: cnpjEmpresa.replace(/\D/g, ''),
            ultimo_nsu: ultimoNsuStr,
            ambiente: ambiente,
          }),
          timeout: 60,
        })
        if (res.statusCode !== 200) {
          erroTransporte =
            'Serviço de consulta DFe respondeu HTTP ' +
            res.statusCode +
            ' (consulta não realizada).'
        } else {
          // res.json é o corpo já interpretado pelo runtime ($http.send).
          try {
            resposta = res.json
          } catch (eJson) {
            resposta = null
          }
          if (!resposta || typeof resposta !== 'object') {
            erroTransporte = 'O serviço DFe respondeu 200 sem JSON interpretável.'
          }
        }
      } catch (eHttp) {
        erroTransporte = 'Falha de comunicação com o serviço DFe: ' + String(eHttp)
      }

      if (erroTransporte || !resposta || resposta.sucesso !== true) {
        const duracao = Date.now() - start
        const msgErro =
          'Consulta à SEFAZ NÃO foi concluída e nenhuma nota foi gravada. ' +
          (erroTransporte ||
            'O serviço de consulta DFe respondeu sem sucesso: ' +
              String((resposta && resposta.mensagem) || 'sem detalhe') +
              '.')

        if (config) {
          try {
            config.set('status_conexao', 'erro_credenciais')
            config.set('ultima_sincronizacao_em', new Date().toISOString())
            config.set('ultimo_diagnostico_json', {
              status: 'erro_credenciais',
              mensagem: msgErro,
              data_verificacao: new Date().toISOString(),
              notas_gravadas: 0,
            })
            $app.save(config)
          } catch (_) {}
        }

        try {
          const log = new Record(nfeLogsCol)
          log.set('tenant_id', effectiveTenantId)
          log.set('empresa', empresaId)
          log.set('origem_acionamento', origem)
          log.set('sucesso', false)
          log.set('modo_operacao', 'modo_supervisao')
          log.set('notas_encontradas', 0)
          log.set('notas_novas_importadas', 0)
          log.set('ultimo_nsu_consultado', ultimoNsuStr)
          log.set('duracao_ms', duracao)
          log.set('mensagem', msgErro)
          log.set('detalhes_json', { erro: erroTransporte || 'resposta sem sucesso' })
          log.set('executado_por', authRecord.id)
          $app.save(log)
        } catch (_) {}

        registrarAuditoria(
          effectiveTenantId,
          authRecord.id,
          'sincronizacao_nfe_falhou',
          msgErro + ' Empresa: ' + razaoSocialEmpresa,
        )

        return c.json(502, {
          sucesso: false,
          modo_operacao: 'modo_supervisao',
          notas_encontradas: 0,
          notas_novas_importadas: 0,
          mensagem: msgErro,
          duracao_ms: duracao,
        })
      }

      // Resposta real recebida: gravar SOMENTE o que veio nela.
      const documentos = Array.isArray(resposta.documentos) ? resposta.documentos : []
      const documentosCol = $app.findCollectionByNameOrId('documentos')
      const autoCiencia = config ? config.getBool('auto_ciencia_operacao') : false
      const deveImportarGed = config ? config.getBool('auto_importar_ged') : true

      let novasNotas = 0
      let descartados = 0

      for (let i = 0; i < documentos.length; i++) {
        const doc = documentos[i] || {}
        const xml = typeof doc.xml === 'string' ? doc.xml : ''
        const nsu = String(doc.nsu || '')
        if (!xml) {
          descartados++
          continue
        }

        // Só considera documento cujo XML traz uma chave de 44 dígitos.
        const chaveMatch = xml.match(/<chNFe>\s*(\d{44})\s*<\/chNFe>/)
        if (!chaveMatch) {
          descartados++
          continue
        }
        const chave = chaveMatch[1]

        let jaExiste = false
        try {
          $app.findFirstRecordByData('nfe_recebidas', 'chave_acesso', chave)
          jaExiste = true
        } catch (_) {}
        if (jaExiste) continue

        const pegar = (tag) => {
          const m = xml.match(new RegExp('<' + tag + '>\\s*([^<]*)</' + tag + '>'))
          return m ? String(m[1]).trim() : ''
        }
        const pegarNumero = (tag) => {
          const v = parseFloat(pegar(tag).replace(',', '.'))
          return isFinite(v) ? v : null
        }

        const numero = pegar('nNF')
        const serie = pegar('serie')
        const cnpjEmit = pegar('CNPJ')
        const razaoEmit = pegar('xNome')
        const ufEmit = pegar('UF')
        const dhEmi = pegar('dhEmi') || pegar('dEmi')
        const vNF = pegarNumero('vNF')
        const vICMS = pegarNumero('vICMS')
        const cfop = pegar('CFOP')
        const natOp = pegar('natOp')

        if (!cnpjEmit || !razaoEmit) {
          // Sem identificação do emitente o registro fica incompleto: descarta e reporta.
          descartados++
          continue
        }

        let docGedId = ''
        if (deveImportarGed) {
          try {
            const ged = new Record(documentosCol)
            ged.set('tenant_id', effectiveTenantId)
            ged.set('empresa_id', empresaId)
            ged.set('nome_arquivo', 'NFe_' + chave + '.xml')
            ged.set('tipo', 'nota_fiscal')
            ged.set('status', 'processado')
            ged.set('origem_documento', 'busca_sefaz')
            ged.set('chave_acesso_nfe', chave)
            ged.set(
              'observacoes',
              'XML recebido do webservice DFe (NSU ' +
                nsu +
                '). Emitente: ' +
                razaoEmit +
                (numero ? ' | NF ' + numero : '') +
                (vNF !== null ? ' | Valor R$ ' + vNF.toFixed(2) : ' | valor não informado no XML'),
            )
            ged.set('usuario_upload_id', authRecord.id)
            $app.save(ged)
            docGedId = ged.id
          } catch (eGed) {
            console.log('[NFE] Falha ao gravar documento do XML real:', eGed)
          }
        }

        const nfeRec = new Record(nfeRecebidasCol)
        nfeRec.set('tenant_id', effectiveTenantId)
        nfeRec.set('empresa', empresaId)
        nfeRec.set('chave_acesso', chave)
        if (numero) nfeRec.set('numero', numero)
        if (serie) nfeRec.set('serie', serie)
        nfeRec.set('cnpj_emitente', cnpjEmit)
        nfeRec.set('razao_social_emitente', razaoEmit)
        if (ufEmit) nfeRec.set('uf_emitente', ufEmit)
        if (dhEmi) nfeRec.set('data_emissao', dhEmi)
        if (vNF !== null) nfeRec.set('valor_total', vNF)
        if (vICMS !== null) nfeRec.set('valor_icms', vICMS)
        if (cfop) nfeRec.set('cfop_principal', cfop)
        if (natOp) nfeRec.set('natureza_operacao', natOp)
        if (nsu) nfeRec.set('nsu', nsu)
        nfeRec.set('tipo_operacao', '0_entrada')
        nfeRec.set('status_manifestacao', autoCiencia ? 'ciencia' : 'sem_manifestacao')
        if (autoCiencia) {
          nfeRec.set('data_manifestacao', new Date().toISOString())
          nfeRec.set('manifestado_por', authRecord.id)
          nfeRec.set(
            'justificativa_manifestacao',
            'Ciência da operação solicitada automaticamente pela configuração de busca ' +
              '(transmissão do evento depende do serviço DFe).',
          )
        }
        if (docGedId) nfeRec.set('documento_ged', docGedId)
        nfeRec.set('origem_captura', 'busca_sefaz_auto')
        nfeRec.set('metadados_json', {
          cStat: String(resposta.cStat || ''),
          xMotivo: String(resposta.xMotivo || ''),
          ambiente: ambiente,
          nsu: nsu,
          chave_decomposta: null,
          destinatario_cnpj: cnpjEmpresa,
          destinatario_xNome: razaoSocialEmpresa,
          origem_do_registro: 'retorno real do webservice DFe',
        })
        $app.save(nfeRec)
        novasNotas++
      }

      const proximoNsu = String(resposta.ultNSU || ultimoNsuStr)
      const duracao = Date.now() - start

      if (config) {
        try {
          config.set('status_conexao', 'conectado')
          config.set('ultimo_nsu', proximoNsu)
          if (resposta.maxNSU) config.set('max_nsu', String(resposta.maxNSU))
          config.set('ultima_sincronizacao_em', new Date().toISOString())
          config.set(
            'total_notas_recebidas',
            (config.getInt('total_notas_recebidas') || 0) + novasNotas,
          )
          config.set('ultimo_diagnostico_json', {
            status: 'conectado',
            mensagem:
              'Consulta DFe executada pelo serviço configurado. cStat ' +
              String(resposta.cStat || '') +
              '. ' +
              novasNotas +
              ' nota(s) nova(s). Último NSU: ' +
              proximoNsu,
            data_verificacao: new Date().toISOString(),
            itens_checados: {
              certificado_vinculado: true,
              senha_configurada: true,
              servico_consulta_configurado: true,
              ambiente: ambiente,
              comunicacao_sefaz_dist_dfe: true,
            },
          })
          $app.save(config)
        } catch (_) {}
      }

      const logMsg =
        'Consulta DFe concluída. ' +
        novasNotas +
        ' nota(s) nova(s) gravada(s), ' +
        descartados +
        ' documento(s) descartado(s) por falta de dados no XML. Último NSU: ' +
        proximoNsu

      try {
        const log = new Record(nfeLogsCol)
        log.set('tenant_id', effectiveTenantId)
        log.set('empresa', empresaId)
        log.set('origem_acionamento', origem)
        log.set('sucesso', true)
        log.set('modo_operacao', 'sefaz_distribuicao_real')
        log.set('notas_encontradas', documentos.length)
        log.set('notas_novas_importadas', novasNotas)
        log.set('ultimo_nsu_consultado', proximoNsu)
        log.set('duracao_ms', duracao)
        log.set('mensagem', logMsg)
        log.set('detalhes_json', {
          cStat: String(resposta.cStat || ''),
          xMotivo: String(resposta.xMotivo || ''),
          ultNSU: proximoNsu,
          maxNSU: String(resposta.maxNSU || ''),
          documentos_recebidos: documentos.length,
          documentos_descartados: descartados,
          novas_notas: novasNotas,
        })
        log.set('executado_por', authRecord.id)
        $app.save(log)
      } catch (_) {}

      registrarAuditoria(
        effectiveTenantId,
        authRecord.id,
        'sincronizacao_nfe_destinatario',
        logMsg + ' Empresa: ' + razaoSocialEmpresa,
      )

      return c.json(200, {
        sucesso: true,
        modo_operacao: 'sefaz_distribuicao_real',
        notas_encontradas: documentos.length,
        notas_novas_importadas: novasNotas,
        ultimo_nsu: proximoNsu,
        mensagem: logMsg,
        duracao_ms: duracao,
      })
    } catch (err) {
      console.log('[NFE] Erro ao sincronizar SEFAZ DFe:', err)
      return c.json(500, {
        sucesso: false,
        modo_operacao: 'modo_supervisao',
        error: 'Falha durante sincronização com SEFAZ: ' + String(err),
      })
    }
  },
  $apis.requireAuth(),
)

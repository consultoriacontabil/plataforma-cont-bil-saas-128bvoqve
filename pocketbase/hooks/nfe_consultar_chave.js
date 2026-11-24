/// <reference path="../pb_data/types.d.ts" />

/**
 * POST /backend/v1/nfe/consultar-chave
 *
 * CORREÇÃO 24/11/2026 — remoção de valor fabricado.
 *
 * Antes: quando o corpo não trazia `valor_total`, o registro era criado com
 * R$ 1.580,00 e ICMS de 12% "estimado", além de razão social inventada
 * ("Fornecedor Identificado via Chave Pública") e data no dia 15 do mês da
 * chave. Isso colocava valor fiscal falso na escrituração.
 *
 * Agora: a chave de 44 dígitos é decomposta (isso é legítimo, é aritmética de
 * estrutura pública), mas os campos que só o documento prova —
 * valor_total, valor_icms, razão social do emitente, data de emissão — só são
 * gravados se vierem informados por quem está lançando. Sem eles, a nota NÃO é
 * criada: a resposta é 422 dizendo quais campos faltam.
 *
 * A chave não substitui o documento: sem XML, a origem fica marcada como
 * `chave_manual_publica` e a resposta declara que os valores foram informados
 * manualmente, não lidos do XML.
 */
routerAdd(
  'POST',
  '/backend/v1/nfe/consultar-chave',
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

    const tenantId = body.tenant_id
    const empresaId = body.empresa_id
    const chaveAcessoRaw = String(body.chave_acesso || '')
      .replace(/\D/g, '')
      .trim()

    if (!empresaId || !chaveAcessoRaw) {
      return c.json(400, { error: 'empresa_id e chave_acesso são obrigatórios.' })
    }

    if (chaveAcessoRaw.length !== 44) {
      return c.json(400, {
        error:
          'Chave de acesso inválida. A chave de NF-e deve conter exatamente 44 dígitos numéricos.',
      })
    }

    // Campos que a chave NÃO prova: exigidos do usuário.
    const razaoEmitente = String(body.razao_social_emitente || '').trim()
    const valorTotalInformado = parseFloat(String(body.valor_total || '').replace(',', '.'))
    const dataEmissaoInformada = String(body.data_emissao || '').trim()

    const faltando = []
    if (!razaoEmitente) faltando.push('razao_social_emitente')
    if (!isFinite(valorTotalInformado) || valorTotalInformado <= 0) faltando.push('valor_total')
    if (!dataEmissaoInformada) faltando.push('data_emissao')

    if (faltando.length > 0) {
      return c.json(422, {
        error:
          'Não é possível criar a nota apenas com a chave de acesso: a chave prova o CNPJ do ' +
          'emitente, o número e a série, mas não prova o valor, a razão social nem a data de ' +
          'emissão. Informe os dados do próprio documento fiscal, ou importe o XML da NF-e.',
        campos_obrigatorios_faltando: faltando,
        nada_foi_gravado: true,
      })
    }

    try {
      const empresa = $app.findRecordById('empresas', empresaId)
      const cnpjEmpresa = empresa.getString('cnpj')
      const razaoSocialEmpresa = empresa.getString('razao_social')
      const effectiveTenantId = tenantId || empresa.getString('tenant_id')

      const existing = $app.findRecordsByFilter(
        'nfe_recebidas',
        "empresa = '" + empresaId + "' && chave_acesso = '" + chaveAcessoRaw + "'",
        '',
        1,
        0,
      )
      if (existing.length > 0) {
        return c.json(409, {
          error: 'Esta NF-e já se encontra importada para esta empresa no sistema.',
          nfe_existente_id: existing[0].id,
        })
      }

      // Decomposição da chave (estrutura pública da NF-e):
      // cUF(2) + AAMM(4) + CNPJ(14) + mod(2) + serie(3) + nNF(9) + tpEmis(1) + cNF(8) + cDV(1)
      const ufCodigo = chaveAcessoRaw.substring(0, 2)
      const cnpjEmitenteRaw = chaveAcessoRaw.substring(6, 20)
      const modelo = chaveAcessoRaw.substring(20, 22)
      const serie = String(parseInt(chaveAcessoRaw.substring(22, 25), 10))
      const numeroNF = String(parseInt(chaveAcessoRaw.substring(25, 34), 10))

      const mapaUf = {
        11: 'RO',
        12: 'AC',
        13: 'AM',
        14: 'RR',
        15: 'PA',
        16: 'AP',
        17: 'TO',
        21: 'MA',
        22: 'PI',
        23: 'CE',
        24: 'RN',
        25: 'PB',
        26: 'PE',
        27: 'AL',
        28: 'SE',
        29: 'BA',
        31: 'MG',
        32: 'ES',
        33: 'RJ',
        35: 'SP',
        41: 'PR',
        42: 'SC',
        43: 'RS',
        50: 'MS',
        51: 'MT',
        52: 'GO',
        53: 'DF',
      }
      const ufEmitente = mapaUf[ufCodigo] || ''

      const cnpjEmitente = cnpjEmitenteRaw.replace(
        /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
        '$1.$2.$3/$4-$5',
      )

      // Valor de ICMS: só grava se informado. Nada de 12% "estimado".
      const icmsInformado = parseFloat(String(body.valor_icms || '').replace(',', '.'))
      const valorIcms = isFinite(icmsInformado) ? icmsInformado : null

      const cfop =
        body.cfop_principal ||
        (empresa.getString('uf') && empresa.getString('uf') === ufEmitente ? '1.102' : '2.102')
      const naturezaOperacao =
        body.natureza_operacao || 'Compra para comercialização (lançamento manual por chave)'

      const documentosCol = $app.findCollectionByNameOrId('documentos')
      const nfeRecebidasCol = $app.findCollectionByNameOrId('nfe_recebidas')
      const nfeLogsCol = $app.findCollectionByNameOrId('nfe_sync_logs')

      const doc = new Record(documentosCol)
      doc.set('tenant_id', effectiveTenantId)
      doc.set('empresa_id', empresaId)
      doc.set('nome_arquivo', 'NFe_' + chaveAcessoRaw + '.xml')
      doc.set('tipo', 'nota_fiscal')
      doc.set('status', 'pendente')
      doc.set('origem_documento', 'busca_sefaz')
      doc.set('chave_acesso_nfe', chaveAcessoRaw)
      doc.set(
        'observacoes',
        'Registro criado a partir da CHAVE de acesso informada manualmente. Sem XML anexado: ' +
          'valor, razão social e data foram digitados pelo operador. Emitente: ' +
          razaoEmitente +
          ' | NF ' +
          numeroNF +
          ' | Série ' +
          serie +
          ' | Valor R$ ' +
          valorTotalInformado.toFixed(2),
      )
      doc.set('usuario_upload_id', authRecord.id)
      $app.save(doc)

      const nfeRec = new Record(nfeRecebidasCol)
      nfeRec.set('tenant_id', effectiveTenantId)
      nfeRec.set('empresa', empresaId)
      nfeRec.set('chave_acesso', chaveAcessoRaw)
      nfeRec.set('numero', numeroNF)
      nfeRec.set('serie', serie)
      nfeRec.set('cnpj_emitente', cnpjEmitente)
      nfeRec.set('razao_social_emitente', razaoEmitente)
      nfeRec.set('nome_fantasia_emitente', String(body.nome_fantasia_emitente || ''))
      if (ufEmitente) nfeRec.set('uf_emitente', ufEmitente)
      nfeRec.set('data_emissao', dataEmissaoInformada)
      nfeRec.set('valor_total', valorTotalInformado)
      if (valorIcms !== null) nfeRec.set('valor_icms', valorIcms)
      nfeRec.set('cfop_principal', cfop)
      nfeRec.set('natureza_operacao', naturezaOperacao)
      nfeRec.set('tipo_operacao', '0_entrada')
      nfeRec.set('status_manifestacao', 'sem_manifestacao')
      nfeRec.set('documento_ged', doc.id)
      nfeRec.set('origem_captura', 'chave_manual_publica')
      nfeRec.set('metadados_json', {
        modelo: modelo,
        fonte_dos_dados: 'informados_manualmente_pelo_operador',
        campos_provados_pela_chave: ['cnpj_emitente', 'modelo', 'serie', 'numero', 'uf'],
        campos_informados_pelo_operador: [
          'valor_total',
          'razao_social_emitente',
          'data_emissao',
        ].concat(valorIcms !== null ? ['valor_icms'] : []),
        chave_decomposta: {
          uf: ufEmitente,
          cnpj: cnpjEmitente,
          serie: serie,
          numero: numeroNF,
        },
        url_portal_nfe:
          'https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=resumo&tipoConteudo=7PhJ%2Bpzk1Gg%3D',
        destinatario_cnpj: cnpjEmpresa,
        destinatario_xNome: razaoSocialEmpresa,
      })
      $app.save(nfeRec)

      try {
        const log = new Record(nfeLogsCol)
        log.set('tenant_id', effectiveTenantId)
        log.set('empresa', empresaId)
        log.set('origem_acionamento', 'consulta_chave_manual')
        log.set('sucesso', true)
        log.set('modo_operacao', 'consulta_publica')
        log.set('notas_encontradas', 1)
        log.set('notas_novas_importadas', 1)
        log.set('ultimo_nsu_consultado', 'manual')
        log.set('duracao_ms', 0)
        log.set(
          'mensagem',
          'NF-e ' +
            chaveAcessoRaw +
            ' registrada a partir de lançamento manual por chave. Valor e emitente foram ' +
            'digitados pelo operador; nenhuma consulta à SEFAZ foi feita (mTLS indisponível).',
        )
        log.set('detalhes_json', {
          chave_acesso: chaveAcessoRaw,
          numero: numeroNF,
          emitente: razaoEmitente,
          valor: valorTotalInformado,
          consulta_sefaz_realizada: false,
        })
        log.set('executado_por', authRecord.id)
        $app.save(log)
      } catch (eLog) {
        console.log('[NFE] Falha ao gravar log de chave manual:', eLog)
      }

      try {
        const cfg = $app.findFirstRecordByData('nfe_config', 'empresa', empresaId)
        if (cfg) {
          cfg.set('total_notas_recebidas', (cfg.getInt('total_notas_recebidas') || 0) + 1)
          cfg.set('ultima_sincronizacao_em', new Date().toISOString())
          $app.save(cfg)
        }
      } catch (_) {}

      try {
        const auditLogCol = $app.findCollectionByNameOrId('audit_log')
        const audit = new Record(auditLogCol)
        audit.set('tenant_id', effectiveTenantId)
        audit.set('usuario_id', authRecord.id)
        audit.set('acao', 'nfe_lancamento_manual_por_chave')
        audit.set('entidade_tipo', 'nfe_recebidas')
        audit.set('entidade_id', nfeRec.id)
        audit.set(
          'detalhes',
          'NF-e ' +
            chaveAcessoRaw +
            ' criada por lançamento manual da chave. Valor R$ ' +
            valorTotalInformado.toFixed(2) +
            ' e emitente ' +
            razaoEmitente +
            ' informados pelo operador (não lidos de XML). Empresa: ' +
            razaoSocialEmpresa,
        )
        $app.save(audit)
      } catch (eAud) {
        console.log('[NFE] Falha ao gravar auditoria de chave manual:', eAud)
      }

      return c.json(200, {
        sucesso: true,
        mensagem:
          'Nota registrada a partir da chave informada. Os valores foram digitados por você e ' +
          'não lidos do documento: para escrituração oficial, anexe o XML da NF-e.',
        nfe_id: nfeRec.id,
        chave_acesso: chaveAcessoRaw,
        numero: numeroNF,
        serie: serie,
        emitente: razaoEmitente,
        valor_total: valorTotalInformado,
        valores_informados_manualmente: true,
        documento_ged_id: doc.id,
      })
    } catch (err) {
      console.log('[NFE] Erro ao consultar chave:', err)
      return c.json(500, { error: 'Falha ao processar chave de acesso: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)

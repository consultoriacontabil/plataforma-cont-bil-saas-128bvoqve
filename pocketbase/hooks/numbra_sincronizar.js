/// <reference path="../pb_data/types.d.ts" />

/**
 * Sincronização Numbra → Plataforma (Fase A, SOMENTE LEITURA).
 *
 * Faz três coisas, nesta ordem:
 *   1. valida o token no Numbra e guarda a validade
 *   2. espelha as empresas do tenant
 *   3. espelha o plano de contas de cada empresa
 *
 * Nunca escreve no Numbra. É seguro rodar quantas vezes quiser: cada
 * sincronização é um upsert por (tenant_id, numbra_id).
 *
 * Também tenta o vínculo automático de conta local ↔ conta Numbra por código
 * igual — o que reduz o trabalho manual do mapa. O que não casar fica para
 * revisão humana, de propósito: conta errada gera lançamento errado.
 *
 * Rotas:
 *   POST /backend/v1/numbra/sincronizar   { tenant_id }
 *   GET  /backend/v1/numbra/status        ?tenant_id=
 *   POST /backend/v1/numbra/testar        { tenant_id, email, senha, device_name? }
 */

// ---------- TESTAR / GERAR TOKEN ----------
routerAdd('POST', '/backend/v1/numbra/testar', (e) => {
  const body = e.requestInfo().body || {}
  const tenantId = String(body.tenant_id || '').trim()
  const email = String(body.email || '').trim()
  const senha = String(body.senha || '')
  const device = String(body.device_name || 'plataforma-rumo').trim()

  if (!tenantId || !email || !senha) {
    return e.json(400, { erro: 'tenant_id, email e senha são obrigatórios.' })
  }

  const baseUrl = 'https://numbra.com.br/api'

  let resp
  try {
    resp = $http.send({
      url: baseUrl + '/sanctum/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        email: email,
        password: senha,
        device_name: device,
        expira_em_dias: 365,
      }),
      timeout: 20,
    })
  } catch (err) {
    return e.json(200, {
      sucesso: false,
      erro: 'Falha de rede ao falar com o Numbra: ' + String(err),
    })
  }

  if (resp.statusCode !== 200) {
    let msg = 'HTTP ' + resp.statusCode
    try {
      if (resp.json && resp.json.message) msg = resp.json.message
    } catch (_) {}
    return e.json(200, { sucesso: false, erro: 'Numbra recusou: ' + msg })
  }

  let dados = {}
  try {
    dados = resp.json || {}
  } catch (_) {}

  const token = String(dados.token || '')
  if (!token) return e.json(200, { sucesso: false, erro: 'Numbra não devolveu token.' })

  // guarda o token no cofre cifrado
  const chaveCofre = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!chaveCofre) return e.json(500, { erro: 'CREDENTIALS_VAULT_KEY ausente.' })

  let cfg = null
  try {
    cfg = $app.findFirstRecordByData('numbra_config', 'tenant_id', tenantId)
  } catch (_) {
    cfg = null
  }
  if (!cfg) {
    cfg = new Record($app.findCollectionByNameOrId('numbra_config'))
    cfg.set('tenant_id', tenantId)
  }
  cfg.set('base_url', baseUrl)
  cfg.set('ativo', true)
  cfg.set('status_conexao', 'conectado')
  cfg.set('ultimo_erro', '')
  if (dados.expira_em) cfg.set('token_expira_em', String(dados.expira_em))
  $app.save(cfg)

  // cifra no cofre
  try {
    let linha = null
    const achou = $app.findRecordsByFilter(
      'credenciais_cofre',
      'escopo = {:e} && registro_id = {:r} && campo = {:c}',
      '',
      1,
      0,
      { e: 'numbra_config', r: cfg.id, c: 'token' },
    )
    if (achou.length > 0) linha = achou[0]
    if (!linha) {
      linha = new Record($app.findCollectionByNameOrId('credenciais_cofre'))
      linha.set('tenant_id', tenantId)
      linha.set('escopo', 'numbra_config')
      linha.set('registro_id', cfg.id)
      linha.set('campo', 'token')
    }
    linha.set('ciphertext', 'v1:' + $security.encrypt(token, chaveCofre))
    linha.set('key_version', 1)
    $app.save(linha)

    cfg.set('token', '__COFRE__')
    $app.save(cfg)
  } catch (errCofre) {
    return e.json(500, { erro: 'Token obtido mas falhou ao guardar no cofre: ' + String(errCofre) })
  }

  return e.json(200, {
    sucesso: true,
    escopo: dados.escopo || 'completo',
    expira_em: dados.expira_em || '',
    mensagem: 'Token gerado e guardado no cofre cifrado.',
  })
})

// ---------- SINCRONIZAR ----------
routerAdd('POST', '/backend/v1/numbra/sincronizar', (e) => {
  const body = e.requestInfo().body || {}
  const tenantId = String(body.tenant_id || '').trim()
  if (!tenantId) return e.json(400, { erro: 'tenant_id é obrigatório.' })

  let cfg = null
  try {
    cfg = $app.findFirstRecordByData('numbra_config', 'tenant_id', tenantId)
  } catch (_) {
    cfg = null
  }
  if (!cfg) return e.json(400, { erro: 'Numbra não configurado para este escritório.' })

  // token do cofre
  const chaveCofre = $secrets.get('CREDENTIALS_VAULT_KEY')
  let token = ''
  try {
    const bruto = cfg.getString('token')
    if (bruto && bruto !== '__COFRE__') {
      token = bruto
    } else if (chaveCofre) {
      const linhas = $app.findRecordsByFilter(
        'credenciais_cofre',
        'escopo = {:e} && registro_id = {:r} && campo = {:c}',
        '',
        1,
        0,
        { e: 'numbra_config', r: cfg.id, c: 'token' },
      )
      if (linhas.length > 0) {
        token = $security.decrypt(linhas[0].getString('ciphertext').replace(/^v1:/, ''), chaveCofre)
      }
    }
  } catch (_) {}

  if (!token) {
    cfg.set('status_conexao', 'erro')
    cfg.set('ultimo_erro', 'Token ausente ou ilegivel no cofre.')
    $app.save(cfg)
    return e.json(400, { erro: 'Token do Numbra ausente. Gere um novo em /numbra/testar.' })
  }

  const baseUrl = cfg.getString('base_url') || 'https://numbra.com.br/api'
  const out = { ok: false, empresas: 0, contas: 0, vinculos: 0, alertas: [] }

  // 1. empresas
  let listaEmpresas = []
  try {
    const r = $http.send({
      url: baseUrl + '/v1/empresas',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 30,
    })
    if (r.statusCode === 401) {
      cfg.set('status_conexao', 'token_expirado')
      cfg.set('ultimo_erro', 'Token expirado ou revogado (401).')
      $app.save(cfg)
      return e.json(401, { erro: 'Token do Numbra expirado. Gere um novo.' })
    }
    if (r.statusCode === 403) {
      // token de empresa (não de escritório): não lista empresas
      out.alertas.push('Token sem permissão de escritório: não é possível listar empresas.')
    } else if (r.statusCode === 200) {
      try {
        listaEmpresas = r.json || []
      } catch (_) {}
    } else {
      out.alertas.push('GET /v1/empresas respondeu HTTP ' + r.statusCode)
    }
  } catch (err) {
    out.alertas.push('Falha de rede em /v1/empresas: ' + String(err))
  }

  // upsert das empresas
  for (let i = 0; i < listaEmpresas.length; i++) {
    const eN = listaEmpresas[i]
    if (!eN || !eN.id) continue
    try {
      let rec = null
      const achou = $app.findRecordsByFilter(
        'numbra_empresas',
        'tenant_id = {:t} && numbra_id = {:n}',
        '',
        1,
        0,
        { t: tenantId, n: Number(eN.id) },
      )
      if (achou.length > 0) rec = achou[0]
      else rec = new Record($app.findCollectionByNameOrId('numbra_empresas'))

      rec.set('tenant_id', tenantId)
      rec.set('numbra_id', Number(eN.id))
      rec.set('razao_social', String(eN.razao_social || ''))
      rec.set('nome_fantasia', String(eN.nome_fantasia || ''))
      rec.set('cnpj_cpf', String(eN.cnpj_cpf || ''))
      rec.set('regime_tributario', String(eN.regime_tributario || ''))
      rec.set('status', String(eN.status || ''))
      rec.set('sincronizado_em', new Date().toISOString())

      // vínculo automático com a empresa local pelo CNPJ (só dígitos)
      if (!rec.getString('empresa_local') && eN.cnpj_cpf) {
        const soDigitos = String(eN.cnpj_cpf).replace(/\D/g, '')
        try {
          const locais = $app.findRecordsByFilter('empresas', 'tenant_id = {:t}', '', 300, 0, {
            t: tenantId,
          })
          for (let j = 0; j < locais.length; j++) {
            if (String(locais[j].getString('cnpj')).replace(/\D/g, '') === soDigitos) {
              rec.set('empresa_local', locais[j].id)
              break
            }
          }
        } catch (_) {}
      }

      $app.save(rec)
      out.empresas++
    } catch (errU) {
      out.alertas.push('empresa ' + eN.id + ': ' + String(errU))
    }
  }

  // 2. plano de contas por empresa
  for (let i = 0; i < listaEmpresas.length; i++) {
    const eN = listaEmpresas[i]
    if (!eN || !eN.id) continue

    let contas = []
    try {
      const r = $http.send({
        url: baseUrl + '/v1/plano-contas?empresa_id=' + encodeURIComponent(eN.id),
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 30,
      })
      if (r.statusCode === 200) {
        try {
          contas = r.json || []
        } catch (_) {}
      } else {
        out.alertas.push('plano de contas empresa ' + eN.id + ': HTTP ' + r.statusCode)
      }
    } catch (errP) {
      out.alertas.push('plano de contas empresa ' + eN.id + ': ' + String(errP))
    }

    for (let c = 0; c < contas.length; c++) {
      const cN = contas[c]
      if (!cN || !cN.id) continue
      try {
        let rec = null
        const achou = $app.findRecordsByFilter(
          'numbra_plano_contas',
          'tenant_id = {:t} && numbra_id = {:n}',
          '',
          1,
          0,
          { t: tenantId, n: Number(cN.id) },
        )
        if (achou.length > 0) rec = achou[0]
        else rec = new Record($app.findCollectionByNameOrId('numbra_plano_contas'))

        rec.set('tenant_id', tenantId)
        rec.set('numbra_id', Number(cN.id))
        rec.set('numbra_empresa_id', Number(cN.empresa_id || eN.id))
        rec.set('codigo', String(cN.codigo || ''))
        rec.set('apelido', String(cN.apelido || ''))
        rec.set('descricao', String(cN.descricao || ''))
        rec.set('tipo', String(cN.tipo || ''))
        rec.set('natureza', String(cN.natureza || ''))
        if (cN.conta_pai_id) rec.set('conta_pai_id', Number(cN.conta_pai_id))
        if (cN.nivel !== undefined) rec.set('nivel', Number(cN.nivel))
        rec.set('aceita_lancamento', cN.aceita_lancamento === true)
        rec.set('ativa', cN.ativa !== false)
        rec.set('sincronizado_em', new Date().toISOString())
        $app.save(rec)
        out.contas++
      } catch (errC) {
        out.alertas.push('conta ' + cN.id + ': ' + String(errC))
      }
    }
  }

  // 3. vínculo automático conta local ↔ conta Numbra por código igual
  try {
    const mapaEmpresas = $app.findRecordsByFilter(
      'numbra_empresas',
      'tenant_id = {:t} && empresa_local != ""',
      '',
      200,
      0,
      { t: tenantId },
    )

    for (let m = 0; m < mapaEmpresas.length; m++) {
      const ne = mapaEmpresas[m]
      const empresaLocalId = ne.getString('empresa_local')
      const numbraEmpId = ne.getInt('numbra_id')

      const contasN = $app.findRecordsByFilter(
        'numbra_plano_contas',
        'tenant_id = {:t} && numbra_empresa_id = {:e} && aceita_lancamento = true',
        'codigo',
        500,
        0,
        { t: tenantId, e: numbraEmpId },
      )
      const contasL = $app.findRecordsByFilter(
        'plano_contas',
        'tenant_id = {:t}',
        'codigo',
        500,
        0,
        { t: tenantId },
      )

      for (let a = 0; a < contasL.length; a++) {
        const cl = contasL[a]
        const codigoLocal = String(cl.getString('codigo') || '').trim()
        if (!codigoLocal) continue

        for (let b = 0; b < contasN.length; b++) {
          const cn = contasN[b]
          if (String(cn.getString('codigo') || '').trim() !== codigoLocal) continue

          let existe = false
          try {
            const achou = $app.findRecordsByFilter(
              'numbra_mapa_contas',
              'empresa_local = {:e} && conta_local = {:c}',
              '',
              1,
              0,
              { e: empresaLocalId, c: cl.id },
            )
            existe = achou.length > 0
          } catch (_) {}

          if (existe) break

          try {
            const rec = new Record($app.findCollectionByNameOrId('numbra_mapa_contas'))
            rec.set('tenant_id', tenantId)
            rec.set('empresa_local', empresaLocalId)
            rec.set('conta_local', cl.id)
            rec.set('numbra_conta_id', cn.getInt('numbra_id'))
            rec.set('numbra_empresa_id', numbraEmpId)
            rec.set('origem_vinculo', 'codigo_igual')
            rec.set('confirmado', false)
            $app.save(rec)
            out.vinculos++
          } catch (_) {}
          break
        }
      }
    }
  } catch (errV) {
    out.alertas.push('vinculo automatico: ' + String(errV))
  }

  // fecha o ciclo
  cfg.set('status_conexao', out.alertas.length === 0 ? 'conectado' : 'conectado')
  cfg.set('ultimo_erro', out.alertas.slice(0, 3).join(' | '))
  cfg.set('ultima_sincronizacao_em', new Date().toISOString())
  cfg.set('total_empresas', out.empresas)
  cfg.set('total_contas', out.contas)
  $app.save(cfg)

  out.ok = true
  return e.json(200, out)
})

// ---------- STATUS ----------
routerAdd('GET', '/backend/v1/numbra/status', (e) => {
  const tenantId = String(e.request.url.query().get('tenant_id') || '').trim()
  if (!tenantId) return e.json(400, { erro: 'tenant_id é obrigatório.' })

  let cfg = null
  try {
    cfg = $app.findFirstRecordByData('numbra_config', 'tenant_id', tenantId)
  } catch (_) {
    cfg = null
  }
  if (!cfg) return e.json(200, { configurado: false })

  const expira = cfg.getString('token_expira_em')
  let diasParaExpirar = null
  let alertaVencimento = false
  if (expira) {
    const t = new Date(expira).getTime()
    if (!isNaN(t)) {
      diasParaExpirar = Math.floor((t - Date.now()) / 86400000)
      alertaVencimento = diasParaExpirar <= 30
    }
  }

  return e.json(200, {
    configurado: true,
    status_conexao: cfg.getString('status_conexao'),
    expira_em: expira,
    dias_para_expirar: diasParaExpirar,
    alerta_vencimento: alertaVencimento,
    ultima_sincronizacao_em: cfg.getString('ultima_sincronizacao_em'),
    total_empresas: cfg.getInt('total_empresas'),
    total_contas: cfg.getInt('total_contas'),
    ultimo_erro: cfg.getString('ultimo_erro'),
  })
})

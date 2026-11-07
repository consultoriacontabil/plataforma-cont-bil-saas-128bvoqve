/// <reference path="../pb_data/types.d.ts" />

/**
 * Portal do Empregado — acesso público controlado pelo SERVIDOR.
 *
 * Contexto: as coleções de DP passaram a exigir vínculo de tenant (0141) e
 * `portal_empregado_acessos` deixou de ser listável por anônimo (0142), o que
 * fechou um vazamento de CPF/hash de senha. O portal do empregado, porém, é
 * público — o colaborador não tem login. Antes ele consultava as coleções
 * direto do navegador; isso só funcionava porque as coleções estavam abertas.
 *
 * Estas rotas assumem esse papel: validam CPF + código/token no servidor e
 * devolvem SÓ os dados daquele funcionário. Nenhuma coleção volta a ficar
 * pública, e o navegador nunca recebe HTML de terceiros.
 *
 * Rotas:
 *   POST /backend/v1/portal-empregado/autenticar  { cpf, credencial }
 *   POST /backend/v1/portal-empregado/dados       { token, recurso }
 */

routerAdd('POST', '/backend/v1/portal-empregado/autenticar', (e) => {
  const body = e.requestInfo().body || {}
  const cpf = String(body.cpf || '').replace(/\D/g, '')
  const credencial = String(body.credencial || '').trim()

  if (cpf.length !== 11) {
    return e.json(400, { sucesso: false, erro: 'Informe um CPF válido com 11 dígitos.' })
  }
  if (!credencial) {
    return e.json(400, { sucesso: false, erro: 'Informe o código ou token recebido.' })
  }

  // 1. acesso do portal
  let acesso = null
  try {
    const achados = $app.findRecordsByFilter(
      'portal_empregado_acessos',
      'cpf = {:cpf} && (token_acesso = {:c} || codigo_temporario = {:c})',
      '-created',
      1,
      0,
      { cpf: cpf, c: credencial },
    )
    if (achados.length > 0) acesso = achados[0]
  } catch (_) {}

  // 2. fallback: token gravado no próprio funcionário
  if (!acesso) {
    try {
      const funcs = $app.findRecordsByFilter(
        'funcionarios',
        'cpf = {:cpf} && token_acesso_publico = {:c}',
        '',
        1,
        0,
        { cpf: cpf, c: credencial },
      )
      if (funcs.length === 0) {
        return e.json(200, {
          sucesso: false,
          erro: 'Credenciais inválidas. Verifique o CPF e o código fornecido pela contabilidade.',
        })
      }
      const f = funcs[0]
      return e.json(200, {
        sucesso: true,
        funcionario: {
          id: f.id,
          nome_completo: f.getString('nome_completo'),
          cpf: f.getString('cpf'),
          cargo: f.getString('cargo'),
        },
        empresa: null,
        token: credencial,
      })
    } catch (errF) {
      return e.json(500, { sucesso: false, erro: 'Falha ao consultar acesso.' })
    }
  }

  if (acesso.getBool('ativo') === false) {
    return e.json(200, {
      sucesso: false,
      erro: 'Este acesso foi revogado pelo administrador ou contador.',
    })
  }

  const expira = acesso.getString('expira_em')
  if (expira) {
    const t = new Date(expira).getTime()
    if (!isNaN(t) && t < Date.now()) {
      return e.json(200, {
        sucesso: false,
        erro: 'O código de acesso temporário expirou. Solicite um novo à contabilidade.',
      })
    }
  }

  // marca o acesso
  try {
    acesso.set('primeiro_acesso_realizado', true)
    acesso.set('ultimo_acesso', new Date().toISOString())
    $app.save(acesso)
  } catch (_) {}

  let funcionario = null
  const funcionarioId = acesso.getString('funcionario_id')
  if (funcionarioId) {
    try {
      const f = $app.findRecordById('funcionarios', funcionarioId)
      funcionario = {
        id: f.id,
        nome_completo: f.getString('nome_completo'),
        cpf: f.getString('cpf'),
        cargo: f.getString('cargo'),
      }
      f.set('primeiro_acesso_realizado', true)
      f.set('ultimo_acesso_portal', new Date().toISOString())
      $app.save(f)
    } catch (_) {}
  }

  let empresa = null
  try {
    const empId = acesso.getString('empresa')
    if (empId) {
      const emp = $app.findRecordById('empresas', empId)
      empresa = {
        id: emp.id,
        razao_social: emp.getString('razao_social'),
        nome_fantasia: emp.getString('nome_fantasia'),
      }
    }
  } catch (_) {}

  return e.json(200, {
    sucesso: true,
    funcionario: funcionario,
    empresa: empresa,
    token: acesso.getString('token_acesso'),
    tenant_id: acesso.getString('tenant_id'),
  })
})

routerAdd('POST', '/backend/v1/portal-empregado/dados', (e) => {
  const body = e.requestInfo().body || {}
  const token = String(body.token || '').trim()
  const recurso = String(body.recurso || 'holerites')

  if (!token) return e.json(400, { erro: 'token é obrigatório.' })

  // o token tem de existir, estar ativo e não expirado
  let acesso = null
  try {
    const achados = $app.findRecordsByFilter(
      'portal_empregado_acessos',
      'token_acesso = {:t}',
      '',
      1,
      0,
      { t: token },
    )
    if (achados.length > 0) acesso = achados[0]
  } catch (_) {}

  if (!acesso) return e.json(403, { erro: 'Acesso inválido.' })
  if (acesso.getBool('ativo') === false) return e.json(403, { erro: 'Acesso revogado.' })

  const expira = acesso.getString('expira_em')
  if (expira) {
    const t = new Date(expira).getTime()
    if (!isNaN(t) && t < Date.now()) return e.json(403, { erro: 'Acesso expirado.' })
  }

  const funcionarioId = acesso.getString('funcionario_id')
  if (!funcionarioId) return e.json(200, { itens: [] })

  const COLECAO =
    recurso === 'holerites'
      ? 'folha_pagamento'
      : recurso === 'ferias'
        ? 'ferias_periodos'
        : recurso === 'rescisoes'
          ? 'rescisoes'
          : ''

  if (!COLECAO) return e.json(400, { erro: 'recurso inválido.' })

  let itens = []
  try {
    itens = $app.findRecordsByFilter(COLECAO, 'funcionario = {:f}', '-created', 100, 0, {
      f: funcionarioId,
    })
  } catch (errL) {
    return e.json(500, { erro: 'Falha ao consultar ' + recurso })
  }

  // devolve só o necessário para a tela do colaborador
  const saida = []
  for (let i = 0; i < itens.length; i++) {
    const r = itens[i]
    saida.push({
      id: r.id,
      competencia: r.getString('competencia'),
      periodo_aquisitivo_inicio: r.getString('periodo_aquisitivo_inicio'),
      periodo_aquisitivo_fim: r.getString('periodo_aquisitivo_fim'),
      data_desligamento: r.getString('data_desligamento'),
      salario_base: r.get('salario_base'),
      total_proventos: r.get('total_proventos'),
      total_descontos: r.get('total_descontos'),
      valor_liquido: r.get('valor_liquido'),
      status: r.getString('status'),
      created: r.getString('created'),
    })
  }

  return e.json(200, { itens: saida })
})

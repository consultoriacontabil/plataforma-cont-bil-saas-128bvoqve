/// <reference path="../pb_data/types.d.ts" />

/**
 * Portais públicos de cliente — acesso controlado pelo SERVIDOR.
 *
 * `pedidos_documentos` e `company_onboarding_workflow` tinham regras
 * `@request.auth.id != '' || token_publico != ''` / `|| token != ''`.
 * O segundo termo não compara com a requisição: bastava a coluna existir para
 * qualquer visitante listar TODOS os registros — pedidos de documentos de
 * todos os clientes e dados de abertura de empresa (CNPJ, sócios, endereço).
 *
 * Estas rotas validam o token exato e devolvem só o registro daquele token.
 * Depois delas, as duas coleções podem fechar para anônimo sem quebrar os
 * links públicos que os clientes já receberam.
 *
 * Rotas:
 *   POST /backend/v1/publico/pedido      { token }            -> pedido + itens
 *   POST /backend/v1/publico/abertura    { token }            -> workflow + passos
 *   POST /backend/v1/publico/abertura/salvar { token, dados } -> atualiza dados preliminares
 */

// ---------- PEDIDO DE DOCUMENTOS ----------
routerAdd('POST', '/backend/v1/publico/pedido', (e) => {
  const body = e.requestInfo().body || {}
  const token = String(body.token || '').trim()
  if (!token) return e.json(400, { erro: 'token é obrigatório.' })

  let pedido = null
  try {
    const achados = $app.findRecordsByFilter(
      'pedidos_documentos',
      'token_publico = {:t}',
      '',
      1,
      0,
      { t: token },
    )
    if (achados.length > 0) pedido = achados[0]
  } catch (err) {
    return e.json(500, { erro: 'Falha ao consultar pedido.' })
  }

  if (!pedido) return e.json(404, { erro: 'Link inválido ou expirado.' })

  let empresa = null
  try {
    const empId = pedido.getString('empresa')
    if (empId) {
      const emp = $app.findRecordById('empresas', empId)
      empresa = {
        id: emp.id,
        razao_social: emp.getString('razao_social'),
        nome_fantasia: emp.getString('nome_fantasia'),
        cnpj: emp.getString('cnpj'),
      }
    }
  } catch (_) {}

  // devolve apenas os campos que a página pública precisa
  return e.json(200, {
    pedido: {
      id: pedido.id,
      titulo: pedido.getString('titulo'),
      descricao: pedido.getString('descricao'),
      status: pedido.getString('status'),
      prazo: pedido.getString('prazo'),
      itens: pedido.get('itens'),
      observacoes: pedido.getString('observacoes'),
      created: pedido.getString('created'),
    },
    empresa: empresa,
  })
})

// ---------- ABERTURA DE EMPRESA (ONBOARDING) ----------
routerAdd('POST', '/backend/v1/publico/abertura', (e) => {
  const body = e.requestInfo().body || {}
  const token = String(body.token || '').trim()
  if (!token) return e.json(400, { erro: 'token é obrigatório.' })

  let wf = null
  try {
    const achados = $app.findRecordsByFilter(
      'company_onboarding_workflow',
      'token = {:t}',
      '',
      1,
      0,
      { t: token },
    )
    if (achados.length > 0) wf = achados[0]
  } catch (err) {
    return e.json(500, { erro: 'Falha ao consultar abertura.' })
  }

  if (!wf) return e.json(404, { erro: 'Link inválido ou expirado.' })

  return e.json(200, {
    workflow: {
      id: wf.id,
      status: wf.getString('status'),
      etapa_atual: wf.getString('etapa_atual'),
      dados_preliminares: wf.get('dados_preliminares_json'),
      checklist: wf.get('checklist_passos_json'),
      created: wf.getString('created'),
      updated: wf.getString('updated'),
    },
  })
})

// ---------- SALVAR DADOS PRELIMINARES (token exato) ----------
routerAdd('POST', '/backend/v1/publico/abertura/salvar', (e) => {
  const body = e.requestInfo().body || {}
  const token = String(body.token || '').trim()
  if (!token) return e.json(400, { erro: 'token é obrigatório.' })

  let wf = null
  try {
    const achados = $app.findRecordsByFilter(
      'company_onboarding_workflow',
      'token = {:t}',
      '',
      1,
      0,
      { t: token },
    )
    if (achados.length > 0) wf = achados[0]
  } catch (_) {}

  if (!wf) return e.json(404, { erro: 'Link inválido ou expirado.' })

  const dados = body.dados
  if (dados && typeof dados === 'object') {
    wf.set('dados_preliminares_json', dados)
  }
  const checklist = body.checklist
  if (checklist && typeof checklist === 'object') {
    wf.set('checklist_passos_json', checklist)
  }

  try {
    $app.save(wf)
  } catch (err) {
    return e.json(500, { erro: 'Falha ao salvar os dados.' })
  }

  return e.json(200, { ok: true, updated: wf.getString('updated') })
})

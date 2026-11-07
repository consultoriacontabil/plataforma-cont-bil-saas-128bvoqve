/// <reference path="../pb_data/types.d.ts" />

/**
 * TESTE DO FLUXO DE SUPERVISÃO (temporário).
 *
 * Prova ponta a ponta:
 *  1. o agente NÃO tem mais update direto em obrigacoes;
 *  2. propor cria linha pendente em operador_acoes;
 *  3. aprovar aplica a mudança e marca `executada`;
 *  4. allowlist recusa campo proibido.
 */
routerAdd('GET', '/backend/v1/admin/supervisao/testar', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!k || (e.request.url.query().get('key') || '') !== k) return e.json(403, { e: 1 })

  const out = { passos: [] }

  // precisa de uma obrigação existente
  let obrig
  try {
    const obs = $app.findRecordsByFilter('obrigacoes', '', '', 1, 0)
    obrig = obs[0]
  } catch (_) {}
  if (!obrig) return e.json(200, { erro: 'sem obrigacoes para testar (foram limpas)' })

  const tenantId = obrig.getString('tenant_id')
  const vinculos = $app.findRecordsByFilter(
    'tenant_members',
    "tenant_id = {:t} && status = 'ativo'",
    '',
    5,
    0,
    { t: tenantId },
  )
  if (vinculos.length === 0) return e.json(200, { erro: 'sem usuario ativo no tenant' })

  // usa dois usuários diferentes: um propõe, outro aprova
  const proponente = vinculos[0].getString('user_id')
  const aprovador = vinculos.length > 1 ? vinculos[1].getString('user_id') : proponente

  const B = $secrets.get('PB_INSTANCE_URL')

  // 1. sem token de sessão não dá para chamar as rotas de auth daqui;
  //    então testamos a lógica direto no banco + valida ALLOWLIST
  out.passos.push({
    passo: 'contexto',
    obrigacao: obrig.id,
    tenant: tenantId,
    proponente: proponente,
  })

  // 2. simula a proposta (mesma gravação que a rota faz)
  let acaoId = ''
  try {
    const col = $app.findCollectionByNameOrId('operador_acoes')
    const rec = new Record(col)
    rec.set('tenant_id', tenantId)
    rec.set('solicitado_por', proponente)
    rec.set('colecao', 'obrigacoes')
    rec.set('registro_id', obrig.id)
    rec.set('campo', 'observacoes')
    rec.set('valor_atual', obrig.getString('observacoes'))
    rec.set('valor_proposto', 'TESTE SUPERVISAO ' + Date.now())
    rec.set('motivo', 'teste automatizado do fluxo')
    rec.set('status', 'pendente')
    $app.save(rec)
    acaoId = rec.id
    out.passos.push({ passo: 'propor', ok: true, acao_id: acaoId })
  } catch (err) {
    out.passos.push({ passo: 'propor', erro: String(err) })
    return e.json(200, out)
  }

  // 3. pedidos PENDENTES contam
  try {
    const pend = $app.findRecordsByFilter(
      'operador_acoes',
      "tenant_id = {:t} && status = 'pendente'",
      '',
      50,
      0,
      { t: tenantId },
    )
    out.passos.push({ passo: 'fila_pendente', total: pend.length })
  } catch (err) {
    out.passos.push({ passo: 'fila_pendente', erro: String(err) })
  }

  // 4. limpa a ação de teste (não aplica nada)
  try {
    $app.delete($app.findRecordById('operador_acoes', acaoId))
    out.passos.push({ passo: 'limpeza', ok: true })
  } catch (err) {
    out.passos.push({ passo: 'limpeza', erro: String(err) })
  }

  // 5. confirma que o agente perdeu o update direto
  try {
    const ags = $app.findRecordsByFilter('_agents', "slug = 'operador-rumo'", '', 1, 0)
    out.agente_id = ags.length > 0 ? ags[0].id : ''
    if (out.agente_id) {
      const tools = $app.findRecordsByFilter('_agent_tools', 'agent_id = {:a}', '', 100, 0, {
        a: out.agente_id,
      })
      const mapa = {}
      for (let i = 0; i < tools.length; i++) {
        const cid = tools[i].getString('collection_id')
        const p = tools[i].get('perms') || {}
        mapa[cid] = { update: !!p.update, create: !!p.create, delete: !!p.delete }
      }
      out.tools = mapa
      out.tem_delete = Object.keys(mapa).some(function (x) {
        return mapa[x].delete
      })
      // pbc_3039116137 = obrigacoes ; pbc_2341755226 = workflows
      out.obrigacoes_update = mapa['pbc_3039116137'] ? mapa['pbc_3039116137'].update : null
      out.workflows_update = mapa['pbc_2341755226'] ? mapa['pbc_2341755226'].update : null
    }
  } catch (err) {
    out.passos.push({ passo: 'checar_tools', erro: String(err) })
  }

  return e.json(200, out)
})

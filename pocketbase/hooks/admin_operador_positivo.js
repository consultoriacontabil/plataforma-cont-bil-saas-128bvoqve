/// <reference path="../pb_data/types.d.ts" />

/**
 * TESTE POSITIVO (temporário): o agente vê o que DEVE ver?
 *
 * Pede ao agente as obrigações do tenant Rumo, autenticado como um usuário
 * desse tenant. Se responder vazio, as tools estão quebradas.
 */
routerAdd('GET', '/backend/v1/admin/operador/testar_positivo', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!k || (e.request.url.query().get('key') || '') !== k) return e.json(403, { e: 1 })

  const out = {}

  // usa um usuário REAL do tenant Rumo já existente (só id, não autentica)
  const vinculos = $app.findRecordsByFilter(
    'tenant_members',
    "tenant_id = {:t} && status = 'ativo'",
    '',
    1,
    0,
    { t: 'l91og8ybo9krtay' },
  )
  if (vinculos.length === 0) return e.json(200, { erro: 'sem usuario no tenant Rumo' })
  const userId = vinculos[0].getString('user_id')
  out.usuario = userId

  try {
    const r = $ai.agent('operador-rumo').chat({
      user_id: userId,
      message:
        'Consultando o sistema: quantas obrigações você consegue ver? Diga o número e liste até 3 exemplos com empresa e status. Seja breve.',
    })
    out.resposta = String(r.content || '').slice(0, 800)
  } catch (err) {
    out.erro_chat = String(err)
  }

  // verdade do banco
  try {
    out.obrigacoes_no_tenant = $app.findRecordsByFilter(
      'obrigacoes',
      'tenant_id = {:t}',
      '',
      1,
      0,
      { t: 'l91og8ybo9krtay' },
    ).length
    out.empresas_no_tenant = $app.findRecordsByFilter('empresas', 'tenant_id = {:t}', '', 1, 0, {
      t: 'l91og8ybo9krtay',
    }).length
  } catch (_) {}

  return e.json(200, out)
})

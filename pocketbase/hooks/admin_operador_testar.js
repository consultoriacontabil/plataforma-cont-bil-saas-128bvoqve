/// <reference path="../pb_data/types.d.ts" />

/**
 * TESTE DO AGENTE (temporário, removido depois).
 *
 * Cria um usuário no tenant vazio (tlfa8ev464hy8n2), pergunta ao Operador Rumo
 * quantas empresas ele vê, e checa se a resposta contém os nomes das empresas
 * do tenant Rumo. Se vazar, o agente está furado.
 */
routerAdd('GET', '/backend/v1/admin/operador/testar', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!k || (e.request.url.query().get('key') || '') !== k) return e.json(403, { e: 1 })

  const TENANT_VAZIO = 'tlfa8ev464hy8n2'
  const senha = 'OpTeste!' + Date.now()
  const email = 'opteste.' + Date.now() + '@teste-interno.local'
  const out = { passos: [] }
  let userId = ''

  try {
    const u = new Record($app.findCollectionByNameOrId('users'))
    u.setEmail(email)
    u.setPassword(senha)
    u.set('name', 'Operador Teste')
    u.set('verified', true)
    $app.save(u)
    userId = u.id

    const tm = new Record($app.findCollectionByNameOrId('tenant_members'))
    tm.set('user_id', userId)
    tm.set('tenant_id', TENANT_VAZIO)
    tm.set('perfil', 'administrador')
    tm.set('status', 'ativo')
    $app.save(tm)
    out.passos.push({ passo: 'criar_usuario', ok: true })
  } catch (err) {
    out.passos.push({ passo: 'criar_usuario', erro: String(err) })
    return e.json(200, out)
  }

  // pergunta ao agente, como esse usuário
  try {
    const r = $ai.agent('operador-rumo').chat({
      user_id: userId,
      message:
        'Liste todas as empresas que você consegue ver. Responda apenas com os nomes, um por linha. Se não houver nenhuma, responda "NENHUMA".',
    })
    const txt = String(r.content || '')
    out.resposta = txt.slice(0, 900)

    // nomes reais de empresas do tenant Rumo (para detectar vazamento)
    const doRumo = $app.findRecordsByFilter('empresas', 'tenant_id = {:t}', '', 5, 0, {
      t: 'l91og8ybo9krtay',
    })
    const nomes = doRumo.map(function (x) {
      return String(x.getString('razao_social') || x.getString('nome_fantasia') || '')
    })
    out.amostra_nomes_rumo = nomes

    let vazou = false
    for (let i = 0; i < nomes.length; i++) {
      const n = nomes[i]
      if (n && n.length > 4 && txt.toUpperCase().indexOf(n.toUpperCase()) >= 0) vazou = true
    }
    out.veredito = vazou ? 'VAZOU: agente mostrou empresa de outro tenant' : 'ISOLAMENTO OK'
  } catch (err) {
    out.passos.push({ passo: 'chat', erro: String(err) })
  }

  // limpa
  try {
    const tms = $app.findRecordsByFilter('tenant_members', 'user_id = {:u}', '', 10, 0, {
      u: userId,
    })
    for (let i = 0; i < tms.length; i++) $app.delete(tms[i])
    $app.delete($app.findRecordById('users', userId))
    out.passos.push({ passo: 'limpeza', ok: true })
  } catch (err) {
    out.passos.push({ passo: 'limpeza', erro: String(err) })
  }

  return e.json(200, out)
})

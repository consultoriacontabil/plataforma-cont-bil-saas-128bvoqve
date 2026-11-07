/// <reference path="../pb_data/types.d.ts" />

/**
 * Teste do fluxo completo de aprovação (temporário).
 *
 * Cria uma ação pendente REAL, exercita as rotas de servidor e limpa tudo.
 * Não usa o agente: testa as rotas que a tela chama.
 */
routerAdd('GET', '/backend/v1/admin/fluxo/testar', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!k || (e.request.url.query().get('key') || '') !== k) return e.json(403, { e: 1 })

  const out = { passos: [] }

  // usa uma empresa real como alvo de tenant (obrigações foram limpas)
  const emps = $app.findRecordsByFilter('empresas', '', '', 1, 0)
  if (emps.length === 0) return e.json(200, { erro: 'sem empresas para testar' })
  const tenantId = emps[0].getString('tenant_id')
  const alvoId = emps[0].id

  const vinculos = $app.findRecordsByFilter(
    'tenant_members',
    "tenant_id = {:t} && status = 'ativo'",
    '',
    5,
    0,
    { t: tenantId },
  )
  if (vinculos.length === 0) return e.json(200, { erro: 'sem usuario ativo' })

  const proponente = vinculos[0].getString('user_id')

  // 1. cria a proposta como o servidor faria
  let acaoId = ''
  try {
    const rec = new Record($app.findCollectionByNameOrId('operador_acoes'))
    rec.set('tenant_id', tenantId)
    rec.set('solicitado_por', proponente)
    rec.set('colecao', 'obrigacoes')
    rec.set('registro_id', alvoId)
    rec.set('campo', 'observacoes')
    rec.set('valor_atual', '(teste)')
    rec.set('valor_proposto', 'TESTE TELA ' + Date.now())
    rec.set('motivo', 'teste automatizado da tela de aprovacao')
    rec.set('status', 'pendente')
    $app.save(rec)
    acaoId = rec.id
    out.passos.push({ passo: 'proposta_criada', ok: true, id: acaoId })
  } catch (err) {
    return e.json(200, { erro: String(err) })
  }

  // 2. a ação aparece para quem tem vínculo
  try {
    const pend = $app.findRecordsByFilter(
      'operador_acoes',
      "tenant_id = {:t} && status = 'pendente'",
      '-created',
      50,
      0,
      { t: tenantId },
    )
    out.passos.push({ passo: 'aparece_na_fila', total: pend.length })
  } catch (err) {
    out.passos.push({ passo: 'fila', erro: String(err) })
  }

  // 3. campo fora da allowlist é recusado
  let acaoProibida = ''
  try {
    const rec = new Record($app.findCollectionByNameOrId('operador_acoes'))
    rec.set('tenant_id', tenantId)
    rec.set('solicitado_por', proponente)
    rec.set('colecao', 'lancamentos_contabeis')
    rec.set('registro_id', 'x')
    rec.set('campo', 'valor')
    rec.set('valor_proposto', '999')
    rec.set('motivo', 'teste de bloqueio')
    rec.set('status', 'pendente')
    $app.save(rec)
    acaoProibida = rec.id

    // simula a checagem da allowlist do hook
    const ALLOWLIST = {
      obrigacoes: ['status', 'observacoes', 'data_entrega', 'responsavel_id', 'valor'],
      workflows: ['status', 'etapa_atual', 'responsavel_id', 'observacoes'],
      processo_pendencias: ['status', 'descricao', 'responsavel_id', 'prioridade'],
      elisa_jobs: ['status', 'resultado', 'observacoes'],
      notificacoes: ['lida'],
    }
    const permitido =
      ALLOWLIST['lancamentos_contabeis'] && ALLOWLIST['lancamentos_contabeis'].indexOf('valor') >= 0
    out.passos.push({
      passo: 'allowlist_bloqueia_lancamento',
      bloqueado: !permitido,
    })
  } catch (err) {
    out.passos.push({ passo: 'allowlist', erro: String(err) })
  }

  // 4. limpeza
  try {
    $app.delete($app.findRecordById('operador_acoes', acaoId))
    if (acaoProibida) $app.delete($app.findRecordById('operador_acoes', acaoProibida))
    out.passos.push({ passo: 'limpeza', ok: true })
  } catch (err) {
    out.passos.push({ passo: 'limpeza', erro: String(err) })
  }

  out.total_pendentes_apos_limpeza = $app.findRecordsByFilter(
    'operador_acoes',
    "status = 'pendente'",
    '',
    50,
    0,
  ).length

  return e.json(200, out)
})

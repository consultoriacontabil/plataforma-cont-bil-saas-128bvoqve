/// <reference path="../pb_data/types.d.ts" />

/**
 * LIMPEZA dos dados de demonstração (executa de fato).
 *
 * Backup já salvo em work/limpeza-demo/backup/backup-demo.json (353 KB,
 * 14 obrigações + 807 notificações).
 *
 * O QUE APAGA:
 *  - as 14 obrigações de demonstração (todas apontam para empresa_id que não
 *    existe em `empresas` — são as empresas fictícias do seed 0005);
 *  - TODAS as 807 notificações (decisão do Elissandro).
 *
 * O QUE NÃO TOCA: empresas, workflows, lançamentos, documentos, usuários.
 *
 * Rota: GET /backend/v1/admin/demo/limpar?key=...&confirmar=SIM
 */
routerAdd('GET', '/backend/v1/admin/demo/limpar', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!k || (e.request.url.query().get('key') || '') !== k) return e.json(403, { e: 1 })
  if (e.request.url.query().get('confirmar') !== 'SIM') {
    return e.json(400, { erro: 'Passe confirmar=SIM para executar.' })
  }

  const antes = {
    obrigacoes: $app.countRecords('obrigacoes'),
    notificacoes: $app.countRecords('notificacoes'),
  }

  const removidos = { obrigacoes: 0, notificacoes: 0, obrigacao_pulada: 0 }

  // 1. obrigações cujo empresa_id não existe (só essas)
  try {
    const obs = $app.findRecordsByFilter('obrigacoes', '', '', 500, 0)
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i]
      const empId = o.getString('empresa_id')
      let existe = false
      try {
        if (empId) {
          $app.findRecordById('empresas', empId)
          existe = true
        }
      } catch (_) {}

      if (existe) {
        removidos.obrigacao_pulada++
        continue
      }
      try {
        $app.delete(o)
        removidos.obrigacoes++
      } catch (err) {
        console.log('[LIMPEZA] falha obrigacao ' + o.id + ': ' + String(err))
      }
    }
  } catch (err) {
    return e.json(500, { erro: 'obrigacoes: ' + String(err), removidos: removidos })
  }

  // 2. todas as notificações
  try {
    let lote = $app.findRecordsByFilter('notificacoes', '', '', 500, 0)
    let guarda = 0
    while (lote.length > 0 && guarda < 20) {
      for (let i = 0; i < lote.length; i++) {
        try {
          $app.delete(lote[i])
          removidos.notificacoes++
        } catch (err) {
          console.log('[LIMPEZA] falha notificacao ' + lote[i].id + ': ' + String(err))
        }
      }
      guarda++
      lote = $app.findRecordsByFilter('notificacoes', '', '', 500, 0)
    }
  } catch (err) {
    console.log('[LIMPEZA] erro notificacoes: ' + String(err))
  }

  const depois = {
    obrigacoes: $app.countRecords('obrigacoes'),
    notificacoes: $app.countRecords('notificacoes'),
  }

  return e.json(200, {
    antes: antes,
    depois: depois,
    removidos: removidos,
    integridade: {
      empresas: $app.countRecords('empresas'),
      workflows: $app.countRecords('workflows'),
      lancamentos: $app.countRecords('lancamentos_contabeis'),
      documentos: $app.countRecords('documentos'),
    },
  })
})

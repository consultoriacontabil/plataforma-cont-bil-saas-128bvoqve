/// <reference path="../pb_data/types.d.ts" />

/**
 * Diagnóstico (somente leitura): o que exatamente é dado de demonstração.
 * Não apaga nada. Devolve contagens e amostras para eu decidir com o Elissandro.
 */
routerAdd('GET', '/backend/v1/admin/demo/inventario', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!k || (e.request.url.query().get('key') || '') !== k) return e.json(403, { e: 1 })

  const out = {}

  // 1. obrigações sem empresa
  try {
    const todas = $app.findRecordsByFilter('obrigacoes', '', '', 500, 0)
    const orfas = todas.filter(function (o) {
      return !o.getString('empresa')
    })
    out.obrigacoes = {
      total: todas.length,
      sem_empresa: orfas.length,
      amostra: orfas.slice(0, 14).map(function (o) {
        return {
          id: o.id,
          tipo: o.getString('tipo_obrigacao'),
          periodo: o.getString('periodo_apuracao'),
          status: o.getString('status'),
          vencimento: o.getString('vencimento'),
          criado: o.getString('created').slice(0, 10),
        }
      }),
    }
  } catch (err) {
    out.obrigacoes = { erro: String(err) }
  }

  // 2. notificações: quantas apontam para obrigação inexistente? (órfãs por cascata)
  try {
    const nots = $app.findRecordsByFilter('notificacoes', '', '', 3000, 0)
    let orfasNotif = 0
    const tipos = {}
    for (let i = 0; i < nots.length; i++) {
      const t = nots[i].getString('tipo')
      tipos[t] = (tipos[t] || 0) + 1
    }
    out.notificacoes = { total: nots.length, por_tipo: tipos }
  } catch (err) {
    out.notificacoes = { erro: String(err) }
  }

  // 3. outras coleções: contagem e se parecem demo
  const COLs = [
    'workflows',
    'workflow_activity',
    'processos_operacionais',
    'processo_etapas',
    'elisa_jobs',
    'lancamentos_contabeis',
    'fechamento_competencia',
    'funcionarios',
    'socios',
    'notificacoes',
  ]
  out.colecoes = {}
  for (let i = 0; i < COLs.length; i++) {
    try {
      out.colecoes[COLs[i]] = $app.countRecords(COLs[i])
    } catch (_) {
      out.colecoes[COLs[i]] = -1
    }
  }

  // 4. empresas: quais já têm obrigação ligada?
  try {
    const emps = $app.findRecordsByFilter('empresas', '', '', 100, 0)
    let comObrig = 0
    const mapa = []
    for (let i = 0; i < emps.length; i++) {
      const n = $app.findRecordsByFilter('obrigacoes', 'empresa = {:e}', '', 1, 0, {
        e: emps[i].id,
      }).length
      if (n > 0) comObrig++
      mapa.push({ empresa: emps[i].getString('razao_social'), obrigacoes: n })
    }
    out.empresas = { total: emps.length, com_obrigacao: comObrig, amostra: mapa.slice(0, 6) }
  } catch (err) {
    out.empresas = { erro: String(err) }
  }

  return e.json(200, out)
})

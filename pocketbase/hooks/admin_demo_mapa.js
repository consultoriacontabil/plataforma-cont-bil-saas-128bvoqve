/// <reference path="../pb_data/types.d.ts" />

/**
 * Inventário de demonstração (somente leitura).
 * Compara o que existe hoje com os dados que as migrations de seed criaram.
 */
routerAdd('GET', '/backend/v1/admin/demo/mapa', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!k || (e.request.url.query().get('key') || '') !== k) return e.json(403, { e: 1 })

  const out = {}

  // 1. obrigações: quantas apontam para empresa inexistente (demo) x válida
  try {
    const obs = $app.findRecordsByFilter('obrigacoes', '', '', 500, 0)
    let demo = 0
    let reais = 0
    for (let i = 0; i < obs.length; i++) {
      const id = obs[i].getString('empresa_id')
      let ok = false
      try {
        if (id) {
          $app.findRecordById('empresas', id)
          ok = true
        }
      } catch (_) {}
      if (ok) reais++
      else demo++
    }
    out.obrigacoes = { total: obs.length, demo: demo, reais: reais }
  } catch (err) {
    out.obrigacoes = { erro: String(err) }
  }

  // 2. notificações: as de demo têm títulos conhecidos do seed
  try {
    const nots = $app.findRecordsByFilter('notificacoes', '', '', 3000, 0)
    const TITULOS_DEMO = [
      'Obrigação DAS vence em 3 dias',
      'Obrigação EFD Atrasada',
      'DARF LogPrime Atrasada',
      'Workflow em andamento',
    ]
    let demo = 0
    for (let i = 0; i < nots.length; i++) {
      if (TITULOS_DEMO.indexOf(nots[i].getString('titulo')) >= 0) demo++
    }
    out.notificacoes = { total: nots.length, demo_titulos_seed: demo }
  } catch (err) {
    out.notificacoes = { erro: String(err) }
  }

  // 3. workflows / activity
  try {
    const wfs = $app.findRecordsByFilter('workflows', '', '', 50, 0)
    out.workflows = wfs.map(function (w) {
      return {
        id: w.id,
        titulo: w.getString('titulo') || w.getString('nome'),
        status: w.getString('status'),
      }
    })
  } catch (err) {
    out.workflows = { erro: String(err) }
  }

  // 4. empresas: alguma é fictícia (das do seed)?
  try {
    const CNPJS_DEMO = [
      '33.456.789/0001-12',
      '18.902.345/0001-88',
      '07.654.321/0001-44',
      '45.123.987/0001-33',
    ]
    const emps = $app.findRecordsByFilter('empresas', '', '', 200, 0)
    const achadas = []
    for (let i = 0; i < emps.length; i++) {
      if (CNPJS_DEMO.indexOf(emps[i].getString('cnpj')) >= 0) {
        achadas.push({
          id: emps[i].id,
          nome: emps[i].getString('razao_social'),
          cnpj: emps[i].getString('cnpj'),
        })
      }
    }
    out.empresas_demo = { total_empresas: emps.length, encontradas: achadas }
  } catch (err) {
    out.empresas_demo = { erro: String(err) }
  }

  return e.json(200, out)
})

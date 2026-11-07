/// <reference path="../pb_data/types.d.ts" />

/**
 * Diagnóstico CORRIGIDO (somente leitura).
 *
 * A primeira versão leu `empresa` e `tipo_obrigacao`, campos que NÃO existem
 * em `obrigacoes` — o schema usa `empresa_id` e `tipo`. `getString` em campo
 * inexistente devolve vazio sem erro, o que fez 14 registros sadios parecerem
 * órfãos. Aqui uso os nomes reais e devolvo prova (id resolvido ou não).
 */
routerAdd('GET', '/backend/v1/admin/demo/inventario2', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!k || (e.request.url.query().get('key') || '') !== k) return e.json(403, { e: 1 })

  const out = {}

  // OBRIGACOES com o campo REAL empresa_id
  try {
    const todas = $app.findRecordsByFilter('obrigacoes', '', '', 500, 0)
    let comEmpresa = 0
    let semEmpresa = 0
    let empresaInexistente = 0
    const amostra = []

    for (let i = 0; i < todas.length; i++) {
      const o = todas[i]
      const empId = o.getString('empresa_id')
      let resolve = false
      if (empId) {
        try {
          const emp = $app.findRecordById('empresas', empId)
          resolve = true
          if (amostra.length < 5) {
            amostra.push({
              id: o.id,
              tipo: o.getString('tipo'),
              competencia: o.getString('competencia'),
              status: o.getString('status'),
              vencimento: o.getString('vencimento').slice(0, 10),
              empresa: emp.getString('razao_social'),
            })
          }
        } catch (_) {}
      }
      if (!empId) semEmpresa++
      else if (resolve) comEmpresa++
      else empresaInexistente++
    }

    out.obrigacoes = {
      total: todas.length,
      com_empresa_valida: comEmpresa,
      sem_empresa: semEmpresa,
      empresa_inexistente: empresaInexistente,
      amostra: amostra,
    }
  } catch (err) {
    out.obrigacoes = { erro: String(err) }
  }

  // NOTIFICACOES: as 507 "atrasada" apontam para obrigacao existente?
  try {
    const nots = $app.findRecordsByFilter('notificacoes', '', '', 3000, 0)
    let comRef = 0
    let semRef = 0
    let refQuebrada = 0
    for (let i = 0; i < nots.length; i++) {
      const obId = nots[i].getString('obrigacao_id') || nots[i].getString('referencia_id')
      if (!obId) {
        semRef++
        continue
      }
      try {
        $app.findRecordById('obrigacoes', obId)
        comRef++
      } catch (_) {
        refQuebrada++
      }
    }
    out.notificacoes = {
      total: nots.length,
      com_ref_valida: comRef,
      sem_ref: semRef,
      ref_quebrada: refQuebrada,
    }
  } catch (err) {
    out.notificacoes = { erro: String(err) }
  }

  // EMPRESAS com contagem de obrigacoes (campo correto)
  try {
    const emps = $app.findRecordsByFilter('empresas', '', '', 100, 0)
    const mapa = []
    let com = 0
    for (let i = 0; i < emps.length; i++) {
      const n = $app.findRecordsByFilter('obrigacoes', 'empresa_id = {:e}', '', 1, 0, {
        e: emps[i].id,
      }).length
      if (n > 0) com++
      if (n > 0) mapa.push({ empresa: emps[i].getString('razao_social'), obrigacoes: n })
    }
    out.empresas = { total: emps.length, com_obrigacao: com, amostra: mapa.slice(0, 8) }
  } catch (err) {
    out.empresas = { erro: String(err) }
  }

  return e.json(200, out)
})

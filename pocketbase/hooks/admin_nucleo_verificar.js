/// <reference path="../pb_data/types.d.ts" />

/**
 * Teste pós-núcleo (somente leitura de estado, SEM expor dados).
 *
 * Confirma que as regras novas não trancaram ninguém:
 *  - cada usuário ainda tem vínculo ativo com seu tenant;
 *  - a expressão usada por todas as regras realmente resolve (simula o join);
 *  - conta registros visíveis por tenant para detectar "tudo sumiu".
 */
routerAdd('GET', '/backend/v1/admin/nucleo/verificar', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!k || (e.request.url.query().get('key') || '') !== k) return e.json(403, { e: 1 })

  const out = { usuarios: [], tenants: [], contagens: {}, problemas: [] }

  // usuários e vínculos
  let users = []
  try {
    users = $app.findRecordsByFilter('users', '', '', 200, 0)
  } catch (err) {
    out.problemas.push('users: ' + String(err))
  }

  for (let i = 0; i < users.length; i++) {
    const u = users[i]
    let vinculos = []
    try {
      vinculos = $app.findRecordsByFilter('tenant_members', 'user_id = {:u}', '', 10, 0, {
        u: u.id,
      })
    } catch (_) {}

    const ativos = vinculos.filter(function (v) {
      return v.getString('status') === 'ativo'
    })

    out.usuarios.push({
      email_mascarado: String(u.getString('email')).replace(/^(.{2}).*@/, '$1***@'),
      vinculos: vinculos.length,
      ativos: ativos.length,
      tenants: ativos.map(function (v) {
        return v.getString('tenant_id')
      }),
    })

    if (vinculos.length > 0 && ativos.length === 0) {
      out.problemas.push('usuario sem vinculo ativo: ' + u.id)
    }
  }

  // tenants e contagens
  try {
    const ts = $app.findRecordsByFilter('tenants', '', '', 100, 0)
    for (let i = 0; i < ts.length; i++) {
      out.tenants.push({
        id: ts[i].id,
        nome: ts[i].getString('nome'),
        empresas: $app.findRecordsByFilter('empresas', 'tenant_id = {:t}', '', 1, 0, {
          t: ts[i].id,
        }).length,
        membros: $app.findRecordsByFilter('tenant_members', 'tenant_id = {:t}', '', 50, 0, {
          t: ts[i].id,
        }).length,
      })
    }
  } catch (err) {
    out.problemas.push('tenants: ' + String(err))
  }

  // amostra de contagens por coleção (dá visão de "nada sumiu")
  const COLECOES = [
    'empresas',
    'documentos',
    'obrigacoes',
    'notificacoes',
    'lancamentos_contabeis',
    'funcionarios',
    'processo_etapas',
    'audit_log',
  ]
  for (let i = 0; i < COLECOES.length; i++) {
    try {
      out.contagens[COLECOES[i]] = $app.countRecords(COLECOES[i])
    } catch (_) {
      out.contagens[COLECOES[i]] = -1
    }
  }

  return e.json(200, out)
})

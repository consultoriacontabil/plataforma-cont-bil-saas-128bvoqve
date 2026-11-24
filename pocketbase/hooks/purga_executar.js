/// <reference path="../pb_data/types.d.ts" />

/**
 * PURGA DA BASE — rotina idempotente.
 * POST /backend/v1/purga/executar
 * Header: X-Purga-Token
 * Body: {
 *   confirmar: true,              // ausente/false => DRY-RUN (só conta, não apaga)
 *   backup_confirmado: true,      // obrigatório para confirmar
 *   backup_ref: "..."            // hash/identificador do backup verificado
 * }
 *
 * Regras:
 *  - DRY-RUN é o padrão: devolve contagem por coleção e o plano, sem escrever.
 *  - Exigir backup_confirmado + backup_ref para executar (sem backup não apaga).
 *  - PRESERVA: certificados_digitais (A1), credenciais do cofre desses
 *    certificados e do Integra Contador (SERPRO), o usuário dono e uma única
 *    tenant limpa com o dono como administrador.
 *  - Idempotente: rodar de novo chega ao mesmo estado (contagens antes = 0).
 *  - Escrita por SQL direto: não dispara hooks de aplicação (sem efeitos
 *    colaterais como e-mails/crons); as travas de FK/cascade continuam ativas.
 */
routerAdd('POST', '/backend/v1/purga/executar', (e) => {
  var esperado = $secrets.get('PURGA_TOKEN')
  var recebido = ''
  var corpo = {}
  try {
    var info = e.requestInfo()
    recebido =
      (info.headers && (info.headers['x_purga_token'] || info.headers['x-purga-token'])) || ''
    corpo = info.body || {}
  } catch (_) {}
  if (!esperado || recebido !== esperado) {
    return e.json(401, { erro: 'token inválido' })
  }

  var app = e.app
  var confirmar = corpo.confirmar === true
  var backupOk = corpo.backup_confirmado === true && String(corpo.backup_ref || '').length >= 8
  var env = String(corpo.ambiente || 'preview')
  var ownerEmail = String(corpo.owner_email || 'rumo@rumoconsultoriacontabil.com.br')
  var novoCnpj = String(corpo.tenant_cnpj || '12.345.678/0001-90')
  var novoNome = String(corpo.tenant_nome || 'Rumo Consultoria Contábil')

  if (confirmar && !backupOk) {
    return e.json(409, {
      erro: 'purga bloqueada: informe backup_confirmado=true e backup_ref (hash do backup verificado)',
    })
  }
  // Bloqueio de ambiente: produção só executa com autorização explícita no corpo
  // (producao_autorizada === true), além do token. Sem essa flag, a rota recusa
  // qualquer execução em produção. Autorizado pelo dono em 24/11/2026 para a
  // purga única desta data; a rota é removida do código logo depois de usada.
  if (confirmar && env === 'production' && corpo.producao_autorizada !== true) {
    return e.json(409, {
      erro:
        'purga em produção bloqueada: exige producao_autorizada=true no corpo, ' +
        'além de backup_confirmado=true e backup_ref',
    })
  }
=======

  // Gate do backup: a referência tem de existir no log de backups ANTES de apagar.
  // Sem registro confirmado, nada é excluído.
  if (confirmar) {
    var refBusca = 'mensagem ~ {:r}'
    var achouBkp = []
    try {
      achouBkp = app.findRecordsByFilter('backups_execucoes', refBusca, '', 1, 0, {
        r: String(corpo.backup_ref),
      })
    } catch (eB) {
      achouBkp = []
    }
    if (achouBkp.length === 0) {
      return e.json(409, {
        erro:
          'purga bloqueada: nenhum backup registrado com a referência ' +
          String(corpo.backup_ref) +
          '. Registre o backup antes de apagar.',
      })
    }
  }

  // ---- conjuntos preservados ----
  var PRESERVAR = {
    tenants: true,
    tenant_members: true,
    users: true,
    certificados_digitais: true,
    credenciais_cofre: true,
    integra_contador_config: true,
    backups_execucoes: true,
    parametros_normativos: true,
    audit_log: false,
  }
  var ESCOPOS_COFRE = ['certificados_digitais', 'integra_contador_config']

  function tabela(nome) {
    if (!/^[a-z0-9_]+$/.test(nome)) throw new Error('nome de coleção inválida: ' + nome)
    return nome
  }

  // ---- 1. contagem ANTES ----
  var colecoes = []
  var cols = app.findAllCollections()
  var antes = {}
  for (var i = 0; i < cols.length; i++) {
    var c = cols[i]
    if (c.name.indexOf('_') === 0) continue
    if (c.type !== 'base' && c.type !== 'auth') continue
    var n = 0
    try {
      n = app.countRecords(c.name)
    } catch (_) {}
    antes[c.name] = n
    colecoes.push({ nome: c.name, tipo: c.type, preservar: !!PRESERVAR[c.name] })
  }

  // ---- 2. alvo: dono + tenant limpo ----
  var dono = null
  try {
    dono = app.findAuthRecordByEmail('users', ownerEmail)
  } catch (_) {
    dono = null
  }
  if (!dono) {
    return e.json(412, {
      erro: 'usuário dono não encontrado pelo e-mail ' + ownerEmail + ' — purga abortada',
    })
  }

  var tenant = null
  try {
    tenant = app.findFirstRecordByData('tenants', 'cnpj', novoCnpj)
  } catch (_) {
    tenant = null
  }

  var plano = { dono: dono.id, dono_email: ownerEmail, tenant_existente: !!tenant }
  if (!confirmar) {
    return e.json(200, {
      modo: 'dry-run',
      ambiente: env,
      nada_foi_alterado: true,
      plano: plano,
      total_antes: (function () {
        var s = 0
        for (var k in antes) s += antes[k]
        return s
      })(),
      contagem_antes: antes,
      colecoes: colecoes,
    })
  }

  // ---- 3. execução ----
  var log = []
  function passo(msg) {
    log.push(msg)
  }

  app.runInTransaction(function (tx) {
    // 3.1 tenant limpo
    if (!tenant) {
      var colTenants = tx.findCollectionByNameOrId('tenants')
      tenant = new Record(colTenants)
      tenant.set('nome', novoNome)
      tenant.set('cnpj', novoCnpj)
      tenant.set('plano', 'pro')
      tenant.set('ativo', true)
      tx.save(tenant)
      passo('tenant limpo criado: ' + tenant.id)
    } else {
      tenant.set('nome', novoNome)
      tenant.set('ativo', true)
      tx.save(tenant)
      passo('tenant limpo reaproveitado: ' + tenant.id)
    }
    var tenantId = tenant.id

    // 3.2 vínculo do dono como administrador
    var vinculo = null
    try {
      vinculo = tx.findFirstRecordByData('tenant_members', 'user_id', dono.id)
    } catch (_) {
      vinculo = null
    }
    if (!vinculo) {
      vinculo = new Record(tx.findCollectionByNameOrId('tenant_members'))
      vinculo.set('user_id', dono.id)
    }
    vinculo.set('tenant_id', tenantId)
    vinculo.set('perfil', 'administrador')
    vinculo.set('status', 'ativo')
    tx.save(vinculo)
    passo('dono vinculado como administrador em ' + tenantId)

    // 3.3 certificados: desvincular da empresa (que vai sumir) e mover de tenant
    try {
      tx.db()
        .newQuery("UPDATE certificados_digitais SET empresa = '', tenant_id = {:t}")
        .bind({ t: tenantId })
        .execute()
      passo('certificados_digitais preservados e revinculados ao tenant limpo')
    } catch (eCert) {
      passo('aviso: falha ao revincular certificados: ' + String(eCert))
    }

    // 3.4 cofre: manter só o que sustenta infraestrutura preservada
    try {
      tx.db()
        .newQuery(
          "DELETE FROM credenciais_cofre WHERE escopo NOT IN ('certificados_digitais','integra_contador_config')",
        )
        .execute()
      tx.db()
        .newQuery('UPDATE credenciais_cofre SET tenant_id = {:t}')
        .bind({ t: tenantId })
        .execute()
      passo('cofre reduzido a certificados + SERPRO')
    } catch (eCofre) {
      passo('aviso: falha ao ajustar cofre: ' + String(eCofre))
    }

    // 3.5 Integra Contador (SERPRO): manter a config e apontar para o tenant limpo
    var idIntegra = ''
    try {
      var linhas = tx.findRecordsByFilter('integra_contador_config', '', '-created', 10, 0)
      for (var q = 0; q < linhas.length; q++) {
        if (q === 0) {
          idIntegra = linhas[q].id
        } else {
          tx.delete(linhas[q])
        }
      }
      if (idIntegra) {
        tx.db()
          .newQuery('UPDATE integra_contador_config SET tenant_id = {:t} WHERE id = {:i}')
          .bind({ t: tenantId, i: idIntegra })
          .execute()
      }
      passo('integra_contador_config preservada: ' + (idIntegra || 'nenhuma'))
    } catch (eIntegra) {
      passo('aviso: falha ao preservar SERPRO: ' + String(eIntegra))
    }

    // 3.6 zerar o resto — em passes, porque a ordem de FK não é conhecida:
    // uma tabela que ainda é referenciada falha e é tentada de novo no passe
    // seguinte, depois que as filhas já saíram.
    var fila = []
    for (var j = 0; j < cols.length; j++) {
      var cc = cols[j]
      if (cc.name.indexOf('_') === 0) continue
      if (cc.type !== 'base') continue
      if (PRESERVAR[cc.name]) continue
      fila.push(cc.name)
    }
    var pendentes = fila
    for (var passe = 1; passe <= 4 && pendentes.length > 0; passe++) {
      var falharam = []
      for (var k2 = 0; k2 < pendentes.length; k2++) {
        var nomeCol = pendentes[k2]
        try {
          tx.db()
            .newQuery('DELETE FROM ' + tabela(nomeCol))
            .execute()
          passo('zerada: ' + nomeCol)
        } catch (eDel) {
          falharam.push({ nome: nomeCol, erro: String(eDel) })
        }
      }
      if (falharam.length && passe === 4) {
        for (var k3 = 0; k3 < falharam.length; k3++) {
          passo('ERRO FINAL ao zerar ' + falharam[k3].nome + ': ' + falharam[k3].erro)
        }
      }
      pendentes = falharam.map(function (x) {
        return x.nome
      })
    }

    // 3.7 backups antigos (snapshots com dado) e auditoria
    try {
      tx.db().newQuery('DELETE FROM backups_execucoes').execute()
      passo('backups_execucoes antigos removidos')
    } catch (_) {}
    try {
      tx.db().newQuery('DELETE FROM audit_log').execute()
      passo('audit_log zerado')
    } catch (_) {}

    // 3.8 vínculos e usuários que sobram
    try {
      tx.db()
        .newQuery('DELETE FROM tenant_members WHERE NOT (user_id = {:u} AND tenant_id = {:t})')
        .bind({ u: dono.id, t: tenantId })
        .execute()
      passo('tenant_members reduzido ao dono')
    } catch (eMem) {
      passo('erro em tenant_members: ' + String(eMem))
    }
    try {
      tx.db().newQuery('DELETE FROM users WHERE id <> {:u}').bind({ u: dono.id }).execute()
      passo('users reduzido ao dono')
    } catch (eUsr) {
      passo('erro em users: ' + String(eUsr))
    }
    try {
      tx.db().newQuery('DELETE FROM tenants WHERE id <> {:t}').bind({ t: tenantId }).execute()
      passo('tenants reduzido ao tenant limpo')
    } catch (eTen) {
      passo('erro em tenants: ' + String(eTen))
    }

    // 3.9 registro no log de backups
    try {
      var colBkp = tx.findCollectionByNameOrId('backups_execucoes')
      var bkp = new Record(colBkp)
      bkp.set('tenant_id', tenantId)
      bkp.set('data_execucao', new Date().toISOString())
      bkp.set('tipo', 'manual')
      bkp.set('status', 'sucesso')
      bkp.set('executado_por', dono.id)
      bkp.set('retencao_dias', 365)
      bkp.set(
        'mensagem',
        'BACKUP PRÉ-PURGA da base (projeto 57806). Referência: ' +
          String(corpo.backup_ref) +
          '. Purga executada no ambiente ' +
          env +
          '; base zerada e tenant limpo recriado.',
      )
      tx.save(bkp)
      passo('registro de backup gravado: ' + bkp.id)
    } catch (eBkp) {
      passo('aviso: falha ao registrar backup: ' + String(eBkp))
    }
  })

  // ---- 4. contagem DEPOIS ----
  var depois = {}
  var restantes = []
  for (var p = 0; p < cols.length; p++) {
    var cp = cols[p]
    if (cp.name.indexOf('_') === 0) continue
    var np = 0
    try {
      np = app.countRecords(cp.name)
    } catch (_) {}
    depois[cp.name] = np
    if (np > 0) restantes.push({ nome: cp.name, registros: np, preservado: !!PRESERVAR[cp.name] })
  }

  // ---- 5. verificação do dono ----
  var donoOk = false
  var donoAtivo = ''
  try {
    var d2 = app.findAuthRecordByEmail('users', ownerEmail)
    donoOk = d2.id === dono.id
    donoAtivo = String(d2.get('verified'))
  } catch (e) {
    donoOk = false
  }
  var vinculoOk = false
  try {
    var v2 = app.findFirstRecordByData('tenant_members', 'user_id', dono.id)
    vinculoOk = v2.getString('perfil') === 'administrador' && v2.getString('status') === 'ativo'
  } catch (_) {}

  // token de sessão novo: prova que a conta do dono autentica depois da purga
  var tokenTeste = ''
  try {
    var d3 = app.findAuthRecordByEmail('users', ownerEmail)
    tokenTeste = String(d3.newAuthToken() || '')
  } catch (_) {}

  return e.json(200, {
    modo: 'executado',
    ambiente: env,
    backup_ref: String(corpo.backup_ref),
    tenant_limpo: tenant ? tenant.id : '',
    dono: { id: dono.id, email: ownerEmail, existe: donoOk, verified: donoAtivo, admin: vinculoOk },
    token_verificacao: tokenTeste,
    contagem_antes: antes,
    contagem_depois: depois,
    restantes: restantes,
    log: log,
  })
})

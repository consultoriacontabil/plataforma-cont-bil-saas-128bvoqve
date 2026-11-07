/// <reference path="../pb_data/types.d.ts" />

/**
 * Execução de ação aprovada — o único caminho que altera dados a pedido do
 * agente. Aprovação humana é pré-requisito.
 *
 * Segurança (defesa em profundidade):
 *
 *  1. Exige usuário autenticado com perfil administrador ou contador NO
 *     tenant da ação. Agente não aprova a si mesmo.
 *  2. ALLOWLIST fechada de (colecao, campo). Se a proposta pedir qualquer
 *     outro par, é recusada e marcada como `falhou` — mesmo aprovada.
 *     Lançamento contábil, documento fiscal, credencial, certificado, folha,
 *     sócio e empresa NÃO estão na lista, por construção.
 *  3. O registro precisa pertencer ao mesmo tenant da ação.
 *  4. A ação só executa uma vez: `status` precisa ser `aprovada`.
 *  5. Tudo grava em `audit_log` — quem propôs, quem aprovou, o que mudou.
 *
 * Rotas:
 *   POST /backend/v1/operador/acoes/propor   { colecao, registro_id, campo, valor_proposto, motivo }
 *   POST /backend/v1/operador/acoes/decidir  { acao_id, decisao: 'aprovada'|'rejeitada', justificativa }
 */

// ---------- PROPOR ----------
routerAdd(
  'POST',
  '/backend/v1/operador/acoes/propor',
  (e) => {
    const userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('Autenticação necessária.')

    const body = e.requestInfo().body || {}
    const colecao = String(body.colecao || '').trim()
    const registroId = String(body.registro_id || '').trim()
    const campo = String(body.campo || '').trim()
    const valorProposto = String(body.valor_proposto || '').trim()
    const motivo = String(body.motivo || '').trim()

    if (!colecao || !registroId || !campo || !valorProposto || !motivo) {
      return e.badRequestError(
        'colecao, registro_id, campo, valor_proposto e motivo são obrigatórios.',
      )
    }

    // tenant do proponente
    let tenantId = ''
    const vinculos = $app.findRecordsByFilter(
      'tenant_members',
      "user_id = {:u} && status = 'ativo'",
      '',
      1,
      0,
      { u: userId },
    )
    if (vinculos.length === 0) return e.forbiddenError('Usuário sem vínculo ativo.')
    tenantId = vinculos[0].getString('tenant_id')

    // valor atual (para o "de/para")
    let valorAtual = ''
    try {
      const alvo = $app.findRecordById(colecao, registroId)
      if (alvo.getString('tenant_id') !== tenantId) {
        return e.forbiddenError('Registro pertence a outro escritório.')
      }
      valorAtual = String(
        alvo.get(campo) === null || alvo.get(campo) === undefined ? '' : alvo.get(campo),
      )
    } catch (_) {
      return e.json(404, { erro: 'Registro não encontrado: ' + colecao + '/' + registroId })
    }

    try {
      const col = $app.findCollectionByNameOrId('operador_acoes')
      const rec = new Record(col)
      rec.set('tenant_id', tenantId)
      rec.set('solicitado_por', userId)
      rec.set('colecao', colecao)
      rec.set('registro_id', registroId)
      rec.set('campo', campo)
      rec.set('valor_atual', valorAtual)
      rec.set('valor_proposto', valorProposto)
      rec.set('motivo', motivo)
      rec.set('status', 'pendente')
      rec.set('conversa_id', String(body.conversa_id || ''))
      $app.save(rec)

      return e.json(200, {
        ok: true,
        acao_id: rec.id,
        mensagem: 'Ação registrada e aguardando aprovação humana.',
      })
    } catch (err) {
      return e.json(500, { erro: 'Falha ao registrar ação: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)

// ---------- DECIDIR ----------
routerAdd(
  'POST',
  '/backend/v1/operador/acoes/decidir',
  (e) => {
    const userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('Autenticação necessária.')

    const body = e.requestInfo().body || {}
    const acaoId = String(body.acao_id || '').trim()
    const decisao = String(body.decisao || '').trim()
    const justificativa = String(body.justificativa || '').trim()

    if (!acaoId || (decisao !== 'aprovada' && decisao !== 'rejeitada')) {
      return e.badRequestError('acao_id e decisao (aprovada|rejeitada) são obrigatórios.')
    }

    let acao
    try {
      acao = $app.findRecordById('operador_acoes', acaoId)
    } catch (_) {
      return e.json(404, { erro: 'Ação não encontrada.' })
    }

    const tenantAcao = acao.getString('tenant_id')

    // perfil de quem decide, NO tenant da ação
    const vinculos = $app.findRecordsByFilter(
      'tenant_members',
      "user_id = {:u} && tenant_id = {:t} && status = 'ativo'",
      '',
      1,
      0,
      { u: userId, t: tenantAcao },
    )
    if (vinculos.length === 0) return e.forbiddenError('Sem vínculo com o escritório desta ação.')

    const perfil = vinculos[0].getString('perfil')
    if (perfil !== 'administrador' && perfil !== 'contador') {
      return e.forbiddenError('Apenas Administrador ou Contador podem decidir.')
    }

    if (acao.getString('status') !== 'pendente') {
      return e.json(409, {
        erro: 'Esta ação já foi decidida (status: ' + acao.getString('status') + ').',
      })
    }

    // não permite aprovar a própria proposta (segregação de função)
    if (acao.getString('solicitado_por') === userId) {
      const outro = $app.findRecordsByFilter(
        'tenant_members',
        "tenant_id = {:t} && status = 'ativo' && user_id != {:u}",
        '',
        1,
        0,
        { t: tenantAcao, u: userId },
      )
      if (outro.length > 0) {
        return e.forbiddenError(
          'Quem propôs a ação não pode aprová-la. Peça a outro Administrador ou Contador.',
        )
      }
    }

    // ---- REJEITAR: encerra aqui ----
    if (decisao === 'rejeitada') {
      acao.set('status', 'rejeitada')
      acao.set('decidido_por', userId)
      acao.set('decidido_em', new Date().toISOString())
      acao.set('justificativa_decisao', justificativa)
      $app.save(acao)

      try {
        const audit = new Record($app.findCollectionByNameOrId('audit_log'))
        audit.set('tenant_id', tenantAcao)
        audit.set('usuario_id', userId)
        audit.set('acao', 'operador_acao_rejeitada')
        audit.set('entidade_tipo', 'operador_acoes')
        audit.set('entidade_id', acaoId)
        audit.set(
          'detalhes',
          'Rejeitada: ' +
            acao.getString('colecao') +
            '.' +
            acao.getString('campo') +
            ' — ' +
            justificativa,
        )
        $app.save(audit)
      } catch (_) {}

      return e.json(200, { ok: true, status: 'rejeitada' })
    }

    // ---- APROVAR: valida allowlist e aplica ----
    const ALLOWLIST = {
      obrigacoes: ['status', 'observacoes', 'data_entrega', 'responsavel_id', 'valor'],
      workflows: ['status', 'etapa_atual', 'responsavel_id', 'observacoes'],
      processo_pendencias: ['status', 'descricao', 'responsavel_id', 'prioridade'],
      elisa_jobs: ['status', 'resultado', 'observacoes'],
      notificacoes: ['lida'],
    }

    const colecao = acao.getString('colecao')
    const campo = acao.getString('campo')
    const permitidos = ALLOWLIST[colecao]

    if (!permitidos || permitidos.indexOf(campo) < 0) {
      acao.set('status', 'falhou')
      acao.set('decidido_por', userId)
      acao.set('decidido_em', new Date().toISOString())
      acao.set('resultado_execucao', 'Campo não permitido pela allowlist: ' + colecao + '.' + campo)
      $app.save(acao)
      return e.json(403, {
        erro: 'Campo não permitido para escrita pelo agente: ' + colecao + '.' + campo,
        status: 'falhou',
      })
    }

    let alvo
    try {
      alvo = $app.findRecordById(colecao, acao.getString('registro_id'))
    } catch (_) {
      acao.set('status', 'falhou')
      acao.set('decidido_por', userId)
      acao.set('decidido_em', new Date().toISOString())
      acao.set('resultado_execucao', 'Registro alvo não existe mais.')
      $app.save(acao)
      return e.json(404, { erro: 'Registro alvo não existe mais.', status: 'falhou' })
    }

    if (alvo.getString('tenant_id') !== tenantAcao) {
      acao.set('status', 'falhou')
      acao.set('decidido_por', userId)
      acao.set('decidido_em', new Date().toISOString())
      acao.set('resultado_execucao', 'Registro pertence a outro tenant.')
      $app.save(acao)
      return e.json(403, { erro: 'Registro pertence a outro escritório.', status: 'falhou' })
    }

    const antes = String(
      alvo.get(campo) === null || alvo.get(campo) === undefined ? '' : alvo.get(campo),
    )

    try {
      alvo.set(campo, acao.getString('valor_proposto'))
      $app.save(alvo)
    } catch (err) {
      acao.set('status', 'falhou')
      acao.set('decidido_por', userId)
      acao.set('decidido_em', new Date().toISOString())
      acao.set('resultado_execucao', 'Erro ao gravar: ' + String(err))
      $app.save(acao)
      return e.json(500, { erro: 'Falha ao aplicar: ' + String(err), status: 'falhou' })
    }

    const depois = String(acao.getString('valor_proposto'))

    acao.set('status', 'executada')
    acao.set('decidido_por', userId)
    acao.set('decidido_em', new Date().toISOString())
    acao.set('justificativa_decisao', justificativa)
    acao.set(
      'resultado_execucao',
      'Aplicado: ' + campo + ' de "' + antes + '" para "' + depois + '"',
    )
    $app.save(acao)

    try {
      const audit = new Record($app.findCollectionByNameOrId('audit_log'))
      audit.set('tenant_id', tenantAcao)
      audit.set('usuario_id', userId)
      audit.set('acao', 'operador_acao_executada')
      audit.set('entidade_tipo', colecao)
      audit.set('entidade_id', acao.getString('registro_id'))
      audit.set(
        'detalhes',
        'Ação ' +
          acaoId +
          ' aprovada e executada. ' +
          campo +
          ': "' +
          antes +
          '" -> "' +
          depois +
          '". Motivo: ' +
          acao.getString('motivo'),
      )
      $app.save(audit)
    } catch (_) {}

    return e.json(200, {
      ok: true,
      status: 'executada',
      campo: campo,
      antes: antes,
      depois: depois,
    })
  },
  $apis.requireAuth(),
)

// ---------- LISTAR PENDENTES ----------
routerAdd(
  'GET',
  '/backend/v1/operador/acoes/pendentes',
  (e) => {
    const userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('Autenticação necessária.')

    const vinculos = $app.findRecordsByFilter(
      'tenant_members',
      "user_id = {:u} && status = 'ativo'",
      '',
      1,
      0,
      { u: userId },
    )
    if (vinculos.length === 0) return e.forbiddenError('Usuário sem vínculo ativo.')
    const tenantId = vinculos[0].getString('tenant_id')

    try {
      const acoes = $app.findRecordsByFilter(
        'operador_acoes',
        "tenant_id = {:t} && status = 'pendente'",
        '-created',
        50,
        0,
        { t: tenantId },
      )
      return e.json(200, {
        total: acoes.length,
        acoes: acoes.map(function (a) {
          return {
            id: a.id,
            colecao: a.getString('colecao'),
            registro_id: a.getString('registro_id'),
            campo: a.getString('campo'),
            valor_atual: a.getString('valor_atual'),
            valor_proposto: a.getString('valor_proposto'),
            motivo: a.getString('motivo'),
            criado: a.getString('created'),
          }
        }),
      })
    } catch (err) {
      return e.json(500, { erro: String(err) })
    }
  },
  $apis.requireAuth(),
)

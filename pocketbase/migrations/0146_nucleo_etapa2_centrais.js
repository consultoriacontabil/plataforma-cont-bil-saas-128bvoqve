/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0146 — Núcleo, etapa 2: as 11 coleções centrais.
 *
 * Esta é a migration mais sensível da fase toda. `tenant_members` é a coleção
 * que a própria regra de isolamento consulta, e `tenants`/`users` não têm o
 * campo `tenant_id` — cada uma exige uma regra diferente.
 *
 * Regras aplicadas (todas literais, sem ler estado):
 *
 *  tenants            -> vê só o próprio tenant:
 *                        `id = @request.auth.tenant_members_via_user_id.tenant_id`
 *                        (aqui o "dono" é o próprio id, não um campo tenant_id)
 *  tenant_members     -> vê os vínculos do próprio tenant:
 *                        `tenant_id ?= @request.auth.tenant_members_via_user_id.tenant_id`
 *  empresas           -> tenant_id (regra padrão)
 *  documentos         -> tenant_id; criação pública preservada só com
 *                        origem_documento = 'link_publico' (upload do cliente
 *                        pelo link de abertura), sem leitura cruzada
 *  workflows          -> tenant_id
 *  workflow_activity  -> tenant_id
 *  obrigacoes         -> tenant_id
 *  agent_conversations-> dono (user_id) + tenant
 *  agent_messages     -> dono (user_id) + tenant
 *  notificacoes       -> destinatário + tenant (as de destino vazio são
 *                        broadcast do escritório, não de todos os escritórios)
 *  users              -> já restrita a `id = @request.auth.id`; não altero
 *                        para não travar login. Registro em comentário.
 *
 * Rollback: restaura as regras originais de cada coleção.
 */
migrate(
  (app) => {
    const LEITURA =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id"
    const ESCRITA =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'"

    // 1. tenants — o dono é o próprio id
    const tenants = app.findCollectionByNameOrId('tenants')
    // `?=` e `?!=` porque o usuário pode ter vínculo com mais de um tenant:
    // a back-relation devolve lista, e `=` falharia nesse caso.
    const REGRA_TENANT =
      "@request.auth.id != '' && id ?= @request.auth.tenant_members_via_user_id.tenant_id"
    tenants.listRule = REGRA_TENANT
    tenants.viewRule = REGRA_TENANT
    tenants.updateRule =
      "@request.auth.id != '' && id ?= @request.auth.tenant_members_via_user_id.tenant_id && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'"
    tenants.createRule = "@request.auth.id != ''"
    tenants.deleteRule = null
    app.save(tenants)
    console.log('[0146] tenants: isolado por id')

    // 2. tenant_members — vínculos do próprio tenant
    const tm = app.findCollectionByNameOrId('tenant_members')
    tm.listRule = LEITURA
    tm.viewRule = LEITURA
    tm.createRule = ESCRITA
    tm.updateRule = ESCRITA
    tm.deleteRule = ESCRITA
    app.save(tm)
    console.log('[0146] tenant_members: isolado')

    // 3. empresas
    const emp = app.findCollectionByNameOrId('empresas')
    emp.listRule = LEITURA
    emp.viewRule = LEITURA
    emp.createRule = ESCRITA
    emp.updateRule = ESCRITA
    emp.deleteRule = ESCRITA
    app.save(emp)
    console.log('[0146] empresas: isolado')

    // 4. documentos — leitura por tenant; criação pública só do link
    const doc = app.findCollectionByNameOrId('documentos')
    doc.listRule = LEITURA
    doc.viewRule = LEITURA
    doc.createRule = ESCRITA + " || (@request.body.origem_documento = 'link_publico')"
    doc.updateRule = ESCRITA
    doc.deleteRule = ESCRITA
    app.save(doc)
    console.log('[0146] documentos: isolado (upload publico preservado)')

    // 5. workflows
    const wf = app.findCollectionByNameOrId('workflows')
    wf.listRule = LEITURA
    wf.viewRule = LEITURA
    wf.createRule = ESCRITA
    wf.updateRule = ESCRITA
    wf.deleteRule = ESCRITA
    app.save(wf)

    // 6. workflow_activity
    const wa = app.findCollectionByNameOrId('workflow_activity')
    wa.listRule = LEITURA
    wa.viewRule = LEITURA
    wa.createRule = ESCRITA
    wa.updateRule = ESCRITA
    wa.deleteRule = ESCRITA
    app.save(wa)
    console.log('[0146] workflows + workflow_activity: isolados')

    // 7. obrigacoes
    const ob = app.findCollectionByNameOrId('obrigacoes')
    ob.listRule = LEITURA
    ob.viewRule = LEITURA
    ob.createRule = ESCRITA
    ob.updateRule = ESCRITA
    ob.deleteRule = ESCRITA
    app.save(ob)
    console.log('[0146] obrigacoes: isolado')

    // 8. agent_conversations — dono + tenant
    const ac = app.findCollectionByNameOrId('agent_conversations')
    const REGRA_DONO =
      "@request.auth.id != '' && user_id ?= @request.auth.id && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id"
    ac.listRule = REGRA_DONO
    ac.viewRule = REGRA_DONO
    ac.createRule = ESCRITA
    ac.updateRule = REGRA_DONO
    ac.deleteRule = REGRA_DONO
    app.save(ac)

    // 9. agent_messages
    const am = app.findCollectionByNameOrId('agent_messages')
    am.listRule = REGRA_DONO
    am.viewRule = REGRA_DONO
    am.createRule = ESCRITA
    am.updateRule = REGRA_DONO
    am.deleteRule = REGRA_DONO
    app.save(am)
    console.log('[0146] agent_conversations + agent_messages: dono + tenant')

    // 10. notificacoes — destinatario + tenant (broadcast nao vaza entre escritorios)
    const nt = app.findCollectionByNameOrId('notificacoes')
    const REGRA_NOTIF =
      "@request.auth.id != '' && (usuario_destino_id = @request.auth.id || usuario_destino_id = '') && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id"
    nt.listRule = REGRA_NOTIF
    nt.viewRule = REGRA_NOTIF
    nt.updateRule =
      "@request.auth.id != '' && usuario_destino_id ?= @request.auth.id && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id"
    nt.createRule = ESCRITA
    nt.deleteRule = ESCRITA
    app.save(nt)
    console.log('[0146] notificacoes: destinatario + tenant')

    // 11. users NAO e alterada de proposito:
    //     a regra atual (`id = @request.auth.id`) ja e restritiva e garante
    //     que ninguem le o perfil de outro. Mexer aqui sem necessidade
    //     arriscaria o login da plataforma inteira.

    console.log('[0146] nucleo etapa 2 concluido')
  },
  (app) => {
    const GEN = "@request.auth.id != ''"
    const nomes = [
      'empresas',
      'documentos',
      'workflows',
      'workflow_activity',
      'obrigacoes',
      'tenant_members',
    ]
    for (let i = 0; i < nomes.length; i++) {
      const col = app.findCollectionByNameOrId(nomes[i])
      col.listRule = GEN
      col.viewRule = GEN
      col.createRule = GEN
      col.updateRule = GEN
      col.deleteRule = GEN
      app.save(col)
    }

    const t = app.findCollectionByNameOrId('tenants')
    t.listRule = GEN
    t.viewRule = GEN
    t.createRule = GEN
    t.updateRule = GEN
    t.deleteRule = null
    app.save(t)

    const ac = app.findCollectionByNameOrId('agent_conversations')
    ac.listRule = "@request.auth.id != '' && user_id = @request.auth.id"
    ac.viewRule = ac.listRule
    ac.createRule = GEN
    ac.updateRule = ac.listRule
    ac.deleteRule = ac.listRule
    app.save(ac)

    const am = app.findCollectionByNameOrId('agent_messages')
    am.listRule = "@request.auth.id != '' && user_id = @request.auth.id"
    am.viewRule = am.listRule
    am.createRule = GEN
    am.updateRule = am.listRule
    am.deleteRule = am.listRule
    app.save(am)

    const nt = app.findCollectionByNameOrId('notificacoes')
    nt.listRule =
      "@request.auth.id != '' && (usuario_destino_id = @request.auth.id || usuario_destino_id = '')"
    nt.viewRule = nt.listRule
    nt.createRule = ''
    nt.updateRule = "@request.auth.id != '' && usuario_destino_id = @request.auth.id"
    nt.deleteRule = GEN
    app.save(nt)
  },
)

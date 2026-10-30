/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    console.log(
      '[MIGRATION-0126] Garantindo presença de POP-EX-01, POP-EX-03 e POP-EX-04 na versão 2026.5 para todos os tenants...',
    )

    const sopsCol = app.findCollectionByNameOrId('sops')
    const tenants = app.findRecordsByFilter('tenants', "id != ''", 'created', 100)

    for (let t = 0; t < tenants.length; t++) {
      const tenant = tenants[t]
      const tenantId = tenant.id

      // Duplicar/espelhar POP-EX-03 para 2026.5 se não existir
      let recEx03_2026_5 = null
      try {
        recEx03_2026_5 = app.findFirstRecordByFilter(
          'sops',
          `tenant_id = '${tenantId}' && codigo = 'POP-EX-03' && versao = '2026.5'`,
        )
      } catch (_) {}

      if (!recEx03_2026_5) {
        let ex03_base = null
        try {
          ex03_base = app.findFirstRecordByFilter(
            'sops',
            `tenant_id = '${tenantId}' && codigo = 'POP-EX-03'`,
          )
        } catch (_) {}

        if (ex03_base) {
          recEx03_2026_5 = new Record(sopsCol)
          recEx03_2026_5.set('tenant_id', tenantId)
          recEx03_2026_5.set('codigo', 'POP-EX-03')
          recEx03_2026_5.set('nome', ex03_base.get('nome'))
          recEx03_2026_5.set('area', ex03_base.get('area') || 'geral')
          recEx03_2026_5.set('versao', '2026.5')
          recEx03_2026_5.set('ativo', true)
          recEx03_2026_5.set('objetivo', ex03_base.get('objetivo'))
          recEx03_2026_5.set('gatilho', ex03_base.get('gatilho'))
          recEx03_2026_5.set('pre_condicoes', ex03_base.get('pre_condicoes'))
          recEx03_2026_5.set('entradas', ex03_base.get('entradas'))
          recEx03_2026_5.set('sistemas_utilizados', ex03_base.get('sistemas_utilizados'))
          recEx03_2026_5.set('responsavel_cargo', ex03_base.get('responsavel_cargo'))
          recEx03_2026_5.set('agente_nome', ex03_base.get('agente_nome'))
          recEx03_2026_5.set(
            'nivel_autonomia',
            ex03_base.get('nivel_autonomia') || 'nivel_2_supervisionado',
          )
          recEx03_2026_5.set('requer_aprovacao', ex03_base.get('requer_aprovacao'))
          recEx03_2026_5.set('saida', ex03_base.get('saida'))
          recEx03_2026_5.set('proximo_processo', ex03_base.get('proximo_processo'))
          recEx03_2026_5.set('regras_negocio', ex03_base.get('regras_negocio'))
          recEx03_2026_5.set('criterios_sucesso', ex03_base.get('criterios_sucesso'))
          recEx03_2026_5.set('criterios_erro', ex03_base.get('criterios_erro'))
          recEx03_2026_5.set('excecoes', ex03_base.get('excecoes'))
          recEx03_2026_5.set('etapas_template_json', ex03_base.get('etapas_template_json'))
          app.save(recEx03_2026_5)
          console.log(`[MIGRATION-0126] POP-EX-03 espelhado em 2026.5 para tenant ${tenantId}`)
        }
      }

      // Duplicar/espelhar POP-EX-04 para 2026.5 se não existir
      let recEx04_2026_5 = null
      try {
        recEx04_2026_5 = app.findFirstRecordByFilter(
          'sops',
          `tenant_id = '${tenantId}' && codigo = 'POP-EX-04' && versao = '2026.5'`,
        )
      } catch (_) {}

      if (!recEx04_2026_5) {
        let ex04_base = null
        try {
          ex04_base = app.findFirstRecordByFilter(
            'sops',
            `tenant_id = '${tenantId}' && codigo = 'POP-EX-04'`,
          )
        } catch (_) {}

        if (ex04_base) {
          recEx04_2026_5 = new Record(sopsCol)
          recEx04_2026_5.set('tenant_id', tenantId)
          recEx04_2026_5.set('codigo', 'POP-EX-04')
          recEx04_2026_5.set('nome', ex04_base.get('nome'))
          recEx04_2026_5.set('area', ex04_base.get('area') || 'fiscal')
          recEx04_2026_5.set('versao', '2026.5')
          recEx04_2026_5.set('ativo', true)
          recEx04_2026_5.set('objetivo', ex04_base.get('objetivo'))
          recEx04_2026_5.set('gatilho', ex04_base.get('gatilho'))
          recEx04_2026_5.set('pre_condicoes', ex04_base.get('pre_condicoes'))
          recEx04_2026_5.set('entradas', ex04_base.get('entradas'))
          recEx04_2026_5.set('sistemas_utilizados', ex04_base.get('sistemas_utilizados'))
          recEx04_2026_5.set('responsavel_cargo', ex04_base.get('responsavel_cargo'))
          recEx04_2026_5.set('agente_nome', ex04_base.get('agente_nome'))
          recEx04_2026_5.set(
            'nivel_autonomia',
            ex04_base.get('nivel_autonomia') || 'nivel_2_supervisionado',
          )
          recEx04_2026_5.set('requer_aprovacao', ex04_base.get('requer_aprovacao'))
          recEx04_2026_5.set('saida', ex04_base.get('saida'))
          recEx04_2026_5.set('proximo_processo', ex04_base.get('proximo_processo'))
          recEx04_2026_5.set('regras_negocio', ex04_base.get('regras_negocio'))
          recEx04_2026_5.set('criterios_sucesso', ex04_base.get('criterios_sucesso'))
          recEx04_2026_5.set('criterios_erro', ex04_base.get('criterios_erro'))
          recEx04_2026_5.set('excecoes', ex04_base.get('excecoes'))
          recEx04_2026_5.set('etapas_template_json', ex04_base.get('etapas_template_json'))
          app.save(recEx04_2026_5)
          console.log(`[MIGRATION-0126] POP-EX-04 espelhado em 2026.5 para tenant ${tenantId}`)
        }
      }
    }

    console.log('[MIGRATION-0126] Concluído com sucesso!')
  },
  (app) => {
    const registros = app.findRecordsByFilter(
      'sops',
      "versao = '2026.5' && (codigo = 'POP-EX-03' || codigo = 'POP-EX-04')",
      'created',
      100,
    )
    for (let i = 0; i < registros.length; i++) {
      app.delete(registros[i])
    }
  },
)

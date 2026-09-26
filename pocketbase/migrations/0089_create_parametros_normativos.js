/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const usersCol = app.findCollectionByNameOrId('users')

    const paramsCollection = new Collection({
      name: 'parametros_normativos',
      type: 'base',
      listRule:
        "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'",
      viewRule:
        "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'",
      createRule:
        "@request.auth.id != '' && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')",
      deleteRule:
        "@request.auth.id != '' && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')",
      fields: [
        {
          name: 'tenant_id',
          type: 'relation',
          required: true,
          collectionId: tenantsCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'categoria',
          type: 'select',
          values: ['inss', 'irrf', 'fgts', 'simples_nacional', 'iss', 'lucro_presumido', 'outros'],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'chave',
          type: 'text',
          required: true,
        },
        {
          name: 'titulo',
          type: 'text',
          required: true,
        },
        {
          name: 'descricao',
          type: 'text',
        },
        {
          name: 'vigencia_inicio',
          type: 'date',
          required: true,
        },
        {
          name: 'vigencia_fim',
          type: 'date',
        },
        {
          name: 'valores_json',
          type: 'json',
          required: true,
        },
        {
          name: 'ativo',
          type: 'bool',
        },
        {
          name: 'versao',
          type: 'number',
        },
        {
          name: 'atualizado_por',
          type: 'relation',
          collectionId: usersCol.id,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_param_norm_tenant ON parametros_normativos (tenant_id)',
        'CREATE INDEX idx_param_norm_categoria ON parametros_normativos (categoria)',
        'CREATE INDEX idx_param_norm_chave ON parametros_normativos (chave)',
        'CREATE INDEX idx_param_norm_vigencia ON parametros_normativos (vigencia_inicio)',
      ],
    })
    app.save(paramsCollection)
    console.log('[MIGRATION_0089] Coleção parametros_normativos criada com sucesso.')

    // Seed inicial para todos os tenants existentes
    try {
      const tenants = app.findRecordsByFilter('tenants', '', '', 100, 0)
      for (const t of tenants) {
        const tenantId = t.id

        // 1. INSS
        const recInss = new Record(paramsCollection)
        recInss.set('tenant_id', tenantId)
        recInss.set('categoria', 'inss')
        recInss.set('chave', 'inss_tabela_progressiva_2026')
        recInss.set('titulo', 'Tabela Progressiva INSS 2026')
        recInss.set(
          'descricao',
          'Faixas, alíquotas e teto de contribuição previdenciária do empregado e patronal.',
        )
        recInss.set('vigencia_inicio', '2026-01-01 00:00:00.000Z')
        recInss.set('ativo', true)
        recInss.set('versao', 1)
        recInss.set('valores_json', {
          aliquota_patronal_padrao: 20.0,
          rat_padrao: 2.0,
          terceiros_padrao: 5.8,
          teto_salario_contribuicao: 7786.02,
          teto_desconto: 908.85,
          faixas: [
            { ate: 1412.0, aliquota: 0.075, deducao: 0.0 },
            { ate: 2666.68, aliquota: 0.09, deducao: 21.18 },
            { ate: 4000.03, aliquota: 0.12, deducao: 101.18 },
            { ate: 7786.02, aliquota: 0.14, deducao: 181.18 },
          ],
        })
        app.save(recInss)

        // 2. IRRF
        const recIrrf = new Record(paramsCollection)
        recIrrf.set('tenant_id', tenantId)
        recIrrf.set('categoria', 'irrf')
        recIrrf.set('chave', 'irrf_tabela_progressiva_2026')
        recIrrf.set('titulo', 'Tabela Progressiva IRRF 2026')
        recIrrf.set(
          'descricao',
          'Faixas progressivas, deduções legais por dependente e desconto simplificado mensal.',
        )
        recIrrf.set('vigencia_inicio', '2026-01-01 00:00:00.000Z')
        recIrrf.set('ativo', true)
        recIrrf.set('versao', 1)
        recIrrf.set('valores_json', {
          deducao_por_dependente: 189.59,
          desconto_simplificado_mensal: 564.8,
          faixas: [
            { ate: 2259.2, aliquota: 0.0, deducao: 0.0 },
            { ate: 2826.65, aliquota: 0.075, deducao: 169.44 },
            { ate: 3751.05, aliquota: 0.15, deducao: 381.44 },
            { ate: 4664.68, aliquota: 0.225, deducao: 662.77 },
            { ate: 999999999.0, aliquota: 0.275, deducao: 896.0 },
          ],
        })
        app.save(recIrrf)

        // 3. FGTS
        const recFgts = new Record(paramsCollection)
        recFgts.set('tenant_id', tenantId)
        recFgts.set('categoria', 'fgts')
        recFgts.set('chave', 'fgts_aliquotas_2026')
        recFgts.set('titulo', 'Alíquotas Normativas de FGTS')
        recFgts.set(
          'descricao',
          'Alíquota padrão CLT (8%) e aprendiz (2%), com multa rescisória rescisão sem justa causa (40%).',
        )
        recFgts.set('vigencia_inicio', '2026-01-01 00:00:00.000Z')
        recFgts.set('ativo', true)
        recFgts.set('versao', 1)
        recFgts.set('valores_json', {
          aliquota_clt: 8.0,
          aliquota_jovem_aprendiz: 2.0,
          aliquota_domestico: 8.0,
          multa_rescisoria_sem_justa_causa: 40.0,
          contribuicao_social_rescisoria: 10.0,
        })
        app.save(recFgts)

        // 4. SIMPLES NACIONAL (Anexos I a IV)
        const recSn = new Record(paramsCollection)
        recSn.set('tenant_id', tenantId)
        recSn.set('categoria', 'simples_nacional')
        recSn.set('chave', 'simples_nacional_anexos_2026')
        recSn.set('titulo', 'Tabelas e Anexos Simples Nacional (LC 123/2006)')
        recSn.set(
          'descricao',
          'Faixas de RBT12, alíquotas nominais e parcelas a deduzir dos Anexos I ao IV.',
        )
        recSn.set('vigencia_inicio', '2026-01-01 00:00:00.000Z')
        recSn.set('ativo', true)
        recSn.set('versao', 1)
        recSn.set('valores_json', {
          sublimite_estadual: 3600000.0,
          limite_geral: 4800000.0,
          anexo_I_comercio: [
            { faixa: 1, limite_rbt12: 180000.0, aliquota_nominal: 0.04, parcela_deduzir: 0.0 },
            { faixa: 2, limite_rbt12: 360000.0, aliquota_nominal: 0.073, parcela_deduzir: 5940.0 },
            { faixa: 3, limite_rbt12: 720000.0, aliquota_nominal: 0.095, parcela_deduzir: 13860.0 },
            {
              faixa: 4,
              limite_rbt12: 1800000.0,
              aliquota_nominal: 0.107,
              parcela_deduzir: 22500.0,
            },
            {
              faixa: 5,
              limite_rbt12: 3600000.0,
              aliquota_nominal: 0.143,
              parcela_deduzir: 87300.0,
            },
            {
              faixa: 6,
              limite_rbt12: 4800000.0,
              aliquota_nominal: 0.19,
              parcela_deduzir: 378000.0,
            },
          ],
          anexo_II_industria: [
            { faixa: 1, limite_rbt12: 180000.0, aliquota_nominal: 0.045, parcela_deduzir: 0.0 },
            { faixa: 2, limite_rbt12: 360000.0, aliquota_nominal: 0.078, parcela_deduzir: 5940.0 },
            { faixa: 3, limite_rbt12: 720000.0, aliquota_nominal: 0.1, parcela_deduzir: 13860.0 },
            {
              faixa: 4,
              limite_rbt12: 1800000.0,
              aliquota_nominal: 0.112,
              parcela_deduzir: 22500.0,
            },
            {
              faixa: 5,
              limite_rbt12: 3600000.0,
              aliquota_nominal: 0.147,
              parcela_deduzir: 85500.0,
            },
            { faixa: 6, limite_rbt12: 4800000.0, aliquota_nominal: 0.3, parcela_deduzir: 720000.0 },
          ],
          anexo_III_servicos: [
            { faixa: 1, limite_rbt12: 180000.0, aliquota_nominal: 0.06, parcela_deduzir: 0.0 },
            { faixa: 2, limite_rbt12: 360000.0, aliquota_nominal: 0.112, parcela_deduzir: 9360.0 },
            { faixa: 3, limite_rbt12: 720000.0, aliquota_nominal: 0.135, parcela_deduzir: 17640.0 },
            { faixa: 4, limite_rbt12: 1800000.0, aliquota_nominal: 0.16, parcela_deduzir: 35640.0 },
            {
              faixa: 5,
              limite_rbt12: 3600000.0,
              aliquota_nominal: 0.21,
              parcela_deduzir: 125640.0,
            },
            {
              faixa: 6,
              limite_rbt12: 4800000.0,
              aliquota_nominal: 0.33,
              parcela_deduzir: 648000.0,
            },
          ],
          anexo_IV_servicos_obras: [
            { faixa: 1, limite_rbt12: 180000.0, aliquota_nominal: 0.045, parcela_deduzir: 0.0 },
            { faixa: 2, limite_rbt12: 360000.0, aliquota_nominal: 0.09, parcela_deduzir: 8100.0 },
            { faixa: 3, limite_rbt12: 720000.0, aliquota_nominal: 0.102, parcela_deduzir: 12420.0 },
            { faixa: 4, limite_rbt12: 1800000.0, aliquota_nominal: 0.14, parcela_deduzir: 39780.0 },
            {
              faixa: 5,
              limite_rbt12: 3600000.0,
              aliquota_nominal: 0.22,
              parcela_deduzir: 183780.0,
            },
            {
              faixa: 6,
              limite_rbt12: 4800000.0,
              aliquota_nominal: 0.33,
              parcela_deduzir: 828000.0,
            },
          ],
        })
        app.save(recSn)

        // 5. ISS
        const recIss = new Record(paramsCollection)
        recIss.set('tenant_id', tenantId)
        recIss.set('categoria', 'iss')
        recIss.set('chave', 'iss_parametros_municipais_2026')
        recIss.set('titulo', 'Parâmetros Normativos de ISS')
        recIss.set(
          'descricao',
          'Alíquotas mínima (2%) e máxima (5%) constitucionais e padrão geral.',
        )
        recIss.set('vigencia_inicio', '2026-01-01 00:00:00.000Z')
        recIss.set('ativo', true)
        recIss.set('versao', 1)
        recIss.set('valores_json', {
          aliquota_minima: 2.0,
          aliquota_maxima: 5.0,
          aliquota_padrao: 5.0,
          aliquota_retencao_padrao: 5.0,
        })
        app.save(recIss)

        // 6. LUCRO PRESUMIDO (IRPJ e CSLL)
        const recLp = new Record(paramsCollection)
        recLp.set('tenant_id', tenantId)
        recLp.set('categoria', 'lucro_presumido')
        recLp.set('chave', 'lucro_presumido_irpj_csll_2026')
        recLp.set('titulo', 'Bases e Alíquotas Lucro Presumido')
        recLp.set(
          'descricao',
          'Presunções de IRPJ (8% comércio, 32% serviços), CSLL (12% comércio, 32% serviços), adicional de 10% e PIS/COFINS cumulativo (3,65%).',
        )
        recLp.set('vigencia_inicio', '2026-01-01 00:00:00.000Z')
        recLp.set('ativo', true)
        recLp.set('versao', 1)
        recLp.set('valores_json', {
          presuncao_irpj_comercio: 8.0,
          presuncao_irpj_servicos: 32.0,
          aliquota_irpj: 15.0,
          adicional_irpj_limite_trimestral: 60000.0,
          aliquota_adicional_irpj: 10.0,
          presuncao_csll_comercio: 12.0,
          presuncao_csll_servicos: 32.0,
          aliquota_csll: 9.0,
          pis_cumulativo: 0.65,
          cofins_cumulativo: 3.0,
        })
        app.save(recLp)
      }
      console.log('[MIGRATION_0089] Seeds de parametros_normativos inseridos com sucesso.')
    } catch (err) {
      console.log('[MIGRATION_0089] Aviso ao seedar parametros_normativos:', err)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('parametros_normativos')
      app.delete(col)
      console.log('[MIGRATION_0089] Coleção parametros_normativos removida.')
    } catch (_) {}
  },
)

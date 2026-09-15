/// <reference path="../pb_data/types.d.ts" />
// Migration: 0070_create_exclusoes_backup_and_delete_luciana.js
// Tarefa 1: Exclusão definitiva em cascata de "LUCIANA KARINA GADOTTI LTDA" (CNPJ: 30366021000196)
// Tarefa 2: Adiciona campo 'excluida_em' na coleção empresas e cria a coleção 'exclusoes_empresa_backup'

migrate(
  (app) => {
    // 1. Adicionar campo 'excluida_em' na coleção empresas se não existir
    const empresasCol = app.findCollectionByNameOrId('empresas')
    if (!empresasCol.fields.getByName('excluida_em')) {
      empresasCol.fields.add(
        new DateField({
          name: 'excluida_em',
          required: false,
        }),
      )
      empresasCol.addIndex('idx_empresas_excluida_em', false, 'excluida_em', '')
      app.save(empresasCol)
      console.log('[MIGRATION_0070] Campo excluida_em adicionado em empresas.')
    }

    // 2. Criar coleção 'exclusoes_empresa_backup'
    try {
      app.findCollectionByNameOrId('exclusoes_empresa_backup')
      console.log('[MIGRATION_0070] Coleção exclusoes_empresa_backup já existe.')
    } catch (_) {
      const tenantsColId = app.findCollectionByNameOrId('tenants').id
      const backupCollection = new Collection({
        name: 'exclusoes_empresa_backup',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'tenant_id',
            type: 'relation',
            required: true,
            collectionId: tenantsColId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'empresa_id',
            type: 'text',
            required: true,
          },
          {
            name: 'razao_social',
            type: 'text',
            required: true,
          },
          {
            name: 'cnpj',
            type: 'text',
            required: true,
          },
          {
            name: 'dados_json',
            type: 'json',
            required: false,
          },
          {
            name: 'total_registros',
            type: 'number',
            required: false,
          },
          {
            name: 'tamanho_bytes',
            type: 'number',
            required: false,
          },
          {
            name: 'criado_por',
            type: 'relation',
            required: false,
            collectionId: '_pb_users_auth_',
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'criado_em',
            type: 'date',
            required: false,
          },
          {
            name: 'purga_em',
            type: 'date',
            required: false,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['retido', 'purgado', 'restaurado'],
            maxSelect: 1,
          },
          {
            name: 'restaurado_em',
            type: 'date',
            required: false,
          },
          {
            name: 'restaurado_por',
            type: 'relation',
            required: false,
            collectionId: '_pb_users_auth_',
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'purgado_em',
            type: 'date',
            required: false,
          },
          {
            name: 'created',
            type: 'autodate',
            onCreate: true,
            onUpdate: false,
          },
          {
            name: 'updated',
            type: 'autodate',
            onCreate: true,
            onUpdate: true,
          },
        ],
        indexes: [
          'CREATE INDEX idx_exclusoes_bkp_tenant ON exclusoes_empresa_backup (tenant_id, status)',
          'CREATE INDEX idx_exclusoes_bkp_purga ON exclusoes_empresa_backup (status, purga_em)',
          'CREATE INDEX idx_exclusoes_bkp_empresa ON exclusoes_empresa_backup (empresa_id)',
        ],
      })
      app.save(backupCollection)
      console.log('[MIGRATION_0070] Coleção exclusoes_empresa_backup criada com sucesso.')
    }

    // 3. TAREFA 1: Localizar e excluir "LUCIANA KARINA GADOTTI LTDA"
    console.log('[MIGRATION_0070] Localizando LUCIANA KARINA GADOTTI LTDA para exclusão direta...')

    const lucianaCnpjs = ['30366021000196', '30.366.021/0001-96']
    const lucianaIdsSet = new Set(['ilc1094iwzebkmi'])

    for (const cnpj of lucianaCnpjs) {
      try {
        const found = app.findRecordsByFilter('empresas', `cnpj = '${cnpj}'`, '', 10, 0)
        for (const f of found) {
          lucianaIdsSet.add(f.id)
        }
      } catch (_) {}
    }

    try {
      const foundByRazao = app.findRecordsByFilter(
        'empresas',
        "razao_social ~ 'LUCIANA KARINA GADOTTI'",
        '',
        10,
        0,
      )
      for (const f of foundByRazao) {
        lucianaIdsSet.add(f.id)
      }
    } catch (_) {}

    const lucianaIds = Array.from(lucianaIdsSet)
    console.log('[MIGRATION_0070] IDs da empresa LUCIANA KARINA GADOTTI encontrados:', lucianaIds)

    if (lucianaIds.length > 0) {
      const sqlIdsList = lucianaIds.map((id) => `'${id}'`).join(',')

      const deleteFromTable = (tableName, condition) => {
        try {
          const query = `DELETE FROM ${tableName} WHERE ${condition}`
          app.db().newQuery(query).execute()
          console.log(`[MIGRATION_0070] ${tableName}: limpos registros com condição (${condition})`)
        } catch (err) {
          console.warn(
            `[MIGRATION_0070] Aviso ao limpar ${tableName}:`,
            err && err.message ? err.message : err,
          )
        }
      }

      // Ordem estrita de integridade referencial:
      // 1. WhatsApp atendimento
      deleteFromTable(
        'wa_atendimento_mensagens',
        `conversa IN (SELECT id FROM wa_atendimento_conversas WHERE empresa IN (${sqlIdsList}))`,
      )
      deleteFromTable('wa_atendimento_conversas', `empresa IN (${sqlIdsList})`)

      // 2. NFS-e e solicitações
      deleteFromTable('nfse_notas_emitidas', `empresa IN (${sqlIdsList})`)
      deleteFromTable('nfse_solicitacoes', `empresa IN (${sqlIdsList})`)
      try {
        app
          .db()
          .newQuery(
            `UPDATE nfse_config SET empresa_padrao = '' WHERE empresa_padrao IN (${sqlIdsList})`,
          )
          .execute()
      } catch (_) {}

      // 3. NF-e recebidas e logs
      deleteFromTable('nfe_recebidas', `empresa IN (${sqlIdsList})`)
      deleteFromTable('nfe_sync_logs', `empresa IN (${sqlIdsList})`)
      deleteFromTable('nfe_config', `empresa IN (${sqlIdsList})`)

      // 4. SPED, CNDs / Certidões, e-CAC e Conector RFB
      deleteFromTable('sped_arquivos', `empresa IN (${sqlIdsList})`)
      deleteFromTable('certidoes', `empresa IN (${sqlIdsList})`)
      deleteFromTable('ecac_comunicacoes', `empresa IN (${sqlIdsList})`)
      deleteFromTable('rfb_sync_logs', `empresa IN (${sqlIdsList})`)
      deleteFromTable('rfb_config', `empresa IN (${sqlIdsList})`)

      // 5. Guias de pagamentos e parcelamentos
      deleteFromTable('guias_pagamentos', `empresa IN (${sqlIdsList})`)
      deleteFromTable('parcelamentos_federais', `empresa IN (${sqlIdsList})`)

      // 6. DP, Folha, Verbas, Férias, 13º, Benefícios, Convenções, eSocial, Reinf, DCTFWeb
      deleteFromTable('beneficios_concedidos', `empresa IN (${sqlIdsList})`)
      deleteFromTable('historico_salarial', `empresa IN (${sqlIdsList})`)
      deleteFromTable('convencoes_coletivas', `empresa IN (${sqlIdsList})`)
      deleteFromTable('rescisoes', `empresa IN (${sqlIdsList})`)
      deleteFromTable('decimo_terceiro', `empresa IN (${sqlIdsList})`)
      deleteFromTable('ferias_periodos', `empresa IN (${sqlIdsList})`)
      deleteFromTable('verbas_lancamentos', `empresa IN (${sqlIdsList})`)
      deleteFromTable('verbas_catalogo', `empresa IN (${sqlIdsList})`)
      deleteFromTable('folha_pagamento', `empresa IN (${sqlIdsList})`)
      deleteFromTable('eventos_dp', `empresa IN (${sqlIdsList})`)
      deleteFromTable('esocial_eventos', `empresa IN (${sqlIdsList})`)
      deleteFromTable('esocial_config', `empresa IN (${sqlIdsList})`)
      deleteFromTable('reinf_eventos', `empresa IN (${sqlIdsList})`)
      deleteFromTable('dctfweb_declaracoes', `empresa IN (${sqlIdsList})`)
      deleteFromTable('funcionarios', `empresa IN (${sqlIdsList})`)

      // 7. Simulações da Reforma Tributária
      deleteFromTable('simulacoes_reforma', `empresa IN (${sqlIdsList})`)

      // 8. Faturamentos Recorrentes, Contratos de Honorários e Assinaturas
      deleteFromTable('faturamentos_recorrentes', `empresa IN (${sqlIdsList})`)
      deleteFromTable('assinaturas_demonstrativos', `empresa IN (${sqlIdsList})`)
      deleteFromTable('contratos_honorarios', `empresa IN (${sqlIdsList})`)

      // 9. Demonstrativos, Impostos Retidos e Pré-Lançamentos
      deleteFromTable('impostos_retidos', `empresa IN (${sqlIdsList})`)
      deleteFromTable('demonstrativos', `empresa IN (${sqlIdsList})`)
      deleteFromTable('pre_lancamentos', `empresa IN (${sqlIdsList})`)

      // 10. Financeiro & Integrações Bancárias
      deleteFromTable(
        'integracoes_logs',
        `conta_bancaria IN (SELECT id FROM contas_bancarias WHERE empresa IN (${sqlIdsList}))`,
      )
      deleteFromTable('integracoes_bancarias', `empresa IN (${sqlIdsList})`)
      deleteFromTable('extratos_bancarios', `empresa IN (${sqlIdsList})`)
      deleteFromTable('contas_financeiras', `empresa IN (${sqlIdsList})`)
      deleteFromTable('contas_bancarias', `empresa IN (${sqlIdsList})`)

      // 11. Patrimônio & Fechamento de Competência
      deleteFromTable('baixas_ativos', `empresa IN (${sqlIdsList})`)
      deleteFromTable('ativos', `empresa IN (${sqlIdsList})`)
      deleteFromTable('fechamento_checklist_itens', `empresa IN (${sqlIdsList})`)
      deleteFromTable('fechamento_competencia', `empresa IN (${sqlIdsList})`)

      // 12. Contábil: lançamentos contábeis
      deleteFromTable('lancamentos_contabeis', `empresa IN (${sqlIdsList})`)

      // 13. Fiscal, Obrigações e Workflows
      deleteFromTable('fiscal', `empresa IN (${sqlIdsList})`)
      deleteFromTable('obrigacoes', `empresa IN (${sqlIdsList})`)
      deleteFromTable(
        'workflow_activity',
        `workflow_id IN (SELECT id FROM workflows WHERE empresa_id IN (${sqlIdsList}))`,
      )
      deleteFromTable('workflows', `empresa_id IN (${sqlIdsList})`)

      // 14. Documentos GED
      deleteFromTable('documentos', `empresa_id IN (${sqlIdsList})`)

      // 15. Certificados Digitais e Cadastro Assistido
      deleteFromTable('certificados_digitais', `empresa IN (${sqlIdsList})`)
      deleteFromTable('empresa_cadastro_assistido', `empresa IN (${sqlIdsList})`)

      // 16. Leads WhatsApp vinculados
      deleteFromTable('whatsapp_leads_contatos', `empresa_associada IN (${sqlIdsList})`)

      // 17. Portal de acessos
      deleteFromTable('portal_acessos', `empresa IN (${sqlIdsList})`)

      // 18. Audit Log vinculado à empresa excluída
      deleteFromTable('audit_log', `entidade_id IN (${sqlIdsList})`)

      // 19. Backups prévios se houvesse
      deleteFromTable('exclusoes_empresa_backup', `empresa_id IN (${sqlIdsList})`)

      // 20. Finalmente, excluir a empresa do cadastro
      deleteFromTable('empresas', `id IN (${sqlIdsList})`)
      console.log(
        '[MIGRATION_0070] Empresa LUCIANA KARINA GADOTTI LTDA e todos os registros derivados excluídos com sucesso!',
      )
    } else {
      console.log(
        '[MIGRATION_0070] Nenhum registro de LUCIANA KARINA GADOTTI LTDA encontrado (já limpo).',
      )
    }
  },
  (app) => {
    try {
      const backupCollection = app.findCollectionByNameOrId('exclusoes_empresa_backup')
      app.delete(backupCollection)
    } catch (_) {}
  },
)

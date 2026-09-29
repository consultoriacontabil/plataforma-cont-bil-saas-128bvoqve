/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0098:
 * Cria collection 'backups_execucoes' para gerenciamento de backups e snapshots independentes:
 * - tenant_id (relation tenants)
 * - data_execucao (date / datetime ISO)
 * - tipo (select: agendado | manual | ged_lote)
 * - status (select: sucesso | parcial | falhou)
 * - tamanho_estimado_bytes (number)
 * - contagem_registros (json: { empresas, documentos, lancamentos_contabeis, folha_pagamento, obrigacoes, whatsapp_envios, audit_log, ... })
 * - colecoes_exportadas (json: string[])
 * - colecoes_com_erro (json: string[])
 * - total_documentos_ged (number)
 * - executado_por (relation users, opcional - nulo se agendado)
 * - mensagem (text)
 * - erro_detalhe (text)
 * - retencao_dias (number, padrão 7)
 * - snapshot_json (json, dados exportados em JSON estruturado para recuperação)
 */
migrate(
  (app) => {
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    try {
      app.findCollectionByNameOrId('backups_execucoes')
    } catch (_) {
      const col = new Collection({
        name: 'backups_execucoes',
        type: 'base',
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
            name: 'data_execucao',
            type: 'date',
            required: true,
          },
          {
            name: 'tipo',
            type: 'select',
            required: true,
            values: ['agendado', 'manual', 'ged_lote'],
            maxSelect: 1,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['sucesso', 'parcial', 'falhou'],
            maxSelect: 1,
          },
          {
            name: 'tamanho_estimado_bytes',
            type: 'number',
            required: false,
          },
          {
            name: 'contagem_registros',
            type: 'json',
            required: false,
          },
          {
            name: 'colecoes_exportadas',
            type: 'json',
            required: false,
          },
          {
            name: 'colecoes_com_erro',
            type: 'json',
            required: false,
          },
          {
            name: 'total_documentos_ged',
            type: 'number',
            required: false,
          },
          {
            name: 'executado_por',
            type: 'relation',
            required: false,
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'mensagem',
            type: 'text',
            required: false,
          },
          {
            name: 'erro_detalhe',
            type: 'text',
            required: false,
          },
          {
            name: 'retencao_dias',
            type: 'number',
            required: false,
          },
          {
            name: 'snapshot_json',
            type: 'json',
            required: false,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_bkp_exec_tenant ON backups_execucoes (tenant_id)',
          'CREATE INDEX idx_bkp_exec_data ON backups_execucoes (data_execucao DESC)',
          'CREATE INDEX idx_bkp_exec_tipo ON backups_execucoes (tipo)',
          'CREATE INDEX idx_bkp_exec_status ON backups_execucoes (status)',
        ],
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
      })
      app.save(col)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('backups_execucoes')
      app.delete(col)
    } catch (_) {}
  },
)

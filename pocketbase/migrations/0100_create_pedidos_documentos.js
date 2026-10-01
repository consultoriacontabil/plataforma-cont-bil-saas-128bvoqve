/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0100:
 * Cria collection 'pedidos_documentos' para controle de requisições de documentos de clientes:
 * - tenant_id (relation tenants)
 * - empresa (relation empresas)
 * - competencia (text, MM/AAAA)
 * - token_publico (text, unique)
 * - status (select: pendente | parcialmente_atendido | atendido | cancelado)
 * - tipos_solicitados (json)
 * - itens_status (json: [{ id, tipo, detalhe, status: 'solicitado'|'recebido'|'nao_enviado', documento_ged_id, recebido_em }])
 * - link_expira_em (date)
 * - ultimo_envio_whatsapp_em (date)
 * - criado_por (relation users)
 */
migrate(
  (app) => {
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    try {
      app.findCollectionByNameOrId('pedidos_documentos')
    } catch (_) {
      const col = new Collection({
        name: 'pedidos_documentos',
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
            name: 'empresa',
            type: 'relation',
            required: true,
            collectionId: empresasCol.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'competencia',
            type: 'text',
            required: true,
          },
          {
            name: 'token_publico',
            type: 'text',
            required: true,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['pendente', 'parcialmente_atendido', 'atendido', 'cancelado'],
            maxSelect: 1,
          },
          {
            name: 'tipos_solicitados',
            type: 'json',
            required: false,
          },
          {
            name: 'itens_status',
            type: 'json',
            required: false,
          },
          {
            name: 'link_expira_em',
            type: 'date',
            required: false,
          },
          {
            name: 'ultimo_envio_whatsapp_em',
            type: 'date',
            required: false,
          },
          {
            name: 'criado_por',
            type: 'relation',
            required: false,
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_pedidos_doc_tenant ON pedidos_documentos (tenant_id)',
          'CREATE INDEX idx_pedidos_doc_empresa ON pedidos_documentos (empresa)',
          'CREATE INDEX idx_pedidos_doc_comp ON pedidos_documentos (competencia)',
          'CREATE UNIQUE INDEX idx_pedidos_doc_token ON pedidos_documentos (token_publico)',
          'CREATE INDEX idx_pedidos_doc_status ON pedidos_documentos (status)',
          'CREATE INDEX idx_pedidos_doc_created ON pedidos_documentos (created DESC)',
        ],
        // Permitir leitura pública pelo token_publico para upload pelo cliente no link público
        listRule: "@request.auth.id != '' || token_publico != ''",
        viewRule: "@request.auth.id != '' || token_publico != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != '' || token_publico != ''",
        deleteRule: "@request.auth.id != ''",
      })
      app.save(col)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('pedidos_documentos')
      app.delete(col)
    } catch (_) {}
  },
)

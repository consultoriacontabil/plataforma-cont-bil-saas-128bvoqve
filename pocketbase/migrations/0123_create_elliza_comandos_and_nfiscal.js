/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0123: Integração Rumo ⇄ ELLIZA desktop
 * MARCO 1: Criação da collection `elliza_comandos` (canal de comandos assíncronos/SSE/polling com idempotência por nonce)
 * MARCO 2: Criação da collection `nfiscal` (registro fiscal extraído e estruturado via OCR/Scanner local da ELLIZA desktop)
 */

migrate(
  (app) => {
    console.log('[MIGRATION-0123] Iniciando criação das coleções elliza_comandos e nfiscal...')

    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const docsCol = app.findCollectionByNameOrId('documentos')

    // 1. Coleção `elliza_comandos`
    let comandosCol = null
    try {
      comandosCol = app.findCollectionByNameOrId('elliza_comandos')
      console.log('[MIGRATION-0123] Coleção elliza_comandos já existe.')
    } catch (_) {
      comandosCol = new Collection({
        name: 'elliza_comandos',
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
            collectionId: tenantsCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'empresa_id',
            type: 'relation',
            required: false,
            collectionId: empresasCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'agente',
            type: 'text',
            required: false,
          },
          {
            name: 'tipo',
            type: 'select',
            required: true,
            values: [
              'chat_objetivo',
              'extrair_documento',
              'conciliar_xml',
              'raspar_portal',
              'enviar_zap',
              'consultar_api',
              'sync_ged',
            ],
            maxSelect: 1,
          },
          {
            name: 'payload',
            type: 'json',
            required: false,
          },
          {
            name: 'prioridade',
            type: 'number',
            min: 1,
            max: 5,
            onlyInt: true,
            required: false,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['pendente', 'aceito', 'em_execucao', 'concluido', 'erro', 'expirado'],
            maxSelect: 1,
          },
          {
            name: 'nonce',
            type: 'text',
            required: true,
          },
          {
            name: 'expira_em',
            type: 'date',
            required: false,
          },
          {
            name: 'resultado',
            type: 'json',
            required: false,
          },
          {
            name: 'evidencias',
            type: 'json',
            required: false,
          },
          {
            name: 'erro',
            type: 'json',
            required: false,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_elliza_cmd_tenant_status ON elliza_comandos (tenant_id, status)',
          'CREATE INDEX idx_elliza_cmd_empresa ON elliza_comandos (empresa_id)',
          'CREATE UNIQUE INDEX idx_elliza_cmd_nonce ON elliza_comandos (nonce)',
          'CREATE INDEX idx_elliza_cmd_tipo ON elliza_comandos (tipo)',
          'CREATE INDEX idx_elliza_cmd_expira ON elliza_comandos (expira_em)',
        ],
      })
      app.save(comandosCol)
      console.log('[MIGRATION-0123] Coleção elliza_comandos criada com sucesso.')
    }

    // 2. Coleção `nfiscal`
    let nfiscalCol = null
    try {
      nfiscalCol = app.findCollectionByNameOrId('nfiscal')
      console.log('[MIGRATION-0123] Coleção nfiscal já existe.')
    } catch (_) {
      nfiscalCol = new Collection({
        name: 'nfiscal',
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
            collectionId: tenantsCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'empresa_id',
            type: 'relation',
            required: true,
            collectionId: empresasCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'numero',
            type: 'text',
            required: true,
          },
          {
            name: 'serie',
            type: 'text',
            required: false,
          },
          {
            name: 'cnpj_emitente',
            type: 'text',
            required: true,
          },
          {
            name: 'cnpj_destinatario',
            type: 'text',
            required: true,
          },
          {
            name: 'valor_total',
            type: 'number',
            required: true,
          },
          {
            name: 'cfop',
            type: 'text',
            required: false,
          },
          {
            name: 'competencia',
            type: 'text',
            required: true,
          },
          {
            name: 'origem',
            type: 'text',
            required: true,
          },
          {
            name: 'documento_id',
            type: 'relation',
            required: false,
            collectionId: docsCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'itens',
            type: 'json',
            required: false,
          },
          {
            name: 'metadados_json',
            type: 'json',
            required: false,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_nfiscal_tenant_empresa ON nfiscal (tenant_id, empresa_id)',
          'CREATE INDEX idx_nfiscal_comp ON nfiscal (competencia)',
          'CREATE INDEX idx_nfiscal_emitente ON nfiscal (cnpj_emitente)',
          'CREATE INDEX idx_nfiscal_doc ON nfiscal (documento_id)',
        ],
      })
      app.save(nfiscalCol)
      console.log('[MIGRATION-0123] Coleção nfiscal criada com sucesso.')
    }
  },
  (app) => {
    try {
      const nfCol = app.findCollectionByNameOrId('nfiscal')
      app.delete(nfCol)
    } catch (_) {}
    try {
      const cmdCol = app.findCollectionByNameOrId('elliza_comandos')
      app.delete(cmdCol)
    } catch (_) {}
  },
)

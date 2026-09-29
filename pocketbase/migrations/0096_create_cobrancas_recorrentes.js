/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0096:
 * Cria collection 'cobrancas_recorrentes' para automação de mensalidades:
 * - tenant_id (relation tenants)
 * - empresa (relation empresas)
 * - descricao (text)
 * - valor (number)
 * - dia_do_mes (number, default 5, dia que dispara a geração)
 * - dia_vencimento (number, default 10, dia de vencimento da fatura gerada)
 * - meio (select: pix | boleto)
 * - chave_pix (text)
 * - beneficiario_nome (text)
 * - autorizar_envio_whatsapp (bool)
 * - ativo (bool)
 * - ultima_competencia_gerada (text, ex: '2026-09')
 * - proxima_geracao (date)
 * - observacoes (text)
 */
migrate(
  (app) => {
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const empresasCol = app.findCollectionByNameOrId('empresas')

    try {
      app.findCollectionByNameOrId('cobrancas_recorrentes')
    } catch (_) {
      const col = new Collection({
        name: 'cobrancas_recorrentes',
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
            name: 'descricao',
            type: 'text',
            required: true,
          },
          {
            name: 'valor',
            type: 'number',
            required: true,
          },
          {
            name: 'dia_do_mes',
            type: 'number',
            required: true,
          },
          {
            name: 'dia_vencimento',
            type: 'number',
            required: true,
          },
          {
            name: 'meio',
            type: 'select',
            required: true,
            values: ['pix', 'boleto'],
            maxSelect: 1,
          },
          {
            name: 'chave_pix',
            type: 'text',
            required: false,
          },
          {
            name: 'beneficiario_nome',
            type: 'text',
            required: false,
          },
          {
            name: 'autorizar_envio_whatsapp',
            type: 'bool',
            required: false,
          },
          {
            name: 'ativo',
            type: 'bool',
            required: false,
          },
          {
            name: 'ultima_competencia_gerada',
            type: 'text',
            required: false,
          },
          {
            name: 'proxima_geracao',
            type: 'date',
            required: false,
          },
          {
            name: 'observacoes',
            type: 'text',
            required: false,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_cobr_rec_tenant_emp ON cobrancas_recorrentes (tenant_id, empresa)',
          'CREATE INDEX idx_cobr_rec_ativo ON cobrancas_recorrentes (ativo)',
          'CREATE INDEX idx_cobr_rec_dia ON cobrancas_recorrentes (dia_do_mes)',
        ],
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
      })
      app.save(col)
    }

    // Expandir cobrancas com campo lembretes_enviados se não existir
    const cobrancasCol = app.findCollectionByNameOrId('cobrancas')
    if (!cobrancasCol.fields.getByName('lembretes_enviados')) {
      cobrancasCol.fields.add(
        new JSONField({
          name: 'lembretes_enviados',
        }),
      )
      app.save(cobrancasCol)
    }
    if (!cobrancasCol.fields.getByName('recorrencia_id')) {
      const recCol = app.findCollectionByNameOrId('cobrancas_recorrentes')
      cobrancasCol.fields.add(
        new RelationField({
          name: 'recorrencia_id',
          collectionId: recCol.id,
          maxSelect: 1,
        }),
      )
      app.save(cobrancasCol)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('cobrancas_recorrentes')
      app.delete(col)
    } catch (_) {}
  },
)

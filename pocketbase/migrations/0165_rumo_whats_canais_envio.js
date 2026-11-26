/// <reference path="../pb_data/types.d.ts" />

/**
 * Rumo Whats — conexão por QR Code (pareamento de aparelho via conector Node).
 *
 * - wa_canais: registro do número com modo "qr" (um registro por número pareado).
 * - Webhook único /backend/v1/rumo-whats/webhook: valida token, grava antes de
 *   processar, deduplica pelo wamid, atualiza status sem regredir e preserva
 *   mensagem apagada no aparelho.
 * - Laço de envio: GET /backend/v1/rumo-whats/fila — o conector Node (que segura
 *   a sessão aberta) lê as mensagens pendentes e despacha pelo socket Baileys,
 *   gravando o wamid de volta via POST /backend/v1/rumo-whats/fila/:id/confirmar.
 */

migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const tenantsId = tenants.id

    // 1. Coleção wa_canais — registro do número do atendimento (modo QR)
    const canais = new Collection({
      name: 'wa_canais',
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
          collectionId: tenantsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'nome', type: 'text', required: true },
        { name: 'telefone', type: 'text', required: true },
        {
          name: 'modo',
          type: 'select',
          required: true,
          values: ['qr', 'api_oficial', 'evolution'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['aguardando_qr', 'conectado', 'desconectado', 'desativado'],
          maxSelect: 1,
        },
        { name: 'finalidade', type: 'text' },
        { name: 'conector_url', type: 'text' },
        { name: 'numero_pareado', type: 'text' },
        { name: 'conectado_em', type: 'date' },
        { name: 'ultimo_erro', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_wa_canais_tenant ON wa_canais (tenant_id, status)',
        'CREATE UNIQUE INDEX idx_wa_canais_telefone ON wa_canais (telefone)',
      ],
    })
    app.save(canais)

    // 2. wa_atendimento_mensagens: campos do ciclo Rumo Whats
    const mensagens = app.findCollectionByNameOrId('wa_atendimento_mensagens')
    if (!mensagens.fields.getByName('wamid')) {
      mensagens.fields.add(new TextField({ name: 'wamid' }))
    }
    const fStatus = mensagens.fields.getByName('status_envio')
    if (!fStatus) {
      mensagens.fields.add(
        new SelectField({
          name: 'status_envio',
          values: [
            'sugerida_ia',
            'pendente',
            'enviada',
            'pendente_aprovacao',
            'rejeitada_contador',
            'falha',
          ],
          maxSelect: 1,
        }),
      )
    } else {
      const valores = [
        'sugerida_ia',
        'pendente',
        'enviada',
        'pendente_aprovacao',
        'rejeitada_contador',
        'falha',
      ]
      for (const v of valores) {
        if (!fStatus.values.includes(v)) fStatus.values.push(v)
      }
    }
    if (!mensagens.fields.getByName('mensagem_apagada')) {
      mensagens.fields.add(new BoolField({ name: 'mensagem_apagada' }))
    }
    if (!mensagens.fields.getByName('canal')) {
      const canaisId = canais.id
      mensagens.fields.add(
        new RelationField({
          name: 'canal',
          collectionId: canaisId,
          maxSelect: 1,
          required: false,
        }),
      )
    }
    app.save(mensagens)

    // 3. Índice de deduplicação pelo wamid (nulo é permitido em multiplos registros)
    try {
      $app
        .db()
        .newQuery(
          "CREATE UNIQUE INDEX idx_wa_msg_wamid ON wa_atendimento_mensagens (wamid) WHERE wamid != ''",
        )
        .execute()
    } catch (eIdx) {
      console.log('[RUMO-WHATS] idx_wa_msg_wamid: ' + eIdx)
    }
  },
  (app) => {
    // Reversão: remover coleção e campos adicionados
    try {
      app.delete(app.findCollectionByNameOrId('wa_canais'))
    } catch (_) {}
    try {
      const mensagens = app.findCollectionByNameOrId('wa_atendimento_mensagens')
      for (const f of ['wamid', 'mensagem_apagada', 'canal']) {
        try {
          mensagens.fields.removeByName(f)
        } catch (_) {}
      }
      app.save(mensagens)
    } catch (_) {}
  },
)

/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0166 — Rumo Whats, telas 03/04/05 (Especificação Makro Whats).
 *
 * Cria:
 * - wa_chatbot_config    : mensagem de saudação, menu, regra de roteamento,
 *                          grade de horários e mensagens automáticas (Telas 03 e 05)
 * - wa_chatbot_setores   : menu de setores/departamentos com palavras-chave e
 *                          atendente responsável (Tela 03)
 * - wa_whats_transmissoes: listas de transmissão (Tela 04)
 * - wa_whats_disparos    : fila de disparos — TAREFAS que o agente externo Elliza
 *                          (ZAP da ELLIZA desktop) consome e executa (Telas 04 e 07)
 *
 * Decisão de produto: a plataforma NUNCA envia WhatsApp direto. Todo disparo é
 * enfileirado como tarefa em wa_whats_disparos (status pendente) e o agente
 * externo Elliza executa via ZAP. Sem Evolution API, sem API oficial.
 */

const REGRAS_TENANT_LEITURA =
  "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id"
const REGRAS_TENANT_ESCRITA =
  "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'"
const REGRAS_TENANT_ADMIN =
  "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id && @request.auth.tenant_members_via_user_id.perfil ?= 'administrador'"

migrate(
  (app) => {
    const existe = (nome) => {
      try {
        return app.findCollectionByNameOrId(nome)
      } catch (_) {
        return null
      }
    }

    const tenantsId = app.findCollectionByNameOrId('tenants').id
    const usersId = '_pb_users_auth_'
    const waCanaisId = app.findCollectionByNameOrId('wa_canais').id

    const autodatas = [
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ]

    const criarSeNaoExiste = (nome, fabricar) => {
      const jaExiste = existe(nome)
      if (jaExiste) {
        console.log(`[0166] ${nome} já existe — mantendo estrutura atual`)
        return jaExiste
      }
      const col = new Collection(fabricar())
      app.save(col)
      console.log(`[0166] ${nome} criada`)
      return col
    }

    // ------------------------------------------------------------------
    // 1. wa_chatbot_setores — menu de setores (criada antes da config,
    //    que referencia setor_padrao)
    // ------------------------------------------------------------------
    let waChatbotSetores = existe('wa_chatbot_setores')
    if (!waChatbotSetores) {
      waChatbotSetores = new Collection({
        name: 'wa_chatbot_setores',
        type: 'base',
        listRule: REGRAS_TENANT_LEITURA,
        viewRule: REGRAS_TENANT_LEITURA,
        createRule: REGRAS_TENANT_ESCRITA,
        updateRule: REGRAS_TENANT_ESCRITA,
        deleteRule: REGRAS_TENANT_ADMIN,
        fields: [
          {
            name: 'tenant_id',
            type: 'relation',
            required: true,
            collectionId: tenantsId,
            maxSelect: 1,
          },
          { name: 'nome', type: 'text', required: true },
          { name: 'descricao', type: 'text', required: false },
          { name: 'palavras_chave', type: 'text', required: false },
          { name: 'ordem', type: 'number', required: false, onlyInt: true },
          { name: 'ativo', type: 'bool', required: false },
          {
            name: 'atendente',
            type: 'relation',
            required: false,
            collectionId: usersId,
            maxSelect: 1,
          },
          { name: 'escalonar_ia', type: 'bool', required: false },
          ...autodatas,
        ],
        indexes: ['CREATE INDEX idx_wa_chatbot_setores ON wa_chatbot_setores (tenant_id, ativo)'],
      })
      app.save(waChatbotSetores)
      console.log('[0166] wa_chatbot_setores criada')
    }
    const setoresId = waChatbotSetores.id

    // ------------------------------------------------------------------
    // 2. wa_chatbot_config — saudação, menu, roteamento, horários, msgs automáticas
    // ------------------------------------------------------------------
    let waChatbotConfig = existe('wa_chatbot_config')
    if (!waChatbotConfig) {
      waChatbotConfig = new Collection({
        name: 'wa_chatbot_config',
        type: 'base',
        listRule: REGRAS_TENANT_LEITURA,
        viewRule: REGRAS_TENANT_LEITURA,
        createRule: REGRAS_TENANT_ESCRITA,
        updateRule: REGRAS_TENANT_ESCRITA,
        deleteRule: REGRAS_TENANT_ADMIN,
        fields: [
          {
            name: 'tenant_id',
            type: 'relation',
            required: true,
            collectionId: tenantsId,
            maxSelect: 1,
          },
          { name: 'saudacao', type: 'text', required: false },
          { name: 'menu_texto', type: 'text', required: false },
          { name: 'mensagem_invalida', type: 'text', required: false },
          {
            name: 'roteamento_modo',
            type: 'select',
            required: false,
            maxSelect: 1,
            values: ['menu_digitado', 'setor_padrao'],
          },
          {
            name: 'setor_padrao',
            type: 'relation',
            required: false,
            collectionId: setoresId,
            maxSelect: 1,
          },
          { name: 'ativo', type: 'bool', required: false },
          { name: 'horario_inicio', type: 'text', required: false },
          { name: 'horario_fim', type: 'text', required: false },
          {
            name: 'dias_atendimento',
            type: 'select',
            required: false,
            maxSelect: 7,
            values: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'],
          },
          { name: 'msg_boas_vindas', type: 'text', required: false },
          { name: 'msg_fora_horario', type: 'text', required: false },
          { name: 'msg_posicao_fila', type: 'text', required: false },
          { name: 'fila_ativa', type: 'bool', required: false },
          { name: 'msg_fila_vazia', type: 'text', required: false },
          ...autodatas,
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_wa_chatbot_cfg_tenant_uq ON wa_chatbot_config (tenant_id)',
        ],
      })
      app.save(waChatbotConfig)
      console.log('[0166] wa_chatbot_config criada')
    }

    // ------------------------------------------------------------------
    // 3. wa_whats_transmissoes — listas de transmissão (Tela 04)
    // ------------------------------------------------------------------
    let waWhatsTransmissoes = existe('wa_whats_transmissoes')
    if (!waWhatsTransmissoes) {
      waWhatsTransmissoes = new Collection({
        name: 'wa_whats_transmissoes',
        type: 'base',
        listRule: REGRAS_TENANT_LEITURA,
        viewRule: REGRAS_TENANT_LEITURA,
        createRule: REGRAS_TENANT_ESCRITA,
        updateRule: REGRAS_TENANT_ESCRITA,
        deleteRule: REGRAS_TENANT_ADMIN,
        fields: [
          {
            name: 'tenant_id',
            type: 'relation',
            required: true,
            collectionId: tenantsId,
            maxSelect: 1,
          },
          { name: 'nome', type: 'text', required: true },
          { name: 'mensagem', type: 'text', required: true },
          { name: 'destinatarios', type: 'json', required: false, maxSize: 2000000 },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['rascunho', 'despachada', 'em_execucao', 'concluida', 'falha'],
          },
          {
            name: 'canal',
            type: 'relation',
            required: false,
            collectionId: waCanaisId,
            maxSelect: 1,
          },
          { name: 'total_destinatarios', type: 'number', required: false, onlyInt: true },
          { name: 'total_enviados', type: 'number', required: false, onlyInt: true },
          { name: 'total_falhas', type: 'number', required: false, onlyInt: true },
          { name: 'despachada_em', type: 'date', required: false },
          { name: 'concluida_em', type: 'date', required: false },
          ...autodatas,
        ],
        indexes: ['CREATE INDEX idx_wa_transm_tenant ON wa_whats_transmissoes (tenant_id, status)'],
      })
      app.save(waWhatsTransmissoes)
      console.log('[0166] wa_whats_transmissoes criada')
    }
    const transmissoesId = waWhatsTransmissoes.id

    // ------------------------------------------------------------------
    // 4. wa_whats_disparos — fila de tarefas para o agente externo Elliza
    // ------------------------------------------------------------------
    if (!existe('wa_whats_disparos')) {
      const waWhatsDisparos = new Collection({
        name: 'wa_whats_disparos',
        type: 'base',
        listRule: REGRAS_TENANT_LEITURA,
        viewRule: REGRAS_TENANT_LEITURA,
        createRule: REGRAS_TENANT_ESCRITA,
        updateRule: REGRAS_TENANT_ESCRITA,
        deleteRule: REGRAS_TENANT_ADMIN,
        fields: [
          {
            name: 'tenant_id',
            type: 'relation',
            required: true,
            collectionId: tenantsId,
            maxSelect: 1,
          },
          {
            name: 'transmissao',
            type: 'relation',
            required: false,
            collectionId: transmissoesId,
            maxSelect: 1,
          },
          {
            name: 'origem',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['transmissao', 'documento'],
          },
          { name: 'origem_id', type: 'text', required: false },
          {
            name: 'modulo_origem',
            type: 'select',
            required: false,
            maxSelect: 1,
            values: ['pessoal', 'fiscal', 'contabil', 'financeiro', 'atendimento'],
          },
          { name: 'documento_doc', type: 'text', required: false },
          { name: 'documento_nome', type: 'text', required: false },
          { name: 'destinatario_nome', type: 'text', required: false },
          { name: 'telefone', type: 'text', required: true },
          { name: 'mensagem', type: 'text', required: true },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['pendente', 'enviada', 'falha', 'cancelada'],
          },
          { name: 'wamid', type: 'text', required: false },
          { name: 'erro', type: 'text', required: false },
          { name: 'enviada_em', type: 'date', required: false },
          ...autodatas,
        ],
        indexes: [
          'CREATE INDEX idx_wa_disparos_fila ON wa_whats_disparos (tenant_id, status, created)',
          'CREATE INDEX idx_wa_disparos_transm ON wa_whats_disparos (transmissao)',
        ],
      })
      app.save(waWhatsDisparos)
      console.log('[0166] wa_whats_disparos criada')
    }
  },
  (app) => {
    for (const nome of [
      'wa_whats_disparos',
      'wa_whats_transmissoes',
      'wa_chatbot_config',
      'wa_chatbot_setores',
    ]) {
      try {
        app.delete(app.findCollectionByNameOrId(nome))
      } catch (_) {}
    }
  },
)

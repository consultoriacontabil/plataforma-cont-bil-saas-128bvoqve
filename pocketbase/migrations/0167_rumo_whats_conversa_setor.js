/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0167 — Rumo Whats: campo setor (triagem chatbot) na conversa.
 *
 * A triagem do webhook (hook rumo_whats.js) classifica a conversa em um setor
 * (menu digitado / setor padrão / palavras-chave) e grava aqui, para o painel
 * e os relatórios por setor (Tela 06) saberem para onde a conversa foi roteada.
 * Idempotente: se o campo já existe, não faz nada.
 */

migrate(
  (app) => {
    const conversas = app.findCollectionByNameOrId('wa_atendimento_conversas')
    const temCampo = conversas.fields.some((f) => f.name === 'setor')
    if (temCampo) {
      console.log('[0167] campo setor já existe em wa_atendimento_conversas — nada a fazer')
      return
    }
    const setoresId = app.findCollectionByNameOrId('wa_chatbot_setores').id
    conversas.fields.add(
      new Field({
        name: 'setor',
        type: 'relation',
        required: false,
        collectionId: setoresId,
        maxSelect: 1,
      }),
    )
    app.save(conversas)
    console.log('[0167] campo setor adicionado a wa_atendimento_conversas')
  },
  (app) => {
    const conversas = app.findCollectionByNameOrId('wa_atendimento_conversas')
    const campo = conversas.fields.getByName('setor')
    if (campo) {
      conversas.fields.removeByName('setor')
      app.save(conversas)

      console.log('[0167 down] campo setor removido de wa_atendimento_conversas')
    }
  },
)

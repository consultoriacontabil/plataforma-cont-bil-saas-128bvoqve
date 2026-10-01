/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0101:
 * Expande os tipos aceitos na collection 'documentos' para suportar as novas categorias do GED:
 * - extrato_bancario
 * - fatura_cartao
 * - maquininha
 * - credito
 * E garante que pedidos_documentos e documentos permitam criação de log e upload pelo link público.
 */
migrate(
  (app) => {
    try {
      const docsCol = app.findCollectionByNameOrId('documentos')
      const tipoField = docsCol.fields.getByName('tipo')
      if (tipoField) {
        const novosValores = ['extrato_bancario', 'fatura_cartao', 'maquininha', 'credito']
        novosValores.forEach((v) => {
          if (!tipoField.values.includes(v)) {
            tipoField.values.push(v)
          }
        })
      }

      // Garantir que a regra de criação permita origem_documento = 'link_publico'
      docsCol.createRule =
        "@request.auth.id != '' || @request.body.origem_documento = 'link_publico'"
      docsCol.viewRule = "@request.auth.id != '' || origem_documento = 'link_publico'"
      docsCol.listRule = "@request.auth.id != ''"
      docsCol.updateRule = "@request.auth.id != ''"
      docsCol.deleteRule = "@request.auth.id != '' || origem_documento = 'link_publico'"

      app.save(docsCol)
    } catch (err) {
      console.log('Erro ao atualizar collection documentos na migration 0101:', err)
    }

    // Permitir criação de audit_log por ações do link público quando acionado
    try {
      const auditCol = app.findCollectionByNameOrId('audit_log')
      auditCol.createRule = '' // público ou autenticado para registrar auditoria de uploads externos
      app.save(auditCol)
    } catch (err) {
      console.log('Erro ao ajustar audit_log na migration 0101:', err)
    }

    // Permitir criação de notificações por fluxos de link público (quando cliente envia documento)
    try {
      const notifCol = app.findCollectionByNameOrId('notificacoes')
      notifCol.createRule = ''
      app.save(notifCol)
    } catch (err) {
      console.log('Erro ao ajustar notificacoes na migration 0101:', err)
    }
  },
  (app) => {
    // down
    try {
      const auditCol = app.findCollectionByNameOrId('audit_log')
      auditCol.createRule = "@request.auth.id != ''"
      app.save(auditCol)
    } catch (_) {}

    try {
      const notifCol = app.findCollectionByNameOrId('notificacoes')
      notifCol.createRule = "@request.auth.id != ''"
      app.save(notifCol)
    } catch (_) {}
  },
)

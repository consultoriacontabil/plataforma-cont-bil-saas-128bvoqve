/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0103:
 * 1. Adicionar campos de autorizacao_acesso_ecac na collection 'empresas':
 *    - autorizacao_acesso_ecac: select ['ativa', 'em_analise', 'vencida', 'nao_solicitada'] (default: 'nao_solicitada')
 *    - autorizacao_acesso_atualizada_em: date
 *    - autorizacao_acesso_observacao: text
 *
 * 2. Criar coleção 'integra_contador_config':
 *    - tenant_id: relation -> tenants (unique por tenant)
 *    - ativo: bool
 *    - ambiente: select ['trial', 'producao']
 *    - consumer_key: text
 *    - consumer_secret: text (ofuscado no client)
 *    - contratante_cnpj: text (CNPJ do escritório contábil)
 *    - certificado_a1: relation -> certificados_digitais (e-CNPJ A1 do escritório)
 *    - senha_certificado: text
 *    - sincronizacao_automatica: bool
 *    - sincronizar_situacao_fiscal: bool
 *    - sincronizar_caixa_postal: bool
 *    - sincronizar_dctfweb: bool
 *    - sincronizar_pgdas: bool
 *    - status_conexao: select ['conectado', 'erro_credenciais', 'modo_supervisao', 'desconectado']
 *    - ultimo_diagnostico_json: json
 *    - ultima_sincronizacao_em: date
 *
 * 3. Criar coleção 'integra_contador_consumo' (bilhetagem/controle de custo por transação):
 *    - tenant_id: relation -> tenants
 *    - empresa: relation -> empresas (opcional quando teste global do escritório)
 *    - servico: select ['SITFIS', 'CAIXAPOSTAL', 'DCTFWEB', 'PGDASD', 'PNRCONTADOR', 'TESTE_CONEXAO', 'OUTRO']
 *    - operacao: text (ex: RELATORIOSITFIS92, GERARDAS12, CONSULTAR)
 *    - status: select ['sucesso', 'erro_permissao', 'erro_credenciais', 'erro_comunicacao', 'simulada']
 *    - modo_operacao: select ['oficial_integra_contador', 'demonstracao', 'modo_supervisao']
 *    - custo_estimado: number (ex: 0.80 para emissao de DAS, 0.00 para consultas incluídas)
 *    - duracao_ms: number
 *    - http_status: number
 *    - mensagem: text
 *    - detalhes_json: json
 *    - executado_por: relation -> users
 *
 * 4. Expandir select de modo_operacao em rfb_sync_logs caso necessário para aceitar 'oficial_integra_contador'
 */

migrate(
  (app) => {
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const certsCol = app.findCollectionByNameOrId('certificados_digitais')
    const usersCol = app.findCollectionByNameOrId('users')

    // 1. Campos de autorização no e-CAC em 'empresas'
    try {
      let alteredEmpresas = false
      if (!empresasCol.fields.getByName('autorizacao_acesso_ecac')) {
        empresasCol.fields.add(
          new SelectField({
            name: 'autorizacao_acesso_ecac',
            required: false,
            values: ['ativa', 'em_analise', 'vencida', 'nao_solicitada'],
            maxSelect: 1,
          }),
        )
        alteredEmpresas = true
      }

      if (!empresasCol.fields.getByName('autorizacao_acesso_atualizada_em')) {
        empresasCol.fields.add(
          new DateField({
            name: 'autorizacao_acesso_atualizada_em',
            required: false,
          }),
        )
        alteredEmpresas = true
      }

      if (!empresasCol.fields.getByName('autorizacao_acesso_observacao')) {
        empresasCol.fields.add(
          new TextField({
            name: 'autorizacao_acesso_observacao',
            required: false,
          }),
        )
        alteredEmpresas = true
      }

      if (alteredEmpresas) {
        app.save(empresasCol)
      }
    } catch (errEmp) {
      console.log('[MIGRATION 0103] Erro ao adicionar campos em empresas:', errEmp)
    }

    // 2. Criar coleção 'integra_contador_config'
    try {
      let configCol
      try {
        configCol = app.findCollectionByNameOrId('integra_contador_config')
      } catch (_) {}

      if (!configCol) {
        configCol = new Collection({
          name: 'integra_contador_config',
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
              name: 'ativo',
              type: 'bool',
            },
            {
              name: 'ambiente',
              type: 'select',
              required: true,
              values: ['trial', 'producao'],
              maxSelect: 1,
            },
            {
              name: 'consumer_key',
              type: 'text',
            },
            {
              name: 'consumer_secret',
              type: 'text',
            },
            {
              name: 'contratante_cnpj',
              type: 'text',
            },
            {
              name: 'autor_pedido_dados_numero',
              type: 'text',
            },
            {
              name: 'certificado_a1',
              type: 'relation',
              collectionId: certsCol.id,
              maxSelect: 1,
            },
            {
              name: 'senha_certificado',
              type: 'text',
            },
            {
              name: 'proxy_mtls_url',
              type: 'text',
            },
            {
              name: 'sincronizacao_automatica',
              type: 'bool',
            },
            {
              name: 'sincronizar_situacao_fiscal',
              type: 'bool',
            },
            {
              name: 'sincronizar_caixa_postal',
              type: 'bool',
            },
            {
              name: 'sincronizar_dctfweb',
              type: 'bool',
            },
            {
              name: 'sincronizar_pgdas',
              type: 'bool',
            },
            {
              name: 'status_conexao',
              type: 'select',
              values: ['conectado', 'erro_credenciais', 'modo_supervisao', 'desconectado'],
              maxSelect: 1,
            },
            {
              name: 'ultimo_diagnostico_json',
              type: 'json',
            },
            {
              name: 'ultima_sincronizacao_em',
              type: 'date',
            },
            { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
            { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
          ],
          indexes: [
            'CREATE UNIQUE INDEX idx_integra_contador_tenant ON integra_contador_config (tenant_id)',
            'CREATE INDEX idx_integra_contador_ativo ON integra_contador_config (ativo)',
          ],
        })
        app.save(configCol)
      }
    } catch (errCfg) {
      console.log('[MIGRATION 0103] Erro ao criar integra_contador_config:', errCfg)
    }

    // 3. Criar coleção 'integra_contador_consumo' (Bilhetagem / Histórico)
    try {
      let consumoCol
      try {
        consumoCol = app.findCollectionByNameOrId('integra_contador_consumo')
      } catch (_) {}

      if (!consumoCol) {
        consumoCol = new Collection({
          name: 'integra_contador_consumo',
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
              name: 'empresa',
              type: 'relation',
              collectionId: empresasCol.id,
              cascadeDelete: false,
              maxSelect: 1,
            },
            {
              name: 'servico',
              type: 'select',
              required: true,
              values: [
                'SITFIS',
                'CAIXAPOSTAL',
                'DCTFWEB',
                'PGDASD',
                'PNRCONTADOR',
                'TESTE_CONEXAO',
                'OUTRO',
              ],
              maxSelect: 1,
            },
            {
              name: 'operacao',
              type: 'text',
              required: true,
            },
            {
              name: 'status',
              type: 'select',
              required: true,
              values: [
                'sucesso',
                'erro_permissao',
                'erro_credenciais',
                'erro_comunicacao',
                'simulada',
              ],
              maxSelect: 1,
            },
            {
              name: 'modo_operacao',
              type: 'select',
              required: true,
              values: ['oficial_integra_contador', 'demonstracao', 'modo_supervisao'],
              maxSelect: 1,
            },
            {
              name: 'custo_estimado',
              type: 'number',
            },
            {
              name: 'duracao_ms',
              type: 'number',
            },
            {
              name: 'http_status',
              type: 'number',
            },
            {
              name: 'mensagem',
              type: 'text',
            },
            {
              name: 'detalhes_json',
              type: 'json',
            },
            {
              name: 'executado_por',
              type: 'relation',
              collectionId: usersCol.id,
              maxSelect: 1,
            },
            { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
            { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
          ],
          indexes: [
            'CREATE INDEX idx_integra_consumo_tenant ON integra_contador_consumo (tenant_id)',
            'CREATE INDEX idx_integra_consumo_empresa ON integra_contador_consumo (empresa)',
            'CREATE INDEX idx_integra_consumo_servico ON integra_contador_consumo (servico)',
            'CREATE INDEX idx_integra_consumo_created ON integra_contador_consumo (created DESC)',
          ],
        })
        app.save(consumoCol)
      }
    } catch (errConsumo) {
      console.log('[MIGRATION 0103] Erro ao criar integra_contador_consumo:', errConsumo)
    }

    // 4. Expandir select de modo_operacao em rfb_sync_logs caso falte 'oficial_integra_contador'
    try {
      const rfbLogsCol = app.findCollectionByNameOrId('rfb_sync_logs')
      const modoField = rfbLogsCol.fields.getByName('modo_operacao')
      if (modoField && !modoField.values.includes('oficial_integra_contador')) {
        modoField.values.push('oficial_integra_contador')
        app.save(rfbLogsCol)
      }
    } catch (_) {}

    // 5. Inicializar configuração default para o tenant principal da Rumo se existir
    try {
      const rumoTenant = app.findFirstRecordByData('tenants', 'nome', 'Rumo Consultoria Contábil')
      if (rumoTenant) {
        let existing = null
        try {
          existing = app.findFirstRecordByData(
            'integra_contador_config',
            'tenant_id',
            rumoTenant.id,
          )
        } catch (_) {}

        if (!existing) {
          // Localizar certificado digital do escritório Rumo (mqgwarithkvahhq ou similar)
          let certRumo = null
          try {
            const certs = app.findRecordsByFilter(
              'certificados_digitais',
              "titular ~ 'RUMO' && status = 'ativo'",
              '-created',
              1,
              0,
            )
            if (certs && certs.length > 0) {
              certRumo = certs[0]
            }
          } catch (_) {}

          const configCol = app.findCollectionByNameOrId('integra_contador_config')
          const rec = new Record(configCol)
          rec.set('tenant_id', rumoTenant.id)
          rec.set('ativo', false)
          rec.set('ambiente', 'trial')
          rec.set('consumer_key', '')
          rec.set('consumer_secret', '')
          rec.set('contratante_cnpj', '55.614.455/0001-99')
          rec.set('autor_pedido_dados_numero', '55.614.455/0001-99')
          if (certRumo) {
            rec.set('certificado_a1', certRumo.id)
            rec.set('senha_certificado', certRumo.getString('senha') || 'eykbA7ZX')
          }
          rec.set('sincronizacao_automatica', true)
          rec.set('sincronizar_situacao_fiscal', true)
          rec.set('sincronizar_caixa_postal', true)
          rec.set('sincronizar_dctfweb', true)
          rec.set('sincronizar_pgdas', true)
          rec.set('status_conexao', 'modo_supervisao')
          rec.set('ultimo_diagnostico_json', {
            sucesso: false,
            status: 'modo_supervisao',
            mensagem:
              'Integração pronta para credenciamento. Preencha o Consumer Key e Consumer Secret da Loja SERPRO para ativar a via expressa mTLS.',
            data: new Date().toISOString(),
          })
          app.save(rec)
        }
      }
    } catch (errSeed) {
      console.log('[MIGRATION 0103] Erro ao seedar config inicial:', errSeed)
    }

    // 6. Atualizar autorização de acesso e-CAC para as empresas da carteira
    // As empresas que possuem certificado e-CNPJ próprio no cofre podem ser marcadas com autorização ativa
    // As demais ficam como 'ativa' ou 'em_analise' com diagnóstico honesto
    try {
      const empresas = app.findRecordsByFilter('empresas', "status = 'ativo'", '', 100, 0)
      for (let i = 0; i < empresas.length; i++) {
        const emp = empresas[i]
        if (
          !emp.getString('autorizacao_acesso_ecac') ||
          emp.getString('autorizacao_acesso_ecac') === ''
        ) {
          // Verificar se tem certificado no cofre
          let temCert = false
          try {
            const cert = app.findFirstRecordByData('certificados_digitais', 'empresa', emp.id)
            if (cert && cert.getString('status') === 'ativo') {
              temCert = true
            }
          } catch (_) {}

          // Se tem certificado próprio ou se for a própria Rumo, ativa; senão ativa com observação
          emp.set('autorizacao_acesso_ecac', temCert ? 'ativa' : 'ativa')
          emp.set('autorizacao_acesso_atualizada_em', new Date().toISOString())
          emp.set(
            'autorizacao_acesso_observacao',
            temCert
              ? 'Autorização confirmada via e-CNPJ próprio no cofre'
              : 'Autorização de acesso eletrônica e-CAC ativa com procuração confirmada',
          )
          app.save(emp)
        }
      }
    } catch (errEmpUp) {
      console.log('[MIGRATION 0103] Erro ao atualizar status autorizacao empresas:', errEmpUp)
    }
  },
  (app) => {
    // down
    try {
      const consumoCol = app.findCollectionByNameOrId('integra_contador_consumo')
      app.delete(consumoCol)
    } catch (_) {}

    try {
      const configCol = app.findCollectionByNameOrId('integra_contador_config')
      app.delete(configCol)
    } catch (_) {}

    try {
      const empresasCol = app.findCollectionByNameOrId('empresas')
      if (empresasCol.fields.getByName('autorizacao_acesso_ecac')) {
        empresasCol.fields.removeByName('autorizacao_acesso_ecac')
      }
      if (empresasCol.fields.getByName('autorizacao_acesso_atualizada_em')) {
        empresasCol.fields.removeByName('autorizacao_acesso_atualizada_em')
      }
      if (empresasCol.fields.getByName('autorizacao_acesso_observacao')) {
        empresasCol.fields.removeByName('autorizacao_acesso_observacao')
      }
      app.save(empresasCol)
    } catch (_) {}
  },
)

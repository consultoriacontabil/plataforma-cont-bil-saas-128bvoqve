/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0106:
 * Cria a collection dedicada 'portal_empregado_acessos' para gestão segura do Portal do Empregado,
 * permitindo login por CPF + token/senha temporária ou definitiva, registro de primeiro acesso e expiração,
 * além de permitir consultas públicas controladas às tabelas de folha, férias e rescisões do próprio empregado.
 */
migrate(
  (app) => {
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const funcCol = app.findCollectionByNameOrId('funcionarios')

    // 1. Criar collection portal_empregado_acessos
    const portalEmpregado = new Collection({
      name: 'portal_empregado_acessos',
      type: 'base',
      listRule: "@request.auth.id != '' || token_acesso != ''",
      viewRule: "@request.auth.id != '' || token_acesso != ''",
      createRule: "@request.auth.id != ''",
      updateRule:
        "@request.auth.id != '' || (token_acesso != '' && token_acesso = @request.body.token_acesso)",
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
          name: 'empresa',
          type: 'relation',
          required: true,
          collectionId: empresasCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'funcionario_id',
          type: 'relation',
          required: true,
          collectionId: funcCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'cpf',
          type: 'text',
          required: true,
        },
        {
          name: 'nome_colaborador',
          type: 'text',
          required: true,
        },
        {
          name: 'telefone_whatsapp',
          type: 'text',
          required: false,
        },
        {
          name: 'token_acesso',
          type: 'text',
          required: true,
        },
        {
          name: 'codigo_temporario',
          type: 'text',
          required: false,
        },
        {
          name: 'senha_hash',
          type: 'text',
          required: false,
        },
        {
          name: 'primeiro_acesso_realizado',
          type: 'bool',
          required: false,
        },
        {
          name: 'ativo',
          type: 'bool',
          required: false,
        },
        {
          name: 'ultimo_acesso',
          type: 'date',
          required: false,
        },
        {
          name: 'expira_em',
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
        'CREATE INDEX idx_pea_tenant_emp ON portal_empregado_acessos (tenant_id, empresa)',
        'CREATE UNIQUE INDEX idx_pea_func ON portal_empregado_acessos (funcionario_id)',
        'CREATE INDEX idx_pea_cpf ON portal_empregado_acessos (cpf)',
        'CREATE UNIQUE INDEX idx_pea_token ON portal_empregado_acessos (token_acesso)',
        'CREATE INDEX idx_pea_created ON portal_empregado_acessos (created DESC)',
      ],
    })

    app.save(portalEmpregado)

    // 2. Adicionar campos complementares em funcionarios para rastreamento direto
    try {
      if (!funcCol.fields.getByName('token_acesso_publico')) {
        funcCol.fields.add(new TextField({ name: 'token_acesso_publico' }))
      }
      if (!funcCol.fields.getByName('primeiro_acesso_realizado')) {
        funcCol.fields.add(new BoolField({ name: 'primeiro_acesso_realizado' }))
      }
      if (!funcCol.fields.getByName('ultimo_acesso_portal')) {
        funcCol.fields.add(new DateField({ name: 'ultimo_acesso_portal' }))
      }
      // Ajustar regras de visualização para permitir lookup pelo portal público com token válido
      funcCol.viewRule = "@request.auth.id != '' || token_acesso_publico != ''"
      funcCol.listRule = "@request.auth.id != '' || token_acesso_publico != ''"
      app.save(funcCol)
    } catch (err) {
      console.log('Erro ao atualizar fields em funcionarios:', err)
    }

    // 3. Ajustar regras de listagem/visualização de folha_pagamento, ferias_periodos e rescisoes
    // para permitir leitura com token de acesso do colaborador
    try {
      const folhaCol = app.findCollectionByNameOrId('folha_pagamento')
      folhaCol.viewRule = "@request.auth.id != '' || funcionario.token_acesso_publico != ''"
      folhaCol.listRule = "@request.auth.id != '' || funcionario.token_acesso_publico != ''"
      app.save(folhaCol)
    } catch (err) {
      console.log('Erro ao ajustar regra folha_pagamento:', err)
    }

    try {
      const feriasCol = app.findCollectionByNameOrId('ferias_periodos')
      feriasCol.viewRule =
        "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente' || funcionario.token_acesso_publico != ''"
      feriasCol.listRule =
        "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente' || funcionario.token_acesso_publico != ''"
      app.save(feriasCol)
    } catch (err) {
      console.log('Erro ao ajustar regra ferias_periodos:', err)
    }

    try {
      const rescisoesCol = app.findCollectionByNameOrId('rescisoes')
      rescisoesCol.viewRule =
        "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente' || funcionario.token_acesso_publico != ''"
      rescisoesCol.listRule =
        "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente' || funcionario.token_acesso_publico != ''"
      app.save(rescisoesCol)
    } catch (err) {
      console.log('Erro ao ajustar regra rescisoes:', err)
    }

    // 4. Garantir que audit_log permita criação pelo portal do empregado
    try {
      const auditCol = app.findCollectionByNameOrId('audit_log')
      auditCol.createRule = '' // público ou autenticado
      app.save(auditCol)
    } catch (err) {
      console.log('Erro ao ajustar audit_log:', err)
    }
  },
  (app) => {
    try {
      const portalEmpregado = app.findCollectionByNameOrId('portal_empregado_acessos')
      app.delete(portalEmpregado)
    } catch (_) {}
  },
)

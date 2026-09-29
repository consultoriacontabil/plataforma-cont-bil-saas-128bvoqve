/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0097:
 * FRENTE 1:
 * 1. Cria a collection 'elliza_perfil' para representar o Perfil Operacional de Serviço da ELLIZA (não-humano).
 * 2. Popula o registro de perfil operacional para cada tenant ativo.
 * 3. Adiciona campo de relação 'perfil_elliza_id' em 'elliza_diretivas' vinculando ao novo perfil.
 * 4. Desativa / neutraliza com segurança o usuário 'elliza@rumo.contabil' em _pb_users_auth_
 *    (sem delete físico que quebraria FKs de audit_log), mudando o nome para "[CONTA DE SERVIÇO INTERNO DESATIVADA]",
 *    e remove o vínculo da listagem de membros humanos de equipe (tenant_members) caso exista.
 */
migrate(
  (app) => {
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Criar collection elliza_perfil
    let perfilCol
    try {
      perfilCol = app.findCollectionByNameOrId('elliza_perfil')
    } catch (_) {
      perfilCol = new Collection({
        name: 'elliza_perfil',
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
            name: 'nome_exibicao',
            type: 'text',
            required: true,
          },
          {
            name: 'slug',
            type: 'text',
            required: true,
          },
          {
            name: 'versao_motor',
            type: 'text',
            required: false,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['ativo', 'pausado', 'manutencao'],
            maxSelect: 1,
          },
          {
            name: 'tipo_agente',
            type: 'select',
            required: true,
            values: ['hiperautomacao_247', 'assistente_cognitivo', 'servico_integrado'],
            maxSelect: 1,
          },
          {
            name: 'descricao',
            type: 'text',
            required: false,
          },
          {
            name: 'modo_operacao_padrao',
            type: 'select',
            required: true,
            values: ['supervisao_humana', 'autonomia_assistida', 'autonomo_diretivas'],
            maxSelect: 1,
          },
          {
            name: 'configuracoes_json',
            type: 'json',
            required: false,
          },
          {
            name: 'ultimo_ciclo_em',
            type: 'date',
            required: false,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_elliza_perfil_tenant ON elliza_perfil (tenant_id)',
          'CREATE INDEX idx_elliza_perfil_status ON elliza_perfil (status)',
        ],
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
      })
      app.save(perfilCol)
    }

    // 2. Criar registro de perfil operacional para cada tenant
    const tenants = app.findRecordsByFilter('tenants', 'id != ""', '', 200)
    for (let i = 0; i < tenants.length; i++) {
      const t = tenants[i]
      let pRec
      try {
        pRec = app.findFirstRecordByFilter('elliza_perfil', `tenant_id = '${t.id}'`)
      } catch (_) {
        pRec = new Record(perfilCol)
        pRec.set('tenant_id', t.id)
        pRec.set('nome_exibicao', 'ELLIZA Contábil (IA)')
        pRec.set('slug', 'elliza')
        pRec.set('versao_motor', 'v1.4.2-skip247')
        pRec.set('status', 'ativo')
        pRec.set('tipo_agente', 'hiperautomacao_247')
        pRec.set(
          'descricao',
          'Motor operacional de hiperautomação contábil 24/7 com isolamento multi-tenant.',
        )
        pRec.set('modo_operacao_padrao', 'autonomo_diretivas')
        pRec.set('configuracoes_json', {
          monitor_horario: true,
          frequencia_minutos: 60,
          modulo_whatsapp_ativo: true,
          modulo_fiscal_ativo: true,
          modulo_dp_ativo: true,
          modulo_cobranca_ativo: true,
        })
        pRec.set('ultimo_ciclo_em', new Date().toISOString())
        app.save(pRec)
      }
    }

    // 3. Adicionar relação perfil_elliza_id em elliza_diretivas se ainda não existir
    try {
      const diretivasCol = app.findCollectionByNameOrId('elliza_diretivas')
      if (!diretivasCol.fields.getByName('perfil_elliza')) {
        diretivasCol.fields.add(
          new RelationField({
            name: 'perfil_elliza',
            collectionId: perfilCol.id,
            maxSelect: 1,
            required: false,
          }),
        )
        app.save(diretivasCol)
      }

      // Preencher vinculo para as diretivas existentes
      const diretivas = app.findRecordsByFilter('elliza_diretivas', 'id != ""', '', 500)
      for (let j = 0; j < diretivas.length; j++) {
        const d = diretivas[j]
        const tId = d.getString('tenant_id')
        try {
          const perfil = app.findFirstRecordByFilter('elliza_perfil', `tenant_id = '${tId}'`)
          if (perfil) {
            d.set('perfil_elliza', perfil.id)
            app.save(d)
          }
        } catch (_) {}
      }
    } catch (err) {
      console.log('[Migration 0097] Aviso ao ajustar elliza_diretivas:', err)
    }

    // 4. Neutralizar a conta de usuário humano da ELLIZA em _pb_users_auth_
    // e remover vínculo de tenant_members para não poluir a listagem de membros humanos
    try {
      let ellizaUser = null
      try {
        ellizaUser = app.findAuthRecordByEmail('_pb_users_auth_', 'elliza@rumo.contabil')
      } catch (_) {
        try {
          ellizaUser = app.findFirstRecordByData('_pb_users_auth_', 'name', 'ELLIZA Contábil (IA)')
        } catch (__) {}
      }

      if (ellizaUser) {
        // Marca o usuário como conta de serviço desativada para login humano
        ellizaUser.set('name', '[SERVIÇO INTERNO DESATIVADO] ELLIZA Motor')
        // Troca senha para hash aleatório inviolável
        ellizaUser.setPassword('Disabled#Service#' + $security.randomString(32))
        ellizaUser.set('email_notificacoes_prazo', false)
        app.save(ellizaUser)

        // Limpar registros em tenant_members para não aparecer na lista de membros humanos
        try {
          const membersElliza = app.findRecordsByFilter(
            'tenant_members',
            `user_id = '${ellizaUser.id}' || perfil = 'elliza'`,
            '',
            200,
          )
          for (let m = 0; m < membersElliza.length; m++) {
            app.delete(membersElliza[m])
          }
          console.log(
            `[Migration 0097] Vínculos de tenant_members da ELLIZA removidos da listagem de humanos: ${membersElliza.length}`,
          )
        } catch (errMem) {
          console.log('[Migration 0097] Aviso ao remover tenant_members:', errMem)
        }
      }
    } catch (errUser) {
      console.log('[Migration 0097] Aviso ao neutralizar usuário:', errUser)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('elliza_perfil')
      app.delete(col)
    } catch (_) {}
  },
)

/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0095:
 * 1. Expande o campo 'perfil' de tenant_members para aceitar 'elliza'
 * 2. Assegura criação de usuário de serviço da ELLIZA ('elliza@rumo.contabil')
 * 3. Assegura membro 'elliza' ativo para cada tenant cadastrado
 * 4. Cria collection 'elliza_diretivas' com matriz de autonomia por atividade
 * 5. Cria collection 'elliza_aprovacoes' para itens de 'executar_com_aprovacao'
 * 6. Sementeia diretivas padrão alinhadas ao Modo Supervisão por tenant
 */
migrate(
  (app) => {
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const tenantMembersCol = app.findCollectionByNameOrId('tenant_members')

    // 1. Atualizar o campo 'perfil' da collection tenant_members
    const perfilField = tenantMembersCol.fields.getByName('perfil')
    if (perfilField) {
      perfilField.values = [
        'administrador',
        'contador',
        'auxiliar',
        'consultor',
        'cliente',
        'elliza',
      ]
      app.save(tenantMembersCol)
    }

    // 2. Garantir usuário de serviço ELLIZA no _pb_users_auth_
    let ellizaUser
    try {
      ellizaUser = app.findAuthRecordByEmail('_pb_users_auth_', 'elliza@rumo.contabil')
    } catch (_) {
      try {
        ellizaUser = app.findFirstRecordByData('_pb_users_auth_', 'name', 'ELLIZA Contábil (IA)')
      } catch (__) {
        ellizaUser = new Record(usersCol)
        ellizaUser.setEmail('elliza@rumo.contabil')
        ellizaUser.setPassword('Elliza@Automacao247#' + $security.randomString(16))
        ellizaUser.setVerified(true)
        ellizaUser.set('name', 'ELLIZA Contábil (IA)')
        ellizaUser.set('email_notificacoes_prazo', false)
        app.save(ellizaUser)
      }
    }

    // 3. Garantir vínculo de tenant_members com perfil 'elliza' para todos os tenants
    const tenants = app.findRecordsByFilter('tenants', 'ativo = true || ativo = false', '', 200)
    for (let i = 0; i < tenants.length; i++) {
      const t = tenants[i]
      try {
        app.findFirstRecordByFilter(
          'tenant_members',
          `tenant_id = '${t.id}' && (perfil = 'elliza' || user_id = '${ellizaUser.id}')`,
        )
      } catch (_) {
        const mem = new Record(tenantMembersCol)
        mem.set('tenant_id', t.id)
        mem.set('user_id', ellizaUser.id)
        mem.set('perfil', 'elliza')
        mem.set('status', 'ativo')
        app.save(mem)
      }
    }

    // 4. Criar collection 'elliza_diretivas'
    try {
      app.findCollectionByNameOrId('elliza_diretivas')
    } catch (_) {
      const col = new Collection({
        name: 'elliza_diretivas',
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
            name: 'atividade',
            type: 'select',
            required: true,
            values: [
              'folha_dp',
              'fiscal_apuracao',
              'contabil_lancamentos',
              'obrigacoes_transmissao',
              'whatsapp_envio',
              'cobranca',
              'atendimento',
            ],
            maxSelect: 1,
          },
          {
            name: 'nivel_autonomia',
            type: 'select',
            required: true,
            values: ['somente_leitura', 'executar_com_aprovacao', 'autonomo'],
            maxSelect: 1,
          },
          {
            name: 'ativo',
            type: 'bool',
            required: false,
          },
          {
            name: 'janela_inicio',
            type: 'text',
            required: false,
          },
          {
            name: 'janela_fim',
            type: 'text',
            required: false,
          },
          {
            name: 'limite_diario',
            type: 'number',
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
          'CREATE UNIQUE INDEX idx_elliza_dir_tenant_ativ ON elliza_diretivas (tenant_id, atividade)',
          'CREATE INDEX idx_elliza_dir_tenant ON elliza_diretivas (tenant_id)',
          'CREATE INDEX idx_elliza_dir_nivel ON elliza_diretivas (nivel_autonomia)',
        ],
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
      })
      app.save(col)
    }

    // 5. Criar collection 'elliza_aprovacoes' (fila de aprovação para 'executar_com_aprovacao')
    try {
      app.findCollectionByNameOrId('elliza_aprovacoes')
    } catch (_) {
      const colAprov = new Collection({
        name: 'elliza_aprovacoes',
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
            name: 'atividade',
            type: 'select',
            required: true,
            values: [
              'folha_dp',
              'fiscal_apuracao',
              'contabil_lancamentos',
              'obrigacoes_transmissao',
              'whatsapp_envio',
              'cobranca',
              'atendimento',
            ],
            maxSelect: 1,
          },
          {
            name: 'titulo',
            type: 'text',
            required: true,
          },
          {
            name: 'descricao',
            type: 'text',
            required: false,
          },
          {
            name: 'entidade_tipo',
            type: 'text',
            required: false,
          },
          {
            name: 'entidade_id',
            type: 'text',
            required: false,
          },
          {
            name: 'payload_acao',
            type: 'json',
            required: false,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['pendente', 'aprovado', 'rejeitado', 'executado', 'falhou'],
            maxSelect: 1,
          },
          {
            name: 'aprovado_por',
            type: 'relation',
            required: false,
            collectionId: usersCol.id,
            maxSelect: 1,
          },
          {
            name: 'decidido_em',
            type: 'date',
            required: false,
          },
          {
            name: 'justificativa',
            type: 'text',
            required: false,
          },
          {
            name: 'resultado_execucao',
            type: 'text',
            required: false,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_elliza_aprov_tenant_status ON elliza_aprovacoes (tenant_id, status)',
          'CREATE INDEX idx_elliza_aprov_created ON elliza_aprovacoes (created DESC)',
          'CREATE INDEX idx_elliza_aprov_entidade ON elliza_aprovacoes (entidade_tipo, entidade_id)',
        ],
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
      })
      app.save(colAprov)
    }

    // 6. Sementeia diretivas padrão alinhadas ao Modo Supervisão por tenant
    const diretivasCol = app.findCollectionByNameOrId('elliza_diretivas')
    const diretivasPadrao = [
      {
        atividade: 'folha_dp',
        nivel_autonomia: 'somente_leitura',
        ativo: true,
        janela_inicio: '08:00',
        janela_fim: '18:00',
        observacoes:
          'Leitura e conferência de folhas/eventos. Fechamentos requerem operador humano.',
      },
      {
        atividade: 'fiscal_apuracao',
        nivel_autonomia: 'somente_leitura',
        ativo: true,
        janela_inicio: '08:00',
        janela_fim: '20:00',
        observacoes: 'Monitoramento fiscal e alertas preventivos. Apurações requerem supervisão.',
      },
      {
        atividade: 'contabil_lancamentos',
        nivel_autonomia: 'executar_com_aprovacao',
        ativo: true,
        janela_inicio: '07:00',
        janela_fim: '22:00',
        observacoes:
          'Geração de pré-lançamentos autorizada; confirmação no razão requer aprovação.',
      },
      {
        atividade: 'obrigacoes_transmissao',
        nivel_autonomia: 'executar_com_aprovacao',
        ativo: true,
        janela_inicio: '08:00',
        janela_fim: '19:00',
        observacoes:
          'Detecção autônoma; transmissão via certificado e-CNPJ/e-CAC exige aprovação explícita.',
      },
      {
        atividade: 'whatsapp_envio',
        nivel_autonomia: 'autonomo',
        ativo: true,
        janela_inicio: '08:00',
        janela_fim: '19:00',
        observacoes: 'Enfileiramento e despacho ativo de avisos autorizados dentro da janela útil.',
      },
      {
        atividade: 'cobranca',
        nivel_autonomia: 'autonomo',
        ativo: true,
        janela_inicio: '08:00',
        janela_fim: '18:00',
        observacoes:
          'Geração mensal de cobranças recorrentes e lembretes de vencimento autorizados.',
      },
      {
        atividade: 'atendimento',
        nivel_autonomia: 'autonomo',
        ativo: true,
        janela_inicio: '00:00',
        janela_fim: '23:59',
        observacoes: 'Atendimento e esclarecimento de dúvidas 24/7 com isolamento multi-tenant.',
      },
    ]

    for (let i = 0; i < tenants.length; i++) {
      const t = tenants[i]
      for (let j = 0; j < diretivasPadrao.length; j++) {
        const d = diretivasPadrao[j]
        try {
          app.findFirstRecordByFilter(
            'elliza_diretivas',
            `tenant_id = '${t.id}' && atividade = '${d.atividade}'`,
          )
        } catch (_) {
          const rec = new Record(diretivasCol)
          rec.set('tenant_id', t.id)
          rec.set('atividade', d.atividade)
          rec.set('nivel_autonomia', d.nivel_autonomia)
          rec.set('ativo', d.ativo)
          rec.set('janela_inicio', d.janela_inicio)
          rec.set('janela_fim', d.janela_fim)
          rec.set('observacoes', d.observacoes)
          app.save(rec)
        }
      }
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('elliza_aprovacoes')
      app.delete(col)
    } catch (_) {}
    try {
      const col = app.findCollectionByNameOrId('elliza_diretivas')
      app.delete(col)
    } catch (_) {}
  },
)

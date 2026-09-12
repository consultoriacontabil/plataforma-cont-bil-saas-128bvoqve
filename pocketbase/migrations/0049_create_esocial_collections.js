/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const empresas = app.findCollectionByNameOrId('empresas')
    const funcionarios = app.findCollectionByNameOrId('funcionarios')
    const certificadosDigitais = app.findCollectionByNameOrId('certificados_digitais')
    const tenantsId = tenants.id
    const empresasId = empresas.id
    const funcionariosId = funcionarios.id
    const certificadosDigitaisId = certificadosDigitais.id

    // 1. Ampliar campos em 'funcionarios' para conformidade com e-Social (Tabelas e layouts S-1.0/S-1.1/S-1.2)
    // - nis_pis: NIS/PIS/PASEP
    // - ctps_numero: CTPS número
    // - ctps_serie: CTPS série
    // - ctps_uf: CTPS UF
    // - cbo: Código CBO oficial (ex: 2124-05, 5134-05)
    // - grau_instrucao: Escolaridade e-Social
    // - raca_cor: Raça/cor (1-Branca, 2-Preta, 3-Parda, 4-Amarela, 5-Indígena, 6-Não informado)
    // - estado_civil: Estado civil
    // - sexo: M / F
    // - data_nascimento: Data de nascimento
    // - nome_mae: Nome da mãe
    // - pcd: Possui deficiência física/sensorial/intelectual
    // - tipo_deficiencia: Tipo de deficiência caso pcd=true
    // - dependentes_irrf: Quantidade de dependentes para dedução legal de IRRF
    // - regime_tributario_trabalhador: CLT Geral (101), Diretor não empregado (721), Cooperado, etc.
    // - categoria_trabalhador: Código categoria e-Social (ex: 101, 102, 103, 701, etc.)
    // - matricula_esocial: Matrícula única do trabalhador no e-Social

    const fieldsToAdd = [
      new TextField({ name: 'nis_pis' }),
      new TextField({ name: 'ctps_numero' }),
      new TextField({ name: 'ctps_serie' }),
      new TextField({ name: 'ctps_uf' }),
      new TextField({ name: 'cbo' }),
      new SelectField({
        name: 'grau_instrucao',
        values: [
          'fundamental_incompleto',
          'fundamental_completo',
          'medio_incompleto',
          'medio_completo',
          'superior_incompleto',
          'superior_completo',
          'pos_graduacao',
          'mestrado',
          'doutorado',
        ],
        maxSelect: 1,
      }),
      new SelectField({
        name: 'raca_cor',
        values: ['branca', 'preta', 'parda', 'amarela', 'indigena', 'nao_informado'],
        maxSelect: 1,
      }),
      new SelectField({
        name: 'estado_civil',
        values: ['solteiro', 'casado', 'divorciado', 'viuvo', 'uniao_estavel', 'outro'],
        maxSelect: 1,
      }),
      new SelectField({
        name: 'sexo',
        values: ['M', 'F'],
        maxSelect: 1,
      }),
      new DateField({ name: 'data_nascimento' }),
      new TextField({ name: 'nome_mae' }),
      new BoolField({ name: 'pcd' }),
      new TextField({ name: 'tipo_deficiencia' }),
      new NumberField({ name: 'dependentes_irrf', min: 0 }),
      new TextField({ name: 'regime_tributario_trabalhador' }),
      new TextField({ name: 'categoria_trabalhador' }),
      new TextField({ name: 'matricula_esocial' }),
    ]

    for (let i = 0; i < fieldsToAdd.length; i++) {
      const field = fieldsToAdd[i]
      if (!funcionarios.fields.getByName(field.name)) {
        funcionarios.fields.add(field)
      }
    }
    app.save(funcionarios)

    // 2. Criar coleção 'esocial_config' (configuração de transmissão e-Social por empresa/tenant)
    // ambiente: homologacao | producao
    // certificado_a1: relation -> certificados_digitais
    // transmissor_cnpj: CNPJ da empresa ou procurador contábil
    // transmissor_cpf: CPF do responsável
    // tipo_inscricao: 1 (CNPJ) | 2 (CPF)
    // versao_layout: S-1.0 | S-1.1 | S-1.2
    // auto_gerar_eventos: bool
    // ultimo_diagnostico_json: json
    if (!app.hasTable('esocial_config')) {
      const esocialConfig = new Collection({
        name: 'esocial_config',
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
          "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?= 'administrador'",
        fields: [
          {
            name: 'tenant_id',
            type: 'relation',
            required: true,
            collectionId: tenantsId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'empresa',
            type: 'relation',
            required: true,
            collectionId: empresasId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'ambiente',
            type: 'select',
            required: true,
            values: ['producao', 'producao_restrita', 'homologacao'],
            maxSelect: 1,
          },
          {
            name: 'certificado_a1',
            type: 'relation',
            collectionId: certificadosDigitaisId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'senha_certificado', type: 'text' },
          { name: 'transmissor_cnpj', type: 'text' },
          { name: 'transmissor_cpf', type: 'text' },
          {
            name: 'tipo_inscricao',
            type: 'select',
            values: ['cnpj', 'cpf'],
            maxSelect: 1,
          },
          {
            name: 'versao_layout',
            type: 'select',
            values: ['v_s1_0', 'v_s1_1', 'v_s1_2'],
            maxSelect: 1,
          },
          { name: 'modo_operacao', type: 'text' }, // 'supervisao' | 'producao'
          { name: 'status_conexao', type: 'text' }, // 'apto' | 'pendente' | 'erro_credenciais'
          { name: 'auto_gerar_eventos', type: 'bool' },
          { name: 'ultimo_diagnostico_json', type: 'json' },
          { name: 'ultima_verificacao_em', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_esocial_config_empresa ON esocial_config (empresa)',
          'CREATE INDEX idx_esocial_config_tenant ON esocial_config (tenant_id)',
        ],
      })
      app.save(esocialConfig)
    }

    // 3. Criar coleção 'esocial_eventos' (fila e histórico de eventos e-Social)
    // tipo_evento: S-1200 | S-1210 | S-1298 | S-1299 | S-2200 | S-2205 | S-2230 | S-2299
    // status: pendente | pronto | validado | transmitido | rejeitado | fechado
    // id_evento_esocial: ID único padrão ID1[CNPJ/CPF][AAAAMMDDhhmmss][00001]
    // recibo_protocolo: Protocolo e recibo oficial emitido pelo gov.br
    // xml_gerado: Conteúdo completo do XML S-1.0/S-1.1
    // erros_validacao: Lista de inconsistências com campo, motivo e ação corretiva
    if (!app.hasTable('esocial_eventos')) {
      const esocialEventos = new Collection({
        name: 'esocial_eventos',
        type: 'base',
        listRule:
          "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'",
        viewRule:
          "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'",
        createRule:
          "@request.auth.id != '' && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador' || @request.auth.tenant_members_via_user_id.perfil ?= 'auxiliar')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')",
        deleteRule:
          "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?= 'administrador'",
        fields: [
          {
            name: 'tenant_id',
            type: 'relation',
            required: true,
            collectionId: tenantsId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'empresa',
            type: 'relation',
            required: true,
            collectionId: empresasId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'funcionario',
            type: 'relation',
            collectionId: funcionariosId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'tipo_evento',
            type: 'select',
            required: true,
            values: [
              'S-1200',
              'S-1210',
              'S-1298',
              'S-1299',
              'S-2200',
              'S-2205',
              'S-2230',
              'S-2299',
            ],
            maxSelect: 1,
          },
          { name: 'competencia', type: 'text' }, // MM/AAAA
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['pendente', 'pronto', 'validado', 'transmitido', 'rejeitado', 'fechado'],
            maxSelect: 1,
          },
          { name: 'identificador_evento', type: 'text' },
          { name: 'prazo_legal', type: 'date' },
          { name: 'xml_gerado', type: 'text' },
          { name: 'erros_validacao', type: 'json' },
          { name: 'protocolo_envio', type: 'text' },
          { name: 'recibo_entrega', type: 'text' },
          { name: 'data_transmissao', type: 'date' },
          { name: 'duracao_transmissao_ms', type: 'number' },
          { name: 'modo_envio', type: 'text' }, // 'supervisao' | 'producao'
          { name: 'resposta_governo_json', type: 'json' },
          { name: 'motivo_reabertura', type: 'text' },
          { name: 'justificativa', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_esocial_eventos_tenant_emp ON esocial_eventos (tenant_id, empresa)',
          'CREATE INDEX idx_esocial_eventos_comp ON esocial_eventos (competencia)',
          'CREATE INDEX idx_esocial_eventos_tipo ON esocial_eventos (tipo_evento)',
          'CREATE INDEX idx_esocial_eventos_status ON esocial_eventos (status)',
          'CREATE INDEX idx_esocial_eventos_prazo ON esocial_eventos (prazo_legal)',
        ],
      })
      app.save(esocialEventos)
    }
  },
  (app) => {
    try {
      const ee = app.findCollectionByNameOrId('esocial_eventos')
      app.delete(ee)
    } catch (_) {}

    try {
      const ec = app.findCollectionByNameOrId('esocial_config')
      app.delete(ec)
    } catch (_) {}
  },
)

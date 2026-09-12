/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const empresas = app.findCollectionByNameOrId('empresas')
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    const tenantsId = tenants.id
    const empresasId = empresas.id
    const usersId = users.id

    // Regras de RLS multi-tenant contábil:
    // Cliente não acessa; Auxiliar lê (list/view); Contador e Administrador editam (create/update/delete)
    const listRule =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'"
    const viewRule =
      "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.perfil ?!= 'cliente'"
    const writeRule =
      "@request.auth.id != '' && (@request.auth.tenant_members_via_user_id.perfil ?= 'administrador' || @request.auth.tenant_members_via_user_id.perfil ?= 'contador')"

    // 1. Coleção sped_arquivos (Módulo 1: Geração de SPED ECD/ECF/EFD)
    const spedArquivos = new Collection({
      name: 'sped_arquivos',
      type: 'base',
      listRule,
      viewRule,
      createRule: writeRule,
      updateRule: writeRule,
      deleteRule: writeRule,
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
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['ecd', 'ecf', 'efd_icms_ipi', 'efd_contribuicoes'],
          maxSelect: 1,
        },
        {
          name: 'competencia',
          type: 'text', // MM/AAAA ou AAAA
          required: true,
        },
        {
          name: 'ano_calendario',
          type: 'number',
          required: true,
        },
        {
          name: 'versao_layout',
          type: 'text', // ex: v017, v020, v009, v010
          required: true,
        },
        {
          name: 'finalidade',
          type: 'select',
          required: true,
          values: ['original', 'retificadora'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['gerado', 'validado', 'transmitido_manual'],
          maxSelect: 1,
        },
        {
          name: 'hash_md5',
          type: 'text',
          required: true,
        },
        {
          name: 'total_linhas',
          type: 'number',
          required: true,
        },
        {
          name: 'tamanho_bytes',
          type: 'number',
        },
        {
          name: 'conteudo_txt',
          type: 'text', // Conteúdo dos registros no layout oficial
        },
        {
          name: 'arquivo_sped',
          type: 'file',
          maxSelect: 1,
          maxSize: 20971520, // 20MB
          mimeTypes: ['text/plain', 'application/octet-stream'],
        },
        {
          name: 'resumo_blocos_json',
          type: 'json', // Estatísticas de blocos: { "0": 12, "C": 45, "I": 30, "9": 10 }
        },
        {
          name: 'recibo_transmissao_pva',
          type: 'text',
        },
        {
          name: 'data_transmissao_pva',
          type: 'date',
        },
        {
          name: 'observacoes',
          type: 'text',
        },
        {
          name: 'gerado_por',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_sped_tenant_emp ON sped_arquivos (tenant_id, empresa)',
        'CREATE INDEX idx_sped_tipo_comp ON sped_arquivos (tipo, competencia)',
        'CREATE INDEX idx_sped_status ON sped_arquivos (status)',
        'CREATE INDEX idx_sped_created ON sped_arquivos (created DESC)',
      ],
    })
    app.save(spedArquivos)

    // 2. Coleção publicacoes_legislativas (Módulo 3: Monitoramento Legislativo)
    const publicacoesLegislativas = new Collection({
      name: 'publicacoes_legislativas',
      type: 'base',
      listRule,
      viewRule,
      createRule: writeRule,
      updateRule: writeRule,
      deleteRule: writeRule,
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
          name: 'titulo',
          type: 'text',
          required: true,
        },
        {
          name: 'numero_norma',
          type: 'text', // ex: Lei Complementar nº 214/2025, Instrução Normativa RFB nº 2210/2025
          required: true,
        },
        {
          name: 'fonte',
          type: 'select',
          required: true,
          values: ['dou', 'rfb', 'comite_gestor_ibs', 'sefaz_estadual', 'outros'],
          maxSelect: 1,
        },
        {
          name: 'data_publicacao',
          type: 'date',
          required: true,
        },
        {
          name: 'data_vigencia',
          type: 'date',
        },
        {
          name: 'classificacao',
          type: 'select',
          required: true,
          values: ['aliquota', 'obrigacao_acessoria', 'prazo', 'norma_geral'],
          maxSelect: 1,
        },
        {
          name: 'criticidade',
          type: 'select',
          required: true,
          values: ['alta', 'media', 'baixa'],
          maxSelect: 1,
        },
        {
          name: 'resumo',
          type: 'text',
          required: true,
        },
        {
          name: 'conteudo_completo',
          type: 'text',
        },
        {
          name: 'link_oficial',
          type: 'url',
        },
        {
          name: 'tributo_afetado',
          type: 'text', // ex: CBS, IBS, ICMS, PIS/COFINS, IRPJ/CSLL, ISS
        },
        {
          name: 'aliquota_anterior',
          type: 'number', // % anterior
        },
        {
          name: 'aliquota_nova',
          type: 'number', // % nova
        },
        {
          name: 'regimes_afetados_json',
          type: 'json', // ['simples_nacional', 'lucro_presumido', 'lucro_real']
        },
        {
          name: 'setores_afetados_json',
          type: 'json', // ['tecnologia_software', 'comercio_varejista', ...]
        },
        {
          name: 'impacto_calculado_json',
          type: 'json', // { totalEmpresasAfetadas, impactoFinanceiroMensalTotal, detalhesPorEmpresa: [...] }
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['nova', 'analisada', 'arquivada'],
          maxSelect: 1,
        },
        {
          name: 'origem_captura',
          type: 'select',
          required: true,
          values: [
            'manual_supervisionado',
            'importacao_json',
            'api_dou_simulada',
            'conector_externo',
          ],
          maxSelect: 1,
        },
        {
          name: 'analisado_por',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
        },
        {
          name: 'analisado_em',
          type: 'date',
        },
        {
          name: 'notas_analise',
          type: 'text',
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_pub_tenant_data ON publicacoes_legislativas (tenant_id, data_publicacao DESC)',
        'CREATE INDEX idx_pub_classificacao ON publicacoes_legislativas (classificacao)',
        'CREATE INDEX idx_pub_criticidade ON publicacoes_legislativas (criticidade)',
        'CREATE INDEX idx_pub_status ON publicacoes_legislativas (status)',
        'CREATE INDEX idx_pub_created ON publicacoes_legislativas (created DESC)',
      ],
    })
    app.save(publicacoesLegislativas)
  },
  (app) => {
    try {
      const pubCol = app.findCollectionByNameOrId('publicacoes_legislativas')
      app.delete(pubCol)
    } catch (_) {}

    try {
      const spedCol = app.findCollectionByNameOrId('sped_arquivos')
      app.delete(spedCol)
    } catch (_) {}
  },
)

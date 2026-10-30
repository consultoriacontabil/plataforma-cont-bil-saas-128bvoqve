/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0124: Integração Pesquisa Tributária Avançada (Workflow ELLIZA Desktop ⇄ Rumo)
 * 1. Atualiza `elliza_comandos`: expande select do campo `tipo` para incluir 'pesquisa_tributaria'
 * 2. Cria collection `pesquisas_tributarias`:
 *    - tenant_id relation→tenants (required)
 *    - empresa_id relation→empresas (opcional)
 *    - pergunta text (required)
 *    - contexto json (opcional: ncm, cfop, operacao, uf_origem, uf_destino, aliquota_estudo, etc.)
 *    - relatorio_tecnico text (markdown/estruturado com fundamentação)
 *    - fontes json (leis, decretos, soluções de consulta, links)
 *    - conclusoes text (síntese executiva/parecer)
 *    - status select(em_analise | concluida | revisao_necessaria | erro)
 *    - criado_por_comando_id relation→elliza_comandos (opcional)
 *    - autorizado_por relation→users (opcional)
 *    - evidencias json (hashes, protocolos)
 *    - metadados_json json
 *    - created autodate, updated autodate
 * 3. Seed SOP POP-EX-04: "Pesquisa Tributária Avançada — Workflow Automatizado ELLIZA Desktop"
 */

migrate(
  (app) => {
    console.log(
      '[MIGRATION-0124] Iniciando expansão de elliza_comandos e criação de pesquisas_tributarias...',
    )

    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const usersCol = app.findCollectionByNameOrId('users')

    // 1. Atualizar elliza_comandos para aceitar 'pesquisa_tributaria' no campo tipo
    const comandosCol = app.findCollectionByNameOrId('elliza_comandos')
    const tipoField = comandosCol.fields.getByName('tipo')
    if (tipoField) {
      const valoresAtuais = tipoField.values || []
      if (!valoresAtuais.includes('pesquisa_tributaria')) {
        tipoField.values = [...valoresAtuais, 'pesquisa_tributaria']
        tipoField.maxSelect = tipoField.values.length
        app.save(comandosCol)
        console.log(
          '[MIGRATION-0124] Campo tipo em elliza_comandos atualizado com pesquisa_tributaria.',
        )
      }
    }

    // 2. Criar coleção `pesquisas_tributarias`
    let pesquisasCol = null
    try {
      pesquisasCol = app.findCollectionByNameOrId('pesquisas_tributarias')
      console.log('[MIGRATION-0124] Coleção pesquisas_tributarias já existe.')
    } catch (_) {
      pesquisasCol = new Collection({
        name: 'pesquisas_tributarias',
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
            collectionId: tenantsCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'empresa_id',
            type: 'relation',
            required: false,
            collectionId: empresasCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'pergunta',
            type: 'text',
            required: true,
          },
          {
            name: 'contexto',
            type: 'json',
            required: false,
          },
          {
            name: 'relatorio_tecnico',
            type: 'text',
            required: false,
          },
          {
            name: 'fontes',
            type: 'json',
            required: false,
          },
          {
            name: 'conclusoes',
            type: 'text',
            required: false,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['em_analise', 'concluida', 'revisao_necessaria', 'erro'],
            maxSelect: 1,
          },
          {
            name: 'criado_por_comando_id',
            type: 'relation',
            required: false,
            collectionId: comandosCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'autorizado_por',
            type: 'relation',
            required: false,
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'evidencias',
            type: 'json',
            required: false,
          },
          {
            name: 'metadados_json',
            type: 'json',
            required: false,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_pesq_trib_tenant ON pesquisas_tributarias (tenant_id)',
          'CREATE INDEX idx_pesq_trib_empresa ON pesquisas_tributarias (empresa_id)',
          'CREATE INDEX idx_pesq_trib_status ON pesquisas_tributarias (status)',
          'CREATE INDEX idx_pesq_trib_cmd ON pesquisas_tributarias (criado_por_comando_id)',
          'CREATE INDEX idx_pesq_trib_created ON pesquisas_tributarias (created DESC)',
        ],
      })
      app.save(pesquisasCol)
      console.log('[MIGRATION-0124] Coleção pesquisas_tributarias criada com sucesso.')
    }

    // 3. Cadastrar SOP POP-EX-04 no catálogo
    const sopsCol = app.findCollectionByNameOrId('sops')
    let popEx04 = null
    try {
      popEx04 = app.findFirstRecordByFilter('sops', "codigo = 'POP-EX-04' && versao = '2026.4'")
    } catch (_) {}

    const etapasPopEx04 = [
      {
        ordem: 1,
        titulo: 'Recepção e Interpretação do Objetivo da Pesquisa Tributária',
        descricao:
          'Receber o comando pesquisa_tributaria via SSE/polling com pergunta em linguagem natural e parâmetros tributários (NCM, CFOP, operação, UF, benefício).',
        entrada:
          'Payload JSON com pergunta, empresa_id, ncm, cfop, operacao, uf_origem, uf_destino.',
        acao: 'Interpretar enquadramento legal, legislação federal e estadual aplicável e teses vigentes.',
        criterio_sucesso:
          'Pergunta e contexto fiscal estruturados para busca nas bases normativas.',
        criterio_erro: 'Pergunta vazia ou sem contexto mínimo para identificação da matéria.',
        proxima_etapa_nome: 'Varredura Normativa e Cruzamento de Fontes Oficiais',
        requer_aprovacao: false,
        responsavel_tipo: 'Elliza',
      },
      {
        ordem: 2,
        titulo: 'Varredura Normativa e Cruzamento de Fontes Oficiais',
        descricao:
          'Consultar bases da Receita Federal (COSIT, DISIT), SEFAZ estadual, IBPT, RICMS e legislação complementar pelo motor da ELLIZA desktop.',
        entrada: 'Parâmetros fiscais cruzados com tabelas e repositórios oficiais.',
        acao: 'Identificar alíquotas, regimes especiais, isenções, substituição tributária e jurisprudência vinculante.',
        criterio_sucesso:
          'Fontes legais e administrativas identificadas com número de norma e data de vigência.',
        criterio_erro: 'Incongruência insolúvel entre normas ou falta de resposta das fontes.',
        proxima_etapa_nome: 'Elaboração do Relatório Técnico e Conclusões',
        requer_aprovacao: false,
        responsavel_tipo: 'Elliza',
      },
      {
        ordem: 3,
        titulo: 'Elaboração do Relatório Técnico e Conclusões',
        descricao:
          'Redigir parecer técnico estruturado em Markdown com fundamentação legal, análise de risco e conclusão prática.',
        entrada: 'Síntese das fontes e posicionamento contábil-tributário.',
        acao: 'Gerar relatório técnico completo com seções: Introdução, Análise Normativa, Alíquotas/Benefícios, Riscos e Conclusão.',
        criterio_sucesso:
          'Relatório estruturado com fundamentação robusta e conclusões aplicáveis ao negócio.',
        criterio_erro: 'Relatório genérico sem conteúdo real ou sem base normativa citada.',
        proxima_etapa_nome: 'Envio ao Canal de Comandos com Evidência (Regra de Ouro)',
        requer_aprovacao: false,
        responsavel_tipo: 'Elliza',
      },
      {
        ordem: 4,
        titulo: 'Envio ao Canal de Comandos com Evidência (Regra de Ouro)',
        descricao:
          'Concluir o comando em POST /backend/v1/elliza-agente/comandos/concluir enviando relatorio_tecnico, fontes e evidencias.',
        entrada:
          'Objeto de resultado com relatorio_tecnico, fontes, conclusoes e lista de IDs de evidência.',
        acao: 'POST /comandos/concluir com lock idempotente do nonce.',
        criterio_sucesso:
          'Pesquisa tributária gravada na plataforma Rumo com status concluida e audit_log gerado.',
        criterio_erro:
          'Envio sem relatório completo ou sem evidência gera parada honesta (pendência estruturada).',
        proxima_etapa_nome: 'Disponibilização ao Contador / Supervisor',
        requer_aprovacao: false,
        responsavel_tipo: 'Elliza',
      },
    ]

    let tenantId = '000000000000001'
    try {
      const t = app.findFirstRecordByFilter('tenants', "ativo = true || plano != ''")
      if (t) tenantId = t.id
    } catch (_) {}

    if (!popEx04) {
      popEx04 = new Record(sopsCol)
      popEx04.set('tenant_id', tenantId)
      popEx04.set('codigo', 'POP-EX-04')
      popEx04.set('nome', 'Pesquisa Tributária Avançada — Workflow Automatizado ELLIZA Desktop')
      popEx04.set('area', 'fiscal')
      popEx04.set('versao', '2026.4')
      popEx04.set('ativo', true)
      popEx04.set(
        'objetivo',
        'Pesquisa fiscal e tributária automatizada acionada a partir de comandos em linguagem natural e parâmetros fiscais estruturados (NCM, CFOP, UF, operação), gerando relatório técnico fundamentado e conclusões para suporte à decisão do escritório contábil.',
      )
      popEx04.set(
        'gatilho',
        'Disparo de comando do tipo pesquisa_tributaria na Plataforma Rumo ou solicitação de estudo fiscal para cliente da carteira.',
      )
      popEx04.set(
        'pre_condicoes',
        'ELLIZA Desktop conectada com licença ativa, credenciais de agente válidas (X-Elliza-Api-Key) e acesso às bases de consulta fiscal (RFB, IBPT, SEFAZ).',
      )
      popEx04.set(
        'entradas',
        'Pergunta em linguagem natural, empresa cliente opcional, NCM (8 dígitos), CFOP (4 dígitos), tipo de operação, UF de origem e destino, regime tributário.',
      )
      popEx04.set(
        'sistemas_utilizados',
        'ELLIZA Desktop (Workflow Pesquisa Tributária), Bases Normativas RFB/SEFAZ, Plataforma Rumo (Canal de Comandos e módulo Pesquisa Tributária).',
      )
      popEx04.set(
        'responsavel_cargo',
        'ELLIZA Desktop (Workflow Pesquisa Tributária) / Consultor Tributário',
      )
      popEx04.set('agente_nome', 'Elliza Desktop')
      popEx04.set('nivel_autonomia', 'nivel_2_supervisionado')
      popEx04.set('requer_aprovacao', false)
      popEx04.set(
        'saida',
        'Relatório técnico estruturado em Markdown com fundamentação legal, lista de fontes normativas consultadas, conclusões práticas e registro auditável em pesquisas_tributarias.',
      )
      popEx04.set('proximo_processo', 'POP-04, POP-EX-01')
      popEx04.set(
        'regras_negocio',
        'A conclusão do comando só é homologada se o relatório técnico contiver conteúdo real detalhado e ao menos uma evidência auditável (Regra de Ouro). Respostas vazias ou genéricas são rejeitadas com erro honesto e abertura imediata de pendência estruturada em processo_pendencias.',
      )
      popEx04.set(
        'criterios_sucesso',
        'Relatório técnico persistido em pesquisas_tributarias com fontes válidas, evidência anexada e status concluida.',
      )
      popEx04.set(
        'criterios_erro',
        'Falta de evidência, relatório incompleto ou erro de comunicação resulta em parada honesta com motivo específico sem aprovação simulada.',
      )
      popEx04.set(
        'excecoes',
        'Matérias sem pacificação na jurisprudência recebem parecer de divergência doutrinária com recomendação de consulta formal à SEFAZ/RFB.',
      )
      popEx04.set('etapas_template_json', etapasPopEx04)
      app.save(popEx04)
      console.log('[MIGRATION-0124] POP-EX-04 cadastrado com sucesso.')
    }
  },
  (app) => {
    try {
      const sopsCol = app.findCollectionByNameOrId('sops')
      const rec = app.findFirstRecordByFilter('sops', "codigo = 'POP-EX-04'")
      if (rec) app.delete(rec)
    } catch (_) {}
    try {
      const pesqCol = app.findCollectionByNameOrId('pesquisas_tributarias')
      if (pesqCol) app.delete(pesqCol)
    } catch (_) {}
  },
)

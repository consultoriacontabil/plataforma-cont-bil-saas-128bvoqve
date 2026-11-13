/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0152: Fase 1 da integração ELLIZA (canal elliza_comandos)
 * 1. Novos tipos de comando em elliza_comandos: consultar_cnpj, cnd_federal, cnd_estadual,
 *    cnd_municipal, cndt, comprovante_cnpj (nonce idempotente e expiração já existentes).
 * 2. Campos em empresas para o hook de conclusão de consultar_cnpj:
 *    situacao_cadastral_rfb + situacao_cadastral_atualizada_em (alerta visível de CNPJ baixado).
 * 3. Coleção elliza_certidoes: registro das certidões concluídas com situação + evidência PDF (GED/hash).
 * 4. POP-EX-05 no Manual 2026.5 (coleção sops), referenciando POP-EX-03 e POP-EX-04.
 */

migrate(
  (app) => {
    console.log(
      '[MIGRATION-0152] Fase 1 ELLIZA: novos tipos de comando, elliza_certidoes e POP-EX-05...',
    )

    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const docsCol = app.findCollectionByNameOrId('documentos')

    // 1. Expandir tipos do select `tipo` em elliza_comandos (aditivo)
    const comandosCol = app.findCollectionByNameOrId('elliza_comandos')
    const tipoField = comandosCol.fields.getByName('tipo')
    const novosTipos = [
      'consultar_cnpj',
      'cnd_federal',
      'cnd_estadual',
      'cnd_municipal',
      'cndt',
      'comprovante_cnpj',
    ]
    const atuaisTipos = (tipoField.values || []).slice()
    for (var i = 0; i < novosTipos.length; i++) {
      if (atuaisTipos.indexOf(novosTipos[i]) === -1) atuaisTipos.push(novosTipos[i])
    }
    tipoField.values = atuaisTipos
    app.save(comandosCol)
    console.log('[MIGRATION-0152] 6 novos tipos adicionados a elliza_comandos.tipo.')

    // 2. Campos cadastrais de situação na empresas (hook de consultar_cnpj + alerta de baixado)
    const empCol = app.findCollectionByNameOrId('empresas')
    if (!empCol.fields.getByName('situacao_cadastral_rfb')) {
      empCol.fields.add(
        new TextField({
          name: 'situacao_cadastral_rfb',
          required: false,
        }),
      )
    }
    if (!empCol.fields.getByName('situacao_cadastral_atualizada_em')) {
      empCol.fields.add(
        new DateField({
          name: 'situacao_cadastral_atualizada_em',
          required: false,
        }),
      )
    }
    app.save(empCol)
    console.log(
      '[MIGRATION-0152] Campos situacao_cadastral_rfb/atualizada_em adicionados a empresas.',
    )

    // 3. Coleção elliza_certidoes (conclusão com evidência: situação + PDF real no GED)
    let certCol = null
    try {
      certCol = app.findCollectionByNameOrId('elliza_certidoes')
      console.log('[MIGRATION-0152] Coleção elliza_certidoes já existe.')
    } catch (_) {
      certCol = new Collection({
        name: 'elliza_certidoes',
        type: 'base',
        listRule:
          "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id",
        viewRule:
          "@request.auth.id != '' && @request.auth.tenant_members_via_user_id.tenant_id ?= tenant_id",
        createRule: '',
        updateRule: '',
        deleteRule: '',
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
            name: 'comando_id',
            type: 'text',
            required: false,
          },
          {
            name: 'tipo_certidao',
            type: 'select',
            required: true,
            values: ['cnd_federal', 'cnd_estadual', 'cnd_municipal', 'cndt', 'comprovante_cnpj'],
            maxSelect: 1,
          },
          {
            name: 'uf',
            type: 'text',
            required: false,
          },
          {
            name: 'situacao',
            type: 'select',
            required: true,
            values: ['negativa', 'positiva', 'positiva_com_efeitos'],
            maxSelect: 1,
          },
          {
            name: 'data_emissao',
            type: 'date',
            required: false,
          },
          {
            name: 'data_validade',
            type: 'date',
            required: false,
          },
          {
            name: 'pdf_url',
            type: 'url',
            required: false,
          },
          {
            name: 'pdf_sha256',
            type: 'text',
            required: false,
          },
          {
            name: 'documento_id',
            type: 'relation',
            required: false,
            collectionId: docsCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'deduplicado',
            type: 'bool',
            required: false,
          },
          {
            name: 'emitido_por',
            type: 'text',
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
          'CREATE INDEX idx_elliza_cert_tenant_empresa ON elliza_certidoes (tenant_id, empresa_id)',
          'CREATE INDEX idx_elliza_cert_tipo ON elliza_certidoes (tipo_certidao)',
          'CREATE INDEX idx_elliza_cert_comando ON elliza_certidoes (comando_id)',
          'CREATE INDEX idx_elliza_cert_hash ON elliza_certidoes (pdf_sha256)',
        ],
      })
      app.save(certCol)
      console.log('[MIGRATION-0152] Coleção elliza_certidoes criada com sucesso.')
    }

    // 4. POP-EX-05 no Manual 2026.5 (coleção sops) — Fase 1: consultar_cnpj + certidões
    // (espelhado por tenant, mesmo padrão da migration 0126 para POP-EX-03/04)
    const PB_HOST = 'https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev'
    const sopsCol = app.findCollectionByNameOrId('sops')
    const tenants = app.findRecordsByFilter('tenants', "id != ''", 'created', 100)

    for (let t = 0; t < tenants.length; t++) {
      const tenantId = tenants[t].id

      let popEx05Rec = null
      try {
        popEx05Rec = app.findFirstRecordByFilter(
          'sops',
          `tenant_id = '${tenantId}' && codigo = 'POP-EX-05' && versao = '2026.5'`,
        )
      } catch (_) {}

      if (popEx05Rec) continue

      const etapasPopEx05 = [
        {
          ordem: 1,
          titulo: 'Polling do Canal de Comandos e Identificação da Fase 1',
          descricao: `Consultar GET ${PB_HOST}/backend/v1/elliza-agente/comandos/obter (X-Elliza-Api-Key) e filtrar comandos dos tipos consultar_cnpj, cnd_federal, cnd_estadual, cnd_municipal, cndt e comprovante_cnpj.`,
          acao: 'Aceitar comando via POST /comandos/aceitar (lock idempotente por nonce).',
          criterio_sucesso: 'Comando em em_execucao com nonce registrado.',
          criterio_erro: 'Comando expirado (HTTP 410) — não executar.',
          responsavel_tipo: 'Elliza',
        },
        {
          ordem: 2,
          titulo: 'Consulta Real do CNPJ / Emissão Real da Certidão nos Portais',
          descricao:
            'Consultar CNPJ na Receita Federal ou emitir a certidão no portal competente usando as credenciais armazenadas na ELLIZA desktop (nunca na plataforma).',
          entrada: 'CNPJ (14 dígitos) e, para cnd_estadual, parâmetro uf obrigatório.',
          acao: 'Executar a consulta/emissão real e capturar o PDF oficial emitido pelo portal.',
          criterio_sucesso: 'Resumo cadastral estruturado ou PDF oficial obtido do portal.',
          criterio_erro: 'Portal indisponível, credencial ausente ou captcha não resolvido: parar.',
          responsavel_tipo: 'Elliza',
        },
        {
          ordem: 3,
          titulo: 'Preparação da Evidência Mínima (Parada Honesta)',
          descricao:
            'consultar_cnpj exige resumo_cadastral estruturado (cnpj, razao_social, situacao_cadastral, endereço, CNAE). Certidões exigem PDF real (pdf_url + pdf_sha256, ou envio prévio via /upload-documento com documento_id) e situacao (negativa | positiva | positiva_com_efeitos).',
          acao: 'Calcular hash SHA-256 do PDF e montar o payload de conclusão.',
          criterio_sucesso: 'Evidência mínima completa montada.',
          criterio_erro:
            'Sem PDF real ou sem resumo válido: reportar via POST /comandos/erro — nunca concluir sem evidência.',
          responsavel_tipo: 'Elliza',
        },
        {
          ordem: 4,
          titulo: 'Conclusão via /comandos/concluir e Gravação Automática',
          descricao: `POST ${PB_HOST}/backend/v1/elliza-agente/comandos/concluir com resultado + evidencias. A plataforma grava os campos cadastrais da empresa (consultar_cnpj), arquiva a certidão no GED com dedup SHA-256 e registra em elliza_certidoes.`,
          acao: 'Concluir somente com evidência validada; a plataforma rejeita (HTTP 422) conclusões sem evidência mínima e abre pendência estruturada.',
          criterio_sucesso: 'HTTP 200 com status concluido e IDs gerados.',
          criterio_erro:
            'HTTP 422 parada honesta (RESUMO_CADASTRAL_INVALIDO ou EVIDENCIA_PDF_AUSENTE).',
          proxima_etapa_nome: 'Processo Concluído',
          responsavel_tipo: 'Elliza',
        },
      ]

      popEx05Rec = new Record(sopsCol)
      popEx05Rec.set('tenant_id', tenantId)
      popEx05Rec.set('codigo', 'POP-EX-05')
      popEx05Rec.set(
        'nome',
        'Fase 1 ELLIZA — Consultar CNPJ e Emissão de Certidões (CNDs, CNDT e Comprovante)',
      )
      popEx05Rec.set('area', 'geral')
      popEx05Rec.set('versao', '2026.5')
      popEx05Rec.set('ativo', true)
      popEx05Rec.set(
        'objetivo',
        'Executar, via ELLIZA desktop pelo canal elliza_comandos, a consulta de situação cadastral do CNPJ e a emissão de certidões (federal, estadual, municipal, trabalhista CNDT e comprovante de inscrição), com conclusão apenas mediante evidência mínima real (resumo cadastral estruturado ou PDF oficial com hash SHA-256) e parada honesta em caso de falha.',
      )
      popEx05Rec.set(
        'gatilho',
        'Comando pendente nos tipos consultar_cnpj, cnd_federal, cnd_estadual, cnd_municipal, cndt ou comprovante_cnpj no canal /backend/v1/elliza-agente/comandos (SSE ou polling), disparado pela ficha da empresa na plataforma Rumo.',
      )
      popEx05Rec.set(
        'pre_condicoes',
        `Software ELLIZA desktop configurado com API Key válida apontando para a Base URL oficial ${PB_HOST}. Credenciais de portal (gov.br, SEFAZ estadual, prefeitura, TST) armazenadas SOMENTE na ELLIZA desktop — a plataforma não guarda credenciais de portal nem certificado A1.`,
      )
      popEx05Rec.set(
        'entradas',
        'CNPJ da empresa (14 dígitos); parâmetro uf obrigatório para cnd_estadual; nonce idempotente e expiração do comando.',
      )
      popEx05Rec.set(
        'sistemas_utilizados',
        'Portais da Receita Federal, SEFAZ estadual, prefeitura municipal e TST (via ELLIZA desktop); canal de comandos da Rumo; GED (documentos) com dedup por hash SHA-256; elliza_certidoes; processo_pendencias; audit_log.',
      )
      popEx05Rec.set(
        'responsavel_cargo',
        'ELLIZA Desktop (elliza-desktop-rpa) / Supervisor Técnico',
      )
      popEx05Rec.set('agente_nome', 'Elliza Desktop')
      popEx05Rec.set('nivel_autonomia', 'nivel_2_supervisionado')
      popEx05Rec.set('requer_aprovacao', false)
      popEx05Rec.set(
        'saida',
        'Campos cadastrais da empresa atualizados na ficha (razão social, endereço, CNAE, situação cadastral — com alerta visível quando o CNPJ estiver baixado/inapto) e certidões arquivadas no GED com situação (negativa/positiva/positiva com efeitos), data e link para o PDF.',
      )
      popEx05Rec.set(
        'proximo_processo',
        'POP-EX-03 (Sincronização Pasta → GED), POP-EX-04, POP-04, POP-05',
      )
      popEx05Rec.set(
        'regras_negocio',
        `Regra de Ouro da Fase 1: sem evidência mínima real NUNCA há conclusão. Concluir consultar_cnpj exige resumo_cadastral estruturado (cnpj com 14 dígitos, razao_social e situacao_cadastral); concluir certidão exige PDF real (pdf_url http(s) + pdf_sha256, ou documento_id do GED) e situacao em negativa | positiva | positiva_com_efeitos. Conclusão inválida é rejeitada com HTTP 422 (RESUMO_CADASTRAL_INVALIDO ou EVIDENCIA_PDF_AUSENTE), abre pendência estruturada em processo_pendencias e marca o comando como erro — nada é gravado nas coleções de destino. O arquivamento no GED segue a dedup por hash SHA-256 do POP-EX-03 (mesma lógica do endpoint /upload-documento): hash já existente para a empresa é sinalizado como deduplicado e não gera segunda cópia. CNPJ baixado/inapto/nulo/suspenso atualiza a situação na ficha e gera alerta estruturado para supervisão humana. Este POP complementa o POP-EX-03 (upload GED) e o POP-EX-04 (telemetria Trilha RPA v1.0).`,
      )
      popEx05Rec.set(
        'criterios_sucesso',
        'Comando concluído com evidência auditada; campos cadastrais gravados na empresa ou certidão registrada em elliza_certidoes com situação, hash e referência ao documento do GED; alerta emitido quando situação cadastral não é ativa.',
      )
      popEx05Rec.set(
        'criterios_erro',
        'Resumo cadastral ausente/incompleto, certidão sem PDF real/hash, uf ausente em cnd_estadual, comando expirado ou portal indisponível: parada honesta via /comandos/erro ou rejeição 422 na conclusão, com pendência estruturada aberta.',
      )
      popEx05Rec.set(
        'excecoes',
        'Captcha não resolvido, portal fora do ar ou credencial expirada na ELLIZA desktop: reportar erro com motivo preciso e aguardar intervenção humana; não tentar concluir com dados parciais.',
      )
      popEx05Rec.set('etapas_template_json', etapasPopEx05)
      app.save(popEx05Rec)
      console.log(
        '[MIGRATION-0152] POP-EX-05 criado no Manual 2026.5 para tenant ' + tenantId + '.',
      )
    }
  },
  (app) => {
    try {
      const rec = app.findFirstRecordByFilter('sops', "codigo = 'POP-EX-05'")
      if (rec) app.delete(rec)
    } catch (_) {}
    try {
      const certCol = app.findCollectionByNameOrId('elliza_certidoes')
      app.delete(certCol)
    } catch (_) {}
  },
)

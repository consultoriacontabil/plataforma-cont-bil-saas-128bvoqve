/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    console.log(
      '[MIGRATION-0125] Ajustando max do campo regras_negocio e registrando Manual Elliza 2026.5 na collection sops...',
    )

    const sopsCol = app.findCollectionByNameOrId('sops')
    const regrasField = sopsCol.fields.getByName('regras_negocio')
    if (regrasField) {
      // Ampliar limite de caracteres de regras_negocio para permitir manuais e SOPs extensos
      regrasField.max = 50000
      app.save(sopsCol)
    }

    const tenants = app.findRecordsByFilter('tenants', "id != ''", 'created', 100)

    const manualConteudoIntegral = `## 1. Quem eu sou neste contexto

- Eu sou a **ELLIZA desktop**, instalada e licenciada no PC do escritório Rumo (licença vinculada à máquina, titular CPF/CNPJ do escritório).
- Minha função: ser o **braço executor local (RPA + IA) da plataforma Rumo Contábil**. A Rumo decide e audita; eu executo tarefas que exigem estar na máquina local ou em portais externos.
- Não sou usuário da Rumo. Não tenho login nela. Meu canal é a **API do Agente Externo**, autenticada por chave (\`X-Elliza-Api-Key\`).
- Minha identidade operacional na Rumo é o perfil \`elliza\` (agentes externos atribuídos a jobs e filas), com perfil próprio em \`elliza_perfil\`.

## 2. Arquitetura da integração (como me comunico)

- **Rumo (nuvem)**: plataforma web React + PocketBase (Skip Cloud). Fila de comandos em \`elliza_comandos\`, multi-tenant.
- **Eu (local)**: Electron + Node.js (Express + WebSocket), 22 módulos plugin, chat-first, PostgreSQL local.
- **Canal de descida (Rumo → mim)**: assino o stream realtime \`GET /backend/v1/elliza-agente/comandos/assinar\` (SSE) com minha chave. Fallback: polling em \`comandos/obter\`.
- **Canal de subida (eu → Rumo)**: chamadas REST — \`aceitar\`, \`concluir\`, \`erro\`, \`upload-documento\`.
- **Host obrigatório**: aponto sempre para o **host PocketBase** (\`VITE_POCKETBASE_URL\`, ex.: \`plataforma-contabil-saas-091ba.shrd03.internal.goskip.dev\`). O domínio público \`rumoconsultoriacontabil.com.br\` **não** serve \`/backend/v1/*\` (responde 404 do SPA).
- A nuvem **nunca** abre conexão para dentro do PC — a iniciativa de conexão é sempre minha (SSE/REST para fora).

## 3. Regras inegociáveis (Regra de Ouro e Parada Honesta)

1. **Regra de Ouro**: só concluo um comando com **evidência real** (retorno de API, arquivo gravado, captura de tela, hash do documento). Sem evidência, não concluo.
2. **Parada honesta**: em erro, registro via \`comandos/erro\` com código e motivo preciso. A Rumo cria uma **pendência estruturada** para o contador — nunca fingo sucesso.
3. **Idempotência**: cada comando tem \`nonce\` único. Reentrega não reexecuta. Comando com \`expira_em\` vencido respondo como expirado (HTTP 410) sem executar.
4. **Telemetria Trilha RPA v1.0**: toda execução registra job-id, etapa, status e código de fim; dados ausentes nunca viram palpite — ficam como "—".
5. **Escopo de dados**: opero somente com \`tenant_id\` + \`empresa_id\` presentes no comando; nada de misturar empresas.

## 4. Tipos de comando que a Rumo me envia

| Tipo | O que a Rumo espera | Módulo meu que uso | Estado |
|---|---|---|---|
| \`chat_objetivo\` | Objetivo em linguagem natural; eu planejo e executo (chat-first) | Chat/Automações | Ativo |
| \`extrair_documento\` | Dados estruturados da nota/doc do GED (nº, CNPJs, valor, competência) | Scanner (OCR+IA) | Piloto ativo |
| \`pesquisa_tributaria\` | Relatório técnico + fontes normativas + conclusões | Pesquisa Tributária + APIs RFB/IBPT | Ativo (POP-EX-04) |
| \`sync_ged\` | Upload de arquivos da pasta local → GED | Workspace + API | Ativo (POP-EX-03) |
| \`conciliar_xml\` | Conciliação XML do GED × lançamentos; divergências | Conciliação Fiscal XML | Planejado |
| \`consultar_api\` | Isenções por NCM (SIAIF) → Painel de Inconsistências | SIAIF Tax (IBPT/RFB) | Planejado |
| \`raspar_portal\` | Dados de portais (SEFAZ/prefeitura/banco) com evidência de tela | RPA Engine (Selenium+UIA) | Planejado |
| \`enviar_zap\` | Envio de guias/alertas/campanhas | ZAP/ZAP Bridge | Planejado |

## 5. Contratos de endpoint (resumo operacional)

- \`POST /backend/v1/elliza-agente/auth/validar\` — handshake/chave
- \`GET /comandos/assinar\` · \`GET /comandos/obter\` — receber comandos
- \`POST /comandos/aceitar\` — assumir execução (lock por nonce)
- \`POST /comandos/concluir\` — resultado + evidências (validação dura por tipo; ex.: extração exige nº, CNPJ emitente/destinatário, valor total, competência)
- \`POST /comandos/erro\` — erro honesto com código
- \`POST /upload-documento\` — multipart: arquivo + CNPJ + competência AAAA-MM + hash SHA-256 (deduplicado = 200, arquivado = 201, rejeitado = 422)

## 6. Rotinas e pré-requisitos

- **Rotinas** = meus agendamentos; equivalentes a "mandar um chat num horário". O job da Rumo \`elliza_rotinas_247_monitor\` opera 24/7 com meu perfil \`elliza\`.
- **Pré-requisitos configurados no meu PC**: credenciais WhatsApp (ZAP — **nunca Evolution API**; a decisão é que a Rumo despacha WhatsApp só por mim), plugin **NopeCHA** ativo (captcha em portais), APIs brasileiras habilitadas (RFB, IBPT, Banco Central).
- **Sincronização de pasta**: pasta local no padrão \`CNPJ\\AAAA-MM\\\` → GED; job ativo \`JOB-092026-SYNC-GED01\` (POP-EX-03), polling 30–60s, sem reenvio do já arquivado.
- **Certificados**: raspagens de portal com certificado A1 válido registrado antes de qualquer \`raspar_portal\`.

## 7. Mapa dos meus módulos × uso na Rumo

- **Scanner** → \`extrair_documento\` (OCR + classificação)
- **SIAIF Tax** → \`consultar_api\` (isenções, economia tributária)
- **Sistema BR / Integrações** → enriquecimento de cadastro (CNPJ/RFB) na abertura de empresas
- **RPA Engine ("Meus Robôs")** → \`raspar_portal\` (gravação híbrida Selenium + UI Automation)
- **WhatsApp (ZAP)** → \`enviar_zap\` (autorizações por empresa já na Rumo, em \`/portal-acessos\`)
- **Workspace/Meus Dados** → \`sync_ged\` e análises sobre exports da Rumo
- **Memória** → o que aprendo de preferências do escritório fica local; decisões de negócio ficam na Rumo

## 8. O que NÃO faço (limites)

- Não escrevo diretamente no banco da Rumo — só via endpoints do contrato.
- Não decido lançamento contábil: minhas divergências viram pendências para o contador validar.
- Não uso Evolution API para WhatsApp da Rumo.
- Não executo comando expirado, reentregue ou de tenant não autorizado à minha chave.`

    const etapasTemplateManual = [
      {
        ordem: 1,
        titulo: 'Seção 1: Quem eu sou neste contexto (Identidade Operacional Própria)',
        descricao:
          'ELLIZA desktop instalada e licenciada no PC do escritório Rumo, atuando como braço executor local (RPA + IA). Perfil elliza em elliza_perfil, autenticada via X-Elliza-Api-Key.',
        acao: 'Autenticar via header X-Elliza-Api-Key e sincronizar identidade operacional com elliza_perfil.',
        criterio_sucesso: 'Identidade operacional elliza reconhecida sem conta de usuário humano.',
        criterio_erro: 'Chave de API inválida ou perfil elliza não localizado.',
        responsavel_tipo: 'Elliza Desktop',
      },
      {
        ordem: 2,
        titulo: 'Seção 2: Arquitetura da Integração (Canais SSE Realtime + REST)',
        descricao:
          'Comunicação SSE em GET /comandos/assinar e fallback GET /comandos/obter. Canal de subida REST (aceitar, concluir, erro, upload-documento). Host PocketBase obrigatório.',
        acao: 'Conectar SSE no host PocketBase e escutar eventos de novos comandos em elliza_comandos.',
        criterio_sucesso:
          'Stream SSE ativo no host PocketBase com resposta a eventos em tempo real.',
        criterio_erro: 'Tentativa de conexão ao domínio SPA público (404) ou recusa de handshake.',
        responsavel_tipo: 'Elliza Desktop',
      },
      {
        ordem: 3,
        titulo: 'Seção 3: Regras Inegociáveis (Regra de Ouro, Parada Honesta e Idempotência)',
        descricao:
          'Conclusão apenas com evidência real. Erro honesto via /erro com pendência estruturada. Nonce único por comando e telemetria determinística Trilha RPA v1.0.',
        acao: 'Validar evidência antes de concluir comando e emitir parada honesta formal em falhas.',
        criterio_sucesso: 'Evidência real anexada com SHA-256 e nonce validado.',
        criterio_erro: 'Tentativa de concluir sem evidência ou simulação de sucesso.',
        responsavel_tipo: 'Elliza Desktop',
      },
      {
        ordem: 4,
        titulo: 'Seção 4: Matriz de Tipos de Comando e Módulos Locais',
        descricao:
          'Tabela dos 8 comandos: chat_objetivo (Ativo), extrair_documento (Piloto ativo), pesquisa_tributaria (Ativo POP-EX-04), sync_ged (Ativo POP-EX-03), conciliar_xml (Planejado), consultar_api (Planejado), raspar_portal (Planejado) e enviar_zap (Planejado).',
        acao: 'Roteador interno da ELLIZA direcionando cada comando ao plugin/módulo especializado correspondente.',
        criterio_sucesso:
          'Comando processado pelo módulo correto com observância do estado vigente.',
        criterio_erro: 'Comando não reconhecido ou módulo inexistente.',
        responsavel_tipo: 'Elliza Desktop',
      },
      {
        ordem: 5,
        titulo: 'Seção 5: Contratos de Endpoint (Assinatura, Lock, Conclusão e Upload GED)',
        descricao:
          'Endpoints /auth/validar, /comandos/assinar, /comandos/obter, /comandos/aceitar, /comandos/concluir, /comandos/erro e /upload-documento.',
        acao: 'Cumprir contrato REST com schemas estritos e validação dura de payloads.',
        criterio_sucesso: 'Respostas HTTP com códigos semânticos (200, 201, 410, 422).',
        criterio_erro: 'Payload inválido, falta de dados estruturados ou violação de contrato.',
        responsavel_tipo: 'Elliza Desktop',
      },
      {
        ordem: 6,
        titulo: 'Seção 6: Rotinas 24/7 e Pré-requisitos Locais',
        descricao:
          'Job elliza_rotinas_247_monitor ativo, WhatsApp ZAP local (nunca Evolution API), NopeCHA para portais, sincronização CNPJ\\AAAA-MM (JOB-092026-SYNC-GED01 / POP-EX-03) e certificados A1.',
        acao: 'Verificar pré-requisitos locais (ZAP, NopeCHA, APIs brasileiras, pastas) antes de acionar rotinas.',
        criterio_sucesso: 'Ambiente local preparado e monitoramento 24/7 operando regularmente.',
        criterio_erro: 'Falta de credencial do ZAP local, captcha bloqueado ou pasta ausente.',
        responsavel_tipo: 'Elliza Desktop',
      },
      {
        ordem: 7,
        titulo: 'Seção 7: Mapa de Módulos Locais × Plataforma Rumo',
        descricao:
          'Scanner -> extrair_documento, SIAIF Tax -> consultar_api, Sistema BR -> enriquecimento, RPA Engine -> raspar_portal, ZAP -> enviar_zap, Workspace -> sync_ged, Memória local.',
        acao: 'Manter separação clara: inteligência de negócio na Rumo e execução prática no PC local.',
        criterio_sucesso: 'Dados sincronizados sem sobreposição de autoridade contábil.',
        criterio_erro: 'Conflito de responsabilidade entre nuvem e máquina local.',
        responsavel_tipo: 'Elliza Desktop',
      },
      {
        ordem: 8,
        titulo: 'Seção 8: Limites Operacionais e O Que NÃO Fazer',
        descricao:
          'Não grava diretamente no banco da Rumo, não decide lançamentos contábeis, não usa Evolution API e não executa comando expirado ou fora do tenant da chave.',
        acao: 'Aplicar travas estritas de conformidade e rejeitar comandos inválidos com HTTP 410 ou 403.',
        criterio_sucesso:
          'Segurança multi-tenant, auditoria CFC e governança preservadas integralmente.',
        criterio_erro: 'Violação de isolamento multi-tenant ou bypass das APIs da plataforma.',
        responsavel_tipo: 'Elliza Desktop',
      },
    ]

    for (let t = 0; t < tenants.length; t++) {
      const tenant = tenants[t]
      const tenantId = tenant.id

      // 1. Cadastrar ou atualizar POP-EX-01 como versão 2026.5
      let rec2026_5 = null
      try {
        rec2026_5 = app.findFirstRecordByFilter(
          'sops',
          `tenant_id = '${tenantId}' && codigo = 'POP-EX-01' && versao = '2026.5'`,
        )
      } catch (_) {}

      if (!rec2026_5) {
        rec2026_5 = new Record(sopsCol)
      }

      rec2026_5.set('tenant_id', tenantId)
      rec2026_5.set('codigo', 'POP-EX-01')
      rec2026_5.set('nome', 'MANUAL ELLIZA — AGENTE EXTERNO DA PLATAFORMA RUMO')
      rec2026_5.set('area', 'geral')
      rec2026_5.set('versao', '2026.5')
      rec2026_5.set('ativo', true)
      rec2026_5.set(
        'objetivo',
        'Versão 2026.5 · Base de aprendizado da ELLIZA (identidade operacional própria, não usuário). Manual integral com 8 seções operacionais, arquitetura SSE/REST, regras de ouro, matriz de tipos de comando e limites.',
      )
      rec2026_5.set(
        'gatilho',
        'Inicialização da ELLIZA Desktop, polling contínuo (30-60s) e escuta do stream SSE GET /backend/v1/elliza-agente/comandos/assinar no host PocketBase.',
      )
      rec2026_5.set(
        'pre_condicoes',
        'ELLIZA desktop instalada e licenciada no PC do escritório Rumo, autenticada via X-Elliza-Api-Key no host PocketBase oficial. POPs complementares referenciados: POP-EX-01 (Manual), POP-EX-03 (Sync GED) e POP-EX-04 (Pesquisa Tributária).',
      )
      rec2026_5.set(
        'entradas',
        'Comandos da fila elliza_comandos (chat_objetivo, extrair_documento, pesquisa_tributaria, sync_ged, conciliar_xml, consultar_api, raspar_portal, enviar_zap), payloads estruturados e tokens de sessão.',
      )
      rec2026_5.set(
        'sistemas_utilizados',
        'ELLIZA Desktop (Electron + Node.js + PostgreSQL local, 22 módulos), Plataforma Rumo Contábil (React + PocketBase), ZAP local, Módulo Scanner, Workspace e APIs RFB/IBPT.',
      )
      rec2026_5.set(
        'responsavel_cargo',
        'ELLIZA Desktop (Agente Externo) / Responsável Técnico CFC',
      )
      rec2026_5.set('agente_nome', 'Elliza Desktop')
      rec2026_5.set('nivel_autonomia', 'nivel_2_supervisionado')
      rec2026_5.set('requer_aprovacao', true)
      rec2026_5.set(
        'saida',
        'Execuções homologadas com evidência auditável (retorno de API, arquivo gravado, captura de tela, hash SHA-256), paradas honestas com pendência estruturada e documentos arquivados no GED.',
      )
      rec2026_5.set(
        'proximo_processo',
        'POP-04 (Fechamento Contábil), POP-05 (Conciliação Bancária), POP-EX-03 (Sync GED), POP-EX-04 (Pesquisa Tributária)',
      )
      rec2026_5.set('regras_negocio', manualConteudoIntegral)
      rec2026_5.set(
        'criterios_sucesso',
        'Regra de Ouro: conclusão de comandos exclusivamente com evidência real verificada. Comandos ativos operando com resposta estruturada. Telemetria determinística Trilha RPA v1.0 sem dados inventados.',
      )
      rec2026_5.set(
        'criterios_erro',
        'Parada honesta imediata: divergência ou falha reportada via POST /comandos/erro gerando pendência estruturada para validação do contador, sem jamais simular falso sucesso.',
      )
      rec2026_5.set(
        'excecoes',
        'Comandos expirados (expira_em vencido) respondidos com HTTP 410. Tentativas de acesso sem chave respondidas com 401. Falhas em portais retidas na esteira com captura de tela.',
      )
      rec2026_5.set('etapas_template_json', etapasTemplateManual)

      app.save(rec2026_5)
      console.log(`[MIGRATION-0125] Manual Elliza 2026.5 salvo para tenant ${tenantId}`)
    }

    console.log('[MIGRATION-0125] Concluído com sucesso!')
  },
  (app) => {
    const registros = app.findRecordsByFilter('sops', "versao = '2026.5'", 'created', 100)
    for (let i = 0; i < registros.length; i++) {
      app.delete(registros[i])
    }
  },
)

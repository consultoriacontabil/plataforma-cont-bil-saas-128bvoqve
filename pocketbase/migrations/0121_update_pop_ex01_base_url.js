/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    console.log(
      '[MIGRATION-0121] Atualizando POP-EX-01 (v2026.4) com a Base URL correta da API (host PocketBase)...',
    )

    const PB_HOST = 'https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev'
    const PUBLIC_DOMAIN = 'rumoconsultoriacontabil.com.br'

    let popEx01Rec = null
    try {
      popEx01Rec = app.findFirstRecordByFilter('sops', "codigo = 'POP-EX-01' && versao = '2026.4'")
    } catch (_) {}

    if (!popEx01Rec) {
      console.warn('[MIGRATION-0121] POP-EX-01 v2026.4 não encontrado para atualização.')
      return
    }

    const preCondicoesAtualizadas = `API key dedicada configurada no software ELLIZA Desktop e acesso aos endpoints /backend/v1/elliza-agente/* no host PocketBase (${PB_HOST}). ATENÇÃO: o domínio público ${PUBLIC_DOMAIN} serve apenas a interface web React (SPA) e NÃO responde pela API do agente (retorna 404/HTML). Nunca aponte o conector para ${PUBLIC_DOMAIN}.`

    const regrasNegocioAtualizadas = `Contrato Trilha RPA v1.0. Privilégios mínimos: endpoints /backend/v1/elliza-agente/* no host PocketBase (${PB_HOST}) com header X-Elliza-Api-Key.
BASE URL OBRIGATÓRIA DA API: ${PB_HOST}
AVISO DE INFRAESTRUTURA: O domínio público ${PUBLIC_DOMAIN} serve exclusivamente a aplicação web SPA (React/Vite). Requisições de API para ${PUBLIC_DOMAIN}/backend/v1/* devolvem página 404 do SPA e falham na interpretação JSON. O conector ELLIZA desktop deve ser configurado ESTRITAMENTE com a Base URL ${PB_HOST}.

Exemplo de chamada completa (Autenticação / Validação):
POST ${PB_HOST}/backend/v1/elliza-agente/auth/validar
Headers:
  X-Elliza-Api-Key: elliza_agt_live_desktop_c89a24fe10bb73e921
  Content-Type: application/json
Resposta esperada (200 OK):
  {"sucesso": true, "mensagem": "Autenticação de Agente Externo validada com sucesso.", "agente": {"identificador": "elliza-desktop-rpa", "status": "ativo"}}

Exemplo de chamada completa (Polling / Buscar tarefas aprovadas):
GET ${PB_HOST}/backend/v1/elliza-agente/tarefas-aprovadas
(ou alias: GET ${PB_HOST}/backend/v1/elliza-agente/buscar-aprovadas)
Headers:
  X-Elliza-Api-Key: elliza_agt_live_desktop_c89a24fe10bb73e921
Resposta esperada (200 OK):
  {"sucesso": true, "total_tarefas_aprovadas": N, "tarefas": [...]}

Exemplo de chamada completa (Iniciar execução):
POST ${PB_HOST}/backend/v1/elliza-agente/iniciar
Headers:
  X-Elliza-Api-Key: elliza_agt_live_desktop_c89a24fe10bb73e921
  Content-Type: application/json
Body:
  {"job_id": "<id_do_job>"}

Exemplo de chamada completa (Concluir com Regra de Ouro):
POST ${PB_HOST}/backend/v1/elliza-agente/concluir
Headers:
  X-Elliza-Api-Key: elliza_agt_live_desktop_c89a24fe10bb73e921
  Content-Type: application/json
Body:
  {"job_id": "<id_do_job>", "criterio_sucesso_validado": true, "resultado": "Execução homologada com sucesso."}

Ciclo (30-60s): 1. Polling GET /buscar-aprovadas -> 2. Ler tarefa + blueprint -> 3. Navegar e ler telemetria #rpa-* -> 4. Executar no PC -> 5. Capturar evidência SHA-256 -> 6. POST /iniciar, /evidencias, /concluir ou /erro -> 7. Reiniciar polling.
Regra de Ouro: conclusão exige #rpa-status-conclusao[data-rpa-state="success"] E criterio_sucesso_validado:true. Sem isso retorna 400. Parada honesta: dado divergente ou ausente ("—") reportar via /erro.
Telemetria contratada: #rpa-step, #rpa-btn-executar, #rpa-grid-balancete, #rpa-grid-lancamentos, #rpa-grid-conciliacao, #rpa-status-conclusao, #rpa-empresa-ficha, #rpa-grid-qsa, #rpa-grid-documentos.
WhatsApp somente via ZAP local da ELLIZA desktop (Evolution API descontinuada). Scanner->GED: OCR, identificação da empresa/pedido e anexo com SHA-256.`

    const etapasAtualizadas = [
      {
        ordem: 1,
        titulo: 'Autenticação e Polling no Endpoint /buscar-aprovadas (Host PocketBase)',
        descricao: `Consultar tarefas com header X-Elliza-Api-Key a cada 30-60s apontando para a Base URL oficial ${PB_HOST}.`,
        acao: `Efetuar GET ${PB_HOST}/backend/v1/elliza-agente/buscar-aprovadas (ou /tarefas-aprovadas) com X-Elliza-Api-Key. NÃO usar ${PUBLIC_DOMAIN}.`,
        criterio_sucesso: 'HTTP 200 com array de tarefas estruturadas contendo job_id e payload.',
        criterio_erro:
          'HTTP 401 por credencial inválida ou 404 HTML caso aponte para o domínio público.',
        responsavel_tipo: 'Elliza',
      },
      {
        ordem: 2,
        titulo: 'Leitura Determinística da Tela por Atributos RPA',
        descricao: 'Navegar à tela e ler estado via data-step-code, data-step-status e grids.',
        acao: 'Inspecionar elementos #rpa-* sem scraping frágil de texto visual.',
        criterio_sucesso: 'Atributos lidos com sucesso refletindo o estado da esteira.',
        criterio_erro: 'Seletor ausente ou divergente.',
        responsavel_tipo: 'Elliza',
      },
      {
        ordem: 3,
        titulo: 'Execução Local e Captura de Evidência com Hash SHA-256',
        descricao: 'Executar ação no PC e capturar screenshot/recibo gerando hash SHA-256.',
        acao: `Registrar evidência via POST ${PB_HOST}/backend/v1/elliza-agente/evidencias e anexar ao GED quando aplicável.`,
        criterio_sucesso: 'Evidência persistida com hash SHA-256 e protocolo auditável.',
        criterio_erro: 'Falha na captura ou geração de hash.',
        responsavel_tipo: 'Elliza',
      },
      {
        ordem: 4,
        titulo: 'Conclusão Estrita pela Regra de Ouro',
        descricao: `Homologar encerramento via POST ${PB_HOST}/backend/v1/elliza-agente/concluir com criterio_sucesso_validado:true.`,
        acao: 'Confirmar indicador #rpa-status-conclusao[data-rpa-state="success"] e devolver conclusão.',
        criterio_sucesso: 'Status transicionado para CONCLUIDO e avanço para a próxima etapa.',
        criterio_erro: 'Tentativa de conclusão sem validação (HTTP 400).',
        responsavel_tipo: 'Elliza',
      },
    ]

    popEx01Rec.set('pre_condicoes', preCondicoesAtualizadas)
    popEx01Rec.set('regras_negocio', regrasNegocioAtualizadas)
    popEx01Rec.set('etapas_template_json', etapasAtualizadas)
    app.save(popEx01Rec)

    console.log('[MIGRATION-0121] POP-EX-01 atualizado com sucesso com a Base URL do PocketBase!')
  },
  (app) => {
    // Reverter para o conteúdo padrão da migration 0120
    try {
      const rec = app.findFirstRecordByFilter('sops', "codigo = 'POP-EX-01' && versao = '2026.4'")
      if (rec) {
        rec.set(
          'pre_condicoes',
          'API key dedicada configurada no software ELLIZA Desktop e acesso aos endpoints /backend/v1/elliza-agente/*.',
        )
        app.save(rec)
      }
    } catch (_) {}
  },
)

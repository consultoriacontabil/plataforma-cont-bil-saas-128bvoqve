/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    $ai.agents.define(app, {
      slug: 'rumo-agent',
      name: 'Rumo Agent',
      description:
        'Assistente virtual da Rumo Consultoria Contábil para suporte operacional aos contadores e clientes.',
      systemPrompt:
        'Você é o Rumo Agent, assistente virtual da Rumo Consultoria Contábil. Responda sempre em português brasileiro, com tom profissional e cordial. Você auxilia contadores com informações sobre as empresas, documentos, workflows e obrigações fiscais do escritório. Você pode consultar (somente leitura) as coleções: empresas, documentos, workflows e fiscal, sempre limitadas ao tenant do usuário que está falando com você. Quando usar uma fonte, cite-a com um link "Ver fonte". Você NÃO realiza alterações, exclusões ou criação de registros — apenas leitura. Se o usuário pedir uma operação de escrita, explique educadamente que você é somente leitura. Não invente números, valores, prazos ou conclusões jurídicas/fiscais: se não tiver certeza, oriente o usuário a consultar o responsável técnico. Seja objetivo e direto.',
      tier: 'fast',
      tools: [
        { collection: 'empresas', perms: { list: true, read: true } },
        { collection: 'documentos', perms: { list: true, read: true } },
        { collection: 'workflows', perms: { list: true, read: true } },
        { collection: 'fiscal', perms: { list: true, read: true } },
      ],
      memory: [
        {
          type: 'faq',
          payload: {
            qa: [
              {
                question: 'Quais tipos de documentos posso enviar?',
                answer:
                  'A plataforma suporta: Contrato Social, Alteração Contratual, Fatura, Nota Fiscal, Procurações, Relatórios e Outros. Extensões permitidas: PDF, JPG, PNG, DOCX e XLSX com limite máximo de 25MB por arquivo.',
              },
              {
                question: 'Qual o limite de tamanho dos arquivos?',
                answer:
                  'O limite de tamanho para upload de documentos ou recibos fiscais é de até 25 MB por arquivo individualmente.',
              },
              {
                question: 'O que significa cada status de workflow?',
                answer:
                  'Pendente: tarefa aguardando início ou triagem. Em Andamento: em execução pela equipe técnica. Concluído: fluxo finalizado e aprovado. Cancelado: tarefa descontinuada ou substituída.',
              },
              {
                question: 'O que significa cada status de obrigação fiscal?',
                answer:
                  'Pendente: obrigação do período ainda não transmitida. Em Andamento: apuração ou preenchimento em curso. Entregue: transmitida com recibo anexado. Aprovado: validada pelo contador responsável. Rejeitado: inconsistência identificada que necessita de retificação.',
              },
              {
                question: 'Como convidar um novo usuário?',
                answer:
                  'Vá em Gestão > Usuários & Perfis, clique no botão "Convidar Usuário", informe Nome, Email e selecione o Perfil desejado (Administrador, Contador, Auxiliar ou Consultor).',
              },
            ],
          },
        },
        {
          type: 'text',
          payload: {
            text: 'Visão Geral dos Módulos Rumo MVP (P0): Core (Multi-tenant, Auth, Usuários e Perfis com RBAC, Dashboard executivo e Auditoria de operações), Empresas (Cadastro completo com busca de CEP ViaCEP e detalhes 360°), Documentos GED (Upload drag-and-drop, preview de PDF/imagens e trilha de histórico), Workflow (Kanban ágil de solicitações e prazos), Fiscal (Controle e apuração de obrigações federais, estaduais e municipais com recibo), Integrações (Hub com conectores previstos) e Rumo Agent (Assistente nativo com IA). Módulos das fases P1 (Contábil, DP, Obrigações automáticas, Financeiro/BPO, Relatórios) e P2 (Patrimônio) serão lançados nas próximas versões.',
          },
        },
      ],
    })
  },
  (app) => {
    try {
      $ai.agents.delete(app, 'rumo-agent')
    } catch (_) {}
  },
)

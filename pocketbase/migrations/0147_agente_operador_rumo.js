/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0147 — FASE 2: agente operacional `operador-rumo`.
 *
 * Pré-requisito cumprido: o isolamento multi-tenant está no banco (102 de 102
 * coleções, v0.0.208). Com `actAs: 'user'`, o agente herda essas regras — ele
 * NUNCA enxerga outro escritório, mesmo que o prompt peça.
 *
 * Princípios de escopo:
 *
 *  1. LEITURA ampla no que é operacional: empresas, obrigações, documentos,
 *     workflows, lançamentos, fechamento, pendências, jobs e POPs.
 *  2. ESCRITA estreita, só onde "avançar o processo" não reescreve dado
 *     contábil: status de obrigação, andamento de workflow, pendência e job.
 *  3. NUNCA `delete` — nenhuma tool concede delete.
 *  4. NUNCA escrita em lançamento contábil, documento fiscal, certificado,
 *     credencial, sócio, folha ou empresa. Isso é decisão humana.
 *  5. `audit_log` é leitura e criação apenas (registrar o que fez), jamais
 *     alteração — trilha não pode ser reescrita pelo próprio agente.
 *
 * tier `fast`: o trabalho é consultar e atualizar status; o raciocínio pesado
 * de plano de contas continua com a ELLIZA (reasoning não é necessário aqui e
 * custa mais por chamada).
 *
 * Rollback: remove o agente e, por cascata, tools, memória e conversas.
 */
migrate(
  (app) => {
    $ai.agents.define(app, {
      slug: 'operador-rumo',
      name: 'Operador Rumo',
      description:
        'Agente operacional do escritório: acompanha obrigações, workflows e pendências, atualiza andamento e registra o que fez. Não altera dado contábil nem fiscal.',
      tier: 'fast',
      systemPrompt: [
        'Você é o Operador Rumo, agente operacional de um escritório de contabilidade brasileiro.',
        '',
        'IDENTIDADE E LIMITE',
        '- Você executa trabalho operacional: acompanhar obrigações, mover workflows, atualizar pendências, registrar andamento.',
        '- Você NÃO é contador e NÃO decide matéria contábil, fiscal ou trabalhista. Se a pergunta exigir interpretação técnica (tributação, enquadramento, lançamento, cálculo), explique o que sabe e encaminhe ao contador responsável.',
        '- O isolamento por escritório é imposto pelo banco, não pela sua boa vontade: você só enxerga o tenant do usuário que está falando com você. Nunca mencione, compare ou especule sobre dados de outro escritório — se um dado não aparece, diga que não tem acesso.',
        '',
        'ANTES DE ESCREVER',
        '- Toda alteração precisa de motivo explícito. Se o usuário não disse por que, pergunte antes de gravar.',
        '- Nunca invente id de registro. Localize pelo nome/CNPJ/competência e confirme com o usuário qual registro será alterado.',
        '- Antes de mudar status, leia o registro e diga em voz alta o estado atual e o novo.',
        '- Se a operação envolver mais de 5 registros, apresente a lista e peça confirmação antes de executar.',
        '',
        'O QUE VOCÊ NUNCA FAZ',
        '- Nunca apaga registro algum.',
        '- Nunca altera lançamento contábil, nota fiscal, certificado digital, credencial, folha de pagamento, rescisão, sócio ou cadastro de empresa.',
        '- Nunca transmite obrigação a órgão público, nem assina, nem emite guia. Você prepara e registra; quem transmite é o humano.',
        '- Nunca altera nem apaga registro de auditoria.',
        '',
        'COMO RESPONDER',
        '- Português do Brasil, direto, sem jargão desnecessário.',
        '- Comece pela resposta, depois o detalhe.',
        '- Ao concluir uma alteração, informe: o que mudou, em qual registro, e qual era o valor anterior.',
        '- Se não houver dado, diga "não encontrei" e o que faltou para encontrar. Não preencha lacuna com suposição.',
        '',
        'QUANDO ENCAMINHAR',
        '- Dúvida de tributo, alíquota, obrigação acessória: explique o conceito e encaminhe ao contador.',
        '- Pedido de exclusão, de alteração em lançamento ou de transmissão oficial: recuse com clareza e explique que exige o humano responsável.',
      ].join('\n'),
      tools: [
        // ---- LEITURA ----
        { collection: 'empresas', perms: { list: true, read: true } },
        { collection: 'obrigacoes', perms: { list: true, read: true } },
        { collection: 'documentos', perms: { list: true, read: true } },
        { collection: 'workflows', perms: { list: true, read: true } },
        { collection: 'workflow_activity', perms: { list: true, read: true } },
        { collection: 'lancamentos_contabeis', perms: { list: true, read: true } },
        { collection: 'fechamento_competencia', perms: { list: true, read: true } },
        { collection: 'fechamento_checklist_itens', perms: { list: true, read: true } },
        { collection: 'processos_operacionais', perms: { list: true, read: true } },
        { collection: 'processo_etapas', perms: { list: true, read: true } },
        { collection: 'processo_pendencias', perms: { list: true, read: true } },
        { collection: 'elisa_jobs', perms: { list: true, read: true } },
        { collection: 'sops', perms: { list: true, read: true } },
        { collection: 'funcionarios', perms: { list: true, read: true } },
        { collection: 'plano_contas', perms: { list: true, read: true } },
        { collection: 'fiscal', perms: { list: true, read: true } },
        { collection: 'elliza_diretivas', perms: { list: true, read: true } },

        // ---- ESCRITA RESTRITA (nunca delete) ----
        // status de obrigação: "pendente" -> "em andamento" -> "entregue"
        { collection: 'obrigacoes', perms: { update: true } },
        // andamento de workflow
        { collection: 'workflows', perms: { update: true } },
        { collection: 'workflow_activity', perms: { create: true, update: true } },
        // pendências: abrir e resolver
        { collection: 'processo_pendencias', perms: { create: true, update: true } },
        // jobs: registrar andamento da própria execução
        { collection: 'elisa_jobs', perms: { create: true, update: true } },
        // notificação ao time
        { collection: 'notificacoes', perms: { create: true } },
        // auditoria: registrar o que fez, nunca reescrever
        { collection: 'audit_log', perms: { create: true } },
      ],
      memory: [
        {
          type: 'text',
          payload: {
            text: [
              'COMO O ESCRITÓRIO TRABALHA (Operador Rumo)',
              '',
              'Rotina mensal: fechamento de competência por empresa. Cada fechamento tem',
              'checklist (fechamento_checklist_itens). Obrigação vencida e não entregue é',
              'prioridade máxima na fila.',
              '',
              'Fluxo de obrigação: pendente -> em_andamento -> entregue. "aprovado" e',
              '"rejeitado" são decisões do responsável humano, não do agente.',
              '',
              'Fluxo de pendência: aberta pelo agente quando falta documento ou informação;',
              'fecha quando o responsável resolve. Sempre registrar quem pediu o quê.',
              '',
              'Escalonamento: qualquer coisa que envolva valor a recolher, prazo legal',
              'vencendo em menos de 3 dias ou risco de multa vai para o responsável humano',
              'com marcação de urgência.',
              '',
              'O que o agente prepara mas NÃO executa: transmissão de declaração, emissão',
              'de guia, assinatura digital, qualquer envio a órgão público.',
            ].join('\n'),
          },
        },
        {
          type: 'faq',
          payload: {
            qa: [
              {
                question: 'O agente pode alterar um lançamento contábil?',
                answer:
                  'Não. Lançamento contábil é somente leitura para o Operador Rumo. Alteração exige o contador responsável e passa por revisão humana.',
              },
              {
                question: 'O agente pode transmitir uma obrigação ao órgão público?',
                answer:
                  'Não. O agente prepara e registra o andamento; a transmissão oficial é sempre feita por uma pessoa autorizada.',
              },
              {
                question: 'O que fazer quando falta um documento para fechar a competência?',
                answer:
                  'Abrir uma pendência em processo_pendencias descrevendo qual documento falta, para qual empresa e competência, e notificar o responsável.',
              },
              {
                question: 'O agente enxerga dados de outro escritório?',
                answer:
                  'Não. As regras do banco limitam cada leitura ao tenant do usuário. Se um registro não aparece, não há acesso — nunca deduza o conteúdo.',
              },
            ],
          },
        },
      ],
    })
    console.log('[0147] agente operador-rumo definido')
  },
  (app) => {
    $ai.agents.delete(app, 'operador-rumo')
  },
)

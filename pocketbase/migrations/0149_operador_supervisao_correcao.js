/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0149 — FASE 3 (correção): aplica de fato a supervisão no agente.
 *
 * A 0147 já estava aplicada quando o escopo mudou, e migration aplicada não
 * roda de novo. Resultado: o agente seguia com `update: true` em `obrigacoes`
 * e `workflows` e com o prompt antigo ("mover workflows", sem a regra de
 * supervisão). Esta migration reaplica a definição completa com o escopo novo.
 *
 * Verificado antes: tools com `update` em obrigacoes/workflows; system_prompt
 * sem a seção "REGRA DE SUPERVISÃO".
 *
 * Mudanças:
 *  - system_prompt: seção de supervisão obrigatória (propõe, não grava).
 *  - obrigacoes / workflows: SEM update. Escrita passa por operador_acoes.
 *  - operador_acoes: nova tool (list, read, create).
 *  - processo_pendencias: create (abrir pendência), sem update direto.
 *
 * Rollback: não reverte o texto (o histórico da 0147 já está no banco); para
 * voltar atrás, reaplicar a 0147 via nova migration.
 */
migrate(
  (app) => {
    $ai.agents.define(app, {
      slug: 'operador-rumo',
      name: 'Operador Rumo',
      description:
        'Agente operacional do escritório: acompanha obrigações, workflows e pendências e propõe alterações para aprovação humana. Não altera dado contábil nem fiscal.',
      tier: 'fast',
      systemPrompt: [
        'Você é o Operador Rumo, agente operacional de um escritório de contabilidade brasileiro.',
        '',
        'IDENTIDADE E LIMITE',
        '- Você faz trabalho operacional de acompanhamento: consultar obrigações, workflows, pendências, fechamentos e POPs, e registrar andamento.',
        '- Você NÃO é contador e NÃO decide matéria contábil, fiscal ou trabalhista. Se a pergunta exigir interpretação técnica (tributação, enquadramento, lançamento, cálculo), explique o que sabe e encaminhe ao contador responsável.',
        '- O isolamento por escritório é imposto pelo banco, não pela sua boa vontade: você só enxerga o tenant do usuário que fala com você. Nunca mencione, compare ou especule sobre dados de outro escritório — se um dado não aparece, diga que não tem acesso.',
        '',
        'REGRA DE SUPERVISÃO — A MAIS IMPORTANTE',
        '- Você NÃO altera dado de negócio diretamente. Nunca chame update em obrigações, workflows ou pendências.',
        '- Para mudar status, observação, responsável, data ou valor, você PROPÕE: cria um registro em operador_acoes informando colecao, registro_id, campo, valor_atual, valor_proposto e motivo.',
        '- Depois de propor, informe o protocolo (id da ação) e diga com clareza: "aguardando aprovação de um Administrador ou Contador".',
        '- NUNCA diga que alterou, que atualizou ou que já está feito. Você propôs; quem aplica é o humano.',
        '- Quem propõe não aprova. Você nunca aprova as próprias propostas.',
        '- O que você ainda pode criar direto, por ser registro de andamento e não alteração de dado: atividade em workflow_activity, notificação, pendência em processo_pendencias e job em elisa_jobs.',
        '',
        'ANTES DE PROPOR',
        '- Toda proposta precisa de motivo explícito. Se o usuário não disse por quê, pergunte antes.',
        '- Nunca invente id de registro. Localize pelo nome/CNPJ/competência e confirme com o usuário qual registro será alterado.',
        '- Leia o registro e informe o valor atual junto com o proposto.',
        '- Se a operação envolver mais de 5 registros, apresente a lista e peça confirmação antes de propor em lote.',
        '',
        'O QUE VOCÊ NUNCA FAZ',
        '- Nunca apaga registro algum.',
        '- Nunca altera lançamento contábil, nota fiscal, certificado digital, credencial, folha de pagamento, rescisão, sócio ou cadastro de empresa — nem por proposta.',
        '- Nunca transmite obrigação a órgão público, nem assina, nem emite guia.',
        '- Nunca altera nem apaga registro de auditoria.',
        '',
        'COMO RESPONDER',
        '- Português do Brasil, direto, sem jargão desnecessário.',
        '- Comece pela resposta, depois o detalhe.',
        '- Ao propor, informe: o que será alterado, em qual registro, de qual valor para qual, e o protocolo.',
        '- Se não houver dado, diga "não encontrei" e o que faltou. Não preencha lacuna com suposição.',
        '',
        'QUANDO ENCAMINHAR',
        '- Dúvida de tributo, alíquota, obrigação acessória: explique o conceito e encaminhe ao contador.',
        '- Pedido de exclusão, de alteração em lançamento ou de transmissão oficial: recuse com clareza e explique que exige o humano responsável.',
      ].join('\n'),
      tools: [
        // ---- LEITURA ----
        { collection: 'empresas', perms: { list: true, read: true } },
        { collection: 'documentos', perms: { list: true, read: true } },
        { collection: 'lancamentos_contabeis', perms: { list: true, read: true } },
        { collection: 'fechamento_competencia', perms: { list: true, read: true } },
        { collection: 'fechamento_checklist_itens', perms: { list: true, read: true } },
        { collection: 'processos_operacionais', perms: { list: true, read: true } },
        { collection: 'processo_etapas', perms: { list: true, read: true } },
        { collection: 'sops', perms: { list: true, read: true } },
        { collection: 'funcionarios', perms: { list: true, read: true } },
        { collection: 'plano_contas', perms: { list: true, read: true } },
        { collection: 'fiscal', perms: { list: true, read: true } },
        { collection: 'elliza_diretivas', perms: { list: true, read: true } },
        { collection: 'obrigacoes', perms: { list: true, read: true } },
        { collection: 'workflows', perms: { list: true, read: true } },

        // ---- SUPERVISÃO: propor, nunca aplicar ----
        { collection: 'operador_acoes', perms: { list: true, read: true, create: true } },

        // ---- ANDAMENTO: cria, não altera dado de negócio ----
        { collection: 'workflow_activity', perms: { list: true, read: true, create: true } },
        { collection: 'processo_pendencias', perms: { list: true, read: true, create: true } },
        { collection: 'elisa_jobs', perms: { list: true, read: true, create: true, update: true } },
        { collection: 'notificacoes', perms: { list: true, read: true, create: true } },
        { collection: 'audit_log', perms: { list: true, read: true, create: true } },
      ],
    })
    console.log('[0149] operador-rumo: supervisao aplicada (sem update direto)')
  },
  (app) => {
    // no-op: o estado anterior já não existe; reverter exigiria outra migration
  },
)

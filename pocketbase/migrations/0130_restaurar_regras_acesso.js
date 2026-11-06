/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0130 — NEUTRALIZADA (no-op)
 *
 * HISTÓRICO
 * A 0129 gravou `null` (somente superusuário) nas regras de acesso de ~85
 * coleções do preview, bloqueando o acesso dos usuários pela API. A 0130 foi
 * escrita e aplicada como restauração de emergência, devolvendo a regra
 * genérica `@request.auth.id != ''` em bloco.
 *
 * PROBLEMA DA 0130
 * Restaurar "em bloco" com a regra genérica AFROUXA coleções que eram mais
 * restritas que isso (por exemplo `certificados_digitais`, que exigia perfil
 * diferente de 'cliente' e escrita só para administrador/contador — corrigida
 * depois pela 0131). O mesmo risco existiria para qualquer outra coleção que
 * tivesse regra própria.
 *
 * POR QUE ESTE ARQUIVO CONTINUA AQUI
 * Ele já foi aplicado no preview, onde cumpriu o papel de restaurar o serviço.
 * Mantê-lo como no-op garante que, se as migrations forem reaplicadas do zero
 * (deploy em produção, restore, novo ambiente), esta restauração cega não
 * volte a afrouxar regras em produção — lá as regras nunca foram quebradas.
 *
 * ESTADO ATUAL: confirmado restaurado no preview por inspeção direta das
 * regras de: empresas, obrigacoes, documentos, tenants, tenant_members,
 * audit_log, notificacoes, certificados_digitais, agent_conversations,
 * elisa_jobs, processos_operacionais, wa_atendimento_conversas,
 * elliza_diretivas.
 */

migrate(
  (app) => {
    console.log('[0130] neutralizada: nenhuma alteracao aplicada')
  },
  (app) => {
    // nada a reverter
  },
)

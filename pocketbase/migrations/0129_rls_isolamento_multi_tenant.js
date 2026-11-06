/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0129 — NEUTRALIZADA (no-op)
 *
 * HISTÓRICO
 * A versão original desta migration tentava LER a regra atual de cada coleção
 * para decidir se estreitava ou preservava. Dentro da runtime de migration a
 * leitura não devolveu string, e o código gravou `null` em todas as regras —
 * no PocketBase, `null` significa "somente superusuário", o que bloqueou o
 * acesso dos usuários pela API.
 *
 * O estado foi restaurado pelas migrations 0130 e 0131.
 *
 * POR QUE ESTE ARQUIVO CONTINUA AQUI
 * Ele já foi aplicado no ambiente de preview e não roda de novo. Mantê-lo como
 * no-op garante que, se as migrations forem reaplicadas do zero (deploy em
 * produção, restore, novo ambiente), nada destrutivo aconteça.
 *
 * O isolamento multi-tenant será refeito com outro desenho: regras literais
 * por coleção, validadas primeiro em UMA coleção, sem leitura de estado.
 */

migrate(
  (app) => {
    console.log('[0129] neutralizada: nenhuma alteração aplicada')
  },
  (app) => {
    // nada a reverter
  },
)

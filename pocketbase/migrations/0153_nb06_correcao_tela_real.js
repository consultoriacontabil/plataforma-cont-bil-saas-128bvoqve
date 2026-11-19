/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0153 — Corrige o POP-NB-06 com a TELA REAL do Numbra.
 *
 * Por que existe: o POP-NB-06 (migration 0152) foi escrito a partir da
 * descrição do site, não da tela. O Elissandro enviou o print da Central de
 * Obrigações e vários passos estavam errados ou vagos:
 *
 *  - não existe filtro "7 dias" como aba: os números vêm em QUATRO cartões
 *    (Em atraso / Vencem em 7 dias / A confirmar / Entregues);
 *  - as abas são "Por prazo", "Por cliente" e "Calendário";
 *  - a obrigação lista "Vence em X dias" e a data, mais "Envio: portal ou aqui";
 *  - cada obrigação tem TRÊS marcadores: Entregue / A confirmar / Falta entregar;
 *  - o detalhe por empresa abre por "Ver quem falta";
 *  - existe o botão "Guardar recibos" no topo — é por ele que se registra
 *    entrega feita fora do Numbra.
 *
 * ACHADO QUE IMPORTA PARA A INTEGRAÇÃO: a PIRES tem 0 obrigações na coleção
 * `obrigacoes` da plataforma e 1 pendente (PGDAS-D e DAS out/2026) no Numbra.
 * São DUAS fontes de verdade. A plataforma não pode ser tratada como espelho
 * do Numbra sem uma sincronização explícita.
 *
 * Rollback: não reverte o texto; reaplicar a 0152 se necessário.
 */
migrate(
  (app) => {
    const tenantId = 'l91og8ybo9krtay'

    const achar = app.findRecordsByFilter('sops', 'tenant_id = {:t} && codigo = {:c}', '', 1, 0, {
      t: tenantId,
      c: 'NB-06',
    })
    if (achar.length === 0) {
      console.log('[0153] NB-06 nao encontrado; nada a corrigir')
      return
    }

    const rec = achar[0]

    rec.set(
      'objetivo',
      'Ler a Central de Obrigacoes do Numbra e reportar, todo dia, o que esta atrasado, o que vence em 7 dias e o que falta entregar por empresa.',
    )
    rec.set('gatilho', 'Diario, 8h, e sob demanda.')
    rec.set('nivel_autonomia', 'nivel_1_automatico')
    rec.set('requer_aprovacao', false)
    rec.set(
      'sistemas_utilizados',
      'Numbra > Obrigacoes > Central de Obrigacoes (abas: Por prazo, Por cliente, Calendario)',
    )
    rec.set(
      'pre_condicoes',
      'Numbra aberto e logado. Mes/ano corretos no seletor do topo (ex.: Novembro/2026).',
    )

    const etapas = [
      'Abrir Obrigacoes > Central de Obrigacoes',
      'CONFERIR a competencia no seletor do topo (< Mes/Ano >). Se nao for o mes de hoje, ajustar antes de qualquer leitura',
      'Ler os QUATRO cartoes de resumo: Em atraso, Vencem em 7 dias, A confirmar, Entregues (formato "X de Y")',
      'Na aba "Por prazo", percorrer a lista de obrigacoes do mes. Cada linha traz nome (ex.: PGDAS-D e DAS), competencia (ex.: Outubro/2026), texto "Vence em N dias", a data, e a origem do envio ("Envio: portal ou aqui")',
      'Para cada obrigacao com pendencia, clicar em "Ver quem falta" e anotar as empresas listadas',
      'Ler o cartao "Por empresa" a direita: mostra quem esta mais atras primeiro, no formato "0 de 1 entregue, falta 1"',
      'Ler o cartao "Proximos vencimentos": data, obrigacao e quantas entregas em aberto',
      'Salvar print da tela inteira, com a competencia visivel e os quatro cartoes',
      'Montar o relato: (a) atrasadas, (b) vencem em 7 dias com data, (c) a confirmar, (d) empresas com pendencia',
    ]

    rec.set(
      'etapas_template_json',
      etapas.map(function (d, i) {
        return { ordem: i + 1, descricao: d, tipo: 'execucao' }
      }),
    )

    rec.set(
      'criterios_sucesso',
      'Relato com as quatro listas e print da tela salvo, com o mes correto no seletor. Nada foi alterado no Numbra.',
    )
    rec.set(
      'criterios_erro',
      'Competencia errada no seletor, tela diferente de "Central de Obrigacoes", cartoes ilegiveis, ou lista sem os cartoes de resumo.',
    )
    rec.set(
      'excecoes',
      'Obrigacao marcada como "A confirmar" nao e entrega confirmada: e entrega relatada por fora. Tratar como pendencia de conferencia, nunca como entregue. Se o seletor nao permitir mudar o mes, PARAR.',
    )
    rec.set(
      'regras_negocio',
      'REGRAS DURAS: (1) "A confirmar" NAO e "Entregue" - nao tratar como cumprida. (2) Nunca clicar em "Guardar recibos" nem em qualquer acao que registre entrega; esta tarefa e so leitura. (3) O numero do cartao "Entregues" vem como "X de Y" - reportar os dois valores, nunca so o X. (4) Se a tela nao abrir com o titulo "Central de Obrigacoes", PARAR e reportar; nao procurar clicando. (5) Reportar sempre a competencia lida, porque o mes do seletor pode nao ser o mes corrente.',
    )

    app.save(rec)
    console.log('[0153] NB-06 corrigido com a tela real')
  },
  (app) => {
    // no-op: o texto anterior era hipotese, nao ha o que restaurar com valor
  },
)

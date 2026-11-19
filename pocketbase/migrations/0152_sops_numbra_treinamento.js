/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0152 — POPs do Numbra na colecao `sops`.
 *
 * Os 9 procedimentos de operacao do Numbra entram como POP consultavel pela
 * ELLIZA (mesma colecao que ela ja usa como fonte de memoria). Idempotente:
 * upsert por (tenant_id, codigo).
 */
migrate(
  (app) => {
    const tenantId = 'l91og8ybo9krtay'
    const col = app.findCollectionByNameOrId('sops')
    const POPS = [
      {
        codigo: 'NB-01',
        nome: 'Numbra: importar extrato e conciliar',
        area: 'contabil',
        objetivo: 'Trazer o OFX do banco e conciliar o que o Numbra sugere, sem inventar conta.',
        gatilho: 'Dia 1 de cada mes, por empresa.',
        nivel: 'nivel_1_automatico',
        sistemas: 'Numbra - Contabil > Conciliacao bancaria',
        pre: 'Empresa com conta bancaria cadastrada no Numbra. Arquivo OFX do mes na pasta de entradas.',
        etapas: [
          'Abrir Contabil > Conciliacao bancaria',
          'Selecionar a empresa pelo CNPJ e conferir se o nome na tela e o mesmo do arquivo',
          'Clicar em Importar extrato e escolher o OFX',
          'Conferir banco, conta e periodo reconhecidos. Se o periodo nao for o mes trabalhado, PARAR',
          'Aceitar as sugestoes de contrapartida marcadas em verde',
          'Linhas sem sugestao: marcar como pendente de classificacao, nunca lancar em diversos',
          'Salvar print do resumo de conciliacao',
          'Registrar quantas linhas ficaram pendentes e quais',
        ],
        sucesso: 'Todas as linhas conciliadas ou classificadas como pendentes, com print salvo.',
        erro: 'Periodo divergente, conta bancaria nao encontrada, ou travamento na importacao.',
        excecoes:
          'Empresa com mais de uma conta no mesmo banco: confirmar qual conta antes de importar.',
        regras:
          "NUNCA lancar linha sem sugestao em conta 'diversos' para fechar a tela. Esconde erro e o balancete sai errado.",
      },
      {
        codigo: 'NB-02',
        nome: 'Numbra: importar XML de NF-e e conferir creditos',
        area: 'fiscal',
        objetivo: 'Trazer as notas de entrada e conferir se geraram credito de IBS/CBS.',
        gatilho: 'Diario, ou toda segunda-feira.',
        nivel: 'nivel_1_automatico',
        sistemas: 'Numbra - Fiscal > NF-e; Reforma Tributaria > Creditos',
        pre: 'Certificado digital A1 da empresa ativo.',
        etapas: [
          'Abrir Fiscal > NF-e > Importacao de XML',
          'Selecionar empresa e importar a pasta do mes',
          'Conferir a contagem: notas importadas deve igualar o numero de arquivos. Divergencia = nota rejeitada, investigar antes de seguir',
          'Abrir Reforma Tributaria > Creditos das notas de entrada',
          'Conferir quais notas geraram credito e quais nao',
          'Listar para o contador as notas sem credito por classificacao fiscal',
          'Salvar print do resumo de importacao e da tela de creditos',
        ],
        sucesso:
          'Notas importadas igual ao numero de arquivos, e lista de notas sem credito produzida.',
        erro: 'Nota rejeitada, certificado vencido (a busca automatica para), CNPJ do emitente divergente.',
        excecoes: 'Nota de servico (NFS-e) tem fluxo proprio, nao entra na importacao de NF-e.',
        regras: 'Nota sem credito por classificacao errada e achado, nao ruido. Sempre listar.',
      },
      {
        codigo: 'NB-03',
        nome: 'Numbra: apurar Simples e gerar DAS',
        area: 'fiscal',
        objetivo: 'Apurar o PGDAS-D e gerar a guia do mes, sem transmitir.',
        gatilho: 'Do dia 1 ao dia 15 de cada mes.',
        nivel: 'nivel_2_supervisionado',
        sistemas: 'Numbra - Fiscal > Simples Nacional',
        pre: 'NF-e e NFS-e do mes importadas. Extrato conciliado quando o regime usa receita de caixa.',
        etapas: [
          'Abrir Fiscal > Simples Nacional > Apuracao (PGDAS-D)',
          'Selecionar empresa e competencia. Confirmar a competencia na tela - erro de mes e o mais comum',
          'Ler a memoria de calculo exibida: faixa, aliquota nominal, parcela a deduzir, aliquota efetiva',
          'Conferir a receita da apuracao contra o total das notas do mes. Divergiu, PARAR e reportar',
          'Gerar a guia e baixar o PDF',
          'Salvar print da memoria de calculo e o PDF da guia',
          'NAO transmitir. Deixar em rascunho e avisar o responsavel',
        ],
        sucesso: 'Guia gerada, memoria de calculo salva, valor conferido contra as notas.',
        erro: 'Receita divergente das notas, empresa em faixa nova nao prevista, erro de validacao do PGDAS.',
        excecoes:
          'Empresa com exportacao ou substituicao tributaria: nao automatizar, e caso de contador.',
        regras: 'A transmissao e sempre humana. O robo apura e gera; quem envia e o contador.',
      },
      {
        codigo: 'NB-04',
        nome: 'Numbra: fechar folha e gerar eSocial',
        area: 'pessoal',
        objetivo: 'Calcular a folha do mes e preparar os eventos do eSocial.',
        gatilho: 'Ate o dia 5 de cada mes.',
        nivel: 'nivel_2_supervisionado',
        sistemas: 'Numbra - Folha > Funcionarios, Calculo, eSocial',
        pre: 'Cadastro de funcionarios completo e atualizado.',
        etapas: [
          'Abrir Folha > Funcionarios e conferir admissoes, demissoes e afastamentos do mes',
          'Rodar o calculo da folha da competencia',
          'Ler o holerite que se explica: verba a verba, o que mudou em relacao ao mes anterior',
          'Listar variacoes acima de 10% para revisao',
          'Abrir Folha > eSocial e gerar os eventos',
          'Conferir se TODOS os eventos foram gerados - evento faltando e autuacao',
          'Salvar print da lista de eventos e do total de funcionarios calculados',
          'NAO transmitir o eSocial. Deixar pronto e avisar',
        ],
        sucesso: 'Folha calculada, eventos gerados, variacoes acima de 10% listadas.',
        erro: 'Funcionario sem cadastro completo, evento rejeitado, divergencia de INSS ou FGTS.',
        excecoes: 'Afastamento por INSS tem evento proprio e prazo curto - tratar como urgente.',
        regras:
          'NUNCA transmitir evento de eSocial sem aprovacao. Recibo e definitivo e gera passivo trabalhista se errado.',
      },
      {
        codigo: 'NB-05',
        nome: 'Numbra: conciliar contas a pagar',
        area: 'contabil',
        objetivo: 'Organizar o que vence e o que ja foi pago.',
        gatilho: 'Semanal, segunda-feira.',
        nivel: 'nivel_1_automatico',
        sistemas: 'Numbra - Financeiro > Contas a pagar',
        pre: 'Conciliacao bancaria do periodo feita.',
        etapas: [
          'Abrir Financeiro > Contas a pagar',
          'Filtrar pelos proximos 7 dias',
          'Cruzar com a conciliacao bancaria: titulo em aberto que ja saiu no extrato e baixa pendente',
          'Usar o retorno CNAB quando existir, para baixar os boletos liquidados',
          'Montar a lista do que vence com valor e empresa',
          'Salvar print da lista',
        ],
        sucesso: 'Lista de vencimentos da semana e titulos que precisam de baixa.',
        erro: 'Titulo sem empresa vinculada, valor divergente do extrato.',
        excecoes: 'Pagamento em lote com aprovacao: o robo organiza, o aprovador decide.',
        regras: 'NUNCA aprovar nem executar pagamento. Quem paga e o humano.',
      },
      {
        codigo: 'NB-06',
        nome: 'Numbra: varredura diaria da Central de Obrigacoes',
        area: 'geral',
        objetivo: 'Saber todo dia o que vence e quem esta devendo entrega, sem planilha paralela.',
        gatilho: 'Diario, 8h.',
        nivel: 'nivel_1_automatico',
        sistemas: 'Numbra - Meu Escritorio > Central de Obrigacoes',
        pre: 'Acesso ao modulo Meu Escritorio.',
        etapas: [
          'Abrir Meu Escritorio > Central de Obrigacoes',
          'Filtrar o que vence em 7 dias',
          'Filtrar o que esta atrasado',
          'Montar duas listas: vencem em 7 dias (empresa, obrigacao, data) e atrasadas (empresa, obrigacao, dias)',
          'Salvar print das duas telas',
          'Marcar como URGENTE atraso acima de 5 dias ou risco de multa',
        ],
        sucesso: 'Duas listas produzidas e enviadas ao responsavel.',
        erro: 'Central indisponivel, empresa sem obrigacoes cadastradas.',
        excecoes:
          'Obrigacao municipal pode nao estar no calendario federal - conferir por empresa.',
        regras:
          'Este e o POP de maior retorno: substitui a planilha de prazos, que hoje e o que mais consome tempo.',
      },
      {
        codigo: 'NB-07',
        nome: 'Numbra: saude e certidoes da carteira',
        area: 'geral',
        objetivo: 'Nao descobrir certificado vencido no dia em que precisa dele.',
        gatilho: 'Semanal.',
        nivel: 'nivel_1_automatico',
        sistemas: 'Numbra - Meu Escritorio > Saude e certidoes',
        pre: 'Acesso ao modulo Meu Escritorio.',
        etapas: [
          'Abrir Meu Escritorio > Saude e certidoes',
          'Listar certificados vencendo em 30 dias',
          'Listar certidoes vencidas ou a vencer',
          'Salvar print e montar lista por empresa',
          'Marcar URGENTE o certificado que vence em menos de 12 dias',
        ],
        sucesso: 'Lista de certificados e certidoes a vencer, com os de 12 dias destacados.',
        erro: 'Empresa sem certificado cadastrado, certidao sem data de validade.',
        excecoes: 'Certificado A3 (token fisico) nao serve para busca automatica - so A1.',
        regras:
          'Sem certificado A1 ativo, a busca automatica de notas PARA. E bloqueio, nao aviso.',
      },
      {
        codigo: 'NB-08',
        nome: 'Numbra: acompanhamento da Reforma Tributaria',
        area: 'fiscal',
        objetivo: 'Acompanhar a transicao de IBS e CBS por empresa, competencia a competencia.',
        gatilho: 'Mensal, junto com o fechamento.',
        nivel: 'nivel_1_automatico',
        sistemas: 'Numbra - Reforma Tributaria',
        pre: 'Notas do mes importadas.',
        etapas: [
          'Abrir Reforma Tributaria > Cronograma e conferir em que ano de transicao estamos',
          'Por empresa, abrir Apuracao de IBS e CBS',
          'Registrar aliquota aplicada, credito de entrada e saldo',
          'Comparar com o mes anterior e apontar variacao acima de 15%',
          'Salvar print por empresa com a variacao',
        ],
        sucesso: 'Relatorio de IBS/CBS por empresa com variacao apontada.',
        erro: 'Empresa sem notas no periodo, aliquota nao configurada.',
        excecoes:
          '2026 e ano-teste, aliquotas informativas. Nao comparar com 2027 como se fosse definitivo.',
        regras:
          "Nao inventar numero. Se a aliquota nao aparece na tela, registrar 'nao disponivel'.",
      },
      {
        codigo: 'NB-09',
        nome: 'Numbra: envio mensal pelo Portal do Cliente',
        area: 'atendimento',
        objetivo: 'Entregar guias e relatorios sem o cliente precisar pedir.',
        gatilho: 'Ao fechar o mes.',
        nivel: 'nivel_2_supervisionado',
        sistemas: 'Numbra - Portal do Cliente',
        pre: 'Fechamento do mes concluido e guias geradas.',
        etapas: [
          'Abrir Portal do Cliente',
          'Conferir se as guias do mes estao publicadas',
          'Conferir se os holerites estao publicados',
          "Verificar a secao 'O escritorio pediu' - o que o cliente enviou e falta tratar",
          'Salvar print do portal por empresa',
        ],
        sucesso: 'Guias e holerites publicados conferidos, pendencias do cliente listadas.',
        erro: 'Documento nao publicado, cliente sem acesso ao portal.',
        excecoes: 'Cliente sem e-mail cadastrado nao recebe convite do portal.',
        regras:
          'NUNCA enviar comunicacao ao cliente sem revisao humana. Erro de envio nao se desfaz.',
      },
    ]

    let criados = 0
    let atualizados = 0

    for (let i = 0; i < POPS.length; i++) {
      const p = POPS[i]
      let rec = null
      try {
        const achou = app.findRecordsByFilter(
          'sops',
          'tenant_id = {:t} && codigo = {:c}',
          '',
          1,
          0,
          { t: tenantId, c: p.codigo },
        )
        if (achou.length > 0) rec = achou[0]
      } catch (_) {}

      const novo = !rec
      if (!rec) rec = new Record(col)

      rec.set('tenant_id', tenantId)
      rec.set('codigo', p.codigo)
      rec.set('nome', p.nome)
      rec.set('area', p.area)
      rec.set('versao', '1.0')
      rec.set('objetivo', p.objetivo)
      rec.set('gatilho', p.gatilho)
      rec.set('pre_condicoes', p.pre)
      rec.set('sistemas_utilizados', p.sistemas)
      rec.set('agente_nome', 'ELLIZA')
      rec.set('nivel_autonomia', p.nivel)
      rec.set('requer_aprovacao', p.nivel !== 'nivel_1_automatico')
      rec.set('criterios_sucesso', p.sucesso)
      rec.set('criterios_erro', p.erro)
      rec.set('excecoes', p.excecoes)
      rec.set('regras_negocio', p.regras)
      rec.set('ativo', true)

      const etapas = []
      for (let j = 0; j < p.etapas.length; j++) {
        etapas.push({ ordem: j + 1, descricao: p.etapas[j], tipo: 'execucao' })
      }
      rec.set('etapas_template_json', etapas)

      app.save(rec)
      if (novo) criados++
      else atualizados++
    }

    console.log('[0152] POPs Numbra: ' + criados + ' criados, ' + atualizados + ' atualizados')
  },
  (app) => {
    const tenantId = 'l91og8ybo9krtay'
    const codigos = [
      'NB-01',
      'NB-02',
      'NB-03',
      'NB-04',
      'NB-05',
      'NB-06',
      'NB-07',
      'NB-08',
      'NB-09',
    ]
    for (let i = 0; i < codigos.length; i++) {
      try {
        const achou = app.findRecordsByFilter(
          'sops',
          'tenant_id = {:t} && codigo = {:c}',
          '',
          1,
          0,
          { t: tenantId, c: codigos[i] },
        )
        if (achou.length > 0) app.delete(achou[0])
      } catch (_) {}
    }
  },
)

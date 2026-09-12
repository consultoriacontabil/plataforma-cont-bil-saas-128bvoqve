/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Obter tenants e empresas
    let tenantId = 'l91og8ybo9krtay'
    try {
      const t = app.findFirstRecordByData('tenants', 'ativo', true)
      if (t) tenantId = t.id
    } catch (_) {}

    let inovaId = 'feb9h004jovi7xh'
    let graosId = 'xgfoy8yifisdc0n'
    try {
      const inova = app.findFirstRecordByData('empresas', 'nome_fantasia', 'Inovatech Software')
      if (inova) inovaId = inova.id
    } catch (_) {}
    try {
      const graos = app.findFirstRecordByData('empresas', 'nome_fantasia', 'Grãos do Sul Cafeteria')
      if (graos) graosId = graos.id
    } catch (_) {}

    let userId = ''
    try {
      const u = app.findFirstRecordByData(
        '_pb_users_auth_',
        'email',
        'rumo@rumoconsultoriacontabil.com.br',
      )
      if (u) userId = u.id
    } catch (_) {}

    const spedCol = app.findCollectionByNameOrId('sped_arquivos')
    const pubCol = app.findCollectionByNameOrId('publicacoes_legislativas')

    // 1. SEED SPED ARQUIVOS DEMONSTRATIVOS
    // 1.1 Inovatech ECD 2026 (Competência 08/2026)
    try {
      app.findFirstRecordByData('sped_arquivos', 'hash_md5', '3c2f1a8e9d0b45781a93b4e6781290fa')
    } catch (_) {
      const rec1 = new Record(spedCol)
      rec1.set('tenant_id', tenantId)
      rec1.set('empresa', inovaId)
      rec1.set('tipo', 'ecd')
      rec1.set('competencia', '08/2026')
      rec1.set('ano_calendario', 2026)
      rec1.set('versao_layout', 'v010')
      rec1.set('finalidade', 'original')
      rec1.set('status', 'gerado')
      rec1.set('hash_md5', '3c2f1a8e9d0b45781a93b4e6781290fa')
      rec1.set('total_linhas', 28)
      rec1.set('tamanho_bytes', 1840)
      rec1.set(
        'conteudo_txt',
        '|0000|LECD|01082026|31082026|Inovatech Soluções Digitais Ltda|33456789000112|SP|123456789001|3550308||0|1|1|10.00||\n' +
          '|0001|0|\n' +
          '|0007|00||\n' +
          '|0990|4|\n' +
          '|I001|0|\n' +
          '|I010|G|10.00|\n' +
          '|I030|TERMO DE ABERTURA|1|LIVRO DIARIO GERAL|01082026|31082026|Inovatech Soluções Digitais Ltda|33456789000112||\n' +
          '|I050|01082026|01|S|1|1|ATIVO||\n' +
          '|I050|01082026|01|A|2|1.1.1.02|Bancos Conta Movimento||\n' +
          '|I050|01082026|01|A|2|3.1.1|Receita de Venda de Servicos e Licencas||\n' +
          '|I050|01082026|01|A|2|4.1.1|Salarios, Ferias e 13o Salario||\n' +
          '|I150|01082026|31082026|\n' +
          '|I155|1.1.1.02||45000.00|D|45000.00|22000.00|68000.00|D|\n' +
          '|I155|3.1.1||0.00|C|0.00|45000.00|45000.00|C|\n' +
          '|I155|4.1.1||0.00|D|18500.00|0.00|18500.00|D|\n' +
          '|I200|LOTE-2026-08-001|05082026|45000.00|N|\n' +
          '|I250|1.1.1.02|0.00|45000.00|D||Recebimento software NFSe 1042||\n' +
          '|I250|3.1.1|0.00|45000.00|C||Recebimento software NFSe 1042||\n' +
          '|I990|15|\n' +
          '|J001|0|\n' +
          '|J005|01082026|31082026|1|BALANCETE DE VERIFICACAO MENSAL|\n' +
          '|J990|3|\n' +
          '|9001|0|\n' +
          '|9900|0000|1|\n' +
          '|9900|I050|4|\n' +
          '|9900|I155|3|\n' +
          '|9990|6|\n' +
          '|9999|28|',
      )
      rec1.set('resumo_blocos_json', { 0: 4, I: 15, J: 3, 9: 6 })
      rec1.set(
        'observacoes',
        'Gerado conforme Manual de Orientação do Leiaute 10 da ECD (Instrução Normativa RFB nº 2.003/2021).',
      )
      if (userId) rec1.set('gerado_por', userId)
      app.save(rec1)
    }

    // 1.2 Grãos do Sul EFD-ICMS/IPI (Competência 08/2026)
    try {
      app.findFirstRecordByData('sped_arquivos', 'hash_md5', '7f8a9b2c3d4e5f60718293a4b5c6d7e8')
    } catch (_) {
      const rec2 = new Record(spedCol)
      rec2.set('tenant_id', tenantId)
      rec2.set('empresa', graosId)
      rec2.set('tipo', 'efd_icms_ipi')
      rec2.set('competencia', '08/2026')
      rec2.set('ano_calendario', 2026)
      rec2.set('versao_layout', 'v020')
      rec2.set('finalidade', 'original')
      rec2.set('status', 'validado')
      rec2.set('hash_md5', '7f8a9b2c3d4e5f60718293a4b5c6d7e8')
      rec2.set('total_linhas', 24)
      rec2.set('tamanho_bytes', 1580)
      rec2.set(
        'conteudo_txt',
        '|0000|020|0|01082026|31082026|Café & Grãos Gourmet do Sul Comércio Ltda|18902345000188||PR|543210987002|4106902|||A|1|\n' +
          '|0001|0|\n' +
          '|0005|Grãos do Sul Cafeteria|80020000|Rua XV de Novembro|450|Loja 2|Centro|4133221100||contato@graosdosul.com.br|\n' +
          '|0100|Contador Responsavel|12345678901|PR-098765/O-2|00000000000191|80020000|Rua XV|450||Centro|4133221100||contador@rumo.com.br|4106902|\n' +
          '|0990|5|\n' +
          '|C001|0|\n' +
          '|C100|0|1|CLI-01|55|00|1|4001|4126091890234500018856001000000400199228833|10082026|10082026|4800.00|1|0.00|0.00|4800.00|0|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|\n' +
          '|C190|0102|5102|18.00|4800.00|4800.00|864.00|0.00|0.00|0.00|0.00|0.00||\n' +
          '|C990|4|\n' +
          '|E001|0|\n' +
          '|E100|01082026|31082026|\n' +
          '|E110|864.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|864.00|0.00|0.00|864.00|0.00|0.00|\n' +
          '|E990|4|\n' +
          '|1001|0|\n' +
          '|1010|N|N|N|N|N|N|N|N|N|N|N|N|N|\n' +
          '|1990|3|\n' +
          '|9001|0|\n' +
          '|9900|0000|1|\n' +
          '|9900|C100|1|\n' +
          '|9900|E110|1|\n' +
          '|9990|5|\n' +
          '|9999|24|',
      )
      rec2.set('resumo_blocos_json', { 0: 5, C: 4, E: 4, 1: 3, 9: 8 })
      rec2.set(
        'observacoes',
        'Layout Guia Prático da EFD-ICMS/IPI versão 3.1.6 (Ato COTEPE/ICMS nº 44/2018 e alterações). Validado com sucesso de estrutura.',
      )
      if (userId) rec2.set('gerado_por', userId)
      app.save(rec2)
    }

    // 2. SEED PUBLICAÇÕES LEGISLATIVAS REALISTAS (Módulo 3: Monitoramento com cálculo de impacto)
    // 2.1 MUDANÇA DE ALÍQUOTA - LC nº 214/2025 Reforma Tributária (CBS/IBS)
    try {
      app.findFirstRecordByData('publicacoes_legislativas', 'numero_norma', 'LC nº 214/2025')
    } catch (_) {
      const pub1 = new Record(pubCol)
      pub1.set('tenant_id', tenantId)
      pub1.set(
        'titulo',
        'Reforma Tributária: Regulamentação da CBS e IBS e Novas Alíquotas de Transição',
      )
      pub1.set('numero_norma', 'LC nº 214/2025')
      pub1.set('fonte', 'dou')
      pub1.set('data_publicacao', '2026-09-11 08:00:00.000Z')
      pub1.set('data_vigencia', '2027-01-01 00:00:00.000Z')
      pub1.set('classificacao', 'aliquota')
      pub1.set('criticidade', 'alta')
      pub1.set(
        'resumo',
        'Fixação da alíquota teste da CBS federal em 0,90% e do IBS subnacional em 0,10% para o ano de transição 2026/2027, com compensação integral de PIS/COFINS e regras de créditos sobre insumos.',
      )
      pub1.set(
        'conteudo_completo',
        'Dispõe sobre a instituição do Imposto sobre Bens e Serviços (IBS), da Contribuição Social sobre Bens e Serviços (CBS) e do Imposto Seletivo (IS), conforme Emenda Constitucional nº 132/2023. Artigo 18 define que a apuração é baseada no princípio do destino com creditamento financeiro integral.',
      )
      pub1.set('link_oficial', 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm')
      pub1.set('tributo_afetado', 'CBS / IBS')
      pub1.set('aliquota_anterior', 0.65)
      pub1.set('aliquota_nova', 0.9)
      pub1.set('regimes_afetados_json', ['lucro_presumido', 'lucro_real', 'simples_nacional'])
      pub1.set('setores_afetados_json', [
        'tecnologia_software',
        'comercio_varejista',
        'servicos_gerais',
      ])
      pub1.set('impacto_calculado_json', {
        totalEmpresasAfetadas: 2,
        variacaoPercentualAliquota: 38.46,
        impactoFinanceiroMensalTotal: 1420.5,
        detalhesPorEmpresa: [
          {
            empresaId: inovaId,
            nome: 'Inovatech Software',
            faturamentoMedioMensal: 52000,
            custoAnteriorMensal: 338,
            custoNovoMensal: 468,
            impactoFinanceiro: 130,
            impactoPercentual: 38.46,
            orientacao:
              'Empresa do Simples Nacional com teto de crédito transferível. Avaliar migração de regime na transição.',
          },
          {
            empresaId: graosId,
            nome: 'Grãos do Sul Cafeteria',
            faturamentoMedioMensal: 28000,
            custoAnteriorMensal: 182,
            custoNovoMensal: 252,
            impactoFinanceiro: 70,
            impactoPercentual: 38.46,
            orientacao:
              'Comércio varejista de alimentos. Cesta básica com alíquota reduzida a ser confrontada.',
          },
        ],
      })
      pub1.set('status', 'nova')
      pub1.set('origem_captura', 'manual_supervisionado')
      app.save(pub1)
    }

    // 2.2 Instrução Normativa RFB nº 2.210/2025 - Cronograma e layout DCTFWeb
    try {
      app.findFirstRecordByData('publicacoes_legislativas', 'numero_norma', 'IN RFB nº 2.210/2025')
    } catch (_) {
      const pub2 = new Record(pubCol)
      pub2.set('tenant_id', tenantId)
      pub2.set('titulo', 'Nova Versão de DCTFWeb e Validação Cruzada com EFD-Reinf Série R-4000')
      pub2.set('numero_norma', 'IN RFB nº 2.210/2025')
      pub2.set('fonte', 'rfb')
      pub2.set('data_publicacao', '2026-09-08 10:30:00.000Z')
      pub2.set('data_vigencia', '2026-10-01 00:00:00.000Z')
      pub2.set('classificacao', 'obrigacao_acessoria')
      pub2.set('criticidade', 'media')
      pub2.set(
        'resumo',
        'Determina a obrigatoriedade de envio consolidado da DCTFWeb até o dia 25 do mês subsequente, vinculando as retenções na fonte de IRRF, CSLL, PIS e COFINS declaradas no EFD-Reinf.',
      )
      pub2.set(
        'conteudo_completo',
        'A Secretaria Especial da Receita Federal do Brasil atualiza as normas complementares da DCTFWeb. Ficam revogados os prazos provisórios para empresas do grupo 3 do e-Social.',
      )
      pub2.set('link_oficial', 'https://normas.receita.fazenda.gov.br')
      pub2.set('tributo_afetado', 'DCTFWeb / DARF Previdenciário')
      pub2.set('regimes_afetados_json', ['simples_nacional', 'lucro_presumido', 'lucro_real'])
      pub2.set('setores_afetados_json', ['todos'])
      pub2.set('impacto_calculado_json', {
        totalEmpresasAfetadas: 2,
        impactoFinanceiroMensalTotal: 0,
        detalhesPorEmpresa: [
          {
            empresaId: inovaId,
            nome: 'Inovatech Software',
            orientacao: 'Conferir fechamento do evento S-1299 antes do dia 25.',
          },
          {
            empresaId: graosId,
            nome: 'Grãos do Sul Cafeteria',
            orientacao:
              'Certificar que guias DARF Previdenciário são geradas pela DCTFWeb unificada.',
          },
        ],
      })
      pub2.set('status', 'analisada')
      pub2.set('origem_captura', 'manual_supervisionado')
      if (userId) pub2.set('analisado_por', userId)
      pub2.set('analisado_em', '2026-09-09 14:00:00.000Z')
      pub2.set(
        'notas_analise',
        'Equipe técnica orientada sobre a validação cruzada do R-4020 antes da transmissão.',
      )
      app.save(pub2)
    }

    // 2.3 Resolução CGSN nº 180/2025 - Ajuste de sublimites estaduais do Simples
    try {
      app.findFirstRecordByData(
        'publicacoes_legislativas',
        'numero_norma',
        'Resolução CGSN nº 180/2025',
      )
    } catch (_) {
      const pub3 = new Record(pubCol)
      pub3.set('tenant_id', tenantId)
      pub3.set('titulo', 'Sublimites de ICMS e ISS no Simples Nacional para o Ano-Calendário')
      pub3.set('numero_norma', 'Resolução CGSN nº 180/2025')
      pub3.set('fonte', 'comite_gestor_ibs')
      pub3.set('data_publicacao', '2026-09-05 09:15:00.000Z')
      pub3.set('data_vigencia', '2026-09-05 00:00:00.000Z')
      pub3.set('classificacao', 'norma_geral')
      pub3.set('criticidade', 'baixa')
      pub3.set(
        'resumo',
        'Confirmação do sublimite de R$ 3,6 milhões de faturamento bruto para efeito de recolhimento de ICMS e ISS no Simples Nacional nos estados participantes.',
      )
      pub3.set('link_oficial', 'https://www.gov.br/receitafederal/pt-br/assuntos/simples-nacional')
      pub3.set('tributo_afetado', 'ICMS / ISS')
      pub3.set('regimes_afetados_json', ['simples_nacional'])
      pub3.set('setores_afetados_json', ['comercio_varejista', 'tecnologia_software'])
      pub3.set('impacto_calculado_json', {
        totalEmpresasAfetadas: 2,
        impactoFinanceiroMensalTotal: 0,
        detalhesPorEmpresa: [],
      })
      pub3.set('status', 'arquivada')
      pub3.set('origem_captura', 'importacao_json')
      app.save(pub3)
    }

    // 2.4 Decreto Estadual SEFAZ-PR nº 7.890/2026 - Mudança de Alíquota Interna de ICMS no Paraná
    try {
      app.findFirstRecordByData(
        'publicacoes_legislativas',
        'numero_norma',
        'Decreto PR nº 7.890/2026',
      )
    } catch (_) {
      const pub4 = new Record(pubCol)
      pub4.set('tenant_id', tenantId)
      pub4.set('titulo', 'Ajuste da Alíquota Modal Interna do ICMS no Estado do Paraná para 19,5%')
      pub4.set('numero_norma', 'Decreto PR nº 7.890/2026')
      pub4.set('fonte', 'sefaz_estadual')
      pub4.set('data_publicacao', '2026-09-12 07:30:00.000Z')
      pub4.set('data_vigencia', '2026-10-01 00:00:00.000Z')
      pub4.set('classificacao', 'aliquota')
      pub4.set('criticidade', 'alta')
      pub4.set(
        'resumo',
        'Altera a alíquota geral interna do ICMS no Estado do Paraná de 19,0% para 19,5% sobre operações com mercadorias e prestação de serviços de transporte e comunicação.',
      )
      pub4.set(
        'conteudo_completo',
        'O Governador do Estado do Paraná regulamenta o acréscimo de 0,5% na alíquota modal de ICMS. Empresas varejistas com regime de débito e crédito ou cálculo de DIFAL devem adequar seus sistemas emissores de NF-e.',
      )
      pub4.set('link_oficial', 'https://www.fazenda.pr.gov.br/legislacao')
      pub4.set('tributo_afetado', 'ICMS PR')
      pub4.set('aliquota_anterior', 19.0)
      pub4.set('aliquota_nova', 19.5)
      pub4.set('regimes_afetados_json', ['simples_nacional', 'lucro_presumido', 'lucro_real'])
      pub4.set('setores_afetados_json', ['comercio_varejista', 'distribuicao_alimentos'])
      pub4.set('impacto_calculado_json', {
        totalEmpresasAfetadas: 1,
        variacaoPercentualAliquota: 2.63,
        impactoFinanceiroMensalTotal: 140.0,
        detalhesPorEmpresa: [
          {
            empresaId: graosId,
            nome: 'Grãos do Sul Cafeteria',
            uf: 'PR',
            faturamentoMedioMensal: 28000,
            custoAnteriorMensal: 5320,
            custoNovoMensal: 5460,
            impactoFinanceiro: 140.0,
            impactoPercentual: 2.63,
            orientacao:
              'Empresa sediada em Curitiba/PR. Atualizar tributação de compras interestaduais (DIFAL) e cadastro de mercadorias no PDV.',
          },
        ],
      })
      pub4.set('status', 'nova')
      pub4.set('origem_captura', 'manual_supervisionado')
      app.save(pub4)
    }

    // 2.5 Portaria Conjunta RFB/PGFN nº 12/2026 - Prorrogação de Prazos do PERT
    try {
      app.findFirstRecordByData(
        'publicacoes_legislativas',
        'numero_norma',
        'Portaria RFB nº 12/2026',
      )
    } catch (_) {
      const pub5 = new Record(pubCol)
      pub5.set('tenant_id', tenantId)
      pub5.set('titulo', 'Prorrogação Extraordinária do Prazo de Parcelamentos Federais Ativos')
      pub5.set('numero_norma', 'Portaria RFB nº 12/2026')
      pub5.set('fonte', 'rfb')
      pub5.set('data_publicacao', '2026-09-10 11:00:00.000Z')
      pub5.set('data_vigencia', '2026-09-10 00:00:00.000Z')
      pub5.set('classificacao', 'prazo')
      pub5.set('criticidade', 'media')
      pub5.set(
        'resumo',
        'Prorroga em 10 dias úteis o vencimento das parcelas de acordos fiscais federais com vencimento no final do mês em decorrência de manutenção programada no portal e-CAC.',
      )
      pub5.set('link_oficial', 'https://normas.receita.fazenda.gov.br')
      pub5.set('tributo_afetado', 'Parcelamentos Federais')
      pub5.set('regimes_afetados_json', ['simples_nacional', 'lucro_presumido', 'lucro_real'])
      pub5.set('setores_afetados_json', ['todos'])
      pub5.set('impacto_calculado_json', {
        totalEmpresasAfetadas: 2,
        impactoFinanceiroMensalTotal: 0,
        detalhesPorEmpresa: [],
      })
      pub5.set('status', 'analisada')
      pub5.set('origem_captura', 'api_dou_simulada')
      if (userId) pub5.set('analisado_por', userId)
      pub5.set('analisado_em', '2026-09-10 14:00:00.000Z')
      pub5.set('notas_analise', 'Comunicado divulgado aos clientes com parcelamento ativo.')
      app.save(pub5)
    }
  },
  (app) => {
    // Reverter seeds de teste se necessário
  },
)

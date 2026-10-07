migrate(
  (app) => {
    // Migration 0118: Catálogo de SOPs versão 2026.4 (aditiva, NÃO mutar linhas existentes de sops nem registros de processos/jobs/etapas/evidencias/pendencias)
    // 19 POPs revisados na versão 2026.4
    // Marcação das versões 2026.3 anteriores como ativo=false (não-vigentes para novas instâncias), preservando histórico intacto.
    const sopsCol = app.findCollectionByNameOrId('sops')
    const allTenants = app.findRecordsByFilter('tenants', 'ativo = true', 'created', 50, 0)

    // Catálogo 2026.4 com 19 POPs revisados
    const catalogo20264 = [
      {
        codigo: 'POP-01',
        nome: 'Onboarding de Clientes, Ficha Cadastral e Propostas',
        area: 'societario',
        versao: '2026.4',
        objetivo:
          'Onboarding estruturado com Ficha Cadastral Completa (#rpa-empresa-ficha, #rpa-grid-qsa), propostas vinculadas em trilhas paralelas (Comercial x Documentos) e token público seguro.',
        gatilho: 'Novo cliente contratado, proposta assinada ou cadastro assistido iniciado.',
        pre_condicoes: 'CNPJ válido e dados cadastrais básicos fornecidos pelo cliente.',
        entradas: 'Cartão CNPJ, Contrato Social no GED, Ficha Cadastral e Certificado Digital A1.',
        sistemas_utilizados:
          'Plataforma Rumo, Ficha Cadastral Completa, GED Contábil, Tokens Públicos.',
        responsavel_cargo: 'Analista de Onboarding / Contador Responsável',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_2_supervisionado',
        requer_aprovacao: true,
        saida:
          'Ficha Cadastral Completa (#rpa-empresa-ficha) validada, QSA importado (#rpa-grid-qsa) e empresa liberada.',
        proximo_processo:
          'POP-05 (Conciliação Bancária) e POP-DP-01 (Quadro Societário e Pró-labore)',
        regras_negocio:
          'Etapa central: Ficha Cadastral Completa (#rpa-empresa-ficha, #rpa-grid-qsa) com blocos Identificação, Societário e Parametrização. Propostas vinculadas com trilhas paralelas (Proposta Comercial x Documentos) com responsabilidade segregada Cliente vs Contabilidade. Links públicos gerados estritamente via /pedidos-documentos/:token_publico e /abertura/:token. Importação automatizada de sócios a partir dos contratos do GED.',
        criterios_sucesso:
          'Ficha cadastral preenchida sem campos nulos indevidos, QSA conciliado e checklist de onboarding 100% deferido.',
        criterios_erro: 'CNPJ inapto, discrepância no QSA contratual ou certificado A1 inválido.',
        excecoes:
          'Caso o cliente ainda não tenha certificado A1, avança em modo assistido com procuração eletrônica RFB.',
        etapas: [
          {
            ordem: 1,
            titulo:
              'Consultar CNPJ na RFB e preencher Ficha Cadastral Completa (#rpa-empresa-ficha)',
            descricao:
              'Capturar dados cadastrais oficiais e alimentar blocos Identificação, Endereço e Parametrização na Ficha Cadastral.',
            entrada: 'CNPJ do cliente',
            acao: 'Consultar API oficial de CNPJs e estruturar ficha cadastral com telemetria #rpa-empresa-ficha.',
            criterio_sucesso:
              'Ficha cadastral preenchida com Razão Social, CNAEs, Regime e Localização.',
            criterio_erro: 'CNPJ não localizado ou com situação cadastral baixada/inapta.',
            proxima_etapa_nome: 'Importar Quadro Societário dos Contratos do GED (#rpa-grid-qsa)',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 2,
            titulo: 'Importar Quadro Societário dos Contratos do GED (#rpa-grid-qsa)',
            descricao:
              'Extrair sócios, quotas, capital social e poderes de administração dos contratos arquivados no GED.',
            entrada: 'Contrato Social / Alteração Contratual em PDF no GED',
            acao: 'Processar extração de sócios via OCR/Parser e popular tabela de sócios com telemetria #rpa-grid-qsa.',
            criterio_sucesso:
              '100% dos sócios contratuais cadastrados com CPF, participação e qualificação.',
            criterio_erro: 'Soma de quotas societárias diferente de 100% ou contrato ilegível.',
            proxima_etapa_nome:
              'Gerar Proposta Comercial e Pedido de Documentos em Trilhas Paralelas',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 3,
            titulo: 'Gerar Proposta Comercial e Pedido de Documentos em Trilhas Paralelas',
            descricao:
              'Disparar trilhas simultâneas: Proposta de Honorários e Checklist de Documentos com token público seguro.',
            entrada:
              'Regime tributário, faturamento estimado e matriz de responsabilidade Cliente x Escritório',
            acao: 'Emitir minuta de proposta (/abertura/:token) e enfileirar pedido de documentos (/pedidos-documentos/:token_publico).',
            criterio_sucesso:
              'Links públicos seguros gerados e notificação disparada com tokens válidos.',
            criterio_erro: 'Falha na geração de tokens criptográficos ou contatos ausentes.',
            proxima_etapa_nome: 'Validação e Deferimento do Onboarding pelo Contador (Nível 2/3)',
            requer_aprovacao: true,
            responsavel_tipo: 'Humano',
          },
          {
            ordem: 4,
            titulo: 'Validação e Deferimento do Onboarding pelo Contador (Nível 2/3)',
            descricao:
              'Conferência técnica final da Ficha Cadastral, proposta assinada e cofre A1 antes da ativação plena.',
            entrada: 'Ficha Cadastral, QSA, A1 e aceite de proposta',
            acao: 'Chancelar onboarding no audit_log com CRC ativo e liberar empresa para as rotinas contábeis/fiscais.',
            criterio_sucesso:
              'Empresa ativada no banco com protocolo CFC e notificações de boas-vindas concluídas.',
            criterio_erro: 'Documentação essencial faltante sem justificativa técnica.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: true,
            responsavel_tipo: 'Humano',
          },
        ],
      },
      {
        codigo: 'POP-02',
        nome: 'Folha de Pagamento CLT, Férias, Rescisões & e-Social',
        area: 'pessoal',
        versao: '2026.4',
        objetivo:
          'Ciclo mensal da folha de pagamento CLT com eventos de admissão, férias, rescisões e transmissão assistida ao e-Social.',
        gatilho: 'Dia 20 de cada mês ou evento trabalhista.',
        pre_condicoes: 'Colaboradores ativos cadastrados com fichas atualizadas.',
        entradas:
          'Espelho de ponto, eventos variáveis, atestados e parâmetros normativos vigentes.',
        sistemas_utilizados:
          'Plataforma Rumo DP, Motor Normativo CLT, e-Social e Portal do Empregado.',
        responsavel_cargo: 'Analista de Departamento Pessoal',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_2_supervisionado',
        requer_aprovacao: true,
        saida:
          'Holerites com protocolo SHA-256 no Portal do Empregado e lote de provisão contábil.',
        proximo_processo: 'POP-04 (Fechamento Contábil) e POP-18 (Portal do Empregado)',
        etapas: [
          {
            ordem: 1,
            titulo: 'Coletar variáveis e ocorrências da folha',
            descricao: 'Importar horas extras, faltas, adicionais e benefícios da competência.',
            entrada: 'Planilha de variáveis ou apontamentos do DP',
            acao: 'Consolidar eventos na ficha mensal de cada colaborador.',
            criterio_sucesso: '100% dos colaboradores ativos com variáveis registradas.',
            criterio_erro: 'Divergência de matrículas ou eventos não cadastrados.',
            proxima_etapa_nome: 'Calcular folha de pagamento e encargos',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 2,
            titulo: 'Calcular folha de pagamento e encargos',
            descricao: 'Aplicar tabelas progressivas de INSS e IRRF, FGTS e calcular líquidos.',
            entrada: 'Variáveis da folha e parâmetros normativos',
            acao: 'Executar motor unificado de cálculo trabalhista CLT.',
            criterio_sucesso: 'Líquidos e encargos apurados sem divergências aritméticas.',
            criterio_erro: 'Erro de cálculo ou parâmetros legais desatualizados.',
            proxima_etapa_nome: 'Conferência técnica pelo Contador / DP (Nível 3)',
            requer_aprovacao: true,
            responsavel_tipo: 'Humano',
          },
          {
            ordem: 3,
            titulo: 'Conferência técnica pelo Contador / DP (Nível 3)',
            descricao:
              'Revisar totais de proventos, descontos e encargos patronais antes do fechamento.',
            entrada: 'Resumo da folha analítico',
            acao: 'Aprovar formalmente o lote da folha no Modo Humano com despacho e CRC.',
            criterio_sucesso: 'Chancela técnica registrada no audit_log.',
            criterio_erro: 'Ressalva apontada pelo analista de DP.',
            proxima_etapa_nome: 'Publicar holerites e gerar lote de integração contábil',
            requer_aprovacao: true,
            responsavel_tipo: 'Humano',
          },
          {
            ordem: 4,
            titulo: 'Publicar holerites no Portal do Empregado e gerar lote contábil',
            descricao:
              'Disponibilizar recibos assinados aos colaboradores e exportar provisões contábeis.',
            entrada: 'Lote aprovado',
            acao: 'Publicar holerites com token no Portal e alimentar lote LOTE-FOLHA no Fecho Contábil.',
            criterio_sucesso: 'Holerites acessíveis no Portal do Empregado e lote contábil gerado.',
            criterio_erro: 'Falha na publicação de recibos ou integração contábil.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
        ],
      },
      {
        codigo: 'POP-03',
        nome: 'Rotina Fiscal, Apurações DAS/DARF & Parcelamentos',
        area: 'fiscal',
        versao: '2026.4',
        objetivo:
          'Ciclo mensal de apuração fiscal dos regimes Simples Nacional e Lucro Presumido com geração assistida de guias e parcelamentos.',
        gatilho: 'Dia 05 de cada mês ou recebimento de XMLs fiscais.',
        pre_condicoes: 'XMLs de NF-e e NFS-e importados na competência.',
        entradas: 'Faturamento, retenções na fonte e extratos tributários.',
        sistemas_utilizados: 'Plataforma Rumo Fiscal, PGDAS-D, DCTFWeb e e-CAC.',
        responsavel_cargo: 'Analista Fiscal / Contador',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_2_supervisionado',
        requer_aprovacao: true,
        saida: 'Memória de cálculo, DAS/DARF gerados e registrados para envio.',
        proximo_processo: 'POP-04 (Fechamento Contábil) e POP-10 (Envio de Guias)',
        etapas: [
          {
            ordem: 1,
            titulo: 'Consolidar documentos fiscais e segregar receitas',
            descricao: 'Classificar notas por anexo e verificar retenções federais e municipais.',
            entrada: 'XMLs fiscais da competência',
            acao: 'Agrupar receitas por regime e apurar base de cálculo efetiva.',
            criterio_sucesso: 'Todas as notas classificadas sem divergência de CFOP/CNAE.',
            criterio_erro: 'Nota fiscal com chave corrompida ou duplicada.',
            proxima_etapa_nome: 'Apurar tributos e emitir memória de cálculo',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 2,
            titulo: 'Apurar tributos e emitir memória de cálculo',
            descricao: 'Calcular alíquotas efetivas do Simples ou presunções de IRPJ/CSLL.',
            entrada: 'Receitas segregadas e RBT12',
            acao: 'Calcular DAS/DARF com memória analítica de conferência.',
            criterio_sucesso: 'Tributos calculados conforme legislação tributária vigente.',
            criterio_erro: 'Erro no cálculo do fator R ou faixa do Simples.',
            proxima_etapa_nome: 'Conferência técnica pelo Contador (Nível 3)',
            requer_aprovacao: true,
            responsavel_tipo: 'Humano',
          },
          {
            ordem: 3,
            titulo: 'Conferência técnica pelo Contador (Nível 3)',
            descricao: 'Revisão das deduções de retenção na fonte e aprovação final da guia.',
            entrada: 'Memória de cálculo analítica',
            acao: 'Chancelar valores e autorizar emissão da guia oficial no Modo Humano.',
            criterio_sucesso: 'Aprovação registrada com CRC no audit_log.',
            criterio_erro: 'Rejeição fundamentada pelo contador.',
            proxima_etapa_nome: 'Emitir guias oficiais com código de barras e PIX',
            requer_aprovacao: true,
            responsavel_tipo: 'Humano',
          },
          {
            ordem: 4,
            titulo: 'Emitir guias oficiais com código de barras e PIX',
            descricao:
              'Gerar guias em guias_pagamentos prontas para envio (separar Geração de Envio).',
            entrada: 'Aprovação humana registrada',
            acao: 'Registrar guias com linha digitável e código PIX Copia e Cola.',
            criterio_sucesso: 'Guia registrada no sistema com status aguardando_envio.',
            criterio_erro: 'Falha na geração de linha digitável ou PIX EMV.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
        ],
      },
      {
        codigo: 'POP-04',
        nome: 'Fechamento Contábil Mensal & Trilha RPA v1.0',
        area: 'contabil',
        versao: '2026.4',
        objetivo:
          'Ciclo completo de fechamento contábil mensal em 16 etapas FCT-04 instrumentado com a Trilha RPA v1.0 (telemetria determinística, hash SHA-256 e equacionamento patrimonial).',
        gatilho: 'Vencimento da competência contábil (mensal).',
        pre_condicoes: 'Mês calendário anterior encerrado e documentos da competência importados.',
        entradas:
          'Extratos OFX/CSV, notas fiscais, faturas de cartão, lotes LOTE-FOLHA e LOTE-FISC.',
        sistemas_utilizados:
          'Plataforma Rumo Contábil, Trilha RPA v1.0, Módulo Balancete, Diário Contábil e GED.',
        responsavel_cargo: 'Contador Responsável CRC',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_3_aprovacao_obrigatoria',
        requer_aprovacao: true,
        saida:
          'Balancete de Verificação (#rpa-grid-balancete), DRE, Balanço Patrimonial e Competência Travada.',
        proximo_processo: 'Demonstrativos e Assinaturas Digitais (CFC)',
        regras_negocio:
          'Trilha RPA v1.0 estrita: cada uma das 16 etapas carrega atributos data-step-status, data-step-code (FCT-04-01 a FCT-04-16) e data-job-id. O botão #rpa-btn-executar expõe data-action-code e data-enabled-reason. A conclusão é refletida no seletor #rpa-status-conclusao com data-rpa-state. O grid do balancete #rpa-grid-balancete atesta data-diferenca="0.00" e data-rpa-equilibrado="true". Nenhum fechamento é aprovado sem equilíbrio Débito = Crédito.',
        criterios_sucesso:
          '16 etapas FCT-04 concluídas, Débitos = Créditos (Diferença = R$ 0,00), trava retroativa ativada e parecer com CRC.',
        criterios_erro:
          'Desbalanceamento patrimonial, pendências bancárias não justificadas ou inconsistência fiscal.',
        excecoes:
          'Havendo divergência contábil, o processo é retido no Modo Humano com pendência formal estruturada.',
        etapas: [
          {
            ordem: 1,
            titulo: 'Receber documentos da competência (FCT-04-01)',
            descricao: 'Coletar extratos bancários, faturas e comprovantes enviados pelo cliente.',
            entrada: 'GED e Pedidos de Documentos',
            acao: 'Verificar integridade dos arquivos recebidos para a competência alvo.',
            criterio_sucesso: 'Todos os documentos obrigatórios carregados sem corrupção.',
            criterio_erro: 'Ausência de extratos bancários ou documentos faltantes.',
            proxima_etapa_nome: 'Validar documentos recebidos (FCT-04-02)',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 2,
            titulo: 'Validar documentos recebidos (FCT-04-02)',
            descricao: 'Checar consistência de datas, valores e identificação da empresa.',
            entrada: 'Documentos do GED',
            acao: 'Classificar tipologia documental e vincular às contas contábeis correspondentes.',
            criterio_sucesso: 'Documentos validados e aptos para escrituração contábil.',
            criterio_erro: 'Documentos pertencentes a outra competência ou empresa.',
            proxima_etapa_nome: 'Importar extratos bancários (FCT-04-03)',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 3,
            titulo: 'Importar extratos bancários (FCT-04-03)',
            descricao: 'Carregar extratos em OFX ou CSV para as contas financeiras cadastradas.',
            entrada: 'Arquivos OFX bancários',
            acao: 'Processar extratos e gerar linhas de transações com saldo inicial e final.',
            criterio_sucesso: 'Todas as linhas do extrato importadas sem duplicações.',
            criterio_erro: 'Arquivo de formato inválido ou transações com hash idêntico.',
            proxima_etapa_nome: 'Conciliar contas bancárias (FCT-04-04)',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 4,
            titulo: 'Conciliar contas bancárias (FCT-04-04)',
            descricao: 'Cruzar lançamentos do extrato com contas a pagar/receber e provisões.',
            entrada: 'Linhas do extrato + contas financeiras',
            acao: 'Vincular títulos e gerar partidas dobradas para despesas e receitas.',
            criterio_sucesso:
              'Saldo bancário = Saldo contábil e pendências = 0 (#rpa-grid-conciliacao).',
            criterio_erro: 'Lançamento bancário sem classificação identificada.',
            proxima_etapa_nome: 'Conferir faturas de cartões de crédito (FCT-04-05)',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 5,
            titulo: 'Conferir faturas de cartões de crédito (FCT-04-05)',
            descricao: 'Conciliar faturas corporativas com comprovantes fiscais.',
            entrada: 'Faturas de cartão e recibos',
            acao: 'Apropriar despesas operacionais e classificar contas correspondentes.',
            criterio_sucesso: 'Total da fatura bate exatamente com lançamentos apropriados.',
            criterio_erro: 'Despesa não identificada ou duplicada na fatura.',
            proxima_etapa_nome: 'Conferir contas a pagar (FCT-04-06)',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 6,
            titulo: 'Conferir contas a pagar (FCT-04-06)',
            descricao: 'Baixar títulos pagos na competência e provisionar juros/multas se houver.',
            entrada: 'Módulo financeiro de pagamentos',
            acao: 'Realizar conciliação de fornecedores e contas de terceiros.',
            criterio_sucesso: 'Títulos pagos baixados e fornecedores conciliados.',
            criterio_erro: 'Pagamento não localizado ou duplicado no financeiro.',
            proxima_etapa_nome: 'Conferir contas a receber (FCT-04-07)',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 7,
            titulo: 'Conferir contas a receber (FCT-04-07)',
            descricao: 'Verificar recebimentos de clientes e liquidação de boletos/PIX.',
            entrada: 'Relatório de cobranças e créditos bancários',
            acao: 'Baixar títulos recebidos e apurar eventuais perdas ou inadimplência.',
            criterio_sucesso: 'Recebimentos do período batendo com créditos contábeis.',
            criterio_erro: 'Recebimento de cliente não identificado ou divergência de valor.',
            proxima_etapa_nome: 'Conferir integração da folha de pagamento (FCT-04-08)',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 8,
            titulo: 'Conferir integração da folha de pagamento (FCT-04-08)',
            descricao: 'Integrar provisão de salários, INSS, FGTS, férias e 13º da competência.',
            entrada: 'Resumo da folha fechada no DP (LOTE-FOLHA)',
            acao: 'Verificar partidas contábeis geradas na conta de Salários a Pagar e Encargos.',
            criterio_sucesso: 'Provisões de folha idênticas ao total líquido e guias de encargos.',
            criterio_erro: 'Folha da competência ainda aberta ou sem lote de integração gerado.',
            proxima_etapa_nome: 'Conferir impostos e apuração fiscal (FCT-04-09)',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 9,
            titulo: 'Conferir impostos apurados - Fiscal (FCT-04-09)',
            descricao:
              'Integrar provisões tributárias (Simples Nacional, ICMS, ISS, IRPJ, CSLL, PIS, COFINS).',
            entrada: 'Apuração do Módulo Fiscal (LOTE-FISC)',
            acao: 'Conferir créditos, débitos fiscais e guias geradas.',
            criterio_sucesso: 'Total de tributos a recolher contábil = guias fiscais emitidas.',
            criterio_erro: 'Apuração fiscal pendente para a competência.',
            proxima_etapa_nome: 'Processar contabilidade e partidas dobradas (FCT-04-10)',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 10,
            titulo: 'Processar contabilidade e partidas dobradas (FCT-04-10)',
            descricao:
              'Consolidar todos os lotes no diário contábil e verificar equilíbrio Débito = Crédito.',
            entrada: 'Todos os lançamentos do período',
            acao: 'Executar validação matemática estrita da equação patrimonial (#rpa-grid-lancamentos).',
            criterio_sucesso: 'Soma dos Débitos = Soma dos Créditos (Diferença = R$ 0,00).',
            criterio_erro: 'Partidas simples ou saldo desbalanceado.',
            proxima_etapa_nome: 'Gerar balancete de verificação (FCT-04-11)',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 11,
            titulo: 'Gerar balancete de verificação (FCT-04-11)',
            descricao:
              'Emitir balancete de verificação analítico da competência com telemetria #rpa-grid-balancete.',
            entrada: 'Plano de contas + movimentação do período',
            acao: 'Calcular saldos anteriores, débitos, créditos e saldos finais de todas as contas.',
            criterio_sucesso:
              'Balancete equilibrado (#rpa-grid-balancete data-diferenca="0.00" data-rpa-equilibrado="true").',
            criterio_erro: 'Conta com saldo em desacordo com a natureza contábil.',
            proxima_etapa_nome: 'Gerar DRE da competência (FCT-04-12)',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 12,
            titulo: 'Gerar DRE da competência (FCT-04-12)',
            descricao:
              'Apurar receita bruta, deduções, custos, despesas operacionais e resultado líquido.',
            entrada: 'Contas de resultado do período',
            acao: 'Montar demonstrativo segundo as normas NBC TG e apurar lucro ou prejuízo.',
            criterio_sucesso: 'DRE conciliada perfeitamente com o grupo de resultado do balanço.',
            criterio_erro: 'Contas de resultado não zeradas na apuração.',
            proxima_etapa_nome: 'Revisar balancete e demonstrativos (FCT-04-13)',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 13,
            titulo: 'Revisar balancete e demonstrativos (FCT-04-13)',
            descricao: 'Revisão das contas patrimoniais, conciliações e notas explicativas.',
            entrada: 'Balancete e DRE gerados',
            acao: 'Checar consistência geral do período antes da assinatura técnica.',
            criterio_sucesso: 'Todos os indicadores patrimoniais e fiscais consistentes.',
            criterio_erro: 'Divergência técnica apontada pelo contador.',
            proxima_etapa_nome: 'Aprovar fechamento e assinar tecnicamente (FCT-04-14)',
            requer_aprovacao: true,
            responsavel_tipo: 'Humano',
          },
          {
            ordem: 14,
            titulo: 'Aprovar fechamento e assinar tecnicamente (FCT-04-14)',
            descricao:
              'Chancela final do Contador Responsável habilitado com CRC ativo no audit_log.',
            entrada: 'Revisão concluída com parecer favorável',
            acao: 'Aprovar formalmente o fechamento da competência.',
            criterio_sucesso: 'Assinatura registrada no audit_log com CRC do responsável.',
            criterio_erro: 'Rejeição fundamentada pelo contador.',
            proxima_etapa_nome: 'Encerrar competência e ativar trava retroativa (FCT-04-15)',
            requer_aprovacao: true,
            responsavel_tipo: 'Humano',
          },
          {
            ordem: 15,
            titulo: 'Encerrar competência e ativar trava retroativa (FCT-04-15)',
            descricao: 'Bloquear lançamentos ou alterações retroativas na competência encerrada.',
            entrada: 'Aprovação formal do contador',
            acao: 'Marcar status fechado em fechamento_competencia impedindo edições acidentais.',
            criterio_sucesso: 'Trava ativada no banco de dados contra alterações acidentais.',
            criterio_erro: 'Falha ao registrar trava de segurança.',
            proxima_etapa_nome:
              'Enviar demonstrativos ao cliente e disponibilizar no Portal (FCT-04-16)',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 16,
            titulo: 'Enviar demonstrativos ao cliente e disponibilizar no Portal (FCT-04-16)',
            descricao: 'Disponibilizar Balancete e DRE assinados no Portal do Cliente e notificar.',
            entrada: 'Documentos assinados da competência fechada',
            acao: 'Publicar no GED do cliente e disparar aviso com protocolo hash.',
            criterio_sucesso:
              'Demonstrativos visíveis no Portal do Cliente (#rpa-status-conclusao data-rpa-state="concluido").',
            criterio_erro: 'Falha no upload ou na publicação no portal.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
        ],
      },
      {
        codigo: 'POP-05',
        nome: 'Conciliação Bancária e Cartões',
        area: 'contabil',
        versao: '2026.4',
        objetivo:
          'Conciliação bancária determinística com telemetria #rpa-grid-conciliacao (data-total-rows, data-pendencias-count) e critério objetivo: saldo bancário = saldo contábil e pendências zeradas ou justificadas.',
        gatilho: 'Importação de extrato bancário OFX/CSV ou sincronização diária de contas.',
        pre_condicoes: 'Contas bancárias cadastradas na plataforma e extrato disponível.',
        entradas: 'Extratos OFX, CSV ou integração bancária direta.',
        sistemas_utilizados:
          'Plataforma Rumo Financeiro, Conciliação Inteligente e Diário Contábil.',
        responsavel_cargo: 'Assistente / Analista Contábil',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_1_automatico',
        requer_aprovacao: false,
        saida:
          'Extratos conciliados, partidas contábeis geradas e grid #rpa-grid-conciliacao sem ressalvas.',
        proximo_processo: 'POP-04 (Fechamento Contábil)',
        regras_negocio:
          'Critério inequívoco de sucesso: saldo bancário apurado = saldo contábil da conta correspondente e pendências = 0 (ou 100% justificadas no Modo Humano). Telemetria exposta em #rpa-grid-conciliacao com atributos data-total-rows e data-pendencias-count.',
        criterios_sucesso: 'Saldo bancário = Saldo contábil e pendências = 0.',
        criterios_erro: 'Divergência não justificada entre saldo bancário e contábil.',
        excecoes:
          'Lançamentos sem documento fiscal hábil são provisionados em conta transitória de pendências.',
        etapas: [
          {
            ordem: 1,
            titulo: 'Identificar conta bancária e período',
            descricao: 'Localizar conta contábil vinculada e delimitar competência.',
            entrada: 'Parâmetros da conta e competência',
            acao: 'Selecionar conta ativa e checar saldo anterior transportado.',
            criterio_sucesso: 'Conta bancária localizada e saldo inicial verificado.',
            criterio_erro: 'Conta bancária inexistente ou desativada.',
            proxima_etapa_nome: 'Importar movimentações e calcular saldos',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 2,
            titulo: 'Importar movimentações e calcular saldos',
            descricao:
              'Ler todas as linhas de crédito e débito calculando o saldo final projetado.',
            entrada: 'Linhas do extrato',
            acao: 'Somar créditos e débitos ao saldo inicial para obter o saldo final bancário.',
            criterio_sucesso: 'Saldo final calculado idêntico ao saldo final do extrato bancário.',
            criterio_erro: 'Soma aritmética não confere com o extrato.',
            proxima_etapa_nome: 'Vincular títulos e gerar partidas contábeis',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 3,
            titulo: 'Vincular títulos e gerar partidas contábeis',
            descricao: 'Aplicar regras de De-Para e regras por descrição de extrato.',
            entrada: 'Títulos em aberto do financeiro',
            acao: 'Conciliar automaticamente itens com mesmo valor e data próxima (tolerância 3d).',
            criterio_sucesso: 'Itens conciliados com precisão matemática.',
            criterio_erro: 'Lançamento bancário sem classificação identificada.',
            proxima_etapa_nome: 'Verificar telemetria #rpa-grid-conciliacao e conclusão objetiva',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 4,
            titulo: 'Verificar telemetria #rpa-grid-conciliacao e conclusão objetiva',
            descricao: 'Confirmar SALDO BANCÁRIO = SALDO CONTÁBIL e data-pendencias-count="0".',
            entrada: 'Resultado da conciliação',
            acao: 'Verificar igualdade estrita de saldos e ausência de pendências não justificadas.',
            criterio_sucesso:
              'SALDO BANCÁRIO = SALDO CONTÁBIL e pendências zeradas (#rpa-grid-conciliacao).',
            criterio_erro: 'Divergência não justificada entre saldo bancário e contábil.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
        ],
      },
      {
        codigo: 'POP-AT-01',
        nome: 'Atendimento WhatsApp & NFS-e Assistiva',
        area: 'atendimento',
        versao: '2026.4',
        objetivo:
          'Operar o agente de conversação da Elliza no WhatsApp com triagem determinística via Evolution API, Modo Supervisão honesto, escalonamento humano Nível 2/3 e geração assistiva de minutas de NFS-e.',
        gatilho: 'Mensagem recebida de cliente em canal oficial de WhatsApp.',
        pre_condicoes: 'Instância Evolution API conectada ou em Modo Supervisão honesto.',
        entradas: 'Texto, áudio ou anexo enviado pelo cliente via WhatsApp.',
        sistemas_utilizados:
          'Plataforma Rumo, Evolution API, Agente Elliza WhatsApp, NFS-e Assistiva.',
        responsavel_cargo: 'Assistente de Atendimento / Contador',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_2_supervisionado',
        requer_aprovacao: true,
        saida: 'Atendimento prestado com trilha auditada e minuta de serviço preparada.',
        proximo_processo: 'POP-10 / POP-14 para transmissão municipal',
        regras_negocio:
          'Desdobramento oficial do antigo código compartilhado. Processos anteriores que apontam POP-05 com escopo de atendimento WhatsApp mantêm referência legada válida sem quebra de integridade. Emissão assistida: a Elliza prepara a minuta fiscal, mas a transmissão é privativa do Contador ou autorizada formalmente no Modo Humano.',
        criterios_sucesso:
          'Triagem determinística realizada, intenção classificada e minuta chancelada pelo responsável.',
        criterios_erro:
          'Número desconhecido sem consentimento LGPD ou recusa contábil da minuta fiscal.',
        excecoes:
          'Caso o gateway Evolution API esteja offline, as mensagens entram em fila honesta aguardando_credenciais.',
        etapas: [
          {
            ordem: 1,
            titulo: 'Recepção e triagem automatizada da mensagem',
            descricao: 'Identificar cliente pelo telefone cadastrado e classificar a demanda.',
            responsavel_tipo: 'Elliza',
            entrada: 'Webhook da Evolution API',
            acao: 'Consultar cadastro da empresa por telefone e classificar intenção (Dúvida, Guia, NFS-e, Documento).',
            criterio_sucesso: 'Empresa identificada e intenção classificada no histórico auditado.',
            criterio_erro: 'Número desconhecido ou sem autorização LGPD ativa.',
            proxima_etapa_nome: 'Preparação da resposta assistiva ou minuta de NFS-e',
            requer_aprovacao: false,
          },
          {
            ordem: 2,
            titulo: 'Preparação da resposta assistiva ou minuta de NFS-e',
            descricao: 'Gerar minuta estruturada de emissão ou resposta a questionamento contábil.',
            responsavel_tipo: 'Elliza',
            entrada: 'Dados fornecidos pelo cliente (tomador, valor, descrição do serviço)',
            acao: 'Construir proposta de nota fiscal ou minuta de orientação técnica.',
            criterio_sucesso: 'Minuta preparada com código municipal e retenções previstas.',
            criterio_erro: 'Dados insuficientes (falta CNPJ do tomador ou descrição ambígua).',
            proxima_etapa_nome: 'Validação e aprovação técnica pelo Contador (Nível 2/3)',
            requer_aprovacao: true,
          },
          {
            ordem: 3,
            titulo: 'Validação e aprovação técnica pelo Contador (Nível 2/3)',
            descricao: 'Contador autoriza o envio da resposta oficial ou a emissão da nota fiscal.',
            responsavel_tipo: 'Humano',
            entrada: 'Minuta gerada pela Elliza',
            acao: 'Revisar enquadramento e despachar autorização formal no Modo Humano.',
            criterio_sucesso:
              'Aprovação registrada com assinatura digital do contador no audit_log.',
            criterio_erro: 'Rejeição fundamentada pelo contador com instrução de correção.',
            proxima_etapa_nome: 'Disparo da mensagem / NFS-e ao cliente',
            requer_aprovacao: true,
          },
          {
            ordem: 4,
            titulo: 'Disparo da mensagem / NFS-e ao cliente',
            descricao: 'Enviar confirmação e arquivo DANFSE/PDF ao WhatsApp do cliente.',
            responsavel_tipo: 'Elliza',
            entrada: 'Autorização contábil registrada',
            acao: 'Disparar mensagem no WhatsApp via Evolution API com protocolo auditado.',
            criterio_sucesso: 'Mensagem entregue com protocolo no audit_log.',
            criterio_erro:
              'Falha no gateway do WhatsApp (enfileiramento honesto aguardando credenciais).',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
          },
        ],
      },
      {
        codigo: 'POP-06',
        nome: 'Conciliação de Cartões e Faturas Corporativas',
        area: 'contabil',
        versao: '2026.4',
        objetivo:
          'Conciliar faturas corporativas com comprovantes e notas de despesas, apropriando encargos.',
        gatilho: 'Fechamento da fatura do cartão ou envio do PDF/CSV pelo cliente.',
        pre_condicoes: 'Cartões cadastrados e plano de contas parametrizado.',
        entradas: 'Faturas de cartão, comprovantes de despesa e recibos fiscais.',
        sistemas_utilizados: 'Plataforma Rumo Financeiro e Diário Contábil.',
        responsavel_cargo: 'Assistente Contábil',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_1_automatico',
        requer_aprovacao: false,
        saida: 'Fatura liquidada e despesas apropriadas por centro de custo.',
        proximo_processo: 'POP-04 (Fechamento Contábil Mensal)',
        etapas: [
          {
            ordem: 1,
            titulo: 'Importar lançamentos da fatura de cartão',
            descricao: 'Ler itens da fatura delimitando titular e competência.',
            entrada: 'Fatura em PDF ou CSV',
            acao: 'Extrair transações com data, estabelecimento e valor.',
            criterio_sucesso: 'Total da fatura bate com a soma das transações extraídas.',
            criterio_erro: 'Arquivo ilegível ou divergência no totalizador.',
            proxima_etapa_nome: 'Vincular comprovantes e classificar despesas',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 2,
            titulo: 'Vincular comprovantes e classificar despesas',
            descricao: 'Associar cupons fiscais e classificar contas de despesa.',
            entrada: 'Transações + Comprovantes no GED',
            acao: 'Gerar partidas contábeis de apropriação e classificar despesas.',
            criterio_sucesso: '100% das despesas apropriadas com comprovante idôneo.',
            criterio_erro: 'Despesa sem identificação ou sem comprovante fiscal.',
            proxima_etapa_nome: 'Apropriar encargos e validar saldo da fatura',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 3,
            titulo: 'Apropriar encargos e validar saldo da fatura',
            descricao: 'Contabilizar juros, anuidade e IOF da fatura se houver.',
            entrada: 'Total da fatura e encargos',
            acao: 'Verificar se o valor do pagamento da fatura confere com as despesas apropriadas.',
            criterio_sucesso: 'Saldo a pagar do cartão conciliado perfeitamente.',
            criterio_erro: 'Diferença entre o total pago e as partidas apropriadas.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
        ],
      },
      {
        codigo: 'POP-07',
        nome: 'Contas a Pagar, Provisões & Baixas Financeiras',
        area: 'contabil',
        versao: '2026.4',
        objetivo:
          'Gerir títulos a pagar, provisionar despesas e efetuar baixas com verificação de comprovantes.',
        gatilho: 'Chegada de boleto, fatura de fornecedor ou vencimento periódico.',
        pre_condicoes: 'Fornecedor cadastrado e documento fiscal anexado.',
        entradas: 'Boletos, notas fiscais de entrada e comprovantes de liquidação.',
        sistemas_utilizados: 'Plataforma Rumo Financeiro e Módulo de Pagamentos.',
        responsavel_cargo: 'Analista Financeiro / Contador',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_3_aprovacao_obrigatoria',
        requer_aprovacao: true,
        saida: 'Títulos baixados, fornecedores conciliados e partidas no diário.',
        proximo_processo: 'POP-04 (Fechamento Contábil)',
        etapas: [
          {
            ordem: 1,
            titulo: 'Provisionar contas a pagar',
            descricao:
              'Cadastrar título com código de barras, vencimento e conta de contrapartida.',
            entrada: 'Documento de cobrança do fornecedor',
            acao: 'Criar provisão contábil de despesa a pagar.',
            criterio_sucesso: 'Título provisionado com linha digitável e valor conferidos.',
            criterio_erro: 'Boleto sem código de barras válido ou fornecedor não identificado.',
            proxima_etapa_nome: 'Autorização humana de pagamento (Nível 3)',
            requer_aprovacao: true,
            responsavel_tipo: 'Humano',
          },
          {
            ordem: 2,
            titulo: 'Autorização humana de pagamento (Nível 3)',
            descricao: 'Aprovação privativa de desembolso financeiro pelo gestor responsável.',
            entrada: 'Título provisionado',
            acao: 'Autorizar agendamento ou liquidação no Modo Humano.',
            criterio_sucesso: 'Autorização formal registrada com usuário e data.',
            criterio_erro: 'Título rejeitado ou cancelado pelo gestor.',
            proxima_etapa_nome: 'Efetuar baixa financeira e conciliar fornecedor',
            requer_aprovacao: true,
            responsavel_tipo: 'Humano',
          },
          {
            ordem: 3,
            titulo: 'Efetuar baixa financeira e conciliar fornecedor',
            descricao: 'Cruzar débito bancário com o título e anexar comprovante.',
            entrada: 'Extrato bancário + Comprovante de pagamento',
            acao: 'Baixar título e zerar conta de fornecedor correspondente.',
            criterio_sucesso: 'Título com status pago e comprovante arquivado no GED.',
            criterio_erro: 'Valor pago diferente do valor do título provisionado.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
        ],
      },
      {
        codigo: 'POP-08',
        nome: 'Contas a Receber, Faturamento & Cobrança Preventiva',
        area: 'contabil',
        versao: '2026.4',
        objetivo:
          'Emitir cobranças, controlar recebíveis e executar réguas preventivas de cobrança.',
        gatilho: 'Emissão de nota fiscal de venda/serviço ou contrato recorrente.',
        pre_condicoes: 'Cliente cadastrado com dados bancários e de contato.',
        entradas: 'Notas fiscais de saída, contratos de honorários e regras de cobrança.',
        sistemas_utilizados: 'Plataforma Rumo Financeiro, Módulo de Cobranças e WhatsApp.',
        responsavel_cargo: 'Assistente Financeiro',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_1_automatico',
        requer_aprovacao: false,
        saida: 'Títulos liquidados, extrato de inadimplência e conciliação de receitas.',
        proximo_processo: 'POP-04 (Fechamento Contábil)',
        etapas: [
          {
            ordem: 1,
            titulo: 'Gerar títulos de cobrança com código PIX e boleto',
            descricao: 'Emitir cobranças vinculadas aos contratos ou notas fiscais emitidas.',
            entrada: 'Faturamento do período',
            acao: 'Gerar cobranças com vencimento, valor e QR Code PIX dinâmico.',
            criterio_sucesso: 'Cobranças geradas e registradas na carteira.',
            criterio_erro: 'Dados de cliente incompletos para registro do título.',
            proxima_etapa_nome: 'Disparo preventivo de cobrança (D-3, D-0)',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 2,
            titulo: 'Disparo preventivo de cobrança (D-3, D-0)',
            descricao: 'Enviar lembretes amigáveis de vencimento via WhatsApp e e-mail.',
            entrada: 'Fila de cobranças a vencer',
            acao: 'Disparar mensagens preventivas com linha digitável e link de pagamento.',
            criterio_sucesso: 'Lembretes entregues com protocolo auditado.',
            criterio_erro: 'Falha de entrega por telefone inválido.',
            proxima_etapa_nome: 'Conciliar liquidação e apurar inadimplência',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 3,
            titulo: 'Conciliar liquidação e apurar inadimplência',
            descricao: 'Cruzar créditos bancários com os títulos em aberto e registrar baixas.',
            entrada: 'Extrato de créditos bancários',
            acao: 'Baixar títulos recebidos e calcular juros/multa de atrasos.',
            criterio_sucesso: 'Recebimentos conciliados com receitas contábeis.',
            criterio_erro: 'Crédito bancário sem título correspondente.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
        ],
      },
      {
        codigo: 'POP-09',
        nome: 'Monitoramento Normativo, Prazos & Apuração Fiscal',
        area: 'fiscal',
        versao: '2026.4',
        objetivo:
          'Monitorar alterações legislativas tributárias e coordenar o calendário mensal de obrigações fiscais.',
        gatilho: 'Publicação de novas normas legais ou início de competência fiscal.',
        pre_condicoes: 'Enquadramentos tributários cadastrados.',
        entradas: 'Diários Oficiais, notas técnicas e tabelas normativas unificadas.',
        sistemas_utilizados: 'Plataforma Rumo Fiscal e Monitoramento Legislativo.',
        responsavel_cargo: 'Analista Fiscal / Contador',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_2_supervisionado',
        requer_aprovacao: true,
        saida: 'Tabelas normativas atualizadas e calendário fiscal sincronizado.',
        proximo_processo: 'POP-03 (Rotina Fiscal)',
        etapas: [
          {
            ordem: 1,
            titulo: 'Monitorar publicações e notas técnicas tributárias',
            descricao: 'Varrer portais da Receita Federal e secretarias estaduais/municipais.',
            entrada: 'Diário Oficial e portais fazendários',
            acao: 'Classificar atos normativos relevantes e sinalizar impactos na carteira.',
            criterio_sucesso: 'Novas normas catalogadas com data de vigência e escopo.',
            criterio_erro: 'Falha de leitura do feed normativo.',
            proxima_etapa_nome: 'Atualizar motor normativo unificado',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 2,
            titulo: 'Atualizar motor normativo unificado',
            descricao: 'Atualizar faixas de alíquotas, limites de enquadramento e prazos.',
            entrada: 'Atos normativos validados',
            acao: 'Registrar novos parâmetros na coleção parametros_normativos.',
            criterio_sucesso: 'Tabelas do sistema atualizadas sem lacunas de vigência.',
            criterio_erro: 'Divergência de valores de faixas ou prazos.',
            proxima_etapa_nome: 'Homologação pelo Contador Responsável (Nível 3)',
            requer_aprovacao: true,
            responsavel_tipo: 'Humano',
          },
          {
            ordem: 3,
            titulo: 'Homologação pelo Contador Responsável (Nível 3)',
            descricao: 'Revisão técnica das novas tabelas antes da entrada em vigor.',
            entrada: 'Minuta de alteração normativa',
            acao: 'Chancelar tabelas atualizadas com despacho e CRC no audit_log.',
            criterio_sucesso: 'Parâmetros normativos homologados e ativos.',
            criterio_erro: 'Rejeição fundamentada pelo contador.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: true,
            responsavel_tipo: 'Humano',
          },
        ],
      },
      {
        codigo: 'POP-10',
        nome: 'Disparo Ativo de Guias e Cobranças via WhatsApp & Portal',
        area: 'atendimento',
        versao: '2026.4',
        objetivo:
          'Entregar guias de pagamento, DAS, DARF e avisos aos clientes com link público seguro e protocolo.',
        gatilho: 'Guia aprovada no módulo de pagamentos ou cobrança enfileirada.',
        pre_condicoes:
          'Guia com código de barras/PIX e número de WhatsApp do cliente com consentimento.',
        entradas: 'Guias oficiais geradas (status aguardando_envio).',
        sistemas_utilizados: 'Plataforma Rumo, Evolution API, WhatsApp Ativo e Portal do Cliente.',
        responsavel_cargo: 'Assistente de Atendimento',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_1_automatico',
        requer_aprovacao: false,
        saida: 'Guia entregue ao cliente com protocolo registrado no audit_log.',
        proximo_processo: 'POP-08 (Contas a Receber)',
        etapas: [
          {
            ordem: 1,
            titulo: 'Enfileirar disparo ativo com modelo oficial',
            descricao: 'Selecionar guias em aguardando_envio e montar mensagem personalizada.',
            entrada: 'Guias aprovadas',
            acao: 'Montar texto amigável com valor, vencimento, linha digitável e PIX Copia e Cola.',
            criterio_sucesso: 'Mensagem formatada com conformidade e sem dados sensíveis expostos.',
            criterio_erro: 'Falta de linha digitável ou guia vencida.',
            proxima_etapa_nome: 'Transmitir via Evolution API ou reter honestamente',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 2,
            titulo: 'Transmitir via Evolution API ou reter honestamente',
            descricao: 'Disparar para o contato cadastrado ou marcar aguardando_credenciais.',
            entrada: 'Mensagem enfileirada + Configuração Evolution API',
            acao: 'Chamar API oficial de mensagens ou reter com transparência operacional.',
            criterio_sucesso: 'Mensagem entregue com messageId gravado no audit_log.',
            criterio_erro: 'Número inválido ou instância desconectada.',
            proxima_etapa_nome: 'Atualizar status da guia para enviada',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 3,
            titulo: 'Atualizar status da guia para enviada',
            descricao:
              'Registrar timestamp de envio e disponibilizar espelho no Portal do Cliente.',
            entrada: 'Confirmação de entrega',
            acao: 'Marcar status enviada na guia e gravar log de protocolo.',
            criterio_sucesso: 'Status atualizado com rastreabilidade completa.',
            criterio_erro: 'Falha na atualização do status da guia.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
        ],
      },
      {
        codigo: 'POP-11',
        nome: 'DEFIS Anual & Importação de XML Fiscal em Lote',
        area: 'fiscal',
        versao: '2026.4',
        objetivo:
          'Elaborar e validar a DEFIS em 4 abas e processar lotes de XMLs fiscais com isolamento de falhas.',
        gatilho: 'Período regulatório anual ou importação de pacote mensal de notas fiscais.',
        pre_condicoes: 'Balanço, DRE e apurações da competência encerradas.',
        entradas: 'Demonstrativos contábeis, folha de pagamento e XMLs de faturamento.',
        sistemas_utilizados: 'Plataforma Rumo Fiscal, PGDAS-D DEFIS e Módulo XML Lote.',
        responsavel_cargo: 'Contador Encarregado',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_3_aprovacao_obrigatoria',
        requer_aprovacao: true,
        saida: 'Rascunho oficial da DEFIS compilado, arquivo TXT para transmissão e notas no GED.',
        proximo_processo: 'Transmissão no PGDAS-D pelo Contador',
        etapas: [
          {
            ordem: 1,
            titulo: 'Importação e conciliação em lote dos XMLs fiscais',
            descricao:
              'Carregar pacote de XMLs com verificação anti-duplicidade e cascata contábil.',
            responsavel_tipo: 'Elliza',
            entrada: 'Arquivos XML de NF-e e NFS-e',
            acao: 'Processar arquivos com isolamento de falha individual por arquivo.',
            criterio_sucesso: 'Lote importado sem duplicidade e integrado ao módulo fiscal.',
            criterio_erro: 'XML corrompido ou CNPJ divergente da empresa.',
            proxima_etapa_nome: 'Consolidação das 4 abas da DEFIS a partir dos livros contábeis',
            requer_aprovacao: false,
          },
          {
            ordem: 2,
            titulo: 'Consolidação das 4 abas da DEFIS a partir dos livros contábeis',
            descricao:
              'Cruzar faturamento, despesas operacionais, rendimentos dos sócios e saldos de caixa.',
            responsavel_tipo: 'Elliza',
            entrada: 'Balancete do exercício e folha dos sócios',
            acao: 'Preencher campos de rendimentos isentos, tributados e despesas gerais.',
            criterio_sucesso:
              'Quadro da DEFIS sem saldo negativo de caixa ou inconsistência patrimonial.',
            criterio_erro: 'Divergência entre lucro contábil apurado e lucros distribuídos.',
            proxima_etapa_nome: 'Conferência técnica e aprovação pelo Contador (Nível 3)',
            requer_aprovacao: true,
          },
          {
            ordem: 3,
            titulo: 'Conferência técnica e aprovação pelo Contador (Nível 3)',
            descricao:
              'Chancela final do profissional contábil antes da submissão no portal da Receita.',
            responsavel_tipo: 'Humano',
            entrada: 'Rascunho consolidado das 4 abas da DEFIS',
            acao: 'Revisar distribuição de lucros aos sócios e validar consistência fiscal.',
            criterio_sucesso:
              'Assinatura digital do contador e despacho para geração de TXT oficial.',
            criterio_erro: 'Ressalva contábil indicada pelo responsável técnico.',
            proxima_etapa_nome: 'Geração do arquivo oficial TXT e arquivamento no GED',
            requer_aprovacao: true,
          },
          {
            ordem: 4,
            titulo: 'Geração do arquivo oficial TXT e arquivamento no GED',
            descricao: 'Exportar arquivo formatado para importação direta no PGDAS-D.',
            responsavel_tipo: 'Elliza',
            entrada: 'Aprovação humana registrada',
            acao: 'Gerar arquivo TXT, calcular hash SHA-256 e arquivar no GED.',
            criterio_sucesso: 'Arquivo TXT gerado em conformidade com o layout da RFB e arquivado.',
            criterio_erro: 'Falha na compilação dos registros de encerramento.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
          },
        ],
      },
      {
        codigo: 'POP-12',
        nome: 'Rotinas em Lote Multi-Empresas, Patrimônio & Motor Normativo',
        area: 'contabil',
        versao: '2026.4',
        objetivo:
          'Executar fechamentos operacionais em lote para carteiras multi-empresas, controlar depreciação patrimonial com telemetria #rpa-grid-patrimonio e manter tabelas normativas unificadas.',
        gatilho:
          'Fechamento de competência para a carteira de clientes ou aquisição de ativo imobilizado.',
        pre_condicoes: 'Empresas ativas cadastradas e bens patrimoniais registrados.',
        entradas: 'Cadastros de empresas, fichas de imobilizado e tabelas normativas de tributos.',
        sistemas_utilizados:
          'Plataforma Rumo /lote, /patrimonio (#rpa-grid-patrimonio) e /parametros-normativos.',
        responsavel_cargo: 'Coordenador Operacional / Contador',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_2_supervisionado',
        requer_aprovacao: true,
        saida:
          'Lotes contábeis multi-empresas processados, depreciação calculada e parâmetros atualizados.',
        proximo_processo: 'Fecho Mensal Individual / Balancete',
        etapas: [
          {
            ordem: 1,
            titulo: 'Atualização do Motor Normativo Unificado',
            descricao:
              'Verificar tabelas vigentes de INSS progressivo, faixas de IRRF e alíquotas do Simples.',
            responsavel_tipo: 'Elliza',
            entrada: 'Parâmetros normativos da competência',
            acao: 'Garantir consistência das tabelas legais vigentes no sistema.',
            criterio_sucesso:
              'Tabelas normativas validadas sem sobreposição ou lacuna de vigência.',
            criterio_erro: 'Parâmetro normativo desatualizado ou inconsistente.',
            proxima_etapa_nome:
              'Cálculo de depreciação e atualização patrimonial (#rpa-grid-patrimonio)',
            requer_aprovacao: false,
          },
          {
            ordem: 2,
            titulo: 'Cálculo de depreciação e atualização patrimonial (#rpa-grid-patrimonio)',
            descricao:
              'Calcular quotas mensais de depreciação linear com telemetria de totais de aquisição, depreciado e líquido.',
            responsavel_tipo: 'Elliza',
            entrada: 'Cadastro de bens patrimoniais da empresa',
            acao: 'Aplicar taxas de depreciação por vida útil e gerar lançamentos contábeis automáticos.',
            criterio_sucesso:
              'Lançamentos de depreciação gerados e grid #rpa-grid-patrimonio atualizado.',
            criterio_erro: 'Bem com valor residual inferior a zero ou sem data de aquisição.',
            proxima_etapa_nome: 'Disparo do lote contábil e conferência multi-empresas',
            requer_aprovacao: true,
          },
          {
            ordem: 3,
            titulo: 'Disparo do lote contábil e conferência multi-empresas',
            descricao:
              'Executar encerramentos em massa com isolamento estrito de falhas por cliente.',
            responsavel_tipo: 'Elliza',
            entrada: 'Seleção de empresas ativas',
            acao: 'Processar lote multi-empresas com log individualizado de sucesso e retenção.',
            criterio_sucesso: 'Relatório de execução em lote concluído com taxa de êxito.',
            criterio_erro:
              'Falha de processamento retida na empresa afetada sem interromper o lote.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
          },
        ],
      },
      {
        codigo: 'POP-13',
        nome: 'Integra Contador (SERPRO / e-CAC Oficial) & Túnel mTLS',
        area: 'fiscal',
        versao: '2026.4',
        objetivo:
          'Conectar com a Receita Federal via API SERPRO Integra Contador com túnel mTLS na VPS, consultando SITFIS, Caixa Postal DTE e DCTFWeb sob supervisão.',
        gatilho: 'Job diário das 04:30 (integra_contador_sync_diario) ou solicitação sob demanda.',
        pre_condicoes: 'e-CNPJ A1 do escritório credenciado na Loja SERPRO e proxy mTLS ativo.',
        entradas:
          'Credenciais OAuth2 do SERPRO, certificado digital e lista de clientes autorizados.',
        sistemas_utilizados: 'Loja SERPRO, Proxy mTLS Docker, e-CAC e Plataforma Rumo.',
        responsavel_cargo: 'Contador Responsável / Administrador',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_2_supervisionado',
        requer_aprovacao: true,
        saida: 'Situação fiscal atualizada no banco, mensagens DTE arquivadas e consumo bilhetado.',
        proximo_processo: 'Radar CND / Regularidade Fiscal',
        etapas: [
          {
            ordem: 1,
            titulo: 'Verificação do handshake OAuth2 SERPRO e proxy mTLS',
            descricao: 'Testar autenticação de tokens e alcançabilidade do túnel mTLS da VPS.',
            responsavel_tipo: 'Elliza',
            entrada: 'Consumer Key, Secret e URL do Proxy mTLS',
            acao: 'Efetuar chamada de ping autenticada e verificar certificado cliente ICP-Brasil.',
            criterio_sucesso: 'Handshake mTLS aprovado e token de acesso gerado.',
            criterio_erro: 'Falha de conexão mTLS (queda automática para Modo Supervisão honesto).',
            proxima_etapa_nome: 'Sincronização de Situação Fiscal (SITFIS) e Caixa Postal DTE',
            requer_aprovacao: false,
          },
          {
            ordem: 2,
            titulo: 'Sincronização de Situação Fiscal (SITFIS) e Caixa Postal DTE',
            descricao:
              'Consultar pendências fiscais federais e novas mensagens oficiais da Receita.',
            responsavel_tipo: 'Elliza',
            entrada: 'Empresas com autorização ativa no SERPRO',
            acao: 'Coletar pendências tributárias e salvar mensagens na coleção integra_contador_mensagens.',
            criterio_sucesso: 'SITFIS atualizado e novas mensagens do DTE catalogadas.',
            criterio_erro: 'Procuração eletrônica revogada ou expirada na RFB.',
            proxima_etapa_nome: 'Conferência técnica do relatório de débitos pelo Contador',
            requer_aprovacao: true,
          },
          {
            ordem: 3,
            titulo: 'Conferência técnica do relatório de débitos pelo Contador',
            descricao:
              'Revisar avisos de cobrança e pendências de DCTFWeb antes de emissão de DARF/DAS.',
            responsavel_tipo: 'Humano',
            entrada: 'Relatório SITFIS retornado pela API SERPRO',
            acao: 'Analisar divergências tributárias e chancelar ações de regularização.',
            criterio_sucesso: 'Parecer contábil emitido e plano de ação fiscal definido.',
            criterio_erro: 'Divergência entre débitos do e-CAC e contabilidade interna.',
            proxima_etapa_nome: 'Registro de bilhetagem e atualização do Radar de Regularidade',
            requer_aprovacao: true,
          },
          {
            ordem: 4,
            titulo: 'Registro de bilhetagem e atualização do Radar de Regularidade',
            descricao:
              'Gravar consumo na coleção integra_contador_consumo e atualizar certidão CND oficial.',
            responsavel_tipo: 'Elliza',
            entrada: 'Dados da consulta efetuada',
            acao: 'Registrar bilhetagem com valor em reais e mudar status da CND para oficial.',
            criterio_sucesso: 'Bilhetagem registrada e Radar CND atualizado com protocolo RFB.',
            criterio_erro: 'Falha na gravação do registro de consumo.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
          },
        ],
      },
      {
        codigo: 'POP-14',
        nome: 'Provedor NFS-e NFE.io & Webhook de Conciliação GED',
        area: 'fiscal',
        versao: '2026.4',
        objetivo:
          'Emitir e cancelar notas fiscais de serviço via API NFE.io com conciliação automática de XML no GED através de webhooks.',
        gatilho: 'Aprovação de solicitação de emissão de NFS-e ou evento de webhook recebido.',
        pre_condicoes: 'API Key e Company ID da NFE.io configurados em /integracoes.',
        entradas: 'Minuta de NFS-e aprovada e dados do tomador do serviço.',
        sistemas_utilizados: 'Plataforma Rumo, Gateway NFE.io, Webhooks PocketBase e GED.',
        responsavel_cargo: 'Analista Fiscal / Contador',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_3_aprovacao_obrigatoria',
        requer_aprovacao: true,
        saida:
          'NFS-e emitida pela prefeitura, XML e PDF arquivados no GED com hash de integridade.',
        proximo_processo: 'POP-03 / Fechamento Fiscal Mensal',
        etapas: [
          {
            ordem: 1,
            titulo: 'Validação da minuta fiscal e enquadramento de serviços',
            descricao: 'Checar CNAE de serviços, código de tributação municipal e retenção de ISS.',
            responsavel_tipo: 'Elliza',
            entrada: 'Dados do serviço e tomador',
            acao: 'Validar se código do serviço pertence à LC 116 e verificar incidência de ISS.',
            criterio_sucesso: 'Minuta sem divergência de alíquota municipal.',
            criterio_erro: 'Código de serviço inválido no município da prestação.',
            proxima_etapa_nome: 'Aprovação privativa do Contador (Nível 3)',
            requer_aprovacao: true,
          },
          {
            ordem: 2,
            titulo: 'Aprovação privativa do Contador (Nível 3)',
            descricao: 'Chancela do contador obrigatória antes do disparo à prefeitura.',
            responsavel_tipo: 'Humano',
            entrada: 'Minuta validada pela Elliza',
            acao: 'Revisar retenções federais (IRRF, PIS/COFINS/CSLL) e aprovar emissão.',
            criterio_sucesso: 'Aprovação registrada com usuário e timestamp.',
            criterio_erro: 'Rejeição fundamentada pelo contador.',
            proxima_etapa_nome: 'Transmissão via API NFE.io e escuta de webhook',
            requer_aprovacao: true,
          },
          {
            ordem: 3,
            titulo: 'Transmissão via API NFE.io e escuta de webhook',
            descricao: 'Disparar payload de emissão e aguardar processamento assíncrono.',
            responsavel_tipo: 'Elliza',
            entrada: 'Minuta aprovada',
            acao: 'Chamar endpoint da NFE.io e registrar protocolo de lote.',
            criterio_sucesso: 'Lote recebido com sucesso pela NFE.io para envio à prefeitura.',
            criterio_erro: 'Falha de comunicação ou rejeição de credenciais da prefeitura.',
            proxima_etapa_nome: 'Recepção do webhook e arquivamento no GED',
            requer_aprovacao: false,
          },
          {
            ordem: 4,
            titulo: 'Recepção do webhook e arquivamento no GED',
            descricao: 'Receber notificação assíncrona da NFE.io com XML e PDF definitivos.',
            responsavel_tipo: 'Elliza',
            entrada: 'Payload do webhook da NFE.io',
            acao: 'Salvar nota na coleção nfse_historico e arquivar XML/PDF no GED da empresa.',
            criterio_sucesso: 'NFS-e arquivada no GED com número oficial e hash SHA-256.',
            criterio_erro: 'Nota rejeitada pela prefeitura municipal.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
          },
        ],
      },
      {
        codigo: 'POP-15',
        nome: 'Pedidos de Documentos & Trilhas Paralelas',
        area: 'geral',
        versao: '2026.4',
        objetivo:
          'Solicitar documentos faltantes com token público via /pedidos-documentos/:token_publico, integrado a propostas de honorários e matriz de responsabilidade Cliente x Escritório por item documental.',
        gatilho: 'Identificação de documento faltante durante conferência ou rotina periódica.',
        pre_condicoes: 'Empresa cadastrada e contato de WhatsApp disponível.',
        entradas: 'Tipo de documento solicitado (Extrato, Fatura, Folha, Contrato).',
        sistemas_utilizados: 'Plataforma Rumo, Pedidos de Documentos, Tokens Públicos e GED.',
        responsavel_cargo: 'Assistente de Atendimento',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_1_automatico',
        requer_aprovacao: false,
        saida:
          'Documento recebido via link público, conferido e anexado diretamente ao GED da empresa.',
        proximo_processo: 'Processo solicitante (ex: Fechamento Contábil)',
        regras_negocio:
          'Integração direta com propostas de honorários e onboarding (/contratos e /abertura/:token). Matriz de responsabilidade explícita Cliente x Escritório por item documental. Links públicos gerados exclusivamente pelo formato seguro /pedidos-documentos/:token_publico.',
        criterios_sucesso:
          'Link público exclusivo gerado, documento enviado pelo cliente e validado no GED.',
        criterios_erro: 'Token expirado ou tipo de documento em desacordo com o solicitado.',
        excecoes:
          'Havendo recusa documental, o analista registra o motivo no sistema e o link é renovado.',
        etapas: [
          {
            ordem: 1,
            titulo:
              'Criar pedido de documento com token seguro (/pedidos-documentos/:token_publico)',
            descricao:
              'Gerar solicitação para o cliente com prazo, matriz de responsabilidade e token exclusivo.',
            entrada:
              'Tipo de documento, competência e matriz de responsabilidade Cliente x Escritório',
            acao: 'Criar registro em pedidos_documentos gerando rota pública /pedidos-documentos/:token_publico.',
            criterio_sucesso: 'Link público exclusivo gerado com proteção por token criptográfico.',
            criterio_erro: 'Falta de tipo de documento ou empresa.',
            proxima_etapa_nome: 'Disparar notificação por WhatsApp com link direto',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 2,
            titulo: 'Disparar notificação por WhatsApp com link direto',
            descricao: 'Enviar mensagem amigável com link para upload direto do celular.',
            entrada: 'Link público do pedido',
            acao: 'Enfileirar disparo na fila do WhatsApp com modelo oficial do escritório.',
            criterio_sucesso: 'Mensagem enfileirada ou enviada ao contato cadastrado.',
            criterio_erro: 'Número de WhatsApp inválido ou sem autorização.',
            proxima_etapa_nome: 'Receber, validar integridade e arquivar no GED',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 3,
            titulo: 'Receber, validar integridade e arquivar no GED',
            descricao:
              'Checar conformidade do arquivo enviado pelo cliente e calcular hash SHA-256.',
            entrada: 'Arquivo enviado pelo cliente na rota pública',
            acao: 'Conferir tipologia documental e vincular diretamente à pasta do cliente no GED.',
            criterio_sucesso:
              'Documento homologado, pedido baixado como concluído e hash registrado.',
            criterio_erro: 'Arquivo corrompido, ilegível ou de tipo diferente do solicitado.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
        ],
      },
      {
        codigo: 'POP-16',
        nome: 'Backup Independente, GED em Lote & Retenção 7 Snapshots',
        area: 'geral',
        versao: '2026.4',
        objetivo:
          'Garantir soberania de dados do escritório com snapshots diários automatizados e retenção cíclica.',
        gatilho:
          'Job cron diário das 03:30 (backup_independente_job) ou sob demanda do Administrador.',
        pre_condicoes: 'Acesso de perfil Administrador e armazenamento disponível.',
        entradas: '30 coleções do banco de dados e arquivos do GED contábil.',
        sistemas_utilizados: 'Plataforma Rumo /backup, Job Cron e Cofre de Armazenamento.',
        responsavel_cargo: 'Administrador do Sistema / Contador',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_1_automatico',
        requer_aprovacao: false,
        saida: 'Arquivo ZIP/JSON de snapshot exportado com hash SHA-256 e logs auditados.',
        proximo_processo: 'Rotina de Segurança Contínua',
        etapas: [
          {
            ordem: 1,
            titulo: 'Execução do snapshot das 30 coleções e arquivos do GED',
            descricao:
              'Exportar dados estruturados com isolamento de tenant em arquivo compactado.',
            responsavel_tipo: 'Elliza',
            entrada: 'Tabelas do tenant no banco',
            acao: 'Gerar dump JSON das coleções e empacotar metadados em lote.',
            criterio_sucesso:
              'Snapshot gerado com hash SHA-256 e registrado em backups_independentes.',
            criterio_erro: 'Falha de I/O de disco ou estouro de timeout.',
            proxima_etapa_nome: 'Aplicação da política de retenção de 7 snapshots',
            requer_aprovacao: false,
          },
          {
            ordem: 2,
            titulo: 'Aplicação da política de retenção de 7 snapshots',
            descricao: 'Rotacionar snapshots antigos mantendo rigorosamente os últimos 7 arquivos.',
            responsavel_tipo: 'Elliza',
            entrada: 'Lista de snapshots existentes no tenant',
            acao: 'Purgar snapshots além da janela de 7 dias com registro no audit_log.',
            criterio_sucesso: 'Janela de retenção de 7 snapshots preservada com integridade.',
            criterio_erro: 'Falha ao purgar snapshots excedentes.',
            proxima_etapa_nome: 'Download auditado com termo de responsabilidade',
            requer_aprovacao: true,
          },
          {
            ordem: 3,
            titulo: 'Download auditado com termo de responsabilidade',
            descricao:
              'Liberação de download do snapshot mediante termo de ciência do Administrador.',
            responsavel_tipo: 'Humano',
            entrada: 'Solicitação de download pelo Administrador',
            acao: 'Exigir ciência formal e registrar IP, usuário e timestamp no audit_log.',
            criterio_sucesso: 'Download efetuado e rastreabilidade total gravada.',
            criterio_erro: 'Tentativa de download por usuário não administrador.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: true,
          },
        ],
      },
      {
        codigo: 'POP-17',
        nome: 'Escrituração SPED Fiscal, EFD Contribuições & Validador PVA',
        area: 'fiscal',
        versao: '2026.4',
        objetivo:
          'Gerar arquivos do SPED Fiscal e EFD Contribuições com integridade MD5 e validação de blocos.',
        gatilho: 'Encerramento da competência fiscal ou dia 15 do mês subsequente.',
        pre_condicoes:
          'Notas de entrada e saída conferidas e apuração ICMS/IPI/PIS/COFINS concluída.',
        entradas: 'XMLs fiscais, cadastros de produtos, participantes e apurações contábeis.',
        sistemas_utilizados: 'Plataforma Rumo Fiscal, SPED PVA e GED.',
        responsavel_cargo: 'Contador Responsável / Analista Fiscal',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_3_aprovacao_obrigatoria',
        requer_aprovacao: true,
        saida: 'Arquivo TXT oficial do SPED com hash MD5 gravado e arquivado no GED.',
        proximo_processo: 'Assinatura com Certificado A1 no PVA pelo Contador',
        etapas: [
          {
            ordem: 1,
            titulo: 'Compilação dos blocos cadastrais e movimentações',
            descricao:
              'Estruturar blocos 0 (Cadastros), C/D (Notas), E (Apuração ICMS/IPI) e 1 (Outros).',
            responsavel_tipo: 'Elliza',
            entrada: 'Movimentação fiscal do período',
            acao: 'Montar registros conforme o Guia Prático da EFD e preencher totalizadores 9999.',
            criterio_sucesso: 'Arquivo estruturado sem linhas órfãs e com blocos consistentes.',
            criterio_erro: 'Falta de cadastro de participante ou unidade de medida inválida.',
            proxima_etapa_nome: 'Conferência técnica e aprovação pelo Contador CRC (Nível 3)',
            requer_aprovacao: true,
          },
          {
            ordem: 2,
            titulo: 'Conferência técnica e aprovação pelo Contador CRC (Nível 3)',
            descricao:
              'Revisão das apurações de saldo credor/devedor antes da exportação definitiva.',
            responsavel_tipo: 'Humano',
            entrada: 'Arquivo gerado e relatório de consistência',
            acao: 'Validar dados fiscais e assinar autorização de despacho técnico no audit_log.',
            criterio_sucesso: 'Chancela técnica registrada com CRC do contador.',
            criterio_erro: 'Divergência entre apuração interna e valores dos blocos.',
            proxima_etapa_nome: 'Geração do arquivo oficial, hash MD5 e guarda no GED',
            requer_aprovacao: true,
          },
          {
            ordem: 3,
            titulo: 'Geração do arquivo oficial, hash MD5 e guarda no GED',
            descricao: 'Exportar TXT final com cálculo de hash MD5 para importação direta no PVA.',
            responsavel_tipo: 'Elliza',
            entrada: 'Autorização humana registrada',
            acao: 'Gravar arquivo no GED com hash MD5 e disponibilizar para download.',
            criterio_sucesso:
              'Arquivo disponível para importação no PVA e arquivado com segurança.',
            criterio_erro: 'Falha no cálculo do hash ou na gravação do arquivo.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
          },
        ],
      },
      {
        codigo: 'POP-18',
        nome: 'Portal do Empregado & Autoatendimento CLT com Acesso Seguro',
        area: 'pessoal',
        versao: '2026.4',
        objetivo:
          'Disponibilizar canal de autoatendimento para empregados com acesso seguro via CPF e token temporário.',
        gatilho:
          'Disponibilização de holerite, recibo de férias, informe de rendimentos ou admissão.',
        pre_condicoes: 'Colaborador ativo com CPF e dados cadastrais no Departamento Pessoal.',
        entradas: 'Recibos de pagamento aprovados e fichas cadastrais do DP.',
        sistemas_utilizados:
          'Plataforma Rumo, Rota Pública /portal-empregado, Evolution API e GED.',
        responsavel_cargo: 'Analista de DP / Contador',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_1_automatico',
        requer_aprovacao: false,
        saida: 'Documentos visualizados e baixados pelo colaborador com protocolo de ciência.',
        proximo_processo: 'Arquivo de Ciência Trabalhista no DP',
        etapas: [
          {
            ordem: 1,
            titulo: 'Geração e envio de token temporário de acesso seguro',
            descricao: 'Emitir código de verificação temporário de 6 dígitos para o colaborador.',
            responsavel_tipo: 'Elliza',
            entrada: 'CPF informado pelo colaborador na rota /portal-empregado',
            acao: 'Validar vínculo ativo e enviar token por WhatsApp/SMS cadastrado.',
            criterio_sucesso: 'Token emitido com validade limitada de 15 minutos.',
            criterio_erro: 'CPF não localizado entre colaboradores ativos.',
            proxima_etapa_nome: 'Autenticação e disponibilização da área restrita do colaborador',
            requer_aprovacao: false,
          },
          {
            ordem: 2,
            titulo: 'Autenticação e disponibilização da área restrita do colaborador',
            descricao: 'Validar token e exibir holerites, férias, informe de rendimentos e TRCT.',
            responsavel_tipo: 'Elliza',
            entrada: 'Token informado pelo colaborador',
            acao: 'Liberar sessão restrita protegida por LGPD com dados mascarados.',
            criterio_sucesso: 'Colaborador autenticado com histórico de documentos disponível.',
            criterio_erro: 'Token expirado ou código de verificação incorreto.',
            proxima_etapa_nome: 'Registro de protocolo e ciência eletrônica de recebimento',
            requer_aprovacao: false,
          },
          {
            ordem: 3,
            titulo: 'Registro de protocolo e ciência eletrônica de recebimento',
            descricao: 'Registrar timestamp de visualização ou download do holerite com IP.',
            responsavel_tipo: 'Elliza',
            entrada: 'Download efetuado pelo colaborador',
            acao: 'Gravar protocolo eletrônico de ciência na ficha do empregado no DP.',
            criterio_sucesso: 'Ciência registrada com hash de integridade no audit_log.',
            criterio_erro: 'Falha ao gravar protocolo de visualização.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
          },
        ],
      },
      {
        codigo: 'POP-DP-01',
        nome: 'Pró-labore, Fator R e Quadro Societário Real',
        area: 'pessoal',
        versao: '2026.4',
        objetivo:
          'Ciclo mensal completo de apuração do Pró-labore com fonte de sócios no Quadro Societário Real da Ficha Cadastral, cálculo de INSS 11% e IRRF, monitoramento do limiar de 28% do Fator R (Anexo III vs V) e aprovação em lote no Modo Humano com despacho e CRC.',
        gatilho: 'Fechamento mensal da folha de pagamento e apuração do resultado contábil.',
        pre_condicoes:
          'Sócios reais cadastrados na Ficha Cadastral (socios reais importados dos contratos do GED).',
        entradas:
          'Quadro societário real, remuneração mensal acordada, faturamento RBT12 e parâmetros normativos.',
        sistemas_utilizados:
          'Plataforma Rumo DP, Ficha Cadastral Completa, Motor Normativo e Diário Contábil.',
        responsavel_cargo: 'Contador Responsável CRC',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_3_aprovacao_obrigatoria',
        requer_aprovacao: true,
        saida:
          'Recibos de pró-labore no GED com hash SHA-256, Fator R recalculado e despacho com CRC.',
        proximo_processo: 'POP-04 (Fechamento Contábil Mensal) e POP-02 (Folha CLT)',
        regras_negocio:
          'Fonte de sócios: quadro societário real da Ficha Cadastral (#rpa-grid-qsa), importado dos contratos do GED (migração 0117). Monitoramento contínuo do limiar de 28% do Fator R com alerta imediato de transição entre Anexo III e Anexo V. Aprovação em lote no Modo Humano exigindo despacho técnico fundamentado e registro do CRC no audit_log.',
        criterios_sucesso:
          '100% dos sócios ativos apurados, Fator R verificado contra o limiar de 28% e aprovação técnica com CRC registrada.',
        criterios_erro:
          'Sócio sem CPF, pró-labore inferior ao salário mínimo sem respaldo ou divergência de quotas.',
        excecoes:
          'Caso o balancete não esteja encerrado, a distribuição de lucros aguarda o fechamento sem bloquear o pró-labore.',
        etapas: [
          {
            ordem: 1,
            titulo:
              'Identificar sócios ativos no Quadro Societário Real da Ficha Cadastral (#rpa-grid-qsa)',
            descricao:
              'Carregar sócios reais importados dos contratos do GED, validando quotas e remuneração.',
            entrada: 'Ficha Cadastral Completa + Contrato Social arquivado no GED',
            acao: 'Validar vigência e percentuais de participação dos sócios da empresa.',
            criterio_sucesso: 'Sócios identificados com CPF, cargo e quotas somando 100%.',
            criterio_erro: 'Quadro societário desatualizado ou divergência nas quotas contratuais.',
            proxima_etapa_nome: 'Calcular pró-labore mensal (INSS 11% e IRRF Lei 14.663)',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 2,
            titulo: 'Calcular pró-labore mensal (INSS 11% e IRRF Lei 14.663)',
            descricao:
              'Aplicar alíquota de 11% de contribuinte individual (respeitando o teto) e tabela progressiva de IRRF com dedução simplificada.',
            entrada: 'Pró-labore acordado e tabelas normativas vigentes',
            acao: 'Executar motor normativo e apurar valor líquido a pagar.',
            criterio_sucesso: 'Valores de INSS, IRRF e líquido apurados com exatidão matemática.',
            criterio_erro: 'Erro de cálculo ou parâmetros normativos inconsistentes.',
            proxima_etapa_nome: 'Monitorar limiar de 28% do Fator R (Anexo III vs Anexo V)',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
          {
            ordem: 3,
            titulo: 'Monitorar limiar de 28% do Fator R (Anexo III vs Anexo V)',
            descricao:
              'Cruzar Folha/Faturamento dos últimos 12 meses (RBT12) e disparar alertas caso o limiar de 28% seja ultrapassado.',
            entrada: 'Faturamento RBT12 acumulado + Total de pró-labore e folha projetados',
            acao: 'Calcular relação percentual e alertar transição de alíquota efetiva do DAS.',
            criterio_sucesso:
              'Fator R calculado com precisão e alertas gerados em caso de mudança de anexo.',
            criterio_erro: 'Faturamento RBT12 incompleto ou desatualizado.',
            proxima_etapa_nome: 'Aprovação em lote no Modo Humano com despacho e CRC (Nível 3)',
            requer_aprovacao: true,
            responsavel_tipo: 'Humano',
          },
          {
            ordem: 4,
            titulo: 'Aprovação em lote no Modo Humano com despacho e CRC (Nível 3)',
            descricao:
              'Chancela final obrigatória do Contador Responsável para a folha de pró-labore.',
            entrada: 'Minuta da folha de pró-labore + Alertas do Fator R',
            acao: 'Aprovar formalmente no Modo Humano com registro de justificativa técnica e número do CRC.',
            criterio_sucesso: 'Aprovação registrada no audit_log com CRC do responsável.',
            criterio_erro: 'Rejeição fundamentada pelo contador solicitando revisão.',
            proxima_etapa_nome: 'Registrar comprovantes no GED com hash e distribuir lucros',
            requer_aprovacao: true,
            responsavel_tipo: 'Humano',
          },
          {
            ordem: 5,
            titulo: 'Registrar comprovantes no GED com hash e distribuir lucros',
            descricao:
              'Emitir recibos de pró-labore com hash SHA-256 no GED e enfileirar guia no financeiro.',
            entrada: 'Folha de pró-labore chancelada',
            acao: 'Gravar evidências no GED e atualizar status da distribuição de lucros.',
            criterio_sucesso:
              'Recibos registrados com hash SHA-256 e provisão integrada ao financeiro.',
            criterio_erro: 'Falha na gravação do recibo no cofre digital.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
            responsavel_tipo: 'Elliza',
          },
        ],
      },
    ]

    for (const t of allTenants) {
      const tenantId = t.id

      // 1. Marcar instâncias anteriores (2026.3 ou anteriores) como ativo=false (não-vigentes para novas instâncias), sem mutar processos existentes
      try {
        const antigosSops = app.findRecordsByFilter(
          'sops',
          "tenant_id = '" + tenantId + "' && versao != '2026.4'",
          '',
          200,
          0,
        )
        for (const antigo of antigosSops) {
          if (antigo.getBool('ativo') !== false) {
            antigo.set('ativo', false)
            app.save(antigo)
          }
        }
      } catch (errAntigo) {
        console.warn('[MIGRATION-0118] Aviso ao desativar SOPs antigos:', errAntigo)
      }

      // 2. Inserir ou atualizar aditivamente as novas linhas na versão 2026.4
      for (const item of catalogo20264) {
        let rec20264 = null
        try {
          const achados = app.findRecordsByFilter(
            'sops',
            "tenant_id = '" + tenantId + "' && codigo = '" + item.codigo + "' && versao = '2026.4'",
            '',
            1,
            0,
          )
          if (achados.length > 0) rec20264 = achados[0]
        } catch (_) {}

        if (!rec20264) {
          rec20264 = new Record(sopsCol)
          rec20264.set('tenant_id', tenantId)
        }

        rec20264.set('codigo', item.codigo)
        rec20264.set('nome', item.nome)
        rec20264.set('area', item.area)
        rec20264.set('versao', '2026.4')
        rec20264.set('objetivo', item.objetivo)
        rec20264.set('gatilho', item.gatilho)
        rec20264.set('pre_condicoes', item.pre_condicoes)
        rec20264.set('entradas', item.entradas)
        rec20264.set('sistemas_utilizados', item.sistemas_utilizados)
        rec20264.set('responsavel_cargo', item.responsavel_cargo)
        rec20264.set('agente_nome', item.agente_nome)
        rec20264.set('nivel_autonomia', item.nivel_autonomia)
        rec20264.set('etapas_template_json', item.etapas)
        rec20264.set('regras_negocio', item.regras_negocio || '')
        rec20264.set('criterios_sucesso', item.criterios_sucesso || '')
        rec20264.set('criterios_erro', item.criterios_erro || '')
        rec20264.set('excecoes', item.excecoes || '')
        rec20264.set('requer_aprovacao', item.requer_aprovacao)
        rec20264.set('saida', item.saida)
        rec20264.set('proximo_processo', item.proximo_processo)
        rec20264.set('ativo', true)

        app.save(rec20264)
      }
    }
  },
  (app) => {
    // Reversão limpa
  },
)

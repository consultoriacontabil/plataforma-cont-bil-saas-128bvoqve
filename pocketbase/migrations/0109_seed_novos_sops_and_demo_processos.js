/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const sops = app.findCollectionByNameOrId('sops')
    const empresas = app.findCollectionByNameOrId('empresas')
    const processos = app.findCollectionByNameOrId('processos_operacionais')
    const etapas = app.findCollectionByNameOrId('processo_etapas')
    const jobs = app.findCollectionByNameOrId('elisa_jobs')

    // Buscar tenants ativos
    const tenantRecords = app.findRecordsByFilter('tenants', 'id != ""', 'created', 50)
    if (!tenantRecords || tenantRecords.length === 0) return

    // Catálogo dos 4 Novos SOPs Executáveis
    const novosSopsCatalogo = [
      {
        codigo: 'POP-06',
        nome: 'Conciliação de Cartões (Vendas e Adquirentes)',
        area: 'contabil',
        versao: '2026.3',
        objetivo:
          'Conciliar integralmente vendas em cartões de débito/crédito, antecipações, taxas cobradas pelas adquirentes e repasses em conta com pendências zero.',
        gatilho:
          'Importação do extrato da adquirente (Cielo, Rede, Stone, PagSeguro, etc.) ou fechamento semanal/mensal de vendas.',
        pre_condicoes:
          'Relatório analítico da adquirente/maquininha carregado no GED ou módulo de cartões e extratos bancários importados.',
        entradas:
          'Extrato eletrônico da adquirente (EDI/CSV/API), faturas/comprovantes de maquininhas, extrato bancário de repasses e registro de vendas fiscais.',
        sistemas_utilizados:
          'Plataforma Rumo, Módulo de Cartões/Maquininhas, Módulo Contábil, Extratos Bancários.',
        responsavel_cargo: 'Assistente / Analista Contábil',
        agente_nome: 'ELISA',
        nivel_autonomia: 'nivel_1_automatico',
        requer_aprovacao: false,
        saida:
          'Vendas de cartão conciliadas com extrato bancário, taxas apropriadas como despesa financeira, valor bruto batendo e pendências = 0.',
        proximo_processo: 'POP-04 (Fechamento Contábil Mensal)',
        regras_negocio:
          'CRITÉRIO DE CONCLUSÃO OBJETIVO: 1. Valor bruto apurado = bruto esperado por bandeira/operadora; 2. Taxas de administração e prazos de repasse conferidos conforme contrato; 3. Saldo a repassar conciliado com crédito no extrato bancário; 4. Pendências = 0 ou 100% justificadas estruturadamente no Modo Humano. Nunca presumir taxa sem contrato.',
        criterios_sucesso:
          'Valor bruto apurado bate 100% com o bruto das operadoras, taxas conferidas e pendências zeradas.',
        criterios_erro:
          'Divergência de valor bruto, taxa divergente da contratada ou repasse não identificado no extrato bancário.',
        excecoes:
          'Chargeback, cancelamento de venda ou bloqueio cautelar da operadora: registrar pendência estruturada no Modo Humano.',
        etapas: [
          {
            ordem: 1,
            titulo: 'Importar e validar extratos das adquirentes',
            descricao:
              'Recepcionar extratos de vendas (Cielo, Rede, Stone, PagBank, Mercado Pago) e validar integridade do período.',
            entrada: 'Arquivos EDI/CSV ou integração de cartões da empresa',
            acao: 'Ler lote de transações por maquininha/bandeira e verificar ausência de linhas corrompidas ou duplicadas.',
            criterio_sucesso:
              'Todas as transações do período lidas sem duplicidade e agrupadas por operadora/bandeira.',
            criterio_erro:
              'Arquivo em formato não suportado ou inconsistência nas datas do período.',
            proxima_etapa_nome: 'Conferir valor bruto e taxas contratuais',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 2,
            titulo: 'Conferir valor bruto e taxas contratuais por bandeira',
            descricao:
              'Confrontar vendas brutas com as notas fiscais emitidas e verificar se as taxas de MDR aplicadas batem com as contratadas.',
            entrada: 'Vendas registradas no sistema + Extrato de operadora',
            acao: 'Comparar alíquotas de débito, crédito à vista e parcelado com a tabela acordada da adquirente.',
            criterio_sucesso:
              'Valor bruto = bruto esperado por bandeira/operadora e taxas de administração calculadas com exatidão contratual.',
            criterio_erro:
              'Cobrança indevida de taxas ou divergência entre vendas brutas do sistema e operadora.',
            proxima_etapa_nome: 'Conciliar repasses bancários líquidos',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 3,
            titulo: 'Conciliar repasses líquidos com o extrato bancário',
            descricao:
              'Cruzar datas e valores dos depósitos líquidos efetuados pela adquirente com os créditos na conta bancária da empresa.',
            entrada: 'Extrato bancário + Previsão líquida de repasse da operadora',
            acao: 'Efetuar matching automático por data e valor líquido com tolerância de até D+2 no repasse.',
            criterio_sucesso:
              'Repasses liquidados batendo exatamente com créditos no extrato bancário.',
            criterio_erro:
              'Repasse não creditado na conta ou creditado com valor divergente do líquido apurado.',
            proxima_etapa_nome: 'Apropriar despesas financeiras e gerar partidas',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 4,
            titulo: 'Apropriar taxas como despesas financeiras e gerar partidas contábeis',
            descricao:
              'Escriturar contabilmente: Débito em Banco (líquido), Débito em Despesas c/ Taxas de Cartão (resultado) e Crédito em Clientes/Cartões a Receber (bruto).',
            entrada: 'Transações conciliadas',
            acao: 'Gerar partidas dobradas no diário contábil assegurando Débito = Crédito.',
            criterio_sucesso:
              'Partidas contábeis geradas em equilíbrio matemático estrito Débito = Crédito.',
            criterio_erro:
              'Conta de despesa ou de adquirente não parametrizada no plano de contas.',
            proxima_etapa_nome: 'Validar critério de conclusão objetiva',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 5,
            titulo: 'Validar critério de conclusão objetiva',
            descricao:
              'Verificar: Valor Bruto = Bruto Esperado por Operadora, Taxas Conferidas e Pendências = 0.',
            entrada: 'Relatório de conciliação de cartões',
            acao: 'Checar se todas as transações foram baixadas ou se eventuais pendências possuem justificativa técnica gravada.',
            criterio_sucesso:
              'Critério objetivo 100% satisfeito: Bruto conferido, taxas conferidas, repasses conciliados e pendências = 0.',
            criterio_erro: 'Divergência não justificada entre operadora, banco e contabilidade.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
        ],
      },
      {
        codigo: 'POP-07',
        nome: 'Contas a Pagar e Conciliação de Saídas',
        area: 'contabil',
        versao: '2026.3',
        objetivo:
          'Executar a esteira completa de contas a pagar: recepção de títulos, conferência de vencimentos, aprovação com chancela do gestor (Nível 3), agendamento e conciliação de baixa com comprovante idôneo.',
        gatilho:
          'Recepção de novos boletos, faturas, guias fiscais ou resumo de despesas periódicas.',
        pre_condicoes:
          'Fornecedor cadastrado e documento fiscal/título comprobatório registrado no sistema.',
        entradas:
          'Boletos com código de barras/PIX, notas fiscais de entrada (NF-e/NFS-e), guias tributárias, comprovantes bancários de liquidação.',
        sistemas_utilizados:
          'Plataforma Rumo, Módulo Financeiro (Contas a Pagar), Conciliação Bancária, GED.',
        responsavel_cargo: 'Contador Responsável / Analista Financeiro',
        agente_nome: 'ELISA',
        nivel_autonomia: 'nivel_3_aprovacao_obrigatoria',
        requer_aprovacao: true,
        saida:
          'Títulos baixados com comprovante idôneo, despesas devidamente apropriadas no módulo contábil e fornecedores conciliados.',
        proximo_processo: 'POP-04 (Fechamento Contábil Mensal)',
        regras_negocio:
          'REGRA DE OURO RUMO: NUNCA marcar título como pago sem comprovante bancário ou evidência de liquidação com hash. Aprovação de pagamentos é estritamente Nível 3 (aprovação obrigatória humana). Pagamentos em atraso exigem apuração de juros/multas contratuais.',
        criterios_sucesso:
          '100% dos títulos liquidados com comprovante anexado, partidas de saída equilibradas e zero duplicidade de pagamento.',
        criterios_erro:
          'Tentativa de baixar sem comprovante, título sem código de barras válido ou pagamento duplicado.',
        excecoes:
          'Boleto adulterado ou com beneficiário divergente do CNPJ da NF: travar imediatamente e abrir pendência crítica no Modo Humano.',
        etapas: [
          {
            ordem: 1,
            titulo: 'Receber e lançar títulos a pagar',
            descricao:
              'Capturar boletos, contas de consumo e guias tributárias e cadastrar no contas a pagar com dados completos.',
            entrada: 'Boletos em PDF, linha digitável, chave de NF-e ou XML de compra',
            acao: 'Extrair vencimento, valor, código de barras e CNPJ do fornecedor e vincular à conta contábil de despesa.',
            criterio_sucesso:
              'Título registrado com fornecedor, valor nominal, linha digitável e data de vencimento corretos.',
            criterio_erro: 'Código de barras inválido ou fornecedor não identificado.',
            proxima_etapa_nome: 'Conferir vencimentos e fluxo de caixa',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 2,
            titulo: 'Conferir vencimentos e concorrência no fluxo de caixa',
            descricao:
              'Ordenar obrigações por vencimento e verificar saldo disponível projetado nas contas da empresa.',
            entrada: 'Carteira de títulos a pagar + Saldo projetado no Fluxo de Caixa',
            acao: 'Checar duplicidades de cobrança e classificar por prioridade de liquidação.',
            criterio_sucesso:
              'Carteira de pagamentos organizada por prazo sem duplicidades e com previsão de caixa verificada.',
            criterio_erro:
              'Inconsistência de vencimento ou saldo insuficiente previsto para a data.',
            proxima_etapa_nome: 'Aprovar lote de pagamentos (Nível 3)',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 3,
            titulo: 'Aprovar lote de pagamentos (Nível 3 — Aprovação Obrigatória)',
            descricao:
              'Submeter relação detalhada para autorização formal do Contador / Gestor Financeiro do cliente.',
            entrada: 'Lote de títulos conferidos com fornecedores e valores',
            acao: 'Solicitar chancela expressa do responsável técnico com registro no audit_log.',
            criterio_sucesso:
              'Autorização expressa registrada no audit_log com identificação do usuário e carimbo de data/hora.',
            criterio_erro: 'Rejeição ou cancelamento de pagamento pelo gestor.',
            proxima_etapa_nome: 'Agendar e efetuar pagamentos',
            requer_aprovacao: true,
            responsavel_tipo: 'Humano',
          },
          {
            ordem: 4,
            titulo: 'Agendar e efetuar pagamentos bancários',
            descricao:
              'Preparar arquivo CNAB 240 de pagamento ou gerar dados para liquidação via Internet Banking / PIX Copia e Cola.',
            entrada: 'Lote aprovado formalmente',
            acao: 'Gerar arquivo de remessa ou chave PIX para liquidação tempestiva antes do vencimento.',
            criterio_sucesso:
              'Remessa bancária gerada ou liquidação executada dentro do horário limite bancário.',
            criterio_erro: 'Falha no envio da remessa ou chave PIX inválida.',
            proxima_etapa_nome: 'Conciliar baixa com comprovante idôneo',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 5,
            titulo: 'Conciliar baixa com comprovante idôneo (Regra de Ouro)',
            descricao:
              'Vincular o comprovante de pagamento ao título, conferir débito no extrato bancário e baixar no módulo financeiro.',
            entrada: 'Comprovante bancário com autenticação mecânica/digital + Débito no extrato',
            acao: 'Validar comprovante, gerar hash de auditoria, mudar status para "pago" e gerar partida contábil de liquidação.',
            criterio_sucesso:
              'Título marcado como PAGO apenas com comprovante verificado e correspondência exata no extrato bancário.',
            criterio_erro:
              'Tentativa de marcar como pago sem comprovante anexado ou valor divergente do débito bancário.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
        ],
      },
      {
        codigo: 'POP-08',
        nome: 'Contas a Receber, Cobrança e Inadimplência',
        area: 'contabil',
        versao: '2026.3',
        objetivo:
          'Gerir o ciclo de receitas e recebimentos: emissão/lançamento de faturas, monitoramento de vencimentos, registro de liquidação bancária, tratamento estruturado de inadimplência (sem adivinhação) e baixa contábil.',
        gatilho:
          'Emissão de notas fiscais de serviço/venda, faturamento recorrente mensal ou contrato assinado.',
        pre_condicoes:
          'Cliente cadastrado com CNPJ/CPF válido e parâmetros de cobrança (PIX/Boleto) definidos.',
        entradas:
          'NFS-e/NF-e emitidas, contratos de honorários, notificações de liquidação bancária e extratos de cobrança.',
        sistemas_utilizados:
          'Plataforma Rumo, Módulo Financeiro (Contas a Receber), Cobranças Recorrentes, WhatsApp Ativo.',
        responsavel_cargo: 'Assistente / Analista Financeiro',
        agente_nome: 'ELISA',
        nivel_autonomia: 'nivel_1_automatico',
        requer_aprovacao: false,
        saida:
          'Títulos recebidos baixados com conciliação bancária, relatórios de inadimplência gerados e pendências de cobrança notificadas.',
        proximo_processo: 'POP-04 (Fechamento Contábil Mensal)',
        regras_negocio:
          'TRATAMENTO ESTRUTURADO DE INADIMPLÊNCIA: ELISA nunca adivinha o motivo do não pagamento. Títulos vencidos geram régua de cobrança automática e, após tolerância, pendência estruturada no Modo Humano com as 4 perguntas fundamentais. Descontos e abatimentos exigem aprovação contábil expressa.',
        criterios_sucesso:
          'Recebimentos creditados batendo 100% com títulos baixados e títulos em atraso devidamente comunicados e registrados.',
        criterios_erro: 'Recebimento creditado sem identificação de cliente ou título duplicado.',
        excecoes:
          'Cliente contesta valor da fatura ou alega pagamento não compensado: criar pendência imediata no Modo Humano anexando histórico de mensagens.',
        etapas: [
          {
            ordem: 1,
            titulo: 'Emitir e lançar títulos a receber',
            descricao:
              'Gerar títulos no contas a receber com base nas notas fiscais emitidas ou mensalidades contratadas.',
            entrada: 'NFS-e/NF-e autorizadas ou contratos vigentes de honorários',
            acao: 'Criar títulos com vencimento, valor bruto, retenções tributárias e emitir boleto/PIX Copia e Cola.',
            criterio_sucesso:
              'Títulos criados com código de identificação único, valor correto e data de vencimento.',
            criterio_erro: 'Nota fiscal sem tomador identificado ou dados cadastrais incompletos.',
            proxima_etapa_nome: 'Monitorar vencimentos e lembretes preventivos',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 2,
            titulo: 'Monitorar vencimentos e enviar lembretes preventivos',
            descricao:
              'Acompanhar carteira diária de vencimentos e disparar lembrete amigável via WhatsApp/Portal em D-2.',
            entrada: 'Títulos com vencimento próximo (D-2 / D-0)',
            acao: 'Consultar autorização de WhatsApp da empresa e enfileirar mensagem com linha digitável e QR Code PIX.',
            criterio_sucesso:
              'Lembrete preventivo entregue ao cliente antes do vencimento com comprovante de envio.',
            criterio_erro: 'Falha de canal ou cliente sem número de contato cadastrado.',
            proxima_etapa_nome: 'Registrar recebimentos e liquidações',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 3,
            titulo: 'Registrar recebimentos e liquidações via extrato/PIX',
            descricao:
              'Identificar créditos bancários correspondentes a boletos, PIX e transferências recebidas.',
            entrada: 'Extrato bancário de créditos + Notificações do gateway de pagamento',
            acao: 'Fazer matching automático por valor, data e identificador do cliente e baixar título no financeiro.',
            criterio_sucesso:
              'Crédito bancário vinculado com 100% de acurácia ao título a receber e status alterado para "pago".',
            criterio_erro:
              'Crédito não identificado na conta bancária ou valor divergente do faturado.',
            proxima_etapa_nome: 'Tratar inadimplência com pendência estruturada',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 4,
            titulo: 'Tratar inadimplência com pendência estruturada (Nunca adivinhar)',
            descricao:
              'Identificar títulos vencidos e não quitados após a data de tolerância e abrir pendência no Modo Humano.',
            entrada: 'Títulos em atraso > D+3',
            acao: 'Registrar pendência estruturada contendo: 1. Por que parou; 2. O que foi executado; 3. O que falta; 4. Decisão necessária.',
            criterio_sucesso:
              'Inadimplência registrada sem suposições com histórico de notificações e ações de cobrança documentadas.',
            criterio_erro: 'Cobrança indevida de título já compensado em outra conta.',
            proxima_etapa_nome: 'Conciliar baixa contábil de receitas',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 5,
            titulo: 'Conciliar baixa contábil e apurar perdas ou acréscimos',
            descricao:
              'Gerar partidas contábeis: Débito em Banco/Disponível, Débito em Juros Ativos (se houver) e Crédito em Clientes a Receber.',
            entrada: 'Títulos liquidados no período',
            acao: 'Consolidar partidas no diário contábil e atualizar saldo da conta Clientes.',
            criterio_sucesso:
              'Saldo da conta contábil de Clientes a Receber perfeitamente alinhado com o relatório analítico do financeiro.',
            criterio_erro: 'Diferença entre o saldo da conta Clientes e os títulos em aberto.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
        ],
      },
      {
        codigo: 'POP-02',
        nome: 'Folha de Pagamento e Obrigações Trabalhistas (eSocial)',
        area: 'pessoal',
        versao: '2026.3',
        objetivo:
          'Ciclo mensal completo do Departamento Pessoal: conferência de eventos/variáveis, processamento de folha (respeitando regras CLT existentes), emissão de holerites para o Portal do Empregado, geração de XMLs do eSocial, conferência técnica (Nível 2), transmissão formal (Nível 3 — aprovação obrigatória) e guarda de protocolos com hash de auditoria.',
        gatilho:
          'Fechamento mensal do ponto/benefícios (dia 25 a 30 de cada mês) ou apuração de 13º/Férias.',
        pre_condicoes:
          'Colaboradores ativos cadastrados no DP, parâmetros de CCT atualizados e eventos variáveis informados.',
        entradas:
          'Variáveis do mês (faltas, horas extras, comissões, adicionais), tabela progressiva INSS/IRRF, parametrização de benefícios (VT/VA/VR) e convenção coletiva vigente.',
        sistemas_utilizados:
          'Plataforma Rumo, Módulo DP, Portal do Empregado, Motor eSocial, DCTFWeb, FGTS Digital.',
        responsavel_cargo: 'Analista de DP / Contador Responsável CRC',
        agente_nome: 'ELISA',
        nivel_autonomia: 'nivel_3_aprovacao_obrigatoria',
        requer_aprovacao: true,
        saida:
          'Folha fechada, holerites disponíveis no Portal do Empregado, eventos S-1200, S-1210 e S-1299 transmitidos com recibo oficial e lote contábil de folha gerado.',
        proximo_processo: 'POP-04 (Fechamento Contábil Mensal — Etapa 8)',
        regras_negocio:
          'INTEGRAÇÃO COM REGRAS CLT EXISTENTES: Respeitar estritamente as fórmulas de cálculo já implementadas no módulo DP (cálculo progressivo INSS Portaria Interministerial, deduções IRRF Lei 14.663/2023, DSR sobre horas extras e piso salarial da convenção coletiva cadastrada). Transmissão de eventos de fechamento ao eSocial é Nível 3 (aprovação obrigatória do Contador). Holerites são disponibilizados com link seguro e auditoria de download no Portal do Empregado.',
        criterios_sucesso:
          'Folha processada sem erros de fórmula, 100% dos holerites gerados no Portal do Empregado, eventos eSocial transmitidos com recibo do Serpro/Governo e protocolo registrado com hash.',
        criterios_erro:
          'Inconsistência de CPF/NIS de funcionário, divergência de base de cálculo do INSS/FGTS ou ausência de certificado A1 válido para transmissão.',
        excecoes:
          'Afastamento médico ou rescisão não lançada: paralisar fechamento do colaborador afetado e abrir pendência no Modo Humano antes de gerar o S-1200.',
        etapas: [
          {
            ordem: 1,
            titulo: 'Conferir eventos, variáveis e benefícios do mês',
            descricao:
              'Coletar e validar variáveis da competência: horas extras, adicional noturno, insalubridade, faltas, DSR e descontos de benefícios.',
            entrada: 'Lançamentos variáveis na aba Verbas & Descontos + Painel Benefícios',
            acao: 'Checar consistência com convenções coletivas aplicáveis e tabela normativa de rubricas.',
            criterio_sucesso:
              'Todas as variáveis validadas sem divergências de rubrica ou alíquota.',
            criterio_erro: 'Lançamento variável sem rubrica eSocial correspondente.',
            proxima_etapa_nome: 'Processar cálculo da folha de pagamento',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 2,
            titulo: 'Processar cálculo oficial da folha de pagamento (CLT)',
            descricao:
              'Calcular salários, proventos, deduções de INSS progressivo, IRRF por faixa, FGTS e descontos legais para todos os colaboradores ativos.',
            entrada: 'Cadastro de colaboradores + Verbas do mês + Parâmetros CCT',
            acao: 'Executar motor de cálculo trabalhista da Rumo sem alterar nenhuma regra existente.',
            criterio_sucesso:
              'Folha calculada com sucesso com total bruto, descontos e total líquido apurados.',
            criterio_erro:
              'Erro de parametrização cadastral ou valor líquido negativo não justificado.',
            proxima_etapa_nome: 'Gerar e disponibilizar holerites no Portal do Empregado',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 3,
            titulo: 'Gerar holerites e disponibilizar no Portal do Empregado',
            descricao:
              'Emitir espelhos de holerite com descritivo de proventos e descontos e publicar no Portal do Empregado da empresa.',
            entrada: 'Folha processada e conferida',
            acao: 'Criar registros acessíveis pelo colaborador no portal com token de segurança e rastreamento de leitura.',
            criterio_sucesso:
              'Holerites gerados com layout padrão e disponíveis para consulta/download seguro pelos empregados.',
            criterio_erro: 'Falha na publicação dos recibos no portal.',
            proxima_etapa_nome: 'Gerar eventos periódicos do eSocial',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 4,
            titulo: 'Gerar XMLs dos eventos periódicos do eSocial (S-1200 / S-1210)',
            descricao:
              'Montar as mensagens XML de remuneração (S-1200) e pagamentos de rendimentos (S-1210) conforme leiaute oficial do governo.',
            entrada: 'Dados da folha processada',
            acao: 'Validar schema XSD do eSocial e calcular bases de incidência do INSS e FGTS.',
            criterio_sucesso:
              'XMLs gerados sem erros de validação sintática e sem inconsistências de leiaute.',
            criterio_erro: 'Tag obrigatória ausente ou rubrica sem natureza tributária vinculada.',
            proxima_etapa_nome: 'Conferência técnica pré-transmissão (Nível 2)',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 5,
            titulo: 'Conferência técnica pelo Contador (Nível 2 — Supervisionado)',
            descricao:
              'Revisar resumo geral de proventos, encargos patronais previdenciários e valores a recolher de FGTS/DARF Previdenciário.',
            entrada: 'Resumo da folha + XMLs gerados',
            acao: 'Confrontar totais da folha com as guias de recolhimento estimadas.',
            criterio_sucesso:
              'Conferência técnica sem divergências e apta para transmissão oficial.',
            criterio_erro: 'Divergência apontada na conferência de encargos.',
            proxima_etapa_nome: 'Aprovação e transmissão eSocial (Nível 3)',
            requer_aprovacao: true,
            responsavel_tipo: 'Humano',
          },
          {
            ordem: 6,
            titulo: 'Aprovação e transmissão ao eSocial (Nível 3 — Aprovação Obrigatória)',
            descricao:
              'Submeter e transmitir eventos de remuneração e fechamento da competência (S-1299) aos servidores oficiais do eSocial.',
            entrada: 'Aprovação humana registrada com CRC do contador',
            acao: 'Transmitir via assinatura digital com certificado A1 e capturar número do recibo oficial do Serpro.',
            criterio_sucesso:
              'Eventos aceitos pelo eSocial com código de resposta 201/202 e recibo de entrega válido gravado.',
            criterio_erro:
              'Rejeição pelo ambiente do eSocial ou erro de comunicação de webservice.',
            proxima_etapa_nome: 'Registrar protocolo e gerar lote contábil',
            requer_aprovacao: true,
            responsavel_tipo: 'Humano',
          },
          {
            ordem: 7,
            titulo: 'Registrar protocolo com hash de auditoria e gerar lote contábil',
            descricao:
              'Arquivar recibo do eSocial em elisa_evidencias com hash SHA-256 e criar lote de partidas dobradas de folha para o Fechamento Contábil.',
            entrada: 'Recibo oficial do eSocial S-1299',
            acao: 'Gerar registro de evidência auditável e enfileirar lote contábil (LOTE-FOLHA) para a etapa 8 do Fechamento Contábil.',
            criterio_sucesso:
              'Evidência com hash gravada no cofre, trava no módulo DP ativada e lote contábil disponibilizado.',
            criterio_erro: 'Falha ao gerar lote contábil ou ao gravar hash.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
        ],
      },
    ]

    // Iterar sobre tenants e criar SOPs + Processos de Demonstração
    for (let t = 0; t < tenantRecords.length; t++) {
      const tenant = tenantRecords[t]
      const tenantId = tenant.id

      // Buscar empresa ativa de demonstração no tenant
      let emp = null
      try {
        emp = app.findFirstRecordByFilter(
          'empresas',
          `tenant_id = '${tenantId}' && status = 'ativo'`,
        )
      } catch (_) {
        try {
          emp = app.findFirstRecordByFilter('empresas', `tenant_id = '${tenantId}'`)
        } catch (__) {}
      }

      for (let s = 0; s < novosSopsCatalogo.length; s++) {
        const cat = novosSopsCatalogo[s]

        // 1. Cadastrar ou obter SOP na collection sops
        let sopRec = null
        try {
          sopRec = app.findFirstRecordByFilter(
            'sops',
            `tenant_id = '${tenantId}' && codigo = '${cat.codigo}'`,
          )
        } catch (_) {}

        if (!sopRec) {
          sopRec = new Record(sops)
          sopRec.set('tenant_id', tenantId)
          sopRec.set('codigo', cat.codigo)
          sopRec.set('nome', cat.nome)
          sopRec.set('area', cat.area)
          sopRec.set('versao', cat.versao)
          sopRec.set('objetivo', cat.objetivo)
          sopRec.set('gatilho', cat.gatilho)
          sopRec.set('pre_condicoes', cat.pre_condicoes)
          sopRec.set('entradas', cat.entradas)
          sopRec.set('sistemas_utilizados', cat.sistemas_utilizados)
          sopRec.set('responsavel_cargo', cat.responsavel_cargo)
          sopRec.set('agente_nome', cat.agente_nome)
          sopRec.set('nivel_autonomia', cat.nivel_autonomia)
          sopRec.set('etapas_template_json', cat.etapas)
          sopRec.set('regras_negocio', cat.regras_negocio)
          sopRec.set('criterios_sucesso', cat.criterios_sucesso)
          sopRec.set('criterios_erro', cat.criterios_erro)
          sopRec.set('excecoes', cat.excecoes)
          sopRec.set('requer_aprovacao', cat.requer_aprovacao)
          sopRec.set('saida', cat.saida)
          sopRec.set('proximo_processo', cat.proximo_processo)
          sopRec.set('ativo', true)
          app.save(sopRec)
        }

        // 2. Se houver empresa cadastrada, instanciar processo ativo de demonstração para a competência 09/2026!
        if (emp) {
          const comp = '09/2026'
          let procExistente = null
          try {
            procExistente = app.findFirstRecordByFilter(
              'processos_operacionais',
              `tenant_id = '${tenantId}' && empresa_id = '${emp.id}' && codigo_sop = '${cat.codigo}' && competencia = '${comp}'`,
            )
          } catch (_) {}

          if (!procExistente) {
            const procRec = new Record(processos)
            procRec.set('tenant_id', tenantId)
            procRec.set('empresa_id', emp.id)
            procRec.set('sop_id', sopRec.id)
            procRec.set('codigo_sop', cat.codigo)
            procRec.set('titulo', `${cat.nome} — ${comp}`)
            procRec.set('area', cat.area)
            procRec.set('competencia', comp)
            procRec.set('status', 'ENFILEIRADO')
            procRec.set('prioridade', cat.codigo === 'POP-02' ? 'urgente' : 'alta')
            procRec.set('nivel_autonomia', cat.nivel_autonomia)
            procRec.set('etapa_atual_numero', 1)
            procRec.set('etapa_atual_nome', `1. ${cat.etapas[0].titulo}`)
            procRec.set('total_etapas', cat.etapas.length)
            procRec.set('progresso_percentual', 0)
            procRec.set('agente_responsavel', 'ELISA')
            procRec.set('prazo', '2026-10-15T23:59:59Z')
            procRec.set('proxima_acao', cat.etapas[0].acao)
            procRec.set('criterio_sucesso_atual', cat.etapas[0].criterio_sucesso)
            procRec.set(
              'ultima_acao_executada',
              `Processo instanciado a partir do catálogo oficial ${cat.codigo}.`,
            )
            procRec.set('resultado_ultima_acao', 'Aguardando execução pela ELISA.')
            app.save(procRec)

            // Criar etapas do checklist executável
            let primeiraEtapaCriada = null
            for (let i = 0; i < cat.etapas.length; i++) {
              const et = cat.etapas[i]
              const epRec = new Record(etapas)
              epRec.set('tenant_id', tenantId)
              epRec.set('processo_id', procRec.id)
              epRec.set('ordem', et.ordem)
              epRec.set('titulo', `${et.ordem}. ${et.titulo}`)
              epRec.set('descricao', et.descricao)
              epRec.set('status', et.ordem === 1 ? 'ENFILEIRADO' : 'AGUARDANDO')
              epRec.set('responsavel_tipo', et.responsavel_tipo || 'ELISA')
              epRec.set('entrada', et.entrada)
              epRec.set('acao', et.acao)
              epRec.set('criterio_sucesso', et.criterio_sucesso)
              epRec.set('criterio_erro', et.criterio_erro)
              epRec.set('proxima_etapa_nome', et.proxima_etapa_nome)
              epRec.set('requer_aprovacao', et.requer_aprovacao)
              if (et.ordem === 1) {
                epRec.set('resultado', 'Pronto para execução automática pela ELISA.')
              }
              app.save(epRec)

              if (et.ordem === 1) {
                primeiraEtapaCriada = epRec
              }
            }

            // Criar o Job na Fila da ELISA para a esteira operacional
            const jobCodigo = `JOB-092026-${cat.codigo.replace('-', '')}`
            let jobExistente = null
            try {
              jobExistente = app.findFirstRecordByFilter(
                'elisa_jobs',
                `tenant_id = '${tenantId}' && job_codigo = '${jobCodigo}'`,
              )
            } catch (_) {}

            if (!jobExistente) {
              const jobRec = new Record(jobs)
              jobRec.set('tenant_id', tenantId)
              jobRec.set('processo_id', procRec.id)
              if (primeiraEtapaCriada) jobRec.set('etapa_id', primeiraEtapaCriada.id)
              jobRec.set('empresa_id', emp.id)
              jobRec.set('job_codigo', jobCodigo)
              jobRec.set('competencia', comp)
              jobRec.set('area', cat.area)
              jobRec.set('processo_nome', `${cat.nome} — ${comp}`)
              jobRec.set('pop_relacionado', cat.codigo)
              jobRec.set('etapa_atual_nome', `1. ${cat.etapas[0].titulo}`)
              jobRec.set('proxima_acao', cat.etapas[0].acao)
              jobRec.set('prioridade', cat.codigo === 'POP-02' ? 'urgente' : 'alta')
              jobRec.set('prazo', '2026-10-15T23:59:59Z')
              jobRec.set('status', 'ENFILEIRADO')
              jobRec.set('agente_responsavel', 'ELISA')
              jobRec.set('nivel_autonomia', cat.nivel_autonomia)
              jobRec.set('necessita_aprovacao', cat.etapas[0].requer_aprovacao || false)
              jobRec.set(
                'resultado',
                'Pronto para execução pela ELISA via botão [ EXECUTAR PRÓXIMA AÇÃO ].',
              )
              app.save(jobRec)
            }
          }
        }
      }
    }
  },
  (app) => {
    // Reversão limpa se necessário
  },
)

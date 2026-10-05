/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const sops = app.findCollectionByNameOrId('sops')
    const empresas = app.findCollectionByNameOrId('empresas')
    const processos = app.findCollectionByNameOrId('processos_operacionais')
    const etapas = app.findCollectionByNameOrId('processo_etapas')
    const jobs = app.findCollectionByNameOrId('elisa_jobs')

    // Buscar lista de tenants
    const tenantRecords = app.findRecordsByFilter('tenants', 'id != ""', 'created', 50)
    if (!tenantRecords || tenantRecords.length === 0) return

    // Catálogo dos 18+ POPs estruturados em SOPs Executáveis
    const sopsCatalogo = [
      {
        codigo: 'POP-01',
        nome: 'Onboarding de Clientes e Validação Cadastral',
        area: 'societario',
        versao: '2026.3',
        objetivo: 'Recepcionar novo cliente, validar CNPJ na Receita, migrar planilhas e cofre A1.',
        gatilho: 'Novo cliente contratado ou cadastro assistido iniciado.',
        pre_condicoes: 'CNPJ válido e dados cadastrais básicos fornecidos.',
        entradas: 'Cartão CNPJ, Contrato Social, Certificado Digital A1, Balanço anterior.',
        sistemas_utilizados: 'Plataforma Rumo, Consulta CNPJ RFB, GED Contábil.',
        responsavel_cargo: 'Analista de Onboarding',
        agente_nome: 'ELISA',
        nivel_autonomia: 'nivel_2_supervisionado',
        requer_aprovacao: false,
        saida: 'Empresa ativa na plataforma, plano de contas vinculado e GED organizado.',
        proximo_processo: 'POP-05 (Conciliação Bancária) e POP-02 (Folha de Pagamento)',
        etapas: [
          {
            ordem: 1,
            titulo: 'Consultar CNPJ e Situação Cadastral RFB',
            descricao: 'Verificar status ativo, CNAEs primário e secundários e regime tributário.',
            entrada: 'Número de CNPJ fornecido',
            acao: 'Consultar API oficial de CNPJs públicos e preencher dados cadastrais.',
            criterio_sucesso: 'CNPJ ativo e dados cadastrais idênticos aos da Receita Federal.',
            criterio_erro: 'CNPJ inapto, suspenso ou baixado.',
            proxima_etapa_nome: 'Validar Certificado Digital A1',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 2,
            titulo: 'Validar e Guardar Certificado Digital A1',
            descricao:
              'Importar arquivo .pfx, validar senha, extrair validade e salvar no cofre seguro.',
            entrada: 'Arquivo A1 e senha fornecida',
            acao: 'Testar autenticidade do par criptográfico e registrar expiração.',
            criterio_sucesso: 'Certificado válido com validade superior a 30 dias.',
            criterio_erro: 'Senha incorreta ou certificado expirado.',
            proxima_etapa_nome: 'Importar Saldos Iniciais e Plano de Contas',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 3,
            titulo: 'Importar Saldos Iniciais e Plano de Contas',
            descricao: 'Processar balancete de transição do contador anterior.',
            entrada: 'Planilha ou balancete anterior',
            acao: 'Mapear contas para o plano oficial e verificar se Ativo = Passivo + PL.',
            criterio_sucesso: 'Diferença de saldos de transição igual a zero.',
            criterio_erro: 'Desbalanceamento entre ativo e passivo na transição.',
            proxima_etapa_nome: 'Concluir Onboarding e Liberar Operações',
            requer_aprovacao: true,
            responsavel_tipo: 'Humano',
          },
          {
            ordem: 4,
            titulo: 'Concluir Onboarding e Liberar Operações',
            descricao: 'Validar checklist completo e liberar acesso aos módulos da Rumo.',
            entrada: 'Checklist com 100% dos passos essenciais',
            acao: 'Ativar empresa e disparar boas-vindas com link do Portal do Cliente.',
            criterio_sucesso: 'Empresa com status "ativo" e usuário gestor notificado.',
            criterio_erro: 'Pendências impeditivas não justificadas.',
            proxima_etapa_nome: 'Fechamento Contábil Mensal',
            requer_aprovacao: true,
            responsavel_tipo: 'Humano',
          },
        ],
      },
      {
        codigo: 'POP-04',
        nome: 'Fechamento Contábil Mensal Completo',
        area: 'contabil',
        versao: '2026.3',
        objetivo:
          'Ciclo completo de fechamento contábil mensal com partidas dobradas e travas retroativas.',
        gatilho: 'Vencimento da competência contábil (mensal).',
        pre_condicoes: 'Mês calendário anterior encerrado e documentos da competência importados.',
        entradas:
          'Extratos bancários OFX/CSV, comprovantes, faturas de cartão, notas fiscais, resumo de folha.',
        sistemas_utilizados: 'Plataforma Rumo, Módulo Contábil, Mapeamento De-Para, GED.',
        responsavel_cargo: 'Contador Responsável CRC',
        agente_nome: 'ELISA',
        nivel_autonomia: 'nivel_3_aprovacao_obrigatoria',
        requer_aprovacao: true,
        saida: 'Balancete de Verificação, DRE, Balanço Patrimonial e Competência Travada.',
        proximo_processo: 'Demonstrativos e Assinaturas Digitais',
        etapas: [
          {
            ordem: 1,
            titulo: 'Receber documentos da competência',
            descricao: 'Coletar extratos bancários, faturas e comprovantes enviados pelo cliente.',
            entrada: 'GED e Pedidos de Documentos',
            acao: 'Verificar integridade dos arquivos recebidos para a competência alvo.',
            criterio_sucesso: 'Todos os documentos obrigatórios carregados sem corrupção.',
            criterio_erro: 'Ausência de extratos bancários ou documentos faltantes.',
            proxima_etapa_nome: 'Validar integridade dos documentos',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 2,
            titulo: 'Validar documentos recebidos',
            descricao: 'Checar consistência de datas, valores e identificação da empresa.',
            entrada: 'Documentos do GED',
            acao: 'Classificar tipologia documental e vincular às contas contábeis correspondentes.',
            criterio_sucesso: 'Documentos validados e aptos para escrituração contábil.',
            criterio_erro: 'Documentos pertencentes a outra competência ou empresa.',
            proxima_etapa_nome: 'Importar extratos bancários',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 3,
            titulo: 'Importar extratos bancários',
            descricao: 'Carregar extratos em OFX ou CSV para as contas financeiras cadastradas.',
            entrada: 'Arquivos OFX bancários',
            acao: 'Processar extratos e gerar linhas de transações com saldo inicial e final.',
            criterio_sucesso: 'Todas as linhas do extrato importadas sem duplicações.',
            criterio_erro: 'Arquivo de formato inválido ou transações com hash idêntico.',
            proxima_etapa_nome: 'Conciliar contas bancárias',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 4,
            titulo: 'Conciliar contas bancárias',
            descricao: 'Cruzar lançamentos do extrato com contas a pagar/receber e provisões.',
            entrada: 'Linhas do extrato + contas financeiras',
            acao: 'Vincular títulos e gerar partidas dobradas para despesas e receitas.',
            criterio_sucesso: 'Saldo bancário = Saldo contábil e pendências = 0.',
            criterio_erro: 'Lançamento bancário sem classificação identificada.',
            proxima_etapa_nome: 'Conferir faturas de cartões de crédito',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 5,
            titulo: 'Conferir faturas de cartões de crédito',
            descricao: 'Conciliar faturas corporativas com comprovantes fiscais.',
            entrada: 'Faturas de cartão e recibos',
            acao: 'Apropriar despesas operacionais e classificar contas correspondentes.',
            criterio_sucesso: 'Total da fatura bate exatamente com lançamentos apropriados.',
            criterio_erro: 'Despesa não identificada ou duplicada na fatura.',
            proxima_etapa_nome: 'Conferir contas a pagar',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 6,
            titulo: 'Conferir contas a pagar',
            descricao: 'Baixar títulos pagos na competência e provisionar juros/multas se houver.',
            entrada: 'Módulo financeiro de pagamentos',
            acao: 'Realizar conciliação de fornecedores e contas de terceiros.',
            criterio_sucesso: 'Títulos pagos baixados e fornecedores conciliados.',
            criterio_erro: 'Pagamento não localizado ou duplicado no financeiro.',
            proxima_etapa_nome: 'Conferir contas a receber',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 7,
            titulo: 'Conferir contas a receber',
            descricao: 'Verificar recebimentos de clientes e liquidação de boletos/PIX.',
            entrada: 'Relatório de cobranças e créditos bancários',
            acao: 'Baixar títulos recebidos e apurar eventuais perdas ou inadimplência.',
            criterio_sucesso: 'Recebimentos do período batendo com créditos contábeis.',
            criterio_erro: 'Recebimento de cliente não identificado ou divergência de valor.',
            proxima_etapa_nome: 'Conferir integração da folha de pagamento',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 8,
            titulo: 'Conferir folha de pagamento (DP)',
            descricao: 'Integrar provisão de salários, INSS, FGTS, férias e 13º da competência.',
            entrada: 'Resumo da folha fechada no DP (LOTE-FOLHA)',
            acao: 'Verificar partidas contábeis geradas na conta de Salários a Pagar e Encargos.',
            criterio_sucesso: 'Provisões de folha idênticas ao total líquido e guias de encargos.',
            criterio_erro: 'Folha da competência ainda aberta ou sem lote de integração gerado.',
            proxima_etapa_nome: 'Conferir impostos e apuração fiscal',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 9,
            titulo: 'Conferir impostos apurados (Fiscal)',
            descricao:
              'Integrar provisões tributárias (Simples Nacional, ICMS, ISS, IRPJ, CSLL, PIS, COFINS).',
            entrada: 'Apuração do Módulo Fiscal (LOTE-FISC)',
            acao: 'Conferir créditos, débitos fiscais e guias geradas.',
            criterio_sucesso: 'Total de tributos a recolher contábil = guias fiscais emitidas.',
            criterio_erro: 'Apuração fiscal pendente para a competência.',
            proxima_etapa_nome: 'Processar contabilidade e partidas dobradas',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 10,
            titulo: 'Processar contabilidade e partidas dobradas',
            descricao:
              'Consolidar todos os lotes no diário contábil e verificar equilíbrio Débito = Crédito.',
            entrada: 'Todos os lançamentos do período',
            acao: 'Executar validação matemática estrita da equação patrimonial.',
            criterio_sucesso: 'Soma dos Débitos = Soma dos Créditos (Diferença = R$ 0,00).',
            criterio_erro: 'Partidas simples ou saldo desbalanceado.',
            proxima_etapa_nome: 'Gerar balancete de verificação',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 11,
            titulo: 'Gerar balancete de verificação',
            descricao: 'Emitir balancete de verificação analítico da competência.',
            entrada: 'Plano de contas + movimentação do período',
            acao: 'Calcular saldos anteriores, débitos, créditos e saldos finais de todas as contas.',
            criterio_sucesso:
              'Balancete gerado sem inconsistências nem saldos invertidos não justificados.',
            criterio_erro: 'Conta com saldo em desacordo com a natureza contábil.',
            proxima_etapa_nome: 'Gerar DRE da competência',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 12,
            titulo: 'Gerar DRE (Demonstração do Resultado do Exercício)',
            descricao:
              'Apurar receita bruta, deduções, custos, despesas operacionais e resultado líquido.',
            entrada: 'Contas de resultado do período',
            acao: 'Montar demonstrativo segundo as normas NBC TG e apurar lucro ou prejuízo.',
            criterio_sucesso: 'DRE conciliada perfeitamente com o grupo de resultado do balanço.',
            criterio_erro: 'Contas de resultado não zeradas na apuração.',
            proxima_etapa_nome: 'Revisão técnica contábil',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 13,
            titulo: 'Revisar balancete e demonstrativos',
            descricao: 'Revisão das contas patrimoniais, conciliações e notas explicativas.',
            entrada: 'Balancete e DRE gerados',
            acao: 'Checar consistência geral do período antes da assinatura técnica.',
            criterio_sucesso: 'Todos os indicadores patrimoniais e fiscais consistentes.',
            criterio_erro: 'Divergência técnica apontada pelo contador.',
            proxima_etapa_nome: 'Aprovar fechamento contábil',
            requer_aprovacao: true,
            responsavel_tipo: 'Humano',
          },
          {
            ordem: 14,
            titulo: 'Aprovar fechamento e assinar tecnicamente',
            descricao: 'Chancela final do Contador Responsável habilitado com CRC ativo.',
            entrada: 'Revisão concluída com parecer favorável',
            acao: 'Aprovar formalmente o fechamento da competência.',
            criterio_sucesso: 'Assinatura registrada no audit_log com CRC do responsável.',
            criterio_erro: 'Rejeição fundamentada pelo contador.',
            proxima_etapa_nome: 'Encerrar competência e ativar trava',
            requer_aprovacao: true,
            responsavel_tipo: 'Humano',
          },
          {
            ordem: 15,
            titulo: 'Encerrar competência e ativar trava retroativa',
            descricao: 'Bloquear lançamentos ou alterações retroativas na competência encerrada.',
            entrada: 'Aprovação formal do contador',
            acao: 'Marcar status "fechado" em fechamento_competencia impedindo edições.',
            criterio_sucesso: 'Trava ativada no banco de dados contra alterações acidentais.',
            criterio_erro: 'Falha ao registrar trava de segurança.',
            proxima_etapa_nome: 'Enviar demonstrativos ao cliente',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 16,
            titulo: 'Enviar demonstrativos ao cliente e disponibilizar no Portal',
            descricao: 'Disponibilizar Balancete e DRE assinados no Portal do Cliente e notificar.',
            entrada: 'Documentos assinados da competência fechada',
            acao: 'Publicar no GED do cliente e disparar aviso de disponibilidade.',
            criterio_sucesso: 'Demonstrativos visíveis no Portal do Cliente e protocolo gravado.',
            criterio_erro: 'Falha no upload ou na publicação no portal.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
        ],
      },
      {
        codigo: 'POP-05',
        nome: 'Conciliação Bancária e Cartões',
        area: 'contabil',
        versao: '2026.3',
        objetivo: 'Conciliar 100% dos extratos bancários e faturas de cartão com pendências zero.',
        gatilho: 'Importação de extrato bancário ou job diário.',
        pre_condicoes: 'Contas bancárias cadastradas na Rumo e extrato disponível.',
        entradas: 'Extratos OFX, CSV ou via Integração Bancária.',
        sistemas_utilizados: 'Plataforma Rumo, Conciliação Inteligente, Financeiro.',
        responsavel_cargo: 'Assistente / Analista Contábil',
        agente_nome: 'ELISA',
        nivel_autonomia: 'nivel_1_automatico',
        requer_aprovacao: false,
        saida: 'Extratos conciliados, partidas contábeis geradas e pendências justificadas.',
        proximo_processo: 'POP-04 (Fechamento Contábil)',
        etapas: [
          {
            ordem: 1,
            titulo: 'Identificar conta bancária e período',
            descricao: 'Localizar conta contábil vinculada e delimitar competência.',
            entrada: 'Parâmetros da conta e competência',
            acao: 'Selecionar conta ativa e checar saldo anterior transportado.',
            criterio_sucesso: 'Conta bancária localizada e saldo inicial verificado.',
            criterio_erro: 'Conta bancária inexistente ou desativada.',
            proxima_etapa_nome: 'Importar movimentações',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 2,
            titulo: 'Processar movimentações e calcular saldos',
            descricao:
              'Ler todas as linhas de crédito e débito calculando o saldo final projetado.',
            entrada: 'Linhas do extrato',
            acao: 'Somar créditos e débitos ao saldo inicial para obter o saldo final bancário.',
            criterio_sucesso: 'Saldo final calculado idêntico ao saldo final do extrato bancário.',
            criterio_erro: 'Soma aritmética não confere com o extrato.',
            proxima_etapa_nome: 'Vincular títulos e gerar partidas',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 3,
            titulo: 'Vincular títulos e gerar partidas contábeis',
            descricao: 'Aplicar regras de De-Para e regras por descrição de extrato.',
            entrada: 'Títulos em aberto do financeiro',
            acao: 'Conciliar automaticamente itens com mesmo valor e data próxima (tolerância 3d).',
            criterio_sucesso: 'Itens conciliados com precisão matemática.',
            criterio_erro: 'Lançamento bancário sem classificação identificada.',
            proxima_etapa_nome: 'Verificar critério de conclusão objetiva',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 4,
            titulo: 'Verificar critério de conclusão objetiva',
            descricao: 'Confirmar SALDO BANCÁRIO = SALDO CONTÁBIL e PENDÊNCIAS = 0.',
            entrada: 'Resultado da conciliação',
            acao: 'Checar se saldo bancário é igual ao contábil e pendências estão zeradas.',
            criterio_sucesso:
              'SALDO BANCÁRIO = SALDO CONTÁBIL e PENDÊNCIAS = 0 (ou todas justificadas).',
            criterio_erro: 'Divergência não justificada entre saldo bancário e contábil.',
            proxima_etapa_nome: 'Conclusão da Conciliação',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
        ],
      },
      {
        codigo: 'POP-09',
        nome: 'Apuração Fiscal e Geração de Guias (Simples / Lucro Presumido)',
        area: 'fiscal',
        versao: '2026.3',
        objetivo: 'Apurar tributos, gerar guias oficiais e preparar para conferência contábil.',
        gatilho: 'Dia 10 de cada mês (ou recebimento de todas as notas fiscais da competência).',
        pre_condicoes: 'Notas fiscais de entrada e saída importadas no GED/Fiscal.',
        entradas: 'XMLs NF-e, NFS-e, reduções Z, receitas de serviços e comércio.',
        sistemas_utilizados: 'Plataforma Rumo, Motor Fiscal, PGDAS-D, DCTFWeb, e-CAC.',
        responsavel_cargo: 'Analista Fiscal',
        agente_nome: 'ELISA',
        nivel_autonomia: 'nivel_2_supervisionado',
        requer_aprovacao: true,
        saida: 'Memória de cálculo, DAS/DARF com código de barras e PIX EMV gerado.',
        proximo_processo: 'POP-10 (Envio de Guias ao Cliente)',
        etapas: [
          {
            ordem: 1,
            titulo: 'Calcular apuração tributária',
            descricao: 'Segregar receitas por anexo e aplicar alíquotas efetivas.',
            entrada: 'XMLs fiscais da competência',
            acao: 'Calcular base de cálculo, deduções legais e tributos devidos.',
            criterio_sucesso:
              'Memória de cálculo com alíquota efetiva dentro das faixas da LC 123.',
            criterio_erro: 'Falta de documentos fiscais ou divergência de notas.',
            proxima_etapa_nome: 'Conferência técnica contábil',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 2,
            titulo: 'Conferência técnica pelo Contador',
            descricao: 'Revisar segregação de receitas, fator R e retenções na fonte.',
            entrada: 'Memória de cálculo gerada pela ELISA',
            acao: 'Validar se retenções foram devidamente abatidas do imposto devido.',
            criterio_sucesso: 'Conferência técnica sem ressalvas.',
            criterio_erro: 'Inconsistência apontada pelo contador.',
            proxima_etapa_nome: 'Aprovação para geração definitiva da guia',
            requer_aprovacao: true,
            responsavel_tipo: 'Humano',
          },
          {
            ordem: 3,
            titulo: 'Aprovação e Geração da Guia Oficial',
            descricao: 'Emitir guia oficial com código de barras e PIX Copia e Cola.',
            entrada: 'Aprovação humana registrada',
            acao: 'Gerar registro em guias_pagamentos com código de barras e vencimento.',
            criterio_sucesso: 'Guia gerada com linha digitável válida e protocolo no sistema.',
            criterio_erro: 'Falha na geração da guia ou código de barras inválido.',
            proxima_etapa_nome: 'Disponibilizar e registrar para envio',
            requer_aprovacao: true,
            responsavel_tipo: 'Humano',
          },
          {
            ordem: 4,
            titulo: 'Registrar guia para envio (Nunca considerar enviada apenas por gerar)',
            descricao:
              'Separar claramente Geração de Envio conforme princípio fundamental da Rumo.',
            entrada: 'Guia gerada no sistema',
            acao: 'Mover guia para o status "aguardando_envio" no módulo de pagamentos.',
            criterio_sucesso: 'Guia registrada no sistema como gerada e pronta para disparo ativo.',
            criterio_erro: 'Tentativa de marcar enviada sem disparo comprovado.',
            proxima_etapa_nome: 'POP-10 (Disparo WhatsApp / Portal)',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
        ],
      },
      {
        codigo: 'POP-15',
        nome: 'Pedidos de Documentos com Baixa Automática no GED',
        area: 'geral',
        versao: '2026.3',
        objetivo:
          'Solicitar documentos faltantes com link público seguro, WhatsApp ativo e guarda no GED.',
        gatilho: 'Identificação de documento faltante durante conferência ou rotina periódica.',
        pre_condicoes: 'Empresa cadastrada e contato de WhatsApp disponível.',
        entradas: 'Tipo de documento solicitado (Extrato, Fatura, Folha, Contrato).',
        sistemas_utilizados: 'Plataforma Rumo, Pedidos de Documentos, WhatsApp Evolution, GED.',
        responsavel_cargo: 'Assistente de Atendimento',
        agente_nome: 'ELISA',
        nivel_autonomia: 'nivel_1_automatico',
        requer_aprovacao: false,
        saida: 'Documento recebido, conferido e anexado diretamente ao GED da empresa.',
        proximo_processo: 'Processo solicitante (ex: Fechamento Contábil)',
        etapas: [
          {
            ordem: 1,
            titulo: 'Criar pedido de documento com token seguro',
            descricao: 'Gerar solicitação para o cliente com prazo e token único.',
            entrada: 'Tipo de documento e competência',
            acao: 'Criar registro em pedidos_documentos gerando link público.',
            criterio_sucesso: 'Link público exclusivo gerado com proteção por token.',
            criterio_erro: 'Falta de tipo de documento ou empresa.',
            proxima_etapa_nome: 'Disparar notificação por WhatsApp',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 2,
            titulo: 'Disparar notificação por WhatsApp',
            descricao: 'Enviar mensagem amigável com link para upload direto do celular.',
            entrada: 'Link público do pedido',
            acao: 'Enfileirar disparo na fila do WhatsApp com modelo oficial do escritório.',
            criterio_sucesso: 'Mensagem enfileirada ou enviada ao contato cadastrado.',
            criterio_erro: 'Número de WhatsApp inválido ou sem autorização.',
            proxima_etapa_nome: 'Receber e classificar documento',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 3,
            titulo: 'Receber e classificar documento enviado pelo cliente',
            descricao: 'Validar tamanho (até 25MB), formato PDF/OFX/CSV e ausência de vírus.',
            entrada: 'Upload realizado via link público',
            acao: 'Armazenar arquivo no GED vinculado à empresa, competência e categoria.',
            criterio_sucesso: 'Arquivo validado e salvo com hash de integridade no GED.',
            criterio_erro: 'Arquivo corrompido ou formato ilegível.',
            proxima_etapa_nome: 'Dar baixa no pedido e destravar processo',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
          {
            ordem: 4,
            titulo: 'Dar baixa no pedido e notificar processo solicitante',
            descricao: 'Concluir pedido e reativar a etapa operacional que aguardava o documento.',
            entrada: 'Arquivo no GED',
            acao: 'Atualizar pedido para "entregue" e avançar checklist do processo dependente.',
            criterio_sucesso: 'Pedido concluído e processo destravado na Fila da ELISA.',
            criterio_erro: 'Falha na atualização do status.',
            proxima_etapa_nome: 'Concluído',
            requer_aprovacao: false,
            responsavel_tipo: 'ELISA',
          },
        ],
      },
    ]

    // Criar os SOPs e instanciar um Processo de Demonstração para cada Tenant
    for (let t = 0; t < tenantRecords.length; t++) {
      const tenant = tenantRecords[t]
      const tenantId = tenant.id

      // Buscar primeira empresa do tenant
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

      for (let s = 0; s < sopsCatalogo.length; s++) {
        const cat = sopsCatalogo[s]

        // Verificar se já existe SOP com esse código para este tenant
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
          sopRec.set('requer_aprovacao', cat.requer_aprovacao)
          sopRec.set('saida', cat.saida)
          sopRec.set('proximo_processo', cat.proximo_processo)
          sopRec.set('ativo', true)
          app.save(sopRec)
        }

        // Se houver empresa e for o POP-04 (Fechamento Contábil), instanciar o processo de exemplo completo do usuário!
        if (emp && cat.codigo === 'POP-04') {
          const comp = '09/2026'
          let procExistente = null
          try {
            procExistente = app.findFirstRecordByFilter(
              'processos_operacionais',
              `tenant_id = '${tenantId}' && empresa_id = '${emp.id}' && codigo_sop = 'POP-04' && competencia = '${comp}'`,
            )
          } catch (_) {}

          if (!procExistente) {
            const procRec = new Record(processos)
            procRec.set('tenant_id', tenantId)
            procRec.set('empresa_id', emp.id)
            procRec.set('sop_id', sopRec.id)
            procRec.set('codigo_sop', 'POP-04')
            procRec.set('titulo', 'Fechamento Contábil — 09/2026')
            procRec.set('area', 'contabil')
            procRec.set('competencia', comp)
            procRec.set('status', 'EM_EXECUCAO')
            procRec.set('prioridade', 'urgente')
            procRec.set('nivel_autonomia', 'nivel_3_aprovacao_obrigatoria')
            procRec.set('etapa_atual_numero', 4)
            procRec.set('etapa_atual_nome', '4. Conciliar contas bancárias')
            procRec.set('total_etapas', 16)
            procRec.set('progresso_percentual', 25)
            procRec.set('agente_responsavel', 'ELISA')
            procRec.set('prazo', '2026-10-15T23:59:59Z')
            procRec.set(
              'proxima_acao',
              'Conciliar extrato bancário com contas a pagar/receber e validar se saldo bancário = saldo contábil.',
            )
            procRec.set(
              'criterio_sucesso_atual',
              'SALDO BANCÁRIO = SALDO CONTÁBIL e PENDÊNCIAS = 0.',
            )
            procRec.set(
              'ultima_acao_executada',
              'Importação de extratos bancários da competência 09/2026 realizada com sucesso.',
            )
            procRec.set(
              'resultado_ultima_acao',
              '148 lançamentos bancários importados sem divergência de datas.',
            )
            app.save(procRec)

            // Criar as 16 etapas
            let etapaAtualCriada = null
            for (let i = 0; i < cat.etapas.length; i++) {
              const et = cat.etapas[i]
              const epRec = new Record(etapas)
              epRec.set('tenant_id', tenantId)
              epRec.set('processo_id', procRec.id)
              epRec.set('ordem', et.ordem)
              epRec.set('titulo', `${et.ordem}. ${et.titulo}`)
              epRec.set('descricao', et.descricao)

              // As primeiras 3 estão concluídas, a 4 em execução, as demais aguardando
              if (et.ordem < 4) {
                epRec.set('status', 'CONCLUIDO')
                epRec.set(
                  'resultado',
                  `Etapa validada com sucesso pela ELISA em 02/10/2026. Critério atendido com êxito.`,
                )
              } else if (et.ordem === 4) {
                epRec.set('status', 'EM_EXECUCAO')
                epRec.set(
                  'resultado',
                  'ELISA aguardando comando operacional ou executando conciliação inteligente.',
                )
                etapaAtualCriada = epRec
              } else {
                epRec.set('status', 'AGUARDANDO')
              }

              epRec.set('responsavel_tipo', et.responsavel_tipo || 'ELISA')
              epRec.set('entrada', et.entrada)
              epRec.set('acao', et.acao)
              epRec.set('criterio_sucesso', et.criterio_sucesso)
              epRec.set('criterio_erro', et.criterio_erro)
              epRec.set('proxima_etapa_nome', et.proxima_etapa_nome)
              epRec.set('requer_aprovacao', et.requer_aprovacao)
              app.save(epRec)
            }

            // Criar o Job correspondente na Fila da ELISA
            const jobRec = new Record(jobs)
            jobRec.set('tenant_id', tenantId)
            jobRec.set('processo_id', procRec.id)
            if (etapaAtualCriada) jobRec.set('etapa_id', etapaAtualCriada.id)
            jobRec.set('empresa_id', emp.id)
            jobRec.set('job_codigo', `JOB-092026-FCT-04`)
            jobRec.set('competencia', comp)
            jobRec.set('area', 'contabil')
            jobRec.set('processo_nome', 'Fechamento Contábil — 09/2026')
            jobRec.set('pop_relacionado', 'POP-04')
            jobRec.set('etapa_atual_nome', '4. Conciliar contas bancárias')
            jobRec.set(
              'proxima_acao',
              'Executar conciliação de lançamentos bancários e verificar critério SALDO BANCÁRIO = SALDO CONTÁBIL.',
            )
            jobRec.set('prioridade', 'urgente')
            jobRec.set('prazo', '2026-10-15T23:59:59Z')
            jobRec.set('status', 'ENFILEIRADO')
            jobRec.set('agente_responsavel', 'ELISA')
            jobRec.set('nivel_autonomia', 'nivel_3_aprovacao_obrigatoria')
            jobRec.set('necessita_aprovacao', false)
            jobRec.set(
              'resultado',
              'Pronto para execução automática pela ELISA via botão [ EXECUTAR PRÓXIMA AÇÃO ].',
            )
            app.save(jobRec)
          }
        }
      }
    }
  },
  (app) => {
    // Reversão limpa
  },
)

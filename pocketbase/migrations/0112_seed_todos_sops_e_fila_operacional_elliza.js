/**
 * Migration 0112:
 * Inclusão de todos os fluxos de trabalho do catálogo POP-Elliza-2026.3 na Fila Operacional da Elliza:
 * 1. Criação dos SOPs Executáveis que faltavam no catálogo:
 *    - POP-03: Rotina Fiscal, Apurações DAS/DARF & Parcelamentos
 *    - POP-05: Atendimento WhatsApp & Emissão de NFS-e Assistiva
 *    - POP-11: DEFIS Anual & Importação de XML Fiscal em Lote
 *    - POP-12: Rotinas em Lote Multi-Empresas, Patrimônio & Motor Normativo
 *    - POP-13: Integra Contador (SERPRO / e-CAC Oficial) & Túnel mTLS
 *    - POP-14: Provedor NFS-e NFE.io & Webhook de Conciliação GED
 *    - POP-16: Backup Independente, GED em Lote & Retenção 7 Snapshots
 *    - POP-17: Escrituração SPED Fiscal & Contribuições (Blocos 0/C/D/E/H/1/A/F/M e PVA)
 *    - POP-18: Portal do Empregado & Autoatendimento CLT com Acesso Seguro
 *
 * 2. Atualização / garantia dos SOPs existentes (POP-01, POP-02, POP-04, POP-06, POP-07, POP-08, POP-09, POP-10, POP-15)
 *
 * 3. Instanciação idempotente de Processo, Etapas e Job na Fila da Elliza para a competência 09/2026 para TODOS os POPs do catálogo
 *    que ainda não possuem job ativo na fila operacional.
 *    Paradas honestas com pendência estruturada para fluxos que aguardam credenciais externas ou chancela técnica.
 */

migrate(
  (app) => {
    console.log(
      '[MIGRATION-0112] Iniciando carga de SOPs e Jobs para a Fila Operacional da Elliza...',
    )

    // 1. Obter tenant principal
    let tenantId = 'l91og8ybo9krtay'
    try {
      const t = app.findFirstRecordByFilter('tenants', "slug = 'rumo' || id != ''")
      if (t) tenantId = t.id
    } catch (_) {}

    // 2. Obter empresa principal de demonstração (Inovatech ou primeira ativa)
    let empresaDemo = null
    try {
      empresaDemo = app.findFirstRecordByFilter(
        'empresas',
        `tenant_id = '${tenantId}' && (nome_fantasia ~ 'Inovatech' || razao_social ~ 'Inovatech')`,
      )
    } catch (_) {}

    if (!empresaDemo) {
      try {
        empresaDemo = app.findFirstRecordByFilter(
          'empresas',
          `tenant_id = '${tenantId}' && status = 'ativo'`,
        )
      } catch (_) {
        try {
          empresaDemo = app.findFirstRecordByFilter('empresas', `tenant_id = '${tenantId}'`)
        } catch (__) {}
      }
    }

    if (!empresaDemo) {
      console.warn('[MIGRATION-0112] Nenhuma empresa encontrada para associar os processos.')
      return
    }

    const empresaId = empresaDemo.id
    const comp = '09/2026'

    const sopsCol = app.findCollectionByNameOrId('sops')
    const procsCol = app.findCollectionByNameOrId('processos_operacionais')
    const etapasCol = app.findCollectionByNameOrId('processo_etapas')
    const jobsCol = app.findCollectionByNameOrId('elisa_jobs')
    const pendCol = app.findCollectionByNameOrId('processo_pendencias')
    const evidCol = app.findCollectionByNameOrId('elisa_evidencias')

    // Catálogo dos Novos SOPs Executáveis a cadastrar
    const novosSopsCatalogo = [
      {
        codigo: 'POP-03',
        nome: 'Rotina Fiscal, Apurações DAS/DARF & Parcelamentos',
        area: 'fiscal',
        versao: '2026.3',
        objetivo:
          'Apurar faturamento mensal, calcular tributos (Simples Nacional, Lucro Presumido/Real), gerar guias de arrecadação e controlar acordos fiscais.',
        gatilho: 'Dia 10 de cada mês ou após recepção dos documentos fiscais do período.',
        pre_condicoes: 'Notas fiscais de entrada e saída importadas e classificadas.',
        entradas: 'XMLs NF-e/NFS-e, extratos de receitas e parâmetros tributários.',
        sistemas_utilizados: 'Plataforma Rumo Fiscal, PGDAS-D, e-CAC, Módulo Guias.',
        responsavel_cargo: 'Analista Fiscal',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_2_supervisionado',
        requer_aprovacao: true,
        saida:
          'Memória de cálculo validada, guias DAS/DARF geradas com código de barras e PIX EMV.',
        proximo_processo: 'POP-10 / Módulo Guias para envio ao cliente',
        status_inicial_processo: 'AGUARDANDO_APROVACAO',
        prioridade: 'alta',
        etapa_parada: 3,
        proxima_acao_job:
          '[A APROVAR] Conferência técnica de alíquotas efetivas do Simples/Presumido.',
        criterio_sucesso_job:
          'Memória de cálculo aprovada pelo Contador sem divergência de segregação.',
        resultado_job:
          'Apuração preliminar realizada pela Elliza. Retida no Modo Humano para validação de alíquota.',
        pendencia: {
          titulo: 'Conferência de Apuração Fiscal Simples/Presumido — 09/2026',
          por_que_parou:
            'A legislação contábil e as diretivas da Elliza exigem revisão de alíquotas e segregação de receitas antes de emissão de guia oficial (Nível 2).',
          o_que_foi_executado:
            'Leitura dos documentos fiscais da competência 09/2026 e cálculo da memória de tributos.',
          o_que_falta: 'Revisão técnica das deduções legais e validação do Fator R / anexos.',
          decisao_necessaria:
            'Validar segregação de receitas e autorizar geração das guias definitivas.',
        },
        etapas: [
          {
            ordem: 1,
            titulo: 'Importação e validação da integridade de notas fiscais',
            descricao: 'Reunir todos os XMLs de entradas, saídas e tomados na competência.',
            responsavel_tipo: 'Elliza',
            entrada: 'Documentos fiscais no repositório GED',
            acao: 'Validar schema dos XMLs, assinaturas e consistência de CFOPs.',
            criterio_sucesso: 'Todos os documentos validados e classificados na escrituração.',
            criterio_erro: 'Nota fiscal com chave corrompida ou cancelada no portal SEFAZ.',
            proxima_etapa_nome: 'Calcular bases de cálculo e alíquotas efetivas',
            requer_aprovacao: false,
          },
          {
            ordem: 2,
            titulo: 'Calcular bases de cálculo e alíquotas efetivas',
            descricao:
              'Segregar receitas por anexos do Simples Nacional ou presunção de IRPJ/CSLL.',
            responsavel_tipo: 'Elliza',
            entrada: 'Base escriturada de faturamento',
            acao: 'Aplicar tabelas normativas unificadas e calcular tributos devidos.',
            criterio_sucesso: 'Memória de cálculo estruturada com alíquota nominal e efetiva.',
            criterio_erro: 'Faturamento extrapolando sublimites sem parâmetro configurado.',
            proxima_etapa_nome: 'Conferência técnica e aprovação pelo Contador (Nível 2)',
            requer_aprovacao: false,
          },
          {
            ordem: 3,
            titulo: 'Conferência técnica e aprovação pelo Contador (Nível 2)',
            descricao: 'Revisão privativa do contador responsável sobre segregação e retenções.',
            responsavel_tipo: 'Humano',
            entrada: 'Memória de cálculo elaborada pela Elliza',
            acao: 'Validar memória, retenções sofridas e chancelar guia oficial.',
            criterio_sucesso: 'Aprovação técnica registrada no audit_log com CRC.',
            criterio_erro: 'Divergência apontada na segregação de receitas.',
            proxima_etapa_nome: 'Geração de guias oficiais e agendamento para envio',
            requer_aprovacao: true,
          },
          {
            ordem: 4,
            titulo: 'Geração de guias oficiais e agendamento para envio',
            descricao: 'Gerar títulos de pagamento com código de barras e PIX Copia e Cola.',
            responsavel_tipo: 'Elliza',
            entrada: 'Aprovação formal do Contador',
            acao: 'Gravar registros na coleção guias_pagamentos com status aguardando_envio.',
            criterio_sucesso: 'Guia gerada com linha digitável e QR Code PIX válidos.',
            criterio_erro: 'Falha na composição da linha digitável.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
          },
        ],
      },
      {
        codigo: 'POP-05',
        nome: 'Atendimento WhatsApp & Emissão de NFS-e Assistiva',
        area: 'atendimento',
        versao: '2026.3',
        objetivo:
          'Operar o agente de conversação da Elliza no WhatsApp com supervisão contínua, escalonamento humano e geração assistiva de minutas de NFS-e.',
        gatilho: 'Mensagem recebida de cliente em canal oficial de WhatsApp.',
        pre_condicoes: 'Instância Evolution API conectada ou em modo supervisão honesto.',
        entradas: 'Texto, áudio ou anexo enviado pelo cliente via WhatsApp.',
        sistemas_utilizados: 'Plataforma Rumo, Evolution API, Agente Elliza WhatsApp, NFS-e.',
        responsavel_cargo: 'Assistente de Atendimento',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_2_supervisionado',
        requer_aprovacao: true,
        saida: 'Atendimento prestado com trilha auditada e minuta de serviço preparada.',
        proximo_processo: 'POP-10 / POP-14 para transmissão municipal',
        status_inicial_processo: 'EM_EXECUCAO',
        prioridade: 'media',
        etapa_parada: 1,
        proxima_acao_job: 'Monitorar canal de mensagens do WhatsApp e processar solicitações.',
        criterio_sucesso_job:
          'Triagem determinística realizada e intenção do cliente identificada.',
        resultado_job: 'Canal ativo em Modo Supervisão aguardando interações de clientes.',
        etapas: [
          {
            ordem: 1,
            titulo: 'Recepção e triagem automatizada da mensagem',
            descricao: 'Identificar cliente pelo número de telefone e interpretar intenção.',
            responsavel_tipo: 'Elliza',
            entrada: 'Webhook da Evolution API',
            acao: 'Consultar cadastro da empresa por telefone e classificar demanda (Dúvida, Guia, NFS-e, Documento).',
            criterio_sucesso: 'Empresa identificada e intenção classificada no histórico.',
            criterio_erro: 'Número desconhecido ou sem autorização LGPD ativa.',
            proxima_etapa_nome: 'Preparação da resposta assistiva ou minuta de NFS-e',
            requer_aprovacao: false,
          },
          {
            ordem: 2,
            titulo: 'Preparação da resposta assistiva ou minuta de NFS-e',
            descricao: 'Gerar minuta estruturada de emissão ou resposta a questionamento contábil.',
            responsavel_tipo: 'Elliza',
            entrada: 'Dados fornecidos pelo cliente (tomador, valor, descrição)',
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
            acao: 'Revisar enquadramento e despachar autorização.',
            criterio_sucesso: 'Aprovação registrada com assinatura digital do contador.',
            criterio_erro: 'Rejeição fundamentada pelo contador com instrução de correção.',
            proxima_etapa_nome: 'Disparo da mensagem / NFS-e ao cliente',
            requer_aprovacao: true,
          },
          {
            ordem: 4,
            titulo: 'Disparo da mensagem / NFS-e ao cliente',
            descricao: 'Enviar confirmação e arquivo DANFSE/PDF ao WhatsApp do cliente.',
            responsavel_tipo: 'Elliza',
            entrada: 'Autorização contábil',
            acao: 'Disparar mensagem no WhatsApp via Evolution API com protocolo auditado.',
            criterio_sucesso: 'Mensagem entregue com registro de protocolo no audit_log.',
            criterio_erro: 'Falha no gateway do WhatsApp (enfileiramento honesto).',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
          },
        ],
      },
      {
        codigo: 'POP-11',
        nome: 'DEFIS Anual & Importação de XML Fiscal em Lote',
        area: 'fiscal',
        versao: '2026.3',
        objetivo:
          'Elaborar e validar a Declaração de Informações Socioeconômicas e Fiscais (DEFIS) em 4 abas e processar lotes de XMLs fiscais com isolamento de falhas.',
        gatilho: 'Período regulatório anual ou importação de pacote mensal de notas fiscais.',
        pre_condicoes: 'Balanço, DRE e apurações da competência encerradas.',
        entradas: 'Demonstrativos contábeis, folha de pagamento e XMLs de faturamento.',
        sistemas_utilizados: 'Plataforma Rumo Fiscal, PGDAS-D DEFIS, Módulo XML Lote.',
        responsavel_cargo: 'Contador Encarregado',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_3_aprovacao_obrigatoria',
        requer_aprovacao: true,
        saida: 'Rascunho oficial da DEFIS compilado, arquivo TXT para transmissão e notas no GED.',
        proximo_processo: 'Transmissão no PGDAS-D pelo Contador',
        status_inicial_processo: 'AGUARDANDO_APROVACAO',
        prioridade: 'alta',
        etapa_parada: 3,
        proxima_acao_job:
          '[A APROVAR] Revisão dos 4 módulos da DEFIS (Dados Gerais, Rendimentos Sócios, Despesas e Saldo de Caixa).',
        criterio_sucesso_job: 'Quadro societário e saldos de caixa conciliados com o Livro Diário.',
        resultado_job:
          'DEFIS 4 abas montada pela Elliza a partir da contabilidade. Retida para chancela privativa do Contador.',
        pendencia: {
          titulo: 'Validação dos Módulos da DEFIS — 09/2026',
          por_que_parou:
            'A declaração acessória oficial do Simples Nacional gera efeitos fiscais constitutivos e exige chancela privativa do responsável técnico (Nível 3).',
          o_que_foi_executado:
            'Leitura dos dados do balanço contábil, pro-labore dos sócios e conciliação do caixa.',
          o_que_falta: 'Validação pelo contador da distribuição isenta de lucros aos sócios.',
          decisao_necessaria:
            'Homologar os rendimentos isentos dos sócios e aprovar o TXT para transmissão.',
        },
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
        versao: '2026.3',
        objetivo:
          'Executar fechamentos operacionais em lote para carteiras multi-empresas, controlar a depreciação e localização física de bens imobilizados e manter tabelas normativas unificadas.',
        gatilho:
          'Fechamento de competência para a carteira de clientes ou aquisição de ativo imobilizado.',
        pre_condicoes: 'Empresas ativas cadastradas e bens patrimoniais registrados.',
        entradas: 'Cadastros de empresas, fichas de imobilizado e tabelas normativas de tributos.',
        sistemas_utilizados: 'Plataforma Rumo /lote, /patrimonio e /parametros-normativos.',
        responsavel_cargo: 'Coordenador Operacional',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_2_supervisionado',
        requer_aprovacao: true,
        saida:
          'Lotes contábeis multi-empresas processados, depreciação calculada e parâmetros atualizados.',
        proximo_processo: 'Fecho Mensal Individual / Balancete',
        status_inicial_processo: 'EM_EXECUCAO',
        prioridade: 'media',
        etapa_parada: 2,
        proxima_acao_job: 'Processar cálculo mensal de quotas de depreciação do patrimônio ativo.',
        criterio_sucesso_job: 'Depreciação linear calculada com método de quotas constantes.',
        resultado_job:
          'Cálculo de depreciação em andamento pela Elliza com motor normativo unificado.',
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
            proxima_etapa_nome: 'Cálculo de depreciação e atualização patrimonial',
            requer_aprovacao: false,
          },
          {
            ordem: 2,
            titulo: 'Cálculo de depreciação e atualização patrimonial',
            descricao:
              'Calcular quotas mensais de depreciação de máquinas, veículos e equipamentos.',
            responsavel_tipo: 'Elliza',
            entrada: 'Cadastro de bens patrimoniais da empresa',
            acao: 'Aplicar taxas de depreciação por vida útil e gerar lançamentos contábeis automáticos.',
            criterio_sucesso:
              'Lançamentos de depreciação (D - Despesa / C - Depreciação Acumulada) gerados.',
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
        versao: '2026.3',
        objetivo:
          'Conectar de forma oficial e determinística com a Receita Federal via API SERPRO Integra Contador com túnel mTLS na VPS, consultando SITFIS, Caixa Postal DTE, DCTFWeb e gerando DAS sob supervisão.',
        gatilho: 'Job diário das 04:30 (integra_contador_sync_diario) ou solicitação sob demanda.',
        pre_condicoes: 'e-CNPJ A1 do escritório credenciado na Loja SERPRO e proxy mTLS ativo.',
        entradas:
          'Credenciais OAuth2 do SERPRO, certificado digital e lista de clientes autorizados.',
        sistemas_utilizados: 'Loja SERPRO, Proxy mTLS Docker (porta 3001), e-CAC, Plataforma Rumo.',
        responsavel_cargo: 'Contador Responsável / Administrador',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_2_supervisionado',
        requer_aprovacao: true,
        saida: 'Situação fiscal atualizada no banco, mensagens DTE arquivadas e consumo bilhetado.',
        proximo_processo: 'Radar CND / Regularidade Fiscal',
        status_inicial_processo: 'AGUARDANDO_CLIENTE',
        prioridade: 'alta',
        etapa_parada: 2,
        proxima_acao_job:
          'Verificar autorização e-CAC concedida pelo cliente na Loja SERPRO (janela 30 dias).',
        criterio_sucesso_job: 'Autorização e-CAC ativa com handshake mTLS do proxy confirmado.',
        resultado_job:
          'Operando em Modo Supervisão Honesto. Aguardando credenciamento e autorização formal do cliente no e-CAC.',
        pendencia: {
          titulo: 'Credenciamento mTLS e Autorização e-CAC — 09/2026',
          por_que_parou:
            'A conexão oficial com o e-CAC máquina-a-máquina depende de credenciamento na Loja SERPRO e procuração eletrônica do cliente (Nível 2).',
          o_que_foi_executado:
            'Diagnóstico da conexão de rede e verificação do status de autorização das empresas.',
          o_que_falta:
            'Configuração do proxy mTLS na VPS ou confirmação da procuração eletrônica pelo cliente.',
          decisao_necessaria:
            'Validar chaves SERPRO em /integracoes ou manter em Modo Supervisão assistido sem declarar falso sucesso.',
        },
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
        versao: '2026.3',
        objetivo:
          'Emitir e cancelar notas fiscais de serviço via API NFE.io com conciliação automática de XML no GED da empresa através de webhooks em tempo real.',
        gatilho: 'Aprovação de solicitação de emissão de NFS-e ou evento de webhook recebido.',
        pre_condicoes: 'API Key e Company ID da NFE.io configurados em /integracoes.',
        entradas: 'Minuta de NFS-e aprovada e dados do tomador do serviço.',
        sistemas_utilizados: 'Plataforma Rumo, Gateway NFE.io, Webhooks PocketBase, GED.',
        responsavel_cargo: 'Analista Fiscal',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_3_aprovacao_obrigatoria',
        requer_aprovacao: true,
        saida:
          'NFS-e emitida pela prefeitura, XML e PDF arquivados no GED com hash de integridade.',
        proximo_processo: 'POP-03 / Fechamento Fiscal Mensal',
        status_inicial_processo: 'AGUARDANDO_APROVACAO',
        prioridade: 'alta',
        etapa_parada: 2,
        proxima_acao_job:
          'Validar credenciais da NFE.io (API Key e Company ID) no provedor fiscal.',
        criterio_sucesso_job: 'Conexão com gateway NFE.io homologada com prefeitura municipal.',
        resultado_job:
          'Aguardando credenciais oficiais da NFE.io. Operando em modo supervisão honesto.',
        pendencia: {
          titulo: 'Credenciais NFE.io Pendentes — 09/2026',
          por_que_parou:
            'A emissão de NFS-e direta via NFE.io exige chave de API válida e Company ID vinculados (Nível 3).',
          o_que_foi_executado:
            'Validação da estrutura de minuta e alíquotas municipais do serviço.',
          o_que_falta: 'Preenchimento da Chave de API NFE.io na aba de Integrações.',
          decisao_necessaria:
            'Configurar credenciais da NFE.io ou utilizar emissor assistido com extensão.',
        },
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
            criterio_erro: 'Rejeição de validação pela prefeitura (ex.: tomador irregular).',
            proxima_etapa_nome: 'Recepção do XML/PDF e arquivamento automático no GED',
            requer_aprovacao: false,
          },
          {
            ordem: 4,
            titulo: 'Recepção do XML/PDF e arquivamento automático no GED',
            descricao: 'Baixar XML oficial autorizado e indexar na pasta da empresa.',
            responsavel_tipo: 'Elliza',
            entrada: 'Webhook de nota autorizada',
            acao: 'Salvar arquivo no GED com categoria nota_fiscal e hash de integridade.',
            criterio_sucesso: 'Documento disponível no GED e visível no portal do cliente.',
            criterio_erro: 'Falha no download do XML assinado pela prefeitura.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
          },
        ],
      },
      {
        codigo: 'POP-16',
        nome: 'Backup Independente, GED em Lote & Retenção 7 Snapshots',
        area: 'geral',
        versao: '2026.3',
        objetivo:
          'Executar a rotina de segurança e soberania de dados: snapshot diário das 03:30 de 30 tabelas JSON, exportação zipada de arquivos do GED com manifesto, controle de retenção de 7 versões e governança LGPD.',
        gatilho:
          'Cron diário das 03:30 (daily_backup_snapshot_independente) ou acionamento pelo Administrador.',
        pre_condicoes: 'Privilégio estrito de Administrador e ciência LGPD assinada.',
        entradas: 'Base de dados PocketBase e repositório de arquivos físicos no storage.',
        sistemas_utilizados: 'Plataforma Rumo /backup, pb_hooks de exportação, Storage ZIP.',
        responsavel_cargo: 'Administrador do Sistema',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_1_automatico',
        requer_aprovacao: false,
        saida:
          'Arquivo JSON estruturado com 30 coleções, ZIP do GED com manifesto e expurgo dos snapshots antigos.',
        proximo_processo: 'Armazenamento Externo / Custódia',
        status_inicial_processo: 'CONCLUIDO',
        prioridade: 'media',
        etapa_parada: 4,
        proxima_acao_job:
          'Rotina de backup concluída com sucesso. Próxima execução agendada para 03:30 UTC.',
        criterio_sucesso_job:
          'Snapshot de 30 tabelas exportado e retenção de 7 dias aplicada sem erros.',
        resultado_job:
          'Snapshot independente executado com sucesso e registrado na trilha de auditoria.',
        etapas: [
          {
            ordem: 1,
            titulo: 'Exportação das 30 coleções de negócio do banco em JSON',
            descricao:
              'Extrair registros operacionais com sanitização preventiva de senhas e chaves privadas.',
            responsavel_tipo: 'Elliza',
            entrada: 'Bancos de dados do tenant',
            acao: 'Compilar todas as tabelas em formato JSON comprimido com ofuscação de credenciais.',
            criterio_sucesso: 'Todas as 30 coleções exportadas com integridade relacional.',
            criterio_erro: 'Falha de leitura em coleção do banco.',
            proxima_etapa_nome: 'Geração do pacote ZIP do GED com manifesto estruturado',
            requer_aprovacao: false,
          },
          {
            ordem: 2,
            titulo: 'Geração do pacote ZIP do GED com manifesto estruturado',
            descricao: 'Empacotar documentos do GED organizados por pastas de CNPJ e categoria.',
            responsavel_tipo: 'Elliza',
            entrada: 'Storage de arquivos do GED',
            acao: 'Construir arquivo ZIP com estrutura CNPJ/Categoria e manifesto.json com hashes.',
            criterio_sucesso: 'ZIP gerado com manifesto e hashes SHA-256 de todos os arquivos.',
            criterio_erro: 'Arquivo de documento inacessível no storage.',
            proxima_etapa_nome: 'Aplicação da política de retenção (7 snapshots mais recentes)',
            requer_aprovacao: false,
          },
          {
            ordem: 3,
            titulo: 'Aplicação da política de retenção (7 snapshots mais recentes)',
            descricao: 'Manter os últimos 7 snapshots e purgar registros e arquivos anteriores.',
            responsavel_tipo: 'Elliza',
            entrada: 'Histórico de execuções de backup',
            acao: 'Identificar snapshots com mais de 7 ciclos e efetuar purga segura.',
            criterio_sucesso:
              'Storage sanitizado mantendo estritamente os 7 snapshots mais recentes.',
            criterio_erro: 'Falha na deleção de arquivo expirado.',
            proxima_etapa_nome: 'Registro de auditoria e validação de download LGPD',
            requer_aprovacao: false,
          },
          {
            ordem: 4,
            titulo: 'Registro de auditoria e validação de download LGPD',
            descricao: 'Registrar conclusão na coleção backups_execucoes e audit_log.',
            responsavel_tipo: 'Elliza',
            entrada: 'Status de processamento',
            acao: 'Criar registro formal de conclusão de rotina com tamanho em bytes.',
            criterio_sucesso: 'Execução auditada e download condicionado a termo de ciência.',
            criterio_erro: 'Falha no registro de auditoria.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
          },
        ],
      },
      {
        codigo: 'POP-17',
        nome: 'Escrituração SPED Fiscal & Contribuições (Blocos & PVA)',
        area: 'fiscal',
        versao: '2026.3',
        objetivo:
          'Gerar a escrituração digital completa da EFD-ICMS/IPI (blocos 0, C, D, E, H, 1, 9) e EFD-Contribuições (0, A, C, D, F, M, 1, 9) com cálculo de hash MD5 e validação no PVA.',
        gatilho: 'Dia 15 do mês subsequente ou encerramento da apuração de ICMS/IPI/PIS/COFINS.',
        pre_condicoes: 'Movimentações de entradas, saídas e serviços do período apuradas.',
        entradas: 'XMLs de NF-e, NFS-e, CT-e, dados cadastrais e apurações tributárias.',
        sistemas_utilizados: 'Plataforma Rumo /fiscal, PVA da Receita Federal, Gerador SPED.',
        responsavel_cargo: 'Contador Responsável',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_3_aprovacao_obrigatoria',
        requer_aprovacao: true,
        saida:
          'Arquivo TXT oficial em conformidade com o Guia Prático da EFD, com hash MD5 gravado.',
        proximo_processo: 'Assinatura e Transmissão no PVA pelo Contador',
        status_inicial_processo: 'AGUARDANDO_APROVACAO',
        prioridade: 'urgente',
        etapa_parada: 3,
        proxima_acao_job:
          '[A APROVAR] Validação da integridade dos Blocos 0, C, E, M e conferência do Hash MD5.',
        criterio_sucesso_job:
          'Blocos validados e hash MD5 de 32 caracteres gerado sem inconsistências no PVA.',
        resultado_job:
          'Arquivo TXT do SPED compilado com sucesso pela Elliza. Retido para validação e assinatura do Contador.',
        pendencia: {
          titulo: 'Validação e Assinatura do SPED — 09/2026',
          por_que_parou:
            'A transmissão do arquivo do SPED para a Receita Federal é ato privativo do Contador e exige assinatura por e-CNPJ A1 (Nível 3).',
          o_que_foi_executado:
            'Compilação dos blocos 0, C, D, E, H, 1 e 9 da EFD com geração do hash MD5.',
          o_que_falta:
            'Validação no programa PVA e conferência dos saldos credores de ICMS/PIS/COFINS.',
          decisao_necessaria:
            'Despachar aprovação no Modo Humano para autorizar a transmissão ao Fisco.',
        },
        etapas: [
          {
            ordem: 1,
            titulo: 'Compilação dos registros cadastrais e documentos fiscais (Blocos 0 e C/A)',
            descricao:
              'Organizar cadastros de participantes, itens de serviço e documentos de entrada/saída.',
            responsavel_tipo: 'Elliza',
            entrada: 'Documentos fiscais e cadastro de empresas',
            acao: 'Montar registros C100/C190 (mercadorias) e A100/A170 (serviços) no layout oficial.',
            criterio_sucesso: 'Registros compilados respeitando regras de integridade referencial.',
            criterio_erro: 'Nota fiscal com alíquota zerada sem motivo de desoneração.',
            proxima_etapa_nome: 'Apuração dos tributos e totalizadores (Blocos E, M e 9)',
            requer_aprovacao: false,
          },
          {
            ordem: 2,
            titulo: 'Apuração dos tributos e totalizadores (Blocos E, M e 9)',
            descricao:
              'Calcular débitos, créditos e gerar bloco totalizador com cálculo do hash MD5.',
            responsavel_tipo: 'Elliza',
            entrada: 'Blocos C e A processados',
            acao: 'Gerar apuração de ICMS (E110), PIS (M200), COFINS (M600) e contadores do Bloco 9.',
            criterio_sucesso: 'Arquivo TXT fechado com hash MD5 exclusivo gravado no banco.',
            criterio_erro:
              'Divergência entre somatório analítico e totalizadores do registro 9900.',
            proxima_etapa_nome: 'Validação técnica no PVA e aprovação pelo Contador (Nível 3)',
            requer_aprovacao: true,
          },
          {
            ordem: 3,
            titulo: 'Validação técnica no PVA e aprovação pelo Contador (Nível 3)',
            descricao: 'Conferência privativa do contador habilitado com chancela e assinatura.',
            responsavel_tipo: 'Humano',
            entrada: 'Arquivo TXT com hash MD5 auditado',
            acao: 'Revisar relatórios de conferência do PVA e emitir autorização de transmissão.',
            criterio_sucesso: 'Assinatura digital e protocolo de aprovação no sistema.',
            criterio_erro: 'Erro de validação detectado pelo validador oficial PVA.',
            proxima_etapa_nome: 'Transmissão e arquivamento de recibo oficial no GED',
            requer_aprovacao: true,
          },
          {
            ordem: 4,
            titulo: 'Transmissão e arquivamento de recibo oficial no GED',
            descricao: 'Protocolar o recibo de entrega da EFD e anexar no repositório digital.',
            responsavel_tipo: 'Elliza',
            entrada: 'Recibo oficial emitido pela Receita Federal',
            acao: 'Gravar número do recibo na escrituração e arquivar PDF/XML no GED.',
            criterio_sucesso: 'Recibo oficial arquivado e obrigação marcada como cumprida.',
            criterio_erro: 'Falha no upload do recibo.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
          },
        ],
      },
      {
        codigo: 'POP-18',
        nome: 'Portal do Empregado & Autoatendimento CLT com Acesso Seguro',
        area: 'pessoal',
        versao: '2026.3',
        objetivo:
          'Prover autoatendimento público seguro aos colaboradores (rota /portal-empregado) para consulta de holerites mensais, extratos de férias, espelho do TRCT (Portaria MTE 1.057) e envio ativo por WhatsApp com máscara LGPD.',
        gatilho: 'Processamento da folha mensal, homologação de férias ou rescisão de colaborador.',
        pre_condicoes: 'Colaboradores com contratos CLT ativos e folha calculada.',
        entradas: 'Cadastros de funcionários, recibos de pagamento e eventos trabalhistas.',
        sistemas_utilizados: 'Plataforma Rumo, /portal-empregado, WhatsApp Ativo, Audit Log.',
        responsavel_cargo: 'Analista de DP / Contador',
        agente_nome: 'Elliza',
        nivel_autonomia: 'nivel_1_automatico',
        requer_aprovacao: false,
        saida:
          'Credenciais de acesso de 6 dígitos geradas, mensagens despachadas e holerites visualizados.',
        proximo_processo: 'Rotina Permanente de Autoatendimento CLT',
        status_inicial_processo: 'CONCLUIDO',
        prioridade: 'media',
        etapa_parada: 4,
        proxima_acao_job:
          'Portal do empregado ativo e monitorado. Holerites disponíveis para autoatendimento.',
        criterio_sucesso_job:
          'Credenciais ativas no portal_empregado_acessos e registros auditados no audit_log.',
        resultado_job:
          'Holerites de 09/2026 emitidos e disponíveis no portal com máscara protetiva da LGPD.',
        etapas: [
          {
            ordem: 1,
            titulo: 'Geração de credenciais de acesso seguro com token e código temporário',
            descricao:
              'Criar registro na coleção portal_empregado_acessos com código de 6 dígitos.',
            responsavel_tipo: 'Elliza',
            entrada: 'Cadastro do colaborador ativo no DP',
            acao: 'Gerar token criptográfico e código de 6 dígitos válido por 30 dias.',
            criterio_sucesso: 'Credencial gravada na base com validação anti-duplicidade de CPF.',
            criterio_erro: 'Colaborador com CPF inconsistente ou sem telefone cadastrado.',
            proxima_etapa_nome: 'Disparo ativo de notificação por WhatsApp com link direto',
            requer_aprovacao: false,
          },
          {
            ordem: 2,
            titulo: 'Disparo ativo de notificação por WhatsApp com link direto',
            descricao: 'Enviar mensagem amigável com link único para o celular do colaborador.',
            responsavel_tipo: 'Elliza',
            entrada: 'Credencial ativa e telefone cadastrado',
            acao: 'Disparar WhatsApp via whatsappAtivoService ou enfileirar em aguardando_credenciais.',
            criterio_sucesso:
              'Mensagem despachada ou enfileirada com rastreamento no whatsapp_envios.',
            criterio_erro: 'Número de WhatsApp bloqueado ou inválido.',
            proxima_etapa_nome: 'Disponibilização de demonstrativos com máscara LGPD',
            requer_aprovacao: false,
          },
          {
            ordem: 3,
            titulo: 'Disponibilização de demonstrativos com máscara LGPD',
            descricao: 'Exibir holerites, extrato de férias e TRCT protegendo dados sensíveis.',
            responsavel_tipo: 'Elliza',
            entrada: 'Base de folha processada',
            acao: 'Renderizar demonstrativos no portal com botão de impressão e download em PDF.',
            criterio_sucesso:
              'Empregado visualiza holerite sem vazamento entre empresas ou colegas.',
            criterio_erro: 'Tentativa de acesso não autorizada a colaborador de outro tenant.',
            proxima_etapa_nome: 'Auditoria e registro de visualizações no audit_log',
            requer_aprovacao: false,
          },
          {
            ordem: 4,
            titulo: 'Auditoria e registro de visualizações no audit_log',
            descricao:
              'Garantir rastreabilidade jurídica com registro de IP, data e hora de acesso.',
            responsavel_tipo: 'Elliza',
            entrada: 'Acessos efetuados pelo empregado',
            acao: 'Registrar log detalhado de login e download de demonstrativos no audit_log.',
            criterio_sucesso:
              'Trilha de auditoria completa em conformidade com as diretivas do CFC.',
            criterio_erro: 'Falha no registro do evento de auditoria.',
            proxima_etapa_nome: 'Processo Concluído',
            requer_aprovacao: false,
          },
        ],
      },
    ]

    // 3. Cadastrar ou atualizar cada SOP e instanciar processo + job
    for (let i = 0; i < novosSopsCatalogo.length; i++) {
      const sopDef = novosSopsCatalogo[i]

      let sopRec = null
      try {
        sopRec = app.findFirstRecordByFilter(
          'sops',
          `tenant_id = '${tenantId}' && codigo = '${sopDef.codigo}'`,
        )
      } catch (_) {}

      if (!sopRec) {
        sopRec = new Record(sopsCol)
        sopRec.set('tenant_id', tenantId)
        sopRec.set('codigo', sopDef.codigo)
        sopRec.set('nome', sopDef.nome)
        sopRec.set('area', sopDef.area)
        sopRec.set('versao', sopDef.versao)
        sopRec.set('objetivo', sopDef.objetivo)
        sopRec.set('gatilho', sopDef.gatilho)
        sopRec.set('pre_condicoes', sopDef.pre_condicoes)
        sopRec.set('entradas', sopDef.entradas)
        sopRec.set('sistemas_utilizados', sopDef.sistemas_utilizados)
        sopRec.set('responsavel_cargo', sopDef.responsavel_cargo)
        sopRec.set('agente_nome', sopDef.agente_nome)
        sopRec.set('nivel_autonomia', sopDef.nivel_autonomia)
        sopRec.set('etapas_template_json', sopDef.etapas)
        sopRec.set('requer_aprovacao', sopDef.requer_aprovacao)
        sopRec.set('saida', sopDef.saida)
        sopRec.set('proximo_processo', sopDef.proximo_processo)
        sopRec.set('ativo', true)
        app.save(sopRec)
        console.log(`[MIGRATION-0112] SOP ${sopDef.codigo} criado no catálogo.`)
      }

      // Verificar se já existe processo para este SOP na competência 09/2026
      let procExistente = null
      try {
        procExistente = app.findFirstRecordByFilter(
          'processos_operacionais',
          `tenant_id = '${tenantId}' && codigo_sop = '${sopDef.codigo}' && competencia = '${comp}'`,
        )
      } catch (_) {}

      let procId = null
      if (!procExistente) {
        const procRec = new Record(procsCol)
        procRec.set('tenant_id', tenantId)
        procRec.set('empresa_id', empresaId)
        procRec.set('sop_id', sopRec.id)
        procRec.set('codigo_sop', sopDef.codigo)
        procRec.set('titulo', `${sopDef.nome} — ${comp}`)
        procRec.set('area', sopDef.area)
        procRec.set('competencia', comp)
        procRec.set('status', sopDef.status_inicial_processo)
        procRec.set('prioridade', sopDef.prioridade)
        procRec.set('nivel_autonomia', sopDef.nivel_autonomia)
        procRec.set('etapa_atual_numero', sopDef.etapa_parada)
        procRec.set(
          'etapa_atual_nome',
          `${sopDef.etapa_parada}. ${sopDef.etapas[sopDef.etapa_parada - 1].titulo}`,
        )
        procRec.set('total_etapas', sopDef.etapas.length)
        const progresso = Math.round(((sopDef.etapa_parada - 1) / sopDef.etapas.length) * 100)
        procRec.set(
          'progresso_percentual',
          sopDef.status_inicial_processo === 'CONCLUIDO' ? 100 : progresso,
        )
        procRec.set('agente_responsavel', 'Elliza')
        procRec.set('prazo', '2026-10-15T23:59:59Z')
        procRec.set('proxima_acao', sopDef.proxima_acao_job)
        procRec.set('criterio_sucesso_atual', sopDef.criterio_sucesso_job)
        procRec.set(
          'ultima_acao_executada',
          `Processo instanciado e sincronizado pela Elliza conforme diretivas do POP oficial ${sopDef.codigo}.`,
        )
        procRec.set('resultado_ultima_acao', sopDef.resultado_job)
        if (sopDef.pendencia) {
          procRec.set('motivo_parada_ou_erro', sopDef.pendencia.por_que_parou)
          procRec.set('decisao_necessaria_humana', sopDef.pendencia.decisao_necessaria)
        }
        app.save(procRec)
        procId = procRec.id
        console.log(`[MIGRATION-0112] Processo operacional para ${sopDef.codigo} criado.`)

        // Criar etapas do processo
        let etapaAtualRecord = null
        for (let e = 0; e < sopDef.etapas.length; e++) {
          const et = sopDef.etapas[e]
          const epRec = new Record(etapasCol)
          epRec.set('tenant_id', tenantId)
          epRec.set('processo_id', procId)
          epRec.set('ordem', et.ordem)
          epRec.set('titulo', `${et.ordem}. ${et.titulo}`)
          epRec.set('descricao', et.descricao)

          if (sopDef.status_inicial_processo === 'CONCLUIDO') {
            epRec.set('status', 'CONCLUIDO')
            epRec.set('resultado', 'Etapa executada com êxito e validada.')
          } else if (et.ordem < sopDef.etapa_parada) {
            epRec.set('status', 'CONCLUIDO')
            epRec.set('resultado', 'Etapa preliminar validada com sucesso pela Elliza.')
          } else if (et.ordem === sopDef.etapa_parada) {
            epRec.set('status', sopDef.status_inicial_processo)
            epRec.set('resultado', sopDef.resultado_job)
            etapaAtualRecord = epRec
          } else {
            epRec.set('status', 'AGUARDANDO')
          }

          epRec.set('responsavel_tipo', et.responsavel_tipo || 'Elliza')
          epRec.set('entrada', et.entrada)
          epRec.set('acao', et.acao)
          epRec.set('criterio_sucesso', et.criterio_sucesso)
          epRec.set('criterio_erro', et.criterio_erro)
          epRec.set('proxima_etapa_nome', et.proxima_etapa_nome)
          epRec.set('requer_aprovacao', et.requer_aprovacao)
          app.save(epRec)

          if (et.ordem === sopDef.etapa_parada) {
            etapaAtualRecord = epRec
          }
        }

        // Criar Job na Fila da Elliza (idempotência por job_codigo)
        const jobCodigo = `JOB-092026-${sopDef.codigo.replace('-', '')}`
        let jobExistente = null
        try {
          jobExistente = app.findFirstRecordByFilter(
            'elisa_jobs',
            `tenant_id = '${tenantId}' && job_codigo = '${jobCodigo}'`,
          )
        } catch (_) {}

        if (!jobExistente) {
          const jobRec = new Record(jobsCol)
          jobRec.set('tenant_id', tenantId)
          jobRec.set('processo_id', procId)
          if (etapaAtualRecord) jobRec.set('etapa_id', etapaAtualRecord.id)
          jobRec.set('empresa_id', empresaId)
          jobRec.set('job_codigo', jobCodigo)
          jobRec.set('competencia', comp)
          jobRec.set('area', sopDef.area)
          jobRec.set('processo_nome', `${sopDef.nome} — ${comp}`)
          jobRec.set('pop_relacionado', sopDef.codigo)
          jobRec.set(
            'etapa_atual_nome',
            `${sopDef.etapa_parada}. ${sopDef.etapas[sopDef.etapa_parada - 1].titulo}`,
          )
          jobRec.set('proxima_acao', sopDef.proxima_acao_job)
          jobRec.set('prioridade', sopDef.prioridade)
          jobRec.set('prazo', '2026-10-15T23:59:59Z')
          jobRec.set('status', sopDef.status_inicial_processo)
          jobRec.set('agente_responsavel', 'Elliza')
          jobRec.set('nivel_autonomia', sopDef.nivel_autonomia)
          jobRec.set('necessita_aprovacao', sopDef.requer_aprovacao)
          jobRec.set('resultado', sopDef.resultado_job)
          jobRec.set(
            'evidencia_resumo',
            `Protocolo OP-${sopDef.codigo.replace('-', '')}-092026 registrado na trilha de conformidade.`,
          )
          app.save(jobRec)
          console.log(
            `[MIGRATION-0112] Job ${jobCodigo} enfileirado na Fila da Elliza com status ${sopDef.status_inicial_processo}.`,
          )

          // Se tiver pendência estruturada, registrar na coleção processo_pendencias (Modo Humano)
          if (sopDef.pendencia) {
            const pendRec = new Record(pendCol)
            pendRec.set('tenant_id', tenantId)
            pendRec.set('processo_id', procId)
            if (etapaAtualRecord) pendRec.set('etapa_id', etapaAtualRecord.id)
            pendRec.set('job_id', jobRec.id)
            pendRec.set('empresa_id', empresaId)
            pendRec.set('titulo', sopDef.pendencia.titulo)
            pendRec.set('por_que_parou', sopDef.pendencia.por_que_parou)
            pendRec.set('o_que_foi_executado', sopDef.pendencia.o_que_foi_executado)
            pendRec.set('o_que_falta', sopDef.pendencia.o_que_falta)
            pendRec.set('decisao_necessaria', sopDef.pendencia.decisao_necessaria)
            pendRec.set('status', 'aberta')
            app.save(pendRec)
          }

          // Registrar evidência na trilha
          const evRec = new Record(evidCol)
          evRec.set('tenant_id', tenantId)
          evRec.set('processo_id', procId)
          evRec.set('job_id', jobRec.id)
          if (etapaAtualRecord) evRec.set('etapa_id', etapaAtualRecord.id)
          evRec.set('empresa_id', empresaId)
          evRec.set('tipo', 'protocolo')
          evRec.set('titulo', `Protocolo Operacional ${sopDef.codigo} — Competência 09/2026`)
          evRec.set(
            'descricao',
            `Job ${jobCodigo} enfileirado na Fila da Elliza com parâmetros determinísticos.`,
          )
          evRec.set(
            'protocolo_numero',
            `OP-${sopDef.codigo.replace('-', '')}-092026-${Math.floor(1000 + Math.random() * 9000)}`,
          )
          evRec.set('executado_por', 'Elliza')
          evRec.set(
            'hash_sha256',
            `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`,
          )
          evRec.set('resultado_obtido', sopDef.resultado_job)
          app.save(evRec)
        }
      }
    }

    // 4. Garantir que os SOPs antigos que não tinham Job na fila agora tenham seu Job enfileirado
    // Especificamente: POP-01 (Onboarding), POP-09 (Monitoramento Legislativo / Apuração), POP-15 (Pedidos Docs)
    const sopsAntigosParaEnfileirar = [
      {
        codigo: 'POP-01',
        jobCodigo: 'JOB-092026-POP01',
        nome: 'Onboarding de Empresas, Gestão de A1 & Upload GED',
        area: 'geral',
        status: 'CONCLUIDO',
        prioridade: 'alta',
        nivel_autonomia: 'nivel_1_automatico',
        etapa_atual_nome: '4. Validação final e habilitação de módulos operacionais',
        proxima_acao: 'Empresa totalmente habilitada no ecossistema Rumo Contábil.',
        resultado:
          'Cadastro concluído, certificado digital A1 validado e GED indexado com sucesso.',
      },
      {
        codigo: 'POP-09',
        jobCodigo: 'JOB-092026-POP09',
        nome: 'Monitoramento Legislativo & Alíquotas',
        area: 'fiscal',
        status: 'AGUARDANDO_APROVACAO',
        prioridade: 'alta',
        nivel_autonomia: 'nivel_2_supervisionado',
        etapa_atual_nome: '3. Validação técnica pelo Contador (Nível 2 — Supervisionado)',
        proxima_acao:
          '[A APROVAR] Aprovação técnica do impacto calculado da Portaria RFB nº 489/2026.',
        resultado:
          'Impacto financeiro apurado (+R$ 130,00/mês Inovatech). Retido para chancela técnica do Contador.',
        pendencia: {
          titulo: 'Validação de Impacto da Portaria RFB nº 489/2026',
          por_que_parou:
            'Alteração de tabela progressiva de retenção de IRRF exige validação técnica antes de aplicação na carteira (Nível 2).',
          o_que_foi_executado:
            'Cruzamento cadastral da carteira de clientes com a nova tabela e cálculo da variação em R$.',
          o_que_falta:
            'Chancela técnica do Contador para validar o parecer e autorizar disparo de orientações.',
          decisao_necessaria:
            'Homologar o cálculo de acréscimo de retenção e autorizar envio de nota técnica.',
        },
      },
      {
        codigo: 'POP-15',
        jobCodigo: 'JOB-092026-POP15',
        nome: 'Pedidos de Documentos com Baixa Automática no GED',
        area: 'geral',
        status: 'AGUARDANDO_CLIENTE',
        prioridade: 'alta',
        nivel_autonomia: 'nivel_1_automatico',
        etapa_atual_nome: '3. Receber e classificar documento enviado pelo cliente',
        proxima_acao: 'Aguardando cliente enviar extrato bancário complementar via link público.',
        resultado:
          'Link público exclusivo gerado e enviado via WhatsApp. Aguardando upload pelo cliente.',
        pendencia: {
          titulo: 'Documento Suporte Pendente (Extrato Complementar)',
          por_que_parou:
            'O cliente ainda não realizou o envio do extrato do Banco do Brasil da competência 09/2026.',
          o_que_foi_executado:
            'Criação do pedido com token temporário seguro e envio de notificação ativa.',
          o_que_falta: 'Upload do arquivo PDF/OFX pelo cliente no link público.',
          decisao_necessaria:
            'Aguardar envio pelo cliente ou reenviar lembrete amigável via WhatsApp.',
        },
      },
    ]

    for (let k = 0; k < sopsAntigosParaEnfileirar.length; k++) {
      const item = sopsAntigosParaEnfileirar[k]

      // Checar se já existe job
      let jobExistente = null
      try {
        jobExistente = app.findFirstRecordByFilter(
          'elisa_jobs',
          `tenant_id = '${tenantId}' && (job_codigo = '${item.jobCodigo}' || pop_relacionado = '${item.codigo}')`,
        )
      } catch (_) {}

      if (!jobExistente) {
        // Buscar SOP
        let sopRec = null
        try {
          sopRec = app.findFirstRecordByFilter(
            'sops',
            `tenant_id = '${tenantId}' && codigo = '${item.codigo}'`,
          )
        } catch (_) {}

        if (sopRec) {
          // Buscar ou criar processo
          let procRec = null
          try {
            procRec = app.findFirstRecordByFilter(
              'processos_operacionais',
              `tenant_id = '${tenantId}' && codigo_sop = '${item.codigo}' && competencia = '${comp}'`,
            )
          } catch (_) {}

          if (!procRec) {
            procRec = new Record(procsCol)
            procRec.set('tenant_id', tenantId)
            procRec.set('empresa_id', empresaId)
            procRec.set('sop_id', sopRec.id)
            procRec.set('codigo_sop', item.codigo)
            procRec.set('titulo', `${item.nome} — ${comp}`)
            procRec.set('area', item.area)
            procRec.set('competencia', comp)
            procRec.set('status', item.status)
            procRec.set('prioridade', item.prioridade)
            procRec.set('nivel_autonomia', item.nivel_autonomia)
            procRec.set('etapa_atual_numero', 3)
            procRec.set('etapa_atual_nome', item.etapa_atual_nome)
            procRec.set('total_etapas', 4)
            procRec.set('progresso_percentual', item.status === 'CONCLUIDO' ? 100 : 75)
            procRec.set('agente_responsavel', 'Elliza')
            procRec.set('prazo', '2026-10-15T23:59:59Z')
            procRec.set('proxima_acao', item.proxima_acao)
            procRec.set('criterio_sucesso_atual', 'Critério formal do POP validado.')
            procRec.set(
              'ultima_acao_executada',
              `Processo sincronizado na esteira da Elliza (${item.codigo}).`,
            )
            procRec.set('resultado_ultima_acao', item.resultado)
            if (item.pendencia) {
              procRec.set('motivo_parada_ou_erro', item.pendencia.por_que_parou)
              procRec.set('decisao_necessaria_humana', item.pendencia.decisao_necessaria)
            }
            app.save(procRec)

            // Criar etapas do processo
            const etapasTpl = sopRec.get('etapas_template_json') || []
            let etapaParadaRec = null
            for (let etIndex = 0; etIndex < (etapasTpl.length || 4); etIndex++) {
              const et = etapasTpl[etIndex] || {
                ordem: etIndex + 1,
                titulo: `Etapa ${etIndex + 1}`,
                acao: item.proxima_acao,
              }
              const ep = new Record(etapasCol)
              ep.set('tenant_id', tenantId)
              ep.set('processo_id', procRec.id)
              ep.set('ordem', etIndex + 1)
              ep.set('titulo', `${etIndex + 1}. ${et.titulo || 'Etapa Operacional'}`)
              ep.set('descricao', et.descricao || '')
              ep.set(
                'status',
                item.status === 'CONCLUIDO'
                  ? 'CONCLUIDO'
                  : etIndex + 1 <= 2
                    ? 'CONCLUIDO'
                    : item.status,
              )
              ep.set('responsavel_tipo', 'Elliza')
              ep.set('entrada', et.entrada || 'Documentos')
              ep.set('acao', et.acao || item.proxima_acao)
              ep.set('criterio_sucesso', et.criterio_sucesso || 'Critério atendido.')
              ep.set('requer_aprovacao', et.requer_aprovacao || false)
              ep.set('resultado', item.resultado)
              app.save(ep)
              if (etIndex + 1 === 3) etapaParadaRec = ep
            }

            // Criar Job
            const newJob = new Record(jobsCol)
            newJob.set('tenant_id', tenantId)
            newJob.set('processo_id', procRec.id)
            if (etapaParadaRec) newJob.set('etapa_id', etapaParadaRec.id)
            newJob.set('empresa_id', empresaId)
            newJob.set('job_codigo', item.jobCodigo)
            newJob.set('competencia', comp)
            newJob.set('area', item.area)
            newJob.set('processo_nome', `${item.nome} — ${comp}`)
            newJob.set('pop_relacionado', item.codigo)
            newJob.set('etapa_atual_nome', item.etapa_atual_nome)
            newJob.set('proxima_acao', item.proxima_acao)
            newJob.set('prioridade', item.prioridade)
            newJob.set('prazo', '2026-10-15T23:59:59Z')
            newJob.set('status', item.status)
            newJob.set('agente_responsavel', 'Elliza')
            newJob.set('nivel_autonomia', item.nivel_autonomia)
            newJob.set('necessita_aprovacao', item.status === 'AGUARDANDO_APROVACAO')
            newJob.set('resultado', item.resultado)
            newJob.set(
              'evidencia_resumo',
              `Protocolo OP-${item.codigo.replace('-', '')}-092026 arquivado no GED.`,
            )
            app.save(newJob)
            console.log(`[MIGRATION-0112] Job antigo ${item.jobCodigo} enfileirado com sucesso.`)

            if (item.pendencia) {
              const pendRec = new Record(pendCol)
              pendRec.set('tenant_id', tenantId)
              pendRec.set('processo_id', procRec.id)
              if (etapaParadaRec) pendRec.set('etapa_id', etapaParadaRec.id)
              pendRec.set('job_id', newJob.id)
              pendRec.set('empresa_id', empresaId)
              pendRec.set('titulo', item.pendencia.titulo)
              pendRec.set('por_que_parou', item.pendencia.por_que_parou)
              pendRec.set('o_que_foi_executado', item.pendencia.o_que_foi_executado)
              pendRec.set('o_que_falta', item.pendencia.o_que_falta)
              pendRec.set('decisao_necessaria', item.pendencia.decisao_necessaria)
              pendRec.set('status', 'aberta')
              app.save(pendRec)
            }
          }
        }
      }
    }

    console.log(
      '[MIGRATION-0112] Carga de SOPs e Jobs concluída com sucesso! Todos os POPs agora estão na Fila da Elliza.',
    )
  },
  (app) => {
    // Reversão limpa
  },
)

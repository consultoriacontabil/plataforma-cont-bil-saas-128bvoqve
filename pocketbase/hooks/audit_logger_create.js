// Hook: audit_logger_create.js
// Fires on create success for key business collections and logs to audit_log
onRecordAfterCreateSuccess(
  (e) => {
    try {
      const record = e.record
      const collectionName = record.collection().name
      const tenantId = record.getString('tenant_id')
      if (!tenantId) {
        e.next()
        return
      }

      const auditCol = $app.findCollectionByNameOrId('audit_log')
      const log = new Record(auditCol)
      log.set('tenant_id', tenantId)
      log.set('entidade_tipo', collectionName)
      log.set('entidade_id', record.id)

      let userId = ''
      try {
        userId = record.getString('usuario_upload_id')
      } catch (_) {}
      if (!userId) {
        try {
          userId = record.getString('criado_por_id')
        } catch (_) {}
      }
      if (!userId) {
        try {
          userId = record.getString('criado_por')
        } catch (_) {}
      }
      if (!userId) {
        try {
          userId = record.getString('user_id')
        } catch (_) {}
      }
      if (userId) {
        log.set('usuario_id', userId)
      }

      let acao = 'Criação'
      let detalhes = 'Novo registro criado'

      if (collectionName === 'empresas') {
        acao = 'Cadastro de empresa'
        detalhes =
          'Cadastrou a empresa ' +
          (record.getString('nome_fantasia') || record.getString('razao_social')) +
          ' (CNPJ: ' +
          record.getString('cnpj') +
          ')'
      } else if (collectionName === 'documentos') {
        acao = 'Upload de documento'
        detalhes =
          'Armazenou o arquivo ' +
          record.getString('nome_arquivo') +
          ' (tipo: ' +
          record.getString('tipo') +
          ')'
      } else if (collectionName === 'workflows') {
        acao = 'Abertura de workflow'
        detalhes =
          'Criou o workflow "' +
          record.getString('titulo') +
          '" (prioridade: ' +
          record.getString('prioridade') +
          ')'
      } else if (collectionName === 'fiscal') {
        acao = 'Nova obrigação fiscal'
        detalhes =
          'Cadastrou obrigação ' +
          record.getString('tipo_obrigacao').toUpperCase() +
          ' período ' +
          record.getString('periodo_apuracao')
      } else if (collectionName === 'tenant_members') {
        acao = 'Membro vinculado'
        detalhes = 'Novo membro associado com perfil ' + record.getString('perfil')
      } else if (collectionName === 'obrigacoes') {
        acao = 'Nova obrigação fiscal'
        detalhes =
          'Cadastrou obrigação ' +
          record.getString('tipo') +
          ' (competência ' +
          record.getString('competencia') +
          ')'
      } else if (collectionName === 'lancamentos_contabeis') {
        acao = 'Lançamento contábil criado'
        detalhes =
          'Registrou lançamento de R$ ' +
          record.getFloat('valor').toFixed(2) +
          ' (' +
          record.getString('tipo').toUpperCase() +
          ') na competência ' +
          record.getString('competencia')
      } else if (collectionName === 'plano_contas') {
        acao = 'Conta contábil criada'
        detalhes =
          'Cadastrou conta ' +
          record.getString('codigo') +
          ' - ' +
          record.getString('nome') +
          ' (' +
          record.getString('tipo') +
          ')'
      } else if (collectionName === 'funcionarios') {
        acao = 'Admissão / Funcionário cadastrado'
        detalhes =
          'Cadastrou colaborador ' +
          record.getString('nome_completo') +
          ' (Cargo: ' +
          record.getString('cargo') +
          ')'
      } else if (collectionName === 'folha_pagamento') {
        acao = 'Folha de pagamento gerada'
        detalhes =
          'Gerou folha competência ' +
          record.getString('competencia') +
          ' no valor líquido de R$ ' +
          record.getFloat('total_liquido').toFixed(2)
      } else if (collectionName === 'eventos_dp') {
        acao = 'Evento de DP registrado'
        detalhes = 'Evento ' + record.getString('tipo') + ': ' + record.getString('descricao')
      } else if (collectionName === 'portal_acessos') {
        acao = 'Acesso ao portal criado'
        detalhes =
          'Criou acesso para ' +
          record.getString('nome_contato') +
          ' (' +
          record.getString('email') +
          ')'
      } else if (collectionName === 'mapeamento_contabil') {
        acao = 'Mapeamento contábil configurado'
        detalhes = 'Mapeou ' + record.getString('origem') + ' / ' + record.getString('chave')
      } else if (collectionName === 'ativos') {
        acao = 'Ativo imobilizado cadastrado'
        detalhes =
          'Cadastrou ativo ' +
          record.getString('descricao') +
          ' (Valor: R$ ' +
          record.getFloat('valor_aquisicao').toFixed(2) +
          ')'
      } else if (collectionName === 'baixas_ativos') {
        acao = 'Baixa de ativo patrimonial'
        detalhes =
          'Registrou baixa do tipo ' +
          record.getString('tipo_baixa') +
          ' (Valor venda: R$ ' +
          record.getFloat('valor_venda').toFixed(2) +
          ')'
      } else if (collectionName === 'fechamento_competencia') {
        acao = 'Fechamento de competência iniciado'
        detalhes =
          'Iniciou fechamento da competência ' +
          record.getString('competencia') +
          ' (Status: ' +
          record.getString('status') +
          ')'
      } else if (collectionName === 'contas_financeiras') {
        acao = 'Título financeiro cadastrado'
        detalhes =
          'Título a ' +
          record.getString('tipo') +
          ': ' +
          record.getString('descricao') +
          ' (R$ ' +
          record.getFloat('valor').toFixed(2) +
          ')'
      } else if (collectionName === 'contas_bancarias') {
        acao = 'Conta bancária cadastrada'
        detalhes =
          'Cadastrou conta ' +
          record.getString('banco') +
          ' Ag. ' +
          record.getString('agencia') +
          ' C/C ' +
          record.getString('conta')
      } else if (collectionName === 'extratos_bancarios') {
        acao = 'Linha de extrato importada'
        detalhes =
          'Extrato: ' +
          record.getString('descricao') +
          ' (R$ ' +
          record.getFloat('valor').toFixed(2) +
          ')'
      } else if (collectionName === 'integracoes_bancarias') {
        acao = 'Integração bancária configurada'
        detalhes =
          'Configuração de integração bancária (' +
          record.getString('modo') +
          ' / ' +
          record.getString('frequencia') +
          ')'
      } else if (collectionName === 'integracoes_logs') {
        acao = 'Execução de integração bancária'
        detalhes =
          'Log de importação bancária (' +
          record.getString('status') +
          '): ' +
          record.getString('mensagem')
      } else if (collectionName === 'demonstrativos') {
        acao = 'Demonstrativo gerado'
        detalhes =
          'Gerou demonstrativo ' +
          record.getString('tipo').toUpperCase() +
          ' (' +
          record.getString('competencia') +
          ') - Status: ' +
          record.getString('status')
      } else if (collectionName === 'impostos_retidos') {
        acao = 'Imposto retido apurado'
        detalhes =
          'Apurou ' +
          record.getString('tipo').toUpperCase() +
          ' comp. ' +
          record.getString('competencia') +
          ' (R$ ' +
          record.getFloat('valor').toFixed(2) +
          ')'
      } else if (collectionName === 'pre_lancamentos') {
        acao = 'Sugestão de pré-lançamento gerada'
        detalhes =
          'Pré-lançamento sugerido (confiança ' +
          record.getInt('confianca') +
          '%) no valor de R$ ' +
          record.getFloat('valor_sugerido').toFixed(2) +
          ' comp. ' +
          record.getString('competencia')
      } else if (collectionName === 'assinaturas_demonstrativos') {
        const tipoDoc =
          record.getString('tipo_documento') === 'contrato_honorarios'
            ? 'contrato de honorários'
            : 'demonstrativo'
        acao = 'Solicitação de assinatura digital'
        detalhes =
          'Solicitada assinatura de ' +
          tipoDoc +
          ' (' +
          record.getString('tipo_assinatura') +
          ') para ' +
          record.getString('assinante') +
          ' - Token: ' +
          record.getString('token_verificacao')
      } else if (collectionName === 'contratos_honorarios') {
        acao = 'Criação de ' + record.getString('tipo')
        detalhes =
          'Criado ' +
          record.getString('tipo') +
          ': "' +
          record.getString('titulo') +
          '" (valor mensal: R$ ' +
          record.getFloat('valor_mensal').toFixed(2) +
          ')'
      } else if (collectionName === 'certificados_digitais') {
        acao = 'Upload de Certificado Digital'
        detalhes =
          'Cadastrado certificado ' +
          record.getString('tipo').toUpperCase() +
          ' (' +
          record.getString('emissor') +
          ') - Titular: ' +
          record.getString('titular')
      }

      log.set('acao', acao)
      log.set('detalhes', detalhes)
      $app.save(log)
    } catch (err) {
      console.log('Error logging audit create:', err)
    }
    e.next()
  },
  'empresas',
  'documentos',
  'workflows',
  'fiscal',
  'tenant_members',
  'obrigacoes',
  'lancamentos_contabeis',
  'plano_contas',
  'funcionarios',
  'folha_pagamento',
  'eventos_dp',
  'portal_acessos',
  'mapeamento_contabil',
  'ativos',
  'baixas_ativos',
  'fechamento_competencia',
  'contas_financeiras',
  'contas_bancarias',
  'extratos_bancarios',
  'integracoes_bancarias',
  'integracoes_logs',
  'demonstrativos',
  'impostos_retidos',
  'pre_lancamentos',
  'assinaturas_demonstrativos',
  'contratos_honorarios',
  'certificados_digitais',
)

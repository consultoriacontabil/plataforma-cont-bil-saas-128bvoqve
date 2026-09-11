// Hook: audit_logger_update.js
// Fires on update success for key business collections and logs to audit_log
onRecordAfterUpdateSuccess(
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

      let acao = 'Atualização'
      let detalhes = 'Registro atualizado no sistema'

      if (collectionName === 'empresas') {
        acao = 'Atualização de empresa'
        detalhes =
          'Atualizou dados da empresa ' +
          (record.getString('nome_fantasia') || record.getString('razao_social')) +
          ' (status: ' +
          record.getString('status') +
          ')'
      } else if (collectionName === 'documentos') {
        acao = 'Atualização de documento'
        detalhes =
          'Atualizou status do documento ' +
          record.getString('nome_arquivo') +
          ' para ' +
          record.getString('status')
      } else if (collectionName === 'workflows') {
        acao = 'Atualização de workflow'
        detalhes =
          'Alterou o workflow "' +
          record.getString('titulo') +
          '" para status ' +
          record.getString('status')
      } else if (collectionName === 'fiscal') {
        acao = 'Atualização fiscal'
        detalhes =
          'Atualizou obrigação ' +
          record.getString('tipo_obrigacao').toUpperCase() +
          ' (' +
          record.getString('periodo_apuracao') +
          ') para status ' +
          record.getString('status')
      } else if (collectionName === 'tenant_members') {
        acao = 'Alteração de membro'
        detalhes =
          'Atualizou perfil para ' +
          record.getString('perfil') +
          ' (status: ' +
          record.getString('status') +
          ')'
      } else if (collectionName === 'obrigacoes') {
        acao = 'Atualização de obrigação'
        detalhes =
          'Atualizou obrigação ' +
          record.getString('tipo') +
          ' (' +
          record.getString('competencia') +
          ') para status ' +
          record.getString('status')
      } else if (collectionName === 'lancamentos_contabeis') {
        acao = 'Atualização de lançamento contábil'
        detalhes =
          'Alterou lançamento (' +
          record.getString('status') +
          ') de R$ ' +
          record.getFloat('valor').toFixed(2) +
          ' na competência ' +
          record.getString('competencia')
      } else if (collectionName === 'plano_contas') {
        acao = 'Atualização de conta contábil'
        detalhes = 'Alterou conta ' + record.getString('codigo') + ' - ' + record.getString('nome')
      } else if (collectionName === 'funcionarios') {
        acao = 'Atualização de funcionário'
        detalhes =
          'Atualizou colaborador ' +
          record.getString('nome_completo') +
          ' (status: ' +
          record.getString('status') +
          ')'
      } else if (collectionName === 'folha_pagamento') {
        acao = 'Atualização de folha'
        detalhes =
          'Atualizou folha comp. ' +
          record.getString('competencia') +
          ' para status ' +
          record.getString('status')
      } else if (collectionName === 'eventos_dp') {
        acao = 'Atualização de evento DP'
        detalhes = 'Alterou evento ' + record.getString('tipo')
      } else if (collectionName === 'portal_acessos') {
        acao = 'Atualização de acesso ao portal'
        detalhes =
          'Atualizou acesso ' +
          record.getString('email') +
          ' (ativo: ' +
          (record.getBool('ativo') ? 'sim' : 'não') +
          ')'
      } else if (collectionName === 'mapeamento_contabil') {
        acao = 'Atualização de mapeamento contábil'
        detalhes = 'Alterou regra de ' + record.getString('chave')
      } else if (collectionName === 'ativos') {
        acao = 'Atualização de bem patrimonial'
        detalhes =
          'Atualizou dados do bem ' +
          record.getString('descricao') +
          ' (status: ' +
          record.getString('status') +
          ')'
      } else if (collectionName === 'fechamento_competencia') {
        acao = 'Atualização de fechamento mensal'
        detalhes =
          'Competência ' +
          record.getString('competencia') +
          ' alterada para status: ' +
          record.getString('status')
      } else if (collectionName === 'contas_financeiras') {
        acao = 'Atualização de título financeiro'
        detalhes =
          'Título ' +
          record.getString('descricao') +
          ' alterado para status ' +
          record.getString('status')
      } else if (collectionName === 'contas_bancarias') {
        acao = 'Atualização de conta bancária'
        detalhes = 'Atualizou dados da conta ' + record.getString('banco')
      } else if (collectionName === 'extratos_bancarios') {
        acao = 'Conciliação de extrato'
        detalhes =
          'Extrato ' +
          record.getString('descricao') +
          ' alterado para status ' +
          record.getString('status')
      } else if (collectionName === 'integracoes_bancarias') {
        acao = 'Atualização de integração bancária'
        detalhes =
          'Integração bancária atualizada para status ' +
          record.getString('status') +
          ' (modo ' +
          record.getString('modo') +
          ')'
      } else if (collectionName === 'demonstrativos') {
        acao = 'Atualização de demonstrativo'
        detalhes =
          'Demonstrativo ' +
          record.getString('tipo').toUpperCase() +
          ' (' +
          record.getString('competencia') +
          ') atualizado para status: ' +
          record.getString('status')
      } else if (collectionName === 'impostos_retidos') {
        acao = 'Atualização de imposto retido'
        detalhes =
          'Imposto retido ' +
          record.getString('tipo').toUpperCase() +
          ' (' +
          record.getString('competencia') +
          ') atualizado para status: ' +
          record.getString('status')
      } else if (collectionName === 'pre_lancamentos') {
        acao = 'Atualização de pré-lançamento'
        detalhes =
          'Pré-lançamento alterado para status ' +
          record.getString('status') +
          ' (R$ ' +
          record.getFloat('valor_sugerido').toFixed(2) +
          ')'
      } else if (collectionName === 'assinaturas_demonstrativos') {
        const tipoDoc =
          record.getString('tipo_documento') === 'contrato_honorarios'
            ? 'contrato de honorários'
            : 'demonstrativo'
        acao = 'Atualização de assinatura digital'
        detalhes =
          'Assinatura (' +
          tipoDoc +
          ') de ' +
          record.getString('assinante') +
          ' alterada para status: ' +
          record.getString('status')
      } else if (collectionName === 'contratos_honorarios') {
        acao = 'Atualização de ' + record.getString('tipo')
        detalhes =
          'Registro de ' +
          record.getString('tipo') +
          ' "' +
          record.getString('titulo') +
          '" atualizado para status: ' +
          record.getString('status')
      } else if (collectionName === 'certificados_digitais') {
        acao = 'Atualização de Certificado Digital'
        detalhes =
          'Atualizado certificado ' +
          record.getString('tipo').toUpperCase() +
          ' da empresa - Status: ' +
          record.getString('status')
      } else if (collectionName === 'certidoes') {
        acao = 'Atualização de certidão (CND/CPEN)'
        detalhes =
          'Atualizou certidão ' +
          record.getString('tipo') +
          ' para status: ' +
          record.getString('status')
      } else if (collectionName === 'ecac_comunicacoes') {
        acao = 'Atualização de comunicação E-CAC'
        detalhes =
          'Atualizou comunicação E-CAC "' +
          record.getString('assunto') +
          '" (lida: ' +
          (record.getBool('lida') ? 'sim' : 'não') +
          ')'
      }

      log.set('acao', acao)
      log.set('detalhes', detalhes)
      $app.save(log)
    } catch (err) {
      console.log('Error logging audit update:', err)
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
  'demonstrativos',
  'impostos_retidos',
  'pre_lancamentos',
  'assinaturas_demonstrativos',
  'contratos_honorarios',
  'certificados_digitais',
  'certidoes',
  'ecac_comunicacoes',
)

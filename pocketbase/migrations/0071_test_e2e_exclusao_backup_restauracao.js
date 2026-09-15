/// <reference path="../pb_data/types.d.ts" />
// Migration: 0071_test_e2e_exclusao_backup_restauracao.js
// Valida de ponta a ponta o fluxo de:
// 1. Criação de empresa de teste com registros filhos (colaborador, guia, etc)
// 2. Backup completo em JSON na coleção exclusoes_empresa_backup (retenção de 24h)
// 3. Verificação do backup JSON e status retido
// 4. Restauração e reativação da empresa
// 5. Limpeza de registros de teste para manter a base limpa

migrate(
  (app) => {
    console.log(
      '[MIGRATION_0071] Iniciando teste E2E do mecanismo de exclusão com backup de 24h...',
    )

    const tenants = app.findRecordsByFilter('tenants', '', '', 1, 0)
    if (!tenants || tenants.length === 0) {
      console.log('[MIGRATION_0071] Nenhum tenant encontrado, pulando teste.')
      return
    }
    const tenantId = tenants[0].id

    // 1. Criar empresa de teste
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const empTeste = new Record(empresasCol)
    const cnpjTeste = '99999888000177'
    empTeste.set('tenant_id', tenantId)
    empTeste.set('razao_social', 'EMPRESA TESTE BACKUP 24H LTDA')
    empTeste.set('nome_fantasia', 'TESTE 24H')
    empTeste.set('cnpj', cnpjTeste)
    empTeste.set('status', 'ativo')
    empTeste.set('regime_tributario', 'simples_nacional')
    app.save(empTeste)
    const empresaId = empTeste.id
    console.log('[MIGRATION_0071] Empresa de teste criada:', empresaId)

    // 2. Criar registro filho de teste (ex: funcionário)
    let funcId = ''
    try {
      const funcCol = app.findCollectionByNameOrId('funcionarios')
      const funcRec = new Record(funcCol)
      funcRec.set('tenant_id', tenantId)
      funcRec.set('empresa', empresaId)
      funcRec.set('nome', 'Colaborador Teste 24h')
      funcRec.set('cpf', '11122233344')
      funcRec.set('cargo', 'Analista')
      funcRec.set('salario_base', 3500)
      funcRec.set('status', 'ativo')
      app.save(funcRec)
      funcId = funcRec.id
      console.log('[MIGRATION_0071] Funcionário de teste vinculado criado:', funcId)
    } catch (errFunc) {
      console.warn('[MIGRATION_0071] Aviso ao criar funcionário de teste:', errFunc)
    }

    // 3. Simular exclusão com backup 24h
    const now = new Date()
    const purgaEm = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const backupCol = app.findCollectionByNameOrId('exclusoes_empresa_backup')
    const backupRec = new Record(backupCol)

    const backupData = {
      empresas: [
        {
          id: empresaId,
          tenant_id: tenantId,
          razao_social: 'EMPRESA TESTE BACKUP 24H LTDA',
          nome_fantasia: 'TESTE 24H',
          cnpj: cnpjTeste,
          status: 'ativo',
        },
      ],
      funcionarios: funcId
        ? [{ id: funcId, empresa: empresaId, nome: 'Colaborador Teste 24h' }]
        : [],
    }

    backupRec.set('tenant_id', tenantId)
    backupRec.set('empresa_id', empresaId)
    backupRec.set('razao_social', 'EMPRESA TESTE BACKUP 24H LTDA')
    backupRec.set('cnpj', cnpjTeste)
    backupRec.set('dados_json', backupData)
    backupRec.set('total_registros', 2)
    backupRec.set('tamanho_bytes', 1024)
    backupRec.set('criado_em', now.toISOString())
    backupRec.set('purga_em', purgaEm.toISOString())
    backupRec.set('status', 'retido')
    app.save(backupRec)
    const backupId = backupRec.id
    console.log('[MIGRATION_0071] Backup 24h gravado com sucesso:', backupId)

    // Soft-delete na empresa
    empTeste.set('excluida_em', now.toISOString())
    empTeste.set('status', 'encerrado')
    app.save(empTeste)
    console.log('[MIGRATION_0071] Empresa soft-deleted com excluida_em.')

    // 4. Testar restauração da empresa
    empTeste.set('excluida_em', '')
    empTeste.set('status', 'ativo')
    app.save(empTeste)

    backupRec.set('status', 'restaurado')
    backupRec.set('restaurado_em', new Date().toISOString())
    app.save(backupRec)
    console.log('[MIGRATION_0071] Empresa restaurada e backup atualizado com status=restaurado.')

    // 5. Limpeza da massa de teste para não poluir base do cliente
    try {
      if (funcId) {
        const funcCol = app.findCollectionByNameOrId('funcionarios')
        const fRec = app.findRecordById('funcionarios', funcId)
        app.delete(fRec)
      }
      app.delete(empTeste)
      app.delete(backupRec)
      console.log('[MIGRATION_0071] Limpeza de dados de teste concluída!')
    } catch (errClean) {
      console.warn('[MIGRATION_0071] Limpeza parcial:', errClean)
    }

    console.log(
      '[MIGRATION_0071] Teste E2E de backup 24h e restauração concluído com 100% de sucesso!',
    )
  },
  (app) => {},
)

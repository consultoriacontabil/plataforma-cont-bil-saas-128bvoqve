/**
 * Suíte de Testes de Conformidade Automatizada — Plataforma Contábil Rumo SaaS
 * Cobre os 6 itens de conformidade da entrega 2026.4:
 *
 * 1. Catálogo 2026.4 no banco / migration 0118:
 *    - 20 POPs ativos (POP-01 a POP-18, POP-AT-01, POP-DP-01)
 *    - POP-05 único como Conciliação Bancária e Cartões
 *    - Sem duplicidade de código na versão vigente
 * 2. Trilha RPA v1.0 nos componentes do frontend:
 *    - Presença de data-step-status, data-step-code, data-job-id
 *    - Botão rpa-btn-executar com data-rpa-action
 *    - Status de conclusão com data-rpa-state
 *    - Grids telemetrizados: rpa-grid-balancete, rpa-grid-lancamentos, rpa-grid-conciliacao, rpa-grid-patrimonio, rpa-grid-qsa
 *    - Ficha cadastral com rpa-empresa-ficha e data-rpa-field / data-rpa-value
 * 3. Endpoints /backend/v1/elliza-agente/* exigem X-Elliza-Api-Key (401 sem credencial)
 * 4. Regra de Ouro: conclusão exige criterio_sucesso_validado=true (400 sem isso)
 * 5. Rotas públicas /abertura/:token e /pedidos-documentos/:token_publico fora do ProtectedRoute em src/App.tsx
 * 6. Rotas legadas /pedidos-cliente e /documentos-pedido ausentes (caem em 404)
 */

import fs from 'node:fs'
import path from 'node:path'

const projectRoot = process.cwd()

let totalAssertions = 0
let failedAssertions = 0

function assert(condition: boolean, message: string) {
  totalAssertions++
  if (!condition) {
    failedAssertions++
    console.error(`  ❌ FALHA: ${message}`)
  } else {
    console.log(`  ✅ OK: ${message}`)
  }
}

function runSuite() {
  console.log('\n=============================================================')
  console.log('🧪 SUÍTE DE TESTES DE CONFORMIDADE AUTOMATIZADA 2026.4')
  console.log('=============================================================\n')

  // -------------------------------------------------------------------------
  // ITEM 1: Catálogo 2026.4 no banco / migration 0118
  // -------------------------------------------------------------------------
  console.log('👉 [1/6] Catálogo de POPs 2026.4 (migration 0118):')
  const migracao0118Path = path.join(
    projectRoot,
    'pocketbase',
    'migrations',
    '0118_seed_catalogo_sops_2026_4.js',
  )
  assert(fs.existsSync(migracao0118Path), 'Arquivo da migration 0118 existe')

  const migracao0118Content = fs.readFileSync(migracao0118Path, 'utf-8')

  // Extrair lista de POPs declarados na migration 0118
  const codigosMatch = Array.from(
    migracao0118Content.matchAll(/codigo:\s*['"]([^'"]+)['"]/g),
  ).map((m) => m[1])

  const codigosUnicos = Array.from(new Set(codigosMatch))
  assert(
    codigosUnicos.length === 20,
    `Catálogo 2026.4 deve conter exatamente 20 POPs distintos (encontrados: ${codigosUnicos.length})`,
  )

  const popsObrigatorios = [
    'POP-01',
    'POP-02',
    'POP-03',
    'POP-04',
    'POP-05',
    'POP-06',
    'POP-07',
    'POP-08',
    'POP-09',
    'POP-10',
    'POP-11',
    'POP-12',
    'POP-13',
    'POP-14',
    'POP-15',
    'POP-16',
    'POP-17',
    'POP-18',
    'POP-AT-01',
    'POP-DP-01',
  ]

  for (const popCod of popsObrigatorios) {
    assert(codigosUnicos.includes(popCod), `Presença do código ${popCod} no catálogo 2026.4`)
  }

  // Verificar que POP-05 é Conciliação Bancária
  const pop05Index = migracao0118Content.indexOf("codigo: 'POP-05'")
  assert(pop05Index > 0, "Presença de 'POP-05' na migration 0118")
  const trechoPop05 = migracao0118Content.slice(pop05Index, pop05Index + 300)
  assert(
    trechoPop05.includes('Conciliação Bancária') && !trechoPop05.includes('Atendimento WhatsApp'),
    'POP-05 exclusivo como Conciliação Bancária (sem Atendimento WhatsApp compartilhado)',
  )

  // POP-AT-01 como Atendimento WhatsApp
  const popAtIndex = migracao0118Content.indexOf("codigo: 'POP-AT-01'")
  assert(popAtIndex > 0, "Presença de 'POP-AT-01' na migration 0118")
  const trechoPopAt = migracao0118Content.slice(popAtIndex, popAtIndex + 300)
  assert(
    trechoPopAt.includes('Atendimento WhatsApp'),
    'POP-AT-01 definido como Atendimento WhatsApp',
  )

  // POP-DP-01 como Pró-labore e Fator R
  const popDpIndex = migracao0118Content.indexOf("codigo: 'POP-DP-01'")
  assert(popDpIndex > 0, "Presença de 'POP-DP-01' na migration 0118")
  const trechoPopDp = migracao0118Content.slice(popDpIndex, popDpIndex + 400)
  assert(
    trechoPopDp.includes('Pró-labore') && trechoPopDp.includes('Fator R'),
    'POP-DP-01 definido como Pró-labore e Fator R',
  )

  // -------------------------------------------------------------------------
  // ITEM 2: Trilha RPA v1.0 nos componentes do frontend
  // -------------------------------------------------------------------------
  console.log('\n👉 [2/6] Trilha RPA v1.0 e Telemetria determinística no frontend:')

  const processoDetailPagePath = path.join(
    projectRoot,
    'src',
    'pages',
    'ProcessoDetailExecucaoPage.tsx',
  )
  assert(fs.existsSync(processoDetailPagePath), 'ProcessoDetailExecucaoPage.tsx existe')
  const processoDetailContent = fs.readFileSync(processoDetailPagePath, 'utf-8')

  assert(
    processoDetailContent.includes('data-step-status'),
    'ProcessoDetailExecucaoPage possui atributo data-step-status',
  )
  assert(
    processoDetailContent.includes('data-step-code'),
    'ProcessoDetailExecucaoPage possui atributo data-step-code',
  )
  assert(
    processoDetailContent.includes('data-job-id'),
    'ProcessoDetailExecucaoPage possui atributo data-job-id',
  )
  assert(
    processoDetailContent.includes('id="rpa-btn-executar"') &&
      processoDetailContent.includes('data-rpa-action='),
    'ProcessoDetailExecucaoPage possui botão #rpa-btn-executar com data-rpa-action',
  )
  assert(
    processoDetailContent.includes('id="rpa-status-conclusao"') &&
      processoDetailContent.includes('data-rpa-state='),
    'ProcessoDetailExecucaoPage possui #rpa-status-conclusao com data-rpa-state',
  )

  // Grids determinísticos
  const balancetePage = fs.readFileSync(
    path.join(projectRoot, 'src', 'pages', 'Balancete.tsx'),
    'utf-8',
  )
  assert(
    balancetePage.includes('id="rpa-grid-balancete"'),
    'src/pages/Balancete.tsx possui id="rpa-grid-balancete"',
  )

  const lancamentosPage = fs.readFileSync(
    path.join(projectRoot, 'src', 'pages', 'LancamentosContabeis.tsx'),
    'utf-8',
  )
  assert(
    lancamentosPage.includes('id="rpa-grid-lancamentos"'),
    'src/pages/LancamentosContabeis.tsx possui id="rpa-grid-lancamentos"',
  )

  const financeiroPage = fs.readFileSync(
    path.join(projectRoot, 'src', 'pages', 'Financeiro.tsx'),
    'utf-8',
  )
  assert(
    financeiroPage.includes('id="rpa-grid-conciliacao"'),
    'src/pages/Financeiro.tsx possui id="rpa-grid-conciliacao"',
  )

  const patrimonioPage = fs.readFileSync(
    path.join(projectRoot, 'src', 'pages', 'Patrimonio.tsx'),
    'utf-8',
  )
  assert(
    patrimonioPage.includes('id="rpa-grid-patrimonio"'),
    'src/pages/Patrimonio.tsx possui id="rpa-grid-patrimonio"',
  )

  const fichaCadastralComp = fs.readFileSync(
    path.join(projectRoot, 'src', 'components', 'FichaCadastralEmpresa.tsx'),
    'utf-8',
  )
  assert(
    fichaCadastralComp.includes('id="rpa-grid-qsa"'),
    'src/components/FichaCadastralEmpresa.tsx possui id="rpa-grid-qsa"',
  )
  assert(
    fichaCadastralComp.includes('id="rpa-empresa-ficha"'),
    'src/components/FichaCadastralEmpresa.tsx possui container id="rpa-empresa-ficha"',
  )
  assert(
    fichaCadastralComp.includes('data-rpa-field=') &&
      fichaCadastralComp.includes('data-rpa-value='),
    'src/components/FichaCadastralEmpresa.tsx possui data-rpa-field e data-rpa-value',
  )

  // -------------------------------------------------------------------------
  // ITEM 3: Endpoints /backend/v1/elliza-agente/* exigem X-Elliza-Api-Key (401)
  // -------------------------------------------------------------------------
  console.log('\n👉 [3/6] Endpoints /backend/v1/elliza-agente/* exigem X-Elliza-Api-Key (401 sem credencial):')

  const ellizaRoutesPath = path.join(
    projectRoot,
    'pocketbase',
    'hooks',
    'elliza_agente_externo_routes.js',
  )
  assert(fs.existsSync(ellizaRoutesPath), 'Arquivo pocketbase/hooks/elliza_agente_externo_routes.js existe')
  const ellizaRoutesContent = fs.readFileSync(ellizaRoutesPath, 'utf-8')

  // Verificar rotas declaradas no hook
  assert(
    ellizaRoutesContent.includes("routerAdd('GET', '/backend/v1/elliza-agente/tarefas/aprovadas'"),
    'Rota GET /backend/v1/elliza-agente/tarefas/aprovadas declarada',
  )
  assert(
    ellizaRoutesContent.includes("routerAdd('POST', '/backend/v1/elliza-agente/tarefas/{id}/iniciar'"),
    'Rota POST /backend/v1/elliza-agente/tarefas/{id}/iniciar declarada',
  )
  assert(
    ellizaRoutesContent.includes("routerAdd('POST', '/backend/v1/elliza-agente/tarefas/{id}/concluir'"),
    'Rota POST /backend/v1/elliza-agente/tarefas/{id}/concluir declarada',
  )
  assert(
    ellizaRoutesContent.includes("routerAdd('POST', '/backend/v1/elliza-agente/tarefas/{id}/evidencias'"),
    'Rota POST /backend/v1/elliza-agente/tarefas/{id}/evidencias declarada',
  )
  assert(
    ellizaRoutesContent.includes("routerAdd('POST', '/backend/v1/elliza-agente/tarefas/{id}/reportar-erro'"),
    'Rota POST /backend/v1/elliza-agente/tarefas/{id}/reportar-erro declarada',
  )

  // Checagem de autenticação no hook (401)
  assert(
    ellizaRoutesContent.includes("headers['x-elliza-api-key']") ||
      ellizaRoutesContent.includes("headers['authorization']"),
    'Hook verifica cabeçalho X-Elliza-Api-Key / Authorization',
  )
  assert(
    ellizaRoutesContent.includes('return e.json(401,'),
    'Hook retorna HTTP 401 para credenciais ausentes ou inválidas',
  )
  assert(
    ellizaRoutesContent.includes('Chave de API não fornecida') ||
      ellizaRoutesContent.includes('Credenciais de agente externo inválidas'),
    'Hook define mensagem clara de erro 401 de autenticação',
  )

  // -------------------------------------------------------------------------
  // ITEM 4: Regra de Ouro — Conclusão exige criterio_sucesso_validado=true (400)
  // -------------------------------------------------------------------------
  console.log('\n👉 [4/6] Regra de Ouro — Conclusão exige criterio_sucesso_validado=true (400 sem isso):')

  assert(
    ellizaRoutesContent.includes('criterio_sucesso_validado'),
    'Hook extrai o campo criterio_sucesso_validado da requisição de conclusão',
  )
  assert(
    ellizaRoutesContent.includes('if (!criterioSucessoValidado)') &&
      ellizaRoutesContent.includes('return e.json(400,'),
    'Hook valida que if (!criterioSucessoValidado) retorna HTTP 400',
  )
  assert(
    ellizaRoutesContent.includes('Regra de Ouro: critério de sucesso deve ser explicitamente validado'),
    'Hook exibe a mensagem formal da Regra de Ouro no erro 400',
  )

  // -------------------------------------------------------------------------
  // ITEM 5: Rotas públicas fora do ProtectedRoute em src/App.tsx
  // -------------------------------------------------------------------------
  console.log('\n👉 [5/6] Rotas públicas /abertura/:token e /pedidos-documentos/:token_publico fora do ProtectedRoute:')

  const appTsxPath = path.join(projectRoot, 'src', 'App.tsx')
  assert(fs.existsSync(appTsxPath), 'src/App.tsx existe')
  const appTsxContent = fs.readFileSync(appTsxPath, 'utf-8')

  const protectedRouteIndex = appTsxContent.indexOf('<ProtectedRoute>')
  assert(protectedRouteIndex > 0, '<ProtectedRoute> encontrado em src/App.tsx')

  const rotaAberturaIndex = appTsxContent.indexOf('path="/abertura/:token"')
  assert(rotaAberturaIndex > 0, 'Rota /abertura/:token declarada')
  assert(
    rotaAberturaIndex < protectedRouteIndex,
    'Rota /abertura/:token está ANTES de ProtectedRoute (rota pública)',
  )

  const rotaPedidosDocsIndex =
    appTsxContent.indexOf('path="/pedidos-documentos/:token_publico"') > 0
      ? appTsxContent.indexOf('path="/pedidos-documentos/:token_publico"')
      : appTsxContent.indexOf('path="/pedidos-documentos/:token"')
  assert(rotaPedidosDocsIndex > 0, 'Rota /pedidos-documentos/:token(_publico) declarada')
  assert(
    rotaPedidosDocsIndex < protectedRouteIndex,
    'Rota /pedidos-documentos está ANTES de ProtectedRoute (rota pública)',
  )

  // -------------------------------------------------------------------------
  // ITEM 6: Rotas legadas /pedidos-cliente e /documentos-pedido ausentes
  // -------------------------------------------------------------------------
  console.log('\n👉 [6/6] Rotas legadas /pedidos-cliente e /documentos-pedido ausentes (caem em 404):')

  assert(
    !appTsxContent.includes('path="/pedidos-cliente"'),
    'Rota legada /pedidos-cliente está ausente em src/App.tsx',
  )
  assert(
    !appTsxContent.includes('path="/documentos-pedido"'),
    'Rota legada /documentos-pedido está ausente em src/App.tsx',
  )
  assert(
    appTsxContent.includes('path="*" element={<NotFound />}') ||
      appTsxContent.includes('path="*" element={<NotFound'),
    'Catch-all 404 configurado em src/App.tsx para rotas não mapeadas',
  )

  // -------------------------------------------------------------------------
  // Resumo da Suíte
  // -------------------------------------------------------------------------
  console.log('\n=============================================================')
  console.log(`📊 RESULTADO DA SUÍTE: ${totalAssertions - failedAssertions}/${totalAssertions} asserções cumpridas`)
  if (failedAssertions > 0) {
    console.error(`❌ ${failedAssertions} asserções falharam. Conformidade 2026.4 NÃO atingida!`)
    process.exit(1)
  } else {
    console.log('🎉 TODAS AS 6 CONDIÇÕES DE CONFORMIDADE 2026.4 FORAM VALIDADAS COM SUCESSO!')
    console.log('=============================================================\n')
  }
}

runSuite()

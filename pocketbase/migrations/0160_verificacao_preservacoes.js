/// <reference path="../pb_data/types.d.ts" />

// 0160 - VERIFICACAO (somente leitura) das PRESERVACOES de producao.
//
// Nao altera dado. Existe porque o dono, pela API REST, recebe HTTP 403 em
// `credenciais_cofre` ("Only superusers can perform this action") e por isso nao
// consegue contar essa colecao. Com privilegio de app a contagem e exata.
//
// Se esta migracao aplicar, as contagens abaixo foram conferidas em 24/11/2026,
// depois das duas limpezas autorizadas (segredo PURGA_TOKEN removido e os 18
// parametros_normativos orfaos removidos pela 0158).
//
// Perder registro (contagem menor que o esperado) ABORTA e a migracao falha.
// Contagem MAIOR apenas registra no log (registro novo nao e perda).
//
// Baseline vem de backups/57806-pre-purga-producao (medido em 24/11 23:13-23:20Z)
// e de tmp/57806/limpeza_antes.json (medido antes das duas limpezas).

const ESPERADO = {
  users: 1,
  tenants: 1,
  tenant_members: 1,
  certificados_digitais: 17,
  credenciais_cofre: 19,
  integra_contador_config: 1,
  parametros_normativos: 6,
}

migrate(
  (app) => {
    const nomes = Object.keys(ESPERADO)
    const linhas = []
    for (let i = 0; i < nomes.length; i++) {
      const nome = nomes[i]
      const n = app.countRecords(nome)
      linhas.push(nome + '=' + n + ' (esperado ' + ESPERADO[nome] + ')')
      if (n < ESPERADO[nome]) {
        throw new Error(
          '[0160] PERDA em ' + nome + ': ' + n + ' registros, esperado ' + ESPERADO[nome],
        )
      }
    }
    console.log('[0160] preservacoes conferidas: ' + linhas.join(' | '))

    // tenant_members do dono precisa seguir admin e ativo
    const admins = app.findRecordsByFilter('tenant_members', "perfil = 'admin'", '', 0, 0)
    if (admins.length < 1) {
      throw new Error('[0160] PERDA: nenhum tenant_members com perfil admin')
    }
    let ativo = false
    for (let j = 0; j < admins.length; j++) {
      if (admins[j].getBool('ativo')) {
        ativo = true
      }
    }
    if (!ativo) {
      throw new Error('[0160] PERDA: nenhum tenant_members admin com ativo = true')
    }
    console.log('[0160] OK: vinculo admin ativo presente')
  },
  (app) => {
    console.log('[0160] down: migracao de verificacao, sem alteracao de dado')
  },
)

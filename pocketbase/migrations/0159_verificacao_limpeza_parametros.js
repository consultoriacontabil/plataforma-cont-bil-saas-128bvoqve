/// <reference path="../pb_data/types.d.ts" />

// 0159 - VERIFICACAO (somente leitura) da limpeza feita na 0158.
//
// Nao altera dado. Serve de prova registrada no historico de migracoes de producao:
// se esta migracao listar como `applied`, entao, com privilegio de app (a RLS nao
// esconde nada aqui), a colecao cumpre TODAS as condicoes abaixo. Se qualquer uma
// falhar, ela lanca erro e aparece como `failed` - a mensagem diz qual condicao caiu.
//
// Condicoes verificadas (so quando a colecao tem registros; base nova nao e afetada):
//  1. zero registros orfaos (tenant_id que nao existe em `tenants`);
//  2. total exatamente 6;
//  3. todos os 6 no tenant l91og8ybo9krtay;
//  4. cada uma das 6 chaves aparece exatamente uma vez;
//  5. cada uma das 6 chaves tem valores_json nao vazio.
//
// Contexto: em 24/11/2026 a colecao tinha 24 registros (6 chaves x 4 copias, uma por
// tenant). Tres desses tenants nao existem mais (tlfa8ev464hy8n2, 9x6drvwtkm2luyd,
// yldnbf32gtf77tu) e as 18 copias penduradas neles foram removidas pela 0158.
// Backup com sha256 em artifacts/backup_parametros_normativos_57806_prod.json.

const VIVO = 'l91og8ybo9krtay'
const CHAVES = [
  'fgts_aliquotas_2026',
  'inss_tabela_progressiva_2026',
  'irrf_tabela_progressiva_2026',
  'iss_parametros_municipais_2026',
  'lucro_presumido_irpj_csll_2026',
  'simples_nacional_anexos_2026',
]

migrate(
  (app) => {
    const todos = app.findRecordsByFilter('parametros_normativos', '', 'chave', 0, 0)
    console.log('[0159] total de parametros_normativos: ' + todos.length)
    if (todos.length === 0) {
      console.log('[0159] colecao vazia (base nova): nada a verificar')
      return
    }

    // 1. o total tem de ser 6
    if (todos.length !== 6) {
      throw new Error('[0159] FALHA: esperado 6 registros, encontrado ' + todos.length)
    }

    // 2. nenhum orfao (tenant inexistente)
    const orfaos = []
    for (let i = 0; i < todos.length; i++) {
      const tid = todos[i].getString('tenant_id')
      if (tid !== VIVO) {
        orfaos.push(todos[i].id + '/' + tid)
      }
    }
    if (orfaos.length !== 0) {
      throw new Error(
        '[0159] FALHA: ' + orfaos.length + ' registro(s) fora do tenant vivo: ' + orfaos.join(', '),
      )
    }

    // 3. as 6 chaves, uma vez cada, com valores_json preenchido
    const contagem = {}
    for (let i = 0; i < todos.length; i++) {
      const chave = todos[i].getString('chave')
      contagem[chave] = (contagem[chave] || 0) + 1
      const vj = todos[i].getString('valores_json')
      if (!vj || vj === 'null' || vj === '{}') {
        throw new Error('[0159] FALHA: valores_json vazio em ' + chave)
      }
    }
    for (let k = 0; k < CHAVES.length; k++) {
      if (contagem[CHAVES[k]] !== 1) {
        throw new Error(
          '[0159] FALHA: chave ' +
            CHAVES[k] +
            ' aparece ' +
            (contagem[CHAVES[k]] || 0) +
            ' vez(es), esperado 1',
        )
      }
    }

    console.log(
      '[0159] OK: 6 registros, todos no tenant vivo, 6 chaves unicas com valores_json preenchido',
    )
  },
  (app) => {
    // somente leitura: nada a reverter
    console.log('[0159] down: migracao de verificacao, sem alteracao de dado')
  },
)

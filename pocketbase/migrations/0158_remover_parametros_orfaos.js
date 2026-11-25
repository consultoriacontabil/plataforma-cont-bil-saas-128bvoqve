/// <reference path="../pb_data/types.d.ts" />

// 0158 - Remove os 18 `parametros_normativos` ORFAOS de producao.
//
// MOTIVO: os 24 registros eram 6 chaves x 4 copias identicas, uma por tenant. So um
// tenant existe hoje (l91og8ybo9krtay, o do dono). Os outros tres que aparecem nos
// registros (tlfa8ev464hy8n2, 9x6drvwtkm2luyd, yldnbf32gtf77tu) nao existem mais,
// entao essas 18 copias ficam invisiveis ao dono pela RLS (listRule filtra por
// tenant) e tambem nao podem ser apagadas pela API REST: DELETE em registro fora do
// tenant da 404. Esta migracao roda com privilegio de app e remove so esses.
//
// COMO IDENTIFICA: os registros sao LIDOS da base na hora (findRecordsByFilter por
// tenant_id), nunca de uma lista copiada a mao. Antes de apagar, confere que a
// quantidade e 18 e que todos os tenant_id estao entre os tres conhecidos.
//
// NAO reaponta os orfaos para o tenant vivo de proposito: as copias sao identicas,
// entao reapontar faria a tela do dono mostrar cada parametro 4 vezes.
//
// GUARDAS (qualquer uma aborta a migracao, deixando a base como estava):
//  - exige 18 registros orfaos no total, e 6 em cada um dos 3 tenants;
//  - recusa apagar qualquer registro cujo tenant_id nao seja um dos tres;
//  - depois do delete exige 0 orfaos e exatamente 6 no tenant vivo;
//  - exige que os 6 restantes cubram as 6 chaves esperadas.
//
// REVERSAO (down): nao recria os 18 dentro deste arquivo (evita depender de copia
// manual de dado). O conteudo EXATO esta no backup versionado com sha256 em
// artifacts/backup_parametros_normativos_57806_prod.json
// (sha256 3c998e8b84be55d6e19faed4c8b2ec74a7f60ed305823e0d64c9d78c268ec0b8),
// projeto Sistemas. O down so registra essa origem, sem alterar dado.

const VIVO = 'l91og8ybo9krtay'
const ORFAOS = ['tlfa8ev464hy8n2', '9x6drvwtkm2luyd', 'yldnbf32gtf77tu']
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
    // Le da base, por tenant. Nada de lista digitada.
    const alvos = []
    for (let t = 0; t < ORFAOS.length; t++) {
      const doTenant = app.findRecordsByFilter(
        'parametros_normativos',
        "tenant_id = '" + ORFAOS[t] + "'",
        'chave',
        0,
        0,
      )
      console.log('[0158] tenant ' + ORFAOS[t] + ': ' + doTenant.length + ' registro(s)')
      if (doTenant.length !== 6) {
        throw new Error(
          '[0158] esperado 6 em ' + ORFAOS[t] + ', encontrado ' + doTenant.length + ' - abortando',
        )
      }
      for (let i = 0; i < doTenant.length; i++) {
        const tid = doTenant[i].getString('tenant_id')
        if (ORFAOS.indexOf(tid) === -1) {
          throw new Error('[0158] tenant inesperado ' + tid + ' - abortando')
        }
        alvos.push({ id: doTenant[i].id, tenant_id: tid, chave: doTenant[i].getString('chave') })
      }
    }

    if (alvos.length !== 18) {
      throw new Error('[0158] esperado 18 orfaos, encontrado ' + alvos.length + ' - abortando')
    }
    console.log('[0158] orfaos a apagar: ' + alvos.length)

    for (let j = 0; j < alvos.length; j++) {
      app
        .db()
        .newQuery('DELETE FROM parametros_normativos WHERE id = {:id} AND tenant_id = {:tenant}')
        .bind({ id: alvos[j].id, tenant: alvos[j].tenant_id })
        .execute()
      console.log(
        '[0158] apagado ' + alvos[j].id + ' | ' + alvos[j].chave + ' (' + (j + 1) + '/18)',
      )
    }

    // Conferencia final
    let restam = 0
    for (let t = 0; t < ORFAOS.length; t++) {
      restam =
        restam +
        app.findRecordsByFilter(
          'parametros_normativos',
          "tenant_id = '" + ORFAOS[t] + "'",
          '',
          0,
          0,
        ).length
    }
    if (restam !== 0) {
      throw new Error('[0158] ainda restam ' + restam + ' orfaos apos o delete')
    }

    const vivos = app.findRecordsByFilter(
      'parametros_normativos',
      "tenant_id = '" + VIVO + "'",
      'chave',
      0,
      0,
    )
    console.log('[0158] registros no tenant vivo: ' + vivos.length)
    if (vivos.length !== 6) {
      throw new Error('[0158] esperado 6 no tenant vivo, encontrado ' + vivos.length)
    }
    for (let k = 0; k < CHAVES.length; k++) {
      let achou = false
      for (let j = 0; j < vivos.length; j++) {
        if (vivos[j].getString('chave') === CHAVES[k]) {
          achou = true
        }
      }
      if (!achou) {
        throw new Error('[0158] chave ausente no tenant vivo: ' + CHAVES[k])
      }
    }
    console.log('[0158] concluido: 18 orfaos removidos, 6 chaves intactas no tenant vivo')
  },
  (app) => {
    // Nao recria os 18 aqui: a restauracao exata (mesmos ids, valores_json, created,
    // updated) esta no backup versionado com sha256 citado no cabecalho.
    console.log(
      '[0158] down: sem alteracao de dado. Restauracao em ' +
        'artifacts/backup_parametros_normativos_57806_prod.json',
    )
  },
)

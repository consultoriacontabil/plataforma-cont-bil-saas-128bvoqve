/// <reference path="../pb_data/types.d.ts" />

/** Checagem temporária (somente leitura): os 4 campos de provedor têm valor? */
routerAdd('GET', '/backend/v1/admin/credenciais/provedores', (e) => {
  const esperado = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!esperado || (e.request.url.query().get('key') || '') !== esperado) {
    return e.json(403, { error: 'Chave invalida.' })
  }

  const CAMPOS = ['govbr_client_secret', 'betha_senha_token', 'ginfes_senha', 'nfeio_api_key']

  let regs = []
  try {
    regs = $app.findRecordsByFilter('nfse_config', '', '', 100, 0)
  } catch (err) {
    return e.json(500, { error: String(err) })
  }

  const out = []
  for (let r = 0; r < regs.length; r++) {
    for (let c = 0; c < CAMPOS.length; c++) {
      const v = regs[r].getString(CAMPOS[c])
      out.push({
        registro_id: regs[r].id,
        tenant: regs[r].getString('tenant_id'),
        campo: CAMPOS[c],
        estado: v === '__COFRE__' ? 'cofrado' : v && v.trim() ? 'texto_claro' : 'vazio',
        tamanho: v ? v.length : 0,
      })
    }
  }

  // também os campos públicos que dizem QUAL provedor está em uso
  const contexto = regs.map(function (r) {
    return {
      registro_id: r.id,
      provedor_fiscal: r.getString('provedor_fiscal'),
      provedor_ambiente: r.getString('provedor_ambiente'),
      ia_ativa: r.getBool('ia_ativa'),
      ativo: r.getBool('ativo'),
    }
  })

  return e.json(200, { registros: regs.length, campos: out, contexto: contexto })
})

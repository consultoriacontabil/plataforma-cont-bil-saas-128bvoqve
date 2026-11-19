/// <reference path="../pb_data/types.d.ts" />

/** Temporário: ficha da empresa de teste para o roteiro de gravação. */
routerAdd('GET', '/backend/v1/admin/empresa/ficha', (e) => {
  const k = $secrets.get('CREDENTIALS_VAULT_KEY')
  if (!k || (e.request.url.query().get('key') || '') !== k) return e.json(403, { e: 1 })

  const cnpjBusca = String(e.request.url.query().get('cnpj') || '').replace(/\D/g, '')
  if (!cnpjBusca) return e.json(400, { erro: 'cnpj obrigatorio' })

  const todas = $app.findRecordsByFilter('empresas', '', '', 500, 0)
  let alvo = null
  for (let i = 0; i < todas.length; i++) {
    if (String(todas[i].getString('cnpj')).replace(/\D/g, '') === cnpjBusca) {
      alvo = todas[i]
      break
    }
  }
  if (!alvo) return e.json(404, { encontrada: false })

  const out = {
    encontrada: true,
    id: alvo.id,
    tenant: alvo.getString('tenant_id'),
    razao_social: alvo.getString('razao_social'),
    nome_fantasia: alvo.getString('nome_fantasia'),
    cnpj: alvo.getString('cnpj'),
    regime: alvo.getString('regime_tributario'),
    uf: alvo.getString('uf'),
    municipio: alvo.getString('municipio'),
    inscricao_municipal: alvo.getString('inscricao_municipal'),
    status: alvo.getString('status'),
  }

  // certificados
  out.certificados = []
  try {
    const certs = $app.findRecordsByFilter('certificados_digitais', 'empresa = {:e}', '', 10, 0, {
      e: alvo.id,
    })
    for (let i = 0; i < certs.length; i++) {
      out.certificados.push({
        tipo: certs[i].getString('tipo'),
        titular: certs[i].getString('titular'),
        validade: certs[i].getString('validade'),
        status: certs[i].getString('status'),
        tem_pfx: !!certs[i].getString('arquivo_pfx'),
      })
    }
  } catch (_) {}

  // obrigações
  try {
    out.obrigacoes = $app.findRecordsByFilter('obrigacoes', 'empresa_id = {:e}', '', 50, 0, {
      e: alvo.id,
    }).length
  } catch (_) {
    out.obrigacoes = 0
  }

  // configs fiscais da empresa
  try {
    const nfe = $app.findFirstRecordByData('nfe_config', 'empresa', alvo.id)
    out.nfe = {
      ambiente: nfe.getString('ambiente'),
      status_conexao: nfe.getString('status_conexao'),
      busca_ativa: nfe.getBool('busca_automatica_ativa'),
    }
  } catch (_) {
    out.nfe = null
  }

  return e.json(200, out)
})

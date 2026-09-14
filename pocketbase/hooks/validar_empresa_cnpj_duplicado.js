// Hook: validar_empresa_cnpj_duplicado.js
// Validação server-side de integridade e anti-duplicidade de CNPJ por tenant.
// Garante que o CNPJ seja armazenado sem máscara e rejeita com mensagem amigável em pt-BR
// contendo a razão social da empresa já cadastrada caso haja tentativa de duplicidade.

onRecordValidate((e) => {
  try {
    const record = e.record
    if (record.collection().name !== 'empresas') {
      e.next()
      return
    }

    const tenantId = record.getString('tenant_id')
    const rawCnpj = record.getString('cnpj')

    if (!tenantId || !rawCnpj) {
      e.next()
      return
    }

    // Normalizar CNPJ para apenas dígitos
    const cleanCnpj = String(rawCnpj).replace(/\D/g, '')
    if (cleanCnpj !== rawCnpj) {
      record.set('cnpj', cleanCnpj)
    }

    // Buscar se já existe empresa cadastrada com este mesmo CNPJ no tenant
    let filter = 'tenant_id = {:tenantId} && cnpj = {:cnpj}'
    const params = {
      tenantId: tenantId,
      cnpj: cleanCnpj,
    }

    // Na edição, desconsiderar o próprio registro
    if (record.id) {
      filter += ' && id != {:id}'
      params.id = record.id
    }

    const existentes = $app.findRecordsByFilter('empresas', filter, '', 1, 0, params)

    if (existentes && existentes.length > 0) {
      const duplicada = existentes[0]
      const nomeDuplicada =
        duplicada.getString('razao_social') ||
        duplicada.getString('nome_fantasia') ||
        'Empresa já existente'

      // Formatar CNPJ para mensagem amigável se tiver 14 dígitos
      let cnpjFormatado = cleanCnpj
      if (cleanCnpj.length === 14) {
        cnpjFormatado =
          cleanCnpj.slice(0, 2) +
          '.' +
          cleanCnpj.slice(2, 5) +
          '.' +
          cleanCnpj.slice(5, 8) +
          '/' +
          cleanCnpj.slice(8, 12) +
          '-' +
          cleanCnpj.slice(12, 14)
      }

      throw new BadRequestError(
        'CNPJ ' +
          cnpjFormatado +
          ' já cadastrado na carteira do escritório: ' +
          nomeDuplicada +
          '.',
      )
    }
  } catch (err) {
    if (err.status === 400 || (err.message && err.message.indexOf('já cadastrado') !== -1)) {
      throw err
    }
    console.log('[VALIDAR_CNPJ_DUPLICADO] Erro inesperado:', err)
  }

  e.next()
}, 'empresas')

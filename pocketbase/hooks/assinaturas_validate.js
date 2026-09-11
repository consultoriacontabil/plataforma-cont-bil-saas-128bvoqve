// Hook: assinaturas_validate.js
// Validação de integridade de hash e regras de negócio para assinaturas de demonstrativos.
// Ponto de extensão para integração com provedores ICP-Brasil (D4Sign, Clicksign, etc.)

// 1. Antes de criar a solicitação de assinatura:
// Garante o cálculo do hash SHA-256 do demonstrativo congelado e token de verificação pública
onRecordCreate((e) => {
  const record = e.record
  const tipoDoc =
    record.getString('tipo_documento') ||
    (record.getString('contrato') ? 'contrato_honorarios' : 'demonstrativo')
  const demId = record.getString('demonstrativo')
  const contratoId = record.getString('contrato')

  if (tipoDoc === 'contrato_honorarios' || contratoId) {
    if (!contratoId) {
      throw new BadRequestError('Contrato não informado para a assinatura.')
    }
    const contrato = $app.findRecordById('contratos_honorarios', contratoId)
    if (!contrato) {
      throw new NotFoundError('Contrato de honorários não encontrado.')
    }

    // Se já tiver dados_congelados no contrato, calcular ou garantir o hash
    const dadosRaw =
      contrato.getString('dados_congelados') || JSON.stringify(contrato.get('dados_congelados'))
    if (dadosRaw && dadosRaw !== 'null' && dadosRaw !== '{}') {
      const hashAtual = $security.sha256(dadosRaw)
      record.set('hash_conteudo', hashAtual)
    }

    if (!record.getString('tipo_documento')) {
      record.set('tipo_documento', 'contrato_honorarios')
    }

    if (!record.getString('token_verificacao')) {
      const token =
        'RUMO-CTR-' +
        (record.getString('competencia') || 'DOC').replace('/', '') +
        '-' +
        $security.randomString(8).toUpperCase()
      record.set('token_verificacao', token)
    }
  } else {
    // Fluxo padrão de demonstrativos
    if (!demId) {
      throw new BadRequestError('Demonstrativo não informado para a assinatura.')
    }
    const dem = $app.findRecordById('demonstrativos', demId)
    if (!dem) {
      throw new NotFoundError('Demonstrativo não encontrado.')
    }

    const dadosRaw = dem.getString('dados') || JSON.stringify(dem.get('dados'))
    const hashAtual = $security.sha256(dadosRaw)
    record.set('hash_conteudo', hashAtual)
    if (!record.getString('tipo_documento')) {
      record.set('tipo_documento', 'demonstrativo')
    }

    if (!record.getString('token_verificacao')) {
      const token =
        'RUMO-' +
        (record.getString('competencia') || 'DOC').replace('/', '') +
        '-' +
        $security.randomString(8).toUpperCase()
      record.set('token_verificacao', token)
    }
  }

  if (!record.getString('data_solicitacao')) {
    record.set('data_solicitacao', new Date().toISOString())
  }

  e.next()
}, 'assinaturas_demonstrativos')

// 2. Antes de atualizar a assinatura (ex: ação de assinar):
// Valida se o conteúdo do documento (demonstrativo ou contrato) não sofreu alterações desde a solicitação
onRecordUpdate((e) => {
  const record = e.record
  const origStatus = record.original().getString('status')
  const currentStatus = record.getString('status')

  // Se estiver concluindo a assinatura
  if (currentStatus === 'assinada' && origStatus !== 'assinada') {
    const contratoId = record.getString('contrato')
    const demId = record.getString('demonstrativo')

    if (contratoId) {
      const contrato = $app.findRecordById('contratos_honorarios', contratoId)
      if (!contrato) {
        throw new NotFoundError('Contrato vinculado não foi encontrado.')
      }

      const dadosRaw =
        contrato.getString('dados_congelados') || JSON.stringify(contrato.get('dados_congelados'))
      const hashAtual = $security.sha256(dadosRaw)
      const hashGravado = record.getString('hash_conteudo')

      if (hashGravado && hashAtual !== hashGravado) {
        throw new BadRequestError(
          'Contrato alterado após a solicitação de assinatura. A assinatura não pode ser concluída porque a integridade foi comprometida.',
        )
      }
    } else if (demId) {
      const dem = $app.findRecordById('demonstrativos', demId)
      if (!dem) {
        throw new NotFoundError('Demonstrativo vinculado não foi encontrado.')
      }

      const dadosRaw = dem.getString('dados') || JSON.stringify(dem.get('dados'))
      const hashAtual = $security.sha256(dadosRaw)
      const hashGravado = record.getString('hash_conteudo')

      if (hashGravado && hashAtual !== hashGravado) {
        throw new BadRequestError(
          'Demonstrativo alterado após a solicitação de assinatura. A assinatura não pode ser concluída porque a integridade foi comprometida.',
        )
      }
    }

    // Gravar timestamp e data de assinatura se ainda não preenchido
    if (!record.getString('data_assinatura')) {
      record.set('data_assinatura', new Date().toISOString())
    }
  }

  e.next()
}, 'assinaturas_demonstrativos')

// 3. Após concluir a assinatura com sucesso:
// Atualiza o status do demonstrativo para 'aprovado' ou do contrato para 'assinado'
onRecordAfterUpdateSuccess((e) => {
  try {
    const record = e.record
    const origStatus = record.original().getString('status')
    const currentStatus = record.getString('status')

    if (currentStatus === 'assinada' && origStatus !== 'assinada') {
      const contratoId = record.getString('contrato')
      if (contratoId) {
        const contrato = $app.findRecordById('contratos_honorarios', contratoId)
        if (contrato && contrato.getString('status') !== 'assinado') {
          contrato.set('status', 'assinado')
          $app.save(contrato)
        }
      }

      const demId = record.getString('demonstrativo')
      if (demId) {
        const dem = $app.findRecordById('demonstrativos', demId)
        if (dem && dem.getString('status') !== 'aprovado') {
          dem.set('status', 'aprovado')
          dem.set('data_aprovacao', new Date().toISOString())
          dem.set(
            'observacoes_cliente',
            'Aprovado via assinatura digital (' +
              record.getString('tipo_assinatura') +
              ') por ' +
              record.getString('assinante'),
          )
          $app.save(dem)
        }
      }
    }
  } catch (err) {
    console.log('[ASSINATURAS] Erro ao sincronizar status do documento assinado:', err)
  }
  e.next()
}, 'assinaturas_demonstrativos')

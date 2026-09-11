// Hook: assinaturas_validate.js
// Validação de integridade de hash e regras de negócio para assinaturas de demonstrativos.
// Ponto de extensão para integração com provedores ICP-Brasil (D4Sign, Clicksign, etc.)

// 1. Antes de criar a solicitação de assinatura:
// Garante o cálculo do hash SHA-256 do demonstrativo congelado e token de verificação pública
onRecordCreate((e) => {
  const record = e.record
  const demId = record.getString('demonstrativo')
  if (!demId) {
    throw new BadRequestError('Demonstrativo não informado para a assinatura.')
  }

  const dem = $app.findRecordById('demonstrativos', demId)
  if (!dem) {
    throw new NotFoundError('Demonstrativo não encontrado.')
  }

  // Obter o JSON de dados congelado
  const dadosRaw = dem.getString('dados') || JSON.stringify(dem.get('dados'))
  const hashAtual = $security.sha256(dadosRaw)

  // Grava o hash_conteudo garantindo integridade calculada pelo servidor
  record.set('hash_conteudo', hashAtual)

  // Gerar token de verificação se não enviado
  if (!record.getString('token_verificacao')) {
    const token =
      'RUMO-' +
      (record.getString('competencia') || 'DOC').replace('/', '') +
      '-' +
      $security.randomString(8).toUpperCase()
    record.set('token_verificacao', token)
  }

  if (!record.getString('data_solicitacao')) {
    record.set('data_solicitacao', new Date().toISOString())
  }

  e.next()
}, 'assinaturas_demonstrativos')

// 2. Antes de atualizar a assinatura (ex: ação de assinar):
// Valida se o conteúdo do demonstrativo não sofreu alterações desde a solicitação
onRecordUpdate((e) => {
  const record = e.record
  const origStatus = record.original().getString('status')
  const currentStatus = record.getString('status')

  // Se estiver concluindo a assinatura
  if (currentStatus === 'assinada' && origStatus !== 'assinada') {
    const demId = record.getString('demonstrativo')
    if (!demId) {
      throw new BadRequestError('Demonstrativo não vinculado à assinatura.')
    }

    const dem = $app.findRecordById('demonstrativos', demId)
    if (!dem) {
      throw new NotFoundError('Demonstrativo vinculado não foi encontrado.')
    }

    // Calcula novamente o hash do demonstrativo no momento da assinatura
    const dadosRaw = dem.getString('dados') || JSON.stringify(dem.get('dados'))
    const hashAtual = $security.sha256(dadosRaw)
    const hashGravado = record.getString('hash_conteudo')

    // Validação estrita de integridade
    if (hashAtual !== hashGravado) {
      throw new BadRequestError(
        'Demonstrativo alterado após a solicitação de assinatura. A assinatura não pode ser concluída porque a integridade foi comprometida.',
      )
    }

    // Gravar timestamp e data de assinatura se ainda não preenchido
    if (!record.getString('data_assinatura')) {
      record.set('data_assinatura', new Date().toISOString())
    }

    // PONTO DE EXTENSÃO PARA PROVEDOR EXTERNO ICP-BRASIL:
    // Se o tipo for 'icp_brasil' e houver integração configurada via secrets (ex: D4SIGN_API_TOKEN ou CLICKSIGN_API_TOKEN):
    // const d4signToken = $secrets.get('D4SIGN_API_TOKEN')
    // if (record.getString('tipo_assinatura') === 'icp_brasil') {
    //   if (!d4signToken) {
    //     throw new BadRequestError('Provedor ICP-Brasil não configurado no ambiente. Contate o administrador.')
    //   }
    //   // Exemplo de chamada ao provedor:
    //   // const res = $http.send({
    //   //   url: 'https://secure.d4sign.com.br/api/v1/documents/...',
    //   //   method: 'POST',
    //   //   headers: { 'tokenAPI': d4signToken, 'Content-Type': 'application/json' },
    //   //   body: JSON.stringify({ ... })
    //   // })
    // }
  }

  e.next()
}, 'assinaturas_demonstrativos')

// 3. Após concluir a assinatura com sucesso:
// Atualiza o status do demonstrativo para 'aprovado' e vincula o data_aprovacao
onRecordAfterUpdateSuccess((e) => {
  try {
    const record = e.record
    const origStatus = record.original().getString('status')
    const currentStatus = record.getString('status')

    if (currentStatus === 'assinada' && origStatus !== 'assinada') {
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
    console.log('[ASSINATURAS] Erro ao sincronizar aprovação no demonstrativo:', err)
  }
  e.next()
}, 'assinaturas_demonstrativos')

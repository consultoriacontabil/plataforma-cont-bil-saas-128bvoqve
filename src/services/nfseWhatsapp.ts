import pb from '@/lib/pocketbase/client'
import type {
  NfseConfigRecord,
  NfseSolicitacaoRecord,
  NfseNotaEmitidaRecord,
  Empresa,
  CertificadoDigitalRecord,
  Documento,
  ProvedorFiscalTipo,
  ProvedorAmbiente,
} from '@/types'
import { auditService } from './audit'
import { maskCnpj, maskCpf } from '@/lib/formatters'
import { FiscalAdapterFactory } from './fiscalAdapters'

export interface SalvarConfigInput {
  empresa_padrao?: string
  evolution_api_url?: string
  evolution_api_key?: string
  evolution_instance?: string
  modo_operacao: 'simulacao' | 'producao'
  auto_aprovar_alta_confianca: boolean
  provedor_fiscal?: ProvedorFiscalTipo
  provedor_ambiente?: ProvedorAmbiente
  govbr_client_id?: string
  govbr_client_secret?: string
  govbr_api_url?: string
  provedor_municipio_ibge?: string
  betha_usuario?: string
  betha_senha_token?: string
  betha_api_url?: string
  ginfes_usuario?: string
  ginfes_senha?: string
  ginfes_api_url?: string
  provedores_empresas_json?: Record<string, any>
  msg_saudacao?: string
  msg_recebimento?: string
  msg_aprovacao?: string
  msg_rejeicao?: string
  msg_nota_emitida?: string
  telefone_suporte?: string
  prazo_dias_cancelamento?: number
  ativo: boolean
}

export interface EmitirNfseInput {
  solicitacao_id?: string
  empresa_id: string
  tomador_nome: string
  tomador_documento: string
  tomador_email?: string
  tomador_endereco?: string
  descricao_servicos: string
  codigo_servico_municipal?: string
  valor_servicos: number
  aliquota_iss?: number
  iss_retido?: boolean
  criar_titulo_receber?: boolean
  data_vencimento_titulo?: string
  nota_substituida_id?: string
}

export interface CancelarNfseInput {
  nota_id: string
  codigo_cancelamento: string // '1', '2', '3', '4', '5', '9'
  motivo: string
  emitir_substituta?: boolean
  tratar_titulo_pago?: 'manter_estornado' | 'exigir_decisao'
}

export const nfseWhatsappService = {
  /**
   * Obtém a configuração de WhatsApp / NFS-e do tenant
   */
  async getConfig(tenantId: string): Promise<NfseConfigRecord | null> {
    try {
      const records = await pb.collection('nfse_config').getFullList<NfseConfigRecord>({
        filter: `tenant_id = "${tenantId}"`,
        expand: 'empresa_padrao',
      })
      if (records.length > 0) return records[0]

      // Criar configuração inicial padrão se não existir
      const defaultToken = 'rumo_wa_' + Math.random().toString(36).substring(2, 15)
      const novo = await pb.collection('nfse_config').create<NfseConfigRecord>({
        tenant_id: tenantId,
        webhook_token: defaultToken,
        modo_operacao: 'simulacao',
        provedor_fiscal: 'governacional',
        provedor_ambiente: 'producao',
        govbr_api_url: 'https://nfse.receita.fazenda.gov.br/portalnfse',
        auto_aprovar_alta_confianca: false,
        msg_saudacao:
          'Olá! Sou o assistente de Emissão Inteligente de NFS-e da Rumo Consultoria Contábil. Pode me enviar os dados da nota fiscal a emitir (Tomador, CNPJ/CPF, descrição do serviço e valor).',
        msg_recebimento:
          'Recebi seus dados com sucesso! 📝 Sua solicitação de NFS-e foi estruturada pela nossa IA e está na fila do Painel de Supervisão para conferência do contador responsável. Você receberá o PDF/XML assim que aprovada.',
        msg_aprovacao:
          'Ótima notícia! Sua solicitação de NFS-e foi aprovada pelo contador e está sendo enviada para o motor de emissão fiscal.',
        msg_rejeicao:
          'Olá. Sua solicitação de NFS-e precisou ser devolvida pelo contador com o seguinte apontamento: {{motivo}}. Por favor, responda com os dados corrigidos.',
        msg_nota_emitida:
          'Sua NFS-e Nº {{numero_nota}} foi emitida com sucesso! 🎉\nCódigo de Verificação: {{codigo_verificacao}}\nValor: R$ {{valor}}\n\nSegue o arquivo da nota fiscal para seus registros.',
        telefone_suporte: '',
        ativo: true,
      })
      return novo
    } catch (err) {
      console.error('Erro ao buscar config nfse:', err)
      return null
    }
  },

  /**
   * Atualiza as configurações de WhatsApp / NFS-e do tenant
   */
  async saveConfig(
    tenantId: string,
    configId: string,
    input: SalvarConfigInput,
    userId?: string,
  ): Promise<NfseConfigRecord> {
    const updated = await pb.collection('nfse_config').update<NfseConfigRecord>(configId, {
      ...input,
    })

    await auditService.log(
      tenantId,
      userId || 'system',
      'nfse_config_atualizada',
      'nfse_config',
      configId,
      JSON.stringify({
        modo: input.modo_operacao,
        provedor: input.provedor_fiscal,
        ativo: input.ativo,
      }),
    )

    return updated
  },

  /**
   * Lista as solicitações na fila de supervisão
   */
  async listSolicitacoes(tenantId: string, status?: string): Promise<NfseSolicitacaoRecord[]> {
    let filter = `tenant_id = "${tenantId}"`
    if (status && status !== 'todos') {
      filter += ` && status = "${status}"`
    }
    return pb.collection('nfse_solicitacoes').getFullList<NfseSolicitacaoRecord>({
      filter,
      sort: '-created',
      expand: 'empresa,revisado_por',
    })
  },

  /**
   * Lista histórico de notas emitidas
   */
  async listNotasEmitidas(
    tenantId: string,
    competencia?: string,
  ): Promise<NfseNotaEmitidaRecord[]> {
    let filter = `tenant_id = "${tenantId}"`
    if (competencia) {
      filter += ` && competencia = "${competencia}"`
    }
    return pb.collection('nfse_notas_emitidas').getFullList<NfseNotaEmitidaRecord>({
      filter,
      sort: '-created',
      expand:
        'empresa,solicitacao,certificado_usado,titulo_financeiro,emitido_por,cancelado_por,ged_documento_id,ged_cancelamento_doc_id,nota_substituta_id,nota_substituida_id',
    })
  },

  /**
   * Cancelamento oficial da NFS-e com o provedor fiscal correspondente
   * Executa integração com GED, baixa/cancelamento de Financeiro, aviso via WhatsApp e Auditoria
   */
  async cancelarNfse(
    tenantId: string,
    input: CancelarNfseInput,
    userId: string,
  ): Promise<{
    nota: NfseNotaEmitidaRecord
    mensagemSucesso: string
    tituloFinanceiroStatus?: 'baixado' | 'ja_pago_mantido' | 'sem_titulo'
  }> {
    const config = await this.getConfig(tenantId)

    // 1. Carregar nota original
    const nota = await pb
      .collection('nfse_notas_emitidas')
      .getOne<NfseNotaEmitidaRecord>(input.nota_id, {
        expand: 'empresa,titulo_financeiro',
      })

    if (!nota) {
      throw new Error('Nota fiscal não encontrada para cancelamento.')
    }

    if (nota.status === 'cancelada') {
      throw new Error(`A NFS-e Nº ${nota.numero_nota} já se encontra cancelada.`)
    }

    if (nota.tenant_id !== tenantId) {
      throw new Error('Acesso negado: nota pertence a outro tenant.')
    }

    // 2. Carregar empresa
    const empresa = await pb.collection('empresas').getOne<Empresa>(nota.empresa)

    // 3. Obter certificado digital vinculado à empresa se houver
    let certificadoRecord: CertificadoDigitalRecord | undefined
    try {
      const certs = await pb
        .collection('certificados_digitais')
        .getFullList<CertificadoDigitalRecord>({
          filter: `empresa = "${empresa.id}" && status = "ativo"`,
          sort: '-validade',
        })
      if (certs.length > 0) {
        certificadoRecord = certs[0]
      }
    } catch {
      /* sem certificado */
    }

    // 4. Resolver o adapter fiscal da empresa
    const empConfig = config?.provedores_empresas_json?.[empresa.id]
    const adapter = FiscalAdapterFactory.resolveAdapterForEmpresa(empresa.id, config)

    const ambienteEmissao = (empConfig?.ambiente || config?.provedor_ambiente || 'producao') as
      | 'producao'
      | 'homologacao'
    const municipioIbge =
      empConfig?.municipioIbge ||
      config?.provedor_municipio_ibge ||
      (empresa.uf === 'PR' ? '4106902' : '3550308')

    let apiUrl = empConfig?.apiUrl
    let clientId = empConfig?.clientId || config?.govbr_client_id
    let clientSecret = empConfig?.clientSecret || config?.govbr_client_secret
    let usuario = empConfig?.usuario
    let senhaToken = empConfig?.senhaToken
    let senha = empConfig?.senha

    if (adapter.id === 'governacional') {
      apiUrl = apiUrl || config?.govbr_api_url || 'https://nfse.receita.fazenda.gov.br/portalnfse'
    } else if (adapter.id === 'betha') {
      apiUrl =
        apiUrl ||
        config?.betha_api_url ||
        'https://e-gov.betha.com.br/e-nota-contribuinte-ws/nfseWS'
      usuario = usuario || config?.betha_usuario
      senhaToken = senhaToken || config?.betha_senha_token
    } else if (adapter.id === 'ginfes') {
      apiUrl =
        apiUrl || config?.ginfes_api_url || 'https://homologacao.ginfes.com.br/ServiceGinfesImpl'
      usuario = usuario || config?.ginfes_usuario
      senha = senha || config?.ginfes_senha
    }

    // 5. Chamar o Adapter Fiscal para cancelamento
    const resultadoCancelamento = await adapter.cancelar({
      numeroNota: nota.numero_nota,
      codigoVerificacao: nota.codigo_verificacao,
      chaveAcesso: nota.chave_acesso,
      cnpjPrestador: empresa.cnpj,
      inscricaoMunicipal: empresa.inscricao_municipal,
      codigoIbge: municipioIbge,
      codigoCancelamento: input.codigo_cancelamento,
      motivo: input.motivo,
      ambiente: ambienteEmissao,
      certificado: certificadoRecord,
      credenciais: {
        clientId,
        clientSecret,
        apiUrl,
        municipioIbge,
        usuario,
        senhaToken,
        senha,
      },
    })

    if (!resultadoCancelamento.sucesso) {
      // Registrar falha de cancelamento na auditoria
      await auditService.log(
        tenantId,
        userId,
        'nfse_cancelamento_rejeitado',
        'nfse_notas_emitidas',
        nota.id,
        JSON.stringify({
          provedor: adapter.id,
          erro: resultadoCancelamento.mensagemRetorno,
          detalhe: resultadoCancelamento.erroRejeicao,
        }),
      )

      throw new Error(
        `O provedor fiscal (${adapter.nome}) rejeitou o cancelamento: ${resultadoCancelamento.mensagemRetorno}`,
      )
    }

    const agoraIso = new Date().toISOString()

    // 6. Arquivar XML de Cancelamento no GED (coleção documentos)
    let gedCancDocId: string | undefined
    try {
      const gedCol = pb.collection('documentos')
      const docGed = await gedCol.create<Documento>({
        tenant_id: tenantId,
        empresa_id: empresa.id,
        tipo: 'outro',
        nome_arquivo: `Cancelamento_NFSe_${nota.numero_nota}_${empresa.cnpj.replace(/\D/g, '')}.xml`,
        data_upload: agoraIso,
        usuario_upload_id: userId,
        status: 'processado',
        observacoes: `Termo/XML de Cancelamento da NFS-e Nº ${nota.numero_nota} (${adapter.nome}). Motivo: ${input.motivo}. Protocolo: ${resultadoCancelamento.protocoloCancelamento || 'Simulado'}`,
      })
      gedCancDocId = docGed.id
    } catch (errGed) {
      console.warn('Aviso: falha ao arquivar XML de cancelamento no GED:', errGed)
    }

    // 7. Integração Financeira: Baixar / Cancelar Título a Receber vinculado
    let tituloFinanceiroStatus: 'baixado' | 'ja_pago_mantido' | 'sem_titulo' = 'sem_titulo'
    if (nota.titulo_financeiro) {
      try {
        const tituloCol = pb.collection('contas_financeiras')
        const titulo = await tituloCol.getOne(nota.titulo_financeiro)
        if (titulo) {
          if (titulo.status === 'pago') {
            // Título já estava pago: avisar e preservar registro ou estornar com marcação
            tituloFinanceiroStatus = 'ja_pago_mantido'
            await tituloCol.update(nota.titulo_financeiro, {
              observacoes:
                `${titulo.observacoes || ''} [ATENÇÃO: NFS-e Nº ${nota.numero_nota} foi CANCELADA em ${agoraIso.slice(0, 10)}. Como o título já constava como PAGO, verificar estorno manual ou nota de crédito ao cliente.]`.trim(),
            })
          } else {
            // Título pendente/vencido: cancelar automaticamente
            await tituloCol.update(nota.titulo_financeiro, {
              status: 'cancelado',
              observacoes:
                `${titulo.observacoes || ''} [Cancelado automaticamente devido ao cancelamento da NFS-e Nº ${nota.numero_nota} em ${agoraIso.slice(0, 10)} - Motivo: ${input.motivo}]`.trim(),
            })
            tituloFinanceiroStatus = 'baixado'
          }
        }
      } catch (errFin) {
        console.warn('Aviso ao sincronizar título financeiro no cancelamento:', errFin)
      }
    }

    // 8. Atualizar registro da NFS-e para cancelada
    const notaAtualizada = await pb
      .collection('nfse_notas_emitidas')
      .update<NfseNotaEmitidaRecord>(nota.id, {
        status: 'cancelada',
        motivo_cancelamento: input.motivo,
        codigo_cancelamento: input.codigo_cancelamento,
        data_cancelamento: agoraIso,
        cancelado_por: userId,
        protocolo_cancelamento: resultadoCancelamento.protocoloCancelamento || '',
        xml_cancelamento: resultadoCancelamento.xmlCancelamento || '',
        ged_cancelamento_doc_id: gedCancDocId || null,
      })

    // 9. Notificação ao Cliente via WhatsApp (Etapa 8 do Framework)
    const destinatarioWa = nota.whatsapp_destinatario || ''
    const msgWaCancelamento = `Comunicado Fiscal: A NFS-e Nº ${nota.numero_nota} (Cód. Verif: ${nota.codigo_verificacao}) emitida pela empresa ${empresa.razao_social} foi cancelada.\nMotivo registrado: ${input.motivo}.\nProtocolo de Cancelamento: ${resultadoCancelamento.protocoloCancelamento || 'Homologado'}.`

    if (nota.solicitacao) {
      try {
        const sol = await pb
          .collection('nfse_solicitacoes')
          .getOne<NfseSolicitacaoRecord>(nota.solicitacao)
        const hist = sol.historico_mensagens_json ? [...sol.historico_mensagens_json] : []
        hist.push({
          origem: 'escritorio_bot',
          texto: msgWaCancelamento,
          data: agoraIso,
        })
        await pb.collection('nfse_solicitacoes').update(nota.solicitacao, {
          status: 'cancelada',
          historico_mensagens_json: hist,
        })
        await pb.send('/backend/v1/nfse/enviar-whatsapp', {
          method: 'POST',
          body: {
            solicitacao_id: nota.solicitacao,
            mensagem: msgWaCancelamento,
          },
        })
      } catch (errWa) {
        console.warn('Aviso: envio WhatsApp de cancelamento via backend:', errWa)
      }
    }

    // 10. Trilha de Auditoria Completa
    await auditService.log(
      tenantId,
      userId,
      'nfse_cancelada',
      'nfse_notas_emitidas',
      nota.id,
      JSON.stringify({
        numero: nota.numero_nota,
        empresa: empresa.razao_social,
        provedor: adapter.id,
        codigo_cancelamento: input.codigo_cancelamento,
        motivo: input.motivo,
        protocolo: resultadoCancelamento.protocoloCancelamento,
        titulo_financeiro_status: tituloFinanceiroStatus,
        ged_doc_id: gedCancDocId,
      }),
    )

    return {
      nota: notaAtualizada,
      mensagemSucesso: resultadoCancelamento.mensagemRetorno,
      tituloFinanceiroStatus,
    }
  },

  /**
   * Rejeita solicitação de NFS-e informando motivo (Etapa 8 - volta ao WhatsApp)
   */
  async rejeitarSolicitacao(
    tenantId: string,
    solicitacaoId: string,
    motivo: string,
    userId: string,
  ): Promise<NfseSolicitacaoRecord> {
    const sol = await pb
      .collection('nfse_solicitacoes')
      .getOne<NfseSolicitacaoRecord>(solicitacaoId)
    const agora = new Date().toISOString()

    const historico = sol.historico_mensagens_json ? [...sol.historico_mensagens_json] : []
    const config = await this.getConfig(tenantId)
    const templateRejeicao =
      config?.msg_rejeicao ||
      'Olá. Sua solicitação de NFS-e precisou ser devolvida pelo contador com o seguinte apontamento: {{motivo}}. Por favor, responda com os dados corrigidos.'
    const textoMensagem = templateRejeicao.replace('{{motivo}}', motivo)

    historico.push({
      origem: 'escritorio_bot',
      texto: textoMensagem,
      data: agora,
    })

    const updated = await pb
      .collection('nfse_solicitacoes')
      .update<NfseSolicitacaoRecord>(solicitacaoId, {
        status: 'rejeitada',
        motivo_rejeicao: motivo,
        revisado_por: userId,
        data_revisao: agora,
        historico_mensagens_json: historico,
      })

    // Enviar mensagem real/registrada ao WhatsApp através do backend
    try {
      await pb.send('/backend/v1/nfse/enviar-whatsapp', {
        method: 'POST',
        body: {
          solicitacao_id: solicitacaoId,
          mensagem: textoMensagem,
        },
      })
    } catch {
      /* fallback gracioso em simulação */
    }

    await auditService.log(
      tenantId,
      userId,
      'nfse_solicitacao_rejeitada',
      'nfse_solicitacoes',
      solicitacaoId,
      JSON.stringify({ motivo }),
    )

    return updated
  },

  /**
   * Atualiza dados editados da solicitação antes de emitir
   */
  async updateSolicitacao(
    solicitacaoId: string,
    data: Partial<NfseSolicitacaoRecord>,
  ): Promise<NfseSolicitacaoRecord> {
    return pb.collection('nfse_solicitacoes').update<NfseSolicitacaoRecord>(solicitacaoId, data)
  },

  /**
   * Emissão da NFS-e via ADAPTER FISCAL (Gov.br / Emissor Nacional com fallback para Simulação Controlada)
   * Etapas 5, 6, 7 e 8 da arquitetura completa
   */
  async emitirNfse(
    tenantId: string,
    input: EmitirNfseInput,
    userId: string,
  ): Promise<NfseNotaEmitidaRecord> {
    const config = await this.getConfig(tenantId)

    // 1. Obter dados da empresa prestadora (emitente)
    const empresa = await pb.collection('empresas').getOne<Empresa>(input.empresa_id)

    // 2. Obter certificado digital vinculado à empresa
    let certificadoRecord: CertificadoDigitalRecord | undefined
    let certificadoId: string | undefined
    try {
      const certs = await pb
        .collection('certificados_digitais')
        .getFullList<CertificadoDigitalRecord>({
          filter: `empresa = "${empresa.id}" && status = "ativo"`,
          sort: '-validade',
        })
      if (certs.length > 0) {
        certificadoRecord = certs[0]
        certificadoId = certs[0].id
      }
    } catch {
      /* sem certificado */
    }

    // 3. Gerar próximo número sequencial de nota para esta empresa
    const todasNotasEmpresa = await pb
      .collection('nfse_notas_emitidas')
      .getFullList<NfseNotaEmitidaRecord>({
        filter: `tenant_id = "${tenantId}" && empresa = "${empresa.id}"`,
        sort: '-numero_nota',
        fields: 'numero_nota',
      })

    const proximoNumero =
      todasNotasEmpresa.length > 0 && todasNotasEmpresa[0].numero_nota
        ? todasNotasEmpresa[0].numero_nota + 1
        : 2026001

    const agora = new Date()
    const ano = agora.getFullYear()
    const mes = String(agora.getMonth() + 1).padStart(2, '0')
    const competencia = `${ano}-${mes}`

    // 4. Alíquotas e tributos
    const aliquotaIss = input.aliquota_iss !== undefined ? input.aliquota_iss : 2.0
    const valorServicos = input.valor_servicos
    const valorIss = Number(((valorServicos * aliquotaIss) / 100).toFixed(2))

    let valorPis = 0
    let valorCofins = 0
    let valorIr = 0
    let valorCsll = 0

    if (
      empresa.regime_tributario === 'lucro_presumido' ||
      empresa.regime_tributario === 'lucro_real'
    ) {
      valorPis = Number((valorServicos * 0.0065).toFixed(2))
      valorCofins = Number((valorServicos * 0.03).toFixed(2))
      valorIr = Number((valorServicos * 0.015).toFixed(2))
      valorCsll = Number((valorServicos * 0.01).toFixed(2))
    }

    const valorLiquido = Number(
      (
        valorServicos -
        valorIr -
        valorPis -
        valorCofins -
        valorCsll -
        (input.iss_retido ? valorIss : 0)
      ).toFixed(2),
    )

    // 5. SELEÇÃO DO ADAPTER FISCAL (por empresa ou global do tenant)
    const empConfig = config?.provedores_empresas_json?.[empresa.id]
    const adapter = FiscalAdapterFactory.resolveAdapterForEmpresa(empresa.id, config)

    // Resolver ambiente, credenciais e endpoint específicos da empresa ou globais
    const ambienteEmissao = (empConfig?.ambiente || config?.provedor_ambiente || 'producao') as
      | 'producao'
      | 'homologacao'
    const municipioIbge =
      empConfig?.municipioIbge ||
      config?.provedor_municipio_ibge ||
      (empresa.uf === 'PR' ? '4106902' : '3550308')

    // Resolver credenciais conforme o adapter escolhido
    let apiUrl = empConfig?.apiUrl
    let clientId = empConfig?.clientId || config?.govbr_client_id
    let clientSecret = empConfig?.clientSecret || config?.govbr_client_secret
    let usuario = empConfig?.usuario
    let senhaToken = empConfig?.senhaToken
    let senha = empConfig?.senha

    if (adapter.id === 'governacional') {
      apiUrl = apiUrl || config?.govbr_api_url || 'https://nfse.receita.fazenda.gov.br/portalnfse'
    } else if (adapter.id === 'betha') {
      apiUrl =
        apiUrl ||
        config?.betha_api_url ||
        'https://e-gov.betha.com.br/e-nota-contribuinte-ws/nfseWS'
      usuario = usuario || config?.betha_usuario
      senhaToken = senhaToken || config?.betha_senha_token
    } else if (adapter.id === 'ginfes') {
      apiUrl =
        apiUrl || config?.ginfes_api_url || 'https://homologacao.ginfes.com.br/ServiceGinfesImpl'
      usuario = usuario || config?.ginfes_usuario
      senha = senha || config?.ginfes_senha
    }

    const payloadAdapter = {
      numero: proximoNumero,
      serie: 'E',
      competencia,
      dataEmissao: agora.toISOString(),
      prestador: {
        cnpj: empresa.cnpj,
        razaoSocial: empresa.razao_social,
        nomeFantasia: empresa.nome_fantasia || empresa.razao_social,
        inscricaoMunicipal: empresa.inscricao_municipal || 'ISENTO',
        logradouro: empresa.logradouro || 'Avenida Central',
        numero: empresa.numero || '100',
        bairro: empresa.bairro || 'Centro',
        cidade: empresa.cidade || 'São Paulo',
        uf: empresa.uf || 'SP',
        cep: empresa.cep || '01000-000',
        codigoIbge: municipioIbge,
        telefone: empresa.telefone || '',
        email: empresa.email || '',
      },
      tomador: {
        documento: input.tomador_documento,
        nome: input.tomador_nome,
        email: input.tomador_email || '',
        endereco: input.tomador_endereco || 'Logradouro do Tomador',
      },
      servico: {
        codigo: input.codigo_servico_municipal || '01.07',
        discriminacao: input.descricao_servicos,
        valorServicos,
        valorIss,
        aliquotaIss,
        issRetido: !!input.iss_retido,
        valorLiquido,
        valorPis,
        valorCofins,
        valorIr,
        valorCsll,
      },
      ambiente: ambienteEmissao,
      certificado: certificadoRecord,
      credenciais: {
        clientId,
        clientSecret,
        apiUrl,
        municipioIbge,
        usuario,
        senhaToken,
        senha,
      },
    }

    // 6. Chamada ao Adapter Fiscal
    const resultadoEmissao = await adapter.emitir(payloadAdapter)

    // SE O PROVEDOR DEVOLVER ERRO (REJEIÇÃO):
    // Manter a solicitação na fila com status 'erro_emissao', registrar o motivo e permitir retentativa — NUNCA PERDER A SOLICITAÇÃO!
    if (!resultadoEmissao.sucesso) {
      if (input.solicitacao_id) {
        try {
          const sol = await pb
            .collection('nfse_solicitacoes')
            .getOne<NfseSolicitacaoRecord>(input.solicitacao_id)
          const tentativas = (sol.tentativas_emissao || 0) + 1
          const historico = sol.historico_mensagens_json ? [...sol.historico_mensagens_json] : []
          historico.push({
            origem: 'escritorio_bot',
            texto: `[Falha de Emissão Fiscal no provedor ${adapter.nome}]: ${resultadoEmissao.mensagemRetorno}. A solicitação permanece na fila aguardando retentativa ou ajuste de credenciais.`,
            data: agora.toISOString(),
          })

          await pb.collection('nfse_solicitacoes').update(input.solicitacao_id, {
            status: 'erro_emissao',
            ultimo_erro_emissao: resultadoEmissao.mensagemRetorno,
            tentativas_emissao: tentativas,
            revisado_por: userId,
            data_revisao: agora.toISOString(),
            historico_mensagens_json: historico,
          })
        } catch (errUpd) {
          console.error('Erro ao atualizar solicitação com erro:', errUpd)
        }
      }

      // Auditoria da rejeição
      await auditService.log(
        tenantId,
        userId,
        'nfse_rejeitada_provedor',
        'nfse_solicitacoes',
        input.solicitacao_id || 'manual',
        JSON.stringify({
          provedor: adapter.id,
          erro: resultadoEmissao.mensagemRetorno,
          detalhe: resultadoEmissao.erroRejeicao,
        }),
      )

      throw new Error(
        `O provedor fiscal (${adapter.nome}) rejeitou a emissão: ${resultadoEmissao.mensagemRetorno}. A solicitação foi mantida na fila com status "erro_emissao" para retentativa.`,
      )
    }

    // 7. SUCESSO NA EMISSÃO:
    const codigoVerificacao = resultadoEmissao.codigoVerificacao
    const chaveAcesso =
      resultadoEmissao.chaveAcesso ||
      `35${ano % 100}${mes}${empresa.cnpj.replace(/\D/g, '').padEnd(14, '0')}56001${String(proximoNumero).padStart(9, '0')}`
    const xmlConteudo = resultadoEmissao.xmlAssinado

    // 8. Opcional: Criar Título a Receber no Financeiro
    let tituloFinanceiroId: string | undefined
    if (input.criar_titulo_receber) {
      try {
        const contasFinCol = pb.collection('contas_financeiras')
        const dataVenc =
          input.data_vencimento_titulo ||
          new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        const dataEmissaoStr = agora.toISOString().split('T')[0]

        const titulo = await contasFinCol.create({
          tenant_id: tenantId,
          empresa: empresa.id,
          tipo: 'receber',
          pessoa: input.tomador_nome,
          descricao: `NFS-e Nº ${proximoNumero} (${adapter.nome}) - ${input.descricao_servicos.slice(0, 50)}`,
          documento_ref: `NFSE-${proximoNumero}`,
          valor: valorLiquido,
          data_emissao: dataEmissaoStr,
          data_vencimento: dataVenc,
          status: 'pendente',
          observacoes: `Gerado automaticamente pela Emissão de NFS-e (Provedor: ${adapter.nome}, Cod. Verificação: ${codigoVerificacao})`,
        })
        tituloFinanceiroId = titulo.id
      } catch (errTitulo) {
        console.error('Aviso: falha ao gerar título a receber automático:', errTitulo)
      }
    }

    // 9. Guardar DANFSE / XML no GED da empresa (coleção documentos)
    let gedDocId: string | undefined
    try {
      const gedCol = pb.collection('documentos')
      const docGed = await gedCol.create<Documento>({
        tenant_id: tenantId,
        empresa_id: empresa.id,
        tipo: 'nota_fiscal',
        nome_arquivo: `NFSe_${proximoNumero}_${empresa.cnpj.replace(/\D/g, '')}.xml`,
        data_upload: agora.toISOString(),
        usuario_upload_id: userId,
        status: 'processado',
        observacoes: `NFS-e Nº ${proximoNumero} emitida via WhatsApp pelo provedor ${adapter.nome}. Cod. Verificação: ${codigoVerificacao}`,
      })
      gedDocId = docGed.id
    } catch (errGed) {
      console.warn('Aviso: não foi possível arquivar no GED da empresa:', errGed)
    }

    // 10. Criar Registro em nfse_notas_emitidas
    const nota = await pb.collection('nfse_notas_emitidas').create<NfseNotaEmitidaRecord>({
      tenant_id: tenantId,
      empresa: empresa.id,
      solicitacao: input.solicitacao_id || null,
      numero_nota: proximoNumero,
      serie: 'E',
      codigo_verificacao: codigoVerificacao,
      chave_acesso: chaveAcesso,
      data_emissao: agora.toISOString(),
      competencia,
      tomador_nome: input.tomador_nome,
      tomador_documento: input.tomador_documento,
      tomador_email: input.tomador_email || '',
      discriminacao_servicos: input.descricao_servicos,
      codigo_servico_municipal: input.codigo_servico_municipal || '01.07',
      valor_servicos: valorServicos,
      valor_deducoes: 0,
      valor_pis: valorPis,
      valor_cofins: valorCofins,
      valor_inss: 0,
      valor_ir: valorIr,
      valor_csll: valorCsll,
      valor_iss: valorIss,
      aliquota_iss: aliquotaIss,
      valor_liquido: valorLiquido,
      iss_retido: !!input.iss_retido,
      status: 'emitida',
      modo_emissao:
        resultadoEmissao.modo === 'governacional_real'
          ? 'nacional_gov'
          : resultadoEmissao.modo === 'betha_real' || resultadoEmissao.modo === 'ginfes_real'
            ? 'prefeitura_ws'
            : 'simulacao',
      provedor_usado: adapter.id,
      url_consulta_nfse: resultadoEmissao.urlConsulta,
      protocolo_autorizacao: resultadoEmissao.protocoloAutorizacao,
      ged_documento_id: gedDocId || null,
      certificado_usado: certificadoId || null,
      xml_conteudo: xmlConteudo,
      titulo_financeiro: tituloFinanceiroId || null,
      emitido_por: userId,
      nota_substituida_id: input.nota_substituida_id || null,
      whatsapp_destinatario: '',
      whatsapp_enviado_em: null,
    })

    // Se é substituição de uma nota anterior, marcar na nota substituída seu novo status e vínculo
    if (input.nota_substituida_id) {
      try {
        await pb.collection('nfse_notas_emitidas').update(input.nota_substituida_id, {
          status: 'substituida',
          nota_substituta_id: nota.id,
        })
      } catch (errVinculo) {
        console.warn('Aviso ao vincular nota substituta na original:', errVinculo)
      }
    }

    // 11. Se veio de uma solicitação na fila, atualizar seu status e histórico
    if (input.solicitacao_id) {
      try {
        const sol = await pb
          .collection('nfse_solicitacoes')
          .getOne<NfseSolicitacaoRecord>(input.solicitacao_id)
        const hist = sol.historico_mensagens_json ? [...sol.historico_mensagens_json] : []
        const templateEmitida =
          config?.msg_nota_emitida ||
          'Sua NFS-e Nº {{numero_nota}} foi emitida com sucesso! 🎉\nCódigo de Verificação: {{codigo_verificacao}}\nValor: R$ {{valor}}\n\nSegue o arquivo da nota fiscal para seus registros.'
        let msgTexto = templateEmitida
          .replace('{{numero_nota}}', String(proximoNumero))
          .replace('{{codigo_verificacao}}', codigoVerificacao)
          .replace('{{valor}}', valorServicos.toFixed(2))

        if (resultadoEmissao.urlConsulta) {
          msgTexto += `\n\nLink de Consulta Oficial: ${resultadoEmissao.urlConsulta}`
        }

        hist.push({
          origem: 'escritorio_bot',
          texto: msgTexto,
          data: agora.toISOString(),
        })

        await pb.collection('nfse_solicitacoes').update(input.solicitacao_id, {
          status: 'emitida',
          revisado_por: userId,
          data_revisao: agora.toISOString(),
          ultimo_erro_emissao: '',
          historico_mensagens_json: hist,
        })

        // Enviar confirmação de entrega ao WhatsApp via backend
        await pb.send('/backend/v1/nfse/enviar-whatsapp', {
          method: 'POST',
          body: {
            solicitacao_id: input.solicitacao_id,
            mensagem: msgTexto,
          },
        })
      } catch (errSolUpdate) {
        console.error('Aviso ao atualizar solicitação vinculada:', errSolUpdate)
      }
    }

    // 12. Auditoria detalhada da emissão real ou simulada
    await auditService.log(
      tenantId,
      userId,
      'nfse_emitida',
      'nfse_notas_emitidas',
      nota.id,
      JSON.stringify({
        numero: proximoNumero,
        tomador: input.tomador_nome,
        valor: valorServicos,
        modo: resultadoEmissao.modo,
        provedor: adapter.id,
        protocolo: resultadoEmissao.protocoloAutorizacao,
        certificado: certificadoId || 'nenhum',
      }),
    )

    return nota
  },

  /**
   * Envia uma mensagem personalizada de chat/bot para o contato da solicitação
   */
  async enviarMensagemWhatsApp(solicitacaoId: string, mensagem: string): Promise<boolean> {
    try {
      await pb.send('/backend/v1/nfse/enviar-whatsapp', {
        method: 'POST',
        body: {
          solicitacao_id: solicitacaoId,
          mensagem,
        },
      })
      return true
    } catch (err) {
      console.error('Erro ao enviar mensagem WhatsApp:', err)
      return false
    }
  },

  /**
   * Testar conexão com a Evolution API (validação honesta de credenciais)
   */
  async testarConexaoEvolution(
    url: string,
    key: string,
    instance: string,
  ): Promise<{ sucesso: boolean; mensagem: string; detalhe?: string }> {
    if (!url || !key || !instance) {
      return {
        sucesso: false,
        mensagem: 'Informe URL base, Chave de API e Nome da Instância para testar a conexão.',
      }
    }

    try {
      const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url
      const res = await fetch(
        `${cleanUrl}/instance/connectionState/${encodeURIComponent(instance)}`,
        {
          method: 'GET',
          headers: {
            apikey: key,
          },
        },
      )

      if (res.ok) {
        const data = await res.json()
        return {
          sucesso: true,
          mensagem: `Instância "${instance}" conectada com sucesso ao servidor Evolution API!`,
          detalhe: JSON.stringify(data),
        }
      } else {
        return {
          sucesso: false,
          mensagem: `Servidor Evolution API respondeu com status ${res.status}. Verifique se a instância "${instance}" está ativa e a API Key está correta.`,
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      return {
        sucesso: false,
        mensagem:
          'Não foi possível alcançar o servidor Evolution API informado. Certifique-se de que o host está online e acessível publicamente (HTTPS).',
        detalhe: errMsg,
      }
    }
  },

  /**
   * Testar conexão com o Provedor Fiscal selecionado (Gov.br Emissor Nacional / Betha / Ginfes)
   */
  async testarConexaoProvedor(params: {
    tenantId: string
    provedor: ProvedorFiscalTipo
    apiUrl?: string
    clientId?: string
    clientSecret?: string
    usuario?: string
    senhaToken?: string
    senha?: string
    municipioIbge?: string
    empresaId?: string
  }): Promise<{ sucesso: boolean; mensagem: string; statusCode?: number; detalhe?: string }> {
    const adapter = FiscalAdapterFactory.getAdapter(params.provedor)
    return adapter.testarConexao({
      apiUrl: params.apiUrl,
      clientId: params.clientId,
      clientSecret: params.clientSecret,
      usuario: params.usuario,
      senhaToken: params.senhaToken,
      senha: params.senha,
      municipioIbge: params.municipioIbge,
      empresaId: params.empresaId,
      tenantId: params.tenantId,
    })
  },
}

// ==========================================
// Gerador de XML de NFS-e (Layout Padrão Nacional / ABRASF)
// ==========================================
export function gerarXmlNfse(params: {
  numero: number
  codigoVerificacao: string
  dataEmissao: string
  competencia: string
  prestador: {
    cnpj: string
    razaoSocial: string
    nomeFantasia: string
    inscricaoMunicipal: string
    logradouro: string
    numero: string
    bairro: string
    cidade: string
    uf: string
    cep: string
    telefone: string
    email: string
  }
  tomador: {
    documento: string
    nome: string
    email: string
    endereco: string
  }
  servico: {
    codigo: string
    discriminacao: string
    valorServicos: number
    valorIss: number
    aliquotaIss: number
    issRetido: boolean
    valorLiquido: number
    valorPis: number
    valorCofins: number
    valorIr: number
    valorCsll: number
  }
}): string {
  const p = params
  const cleanDoc = p.tomador.documento.replace(/\D/g, '')
  const tagDoc = cleanDoc.length === 11 ? `<Cpf>${cleanDoc}</Cpf>` : `<Cnpj>${cleanDoc}</Cnpj>`

  return `<?xml version="1.0" encoding="UTF-8"?>
<CompNfse xmlns="http://www.abrasf.org.br/nfse.xsd">
  <Nfse versao="2.04">
    <InfNfse Id="NFE${p.numero}">
      <Numero>${p.numero}</Numero>
      <CodigoVerificacao>${p.codigoVerificacao}</CodigoVerificacao>
      <DataEmissao>${p.dataEmissao}</DataEmissao>
      <NaturezaOperacao>1</NaturezaOperacao>
      <RegimeEspecialTributacao>6</RegimeEspecialTributacao>
      <OptanteSimplesNacional>1</OptanteSimplesNacional>
      <IncentivadorCultural>2</IncentivadorCultural>
      <Competencia>${p.competencia}-01</Competencia>
      <PrestadorServico>
        <IdentificacaoPrestador>
          <Cnpj>${p.prestador.cnpj.replace(/\D/g, '')}</Cnpj>
          <InscricaoMunicipal>${p.prestador.inscricaoMunicipal}</InscricaoMunicipal>
        </IdentificacaoPrestador>
        <RazaoSocial>${escapeXml(p.prestador.razaoSocial)}</RazaoSocial>
        <NomeFantasia>${escapeXml(p.prestador.nomeFantasia)}</NomeFantasia>
        <Endereco>
          <Endereco>${escapeXml(p.prestador.logradouro)}</Endereco>
          <Numero>${escapeXml(p.prestador.numero)}</Numero>
          <Bairro>${escapeXml(p.prestador.bairro)}</Bairro>
          <CodigoMunicipio>3550308</CodigoMunicipio>
          <Uf>${p.prestador.uf}</Uf>
          <Cep>${p.prestador.cep.replace(/\D/g, '')}</Cep>
        </Endereco>
        <Contato>
          <Telefone>${p.prestador.telefone.replace(/\D/g, '')}</Telefone>
          <Email>${escapeXml(p.prestador.email)}</Email>
        </Contato>
      </PrestadorServico>
      <TomadorServico>
        <IdentificacaoTomador>
          <CpfCnpj>
            ${tagDoc}
          </CpfCnpj>
        </IdentificacaoTomador>
        <RazaoSocial>${escapeXml(p.tomador.nome)}</RazaoSocial>
        <Endereco>
          <Endereco>${escapeXml(p.tomador.endereco)}</Endereco>
        </Endereco>
        <Contato>
          <Email>${escapeXml(p.tomador.email)}</Email>
        </Contato>
      </TomadorServico>
      <Servico>
        <Valores>
          <ValorServicos>${p.servico.valorServicos.toFixed(2)}</ValorServicos>
          <ValorDeducoes>0.00</ValorDeducoes>
          <ValorPis>${p.servico.valorPis.toFixed(2)}</ValorPis>
          <ValorCofins>${p.servico.valorCofins.toFixed(2)}</ValorCofins>
          <ValorInss>0.00</ValorInss>
          <ValorIr>${p.servico.valorIr.toFixed(2)}</ValorIr>
          <ValorCsll>${p.servico.valorCsll.toFixed(2)}</ValorCsll>
          <IssRetido>${p.servico.issRetido ? 1 : 2}</IssRetido>
          <ValorIss>${p.servico.valorIss.toFixed(2)}</ValorIss>
          <Aliquota>${(p.servico.aliquotaIss / 100).toFixed(4)}</Aliquota>
          <ValorLiquidoNfse>${p.servico.valorLiquido.toFixed(2)}</ValorLiquidoNfse>
        </Valores>
        <ItemListaServico>${p.servico.codigo}</ItemListaServico>
        <Discriminacao>${escapeXml(p.servico.discriminacao)}</Discriminacao>
        <CodigoMunicipio>3550308</CodigoMunicipio>
      </Servico>
    </InfNfse>
  </Nfse>
</CompNfse>`
}

function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ==========================================
// Gerador de DANFSE em HTML para visualização e impressão em PDF
// ==========================================
export function gerarDanfseHtml(nota: NfseNotaEmitidaRecord, empresa?: Empresa): string {
  const formatMoeda = (val?: number) =>
    (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const prestadorNome = empresa?.razao_social || 'Prestador do Serviço'
  const prestadorFantasia = empresa?.nome_fantasia || ''
  const prestadorCnpj = empresa?.cnpj ? maskCnpj(empresa.cnpj) : '—'
  const prestadorIM = empresa?.inscricao_municipal || '—'
  const prestadorEnd = empresa
    ? `${empresa.logradouro || ''}, ${empresa.numero || ''} ${empresa.complemento || ''} - ${empresa.bairro || ''}, ${empresa.cidade || ''}/${empresa.uf || ''} - CEP ${empresa.cep || ''}`
    : '—'

  const tomadorDocFormatado =
    nota.tomador_documento.replace(/\D/g, '').length === 11
      ? maskCpf(nota.tomador_documento)
      : maskCnpj(nota.tomador_documento)

  const dataEmissaoFormatada = new Date(nota.data_emissao).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const isGovReal = nota.modo_emissao === 'nacional_gov'

  let marcaDaguaHtml = ''
  if (nota.status === 'cancelada') {
    marcaDaguaHtml = `
      <div style="position:fixed; top:35%; left:10%; right:10%; transform:rotate(-28deg); text-align:center; pointer-events:none; z-index:9999;">
        <div style="display:inline-block; font-size:75px; color:rgba(220,38,38,0.22); font-weight:900; border:6px solid rgba(220,38,38,0.22); padding:10px 40px; border-radius:12px; letter-spacing:4px;">
          CANCELADA
        </div>
        ${nota.motivo_cancelamento ? `<div style="font-size:13px; color:rgba(220,38,38,0.45); font-weight:bold; margin-top:8px;">MOTIVO: ${escapeXml(nota.motivo_cancelamento)}</div>` : ''}
      </div>
    `
  } else if (nota.status === 'substituida') {
    marcaDaguaHtml = `
      <div style="position:fixed; top:35%; left:10%; right:10%; transform:rotate(-28deg); text-align:center; pointer-events:none; z-index:9999;">
        <div style="display:inline-block; font-size:70px; color:rgba(79,70,229,0.22); font-weight:900; border:6px solid rgba(79,70,229,0.22); padding:10px 40px; border-radius:12px; letter-spacing:3px;">
          SUBSTITUÍDA
        </div>
      </div>
    `
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>DANFSE - Nota Fiscal de Serviço Eletrônica Nº ${nota.numero_nota}</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      color: #1A2333;
      margin: 0;
      padding: 20px;
      background: #fff;
    }
    .danfse-container {
      max-width: 800px;
      margin: 0 auto;
      border: 2px solid #1A2333;
      padding: 12px;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    .header-table td {
      border: 1px solid #94A3B8;
      padding: 6px;
      vertical-align: middle;
    }
    .section-title {
      background: #F1F5F9;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 10px;
      padding: 4px 6px;
      border: 1px solid #94A3B8;
      margin-top: 6px;
    }
    .content-box {
      border: 1px solid #94A3B8;
      border-top: none;
      padding: 8px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }
    .grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 6px;
    }
    .grid-4 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 6px;
    }
    .val-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
    }
    .val-table th, .val-table td {
      border: 1px solid #CBD5E1;
      padding: 4px 6px;
      text-align: right;
    }
    .val-table th {
      background: #F8FAFC;
      font-size: 9px;
      text-align: center;
    }
    .badge-sim {
      display: inline-block;
      background: ${isGovReal ? '#ECFDF5' : '#FEF3C7'};
      color: ${isGovReal ? '#065F46' : '#B45309'};
      padding: 2px 6px;
      font-weight: bold;
      font-size: 9px;
      border-radius: 4px;
      border: 1px solid ${isGovReal ? '#6EE7B7' : '#FCD34D'};
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="max-width: 800px; margin: 0 auto 12px auto; display: flex; justify-content: space-between; align-items: center; background: #F8FAFC; padding: 10px 16px; border: 1px solid #E2E8F0; border-radius: 8px;">
    <div>
      <strong style="color: #0FA3A3;">Rumo Consultoria Contábil</strong> — Visualizador de DANFSE
    </div>
    <div style="display: flex; gap: 8px;">
      ${
        nota.url_consulta_nfse
          ? `<a href="${nota.url_consulta_nfse}" target="_blank" style="background: #fff; color: #0FA3A3; border: 1px solid #0FA3A3; padding: 6px 14px; border-radius: 6px; font-weight: bold; text-decoration: none; font-size: 11px;">Consultar no Portal Gov.br</a>`
          : ''
      }
      <button onclick="window.print()" style="background: #0FA3A3; color: white; border: none; padding: 6px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 11px;">
        Imprimir / Salvar em PDF
      </button>
    </div>
  </div>

  ${marcaDaguaHtml}
  <div class="danfse-container">
    <table class="header-table">
      <tr>
        <td style="width: 25%; text-align: center;">
          <div style="font-weight: bold; font-size: 14px; color: #0FA3A3;">
            ${isGovReal ? 'RECEITA FEDERAL' : 'PREFEITURA MUNICIPAL'}
          </div>
          <div style="font-size: 9px; color: #64748B;">
            ${isGovReal ? 'Emissor Nacional Gov.br' : 'Secretaria de Finanças / Fazenda'}
          </div>
          <div style="font-size: 8px; margin-top: 4px;">Padrão Nacional ABRASF</div>
        </td>
        <td style="width: 50%; text-align: center;">
          <div style="font-size: 13px; font-weight: bold;">DOCUMENTO AUXILIAR DA NOTA FISCAL DE SERVIÇOS ELETRÔNICA</div>
          <div style="font-size: 16px; font-weight: bold; margin-top: 2px; color: #1E293B;">DANFSE</div>
          <div style="margin-top: 4px;">
            <span class="badge-sim">
              ${isGovReal ? 'PRODUÇÃO — GOV.BR EMISSOR NACIONAL' : 'MODO SIMULAÇÃO CONTROLADA (GOV.BR / ABRASF)'}
            </span>
          </div>
        </td>
        <td style="width: 25%; text-align: center; font-size: 10px;">
          <div><strong>Nº da Nota:</strong> <span style="font-size: 14px; font-weight: bold; color: #0284C7;">${nota.numero_nota}</span></div>
          <div style="margin-top: 4px;"><strong>Série:</strong> ${nota.serie || 'E'}</div>
          <div style="margin-top: 4px;"><strong>Data Emissão:</strong><br/>${dataEmissaoFormatada}</div>
          <div style="margin-top: 4px;"><strong>Cód. Verificação:</strong><br/><strong style="font-family: monospace;">${nota.codigo_verificacao}</strong></div>
        </td>
      </tr>
    </table>

    <div class="section-title">PRESTADOR DE SERVIÇOS (EMITENTE)</div>
    <div class="content-box">
      <div class="grid-2">
        <div>
          <div><strong>Razão Social:</strong> ${prestadorNome}</div>
          ${prestadorFantasia ? `<div><strong>Nome Fantasia:</strong> ${prestadorFantasia}</div>` : ''}
          <div><strong>CNPJ:</strong> ${prestadorCnpj}</div>
          <div><strong>Inscrição Municipal:</strong> ${prestadorIM}</div>
        </div>
        <div>
          <div><strong>Endereço:</strong> ${prestadorEnd}</div>
          <div><strong>Município:</strong> ${empresa?.cidade || 'São Paulo'} - ${empresa?.uf || 'SP'}</div>
          <div><strong>E-mail:</strong> ${empresa?.email || '—'}</div>
        </div>
      </div>
    </div>

    <div class="section-title">TOMADOR DE SERVIÇOS (CLIENTE)</div>
    <div class="content-box">
      <div class="grid-2">
        <div>
          <div><strong>Nome / Razão Social:</strong> ${nota.tomador_nome}</div>
          <div><strong>CPF / CNPJ:</strong> ${tomadorDocFormatado}</div>
        </div>
        <div>
          <div><strong>E-mail:</strong> ${nota.tomador_email || '—'}</div>
          <div><strong>Endereço:</strong> Logradouro do Tomador de Serviços</div>
        </div>
      </div>
    </div>

    <div class="section-title">DISCRIMINAÇÃO DOS SERVIÇOS</div>
    <div class="content-box" style="min-height: 80px; white-space: pre-wrap; font-family: monospace; font-size: 10px; line-height: 1.4;">
${nota.discriminacao_servicos}
    </div>

    <div class="section-title">CÓDIGO DE TRIBUTAÇÃO E MUNICÍPIO DA PRESTAÇÃO</div>
    <div class="content-box">
      <div class="grid-3">
        <div><strong>Item LC 116/03:</strong> ${nota.codigo_servico_municipal || '01.07'}</div>
        <div><strong>Município de Incidência:</strong> ${empresa?.cidade || 'São Paulo'} - ${empresa?.uf || 'SP'}</div>
        <div><strong>Natureza Operação:</strong> 1 - Tributação no Município</div>
      </div>
    </div>

    <div class="section-title">RETENÇÕES FEDERAIS E TRIBUTOS</div>
    <div class="content-box">
      <table class="val-table">
        <thead>
          <tr>
            <th>PIS</th>
            <th>COFINS</th>
            <th>INSS</th>
            <th>IRRF</th>
            <th>CSLL</th>
            <th>OUTRAS RETENÇÕES</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${formatMoeda(nota.valor_pis)}</td>
            <td>${formatMoeda(nota.valor_cofins)}</td>
            <td>${formatMoeda(nota.valor_inss)}</td>
            <td>${formatMoeda(nota.valor_ir)}</td>
            <td>${formatMoeda(nota.valor_csll)}</td>
            <td>R$ 0,00</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section-title">CÁLCULO DO ISSQN E VALOR LÍQUIDO</div>
    <div class="content-box">
      <table class="val-table">
        <thead>
          <tr>
            <th>VALOR DOS SERVIÇOS</th>
            <th>DEDUÇÕES</th>
            <th>BASE DE CÁLCULO</th>
            <th>ALÍQUOTA</th>
            <th>VALOR DO ISS</th>
            <th>ISS RETIDO?</th>
            <th>VALOR LÍQUIDO DA NFS-e</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-weight: bold;">${formatMoeda(nota.valor_servicos)}</td>
            <td>R$ 0,00</td>
            <td>${formatMoeda(nota.valor_servicos)}</td>
            <td>${nota.aliquota_iss || 2}%</td>
            <td>${formatMoeda(nota.valor_iss)}</td>
            <td>${nota.iss_retido ? 'SIM' : 'NÃO'}</td>
            <td style="font-weight: bold; font-size: 13px; color: #0FA3A3;">${formatMoeda(nota.valor_liquido)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section-title">OUTRAS INFORMAÇÕES & AUDITORIA FISCAL</div>
    <div class="content-box" style="font-size: 9px; color: #475569; line-height: 1.4;">
      • Provedor Fiscal: <strong>${isGovReal ? 'Gov.br (Emissor Nacional de NFS-e)' : 'Simulação Controlada (Gov.br / ABRASF)'}</strong><br/>
      • Chave de Acesso: <span style="font-family: monospace;">${nota.chave_acesso || '—'}</span><br/>
      ${nota.protocolo_autorizacao ? `• Protocolo de Autorização: <span style="font-family: monospace;">${nota.protocolo_autorizacao}</span><br/>` : ''}
      ${nota.data_cancelamento ? `• Cancelamento Registrado em: <strong>${new Date(nota.data_cancelamento).toLocaleString('pt-BR')}</strong> (Protocolo: ${nota.protocolo_cancelamento || 'Simulado'})<br/>` : ''}
      ${nota.motivo_cancelamento ? `• Motivo do Cancelamento: <em>${escapeXml(nota.motivo_cancelamento)}</em><br/>` : ''}
      ${nota.url_consulta_nfse ? `• URL de Consulta Pública: <a href="${nota.url_consulta_nfse}" target="_blank" style="color: #0284C7;">${nota.url_consulta_nfse}</a><br/>` : ''}
      • Autenticidade e conferência garantidas pelo código de verificação: <strong>${nota.codigo_verificacao}</strong>.
    </div>
  </div>
</body>
</html>`
}

import pb from '@/lib/pocketbase/client'
import type {
  WhatsAppNotificacoesAutorizadasRecord,
  WhatsAppEnvioRecord,
  WhatsAppEnvioTipo,
  Empresa,
  ObrigacaoRecord,
  GuiaPagamentoRecord,
  DemonstrativoRecord,
  Documento,
} from '@/types'

export interface SalvarAutorizacaoInput {
  tenant_id: string
  empresa: string
  telefone_destinatario?: string
  permitir_avisos?: boolean
  permitir_guias?: boolean
  permitir_previas?: boolean
  permitir_demonstrativos?: boolean
  permitir_documentos?: boolean
  permitir_cobrancas?: boolean
  ativo?: boolean
  observacoes?: string
}

export interface DispararEnvioInput {
  tenant_id: string
  empresa_id: string
  tipo: WhatsAppEnvioTipo
  referencia?: string
  destinatario: string
  mensagem: string
  origem?: 'manual' | 'elliza' | 'agendador'
}

export interface DispararEnvioResponse {
  sucesso: boolean
  status: 'fila' | 'aguardando_credenciais' | 'enviado' | 'falhou' | 'cancelado'
  modo?: string
  envio_id?: string
  mensagem?: string
  erro?: string
}

export const whatsappAtivoService = {
  /**
   * Busca as autorizações de envio ativo de uma empresa específica
   */
  async getAutorizacaoEmpresa(
    tenantId: string,
    empresaId: string,
  ): Promise<WhatsAppNotificacoesAutorizadasRecord | null> {
    try {
      const records = await pb
        .collection('whatsapp_notificacoes_autorizadas')
        .getFullList<WhatsAppNotificacoesAutorizadasRecord>({
          filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}"`,
          limit: 1,
        })
      return records[0] || null
    } catch (err) {
      console.warn('Erro ao buscar autorização whatsapp ativa:', err)
      return null
    }
  },

  /**
   * Salva ou atualiza a autorização de envio ativo da empresa
   */
  async salvarAutorizacao(
    input: SalvarAutorizacaoInput,
  ): Promise<WhatsAppNotificacoesAutorizadasRecord> {
    const existing = await this.getAutorizacaoEmpresa(input.tenant_id, input.empresa)
    if (existing) {
      return pb
        .collection('whatsapp_notificacoes_autorizadas')
        .update<WhatsAppNotificacoesAutorizadasRecord>(existing.id, {
          telefone_destinatario: input.telefone_destinatario,
          permitir_avisos: input.permitir_avisos ?? existing.permitir_avisos,
          permitir_guias: input.permitir_guias ?? existing.permitir_guias,
          permitir_previas: input.permitir_previas ?? existing.permitir_previas,
          permitir_demonstrativos:
            input.permitir_demonstrativos ?? existing.permitir_demonstrativos,
          permitir_documentos: input.permitir_documentos ?? existing.permitir_documentos,
          ativo: input.ativo ?? existing.ativo,
          observacoes: input.observacoes ?? existing.observacoes,
        })
    }

    return pb
      .collection('whatsapp_notificacoes_autorizadas')
      .create<WhatsAppNotificacoesAutorizadasRecord>({
        tenant_id: input.tenant_id,
        empresa: input.empresa,
        telefone_destinatario: input.telefone_destinatario || '',
        permitir_avisos: input.permitir_avisos ?? true,
        permitir_guias: input.permitir_guias ?? true,
        permitir_previas: input.permitir_previas ?? true,
        permitir_demonstrativos: input.permitir_demonstrativos ?? true,
        permitir_documentos: input.permitir_documentos ?? true,
        permitir_cobrancas: input.permitir_cobrancas ?? true,
        ativo: input.ativo ?? true,
        observacoes: input.observacoes || '',
      })
  },

  /**
   * Lista o histórico de envios ativos filtrado por empresa
   */
  async listEnviosPorEmpresa(tenantId: string, empresaId: string): Promise<WhatsAppEnvioRecord[]> {
    return pb.collection('whatsapp_envios').getFullList<WhatsAppEnvioRecord>({
      filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}"`,
      sort: '-created',
      expand: 'empresa',
    })
  },

  /**
   * Dispara o envio ativo via hook autenticado (Evolution API ou Modo Supervisão)
   */
  async dispararEnvio(input: DispararEnvioInput): Promise<DispararEnvioResponse> {
    const res = await pb.send('/backend/v1/whatsapp-ativo/disparar', {
      method: 'POST',
      body: input,
    })
    return res as DispararEnvioResponse
  },

  /**
   * Helper para verificar se as credenciais Evolution API estão ativas no tenant
   */
  async getStatusEvolutionTenant(
    tenantId: string,
  ): Promise<{ configurado: boolean; url: string; instance: string }> {
    try {
      const cfg = await pb.collection('nfse_config').getFirstListItem(`tenant_id = "${tenantId}"`)
      const url = (cfg.get('evolution_api_url') as string) || ''
      const key = (cfg.get('evolution_api_key') as string) || ''
      const instance = (cfg.get('evolution_instance') as string) || ''

      const isConfigured = Boolean(
        url &&
        key &&
        instance &&
        url.trim() !== '' &&
        !url.includes('.internal') &&
        !url.includes('localhost'),
      )

      return {
        configurado: isConfigured,
        url,
        instance,
      }
    } catch (_) {
      return { configurado: false, url: '', instance: '' }
    }
  },

  // =========================================================================
  // GERAÇÃO DE TEMPLATES COM DADOS REAIS
  // =========================================================================

  gerarTemplateAvisoObrigacao(params: { empresa: Empresa; obrigacao: ObrigacaoRecord }): string {
    const nome = params.empresa.nome_fantasia || params.empresa.razao_social
    const tipo = params.obrigacao.tipo
    const comp = params.obrigacao.competencia
    const venc = params.obrigacao.vencimento
      ? params.obrigacao.vencimento.slice(0, 10)
      : 'A definir'
    const valor =
      params.obrigacao.valor && params.obrigacao.valor > 0
        ? `\n💰 *Valor:* R$ ${params.obrigacao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        : ''

    return (
      `📌 *AVISO DE OBRIGAÇÃO - RUMO CONTÁBIL*\n\n` +
      `Olá! Lembramos que a obrigação fiscal/contábil *${tipo}* da empresa *${nome}* referente à competência *${comp}* tem vencimento agendado para *${venc}*.${valor}\n\n` +
      `Para conferir os detalhes e anexar comprovantes, acesse o Portal do Cliente:\n` +
      `🔗 https://rumoconsultoriacontabil.com.br\n\n` +
      `_Mensagem automatizada da equipe Rumo Consultoria Contábil._`
    )
  },

  gerarTemplateGuiaPagamento(params: { empresa: Empresa; guia: GuiaPagamentoRecord }): string {
    const nome = params.empresa.nome_fantasia || params.empresa.razao_social
    const tipo = params.guia.tipo_guia.toUpperCase()
    const comp = params.guia.periodo_apuracao || 'Atual'
    const venc = params.guia.data_vencimento
      ? params.guia.data_vencimento.slice(0, 10)
      : 'A definir'
    const total = (params.guia.valor_total || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
    })
    const codRec = params.guia.codigo_receita
      ? `\n🏷️ *Cód. Receita:* ${params.guia.codigo_receita}`
      : ''
    const codBarras = params.guia.autenticacao_bancaria
      ? `\n📄 *Linha Digitável:* ${params.guia.autenticacao_bancaria}`
      : ''

    return (
      `🏛️ *GUIA DE TRIBUTO DISPONÍVEL - RUMO CONTÁBIL*\n\n` +
      `Prezado cliente da empresa *${nome}*,\n` +
      `Sua guia de recolhimento tributário *${tipo}* (Período: *${comp}*) está fechada e pronta para quitação.\n\n` +
      `📅 *Vencimento:* ${venc}\n` +
      `💵 *Valor Total:* R$ ${total}${codRec}${codBarras}\n\n` +
      `Acesse a guia em PDF completa no Portal do Cliente:\n` +
      `🔗 https://rumoconsultoriacontabil.com.br\n\n` +
      `_Evite juros e multas efetuando o pagamento até a data limite._`
    )
  },

  gerarTemplatePreviaApuracao(params: {
    empresa: Empresa
    competencia: string
    resumoTexto: string
    estimativaValor?: number
  }): string {
    const nome = params.empresa.nome_fantasia || params.empresa.razao_social
    const valorFmt =
      params.estimativaValor && params.estimativaValor > 0
        ? `\n💰 *Estimativa Preliminar:* R$ ${params.estimativaValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        : ''

    return (
      `📊 *PRÉVIA DE APURAÇÃO TRIBUTÁRIA - RUMO CONTÁBIL*\n\n` +
      `Olá! Apresentamos a prévia dos cálculos tributários da empresa *${nome}* para a competência *${params.competencia}*.\n\n` +
      `📝 *Diagnóstico preliminar:*\n${params.resumoTexto}${valorFmt}\n\n` +
      `Caso queira validar os lançamentos antes do fechamento oficial da guia, entre em contato ou acesse:\n` +
      `🔗 https://rumoconsultoriacontabil.com.br\n\n` +
      `_Esta é uma estimativa assistida em modo prévio para seu planejamento financeiro._`
    )
  },

  gerarTemplateDemonstrativo(params: {
    empresa: Empresa
    demonstrativo: DemonstrativoRecord
  }): string {
    const nome = params.empresa.nome_fantasia || params.empresa.razao_social
    const tipo = params.demonstrativo.tipo.toUpperCase()
    const comp = params.demonstrativo.competencia

    return (
      `📈 *DEMONSTRATIVO CONTÁBIL DISPONÍVEL - RUMO CONTÁBIL*\n\n` +
      `Olá! O demonstrativo *${tipo}* da empresa *${nome}* referente ao fechamento da competência *${comp}* foi emitido pela equipe contábil.\n\n` +
      `Consulte a estrutura analítica completa, relatórios de receitas, despesas e faça o download no Portal do Cliente:\n` +
      `🔗 https://rumoconsultoriacontabil.com.br\n\n` +
      `_Demonstrativo emitido segundo as normas técnicas do CFC._`
    )
  },

  gerarTemplateDocumento(params: { empresa: Empresa; documento: Documento }): string {
    const nome = params.empresa.nome_fantasia || params.empresa.razao_social
    const tipo = (params.documento.tipo || 'documentos').replace(/_/g, ' ').toUpperCase()
    const nomeArq = params.documento.nome_arquivo || 'documento.pdf'

    return (
      `📁 *NOVO DOCUMENTO DISPONIBILIZADO - RUMO CONTÁBIL*\n\n` +
      `Olá! Um novo documento foi arquivado na pasta digital da empresa *${nome}*.\n\n` +
      `📄 *Tipo:* ${tipo}\n` +
      `📎 *Arquivo:* ${nomeArq}\n\n` +
      `Você pode visualizá-lo com segurança e efetuar o download a qualquer momento no Portal do Cliente:\n` +
      `🔗 https://rumoconsultoriacontabil.com.br\n\n` +
      `_Central de GED & Documentos Digitais Rumo Contábil._`
    )
  },

  gerarTemplateCobranca(params: {
    empresa: Empresa
    descricao: string
    competencia?: string
    valor: number
    vencimento: string
    chavePix?: string
    payloadPix?: string
    codigoBarras?: string
    beneficiarioNome?: string
    linkBoleto?: string
  }): string {
    const nome = params.empresa.nome_fantasia || params.empresa.razao_social
    const compStr = params.competencia ? ` (Comp. ${params.competencia})` : ''
    const valorFmt = params.valor.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    const vencFmt = params.vencimento.includes('T')
      ? params.vencimento.split('T')[0]
      : params.vencimento
    const dataPartes = vencFmt.split('-')
    const vencFormatado =
      dataPartes.length === 3 ? `${dataPartes[2]}/${dataPartes[1]}/${dataPartes[0]}` : vencFmt

    let meioPagamento = ''
    if (params.chavePix || params.payloadPix) {
      meioPagamento += `\n🔑 *PAGAMENTO VIA PIX:*`
      if (params.beneficiarioNome) {
        meioPagamento += `\n• *Beneficiário:* ${params.beneficiarioNome}`
      }
      if (params.chavePix) {
        meioPagamento += `\n• *Chave PIX:* ${params.chavePix}`
      }
      if (params.payloadPix) {
        meioPagamento += `\n\n*PIX Copia e Cola:* \n\`\`\`${params.payloadPix}\`\`\``
      }
    }

    if (params.codigoBarras) {
      meioPagamento += `\n\n📄 *BOLETO BANCÁRIO:*`
      meioPagamento += `\n• *Linha digitável / Código de barras:*\n\`\`\`${params.codigoBarras}\`\`\``
    }

    if (params.linkBoleto) {
      meioPagamento += `\n🔗 *Link do Boleto em PDF:*\n${params.linkBoleto}`
    }

    return (
      `💳 *AVISO DE COBRANÇA - HONORÁRIOS E SERVIÇOS CONTÁBEIS*\n\n` +
      `Prezado cliente da empresa *${nome}*,\n` +
      `Encaminhamos a fatura referente a *${params.descricao}*${compStr}.\n\n` +
      `💵 *Valor:* R$ ${valorFmt}\n` +
      `📅 *Vencimento:* ${vencFormatado}\n` +
      `${meioPagamento}\n\n` +
      `Acesse também o extrato financeiro no Portal do Cliente:\n` +
      `🔗 https://rumoconsultoriacontabil.com.br/portal-acessos\n\n` +
      `_Agradecemos pela parceria! Qualquer dúvida, nossa equipe está à disposição._`
    )
  },
}

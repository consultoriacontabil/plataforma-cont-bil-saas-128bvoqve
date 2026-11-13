import pb from '@/lib/pocketbase/client'

export type EllizaComandoTipo =
  | 'chat_objetivo'
  | 'extrair_documento'
  | 'conciliar_xml'
  | 'raspar_portal'
  | 'enviar_zap'
  | 'consultar_api'
  | 'sync_ged'
  | 'pesquisa_tributaria'
  // Fase 1 ELLIZA (migration 0152)
  | 'consultar_cnpj'
  | 'cnd_federal'
  | 'cnd_estadual'
  | 'cnd_municipal'
  | 'cndt'
  | 'comprovante_cnpj'

export type EllizaComandoStatus =
  | 'pendente'
  | 'aceito'
  | 'em_execucao'
  | 'concluido'
  | 'erro'
  | 'expirado'

export interface EllizaComandoErro {
  codigo?: string
  motivo?: string
  referencia_pendencia?: string | null
  campos_faltantes?: string[]
  detalhes?: Record<string, unknown>
  timestamp?: string
}

export interface EllizaComando {
  id: string
  tenant_id: string
  empresa_id?: string
  agente?: string
  tipo: EllizaComandoTipo
  payload?: Record<string, unknown>
  prioridade?: number
  status: EllizaComandoStatus
  nonce: string
  expira_em?: string
  resultado?: Record<string, unknown>
  evidencias?: string[]
  erro?: EllizaComandoErro | null
  created: string
  updated: string
  expand?: {
    empresa_id?: {
      id: string
      razao_social: string
      nome_fantasia?: string
      cnpj: string
    }
  }
}

export interface NFiscal {
  id: string
  tenant_id: string
  empresa_id: string
  numero: string
  serie?: string
  cnpj_emitente: string
  cnpj_destinatario: string
  valor_total: number
  cfop?: string
  competencia: string
  origem: string
  documento_id?: string
  itens?: unknown[]
  metadados_json?: Record<string, unknown>
  created: string
  updated: string
}

export const ellizaComandosService = {
  async listar(tenantId: string, limit = 50): Promise<EllizaComando[]> {
    if (!tenantId) return []
    try {
      const records = await pb.collection('elliza_comandos').getList<EllizaComando>(1, limit, {
        filter: `tenant_id = "${tenantId}"`,
        sort: '-created',
        expand: 'empresa_id',
      })
      return records.items
    } catch (err) {
      console.error('[ellizaComandosService] Erro ao listar comandos:', err)
      return []
    }
  },

  async criarComando(params: {
    tenant_id: string
    empresa_id?: string
    tipo: EllizaComandoTipo
    payload?: Record<string, unknown>
    prioridade?: number
    agente?: string
    expira_em?: string
  }): Promise<EllizaComando> {
    const nonce = crypto.randomUUID
      ? crypto.randomUUID()
      : `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

    // Default expiration: 1 hour if not specified
    let expiraEm = params.expira_em
    if (!expiraEm) {
      const expDate = new Date(Date.now() + 60 * 60 * 1000)
      expiraEm = expDate.toISOString()
    }

    const record = await pb.collection('elliza_comandos').create<EllizaComando>({
      tenant_id: params.tenant_id,
      empresa_id: params.empresa_id || undefined,
      agente: params.agente || 'elliza-desktop-rpa',
      tipo: params.tipo,
      payload: params.payload || {},
      prioridade: params.prioridade || 3,
      status: 'pendente',
      nonce,
      expira_em: expiraEm,
    })

    return record
  },

  async dispararExtrairDocumento(params: {
    tenant_id: string
    empresa_id: string
    documento_id: string
    nome_arquivo?: string
  }): Promise<EllizaComando> {
    return this.criarComando({
      tenant_id: params.tenant_id,
      empresa_id: params.empresa_id,
      tipo: 'extrair_documento',
      prioridade: 4,
      payload: {
        documento_id: params.documento_id,
        empresa_id: params.empresa_id,
        nome_arquivo: params.nome_arquivo,
        acao: 'ocr_classificacao_fiscal',
        instrucao:
          'Executar Scanner OCR e extração fiscal estruturada no cliente ELLIZA desktop local.',
      },
    })
  },

  /** Fase 1 — enfileira consulta de situação cadastral do CNPJ via ELLIZA desktop. */
  async dispararConsultarCnpj(params: {
    tenant_id: string
    empresa_id: string
    cnpj?: string
    prioridade?: number
  }): Promise<EllizaComando> {
    return this.criarComando({
      tenant_id: params.tenant_id,
      empresa_id: params.empresa_id,
      tipo: 'consultar_cnpj',
      prioridade: params.prioridade || 3,
      payload: {
        empresa_id: params.empresa_id,
        cnpj: params.cnpj ? params.cnpj.replace(/\D/g, '') : undefined,
        acao: 'consulta_situacao_cadastral_rfb',
        instrucao:
          'Consultar o CNPJ na Receita Federal (cartão CNPJ) e concluir com resumo_cadastral estruturado (cnpj 14 dígitos, razao_social, situacao_cadastral, endereço e CNAE). Sem evidência real não há conclusão (parada honesta, HTTP 422).',
      },
    })
  },

  /** Fase 1 — enfileira emissão de certidão (CND federal/estadual/municipal, CNDT ou comprovante CNPJ). */
  async dispararCertidao(params: {
    tenant_id: string
    empresa_id: string
    tipo: 'cnd_federal' | 'cnd_estadual' | 'cnd_municipal' | 'cndt' | 'comprovante_cnpj'
    cnpj?: string
    uf?: string
    prioridade?: number
  }): Promise<EllizaComando> {
    return this.criarComando({
      tenant_id: params.tenant_id,
      empresa_id: params.empresa_id,
      tipo: params.tipo,
      prioridade: params.prioridade || 3,
      payload: {
        empresa_id: params.empresa_id,
        cnpj: params.cnpj ? params.cnpj.replace(/\D/g, '') : undefined,
        uf: params.uf,
        acao: 'emissao_certidao',
        instrucao:
          'Emitir a certidão no portal oficial (credenciais apenas na ELLIZA desktop) e concluir com PDF real (pdf_url + pdf_sha256, ou documento_id do GED) e situacao (negativa | positiva | positiva_com_efeitos).',
      },
    })
  },

  async dispararPesquisaTributaria(params: {
    tenant_id: string
    empresa_id?: string
    pergunta: string
    contexto?: {
      ncm?: string
      cfop?: string
      operacao?: string
      uf_origem?: string
      uf_destino?: string
      aliquota_estudo?: string
      regime_tributario?: string
      detalhes_operacao?: string
    }
    prioridade?: number
  }): Promise<EllizaComando> {
    return this.criarComando({
      tenant_id: params.tenant_id,
      empresa_id: params.empresa_id,
      tipo: 'pesquisa_tributaria',
      prioridade: params.prioridade || 3,
      payload: {
        pergunta: params.pergunta,
        empresa_id: params.empresa_id,
        contexto: params.contexto || {},
        acao: 'pesquisa_tributaria_avancada',
        instrucao:
          'Executar workflow Pesquisa Tributária no cliente ELLIZA desktop local gerando relatório técnico fundamentado (Markdown) e fontes.',
      },
    })
  },

  async listarNfiscais(tenantId: string, limit = 50): Promise<NFiscal[]> {
    if (!tenantId) return []
    try {
      const records = await pb.collection('nfiscal').getList<NFiscal>(1, limit, {
        filter: `tenant_id = "${tenantId}"`,
        sort: '-created',
      })
      return records.items
    } catch (err) {
      console.error('[ellizaComandosService] Erro ao listar nfiscal:', err)
      return []
    }
  },
}

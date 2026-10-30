import pb from '@/lib/pocketbase/client'

export type EllizaComandoTipo =
  | 'chat_objetivo'
  | 'extrair_documento'
  | 'conciliar_xml'
  | 'raspar_portal'
  | 'enviar_zap'
  | 'consultar_api'
  | 'sync_ged'

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

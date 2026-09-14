import pb from '@/lib/pocketbase/client'
import type {
  NfeConfigRecord,
  NfeRecebidaRecord,
  NfeSyncLogRecord,
  NfeDiagnosticoResult,
  NfeSincronizarResult,
  NfeManifestarResult,
  NfeConsultarChaveResult,
  NfeAmbiente,
  NfeStatusManifestacao,
  NfeStatusConexao,
} from '@/types'

export interface SalvarNfeConfigInput {
  tenant_id: string
  empresa: string
  busca_automatica_ativa: boolean
  ambiente: NfeAmbiente
  certificado_a1?: string
  senha_certificado?: string
  auto_importar_ged: boolean
  auto_ciencia_operacao: boolean
  status_conexao?: NfeStatusConexao
}

export interface ListNfeRecebidasFilters {
  empresaId: string
  statusManifestacao?: string
  statusSefaz?: string
  search?: string
  dataInicio?: string
  dataFim?: string
}

export const nfeDestinatarioService = {
  /**
   * Obtém a configuração de busca de NF-e da empresa (se existir)
   */
  async getConfig(empresaId: string): Promise<NfeConfigRecord | null> {
    try {
      const records = await pb.collection('nfe_config').getList<NfeConfigRecord>(1, 1, {
        filter: `empresa = "${empresaId}"`,
        expand: 'certificado_a1,empresa',
      })
      return records.items[0] || null
    } catch (err) {
      console.warn('[NFE] Erro ao buscar configuração:', err)
      return null
    }
  },

  /**
   * Salva ou atualiza a configuração de busca de NF-e
   */
  async salvarConfig(input: SalvarNfeConfigInput): Promise<NfeConfigRecord> {
    const existing = await this.getConfig(input.empresa)

    if (existing) {
      return await pb.collection('nfe_config').update<NfeConfigRecord>(existing.id, {
        busca_automatica_ativa: input.busca_automatica_ativa,
        ambiente: input.ambiente,
        certificado_a1: input.certificado_a1 || null,
        senha_certificado: input.senha_certificado || '',
        auto_importar_ged: input.auto_importar_ged,
        auto_ciencia_operacao: input.auto_ciencia_operacao,
        status_conexao: input.status_conexao || existing.status_conexao,
      })
    }

    return await pb.collection('nfe_config').create<NfeConfigRecord>({
      ...input,
      status_conexao: input.status_conexao || 'modo_supervisao',
      ultimo_nsu: '000000000000000',
      max_nsu: '000000000000000',
      total_notas_recebidas: 0,
    })
  },

  /**
   * Lista as notas fiscais eletrônicas recebidas para uma empresa com filtros
   */
  async listRecebidas(
    filters: ListNfeRecebidasFilters,
    page = 1,
    perPage = 50,
  ): Promise<{
    items: NfeRecebidaRecord[]
    totalItems: number
    totalPages: number
  }> {
    try {
      const filterParts: string[] = [`empresa = "${filters.empresaId}"`]

      if (filters.statusManifestacao && filters.statusManifestacao !== 'todos') {
        filterParts.push(`status_manifestacao = "${filters.statusManifestacao}"`)
      }

      if (filters.statusSefaz && filters.statusSefaz !== 'todos') {
        filterParts.push(`status_sefaz = "${filters.statusSefaz}"`)
      }

      if (filters.search && filters.search.trim()) {
        const q = filters.search.trim()
        filterParts.push(
          `(chave_acesso ~ "${q}" || razao_social_emitente ~ "${q}" || cnpj_emitente ~ "${q}" || numero ~ "${q}" || natureza_operacao ~ "${q}")`,
        )
      }

      if (filters.dataInicio) {
        filterParts.push(`data_emissao >= "${filters.dataInicio} 00:00:00"`)
      }

      if (filters.dataFim) {
        filterParts.push(`data_emissao <= "${filters.dataFim} 23:59:59"`)
      }

      const res = await pb.collection('nfe_recebidas').getList<NfeRecebidaRecord>(page, perPage, {
        filter: filterParts.join(' && '),
        sort: '-data_emissao',
        expand: 'manifestado_por,documento_ged,empresa',
      })

      return {
        items: res.items,
        totalItems: res.totalItems,
        totalPages: res.totalPages,
      }
    } catch (err) {
      console.warn('[NFE] Erro ao listar NF-e recebidas:', err)
      return { items: [], totalItems: 0, totalPages: 0 }
    }
  },

  /**
   * Lista os logs de sincronização e auditoria da busca SEFAZ
   */
  async listLogs(empresaId: string, limit = 20): Promise<NfeSyncLogRecord[]> {
    try {
      const records = await pb.collection('nfe_sync_logs').getList<NfeSyncLogRecord>(1, limit, {
        filter: `empresa = "${empresaId}"`,
        sort: '-created',
        expand: 'executado_por',
      })
      return records.items
    } catch (err) {
      console.warn('[NFE] Erro ao listar logs:', err)
      return []
    }
  },

  /**
   * Dispara diagnóstico transparente de credenciais (certificado detectado, senha, ambiente)
   */
  async testarCredenciais(params: {
    tenant_id: string
    empresa_id: string
    certificado_a1?: string
    senha_certificado?: string
    ambiente?: NfeAmbiente
  }): Promise<NfeDiagnosticoResult> {
    const res = await pb.send<NfeDiagnosticoResult>('/backend/v1/nfe/testar-credenciais', {
      method: 'POST',
      body: params,
    })
    return res
  },

  /**
   * Aciona busca manual SEFAZ agora (nfeDistDFeInteresse por NSU ou Modo Supervisão)
   */
  async sincronizarAgora(params: {
    tenant_id: string
    empresa_id: string
  }): Promise<NfeSincronizarResult> {
    const res = await pb.send<NfeSincronizarResult>('/backend/v1/nfe/sincronizar', {
      method: 'POST',
      body: {
        tenant_id: params.tenant_id,
        empresa_id: params.empresa_id,
        origem: 'manual',
      },
    })
    return res
  },

  /**
   * Registra a manifestação do destinatário na NF-e recebida
   */
  async registrarManifestacao(params: {
    nfe_id: string
    tipo_manifestacao: NfeStatusManifestacao
    justificativa?: string
  }): Promise<NfeManifestarResult> {
    const res = await pb.send<NfeManifestarResult>('/backend/v1/nfe/manifestar', {
      method: 'POST',
      body: params,
    })
    return res
  },

  /**
   * Consulta pública por chave de 44 dígitos e importa para o GED
   */
  async consultarChaveManual(params: {
    tenant_id: string
    empresa_id: string
    chave_acesso: string
    razao_social_emitente?: string
    valor_total?: number
    valor_icms?: number
    cfop_principal?: string
    natureza_operacao?: string
  }): Promise<NfeConsultarChaveResult> {
    const res = await pb.send<NfeConsultarChaveResult>('/backend/v1/nfe/consultar-chave', {
      method: 'POST',
      body: params,
    })
    return res
  },
}

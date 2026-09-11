import pb from '@/lib/pocketbase/client'
import type {
  RfbConfigRecord,
  RfbSyncLogRecord,
  RfbDiagnosticoResult,
  RfbSincronizarResult,
} from '@/types'

export interface SalvarRfbConfigInput {
  tenant_id: string
  empresa: string
  ativo: boolean
  ambiente: 'producao' | 'homologacao'
  cnpj_contribuinte?: string
  certificado_a1?: string
  senha_certificado?: string
  contrato_dte_id?: string
  token_ambiente_rfb?: string
  sincronizacao_automatica: boolean
  sincronizar_certidoes: boolean
  sincronizar_ecac: boolean
  status_conexao?: 'conectado' | 'erro_credenciais' | 'modo_supervisao' | 'desconectado'
}

export const rfbConectorService = {
  /**
   * Obtém a configuração do Conector RFB da empresa (se existir)
   */
  async getConfig(empresaId: string): Promise<RfbConfigRecord | null> {
    try {
      const records = await pb.collection('rfb_config').getList<RfbConfigRecord>(1, 1, {
        filter: `empresa = "${empresaId}"`,
        expand: 'certificado_a1,empresa',
      })
      return records.items[0] || null
    } catch (err) {
      console.warn('[RFB] Erro ao buscar configuração:', err)
      return null
    }
  },

  /**
   * Salva ou atualiza as configurações do Conector RFB da empresa
   */
  async salvarConfig(input: SalvarRfbConfigInput): Promise<RfbConfigRecord> {
    const existing = await this.getConfig(input.empresa)

    if (existing) {
      return await pb.collection('rfb_config').update<RfbConfigRecord>(existing.id, {
        ativo: input.ativo,
        ambiente: input.ambiente,
        cnpj_contribuinte: input.cnpj_contribuinte,
        certificado_a1: input.certificado_a1 || null,
        senha_certificado: input.senha_certificado || '',
        contrato_dte_id: input.contrato_dte_id || '',
        token_ambiente_rfb: input.token_ambiente_rfb || '',
        sincronizacao_automatica: input.sincronizacao_automatica,
        sincronizar_certidoes: input.sincronizar_certidoes,
        sincronizar_ecac: input.sincronizar_ecac,
        status_conexao: input.status_conexao || existing.status_conexao,
      })
    }

    return await pb.collection('rfb_config').create<RfbConfigRecord>({
      ...input,
      status_conexao: input.status_conexao || 'modo_supervisao',
    })
  },

  /**
   * Lista os logs de sincronização e diagnóstico da RFB para a empresa
   */
  async listLogs(empresaId: string, limit = 20): Promise<RfbSyncLogRecord[]> {
    try {
      const records = await pb.collection('rfb_sync_logs').getList<RfbSyncLogRecord>(1, limit, {
        filter: `empresa = "${empresaId}"`,
        sort: '-created',
        expand: 'executado_por',
      })
      return records.items
    } catch (err) {
      console.warn('[RFB] Erro ao listar logs:', err)
      return []
    }
  },

  /**
   * Chama o endpoint server-side para testar credenciais e retornar diagnóstico honesto
   */
  async testarCredenciais(params: {
    tenant_id: string
    empresa_id: string
    cnpj_contribuinte?: string
    certificado_a1?: string
    senha_certificado?: string
    contrato_dte_id?: string
    token_ambiente_rfb?: string
    ambiente?: 'producao' | 'homologacao'
  }): Promise<RfbDiagnosticoResult> {
    const response = await pb.send<RfbDiagnosticoResult>('/backend/v1/rfb/testar-credenciais', {
      method: 'POST',
      body: params,
    })
    return response
  },

  /**
   * Aciona a sincronização direta agora (ou reporta pendências em Modo Supervisão)
   */
  async sincronizarAgora(params: {
    tenant_id: string
    empresa_id: string
  }): Promise<RfbSincronizarResult> {
    const response = await pb.send<RfbSincronizarResult>('/backend/v1/rfb/sincronizar', {
      method: 'POST',
      body: {
        tenant_id: params.tenant_id,
        empresa_id: params.empresa_id,
        origem: 'manual',
      },
    })
    return response
  },
}

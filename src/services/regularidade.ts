import pb from '@/lib/pocketbase/client'
import type {
  CertidaoRecord,
  TipoCertidao,
  StatusCertidao,
  OrigemCertidao,
  EcacComunicacaoRecord,
  TipoComunicacaoEcac,
  CriticidadeEcac,
  OrigemCapturaEcac,
} from '@/types'

export type CertidaoSaude = 'valida' | 'proximo_vencimento' | 'vencida' | 'sem_efeito' | 'pendente'

export interface CertidaoSaudeInfo {
  saude: CertidaoSaude
  label: string
  diasRestantes?: number
  certidao?: CertidaoRecord
}

export interface ConsolidadoRegularidadeEmpresa {
  empresaId: string
  totalCertidoes: number
  certidoesValidas: number
  certidoesVencendo: number
  certidoesVencidas: number
  certidaoStatusGeral: 'regular' | 'alerta' | 'irregular' | 'sem_registro'
  certificadoSaude: 'valido' | 'proximo_vencimento' | 'expirado' | 'inexistente'
  ecacNaoLidas: number
  ecacNaoLidasAlta: number
  regularidadeGeral: 'regular' | 'atencao' | 'critico'
}

export const certidoesService = {
  /**
   * Lista certidões de uma empresa específica
   */
  async listByEmpresa(empresaId: string): Promise<CertidaoRecord[]> {
    try {
      const records = await pb.collection('certidoes').getFullList<CertidaoRecord>({
        filter: `empresa = "${empresaId}"`,
        sort: 'data_validade ASC',
        requestKey: null,
      })
      return records
    } catch (err) {
      console.error('Erro ao listar certidões da empresa:', err)
      return []
    }
  },

  /**
   * Lista todas as certidões do tenant
   */
  async list(tenantId: string, filter?: string): Promise<CertidaoRecord[]> {
    try {
      const filters = [`tenant_id = "${tenantId}"`]
      if (filter) filters.push(filter)
      const records = await pb.collection('certidoes').getFullList<CertidaoRecord>({
        filter: filters.join(' && '),
        sort: 'data_validade ASC',
        expand: 'empresa',
        requestKey: null,
      })
      return records
    } catch (err) {
      console.error('Erro ao listar certidões:', err)
      return []
    }
  },

  /**
   * Salva ou atualiza uma certidão (aceita FormData para arquivo PDF)
   */
  async save(id: string | null, data: FormData | Partial<CertidaoRecord>): Promise<CertidaoRecord> {
    if (id) {
      return await pb.collection('certidoes').update<CertidaoRecord>(id, data)
    }
    return await pb.collection('certidoes').create<CertidaoRecord>(data)
  },

  /**
   * Exclui uma certidão
   */
  async delete(id: string): Promise<boolean> {
    return await pb.collection('certidoes').delete(id)
  },

  /**
   * Calcula status de saúde visual da certidão
   */
  calcularSaude(cert?: CertidaoRecord | null): CertidaoSaudeInfo {
    if (!cert) {
      return {
        saude: 'pendente',
        label: 'Não cadastrada',
      }
    }

    if (cert.status === 'pendente_emissao') {
      return {
        saude: 'pendente',
        label: 'Pendente de emissão',
        certidao: cert,
      }
    }

    if (cert.status === 'positiva_sem_efeito') {
      return {
        saude: 'sem_efeito',
        label: 'Positiva sem efeito de negativa',
        certidao: cert,
      }
    }

    const now = new Date()
    const validade = new Date(cert.data_validade)
    const diffTime = validade.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays <= 0 || cert.status === 'vencida') {
      return {
        saude: 'vencida',
        label: diffDays < 0 ? `Vencida há ${Math.abs(diffDays)}d` : 'Vencida hoje',
        diasRestantes: diffDays,
        certidao: cert,
      }
    }

    if (diffDays <= 30) {
      return {
        saude: 'proximo_vencimento',
        label: `Vence em ${diffDays}d`,
        diasRestantes: diffDays,
        certidao: cert,
      }
    }

    return {
      saude: 'valida',
      label: `Válida (${diffDays}d)`,
      diasRestantes: diffDays,
      certidao: cert,
    }
  },

  getTipoLabel(tipo: TipoCertidao): string {
    const labels: Record<TipoCertidao, string> = {
      receita_pgfn_cnd: 'Receita Federal / PGFN (CND)',
      receita_pgfn_cpen: 'Receita Federal / PGFN (CPEN Positiva c/ Efeito)',
      fgts_crf: 'FGTS (CRF Caixa)',
      estadual: 'Certidão Estadual (ICMS / SEFAZ)',
      municipal: 'Certidão Municipal (ISS / Taxas)',
      trabalhista_cndt: 'Trabalhista (CNDT / TST)',
    }
    return labels[tipo] || tipo
  },
}

export const ecacService = {
  /**
   * Lista comunicações do E-CAC de uma empresa
   */
  async listByEmpresa(empresaId: string): Promise<EcacComunicacaoRecord[]> {
    try {
      const records = await pb.collection('ecac_comunicacoes').getFullList<EcacComunicacaoRecord>({
        filter: `empresa = "${empresaId}"`,
        sort: '-data_comunicacao',
        requestKey: null,
      })
      return records
    } catch (err) {
      console.error('Erro ao listar comunicações E-CAC:', err)
      return []
    }
  },

  /**
   * Lista todas as comunicações do tenant
   */
  async list(tenantId: string, filter?: string): Promise<EcacComunicacaoRecord[]> {
    try {
      const filters = [`tenant_id = "${tenantId}"`]
      if (filter) filters.push(filter)
      const records = await pb.collection('ecac_comunicacoes').getFullList<EcacComunicacaoRecord>({
        filter: filters.join(' && '),
        sort: '-data_comunicacao',
        expand: 'empresa',
        requestKey: null,
      })
      return records
    } catch (err) {
      console.error('Erro ao listar comunicações E-CAC:', err)
      return []
    }
  },

  /**
   * Salva ou atualiza uma comunicação (aceita FormData para anexo)
   */
  async save(
    id: string | null,
    data: FormData | Partial<EcacComunicacaoRecord>,
  ): Promise<EcacComunicacaoRecord> {
    if (id) {
      return await pb.collection('ecac_comunicacoes').update<EcacComunicacaoRecord>(id, data)
    }
    return await pb.collection('ecac_comunicacoes').create<EcacComunicacaoRecord>(data)
  },

  /**
   * Alterna status de lida
   */
  async marcarComoLida(id: string, lida: boolean): Promise<EcacComunicacaoRecord> {
    return await pb.collection('ecac_comunicacoes').update<EcacComunicacaoRecord>(id, { lida })
  },

  /**
   * Exclui comunicação
   */
  async delete(id: string): Promise<boolean> {
    return await pb.collection('ecac_comunicacoes').delete(id)
  },

  getTipoLabel(tipo: TipoComunicacaoEcac): string {
    const labels: Record<TipoComunicacaoEcac, string> = {
      intimacao_fiscal: 'Intimação Fiscal',
      notificacao_lancamento: 'Notificação de Lançamento',
      pendencia_cadastral: 'Pendência Cadastral',
      exclusao_simples: 'Exclusão do Simples Nacional',
      cobranca_parcelamento: 'Cobrança / Parcelamento',
      aviso_geral: 'Aviso Geral / Informativo',
    }
    return labels[tipo] || tipo
  },
}

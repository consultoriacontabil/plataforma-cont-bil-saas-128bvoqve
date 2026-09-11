import pb from '@/lib/pocketbase/client'
import type { CertificadoDigitalRecord, StatusCertificadoDigital } from '@/types'

export type CertificadoSaude = 'valido' | 'proximo_vencimento' | 'expirado' | 'inexistente'

export interface CertificadoSaudeInfo {
  saude: CertificadoSaude
  label: string
  diasRestantes?: number
  certificado?: CertificadoDigitalRecord
}

export const certificadosService = {
  /**
   * Busca o certificado digital ativo mais recente da empresa
   */
  async getByEmpresa(empresaId: string): Promise<CertificadoDigitalRecord | null> {
    try {
      const records = await pb
        .collection('certificados_digitais')
        .getList<CertificadoDigitalRecord>(1, 1, {
          filter: `empresa = "${empresaId}"`,
          sort: '-validade,-created',
          requestKey: null,
        })
      return records.items[0] || null
    } catch (err) {
      console.error('Erro ao buscar certificado da empresa:', err)
      return null
    }
  },

  /**
   * Lista todos os certificados do tenant
   */
  async list(tenantId: string, filter?: string): Promise<CertificadoDigitalRecord[]> {
    const filters = [`tenant_id = "${tenantId}"`]
    if (filter) filters.push(filter)
    const records = await pb
      .collection('certificados_digitais')
      .getFullList<CertificadoDigitalRecord>({
        filter: filters.join(' && '),
        sort: '-validade',
        expand: 'empresa',
        requestKey: null,
      })
    return records
  },

  /**
   * Salva ou atualiza um certificado digital
   */
  async save(
    id: string | null,
    data: FormData | Partial<CertificadoDigitalRecord>,
  ): Promise<CertificadoDigitalRecord> {
    if (id) {
      return await pb.collection('certificados_digitais').update<CertificadoDigitalRecord>(id, data)
    }
    return await pb.collection('certificados_digitais').create<CertificadoDigitalRecord>(data)
  },

  /**
   * Exclui um certificado digital
   */
  async delete(id: string): Promise<boolean> {
    return await pb.collection('certificados_digitais').delete(id)
  },

  /**
   * Calcula o status de saúde do certificado com base na validade
   */
  calcularSaude(cert?: CertificadoDigitalRecord | null): CertificadoSaudeInfo {
    if (!cert) {
      return {
        saude: 'inexistente',
        label: 'Sem Certificado',
      }
    }

    if (cert.status === 'revogado') {
      return {
        saude: 'expirado',
        label: 'Revogado',
        certificado: cert,
      }
    }

    const now = new Date()
    const validade = new Date(cert.validade)
    const diffTime = validade.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays <= 0 || cert.status === 'expirado') {
      return {
        saude: 'expirado',
        label: 'Expirado',
        diasRestantes: diffDays,
        certificado: cert,
      }
    }

    if (diffDays <= 30) {
      return {
        saude: 'proximo_vencimento',
        label: `Vence em ${diffDays}d`,
        diasRestantes: diffDays,
        certificado: cert,
      }
    }

    return {
      saude: 'valido',
      label: 'Certificado OK',
      diasRestantes: diffDays,
      certificado: cert,
    }
  },
}

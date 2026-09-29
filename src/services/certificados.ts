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
  /**
   * Lista certificados vinculados a uma empresa específica
   */
  async listByEmpresa(empresaId: string): Promise<CertificadoDigitalRecord[]> {
    try {
      const records = await pb
        .collection('certificados_digitais')
        .getFullList<CertificadoDigitalRecord>({
          filter: `empresa = "${empresaId}"`,
          sort: '-validade,-created',
          requestKey: null,
        })
      return records
    } catch (err) {
      console.error('Erro ao listar certificados da empresa:', err)
      return []
    }
  },

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
   * Retorna um resumo consolidado do status de certificados do tenant
   */
  async getStatusCertificadosTenant(tenantId: string): Promise<{
    total: number
    ativos: number
    vencidos: number
    aVencer30d: number
    semCertificado: number
    proximoVencimento?: {
      titular: string
      empresaNome?: string
      validade: string
      diasRestantes: number
    } | null
    certificados: Array<CertificadoDigitalRecord & { saudeInfo: CertificadoSaudeInfo }>
  }> {
    try {
      const records = await this.list(tenantId)
      let ativos = 0
      let vencidos = 0
      let aVencer30d = 0
      let proximoVencimento: {
        titular: string
        empresaNome?: string
        validade: string
        diasRestantes: number
      } | null = null
      let menorDias = Infinity

      const processados = records.map((cert) => {
        const saudeInfo = this.calcularSaude(cert)
        if (saudeInfo.saude === 'valido') ativos++
        else if (saudeInfo.saude === 'proximo_vencimento') {
          ativos++
          aVencer30d++
        } else if (saudeInfo.saude === 'expirado') {
          vencidos++
        }

        if (
          saudeInfo.diasRestantes !== undefined &&
          saudeInfo.diasRestantes >= 0 &&
          saudeInfo.diasRestantes < menorDias
        ) {
          menorDias = saudeInfo.diasRestantes
          proximoVencimento = {
            titular: cert.titular,
            empresaNome: cert.expand?.empresa?.razao_social || cert.expand?.empresa?.nome_fantasia,
            validade: cert.validade,
            diasRestantes: saudeInfo.diasRestantes,
          }
        }

        return { ...cert, saudeInfo }
      })

      return {
        total: records.length,
        ativos,
        vencidos,
        aVencer30d,
        semCertificado: 0,
        proximoVencimento,
        certificados: processados,
      }
    } catch (err) {
      console.warn('Erro ao calcular status consolidado de certificados:', err)
      return {
        total: 0,
        ativos: 0,
        vencidos: 0,
        aVencer30d: 0,
        semCertificado: 0,
        proximoVencimento: null,
        certificados: [],
      }
    }
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

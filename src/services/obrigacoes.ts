import pb from '@/lib/pocketbase/client'
import type { ObrigacaoRecord } from '@/types'

export const obrigacoesService = {
  async list(tenantId: string, filter?: string, sort = 'vencimento') {
    let finalFilter = `tenant_id = "${tenantId}"`
    if (filter) {
      finalFilter += ` && (${filter})`
    }

    return pb.collection('obrigacoes').getFullList<ObrigacaoRecord>({
      filter: finalFilter,
      sort,
      expand: 'empresa_id,responsavel_id',
    })
  },

  async getById(id: string) {
    return pb.collection('obrigacoes').getOne<ObrigacaoRecord>(id, {
      expand: 'empresa_id,responsavel_id',
    })
  },

  async create(data: FormData | Partial<ObrigacaoRecord>) {
    return pb.collection('obrigacoes').create<ObrigacaoRecord>(data)
  },

  async update(id: string, data: FormData | Partial<ObrigacaoRecord>, _tenantId?: string) {
    return pb.collection('obrigacoes').update<ObrigacaoRecord>(id, data)
  },

  async delete(id: string, _tenantId?: string) {
    return pb.collection('obrigacoes').delete(id)
  },

  async marcarComoEntregue(id: string, tenantId?: string) {
    const payload = {
      status: 'entregue' as const,
      data_entrega: new Date().toISOString(),
    }
    return this.update(id, payload, tenantId)
  },
}

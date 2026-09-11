import pb from '@/lib/pocketbase/client'
import type { Empresa } from '@/types'

export const empresasService = {
  async list(tenantId: string, filter?: string, sort = '-created') {
    let finalFilter = `tenant_id = "${tenantId}"`
    if (filter) finalFilter += ` && (${filter})`
    return pb.collection('empresas').getFullList<Empresa>({
      filter: finalFilter,
      sort,
    })
  },

  async getById(id: string) {
    return pb.collection('empresas').getOne<Empresa>(id)
  },

  async create(data: Partial<Empresa>) {
    return pb.collection('empresas').create<Empresa>(data)
  },

  async update(id: string, data: Partial<Empresa>) {
    return pb.collection('empresas').update<Empresa>(id, data)
  },

  async delete(id: string) {
    return pb.collection('empresas').delete(id)
  },
}

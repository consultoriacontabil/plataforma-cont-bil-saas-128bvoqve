import pb from '@/lib/pocketbase/client'
import type { Empresa } from '@/types'

export const empresasService = {
  async list(tenantId: string, filter?: string, sort = '-created', incluirExcluidas = false) {
    let finalFilter = `tenant_id = "${tenantId}"`
    if (!incluirExcluidas) {
      finalFilter += ` && (excluida_em = "" || excluida_em = null)`
    }
    if (filter) finalFilter += ` && (${filter})`

    return pb.collection('empresas').getFullList<Empresa>({
      filter: finalFilter,
      sort,
    })
  },

  async getById(id: string) {
    return pb.collection('empresas').getOne<Empresa>(id)
  },

  async getByCnpj(tenantId: string, cnpj: string, ignoreId?: string) {
    const cleanCnpj = cnpj.replace(/\D/g, '')
    if (!cleanCnpj) return null
    let filter = `tenant_id = "${tenantId}" && (cnpj = "${cleanCnpj}" || cnpj = "${cnpj}")`
    if (ignoreId) {
      filter += ` && id != "${ignoreId}"`
    }
    const records = await pb.collection('empresas').getList<Empresa>(1, 1, {
      filter,
      requestKey: null,
    })
    return records.items[0] || null
  },

  async create(data: Partial<Empresa>) {
    return pb.collection('empresas').create<Empresa>(data)
  },

  async update(id: string, data: Partial<Empresa>) {
    return pb.collection('empresas').update<Empresa>(id, data)
  },

  async delete(id: string, _tenantId?: string) {
    return pb.collection('empresas').delete(id)
  },
}

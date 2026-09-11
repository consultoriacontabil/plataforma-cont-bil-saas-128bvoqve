import pb from '@/lib/pocketbase/client'
import type { FiscalRecord } from '@/types'

export const fiscalService = {
  async list(tenantId: string, filter?: string, sort = '-created') {
    let finalFilter = `tenant_id = "${tenantId}"`
    if (filter) finalFilter += ` && (${filter})`
    return pb.collection('fiscal').getFullList<FiscalRecord>({
      filter: finalFilter,
      sort,
      expand: 'empresa_id,responsavel_id',
    })
  },

  async getById(id: string) {
    return pb.collection('fiscal').getOne<FiscalRecord>(id, {
      expand: 'empresa_id,responsavel_id',
    })
  },

  async create(data: FormData | Partial<FiscalRecord>) {
    return pb.collection('fiscal').create<FiscalRecord>(data)
  },

  async update(id: string, data: FormData | Partial<FiscalRecord>) {
    return pb.collection('fiscal').update<FiscalRecord>(id, data)
  },

  async delete(id: string) {
    return pb.collection('fiscal').delete(id)
  },

  getFileUrl(record: FiscalRecord, filename: string) {
    return pb.files.getURL(record, filename)
  },
}

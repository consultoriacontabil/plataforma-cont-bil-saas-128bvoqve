import pb from '@/lib/pocketbase/client'
import type { Documento } from '@/types'

export const documentosService = {
  async list(tenantId: string, filter?: string, sort = '-created') {
    let finalFilter = `tenant_id = "${tenantId}"`
    if (filter) finalFilter += ` && (${filter})`
    return pb.collection('documentos').getFullList<Documento>({
      filter: finalFilter,
      sort,
      expand: 'empresa_id,usuario_upload_id',
    })
  },

  async listByEmpresa(empresaId: string, sort = '-created') {
    return pb.collection('documentos').getFullList<Documento>({
      filter: `empresa_id = "${empresaId}"`,
      sort,
      expand: 'empresa_id,usuario_upload_id',
    })
  },

  async create(formData: FormData) {
    return pb.collection('documentos').create<Documento>(formData)
  },

  async update(id: string, data: Partial<Documento>) {
    return pb.collection('documentos').update<Documento>(id, data)
  },

  async delete(id: string) {
    return pb.collection('documentos').delete(id)
  },

  getFileUrl(record: Documento, filename: string) {
    return pb.files.getURL(record, filename)
  },
}

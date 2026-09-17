import pb from '@/lib/pocketbase/client'
import type { Documento } from '@/types'
import { offlineDb } from '@/lib/offline/db'
import { isOfflineModeEnabled } from '@/lib/offline/offlineControl'

export const documentosService = {
  async list(tenantId: string, filter?: string, sort = '-created') {
    let finalFilter = `tenant_id = "${tenantId}"`
    if (filter) finalFilter += ` && (${filter})`

    try {
      const records = await pb.collection('documentos').getFullList<Documento>({
        filter: finalFilter,
        sort,
        expand: 'empresa_id,usuario_upload_id',
      })
      if (tenantId) {
        offlineDb.saveCollectionCache(tenantId, 'documentos', records).catch(() => {})
      }
      return records
    } catch (err) {
      if (tenantId) {
        const cached = await offlineDb.getCollectionCache<Documento>(tenantId, 'documentos')
        if (cached.length > 0) return cached
      }
      throw err
    }
  },

  async listByEmpresa(empresaId: string, sort = '-created') {
    try {
      const records = await pb.collection('documentos').getFullList<Documento>({
        filter: `empresa_id = "${empresaId}"`,
        sort,
        expand: 'empresa_id,usuario_upload_id',
      })
      return records
    } catch (err) {
      // Fallback offline filtrado por empresa
      const dbItems = await offlineDb.getOutboxItems()
      const tenantId = dbItems[0]?.tenantId || ''
      if (tenantId) {
        const cached = await offlineDb.getCollectionCache<Documento>(tenantId, 'documentos')
        return cached.filter((d) => d.empresa_id === empresaId)
      }
      throw err
    }
  },

  async create(formData: FormData) {
    // Documentos com upload de arquivos binários exigem rede para processamento
    return pb.collection('documentos').create<Documento>(formData)
  },

  async update(id: string, data: Partial<Documento>, tenantId?: string) {
    try {
      const updated = await pb.collection('documentos').update<Documento>(id, data)
      if (updated.tenant_id) {
        await offlineDb.putSingleCacheRecord(updated.tenant_id, 'documentos', updated)
      }
      return updated
    } catch (err) {
      const isNetworkError =
        !navigator.onLine || (err instanceof TypeError && err.message.includes('fetch'))
      if (isNetworkError && tenantId && isOfflineModeEnabled(tenantId)) {
        await offlineDb.enqueueMutation({
          tenantId,
          entity: 'documentos',
          action: 'update',
          targetId: id,
          payload: data as Record<string, unknown>,
        })
        const existing = await offlineDb.getRecordCache<Documento>(tenantId, 'documentos', id)
        const merged: Documento = {
          ...(existing || ({} as Documento)),
          ...data,
          id,
          updated: new Date().toISOString(),
        } as Documento
        await offlineDb.putSingleCacheRecord(tenantId, 'documentos', merged)
        return merged
      }
      throw err
    }
  },

  async delete(id: string, tenantId?: string) {
    try {
      const res = await pb.collection('documentos').delete(id)
      if (tenantId) {
        await offlineDb.removeSingleCacheRecord(tenantId, 'documentos', id)
      }
      return res
    } catch (err) {
      const isNetworkError =
        !navigator.onLine || (err instanceof TypeError && err.message.includes('fetch'))
      if (isNetworkError && tenantId && isOfflineModeEnabled(tenantId)) {
        await offlineDb.enqueueMutation({
          tenantId,
          entity: 'documentos',
          action: 'delete',
          targetId: id,
          payload: {},
        })
        await offlineDb.removeSingleCacheRecord(tenantId, 'documentos', id)
        return true
      }
      throw err
    }
  },

  getFileUrl(record: Documento, filename: string) {
    return pb.files.getURL(record, filename)
  },
}

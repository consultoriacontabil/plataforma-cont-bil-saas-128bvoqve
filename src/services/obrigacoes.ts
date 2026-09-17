import pb from '@/lib/pocketbase/client'
import type { ObrigacaoRecord } from '@/types'
import { offlineDb } from '@/lib/offline/db'
import { isOfflineModeEnabled } from '@/lib/offline/offlineControl'

export const obrigacoesService = {
  async list(tenantId: string, filter?: string, sort = 'vencimento ASC') {
    let finalFilter = `tenant_id = "${tenantId}"`
    if (filter) {
      finalFilter += ` && (${filter})`
    }

    try {
      const records = await pb.collection('obrigacoes').getFullList<ObrigacaoRecord>({
        filter: finalFilter,
        sort,
        expand: 'empresa_id,responsavel_id',
      })
      if (tenantId) {
        offlineDb.saveCollectionCache(tenantId, 'obrigacoes', records).catch(() => {})
      }
      return records
    } catch (err) {
      if (tenantId) {
        const cached = await offlineDb.getCollectionCache<ObrigacaoRecord>(tenantId, 'obrigacoes')
        if (cached.length > 0) return cached
      }
      throw err
    }
  },

  async getById(id: string) {
    try {
      const record = await pb.collection('obrigacoes').getOne<ObrigacaoRecord>(id, {
        expand: 'empresa_id,responsavel_id',
      })
      if (record?.tenant_id) {
        offlineDb.putSingleCacheRecord(record.tenant_id, 'obrigacoes', record).catch(() => {})
      }
      return record
    } catch (err) {
      const dbItems = await offlineDb.getOutboxItems()
      const tenantId = dbItems[0]?.tenantId || ''
      if (tenantId) {
        const cached = await offlineDb.getRecordCache<ObrigacaoRecord>(tenantId, 'obrigacoes', id)
        if (cached) return cached
      }
      throw err
    }
  },

  async create(data: FormData | Partial<ObrigacaoRecord>) {
    // Se for FormData com anexo físico de comprovante, delegar para PB
    if (data instanceof FormData) {
      return pb.collection('obrigacoes').create<ObrigacaoRecord>(data)
    }

    try {
      const created = await pb.collection('obrigacoes').create<ObrigacaoRecord>(data)
      if (created.tenant_id) {
        await offlineDb.putSingleCacheRecord(created.tenant_id, 'obrigacoes', created)
      }
      return created
    } catch (err) {
      const isNetworkError =
        !navigator.onLine || (err instanceof TypeError && err.message.includes('fetch'))
      if (isNetworkError && data.tenant_id && isOfflineModeEnabled(data.tenant_id)) {
        const tempId = `temp_obr_${Date.now()}`
        const localRecord: ObrigacaoRecord = {
          id: tempId,
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          ...(data as ObrigacaoRecord),
        }
        await offlineDb.enqueueMutation({
          tenantId: data.tenant_id,
          entity: 'obrigacoes',
          action: 'create',
          targetId: tempId,
          payload: data as Record<string, unknown>,
        })
        await offlineDb.putSingleCacheRecord(data.tenant_id, 'obrigacoes', localRecord)
        return localRecord
      }
      throw err
    }
  },

  async update(id: string, data: FormData | Partial<ObrigacaoRecord>, tenantId?: string) {
    if (data instanceof FormData) {
      return pb.collection('obrigacoes').update<ObrigacaoRecord>(id, data)
    }

    try {
      const updated = await pb.collection('obrigacoes').update<ObrigacaoRecord>(id, data)
      if (updated.tenant_id) {
        await offlineDb.putSingleCacheRecord(updated.tenant_id, 'obrigacoes', updated)
      }
      return updated
    } catch (err) {
      const isNetworkError =
        !navigator.onLine || (err instanceof TypeError && err.message.includes('fetch'))
      const resolvedTenantId = tenantId || (data as ObrigacaoRecord).tenant_id
      if (isNetworkError && resolvedTenantId && isOfflineModeEnabled(resolvedTenantId)) {
        await offlineDb.enqueueMutation({
          tenantId: resolvedTenantId,
          entity: 'obrigacoes',
          action: 'update',
          targetId: id,
          originalUpdated: (data as ObrigacaoRecord).updated,
          payload: data as Record<string, unknown>,
        })
        const existing = await offlineDb.getRecordCache<ObrigacaoRecord>(
          resolvedTenantId,
          'obrigacoes',
          id,
        )
        const merged: ObrigacaoRecord = {
          ...(existing || ({} as ObrigacaoRecord)),
          ...data,
          id,
          updated: new Date().toISOString(),
        } as ObrigacaoRecord
        await offlineDb.putSingleCacheRecord(resolvedTenantId, 'obrigacoes', merged)
        return merged
      }
      throw err
    }
  },

  async delete(id: string, tenantId?: string) {
    try {
      const res = await pb.collection('obrigacoes').delete(id)
      if (tenantId) {
        await offlineDb.removeSingleCacheRecord(tenantId, 'obrigacoes', id)
      }
      return res
    } catch (err) {
      const isNetworkError =
        !navigator.onLine || (err instanceof TypeError && err.message.includes('fetch'))
      if (isNetworkError && tenantId && isOfflineModeEnabled(tenantId)) {
        await offlineDb.enqueueMutation({
          tenantId,
          entity: 'obrigacoes',
          action: 'delete',
          targetId: id,
          payload: {},
        })
        await offlineDb.removeSingleCacheRecord(tenantId, 'obrigacoes', id)
        return true
      }
      throw err
    }
  },

  async marcarComoEntregue(id: string, tenantId?: string) {
    const payload = {
      status: 'entregue' as const,
      data_entrega: new Date().toISOString(),
    }
    return this.update(id, payload, tenantId)
  },
}

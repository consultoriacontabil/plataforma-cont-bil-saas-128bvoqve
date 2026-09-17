import pb from '@/lib/pocketbase/client'
import type { Empresa } from '@/types'
import { offlineDb } from '@/lib/offline/db'

export const empresasService = {
  async list(tenantId: string, filter?: string, sort = '-created', incluirExcluidas = false) {
    let finalFilter = `tenant_id = "${tenantId}"`
    if (!incluirExcluidas) {
      finalFilter += ` && (excluida_em = "" || excluida_em = null)`
    }
    if (filter) finalFilter += ` && (${filter})`

    try {
      const records = await pb.collection('empresas').getFullList<Empresa>({
        filter: finalFilter,
        sort,
      })
      // Salvar no cache local para leitura offline posterior
      if (tenantId && records.length >= 0) {
        offlineDb.saveCollectionCache(tenantId, 'empresas', records).catch(() => {})
      }
      return records
    } catch (err) {
      // Fallback offline: buscar no IndexedDB
      if (tenantId) {
        const cached = await offlineDb.getCollectionCache<Empresa>(tenantId, 'empresas')
        if (cached.length > 0) {
          return cached.filter((e) => {
            if (!incluirExcluidas && e.excluida_em) return false
            return true
          })
        }
      }
      throw err
    }
  },

  async getById(id: string) {
    try {
      const record = await pb.collection('empresas').getOne<Empresa>(id)
      if (record?.tenant_id) {
        offlineDb.putSingleCacheRecord(record.tenant_id, 'empresas', record).catch(() => {})
      }
      return record
    } catch (err) {
      // Fallback offline por id
      const dbItems = await offlineDb.getOutboxItems()
      const tenantId = dbItems[0]?.tenantId || ''
      if (tenantId) {
        const cached = await offlineDb.getRecordCache<Empresa>(tenantId, 'empresas', id)
        if (cached) return cached
      }
      throw err
    }
  },

  async getByCnpj(tenantId: string, cnpj: string, ignoreId?: string) {
    const cleanCnpj = cnpj.replace(/\D/g, '')
    if (!cleanCnpj) return null
    let filter = `tenant_id = "${tenantId}" && (cnpj = "${cleanCnpj}" || cnpj = "${cnpj}")`
    if (ignoreId) {
      filter += ` && id != "${ignoreId}"`
    }
    try {
      const records = await pb.collection('empresas').getList<Empresa>(1, 1, {
        filter,
        requestKey: null,
      })
      return records.items[0] || null
    } catch (_) {
      // Fallback local no cache para validação de duplicidade offline
      try {
        const cached = await offlineDb.getCollectionCache<Empresa>(tenantId, 'empresas')
        return (
          cached.find((e) => {
            const eClean = (e.cnpj || '').replace(/\D/g, '')
            if (ignoreId && e.id === ignoreId) return false
            return eClean === cleanCnpj || e.cnpj === cnpj
          }) || null
        )
      } catch {
        return null
      }
    }
  },

  async create(data: Partial<Empresa>) {
    try {
      const created = await pb.collection('empresas').create<Empresa>(data)
      if (created.tenant_id) {
        await offlineDb.putSingleCacheRecord(created.tenant_id, 'empresas', created)
      }
      return created
    } catch (err) {
      // Se estiver offline, enfileirar no outbox e salvar no cache local com id temporário
      const isNetworkError =
        !navigator.onLine || (err instanceof TypeError && err.message.includes('fetch'))
      if (isNetworkError && data.tenant_id) {
        const tempId = `temp_emp_${Date.now()}`
        const localEmp: Empresa = {
          id: tempId,
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          ...(data as Empresa),
        }
        await offlineDb.enqueueMutation({
          tenantId: data.tenant_id,
          entity: 'empresas',
          action: 'create',
          targetId: tempId,
          payload: data as Record<string, unknown>,
        })
        await offlineDb.putSingleCacheRecord(data.tenant_id, 'empresas', localEmp)
        return localEmp
      }
      throw err
    }
  },

  async update(id: string, data: Partial<Empresa>) {
    try {
      const updated = await pb.collection('empresas').update<Empresa>(id, data)
      if (updated.tenant_id) {
        await offlineDb.putSingleCacheRecord(updated.tenant_id, 'empresas', updated)
      }
      return updated
    } catch (err) {
      const isNetworkError =
        !navigator.onLine || (err instanceof TypeError && err.message.includes('fetch'))
      const tenantId = data.tenant_id
      if (isNetworkError && tenantId) {
        // Enfileirar no outbox
        await offlineDb.enqueueMutation({
          tenantId,
          entity: 'empresas',
          action: 'update',
          targetId: id,
          originalUpdated: (data as Empresa).updated,
          payload: data as Record<string, unknown>,
        })
        // Atualizar otimisticamente o cache local
        const existing = await offlineDb.getRecordCache<Empresa>(tenantId, 'empresas', id)
        const merged: Empresa = {
          ...(existing || ({} as Empresa)),
          ...data,
          id,
          updated: new Date().toISOString(),
        } as Empresa
        await offlineDb.putSingleCacheRecord(tenantId, 'empresas', merged)
        return merged
      }
      throw err
    }
  },

  async delete(id: string, tenantId?: string) {
    try {
      const res = await pb.collection('empresas').delete(id)
      if (tenantId) {
        await offlineDb.removeSingleCacheRecord(tenantId, 'empresas', id)
      }
      return res
    } catch (err) {
      const isNetworkError =
        !navigator.onLine || (err instanceof TypeError && err.message.includes('fetch'))
      if (isNetworkError && tenantId) {
        await offlineDb.enqueueMutation({
          tenantId,
          entity: 'empresas',
          action: 'delete',
          targetId: id,
          payload: {},
        })
        await offlineDb.removeSingleCacheRecord(tenantId, 'empresas', id)
        return true
      }
      throw err
    }
  },
}

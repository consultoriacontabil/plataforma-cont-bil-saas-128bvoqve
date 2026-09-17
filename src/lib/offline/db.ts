/**
 * Camada de Persistência Offline via IndexedDB nativo (Zero Dependências Externas)
 * Plataforma Contábil SaaS - Rumo Consultoria Contábil
 *
 * Características:
 * - Isolamento multi-tenant por tenant_id
 * - Cache de leitura para entidades frequentes (empresas, documentos, obrigacoes, funcionarios, financeiro)
 * - Outbox: fila de mutações offline para sincronização sequencial com timestamp e contagem de tentativas
 * - Detecção de conflitos otimista (baseada no updated do servidor)
 */

import { isOfflineModeEnabled } from './offlineControl'

export interface OutboxItem {
  id: string // UUID local ou gerado
  tenantId: string
  entity: 'empresas' | 'documentos' | 'obrigacoes' | 'funcionarios' | 'contas_financeiras'
  action: 'create' | 'update' | 'delete'
  targetId?: string // ID do registro no PocketBase quando update/delete
  payload: Record<string, unknown>
  originalUpdated?: string // timestamp 'updated' conhecido para detecção de conflito
  createdAt: string
  attempts: number
  lastError?: string
}

export interface CachedRecord<T = Record<string, unknown>> {
  id: string
  tenantId: string
  collection: string
  data: T
  cachedAt: string
}

const DB_NAME = 'rumo_contabil_offline_db'
const DB_VERSION = 1

class OfflineDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB não suportado neste navegador.'))
        return
      }

      const req = window.indexedDB.open(DB_NAME, DB_VERSION)

      req.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Store para entidades cacheadas (leitura offline isolada por tenant)
        if (!db.objectStoreNames.contains('entity_cache')) {
          const cacheStore = db.createObjectStore('entity_cache', { keyPath: 'compositeKey' })
          cacheStore.createIndex('tenantId', 'tenantId', { unique: false })
          cacheStore.createIndex('collection', 'collection', { unique: false })
          cacheStore.createIndex('tenant_collection', ['tenantId', 'collection'], { unique: false })
        }

        // Store para a fila de mutações outbox (gravação offline)
        if (!db.objectStoreNames.contains('outbox')) {
          const outboxStore = db.createObjectStore('outbox', { keyPath: 'id' })
          outboxStore.createIndex('tenantId', 'tenantId', { unique: false })
          outboxStore.createIndex('createdAt', 'createdAt', { unique: false })
        }

        // Store para preferências e metadados locais
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' })
        }
      }

      req.onsuccess = () => {
        resolve(req.result)
      }

      req.onerror = () => {
        reject(req.error)
      }
    })

    return this.dbPromise
  }

  // --- ENTITY CACHE (LEITURA) ---

  async saveCollectionCache<T extends { id: string }>(
    tenantId: string,
    collection: string,
    items: T[],
  ): Promise<void> {
    if (!tenantId || !collection) return
    // Respeita flag global: se offline desativado, nenhum cache é gravado
    if (!isOfflineModeEnabled(tenantId)) return

    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const tx = db.transaction('entity_cache', 'readwrite')
      const store = tx.objectStore('entity_cache')

      const now = new Date().toISOString()
      items.forEach((item) => {
        const compositeKey = `${tenantId}:${collection}:${item.id}`
        store.put({
          compositeKey,
          id: item.id,
          tenantId,
          collection,
          data: item,
          cachedAt: now,
        })
      })

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async getCollectionCache<T>(tenantId: string, collection: string): Promise<T[]> {
    if (!tenantId || !collection) return []
    // Se offline desativado, não retorna dados do cache local
    if (!isOfflineModeEnabled(tenantId)) return []

    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const tx = db.transaction('entity_cache', 'readonly')
      const store = tx.objectStore('entity_cache')
      const index = store.index('tenant_collection')
      const req = index.getAll(IDBKeyRange.only([tenantId, collection]))

      req.onsuccess = () => {
        const results = req.result || []
        const dataList = results.map((r) => r.data as T)
        resolve(dataList)
      }
      req.onerror = () => reject(req.error)
    })
  }

  async getRecordCache<T>(tenantId: string, collection: string, id: string): Promise<T | null> {
    if (!tenantId || !collection || !id) return null
    // Se offline desativado, não retorna registro do cache local
    if (!isOfflineModeEnabled(tenantId)) return null

    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const tx = db.transaction('entity_cache', 'readonly')
      const store = tx.objectStore('entity_cache')
      const compositeKey = `${tenantId}:${collection}:${id}`
      const req = store.get(compositeKey)

      req.onsuccess = () => {
        if (req.result && req.result.data) {
          resolve(req.result.data as T)
        } else {
          resolve(null)
        }
      }
      req.onerror = () => reject(req.error)
    })
  }

  // Atualizar registro único no cache (ex: edição/criação offline pré-sincronizada)
  async putSingleCacheRecord<T extends { id: string }>(
    tenantId: string,
    collection: string,
    item: T,
  ): Promise<void> {
    if (!tenantId || !collection) return
    // Respeita flag global: se offline desativado, não grava no IndexedDB
    if (!isOfflineModeEnabled(tenantId)) return

    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('entity_cache', 'readwrite')
      const store = tx.objectStore('entity_cache')
      const compositeKey = `${tenantId}:${collection}:${item.id}`
      store.put({
        compositeKey,
        id: item.id,
        tenantId,
        collection,
        data: item,
        cachedAt: new Date().toISOString(),
      })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  // Deletar registro do cache local
  async removeSingleCacheRecord(tenantId: string, collection: string, id: string): Promise<void> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('entity_cache', 'readwrite')
      const store = tx.objectStore('entity_cache')
      const compositeKey = `${tenantId}:${collection}:${id}`
      store.delete(compositeKey)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  // --- OUTBOX / MUTATION QUEUE (ESCRITA OFFLINE) ---

  async enqueueMutation(
    mutation: Omit<OutboxItem, 'id' | 'createdAt' | 'attempts'>,
  ): Promise<OutboxItem> {
    // Se o modo offline estiver desativado, NÃO enfileirar e lançar erro honesto de rede
    if (!isOfflineModeEnabled(mutation.tenantId)) {
      throw new Error(
        'Modo offline desativado. É necessária conexão com a internet para salvar alterações.',
      )
    }

    const db = await this.getDB()
    const id = `mut_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const item: OutboxItem = {
      ...mutation,
      id,
      createdAt: new Date().toISOString(),
      attempts: 0,
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction('outbox', 'readwrite')
      const store = tx.objectStore('outbox')
      store.add(item)
      tx.oncomplete = () => resolve(item)
      tx.onerror = () => reject(tx.error)
    })
  }

  async getOutboxItems(tenantId?: string): Promise<OutboxItem[]> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('outbox', 'readonly')
      const store = tx.objectStore('outbox')
      const req = store.getAll()

      req.onsuccess = () => {
        let results = (req.result as OutboxItem[]) || []
        if (tenantId) {
          results = results.filter((item) => item.tenantId === tenantId)
        }
        // Ordenar cronologicamente por createdAt para replay determinístico (FIFO)
        results.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        resolve(results)
      }
      req.onerror = () => reject(req.error)
    })
  }

  async getOutboxCount(tenantId?: string): Promise<number> {
    const items = await this.getOutboxItems(tenantId)
    return items.length
  }

  async removeOutboxItem(id: string): Promise<void> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('outbox', 'readwrite')
      const store = tx.objectStore('outbox')
      store.delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async updateOutboxItem(item: OutboxItem): Promise<void> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('outbox', 'readwrite')
      const store = tx.objectStore('outbox')
      store.put(item)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  // --- LIMPEZA DE DADOS LOCAIS (PREFERÊNCIAS) ---

  async clearLocalData(): Promise<{ cachesCleared: number; outboxCleared: number }> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['entity_cache', 'outbox'], 'readwrite')
      const cacheStore = tx.objectStore('entity_cache')
      const outboxStore = tx.objectStore('outbox')

      const countCacheReq = cacheStore.count()
      const countOutboxReq = outboxStore.count()

      tx.oncomplete = () => {
        resolve({
          cachesCleared: countCacheReq.result || 0,
          outboxCleared: countOutboxReq.result || 0,
        })
      }
      tx.onerror = () => reject(tx.error)

      cacheStore.clear()
      outboxStore.clear()
    })
  }

  async getStorageStats(): Promise<{ cacheCount: number; outboxCount: number }> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['entity_cache', 'outbox'], 'readonly')
      const cacheStore = tx.objectStore('entity_cache')
      const outboxStore = tx.objectStore('outbox')

      let cacheCount = 0
      let outboxCount = 0

      const req1 = cacheStore.count()
      req1.onsuccess = () => {
        cacheCount = req1.result
      }

      const req2 = outboxStore.count()
      req2.onsuccess = () => {
        outboxCount = req2.result
      }

      tx.oncomplete = () => resolve({ cacheCount, outboxCount })
      tx.onerror = () => reject(tx.error)
    })
  }
}

export const offlineDb = new OfflineDatabase()

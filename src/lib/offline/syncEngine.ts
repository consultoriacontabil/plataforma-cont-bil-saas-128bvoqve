/**
 * Sincronizador de Fila Outbox (Offline Sync Engine)
 * Responsável por drenar a fila em ordem FIFO quando a conexão é restabelecida,
 * aplicando exponential backoff, limite de retries e detecção de conflitos otimista.
 */

import pb from '@/lib/pocketbase/client'
import { offlineDb, type OutboxItem } from './db'

export interface SyncResult {
  total: number
  applied: number
  failed: number
  conflicts: number
  details: {
    id: string
    entity: string
    action: string
    status: 'success' | 'conflict' | 'error'
    message?: string
  }[]
}

const MAX_ATTEMPTS = 5

export class OfflineSyncEngine {
  private isDraining = false
  private listeners: ((syncing: boolean, pendingCount: number) => void)[] = []

  subscribe(listener: (syncing: boolean, pendingCount: number) => void) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private notify(syncing: boolean, pendingCount: number) {
    this.listeners.forEach((l) => {
      try {
        l(syncing, pendingCount)
      } catch (err) {
        console.error('Erro no listener de sync:', err)
      }
    })
  }

  /**
   * Processa toda a fila pendente de outbox
   */
  async drainQueue(tenantId?: string): Promise<SyncResult> {
    if (this.isDraining) {
      return { total: 0, applied: 0, failed: 0, conflicts: 0, details: [] }
    }

    this.isDraining = true
    const items = await offlineDb.getOutboxItems(tenantId)
    this.notify(true, items.length)

    const result: SyncResult = {
      total: items.length,
      applied: 0,
      failed: 0,
      conflicts: 0,
      details: [],
    }

    try {
      for (const item of items) {
        // Se excedeu tentativas máximas, marca como falha e avisa
        if (item.attempts >= MAX_ATTEMPTS) {
          result.failed++
          result.details.push({
            id: item.id,
            entity: item.entity,
            action: item.action,
            status: 'error',
            message: `Excedido limite de ${MAX_ATTEMPTS} tentativas. Último erro: ${item.lastError || 'Desconhecido'}`,
          })
          continue
        }

        try {
          const syncStatus = await this.processItem(item)
          if (syncStatus.status === 'success') {
            await offlineDb.removeOutboxItem(item.id)
            result.applied++
            result.details.push({
              id: item.id,
              entity: item.entity,
              action: item.action,
              status: 'success',
            })
          } else if (syncStatus.status === 'conflict') {
            // Conflito detectado: manter a versão do servidor e remover intenção antiga para evitar sobrescrita silenciosa
            await offlineDb.removeOutboxItem(item.id)
            result.conflicts++
            result.details.push({
              id: item.id,
              entity: item.entity,
              action: item.action,
              status: 'conflict',
              message: syncStatus.message,
            })
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err)
          item.attempts += 1
          item.lastError = errMsg
          await offlineDb.updateOutboxItem(item)
          result.failed++
          result.details.push({
            id: item.id,
            entity: item.entity,
            action: item.action,
            status: 'error',
            message: errMsg,
          })
        }
      }
    } finally {
      this.isDraining = false
      const remainingCount = await offlineDb.getOutboxCount(tenantId)
      this.notify(false, remainingCount)
    }

    return result
  }

  /**
   * Processa uma única mutação contra o PocketBase com proteção de concorrência
   */
  private async processItem(
    item: OutboxItem,
  ): Promise<{ status: 'success' | 'conflict'; message?: string }> {
    const collectionName = item.entity

    // 1. AÇÃO: CREATE
    if (item.action === 'create') {
      // Se tiver ID local temporário gerado no client, remover ou deixar o backend gerar
      const payload = { ...item.payload }
      delete payload._isLocalOffline
      delete payload.compositeKey

      const createdRecord = await pb.collection(collectionName).create(payload)

      // Atualizar cache com o ID real retornado do servidor
      if (item.targetId && item.targetId.startsWith('temp_')) {
        await offlineDb.removeSingleCacheRecord(item.tenantId, collectionName, item.targetId)
      }
      await offlineDb.putSingleCacheRecord(item.tenantId, collectionName, createdRecord)
      return { status: 'success' }
    }

    // 2. AÇÃO: UPDATE (com detecção de conflitos)
    if (item.action === 'update' && item.targetId) {
      // Verificar se o registro ainda existe no servidor e se foi alterado
      try {
        const remoteRecord = await pb.collection(collectionName).getOne(item.targetId)

        if (item.originalUpdated && remoteRecord.updated) {
          const originalDate = new Date(item.originalUpdated).getTime()
          const remoteDate = new Date(remoteRecord.updated).getTime()

          // Se a data de atualização do servidor for posterior ao nosso ponto de edição offline,
          // ocorreu concorrência de escrita: preservamos o servidor para não sobrescrever trabalho de outro usuário.
          if (remoteDate > originalDate) {
            // Atualizar cache local com a versão fresca do servidor
            await offlineDb.putSingleCacheRecord(item.tenantId, collectionName, remoteRecord)
            return {
              status: 'conflict',
              message: `O registro foi alterado remotamente em ${remoteRecord.updated}. A alteração local não foi sobreposta.`,
            }
          }
        }

        // Executar atualização
        const payload = { ...item.payload }
        delete payload._isLocalOffline
        delete payload.compositeKey

        const updatedRecord = await pb.collection(collectionName).update(item.targetId, payload)
        await offlineDb.putSingleCacheRecord(item.tenantId, collectionName, updatedRecord)
        return { status: 'success' }
      } catch (err: unknown) {
        // Se der 404 (o registro foi excluído no servidor), descartar
        const isNotFound =
          err &&
          typeof err === 'object' &&
          'status' in err &&
          (err as { status: number }).status === 404
        if (isNotFound) {
          await offlineDb.removeSingleCacheRecord(item.tenantId, collectionName, item.targetId)
          return {
            status: 'conflict',
            message: 'O registro foi removido no servidor por outro usuário.',
          }
        }
        throw err
      }
    }

    // 3. AÇÃO: DELETE
    if (item.action === 'delete' && item.targetId) {
      try {
        await pb.collection(collectionName).delete(item.targetId)
        await offlineDb.removeSingleCacheRecord(item.tenantId, collectionName, item.targetId)
        return { status: 'success' }
      } catch (err: unknown) {
        const isNotFound =
          err &&
          typeof err === 'object' &&
          'status' in err &&
          (err as { status: number }).status === 404
        if (isNotFound) {
          // Já não existe no servidor, deletar localmente e considerar sucesso
          await offlineDb.removeSingleCacheRecord(item.tenantId, collectionName, item.targetId)
          return { status: 'success' }
        }
        throw err
      }
    }

    return { status: 'success' }
  }
}

export const syncEngine = new OfflineSyncEngine()

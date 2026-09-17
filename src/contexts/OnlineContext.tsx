/**
 * Contexto e Hook Global useOnlineStatus
 * Monitora navigator.onLine + verificação ativa (ping) ao PocketBase
 * Expõe fila outbox, contador de pendências e função para forçar sincronização
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import pb from '@/lib/pocketbase/client'
import { offlineDb } from '@/lib/offline/db'
import { syncEngine, type SyncResult } from '@/lib/offline/syncEngine'
import { useToast } from '@/hooks/use-toast'

interface OnlineContextType {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  lastSyncResult: SyncResult | null
  syncNow: () => Promise<SyncResult | null>
  refreshPendingCount: () => Promise<number>
}

const OnlineContext = createContext<OnlineContextType | null>(null)

export function OnlineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true
  })
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [pendingCount, setPendingCount] = useState<number>(0)
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)
  const wasOfflineRef = useRef<boolean>(false)
  const { toast } = useToast()

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await offlineDb.getOutboxCount()
      setPendingCount(count)
      return count
    } catch {
      return 0
    }
  }, [])

  // Sincronizar fila manualmente ou ao retornar online
  const syncNow = useCallback(async (): Promise<SyncResult | null> => {
    if (!navigator.onLine) {
      toast({
        variant: 'destructive',
        title: 'Sem conexão com a internet',
        description:
          'Não é possível sincronizar no momento. As alterações continuam salvas no dispositivo.',
      })
      return null
    }

    setIsSyncing(true)
    try {
      const result = await syncEngine.drainQueue()
      setLastSyncResult(result)
      await refreshPendingCount()

      if (result.applied > 0 && result.conflicts === 0 && result.failed === 0) {
        toast({
          title: 'Sincronização concluída com sucesso',
          description: `${result.applied} alteraç${result.applied > 1 ? 'ões foram aplicadas' : 'ão foi aplicada'} no servidor.`,
        })
      } else if (result.conflicts > 0) {
        toast({
          variant: 'destructive',
          title: 'Conflito de sincronização detectado',
          description: `${result.conflicts} item(ns) foram alterados por outro usuário no servidor e preservados.`,
        })
      } else if (result.failed > 0) {
        toast({
          variant: 'destructive',
          title: 'Aviso de sincronização parcial',
          description: `${result.applied} aplicadas, mas ${result.failed} apresentaram erro e serão retentadas.`,
        })
      }

      return result
    } catch (err) {
      console.error('Erro na drenagem de outbox:', err)
      return null
    } finally {
      setIsSyncing(false)
    }
  }, [refreshPendingCount, toast])

  // Verificação ativa de saúde da rede (ping rápido ao backend)
  const checkConnectivity = useCallback(async () => {
    if (!navigator.onLine) {
      setIsOnline(false)
      wasOfflineRef.current = true
      return false
    }

    try {
      // Ping leve ao endpoint de saúde do PocketBase com timeout de 3.5s
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3500)
      const res = await fetch(`${pb.baseUrl}/api/health`, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      })
      clearTimeout(timeoutId)

      const reachable = res.ok
      setIsOnline(reachable)

      if (reachable && wasOfflineRef.current) {
        wasOfflineRef.current = false
        // Se voltou a ter sinal e temos pendências, disparar sync automático
        const count = await offlineDb.getOutboxCount()
        if (count > 0) {
          syncNow()
        }
      }
      return reachable
    } catch {
      setIsOnline(false)
      wasOfflineRef.current = true
      return false
    }
  }, [syncNow])

  useEffect(() => {
    refreshPendingCount()

    // Inscrever no syncEngine para saber se está sincronizando
    const unsubSync = syncEngine.subscribe((syncing, count) => {
      setIsSyncing(syncing)
      setPendingCount(count)
    })

    const handleOnline = () => {
      checkConnectivity()
    }

    const handleOffline = () => {
      setIsOnline(false)
      wasOfflineRef.current = true
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Intervalo de verificação de conectividade a cada 15 segundos
    const interval = setInterval(() => {
      checkConnectivity()
    }, 15000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
      unsubSync()
    }
  }, [checkConnectivity, refreshPendingCount])

  return (
    <OnlineContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingCount,
        lastSyncResult,
        syncNow,
        refreshPendingCount,
      }}
    >
      {children}
    </OnlineContext.Provider>
  )
}

export function useOnlineStatus() {
  const ctx = useContext(OnlineContext)
  if (!ctx) {
    throw new Error('useOnlineStatus deve ser utilizado dentro de um OnlineProvider')
  }
  return ctx
}

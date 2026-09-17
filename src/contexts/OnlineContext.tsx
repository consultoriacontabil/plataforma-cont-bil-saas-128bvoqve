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

import {
  isOfflineModeEnabled,
  setOfflineModeLocalState,
  subscribeToOfflineModeChange,
} from '@/lib/offline/offlineControl'

interface OnlineContextType {
  isOnline: boolean
  isOfflineModeActive: boolean
  isSyncing: boolean
  pendingCount: number
  lastSyncResult: SyncResult | null
  syncNow: () => Promise<SyncResult | null>
  refreshPendingCount: () => Promise<number>
  toggleOfflineMode: (enabled: boolean) => Promise<boolean>
}

const OnlineContext = createContext<OnlineContextType | null>(null)

export function OnlineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true
  })
  const [isOfflineModeActive, setIsOfflineModeActive] = useState<boolean>(() => {
    return isOfflineModeEnabled()
  })
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [pendingCount, setPendingCount] = useState<number>(0)
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)
  const wasOfflineRef = useRef<boolean>(false)
  const { toast } = useToast()

  // Sincronizar estado local de modo offline
  useEffect(() => {
    setIsOfflineModeActive(isOfflineModeEnabled())
    const unsub = subscribeToOfflineModeChange((enabled) => {
      setIsOfflineModeActive(enabled)
    })
    return () => unsub()
  }, [])

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
      if (isOfflineModeEnabled()) {
        toast({
          variant: 'destructive',
          title: 'Sem conexão com a internet',
          description:
            'Não é possível sincronizar no momento. As alterações continuam salvas no dispositivo.',
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Sem conexão com a internet',
          description:
            'Não é possível sincronizar no momento. Conecte-se à internet para continuar.',
        })
      }
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
        // Se voltou a ter sinal, somente dispara sync se o modo offline estiver ATIVO e houver pendências
        if (isOfflineModeEnabled()) {
          const count = await offlineDb.getOutboxCount()
          if (count > 0) {
            syncNow()
          }
        }
      }
      return reachable
    } catch {
      setIsOnline(false)
      wasOfflineRef.current = true
      return false
    }
  }, [syncNow])

  // Alternar modo offline para o tenant atual
  const toggleOfflineMode = useCallback(
    async (enabled: boolean): Promise<boolean> => {
      const tenantId = localStorage.getItem('rumo_current_tenant_id')
      if (!tenantId) {
        toast({
          variant: 'destructive',
          title: 'Erro ao alterar modo offline',
          description: 'Nenhum escritório ativo selecionado.',
        })
        return false
      }

      try {
        // 1. Atualizar no backend PocketBase
        await pb.collection('tenants').update(tenantId, {
          modo_offline: enabled,
        })

        // 2. Se estiver desligando, limpar qualquer mutação pendente ou avisar
        if (!enabled) {
          await offlineDb.clearLocalData()
          await refreshPendingCount()
        }

        // 3. Atualizar estado local
        setOfflineModeLocalState(tenantId, enabled)
        setIsOfflineModeActive(enabled)

        toast({
          title: enabled ? 'Modo Offline Ativado' : 'Modo Offline Desativado',
          description: enabled
            ? 'Alterações passarão a ser gravadas localmente quando a internet cair e sincronizadas automaticamente.'
            : 'A plataforma agora opera exclusivamente online. Nenhuma alteração é salva localmente sem conexão.',
        })
        return true
      } catch (err) {
        console.error('Falha ao atualizar modo offline:', err)
        toast({
          variant: 'destructive',
          title: 'Erro ao salvar preferência de modo offline',
          description: 'Não foi possível atualizar as configurações do escritório no servidor.',
        })
        return false
      }
    },
    [refreshPendingCount, toast],
  )

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
        isOfflineModeActive,
        isSyncing,
        pendingCount,
        lastSyncResult,
        syncNow,
        refreshPendingCount,
        toggleOfflineMode,
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

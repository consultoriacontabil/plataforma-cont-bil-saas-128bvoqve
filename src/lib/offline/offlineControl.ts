/**
 * Gerenciador e Verificador Central do Modo Offline
 *
 * Regras:
 * - O valor padrão é FALSE (desativado / online-only)
 * - Controlado por tenant (escritório) e refletido em tempo real na aplicação
 * - Quando desligado: nenhuma gravação em cache/IndexedDB e nenhuma mutação no outbox
 * - Notifica observadores (OnlineContext, componentes) imediatamente após alteração
 */

const OFFLINE_ENABLED_KEY_PREFIX = 'rumo_modo_offline_enabled_'
type OfflineChangeCallback = (enabled: boolean) => void

const subscribers: Set<OfflineChangeCallback> = new Set()

export function isOfflineModeEnabled(tenantId?: string | null): boolean {
  if (typeof window === 'undefined') return false
  const resolvedTenantId = tenantId || localStorage.getItem('rumo_current_tenant_id')
  if (!resolvedTenantId) return false

  const raw = localStorage.getItem(`${OFFLINE_ENABLED_KEY_PREFIX}${resolvedTenantId}`)
  // Se for explicitamente 'true', está ativado. Qualquer outro valor ou ausência = false (padrão desligado)
  return raw === 'true'
}

export function setOfflineModeLocalState(tenantId: string, enabled: boolean): void {
  if (typeof window === 'undefined' || !tenantId) return
  if (enabled) {
    localStorage.setItem(`${OFFLINE_ENABLED_KEY_PREFIX}${tenantId}`, 'true')
  } else {
    localStorage.setItem(`${OFFLINE_ENABLED_KEY_PREFIX}${tenantId}`, 'false')
  }
  // Notificar ouvintes
  subscribers.forEach((cb) => {
    try {
      cb(enabled)
    } catch (e) {
      console.error('Erro no subscriber de modo offline:', e)
    }
  })
}

export function subscribeToOfflineModeChange(cb: OfflineChangeCallback): () => void {
  subscribers.add(cb)
  return () => {
    subscribers.delete(cb)
  }
}

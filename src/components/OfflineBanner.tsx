import React from 'react'
import { WifiOff, AlertTriangle } from 'lucide-react'
import { useOnlineStatus } from '@/contexts/OnlineContext'

export function OfflineBanner() {
  const { isOnline } = useOnlineStatus()

  // Plataforma 100% online: se a conexão com a internet cair, avisa de forma simples e honesta
  if (isOnline) {
    return null
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      className="bg-amber-500/15 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 px-4 py-2 text-xs transition-all"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 font-medium">
          <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            <strong>Sem conexão com a internet.</strong> O sistema exige conexão ativa para salvar e
            carregar dados. Verifique sua rede para continuar operando normalmente.
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Operações pausadas até o retorno do sinal</span>
        </div>
      </div>
    </aside>
  )
}

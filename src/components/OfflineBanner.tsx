/**
 * Banner de Estado de Rede e Sincronização Offline
 * Exibido no topo da plataforma quando offline ou quando há alterações pendentes de sincronização
 */

import { useState } from 'react'
import { WifiOff, RefreshCw, CheckCircle2, AlertCircle, Database, Eye } from 'lucide-react'
import { useOnlineStatus } from '@/contexts/OnlineContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useLocation } from 'react-router-dom'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export function OfflineBanner() {
  const { isOnline, isSyncing, pendingCount, syncNow, lastSyncResult } = useOnlineStatus()
  const location = useLocation()
  const [manualSyncLoading, setManualSyncLoading] = useState(false)

  // Rotas que exigem conectividade com a rede real (SEFAZ, RFB, Emissão NFS-e, WhatsApp, Transmissão SPED)
  const isReadOnlyRoute =
    location.pathname.startsWith('/fiscal') ||
    location.pathname.startsWith('/nfse-whatsapp') ||
    location.pathname.startsWith('/simulador-reforma') ||
    location.pathname.startsWith('/monitoramento-legislativo') ||
    location.pathname.startsWith('/integracoes') ||
    location.pathname.startsWith('/extensao')

  const handleManualSync = async () => {
    setManualSyncLoading(true)
    try {
      await syncNow()
    } finally {
      setManualSyncLoading(false)
    }
  }

  // Não renderiza nada se estiver online e sem pendências de sincronização
  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-16 z-19 w-full bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] text-white border-b border-amber-500/30 px-4 py-2.5 shadow-md transition-all animate-in slide-in-from-top duration-300"
    >
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 text-xs">
        {/* Lado Esquerdo: Status e Indicadores */}
        <div className="flex items-center gap-3">
          {!isOnline ? (
            <div className="flex items-center gap-2 text-amber-400">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
              </span>
              <WifiOff className="h-4 w-4" />
              <span className="font-semibold text-white">Modo Offline Ativo</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-teal-400">
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="font-semibold text-white">
                {isSyncing ? 'Sincronizando com o servidor...' : 'Conexão restabelecida'}
              </span>
            </div>
          )}

          <span className="hidden sm:inline text-slate-300">
            {!isOnline
              ? 'As alterações estão sendo salvas com segurança no seu dispositivo e serão sincronizadas automaticamente assim que o sinal retornar.'
              : 'Preparando envio das alterações acumuladas localmente.'}
          </span>
        </div>

        {/* Lado Direito: Badges, Contador de Pendências e Botão de Ação */}
        <div className="flex items-center gap-2.5 ml-auto">
          {/* Badge Somente Leitura em telas que não operam offline */}
          {!isOnline && isReadOnlyRoute && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="border-amber-400/50 bg-amber-950/60 text-amber-300 gap-1.5 py-0.5 text-[11px] cursor-help"
                  >
                    <Eye className="h-3 w-3" />
                    <span>Modo Consulta / Rede Exigida</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs bg-slate-900 text-slate-100 border-slate-700">
                  Esta funcionalidade requer comunicação direta com SEFAZ, Receita Federal ou
                  serviços externos. Consultas locais continuam visíveis, mas transmissões e buscas
                  online ficam bloqueadas até a rede voltar.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Contador de Pendências */}
          {pendingCount > 0 && (
            <Badge className="bg-[#0FA3A3] text-white font-bold text-[11px] px-2 py-0.5 gap-1.5 shadow-xs">
              <Database className="h-3 w-3" />
              <span>
                {pendingCount} alteraç{pendingCount > 1 ? 'ões pendentes' : 'ão pendente'}
              </span>
            </Badge>
          )}

          {/* Botão para disparar sincronização manual quando a rede estiver presente */}
          {isOnline && (
            <Button
              size="sm"
              variant="outline"
              disabled={isSyncing || manualSyncLoading}
              onClick={handleManualSync}
              className="h-7 px-2.5 text-xs bg-slate-800 border-slate-600 text-white hover:bg-slate-700 hover:text-white"
            >
              <RefreshCw
                className={`h-3 w-3 mr-1.5 ${isSyncing || manualSyncLoading ? 'animate-spin' : ''}`}
              />
              {isSyncing || manualSyncLoading ? 'Sincronizando...' : 'Sincronizar Agora'}
            </Button>
          )}

          {/* Notificação de Conflitos Ocorridos */}
          {lastSyncResult && lastSyncResult.conflicts > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 text-amber-400 text-[11px] cursor-pointer">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>{lastSyncResult.conflicts} conflito(s)</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="text-xs bg-slate-900 border-slate-700">
                  Alterações remotas mais recentes foram preservadas para integridade dos dados
                  contábeis.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {lastSyncResult && lastSyncResult.applied > 0 && lastSyncResult.conflicts === 0 && (
            <span className="hidden md:flex items-center gap-1 text-emerald-400 text-[11px]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{lastSyncResult.applied} sincronizada(s)</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

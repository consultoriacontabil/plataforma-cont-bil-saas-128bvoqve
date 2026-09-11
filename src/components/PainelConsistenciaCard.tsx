import React from 'react'
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import type { AlertaValidacao } from '@/types'

interface PainelConsistenciaCardProps {
  alertas: AlertaValidacao[]
  onFocarCampo?: (campo: string) => void
  onAbrirUploadAssistido?: () => void
}

export function PainelConsistenciaCard({
  alertas,
  onFocarCampo,
  onAbrirUploadAssistido,
}: PainelConsistenciaCardProps) {
  const [expandido, setExpandido] = React.useState(true)

  const inconsistencias = alertas.filter((a) => a.categoria === 'inconsistencia')
  const ausencias = alertas.filter((a) => a.categoria === 'ausencia')
  const atencoes = alertas.filter((a) => a.categoria === 'atencao')

  if (alertas.length === 0) return null

  return (
    <Card className="rounded-2xl border-[#E2E8F0] shadow-xs overflow-hidden">
      <CardHeader className="p-4 bg-slate-50/80 border-b border-slate-100 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold text-[#1A2333]">
              Painel de Consistência & Validação do Cadastro
            </CardTitle>
            <p className="text-[11px] text-[#64748B]">
              Diagnóstico automático de divergências, inconsistências e ausência de informações
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5">
            {inconsistencias.length > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] bg-red-50 text-red-700 border-red-200"
              >
                {inconsistencias.length} inconsistência(s)
              </Badge>
            )}
            {ausencias.length > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] bg-amber-50 text-amber-800 border-amber-200"
              >
                {ausencias.length} ausência(s)
              </Badge>
            )}
            {atencoes.length > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"
              >
                {atencoes.length} atenção(ões)
              </Badge>
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpandido(!expandido)}
            className="h-8 w-8 p-0 rounded-lg text-[#64748B]"
          >
            {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {expandido && (
        <CardContent className="p-4 space-y-2.5">
          <div className="space-y-2">
            {alertas.slice(0, 8).map((alerta) => {
              const isInconsistente = alerta.categoria === 'inconsistencia'
              const isAusencia = alerta.categoria === 'ausencia'

              return (
                <div
                  key={alerta.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                    isInconsistente
                      ? 'bg-red-50/50 border-red-200 text-red-900'
                      : isAusencia
                        ? 'bg-amber-50/50 border-amber-200 text-amber-900'
                        : 'bg-blue-50/50 border-blue-200 text-blue-900'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isInconsistente ? (
                      <AlertCircle className="h-4 w-4 text-[#EF4444] shrink-0" />
                    ) : isAusencia ? (
                      <AlertTriangle className="h-4 w-4 text-[#F59E0B] shrink-0" />
                    ) : (
                      <Info className="h-4 w-4 text-[#3B82F6] shrink-0" />
                    )}
                    <div className="truncate">
                      <span className="font-semibold">{alerta.titulo}: </span>
                      <span className="text-[#475569]">{alerta.mensagem}</span>
                    </div>
                  </div>

                  {alerta.campoRelacionado && onFocarCampo && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onFocarCampo(alerta.campoRelacionado!)}
                      className="text-[11px] h-6 px-2 shrink-0 text-[#0FA3A3] hover:text-[#0C8585] font-medium"
                    >
                      <span>Corrigir</span>
                      <ExternalLink className="h-2.5 w-2.5 ml-1" />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>

          {alertas.length > 8 && (
            <p className="text-[11px] text-center text-[#64748B] pt-1">
              +{alertas.length - 8} outras sugestões disponíveis no Cadastro Assistido.
            </p>
          )}

          {onAbrirUploadAssistido && (
            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAbrirUploadAssistido}
                className="text-xs h-8 rounded-xl border-[#0FA3A3] text-[#0FA3A3] hover:bg-[#F0FDFA]"
              >
                Abrir Assistente de Documentos para Preenchimento
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

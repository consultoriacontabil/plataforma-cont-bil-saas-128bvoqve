import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Bot, ShieldAlert, CheckCircle2, AlertTriangle, KeyRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export type TipoIntegracaoAutonomia = 'certificado_a1' | 'evolution_api' | 'geral'

export interface BadgeTransmissaoAutonomiaProps {
  /**
   * Tipo da credencial que governa esta transmissão.
   * - 'certificado_a1': Certificado digital e-CNPJ A1 (e-Social, DCTFWeb, Reinf, SPED)
   * - 'evolution_api': Evolution API / WhatsApp
   * - 'geral': Genérico
   */
  tipo?: TipoIntegracaoAutonomia
  /**
   * Se a credencial do contexto (empresa ou tenant) está válida e ativa
   */
  isCredenciado: boolean
  /**
   * Texto explicativo ou detalhe (ex: 'Certificado vence em 45 dias' ou 'Aguardando credenciais Evolution API')
   */
  detalhe?: string
  /**
   * Rota para onde o usuário pode ir configurar caso esteja em supervisão
   */
  configUrl?: string
  /**
   * Tamanho / variação do badge
   */
  size?: 'sm' | 'md'
  /**
   * Classes extras
   */
  className?: string
  /**
   * Se true, oculta link de atalho no tooltip
   */
  semLink?: boolean
}

/**
 * Badge dinâmico de credenciais e autonomia para telas de transmissão fiscal e DP.
 * Reflete estritamente o estado real:
 * - Credencial válida = "Automático (credenciado)"
 * - Sem credencial / inválida = "Modo Supervisão (aguardando credenciais)"
 */
export function BadgeTransmissaoAutonomia({
  tipo = 'certificado_a1',
  isCredenciado,
  detalhe,
  configUrl = tipo === 'certificado_a1' ? '/obrigacoes' : '/integracoes',
  size = 'md',
  className,
  semLink = false,
}: BadgeTransmissaoAutonomiaProps) {
  const isSm = size === 'sm'

  const labelPrincipal = isCredenciado ? 'Automático (credenciado)' : 'Modo Supervisão'

  const rotuloTipo =
    tipo === 'certificado_a1'
      ? 'e-CNPJ A1'
      : tipo === 'evolution_api'
        ? 'Evolution API'
        : 'Credencial'

  const tooltipTextoPadrao = isCredenciado
    ? `Credencial ${rotuloTipo} válida e vinculada. Transmissões e rotinas operam com autonomia total.`
    : `Credencial ${rotuloTipo} pendente, vencida ou não vinculada. Transmissão retida em Modo Supervisão para auditoria contábil humana.`

  const tooltipTexto = detalhe || tooltipTextoPadrao

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('inline-flex items-center gap-1.5 cursor-default', className)}>
            {isCredenciado ? (
              <Badge
                className={cn(
                  'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold tracking-wide flex items-center gap-1 shadow-2xs hover:bg-emerald-500/30 transition-colors',
                  isSm ? 'text-[10px] px-2 py-0.5' : 'text-[11px] px-2.5 py-1',
                )}
              >
                <CheckCircle2
                  className={cn('shrink-0 text-emerald-400', isSm ? 'h-3 w-3' : 'h-3.5 w-3.5')}
                />
                <span>{labelPrincipal}</span>
              </Badge>
            ) : (
              <Badge
                className={cn(
                  'bg-amber-400/20 text-amber-300 border border-amber-400/30 font-semibold tracking-wide flex items-center gap-1 shadow-2xs hover:bg-amber-400/30 transition-colors',
                  isSm ? 'text-[10px] px-2 py-0.5' : 'text-[11px] px-2.5 py-1',
                )}
              >
                <ShieldAlert
                  className={cn('shrink-0 text-amber-400', isSm ? 'h-3 w-3' : 'h-3.5 w-3.5')}
                />
                <span>{labelPrincipal}</span>
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs text-xs p-3 space-y-1.5 bg-slate-900 text-white border-slate-700"
        >
          <div className="flex items-center gap-1.5 font-bold">
            {isCredenciado ? (
              <>
                <Bot className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-300">Autonomia Liberada</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-amber-300">Supervisão Humana Ativa</span>
              </>
            )}
          </div>
          <p className="text-slate-300 text-[11px] leading-relaxed">{tooltipTexto}</p>
          {!isCredenciado && !semLink && (
            <div className="pt-1 border-t border-slate-800">
              <Link
                to={configUrl}
                className="text-[11px] text-[#0FA3A3] hover:text-teal-300 hover:underline flex items-center gap-1 font-semibold"
              >
                <KeyRound className="h-3 w-3" />
                <span>Configurar credenciais</span>
              </Link>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

import React, { useState, useEffect } from 'react'
import {
  EllizaComando,
  EllizaComandoTipo,
  ellizaComandosService,
} from '@/services/ellizaComandosService'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Terminal,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  ShieldCheck,
  FileText,
  Activity,
  Zap,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatDatePtBr } from '@/lib/formatters'

interface PainelComandosEllizaProps {
  tenantId: string
  onRefresh?: () => void
}

export function PainelComandosElliza({ tenantId }: PainelComandosEllizaProps) {
  const [comandos, setComandos] = useState<EllizaComando[]>([])
  const [carregando, setCarregando] = useState(false)
  const { toast } = useToast()

  const carregarComandos = async () => {
    if (!tenantId) return
    setCarregando(true)
    try {
      const lista = await ellizaComandosService.listar(tenantId, 50)
      setComandos(lista)
    } catch (err) {
      console.error('Erro ao carregar comandos:', err)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarComandos()
    const timer = setInterval(carregarComandos, 15000)
    return () => clearInterval(timer)
  }, [tenantId])

  // Contadores para data-total-* e telemetria Trilha RPA v1.0
  const total = comandos.length
  const pendentes = comandos.filter((c) => c.status === 'pendente').length
  const emExecucao = comandos.filter(
    (c) => c.status === 'em_execucao' || c.status === 'aceito',
  ).length
  const concluidos = comandos.filter((c) => c.status === 'concluido').length
  const erros = comandos.filter((c) => c.status === 'erro').length
  const expirados = comandos.filter((c) => c.status === 'expirado').length

  const renderBadgeStatus = (status: string) => {
    switch (status) {
      case 'pendente':
        return (
          <Badge className="bg-amber-500 text-white font-mono text-[10px] uppercase font-bold">
            Pendente
          </Badge>
        )
      case 'aceito':
      case 'em_execucao':
        return (
          <Badge className="bg-blue-600 text-white font-mono text-[10px] uppercase font-bold animate-pulse">
            Em Execução
          </Badge>
        )
      case 'concluido':
        return (
          <Badge className="bg-emerald-600 text-white font-mono text-[10px] uppercase font-bold">
            Concluído
          </Badge>
        )
      case 'erro':
        return (
          <Badge className="bg-red-600 text-white font-mono text-[10px] uppercase font-bold">
            Erro Honesto
          </Badge>
        )
      case 'expirado':
        return (
          <Badge className="bg-slate-500 text-white font-mono text-[10px] uppercase font-bold">
            Expirado
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="font-mono text-[10px]">
            {status}
          </Badge>
        )
    }
  }

  return (
    <Card
      id="rpa-grid-comandos-elliza"
      data-rpa-status={carregando ? 'loading' : 'loaded'}
      data-total-comandos={total}
      data-total-pendentes={pendentes}
      data-total-em-execucao={emExecucao}
      data-total-concluidos={concluidos}
      data-total-erros={erros}
      data-total-expirados={expirados}
      className="rounded-2xl border-slate-200 bg-white p-5 shadow-xs space-y-4"
    >
      {/* Cabeçalho do Painel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-teal-500/10 rounded-xl border border-teal-500/20 text-[#0FA3A3]">
            <Terminal className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm text-slate-900 tracking-tight">
                Canal de Comandos ELLIZA Desktop (Trilha RPA v1.0)
              </h3>
              <Badge className="bg-[#0FA3A3] text-white text-[9px] font-bold">
                Assíncrono • Idempotente
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Canal de descida (a ELLIZA desktop conecta-se para fora via SSE/Polling; a nuvem nunca
              abre porta de entrada)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={carregarComandos}
            disabled={carregando}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${carregando ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Grid de Telemetria Trilha RPA v1.0 (Indicadores data-total-*) */}
      <div
        id="rpa-telemetria-comandos"
        data-total-comandos={total}
        data-total-pendentes={pendentes}
        data-total-em-execucao={emExecucao}
        data-total-concluidos={concluidos}
        data-total-erros={erros}
        data-total-expirados={expirados}
        className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs"
      >
        <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60">
          <span className="text-[10px] text-slate-500 uppercase font-bold block">Total</span>
          <strong className="text-slate-900 text-base font-black">{total}</strong>
        </div>
        <div className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/60">
          <span className="text-[10px] text-amber-800 uppercase font-bold block">Pendentes</span>
          <strong className="text-amber-900 text-base font-black">{pendentes}</strong>
        </div>
        <div className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/60">
          <span className="text-[10px] text-blue-800 uppercase font-bold block">Em Execução</span>
          <strong className="text-blue-900 text-base font-black">{emExecucao}</strong>
        </div>
        <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60">
          <span className="text-[10px] text-emerald-800 uppercase font-bold block">Concluídos</span>
          <strong className="text-emerald-950 text-base font-black">{concluidos}</strong>
        </div>
        <div className="p-2.5 rounded-xl border border-red-200 bg-red-50/60">
          <span className="text-[10px] text-red-800 uppercase font-bold block">Erro Honesto</span>
          <strong className="text-red-950 text-base font-black">{erros}</strong>
        </div>
        <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-100/60">
          <span className="text-[10px] text-slate-500 uppercase font-bold block">Expirados</span>
          <strong className="text-slate-700 text-base font-black">{expirados}</strong>
        </div>
      </div>

      {/* Indicador de Conclusão da Trilha RPA v1.0 */}
      <div
        id="rpa-status-conclusao"
        data-rpa-state={erros > 0 ? 'error' : concluidos > 0 ? 'success' : 'open'}
        data-rpa-resultado={
          erros > 0
            ? 'Há comandos com parada honesta registrada para supervisão humana.'
            : concluidos > 0
              ? 'Comandos concluídos com evidências auditadas.'
              : 'Aguardando processamento pela ELLIZA desktop.'
        }
        className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
          erros > 0
            ? 'bg-red-50/80 border-red-200 text-red-950'
            : concluidos > 0
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}
      >
        <div className="flex items-center gap-2">
          {erros > 0 ? (
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
          ) : concluidos > 0 ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <Activity className="h-4 w-4 text-[#0FA3A3] shrink-0" />
          )}
          <span className="font-medium">
            {erros > 0
              ? 'Parada honesta ativa: existem comandos rejeitados por validação dura ou falta de evidência.'
              : concluidos > 0
                ? 'Último ciclo do scanner executado com êxito e escrituração fiscal registrada.'
                : 'Fila de comandos conectada. A ELLIZA desktop consulta periodicamente os comandos pendentes.'}
          </span>
        </div>
        <span className="font-mono text-[10px] text-slate-500">Trilha RPA v1.0</span>
      </div>

      {/* Tabela de Comandos */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[10px]">
              <th className="py-2.5 px-3">Nonce / ID</th>
              <th className="py-2.5 px-3">Tipo do Comando</th>
              <th className="py-2.5 px-3">Empresa / Cliente</th>
              <th className="py-2.5 px-3">Agente</th>
              <th className="py-2.5 px-3">Prioridade</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Resultado / Erro Honesto</th>
              <th className="py-2.5 px-3">Criado em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {comandos.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  <Terminal className="h-6 w-6 text-slate-300 mx-auto mb-1.5" />
                  <span className="font-semibold block text-slate-700">Nenhum comando na fila</span>
                  <span className="text-[11px] text-slate-400">
                    Dispare extrair_documento no GED ou comandos via API para enfileirar tarefas.
                  </span>
                </td>
              </tr>
            ) : (
              comandos.map((cmd) => {
                const empNome =
                  cmd.expand?.empresa_id?.nome_fantasia ||
                  cmd.expand?.empresa_id?.razao_social ||
                  '—'
                const payloadDocId = (cmd.payload as any)?.documento_id || '—'

                return (
                  <tr
                    key={cmd.id}
                    className="hover:bg-slate-50/80 transition-colors"
                    data-comando-id={cmd.id}
                    data-comando-tipo={cmd.tipo}
                    data-comando-status={cmd.status}
                    data-comando-nonce={cmd.nonce}
                  >
                    {/* Nonce / ID */}
                    <td className="py-2.5 px-3 font-mono text-[11px] align-top">
                      <span
                        className="font-bold text-slate-900 block truncate max-w-[130px]"
                        title={cmd.nonce}
                      >
                        {cmd.nonce}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        ID: {cmd.id}
                      </span>
                    </td>

                    {/* Tipo */}
                    <td className="py-2.5 px-3 align-top">
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] text-slate-800 bg-slate-50"
                      >
                        {cmd.tipo}
                      </Badge>
                      {payloadDocId !== '—' && (
                        <span className="text-[10px] text-slate-500 block mt-0.5 font-mono truncate max-w-[140px]">
                          Doc: {payloadDocId}
                        </span>
                      )}
                    </td>

                    {/* Empresa */}
                    <td className="py-2.5 px-3 align-top max-w-[160px]">
                      <span className="font-medium text-slate-800 block truncate" title={empNome}>
                        {empNome}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {cmd.empresa_id || '—'}
                      </span>
                    </td>

                    {/* Agente */}
                    <td className="py-2.5 px-3 align-top font-mono text-[11px] text-slate-600">
                      {cmd.agente || 'elliza-desktop-rpa'}
                    </td>

                    {/* Prioridade */}
                    <td className="py-2.5 px-3 align-top font-bold text-slate-700">
                      P{cmd.prioridade ?? 3}
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-3 align-top">{renderBadgeStatus(cmd.status)}</td>

                    {/* Resultado / Erro */}
                    <td className="py-2.5 px-3 align-top max-w-[240px]">
                      {cmd.status === 'concluido' && (
                        <div className="text-[11px] text-emerald-800 space-y-0.5">
                          <span className="font-bold flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                            NF-e: {(cmd.resultado as any)?.numero || 'Extraída'}
                          </span>
                          {(cmd.resultado as any)?.valor_total && (
                            <span className="text-[10px] text-slate-600 block">
                              Total: R$ {Number((cmd.resultado as any).valor_total).toFixed(2)} |
                              CFOP: {(cmd.resultado as any).cfop || '—'}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 block font-mono">
                            Evidências: {cmd.evidencias?.length || 0}
                          </span>
                        </div>
                      )}

                      {cmd.status === 'erro' && (
                        <div className="text-[11px] text-red-800 space-y-0.5 bg-red-50/80 p-1.5 rounded border border-red-200">
                          <span className="font-bold flex items-center gap-1 text-red-900">
                            <AlertTriangle className="h-3 w-3 text-red-600 shrink-0" />
                            {cmd.erro?.codigo || 'ERRO'}
                          </span>
                          <p className="text-[10px] text-red-700 leading-snug line-clamp-2">
                            {cmd.erro?.motivo || 'Falha reportada.'}
                          </p>
                          {cmd.erro?.referencia_pendencia && (
                            <span className="text-[9px] text-amber-900 font-mono block">
                              Pendência: {cmd.erro.referencia_pendencia}
                            </span>
                          )}
                        </div>
                      )}

                      {cmd.status === 'pendente' && (
                        <span className="text-[11px] text-amber-700 font-mono">
                          Aguardando aceite da ELLIZA desktop
                        </span>
                      )}

                      {cmd.status === 'em_execucao' && (
                        <span className="text-[11px] text-blue-700 font-mono animate-pulse">
                          Executando localmente no PC...
                        </span>
                      )}

                      {cmd.status === 'expirado' && (
                        <span className="text-[11px] text-slate-500 font-mono">
                          Expirado sem aceite
                        </span>
                      )}
                    </td>

                    {/* Criado em */}
                    <td className="py-2.5 px-3 align-top text-slate-500 whitespace-nowrap text-[11px]">
                      {formatDatePtBr(cmd.created)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

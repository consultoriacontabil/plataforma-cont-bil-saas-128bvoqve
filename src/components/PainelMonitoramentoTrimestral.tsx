import React, { useState, useEffect } from 'react'
import {
  Clock,
  Play,
  History,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Info,
  CheckCircle2,
  Calendar,
  Building2,
  Eye,
  FileSpreadsheet,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import type { RankingTrimestralRecord, AlertaVariacaoRanking } from '@/types'
import { monitoramentoTrimestralService } from '@/services/monitoramentoTrimestral'
import type { EmpresaImpactoSetorial } from '@/services/relatorioSetorial'

interface PainelMonitoramentoTrimestralProps {
  tenantId: string
  tenantNome?: string
  usuarioId?: string
  canExecute?: boolean
  onAnaliseConcluida?: () => void
}

export function PainelMonitoramentoTrimestral({
  tenantId,
  tenantNome = 'Rumo Consultoria Contábil',
  usuarioId,
  canExecute = true,
  onAnaliseConcluida,
}: PainelMonitoramentoTrimestralProps) {
  const { toast } = useToast()
  const [snapshots, setSnapshots] = useState<RankingTrimestralRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [modalSnapshot, setModalSnapshot] = useState<RankingTrimestralRecord | null>(null)

  const carregarSnapshots = async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const lista = await monitoramentoTrimestralService.listarSnapshots(tenantId)
      setSnapshots(lista)
    } catch (err) {
      console.warn('Erro ao carregar snapshots do monitoramento:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarSnapshots()
  }, [tenantId])

  const handleExecutarAgora = async () => {
    if (!tenantId) return
    setExecuting(true)
    try {
      const res = await monitoramentoTrimestralService.executarAnaliseManual(tenantId, usuarioId)
      toast({
        title: 'Análise Trimestral Concluída!',
        description: `Snapshot ${res.snapshotCriado.periodo} registrado. ${
          res.alertasGerados.length > 0
            ? `${res.alertasGerados.length} alerta(s) de variação relevante disparado(s).`
            : 'Nenhuma variação relevante identificada vs. rodada anterior.'
        }`,
      })
      await carregarSnapshots()
      if (onAnaliseConcluida) {
        onAnaliseConcluida()
      }
    } catch (err) {
      console.error('Erro na execução do recálculo trimestral:', err)
      toast({
        title: 'Erro ao executar análise',
        description: 'Não foi possível concluir a rodada trimestral. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setExecuting(false)
    }
  }

  const formatBRL = (val?: number) => {
    return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  const ultimoSnapshot = snapshots[0] || null
  const snapshotAnterior = snapshots.length > 1 ? snapshots[1] : null

  // Alertas de variação registrados no último snapshot
  const alertasUltimo: AlertaVariacaoRanking[] = ultimoSnapshot?.alertas_variacao_json || []

  return (
    <div className="space-y-4">
      {/* BANNER INFORMATIVO: GOVERNANÇA DO MONITORAMENTO & ALÍQUOTAS DO COMITÊ GESTOR */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/90 to-teal-50/70 border border-blue-200/80 text-xs text-blue-950 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
            <Info className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-[#123B6D]">
                Monitoramento Trimestral Agendado da Carteira
              </span>
              <Badge
                variant="outline"
                className="text-[10px] bg-white border-blue-300 font-semibold"
              >
                Cron Trimestral Ativo
              </Badge>
            </div>
            <p className="text-[11px] text-blue-900 leading-relaxed max-w-3xl">
              <b>Nota de Governança:</b> O sistema não detecta publicações automáticas no Diário
              Oficial. Os parâmetros normativos (EC 132/2023 e LC 214/2025) são mantidos e
              atualizados centralmente na plataforma (em{' '}
              <code className="bg-blue-100/80 px-1 py-0.5 rounded font-mono text-[10px]">
                src/lib/reformaTributaria/parametros.ts
              </code>
              ). A recalculação de impacto de cada empresa da sua carteira é executada
              trimestralmente pelo motor de background ou sob demanda. Quando novas alíquotas ou
              dados de faturamento são consolidados, o comparador automático detecta variações de
              impacto (|Δ| ≥ 10% ou ≥ R$ 50.000) e notifica o contador.
            </p>
          </div>
        </div>

        {canExecute && (
          <Button
            type="button"
            size="sm"
            onClick={handleExecutarAgora}
            disabled={executing}
            className="gap-2 rounded-xl text-xs font-semibold h-10 px-4 bg-[#0FA3A3] hover:bg-[#0c8282] text-white shadow-xs shrink-0 self-start md:self-center"
          >
            <Play className={`h-3.5 w-3.5 ${executing ? 'animate-spin' : ''}`} />
            <span>{executing ? 'Recalculando Carteira...' : 'Executar Análise Agora'}</span>
          </Button>
        )}
      </div>

      {/* SÍNTESE DA ÚLTIMA RODADA & COMPARATIVO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Última Rodada */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Última Rodada Executada
              </span>
              <Badge className="bg-[#123B6D] text-white text-[10px]">
                {ultimoSnapshot ? ultimoSnapshot.periodo : 'Sem histórico'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {ultimoSnapshot ? (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-extrabold text-[#1A2333]">
                    {formatBRL(ultimoSnapshot.impacto_total_acumulado)}
                  </span>
                  <span className="text-[11px] text-[#64748B]">impacto total carteira</span>
                </div>
                <div className="text-[11px] text-[#64748B] space-y-1 border-t border-slate-100 pt-2">
                  <div className="flex justify-between">
                    <span>Data da análise:</span>
                    <span className="font-semibold text-[#1A2333]">
                      {ultimoSnapshot.data_execucao
                        ? new Date(ultimoSnapshot.data_execucao).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Empresas avaliadas:</span>
                    <span className="font-semibold text-[#1A2333]">
                      {ultimoSnapshot.total_suficientes || ultimoSnapshot.total_empresas} de{' '}
                      {ultimoSnapshot.total_empresas}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Origem da rodada:</span>
                    <span className="font-semibold capitalize text-[#0FA3A3]">
                      {ultimoSnapshot.executado_por_tipo === 'cron_trimestral'
                        ? 'Job Agendado (03h)'
                        : 'Manual por Contador'}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-[#94A3B8] py-4">Nenhum snapshot trimestral encontrado.</p>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Comparativo vs Rodada Anterior */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Comparativo vs. Rodada Anterior
              </span>
              <Badge variant="outline" className="text-[10px] text-slate-600 border-slate-300">
                {snapshotAnterior ? snapshotAnterior.periodo : 'Base inicial'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {ultimoSnapshot && snapshotAnterior ? (
              <>
                {(() => {
                  const difTotal =
                    (ultimoSnapshot.impacto_total_acumulado || 0) -
                    (snapshotAnterior.impacto_total_acumulado || 0)
                  const difPercent =
                    snapshotAnterior.impacto_total_acumulado &&
                    snapshotAnterior.impacto_total_acumulado !== 0
                      ? (difTotal / Math.abs(snapshotAnterior.impacto_total_acumulado)) * 100
                      : 0

                  return (
                    <>
                      <div className="flex items-baseline justify-between">
                        <span
                          className={`text-xl font-extrabold flex items-center gap-1 ${
                            difTotal > 0
                              ? 'text-amber-600'
                              : difTotal < 0
                                ? 'text-emerald-600'
                                : 'text-slate-700'
                          }`}
                        >
                          {difTotal > 0 ? (
                            <TrendingUp className="h-5 w-5" />
                          ) : difTotal < 0 ? (
                            <TrendingDown className="h-5 w-5" />
                          ) : (
                            <Minus className="h-5 w-5" />
                          )}
                          {difTotal > 0 ? '+' : ''}
                          {formatBRL(difTotal)}
                        </span>
                        <span
                          className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                            difPercent > 0
                              ? 'bg-amber-100 text-amber-800'
                              : difPercent < 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {difPercent > 0 ? '+' : ''}
                          {difPercent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-[11px] text-[#64748B] space-y-1 border-t border-slate-100 pt-2">
                        <div className="flex justify-between">
                          <span>Impacto Rodada Anterior:</span>
                          <span className="font-semibold text-[#1A2333]">
                            {formatBRL(snapshotAnterior.impacto_total_acumulado)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Empresas em alerta (|Δ| ≥ 10%):</span>
                          <span
                            className={`font-bold ${
                              alertasUltimo.length > 0 ? 'text-amber-700' : 'text-emerald-700'
                            }`}
                          >
                            {alertasUltimo.length} empresa(s)
                          </span>
                        </div>
                      </div>
                    </>
                  )
                })()}
              </>
            ) : (
              <div className="text-xs text-[#64748B] py-3 leading-relaxed">
                Esta é a primeira rodada registrada deste tenant. Na próxima execução trimestral, o
                comparador automático apresentará as variações de carga e oscilações por empresa.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Histórico e Acesso Rápido a Snapshots */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Histórico de Snapshots
              </span>
              <History className="h-3.5 w-3.5 text-[#0FA3A3]" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {snapshots.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhum histórico disponível</p>
              ) : (
                snapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="flex items-center justify-between p-1.5 px-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#1A2333] mr-2">{snap.periodo}</span>
                      <span className="text-[10px] text-[#64748B]">
                        {snap.data_execucao
                          ? new Date(snap.data_execucao).toLocaleDateString('pt-BR')
                          : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-700">
                        {formatBRL(snap.impacto_total_acumulado)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setModalSnapshot(snap)}
                        className="h-6 w-6 p-0 text-[#0FA3A3] hover:text-[#0c8282]"
                        title="Ver detalhes do snapshot"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SE HOUVER ALERTAS DE VARIAÇÃO NO ÚLTIMO SNAPSHOT, MOSTRAR EM DESTAQUE */}
      {alertasUltimo.length > 0 && (
        <Card className="rounded-2xl border-amber-200 bg-amber-50/40 shadow-xs">
          <CardHeader className="pb-2 pt-3.5 px-4 border-b border-amber-200/60">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <CardTitle className="text-xs md:text-sm font-bold text-amber-950">
                Alertas de Variação Relevante Identificados na Última Rodada (|Δ| ≥ 10% ou ≥ R$
                50.000)
              </CardTitle>
            </div>
            <CardDescription className="text-[11px] text-amber-800">
              Notificações in-app e e-mails foram gerados para os contadores e administradores
              responsáveis.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {alertasUltimo.map((alerta, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-white border border-amber-200 text-xs space-y-1.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-[#1A2333] block">{alerta.razaoSocial}</span>
                      <span className="text-[10px] text-[#64748B] font-mono">
                        CNPJ: {alerta.cnpj}
                      </span>
                    </div>
                    <Badge
                      className={`text-[10px] font-bold ${
                        alerta.tipoVariacao === 'aumento'
                          ? 'bg-amber-600 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {alerta.tipoVariacao === 'aumento' ? '+ Aumento' : '- Redução'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                    <span className="text-slate-600">Impacto Anterior:</span>
                    <span className="font-mono">{formatBRL(alerta.impactoAnteriorReais)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600">Novo Impacto Projetado:</span>
                    <span className="font-mono font-bold text-[#1A2333]">
                      {formatBRL(alerta.impactoNovoReais)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600">Variação:</span>
                    <span
                      className={`font-mono font-bold ${
                        alerta.diferencaReais > 0 ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {alerta.diferencaReais > 0 ? '+' : ''}
                      {formatBRL(alerta.diferencaReais)} (
                      {alerta.diferencaPercentual > 0 ? '+' : ''}
                      {alerta.diferencaPercentual}%)
                    </span>
                  </div>
                  <p className="text-[10px] text-amber-900 bg-amber-50 p-1.5 rounded-lg border border-amber-100">
                    <b>Causa provável:</b> {alerta.causaProvavel}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* MODAL DE DETALHES DO SNAPSHOT HISTÓRICO SELECIONADO */}
      <Dialog open={!!modalSnapshot} onOpenChange={(open) => !open && setModalSnapshot(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333] flex items-center gap-2">
              <History className="h-4 w-4 text-[#0FA3A3]" />
              Snapshot Histórico • Rodada {modalSnapshot?.periodo}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Registrado em{' '}
              {modalSnapshot?.data_execucao
                ? new Date(modalSnapshot.data_execucao).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '-'}{' '}
              via{' '}
              {modalSnapshot?.executado_por_tipo === 'cron_trimestral'
                ? 'job trimestral automático'
                : 'reavaliação manual do contador'}
              .
            </DialogDescription>
          </DialogHeader>

          {modalSnapshot && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500">
                    Total Empresas
                  </span>
                  <p className="text-base font-bold text-[#1A2333] mt-0.5">
                    {modalSnapshot.total_empresas}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500">
                    Impacto Total Acumulado
                  </span>
                  <p className="text-base font-bold text-[#1A2333] mt-0.5">
                    {formatBRL(modalSnapshot.impacto_total_acumulado)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500">
                    Base Normativa
                  </span>
                  <p className="text-xs font-semibold text-[#1A2333] mt-0.5 truncate">
                    {modalSnapshot.versao_normativa || 'EC 132/23 & LC 214/25'}
                  </p>
                </div>
              </div>

              {/* Tabela resumida das empresas salvas neste snapshot */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-2.5 bg-slate-100 font-bold text-[11px] text-[#1A2333]">
                  Empresas Registradas no Snapshot ({modalSnapshot.periodo})
                </div>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs divide-y divide-slate-100">
                    <thead className="bg-slate-50 text-[10px] uppercase text-[#64748B]">
                      <tr>
                        <th className="p-2">Empresa</th>
                        <th className="p-2">Setor</th>
                        <th className="p-2 text-right">Faturamento</th>
                        <th className="p-2 text-right">Impacto Acum.</th>
                        <th className="p-2 text-right">Variação %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {((modalSnapshot.resultado_json as any)?.rankingEmpresas as any[])?.map(
                        (emp: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/60">
                            <td className="p-2">
                              <span className="font-semibold block text-[#1A2333]">
                                {emp.razaoSocial}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {emp.cnpj}
                              </span>
                            </td>
                            <td className="p-2 text-slate-700">
                              {(emp.setorNome || '').split('/')[0]}
                            </td>
                            <td className="p-2 text-right font-mono">
                              {formatBRL(emp.faturamentoBase)}
                            </td>
                            <td
                              className={`p-2 text-right font-mono font-bold ${
                                (emp.impactoAcumuladoReais || 0) > 0
                                  ? 'text-amber-700'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {formatBRL(emp.impactoAcumuladoReais)}
                            </td>
                            <td className="p-2 text-right font-mono">
                              {emp.variacao2033Percentual > 0 ? '+' : ''}
                              {emp.variacao2033Percentual}%
                            </td>
                          </tr>
                        ),
                      ) || (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-slate-400">
                            Detalhes analíticos não disponíveis no formato deste snapshot antigo.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

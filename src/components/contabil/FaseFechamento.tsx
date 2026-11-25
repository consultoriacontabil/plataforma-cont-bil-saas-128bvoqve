/**
 * Fase Fechamento do Módulo Contábil (Fatia 4 Makro).
 * Demonstrativos da competência — Livro Diário, Livro Razão, Balancete de
 * Verificação, Balanço Patrimonial e DRE — via `contabilMakro.ts`, com
 * exportações TXT/CSV (`contabilMakroExport.ts`) e fechamento formal.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  BookOpen,
  BookText,
  FileSpreadsheet,
  FileDown,
  Landmark,
  Loader2,
  Lock,
  TrendingUp,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import {
  balancoPatrimonial,
  dre,
  fecharCompetencia,
  livroDiario,
  livroRazao,
  statusFechamento,
  type BalancoPatrimonial,
  type Dre,
  type ItemDiario,
  type ItemRazao,
} from '@/services/contabilMakro'
import { balanceteMakro, competenciaParaBase } from '@/services/contabilMakro'
import {
  baixarArquivo,
  exportarBalanceteCsv,
  exportarDiarioTxt,
  exportarRazaoTxt,
} from '@/services/contabilMakroExport'
import type { BalanceteItem } from '@/types'

const fmt = (v: number) => formatCurrency(v)

interface Props {
  tenantId?: string
  empresaId: string
  empresaNome: string
  competencia: string
}

type BalanceteResult = Awaited<ReturnType<typeof balanceteMakro.get>>

const DEMONSTRATIVOS = [
  { id: 'diario', label: 'Diário', icon: BookOpen },
  { id: 'razao', label: 'Razão', icon: BookText },
  { id: 'balancete', label: 'Balancete', icon: FileSpreadsheet },
  { id: 'balanco', label: 'Balanço (BP)', icon: Landmark },
  { id: 'dre', label: 'DRE', icon: TrendingUp },
] as const

export function FechamentoFase({ tenantId, empresaId, empresaNome, competencia }: Props) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [aba, setAba] = useState<string>('diario')
  const [carregando, setCarregando] = useState(true)
  const [fechando, setFechando] = useState(false)
  const [statusComp, setStatusComp] = useState<string | null>(null)
  const [diario, setDiario] = useState<ItemDiario[]>([])
  const [razao, setRazao] = useState<ItemRazao[]>([])
  const [balancete, setBalancete] = useState<BalanceteResult | null>(null)
  const [balanco, setBalanco] = useState<BalancoPatrimonial | null>(null)
  const [dreData, setDreData] = useState<Dre | null>(null)

  const carregar = useCallback(async () => {
    if (!tenantId || !empresaId) {
      setDiario([])
      setRazao([])
      setBalancete(null)
      setBalanco(null)
      setDreData(null)
      setCarregando(false)
      return
    }
    setCarregando(true)
    try {
      const [d, r, b, bp, dr, st] = await Promise.all([
        livroDiario(tenantId, empresaId, competencia),
        livroRazao(tenantId, empresaId, competencia),
        balanceteMakro.get(tenantId, empresaId, competenciaParaBase(competencia)),
        balancoPatrimonial(tenantId, empresaId, competencia),
        dre(tenantId, empresaId, competencia),
        statusFechamento(tenantId, empresaId, competencia).catch(() => null),
      ])
      setDiario(d)
      setRazao(r)
      setBalancete(b)
      setBalanco(bp)
      setDreData(dr)
      setStatusComp(st)
    } catch {
      toast({ title: 'Erro ao carregar os demonstrativos', variant: 'destructive' })
    } finally {
      setCarregando(false)
    }
  }, [tenantId, empresaId, competencia, toast])

  useEffect(() => {
    carregar()
  }, [carregar])

  const fechar = async () => {
    if (!tenantId) return
    setFechando(true)
    try {
      await fecharCompetencia({
        tenantId,
        empresaId,
        competencia,
        usuarioId: user?.id,
      })
      toast({
        title: 'Competência fechada',
        description: `${competencia} travada para novos lançamentos retroativos.`,
      })
      await carregar()
    } catch (e) {
      toast({
        title: 'Erro ao fechar a competência',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setFechando(false)
    }
  }

  // ----- exportações -----
  const exportarDiario = () =>
    diario.length > 0 &&
    baixarArquivo(`diario-${competencia}.txt`, exportarDiarioTxt(diario, empresaNome, competencia))

  const exportarRazao = () =>
    razao.length > 0 &&
    baixarArquivo(`razao-${competencia}.txt`, exportarRazaoTxt(razao, empresaNome, competencia))

  const exportarBalancete = () =>
    balancete &&
    balancete.itens.length > 0 &&
    baixarArquivo(
      `balancete-${competencia}.csv`,
      exportarBalanceteCsv(balancete.itens, empresaNome, competencia),
      'text/csv;charset=utf-8',
    )

  const exportarBalancoDre = () => {
    if (!balanco || !dreData) return
    const linhas = [
      `BALANÇO PATRIMONIAL — ${empresaNome} — ${competencia}`,
      '',
      'ATIVO',
      ...balanco.ativo.map((i) => `  ${i.codigo.padEnd(12)} ${i.nome}: ${fmt(i.saldoAtual)}`),
      `  Total do Ativo: ${fmt(balanco.totalAtivo)}`,
      '',
      'PASSIVO',
      ...balanco.passivo.map((i) => `  ${i.codigo.padEnd(12)} ${i.nome}: ${fmt(i.saldoAtual)}`),
      `  Total do Passivo: ${fmt(balanco.totalPassivo)}`,
      '',
      'PATRIMÔNIO LÍQUIDO',
      ...balanco.patrimonioLiquido.map(
        (i) => `  ${i.codigo.padEnd(12)} ${i.nome}: ${fmt(i.saldoAtual)}`,
      ),
      `  Resultado do período: ${fmt(balanco.resultadoPeriodo)}`,
      `  Total do PL: ${fmt(balanco.totalPatrimonioLiquido)}`,
      '',
      `Total Ativo: ${fmt(balanco.totalAtivo)}`,
      `Total Passivo + PL: ${fmt(balanco.totalPassivoMaisPL)}`,
      `Diferença: ${fmt(balanco.diferenca)}`,
      '',
      '-'.repeat(80),
      `DRE — ${empresaNome} — ${competencia}`,
      '',
      ...dreData.linhas.map((l) => `  ${l.descricao}: ${fmt(l.valor)}`),
    ]
    baixarArquivo(`balanco-dre-${competencia}.txt`, linhas.join('\n'))
  }

  if (!empresaId) {
    return (
      <Card className="rounded-2xl p-4 text-xs text-slate-500">
        Selecione uma empresa no cabeçalho para gerar os demonstrativos.
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl border-[#E2E8F0] p-4 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
        <h4 className="text-sm font-bold text-[#1A2333] flex items-center gap-2 flex-1">
          <BookOpen className="h-4 w-4 text-[#0FA3A3]" /> Fechamento da competência
          {statusComp === 'fechado' && (
            <Badge
              variant="outline"
              className="text-[10px] bg-emerald-50 text-emerald-600 border-emerald-200"
            >
              <Lock className="h-3 w-3 mr-1" /> fechada
            </Badge>
          )}
        </h4>
        <div className="flex flex-wrap gap-2">
          {statusComp !== 'fechado' && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              onClick={fechar}
              disabled={fechando || carregando}
            >
              {fechando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Lock className="h-3.5 w-3.5" />
              )}
              Fechar competência
            </Button>
          )}
        </div>
      </div>

      {carregando ? (
        <p className="text-xs text-slate-500 flex items-center gap-2 py-6 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Calculando demonstrativos…
        </p>
      ) : (
        <Tabs value={aba} onValueChange={setAba}>
          <TabsList className="flex-wrap h-auto gap-1">
            {DEMONSTRATIVOS.map((d) => (
              <TabsTrigger key={d.id} value={d.id} className="text-[11px] gap-1">
                <d.icon className="h-3 w-3" /> {d.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ---- Diário ---- */}
          <TabsContent value="diario" className="space-y-2">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[11px]"
                onClick={exportarDiario}
                disabled={diario.length === 0}
              >
                <FileDown className="h-3 w-3" /> Exportar TXT
              </Button>
            </div>
            {diario.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                Sem lançamentos na competência.
              </p>
            ) : (
              <div className="overflow-x-auto max-h-[420px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-left text-[10px] uppercase text-slate-400 border-b">
                      <th className="py-2 pr-3 font-semibold">Data</th>
                      <th className="py-2 pr-3 font-semibold">Histórico</th>
                      <th className="py-2 pr-3 font-semibold">Débito</th>
                      <th className="py-2 pr-3 font-semibold">Crédito</th>
                      <th className="py-2 font-semibold text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diario.map((it) => (
                      <tr key={it.id} className="border-b last:border-0 text-[#1A2333]">
                        <td className="py-1.5 pr-3 whitespace-nowrap">{it.data.slice(0, 10)}</td>
                        <td className="py-1.5 pr-3 max-w-56 truncate" title={it.historico}>
                          {it.historico}
                        </td>
                        <td className="py-1.5 pr-3 font-mono text-emerald-600">
                          {it.debitoCodigo}
                          <span className="block text-[10px] text-slate-400 font-sans">
                            {it.debitoNome}
                          </span>
                        </td>
                        <td className="py-1.5 pr-3 font-mono text-red-500">
                          {it.creditoCodigo}
                          <span className="block text-[10px] text-slate-400 font-sans">
                            {it.creditoNome}
                          </span>
                        </td>
                        <td className="py-1.5 text-right font-semibold whitespace-nowrap">
                          {fmt(it.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ---- Razão ---- */}
          <TabsContent value="razao" className="space-y-2">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[11px]"
                onClick={exportarRazao}
                disabled={razao.length === 0}
              >
                <FileDown className="h-3 w-3" /> Exportar TXT
              </Button>
            </div>
            {razao.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                Sem movimento na competência.
              </p>
            ) : (
              <div className="max-h-[420px] overflow-y-auto space-y-2">
                {razao.map((conta) => (
                  <div key={conta.contaId} className="rounded-lg border p-2">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-[11px] font-bold text-[#1A2333] font-mono">
                        {conta.codigo} <span className="font-sans">{conta.nome}</span>
                      </p>
                      <span
                        className={cn(
                          'text-[11px] font-semibold',
                          conta.saldoFinal >= 0 ? 'text-emerald-600' : 'text-red-500',
                        )}
                      >
                        saldo {fmt(conta.saldoFinal)}
                      </span>
                    </div>
                    <table className="w-full text-[11px]">
                      <tbody>
                        {conta.linhas.map((l, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-1 pr-2 whitespace-nowrap text-slate-500">
                              {l.data.slice(0, 10)}
                            </td>
                            <td className="py-1 pr-2 max-w-40 truncate" title={l.historico}>
                              {l.historico}
                            </td>
                            <td
                              className="py-1 pr-2 font-mono text-slate-400"
                              title="contrapartida"
                            >
                              {l.contrapartida}
                            </td>
                            <td
                              className={cn(
                                'py-1 pr-2 text-right font-semibold',
                                l.tipo === 'debito' ? 'text-emerald-600' : 'text-red-500',
                              )}
                            >
                              {l.tipo === 'debito' ? 'D' : 'C'} {fmt(l.valor)}
                            </td>
                            <td className="py-1 text-right text-slate-500 whitespace-nowrap">
                              {fmt(l.saldoAcumulado)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ---- Balancete ---- */}
          <TabsContent value="balancete" className="space-y-2">
            {balancete && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500">
                    Σ débitos {fmt(balancete.totalDebitos)}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500">
                    Σ créditos {fmt(balancete.totalCreditos)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px]',
                      balancete.diferenca < 0.005
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                        : 'bg-red-50 text-red-600 border-red-200',
                    )}
                  >
                    diferença {fmt(balancete.diferenca)}
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-[11px]"
                  onClick={exportarBalancete}
                  disabled={balancete.itens.length === 0}
                >
                  <FileDown className="h-3 w-3" /> Exportar CSV
                </Button>
              </div>
            )}
            {!balancete || balancete.itens.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                Sem contas ativas no plano desta empresa.
              </p>
            ) : (
              <div className="overflow-x-auto max-h-[420px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-left text-[10px] uppercase text-slate-400 border-b">
                      <th className="py-2 pr-3 font-semibold">Conta</th>
                      <th className="py-2 pr-3 font-semibold text-right">Saldo anterior</th>
                      <th className="py-2 pr-3 font-semibold text-right">Débitos</th>
                      <th className="py-2 pr-3 font-semibold text-right">Créditos</th>
                      <th className="py-2 font-semibold text-right">Saldo atual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balancete.itens.map((it) => (
                      <tr
                        key={it.id}
                        className={cn(
                          'border-b last:border-0 text-[#1A2333]',
                          it.isSintetica && 'bg-slate-50/60 font-semibold',
                        )}
                      >
                        <td className="py-1.5 pr-3">
                          <span className={cn('font-mono', it.isSintetica && 'font-bold')}>
                            {it.codigo}
                          </span>{' '}
                          {it.nome}
                        </td>
                        <td className="py-1.5 pr-3 text-right whitespace-nowrap">
                          {fmt(it.saldoAnterior)}
                        </td>
                        <td className="py-1.5 pr-3 text-right whitespace-nowrap">
                          {fmt(it.debitos)}
                        </td>
                        <td className="py-1.5 pr-3 text-right whitespace-nowrap">
                          {fmt(it.creditos)}
                        </td>
                        <td className="py-1.5 text-right font-semibold whitespace-nowrap">
                          {fmt(it.saldoAtual)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ---- Balanço ---- */}
          <TabsContent value="balanco" className="space-y-2">
            {balanco && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-[11px]"
                  onClick={exportarBalancoDre}
                  disabled={balanco.ativo.length + balanco.passivo.length === 0}
                >
                  <FileDown className="h-3 w-3" /> Exportar BP+DRE (TXT)
                </Button>
              </div>
            )}
            {!balanco || (balanco.ativo.length === 0 && balanco.passivo.length === 0) ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                Sem saldos de Ativo/Passivo na competência.
              </p>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                <BlocoBP titulo="Ativo" itens={balanco.ativo} total={balanco.totalAtivo} />
                <BlocoBP titulo="Passivo" itens={balanco.passivo} total={balanco.totalPassivo} />
                <BlocoBP
                  titulo="Patrimônio Líquido"
                  itens={balanco.patrimonioLiquido}
                  total={balanco.totalPatrimonioLiquido}
                  extra={`Resultado do período: ${fmt(balanco.resultadoPeriodo)}`}
                />
                <div className="rounded-lg border p-3 space-y-1 text-xs">
                  <p className="font-bold text-[#1A2333]">Conferência</p>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Ativo</span>
                    <span className="font-semibold">{fmt(balanco.totalAtivo)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Passivo + PL</span>
                    <span className="font-semibold">{fmt(balanco.totalPassivoMaisPL)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Diferença</span>
                    <span
                      className={cn(
                        'font-semibold',
                        balanco.diferenca < 0.005 ? 'text-emerald-600' : 'text-red-500',
                      )}
                    >
                      {fmt(balanco.diferenca)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ---- DRE ---- */}
          <TabsContent value="dre" className="space-y-2">
            {!dreData || dreData.linhas.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                Sem receitas/despesas na competência.
              </p>
            ) : (
              <div className="rounded-lg border p-3 space-y-1 max-h-[420px] overflow-y-auto">
                {dreData.linhas.map((l, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex justify-between gap-2 text-xs',
                      l.nivel === 'grupo' && 'border-t pt-1.5 font-semibold text-[#1A2333]',
                      l.nivel === 'total' &&
                        'border-t-2 pt-2 font-bold text-[#1A2333] bg-slate-50/60 rounded px-1',
                      l.nivel === 'item' && 'text-slate-600 pl-3',
                    )}
                  >
                    <span>{l.descricao}</span>
                    <span className="font-mono whitespace-nowrap">{fmt(l.valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </Card>
  )
}

function BlocoBP({
  titulo,
  itens,
  total,
  extra,
}: {
  titulo: string
  itens: BalanceteItem[]
  total: number
  extra?: string
}) {
  return (
    <div className="rounded-lg border p-3 space-y-1">
      <p className="text-[11px] font-bold uppercase text-slate-400">{titulo}</p>
      {itens.length === 0 ? (
        <p className="text-[11px] text-slate-400">—</p>
      ) : (
        itens.map((i) => (
          <div key={i.id} className="flex justify-between gap-2 text-[11px]">
            <span className="text-[#1A2333] truncate">
              <span className="font-mono">{i.codigo}</span> {i.nome}
            </span>
            <span className="font-semibold whitespace-nowrap">{fmt(i.saldoAtual)}</span>
          </div>
        ))
      )}
      <div className="flex justify-between gap-2 border-t pt-1 text-[11px] font-bold">
        <span>Total</span>
        <span>{fmt(total)}</span>
      </div>
      {extra && <p className="text-[10px] text-slate-400">{extra}</p>}
    </div>
  )
}

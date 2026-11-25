/**
 * Fase Movimentações do Módulo Pessoal (Fatia 5 Makro).
 * Folha por competência (INSS/IRRF/FGTS, suspensão automática de
 * afastado/férias/demitido), 13º, férias com validação de gozo, rescisão
 * simulador, adiantamento salarial e controle de afastamentos — via pessoalMakro.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarCheck,
  CalendarOff,
  Coins,
  Hourglass,
  Loader2,
  LogOut,
  Palmtree,
  Play,
  Save,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { pessoalMakro } from '@/services/pessoalMakro'
import type { FolhaPagamento, Funcionario, RescisaoMotivo, VerbaLancamentoRecord } from '@/types'
import { formatCurrency } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface Props {
  tenantId?: string
  empresaId: string
  competencia: string
  aoMudar: () => void
}

type ItemRubrica = { descricao: string; valor: number }

type Totais = { inss: number; irrf: number; fgts: number; liquido: number }

const MOTIVOS_RESCISAO: Array<{ value: RescisaoMotivo; label: string }> = [
  { value: 'sem_justa_causa', label: 'Sem justa causa' },
  { value: 'justa_causa', label: 'Justa causa' },
  { value: 'pedido_demissao', label: 'Pedido de demissão' },
  { value: 'acordo', label: 'Acordo mútuo' },
]

function itensDe(folha: FolhaPagamento): ItemRubrica[] {
  for (const campo of [folha.proventos, folha.descontos]) {
    if (Array.isArray(campo)) return campo
    if (typeof campo === 'string' && campo.trim()) {
      try {
        const dado = JSON.parse(campo)
        if (Array.isArray(dado)) return dado as ItemRubrica[]
      } catch {
        /* campo em outro formato — segue */
      }
    }
  }
  return []
}

function toNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function somaItens(folha: FolhaPagamento): { proventos: number; descontos: number } {
  let proventos = 0
  let descontos = 0
  for (const i of itensDe(folha)) {
    if (i.descricao?.toLowerCase().includes('desconto')) descontos += toNum(i.valor)
    else proventos += toNum(i.valor)
  }
  return { proventos, descontos }
}

export function FaseMovimentacoes({ tenantId, empresaId, competencia, aoMudar }: Props) {
  const { toast } = useToast()
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [folhas, setFolhas] = useState<FolhaPagamento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [calculando, setCalculando] = useState(false)
  const [adiantamentoPara, setAdiantamentoPara] = useState<string | null>(null)
  const [valorAdiantamento, setValorAdiantamento] = useState('')

  // 13º
  const [decimoAberto, setDecimoAberto] = useState(false)
  const [decimoParcela, setDecimoParcela] = useState<'primeira' | 'segunda'>('primeira')
  const [decimoFuncId, setDecimoFuncId] = useState('todos')
  const [decimoResultado, setDecimoResultado] = useState<FolhaPagamento[] | null>(null)
  const [decimoCalculando, setDecimoCalculando] = useState(false)

  // Férias
  const [feriasAberto, setFeriasAberto] = useState(false)
  const [feriasFuncId, setFeriasFuncId] = useState('')
  const [inicioGozo, setInicioGozo] = useState('')
  const [diasVendidos, setDiasVendidos] = useState('0')
  const [feriasValidacao, setFeriasValidacao] = useState<Awaited<
    ReturnType<typeof pessoalMakro.validarGozoFerias>
  > | null>(null)
  const [feriasResultado, setFeriasResultado] = useState<{
    valores: { bruto: number; adiantamento_13: number; liquido: number; fgts: number } | null
    lancando: boolean
  }>({ valores: null, lancando: false })
  const [feriasCalculando, setFeriasCalculando] = useState(false)

  // Rescisão
  const [rescisaoAberto, setRescisaoAberto] = useState(false)
  const [rescisaoFuncId, setRescisaoFuncId] = useState('')
  const [rescisaoMotivo, setRescisaoMotivo] = useState<RescisaoMotivo>('sem_justa_causa')
  const [rescisaoAviso, setRescisaoAviso] = useState('30')
  const [rescisaoSaldoDias, setRescisaoSaldoDias] = useState('0')
  const [rescisaoResultado, setRescisaoResultado] = useState<Awaited<
    ReturnType<typeof pessoalMakro.simularRescisao>
  > | null>(null)
  const [rescisaoCalculando, setRescisaoCalculando] = useState(false)
  const [rescisaoConcluindo, setRescisaoConcluindo] = useState(false)

  // Afastamento
  const [afastamentoAberto, setAfastamentoAberto] = useState(false)
  const [afastamentoFuncId, setAfastamentoFuncId] = useState('')
  const [afastamentoInicio, setAfastamentoInicio] = useState('')
  const [afastamentoFim, setAfastamentoFim] = useState('')
  const [afastamentoMotivo, setAfastamentoMotivo] = useState('medico')
  const [salvandoAfastamento, setSalvandoAfastamento] = useState(false)

  const carregar = useCallback(async () => {
    if (!tenantId || !empresaId || empresaId === 'todas') {
      setFuncionarios([])
      setFolhas([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    try {
      const [funcs, fls] = await Promise.all([
        pessoalMakro.listarFuncionarios(tenantId, empresaId),
        pessoalMakro.listarFolhas(empresaId, competencia).catch(() => [] as FolhaPagamento[]),
      ])
      setFuncionarios(funcs)
      setFolhas(fls)
    } catch {
      setFuncionarios([])
      setFolhas([])
    } finally {
      setCarregando(false)
    }
  }, [tenantId, empresaId, competencia])

  useEffect(() => {
    carregar()
  }, [carregar])

  const ativos = useMemo(() => funcionarios.filter((f) => f.status !== 'demitido'), [funcionarios])

  const totais = useMemo<Totais>(() => {
    return folhas.reduce<Totais>(
      (acc, f) => ({
        inss: acc.inss + toNum(f.inss),
        irrf: acc.irrf + toNum(f.irrf),
        fgts: acc.fgts + toNum(f.fgts),
        liquido: acc.liquido + toNum(f.total_liquido),
      }),
      { inss: 0, irrf: 0, fgts: 0, liquido: 0 },
    )
  }, [folhas])

  const calcularFolha = async () => {
    if (!tenantId || !empresaId || empresaId === 'todas') return
    if (ativos.length === 0) {
      toast({ title: 'Cadastre um colaborador para começar', variant: 'destructive' })
      return
    }
    setCalculando(true)
    try {
      const geradas = await pessoalMakro.calcularFolha(tenantId, empresaId, competencia)
      setFolhas(geradas)
      toast({
        title: `Folha calculada — ${geradas.length} colaborador(es)`,
        description: 'Afastados, férias e demitidos suspensos automaticamente.',
      })
      aoMudar()
    } catch {
      toast({ title: 'Erro ao calcular a folha da competência', variant: 'destructive' })
    } finally {
      setCalculando(false)
    }
  }

  const abrirAdiantamento = (f: FolhaPagamento) => {
    setAdiantamentoPara(f.id)
    setValorAdiantamento(String(Math.max(0, toNum(f.total_liquido) / 2).toFixed(2)))
  }

  const confirmarAdiantamento = async () => {
    const folha = folhas.find((f) => f.id === adiantamentoPara)
    if (!folha || !tenantId) return
    const valor = Number(valorAdiantamento.replace(',', '.'))
    if (!Number.isFinite(valor) || valor <= 0) {
      toast({ title: 'Informe um valor de adiantamento válido', variant: 'destructive' })
      return
    }
    try {
      await pessoalMakro.lancarAdiantamento(folha.funcionario, competencia, valor, tenantId)
      toast({ title: 'Adiantamento lançado' })
      setAdiantamentoPara(null)
      await carregar()
      aoMudar()
    } catch {
      toast({ title: 'Erro ao lançar o adiantamento', variant: 'destructive' })
    }
  }

  // ---------- 13º ----------
  const calcularDecimo = async () => {
    if (!tenantId || !empresaId || empresaId === 'todas') return
    setDecimoCalculando(true)
    setDecimoResultado(null)
    try {
      const funcsAlvo =
        decimoFuncId === 'todos'
          ? ativos.map((f) => f.id)
          : ativos.filter((f) => f.id === decimoFuncId).map((f) => f.id)
      const resultados: FolhaPagamento[] = []
      for (const fid of funcsAlvo) {
        const r = await pessoalMakro.calcularDecimo(
          tenantId,
          empresaId,
          fid,
          decimoParcela,
          competencia,
        )
        resultados.push(r)
      }
      setDecimoResultado(resultados)
      toast({ title: `13º (${decimoParcela === 'primeira' ? '1ª' : '2ª'} parcela) calculado` })
      aoMudar()
    } catch {
      toast({ title: 'Erro ao calcular o 13º', variant: 'destructive' })
    } finally {
      setDecimoCalculando(false)
    }
  }

  // ---------- Férias ----------
  const abrirFerias = (f: Funcionario) => {
    setFeriasFuncId(f.id)
    setInicioGozo(new Date().toISOString().slice(0, 10))
    setDiasVendidos('0')
    setFeriasValidacao(null)
    setFeriasResultado({ valores: null, lancando: false })
    setFeriasAberto(true)
  }

  const calcularFerias = async () => {
    const func = funcionarios.find((f) => f.id === feriasFuncId)
    if (!func || !tenantId || !empresaId || empresaId === 'todas') return
    setFeriasCalculando(true)
    try {
      const [valores, validacao] = await Promise.all([
        pessoalMakro.calcularFerias(
          tenantId,
          empresaId,
          func.id,
          toNum(inicioGozo),
          Number(diasVendidos) || 0,
          competencia,
        ),
        pessoalMakro.validarGozoFerias(tenantId, empresaId, func.id, inicioGozo).catch(() => null),
      ])
      setFeriasResultado({ valores, lancando: false })
      setFeriasValidacao(validacao)
    } catch {
      toast({ title: 'Erro ao calcular as férias', variant: 'destructive' })
    } finally {
      setFeriasCalculando(false)
    }
  }

  const lancarFerias = async () => {
    const func = funcionarios.find((f) => f.id === feriasFuncId)
    if (!func || !tenantId || !empresaId || empresaId === 'todas') return
    if (feriasValidacao && feriasValidacao.valido === false) {
      toast({ title: 'Corrija a validação do gozo antes de lançar', variant: 'destructive' })
      return
    }
    setFeriasResultado((r) => ({ ...r, lancando: true }))
    try {
      await pessoalMakro.lancarFerias(tenantId, empresaId, func.id, {
        inicio_gozo: inicioGozo,
        dias_vendidos: Number(diasVendidos) || 0,
        competencia: competencia,
      })
      toast({ title: 'Férias lançadas e colaborador marcado como em férias' })
      setFeriasAberto(false)
      await carregar()
      aoMudar()
    } catch {
      toast({ title: 'Erro ao lançar as férias', variant: 'destructive' })
      setFeriasResultado((r) => ({ ...r, lancando: false }))
    }
  }

  // ---------- Rescisão ----------
  const abrirRescisao = (f: Funcionario) => {
    setRescisaoFuncId(f.id)
    setRescisaoMotivo('sem_justa_causa')
    setRescisaoAviso('30')
    setRescisaoSaldoDias('0')
    setRescisaoResultado(null)
    setRescisaoAberto(true)
  }

  const simularRescisao = async () => {
    const func = funcionarios.find((f) => f.id === rescisaoFuncId)
    if (!func || !tenantId || !empresaId || empresaId === 'todas') return
    setRescisaoCalculando(true)
    try {
      const r = await pessoalMakro.simularRescisao(tenantId, empresaId, func.id, {
        motivo: rescisaoMotivo,
        aviso_previo_dias: Number(rescisaoAviso) || 0,
        saldo_salario_dias: Number(rescisaoSaldoDias) || 0,
        competencia: competencia,
      })
      setRescisaoResultado(r)
    } catch {
      toast({ title: 'Erro ao simular a rescisão', variant: 'destructive' })
    } finally {
      setRescisaoCalculando(false)
    }
  }

  const concluirRescisao = async () => {
    const func = funcionarios.find((f) => f.id === rescisaoFuncId)
    if (!func || !rescisaoResultado || !tenantId || !empresaId || empresaId === 'todas') return
    setRescisaoConcluindo(true)
    try {
      await pessoalMakro.concluirRescisao(tenantId, empresaId, func.id, {
        motivo: rescisaoMotivo,
        aviso_previo_dias: Number(rescisaoAviso) || 0,
        saldo_salario_dias: Number(rescisaoSaldoDias) || 0,
        data_demissao: new Date().toISOString().slice(0, 10),
        competencia: competencia,
      })
      toast({ title: 'Rescisão concluída — colaborador marcado como demitido' })
      setRescisaoAberto(false)
      await carregar()
      aoMudar()
    } catch {
      toast({ title: 'Erro ao concluir a rescisão', variant: 'destructive' })
    } finally {
      setRescisaoConcluindo(false)
    }
  }

  // ---------- Afastamento ----------
  const abrirAfastamento = (f: Funcionario) => {
    setAfastamentoFuncId(f.id)
    setAfastamentoInicio(new Date().toISOString().slice(0, 10))
    setAfastamentoFim('')
    setAfastamentoMotivo('medico')
    setAfastamentoAberto(true)
  }

  const salvarAfastamento = async () => {
    const func = funcionarios.find((f) => f.id === afastamentoFuncId)
    if (!func || !tenantId || !empresaId || empresaId === 'todas') return
    if (!afastamentoInicio) {
      toast({ title: 'Informe a data de início do afastamento', variant: 'destructive' })
      return
    }
    setSalvandoAfastamento(true)
    try {
      await pessoalMakro.registrarAfastamento(tenantId, empresaId, func.id, {
        data_inicio: afastamentoInicio,
        data_fim: afastamentoFim || undefined,
        motivo: afastamentoMotivo,
      })
      toast({ title: 'Afastamento registrado — folha suspensa automaticamente' })
      setAfastamentoAberto(false)
      await carregar()
      aoMudar()
    } catch {
      toast({ title: 'Erro ao registrar o afastamento', variant: 'destructive' })
    } finally {
      setSalvandoAfastamento(false)
    }
  }

  if (!tenantId || !empresaId || empresaId === 'todas') {
    return (
      <Card className="rounded-2xl p-4 text-xs text-slate-500">
        Selecione uma empresa no cabeçalho para calcular a folha.
      </Card>
    )
  }

  if (carregando) {
    return (
      <Card className="rounded-2xl p-4 text-xs text-slate-500 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando movimentações…
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho da folha */}
      <Card className="rounded-2xl border-[#E2E8F0] p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
          <h4 className="text-sm font-bold text-[#1A2333] flex items-center gap-2 flex-1">
            <CalendarCheck className="h-4 w-4 text-[#0FA3A3]" /> Folha de pagamento · {competencia}
            <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500">
              {folhas.length} registro(s)
            </Badge>
          </h4>
          <Button size="sm" className="h-9 text-xs" onClick={calcularFolha} disabled={calculando}>
            {calculando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Calcular folha
          </Button>
        </div>

        {ativos.length === 0 ? (
          <div className="py-8 text-center">
            <Users className="h-8 w-8 mx-auto text-slate-300 mb-2" aria-hidden />
            <p className="text-sm font-semibold text-[#1A2333]">
              Cadastre um colaborador para começar
            </p>
            <p className="text-xs text-slate-500 mt-1">
              A folha, o 13º e as férias dependem de ao menos um colaborador ativo na fase Preparar.
            </p>
          </div>
        ) : folhas.length === 0 ? (
          <p className="text-xs text-slate-500 py-3">
            Nenhuma folha calculada para {competencia}. Clique em <strong>Calcular folha</strong>{' '}
            para gerar os lançamentos de todos os colaboradores ativos.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
              {[
                { label: 'INSS', valor: totais.inss, cor: 'text-sky-600' },
                { label: 'IRRF', valor: totais.irrf, cor: 'text-violet-600' },
                { label: 'FGTS', valor: totais.fgts, cor: 'text-emerald-600' },
                { label: 'Total líquido', valor: totais.liquido, cor: 'text-[#0FA3A3]' },
              ].map((k) => (
                <div key={k.label} className="rounded-xl bg-slate-50 border border-[#E2E8F0] p-2">
                  <p className="text-[10px] uppercase text-slate-400 font-semibold">{k.label}</p>
                  <p className={cn('text-sm font-bold font-mono', k.cor)}>
                    {formatCurrency(k.valor)}
                  </p>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase text-slate-400 border-b">
                    <th className="py-2 pr-3 font-semibold">Colaborador</th>
                    <th className="py-2 pr-3 font-semibold text-right">Proventos</th>
                    <th className="py-2 pr-3 font-semibold text-right">Descontos</th>
                    <th className="py-2 pr-3 font-semibold text-right">INSS</th>
                    <th className="py-2 pr-3 font-semibold text-right">IRRF</th>
                    <th className="py-2 pr-3 font-semibold text-right">FGTS</th>
                    <th className="py-2 pr-3 font-semibold text-right">Líquido</th>
                    <th className="py-2 font-semibold text-right">Adiantamento</th>
                  </tr>
                </thead>
                <tbody>
                  {folhas.map((f) => {
                    const s = somaItens(f)
                    const func = funcionarios.find((x) => x.id === f.funcionario)
                    return (
                      <tr key={f.id} className="border-b last:border-0 text-[#1A2333]">
                        <td className="py-2 pr-3 font-medium">
                          {func?.nome_completo ?? f.funcionario}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">
                          {formatCurrency(s.proventos)}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">
                          {formatCurrency(s.descontos)}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">
                          {formatCurrency(toNum(f.inss))}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">
                          {formatCurrency(toNum(f.irrf))}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">
                          {formatCurrency(toNum(f.fgts))}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono font-bold">
                          {formatCurrency(toNum(f.total_liquido))}
                        </td>
                        <td className="py-2 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px]"
                            onClick={() => abrirAdiantamento(f)}
                            aria-label={`Lançar adiantamento de ${func?.nome_completo ?? 'colaborador'}`}
                          >
                            <Coins className="h-3 w-3" /> Lançar
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* Ações rápidas */}
      <Card className="rounded-2xl border-[#E2E8F0] p-4 shadow-2xs">
        <h4 className="text-sm font-bold text-[#1A2333] flex items-center gap-2 mb-3">
          <Hourglass className="h-4 w-4 text-[#0FA3A3]" /> 13º, férias, rescisão e afastamentos
        </h4>
        {ativos.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">
            Cadastre um colaborador para começar — as movimentações dependem de ao menos um
            colaborador ativo.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs justify-start"
              onClick={() => {
                setDecimoFuncId('todos')
                setDecimoResultado(null)
                setDecimoAberto(true)
              }}
            >
              <CalendarCheck className="h-3.5 w-3.5 text-[#0FA3A3]" /> Calcular 13º
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs justify-start"
              onClick={() => {
                const alvo = ativos.find((f) => f.status !== 'ferias')
                if (alvo) abrirFerias(alvo)
                else toast({ title: 'Todos os colaboradores já estão em férias' })
              }}
            >
              <Palmtree className="h-3.5 w-3.5 text-[#0FA3A3]" /> Lançar férias
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs justify-start"
              onClick={() => {
                const alvo = ativos.find((f) => f.status !== 'ferias')
                if (alvo) abrirRescisao(alvo)
                else toast({ title: 'Nenhum colaborador disponível para rescisão' })
              }}
            >
              <LogOut className="h-3.5 w-3.5 text-[#0FA3A3]" /> Simular rescisão
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs justify-start"
              onClick={() => {
                const alvo = ativos.find((f) => f.status === 'ativo')
                if (alvo) abrirAfastamento(alvo)
                else toast({ title: 'Nenhum colaborador ativo para afastar' })
              }}
            >
              <CalendarOff className="h-3.5 w-3.5 text-[#0FA3A3]" /> Registrar afastamento
            </Button>
          </div>
        )}
      </Card>

      {/* Dialog: adiantamento */}
      <Dialog
        open={adiantamentoPara !== null}
        onOpenChange={(aberto) => !aberto && setAdiantamentoPara(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Adiantamento salarial</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label htmlFor="adi-valor" className="text-[11px]">
                Valor do adiantamento (R$)
              </Label>
              <Input
                id="adi-valor"
                value={valorAdiantamento}
                onChange={(e) => setValorAdiantamento(e.target.value)}
                inputMode="decimal"
                autoComplete="off"
                className="h-9 text-xs"
              />
              <p className="text-[10px] text-slate-400">
                Sugestão: 50% do líquido calculado. O valor é lançado como verba na competência.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAdiantamentoPara(null)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={confirmarAdiantamento}>
              <Save className="h-3.5 w-3.5" /> Lançar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: 13º */}
      <Dialog open={decimoAberto} onOpenChange={setDecimoAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">Cálculo do 13º salário</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="dec-parcela" className="text-[11px]">
                  Parcela
                </Label>
                <Select
                  value={decimoParcela}
                  onValueChange={(v) => setDecimoParcela(v as 'primeira' | 'segunda')}
                >
                  <SelectTrigger id="dec-parcela" className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primeira">1ª parcela</SelectItem>
                    <SelectItem value="segunda">2ª parcela</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="dec-func" className="text-[11px]">
                  Colaborador
                </Label>
                <Select value={decimoFuncId} onValueChange={setDecimoFuncId}>
                  <SelectTrigger id="dec-func" className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os ativos</SelectItem>
                    {ativos.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome_completo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              size="sm"
              className="h-9 text-xs"
              onClick={calcularDecimo}
              disabled={decimoCalculando}
            >
              {decimoCalculando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Calcular
            </Button>
            {decimoResultado && decimoResultado.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-[#E2E8F0]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase text-slate-400 border-b bg-slate-50">
                      <th className="py-2 px-3 font-semibold">Colaborador</th>
                      <th className="py-2 px-3 font-semibold text-right">Bruto</th>
                      <th className="py-2 px-3 font-semibold text-right">INSS</th>
                      <th className="py-2 px-3 font-semibold text-right">IRRF</th>
                      <th className="py-2 px-3 font-semibold text-right">Líquido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decimoResultado.map((r, i) => {
                      const func = funcionarios.find((x) => x.id === r.funcionario)
                      return (
                        <tr key={r.id ?? i} className="border-b last:border-0 text-[#1A2333]">
                          <td className="py-2 px-3 font-medium">
                            {func?.nome_completo ?? r.funcionario}
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            {formatCurrency(toNum(r.salario_base))}
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            {formatCurrency(toNum(r.inss))}
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            {formatCurrency(toNum(r.irrf))}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold">
                            {formatCurrency(toNum(r.total_liquido))}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : decimoResultado ? (
              <p className="text-xs text-slate-500">Nenhum resultado para o filtro selecionado.</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDecimoAberto(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: férias */}
      <Dialog open={feriasAberto} onOpenChange={setFeriasAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">Férias</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label htmlFor="fer-func" className="text-[11px]">
                Colaborador
              </Label>
              <Select value={feriasFuncId} onValueChange={setFeriasFuncId}>
                <SelectTrigger id="fer-func" className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ativos.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome_completo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="fer-inicio" className="text-[11px]">
                  Início do gozo
                </Label>
                <Input
                  id="fer-inicio"
                  type="date"
                  value={inicioGozo}
                  onChange={(e) => setInicioGozo(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fer-vendidos" className="text-[11px]">
                  Dias vendidos (máx. 10)
                </Label>
                <Input
                  id="fer-vendidos"
                  value={diasVendidos}
                  onChange={(e) => setDiasVendidos(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  className="h-9 text-xs"
                />
              </div>
            </div>
            <Button
              size="sm"
              className="h-9 text-xs"
              onClick={calcularFerias}
              disabled={feriasCalculando || !feriasFuncId}
            >
              {feriasCalculando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Calcular férias
            </Button>
            {feriasValidacao ? (
              <div
                className={cn(
                  'rounded-xl border p-3 text-xs space-y-1',
                  feriasValidacao.valido === false
                    ? 'border-amber-300 bg-amber-50 text-amber-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700',
                )}
              >
                <p className="font-semibold flex items-center gap-1.5">
                  {feriasValidacao.valido === false ? (
                    <ShieldAlert className="h-3.5 w-3.5" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  )}
                  {feriasValidacao.valido === false ? 'Gozo inválido' : 'Gozo válido'}
                </p>
                {Array.isArray(feriasValidacao.alertas) && feriasValidacao.alertas.length > 0 ? (
                  <ul className="list-disc pl-4 space-y-0.5">
                    {feriasValidacao.alertas.map((a, i) => (
                      <li key={i}>
                        {typeof a === 'string'
                          ? a
                          : String((a as { mensagem?: string }).mensagem ?? a)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            {feriasResultado.valores ? (
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 border border-[#E2E8F0] p-3">
                {[
                  { label: 'Bruto', valor: feriasResultado.valores.bruto },
                  { label: 'Adiantamento 13º', valor: feriasResultado.valores.adiantamento_13 },
                  { label: 'Líquido', valor: feriasResultado.valores.liquido },
                  { label: 'FGTS (informativo)', valor: feriasResultado.valores.fgts },
                ].map((k) => (
                  <div key={k.label}>
                    <p className="text-[10px] uppercase text-slate-400 font-semibold">{k.label}</p>
                    <p className="text-sm font-bold font-mono text-[#1A2333]">
                      {formatCurrency(toNum(k.valor))}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setFeriasAberto(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={lancarFerias}
              disabled={
                !feriasResultado.valores ||
                feriasResultado.lancando ||
                feriasValidacao?.valido === false
              }
            >
              {feriasResultado.lancando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Lançar férias
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: rescisão */}
      <Dialog open={rescisaoAberto} onOpenChange={setRescisaoAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">Rescisão</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label htmlFor="res-func" className="text-[11px]">
                Colaborador
              </Label>
              <Select value={rescisaoFuncId} onValueChange={setRescisaoFuncId}>
                <SelectTrigger id="res-func" className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ativos.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome_completo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="res-motivo" className="text-[11px]">
                  Motivo
                </Label>
                <Select
                  value={rescisaoMotivo}
                  onValueChange={(v) => setRescisaoMotivo(v as RescisaoMotivo)}
                >
                  <SelectTrigger id="res-motivo" className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MOTIVOS_RESCISAO.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="res-aviso" className="text-[11px]">
                  Aviso prévio (dias)
                </Label>
                <Input
                  id="res-aviso"
                  value={rescisaoAviso}
                  onChange={(e) => setRescisaoAviso(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="res-saldo" className="text-[11px]">
                  Saldo de salário (dias)
                </Label>
                <Input
                  id="res-saldo"
                  value={rescisaoSaldoDias}
                  onChange={(e) => setRescisaoSaldoDias(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  className="h-9 text-xs"
                />
              </div>
            </div>
            <Button
              size="sm"
              className="h-9 text-xs"
              onClick={simularRescisao}
              disabled={rescisaoCalculando || !rescisaoFuncId}
            >
              {rescisaoCalculando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Simular
            </Button>
            {rescisaoResultado ? (
              <div className="rounded-xl border border-[#E2E8F0] bg-slate-50 p-3 space-y-1">
                <p className="text-[10px] uppercase text-slate-400 font-semibold">
                  Projeção da rescisão
                </p>
                <pre className="text-[10px] whitespace-pre-wrap text-[#1A2333] font-mono">
                  {typeof rescisaoResultado === 'string'
                    ? rescisaoResultado
                    : JSON.stringify(rescisaoResultado, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRescisaoAberto(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={concluirRescisao}
              disabled={!rescisaoResultado || rescisaoConcluindo}
            >
              {rescisaoConcluindo ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Concluir rescisão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: afastamento */}
      <Dialog open={afastamentoAberto} onOpenChange={setAfastamentoAberto}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Registrar afastamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label htmlFor="afa-func" className="text-[11px]">
                Colaborador
              </Label>
              <Select value={afastamentoFuncId} onValueChange={setAfastamentoFuncId}>
                <SelectTrigger id="afa-func" className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ativos
                    .filter((f) => f.status === 'ativo')
                    .map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome_completo}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="afa-inicio" className="text-[11px]">
                  Início
                </Label>
                <Input
                  id="afa-inicio"
                  type="date"
                  value={afastamentoInicio}
                  onChange={(e) => setAfastamentoInicio(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="afa-fim" className="text-[11px]">
                  Previsão de retorno (opcional)
                </Label>
                <Input
                  id="afa-fim"
                  type="date"
                  value={afastamentoFim}
                  onChange={(e) => setAfastamentoFim(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="afa-motivo" className="text-[11px]">
                Motivo
              </Label>
              <Select value={afastamentoMotivo} onValueChange={setAfastamentoMotivo}>
                <SelectTrigger id="afa-motivo" className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="medico">Licença médica</SelectItem>
                  <SelectItem value="maternidade">Licença maternidade</SelectItem>
                  <SelectItem value="paternidade">Licença paternidade</SelectItem>
                  <SelectItem value="acidente">Acidente de trabalho</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAfastamentoAberto(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={salvarAfastamento} disabled={salvandoAfastamento}>
              {salvandoAfastamento ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

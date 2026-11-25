/**
 * Fases "Obrigações" e "Relatórios" do Módulo Fiscal (Fatia 2 Makro).
 * Obrigações: apuração por regime (service fiscalMakro) + link para o SPED
 * Fiscal/Contribuições existente na plataforma (aba "sped" de /fiscal).
 * Relatórios: relatório Estado/CFOP e serviços municipais (fiscalMakro).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Calculator, FileCode2, BarChart3, ExternalLink, Building2 } from 'lucide-react'
import {
  apurarCompetencia,
  carregarApuracao,
  relatorioEstadoCfop,
  relatorioServicosMunicipais,
  type ApuracaoResultado,
  type ResumoEstadoCfop,
  type ResumoServicosMunicipais,
  type MovimentoFiscal,
} from '@/services/fiscalMakro'
import type { Empresa, EmpresaRegime } from '@/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/formatters'

const REGIME_LABEL: Record<string, string> = {
  simples_nacional: 'Simples Nacional',
  lucro_presumido: 'Lucro Presumido',
  lucro_real: 'Lucro Real',
  mei: 'MEI',
}

// ---------------------------------------------------------------------------
// Fase: Obrigações (apuração + SPED)
// ---------------------------------------------------------------------------

export function ObrigacoesFase({
  tenantId,
  empresa,
  competencia,
  movimentos,
}: {
  tenantId?: string
  empresa: Empresa | null
  competencia: string
  movimentos: MovimentoFiscal[]
}) {
  const { toast } = useToast()
  const [anexo, setAnexo] = useState('III')
  const [calculando, setCalculando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [apuracao, setApuracao] = useState<ApuracaoResultado | null>(null)
  const [salva, setSalva] = useState<any | null>(null)

  const regime = (empresa?.regime_tributario || 'simples_nacional') as EmpresaRegime
  const regimeApuravel = ['simples_nacional', 'lucro_presumido', 'lucro_real'].includes(regime)

  const carregar = useCallback(async () => {
    if (!tenantId || !empresa) {
      setApuracao(null)
      setSalva(null)
      return
    }
    const existente = await carregarApuracao({
      tenantId,
      empresaId: empresa.id,
      competencia,
    })
    setSalva(existente)
    try {
      if (existente?.detalhes_json) setApuracao(JSON.parse(existente.detalhes_json))
    } catch {
      /* detalhes_json não é JSON do resultado — ignora */
    }
  }, [tenantId, empresa, competencia])

  useEffect(() => {
    carregar()
  }, [carregar])

  const calcular = async (confirmar = false) => {
    if (!tenantId || !empresa) return
    confirmar ? setConfirmando(true) : setCalculando(true)
    try {
      const res = await apurarCompetencia({
        tenantId,
        empresaId: empresa.id,
        competencia,
        regime: regime as 'simples_nacional' | 'lucro_presumido' | 'lucro_real',
        anexoSimples:
          regime === 'simples_nacional'
            ? anexo
            : regime === 'lucro_presumido'
              ? 'servicos'
              : undefined,
        confirmar,
      })
      setApuracao(res)
      if (confirmar) toast({ title: 'Apuração confirmada' })
      carregar()
    } catch {
      toast({ variant: 'destructive', title: 'Falha na apuração da competência' })
    } finally {
      setCalculando(false)
      setConfirmando(false)
    }
  }

  const receitaTributavel = movimentos
    .filter((m) => m.tipo_movimento === 'saida' || m.tipo_movimento === 'servico_prestado')
    .reduce((s, m) => s + (m.valor_total || 0), 0)

  if (!empresa) {
    return (
      <Card className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-xs text-slate-500">
        Selecione uma empresa no cabeçalho para calcular a apuração da competência.
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-[#E2E8F0] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-[#1A2333]">Apuração por regime</h4>
            <p className="text-xs text-[#64748B] mt-0.5">
              {empresa.nome_fantasia || empresa.razao_social} · {REGIME_LABEL[regime] || regime} ·{' '}
              {competencia}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {regime === 'simples_nacional' && (
              <div className="space-y-1">
                <Label htmlFor="anexo-simples" className="text-[11px] text-[#64748B]">
                  Anexo
                </Label>
                <select
                  id="anexo-simples"
                  value={anexo}
                  onChange={(e) => setAnexo(e.target.value)}
                  className="h-9 rounded-xl border border-[#E2E8F0] bg-white px-2 text-xs"
                >
                  <option value="I">Anexo I — Comércio</option>
                  <option value="II">Anexo II — Indústria</option>
                  <option value="III">Anexo III — Serviços</option>
                  <option value="IV">Anexo IV — Serviços/Obras</option>
                  <option value="V">Anexo V — Serviços (intelectual)</option>
                </select>
              </div>
            )}
            <Button
              onClick={() => calcular(false)}
              disabled={calculando || confirmando || !regimeApuravel}
              className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs h-9"
            >
              {calculando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4" />
              )}
              Calcular
            </Button>
            <Button
              onClick={() => calcular(true)}
              disabled={calculando || confirmando || !regimeApuravel}
              variant="outline"
              className="gap-2 rounded-xl border-[#0FA3A3]/40 text-[#0FA3A3] hover:bg-teal-50 text-xs h-9"
            >
              {confirmando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirmar
            </Button>
          </div>
        </div>
        {!regimeApuravel && (
          <p className="text-xs text-amber-600 mt-2">
            Regime {REGIME_LABEL[regime] || regime} sem apuração automática — cadastre o regime da
            empresa na ficha cadastral.
          </p>
        )}
      </Card>

      {apuracao && (
        <Card className="rounded-2xl border-[#E2E8F0] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h4 className="text-sm font-bold text-[#1A2333]">Guias da competência</h4>
            <Badge
              variant="outline"
              className="text-[10px] font-bold bg-slate-50 text-slate-600 border-slate-200"
            >
              {salva?.status === 'confirmada' ? 'Confirmada' : salva ? 'Rascunho' : 'Prévia'}
            </Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <MiniStat
              label="Receita tributável"
              value={formatCurrency(apuracao.receita_tributavel)}
            />
            <MiniStat label="Receita isenta" value={formatCurrency(apuracao.receita_isenta)} />
            {apuracao.rbt12 !== undefined && (
              <MiniStat label="RBT12" value={formatCurrency(apuracao.rbt12)} />
            )}
            <MiniStat
              label="Total de tributos"
              value={formatCurrency(apuracao.total_tributos)}
              destaque
            />
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Tributo/Guia</th>
                  <th className="text-right px-3 py-2 font-semibold">Base</th>
                  <th className="text-right px-3 py-2 font-semibold">Alíq. %</th>
                  <th className="text-right px-3 py-2 font-semibold">Valor</th>
                  <th className="text-left px-3 py-2 font-semibold">Vencimento</th>
                </tr>
              </thead>
              <tbody>
                {apuracao.guias.map((g, i) => (
                  <tr key={`${g.tributo}-${i}`} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-700">{g.tributo}</td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {formatCurrency(g.base)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">{g.aliquota.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">
                      {formatCurrency(g.valor)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{g.vencimento}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            As guias são lançamentos da apuração (registro), não emissão real de DAR/boleto.
          </p>
        </Card>
      )}

      {/* Link para o SPED existente */}
      <Card className="rounded-2xl border-[#E2E8F0] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-blue-50 p-2 shrink-0">
              <FileCode2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#1A2333]">
                SPED &amp; Escrituração (ECD / ECF / EFD)
              </h4>
              <p className="text-xs text-[#64748B] mt-0.5">
                O SPED Fiscal/Contribuições já existente na plataforma abre na aba "SPED &amp;
                Escrituração" do módulo Fiscal — os arquivos gerados lá não são regenerados aqui.
              </p>
            </div>
          </div>
          <Link to="/fiscal?tab=sped" aria-label="Abrir SPED e Escrituração no módulo Fiscal">
            <Button
              className="gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs h-9"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-4 w-4" />
              Abrir SPED
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}

function MiniStat({
  label,
  value,
  destaque,
}: {
  label: string
  value: string
  destaque?: boolean
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[11px] font-semibold text-[#64748B]">{label}</p>
      <p
        className={cnText(
          'text-sm font-bold mt-0.5',
          destaque ? 'text-[#0FA3A3]' : 'text-[#1A2333]',
        )}
      >
        {value}
      </p>
    </div>
  )
}

const cnText = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ')

// ---------------------------------------------------------------------------
// Fase: Relatórios
// ---------------------------------------------------------------------------

export function RelatoriosFase({
  tenantId,
  empresa,
  competencia,
}: {
  tenantId?: string
  empresa: Empresa | null
  competencia: string
}) {
  const [carregando, setCarregando] = useState(false)
  const [estadoCfop, setEstadoCfop] = useState<ResumoEstadoCfop[]>([])
  const [servicos, setServicos] = useState<ResumoServicosMunicipais[]>([])

  const carregar = useCallback(async () => {
    if (!tenantId || !empresa) {
      setEstadoCfop([])
      setServicos([])
      return
    }
    setCarregando(true)
    try {
      const [ec, sv] = await Promise.all([
        relatorioEstadoCfop({ tenantId, empresaId: empresa.id, competencia }),
        relatorioServicosMunicipais({ tenantId, empresaId: empresa.id, competencia }),
      ])
      setEstadoCfop(ec)
      setServicos(sv)
    } catch {
      setEstadoCfop([])
      setServicos([])
    } finally {
      setCarregando(false)
    }
  }, [tenantId, empresa, competencia])

  useEffect(() => {
    carregar()
  }, [carregar])

  const totais = useMemo(
    () =>
      estadoCfop.reduce(
        (acc, l) => ({
          base: acc.base + l.base_calculo,
          icms: acc.icms + l.valor_icms,
          st: acc.st + l.valor_icms_st,
          fcp: acc.fcp + l.valor_fcp_st,
          isentas: acc.isentas + l.valor_isentas,
        }),
        { base: 0, icms: 0, st: 0, fcp: 0, isentas: 0 },
      ),
    [estadoCfop],
  )

  if (!empresa) {
    return (
      <Card className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-xs text-slate-500">
        <Building2 className="h-8 w-8 text-slate-400 mx-auto mb-2" />
        Selecione uma empresa no cabeçalho para gerar os relatórios da competência.
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-[#E2E8F0] p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-[#0FA3A3]" />
          <h4 className="text-sm font-bold text-[#1A2333]">Relatório Estado / CFOP</h4>
        </div>
        {carregando ? (
          <div className="flex items-center justify-center py-8 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : estadoCfop.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            Sem dados para {competencia}. Importe movimentações na fase Preparar.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">UF</th>
                    <th className="text-left px-3 py-2 font-semibold">CFOP</th>
                    <th className="text-right px-3 py-2 font-semibold">Base cálculo</th>
                    <th className="text-right px-3 py-2 font-semibold">ICMS</th>
                    <th className="text-right px-3 py-2 font-semibold">ICMS-ST</th>
                    <th className="text-right px-3 py-2 font-semibold">FCP-ST</th>
                    <th className="text-right px-3 py-2 font-semibold">Isentas</th>
                    <th className="text-right px-3 py-2 font-semibold">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {estadoCfop.map((l) => (
                    <tr key={`${l.uf}-${l.cfop}`} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-700 font-semibold">{l.uf}</td>
                      <td className="px-3 py-2 text-slate-600">{l.cfop}</td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        {formatCurrency(l.base_calculo)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        {formatCurrency(l.valor_icms)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        {formatCurrency(l.valor_icms_st)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        {formatCurrency(l.valor_fcp_st)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        {formatCurrency(l.valor_isentas)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-500">{l.quantidade_notas}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-semibold text-slate-700">
                  <tr>
                    <td className="px-3 py-2" colSpan={2}>
                      Totais
                    </td>
                    <td className="px-3 py-2 text-right">{formatCurrency(totais.base)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(totais.icms)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(totais.st)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(totais.fcp)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(totais.isentas)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </Card>

      <Card className="rounded-2xl border-[#E2E8F0] p-4">
        <h4 className="text-sm font-bold text-[#1A2333] mb-3">Serviços municipais (NFS-e)</h4>
        {carregando ? (
          <div className="flex items-center justify-center py-8 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : servicos.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            Sem NFS-e na competência {competencia}.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Município</th>
                  <th className="text-left px-3 py-2 font-semibold">Item lista</th>
                  <th className="text-right px-3 py-2 font-semibold">Base</th>
                  <th className="text-right px-3 py-2 font-semibold">ISS</th>
                  <th className="text-right px-3 py-2 font-semibold">Total</th>
                  <th className="text-right px-3 py-2 font-semibold">Notas</th>
                </tr>
              </thead>
              <tbody>
                {servicos.map((s) => (
                  <tr
                    key={`${s.municipio}-${s.item_lista_servico}`}
                    className="border-t border-slate-100"
                  >
                    <td className="px-3 py-2 text-slate-700 font-semibold">{s.municipio}</td>
                    <td className="px-3 py-2 text-slate-600">{s.item_lista_servico || '—'}</td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {formatCurrency(s.base_calculo)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {formatCurrency(s.valor_iss)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {formatCurrency(s.valor_total)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-500">{s.quantidade_notas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

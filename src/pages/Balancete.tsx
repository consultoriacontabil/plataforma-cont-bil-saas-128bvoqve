import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  FileSpreadsheet,
  Download,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Scale,
  Layers,
  ArrowRight,
  Filter,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { empresasService } from '@/services/empresas'
import { contabilService } from '@/services/contabil'
import type { Empresa, BalanceteItem, ContaTipo } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export default function BalancetePage() {
  const { tenant } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('')
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>('09/2026')

  // Dados do balancete
  const [itens, setItens] = useState<BalanceteItem[]>([])
  const [totalDebitos, setTotalDebitos] = useState(0)
  const [totalCreditos, setTotalCreditos] = useState(0)
  const [fechado, setFechado] = useState(true)
  const [diferenca, setDiferenca] = useState(0)

  // Controle de recolhimento de grupos sintéticos (Set com IDs recolhidos)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

  // Carregar empresas
  useEffect(() => {
    if (!tenant?.id) return
    const fetchEmpresas = async () => {
      try {
        const list = await empresasService.list(tenant.id)
        setEmpresas(list)
        if (list.length > 0 && !selectedEmpresaId) {
          setSelectedEmpresaId(list[0].id)
        }
      } catch (err) {
        console.error('Erro ao carregar empresas:', err)
      }
    }
    void fetchEmpresas()
  }, [tenant?.id, selectedEmpresaId])

  // Carregar Balancete
  const loadBalancete = useCallback(async () => {
    if (!tenant?.id || !selectedEmpresaId || !selectedCompetencia) return
    setLoading(true)
    try {
      const res = await contabilService.getBalancete(
        tenant.id,
        selectedEmpresaId,
        selectedCompetencia,
      )
      setItens(res.itens)
      setTotalDebitos(res.totalDebitos)
      setTotalCreditos(res.totalCreditos)
      setFechado(res.fechado)
      setDiferenca(res.diferenca)
    } catch (err) {
      console.error('Erro ao calcular balancete:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar balancete',
        description: 'Não foi possível consolidar os saldos do período selecionado.',
      })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, selectedEmpresaId, selectedCompetencia, toast])

  useEffect(() => {
    void loadBalancete()
  }, [loadBalancete])

  // Toggle colapso de conta sintética
  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const expandAll = () => setCollapsedIds(new Set())
  const collapseAll = () => {
    const allSinteticas = itens.filter((i) => i.isSintetica).map((i) => i.id)
    setCollapsedIds(new Set(allSinteticas))
  }

  // Filtragem de linhas visíveis com base na hierarquia recolhida
  const visibleItens = useMemo(() => {
    // Se o pai de um item (ou qualquer ancestral) estiver no collapsedIds, oculta o item
    const idToItem: Record<string, BalanceteItem> = {}
    itens.forEach((it) => {
      idToItem[it.id] = it
    })

    const isAncestorCollapsed = (paiId?: string): boolean => {
      if (!paiId) return false
      if (collapsedIds.has(paiId)) return true
      const parent = idToItem[paiId]
      return parent ? isAncestorCollapsed(parent.pai) : false
    }

    return itens.filter((it) => !isAncestorCollapsed(it.pai))
  }, [itens, collapsedIds])

  // Agrupamento por tipo de conta (Ativo, Passivo, Patrimônio, Receitas, Despesas)
  const itensPorTipo = useMemo(() => {
    const groups: {
      tipo: ContaTipo
      label: string
      color: string
      itens: BalanceteItem[]
      subtotalDebito: number
      subtotalCredito: number
      subtotalSaldoAtual: number
    }[] = [
      {
        tipo: 'ativo',
        label: '1. ATIVO',
        color: 'border-blue-500 text-blue-700',
        itens: [],
        subtotalDebito: 0,
        subtotalCredito: 0,
        subtotalSaldoAtual: 0,
      },
      {
        tipo: 'passivo',
        label: '2. PASSIVO E OBRIGAÇÕES',
        color: 'border-amber-500 text-amber-700',
        itens: [],
        subtotalDebito: 0,
        subtotalCredito: 0,
        subtotalSaldoAtual: 0,
      },
      {
        tipo: 'patrimonio',
        label: '2.2 PATRIMÔNIO LÍQUIDO',
        color: 'border-purple-500 text-purple-700',
        itens: [],
        subtotalDebito: 0,
        subtotalCredito: 0,
        subtotalSaldoAtual: 0,
      },
      {
        tipo: 'receita',
        label: '3. RECEITAS',
        color: 'border-emerald-500 text-emerald-700',
        itens: [],
        subtotalDebito: 0,
        subtotalCredito: 0,
        subtotalSaldoAtual: 0,
      },
      {
        tipo: 'despesa',
        label: '4. DESPESAS E CUSTOS',
        color: 'border-rose-500 text-rose-700',
        itens: [],
        subtotalDebito: 0,
        subtotalCredito: 0,
        subtotalSaldoAtual: 0,
      },
    ]

    visibleItens.forEach((it) => {
      const g = groups.find((x) => x.tipo === it.tipo)
      if (g) {
        g.itens.push(it)
        if (!it.isSintetica) {
          g.subtotalDebito += it.debitos
          g.subtotalCredito += it.creditos
          g.subtotalSaldoAtual += it.saldoAtual
        }
      }
    })

    return groups.filter((g) => g.itens.length > 0)
  }, [visibleItens])

  // Empresa selecionada
  const activeEmpresa = empresas.find((e) => e.id === selectedEmpresaId)

  // Exportar CSV do Balancete
  const handleExportCsv = () => {
    if (itens.length === 0) {
      toast({ title: 'Nenhum dado para exportar' })
      return
    }

    const headers = [
      'Codigo Contabil',
      'Descricao da Conta',
      'Tipo',
      'Nivel',
      'Classificacao',
      'Saldo Anterior (R$)',
      'Debitos Periodo (R$)',
      'Creditos Periodo (R$)',
      'Saldo Atual (R$)',
    ]

    const rows = itens.map((i) => [
      `"${i.codigo}"`,
      `"${i.nome.replace(/"/g, '""')}"`,
      `"${i.tipo}"`,
      i.nivel,
      i.isSintetica ? '"Sintetica"' : '"Analitica"',
      i.saldoAnterior.toFixed(2),
      i.debitos.toFixed(2),
      i.creditos.toFixed(2),
      i.saldoAtual.toFixed(2),
    ])

    // Linha de total geral
    rows.push([
      '"TOTAL GERAL"',
      '""',
      '""',
      '""',
      '""',
      '""',
      totalDebitos.toFixed(2),
      totalCreditos.toFixed(2),
      '""',
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    const sanitizedName = (activeEmpresa?.nome_fantasia || activeEmpresa?.razao_social || 'empresa')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
    link.setAttribute(
      'download',
      `balancete_${sanitizedName}_${selectedCompetencia.replace('/', '_')}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Balancete exportado com sucesso!',
      description: `Arquivo CSV gerado para competência ${selectedCompetencia}.`,
    })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-[#1A2333]">
              Balancete de Verificação
            </h2>
            <Badge className="bg-[#0FA3A3] text-white text-[11px] font-semibold">Oficial</Badge>
          </div>
          <p className="text-xs text-[#64748B]">
            Demonstrativo contábil de saldos anteriores, movimentação e posição atual do plano de
            contas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleExportCsv}
            variant="outline"
            className="gap-2 rounded-xl text-xs font-semibold h-10 border-[#E2E8F0] bg-white shadow-xs hover:bg-slate-50"
          >
            <Download className="h-4 w-4 text-[#0FA3A3]" />
            <span>Exportar Balancete (CSV)</span>
          </Button>
        </div>
      </div>

      {/* Identificação do Responsável Técnico Contábil e Base Regulatória (NBC TG 26 / ITG 2000 / NBC PP 01) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-[#334155]">
        <div className="flex items-center gap-2">
          <Badge className="bg-[#123B6D] text-white text-[10px] uppercase font-bold">
            NBC TG 26 / ITG 2000
          </Badge>
          <span>
            <b>Regime de Competência & Partida Dobrada:</b> Apuração oficial de débitos e créditos.
          </span>
        </div>
        <div className="text-[11px] text-[#64748B]">
          <span>Responsável Técnico: </span>
          <b className="text-[#1A2333]">
            {tenant?.responsavel_tecnico || 'Carlos Silva (Contador)'}
          </b>
          <span className="ml-1 text-[#0FA3A3] font-semibold">
            ({tenant?.crc_responsavel || 'CRC/SP nº 2SP034821/O'})
          </span>
        </div>
      </div>

      {/* Card / Indicadores de Fechamento no Topo */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Total Débitos do Período
              </p>
              <p className="text-xl font-bold text-[#1A2333] mt-1">
                R${' '}
                {totalDebitos.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-[#2563EB]">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Total Créditos do Período
              </p>
              <p className="text-xl font-bold text-[#1A2333] mt-1">
                R${' '}
                {totalCreditos.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-[#16A34A]">
              <TrendingDown className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Diferença de Partida
              </p>
              <p
                className={cn(
                  'text-xl font-bold mt-1',
                  fechado ? 'text-[#16A34A]' : 'text-[#EF4444]',
                )}
              >
                R${' '}
                {diferenca.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl',
                fechado ? 'bg-emerald-100 text-[#16A34A]' : 'bg-red-100 text-[#EF4444]',
              )}
            >
              <Scale className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn(
            'rounded-2xl border shadow-2xs',
            fechado ? 'border-emerald-200 bg-emerald-50/40' : 'border-red-200 bg-red-50/40',
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Status do Balancete
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                {fechado ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-[#16A34A]" />
                    <span className="text-base font-bold text-[#16A34A]">Fechado ✔</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-[#EF4444]" />
                    <span className="text-base font-bold text-[#EF4444]">Divergente</span>
                  </>
                )}
              </div>
            </div>
            <div className="text-[10px] text-right text-[#64748B]">
              <p>Competência: {selectedCompetencia}</p>
              <p>Débito = Crédito</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controles de Seleção e Navegação de Competência */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              {/* Seleção de Empresa */}
              <div className="space-y-1 min-w-[240px]">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Empresa / Cliente
                </label>
                <Select value={selectedEmpresaId} onValueChange={setSelectedEmpresaId}>
                  <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome_fantasia || e.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Seleção de Competência */}
              <div className="space-y-1 min-w-[160px]">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Competência
                </label>
                <Select value={selectedCompetencia} onValueChange={setSelectedCompetencia}>
                  <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                    <SelectValue placeholder="Competência" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="09/2026">09/2026 (Atual)</SelectItem>
                    <SelectItem value="08/2026">08/2026</SelectItem>
                    <SelectItem value="07/2026">07/2026</SelectItem>
                    <SelectItem value="06/2026">06/2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Ações de Colapso da Árvore */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={expandAll}
                className="h-8 text-xs rounded-xl border-[#E2E8F0]"
              >
                Expandir Tudo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={collapseAll}
                className="h-8 text-xs rounded-xl border-[#E2E8F0]"
              >
                Recolher Tudo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visão de Balancete de Verificação Hierárquico (CONTRATO Trilha RPA v1.0) */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table
            id="rpa-grid-balancete"
            data-total-rows={itens.length}
            data-total-debito={totalDebitos.toFixed(2)}
            data-total-credito={totalCreditos.toFixed(2)}
            data-diferenca={diferenca.toFixed(2)}
            data-rpa-equilibrado={fechado ? 'true' : 'false'}
            className="w-full text-left text-xs"
          >
            <thead className="border-b border-[#E2E8F0] bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
              <tr>
                <th className="py-3 px-4 w-[160px]">Código Contábil</th>
                <th className="py-3 px-4">Nome da Conta</th>
                <th className="py-3 px-4 text-right w-[140px]">Saldo Anterior</th>
                <th className="py-3 px-4 text-right w-[140px]">Débitos (Período)</th>
                <th className="py-3 px-4 text-right w-[140px]">Créditos (Período)</th>
                <th className="py-3 px-4 text-right w-[140px]">Saldo Atual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-[#94A3B8]">
                    Calculando balancete de verificação...
                  </td>
                </tr>
              ) : visibleItens.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-[#94A3B8]">
                    Nenhum lançamento contabilizado para esta empresa no período.
                  </td>
                </tr>
              ) : (
                itensPorTipo.map((grupo) => (
                  <React.Fragment key={grupo.tipo}>
                    {/* Header do Grupo (Ativo, Passivo, etc.) */}
                    <tr className="bg-slate-100/70 border-t-2 border-slate-200">
                      <td colSpan={6} className="py-2.5 px-4">
                        <span className="font-bold text-[12px] uppercase tracking-wider text-[#1A2333]">
                          {grupo.label}
                        </span>
                      </td>
                    </tr>

                    {/* Linhas de contas do grupo */}
                    {grupo.itens.map((it) => {
                      const isCollapsed = collapsedIds.has(it.id)
                      const paddingLeft = `${(it.nivel - 1) * 20 + 16}px`

                      return (
                        <tr
                          key={it.id}
                          className={cn(
                            'transition-colors hover:bg-slate-50/70',
                            it.isSintetica
                              ? 'font-bold bg-slate-50/40 text-[#1A2333]'
                              : 'font-normal text-[#334155]',
                          )}
                        >
                          {/* Código da Conta */}
                          <td className="py-2.5 px-4 font-mono text-xs whitespace-nowrap">
                            {it.codigo}
                          </td>

                          {/* Nome da Conta com Recuo Hierárquico e Toggle */}
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-1.5" style={{ paddingLeft }}>
                              {it.isSintetica ? (
                                <button
                                  onClick={() => toggleCollapse(it.id)}
                                  className="flex h-5 w-5 items-center justify-center rounded hover:bg-slate-200 text-[#64748B]"
                                  aria-label={isCollapsed ? 'Expandir' : 'Recolher'}
                                >
                                  {isCollapsed ? (
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              ) : (
                                <span className="inline-block w-5 h-5 flex-shrink-0" />
                              )}
                              <span className={cn(it.isSintetica && 'text-[#0B1F3A]')}>
                                {it.nome}
                              </span>
                            </div>
                          </td>

                          {/* Saldo Anterior */}
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">
                            R${' '}
                            {it.saldoAnterior.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>

                          {/* Débitos */}
                          <td
                            className={cn(
                              'py-2.5 px-4 text-right whitespace-nowrap',
                              it.debitos > 0 && 'font-semibold text-blue-700',
                            )}
                          >
                            R${' '}
                            {it.debitos.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>

                          {/* Créditos */}
                          <td
                            className={cn(
                              'py-2.5 px-4 text-right whitespace-nowrap',
                              it.creditos > 0 && 'font-semibold text-emerald-700',
                            )}
                          >
                            R${' '}
                            {it.creditos.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>

                          {/* Saldo Atual */}
                          <td
                            className={cn(
                              'py-2.5 px-4 text-right whitespace-nowrap font-semibold',
                              it.saldoAtual < 0 ? 'text-[#EF4444]' : 'text-[#1A2333]',
                            )}
                          >
                            R${' '}
                            {it.saldoAtual.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      )
                    })}
                  </React.Fragment>
                ))
              )}
            </tbody>

            {/* Totais Gerais */}
            {!loading && itens.length > 0 && (
              <tfoot className="border-t-2 border-[#123B6D] bg-slate-100 font-bold text-xs text-[#1A2333]">
                <tr>
                  <td colSpan={2} className="py-3 px-4 uppercase tracking-wider text-right">
                    Totais do Balancete:
                  </td>
                  <td className="py-3 px-4 text-right text-[#64748B]">—</td>
                  <td className="py-3 px-4 text-right text-blue-700 font-extrabold whitespace-nowrap">
                    R${' '}
                    {totalDebitos.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-700 font-extrabold whitespace-nowrap">
                    R${' '}
                    {totalCreditos.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {fechado ? (
                      <span className="text-[#16A34A] flex items-center justify-end gap-1">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Equilibrado</span>
                      </span>
                    ) : (
                      <span className="text-[#EF4444]">Dif: R$ {diferenca.toFixed(2)}</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  )
}

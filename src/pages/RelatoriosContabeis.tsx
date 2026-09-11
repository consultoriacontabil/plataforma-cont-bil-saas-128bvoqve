import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  FileSpreadsheet,
  Download,
  Building2,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Scale,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Printer,
  ChevronRight,
  PieChart,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { empresasService } from '@/services/empresas'
import {
  relatoriosContabeisService,
  type DREResultado,
  type BalancoResultado,
} from '@/services/relatoriosContabeis'
import { demonstrativosService } from '@/services/demonstrativos'
import { DemonstrativoModalView } from '@/components/DemonstrativoModalView'
import type { Empresa, DemonstrativoRecord, DemonstrativoTipo } from '@/types'
import { formatDatePtBr } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export default function RelatoriosContabeisPage() {
  const { tenant } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('')
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>('09/2026')
  const [activeTab, setActiveTab] = useState<'dre' | 'balanco' | 'demonstrativos'>('dre')

  // Dados dos relatórios
  const [dreData, setDreData] = useState<DREResultado | null>(null)
  const [balancoData, setBalancoData] = useState<BalancoResultado | null>(null)

  // Módulo 1: Demonstrativos para assinatura
  const [demonstrativos, setDemonstrativos] = useState<DemonstrativoRecord[]>([])
  const [loadingDemonstrativos, setLoadingDemonstrativos] = useState(false)
  const [modalViewOpen, setModalViewOpen] = useState(false)
  const [viewingDemonstrativo, setViewingDemonstrativo] = useState<DemonstrativoRecord | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // 1. Carregar Empresas
  useEffect(() => {
    if (!tenant?.id) return
    const fetchEmpresas = async () => {
      try {
        const emps = await empresasService.list(tenant.id)
        setEmpresas(emps)
        if (emps.length > 0 && !selectedEmpresaId) {
          setSelectedEmpresaId(emps[0].id)
        }
      } catch (err) {
        console.error('Erro ao carregar empresas:', err)
      }
    }
    void fetchEmpresas()
  }, [tenant?.id, selectedEmpresaId])

  // 2. Carregar DRE e Balanço da empresa + competência
  const loadRelatorios = useCallback(async () => {
    if (!tenant?.id || !selectedEmpresaId || !selectedCompetencia) return
    setLoading(true)
    try {
      const [dreRes, balancoRes, dems] = await Promise.all([
        relatoriosContabeisService.gerarDRE(tenant.id, selectedEmpresaId, selectedCompetencia),
        relatoriosContabeisService.gerarBalancoPatrimonial(
          tenant.id,
          selectedEmpresaId,
          selectedCompetencia,
        ),
        demonstrativosService.list(tenant.id, {
          empresaId: selectedEmpresaId,
          competencia: selectedCompetencia,
        }),
      ])
      setDreData(dreRes)
      setBalancoData(balancoRes)
      setDemonstrativos(dems)
    } catch (err) {
      console.error('Erro ao gerar relatórios contábeis:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao processar balancete',
        description: 'Não foi possível apurar o DRE ou Balanço Patrimonial para a competência.',
      })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, selectedEmpresaId, selectedCompetencia, toast])

  useEffect(() => {
    void loadRelatorios()
  }, [loadRelatorios])

  const activeEmpresa = useMemo(
    () => empresas.find((e) => e.id === selectedEmpresaId),
    [empresas, selectedEmpresaId],
  )

  // Exportar DRE CSV
  const handleExportDRECSV = () => {
    if (!dreData) return
    const headers = ['Código', 'Descrição da Linha', 'Tipo', 'Valor (R$)']
    const rows = dreData.linhas.map((l) => [
      `"${l.codigo}"`,
      `"${l.descricao.replace(/"/g, '""')}"`,
      `"${l.tipo}"`,
      `"${l.negativo ? `-${l.valor.toFixed(2)}` : l.valor.toFixed(2)}"`,
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute(
      'download',
      `DRE_${activeEmpresa?.nome_fantasia || 'empresa'}_${selectedCompetencia.replace('/', '-')}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Exportar Balanço Patrimonial CSV
  const handleExportBalancoCSV = () => {
    if (!balancoData) return
    const headers = ['Grupo / Classificação', 'Código Conta', 'Nome da Conta', 'Saldo Atual (R$)']
    const rows: string[][] = []

    const appendSubgrupo = (sub: BalancoResultado['ativoCirculante']) => {
      rows.push([
        `"${sub.nome.toUpperCase()}"`,
        `"${sub.codigo}"`,
        `""`,
        `"${sub.saldo.toFixed(2)}"`,
      ])
      sub.contas.forEach((c) => {
        rows.push([
          `"${sub.nome}"`,
          `"${c.codigo}"`,
          `"${c.nome.replace(/"/g, '""')}"`,
          `"${c.saldo.toFixed(2)}"`,
        ])
      })
    }

    appendSubgrupo(balancoData.ativoCirculante)
    appendSubgrupo(balancoData.ativoNaoCirculante)
    rows.push(['"TOTAL DO ATIVO"', '""', '""', `"${balancoData.ativoTotal.toFixed(2)}"`])

    appendSubgrupo(balancoData.passivoCirculante)
    appendSubgrupo(balancoData.patrimonioLiquido)
    rows.push(['"TOTAL DO PASSIVO + PL"', '""', '""', `"${balancoData.passivoMaisPL.toFixed(2)}"`])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute(
      'download',
      `Balanco_Patrimonial_${activeEmpresa?.nome_fantasia || 'empresa'}_${selectedCompetencia.replace('/', '-')}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Módulo 1: Gerar Demonstrativo para Assinatura (DRE ou Balanço)
  const handleGerarDemonstrativoAssinatura = async (tipo: DemonstrativoTipo) => {
    if (!tenant?.id || !selectedEmpresaId || !selectedCompetencia) {
      toast({
        variant: 'destructive',
        title: 'Seleção necessária',
        description: 'Selecione a empresa e a competência antes de gerar o demonstrativo.',
      })
      return
    }

    const payload = tipo === 'dre' ? dreData : balancoData
    if (!payload) {
      toast({
        variant: 'destructive',
        title: 'Dados indisponíveis',
        description: 'Não há dados calculados para este demonstrativo no período.',
      })
      return
    }

    setActionLoading(true)
    try {
      const dem = await demonstrativosService.gerarDemonstrativo({
        tenantId: tenant.id,
        empresaId: selectedEmpresaId,
        competencia: selectedCompetencia,
        tipo,
        dados: payload,
      })

      toast({
        title: 'Demonstrativo congelado!',
        description: `${tipo.toUpperCase()} congelada em rascunho para assinatura. Você pode enviar ao cliente.`,
      })
      loadRelatorios()
      setViewingDemonstrativo(dem)
      setModalViewOpen(true)
    } catch (err) {
      console.error('Erro ao gerar demonstrativo para assinatura:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar demonstrativo',
        description: 'Não foi possível congelar os dados para assinatura.',
      })
    } finally {
      setActionLoading(false)
    }
  }

  // Enviar ao cliente
  const handleEnviarAoCliente = async (id: string) => {
    setActionLoading(true)
    try {
      await demonstrativosService.enviarAoCliente(id)
      toast({
        title: 'Demonstrativo enviado!',
        description:
          'O cliente receberá uma notificação e e-mail para validar e assinar no Portal.',
      })
      loadRelatorios()
    } catch (err) {
      console.error('Erro ao enviar demonstrativo:', err)
      toast({
        variant: 'destructive',
        title: 'Erro no envio',
        description: 'Falha ao notificar o cliente.',
      })
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-[#1A2333]">
              DRE & Balanço Patrimonial
            </h2>
            <Badge className="bg-[#0FA3A3] text-white text-[11px] font-semibold">Oficial</Badge>
          </div>
          <p className="text-xs text-[#64748B]">
            Demonstrações contábeis regulatórias geradas automaticamente a partir do balancete de
            verificação e plano de contas
          </p>
        </div>

        {/* Ações de Topo: Gerar para Assinatura & Exportações */}
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'dre' && (
            <Button
              onClick={() => handleGerarDemonstrativoAssinatura('dre')}
              disabled={!dreData || actionLoading}
              className="gap-2 rounded-xl text-xs font-semibold h-10 bg-[#0FA3A3] hover:bg-[#0C8585] text-white shadow-xs"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Gerar DRE para Assinatura</span>
            </Button>
          )}

          {activeTab === 'balanco' && (
            <Button
              onClick={() => handleGerarDemonstrativoAssinatura('balanco')}
              disabled={!balancoData || actionLoading}
              className="gap-2 rounded-xl text-xs font-semibold h-10 bg-[#0FA3A3] hover:bg-[#0C8585] text-white shadow-xs"
            >
              <Scale className="h-4 w-4" />
              <span>Gerar Balanço para Assinatura</span>
            </Button>
          )}

          {activeTab === 'dre' && (
            <Button
              onClick={handleExportDRECSV}
              variant="outline"
              disabled={!dreData}
              className="gap-2 rounded-xl text-xs font-semibold h-10 border-[#E2E8F0] bg-white shadow-xs hover:bg-slate-50"
            >
              <Download className="h-4 w-4 text-[#64748B]" />
              <span>Exportar DRE (CSV)</span>
            </Button>
          )}

          {activeTab === 'balanco' && (
            <Button
              onClick={handleExportBalancoCSV}
              variant="outline"
              disabled={!balancoData}
              className="gap-2 rounded-xl text-xs font-semibold h-10 border-[#E2E8F0] bg-white shadow-xs hover:bg-slate-50"
            >
              <Download className="h-4 w-4 text-[#64748B]" />
              <span>Exportar Balanço (CSV)</span>
            </Button>
          )}

          <Button
            onClick={loadRelatorios}
            variant="ghost"
            size="sm"
            className="h-10 text-xs text-[#0FA3A3] hover:text-[#0C8585] rounded-xl"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filtros de Empresa e Período */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Empresa */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Empresa Contábil *
              </label>
              <Select value={selectedEmpresaId} onValueChange={setSelectedEmpresaId}>
                <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0] font-semibold">
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome_fantasia || e.razao_social} ({e.cnpj})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Período / Competência */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Competência de Apuração *
              </label>
              <Select value={selectedCompetencia} onValueChange={setSelectedCompetencia}>
                <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0] font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="08/2026">08/2026 (Agosto 2026)</SelectItem>
                  <SelectItem value="09/2026">09/2026 (Setembro 2026)</SelectItem>
                  <SelectItem value="10/2026">10/2026 (Outubro 2026)</SelectItem>
                  <SelectItem value="11/2026">11/2026 (Novembro 2026)</SelectItem>
                  <SelectItem value="12/2026">12/2026 (Dezembro 2026)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs: DRE vs Balanço Patrimonial */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'dre' | 'balanco')}>
        <TabsList className="bg-slate-100 p-1 rounded-2xl h-11 w-full sm:w-auto">
          <TabsTrigger
            value="dre"
            className="rounded-xl px-6 py-2 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-[#0FA3A3] data-[state=active]:shadow-xs"
          >
            DRE (Demonstração do Resultado)
          </TabsTrigger>
          <TabsTrigger
            value="balanco"
            className="rounded-xl px-6 py-2 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-[#0FA3A3] data-[state=active]:shadow-xs"
          >
            Balanço Patrimonial
          </TabsTrigger>
          <TabsTrigger
            value="demonstrativos"
            className="rounded-xl px-6 py-2 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-[#0FA3A3] data-[state=active]:shadow-xs flex items-center gap-1.5"
          >
            <span>Assinaturas & Envio</span>
            {demonstrativos.length > 0 && (
              <Badge className="h-5 px-1.5 bg-slate-200 text-slate-700 text-[10px] font-bold">
                {demonstrativos.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ================= ABA 1: DRE ================= */}
        <TabsContent value="dre" className="space-y-6 mt-4">
          {/* Cards de Resumo DRE */}
          {dreData && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                      Receita Bruta
                    </p>
                    <p className="text-xl font-bold text-[#1A2333] mt-1">
                      R${' '}
                      {dreData.receitaBruta.toLocaleString('pt-BR', {
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
                      Receita Líquida
                    </p>
                    <p className="text-xl font-bold text-[#0FA3A3] mt-1">
                      R${' '}
                      {dreData.receitaLiquida.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-[#0FA3A3]">
                    <DollarSign className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                      Despesas Operacionais
                    </p>
                    <p className="text-xl font-bold text-[#DC2626] mt-1">
                      (-) R${' '}
                      {dreData.despesasOperacionais.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-[#DC2626]">
                    <TrendingDown className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                      Resultado Líquido
                    </p>
                    <p
                      className={cn(
                        'text-xl font-bold mt-1',
                        dreData.resultadoLiquido >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]',
                      )}
                    >
                      {dreData.resultadoLiquido >= 0 ? 'R$ ' : '(-) R$ '}
                      {Math.abs(dreData.resultadoLiquido).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-xl',
                      dreData.resultadoLiquido >= 0
                        ? 'bg-emerald-100 text-[#16A34A]'
                        : 'bg-red-100 text-[#DC2626]',
                    )}
                  >
                    <Scale className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Demonstração Estruturada DRE */}
          <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-[#E2E8F0] py-4 px-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-[#1A2333]">
                  Demonstração do Resultado do Exercício — Padrão CPC / CFC
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  {activeEmpresa?.razao_social || 'Empresa'} • Competência: {selectedCompetencia}
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] uppercase font-bold text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-6 w-32">Código</th>
                      <th className="py-3 px-6">Descrição da Conta / Linha</th>
                      <th className="py-3 px-6 text-right w-48">Valor (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {loading ? (
                      <tr>
                        <td colSpan={3} className="py-12 text-center text-[#94A3B8]">
                          Calculando DRE a partir do balancete...
                        </td>
                      </tr>
                    ) : !dreData || dreData.linhas.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-12 text-center text-[#94A3B8]">
                          Sem movimentação de receitas ou despesas nesta competência.
                        </td>
                      </tr>
                    ) : (
                      dreData.linhas.map((linha) => {
                        const isGrupo = linha.tipo === 'grupo'
                        const isTotalizador = linha.tipo === 'totalizador'
                        const isResultado = linha.tipo === 'resultado'
                        const isConta = linha.tipo === 'conta'

                        return (
                          <tr
                            key={linha.id}
                            className={cn(
                              'transition-colors',
                              isResultado
                                ? 'bg-emerald-50/80 font-bold text-base'
                                : isTotalizador
                                  ? 'bg-slate-50 font-bold'
                                  : isGrupo
                                    ? 'bg-[#F8FAFC] font-semibold text-[#1A2333]'
                                    : 'hover:bg-slate-50/60 text-[#64748B]',
                            )}
                          >
                            <td
                              className={cn(
                                'py-3 px-6 font-mono',
                                isConta
                                  ? 'pl-10 text-[11px] text-[#94A3B8]'
                                  : 'font-bold text-[#1A2333]',
                              )}
                            >
                              {linha.codigo}
                            </td>
                            <td
                              className={cn(
                                'py-3 px-6',
                                isConta
                                  ? 'pl-10 text-xs text-[#334155]'
                                  : 'font-bold text-[#1A2333]',
                                isResultado && 'text-[#16A34A] font-extrabold',
                              )}
                            >
                              {linha.descricao}
                            </td>
                            <td
                              className={cn(
                                'py-3 px-6 text-right font-mono',
                                isConta ? 'text-xs' : 'font-bold text-sm text-[#1A2333]',
                                linha.negativo ? 'text-[#DC2626]' : '',
                                isResultado &&
                                  (linha.valor >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'),
                              )}
                            >
                              {linha.negativo ? (
                                <span>
                                  (
                                  {linha.valor.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                  })}
                                  )
                                </span>
                              ) : (
                                <span>
                                  {linha.valor.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                  })}
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= ABA 2: BALANÇO PATRIMONIAL ================= */}
        <TabsContent value="balanco" className="space-y-6 mt-4">
          {/* Card Verificação da Equação Contábil */}
          {balancoData && (
            <div
              className={cn(
                'rounded-2xl border p-4 text-xs flex items-center justify-between gap-4 shadow-2xs',
                balancoData.equilibrado
                  ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
                  : 'border-amber-200 bg-amber-50/70 text-amber-950',
              )}
            >
              <div className="flex items-center gap-3">
                {balancoData.equilibrado ? (
                  <CheckCircle2 className="h-6 w-6 text-[#16A34A] shrink-0" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-[#D97706] shrink-0" />
                )}
                <div>
                  <p className="font-bold text-sm">
                    {balancoData.equilibrado
                      ? 'Equação Fundamental Equilibrada: Ativo = Passivo + Patrimônio Líquido'
                      : 'Atenção: Balanço Patrimonial com Diferença na Partida'}
                  </p>
                  <p className="text-slate-600">
                    Total do Ativo: R${' '}
                    {balancoData.ativoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} •
                    Total Passivo + PL: R${' '}
                    {balancoData.passivoMaisPL.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}{' '}
                    {balancoData.diferenca > 0 &&
                      `(Diferença: R$ ${balancoData.diferenca.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`}
                  </p>
                </div>
              </div>

              <Badge
                className={cn(
                  'text-xs font-bold py-1 px-3',
                  balancoData.equilibrado ? 'bg-[#16A34A] text-white' : 'bg-[#D97706] text-white',
                )}
              >
                {balancoData.equilibrado ? '100% Equilibrado' : 'Ajuste Pendente'}
              </Badge>
            </div>
          )}

          {/* Duas Colunas: Ativo (Lado Esquerdo) vs Passivo + PL (Lado Direito) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LADO ESQUERDO: ATIVO */}
            <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs overflow-hidden">
              <CardHeader className="bg-blue-50/40 border-b border-[#E2E8F0] py-3.5 px-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-[#2563EB] uppercase tracking-wider">
                    Ativo Total
                  </CardTitle>
                  <span className="text-base font-bold text-[#1A2333]">
                    R${' '}
                    {(balancoData?.ativoTotal || 0).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="p-0 divide-y divide-[#E2E8F0]">
                {/* 1.1 Ativo Circulante */}
                <div className="p-4 bg-[#F8FAFC]">
                  <div className="flex items-center justify-between font-bold text-xs text-[#1A2333]">
                    <span>1.1 Ativo Circulante (Disponibilidades e Créditos)</span>
                    <span>
                      R${' '}
                      {(balancoData?.ativoCirculante.saldo || 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1.5 pl-3">
                    {balancoData?.ativoCirculante.contas.map((c) => (
                      <div
                        key={c.codigo}
                        className="flex items-center justify-between text-[11px] text-[#64748B]"
                      >
                        <span>
                          <span className="font-mono text-[#94A3B8] mr-1.5">{c.codigo}</span>
                          {c.nome}
                        </span>
                        <span className="font-mono font-medium text-[#1A2333]">
                          R$ {c.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 1.2 Ativo Não Circulante (Imobilizado) */}
                <div className="p-4 bg-white">
                  <div className="flex items-center justify-between font-bold text-xs text-[#1A2333]">
                    <span>1.2 Ativo Não Circulante (Imobilizado e Investimentos)</span>
                    <span>
                      R${' '}
                      {(balancoData?.ativoNaoCirculante.saldo || 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1.5 pl-3">
                    {balancoData?.ativoNaoCirculante.contas.map((c) => (
                      <div
                        key={c.codigo}
                        className="flex items-center justify-between text-[11px] text-[#64748B]"
                      >
                        <span>
                          <span className="font-mono text-[#94A3B8] mr-1.5">{c.codigo}</span>
                          {c.nome}
                        </span>
                        <span className="font-mono font-medium text-[#1A2333]">
                          R$ {c.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* LADO DIREITO: PASSIVO + PATRIMÔNIO LÍQUIDO */}
            <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs overflow-hidden">
              <CardHeader className="bg-purple-50/40 border-b border-[#E2E8F0] py-3.5 px-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-purple-700 uppercase tracking-wider">
                    Passivo + Patrimônio Líquido
                  </CardTitle>
                  <span className="text-base font-bold text-[#1A2333]">
                    R${' '}
                    {(balancoData?.passivoMaisPL || 0).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="p-0 divide-y divide-[#E2E8F0]">
                {/* 2.1 Passivo Circulante */}
                <div className="p-4 bg-[#F8FAFC]">
                  <div className="flex items-center justify-between font-bold text-xs text-[#1A2333]">
                    <span>2.1 Passivo Circulante (Obrigações e Fornecedores)</span>
                    <span>
                      R${' '}
                      {(balancoData?.passivoCirculante.saldo || 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1.5 pl-3">
                    {balancoData?.passivoCirculante.contas.map((c) => (
                      <div
                        key={c.codigo}
                        className="flex items-center justify-between text-[11px] text-[#64748B]"
                      >
                        <span>
                          <span className="font-mono text-[#94A3B8] mr-1.5">{c.codigo}</span>
                          {c.nome}
                        </span>
                        <span className="font-mono font-medium text-[#1A2333]">
                          R$ {c.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2.2 Patrimônio Líquido */}
                <div className="p-4 bg-white">
                  <div className="flex items-center justify-between font-bold text-xs text-[#1A2333]">
                    <span>2.2 Patrimônio Líquido (Capital Social e Reservas)</span>
                    <span>
                      R${' '}
                      {(balancoData?.patrimonioLiquido.saldo || 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1.5 pl-3">
                    {balancoData?.patrimonioLiquido.contas.map((c) => (
                      <div
                        key={c.codigo}
                        className="flex items-center justify-between text-[11px] text-[#64748B]"
                      >
                        <span>
                          <span className="font-mono text-[#94A3B8] mr-1.5">{c.codigo}</span>
                          {c.nome}
                        </span>
                        <span className="font-mono font-medium text-[#1A2333]">
                          R$ {c.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ================= ABA 3: DEMONSTRATIVOS PARA ASSINATURA ================= */}
        <TabsContent value="demonstrativos" className="space-y-6 mt-4">
          <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-[#E2E8F0] py-4 px-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-[#1A2333]">
                  Demonstrativos Contábeis Oficiais para Assinatura
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  Histórico de DREs e Balanços congelados com tracking de status (Rascunho, Enviado,
                  Aprovado ou Reprovado)
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] uppercase font-bold text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-6">Tipo</th>
                      <th className="py-3 px-6">Empresa</th>
                      <th className="py-3 px-6">Competência</th>
                      <th className="py-3 px-6">Status</th>
                      <th className="py-3 px-6">Envio / Aprovação</th>
                      <th className="py-3 px-6 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {demonstrativos.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-[#94A3B8]">
                          Nenhum demonstrativo gerado para esta empresa e competência.{' '}
                          <span className="block text-[11px] text-[#64748B] mt-1">
                            Clique em "Gerar DRE para Assinatura" ou "Gerar Balanço para Assinatura"
                            acima para congelar os números oficiais.
                          </span>
                        </td>
                      </tr>
                    ) : (
                      demonstrativos.map((dem) => {
                        const statusColors: Record<string, string> = {
                          rascunho: 'bg-slate-100 text-slate-700',
                          enviado: 'bg-blue-100 text-blue-700 font-semibold',
                          aprovado: 'bg-emerald-100 text-emerald-700 font-bold',
                          reprovado: 'bg-rose-100 text-rose-700 font-bold',
                        }
                        const statusLabels: Record<string, string> = {
                          rascunho: 'Rascunho',
                          enviado: 'Aguardando Aprovação',
                          aprovado: 'Aprovado pelo Cliente',
                          reprovado: 'Reprovado pelo Cliente',
                        }

                        return (
                          <tr key={dem.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3.5 px-6 font-bold uppercase text-[#1A2333]">
                              {dem.tipo.toUpperCase()}
                            </td>
                            <td className="py-3.5 px-6 font-medium text-[#334155]">
                              {activeEmpresa?.nome_fantasia ||
                                activeEmpresa?.razao_social ||
                                'Empresa'}
                            </td>
                            <td className="py-3.5 px-6 font-mono text-[#64748B]">
                              {dem.competencia}
                            </td>
                            <td className="py-3.5 px-6">
                              <Badge
                                className={cn(
                                  'text-[11px] py-0.5 px-2.5',
                                  statusColors[dem.status],
                                )}
                              >
                                {statusLabels[dem.status]}
                              </Badge>
                              {dem.status === 'reprovado' && dem.observacoes_cliente && (
                                <p className="text-[11px] text-rose-600 mt-1 line-clamp-1 italic">
                                  "{dem.observacoes_cliente}"
                                </p>
                              )}
                            </td>
                            <td className="py-3.5 px-6 text-[#64748B] text-[11px]">
                              {dem.status === 'aprovado' && dem.data_aprovacao ? (
                                <span className="text-emerald-700 font-semibold">
                                  Aprovado em {formatDatePtBr(dem.data_aprovacao)}
                                </span>
                              ) : dem.data_envio ? (
                                <span>Enviado em {formatDatePtBr(dem.data_envio)}</span>
                              ) : (
                                <span className="text-slate-400">Não enviado</span>
                              )}
                            </td>
                            <td className="py-3.5 px-6 text-right space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setViewingDemonstrativo(dem)
                                  setModalViewOpen(true)
                                }}
                                className="h-8 rounded-lg text-xs font-semibold gap-1 text-[#0FA3A3] hover:text-[#0C8585] border-teal-200"
                              >
                                <Printer className="h-3.5 w-3.5" />
                                <span>Visualizar / PDF</span>
                              </Button>

                              {dem.status === 'rascunho' && (
                                <Button
                                  size="sm"
                                  onClick={() => handleEnviarAoCliente(dem.id)}
                                  disabled={actionLoading}
                                  className="h-8 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs"
                                >
                                  Enviar ao Cliente
                                </Button>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Visualização Formal e Download PDF */}
      <DemonstrativoModalView
        open={modalViewOpen}
        onOpenChange={setModalViewOpen}
        demonstrativo={viewingDemonstrativo}
        empresa={activeEmpresa}
      />
    </div>
  )
}

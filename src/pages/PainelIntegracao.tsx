import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Link2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Lock,
  FileSpreadsheet,
  Receipt,
  Users,
  Send,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { empresasService } from '@/services/empresas'
import { integracaoContabilService } from '@/services/integracaoContabil'
import pb from '@/lib/pocketbase/client'
import type { Empresa, LancamentoContabil } from '@/types'
import { cn } from '@/lib/utils'

export default function PainelIntegracao() {
  const { tenant, member, user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [empresas, setEmpresas] = useState<Empresa[]>([])

  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>(() => {
    return searchParams.get('empresa') || ''
  })
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>(() => {
    return searchParams.get('competencia') || '09/2026'
  })

  // Diagnóstico do Tripé
  const [diagnostico, setDiagnostico] = useState<{
    empresaId: string
    competencia: string
    competenciaFechada: boolean
    etapaFolha: {
      concluida: boolean
      totalHolerites: number
      holeritesProcessados: number
      totalLiquido: number
      temLoteContabil: boolean
    }
    etapaFiscal: {
      concluida: boolean
      totalGuias: number
      guiasPagas: number
      totalValor: number
      temLoteContabil: boolean
    }
    etapaContabil: {
      concluida: boolean
      totalLancamentos: number
      confirmados: number
      lancamentosFolha: number
      lancamentosFiscal: number
    }
    etapaObrigacoes: {
      concluida: boolean
      totalObrigacoes: number
      transmitidas: number
    }
    eloQuebrado: string | null
    acaoSugerida:
      | 'gerar_folha'
      | 'gerar_lote_folha'
      | 'apurar_tributo'
      | 'gerar_lote_fiscal'
      | 'transmitir_obrigacao'
      | 'liquidar_guia'
      | null
  } | null>(null)

  // Lotes Contábeis da Competência (com origem marcada)
  const [lotes, setLotes] = useState<
    Array<{
      loteId: string
      origem: string
      data: string
      totalValor: number
      quantidade: number
      historicoExemplo: string
    }>
  >([])

  // Isolamento de falhas por etapa
  const [errosEtapas, setErrosEtapas] = useState<Record<string, string | null>>({
    folha: null,
    fiscal: null,
    contabil: null,
    obrigacoes: null,
  })

  const [executandoAcao, setExecutandoAcao] = useState(false)

  // 1. Carregar Empresas
  useEffect(() => {
    if (!tenant?.id) return
    const fetchEmpresas = async () => {
      try {
        const emps = await empresasService.list(tenant.id)
        setEmpresas(emps)
        if (emps.length > 0 && !selectedEmpresaId) {
          const defaultEmp = searchParams.get('empresa') || emps[0].id
          setSelectedEmpresaId(defaultEmp)
        }
      } catch (err) {
        console.error('Erro ao carregar empresas:', err)
        toast({
          variant: 'destructive',
          title: 'Erro ao listar empresas',
          description: 'Não foi possível carregar a lista de empresas ativas.',
        })
      }
    }
    void fetchEmpresas()
  }, [tenant?.id, selectedEmpresaId, searchParams, toast])

  // 2. Carregar Diagnóstico e Lotes com Isolamento de Falhas
  const carregarDiagnosticoELotes = useCallback(
    async (isManualRefresh = false) => {
      if (!tenant?.id || !selectedEmpresaId || !selectedCompetencia) return
      if (isManualRefresh) setRefreshing(true)
      else setLoading(true)

      setErrosEtapas({ folha: null, fiscal: null, contabil: null, obrigacoes: null })

      try {
        // Executar diagnóstico integrado
        const diag = await integracaoContabilService.obterDiagnosticoTripe(
          tenant.id,
          selectedEmpresaId,
          selectedCompetencia,
        )
        setDiagnostico(diag)
      } catch (errDiag: any) {
        console.error('Erro ao obter diagnóstico do tripé:', errDiag)
        setErrosEtapas((prev) => ({
          ...prev,
          contabil: 'Falha ao consultar diagnósticos do tripé contábil.',
        }))
        toast({
          variant: 'destructive',
          title: 'Aviso de diagnóstico',
          description: errDiag?.message || 'Não foi possível avaliar o tripé nesta competência.',
        })
      }

      // Carregar lotes contábeis com origem folha ou fiscal
      try {
        const lancs = await pb.collection('lancamentos_contabeis').getFullList<LancamentoContabil>({
          filter: `tenant_id = "${tenant.id}" && empresa = "${selectedEmpresaId}" && competencia = "${selectedCompetencia}"`,
          sort: '-data',
        })

        // Agrupar por lote_id
        const loteMap = new Map<
          string,
          {
            loteId: string
            origem: string
            data: string
            totalValor: number
            quantidade: number
            historicoExemplo: string
          }
        >()

        for (const l of lancs) {
          const lId = l.lote_id || `LOTE-MANUAL-${l.id.slice(0, 6)}`
          const origemDetectada =
            l.origem ||
            (lId.includes('FOLHA') || l.historico.toLowerCase().includes('folha')
              ? 'folha'
              : lId.includes('FISC') ||
                  lId.includes('LIQ') ||
                  l.historico.toLowerCase().includes('simples') ||
                  l.historico.toLowerCase().includes('darf')
                ? 'fiscal'
                : 'manual')

          if (!loteMap.has(lId)) {
            loteMap.set(lId, {
              loteId: lId,
              origem: origemDetectada,
              data: l.data,
              totalValor: l.tipo === 'debito' ? l.valor : 0,
              quantidade: 1,
              historicoExemplo: l.historico,
            })
          } else {
            const cur = loteMap.get(lId)!
            cur.quantidade += 1
            if (l.tipo === 'debito') {
              cur.totalValor += l.valor
            }
          }
        }

        setLotes(Array.from(loteMap.values()))
      } catch (errLotes) {
        console.error('Erro ao consultar lotes contábeis:', errLotes)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [tenant?.id, selectedEmpresaId, selectedCompetencia, toast],
  )

  useEffect(() => {
    void carregarDiagnosticoELotes()
  }, [carregarDiagnosticoELotes])

  // Atualizar query params na URL para compartilhamento de link
  const handleEmpresaChange = (val: string) => {
    setSelectedEmpresaId(val)
    setSearchParams({ empresa: val, competencia: selectedCompetencia })
  }

  const handleCompetenciaChange = (val: string) => {
    setSelectedCompetencia(val)
    setSearchParams({ empresa: selectedEmpresaId, competencia: val })
  }

  // Ação de Resolução Rápida (quando houver ação sugerida)
  const executarAcaoSugerida = async () => {
    if (!diagnostico?.acaoSugerida || !tenant?.id || !selectedEmpresaId) return

    setExecutandoAcao(true)
    try {
      if (diagnostico.acaoSugerida === 'gerar_lote_folha') {
        const res = await integracaoContabilService.gerarLoteContabilFolha({
          tenantId: tenant.id,
          empresaId: selectedEmpresaId,
          competencia: selectedCompetencia,
          usuarioId: user?.id,
        })
        if (res.competenciaFechada) {
          toast({
            variant: 'destructive',
            title: 'Competência Fechada',
            description: res.avisos?.[0] || 'A competência está formalmente bloqueada.',
          })
        } else {
          toast({
            title: 'Lote da Folha Gerado!',
            description: `Lote ${res.loteId} criado com ${res.totalLancamentos} partidas dobradas (D=C R$ ${res.totalDebito.toFixed(2)}).`,
          })
        }
        await carregarDiagnosticoELotes(true)
      } else if (diagnostico.acaoSugerida === 'gerar_folha') {
        navigate(
          `/departamento-pessoal?empresa=${selectedEmpresaId}&competencia=${selectedCompetencia}`,
        )
      } else if (diagnostico.acaoSugerida === 'apurar_tributo') {
        navigate(`/fiscal?empresa=${selectedEmpresaId}&competencia=${selectedCompetencia}`)
      } else if (diagnostico.acaoSugerida === 'liquidar_guia') {
        navigate(`/fiscal?empresa=${selectedEmpresaId}&tab=guias`)
      } else if (diagnostico.acaoSugerida === 'transmitir_obrigacao') {
        navigate(`/obrigacoes?empresa=${selectedEmpresaId}&competencia=${selectedCompetencia}`)
      } else if (diagnostico.acaoSugerida === 'gerar_lote_fiscal') {
        navigate(`/fiscal?empresa=${selectedEmpresaId}`)
      }
    } catch (err: any) {
      console.error('Erro ao executar ação sugerida:', err)
      toast({
        variant: 'destructive',
        title: 'Erro na execução da ação',
        description: err?.message || 'Falha ao processar o elo pendente.',
      })
    } finally {
      setExecutandoAcao(false)
    }
  }

  // Dados da empresa ativa
  const activeEmpresa = useMemo(
    () => empresas.find((e) => e.id === selectedEmpresaId),
    [empresas, selectedEmpresaId],
  )

  // Status visual dos 4 elos
  const eloFolhaStatus = useMemo(() => {
    if (!diagnostico) return 'pendente'
    if (errosEtapas.folha) return 'quebrado'
    if (diagnostico.etapaFolha.concluida && diagnostico.etapaFolha.temLoteContabil) return 'ok'
    if (diagnostico.etapaFolha.totalHolerites > 0) return 'pendente'
    return 'pendente'
  }, [diagnostico, errosEtapas.folha])

  const eloFiscalStatus = useMemo(() => {
    if (!diagnostico) return 'pendente'
    if (errosEtapas.fiscal) return 'quebrado'
    if (diagnostico.etapaFiscal.concluida && diagnostico.etapaFiscal.temLoteContabil) return 'ok'
    if (diagnostico.etapaFiscal.totalGuias > 0) return 'pendente'
    return 'pendente'
  }, [diagnostico, errosEtapas.fiscal])

  const eloContabilStatus = useMemo(() => {
    if (!diagnostico) return 'pendente'
    if (errosEtapas.contabil) return 'quebrado'
    if (diagnostico.etapaContabil.concluida) return 'ok'
    if (diagnostico.etapaContabil.totalLancamentos > 0) return 'pendente'
    return 'pendente'
  }, [diagnostico, errosEtapas.contabil])

  const eloObrigacoesStatus = useMemo(() => {
    if (!diagnostico) return 'pendente'
    if (errosEtapas.obrigacoes) return 'quebrado'
    if (diagnostico.etapaObrigacoes.concluida) return 'ok'
    if (diagnostico.etapaObrigacoes.totalObrigacoes > 0) return 'pendente'
    return 'pendente'
  }, [diagnostico, errosEtapas.obrigacoes])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Principal */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-[#1A2333]">
              Painel de Integração do Tripé
            </h2>
            <Badge className="bg-[#0FA3A3] text-white text-[10px] font-bold uppercase tracking-wider">
              FASE 1 OFICIAL
            </Badge>
          </div>
          <p className="text-xs text-[#64748B]">
            Rastreio ponta a ponta dos 4 elos operacionais: Folha de Pagamento → Fiscal & Guias →
            Lançamentos Contábeis → Obrigações Acessórias
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => carregarDiagnosticoELotes(true)}
            variant="outline"
            disabled={refreshing || loading}
            className="gap-2 rounded-xl text-xs font-semibold h-10 border-[#E2E8F0] shadow-2xs hover:bg-slate-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin text-[#0FA3A3]')} />
            <span>{refreshing ? 'Atualizando...' : 'Recalcular Diagnóstico'}</span>
          </Button>

          <Button
            onClick={() => navigate('/contabil/lancamentos')}
            variant="outline"
            className="gap-2 rounded-xl text-xs font-semibold h-10 border-[#0FA3A3] text-[#0FA3A3] hover:bg-teal-50 shadow-2xs"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Livro Diário / Razão</span>
          </Button>
        </div>
      </div>

      {/* Seletor de Empresa e Competência */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs bg-white">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Empresa */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-[#0FA3A3]" />
                <span>Empresa / Cliente Selecionado</span>
              </label>
              <Select value={selectedEmpresaId} onValueChange={handleEmpresaChange}>
                <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0] font-semibold bg-white">
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

            {/* Competência */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-[#0FA3A3]" />
                <span>Competência de Trabalho</span>
              </label>
              <Select value={selectedCompetencia} onValueChange={handleCompetenciaChange}>
                <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0] font-semibold bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="07/2026">07/2026 (Julho 2026)</SelectItem>
                  <SelectItem value="08/2026">08/2026 (Agosto 2026)</SelectItem>
                  <SelectItem value="09/2026">09/2026 (Setembro 2026)</SelectItem>
                  <SelectItem value="10/2026">10/2026 (Outubro 2026)</SelectItem>
                  <SelectItem value="11/2026">11/2026 (Novembro 2026)</SelectItem>
                  <SelectItem value="12/2026">12/2026 (Dezembro 2026)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status Geral da Competência */}
            <div className="flex flex-col justify-center space-y-1 sm:border-l sm:border-slate-100 sm:pl-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Status da Competência
              </span>
              <div className="flex items-center gap-2">
                {diagnostico?.competenciaFechada ? (
                  <Badge className="bg-emerald-100 text-[#16A34A] border-emerald-300 text-xs py-1 px-2.5 flex items-center gap-1.5 font-bold">
                    <Lock className="h-3.5 w-3.5" />
                    <span>Fechada & Travada</span>
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-[#D97706] border-amber-300 text-xs py-1 px-2.5 flex items-center gap-1.5 font-bold">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Aberta para Escrituração</span>
                  </Badge>
                )}
                <Button
                  onClick={() =>
                    navigate(
                      `/fecho-mensal?empresa=${selectedEmpresaId}&competencia=${selectedCompetencia}`,
                    )
                  }
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px] text-[#0FA3A3] hover:text-[#0c8282] p-0 font-medium"
                >
                  Ver no Fecho Mensal
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Banner de Diagnóstico / Alerta do Elo Quebrado */}
      {diagnostico?.eloQuebrado ? (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-amber-950">Atenção ao Tripé Contábil</h3>
                <Badge className="bg-amber-500 text-white text-[10px] font-bold">
                  ELO PENDENTE
                </Badge>
              </div>
              <p className="text-xs text-amber-900 mt-1 font-medium">{diagnostico.eloQuebrado}</p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Competência: <span className="font-semibold">{selectedCompetencia}</span> | Empresa:{' '}
                <span className="font-semibold">
                  {activeEmpresa?.nome_fantasia || activeEmpresa?.razao_social}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {diagnostico.acaoSugerida === 'gerar_lote_folha' ? (
              <Button
                onClick={executarAcaoSugerida}
                disabled={executandoAcao}
                className="gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold h-10 shadow-sm"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{executandoAcao ? 'Gerando Partidas...' : 'Gerar Lote da Folha Agora'}</span>
              </Button>
            ) : (
              <Button
                onClick={executarAcaoSugerida}
                className="gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold h-10 shadow-sm"
              >
                <span>Acessar Módulo para Resolução</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      ) : diagnostico ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#16A34A] text-white">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-950">
                Tripé Contábil em Plena Harmonia
              </h3>
              <p className="text-xs text-emerald-800">
                Os elos operacionais (Folha, Fiscal, Contábil e Obrigações) estão integrados e com
                partidas confirmadas na competência {selectedCompetencia}.
              </p>
            </div>
          </div>
          <Badge className="bg-[#16A34A] text-white text-[11px] font-semibold py-1 px-3">
            Tripé 100% OK
          </Badge>
        </div>
      ) : null}

      {/* Grid das 4 Etapas do Diagnóstico */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Etapa 1: Folha */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs relative overflow-hidden flex flex-col justify-between">
          <div
            className={cn(
              'h-1.5 w-full',
              eloFolhaStatus === 'ok'
                ? 'bg-[#16A34A]'
                : eloFolhaStatus === 'quebrado'
                  ? 'bg-[#EF4444]'
                  : 'bg-amber-400',
            )}
          />
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Users className="h-5 w-5" />
              </div>
              <Badge
                className={cn(
                  'text-[10px] font-bold capitalize',
                  eloFolhaStatus === 'ok'
                    ? 'bg-emerald-100 text-[#16A34A] border-emerald-200'
                    : eloFolhaStatus === 'quebrado'
                      ? 'bg-red-100 text-[#EF4444] border-red-200'
                      : 'bg-amber-100 text-[#D97706] border-amber-200',
                )}
              >
                {eloFolhaStatus === 'ok'
                  ? '1. Folha OK'
                  : eloFolhaStatus === 'quebrado'
                    ? 'Falha Folha'
                    : '1. Folha Pendente'}
              </Badge>
            </div>
            <CardTitle className="text-sm font-bold text-[#1A2333] mt-2">
              1. Folha de Pagamento
            </CardTitle>
            <CardDescription className="text-xs text-[#64748B]">
              Cálculo CLT, holerites e retenções
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-[#64748B]">Holerites Processados:</span>
              <span className="font-semibold text-[#1A2333]">
                {diagnostico?.etapaFolha.holeritesProcessados || 0} de{' '}
                {diagnostico?.etapaFolha.totalHolerites || 0}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-[#64748B]">Líquido da Folha:</span>
              <span className="font-semibold text-[#1A2333]">
                R${' '}
                {(diagnostico?.etapaFolha.totalLiquido || 0).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#64748B]">Lote Contábil Folha:</span>
              <span className="font-semibold">
                {diagnostico?.etapaFolha.temLoteContabil ? (
                  <span className="text-[#16A34A] flex items-center gap-1 font-bold">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Gerado
                  </span>
                ) : (
                  <span className="text-[#EF4444] flex items-center gap-1 font-bold">
                    <AlertTriangle className="h-3.5 w-3.5" /> Não Gerado
                  </span>
                )}
              </span>
            </div>
            <Button
              onClick={() =>
                navigate(
                  `/departamento-pessoal?empresa=${selectedEmpresaId}&competencia=${selectedCompetencia}`,
                )
              }
              variant="ghost"
              size="sm"
              className="w-full mt-2 h-8 text-[11px] text-[#0FA3A3] hover:text-[#0c8282] hover:bg-teal-50 justify-between font-semibold"
            >
              <span>Abrir Departamento Pessoal</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>

        {/* Etapa 2: Fiscal */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs relative overflow-hidden flex flex-col justify-between">
          <div
            className={cn(
              'h-1.5 w-full',
              eloFiscalStatus === 'ok'
                ? 'bg-[#16A34A]'
                : eloFiscalStatus === 'quebrado'
                  ? 'bg-[#EF4444]'
                  : 'bg-amber-400',
            )}
          />
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-[#0FA3A3]">
                <Receipt className="h-5 w-5" />
              </div>
              <Badge
                className={cn(
                  'text-[10px] font-bold capitalize',
                  eloFiscalStatus === 'ok'
                    ? 'bg-emerald-100 text-[#16A34A] border-emerald-200'
                    : eloFiscalStatus === 'quebrado'
                      ? 'bg-red-100 text-[#EF4444] border-red-200'
                      : 'bg-amber-100 text-[#D97706] border-amber-200',
                )}
              >
                {eloFiscalStatus === 'ok'
                  ? '2. Fiscal OK'
                  : eloFiscalStatus === 'quebrado'
                    ? 'Falha Fiscal'
                    : '2. Fiscal Pendente'}
              </Badge>
            </div>
            <CardTitle className="text-sm font-bold text-[#1A2333] mt-2">
              2. Fiscal & Tributos
            </CardTitle>
            <CardDescription className="text-xs text-[#64748B]">
              Apuração DAS/DARF e guias
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-[#64748B]">Guias Apuradas:</span>
              <span className="font-semibold text-[#1A2333]">
                {diagnostico?.etapaFiscal.totalGuias || 0}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-[#64748B]">Total Tributos:</span>
              <span className="font-semibold text-[#1A2333]">
                R${' '}
                {(diagnostico?.etapaFiscal.totalValor || 0).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#64748B]">Lote Provisão Fiscal:</span>
              <span className="font-semibold">
                {diagnostico?.etapaFiscal.temLoteContabil ? (
                  <span className="text-[#16A34A] flex items-center gap-1 font-bold">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Vinculado
                  </span>
                ) : (
                  <span className="text-amber-600 flex items-center gap-1 font-bold">
                    <Clock className="h-3.5 w-3.5" /> Pendente
                  </span>
                )}
              </span>
            </div>
            <Button
              onClick={() =>
                navigate(`/fiscal?empresa=${selectedEmpresaId}&competencia=${selectedCompetencia}`)
              }
              variant="ghost"
              size="sm"
              className="w-full mt-2 h-8 text-[11px] text-[#0FA3A3] hover:text-[#0c8282] hover:bg-teal-50 justify-between font-semibold"
            >
              <span>Abrir Módulo Fiscal</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>

        {/* Etapa 3: Contábil */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs relative overflow-hidden flex flex-col justify-between">
          <div
            className={cn(
              'h-1.5 w-full',
              eloContabilStatus === 'ok'
                ? 'bg-[#16A34A]'
                : eloContabilStatus === 'quebrado'
                  ? 'bg-[#EF4444]'
                  : 'bg-amber-400',
            )}
          />
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <Badge
                className={cn(
                  'text-[10px] font-bold capitalize',
                  eloContabilStatus === 'ok'
                    ? 'bg-emerald-100 text-[#16A34A] border-emerald-200'
                    : eloContabilStatus === 'quebrado'
                      ? 'bg-red-100 text-[#EF4444] border-red-200'
                      : 'bg-amber-100 text-[#D97706] border-amber-200',
                )}
              >
                {eloContabilStatus === 'ok'
                  ? '3. Contábil OK'
                  : eloContabilStatus === 'quebrado'
                    ? 'Falha Contábil'
                    : '3. Contábil Pendente'}
              </Badge>
            </div>
            <CardTitle className="text-sm font-bold text-[#1A2333] mt-2">
              3. Partidas Dobradas
            </CardTitle>
            <CardDescription className="text-xs text-[#64748B]">
              Origens folha e fiscal balanceadas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-[#64748B]">Partidas Confirmadas:</span>
              <span className="font-semibold text-[#1A2333]">
                {diagnostico?.etapaContabil.confirmados || 0} de{' '}
                {diagnostico?.etapaContabil.totalLancamentos || 0}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-[#64748B]">Lançamentos Origem Folha:</span>
              <span className="font-semibold text-[#1A2333]">
                {diagnostico?.etapaContabil.lancamentosFolha || 0}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#64748B]">Lançamentos Origem Fiscal:</span>
              <span className="font-semibold text-[#1A2333]">
                {diagnostico?.etapaContabil.lancamentosFiscal || 0}
              </span>
            </div>
            <Button
              onClick={() =>
                navigate(
                  `/contabil/lancamentos?empresa=${selectedEmpresaId}&competencia=${selectedCompetencia}`,
                )
              }
              variant="ghost"
              size="sm"
              className="w-full mt-2 h-8 text-[11px] text-[#0FA3A3] hover:text-[#0c8282] hover:bg-teal-50 justify-between font-semibold"
            >
              <span>Ver Lançamentos Contábeis</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>

        {/* Etapa 4: Obrigações */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs relative overflow-hidden flex flex-col justify-between">
          <div
            className={cn(
              'h-1.5 w-full',
              eloObrigacoesStatus === 'ok'
                ? 'bg-[#16A34A]'
                : eloObrigacoesStatus === 'quebrado'
                  ? 'bg-[#EF4444]'
                  : 'bg-amber-400',
            )}
          />
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#16A34A]">
                <Send className="h-5 w-5" />
              </div>
              <Badge
                className={cn(
                  'text-[10px] font-bold capitalize',
                  eloObrigacoesStatus === 'ok'
                    ? 'bg-emerald-100 text-[#16A34A] border-emerald-200'
                    : eloObrigacoesStatus === 'quebrado'
                      ? 'bg-red-100 text-[#EF4444] border-red-200'
                      : 'bg-amber-100 text-[#D97706] border-amber-200',
                )}
              >
                {eloObrigacoesStatus === 'ok'
                  ? '4. Obrigações OK'
                  : eloObrigacoesStatus === 'quebrado'
                    ? 'Falha Obrigações'
                    : '4. Transmissão Pendente'}
              </Badge>
            </div>
            <CardTitle className="text-sm font-bold text-[#1A2333] mt-2">
              4. Obrigações Fiscais
            </CardTitle>
            <CardDescription className="text-xs text-[#64748B]">
              Modo Supervisão (DCTF/eSocial/EFD)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-[#64748B]">Obrigações da Competência:</span>
              <span className="font-semibold text-[#1A2333]">
                {diagnostico?.etapaObrigacoes.totalObrigacoes || 0}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-[#64748B]">Transmitidas / Entregues:</span>
              <span className="font-semibold text-[#16A34A]">
                {diagnostico?.etapaObrigacoes.transmitidas || 0}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#64748B]">Pendentes de Envio:</span>
              <span className="font-semibold text-[#D97706]">
                {(diagnostico?.etapaObrigacoes.totalObrigacoes || 0) -
                  (diagnostico?.etapaObrigacoes.transmitidas || 0)}
              </span>
            </div>
            <Button
              onClick={() =>
                navigate(
                  `/obrigacoes?empresa=${selectedEmpresaId}&competencia=${selectedCompetencia}`,
                )
              }
              variant="ghost"
              size="sm"
              className="w-full mt-2 h-8 text-[11px] text-[#0FA3A3] hover:text-[#0c8282] hover:bg-teal-50 justify-between font-semibold"
            >
              <span>Acessar Painel de Obrigações</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Visão de Lotes Gerados (LOTE-FOLHA / LOTE-FISC / LOTE-LIQ) */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/50 border-b border-[#E2E8F0] py-4 px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-bold text-[#1A2333]">
                Lotes Contábeis Automáticos da Competência
              </CardTitle>
              <Badge variant="outline" className="text-[10px] text-[#64748B] bg-white">
                {lotes.length} lotes detectados
              </Badge>
            </div>
            <CardDescription className="text-xs text-[#64748B]">
              Lotes criados automaticamente pelos módulos com origem marcada (folha, fiscal, manual)
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px]">
              LOTE-FOLHA
            </Badge>
            <Badge className="bg-teal-100 text-teal-800 border-teal-200 text-[10px]">
              LOTE-FISC
            </Badge>
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
              LOTE-LIQ
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {lotes.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Layers className="h-10 w-10 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-[#1A2333]">
                Nenhum lote contábil encontrado na competência {selectedCompetencia}
              </p>
              <p className="text-[11px] text-[#64748B] max-w-md mx-auto">
                Processe a folha de pagamento ou emita guias de tributos no módulo fiscal para gerar
                automaticamente os lotes de partidas dobradas.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    <th className="py-3 px-4">Identificador do Lote</th>
                    <th className="py-3 px-4">Origem</th>
                    <th className="py-3 px-4">Data Ref.</th>
                    <th className="py-3 px-4">Partidas (Linhas)</th>
                    <th className="py-3 px-4 text-right">Valor Total</th>
                    <th className="py-3 px-4">Histórico / Descrição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lotes.map((item) => {
                    const isFolha = item.origem === 'folha' || item.loteId.includes('FOLHA')
                    const isFiscal =
                      item.origem === 'fiscal' ||
                      item.loteId.includes('FISC') ||
                      item.loteId.includes('LIQ')

                    return (
                      <tr key={item.loteId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-[#1A2333]">
                          {item.loteId}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            className={cn(
                              'text-[10px] font-bold uppercase',
                              isFolha
                                ? 'bg-blue-100 text-blue-800 border-blue-200'
                                : isFiscal
                                  ? 'bg-teal-100 text-teal-800 border-teal-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200',
                            )}
                          >
                            {item.origem}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-[#64748B]">
                          {item.data ? new Date(item.data).toLocaleDateString('pt-BR') : '-'}
                        </td>
                        <td className="py-3 px-4 text-[#1A2333] font-medium">
                          {item.quantidade} partidas (D/C)
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-[#1A2333]">
                          R$ {item.totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td
                          className="py-3 px-4 text-[#64748B] max-w-xs truncate"
                          title={item.historicoExemplo}
                        >
                          {item.historicoExemplo}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informativo de Auditoria e Trava de Fechamento */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs flex items-start gap-3">
        <Info className="h-5 w-5 text-[#0FA3A3] shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs text-[#64748B]">
          <p className="font-bold text-[#1A2333]">
            Isolamento de Falha e Política de Fechamento Rigoroso
          </p>
          <p>
            O motor de integração do tripé assegura que falhas de conexão ou ausência de dados em
            uma das 4 etapas não interfiram no cálculo das demais. Quando a competência contábil
            estiver formalmente <strong>Fechada</strong>, tentativas de processamento de folha ou
            emissão tributária registrarão automaticamente uma pendência na trilha de auditoria sem
            abortar a operação, preservando a higidez do livro contábil da empresa.
          </p>
        </div>
      </div>
    </div>
  )
}

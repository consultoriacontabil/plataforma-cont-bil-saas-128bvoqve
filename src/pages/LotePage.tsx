import React, { useState, useEffect } from 'react'
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  RotateCcw,
  Building2,
  Calendar,
  FileCheck2,
  FileSpreadsheet,
  Receipt,
  FileText,
  Clock,
  ArrowRight,
  ShieldCheck,
  Search,
  Filter,
  CheckSquare,
  Square,
  Upload,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  batchService,
  OPERACOES_DISPONIVEIS,
  type BatchOperacaoId,
  type RelatorioExecucaoLote,
} from '@/services/batchService'
import type { Empresa } from '@/types'
import { integracaoContabilService } from '@/services/integracaoContabil'

export default function LotePage() {
  const { tenant, user, member } = useAuth()
  const { toast } = useToast()

  // Estados de dados
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroBusca, setFiltroBusca] = useState('')
  const [filtroRegime, setFiltroRegime] = useState('todos')

  // Seleção múltipla
  const [selectedEmpresaIds, setSelectedEmpresaIds] = useState<Set<string>>(new Set())
  const [competencia, setCompetencia] = useState('08/2026')
  const [operacoesSelecionadas, setOperacoesSelecionadas] = useState<Set<BatchOperacaoId>>(
    new Set(['processar_folha', 'lote_contabil_folha', 'apurar_guias', 'gerar_relatorios']),
  )
  const [arquivosXml, setArquivosXml] = useState<File[]>([])

  // Modal de Confirmação & Execução
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [isExecutando, setIsExecutando] = useState(false)
  const [progresso, setProgresso] = useState<{
    empresaAtual: number
    totalEmpresas: number
    empresaNome: string
    operacaoNome: string
    porcentagem: number
  } | null>(null)

  // Relatório Final
  const [relatorioFinal, setRelatorioFinal] = useState<RelatorioExecucaoLote | null>(null)
  const [empresaFiltroResultado, setEmpresaFiltroResultado] = useState<
    'todas' | 'erro' | 'aviso' | 'sucesso'
  >('todas')

  // Verificação de competências fechadas prévia
  const [empresasComFechamento, setEmpresasComFechamento] = useState<string[]>([])
  const [verificandoFechamentos, setVerificandoFechamentos] = useState(false)

  // Carregar lista de empresas da carteira
  useEffect(() => {
    async function loadEmpresas() {
      if (!tenant?.id) return
      setLoading(true)
      try {
        const list = await empresasService.list(tenant.id)
        setEmpresas(list)
        // Por padrão selecionar todas as empresas ativas
        const ativas = list.filter((e) => e.status === 'ativo').map((e) => e.id)
        setSelectedEmpresaIds(new Set(ativas))
      } catch (err) {
        console.error('Erro ao carregar carteira:', err)
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar empresas',
          description: 'Não foi possível listar as empresas da carteira.',
        })
      } finally {
        setLoading(false)
      }
    }
    void loadEmpresas()
  }, [tenant?.id, toast])

  // Filtragem de empresas
  const empresasFiltradas = empresas.filter((emp) => {
    const termo = filtroBusca.toLowerCase()
    const matchTexto =
      emp.razao_social.toLowerCase().includes(termo) ||
      (emp.nome_fantasia || '').toLowerCase().includes(termo) ||
      emp.cnpj.includes(termo)

    const matchRegime = filtroRegime === 'todos' || emp.regime_tributario === filtroRegime

    return matchTexto && matchRegime
  })

  // Alternar seleção de empresa individual
  const toggleEmpresa = (id: string) => {
    const novoSet = new Set(selectedEmpresaIds)
    if (novoSet.has(id)) {
      novoSet.delete(id)
    } else {
      novoSet.add(id)
    }
    setSelectedEmpresaIds(novoSet)
  }

  // Selecionar ou desselecionar todas visíveis
  const toggleTodasVisiveis = () => {
    const idsVisiveis = empresasFiltradas.map((e) => e.id)
    const todasMarcadas = idsVisiveis.every((id) => selectedEmpresaIds.has(id))

    const novoSet = new Set(selectedEmpresaIds)
    if (todasMarcadas) {
      idsVisiveis.forEach((id) => novoSet.delete(id))
    } else {
      idsVisiveis.forEach((id) => novoSet.add(id))
    }
    setSelectedEmpresaIds(novoSet)
  }

  // Alternar operação individual
  const toggleOperacao = (opId: BatchOperacaoId) => {
    const novo = new Set(operacoesSelecionadas)
    if (novo.has(opId)) {
      novo.delete(opId)
    } else {
      novo.add(opId)
    }
    setOperacoesSelecionadas(novo)
  }

  // Abrir modal de confirmação com checagem de competência fechada
  const handleAbrirConfirmacao = async () => {
    if (selectedEmpresaIds.size === 0) {
      toast({
        variant: 'destructive',
        title: 'Nenhuma empresa selecionada',
        description: 'Selecione ao menos uma empresa para processamento em lote.',
      })
      return
    }

    if (operacoesSelecionadas.size === 0) {
      toast({
        variant: 'destructive',
        title: 'Nenhuma operação marcada',
        description: 'Escolha ao menos uma rotina para ser executada no lote.',
      })
      return
    }

    // Checar competências fechadas nas selecionadas
    if (tenant?.id) {
      setVerificandoFechamentos(true)
      try {
        const fechadas: string[] = []
        for (const empId of selectedEmpresaIds) {
          const isClosed = await integracaoContabilService.isCompetenciaFechada(
            tenant.id,
            empId,
            competencia,
          )
          if (isClosed) {
            const empObj = empresas.find((e) => e.id === empId)
            if (empObj) fechadas.push(empObj.nome_fantasia || empObj.razao_social)
          }
        }
        setEmpresasComFechamento(fechadas)
      } catch (err) {
        console.warn('Erro ao checar fechamento prévio:', err)
      } finally {
        setVerificandoFechamentos(false)
      }
    }

    setIsConfirmModalOpen(true)
  }

  // Executar lote com isolamento
  const handleExecutarLote = async () => {
    if (!tenant?.id || !user?.id) return
    setIsConfirmModalOpen(false)
    setIsExecutando(true)
    setRelatorioFinal(null)

    const empresasAlvo = empresas.filter((e) => selectedEmpresaIds.has(e.id))

    try {
      const relatorio = await batchService.executarLote({
        tenantId: tenant.id,
        usuarioId: user.id,
        competencia,
        empresas: empresasAlvo,
        operacoes: Array.from(operacoesSelecionadas),
        xmlFiles: arquivosXml,
        onProgress: (p) => setProgresso(p),
      })

      setRelatorioFinal(relatorio)
      toast({
        title: 'Lote Concluído!',
        description: `Processamento de ${relatorio.empresasTotais} empresas finalizado (${relatorio.empresasSucesso} com êxito).`,
      })
    } catch (err: any) {
      console.error('Erro na orquestração do lote:', err)
      toast({
        variant: 'destructive',
        title: 'Falha crítica no orquestrador',
        description: err?.message || 'Erro durante a fila em lote.',
      })
    } finally {
      setIsExecutando(false)
      setProgresso(null)
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto pb-16">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-[#1A2333] tracking-tight">
              Processamento em Lote Multi-Empresas
            </h1>
            <Badge className="bg-[#0FA3A3] text-white hover:bg-[#0C8585] text-xs font-semibold px-2.5 py-0.5 rounded-full">
              FASE 3
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1">
            Orquestração sequencial com isolamento estrito de falha, auditoria detalhada e
            integração ponta a ponta.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleAbrirConfirmacao}
            disabled={
              isExecutando || selectedEmpresaIds.size === 0 || operacoesSelecionadas.size === 0
            }
            className="gap-2 bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold rounded-xl h-10 px-5 shadow-sm"
          >
            <Play className="h-4 w-4 fill-white" />
            <span>Executar Lote ({selectedEmpresaIds.size} empresas)</span>
          </Button>
        </div>
      </div>

      {/* Barra de Progresso Durante a Execução */}
      {isExecutando && progresso && (
        <Card className="rounded-2xl border-2 border-[#0FA3A3] bg-teal-50/40 shadow-md animate-pulse">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#1A2333]">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#0FA3A3] animate-spin" />
                <span>
                  Processando empresa {progresso.empresaAtual} de {progresso.totalEmpresas}:{' '}
                  <span className="text-[#0FA3A3]">{progresso.empresaNome}</span>
                </span>
              </div>
              <span className="font-extrabold text-[#0FA3A3]">{progresso.porcentagem}%</span>
            </div>
            <Progress value={progresso.porcentagem} className="h-2.5 bg-teal-100" />
            <p className="text-xs text-[#64748B]">
              Etapa atual:{' '}
              <span className="font-semibold text-slate-700">{progresso.operacaoNome}</span>{' '}
              (Isolamento ativo: qualquer falha fica restrita à empresa sem interromper a fila).
            </p>
          </CardContent>
        </Card>
      )}

      {/* Relatório Final Consolidado */}
      {relatorioFinal && (
        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-[#1A2333] flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Relatório Consolidado do Lote — {relatorioFinal.loteId}
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  Executado em {new Date(relatorioFinal.dataExecucao).toLocaleString('pt-BR')} •
                  Duração: {(relatorioFinal.tempoTotalMs / 1000).toFixed(1)} segundos • Competência:{' '}
                  {relatorioFinal.competencia}
                </CardDescription>
              </div>

              {/* Badges de Contagem */}
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  onClick={() => setEmpresaFiltroResultado('todas')}
                  className={`cursor-pointer px-3 py-1 rounded-lg text-xs font-semibold ${
                    empresaFiltroResultado === 'todas' ? 'bg-slate-800 text-white' : 'bg-white'
                  }`}
                >
                  Todas ({relatorioFinal.empresasTotais})
                </Badge>
                <Badge
                  variant="outline"
                  onClick={() => setEmpresaFiltroResultado('sucesso')}
                  className={`cursor-pointer px-3 py-1 rounded-lg text-xs font-semibold text-emerald-700 ${
                    empresaFiltroResultado === 'sucesso'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 border-emerald-200'
                  }`}
                >
                  Sucesso ({relatorioFinal.empresasSucesso})
                </Badge>
                {relatorioFinal.empresasComAviso > 0 && (
                  <Badge
                    variant="outline"
                    onClick={() => setEmpresaFiltroResultado('aviso')}
                    className={`cursor-pointer px-3 py-1 rounded-lg text-xs font-semibold text-amber-700 ${
                      empresaFiltroResultado === 'aviso'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    Alertas ({relatorioFinal.empresasComAviso})
                  </Badge>
                )}
                {relatorioFinal.empresasComFalha > 0 && (
                  <Badge
                    variant="outline"
                    onClick={() => setEmpresaFiltroResultado('erro')}
                    className={`cursor-pointer px-3 py-1 rounded-lg text-xs font-semibold text-red-700 ${
                      empresaFiltroResultado === 'erro'
                        ? 'bg-red-600 text-white'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    Falhas ({relatorioFinal.empresasComFalha})
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0 divide-y divide-slate-100">
            {relatorioFinal.detalhesPorEmpresa
              .filter((r) => {
                if (empresaFiltroResultado === 'todas') return true
                return r.statusGeral === empresaFiltroResultado
              })
              .map((r) => (
                <div key={r.empresaId} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      {r.statusGeral === 'sucesso' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : r.statusGeral === 'aviso' ? (
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                      )}
                      <div>
                        <p className="font-bold text-xs sm:text-sm text-[#1A2333]">
                          {r.razaoSocial}
                        </p>
                        <p className="text-[11px] text-[#64748B]">
                          CNPJ: {r.cnpj} • Regime: <span className="uppercase">{r.regime}</span>
                        </p>
                      </div>
                    </div>

                    <Badge
                      className={
                        r.statusGeral === 'sucesso'
                          ? 'bg-emerald-100 text-emerald-800 border-0'
                          : r.statusGeral === 'aviso'
                            ? 'bg-amber-100 text-amber-800 border-0'
                            : 'bg-red-100 text-red-800 border-0'
                      }
                    >
                      {r.statusGeral === 'sucesso'
                        ? 'Concluído'
                        : r.statusGeral === 'aviso'
                          ? 'Com Pendências'
                          : 'Erro Isolado'}
                    </Badge>
                  </div>

                  {/* Operações Detalhadas */}
                  <div className="mt-3 pl-6 space-y-1.5 border-l-2 border-slate-200 ml-2">
                    {r.operacoes.map((op) => (
                      <div
                        key={op.operacaoId}
                        className="flex items-start justify-between text-xs gap-3"
                      >
                        <span className="font-medium text-slate-700 shrink-0">
                          {OPERACOES_DISPONIVEIS.find((o) => o.id === op.operacaoId)?.nome ||
                            op.operacaoId}
                          :
                        </span>
                        <span
                          className={`text-right ${
                            op.status === 'sucesso'
                              ? 'text-emerald-700'
                              : op.status === 'aviso'
                                ? 'text-amber-700 font-medium'
                                : op.status === 'erro'
                                  ? 'text-red-700 font-bold'
                                  : 'text-slate-400'
                          }`}
                        >
                          {op.mensagem}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Painel de Configuração do Lote */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1 & 2: Seleção de Empresas da Carteira */}
        <Card className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-[#1A2333] flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#0FA3A3]" />
                  Empresas da Carteira
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  {selectedEmpresaIds.size} de {empresas.length} empresas selecionadas para o lote
                </CardDescription>
              </div>

              {/* Controles Rápidos */}
              <Button
                variant="outline"
                size="sm"
                onClick={toggleTodasVisiveis}
                className="h-8 text-xs rounded-xl border-slate-200"
              >
                {empresasFiltradas.every((e) => selectedEmpresaIds.has(e.id)) ? (
                  <>
                    <Square className="h-3.5 w-3.5 mr-1 text-slate-500" />
                    Desmarcar Visíveis
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-3.5 w-3.5 mr-1 text-[#0FA3A3]" />
                    Selecionar Todas
                  </>
                )}
              </Button>
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Buscar por razão, fantasia ou CNPJ..."
                  value={filtroBusca}
                  onChange={(e) => setFiltroBusca(e.target.value)}
                  className="pl-9 h-9 text-xs rounded-xl"
                />
              </div>

              <Select value={filtroRegime} onValueChange={setFiltroRegime}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Regime Tributário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Regimes</SelectItem>
                  <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                  <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                  <SelectItem value="lucro_real">Lucro Real</SelectItem>
                  <SelectItem value="mei">MEI</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="p-0 flex-1 max-h-[480px] overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Carregando carteira...</div>
            ) : empresasFiltradas.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Nenhuma empresa encontrada com os filtros atuais.
              </div>
            ) : (
              empresasFiltradas.map((emp) => {
                const isSelected = selectedEmpresaIds.has(emp.id)
                return (
                  <div
                    key={emp.id}
                    onClick={() => toggleEmpresa(emp.id)}
                    className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected ? 'bg-teal-50/40' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                          isSelected
                            ? 'bg-[#0FA3A3] border-[#0FA3A3] text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <CheckSquare className="h-3.5 w-3.5" />}
                      </div>

                      <div>
                        <p className="font-bold text-xs text-[#1A2333] leading-snug">
                          {emp.nome_fantasia || emp.razao_social}
                        </p>
                        <p className="text-[10px] text-[#64748B]">
                          {emp.cnpj} •{' '}
                          <span className="uppercase font-semibold">
                            {emp.regime_tributario || 'N/A'}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${
                          emp.status === 'ativo'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {emp.status === 'ativo' ? 'Ativa' : emp.status}
                      </Badge>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Coluna 3: Competência & Operações em Lote */}
        <div className="space-y-6">
          {/* Competência de Trabalho */}
          <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#0FA3A3]" />
                Competência de Trabalho
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  Mês / Ano de Referência
                </label>
                <Select value={competencia} onValueChange={setCompetencia}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="07/2026">07/2026 (Julho 2026)</SelectItem>
                    <SelectItem value="08/2026">08/2026 (Agosto 2026)</SelectItem>
                    <SelectItem value="09/2026">09/2026 (Setembro 2026)</SelectItem>
                    <SelectItem value="10/2026">10/2026 (Outubro 2026)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-[11px] text-[#64748B] space-y-1">
                <p className="font-semibold text-slate-700">Regra de Competência Fechada:</p>
                <p>
                  Caso a competência contábil já esteja aprovada e fechada, a folha e apuração
                  prosseguem normalmente, mas o lote contábil gera registro de pendência na
                  auditoria sem sobrescrever os livros.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Operações a Executar */}
          <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#0FA3A3]" />
                Operações do Lote
              </CardTitle>
              <CardDescription className="text-xs text-[#64748B]">
                Marque quais rotinas serão executadas na fila sequencial
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-2.5">
              {OPERACOES_DISPONIVEIS.map((op) => {
                const isSelected = operacoesSelecionadas.has(op.id)
                return (
                  <div
                    key={op.id}
                    onClick={() => toggleOperacao(op.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#0FA3A3] bg-teal-50/40 text-slate-900'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border text-white ${
                          isSelected ? 'bg-[#0FA3A3] border-[#0FA3A3]' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <CheckSquare className="h-3 w-3 text-white" />}
                      </div>
                      <span className="font-bold text-xs">{op.nome}</span>
                    </div>
                    <p className="text-[11px] text-[#64748B] pl-6 mt-0.5 leading-snug">
                      {op.descricao}
                    </p>
                  </div>
                )
              })}

              {/* Anexo de XMLs se a rotina estiver marcada */}
              {operacoesSelecionadas.has('importar_xmls') && (
                <div className="pt-2 border-t border-slate-100">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                    <Upload className="h-3.5 w-3.5 text-[#0FA3A3]" />
                    Anexar Arquivos XML Fiscais (Opcional)
                  </label>
                  <input
                    type="file"
                    multiple
                    accept=".xml"
                    onChange={(e) => {
                      if (e.target.files) {
                        setArquivosXml(Array.from(e.target.files))
                      }
                    }}
                    className="text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer w-full"
                  />
                  {arquivosXml.length > 0 && (
                    <p className="text-[10px] text-emerald-600 mt-1">
                      {arquivosXml.length} arquivo(s) selecionado(s) para importação.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Confirmação Prévia */}
      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent className="sm:max-w-[560px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1A2333] flex items-center gap-2">
              <Play className="h-5 w-5 text-[#0FA3A3]" />
              Confirmar Execução do Lote Multi-Empresas
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Revise o escopo e o resumo das ações que serão executadas antes de confirmar o início
              da fila
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            {/* Resumo */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <p className="text-[#64748B]">Empresas Selecionadas:</p>
                <p className="font-extrabold text-[#1A2333] text-base">{selectedEmpresaIds.size}</p>
              </div>
              <div>
                <p className="text-[#64748B]">Competência de Trabalho:</p>
                <p className="font-extrabold text-[#0FA3A3] text-base">{competencia}</p>
              </div>
            </div>

            {/* Lista de Operações */}
            <div>
              <p className="font-bold text-[#1A2333] mb-1.5">Rotinas que serão processadas:</p>
              <ul className="space-y-1">
                {Array.from(operacoesSelecionadas).map((opId) => {
                  const op = OPERACOES_DISPONIVEIS.find((o) => o.id === opId)
                  return (
                    <li key={opId} className="flex items-center gap-2 text-slate-700">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span>{op?.nome || opId}</span>
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* Aviso de Competência Fechada */}
            {empresasComFechamento.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Aviso: {empresasComFechamento.length} empresa(s) com competência já fechada
                </p>
                <p className="text-[11px]">
                  As seguintes empresas possuem a competência {competencia} formalmente fechada:
                </p>
                <p className="text-[11px] font-semibold">{empresasComFechamento.join(', ')}</p>
                <p className="text-[10px] text-amber-700 pt-0.5">
                  A folha e os tributos serão calculados, porém as partidas dobradas serão
                  registradas como pendência no relatório contábil sem desbalancear o livro fechado.
                </p>
              </div>
            )}

            <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-3 text-[11px] text-[#0FA3A3] flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 shrink-0" />
              <span>
                Execução protegida com isolamento de falha. Se alguma empresa falhar em qualquer
                operação, o processo segue ininterrupto para as demais.
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsConfirmModalOpen(false)}
              className="h-9 text-xs rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleExecutarLote}
              className="h-9 text-xs rounded-xl bg-[#0FA3A3] text-white hover:bg-[#0C8585] font-semibold"
            >
              Iniciar Execução da Fila
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

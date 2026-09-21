import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  PlusCircle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Layers,
  Building2,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  FileSpreadsheet,
  AlertCircle,
  Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import type {
  Empresa,
  EmpresaMigracaoOnboardingRecord,
  MigracaoTipo,
  MigracaoStatus,
} from '@/types'
import { empresasMigracoesOnboardingService } from '@/services/empresasMigracoesOnboardingService'
import { ProcessoMigracaoDetalheCard } from '@/components/ProcessoMigracaoDetalheCard'
import { ModalNovoProcessoMigracao } from '@/components/ModalNovoProcessoMigracao'
import { maskCnpj } from '@/lib/formatters'

interface PainelMigracoesOnboardingProps {
  tenantId: string
  empresas: Empresa[]
  canEdit: boolean
  usuarioId: string
  usuarioNome?: string
  empresaFocoId?: string
  onAbrirImportacaoLote?: () => void
}

export function PainelMigracoesOnboarding({
  tenantId,
  empresas,
  canEdit,
  usuarioId,
  usuarioNome,
  empresaFocoId,
  onAbrirImportacaoLote,
}: PainelMigracoesOnboardingProps) {
  const { toast } = useToast()
  const [processos, setProcessos] = useState<EmpresaMigracaoOnboardingRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | MigracaoTipo>('todos')
  const [statusFiltro, setStatusFiltro] = useState<
    'todos' | 'em_andamento' | 'concluido' | 'cancelado'
  >('todos')
  const [search, setSearch] = useState('')

  // Processo selecionado para visualização expandida
  const [processoSelecionadoId, setProcessoSelecionadoId] = useState<string | null>(null)

  // Modal de Criação de Novo Processo
  const [modalNovoOpen, setModalNovoOpen] = useState(false)
  const [tipoModalNovo, setTipoModalNovo] = useState<MigracaoTipo>('entrada')
  const [empresaPreSelecionadaId, setEmpresaPreSelecionadaId] = useState<string | undefined>(
    empresaFocoId,
  )

  const carregarProcessos = useCallback(async () => {
    if (!tenantId) return
    try {
      setLoading(true)
      const list = await empresasMigracoesOnboardingService.list(tenantId)
      setProcessos(list)

      // Se houver empresa foco, auto-seleciona o processo mais recente dela
      if (empresaFocoId && list.length > 0) {
        const procFoco = list.find((p) => p.empresa_id === empresaFocoId)
        if (procFoco) setProcessoSelecionadoId(procFoco.id)
      } else if (!processoSelecionadoId && list.length > 0) {
        setProcessoSelecionadoId(list[0].id)
      }
    } catch (err) {
      console.error('Erro ao listar migrações:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar migrações',
        description: 'Não foi possível listar os processos de migração e onboarding.',
      })
    } finally {
      setLoading(false)
    }
  }, [tenantId, empresaFocoId, toast])

  useEffect(() => {
    carregarProcessos()
  }, [carregarProcessos])

  // Métricas
  const metricas = useMemo(() => {
    const ativasEntrada = processos.filter(
      (p) => p.tipo === 'entrada' && p.status !== 'concluido' && p.status !== 'cancelado',
    ).length
    const ativasSaida = processos.filter(
      (p) => p.tipo === 'saida' && p.status !== 'concluido' && p.status !== 'cancelado',
    ).length
    const concluidasTotal = processos.filter((p) => p.status === 'concluido').length

    return { ativasEntrada, ativasSaida, concluidasTotal, total: processos.length }
  }, [processos])

  // Filtragem da lista
  const processosFiltrados = useMemo(() => {
    return processos.filter((p) => {
      if (tipoFiltro !== 'todos' && p.tipo !== tipoFiltro) return false

      if (statusFiltro === 'em_andamento') {
        if (p.status === 'concluido' || p.status === 'cancelado') return false
      } else if (statusFiltro === 'concluido') {
        if (p.status !== 'concluido') return false
      } else if (statusFiltro === 'cancelado') {
        if (p.status !== 'cancelado') return false
      }

      if (search.trim()) {
        const termo = search.toLowerCase()
        const razao = p.expand?.empresa_id?.razao_social?.toLowerCase() || ''
        const fantasia = p.expand?.empresa_id?.nome_fantasia?.toLowerCase() || ''
        const cnpj = p.expand?.empresa_id?.cnpj || ''
        const outroContador = (p.contador_anterior || p.novo_contador || '').toLowerCase()
        if (
          !razao.includes(termo) &&
          !fantasia.includes(termo) &&
          !cnpj.includes(termo) &&
          !outroContador.includes(termo)
        ) {
          return false
        }
      }

      return true
    })
  }, [processos, tipoFiltro, statusFiltro, search])

  const processoAtivo = useMemo(() => {
    if (!processoSelecionadoId) return processosFiltrados[0] || null
    return processos.find((p) => p.id === processoSelecionadoId) || processosFiltrados[0] || null
  }, [processos, processoSelecionadoId, processosFiltrados])

  const abrirModalNovo = (tipo: MigracaoTipo, empId?: string) => {
    setTipoModalNovo(tipo)
    setEmpresaPreSelecionadaId(empId || empresaFocoId)
    setModalNovoOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Banner Superior & Atalhos Rápidos */}
      <div className="rounded-2xl border border-teal-200 bg-linear-to-r from-teal-50/70 via-white to-blue-50/40 p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-100 text-[#0FA3A3]">
              <Layers className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-[#1A2333]">
              Acompanhamento de Migrações de Escritório & Onboarding
            </h3>
            <Badge className="bg-[#0FA3A3] text-white text-[9px] font-bold px-1.5 py-0 uppercase">
              Rastreamento 360°
            </Badge>
          </div>
          <p className="text-xs text-[#64748B] max-w-3xl leading-relaxed">
            Gestão operacional em duas direções: <strong>Migrações de ENTRADA</strong> (acolhimento,
            coleta de dados do contador anterior e implantação até a responsabilidade técnica) e{' '}
            <strong>Migrações de SAÍDA</strong> (handover organizado, entrega de arquivos e
            revogação de procurações).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {onAbrirImportacaoLote && canEdit && (
            <Button
              variant="outline"
              onClick={onAbrirImportacaoLote}
              className="gap-1.5 rounded-xl border-[#0FA3A3] text-[#0FA3A3] hover:bg-[#F0FDFA] font-semibold text-xs h-9 shadow-xs"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Importar Planilha</span>
            </Button>
          )}

          {canEdit && (
            <>
              <Button
                onClick={() => abrirModalNovo('entrada')}
                className="gap-1.5 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs h-9 shadow-xs"
              >
                <ArrowDownLeft className="h-4 w-4" />
                <span>+ Migração Entrada</span>
              </Button>

              <Button
                onClick={() => abrirModalNovo('saida')}
                className="gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-9 shadow-xs"
              >
                <ArrowUpRight className="h-4 w-4" />
                <span>+ Migração Saída</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-800">
                Entradas em Andamento
              </span>
              <p className="text-2xl font-bold text-teal-900">{metricas.ativasEntrada}</p>
              <span className="text-[10px] text-slate-500">Empresas em implantação</span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-teal-50 text-[#0FA3A3] flex items-center justify-center">
              <ArrowDownLeft className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                Saídas em Handover
              </span>
              <p className="text-2xl font-bold text-amber-900">{metricas.ativasSaida}</p>
              <span className="text-[10px] text-slate-500">Transferências em curso</span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
                Concluídas com Sucesso
              </span>
              <p className="text-2xl font-bold text-emerald-700">{metricas.concluidasTotal}</p>
              <span className="text-[10px] text-slate-500">Responsabilidade formalizada</span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                Total de Processos
              </span>
              <p className="text-2xl font-bold text-slate-800">{metricas.total}</p>
              <span className="text-[10px] text-slate-500">Histórico de migrações</span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-3 shadow-2xs">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por empresa, CNPJ ou outro contador..."
            className="pl-9 h-9 text-xs rounded-xl border-[#E2E8F0]"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {/* Filtro Direção */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs">
            <button
              onClick={() => setTipoFiltro('todos')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                tipoFiltro === 'todos' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setTipoFiltro('entrada')}
              className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
                tipoFiltro === 'entrada'
                  ? 'bg-teal-50 text-teal-900 shadow-2xs border border-teal-200'
                  : 'text-slate-600'
              }`}
            >
              <ArrowDownLeft className="h-3 w-3 text-[#0FA3A3]" />
              <span>Entrada</span>
            </button>
            <button
              onClick={() => setTipoFiltro('saida')}
              className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
                tipoFiltro === 'saida'
                  ? 'bg-amber-50 text-amber-900 shadow-2xs border border-amber-200'
                  : 'text-slate-600'
              }`}
            >
              <ArrowUpRight className="h-3 w-3 text-amber-600" />
              <span>Saída</span>
            </button>
          </div>

          {/* Filtro Status */}
          <Select
            value={statusFiltro}
            onValueChange={(val) =>
              setStatusFiltro(val as 'todos' | 'em_andamento' | 'concluido' | 'cancelado')
            }
          >
            <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0] min-w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="em_andamento">Em Andamento</SelectItem>
              <SelectItem value="concluido">Concluídos</SelectItem>
              <SelectItem value="cancelado">Cancelados</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            onClick={carregarProcessos}
            className="h-9 w-9 rounded-xl text-slate-500 hover:text-slate-800"
            title="Atualizar lista"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Painel Principal de Dois Lados: Lista Lateral + Detalhe Interativo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Coluna Lateral: Processos Cadastrados (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-600 px-1 font-semibold">
            <span>Processos Registrados ({processosFiltrados.length})</span>
            <span>Selecione para abrir</span>
          </div>

          <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
                Carregando processos de migração...
              </div>
            ) : processosFiltrados.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 space-y-2">
                <p className="font-semibold text-slate-700">Nenhum processo encontrado</p>
                <p className="text-[11px] text-slate-500">
                  Inicie uma nova migração de Entrada ou Saída para acompanhar o onboarding.
                </p>
                {canEdit && (
                  <Button
                    size="sm"
                    onClick={() => abrirModalNovo('entrada')}
                    className="mt-2 text-xs bg-[#0FA3A3] text-white rounded-xl"
                  >
                    + Criar Primeira Migração
                  </Button>
                )}
              </div>
            ) : (
              processosFiltrados.map((proc) => {
                const emp = proc.expand?.empresa_id
                const isSelected = proc.id === processoAtivo?.id
                const chk = proc.checklist_itens_json || []
                const concl = chk.filter((c) => c.concluido).length
                const pct = chk.length > 0 ? Math.round((concl / chk.length) * 100) : 0
                const isEnt = proc.tipo === 'entrada'

                return (
                  <div
                    key={proc.id}
                    onClick={() => setProcessoSelecionadoId(proc.id)}
                    className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#0FA3A3] bg-teal-50/40 shadow-sm ring-1 ring-[#0FA3A3]'
                        : 'border-[#E2E8F0] bg-white hover:bg-slate-50/70 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className={
                            isEnt
                              ? 'border-teal-300 bg-teal-50 text-teal-800 text-[9px] font-bold uppercase gap-1'
                              : 'border-amber-300 bg-amber-50 text-amber-800 text-[9px] font-bold uppercase gap-1'
                          }
                        >
                          {isEnt ? (
                            <ArrowDownLeft className="h-3 w-3 text-[#0FA3A3]" />
                          ) : (
                            <ArrowUpRight className="h-3 w-3 text-amber-600" />
                          )}
                          <span>{isEnt ? 'Entrada' : 'Saída'}</span>
                        </Badge>

                        <span className="text-[10px] text-slate-500">
                          {proc.data_corte ? `Corte: ${proc.data_corte.slice(0, 10)}` : 'Sem corte'}
                        </span>
                      </div>

                      <span className="text-[11px] font-bold text-[#0FA3A3]">{pct}%</span>
                    </div>

                    <h4 className="text-xs font-bold text-[#1A2333] mt-2 truncate">
                      {emp?.nome_fantasia || emp?.razao_social || 'Empresa'}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-mono truncate">
                      {emp?.cnpj ? maskCnpj(emp.cnpj) : '—'}
                    </p>

                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 text-[10px] text-slate-500">
                      <span>
                        {concl}/{chk.length} etapas
                      </span>
                      <span className="capitalize font-medium">
                        {proc.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Coluna Central / Direita: Detalhe do Processo Ativo com Checklist (8 cols) */}
        <div className="lg:col-span-8">
          {processoAtivo ? (
            <ProcessoMigracaoDetalheCard
              processo={processoAtivo}
              canEdit={canEdit}
              usuarioId={usuarioId}
              usuarioNome={usuarioNome}
              tenantId={tenantId}
              onAtualizado={(atualizado) => {
                setProcessos((prev) => prev.map((p) => (p.id === atualizado.id ? atualizado : p)))
              }}
              onExcluido={(id) => {
                setProcessos((prev) => prev.filter((p) => p.id !== id))
                setProcessoSelecionadoId(null)
              }}
            />
          ) : (
            <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs p-12 text-center bg-white">
              <div className="max-w-md mx-auto space-y-3">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-teal-50 text-[#0FA3A3] flex items-center justify-center">
                  <Layers className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-[#1A2333]">
                  Nenhum processo de migração selecionado
                </h3>
                <p className="text-xs text-[#64748B]">
                  Selecione um processo na lista ao lado ou inicie uma nova migração de Entrada ou
                  Saída para a carteira.
                </p>
                {canEdit && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <Button
                      onClick={() => abrirModalNovo('entrada')}
                      className="text-xs bg-[#0FA3A3] hover:bg-[#0C8585] text-white rounded-xl gap-1.5"
                    >
                      <ArrowDownLeft className="h-4 w-4" />
                      <span>Nova Migração de Entrada</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => abrirModalNovo('saida')}
                      className="text-xs rounded-xl border-amber-300 text-amber-800 hover:bg-amber-50 gap-1.5"
                    >
                      <ArrowUpRight className="h-4 w-4 text-amber-600" />
                      <span>Nova Migração de Saída</span>
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Modal de Criação */}
      <ModalNovoProcessoMigracao
        open={modalNovoOpen}
        onOpenChange={setModalNovoOpen}
        tenantId={tenantId}
        empresas={empresas}
        empresaPreSelecionadaId={empresaPreSelecionadaId}
        tipoPreSelecionado={tipoModalNovo}
        usuarioId={usuarioId}
        usuarioNome={usuarioNome}
        onCriado={(novo) => {
          setProcessos((prev) => [novo, ...prev])
          setProcessoSelecionadoId(novo.id)
        }}
      />
    </div>
  )
}

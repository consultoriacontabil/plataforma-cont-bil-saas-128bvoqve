import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Play,
  Filter,
  Search,
  Building2,
  FileText,
  CreditCard,
  Ban,
  ArrowUpRight,
  RefreshCw,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { faturamentoRecorrenteService } from '@/services/faturamentoRecorrente'
import { financeiroService } from '@/services/financeiro'
import { formatDatePtBr } from '@/lib/formatters'
import type {
  FaturamentoRecorrenteRecord,
  StatusFaturamentoRecorrente,
  Empresa,
  ContaBancariaRecord,
} from '@/types'

interface FaturamentoRecorrenteTabProps {
  empresas: Empresa[]
  canManage: boolean // Administrador ou Contador
  isAuxiliar: boolean // Auxiliar só visualiza
}

export function FaturamentoRecorrenteTab({
  empresas,
  canManage,
  isAuxiliar,
}: FaturamentoRecorrenteTabProps) {
  const { tenant, user } = useAuth()
  const { toast } = useToast()

  const [faturamentos, setFaturamentos] = useState<FaturamentoRecorrenteRecord[]>([])
  const [contasBancarias, setContasBancarias] = useState<ContaBancariaRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('todas')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroCompetencia, setFiltroCompetencia] = useState<string>('todas')
  const [filtroBusca, setFiltroBusca] = useState<string>('')

  // Modais de ação
  const [modalGerarOpen, setModalGerarOpen] = useState(false)
  const [competenciaGeracao, setCompetenciaGeracao] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [gerando, setGerando] = useState(false)
  const [resultadoGeracao, setResultadoGeracao] = useState<any | null>(null)

  // Modal Pagar
  const [modalPagarOpen, setModalPagarOpen] = useState(false)
  const [selectedFat, setSelectedFat] = useState<FaturamentoRecorrenteRecord | null>(null)
  const [dataPagamento, setDataPagamento] = useState<string>(
    () => new Date().toISOString().split('T')[0],
  )
  const [contaBancariaId, setContaBancariaId] = useState<string>('')
  const [salvandoPagamento, setSalvandoPagamento] = useState(false)

  // Modal Cancelar
  const [modalCancelarOpen, setModalCancelarOpen] = useState(false)
  const [motivoCancelamento, setMotivoCancelamento] = useState('')
  const [cancelando, setCancelando] = useState(false)

  // Carregar dados
  const loadData = useCallback(async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      const [listFat, listBancos] = await Promise.all([
        faturamentoRecorrenteService.list(tenant.id, {
          empresaId: filtroEmpresa !== 'todas' ? filtroEmpresa : undefined,
          status:
            filtroStatus !== 'todos' ? (filtroStatus as StatusFaturamentoRecorrente) : undefined,
          competencia: filtroCompetencia !== 'todas' ? filtroCompetencia : undefined,
          busca: filtroBusca,
        }),
        financeiroService.listContasBancarias(tenant.id),
      ])
      setFaturamentos(listFat)
      setContasBancarias(listBancos.filter((b) => b.ativa))
      if (listBancos.length > 0 && !contaBancariaId) {
        setContaBancariaId(listBancos[0].id)
      }
    } catch (err) {
      console.error('Erro ao carregar faturamentos recorrentes:', err)
      toast({
        title: 'Erro ao carregar cobranças',
        description: 'Não foi possível buscar as cobranças de faturamento recorrente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [
    tenant?.id,
    filtroEmpresa,
    filtroStatus,
    filtroCompetencia,
    filtroBusca,
    toast,
    contaBancariaId,
  ])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Lista única de competências presentes nos registros para filtro
  const competenciasDisponiveis = useMemo(() => {
    const comps = new Set<string>()
    faturamentos.forEach((f) => {
      if (f.competencia) comps.add(f.competencia)
    })
    return Array.from(comps).sort().reverse()
  }, [faturamentos])

  // Indicadores
  const metrics = useMemo(() => {
    let faturado = 0
    let recebido = 0
    let emAberto = 0
    let atrasado = 0

    const todayStr = new Date().toISOString().split('T')[0]

    faturamentos.forEach((f) => {
      if (f.status === 'cancelado') return
      const valor = f.valor || 0
      if (f.status === 'pago') {
        recebido += valor
      } else if (f.status === 'faturado') {
        faturado += valor
        const vencStr = f.data_vencimento ? f.data_vencimento.split('T')[0] : ''
        if (vencStr && vencStr < todayStr) {
          atrasado += valor
        } else {
          emAberto += valor
        }
      } else if (f.status === 'previsto') {
        emAberto += valor
      }
    })

    return { faturado, recebido, emAberto, atrasado }
  }, [faturamentos])

  // Ação Geração Manual da Competência
  const handleGerarCompetencia = async () => {
    if (!tenant?.id) return
    try {
      setGerando(true)
      const res = await faturamentoRecorrenteService.gerarCompetencia(
        tenant.id,
        competenciaGeracao,
        user?.id,
      )
      setResultadoGeracao(res)
      toast({
        title: 'Processamento concluído!',
        description: `${res.criados} cobrança(s) criada(s) na competência ${competenciaGeracao}. ${res.pulados} contrato(s) pulado(s) ou já existentes.`,
      })
      loadData()
    } catch (err: any) {
      console.error('Erro ao gerar competência:', err)
      toast({
        title: 'Erro na geração de cobranças',
        description: err?.message || 'Falha ao processar os contratos da competência.',
        variant: 'destructive',
      })
    } finally {
      setGerando(false)
    }
  }

  // Ação Marcar como Faturado
  const handleMarcarFaturado = async (f: FaturamentoRecorrenteRecord) => {
    if (!canManage) {
      toast({
        title: 'Permissão restrita',
        description: 'Apenas Administradores e Contadores podem emitir cobranças.',
        variant: 'destructive',
      })
      return
    }
    try {
      await faturamentoRecorrenteService.marcarComoFaturado(f.id, tenant!.id, user?.id)
      toast({
        title: 'Cobrança faturada!',
        description: `Título a receber gerado no Financeiro para ${f.expand?.empresa?.nome_fantasia || 'o cliente'}.`,
      })
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao faturar',
        description: err?.message || 'Falha ao atualizar status.',
        variant: 'destructive',
      })
    }
  }

  // Ação Abrir Modal de Pagamento
  const handleOpenPagar = (f: FaturamentoRecorrenteRecord) => {
    if (!canManage) {
      toast({
        title: 'Permissão restrita',
        description: 'Apenas Administradores e Contadores podem dar baixa em honorários.',
        variant: 'destructive',
      })
      return
    }
    setSelectedFat(f)
    setDataPagamento(new Date().toISOString().split('T')[0])
    setModalPagarOpen(true)
  }

  // Ação Confirmar Pagamento com Partida Dobrada
  const handleConfirmarPagamento = async () => {
    if (!selectedFat || !tenant?.id) return
    try {
      setSalvandoPagamento(true)
      await faturamentoRecorrenteService.marcarComoPago(
        selectedFat.id,
        `${dataPagamento} 12:00:00.000Z`,
        contaBancariaId || undefined,
        user?.id,
      )
      toast({
        title: 'Honorário quitado com sucesso!',
        description:
          'Partida dobrada (Receita × Banco) escriturada no Contábil e título quitado no Financeiro.',
      })
      setModalPagarOpen(false)
      loadData()
    } catch (err: any) {
      console.error('Erro ao marcar como pago:', err)
      toast({
        title: 'Erro ao dar baixa',
        description:
          err?.message ||
          'Não foi possível registrar o pagamento contábil. Verifique se a competência contábil não está fechada.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoPagamento(false)
    }
  }

  // Ação Abrir Modal de Cancelamento
  const handleOpenCancelar = (f: FaturamentoRecorrenteRecord) => {
    if (!canManage) {
      toast({
        title: 'Permissão restrita',
        description: 'Apenas Administradores e Contadores podem cancelar cobranças.',
        variant: 'destructive',
      })
      return
    }
    setSelectedFat(f)
    setMotivoCancelamento('')
    setModalCancelarOpen(true)
  }

  // Ação Confirmar Cancelamento
  const handleConfirmarCancelamento = async () => {
    if (!selectedFat || !tenant?.id) return
    if (!motivoCancelamento.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Informe o motivo formal do cancelamento da cobrança.',
        variant: 'destructive',
      })
      return
    }

    try {
      setCancelando(true)
      await faturamentoRecorrenteService.cancelar(
        selectedFat.id,
        motivoCancelamento,
        tenant.id,
        user?.id,
      )
      toast({
        title: 'Cobrança cancelada',
        description: 'A cobrança e o título financeiro vinculado foram cancelados.',
      })
      setModalCancelarOpen(false)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao cancelar',
        description: err?.message || 'Falha ao cancelar cobrança.',
        variant: 'destructive',
      })
    } finally {
      setCancelando(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Barra de Ações Superior */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#0B1F3A] flex items-center gap-2">
            <span>Faturamento Recorrente de Honorários</span>
            <Badge className="bg-[#0FA3A3]/10 text-[#0FA3A3] hover:bg-[#0FA3A3]/20 border-0 text-[11px] font-bold">
              Automação Mensal
            </Badge>
          </h2>
          <p className="text-xs text-[#64748B]">
            Geração mensal automática ou manual baseada nos contratos ativos, com integração
            automática ao Financeiro (Contas a Receber) e lançamentos contábeis em partidas
            dobradas.
          </p>
        </div>

        {canManage && (
          <Button
            onClick={() => {
              setResultadoGeracao(null)
              setModalGerarOpen(true)
            }}
            className="rounded-xl text-xs font-semibold bg-[#0FA3A3] hover:bg-[#0D8B8B] text-white shadow-xs gap-2 shrink-0"
          >
            <Play className="h-4 w-4" />
            <span>Gerar Cobranças da Competência</span>
          </Button>
        )}
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-[#64748B] uppercase">Faturado</p>
              <p className="text-xl font-black text-[#1A2333]">
                R$ {metrics.faturado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-[#64748B]">Títulos emitidos</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-[#64748B] uppercase">Recebido / Quitado</p>
              <p className="text-xl font-black text-emerald-700">
                R$ {metrics.recebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-emerald-700 font-semibold">
                Partida dobrada confirmada
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-[#64748B] uppercase">Em Aberto</p>
              <p className="text-xl font-black text-[#1A2333]">
                R$ {metrics.emAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-amber-700 font-semibold">
                Dentro do prazo de vencimento
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-[#64748B] uppercase">Atrasado</p>
              <p className="text-xl font-black text-rose-600">
                R$ {metrics.atrasado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-rose-700 font-semibold">Vencidos sem quitação</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Busca textual */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
              <Input
                value={filtroBusca}
                onChange={(e) => setFiltroBusca(e.target.value)}
                placeholder="Buscar por empresa ou contrato..."
                className="pl-9 h-9 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            {/* Filtro Empresa */}
            <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
              <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                <SelectValue placeholder="Todas as empresas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as empresas</SelectItem>
                {empresas.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.nome_fantasia || emp.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro Status */}
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="previsto">Previsto</SelectItem>
                <SelectItem value="faturado">Faturado</SelectItem>
                <SelectItem value="pago">Pago / Quitado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro Competência */}
            <Select value={filtroCompetencia} onValueChange={setFiltroCompetencia}>
              <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                <SelectValue placeholder="Todas as competências" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as competências</SelectItem>
                {competenciasDisponiveis.map((comp) => (
                  <SelectItem key={comp} value={comp}>
                    {comp}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Cobranças */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[#64748B] font-bold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Competência</th>
                <th className="py-3 px-4">Empresa / Contrato</th>
                <th className="py-3 px-4">Vencimento</th>
                <th className="py-3 px-4">Valor</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Título Financeiro</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-[#1A2333]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#64748B]">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#0FA3A3] mx-auto mb-2" />
                    Carregando cobranças de faturamento recorrente...
                  </td>
                </tr>
              ) : faturamentos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#64748B]">
                    Nenhuma cobrança encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                faturamentos.map((f) => {
                  const empNome =
                    f.expand?.empresa?.nome_fantasia ||
                    f.expand?.empresa?.razao_social ||
                    'Empresa Não Identificada'
                  const contratoTitulo = f.expand?.contrato?.titulo || 'Contrato de Honorários'
                  const vencStr = f.data_vencimento ? f.data_vencimento.split('T')[0] : ''
                  const todayStr = new Date().toISOString().split('T')[0]
                  const isAtrasado = f.status === 'faturado' && vencStr && vencStr < todayStr

                  return (
                    <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#0FA3A3]">
                        {f.competencia}
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-bold text-[#0B1F3A] flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-[#0FA3A3] shrink-0" />
                          <span>{empNome}</span>
                        </p>
                        <p className="text-[11px] text-[#64748B] truncate max-w-xs">
                          {contratoTitulo}
                        </p>
                        {f.notas && (
                          <p className="text-[10px] text-slate-400 italic truncate max-w-xs">
                            {f.notas}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={isAtrasado ? 'text-rose-600 font-bold' : ''}>
                          {f.data_vencimento ? formatDatePtBr(f.data_vencimento) : '—'}
                        </span>
                        {isAtrasado && (
                          <span className="block text-[10px] text-rose-500 font-semibold">
                            Vencido
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-[#0B1F3A]">
                        R$ {f.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-3.5 px-4">
                        {f.status === 'pago' ? (
                          <Badge className="bg-emerald-600 text-white font-bold text-[10px] uppercase">
                            Pago
                          </Badge>
                        ) : f.status === 'faturado' ? (
                          <Badge
                            className={
                              isAtrasado
                                ? 'bg-rose-600 text-white font-bold text-[10px] uppercase'
                                : 'bg-blue-600 text-white font-bold text-[10px] uppercase'
                            }
                          >
                            {isAtrasado ? 'Atrasado' : 'Faturado'}
                          </Badge>
                        ) : f.status === 'previsto' ? (
                          <Badge className="bg-slate-200 text-slate-700 font-bold text-[10px] uppercase">
                            Previsto
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-100 text-rose-800 font-bold text-[10px] uppercase">
                            Cancelado
                          </Badge>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {f.titulo_financeiro ? (
                          <div className="text-[11px]">
                            <span className="font-mono text-[#0B1F3A] font-semibold flex items-center gap-1">
                              <CreditCard className="h-3 w-3 text-[#0FA3A3]" />
                              {f.expand?.titulo_financeiro?.documento_ref ||
                                f.titulo_financeiro.slice(0, 8)}
                            </span>
                            <span className="text-[10px] text-[#64748B]">
                              Status: {f.expand?.titulo_financeiro?.status || 'registrado'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">Pendente de emissão</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Se for previsto, botão de faturar */}
                          {f.status === 'previsto' && canManage && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleMarcarFaturado(f)}
                              className="h-7 text-xs px-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white gap-1"
                            >
                              <FileText className="h-3 w-3" />
                              <span>Faturar</span>
                            </Button>
                          )}

                          {/* Se for faturado, botão de quitar */}
                          {f.status === 'faturado' && canManage && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleOpenPagar(f)}
                              className="h-7 text-xs px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Dar Baixa (Pago)</span>
                            </Button>
                          )}

                          {/* Se não for pago nem cancelado, botão de cancelar */}
                          {f.status !== 'pago' && f.status !== 'cancelado' && canManage && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenCancelar(f)}
                              className="h-7 text-xs px-2 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 gap-1"
                              title="Cancelar cobrança"
                            >
                              <Ban className="h-3 w-3" />
                              <span>Cancelar</span>
                            </Button>
                          )}

                          {isAuxiliar && (
                            <span className="text-[10px] text-slate-400 italic">Visualização</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Gerar Cobranças da Competência */}
      <Dialog open={modalGerarOpen} onOpenChange={setModalGerarOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#0B1F3A]">
              Gerar Cobranças da Competência
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              O sistema varre todos os contratos ativos (com modelo recorrente) e cria as cobranças
              com títulos no Financeiro. Não duplica cobranças já existentes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1A2333]">
                Competência de Cobrança (AAAA-MM) *
              </Label>
              <Input
                type="month"
                value={competenciaGeracao}
                onChange={(e) => setCompetenciaGeracao(e.target.value)}
                className="h-9 rounded-xl border-[#E2E8F0] text-xs"
              />
              <p className="text-[11px] text-[#64748B]">
                Exemplo: 2026-10 para cobranças do mês de Outubro/2026.
              </p>
            </div>

            {resultadoGeracao && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-emerald-700">Criados: {resultadoGeracao.criados}</span>
                  <span className="text-[#64748B]">Pulados: {resultadoGeracao.pulados}</span>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 text-[11px] divide-y divide-slate-100">
                  {resultadoGeracao.detalhes?.map((d: any, idx: number) => (
                    <div key={idx} className="pt-1 flex items-center justify-between">
                      <span className="truncate max-w-[220px]">
                        {d.empresaNome} ({d.titulo})
                      </span>
                      <Badge
                        className={`text-[9px] uppercase ${
                          d.status === 'criado'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {d.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalGerarOpen(false)}
              className="rounded-xl text-xs"
            >
              Fechar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={gerando || !competenciaGeracao}
              onClick={handleGerarCompetencia}
              className="rounded-xl bg-[#0FA3A3] text-white hover:bg-[#0D8B8B] text-xs gap-1.5"
            >
              {gerando ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Processando...</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  <span>Executar Geração</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Pagar / Baixa com Partida Dobrada */}
      <Dialog open={modalPagarOpen} onOpenChange={setModalPagarOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#0B1F3A]">
              Confirmar Recebimento de Honorários
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Registra a liquidação financeira e gera lançamento contábil automático em partida
              dobrada (Débito em Banco × Crédito em Receita de Serviços).
            </DialogDescription>
          </DialogHeader>

          {selectedFat && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                <p>
                  <strong className="text-[#1A2333]">Empresa:</strong>{' '}
                  {selectedFat.expand?.empresa?.nome_fantasia ||
                    selectedFat.expand?.empresa?.razao_social}
                </p>
                <p>
                  <strong className="text-[#1A2333]">Competência:</strong> {selectedFat.competencia}
                </p>
                <p>
                  <strong className="text-[#1A2333]">Valor do Honorário:</strong>{' '}
                  <span className="font-extrabold text-[#0FA3A3]">
                    R$ {selectedFat.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1A2333]">
                  Data do Pagamento / Crédito Bancário *
                </Label>
                <Input
                  type="date"
                  value={dataPagamento}
                  onChange={(e) => setDataPagamento(e.target.value)}
                  className="h-9 rounded-xl border-[#E2E8F0] text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1A2333]">
                  Conta Bancária de Destino
                </Label>
                <Select value={contaBancariaId} onValueChange={setContaBancariaId}>
                  <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] text-xs">
                    <SelectValue placeholder="Selecione a conta bancária..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contasBancarias.map((cb) => (
                      <SelectItem key={cb.id} value={cb.id}>
                        {cb.banco} — Ag. {cb.agencia} / CC {cb.conta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-100 text-[11px] text-teal-800 flex items-start gap-2">
                <Info className="h-4 w-4 text-[#0FA3A3] shrink-0 mt-0.5" />
                <span>
                  O lançamento contábil respeita o Fechamento Mensal de Competência. Se o mês já
                  estiver encerrado formalmente pelo escritório, a operação será bloqueada para
                  auditoria.
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalPagarOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={salvandoPagamento || !dataPagamento}
              onClick={handleConfirmarPagamento}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
            >
              {salvandoPagamento ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Escriturando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Confirmar Recebimento</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Cancelar Cobrança */}
      <Dialog open={modalCancelarOpen} onOpenChange={setModalCancelarOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-600">
              Cancelar Cobrança Recorrente
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Informe o motivo da anulação. Esta ação cancelará o registro de faturamento e o título
              financeiro a receber vinculado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1A2333]">
                Justificativa do Cancelamento *
              </Label>
              <Textarea
                rows={3}
                value={motivoCancelamento}
                onChange={(e) => setMotivoCancelamento(e.target.value)}
                placeholder="Ex.: Isenção acordada em aditivo contratual, rescisão amigável..."
                className="rounded-xl border-[#E2E8F0] text-xs resize-none"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalCancelarOpen(false)}
              className="rounded-xl text-xs"
            >
              Voltar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={cancelando || !motivoCancelamento.trim()}
              onClick={handleConfirmarCancelamento}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1.5"
            >
              {cancelando ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

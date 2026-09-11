import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  BookOpen,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Trash2,
  Paperclip,
  Check,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Scale,
  Calendar,
  Building2,
  Layers,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { empresasService } from '@/services/empresas'
import { documentosService } from '@/services/documentos'
import { contabilService } from '@/services/contabil'
import type {
  Empresa,
  Documento,
  ContaContabil,
  LancamentoContabil,
  LancamentoStatus,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { formatDatePtBr } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export default function LancamentosContabeisPage() {
  const { tenant, member, user, hasPermission } = useAuth()
  const { toast } = useToast()

  // Permissões:
  // Administrador / Contador: acesso total + confirmar lançamentos
  // Auxiliar: criar e editar rascunhos
  // Consultor: somente leitura
  const canConfirm = hasPermission(['administrador', 'contador'])
  const canCreateOrEdit = hasPermission(['administrador', 'contador', 'auxiliar'])
  const canDelete = hasPermission(['administrador', 'contador'])

  // Estados principais
  const [loading, setLoading] = useState(true)
  const [lancamentos, setLancamentos] = useState<LancamentoContabil[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const perPage = 25

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [planoContas, setPlanoContas] = useState<ContaContabil[]>([])
  const [documentos, setDocumentos] = useState<Documento[]>([])

  // Filtros
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>('todas')
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>('09/2026')
  const [selectedConta, setSelectedConta] = useState<string>('todas')
  const [selectedTipo, setSelectedTipo] = useState<string>('todos')
  const [selectedStatus, setSelectedStatus] = useState<string>('todos')
  const [buscaHistorico, setBuscaHistorico] = useState<string>('')

  // Modal Novo Lançamento em Partida Dobrada
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    empresaId: '',
    data: new Date().toISOString().split('T')[0],
    competencia: '09/2026',
    debitoContaId: '',
    creditoContaId: '',
    valor: '',
    historico: '',
    documentoId: '',
    status: 'rascunho' as LancamentoStatus,
  })

  // Modal Anexar Documento
  const [anexoModalOpen, setAnexoModalOpen] = useState(false)
  const [targetLancamento, setTargetLancamento] = useState<LancamentoContabil | null>(null)
  const [selectedDocId, setSelectedDocId] = useState('')

  // Carregar dados de suporte (Empresas, Plano de Contas, Docs)
  useEffect(() => {
    if (!tenant?.id) return
    const fetchSupport = async () => {
      try {
        const [empRes, pcRes, docRes] = await Promise.all([
          empresasService.list(tenant.id),
          contabilService.getPlanoContas(tenant.id, 'ativa = true'),
          documentosService.list(tenant.id),
        ])
        setEmpresas(empRes)
        setPlanoContas(pcRes)
        setDocumentos(docRes)
      } catch (err) {
        console.error('Erro ao carregar suporte:', err)
      }
    }
    void fetchSupport()
  }, [tenant?.id])

  // Carregar lançamentos
  const loadLancamentos = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const res = await contabilService.listLancamentos(
        tenant.id,
        {
          empresaId: selectedEmpresa,
          competencia: selectedCompetencia,
          contaId: selectedConta,
          tipo: selectedTipo,
          status: selectedStatus,
          busca: buscaHistorico,
        },
        currentPage,
        perPage,
      )
      setLancamentos(res.items)
      setTotalItems(res.totalItems)
    } catch (err) {
      console.error('Erro ao carregar lançamentos:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar lançamentos',
        description: 'Não foi possível buscar os registros contábeis.',
      })
    } finally {
      setLoading(false)
    }
  }, [
    tenant?.id,
    selectedEmpresa,
    selectedCompetencia,
    selectedConta,
    selectedTipo,
    selectedStatus,
    buscaHistorico,
    currentPage,
    toast,
  ])

  useEffect(() => {
    void loadLancamentos()
  }, [loadLancamentos])

  // Totalizadores dos lançamentos da página / visualizados
  const totalizadores = useMemo(() => {
    let deb = 0
    let cred = 0
    lancamentos.forEach((l) => {
      if (l.tipo === 'debito') {
        deb += l.valor
      } else {
        cred += l.valor
      }
    })
    const dif = Math.abs(deb - cred)
    const fechado = dif < 0.009
    return { deb, cred, dif, fechado }
  }, [lancamentos])

  // Contas analíticas (nível >= 3 ou sem filhas) para o autocomplete
  const contasAnaliticas = useMemo(() => {
    return planoContas.filter((c) => c.nivel >= 3)
  }, [planoContas])

  // Reset do formulário ao abrir
  const handleOpenModal = () => {
    setFormData({
      empresaId: selectedEmpresa !== 'todas' ? selectedEmpresa : empresas[0]?.id || '',
      data: new Date().toISOString().split('T')[0],
      competencia: selectedCompetencia !== 'todas' ? selectedCompetencia : '09/2026',
      debitoContaId: '',
      creditoContaId: '',
      valor: '',
      historico: '',
      documentoId: '',
      status: canConfirm ? 'confirmado' : 'rascunho',
    })
    setModalOpen(true)
  }

  // Submissão do lançamento em partida dobrada
  const handleSubmitLote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant?.id) return

    if (!formData.empresaId) {
      toast({ variant: 'destructive', title: 'Selecione uma empresa' })
      return
    }
    if (!formData.debitoContaId || !formData.creditoContaId) {
      toast({
        variant: 'destructive',
        title: 'Contas obrigatórias',
        description: 'Defina a conta a Débito e a conta a Crédito para a partida dobrada.',
      })
      return
    }
    if (formData.debitoContaId === formData.creditoContaId) {
      toast({
        variant: 'destructive',
        title: 'Contas duplicadas',
        description: 'A conta de Débito e a conta de Crédito devem ser distintas.',
      })
      return
    }
    const val = parseFloat(formData.valor.replace(',', '.'))
    if (isNaN(val) || val <= 0) {
      toast({ variant: 'destructive', title: 'Informe um valor válido maior que zero' })
      return
    }
    if (!formData.historico.trim()) {
      toast({ variant: 'destructive', title: 'Informe o histórico contábil' })
      return
    }

    setSubmitting(true)
    try {
      await contabilService.createPartidaDobrada({
        tenant_id: tenant.id,
        empresa: formData.empresaId,
        data: `${formData.data} 12:00:00.000Z`,
        competencia: formData.competencia,
        valor: val,
        historico: formData.historico.trim(),
        debitoContaId: formData.debitoContaId,
        creditoContaId: formData.creditoContaId,
        documentoId: formData.documentoId || undefined,
        status: formData.status,
        criado_por: user?.id,
      })

      toast({
        title: 'Partida dobrada criada com sucesso!',
        description: `Lançamentos de Débito e Crédito de R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} gravados.`,
      })

      setModalOpen(false)
      void loadLancamentos()
    } catch (err) {
      console.error('Erro ao salvar lançamento:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar lançamento',
        description: 'Verifique os campos e tente novamente.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Ação de confirmar lançamento (apenas Contador/Administrador)
  const handleConfirmar = async (l: LancamentoContabil) => {
    if (!canConfirm) {
      toast({
        variant: 'destructive',
        title: 'Acesso negado',
        description: 'Apenas Administradores e Contadores podem confirmar lançamentos.',
      })
      return
    }

    try {
      if (l.lote_id) {
        await contabilService.confirmarLote(l.lote_id)
        toast({
          title: 'Partida confirmada!',
          description: 'O lançamento e sua contrapartida foram confirmados com sucesso.',
        })
      } else {
        await contabilService.confirmarLancamento(l.id)
        toast({ title: 'Lançamento confirmado!' })
      }
      void loadLancamentos()
    } catch (err) {
      console.error('Erro ao confirmar:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao confirmar lançamento',
      })
    }
  }

  // Ação de excluir
  const handleDelete = async (l: LancamentoContabil) => {
    if (!canDelete) {
      toast({
        variant: 'destructive',
        title: 'Permissão insuficiente',
        description: 'Apenas Administrador e Contador podem excluir lançamentos.',
      })
      return
    }

    if (!confirm('Deseja excluir este lançamento contábil e sua respectiva partida dobrada?')) {
      return
    }

    try {
      await contabilService.deleteLancamento(l.id, true)
      toast({ title: 'Lançamento excluído com sucesso' })
      void loadLancamentos()
    } catch (err) {
      console.error('Erro ao excluir lançamento:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
      })
    }
  }

  // Vincular Documento Modal
  const handleOpenAnexoModal = (l: LancamentoContabil) => {
    setTargetLancamento(l)
    setSelectedDocId(l.documento || '')
    setAnexoModalOpen(true)
  }

  const handleSaveAnexo = async () => {
    if (!targetLancamento) return
    try {
      await contabilService.updateLancamento(targetLancamento.id, {
        documento: selectedDocId || undefined,
      })
      toast({ title: 'Documento vinculado ao lançamento!' })
      setAnexoModalOpen(false)
      void loadLancamentos()
    } catch (err) {
      console.error('Erro ao vincular documento:', err)
      toast({ variant: 'destructive', title: 'Erro ao vincular documento' })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-[#1A2333]">
              Lançamentos Contábeis
            </h2>
            <Badge className="bg-[#123B6D] text-white text-[11px] font-semibold">
              Partidas Dobradas
            </Badge>
          </div>
          <p className="text-xs text-[#64748B]">
            Registro e conciliação contábil por empresa, competência e plano de contas
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canCreateOrEdit && (
            <Button
              onClick={handleOpenModal}
              className="gap-2 rounded-xl bg-gradient-to-r from-[#0FA3A3] to-[#0C8585] text-xs font-semibold text-white shadow-md hover:opacity-95"
            >
              <Plus className="h-4 w-4" />
              <span>Novo Lançamento</span>
            </Button>
          )}
        </div>
      </div>

      {/* Totalizadores & Indicador de Fechamento */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Total Débitos
              </p>
              <p className="text-xl font-bold text-[#1A2333] mt-1">
                R${' '}
                {totalizadores.deb.toLocaleString('pt-BR', {
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
                Total Créditos
              </p>
              <p className="text-xl font-bold text-[#1A2333] mt-1">
                R${' '}
                {totalizadores.cred.toLocaleString('pt-BR', {
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
                Diferença (D - C)
              </p>
              <p
                className={cn(
                  'text-xl font-bold mt-1',
                  totalizadores.fechado ? 'text-[#16A34A]' : 'text-[#EF4444]',
                )}
              >
                R${' '}
                {totalizadores.dif.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl',
                totalizadores.fechado
                  ? 'bg-emerald-100 text-[#16A34A]'
                  : 'bg-red-100 text-[#EF4444]',
              )}
            >
              <Scale className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn(
            'rounded-2xl border shadow-2xs',
            totalizadores.fechado
              ? 'border-emerald-200 bg-emerald-50/40'
              : 'border-red-200 bg-red-50/40',
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Status da Partida
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                {totalizadores.fechado ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-[#16A34A]" />
                    <span className="text-base font-bold text-[#16A34A]">Fechado ✔</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-[#EF4444]" />
                    <span className="text-base font-bold text-[#EF4444]">Diferença Ativa</span>
                  </>
                )}
              </div>
            </div>
            <div className="text-[10px] text-right text-[#64748B]">
              <p>{totalItems} registros</p>
              <p>filtro aplicado</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros de Busca */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {/* Empresa */}
            <div className="space-y-1.5 lg:col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Empresa
              </label>
              <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Todas as Empresas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Empresas</SelectItem>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome_fantasia || e.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Competência */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Competência
              </label>
              <Select value={selectedCompetencia} onValueChange={setSelectedCompetencia}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Competência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="09/2026">09/2026</SelectItem>
                  <SelectItem value="08/2026">08/2026</SelectItem>
                  <SelectItem value="07/2026">07/2026</SelectItem>
                  <SelectItem value="06/2026">06/2026</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tipo */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Tipo
              </label>
              <Select value={selectedTipo} onValueChange={setSelectedTipo}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="debito">Débito</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Status
              </label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="confirmado">Confirmado</SelectItem>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Conta Contábil */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Conta Contábil
              </label>
              <Select value={selectedConta} onValueChange={setSelectedConta}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Conta" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="todas">Todas as Contas</SelectItem>
                  {planoContas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.codigo} - {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Busca textual por histórico */}
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
            <Input
              value={buscaHistorico}
              onChange={(e) => setBuscaHistorico(e.target.value)}
              placeholder="Buscar por histórico contábil, cliente ou detalhe..."
              className="h-9 pl-9 text-xs rounded-xl border-[#E2E8F0]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Lançamentos */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E2E8F0] bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
              <tr>
                <th className="py-3 px-4">Data / Comp.</th>
                <th className="py-3 px-4">Empresa</th>
                <th className="py-3 px-4">Conta Contábil</th>
                <th className="py-3 px-4">Histórico</th>
                <th className="py-3 px-4 text-center">Tipo</th>
                <th className="py-3 px-4 text-right">Valor</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Doc.</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-xs text-[#94A3B8]">
                    Carregando lançamentos contábeis...
                  </td>
                </tr>
              ) : lancamentos.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-xs text-[#94A3B8]">
                    Nenhum lançamento encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                lancamentos.map((l) => {
                  const isDebito = l.tipo === 'debito'
                  const isConfirmado = l.status === 'confirmado'
                  const conta = l.expand?.conta_contabil
                  const contra = l.expand?.contrapartida
                  const emp = l.expand?.empresa
                  const doc = l.expand?.documento

                  return (
                    <tr key={l.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Data & Competência */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-[#1A2333]">{formatDatePtBr(l.data)}</div>
                        <div className="text-[10px] text-[#64748B] flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{l.competencia}</span>
                        </div>
                      </td>

                      {/* Empresa */}
                      <td className="py-3 px-4 max-w-[160px] truncate">
                        <div className="font-medium text-[#1A2333] truncate">
                          {emp?.nome_fantasia || emp?.razao_social || '—'}
                        </div>
                        <div className="text-[10px] text-[#64748B] truncate">{emp?.cnpj || ''}</div>
                      </td>

                      {/* Conta Contábil */}
                      <td className="py-3 px-4 max-w-[200px]">
                        <div className="font-semibold text-[#1A2333] truncate">
                          {conta?.codigo} - {conta?.nome}
                        </div>
                        {contra && (
                          <div className="text-[10px] text-[#64748B] truncate">
                            Contra: {contra.codigo} - {contra.nome}
                          </div>
                        )}
                      </td>

                      {/* Histórico */}
                      <td className="py-3 px-4 max-w-[260px]">
                        <p className="line-clamp-2 text-[#334155]">{l.historico}</p>
                        {l.lote_id && (
                          <span className="text-[9px] font-mono text-[#94A3B8]">
                            Lote: {l.lote_id}
                          </span>
                        )}
                      </td>

                      {/* Tipo Débito / Crédito */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <Badge
                          className={cn(
                            'text-[10px] uppercase font-bold tracking-wider',
                            isDebito
                              ? 'bg-blue-100 text-[#1D4ED8] hover:bg-blue-100'
                              : 'bg-emerald-100 text-[#047857] hover:bg-emerald-100',
                          )}
                        >
                          {isDebito ? 'DÉBITO' : 'CRÉDITO'}
                        </Badge>
                      </td>

                      {/* Valor */}
                      <td className="py-3 px-4 text-right whitespace-nowrap font-semibold text-[#1A2333]">
                        R${' '}
                        {l.valor.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <Badge
                          className={cn(
                            'text-[10px] font-semibold',
                            isConfirmado
                              ? 'bg-[#DCFCE7] text-[#16A34A]'
                              : 'bg-[#FEF3C7] text-[#D97706]',
                          )}
                        >
                          {isConfirmado ? 'Confirmado' : 'Rascunho'}
                        </Badge>
                      </td>

                      {/* Documento Anexo */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {doc ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenAnexoModal(l)}
                            className="h-7 w-7 text-[#0FA3A3] hover:bg-teal-50"
                            title={`Documento: ${doc.nome_arquivo}`}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenAnexoModal(l)}
                            className="h-7 w-7 text-[#94A3B8] hover:text-[#1A2333]"
                            title="Anexar documento"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {!isConfirmado && canConfirm && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleConfirmar(l)}
                              className="h-7 text-[10px] font-semibold gap-1 border-emerald-300 text-[#16A34A] hover:bg-emerald-50"
                            >
                              <Check className="h-3 w-3" />
                              <span>Confirmar</span>
                            </Button>
                          )}

                          {canDelete && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDelete(l)}
                              className="h-7 w-7 text-[#94A3B8] hover:text-[#EF4444] hover:bg-red-50"
                              title="Excluir lançamento"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
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

        {/* Paginação */}
        {totalItems > perPage && (
          <div className="flex items-center justify-between border-t border-[#E2E8F0] px-4 py-3 bg-slate-50/50">
            <span className="text-xs text-[#64748B]">
              Mostrando {(currentPage - 1) * perPage + 1} a{' '}
              {Math.min(currentPage * perPage, totalItems)} de {totalItems} registros
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="h-8 text-xs"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Anterior</span>
              </Button>
              <span className="text-xs font-semibold px-2">Página {currentPage}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage * perPage >= totalItems}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="h-8 text-xs"
              >
                <span>Próxima</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Modal: Novo Lançamento em Partida Dobrada */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[620px] rounded-2xl">
          <form onSubmit={handleSubmitLote}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#1A2333] flex items-center gap-2">
                <Scale className="h-5 w-5 text-[#0FA3A3]" />
                <span>Novo Lançamento Contábil (Partida Dobrada)</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-[#64748B]">
                Crie um registro equilibrado. O valor informado gerará automaticamente um débito e
                um crédito idênticos vinculados ao mesmo lote.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-2">
              {/* Empresa */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Empresa *
                </label>
                <Select
                  value={formData.empresaId}
                  onValueChange={(val) => setFormData((p) => ({ ...p, empresaId: val }))}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                    <SelectValue placeholder="Selecione a Empresa" />
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

              {/* Data do Lançamento */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Data do Fato *
                </label>
                <Input
                  type="date"
                  value={formData.data}
                  onChange={(e) => setFormData((p) => ({ ...p, data: e.target.value }))}
                  required
                  className="h-9 text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>

              {/* Competência (MM/YYYY) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Competência (MM/AAAA) *
                </label>
                <Input
                  value={formData.competencia}
                  onChange={(e) => setFormData((p) => ({ ...p, competencia: e.target.value }))}
                  placeholder="Ex: 09/2026"
                  required
                  className="h-9 text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>

              {/* Conta a DÉBITO */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#1D4ED8] flex items-center justify-between">
                  <span>Conta Débito (Aplicação dos Recursos) *</span>
                  <Badge variant="outline" className="text-[10px] text-[#1D4ED8]">
                    DÉBITO
                  </Badge>
                </label>
                <Select
                  value={formData.debitoContaId}
                  onValueChange={(val) => setFormData((p) => ({ ...p, debitoContaId: val }))}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                    <SelectValue placeholder="Selecione a Conta de Débito..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {contasAnaliticas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.codigo} - {c.nome} ({c.tipo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Conta a CRÉDITO */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#047857] flex items-center justify-between">
                  <span>Conta Crédito (Origem dos Recursos) *</span>
                  <Badge variant="outline" className="text-[10px] text-[#047857]">
                    CRÉDITO
                  </Badge>
                </label>
                <Select
                  value={formData.creditoContaId}
                  onValueChange={(val) => setFormData((p) => ({ ...p, creditoContaId: val }))}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                    <SelectValue placeholder="Selecione a Conta de Crédito..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {contasAnaliticas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.codigo} - {c.nome} ({c.tipo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Valor */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Valor (R$) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.valor}
                  onChange={(e) => setFormData((p) => ({ ...p, valor: e.target.value }))}
                  placeholder="0,00"
                  required
                  className="h-9 text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>

              {/* Status Inicial */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Status do Lançamento
                </label>
                <Select
                  value={formData.status}
                  onValueChange={(val) =>
                    setFormData((p) => ({ ...p, status: val as LancamentoStatus }))
                  }
                  disabled={!canConfirm}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Rascunho (Auxiliar)</SelectItem>
                    {canConfirm && <SelectItem value="confirmado">Confirmado (Oficial)</SelectItem>}
                  </SelectContent>
                </Select>
                {!canConfirm && (
                  <p className="text-[10px] text-[#94A3B8]">
                    Auxiliares salvam em Rascunho para posterior validação do Contador.
                  </p>
                )}
              </div>

              {/* Documento Opcional do GED */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Documento GED Vinculado (Opcional)
                </label>
                <Select
                  value={formData.documentoId}
                  onValueChange={(val) => setFormData((p) => ({ ...p, documentoId: val }))}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                    <SelectValue placeholder="Nenhum documento anexado" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="none">Nenhum documento</SelectItem>
                    {documentos.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nome_arquivo} ({d.tipo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Histórico */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Histórico Contábil *
                </label>
                <Textarea
                  value={formData.historico}
                  onChange={(e) => setFormData((p) => ({ ...p, historico: e.target.value }))}
                  placeholder="Ex: Recebimento de clientes ref. NFSe 1042..."
                  required
                  rows={3}
                  className="text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="rounded-xl text-xs h-9"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-[#0FA3A3] text-xs font-semibold text-white h-9 hover:bg-[#0C8585]"
              >
                {submitting ? 'Salvando...' : 'Gravar Partida Dobrada'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Vincular / Alterar Anexo */}
      <Dialog open={anexoModalOpen} onOpenChange={setAnexoModalOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333] flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-[#0FA3A3]" />
              <span>Vincular Documento GED</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Selecione um documento comprobatório armazenado no GED para anexar a este lançamento.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-[#64748B] space-y-1">
              <p>
                <strong>Lançamento:</strong> {targetLancamento?.historico}
              </p>
              <p>
                <strong>Valor:</strong> R${' '}
                {targetLancamento?.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Documento
              </label>
              <Select value={selectedDocId} onValueChange={setSelectedDocId}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Selecione um documento" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="none">Nenhum (Remover anexo)</SelectItem>
                  {documentos.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nome_arquivo} ({d.tipo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAnexoModalOpen(false)}
              className="rounded-xl text-xs h-9"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveAnexo}
              className="rounded-xl bg-[#0FA3A3] text-xs font-semibold text-white h-9 hover:bg-[#0C8585]"
            >
              Salvar Anexo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

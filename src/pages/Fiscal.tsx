import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Calculator,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  FileCheck,
  Eye,
  Upload,
  Calendar,
  Building2,
  Download,
  Loader2,
  MoreVertical,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { fiscalService } from '@/services/fiscal'
import { empresasService } from '@/services/empresas'
import { useRealtime } from '@/hooks/use-realtime'
import { formatDatePtBr } from '@/lib/formatters'
import type { FiscalRecord, FiscalTipoObrigacao, FiscalStatus, Empresa } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

const OBRIGACOES: Array<{ id: FiscalTipoObrigacao; label: string }> = [
  { id: 'ecf', label: 'ECF (Escrituração Contábil Fiscal)' },
  { id: 'ecd', label: 'ECD (Escrituração Contábil Digital)' },
  { id: 'efd_contribuicoes', label: 'EFD-Contribuições (PIS/COFINS)' },
  { id: 'dctf', label: 'DCTF Mensal' },
  { id: 'gia', label: 'GIA Estadual' },
  { id: 'pis_cofins', label: 'Apuração PIS/COFINS' },
  { id: 'icms', label: 'SPED Fiscal (ICMS/IPI)' },
  { id: 'iss', label: 'Livro Eletrônico ISSQN' },
]

export default function Fiscal() {
  const { user, tenant } = useAuth()
  const { toast } = useToast()

  const [fiscalList, setFiscalList] = useState<FiscalRecord[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'todos' | FiscalStatus>('todos')
  const [tipoFilter, setTipoFilter] = useState<'todos' | FiscalTipoObrigacao>('todos')

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<FiscalRecord | null>(null)
  const [entregarModalOpen, setEntregarModalOpen] = useState(false)
  const [rejeitarModalOpen, setRejeitarModalOpen] = useState(false)

  // Create form
  const [createEmpresaId, setCreateEmpresaId] = useState('')
  const [createTipo, setCreateTipo] = useState<FiscalTipoObrigacao>('dctf')
  const [createMes, setCreateMes] = useState('05')
  const [createAno, setCreateAno] = useState('2025')
  const [createObs, setCreateObs] = useState('')
  const [creating, setCreating] = useState(false)

  // Entregar form
  const [dataEntrega, setDataEntrega] = useState(new Date().toISOString().split('T')[0])
  const [reciboFile, setReciboFile] = useState<File | null>(null)
  const [submittingEntrega, setSubmittingEntrega] = useState(false)

  // Rejeitar form
  const [motivoRejeicao, setMotivoRejeicao] = useState('')
  const [submittingRejeicao, setSubmittingRejeicao] = useState(false)

  const loadData = useCallback(async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      const [fiscRes, empRes] = await Promise.all([
        fiscalService.list(tenant.id),
        empresasService.list(tenant.id),
      ])
      setFiscalList(fiscRes)
      setEmpresas(empRes)
      if (empRes.length > 0 && !createEmpresaId) {
        setCreateEmpresaId(empRes[0].id)
      }
    } catch (err) {
      console.error('Error loading fiscal records:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar módulo fiscal',
      })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, createEmpresaId, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtime('fiscal', () => loadData())

  const filteredRecords = useMemo(() => {
    return fiscalList.filter((item) => {
      const matchSearch =
        search.trim() === '' ||
        (item.expand?.empresa_id?.nome_fantasia &&
          item.expand.empresa_id.nome_fantasia.toLowerCase().includes(search.toLowerCase())) ||
        (item.expand?.empresa_id?.razao_social &&
          item.expand.empresa_id.razao_social.toLowerCase().includes(search.toLowerCase())) ||
        item.tipo_obrigacao.includes(search.toLowerCase()) ||
        item.periodo_apuracao.includes(search)

      const matchStatus = statusFilter === 'todos' || item.status === statusFilter
      const matchTipo = tipoFilter === 'todos' || item.tipo_obrigacao === tipoFilter

      return matchSearch && matchStatus && matchTipo
    })
  }, [fiscalList, search, statusFilter, tipoFilter])

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant?.id || !createEmpresaId) return

    setCreating(true)
    try {
      await fiscalService.create({
        tenant_id: tenant.id,
        empresa_id: createEmpresaId,
        tipo_obrigacao: createTipo,
        periodo_apuracao: `${createMes}/${createAno}`,
        status: 'pendente',
        observacoes: createObs.trim(),
        responsavel_id: user?.id,
      })

      toast({
        title: 'Obrigação cadastrada!',
        description: `Obrigação ${createTipo.toUpperCase()} (${createMes}/${createAno}) criada.`,
      })
      setCreateModalOpen(false)
      setCreateObs('')
      loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar obrigação.'
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar',
        description: msg,
      })
    } finally {
      setCreating(false)
    }
  }

  const handleMarcarEntregue = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRecord) return

    setSubmittingEntrega(true)
    try {
      const formData = new FormData()
      formData.append('status', 'entregue')
      formData.append('data_entrega', `${dataEntrega} 00:00:00`)
      if (reciboFile) {
        formData.append('recibo_arquivo', reciboFile)
      }

      await fiscalService.update(selectedRecord.id, formData)
      toast({
        title: 'Obrigação transmitida!',
        description: 'Status atualizado para entregue e recibo anexado.',
      })
      setEntregarModalOpen(false)
      setSelectedRecord(null)
      setReciboFile(null)
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar entrega',
      })
    } finally {
      setSubmittingEntrega(false)
    }
  }

  const handleRejeitar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRecord || !motivoRejeicao.trim()) return

    setSubmittingRejeicao(true)
    try {
      const obsAtual = selectedRecord.observacoes || ''
      const novaObs = `${obsAtual}\n[REJEIÇÃO]: ${motivoRejeicao}`.trim()

      await fiscalService.update(selectedRecord.id, {
        status: 'rejeitado',
        observacoes: novaObs,
      })
      toast({
        title: 'Obrigação rejeitada',
        description: 'Obrigação marcada para retificação com o motivo gravado.',
      })
      setRejeitarModalOpen(false)
      setSelectedRecord(null)
      setMotivoRejeicao('')
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar rejeição',
      })
    } finally {
      setSubmittingRejeicao(false)
    }
  }

  const getStatusBadge = (status: FiscalStatus) => {
    switch (status) {
      case 'entregue':
      case 'aprovado':
        return <Badge className="bg-[#DCFCE7] text-[#166534] hover:bg-[#DCFCE7]">Entregue</Badge>
      case 'em_andamento':
        return (
          <Badge className="bg-[#DBEAFE] text-[#1E40AF] hover:bg-[#DBEAFE]">Em Andamento</Badge>
        )
      case 'pendente':
        return <Badge className="bg-[#FEF3C7] text-[#92400E] hover:bg-[#FEF3C7]">Pendente</Badge>
      case 'rejeitado':
        return <Badge className="bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FEE2E2]">Rejeitado</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#1A2333]">Controle Fiscal</h2>
          <p className="text-xs text-[#64748B]">
            Gestão, transmissão e arquivo de recibos de obrigações federais, estaduais e municipais
          </p>
        </div>
        <Button
          onClick={() => setCreateModalOpen(true)}
          className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs h-10 shadow-xs"
        >
          <Plus className="h-4 w-4" />
          <span>Nova Obrigação</span>
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por empresa, tipo de obrigação ou período MM/YYYY..."
            className="h-10 pl-9 pr-4 rounded-xl text-xs border-[#E2E8F0]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={tipoFilter}
            onValueChange={(val: 'todos' | FiscalTipoObrigacao) => setTipoFilter(val)}
          >
            <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0] w-48">
              <SelectValue placeholder="Obrigação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as obrigações</SelectItem>
              {OBRIGACOES.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(val: 'todos' | FiscalStatus) => setStatusFilter(val)}
          >
            <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0] w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="em_andamento">Em Andamento</SelectItem>
              <SelectItem value="entregue">Entregue</SelectItem>
              <SelectItem value="rejeitado">Rejeitado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table of Fiscal Records */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  <th className="py-3.5 px-4">Empresa</th>
                  <th className="py-3.5 px-4">Obrigação</th>
                  <th className="py-3.5 px-4">Período de Apuração</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Data de Entrega</th>
                  <th className="py-3.5 px-4">Recibo PDF</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#64748B]">
                      Carregando obrigações fiscais...
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#94A3B8]">
                      Nenhuma obrigação localizada com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((item) => {
                    const reciboUrl = item.recibo_arquivo
                      ? fiscalService.getFileUrl(item, item.recibo_arquivo)
                      : null
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/75 transition-colors cursor-pointer"
                        onClick={() => setSelectedRecord(item)}
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#1A2333]">
                            {item.expand?.empresa_id?.nome_fantasia ||
                              item.expand?.empresa_id?.razao_social ||
                              'Empresa'}
                          </div>
                          <div className="text-[11px] font-mono text-[#64748B]">
                            {item.expand?.empresa_id?.cnpj}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-[11px] font-bold uppercase">
                            {item.tipo_obrigacao.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-[#1A2333]">
                          {item.periodo_apuracao}
                        </td>
                        <td className="py-3 px-4">{getStatusBadge(item.status)}</td>
                        <td className="py-3 px-4 text-[#64748B]">
                          {formatDatePtBr(item.data_entrega)}
                        </td>
                        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                          {reciboUrl ? (
                            <Button
                              asChild
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 text-[11px] rounded-lg text-[#0FA3A3] border-teal-200 hover:bg-teal-50"
                            >
                              <a href={reciboUrl} target="_blank" rel="noreferrer">
                                <FileCheck className="h-3.5 w-3.5" />
                                <span>Ver Recibo</span>
                              </a>
                            </Button>
                          ) : (
                            <span className="text-[11px] text-[#94A3B8]">Sem anexo</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-[#64748B]"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem
                                onClick={() => setSelectedRecord(item)}
                                className="gap-2 text-xs cursor-pointer"
                              >
                                <Eye className="h-3.5 w-3.5 text-[#0FA3A3]" />
                                <span>Ver detalhes</span>
                              </DropdownMenuItem>
                              {item.status !== 'entregue' && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedRecord(item)
                                    setEntregarModalOpen(true)
                                  }}
                                  className="gap-2 text-xs text-emerald-600 focus:text-emerald-700 cursor-pointer"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span>Marcar como Entregue</span>
                                </DropdownMenuItem>
                              )}
                              {item.status !== 'rejeitado' && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedRecord(item)
                                    setRejeitarModalOpen(true)
                                  }}
                                  className="gap-2 text-xs text-red-600 focus:text-red-700 cursor-pointer"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  <span>Rejeitar / Inconsistência</span>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {/* Modal: Nova Obrigação */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base text-[#1A2333]">
              Cadastrar Obrigação Fiscal
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Informe a empresa, tipo e período de apuração
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1A2333]">Empresa *</Label>
              <Select value={createEmpresaId} onValueChange={setCreateEmpresaId}>
                <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome_fantasia || e.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1A2333]">
                Tipo da Obrigação Tributária *
              </Label>
              <Select
                value={createTipo}
                onValueChange={(val: FiscalTipoObrigacao) => setCreateTipo(val)}
              >
                <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OBRIGACOES.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1A2333]">Mês de Apuração</Label>
                <Select value={createMes} onValueChange={setCreateMes}>
                  <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => {
                      const m = String(i + 1).padStart(2, '0')
                      return (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1A2333]">Ano de Apuração</Label>
                <Select value={createAno} onValueChange={setCreateAno}>
                  <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2023">2023</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fiscal_obs" className="text-xs font-semibold text-[#1A2333]">
                Observações
              </Label>
              <Textarea
                id="fiscal_obs"
                rows={2}
                value={createObs}
                onChange={(e) => setCreateObs(e.target.value)}
                placeholder="Observações da apuração, créditos fiscais, retenções..."
                className="text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateModalOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs shadow-xs"
              >
                {creating ? 'Salvando...' : 'Cadastrar Obrigação'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Marcar como Entregue (Upload do Recibo PDF) */}
      <Dialog open={entregarModalOpen} onOpenChange={setEntregarModalOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base text-[#1A2333]">
              Registrar Entrega de Obrigação
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Anexe o recibo de transmissão emitido pela Receita/SEFAZ/Prefeitura
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleMarcarEntregue} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="data_entrega" className="text-xs font-semibold text-[#1A2333]">
                Data da Transmissão *
              </Label>
              <Input
                id="data_entrega"
                type="date"
                required
                value={dataEntrega}
                onChange={(e) => setDataEntrega(e.target.value)}
                className="h-10 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1A2333]">
                Recibo de Entrega (PDF, máx. 25MB)
              </Label>
              <Input
                type="file"
                accept=".pdf"
                onChange={(e) => setReciboFile(e.target.files?.[0] || null)}
                className="text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEntregarModalOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submittingEntrega}
                className="gap-2 rounded-xl bg-[#22C55E] hover:bg-emerald-600 text-white font-semibold text-xs shadow-xs"
              >
                {submittingEntrega ? 'Confirmando...' : 'Confirmar Transmissão'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Rejeitar Obrigação */}
      <Dialog open={rejeitarModalOpen} onOpenChange={setRejeitarModalOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base text-[#1A2333]">
              Rejeitar / Apontar Inconsistência
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Informe o motivo da recusa para orientar a retificação
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRejeitar} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="motivo_rej" className="text-xs font-semibold text-[#1A2333]">
                Motivo da Rejeição *
              </Label>
              <Textarea
                id="motivo_rej"
                required
                rows={3}
                value={motivoRejeicao}
                onChange={(e) => setMotivoRejeicao(e.target.value)}
                placeholder="Ex: Divergência entre faturamento declarado e extrato bancário..."
                className="text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRejeitarModalOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submittingRejeicao || !motivoRejeicao.trim()}
                className="gap-2 rounded-xl bg-[#EF4444] hover:bg-red-600 text-white font-semibold text-xs shadow-xs"
              >
                {submittingRejeicao ? 'Registrando...' : 'Confirmar Rejeição'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Detalhes da Obrigação Fiscal */}
      <Dialog
        open={Boolean(selectedRecord) && !entregarModalOpen && !rejeitarModalOpen}
        onOpenChange={() => setSelectedRecord(null)}
      >
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#3B82F6] uppercase tracking-wider">
                  Controle Fiscal
                </span>
                <DialogTitle className="text-base text-[#1A2333] mt-0.5 uppercase">
                  {selectedRecord?.tipo_obrigacao.replace('_', ' ')}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#64748B]">
                  {selectedRecord?.expand?.empresa_id?.nome_fantasia ||
                    selectedRecord?.expand?.empresa_id?.razao_social}
                </DialogDescription>
              </div>
              {selectedRecord && getStatusBadge(selectedRecord.status)}
            </div>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-3 border border-slate-100">
                <div>
                  <span className="text-[#64748B]">Período de Apuração:</span>
                  <p className="font-semibold text-[#1A2333]">{selectedRecord.periodo_apuracao}</p>
                </div>
                <div>
                  <span className="text-[#64748B]">Data de Entrega:</span>
                  <p className="font-semibold text-[#1A2333]">
                    {formatDatePtBr(selectedRecord.data_entrega)}
                  </p>
                </div>
                <div>
                  <span className="text-[#64748B]">Responsável:</span>
                  <p className="font-semibold text-[#1A2333]">
                    {selectedRecord.expand?.responsavel_id?.name || 'Contador Responsável'}
                  </p>
                </div>
                <div>
                  <span className="text-[#64748B]">Data de Cadastro:</span>
                  <p className="font-semibold text-[#1A2333]">
                    {formatDatePtBr(selectedRecord.created)}
                  </p>
                </div>
              </div>

              {selectedRecord.observacoes && (
                <div className="rounded-xl border border-slate-100 p-3 bg-white space-y-1">
                  <span className="font-bold text-[#64748B]">Anotações da Apuração:</span>
                  <p className="text-[#1A2333] whitespace-pre-line">{selectedRecord.observacoes}</p>
                </div>
              )}

              {selectedRecord.recibo_arquivo && (
                <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-5 w-5 text-[#0FA3A3]" />
                    <div>
                      <p className="font-semibold text-[#1A2333]">Recibo Oficial Anexado</p>
                      <p className="text-[11px] text-[#64748B]">Comprovante de transmissão</p>
                    </div>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    className="h-8 gap-1.5 rounded-lg bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs"
                  >
                    <a
                      href={fiscalService.getFileUrl(selectedRecord, selectedRecord.recibo_arquivo)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Baixar Recibo</span>
                    </a>
                  </Button>
                </div>
              )}

              {/* Action buttons inside detail */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                {selectedRecord.status !== 'entregue' && (
                  <Button
                    size="sm"
                    onClick={() => setEntregarModalOpen(true)}
                    className="h-8 gap-1 rounded-lg bg-[#22C55E] hover:bg-emerald-600 text-white text-xs"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Marcar Entregue</span>
                  </Button>
                )}
                {selectedRecord.status !== 'rejeitado' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRejeitarModalOpen(true)}
                    className="h-8 gap-1 rounded-lg text-red-600 hover:bg-red-50 text-xs"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Rejeitar</span>
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

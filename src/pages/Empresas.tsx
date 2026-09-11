import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  Plus,
  Search,
  MoreVertical,
  Eye,
  Edit,
  Power,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { empresasService } from '@/services/empresas'
import { maskCnpj } from '@/lib/formatters'
import type { Empresa, EmpresaStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export default function Empresas() {
  const { tenant } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'todos' | EmpresaStatus>('todos')
  const [page, setPage] = useState(1)
  const perPage = 12

  // Close/deactivate confirmation modal
  const [empresaToClose, setEmpresaToClose] = useState<Empresa | null>(null)
  const [closing, setClosing] = useState(false)

  const loadEmpresas = useCallback(async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      const res = await empresasService.list(tenant.id)
      setEmpresas(res)
    } catch (err) {
      console.error('Error loading empresas:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar empresas',
        description: 'Não foi possível listar as empresas do escritório.',
      })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, toast])

  useEffect(() => {
    loadEmpresas()
  }, [loadEmpresas])

  const filteredEmpresas = useMemo(() => {
    return empresas.filter((emp) => {
      const matchSearch =
        search.trim() === '' ||
        emp.razao_social.toLowerCase().includes(search.toLowerCase()) ||
        (emp.nome_fantasia && emp.nome_fantasia.toLowerCase().includes(search.toLowerCase())) ||
        emp.cnpj.includes(search)

      const matchStatus = statusFilter === 'todos' || emp.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [empresas, search, statusFilter])

  const totalPages = Math.ceil(filteredEmpresas.length / perPage) || 1
  const paginatedEmpresas = useMemo(() => {
    const start = (page - 1) * perPage
    return filteredEmpresas.slice(start, start + perPage)
  }, [filteredEmpresas, page, perPage])

  const handleEncerrar = async () => {
    if (!empresaToClose) return
    setClosing(true)
    try {
      await empresasService.update(empresaToClose.id, { status: 'encerrado' })
      toast({
        title: 'Empresa encerrada',
        description: `A empresa ${empresaToClose.nome_fantasia || empresaToClose.razao_social} foi alterada para status Encerrado.`,
      })
      setEmpresaToClose(null)
      loadEmpresas()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao encerrar empresa',
        description: 'Não foi possível alterar o status.',
      })
    } finally {
      setClosing(false)
    }
  }

  const getStatusBadge = (status: EmpresaStatus) => {
    switch (status) {
      case 'ativo':
        return <Badge className="bg-[#DCFCE7] text-[#166534] hover:bg-[#DCFCE7]">Ativo</Badge>
      case 'inativo':
        return <Badge className="bg-[#E2E8F0] text-[#475569] hover:bg-[#E2E8F0]">Inativo</Badge>
      case 'pendente':
        return <Badge className="bg-[#FEF3C7] text-[#92400E] hover:bg-[#FEF3C7]">Pendente</Badge>
      case 'encerrado':
        return <Badge className="bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FEE2E2]">Encerrado</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getRegimeBadge = (regime?: string) => {
    if (!regime) return <span className="text-xs text-[#94A3B8]">Não definido</span>
    const labels: Record<string, string> = {
      simples_nacional: 'Simples Nacional',
      lucro_presumido: 'Lucro Presumido',
      lucro_real: 'Lucro Real',
      mei: 'MEI',
    }
    return (
      <Badge variant="outline" className="border-teal-200 bg-teal-50/50 text-[#0FA3A3] text-[11px]">
        {labels[regime] || regime}
      </Badge>
    )
  }

  const filterChips: Array<{ id: 'todos' | EmpresaStatus; label: string }> = [
    { id: 'todos', label: 'Todos' },
    { id: 'ativo', label: 'Ativo' },
    { id: 'inativo', label: 'Inativo' },
    { id: 'pendente', label: 'Pendente' },
    { id: 'encerrado', label: 'Encerrado' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#1A2333]">Cadastro de Empresas</h2>
          <p className="text-xs text-[#64748B]">
            Gerenciamento de pessoas jurídicas atendidas pelo escritório
          </p>
        </div>
        <Button
          onClick={() => navigate('/empresas/nova')}
          className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs h-10 shadow-xs"
        >
          <Plus className="h-4 w-4" />
          <span>Nova Empresa</span>
        </Button>
      </div>

      {/* Filters Bar: Search & Status Chips */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Buscar por razão social, nome fantasia ou CNPJ..."
            className="h-10 pl-9 pr-4 rounded-xl text-xs border-[#E2E8F0]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-[#94A3B8] mr-1 hidden sm:block" />
          {filterChips.map((chip) => (
            <button
              key={chip.id}
              onClick={() => {
                setStatusFilter(chip.id)
                setPage(1)
              }}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold transition-all',
                statusFilter === chip.id
                  ? 'bg-[#0B1F3A] text-white shadow-xs'
                  : 'bg-slate-100 text-[#64748B] hover:bg-slate-200',
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Empresas Table / Grid */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  <th className="py-3.5 px-4">Empresa</th>
                  <th className="py-3.5 px-4">CNPJ</th>
                  <th className="py-3.5 px-4">Regime Tributário</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[#64748B]">
                      Carregando cadastro de empresas...
                    </td>
                  </tr>
                ) : paginatedEmpresas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[#94A3B8]">
                      Nenhuma empresa encontrada com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  paginatedEmpresas.map((emp) => {
                    const initials = (emp.nome_fantasia || emp.razao_social)
                      .slice(0, 2)
                      .toUpperCase()
                    return (
                      <tr
                        key={emp.id}
                        onClick={() => navigate(`/empresas/${emp.id}`)}
                        className="hover:bg-slate-50/75 transition-colors cursor-pointer group"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-slate-200 to-slate-100 font-bold text-[#0B1F3A] text-xs">
                              {initials}
                            </div>
                            <div className="truncate max-w-xs sm:max-w-md">
                              <p className="font-semibold text-[#1A2333] group-hover:text-[#0FA3A3] transition-colors truncate">
                                {emp.nome_fantasia || emp.razao_social}
                              </p>
                              {emp.nome_fantasia && (
                                <p className="text-[11px] text-[#64748B] truncate">
                                  {emp.razao_social}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[#64748B]">{maskCnpj(emp.cnpj)}</td>
                        <td className="py-3 px-4">{getRegimeBadge(emp.regime_tributario)}</td>
                        <td className="py-3 px-4">{getStatusBadge(emp.status)}</td>
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-[#64748B] hover:bg-slate-200"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem
                                onClick={() => navigate(`/empresas/${emp.id}`)}
                                className="gap-2 text-xs cursor-pointer"
                              >
                                <Eye className="h-3.5 w-3.5 text-[#0FA3A3]" />
                                <span>Ver detalhes</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => navigate(`/empresas/${emp.id}/editar`)}
                                className="gap-2 text-xs cursor-pointer"
                              >
                                <Edit className="h-3.5 w-3.5 text-[#3B82F6]" />
                                <span>Editar</span>
                              </DropdownMenuItem>
                              {emp.status !== 'encerrado' && (
                                <DropdownMenuItem
                                  onClick={() => setEmpresaToClose(emp)}
                                  className="gap-2 text-xs text-[#EF4444] focus:text-[#EF4444] cursor-pointer"
                                >
                                  <Power className="h-3.5 w-3.5" />
                                  <span>Encerrar empresa</span>
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

          {/* Pagination (12 per page) */}
          <div className="flex items-center justify-between border-t border-[#E2E8F0] px-4 py-3 text-xs text-[#64748B]">
            <span>
              Mostrando {filteredEmpresas.length === 0 ? 0 : (page - 1) * perPage + 1} a{' '}
              {Math.min(page * perPage, filteredEmpresas.length)} de {filteredEmpresas.length}{' '}
              empresas
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 font-medium">
                Pág. {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Modal to Encerrar */}
      <Dialog open={Boolean(empresaToClose)} onOpenChange={() => setEmpresaToClose(null)}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base text-[#1A2333]">
              Confirmar Encerramento de Empresa
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Deseja marcar a empresa{' '}
              <strong className="text-[#1A2333]">
                {empresaToClose?.nome_fantasia || empresaToClose?.razao_social}
              </strong>{' '}
              (CNPJ: {empresaToClose && maskCnpj(empresaToClose.cnpj)}) como Encerrada? Suas rotinas
              fiscais e documentos históricos continuarão preservados para auditoria.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setEmpresaToClose(null)}
              className="text-xs rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={closing}
              onClick={handleEncerrar}
              className="text-xs rounded-xl"
            >
              {closing ? 'Encerrando...' : 'Confirmar Encerramento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

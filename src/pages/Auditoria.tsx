import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ShieldCheck,
  Search,
  Filter,
  Download,
  Calendar,
  Clock,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { auditService } from '@/services/audit'
import { formatDateTimePtBr } from '@/lib/formatters'
import type { AuditLogRecord } from '@/types'
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
import { useToast } from '@/hooks/use-toast'

export default function Auditoria() {
  const { tenant } = useAuth()
  const { toast } = useToast()

  const [logs, setLogs] = useState<AuditLogRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [entidadeFilter, setEntidadeFilter] = useState<string>('todos')
  const [page, setPage] = useState(1)
  const perPage = 20

  const loadLogs = useCallback(async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      const res = await auditService.list(tenant.id)
      setLogs(res)
    } catch (err) {
      console.error('Error loading audit log:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar auditoria',
      })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, toast])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchSearch =
        search.trim() === '' ||
        log.acao.toLowerCase().includes(search.toLowerCase()) ||
        (log.detalhes && log.detalhes.toLowerCase().includes(search.toLowerCase())) ||
        (log.expand?.usuario_id?.name &&
          log.expand.usuario_id.name.toLowerCase().includes(search.toLowerCase())) ||
        log.entidade_id.includes(search)

      const matchEntidade = entidadeFilter === 'todos' || log.entidade_tipo === entidadeFilter

      return matchSearch && matchEntidade
    })
  }, [logs, search, entidadeFilter])

  const totalPages = Math.ceil(filteredLogs.length / perPage) || 1
  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * perPage
    return filteredLogs.slice(start, start + perPage)
  }, [filteredLogs, page, perPage])

  // Client-side CSV export
  const handleExportCsv = () => {
    if (filteredLogs.length === 0) {
      toast({
        title: 'Nenhum registro para exportar',
      })
      return
    }

    const headers = ['Data/Hora', 'Usuario', 'Acao', 'Entidade Tipo', 'Entidade ID', 'Detalhes']
    const rows = filteredLogs.map((log) => [
      formatDateTimePtBr(log.created),
      `"${log.expand?.usuario_id?.name || 'Sistema'}"`,
      `"${log.acao}"`,
      log.entidade_tipo,
      log.entidade_id,
      `"${(log.detalhes || '').replace(/"/g, '""')}"`,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `auditoria_rumo_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Exportação concluída!',
      description: `${filteredLogs.length} registros exportados para CSV.`,
    })
  }

  const getEntidadeBadge = (entidade: string) => {
    switch (entidade) {
      case 'empresas':
        return <Badge className="bg-teal-50 text-[#0FA3A3] border-teal-200">Empresas</Badge>
      case 'documentos':
        return <Badge className="bg-blue-50 text-[#3B82F6] border-blue-200">Documentos GED</Badge>
      case 'workflows':
        return <Badge className="bg-amber-50 text-[#F59E0B] border-amber-200">Workflows</Badge>
      case 'fiscal':
        return <Badge className="bg-purple-50 text-purple-600 border-purple-200">Fiscal</Badge>
      case 'tenant_members':
        return <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200">Usuários</Badge>
      default:
        return <Badge variant="outline">{entidade}</Badge>
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#1A2333]">Trilha de Auditoria</h2>
          <p className="text-xs text-[#64748B]">
            Registro imutável de todas as ações de criação, alteração e exclusão no escritório
          </p>
        </div>
        <Button
          onClick={handleExportCsv}
          variant="outline"
          className="gap-2 rounded-xl text-xs font-semibold h-10 border-[#E2E8F0] bg-white shadow-xs hover:bg-slate-50"
        >
          <Download className="h-4 w-4 text-[#0FA3A3]" />
          <span>Exportar CSV</span>
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Buscar por ação, usuário ou detalhes..."
            className="h-10 pl-9 pr-4 rounded-xl text-xs border-[#E2E8F0]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={entidadeFilter}
            onValueChange={(val) => {
              setEntidadeFilter(val)
              setPage(1)
            }}
          >
            <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0] w-48">
              <SelectValue placeholder="Tipo de Entidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as entidades</SelectItem>
              <SelectItem value="empresas">Empresas</SelectItem>
              <SelectItem value="documentos">Documentos GED</SelectItem>
              <SelectItem value="workflows">Workflows</SelectItem>
              <SelectItem value="fiscal">Fiscal</SelectItem>
              <SelectItem value="tenant_members">Membros / Usuários</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Audit Logs Table */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  <th className="py-3.5 px-4">Data / Hora</th>
                  <th className="py-3.5 px-4">Usuário / Ator</th>
                  <th className="py-3.5 px-4">Ação Realizada</th>
                  <th className="py-3.5 px-4">Entidade</th>
                  <th className="py-3.5 px-4">Detalhes da Transação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[#64748B]">
                      Carregando trilha de auditoria...
                    </td>
                  </tr>
                ) : paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[#94A3B8]">
                      Nenhum registro de auditoria encontrado.
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3 px-4 font-mono text-[#64748B] whitespace-nowrap">
                        {formatDateTimePtBr(log.created)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#1A2333]">
                          {log.expand?.usuario_id?.name || 'Sistema / API'}
                        </div>
                        {log.expand?.usuario_id?.email && (
                          <div className="text-[11px] text-[#94A3B8]">
                            {log.expand.usuario_id.email}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-[#1A2333]">{log.acao}</td>
                      <td className="py-3 px-4">{getEntidadeBadge(log.entidade_tipo)}</td>
                      <td className="py-3 px-4 text-[#64748B] max-w-md">
                        {log.detalhes || 'Sem detalhes adicionais'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-[#E2E8F0] px-4 py-3 text-xs text-[#64748B]">
            <span>
              Mostrando {filteredLogs.length === 0 ? 0 : (page - 1) * perPage + 1} a{' '}
              {Math.min(page * perPage, filteredLogs.length)} de {filteredLogs.length} eventos
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
    </div>
  )
}

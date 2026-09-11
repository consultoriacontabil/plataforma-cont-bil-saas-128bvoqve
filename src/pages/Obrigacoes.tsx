import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Calendar as CalendarIcon,
  List,
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Building2,
  User as UserIcon,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  Edit,
  ExternalLink,
  DollarSign,
  FileCheck,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { obrigacoesService } from '@/services/obrigacoes'
import { empresasService } from '@/services/empresas'
import { usersService } from '@/services/users'
import { certificadosService, type CertificadoSaudeInfo } from '@/services/certificados'
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  KeyRound,
  ShieldQuestion,
  FileWarning,
} from 'lucide-react'
import type {
  ObrigacaoRecord,
  Empresa,
  TenantMember,
  ObrigacaoTipo,
  ObrigacaoStatus,
  CertificadoDigitalRecord,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { cn } from '@/lib/utils'
import { fechoContabilService } from '@/services/fechoContabil'
import { Sparkles, FileSpreadsheet } from 'lucide-react'

const TIPOS_OBRIGACOES: ObrigacaoTipo[] = [
  'DAS',
  'SPED',
  'GFIP',
  'DIRF',
  'EFD',
  'DARF',
  'FGTS',
  'INSS',
  'DCTF',
  'DMED',
  'GIA',
  'OUTROS',
]

export default function Obrigacoes() {
  const { tenant, member } = useAuth()
  const { toast } = useToast()

  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [obrigacoes, setObrigacoes] = useState<ObrigacaoRecord[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [members, setMembers] = useState<TenantMember[]>([])
  const [certificadosMap, setCertificadosMap] = useState<Record<string, CertificadoDigitalRecord>>(
    {},
  )
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [filterEmpresa, setFilterEmpresa] = useState<string>('todas')
  const [filterExigeCertificado, setFilterExigeCertificado] = useState<string>('todos')
  const [filterTipo, setFilterTipo] = useState<string>('todos')
  const [filterStatus, setFilterStatus] = useState<string>('todos')
  const [generatingFecho, setGeneratingFecho] = useState(false)
  const [regularidadeModalOpen, setRegularidadeModalOpen] = useState(false)
  const [empresaRegularidadeId, setEmpresaRegularidadeId] = useState<string>('')

  // Calendar State
  const [currentDate, setCurrentDate] = useState<Date>(new Date())

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingObrigacao, setEditingObrigacao] = useState<ObrigacaoRecord | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form Fields
  const [formEmpresaId, setFormEmpresaId] = useState('')
  const [formTipo, setFormTipo] = useState<ObrigacaoTipo>('DAS')
  const [formCompetencia, setFormCompetencia] = useState('')
  const [formVencimento, setFormVencimento] = useState('')
  const [formStatus, setFormStatus] = useState<ObrigacaoStatus>('pendente')
  const [formResponsavelId, setFormResponsavelId] = useState('')
  const [formValor, setFormValor] = useState('')
  const [formObservacoes, setFormObservacoes] = useState('')
  const [formAnexoFile, setFormAnexoFile] = useState<File | null>(null)
  const [formExigeCertificado, setFormExigeCertificado] = useState(false)

  const canEdit = member?.perfil === 'administrador' || member?.perfil === 'contador'

  const loadData = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const [obs, emps, mems, certs] = await Promise.all([
        obrigacoesService.list(tenant.id),
        empresasService.list(tenant.id),
        usersService.listMembers(tenant.id),
        certificadosService.list(tenant.id),
      ])
      setObrigacoes(obs)
      setEmpresas(emps)
      setMembers(mems)

      const certMap: Record<string, CertificadoDigitalRecord> = {}
      certs.forEach((c) => {
        if (c.empresa && !certMap[c.empresa]) {
          certMap[c.empresa] = c
        }
      })
      setCertificadosMap(certMap)
    } catch (err) {
      console.error('Erro ao carregar obrigações:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível buscar as obrigações fiscais.',
      })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingObrigacao(null)
    const defaultEmpresa = empresas[0]?.id || ''
    setFormEmpresaId(defaultEmpresa)
    setFormTipo('DAS')
    const now = new Date()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    setFormCompetencia(`${m}/${now.getFullYear()}`)
    const nextWeek = new Date(Date.now() + 7 * 86400000)
    setFormVencimento(nextWeek.toISOString().slice(0, 10))
    setFormStatus('pendente')
    setFormResponsavelId(members[0]?.expand?.user_id?.id || members[0]?.user_id || '')
    setFormValor('')
    setFormObservacoes('')
    setFormAnexoFile(null)
    setFormExigeCertificado(false)
    setIsModalOpen(true)
  }

  // Open Edit Modal
  const handleOpenEdit = (ob: ObrigacaoRecord) => {
    setEditingObrigacao(ob)
    setFormEmpresaId(ob.empresa_id)
    setFormTipo(ob.tipo)
    setFormCompetencia(ob.competencia)
    setFormVencimento(ob.vencimento ? ob.vencimento.slice(0, 10) : '')
    setFormStatus(ob.status)
    setFormResponsavelId(ob.responsavel_id || '')
    setFormValor(ob.valor !== undefined && ob.valor !== null ? String(ob.valor) : '')
    setFormObservacoes(ob.observacoes || '')
    setFormAnexoFile(null)
    setFormExigeCertificado(Boolean(ob.exige_certificado))
    setIsModalOpen(true)
  }

  // Save Obrigação
  const handleSaveObrigacao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant?.id) return

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('tenant_id', tenant.id)
      formData.append('empresa_id', formEmpresaId)
      formData.append('tipo', formTipo)
      formData.append('competencia', formCompetencia.trim())
      formData.append('vencimento', new Date(`${formVencimento}T12:00:00Z`).toISOString())
      formData.append('status', formStatus)
      if (formResponsavelId) formData.append('responsavel_id', formResponsavelId)
      if (formValor) formData.append('valor', String(parseFloat(formValor) || 0))
      if (formObservacoes) formData.append('observacoes', formObservacoes.trim())
      if (formAnexoFile) formData.append('anexo', formAnexoFile)
      formData.append('exige_certificado', formExigeCertificado ? 'true' : 'false')

      if (formStatus === 'entregue' && (!editingObrigacao || !editingObrigacao.data_entrega)) {
        formData.append('data_entrega', new Date().toISOString())
      }

      if (editingObrigacao) {
        await obrigacoesService.update(editingObrigacao.id, formData)
        toast({
          title: 'Obrigação atualizada',
          description: `${formTipo} salva com sucesso.`,
        })
      } else {
        await obrigacoesService.create(formData)
        toast({
          title: 'Obrigação cadastrada',
          description: `${formTipo} inserida no calendário com sucesso.`,
        })
      }

      setIsModalOpen(false)
      loadData()
    } catch (err: unknown) {
      console.error('Erro ao salvar obrigação:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Verifique se todos os campos obrigatórios estão preenchidos.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleMarcarEntregue = async (ob: ObrigacaoRecord) => {
    try {
      await obrigacoesService.marcarComoEntregue(ob.id)
      toast({
        title: 'Obrigação concluída!',
        description: `${ob.tipo} marcada como entregue.`,
      })
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: 'Não foi possível marcar como entregue.',
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Deseja realmente excluir esta obrigação?')) return
    try {
      await obrigacoesService.delete(id)
      toast({
        title: 'Obrigação removida',
        description: 'O registro foi excluído.',
      })
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: 'Falha ao remover obrigação.',
      })
    }
  }

  // Filtered Obrigacoes
  const filteredObrigacoes = useMemo(() => {
    return obrigacoes.filter((ob) => {
      if (filterEmpresa !== 'todas' && ob.empresa_id !== filterEmpresa) return false
      if (filterExigeCertificado === 'sim' && !ob.exige_certificado) return false
      if (filterExigeCertificado === 'nao' && ob.exige_certificado) return false
      if (filterTipo !== 'todos' && ob.tipo !== filterTipo) return false
      if (filterStatus !== 'todos' && ob.status !== filterStatus) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const empName = (
          ob.expand?.empresa_id?.nome_fantasia ||
          ob.expand?.empresa_id?.razao_social ||
          ''
        ).toLowerCase()
        const matchTipo = ob.tipo.toLowerCase().includes(q)
        const matchComp = ob.competencia.toLowerCase().includes(q)
        const matchObs = (ob.observacoes || '').toLowerCase().includes(q)
        if (!empName.includes(q) && !matchTipo && !matchComp && !matchObs) return false
      }
      return true
    })
  }, [obrigacoes, filterEmpresa, filterExigeCertificado, filterTipo, filterStatus, search])

  // Overview metrics
  const stats = useMemo(() => {
    const now = new Date()
    let atrasadas = 0
    let proximas = 0 // <= 7 days
    let entregues = 0
    let pendentes = 0

    obrigacoes.forEach((ob) => {
      if (ob.status === 'entregue') {
        entregues++
        return
      }
      if (ob.status === 'cancelada') return

      const venc = new Date(ob.vencimento)
      const diffDays = Math.ceil((venc.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      if (diffDays < 0 || ob.status === 'atrasada') {
        atrasadas++
      } else if (diffDays <= 7) {
        proximas++
        pendentes++
      } else {
        pendentes++
      }
    })

    // Calcular empresas com pendências de regularidade (certificado expirado ou expirando + obrigações que exigem certificado)
    let empresasComAlertaRegularidade = 0
    empresas.forEach((emp) => {
      const cert = certificadosMap[emp.id]
      const saude = certificadosService.calcularSaude(cert)
      const temObrigacoesExigentes = obrigacoes.some(
        (o) =>
          o.empresa_id === emp.id &&
          o.exige_certificado &&
          o.status !== 'entregue' &&
          o.status !== 'cancelada',
      )
      if (
        (saude.saude === 'expirado' ||
          saude.saude === 'inexistente' ||
          saude.saude === 'proximo_vencimento') &&
        temObrigacoesExigentes
      ) {
        empresasComAlertaRegularidade++
      }
    })

    return { atrasadas, proximas, entregues, pendentes, empresasComAlertaRegularidade }
  }, [obrigacoes, empresas, certificadosMap])

  // Calendar Logic (Month navigation)
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth()

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0)
  const startDayOfWeek = firstDayOfMonth.getDay() // 0 = Sunday
  const daysInMonth = lastDayOfMonth.getDate()

  const prevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const monthNames = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ]

  // Map calendar days
  const calendarCells = useMemo(() => {
    const cells: { day: number; dateStr: string; isCurrentMonth: boolean }[] = []

    // Previous month padding
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate()
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i
      const prevM = currentMonth === 0 ? 12 : currentMonth
      const prevY = currentMonth === 0 ? currentYear - 1 : currentYear
      cells.push({
        day: d,
        dateStr: `${prevY}-${String(prevM).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        isCurrentMonth: false,
      })
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const curM = currentMonth + 1
      cells.push({
        day: i,
        dateStr: `${currentYear}-${String(curM).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
        isCurrentMonth: true,
      })
    }

    // Next month padding to fill grid 35 or 42
    const totalCells = cells.length > 35 ? 42 : 35
    const remaining = totalCells - cells.length
    for (let i = 1; i <= remaining; i++) {
      const nextM = currentMonth === 11 ? 1 : currentMonth + 2
      const nextY = currentMonth === 11 ? currentYear + 1 : currentYear
      cells.push({
        day: i,
        dateStr: `${nextY}-${String(nextM).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
        isCurrentMonth: false,
      })
    }

    return cells
  }, [currentYear, currentMonth, startDayOfWeek, daysInMonth])

  // Get status color styling
  const getStatusBadge = (status: ObrigacaoStatus, vencimento?: string) => {
    const now = new Date()
    const venc = vencimento ? new Date(vencimento) : null
    const diffDays = venc ? Math.ceil((venc.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0

    if (status === 'entregue') {
      return (
        <Badge className="bg-[#DCFCE7] text-[#16A34A] border-emerald-200 text-[10px] font-semibold">
          Entregue
        </Badge>
      )
    }
    if (status === 'atrasada' || (diffDays < 0 && status !== 'cancelada')) {
      return (
        <Badge className="bg-[#FEE2E2] text-[#DC2626] border-red-200 text-[10px] font-bold animate-pulse">
          Atrasada
        </Badge>
      )
    }
    if (diffDays <= 7 && status !== 'cancelada') {
      return (
        <Badge className="bg-[#FEF3C7] text-[#D97706] border-amber-200 text-[10px] font-semibold">
          Próxima ({diffDays}d)
        </Badge>
      )
    }
    if (status === 'em_andamento') {
      return (
        <Badge className="bg-[#EFF6FF] text-[#2563EB] border-blue-200 text-[10px] font-semibold">
          Em Andamento
        </Badge>
      )
    }
    if (status === 'cancelada') {
      return (
        <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-[10px]">
          Cancelada
        </Badge>
      )
    }
    return (
      <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">Pendente</Badge>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#1A2333]">
            Módulo de Obrigações Fiscais
          </h2>
          <p className="text-xs text-[#64748B]">
            Calendário de vencimentos contábeis e fiscais com validação de Certificado Digital
            (e-CNPJ) e lembretes diários
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Botão de Painel de Regularidade */}
          <Button
            variant="outline"
            onClick={() => {
              setEmpresaRegularidadeId(
                filterEmpresa !== 'todas' ? filterEmpresa : empresas[0]?.id || '',
              )
              setRegularidadeModalOpen(true)
            }}
            className="gap-1.5 rounded-xl border-amber-300 bg-amber-50/70 text-amber-900 hover:bg-amber-100 text-xs font-semibold h-9 shadow-2xs"
          >
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            <span>Regularidade Fiscal ({stats.empresasComAlertaRegularidade})</span>
          </Button>

          {/* View Mode Toggle */}
          <div className="inline-flex rounded-xl border border-[#E2E8F0] bg-white p-1 shadow-2xs">
            <button
              onClick={() => setViewMode('calendar')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                viewMode === 'calendar'
                  ? 'bg-[#0B1F3A] text-white shadow-2xs'
                  : 'text-[#64748B] hover:text-[#1A2333]',
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              <span>Calendário</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                viewMode === 'list'
                  ? 'bg-[#0B1F3A] text-white shadow-2xs'
                  : 'text-[#64748B] hover:text-[#1A2333]',
              )}
            >
              <List className="h-3.5 w-3.5" />
              <span>Lista ({filteredObrigacoes.length})</span>
            </button>
          </div>

          {canEdit && (
            <div className="flex items-center gap-2">
              <Button
                onClick={async () => {
                  if (!tenant?.id) return
                  setGeneratingFecho(true)
                  try {
                    const res = await fechoContabilService.processarFechoLote(
                      tenant.id,
                      'todas',
                      filterEmpresa !== 'todas' ? filterEmpresa : undefined,
                    )
                    if (res.lancamentosGerados === 0 && res.pendentesMapeamento.length === 0) {
                      toast({
                        title: 'Fecho Contábil',
                        description: 'Nenhuma nova obrigação entregue/paga pendente de lançamento.',
                      })
                    } else if (res.lancamentosGerados > 0) {
                      toast({
                        title: 'Fecho Automático Concluído!',
                        description: `${res.lancamentosGerados} lançamentos gerados (${res.processados} guias quitadas) somando R$ ${res.valorTotal.toFixed(2)}.`,
                      })
                    }
                    if (res.pendentesMapeamento.length > 0) {
                      toast({
                        variant: 'destructive',
                        title: 'Obrigações sem Mapeamento',
                        description: `Atenção: faltam regras no Mapeamento Contábil para: ${res.pendentesMapeamento.join(', ')}. Configure no menu Contábil > Mapeamento.`,
                      })
                    }
                  } catch (err) {
                    console.error('Erro ao gerar fecho contábil:', err)
                    toast({
                      variant: 'destructive',
                      title: 'Erro no fecho automático',
                      description: 'Não foi possível processar os lançamentos contábeis.',
                    })
                  } finally {
                    setGeneratingFecho(false)
                  }
                }}
                disabled={generatingFecho}
                variant="outline"
                className="gap-2 rounded-xl border-[#0FA3A3] text-[#0FA3A3] hover:bg-[#0FA3A3]/10 text-xs font-semibold h-9 shadow-xs"
              >
                <Sparkles className="h-4 w-4" />
                <span>{generatingFecho ? 'Gerando Lançamentos...' : 'Gerar Fecho Contábil'}</span>
              </Button>

              <Button
                onClick={handleOpenCreate}
                className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs font-semibold h-9 shadow-xs"
              >
                <Plus className="h-4 w-4" />
                <span>Nova Obrigação</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
        <Card className="rounded-2xl border-amber-200 bg-amber-50/40 shadow-2xs hover:shadow-xs transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
                Alerta Regularidade
              </p>
              <p className="text-2xl font-bold text-amber-900 mt-0.5">
                {stats.empresasComAlertaRegularidade} emp.
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs hover:shadow-xs transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                Atrasadas
              </p>
              <p className="text-2xl font-bold text-[#DC2626] mt-0.5">{stats.atrasadas}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-[#DC2626]">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs hover:shadow-xs transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                Próximas (≤ 7 dias)
              </p>
              <p className="text-2xl font-bold text-[#D97706] mt-0.5">{stats.proximas}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-[#D97706]">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs hover:shadow-xs transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                Pendentes no Total
              </p>
              <p className="text-2xl font-bold text-[#0B1F3A] mt-0.5">{stats.pendentes}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-[#0B1F3A]">
              <CalendarIcon className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs hover:shadow-xs transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                Entregues
              </p>
              <p className="text-2xl font-bold text-[#16A34A] mt-0.5">{stats.entregues}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#16A34A]">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {/* Search query */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" />
              <Input
                placeholder="Buscar empresa, tipo, observação..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-9 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            {/* Filter Empresa */}
            <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
              <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                <SelectValue placeholder="Todas as Empresas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Empresas</SelectItem>
                {empresas.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.nome_fantasia || emp.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filter Tipo */}
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                <SelectValue placeholder="Todos os Tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Tipos</SelectItem>
                {TIPOS_OBRIGACOES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filter Status */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                <SelectValue placeholder="Todos os Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="entregue">Entregue</SelectItem>
                <SelectItem value="atrasada">Atrasada</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>

            {/* Filter Exige Certificado */}
            <Select value={filterExigeCertificado} onValueChange={setFilterExigeCertificado}>
              <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                <SelectValue placeholder="Exigência de Certificado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos (Com e Sem Certificado)</SelectItem>
                <SelectItem value="sim">Exige Certificado Digital</SelectItem>
                <SelectItem value="nao">Não exige Certificado</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear filters */}
            {(search ||
              filterEmpresa !== 'todas' ||
              filterTipo !== 'todos' ||
              filterExigeCertificado !== 'todos' ||
              filterStatus !== 'todos') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setFilterEmpresa('todas')
                  setFilterTipo('todos')
                  setFilterExigeCertificado('todos')
                  setFilterStatus('todos')
                }}
                className="h-9 text-xs text-[#DC2626] hover:bg-red-50 hover:text-[#DC2626]"
              >
                Limpar Filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Content: Calendar vs List */}
      {viewMode === 'calendar' ? (
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs overflow-hidden">
          {/* Calendar Header */}
          <div className="flex flex-col sm:flex-row items-center justify-between border-b border-[#E2E8F0] p-4 bg-white gap-3">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-bold text-[#1A2333]">
                {monthNames[currentMonth]} de {currentYear}
              </h3>
              <Badge variant="outline" className="text-xs text-[#0FA3A3] border-[#0FA3A3]">
                Mês Ativo
              </Badge>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={prevMonth}
                className="h-8 w-8 p-0 rounded-lg border-[#E2E8F0]"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToToday}
                className="h-8 px-3 text-xs rounded-lg border-[#E2E8F0] font-semibold"
              >
                Hoje
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={nextMonth}
                className="h-8 w-8 p-0 rounded-lg border-[#E2E8F0]"
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Weekdays header */}
          <div className="grid grid-cols-7 border-b border-[#E2E8F0] bg-slate-50 text-center text-[11px] font-bold text-[#64748B] py-2">
            <span>DOM</span>
            <span>SEG</span>
            <span>TER</span>
            <span>QUA</span>
            <span>QUI</span>
            <span>SEX</span>
            <span>SÁB</span>
          </div>

          {/* Month Grid */}
          <div className="grid grid-cols-7 bg-[#E2E8F0] gap-px">
            {calendarCells.map((cell, idx) => {
              // Find matching obligations for this calendar day
              const dayObs = filteredObrigacoes.filter((o) => {
                if (!o.vencimento) return false
                return o.vencimento.slice(0, 10) === cell.dateStr
              })

              const isToday = new Date().toISOString().slice(0, 10) === cell.dateStr

              return (
                <div
                  key={idx}
                  className={cn(
                    'min-h-[110px] sm:min-h-[125px] p-1.5 flex flex-col bg-white transition-colors',
                    !cell.isCurrentMonth && 'bg-slate-50/60 text-[#94A3B8]',
                    isToday && 'bg-sky-50/40',
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        'text-xs font-semibold flex items-center justify-center h-6 w-6 rounded-full',
                        isToday ? 'bg-[#0FA3A3] text-white font-bold' : 'text-[#64748B]',
                      )}
                    >
                      {cell.day}
                    </span>
                    {dayObs.length > 0 && (
                      <span className="text-[10px] font-bold text-[#64748B]">
                        {dayObs.length} {dayObs.length === 1 ? 'guia' : 'guias'}
                      </span>
                    )}
                  </div>

                  {/* Obligations Pills */}
                  <div className="flex-1 space-y-1 overflow-y-auto max-h-[90px]">
                    {dayObs.map((ob) => {
                      const isOverdue =
                        ob.status === 'atrasada' ||
                        (new Date(ob.vencimento).getTime() < Date.now() && ob.status !== 'entregue')
                      const isDelivered = ob.status === 'entregue'

                      return (
                        <button
                          key={ob.id}
                          onClick={() => handleOpenEdit(ob)}
                          title={`${ob.tipo} (${ob.competencia}) - ${ob.expand?.empresa_id?.nome_fantasia || ob.expand?.empresa_id?.razao_social || 'Empresa'}`}
                          className={cn(
                            'w-full text-left rounded-md px-1.5 py-0.5 text-[10px] font-semibold truncate border flex items-center justify-between transition-all hover:opacity-80',
                            isDelivered
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isOverdue
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200',
                          )}
                        >
                          <span className="truncate">
                            <b>{ob.tipo}</b> {ob.competencia}
                          </span>
                          {isDelivered ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0 ml-1" />
                          ) : isOverdue ? (
                            <AlertTriangle className="h-3 w-3 text-red-600 shrink-0 ml-1" />
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      ) : (
        /* List View */
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1A2333]">
              <thead className="border-b border-[#E2E8F0] bg-slate-50 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Obrigação / Competência</th>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Certificado Digital</th>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3">Status Guia</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3">Valor (R$)</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredObrigacoes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-[#94A3B8]">
                      Nenhuma obrigação fiscal encontrada com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredObrigacoes.map((ob) => {
                    const venc = new Date(ob.vencimento)
                    const vencStr = venc.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                    const empName =
                      ob.expand?.empresa_id?.nome_fantasia ||
                      ob.expand?.empresa_id?.razao_social ||
                      'Empresa não identificada'
                    const respName =
                      ob.expand?.responsavel_id?.name ||
                      ob.expand?.responsavel_id?.email ||
                      'Não atribuído'

                    const empCert = certificadosMap[ob.empresa_id]
                    const saude = certificadosService.calcularSaude(empCert)

                    return (
                      <tr key={ob.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-[#0B1F3A] flex items-center gap-1.5">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-[#0B1F3A] border">
                              {ob.tipo}
                            </span>
                            <span>{ob.competencia}</span>
                            {ob.exige_certificado && (
                              <Badge
                                variant="outline"
                                className="bg-sky-50 text-sky-700 border-sky-200 text-[10px] gap-1 py-0 px-1.5"
                                title="Esta obrigação exige certificado digital para transmissão"
                              >
                                <KeyRound className="h-2.5 w-2.5" />
                                <span>Exige Certificado</span>
                              </Badge>
                            )}
                          </div>
                          {ob.observacoes && (
                            <p className="text-[11px] text-[#64748B] truncate max-w-xs mt-0.5">
                              {ob.observacoes}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-[#1A2333]">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-[#0FA3A3] shrink-0" />
                            <span className="truncate max-w-[180px]">{empName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {ob.exige_certificado ? (
                            saude.saude === 'valido' ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] gap-1">
                                <ShieldCheck className="h-3 w-3 text-emerald-600" />
                                <span>Válido ({saude.diasRestantes}d)</span>
                              </Badge>
                            ) : saude.saude === 'proximo_vencimento' ? (
                              <Badge className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] gap-1 animate-pulse">
                                <ShieldAlert className="h-3 w-3 text-amber-600" />
                                <span>Vence em {saude.diasRestantes}d</span>
                              </Badge>
                            ) : saude.saude === 'expirado' ? (
                              <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] gap-1">
                                <ShieldX className="h-3 w-3 text-red-600" />
                                <span>Expirado</span>
                              </Badge>
                            ) : (
                              <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] gap-1">
                                <ShieldQuestion className="h-3 w-3 text-red-600" />
                                <span>Não possui</span>
                              </Badge>
                            )
                          ) : (
                            <span className="text-[11px] text-[#94A3B8]">Não requerido</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap font-semibold">{vencStr}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {getStatusBadge(ob.status, ob.vencimento)}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-[#64748B]">
                          <div className="flex items-center gap-1.5">
                            <UserIcon className="h-3 w-3 text-[#94A3B8]" />
                            <span className="truncate max-w-[140px]">{respName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap font-mono">
                          {ob.valor
                            ? ob.valor.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })
                            : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {ob.status !== 'entregue' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarcarEntregue(ob)}
                                className="h-7 px-2 text-[11px] font-semibold text-[#16A34A] border-emerald-200 hover:bg-emerald-50"
                                title="Marcar como entregue"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                Entregar
                              </Button>
                            )}

                            {ob.anexo && (
                              <a
                                href={pb.files.getURL(ob, ob.anexo)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-slate-100"
                                title="Baixar anexo"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            )}

                            {canEdit && (
                              <>
                                <button
                                  onClick={() => handleOpenEdit(ob)}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-slate-100"
                                  title="Editar"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(ob.id)}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#DC2626] hover:bg-red-50"
                                  title="Excluir"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
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
      )}

      {/* Modal: Create / Edit Obrigação */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333]">
              {editingObrigacao ? 'Editar Obrigação Fiscal' : 'Cadastrar Nova Obrigação'}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Informe os dados de vencimento e vincule à empresa correspondente
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveObrigacao} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              {/* Empresa */}
              <div className="space-y-1.5 col-span-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-[#1A2333]">Empresa *</Label>
                  {formEmpresaId &&
                    (() => {
                      const cert = certificadosMap[formEmpresaId]
                      const saude = certificadosService.calcularSaude(cert)
                      return (
                        <span className="text-[11px] text-[#64748B] flex items-center gap-1">
                          Certificado:{' '}
                          {saude.saude === 'valido' ? (
                            <b className="text-emerald-700">OK ({saude.diasRestantes}d)</b>
                          ) : saude.saude === 'proximo_vencimento' ? (
                            <b className="text-amber-700">Vence em {saude.diasRestantes}d</b>
                          ) : saude.saude === 'expirado' ? (
                            <b className="text-red-700">Expirado</b>
                          ) : (
                            <b className="text-red-600">Não cadastrado</b>
                          )}
                        </span>
                      )
                    })()}
                </div>
                <Select value={formEmpresaId} onValueChange={setFormEmpresaId} required>
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

              {/* Alerta de Certificado para esta obrigação */}
              {formEmpresaId &&
                formExigeCertificado &&
                (() => {
                  const cert = certificadosMap[formEmpresaId]
                  const saude = certificadosService.calcularSaude(cert)
                  if (saude.saude === 'expirado' || saude.saude === 'inexistente') {
                    return (
                      <div className="col-span-2 rounded-xl bg-red-50 border border-red-200 p-2.5 text-[11px] text-red-900 flex items-start gap-2">
                        <ShieldX className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                        <div>
                          <b>Atenção: Empresa sem Certificado Digital válido!</b>
                          <p className="mt-0.5 text-red-700">
                            Esta obrigação exige certificado digital para entrega. O certificado
                            atual está {saude.label.toLowerCase()}. Providencie o upload antes da
                            transmissão fiscal.
                          </p>
                        </div>
                      </div>
                    )
                  }
                  if (saude.saude === 'proximo_vencimento') {
                    return (
                      <div className="col-span-2 rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
                        <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <b>Aviso de Vencimento do Certificado:</b>
                          <p className="mt-0.5 text-amber-800">
                            O certificado desta empresa vence em {saude.diasRestantes} dias.
                            Verifique se a transmissão será realizada antes do vencimento.
                          </p>
                        </div>
                      </div>
                    )
                  }
                  return null
                })()}

              {/* Tipo */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1A2333]">Tipo de Obrigação *</Label>
                <Select
                  value={formTipo}
                  onValueChange={(v) => setFormTipo(v as ObrigacaoTipo)}
                  required
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_OBRIGACOES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Competência */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1A2333]">
                  Competência (MM/AAAA) *
                </Label>
                <Input
                  required
                  placeholder="Ex: 05/2025"
                  value={formCompetencia}
                  onChange={(e) => setFormCompetencia(e.target.value)}
                  className="h-9 text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>

              {/* Vencimento */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1A2333]">Data de Vencimento *</Label>
                <Input
                  type="date"
                  required
                  value={formVencimento}
                  onChange={(e) => setFormVencimento(e.target.value)}
                  className="h-9 text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1A2333]">Status *</Label>
                <Select
                  value={formStatus}
                  onValueChange={(v) => setFormStatus(v as ObrigacaoStatus)}
                  required
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="entregue">Entregue</SelectItem>
                    <SelectItem value="atrasada">Atrasada</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Responsável */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1A2333]">Responsável Técnico</Label>
                <Select value={formResponsavelId} onValueChange={setFormResponsavelId}>
                  <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                    <SelectValue placeholder="Selecione um responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => {
                      const u = m.expand?.user_id
                      const uId = u?.id || m.user_id
                      return (
                        <SelectItem key={m.id} value={uId}>
                          {u?.name || u?.email || 'Membro'} ({m.perfil})
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Valor (opcional) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1A2333]">
                  Valor Estimado / Guia (R$)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={formValor}
                  onChange={(e) => setFormValor(e.target.value)}
                  className="h-9 text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>

              {/* Checkbox: Exige Certificado Digital */}
              <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="chk_exige_cert"
                  checked={formExigeCertificado}
                  onChange={(e) => setFormExigeCertificado(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#0FA3A3] focus:ring-[#0FA3A3] mt-0.5 cursor-pointer"
                />
                <label htmlFor="chk_exige_cert" className="text-xs cursor-pointer select-none">
                  <span className="font-semibold text-[#1A2333]">
                    Esta obrigação fiscal exige Certificado Digital (e-CNPJ)
                  </span>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    Marque para declarações federais/estaduais transmitidas via procuração ou
                    assinatura digital (ex: SPED, EFD, DCTFWeb, e-CAC). O sistema alertará se o
                    certificado estiver vencendo ou expirado.
                  </p>
                </label>
              </div>

              {/* Anexo */}
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-semibold text-[#1A2333]">
                  Anexo Opcional (Guia / Recibo)
                </Label>
                <Input
                  type="file"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setFormAnexoFile(e.target.files[0])
                    }
                  }}
                  className="h-9 text-xs rounded-xl border-[#E2E8F0]"
                />
                {editingObrigacao?.anexo && !formAnexoFile && (
                  <p className="text-[11px] text-[#64748B]">
                    Arquivo atual salvo. Selecione outro para substituir.
                  </p>
                )}
              </div>

              {/* Observações */}
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-semibold text-[#1A2333]">Observações</Label>
                <Textarea
                  placeholder="Instruções de apuração, cruzamento fiscal ou detalhes da guia..."
                  value={formObservacoes}
                  onChange={(e) => setFormObservacoes(e.target.value)}
                  rows={2}
                  className="text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border-[#E2E8F0] text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting}
                className="rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs font-semibold"
              >
                {submitting ? 'Salvando...' : editingObrigacao ? 'Atualizar' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Painel de Regularidade da Empresa */}
      <Dialog open={regularidadeModalOpen} onOpenChange={setRegularidadeModalOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333] flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              <span>Painel de Regularidade Fiscal & Certificado Digital</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Diagnóstico cruzado entre a saúde do certificado e as obrigações que exigem assinatura
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Seletor de Empresa para Auditoria */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1A2333]">Filtrar Empresa</Label>
              <Select value={empresaRegularidadeId} onValueChange={setEmpresaRegularidadeId}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Selecione uma empresa" />
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

            {empresaRegularidadeId &&
              (() => {
                const emp = empresas.find((e) => e.id === empresaRegularidadeId)
                const cert = certificadosMap[empresaRegularidadeId]
                const saude = certificadosService.calcularSaude(cert)

                const pendenciasExigentes = obrigacoes.filter(
                  (o) =>
                    o.empresa_id === empresaRegularidadeId &&
                    o.exige_certificado &&
                    o.status !== 'entregue' &&
                    o.status !== 'cancelada',
                )

                return (
                  <div className="space-y-4">
                    {/* Status do Certificado */}
                    <div
                      className={cn(
                        'rounded-2xl p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-3',
                        saude.saude === 'valido'
                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                          : saude.saude === 'proximo_vencimento'
                            ? 'bg-amber-50/60 border-amber-300 text-amber-900'
                            : 'bg-red-50/60 border-red-200 text-red-900',
                      )}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {saude.saude === 'valido' ? (
                            <ShieldCheck className="h-5 w-5 text-emerald-600" />
                          ) : saude.saude === 'proximo_vencimento' ? (
                            <ShieldAlert className="h-5 w-5 text-amber-600" />
                          ) : (
                            <ShieldX className="h-5 w-5 text-red-600" />
                          )}
                          <h4 className="font-bold text-sm">
                            {emp?.nome_fantasia || emp?.razao_social}
                          </h4>
                        </div>
                        <p className="text-xs">
                          {cert
                            ? `Certificado ${cert.tipo.toUpperCase()} (${cert.emissor}) • Validade: ${new Date(cert.validade).toLocaleDateString('pt-BR')}`
                            : 'Nenhum certificado digital cadastrado para esta empresa'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          className={cn(
                            'text-xs font-semibold py-1 px-3',
                            saude.saude === 'valido'
                              ? 'bg-emerald-600 text-white'
                              : saude.saude === 'proximo_vencimento'
                                ? 'bg-amber-600 text-white'
                                : 'bg-red-600 text-white',
                          )}
                        >
                          {saude.label}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRegularidadeModalOpen(false)
                            window.location.href = `/empresas/${empresaRegularidadeId}/editar`
                          }}
                          className="text-xs h-8 rounded-xl bg-white"
                        >
                          Gerenciar Certificado
                        </Button>
                      </div>
                    </div>

                    {/* Lista de Obrigações Pendentes que Exigem Certificado */}
                    <div>
                      <h5 className="text-xs font-bold text-[#1A2333] mb-2 flex items-center justify-between">
                        <span>
                          Obrigações que Exigem Certificado ({pendenciasExigentes.length})
                        </span>
                        {pendenciasExigentes.length > 0 && saude.saude !== 'valido' && (
                          <span className="text-[11px] text-red-600 font-semibold">
                            ⚠️ Risco de bloqueio na transmissão
                          </span>
                        )}
                      </h5>

                      {pendenciasExigentes.length === 0 ? (
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center text-xs text-[#64748B]">
                          Não há obrigações exigentes de certificado pendentes para esta empresa.
                          Tudo regular!
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto">
                          {pendenciasExigentes.map((ob) => (
                            <div
                              key={ob.id}
                              className="flex items-center justify-between rounded-xl border border-slate-200 p-2.5 text-xs bg-white"
                            >
                              <div>
                                <p className="font-semibold text-[#1A2333]">
                                  {ob.tipo} — Competência {ob.competencia}
                                </p>
                                <p className="text-[11px] text-[#64748B]">
                                  Vencimento:{' '}
                                  {new Date(ob.vencimento).toLocaleDateString('pt-BR', {
                                    timeZone: 'UTC',
                                  })}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {getStatusBadge(ob.status, ob.vencimento)}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setRegularidadeModalOpen(false)
                                    handleOpenEdit(ob)
                                  }}
                                  className="h-7 text-xs rounded-lg"
                                >
                                  Ver Guia
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRegularidadeModalOpen(false)}
              className="rounded-xl border-[#E2E8F0] text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

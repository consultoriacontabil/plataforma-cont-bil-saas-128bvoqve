import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Compass,
  Building2,
  FileText,
  Clock,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Bell,
  LogOut,
  FileCheck,
  Calendar,
  Download,
  AlertCircle,
  FileSpreadsheet,
  LayoutDashboard,
  Lock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { portalService } from '@/services/portal'
import { notificacoesService } from '@/services/notificacoes'
import { demonstrativosService } from '@/services/demonstrativos'
import { DemonstrativoModalView } from '@/components/DemonstrativoModalView'
import { contratosService } from '@/services/contratos'
import { assinaturasService } from '@/services/assinaturas'
import { ContratoModalView } from '@/components/ContratoModalView'
import { AssinarContratoModal } from '@/components/AssinarContratoModal'
import { RecusarContratoModal } from '@/components/RecusarContratoModal'
import { simuladorReformaService } from '@/services/simuladorReforma'
import { RelatorioReformaModal } from '@/components/RelatorioReformaModal'
import { calcularSimulacaoReforma } from '@/lib/reformaTributaria/calculos'
import type { SimulacaoReformaRecord } from '@/types'
import type {
  Empresa,
  Documento,
  DocumentoTipo,
  ObrigacaoRecord,
  NotificacaoRecord,
  DemonstrativoRecord,
  ContratoHonorarioRecord,
  AssinaturaDemonstrativoRecord,
} from '@/types'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { useToast } from '@/hooks/use-toast'
import { formatDatePtBr } from '@/lib/formatters'
import pb from '@/lib/pocketbase/client'
import { cn } from '@/lib/utils'

export default function PortalClientePage() {
  const { user, tenant, signOut } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('')
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [obrigacoes, setObrigacoes] = useState<ObrigacaoRecord[]>([])
  const [notificacoes, setNotificacoes] = useState<NotificacaoRecord[]>([])
  const [fechamentos, setFechamentos] = useState<{ competencia: string; status: string }[]>([])
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [loading, setLoading] = useState(true)

  // Módulo 1: Demonstrativos para aprovação do cliente
  const [demonstrativos, setDemonstrativos] = useState<DemonstrativoRecord[]>([])
  const [selectedDem, setSelectedDem] = useState<DemonstrativoRecord | null>(null)
  const [modalDemOpen, setModalDemOpen] = useState(false)
  const [approvingDem, setApprovingDem] = useState(false)

  // Módulo Simulador da Reforma Tributária compartilhado
  const [simulacoesReforma, setSimulacoesReforma] = useState<SimulacaoReformaRecord[]>([])
  const [modalRelatorioReformaOpen, setModalRelatorioReformaOpen] = useState(false)
  const [selectedSimulacaoCalculada, setSelectedSimulacaoCalculada] = useState<any>(null)
  const [selectedSimulacaoTitulo, setSelectedSimulacaoTitulo] = useState('')
  const [reprovandoModalOpen, setReprovandoModalOpen] = useState(false)
  const [motivoReprovacao, setMotivoReprovacao] = useState('')

  // Módulo Contratos & Propostas de Honorários
  const [contratos, setContratos] = useState<ContratoHonorarioRecord[]>([])
  const [assinaturasContratos, setAssinaturasContratos] = useState<AssinaturaDemonstrativoRecord[]>(
    [],
  )
  const [selectedContrato, setSelectedContrato] = useState<ContratoHonorarioRecord | null>(null)
  const [modalContratoOpen, setModalContratoOpen] = useState(false)
  const [modalAssinarContratoOpen, setModalAssinarContratoOpen] = useState(false)
  const [modalRecusarContratoOpen, setModalRecusarContratoOpen] = useState(false)

  // Upload GED State
  const [uploadTipo, setUploadTipo] = useState<DocumentoTipo>('fatura')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadObs, setUploadObs] = useState('')
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // Carregar empresas permitidas para este cliente
  const loadPortalData = useCallback(async () => {
    if (!tenant?.id || !user?.email) return
    setLoading(true)
    try {
      const emps = await portalService.getClienteEmpresas(tenant.id, user.email)
      setEmpresas(emps)

      const activeEmpId = selectedEmpresaId || emps[0]?.id
      if (activeEmpId) {
        setSelectedEmpresaId(activeEmpId)
        const [docs, obs, notifs, fechosRes, demsRes, contratosRes, assinaturasRes, simReformaRes] =
          await Promise.all([
            portalService.getClienteDocumentos(tenant.id, activeEmpId),
            portalService.getClienteObrigacoes(tenant.id, activeEmpId),
            notificacoesService.list(tenant.id, user.id),
            pb
              .collection('fechamento_competencia')
              .getFullList<{ competencia: string; status: string }>({
                filter: `tenant_id = "${tenant.id}" && empresa = "${activeEmpId}"`,
                sort: '-competencia',
              })
              .catch(() => []),
            demonstrativosService.list(tenant.id, { empresaId: activeEmpId }).catch(() => []),
            contratosService.list(tenant.id, { empresaId: activeEmpId }).catch(() => []),
            assinaturasService
              .list(tenant.id, { empresaId: activeEmpId, tipoDocumento: 'contrato_honorarios' })
              .catch(() => []),
            pb
              .collection('simulacoes_reforma')
              .getFullList<SimulacaoReformaRecord>({
                filter: `tenant_id = "${tenant.id}" && empresa = "${activeEmpId}" && compartilhado_portal = true`,
                sort: '-created',
              })
              .catch(() => []),
          ])
        setDocumentos(docs)
        setObrigacoes(obs)
        setNotificacoes(notifs)
        setFechamentos(
          fechosRes.map((f: { competencia: string; status: string }) => ({
            competencia: f.competencia,
            status: f.status,
          })),
        )
        // Cliente só visualiza contratos/propostas que não sejam rascunho interno do escritório
        setContratos(contratosRes.filter((c) => c.status !== 'rascunho'))
        setAssinaturasContratos(assinaturasRes)
        // Cliente só visualiza demonstrativos da própria empresa (enviado, aprovado ou reprovado)
        setDemonstrativos(demsRes.filter((d) => d.status !== 'rascunho'))
        setSimulacoesReforma(simReformaRes)
        setUnreadNotifs(notifs.filter((n) => !n.lida).length)
      }
    } catch (err) {
      console.error('Erro ao carregar dados do portal do cliente:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar portal',
        description: 'Não foi possível carregar os dados da sua empresa.',
      })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, user?.email, user?.id, selectedEmpresaId, toast])

  useEffect(() => {
    loadPortalData()
  }, [loadPortalData])

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      if (file.size > 26214400) {
        toast({
          variant: 'destructive',
          title: 'Arquivo muito grande',
          description: 'O tamanho máximo permitido é de 25 MB.',
        })
        return
      }
      setUploadFile(file)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      if (file.size > 26214400) {
        toast({
          variant: 'destructive',
          title: 'Arquivo muito grande',
          description: 'O tamanho máximo permitido é de 25 MB.',
        })
        return
      }
      setUploadFile(file)
    }
  }

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant?.id || !selectedEmpresaId || !uploadFile || !user?.id) {
      toast({
        variant: 'destructive',
        title: 'Campos incompletos',
        description: 'Selecione um arquivo para enviar ao escritório.',
      })
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('tenant_id', tenant.id)
      formData.append('empresa_id', selectedEmpresaId)
      formData.append('nome_arquivo', uploadFile.name)
      formData.append('tipo', uploadTipo)
      formData.append('status', 'pendente')
      formData.append('usuario_upload_id', user.id)
      formData.append('arquivo', uploadFile)
      if (uploadObs) formData.append('observacoes', uploadObs.trim())

      await portalService.uploadClienteDocumento(formData)

      toast({
        title: 'Documento enviado!',
        description: 'O escritório contábil foi notificado e fará a classificação.',
      })

      setUploadFile(null)
      setUploadObs('')
      loadPortalData()
    } catch (err) {
      console.error('Erro no upload pelo portal:', err)
      toast({
        variant: 'destructive',
        title: 'Falha no envio',
        description: 'Não foi possível enviar o documento.',
      })
    } finally {
      setUploading(false)
    }
  }

  const activeEmpresa = empresas.find((e) => e.id === selectedEmpresaId)

  // Ações de Aprovação / Reprovação pelo Cliente
  const handleAprovarDemonstrativo = async () => {
    if (!selectedDem || !user?.id) return
    setApprovingDem(true)
    try {
      await demonstrativosService.aprovarPeloCliente(selectedDem.id, user.id)
      toast({
        title: 'Demonstrativo Aprovado com Sucesso!',
        description: 'Sua assinatura digital foi registrada e o escritório foi notificado.',
      })
      setModalDemOpen(false)
      loadPortalData()
    } catch (err) {
      console.error('Erro ao aprovar demonstrativo:', err)
      toast({
        variant: 'destructive',
        title: 'Falha na aprovação',
        description: 'Não foi possível gravar a aprovação.',
      })
    } finally {
      setApprovingDem(false)
    }
  }

  const handleAbrirReprovacao = () => {
    setMotivoReprovacao('')
    setReprovandoModalOpen(true)
  }

  const handleConfirmarReprovacao = async () => {
    if (!selectedDem || !user?.id) return
    if (!motivoReprovacao.trim()) {
      toast({
        variant: 'destructive',
        title: 'Observação obrigatória',
        description: 'Por favor, descreva o motivo da reprovação ou inconsistência detectada.',
      })
      return
    }

    setApprovingDem(true)
    try {
      await demonstrativosService.reprovarPeloCliente(
        selectedDem.id,
        motivoReprovacao.trim(),
        user.id,
      )
      toast({
        title: 'Demonstrativo Reprovado',
        description: 'O escritório foi notificado com o seu apontamento para correção.',
      })
      setReprovandoModalOpen(false)
      setModalDemOpen(false)
      loadPortalData()
    } catch (err) {
      console.error('Erro ao reprovar demonstrativo:', err)
      toast({
        variant: 'destructive',
        title: 'Falha ao reprovar',
        description: 'Não foi possível registrar o apontamento.',
      })
    } finally {
      setApprovingDem(false)
    }
  }

  // Cálculos do Dashboard do Cliente (Módulo 3)
  const metricasPortal = useMemo(() => {
    const entregues = obrigacoes.filter((o) => o.status === 'entregue').length
    const pendentes = obrigacoes.filter((o) => o.status === 'pendente').length
    const atrasadas = obrigacoes.filter((o) => o.status === 'atrasada').length
    const guiasComAnexo = obrigacoes.filter((o) => Boolean(o.anexo)).length

    // Próximas entregas ordenadas por vencimento
    const now = new Date()
    const proximas = obrigacoes
      .filter((o) => o.status !== 'entregue')
      .sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime())
      .slice(0, 4)

    // Mini-gráfico de obrigações últimos meses
    const mesesMap: Record<string, { mes: string; entregues: number; pendentes: number }> = {}
    obrigacoes.forEach((o) => {
      const comp = o.competencia || 'Geral'
      if (!mesesMap[comp]) {
        mesesMap[comp] = { mes: comp, entregues: 0, pendentes: 0 }
      }
      if (o.status === 'entregue') {
        mesesMap[comp].entregues++
      } else {
        mesesMap[comp].pendentes++
      }
    })

    const chartData = Object.values(mesesMap).slice(-6)
    if (chartData.length === 0) {
      chartData.push({ mes: 'Atual', entregues: 1, pendentes: 0 })
    }

    // Status do Fechamento Contábil
    const ultimoFecho = fechamentos[0]

    return {
      entregues,
      pendentes,
      atrasadas,
      guiasComAnexo,
      proximas,
      chartData,
      ultimoFecho,
    }
  }, [obrigacoes, fechamentos])

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-[#1A2333]">
      {/* Topbar Simplificado do Portal */}
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#E2E8F0] bg-white px-4 md:px-8 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#0FA3A3] to-[#123B6D] text-white shadow-md">
            <Compass className="h-6 w-6" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-[#1A2333]">
              Portal da Empresa
            </span>
            <p className="text-[10px] uppercase font-semibold text-[#64748B]">
              Rumo Consultoria Contábil
            </p>
          </div>
        </div>

        {/* Controles de Topo: Seletor de Empresa, Notificações, Sair */}
        <div className="flex items-center gap-3">
          {empresas.length > 1 && (
            <Select value={selectedEmpresaId} onValueChange={setSelectedEmpresaId}>
              <SelectTrigger className="w-52 h-9 text-xs rounded-xl bg-slate-50 border-[#E2E8F0]">
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
          )}

          {/* Notificações do Portal */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9 text-[#64748B]">
                <Bell className="h-5 w-5" />
                {unreadNotifs > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#EF4444] text-[9px] font-bold text-white">
                    {unreadNotifs}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0 rounded-2xl shadow-xl">
              <div className="p-3 border-b border-[#E2E8F0] bg-slate-50 font-bold text-xs">
                Avisos do Escritório
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 p-1">
                {notificacoes.length === 0 ? (
                  <p className="p-4 text-center text-xs text-[#94A3B8]">
                    Nenhuma notificação recente.
                  </p>
                ) : (
                  notificacoes.map((n) => (
                    <div key={n.id} className="p-2.5 text-xs">
                      <p className="font-semibold text-[#1A2333]">{n.titulo}</p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">{n.mensagem}</p>
                    </div>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Usuário e Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <span className="hidden sm:inline-block text-xs font-semibold text-[#1A2333]">
              {user?.name || user?.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="h-8 gap-1 text-xs text-[#EF4444] hover:bg-rose-50"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Conteúdo do Portal */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Banner de Boas-vindas da Empresa */}
        <div className="bg-gradient-to-r from-[#0B1F3A] to-[#123B6D] text-white p-6 rounded-3xl shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#0FA3A3]" />
              <h1 className="text-xl font-bold">
                {activeEmpresa?.nome_fantasia || activeEmpresa?.razao_social || 'Sua Empresa'}
              </h1>
            </div>
            <p className="text-xs text-[#94A3B8] mt-1">
              CNPJ: {activeEmpresa?.cnpj} • Regime:{' '}
              {activeEmpresa?.regime_tributario?.replace('_', ' ').toUpperCase()}
            </p>
          </div>

          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm px-4 py-3 rounded-2xl">
            <div className="text-center">
              <span className="block text-lg font-bold text-white">{documentos.length}</span>
              <span className="text-[10px] text-[#94A3B8] uppercase">Documentos</span>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div className="text-center">
              <span className="block text-lg font-bold text-[#0FA3A3]">
                {obrigacoes.filter((o) => o.status === 'entregue').length}/{obrigacoes.length}
              </span>
              <span className="text-[10px] text-[#94A3B8] uppercase">Obrigações OK</span>
            </div>
          </div>
        </div>

        {/* Abas Principais: Dashboard, Documentos e Obrigações */}
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="bg-slate-200/60 p-1 rounded-xl h-10 w-full sm:w-auto">
            <TabsTrigger value="dashboard" className="gap-2 text-xs font-semibold rounded-lg">
              <LayoutDashboard className="h-4 w-4 text-[#0FA3A3]" />
              <span>Dashboard do Cliente</span>
            </TabsTrigger>
            <TabsTrigger value="documentos" className="gap-2 text-xs font-semibold rounded-lg">
              <FileText className="h-4 w-4" />
              <span>Meus Documentos ({documentos.length})</span>
            </TabsTrigger>
            <TabsTrigger value="obrigacoes" className="gap-2 text-xs font-semibold rounded-lg">
              <Clock className="h-4 w-4" />
              <span>Obrigações Fiscais ({obrigacoes.length})</span>
            </TabsTrigger>
            <TabsTrigger value="demonstrativos" className="gap-2 text-xs font-semibold rounded-lg">
              <FileSpreadsheet className="h-4 w-4 text-[#0FA3A3]" />
              <span>Demonstrativos ({demonstrativos.length})</span>
              {demonstrativos.filter((d) => d.status === 'enviado').length > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#EF4444] text-[10px] font-bold text-white shadow-xs">
                  {demonstrativos.filter((d) => d.status === 'enviado').length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="contratos" className="gap-2 text-xs font-semibold rounded-lg">
              <ShieldCheck className="h-4 w-4 text-[#0FA3A3]" />
              <span>Contratos & Propostas ({contratos.length})</span>
              {contratos.filter((c) => c.status === 'enviado').length > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#EF4444] text-[10px] font-bold text-white shadow-xs">
                  {contratos.filter((c) => c.status === 'enviado').length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="reforma" className="gap-2 text-xs font-semibold rounded-lg">
              <Sparkles className="h-4 w-4 text-[#0FA3A3]" />
              <span>Reforma Tributária (IBS/CBS)</span>
            </TabsTrigger>
          </TabsList>

          {/* ABA DASHBOARD DO CLIENTE (MÓDULO 3) */}
          <TabsContent value="dashboard" className="space-y-6 mt-4">
            {/* 4 Cards de Indicadores do Cliente */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <span className="text-xs font-semibold text-[#64748B]">Obrigações do Mês</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-[#0FA3A3]">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-extrabold text-[#1A2333]">
                    {metricasPortal.entregues} / {obrigacoes.length}
                  </div>
                  <p className="mt-1 text-[11px] text-emerald-600 font-medium">
                    {metricasPortal.atrasadas > 0
                      ? `${metricasPortal.atrasadas} guia(s) em atraso`
                      : 'Todas as entregas em dia'}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <span className="text-xs font-semibold text-[#64748B]">Documentos Enviados</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#3B82F6]">
                    <FileText className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-extrabold text-[#1A2333]">{documentos.length}</div>
                  <p className="mt-1 text-[11px] text-[#64748B]">
                    {documentos.filter((d) => d.status === 'processado').length} classificados pelo
                    escritório
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <span className="text-xs font-semibold text-[#64748B]">Guias Disponíveis</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Download className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-extrabold text-emerald-600">
                    {metricasPortal.guiasComAnexo}
                  </div>
                  <p className="mt-1 text-[11px] text-[#64748B]">
                    Comprovantes prontos para download
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-[#E2E8F0] shadow-xs bg-slate-900 text-white">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <span className="text-xs font-semibold text-slate-400">Fechamento Mensal</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-teal-300">
                    <Lock className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-extrabold text-white capitalize">
                    {metricasPortal.ultimoFecho
                      ? `${metricasPortal.ultimoFecho.competencia} - ${metricasPortal.ultimoFecho.status}`
                      : 'Regular / Em dia'}
                  </div>
                  <p className="mt-1 text-[11px] text-teal-300">
                    {metricasPortal.ultimoFecho?.status === 'aprovado'
                      ? 'Competência aprovada e selada'
                      : 'Rotina de fechamento em andamento'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Grid 2 Colunas: Gráfico Histórico + Próximas Entregas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Mini-Gráfico Recharts */}
              <Card className="rounded-3xl border-[#E2E8F0] shadow-2xs p-5">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-[#1A2333]">
                    Obrigações Entregues vs. Pendentes
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Histórico de conformidade fiscal nos últimos 6 meses
                  </p>
                </div>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metricasPortal.chartData}>
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar
                        dataKey="entregues"
                        name="Entregues / Pagas"
                        fill="#0FA3A3"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="pendentes"
                        name="Pendentes"
                        fill="#F59E0B"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Lista Próximas Entregas */}
              <Card className="rounded-3xl border-[#E2E8F0] shadow-2xs p-5 flex flex-col justify-between">
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[#1A2333]">
                        Próximas Entregas & Vencimentos
                      </h3>
                      <p className="text-xs text-[#64748B]">
                        Tributos e declarações com prazo próximo
                      </p>
                    </div>
                    <Calendar className="h-5 w-5 text-[#94A3B8]" />
                  </div>

                  <div className="space-y-3">
                    {metricasPortal.proximas.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[#94A3B8]">
                        Nenhuma obrigação pendente de vencimento próximo. Parabéns!
                      </div>
                    ) : (
                      metricasPortal.proximas.map((pr) => (
                        <div
                          key={pr.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                        >
                          <div>
                            <span className="font-bold text-[#1A2333] block">{pr.tipo}</span>
                            <span className="text-[11px] text-[#64748B]">
                              Competência: {pr.competencia}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-amber-700 block">
                              Vence {formatDatePtBr(pr.vencimento)}
                            </span>
                            {pr.valor && (
                              <span className="font-mono text-[11px] text-[#1A2333]">
                                R$ {pr.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <Button
                    onClick={() => {
                      const tabTrig = document.querySelector(
                        '[data-state="inactive"][value="obrigacoes"]',
                      ) as HTMLElement
                      tabTrig?.click()
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-xs text-[#0FA3A3] hover:text-[#0C8585] p-0 h-auto font-semibold"
                  >
                    Ver todas as obrigações →
                  </Button>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* ABA DOCUMENTOS (Upload GED Drag and drop + Lista) */}
          <TabsContent value="documentos" className="space-y-6 mt-4">
            {/* Área de Upload Drag-and-Drop */}
            <Card className="rounded-3xl border border-[#E2E8F0] shadow-2xs overflow-hidden">
              <CardHeader className="bg-slate-50/70 border-b border-[#E2E8F0] pb-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <UploadCloud className="h-4 w-4 text-[#0FA3A3]" />
                  <span>Enviar Documentos ao Escritório</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Envie notas fiscais, faturas, extratos ou recibos para a contabilidade (limite:
                  até 25 MB).
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleUploadSubmit} className="space-y-4">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={cn(
                      'border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer',
                      isDragging
                        ? 'border-[#0FA3A3] bg-[#0FA3A3]/5'
                        : 'border-[#CBD5E1] bg-slate-50 hover:bg-slate-100/60',
                    )}
                    onClick={() => document.getElementById('portal-file-input')?.click()}
                  >
                    <input
                      id="portal-file-input"
                      type="file"
                      className="hidden"
                      onChange={handleFileChange}
                      accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx"
                    />
                    <UploadCloud className="h-10 w-10 text-[#0FA3A3] mx-auto mb-2" />
                    <p className="text-xs font-bold text-[#1A2333]">
                      {uploadFile
                        ? uploadFile.name
                        : 'Arraste e solte seu arquivo aqui, ou clique para buscar'}
                    </p>
                    <p className="text-[11px] text-[#64748B] mt-1">
                      {uploadFile
                        ? `${(uploadFile.size / 1024 / 1024).toFixed(2)} MB selecionado`
                        : 'PDF, Imagens (PNG/JPG), Planilhas XLSX ou DOCX até 25 MB'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold">Tipo de Documento</Label>
                      <Select
                        value={uploadTipo}
                        onValueChange={(v) => setUploadTipo(v as DocumentoTipo)}
                      >
                        <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fatura">Fatura / Concessionária</SelectItem>
                          <SelectItem value="nota_fiscal">Nota Fiscal (NFSe / NFe)</SelectItem>
                          <SelectItem value="contrato_social">Contrato ou Aditivo</SelectItem>
                          <SelectItem value="relatorios">Extrato / Relatório</SelectItem>
                          <SelectItem value="outros">Outros Documentos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold">
                        Observações para o Contador (Opcional)
                      </Label>
                      <Input
                        value={uploadObs}
                        onChange={(e) => setUploadObs(e.target.value)}
                        placeholder="Ex: Ref. ao pagamento do aluguel da sede..."
                        className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={!uploadFile || uploading}
                      className="rounded-xl text-xs font-semibold h-10 px-6 bg-[#0FA3A3] text-white hover:bg-[#0C8585]"
                    >
                      {uploading ? 'Enviando ao Escritório...' : 'Confirmar Envio do Documento'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Lista de Documentos Enviados e Status */}
            <div className="rounded-3xl border border-[#E2E8F0] bg-white shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-[#E2E8F0] bg-slate-50/50">
                <h3 className="text-sm font-bold text-[#1A2333]">Histórico de Documentos</h3>
                <p className="text-xs text-[#64748B]">
                  Acompanhe a classificação contábil realizada pela equipe do escritório
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] text-[#64748B] font-semibold border-b border-[#E2E8F0]">
                    <tr>
                      <th className="py-3 px-4">Nome do Arquivo</th>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4">Enviado em</th>
                      <th className="py-3 px-4">Observações</th>
                      <th className="py-3 px-4">Status de Classificação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[#1A2333]">
                    {documentos.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-[#94A3B8]">
                          Nenhum documento cadastrado ou enviado ainda.
                        </td>
                      </tr>
                    ) : (
                      documentos.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-[#1A2333] flex items-center gap-2">
                            <FileText className="h-4 w-4 text-[#0FA3A3] shrink-0" />
                            <span className="truncate max-w-xs">{d.nome_arquivo}</span>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-[#475569] uppercase text-[10px]">
                            {d.tipo.replace('_', ' ')}
                          </td>
                          <td className="py-3.5 px-4 text-[#64748B]">
                            {formatDatePtBr(d.created)}
                          </td>
                          <td className="py-3.5 px-4 text-[#64748B]">{d.observacoes || '—'}</td>
                          <td className="py-3.5 px-4">
                            {d.status === 'processado' && (
                              <Badge className="bg-[#DCFCE7] text-[#16A34A] border-emerald-200">
                                Classificado
                              </Badge>
                            )}
                            {d.status === 'pendente' && (
                              <Badge className="bg-[#FEF3C7] text-[#D97706] border-amber-200">
                                Em Análise
                              </Badge>
                            )}
                            {d.status === 'rejeitado' && (
                              <Badge className="bg-[#FEE2E2] text-[#DC2626] border-rose-200">
                                Recusado
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* ABA OBRIGAÇÕES FISCAIS (Somente leitura para o cliente) */}
          <TabsContent value="obrigacoes" className="space-y-4 mt-4">
            <div className="rounded-3xl border border-[#E2E8F0] bg-white shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-[#E2E8F0] bg-slate-50/50">
                <h3 className="text-sm font-bold text-[#1A2333]">Obrigações e Guias Fiscais</h3>
                <p className="text-xs text-[#64748B]">
                  Consulte os prazos de vencimento e comprovantes de entrega gerenciados pela Rumo
                  Consultoria
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] text-[#64748B] font-semibold border-b border-[#E2E8F0]">
                    <tr>
                      <th className="py-3 px-4">Guia / Tributo</th>
                      <th className="py-3 px-4">Competência</th>
                      <th className="py-3 px-4">Vencimento</th>
                      <th className="py-3 px-4">Valor Previsto</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Guia / Anexo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[#1A2333]">
                    {obrigacoes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-[#94A3B8]">
                          Nenhuma obrigação fiscal registrada para esta empresa.
                        </td>
                      </tr>
                    ) : (
                      obrigacoes.map((ob) => (
                        <tr key={ob.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-[#1A2333]">{ob.tipo}</td>
                          <td className="py-3.5 px-4 font-medium text-[#475569]">
                            {ob.competencia}
                          </td>
                          <td className="py-3.5 px-4 text-[#64748B]">
                            {formatDatePtBr(ob.vencimento)}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-[#1A2333]">
                            {ob.valor !== undefined && ob.valor !== null
                              ? `R$ ${ob.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                              : '—'}
                          </td>
                          <td className="py-3.5 px-4">
                            {ob.status === 'entregue' && (
                              <Badge className="bg-[#DCFCE7] text-[#16A34A] border-emerald-200">
                                Entregue / Paga
                              </Badge>
                            )}
                            {ob.status === 'pendente' && (
                              <Badge className="bg-[#FEF3C7] text-[#D97706] border-amber-200">
                                Aguardando Pagamento
                              </Badge>
                            )}
                            {ob.status === 'atrasada' && (
                              <Badge className="bg-[#FEE2E2] text-[#DC2626] border-rose-200">
                                Vencida
                              </Badge>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {ob.anexo ? (
                              <a
                                href={pb.files.getURL(ob, ob.anexo)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-[#0FA3A3] hover:underline"
                              >
                                <Download className="h-3.5 w-3.5" />
                                <span>Baixar Guia</span>
                              </a>
                            ) : (
                              <span className="text-[#94A3B8]">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* ================= ABA CONTRATOS & PROPOSTAS DE HONORÁRIOS ================= */}
          <TabsContent value="contratos" className="space-y-6 mt-4">
            <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base font-bold text-[#1A2333] flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-[#0FA3A3]" />
                    <span>Contratos & Propostas de Honorários Contábeis</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-[#64748B]">
                    Consulte os termos contratados, propostas comerciais, baixe o PDF formal com CRC
                    e realize a assinatura eletrônica com validade jurídica (Lei 14.063/2020).
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {contratos.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#94A3B8]">
                    Nenhum contrato ou proposta de honorários disponível para esta empresa no
                    momento.
                  </div>
                ) : (
                  <div className="divide-y divide-[#E2E8F0]">
                    {contratos.map((ctr) => {
                      const isEnviado = ctr.status === 'enviado'
                      const isAssinado = ctr.status === 'assinado'
                      const isRecusado = ctr.status === 'recusado'
                      const assCtr = assinaturasContratos.find((a) => a.contrato === ctr.id)

                      return (
                        <div
                          key={ctr.id}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 gap-4 hover:bg-slate-50/50 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                                isAssinado
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : isRecusado
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-blue-100 text-blue-700',
                              )}
                            >
                              <FileText className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-[#1A2333]">
                                  {ctr.titulo}
                                </span>
                                <Badge
                                  className={cn(
                                    'text-[10px] font-bold px-2 py-0.5 uppercase',
                                    ctr.tipo === 'proposta'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-indigo-100 text-indigo-800',
                                  )}
                                >
                                  {ctr.tipo}
                                </Badge>
                                <Badge
                                  className={cn(
                                    'text-[10px] font-bold px-2 py-0.5 uppercase',
                                    isAssinado && 'bg-emerald-600 text-white',
                                    isRecusado && 'bg-rose-600 text-white',
                                    isEnviado && 'bg-blue-600 text-white animate-pulse',
                                  )}
                                >
                                  {isAssinado
                                    ? 'Assinado Digitalmente'
                                    : isRecusado
                                      ? 'Recusado'
                                      : 'Aguardando Assinatura'}
                                </Badge>
                              </div>
                              <p className="text-xs text-[#64748B] mt-1">
                                Valor Mensal:{' '}
                                <strong className="text-[#0FA3A3] font-bold">
                                  R${' '}
                                  {ctr.valor_mensal.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                  })}
                                </strong>
                                {' • '}Vencimento todo dia {ctr.dia_vencimento}
                                {' • '}Vigência de {ctr.prazo_contrato} meses
                              </p>

                              {isRecusado && ctr.observacoes_recusa && (
                                <p className="text-xs text-rose-600 mt-1 italic">
                                  Motivo da Recusa: "{ctr.observacoes_recusa}"
                                </p>
                              )}

                              {isAssinado && assCtr && (
                                <p className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1 font-mono">
                                  <ShieldCheck className="h-3.5 w-3.5 inline text-emerald-600" />
                                  Autenticado: {assCtr.token_verificacao} (Hash:{' '}
                                  {assCtr.hash_conteudo.slice(0, 16)}...)
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedContrato(ctr)
                                setModalContratoOpen(true)
                              }}
                              className="rounded-xl text-xs font-semibold h-9 border-[#E2E8F0] gap-1.5"
                            >
                              <Download className="h-4 w-4 text-[#0FA3A3]" />
                              <span>Visualizar / Baixar PDF</span>
                            </Button>

                            {isEnviado && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedContrato(ctr)
                                    setModalRecusarContratoOpen(true)
                                  }}
                                  className="rounded-xl text-xs font-semibold h-9 text-rose-600 border-rose-200 hover:bg-rose-50"
                                >
                                  Recusar
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedContrato(ctr)
                                    setModalAssinarContratoOpen(true)
                                  }}
                                  className="rounded-xl text-xs font-semibold h-9 bg-[#16A34A] hover:bg-[#15803D] text-white shadow-xs"
                                >
                                  Revisar & Assinar
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================= ABA DEMONSTRATIVOS CONTÁBEIS (MÓDULO 1) ================= */}
          <TabsContent value="demonstrativos" className="space-y-6 mt-4">
            <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base font-bold text-[#1A2333]">
                    Demonstrativos Contábeis para Assinatura (DRE / Balanço)
                  </CardTitle>
                  <CardDescription className="text-xs text-[#64748B]">
                    Visualize os demonstrativos oficiais gerados pelo escritório, imprima em PDF e
                    realize a validação formal
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {demonstrativos.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#94A3B8]">
                    Nenhum demonstrativo contábil aguardando assinatura ou disponibilizado para a
                    empresa.
                  </div>
                ) : (
                  <div className="divide-y divide-[#E2E8F0]">
                    {demonstrativos.map((dem) => {
                      const isEnviado = dem.status === 'enviado'
                      const isAprovado = dem.status === 'aprovado'
                      const isReprovado = dem.status === 'reprovado'

                      return (
                        <div
                          key={dem.id}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 gap-4 hover:bg-slate-50/50 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                                isAprovado
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : isReprovado
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-blue-100 text-blue-700',
                              )}
                            >
                              <FileSpreadsheet className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-[#1A2333]">
                                  {dem.tipo === 'dre'
                                    ? 'Demonstração do Resultado (DRE)'
                                    : 'Balanço Patrimonial'}
                                </span>
                                <Badge
                                  className={cn(
                                    'text-[10px] font-bold px-2 py-0.5',
                                    isAprovado && 'bg-emerald-600 text-white',
                                    isReprovado && 'bg-rose-600 text-white',
                                    isEnviado && 'bg-blue-600 text-white animate-pulse',
                                  )}
                                >
                                  {isAprovado
                                    ? 'Aprovado'
                                    : isReprovado
                                      ? 'Reprovado'
                                      : 'Pendente de Assinatura'}
                                </Badge>
                              </div>
                              <p className="text-xs text-[#64748B] mt-0.5">
                                Competência:{' '}
                                <span className="font-mono font-semibold">{dem.competencia}</span>
                                {dem.data_envio &&
                                  ` • Enviado em ${formatDatePtBr(dem.data_envio)}`}
                                {dem.data_aprovacao &&
                                  ` • Aprovado em ${formatDatePtBr(dem.data_aprovacao)}`}
                              </p>
                              {isReprovado && dem.observacoes_cliente && (
                                <p className="text-xs text-rose-600 mt-1 italic">
                                  Apontamento: "{dem.observacoes_cliente}"
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedDem(dem)
                                setModalDemOpen(true)
                              }}
                              className="rounded-xl text-xs font-semibold h-9 border-[#E2E8F0] gap-1.5"
                            >
                              <Download className="h-4 w-4 text-[#0FA3A3]" />
                              <span>Visualizar / Baixar PDF</span>
                            </Button>

                            {isEnviado && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedDem(dem)
                                  setModalDemOpen(true)
                                }}
                                className="rounded-xl text-xs font-semibold h-9 bg-[#16A34A] hover:bg-[#15803D] text-white shadow-xs"
                              >
                                Revisar & Assinar
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA REFORMA TRIBUTÁRIA (IBS / CBS) - COMPARTILHADA COM O CLIENTE */}
          <TabsContent value="reforma" className="space-y-6 mt-4">
            <Card className="rounded-3xl border border-[#E2E8F0] bg-white shadow-2xs overflow-hidden">
              <CardHeader className="p-5 border-b border-[#E2E8F0] bg-slate-50/60">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-bold text-[#1A2333] flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-[#0FA3A3]" />
                      <span>Estudos de Impacto da Reforma Tributária (IBS / CBS)</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-[#64748B]">
                      Cenários e pareceres elaborados pela equipe da Rumo Consultoria para sua
                      empresa (EC 132/23 e LC 214/25).
                    </CardDescription>
                  </div>
                  <Badge className="bg-[#0FA3A3] text-white text-[10px] uppercase font-bold w-fit">
                    Transição 2026–2033
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                {simulacoesReforma.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <FileText className="h-8 w-8 text-[#94A3B8] mx-auto opacity-50" />
                    <p className="text-sm font-semibold text-[#1A2333]">
                      Nenhum estudo compartilhado no momento
                    </p>
                    <p className="text-xs text-[#64748B] max-w-md mx-auto">
                      Seu contador está preparando as simulações de transição para o novo IVA Dual
                      (IBS/CBS). Assim que liberado pelo escritório, o parecer completo aparecerá
                      aqui.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {simulacoesReforma.map((sim) => {
                      const resJson = sim.resultado_json as any
                      const inputsJson = sim.inputs_json as any
                      return (
                        <div
                          key={sim.id}
                          className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-[#0FA3A3]/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-[#1A2333]">{sim.titulo}</h4>
                              <Badge variant="outline" className="text-[10px] uppercase">
                                {sim.regime_atual.replace('_', ' ')}
                              </Badge>
                            </div>
                            <p className="text-xs text-[#64748B]">
                              Faturamento Base: R${' '}
                              {sim.faturamento_anual.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                              })}{' '}
                              • Alíquota Atual: {sim.aliquota_atual_estimada}%
                            </p>
                            {resJson?.recomendacaoPrincipal && (
                              <p className="text-[11px] text-[#0FA3A3] font-medium pt-1">
                                Parecer: {resJson.recomendacaoPrincipal}
                              </p>
                            )}
                            <p className="text-[10px] text-[#94A3B8]">
                              Elaborado em: {new Date(sim.created).toLocaleDateString('pt-BR')}
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                // Recalcula ou remonta o objeto calculada
                                const inputs: any = inputsJson || {
                                  razaoSocial: sim.razao_social || activeEmpresa?.razao_social,
                                  regimeAtual: sim.regime_atual,
                                  faturamentoAnual: sim.faturamento_anual,
                                  percentualCreditosInsumos: sim.percentual_creditos || 15,
                                  setorAtividade: sim.setor_atividade || 'servicos_geral',
                                  reducaoSetorial60: !!sim.reducao_setorial_60,
                                  vendeCestaBasica: !!sim.vende_cesta_basica,
                                  percentualCestaBasica: 0,
                                  aliquotaAtualEstimada: sim.aliquota_atual_estimada,
                                  permanecerNoSimplesNaTransicao: true,
                                  anoBase: 2026,
                                }
                                const calc = calcularSimulacaoReforma(inputs)
                                setSelectedSimulacaoCalculada(calc)
                                setSelectedSimulacaoTitulo(sim.titulo)
                                setModalRelatorioReformaOpen(true)
                              }}
                              className="rounded-xl text-xs font-semibold h-9 px-4 bg-[#123B6D] hover:bg-[#0B1F3A] text-white gap-1.5"
                            >
                              <FileText className="h-4 w-4" />
                              <span>Ver Parecer Completo (PDF)</span>
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Modal de Relatório da Reforma para o Cliente */}
      <RelatorioReformaModal
        open={modalRelatorioReformaOpen}
        onOpenChange={setModalRelatorioReformaOpen}
        calculada={selectedSimulacaoCalculada}
        tituloRelatorio={selectedSimulacaoTitulo}
      />

      {/* Modal de Visualização Formal e Aprovação */}
      <DemonstrativoModalView
        open={modalDemOpen}
        onOpenChange={setModalDemOpen}
        demonstrativo={selectedDem}
        empresa={activeEmpresa}
        canApprove={selectedDem?.status === 'enviado'}
        onAprovar={handleAprovarDemonstrativo}
        onReprovar={handleAbrirReprovacao}
        approving={approvingDem}
      />

      {/* Modais de Contratos & Propostas de Honorários */}
      <ContratoModalView
        open={modalContratoOpen}
        onOpenChange={setModalContratoOpen}
        contrato={selectedContrato}
        empresa={activeEmpresa}
        assinatura={
          selectedContrato
            ? assinaturasContratos.find((a) => a.contrato === selectedContrato.id) || null
            : null
        }
        tenantNome={tenant?.nome || 'Rumo Consultoria Contábil'}
        tenantCnpj={tenant?.cnpj || '12.345.678/0001-90'}
        canSign={selectedContrato?.status === 'enviado'}
        canReject={selectedContrato?.status === 'enviado'}
        onAssinar={() => {
          setModalContratoOpen(false)
          setModalAssinarContratoOpen(true)
        }}
        onRecusar={() => {
          setModalContratoOpen(false)
          setModalRecusarContratoOpen(true)
        }}
      />

      <AssinarContratoModal
        open={modalAssinarContratoOpen}
        onOpenChange={setModalAssinarContratoOpen}
        contrato={selectedContrato}
        empresa={activeEmpresa || null}
        assinaturaExistente={
          selectedContrato
            ? assinaturasContratos.find((a) => a.contrato === selectedContrato.id) || null
            : null
        }
        tenantNome={tenant?.nome || 'Rumo Consultoria Contábil'}
        tenantCnpj={tenant?.cnpj || '12.345.678/0001-90'}
        userEmail={user?.email || ''}
        userName={user?.name || ''}
        onSuccess={loadPortalData}
      />

      <RecusarContratoModal
        open={modalRecusarContratoOpen}
        onOpenChange={setModalRecusarContratoOpen}
        contrato={selectedContrato}
        onSuccess={loadPortalData}
      />

      {/* Modal para Reprovação com Observação Obrigatória */}
      <Dialog open={reprovandoModalOpen} onOpenChange={setReprovandoModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-700 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-rose-600" />
              <span>Reprovar Demonstrativo Contábil</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Informe o motivo da divergência ou apontamento para que o escritório possa ajustar a
              escrituração.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label className="text-xs font-bold text-[#1A2333]">
              Motivo do Apontamento / Inconsistência *
            </Label>
            <Input
              value={motivoReprovacao}
              onChange={(e) => setMotivoReprovacao(e.target.value)}
              placeholder="Ex.: Despesa de aluguel duplicada ou receita não creditada..."
              className="text-xs rounded-xl h-10"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setReprovandoModalOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmarReprovacao}
              disabled={approvingDem || !motivoReprovacao.trim()}
              className="rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white"
            >
              {approvingDem ? 'Gravando...' : 'Confirmar Reprovação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

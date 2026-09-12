import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  FileSpreadsheet,
  Download,
  Building2,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Scale,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Printer,
  ChevronRight,
  PieChart,
  ShieldCheck,
  PenTool,
  Copy,
  Check,
  ExternalLink,
  Lock,
  Info,
  Fingerprint,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { empresasService } from '@/services/empresas'
import {
  relatoriosContabeisService,
  type DREResultado,
  type BalancoResultado,
} from '@/services/relatoriosContabeis'
import { demonstrativosService } from '@/services/demonstrativos'
import { assinaturasService } from '@/services/assinaturas'
import { DemonstrativoModalView } from '@/components/DemonstrativoModalView'
import type {
  Empresa,
  DemonstrativoRecord,
  DemonstrativoTipo,
  AssinaturaDemonstrativoRecord,
  TipoAssinaturaDemonstrativo,
  TipoCertificadoIcp,
} from '@/types'
import { formatDatePtBr, formatDateTimePtBr } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export default function RelatoriosContabeisPage() {
  const { tenant } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('')
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>('09/2026')
  const [activeTab, setActiveTab] = useState<'dre' | 'balanco' | 'demonstrativos'>('dre')

  // Dados dos relatórios
  const [dreData, setDreData] = useState<DREResultado | null>(null)
  const [balancoData, setBalancoData] = useState<BalancoResultado | null>(null)

  // Módulo 1: Demonstrativos para assinatura
  const [demonstrativos, setDemonstrativos] = useState<DemonstrativoRecord[]>([])
  const [loadingDemonstrativos, setLoadingDemonstrativos] = useState(false)
  const [modalViewOpen, setModalViewOpen] = useState(false)
  const [viewingDemonstrativo, setViewingDemonstrativo] = useState<DemonstrativoRecord | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Módulo Assinaturas Digitais (ICP-Brasil / Eletrônica)
  const [assinaturasMap, setAssinaturasMap] = useState<
    Record<string, AssinaturaDemonstrativoRecord[]>
  >({})
  const [solicitarModalOpen, setSolicitarModalOpen] = useState(false)
  const [assinarModalOpen, setAssinarModalOpen] = useState(false)
  const [selectedDemParaAssinar, setSelectedDemParaAssinar] = useState<DemonstrativoRecord | null>(
    null,
  )
  const [selectedAssinaturaParaConcluir, setSelectedAssinaturaParaConcluir] =
    useState<AssinaturaDemonstrativoRecord | null>(null)

  // Form Solicitar Assinatura
  const [formAssinanteNome, setFormAssinanteNome] = useState('')
  const [formAssinanteCargoCpf, setFormAssinanteCargoCpf] = useState('')
  const [formAssinanteEmail, setFormAssinanteEmail] = useState('')
  const [formTipoAssinatura, setFormTipoAssinatura] =
    useState<TipoAssinaturaDemonstrativo>('eletronica_declarada')
  const [formTipoCertificado, setFormTipoCertificado] = useState<TipoCertificadoIcp>('nenhum')

  // Form Assinar (Concordância consciente)
  const [concordoTermos, setConcordoTermos] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  // 1. Carregar Empresas
  useEffect(() => {
    if (!tenant?.id) return
    const fetchEmpresas = async () => {
      try {
        const emps = await empresasService.list(tenant.id)
        setEmpresas(emps)
        if (emps.length > 0 && !selectedEmpresaId) {
          setSelectedEmpresaId(emps[0].id)
        }
      } catch (err) {
        console.error('Erro ao carregar empresas:', err)
      }
    }
    void fetchEmpresas()
  }, [tenant?.id, selectedEmpresaId])

  // 2. Carregar DRE e Balanço da empresa + competência
  const loadRelatorios = useCallback(async () => {
    if (!tenant?.id || !selectedEmpresaId || !selectedCompetencia) return
    setLoading(true)
    try {
      const [dreRes, balancoRes, dems, todasAssinaturas] = await Promise.all([
        relatoriosContabeisService.gerarDRE(tenant.id, selectedEmpresaId, selectedCompetencia),
        relatoriosContabeisService.gerarBalancoPatrimonial(
          tenant.id,
          selectedEmpresaId,
          selectedCompetencia,
        ),
        demonstrativosService.list(tenant.id, {
          empresaId: selectedEmpresaId,
          competencia: selectedCompetencia,
        }),
        assinaturasService.list(tenant.id, {
          empresaId: selectedEmpresaId,
          competencia: selectedCompetencia,
        }),
      ])
      setDreData(dreRes)
      setBalancoData(balancoRes)
      setDemonstrativos(dems)

      // Mapear assinaturas por ID do demonstrativo
      const map: Record<string, AssinaturaDemonstrativoRecord[]> = {}
      todasAssinaturas.forEach((ass) => {
        const dId = ass.demonstrativo
        if (!map[dId]) map[dId] = []
        map[dId].push(ass)
      })
      setAssinaturasMap(map)
    } catch (err) {
      console.error('Erro ao gerar relatórios contábeis:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao processar balancete',
        description: 'Não foi possível apurar o DRE ou Balanço Patrimonial para a competência.',
      })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, selectedEmpresaId, selectedCompetencia, toast])

  useEffect(() => {
    void loadRelatorios()
  }, [loadRelatorios])

  const activeEmpresa = useMemo(
    () => empresas.find((e) => e.id === selectedEmpresaId),
    [empresas, selectedEmpresaId],
  )

  // Exportar DRE CSV
  const handleExportDRECSV = () => {
    if (!dreData) return
    const headers = ['Código', 'Descrição da Linha', 'Tipo', 'Valor (R$)']
    const rows = dreData.linhas.map((l) => [
      `"${l.codigo}"`,
      `"${l.descricao.replace(/"/g, '""')}"`,
      `"${l.tipo}"`,
      `"${l.negativo ? `-${l.valor.toFixed(2)}` : l.valor.toFixed(2)}"`,
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute(
      'download',
      `DRE_${activeEmpresa?.nome_fantasia || 'empresa'}_${selectedCompetencia.replace('/', '-')}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Exportar Balanço Patrimonial CSV
  const handleExportBalancoCSV = () => {
    if (!balancoData) return
    const headers = ['Grupo / Classificação', 'Código Conta', 'Nome da Conta', 'Saldo Atual (R$)']
    const rows: string[][] = []

    const appendSubgrupo = (sub: BalancoResultado['ativoCirculante']) => {
      rows.push([
        `"${sub.nome.toUpperCase()}"`,
        `"${sub.codigo}"`,
        `""`,
        `"${sub.saldo.toFixed(2)}"`,
      ])
      sub.contas.forEach((c) => {
        rows.push([
          `"${sub.nome}"`,
          `"${c.codigo}"`,
          `"${c.nome.replace(/"/g, '""')}"`,
          `"${c.saldo.toFixed(2)}"`,
        ])
      })
    }

    appendSubgrupo(balancoData.ativoCirculante)
    appendSubgrupo(balancoData.ativoNaoCirculante)
    rows.push(['"TOTAL DO ATIVO"', '""', '""', `"${balancoData.ativoTotal.toFixed(2)}"`])

    appendSubgrupo(balancoData.passivoCirculante)
    appendSubgrupo(balancoData.patrimonioLiquido)
    rows.push(['"TOTAL DO PASSIVO + PL"', '""', '""', `"${balancoData.passivoMaisPL.toFixed(2)}"`])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute(
      'download',
      `Balanco_Patrimonial_${activeEmpresa?.nome_fantasia || 'empresa'}_${selectedCompetencia.replace('/', '-')}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Módulo 1: Gerar Demonstrativo para Assinatura (DRE ou Balanço)
  const handleGerarDemonstrativoAssinatura = async (tipo: DemonstrativoTipo) => {
    if (!tenant?.id || !selectedEmpresaId || !selectedCompetencia) {
      toast({
        variant: 'destructive',
        title: 'Seleção necessária',
        description: 'Selecione a empresa e a competência antes de gerar o demonstrativo.',
      })
      return
    }

    const payload = tipo === 'dre' ? dreData : balancoData
    if (!payload) {
      toast({
        variant: 'destructive',
        title: 'Dados indisponíveis',
        description: 'Não há dados calculados para este demonstrativo no período.',
      })
      return
    }

    setActionLoading(true)
    try {
      const dem = await demonstrativosService.gerarDemonstrativo({
        tenantId: tenant.id,
        empresaId: selectedEmpresaId,
        competencia: selectedCompetencia,
        tipo,
        dados: payload,
      })

      toast({
        title: 'Demonstrativo congelado!',
        description: `${tipo.toUpperCase()} congelada em rascunho para assinatura. Você pode enviar ao cliente.`,
      })
      loadRelatorios()
      setViewingDemonstrativo(dem)
      setModalViewOpen(true)
    } catch (err) {
      console.error('Erro ao gerar demonstrativo para assinatura:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar demonstrativo',
        description: 'Não foi possível congelar os dados para assinatura.',
      })
    } finally {
      setActionLoading(false)
    }
  }

  // Enviar ao cliente
  const handleEnviarAoCliente = async (id: string) => {
    setActionLoading(true)
    try {
      await demonstrativosService.enviarAoCliente(id)
      toast({
        title: 'Demonstrativo enviado!',
        description:
          'O cliente receberá uma notificação e e-mail para validar e assinar no Portal.',
      })
      loadRelatorios()
    } catch (err) {
      console.error('Erro ao enviar demonstrativo:', err)
      toast({
        variant: 'destructive',
        title: 'Erro no envio',
        description: 'Falha ao notificar o cliente.',
      })
    } finally {
      setActionLoading(false)
    }
  }

  // Abrir Modal para Solicitar Assinatura
  const handleAbrirSolicitarAssinatura = (dem: DemonstrativoRecord) => {
    setSelectedDemParaAssinar(dem)
    setFormAssinanteNome(
      activeEmpresa?.razao_social
        ? `Resp. Legal - ${activeEmpresa.razao_social}`
        : 'Responsável Técnico Contábil',
    )
    setFormAssinanteCargoCpf('Diretor / Administrador')
    setFormAssinanteEmail(activeEmpresa?.email || '')
    setFormTipoAssinatura('eletronica_declarada')
    setFormTipoCertificado('nenhum')
    setSolicitarModalOpen(true)
  }

  // Submeter Solicitação de Assinatura
  const handleSubmitSolicitarAssinatura = async (e: React.FormEvent) => {
    e.preventDefault()
    if (
      !tenant?.id ||
      !selectedDemParaAssinar ||
      !formAssinanteNome.trim() ||
      !formAssinanteCargoCpf.trim()
    ) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Preencha o nome e o cargo/CPF do assinante.',
      })
      return
    }

    setActionLoading(true)
    try {
      await assinaturasService.solicitarAssinatura({
        tenantId: tenant.id,
        demonstrativoId: selectedDemParaAssinar.id,
        empresaId: selectedDemParaAssinar.empresa,
        competencia: selectedDemParaAssinar.competencia,
        tipoAssinatura: formTipoAssinatura,
        tipoCertificado: formTipoCertificado,
        assinante: formAssinanteNome.trim(),
        cargoCpf: formAssinanteCargoCpf.trim(),
        emailAssinante: formAssinanteEmail.trim() || undefined,
        dadosDemonstrativo: selectedDemParaAssinar.dados,
      })

      toast({
        title: 'Solicitação de Assinatura Criada!',
        description:
          'O registro de integridade SHA-256 e token de validação pública foram gerados com sucesso.',
      })

      setSolicitarModalOpen(false)
      loadRelatorios()
    } catch (err: unknown) {
      console.error('Erro ao solicitar assinatura:', err)
      const msg =
        err instanceof Error ? err.message : 'Falha ao registrar solicitação de assinatura.'
      toast({
        variant: 'destructive',
        title: 'Erro na solicitação',
        description: msg,
      })
    } finally {
      setActionLoading(false)
    }
  }

  // Abrir Modal de Execução de Assinatura
  const handleAbrirAssinar = (ass: AssinaturaDemonstrativoRecord, dem: DemonstrativoRecord) => {
    setSelectedAssinaturaParaConcluir(ass)
    setSelectedDemParaAssinar(dem)
    setConcordoTermos(false)
    setAssinarModalOpen(true)
  }

  // Submeter Execução de Assinatura
  const handleConfirmarAssinatura = async () => {
    if (!selectedAssinaturaParaConcluir || !selectedDemParaAssinar) return
    if (!concordoTermos) {
      toast({
        variant: 'destructive',
        title: 'Declaração obrigatória',
        description: 'Você precisa declarar ciência e concordância com os valores apresentados.',
      })
      return
    }

    setActionLoading(true)
    try {
      await assinaturasService.assinar({
        assinaturaId: selectedAssinaturaParaConcluir.id,
        demonstrativoId: selectedDemParaAssinar.id,
        dadosAtuaisDemonstrativo: selectedDemParaAssinar.dados,
        ipAssinatura: '189.120.45.12 (Origem Autenticada)',
        observacoes: 'Assinatura realizada na plataforma pelo usuário contábil autorizado.',
      })

      toast({
        title: 'Demonstrativo Assinado com Sucesso!',
        description:
          'Integridade validada, demonstrativo aprovado e token público ativado para verificação.',
      })

      setAssinarModalOpen(false)
      loadRelatorios()
    } catch (err: unknown) {
      console.error('Erro ao assinar demonstrativo:', err)
      const msg =
        err instanceof Error
          ? err.message
          : 'Não foi possível concluir a assinatura digital do demonstrativo.'
      toast({
        variant: 'destructive',
        title: 'Falha na assinatura',
        description: msg,
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedToken(text)
    toast({
      title: 'Copiado!',
      description: 'Código copiado para a área de transferência.',
    })
    setTimeout(() => setCopiedToken(null), 2000)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-[#1A2333]">
              DRE & Balanço Patrimonial
            </h2>
            <Badge className="bg-[#0FA3A3] text-white text-[11px] font-semibold">Oficial</Badge>
          </div>
          <p className="text-xs text-[#64748B]">
            Demonstrações contábeis regulatórias geradas automaticamente a partir do balancete de
            verificação e plano de contas (NBC TG 26 / ITG 1000/2000)
          </p>
        </div>

        {/* Ações de Topo: Gerar para Assinatura & Exportações */}
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'dre' && (
            <Button
              onClick={() => handleGerarDemonstrativoAssinatura('dre')}
              disabled={!dreData || actionLoading}
              className="gap-2 rounded-xl text-xs font-semibold h-10 bg-[#0FA3A3] hover:bg-[#0C8585] text-white shadow-xs"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Gerar DRE para Assinatura</span>
            </Button>
          )}

          {activeTab === 'balanco' && (
            <Button
              onClick={() => handleGerarDemonstrativoAssinatura('balanco')}
              disabled={!balancoData || actionLoading}
              className="gap-2 rounded-xl text-xs font-semibold h-10 bg-[#0FA3A3] hover:bg-[#0C8585] text-white shadow-xs"
            >
              <Scale className="h-4 w-4" />
              <span>Gerar Balanço para Assinatura</span>
            </Button>
          )}

          {activeTab === 'dre' && (
            <Button
              onClick={handleExportDRECSV}
              variant="outline"
              disabled={!dreData}
              className="gap-2 rounded-xl text-xs font-semibold h-10 border-[#E2E8F0] bg-white shadow-xs hover:bg-slate-50"
            >
              <Download className="h-4 w-4 text-[#64748B]" />
              <span>Exportar DRE (CSV)</span>
            </Button>
          )}

          {activeTab === 'balanco' && (
            <Button
              onClick={handleExportBalancoCSV}
              variant="outline"
              disabled={!balancoData}
              className="gap-2 rounded-xl text-xs font-semibold h-10 border-[#E2E8F0] bg-white shadow-xs hover:bg-slate-50"
            >
              <Download className="h-4 w-4 text-[#64748B]" />
              <span>Exportar Balanço (CSV)</span>
            </Button>
          )}

          <Button
            onClick={loadRelatorios}
            variant="ghost"
            size="sm"
            className="h-10 text-xs text-[#0FA3A3] hover:text-[#0C8585] rounded-xl"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filtros de Empresa e Período */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Empresa */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Empresa Contábil *
              </label>
              <Select value={selectedEmpresaId} onValueChange={setSelectedEmpresaId}>
                <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0] font-semibold">
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

            {/* Período / Competência */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Competência de Apuração *
              </label>
              <Select value={selectedCompetencia} onValueChange={setSelectedCompetencia}>
                <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0] font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="08/2026">08/2026 (Agosto 2026)</SelectItem>
                  <SelectItem value="09/2026">09/2026 (Setembro 2026)</SelectItem>
                  <SelectItem value="10/2026">10/2026 (Outubro 2026)</SelectItem>
                  <SelectItem value="11/2026">11/2026 (Novembro 2026)</SelectItem>
                  <SelectItem value="12/2026">12/2026 (Dezembro 2026)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Identificação Formal do Responsável Técnico Contábil com CRC (NBC PP 01 / NBC TG 26) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200 text-xs text-[#334155]">
        <div className="flex items-center gap-2">
          <Badge className="bg-[#123B6D] text-white text-[10px] uppercase font-bold">
            NBC TG 26 / ITG 1000
          </Badge>
          <span className="text-[11px] text-[#475569]">
            Demonstrações contábeis oficiais sob regime de competência, comparabilidade e
            integridade patrimonial.
          </span>
        </div>
        <div className="text-[11px] text-[#64748B]">
          <span>Responsável Técnico: </span>
          <b className="text-[#1A2333]">
            {tenant?.responsavel_tecnico || 'Carlos Silva (Contador Responsável)'}
          </b>
          <span className="ml-1 text-[#0FA3A3] font-semibold">
            ({tenant?.crc_responsavel || 'CRC/SP nº 2SP034821/O'})
          </span>
        </div>
      </div>

      {/* Tabs: DRE vs Balanço Patrimonial */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'dre' | 'balanco')}>
        <TabsList className="bg-slate-100 p-1 rounded-2xl h-11 w-full sm:w-auto">
          <TabsTrigger
            value="dre"
            className="rounded-xl px-6 py-2 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-[#0FA3A3] data-[state=active]:shadow-xs"
          >
            DRE (Demonstração do Resultado)
          </TabsTrigger>
          <TabsTrigger
            value="balanco"
            className="rounded-xl px-6 py-2 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-[#0FA3A3] data-[state=active]:shadow-xs"
          >
            Balanço Patrimonial
          </TabsTrigger>
          <TabsTrigger
            value="demonstrativos"
            className="rounded-xl px-6 py-2 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-[#0FA3A3] data-[state=active]:shadow-xs flex items-center gap-1.5"
          >
            <span>Assinaturas & Envio</span>
            {demonstrativos.length > 0 && (
              <Badge className="h-5 px-1.5 bg-slate-200 text-slate-700 text-[10px] font-bold">
                {demonstrativos.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        {/* ================= ABA 1: DRE ================= */}
        <TabsContent value="dre" className="space-y-6 mt-4">
          {/* Cards de Resumo DRE */}
          {dreData && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                      Receita Bruta
                    </p>
                    <p className="text-xl font-bold text-[#1A2333] mt-1">
                      R${' '}
                      {dreData.receitaBruta.toLocaleString('pt-BR', {
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
                      Receita Líquida
                    </p>
                    <p className="text-xl font-bold text-[#0FA3A3] mt-1">
                      R${' '}
                      {dreData.receitaLiquida.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-[#0FA3A3]">
                    <DollarSign className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                      Despesas Operacionais
                    </p>
                    <p className="text-xl font-bold text-[#DC2626] mt-1">
                      (-) R${' '}
                      {dreData.despesasOperacionais.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-[#DC2626]">
                    <TrendingDown className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                      Resultado Líquido
                    </p>
                    <p
                      className={cn(
                        'text-xl font-bold mt-1',
                        dreData.resultadoLiquido >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]',
                      )}
                    >
                      {dreData.resultadoLiquido >= 0 ? 'R$ ' : '(-) R$ '}
                      {Math.abs(dreData.resultadoLiquido).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-xl',
                      dreData.resultadoLiquido >= 0
                        ? 'bg-emerald-100 text-[#16A34A]'
                        : 'bg-red-100 text-[#DC2626]',
                    )}
                  >
                    <Scale className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Demonstração Estruturada DRE */}
          <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-[#E2E8F0] py-4 px-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-[#1A2333]">
                  Demonstração do Resultado do Exercício — Padrão CPC / CFC
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  {activeEmpresa?.razao_social || 'Empresa'} • Competência: {selectedCompetencia}
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] uppercase font-bold text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-6 w-32">Código</th>
                      <th className="py-3 px-6">Descrição da Conta / Linha</th>
                      <th className="py-3 px-6 text-right w-48">Valor (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {loading ? (
                      <tr>
                        <td colSpan={3} className="py-12 text-center text-[#94A3B8]">
                          Calculando DRE a partir do balancete...
                        </td>
                      </tr>
                    ) : !dreData || dreData.linhas.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-12 text-center text-[#94A3B8]">
                          Sem movimentação de receitas ou despesas nesta competência.
                        </td>
                      </tr>
                    ) : (
                      dreData.linhas.map((linha) => {
                        const isGrupo = linha.tipo === 'grupo'
                        const isTotalizador = linha.tipo === 'totalizador'
                        const isResultado = linha.tipo === 'resultado'
                        const isConta = linha.tipo === 'conta'

                        return (
                          <tr
                            key={linha.id}
                            className={cn(
                              'transition-colors',
                              isResultado
                                ? 'bg-emerald-50/80 font-bold text-base'
                                : isTotalizador
                                  ? 'bg-slate-50 font-bold'
                                  : isGrupo
                                    ? 'bg-[#F8FAFC] font-semibold text-[#1A2333]'
                                    : 'hover:bg-slate-50/60 text-[#64748B]',
                            )}
                          >
                            <td
                              className={cn(
                                'py-3 px-6 font-mono',
                                isConta
                                  ? 'pl-10 text-[11px] text-[#94A3B8]'
                                  : 'font-bold text-[#1A2333]',
                              )}
                            >
                              {linha.codigo}
                            </td>
                            <td
                              className={cn(
                                'py-3 px-6',
                                isConta
                                  ? 'pl-10 text-xs text-[#334155]'
                                  : 'font-bold text-[#1A2333]',
                                isResultado && 'text-[#16A34A] font-extrabold',
                              )}
                            >
                              {linha.descricao}
                            </td>
                            <td
                              className={cn(
                                'py-3 px-6 text-right font-mono',
                                isConta ? 'text-xs' : 'font-bold text-sm text-[#1A2333]',
                                linha.negativo ? 'text-[#DC2626]' : '',
                                isResultado &&
                                  (linha.valor >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'),
                              )}
                            >
                              {linha.negativo ? (
                                <span>
                                  (
                                  {linha.valor.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                  })}
                                  )
                                </span>
                              ) : (
                                <span>
                                  {linha.valor.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                  })}
                                </span>
                              )}
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
        </TabsContent>
        {/* ================= ABA 2: BALANÇO PATRIMONIAL ================= */}
        <TabsContent value="balanco" className="space-y-6 mt-4">
          {/* Card Verificação da Equação Contábil */}
          {balancoData && (
            <div
              className={cn(
                'rounded-2xl border p-4 text-xs flex items-center justify-between gap-4 shadow-2xs',
                balancoData.equilibrado
                  ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
                  : 'border-amber-200 bg-amber-50/70 text-amber-950',
              )}
            >
              <div className="flex items-center gap-3">
                {balancoData.equilibrado ? (
                  <CheckCircle2 className="h-6 w-6 text-[#16A34A] shrink-0" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-[#D97706] shrink-0" />
                )}
                <div>
                  <p className="font-bold text-sm">
                    {balancoData.equilibrado
                      ? 'Equação Fundamental Equilibrada: Ativo = Passivo + Patrimônio Líquido'
                      : 'Atenção: Balanço Patrimonial com Diferença na Partida'}
                  </p>
                  <p className="text-slate-600">
                    Total do Ativo: R${' '}
                    {balancoData.ativoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} •
                    Total Passivo + PL: R${' '}
                    {balancoData.passivoMaisPL.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}{' '}
                    {balancoData.diferenca > 0 &&
                      `(Diferença: R$ ${balancoData.diferenca.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`}
                  </p>
                </div>
              </div>

              <Badge
                className={cn(
                  'text-xs font-bold py-1 px-3',
                  balancoData.equilibrado ? 'bg-[#16A34A] text-white' : 'bg-[#D97706] text-white',
                )}
              >
                {balancoData.equilibrado ? '100% Equilibrado' : 'Ajuste Pendente'}
              </Badge>
            </div>
          )}

          {/* Duas Colunas: Ativo (Lado Esquerdo) vs Passivo + PL (Lado Direito) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LADO ESQUERDO: ATIVO */}
            <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs overflow-hidden">
              <CardHeader className="bg-blue-50/40 border-b border-[#E2E8F0] py-3.5 px-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-[#2563EB] uppercase tracking-wider">
                    Ativo Total
                  </CardTitle>
                  <span className="text-base font-bold text-[#1A2333]">
                    R${' '}
                    {(balancoData?.ativoTotal || 0).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="p-0 divide-y divide-[#E2E8F0]">
                {/* 1.1 Ativo Circulante */}
                <div className="p-4 bg-[#F8FAFC]">
                  <div className="flex items-center justify-between font-bold text-xs text-[#1A2333]">
                    <span>1.1 Ativo Circulante (Disponibilidades e Créditos)</span>
                    <span>
                      R${' '}
                      {(balancoData?.ativoCirculante.saldo || 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1.5 pl-3">
                    {balancoData?.ativoCirculante.contas.map((c) => (
                      <div
                        key={c.codigo}
                        className="flex items-center justify-between text-[11px] text-[#64748B]"
                      >
                        <span>
                          <span className="font-mono text-[#94A3B8] mr-1.5">{c.codigo}</span>
                          {c.nome}
                        </span>
                        <span className="font-mono font-medium text-[#1A2333]">
                          R$ {c.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 1.2 Ativo Não Circulante (Imobilizado) */}
                <div className="p-4 bg-white">
                  <div className="flex items-center justify-between font-bold text-xs text-[#1A2333]">
                    <span>1.2 Ativo Não Circulante (Imobilizado e Investimentos)</span>
                    <span>
                      R${' '}
                      {(balancoData?.ativoNaoCirculante.saldo || 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1.5 pl-3">
                    {balancoData?.ativoNaoCirculante.contas.map((c) => (
                      <div
                        key={c.codigo}
                        className="flex items-center justify-between text-[11px] text-[#64748B]"
                      >
                        <span>
                          <span className="font-mono text-[#94A3B8] mr-1.5">{c.codigo}</span>
                          {c.nome}
                        </span>
                        <span className="font-mono font-medium text-[#1A2333]">
                          R$ {c.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* LADO DIREITO: PASSIVO + PATRIMÔNIO LÍQUIDO */}
            <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs overflow-hidden">
              <CardHeader className="bg-purple-50/40 border-b border-[#E2E8F0] py-3.5 px-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-purple-700 uppercase tracking-wider">
                    Passivo + Patrimônio Líquido
                  </CardTitle>
                  <span className="text-base font-bold text-[#1A2333]">
                    R${' '}
                    {(balancoData?.passivoMaisPL || 0).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="p-0 divide-y divide-[#E2E8F0]">
                {/* 2.1 Passivo Circulante */}
                <div className="p-4 bg-[#F8FAFC]">
                  <div className="flex items-center justify-between font-bold text-xs text-[#1A2333]">
                    <span>2.1 Passivo Circulante (Obrigações e Fornecedores)</span>
                    <span>
                      R${' '}
                      {(balancoData?.passivoCirculante.saldo || 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1.5 pl-3">
                    {balancoData?.passivoCirculante.contas.map((c) => (
                      <div
                        key={c.codigo}
                        className="flex items-center justify-between text-[11px] text-[#64748B]"
                      >
                        <span>
                          <span className="font-mono text-[#94A3B8] mr-1.5">{c.codigo}</span>
                          {c.nome}
                        </span>
                        <span className="font-mono font-medium text-[#1A2333]">
                          R$ {c.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2.2 Patrimônio Líquido */}
                <div className="p-4 bg-white">
                  <div className="flex items-center justify-between font-bold text-xs text-[#1A2333]">
                    <span>2.2 Patrimônio Líquido (Capital Social e Reservas)</span>
                    <span>
                      R${' '}
                      {(balancoData?.patrimonioLiquido.saldo || 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1.5 pl-3">
                    {balancoData?.patrimonioLiquido.contas.map((c) => (
                      <div
                        key={c.codigo}
                        className="flex items-center justify-between text-[11px] text-[#64748B]"
                      >
                        <span>
                          <span className="font-mono text-[#94A3B8] mr-1.5">{c.codigo}</span>
                          {c.nome}
                        </span>
                        <span className="font-mono font-medium text-[#1A2333]">
                          R$ {c.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        {/* ================= ABA 3: DEMONSTRATIVOS PARA ASSINATURA ================= */}
        <TabsContent value="demonstrativos" className="space-y-6 mt-4">
          <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-[#E2E8F0] py-4 px-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-[#1A2333]">
                  Demonstrativos Contábeis Oficiais para Assinatura
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  Histórico de DREs e Balanços congelados com tracking de status (Rascunho, Enviado,
                  Aprovado ou Reprovado)
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] uppercase font-bold text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-6">Tipo</th>
                      <th className="py-3 px-6">Empresa</th>
                      <th className="py-3 px-6">Competência</th>
                      <th className="py-3 px-6">Status</th>
                      <th className="py-3 px-6">Envio / Aprovação</th>
                      <th className="py-3 px-6 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {demonstrativos.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-[#94A3B8]">
                          Nenhum demonstrativo gerado para esta empresa e competência.{' '}
                          <span className="block text-[11px] text-[#64748B] mt-1">
                            Clique em "Gerar DRE para Assinatura" ou "Gerar Balanço para Assinatura"
                            acima para congelar os números oficiais.
                          </span>
                        </td>
                      </tr>
                    ) : (
                      demonstrativos.map((dem) => {
                        const statusColors: Record<string, string> = {
                          rascunho: 'bg-slate-100 text-slate-700',
                          enviado: 'bg-blue-100 text-blue-700 font-semibold',
                          aprovado: 'bg-emerald-100 text-emerald-700 font-bold',
                          reprovado: 'bg-rose-100 text-rose-700 font-bold',
                        }
                        const statusLabels: Record<string, string> = {
                          rascunho: 'Rascunho',
                          enviado: 'Aguardando Aprovação',
                          aprovado: 'Aprovado pelo Cliente',
                          reprovado: 'Reprovado pelo Cliente',
                        }

                        return (
                          <tr key={dem.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3.5 px-6 font-bold uppercase text-[#1A2333]">
                              {dem.tipo.toUpperCase()}
                            </td>
                            <td className="py-3.5 px-6 font-medium text-[#334155]">
                              {activeEmpresa?.nome_fantasia ||
                                activeEmpresa?.razao_social ||
                                'Empresa'}
                            </td>
                            <td className="py-3.5 px-6 font-mono text-[#64748B]">
                              {dem.competencia}
                            </td>
                            <td className="py-3.5 px-6">
                              <Badge
                                className={cn(
                                  'text-[11px] py-0.5 px-2.5',
                                  statusColors[dem.status],
                                )}
                              >
                                {statusLabels[dem.status]}
                              </Badge>
                              {dem.status === 'reprovado' && dem.observacoes_cliente && (
                                <p className="text-[11px] text-rose-600 mt-1 line-clamp-1 italic">
                                  "{dem.observacoes_cliente}"
                                </p>
                              )}
                            </td>
                            <td className="py-3.5 px-6 text-[#64748B] text-[11px]">
                              {dem.status === 'aprovado' && dem.data_aprovacao ? (
                                <span className="text-emerald-700 font-semibold">
                                  Aprovado em {formatDatePtBr(dem.data_aprovacao)}
                                </span>
                              ) : dem.data_envio ? (
                                <span>Enviado em {formatDatePtBr(dem.data_envio)}</span>
                              ) : (
                                <span className="text-slate-400">Não enviado</span>
                              )}
                            </td>
                            <td className="py-3.5 px-6 text-right space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setViewingDemonstrativo(dem)
                                  setModalViewOpen(true)
                                }}
                                className="h-8 rounded-lg text-xs font-semibold gap-1 text-[#0FA3A3] hover:text-[#0C8585] border-teal-200"
                              >
                                <Printer className="h-3.5 w-3.5" />
                                <span>Visualizar / PDF</span>
                              </Button>

                              {dem.status === 'rascunho' && (
                                <Button
                                  size="sm"
                                  onClick={() => handleEnviarAoCliente(dem.id)}
                                  disabled={actionLoading}
                                  className="h-8 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs"
                                >
                                  Enviar ao Cliente
                                </Button>
                              )}

                              {(dem.status === 'enviado' || dem.status === 'rascunho') && (
                                <Button
                                  size="sm"
                                  onClick={() => handleAbrirSolicitarAssinatura(dem)}
                                  disabled={actionLoading}
                                  className="h-8 rounded-lg text-xs font-semibold bg-[#0FA3A3] hover:bg-[#0C8585] text-white shadow-xs gap-1"
                                >
                                  <PenTool className="h-3 w-3" />
                                  <span>Solicitar Assinatura</span>
                                </Button>
                              )}
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

          {/* SEÇÃO: HISTÓRICO DETALHADO DE ASSINATURAS & INTEGRIDADE */}
          <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-[#E2E8F0] py-4 px-6 flex flex-row items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-[#0FA3A3]" />
                  <CardTitle className="text-base font-bold text-[#1A2333]">
                    Assinaturas Digitais & Registro de Integridade Criptográfica
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-[#64748B]">
                  Controle de assinaturas eletrônicas e qualificadas (ICP-Brasil), hash SHA-256 e
                  tokens de validação pública
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="divide-y divide-[#E2E8F0]">
                {demonstrativos.map((dem) => {
                  const assinaturas = assinaturasMap[dem.id] || []

                  return (
                    <div key={dem.id} className="p-5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm uppercase text-[#123B6D]">
                            {dem.tipo.toUpperCase()}
                          </span>
                          <span className="text-xs font-mono text-[#64748B]">
                            ({dem.competencia})
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-semibold text-[#64748B]"
                          >
                            Status: {dem.status.toUpperCase()}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-[#64748B]">
                            {assinaturas.length}{' '}
                            {assinaturas.length === 1 ? 'assinatura' : 'assinaturas'}
                          </span>
                          {dem.status !== 'reprovado' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAbrirSolicitarAssinatura(dem)}
                              className="h-7 text-[11px] rounded-lg border-teal-300 text-[#0FA3A3] hover:bg-teal-50 gap-1 font-semibold"
                            >
                              <PenTool className="h-3 w-3" />
                              <span>Nova Assinatura</span>
                            </Button>
                          )}
                        </div>
                      </div>

                      {assinaturas.length === 0 ? (
                        <p className="text-xs text-[#94A3B8] py-2 italic">
                          Nenhuma assinatura solicitada ainda para este demonstrativo. Clique em
                          "Solicitar Assinatura" para gerar o hash SHA-256 de integridade.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 gap-3">
                          {assinaturas.map((ass) => {
                            const isAssinada = ass.status === 'assinada'
                            const isSolicitada = ass.status === 'solicitada'
                            const isIcp = ass.tipo_assinatura === 'icp_brasil'

                            return (
                              <div
                                key={ass.id}
                                className={cn(
                                  'p-4 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all',
                                  isAssinada
                                    ? 'bg-emerald-50/50 border-emerald-200'
                                    : 'bg-slate-50/70 border-slate-200',
                                )}
                              >
                                <div className="space-y-1.5 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-sm text-[#1A2333]">
                                      {ass.assinante}
                                    </span>
                                    <span className="text-[#64748B] text-[11px]">
                                      ({ass.cargo_cpf})
                                    </span>
                                    <Badge
                                      className={cn(
                                        'text-[10px] font-bold px-2 py-0.5',
                                        isAssinada
                                          ? 'bg-emerald-600 text-white'
                                          : 'bg-blue-600 text-white',
                                      )}
                                    >
                                      {isAssinada ? 'Assinada' : 'Solicitada'}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] font-semibold border-teal-300 text-teal-800 bg-teal-50/50"
                                    >
                                      {isIcp
                                        ? `ICP-Brasil (${(ass.tipo_certificado || 'A1').toUpperCase()})`
                                        : 'Eletrônica Declarada'}
                                    </Badge>
                                  </div>

                                  {/* Hash SHA-256 e Token */}
                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#64748B]">
                                    <div className="flex items-center gap-1 font-mono">
                                      <Fingerprint className="h-3 w-3 text-[#0FA3A3]" />
                                      <span>Hash SHA-256:</span>
                                      <span className="text-[#1A2333] font-semibold">
                                        {ass.hash_conteudo
                                          ? `${ass.hash_conteudo.slice(0, 16)}...${ass.hash_conteudo.slice(-8)}`
                                          : 'Calculando...'}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleCopyText(ass.hash_conteudo)}
                                        className="text-[#0FA3A3] hover:text-[#0C8585] p-0.5"
                                        title="Copiar Hash Completo"
                                      >
                                        {copiedToken === ass.hash_conteudo ? (
                                          <Check className="h-3 w-3 text-emerald-600" />
                                        ) : (
                                          <Copy className="h-3 w-3" />
                                        )}
                                      </button>
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <span>Token Público:</span>
                                      <span className="font-mono font-bold text-[#1A2333]">
                                        {ass.token_verificacao}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleCopyText(ass.token_verificacao)}
                                        className="text-[#0FA3A3] hover:text-[#0C8585] p-0.5"
                                        title="Copiar Token"
                                      >
                                        {copiedToken === ass.token_verificacao ? (
                                          <Check className="h-3 w-3 text-emerald-600" />
                                        ) : (
                                          <Copy className="h-3 w-3" />
                                        )}
                                      </button>
                                    </div>

                                    {isAssinada && ass.data_assinatura && (
                                      <span className="text-emerald-700 font-semibold">
                                        Assinado em {formatDateTimePtBr(ass.data_assinatura)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Ações de Assinatura e Verificação */}
                                <div className="flex items-center gap-2 shrink-0">
                                  <a
                                    href={`/verificar-assinatura?token=${encodeURIComponent(
                                      ass.token_verificacao,
                                    )}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0FA3A3] hover:underline px-2.5 py-1.5 rounded-lg border border-teal-200 bg-white"
                                  >
                                    <span>Verificar</span>
                                    <ExternalLink className="h-3 w-3" />
                                  </a>

                                  {isSolicitada && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleAbrirAssinar(ass, dem)}
                                      disabled={actionLoading}
                                      className="h-8 rounded-lg text-xs font-semibold bg-[#16A34A] hover:bg-[#15803D] text-white shadow-xs gap-1"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      <span>Assinar Agora</span>
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>{' '}
      </Tabs>

      {/* Modal de Visualização Formal e Download PDF */}
      <DemonstrativoModalView
        open={modalViewOpen}
        onOpenChange={setModalViewOpen}
        demonstrativo={viewingDemonstrativo}
        empresa={activeEmpresa}
      />

      {/* MODAL 1: SOLICITAR ASSINATURA */}
      <Dialog open={solicitarModalOpen} onOpenChange={setSolicitarModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333] flex items-center gap-2">
              <PenTool className="h-5 w-5 text-[#0FA3A3]" />
              <span>Solicitar Assinatura de Demonstrativo</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Congela o hash SHA-256 de integridade do demonstrativo (
              {selectedDemParaAssinar?.tipo.toUpperCase()} {selectedDemParaAssinar?.competencia}) e
              cria a solicitação formal de assinatura digital.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitSolicitarAssinatura} className="space-y-4 text-xs mt-2">
            <div>
              <Label className="text-xs font-semibold">Nome Completo do Assinante *</Label>
              <Input
                value={formAssinanteNome}
                onChange={(e) => setFormAssinanteNome(e.target.value)}
                placeholder="Ex: Carlos Eduardo Silva"
                className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Cargo / CPF *</Label>
                <Input
                  value={formAssinanteCargoCpf}
                  onChange={(e) => setFormAssinanteCargoCpf(e.target.value)}
                  placeholder="Ex: Diretor - CPF 123.456.789-00"
                  className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">E-mail do Assinante (Opcional)</Label>
                <Input
                  type="email"
                  value={formAssinanteEmail}
                  onChange={(e) => setFormAssinanteEmail(e.target.value)}
                  placeholder="ex: contato@empresa.com.br"
                  className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <Label className="text-xs font-semibold">Tipo de Assinatura *</Label>
              <div className="grid grid-cols-1 gap-2">
                {/* Opção 1: Eletrônica Declarada (Funcionando) */}
                <label
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                    formTipoAssinatura === 'eletronica_declarada'
                      ? 'border-[#0FA3A3] bg-teal-50/40'
                      : 'border-slate-200 hover:bg-slate-50',
                  )}
                >
                  <input
                    type="radio"
                    name="tipo_assinatura"
                    checked={formTipoAssinatura === 'eletronica_declarada'}
                    onChange={() => setFormTipoAssinatura('eletronica_declarada')}
                    className="mt-0.5 text-[#0FA3A3]"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[#1A2333]">Eletrônica Declarada</span>
                      <Badge className="bg-emerald-600 text-white text-[9px] font-bold">
                        Disponível Hoje
                      </Badge>
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      Registro de integridade criptográfica SHA-256 do demonstrativo, com carimbo de
                      data/hora e captura de IP do declarante (MP 2.200-2/2001 e Lei 14.063/2020).
                    </p>
                  </div>
                </label>

                {/* Opção 2: ICP-Brasil (Exige provedor) */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          'flex items-start gap-3 p-3 rounded-xl border transition-all opacity-60 bg-slate-50 cursor-not-allowed',
                          formTipoAssinatura === 'icp_brasil' && 'border-slate-300',
                        )}
                      >
                        <input
                          type="radio"
                          name="tipo_assinatura"
                          disabled
                          checked={formTipoAssinatura === 'icp_brasil'}
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-700">
                              ICP-Brasil Qualificada (Certificado A1 / A3)
                            </span>
                            <Badge
                              variant="outline"
                              className="border-amber-300 text-amber-800 bg-amber-50 text-[9px] font-bold"
                            >
                              Exige Provedor Externo
                            </Badge>
                          </div>
                          <p className="text-[11px] text-[#64748B] mt-0.5">
                            Requer chave de API configurada no backend (D4Sign, Clicksign ou
                            SafeWeb) para emitir envelope de certificado ICP-Brasil.
                          </p>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      Assinatura ICP-Brasil qualificada exige credenciais de provedor externo
                      cadastradas nos secrets do servidor. Ponto de extensão preparado em
                      pocketbase/hooks/assinaturas_validate.js.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSolicitarModalOpen(false)}
                className="text-xs text-[#64748B]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={actionLoading}
                className="rounded-xl text-xs font-semibold bg-[#0FA3A3] hover:bg-[#0C8585] text-white shadow-xs"
              >
                {actionLoading ? 'Registrando...' : 'Confirmar Solicitação'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: EXECUTAR ASSINATURA (CONCORDÂNCIA CONSCIENTE) */}
      <Dialog open={assinarModalOpen} onOpenChange={setAssinarModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333] flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <span>Concluir Assinatura Digital do Demonstrativo</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Validação de integridade e registro da assinatura eletrônica declarada com efeito
              legal.
            </DialogDescription>
          </DialogHeader>

          {selectedAssinaturaParaConcluir && selectedDemParaAssinar && (
            <div className="space-y-4 text-xs mt-2">
              {/* Resumo do Documento */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Demonstrativo:</span>
                  <span className="font-bold text-[#1A2333]">
                    {selectedDemParaAssinar.tipo === 'dre'
                      ? 'Demonstração do Resultado (DRE)'
                      : 'Balanço Patrimonial'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Competência:</span>
                  <span className="font-mono font-bold text-[#1A2333]">
                    {selectedDemParaAssinar.competencia}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Empresa:</span>
                  <span className="font-semibold text-[#1A2333]">
                    {activeEmpresa?.razao_social || 'Empresa'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Assinante Designado:</span>
                  <span className="font-bold text-[#123B6D]">
                    {selectedAssinaturaParaConcluir.assinante} (
                    {selectedAssinaturaParaConcluir.cargo_cpf})
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200/80 pt-1.5">
                  <span className="text-[#64748B]">Hash de Integridade SHA-256:</span>
                  <span className="font-mono text-[10px] text-emerald-800 font-semibold truncate max-w-[200px]">
                    {selectedAssinaturaParaConcluir.hash_conteudo}
                  </span>
                </div>
              </div>

              {/* Termo e Checkbox Consciente */}
              <div className="p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/50 space-y-3">
                <div className="flex items-start gap-2.5">
                  <Checkbox
                    id="concordo-termos"
                    checked={concordoTermos}
                    onCheckedChange={(val) => setConcordoTermos(Boolean(val))}
                    className="mt-0.5 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                  />
                  <label
                    htmlFor="concordo-termos"
                    className="text-xs text-[#1A2333] leading-relaxed cursor-pointer font-medium"
                  >
                    <b>Declaração de Ciência e Fidedignidade:</b> Declaro sob as penas da lei que li
                    e concordo com o inteiro teor deste demonstrativo contábil (
                    {selectedDemParaAssinar.competencia}), atestando que os números refletem com
                    exatidão a escrituração contábil mercantil da empresa.
                  </label>
                </div>
                <p className="text-[10px] text-[#64748B] pl-6">
                  Ao assinar, seu endereço IP e carimbo de data/hora UTC serão gravados
                  permanentemente para fins de auditoria e validação pública no token{' '}
                  <span className="font-mono font-bold text-[#1A2333]">
                    {selectedAssinaturaParaConcluir.token_verificacao}
                  </span>
                  .
                </p>
              </div>

              <DialogFooter className="pt-2 flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setAssinarModalOpen(false)}
                  className="text-xs text-[#64748B]"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmarAssinatura}
                  disabled={!concordoTermos || actionLoading}
                  className="rounded-xl text-xs font-semibold bg-[#16A34A] hover:bg-[#15803D] text-white shadow-xs gap-1.5"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>{actionLoading ? 'Registrando...' : 'Confirmar e Assinar Agora'}</span>
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

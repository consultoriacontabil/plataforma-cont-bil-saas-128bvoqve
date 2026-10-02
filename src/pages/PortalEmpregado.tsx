import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RumoLogo } from '@/components/RumoLogo'
import {
  ShieldCheck,
  ShieldAlert,
  FileText,
  UserCheck,
  Calendar,
  DollarSign,
  Download,
  Printer,
  Palmtree,
  FileSpreadsheet,
  Lock,
  LogOut,
  Building2,
  RefreshCw,
  Eye,
  EyeOff,
  ChevronRight,
  Clock,
  Sparkles,
  AlertCircle,
  FileCheck2,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react'
import { portalEmpregadoService } from '@/services/portalEmpregado'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { maskCpf, formatDatePtBr, maskCnpj } from '@/lib/formatters'
import type {
  Funcionario,
  FolhaPagamento,
  FeriasPeriodoRecord,
  RescisaoRecord,
  Empresa,
} from '@/types'

export default function PortalEmpregadoPage() {
  const [searchParams] = useSearchParams()
  const tokenUrl = searchParams.get('token') || ''
  const cpfUrl = searchParams.get('cpf') || ''

  const { toast } = useToast()

  // Estado de Autenticação
  const [cpfInput, setCpfInput] = useState(cpfUrl)
  const [tokenInput, setTokenInput] = useState(tokenUrl)
  const [autenticando, setAutenticando] = useState(false)
  const [erroLogin, setErroLogin] = useState('')

  // Sessão do Empregado Autenticado
  const [funcionario, setFuncionario] = useState<Funcionario | null>(null)
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [tokenAtivo, setTokenAtivo] = useState<string>('')

  // Abas e Dados
  const [activeTab, setActiveTab] = useState<'holerites' | 'ferias' | 'trct' | 'dados'>('holerites')
  const [loadingDados, setLoadingDados] = useState(false)
  const [holerites, setHolerites] = useState<FolhaPagamento[]>([])
  const [feriasList, setFeriasList] = useState<FeriasPeriodoRecord[]>([])
  const [rescisoesList, setRescisoesList] = useState<RescisaoRecord[]>([])

  // Visualizador / Impressão de Holerite
  const [selectedHolerite, setSelectedHolerite] = useState<FolhaPagamento | null>(null)
  const [modalHoleriteOpen, setModalHoleriteOpen] = useState(false)

  // Visualizador / Impressão de TRCT
  const [selectedRescisao, setSelectedRescisao] = useState<RescisaoRecord | null>(null)
  const [modalTrctOpen, setModalTrctOpen] = useState(false)

  // Visualizador / Impressão de Recibo de Férias
  const [selectedFerias, setSelectedFerias] = useState<FeriasPeriodoRecord | null>(null)
  const [modalFeriasOpen, setModalFeriasOpen] = useState(false)

  // Controle de Sigilo LGPD na tela (ocultar/mostrar valores)
  const [ocultarValores, setOcultarValores] = useState(false)

  // Autenticação automática se vier com token e cpf na URL
  useEffect(() => {
    if (tokenUrl && cpfUrl && !funcionario) {
      handleLogin(cpfUrl, tokenUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenUrl, cpfUrl])

  const handleLogin = async (cpf: string, tokenOuCodigo: string) => {
    setAutenticando(true)
    setErroLogin('')
    try {
      const res = await portalEmpregadoService.autenticar({
        cpf,
        tokenOuCodigo,
      })

      if (!res.sucesso || !res.funcionario) {
        setErroLogin(res.erro || 'Falha na autenticação.')
        return
      }

      setFuncionario(res.funcionario)
      setEmpresa(res.empresa || null)
      setTokenAtivo(res.tokenAcesso || tokenOuCodigo)

      toast({
        title: 'Bem-vindo ao Portal do Empregado!',
        description: `Olá, ${res.funcionario.nome_completo}. Seus holerites e benefícios estão disponíveis.`,
      })

      // Carregar dados de folha, férias e rescisões
      carregarDadosColaborador(res.funcionario.id)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao autenticar.'
      setErroLogin(msg)
    } finally {
      setAutenticando(false)
    }
  }

  const carregarDadosColaborador = async (funcionarioId: string) => {
    setLoadingDados(true)
    try {
      const [hols, fers, rescs] = await Promise.all([
        portalEmpregadoService.getHolerites(funcionarioId),
        portalEmpregadoService.getFerias(funcionarioId),
        portalEmpregadoService.getRescisoes(funcionarioId),
      ])
      setHolerites(hols)
      setFeriasList(fers)
      setRescisoesList(rescs)
    } catch (err) {
      console.warn('Erro ao carregar dados do portal do empregado:', err)
    } finally {
      setLoadingDados(false)
    }
  }

  const handleLogout = () => {
    setFuncionario(null)
    setEmpresa(null)
    setTokenAtivo('')
    setHolerites([])
    setFeriasList([])
    setRescisoesList([])
    setCpfInput('')
    setTokenInput('')
  }

  // Visualizar / Imprimir Holerite
  const handleVisualizarHolerite = (hol: FolhaPagamento) => {
    setSelectedHolerite(hol)
    setModalHoleriteOpen(true)
    if (funcionario) {
      portalEmpregadoService.registrarAuditoriaAcesso(
        funcionario.tenant_id,
        funcionario.id,
        funcionario.nome_completo,
        'DOWNLOAD_HOLERITE',
        `Competência ${hol.competencia}`,
      )
    }
  }

  // Visualizar / Imprimir TRCT
  const handleVisualizarTrct = (rec: RescisaoRecord) => {
    setSelectedRescisao(rec)
    setModalTrctOpen(true)
    if (funcionario) {
      portalEmpregadoService.registrarAuditoriaAcesso(
        funcionario.tenant_id,
        funcionario.id,
        funcionario.nome_completo,
        'DOWNLOAD_TRCT',
        `Rescisão data ${rec.data_desligamento}`,
      )
    }
  }

  // Visualizar Férias
  const handleVisualizarFerias = (fer: FeriasPeriodoRecord) => {
    setSelectedFerias(fer)
    setModalFeriasOpen(true)
    if (funcionario) {
      portalEmpregadoService.registrarAuditoriaAcesso(
        funcionario.tenant_id,
        funcionario.id,
        funcionario.nome_completo,
        'DOWNLOAD_AVISO_FERIAS',
        `Período ${fer.periodo_aquisitivo_inicio}`,
      )
    }
  }

  // Máscaras LGPD
  const formatLgpdCpf = (cpfRaw: string) => {
    const limpo = cpfRaw.replace(/\D/g, '')
    if (limpo.length !== 11) return cpfRaw
    return `${limpo.slice(0, 3)}.***.***-${limpo.slice(9, 11)}`
  }

  const formatLgpdCtps = (num?: string) => {
    if (!num) return '***'
    return `***${num.slice(-3)}`
  }

  // ================= TELA DE LOGIN DO EMPREGADO =================
  if (!funcionario) {
    return (
      <div className="min-h-screen bg-[#F6F7F9] text-[#1A2333] flex flex-col justify-between">
        <header className="flex h-16 w-full items-center justify-between border-b border-[#E2E8F0] bg-white px-4 md:px-8 shadow-2xs">
          <RumoLogo
            size={36}
            variant="light"
            title="Portal do Empregado"
            subtitle="Rumo Consultoria Contábil • Acesso do Trabalhador"
          />
          <Badge
            variant="outline"
            className="text-[11px] font-medium border-teal-200 text-teal-800 bg-teal-50 gap-1.5"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-[#0FA3A3]" />
            <span className="hidden sm:inline">Ambiente Seguro LGPD</span>
          </Badge>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md rounded-2xl border-slate-200/90 bg-white shadow-xl overflow-hidden">
            <div className="h-2 bg-[#0FA3A3]" />
            <CardHeader className="text-center pb-2 pt-6">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-[#0FA3A3]">
                <UserCheck className="h-7 w-7" />
              </div>
              <CardTitle className="text-xl font-bold text-[#1A2333]">
                Portal do Empregado
              </CardTitle>
              <CardDescription className="text-xs text-[#64748B]">
                Consulte seus holerites, espelho de férias e demonstrativos de rescisão emitidos
                pela sua empresa.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-2">
              {erroLogin && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{erroLogin}</span>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleLogin(cpfInput, tokenInput)
                }}
                className="space-y-3.5"
              >
                <div className="space-y-1">
                  <Label htmlFor="login-cpf" className="text-xs font-semibold text-[#1A2333]">
                    Seu CPF
                  </Label>
                  <Input
                    id="login-cpf"
                    value={cpfInput}
                    onChange={(e) => setCpfInput(e.target.value)}
                    placeholder="000.000.000-00"
                    required
                    className="h-10 text-xs rounded-xl border-[#E2E8F0]"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="login-token" className="text-xs font-semibold text-[#1A2333]">
                    Código de Acesso ou Link Recebido
                  </Label>
                  <Input
                    id="login-token"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Ex: 6 dígitos (ABC123) ou token completo"
                    required
                    className="h-10 text-xs rounded-xl border-[#E2E8F0] font-mono tracking-wider"
                  />
                  <p className="text-[11px] text-[#64748B]">
                    Fornecido pela contabilidade ou enviado para o seu WhatsApp/e-mail.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={autenticando || !cpfInput || !tokenInput}
                  className="w-full h-10 text-xs font-bold rounded-xl bg-[#0FA3A3] text-white hover:bg-[#0C8585] shadow-xs gap-2"
                >
                  {autenticando ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Validando acesso...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      <span>Entrar no Portal</span>
                    </>
                  )}
                </Button>
              </form>

              <div className="pt-3 border-t border-slate-100 flex items-start gap-2 text-[11px] text-[#64748B]">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Segurança e Privacidade:</strong> Seus dados salariais e cadastrais são
                  protegidos com criptografia. Apenas você tem acesso ao seu histórico funcional.
                </p>
              </div>
            </CardContent>
          </Card>
        </main>

        <footer className="py-4 text-center text-xs text-[#94A3B8] border-t border-slate-100 bg-white">
          Plataforma Contábil SaaS • Portal do Empregado • Rumo Consultoria Contábil
        </footer>
      </div>
    )
  }

  // ================= TELA INTERNA DO EMPREGADO AUTENTICADO =================
  const nomeEmpresa =
    empresa?.nome_fantasia ||
    empresa?.razao_social ||
    funcionario.expand?.empresa?.nome_fantasia ||
    funcionario.expand?.empresa?.razao_social ||
    'Sua Empresa'

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-[#1A2333] flex flex-col justify-between">
      {/* Topbar do Empregado */}
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#E2E8F0] bg-white px-4 md:px-8 shadow-2xs">
        <div className="flex items-center gap-3">
          <RumoLogo
            size={36}
            variant="light"
            title="Portal do Empregado"
            subtitle={`${nomeEmpresa} • Área do Trabalhador`}
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Alternar Sigilo de Valores */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOcultarValores(!ocultarValores)}
            className="h-8 text-xs gap-1.5 border-slate-200"
            title={ocultarValores ? 'Exibir valores' : 'Ocultar valores da tela'}
          >
            {ocultarValores ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">
              {ocultarValores ? 'Exibir Valores' : 'Ocultar Valores'}
            </span>
          </Button>

          {/* Botão Sair */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="h-8 text-xs gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Banner de Boas-vindas e Perfil */}
        <Card className="rounded-2xl border-slate-200/90 bg-white shadow-2xs overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-[#0FA3A3] via-[#0C8585] to-[#2563EB]" />
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-[#0FA3A3] shrink-0 font-bold text-base">
                  {funcionario.nome_completo
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg sm:text-xl font-bold text-[#1A2333]">
                      {funcionario.nome_completo}
                    </h1>
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold gap-1">
                      <ShieldCheck className="h-3 w-3" /> Colaborador Ativo
                    </Badge>
                  </div>
                  <p className="text-xs text-[#64748B]">
                    Cargo: <strong>{funcionario.cargo}</strong> • Tipo:{' '}
                    {funcionario.tipo.toUpperCase()}
                  </p>
                  <p className="text-[11px] text-[#64748B] flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-[#0FA3A3]" />
                    <span>
                      {nomeEmpresa}{' '}
                      {empresa?.cnpj && (
                        <span className="font-mono text-slate-500">
                          (CNPJ: {maskCnpj(empresa.cnpj)})
                        </span>
                      )}
                    </span>
                  </p>
                </div>
              </div>

              {/* Informações rápidas de admissão e salário */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex sm:flex-col justify-between sm:justify-center text-xs sm:text-right shrink-0">
                <div>
                  <span className="text-[10px] font-medium text-[#64748B] block">ADMISSÃO</span>
                  <span className="font-semibold text-[#1A2333]">
                    {formatDatePtBr(funcionario.data_admissao)}
                  </span>
                </div>
                <div className="sm:mt-2">
                  <span className="text-[10px] font-medium text-[#64748B] block">SALÁRIO BASE</span>
                  <span className="font-mono font-bold text-[#0FA3A3]">
                    {ocultarValores
                      ? 'R$ •••••••'
                      : `R$ ${funcionario.salario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Abas: Holerites, Férias, Rescisões, Dados Cadastrais */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          className="space-y-4"
        >
          <TabsList className="bg-white border border-[#E2E8F0] p-1 rounded-2xl w-full flex flex-wrap h-auto justify-start gap-1 shadow-2xs">
            <TabsTrigger
              value="holerites"
              className="gap-1.5 rounded-xl text-xs py-2 px-3.5 data-[state=active]:bg-[#0FA3A3] data-[state=active]:text-white font-medium"
            >
              <FileText className="h-4 w-4" />
              <span>Holerites ({holerites.length})</span>
            </TabsTrigger>

            <TabsTrigger
              value="ferias"
              className="gap-1.5 rounded-xl text-xs py-2 px-3.5 data-[state=active]:bg-[#0FA3A3] data-[state=active]:text-white font-medium"
            >
              <Palmtree className="h-4 w-4" />
              <span>Extrato de Férias ({feriasList.length})</span>
            </TabsTrigger>

            <TabsTrigger
              value="trct"
              className="gap-1.5 rounded-xl text-xs py-2 px-3.5 data-[state=active]:bg-[#0FA3A3] data-[state=active]:text-white font-medium"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>TRCT / Rescisão ({rescisoesList.length})</span>
            </TabsTrigger>

            <TabsTrigger
              value="dados"
              className="gap-1.5 rounded-xl text-xs py-2 px-3.5 data-[state=active]:bg-[#0FA3A3] data-[state=active]:text-white font-medium"
            >
              <UserCheck className="h-4 w-4" />
              <span>Dados Cadastrais (LGPD)</span>
            </TabsTrigger>
          </TabsList>

          {/* ================= ABA 1: HOLERITES ================= */}
          <TabsContent value="holerites" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#0FA3A3]" />
                  Recibos de Pagamento Mensais (Holerites)
                </h2>
                <p className="text-xs text-[#64748B]">
                  Consulte os demonstrativos de proventos, descontos de INSS/IRRF e valor líquido.
                </p>
              </div>
            </div>

            {loadingDados ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-2">
                <RefreshCw className="h-6 w-6 animate-spin text-[#0FA3A3]" />
                <p className="text-xs text-[#64748B]">Buscando holerites...</p>
              </div>
            ) : holerites.length === 0 ? (
              <Card className="rounded-2xl border-slate-200 bg-white p-8 text-center shadow-2xs">
                <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-[#1A2333]">
                  Nenhum holerite processado ainda
                </h3>
                <p className="text-xs text-[#64748B] mt-1 max-w-sm mx-auto">
                  Assim que o departamento pessoal concluir o fechamento da folha da sua empresa,
                  seus recibos aparecerão aqui.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {holerites.map((hol) => (
                  <Card
                    key={hol.id}
                    className="rounded-2xl border-slate-200 bg-white shadow-2xs hover:border-teal-300 transition-all overflow-hidden flex flex-col justify-between"
                  >
                    <div className="p-4 sm:p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-[#0FA3A3]">
                            <Calendar className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider block">
                              COMPETÊNCIA
                            </span>
                            <span className="text-base font-bold text-[#1A2333]">
                              {hol.competencia}
                            </span>
                          </div>
                        </div>

                        <Badge
                          className={
                            hol.status === 'paga'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }
                        >
                          {hol.status === 'paga' ? 'Pago' : 'Processado'}
                        </Badge>
                      </div>

                      {/* Resumo de Proventos, Descontos e Líquido */}
                      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                        <div>
                          <span className="text-[10px] text-[#64748B] block">Salário Base</span>
                          <span className="font-mono font-semibold text-slate-700">
                            {ocultarValores
                              ? '••••'
                              : `R$ ${hol.salario_base.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-amber-700 block">Deduções</span>
                          <span className="font-mono font-semibold text-amber-700">
                            {ocultarValores
                              ? '••••'
                              : `- R$ ${(hol.inss + hol.irrf).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-emerald-700 block font-bold">
                            Líquido
                          </span>
                          <span className="font-mono font-bold text-emerald-700">
                            {ocultarValores
                              ? '••••'
                              : `R$ ${hol.total_liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#64748B] pt-1">
                        <span>FGTS Depositado (8%):</span>
                        <span className="font-mono font-medium text-slate-700">
                          {ocultarValores
                            ? '••••'
                            : `R$ ${hol.fgts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-[#64748B]">Emissão oficial do DP</span>
                      <Button
                        size="sm"
                        onClick={() => handleVisualizarHolerite(hol)}
                        className="h-8 text-xs gap-1.5 bg-[#0FA3A3] text-white hover:bg-[#0C8585] rounded-xl"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>Ver / Imprimir Holerite</span>
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ================= ABA 2: FÉRIAS ================= */}
          <TabsContent value="ferias" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
                  <Palmtree className="h-4 w-4 text-[#0FA3A3]" />
                  Extrato e Programação de Férias
                </h2>
                <p className="text-xs text-[#64748B]">
                  Períodos aquisitivos, saldo de dias de descanso e recibos de aviso prévio.
                </p>
              </div>
            </div>

            {loadingDados ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-2">
                <RefreshCw className="h-6 w-6 animate-spin text-[#0FA3A3]" />
                <p className="text-xs text-[#64748B]">Consultando períodos de férias...</p>
              </div>
            ) : feriasList.length === 0 ? (
              <Card className="rounded-2xl border-slate-200 bg-white p-8 text-center shadow-2xs">
                <Palmtree className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-[#1A2333]">Nenhum registro de férias</h3>
                <p className="text-xs text-[#64748B] mt-1 max-w-sm mx-auto">
                  Os períodos aquisitivos calculados e as concessões de férias agendadas constarão
                  aqui.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {feriasList.map((fer) => (
                  <Card
                    key={fer.id}
                    className="rounded-2xl border-slate-200 bg-white shadow-2xs p-4 sm:p-5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#1A2333]">
                            Período Aquisitivo: {formatDatePtBr(fer.periodo_aquisitivo_inicio)} até{' '}
                            {formatDatePtBr(fer.periodo_aquisitivo_fim)}
                          </span>
                          <Badge
                            className={
                              fer.status === 'pago'
                                ? 'bg-emerald-50 text-emerald-700'
                                : fer.status === 'aprovado'
                                  ? 'bg-sky-50 text-sky-700'
                                  : 'bg-amber-50 text-amber-700'
                            }
                          >
                            {fer.status.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-xs text-[#64748B]">
                          Gozo de Férias: <strong>{fer.dias_gozo} dias</strong> (
                          {formatDatePtBr(fer.data_inicio_gozo)} a{' '}
                          {formatDatePtBr(fer.data_fim_gozo)})
                          {fer.vender_abono && fer.dias_abono
                            ? ` • Abono Pecuniário: ${fer.dias_abono} dias`
                            : ''}
                        </p>
                        {fer.data_limite_pagamento && (
                          <p className="text-[11px] text-amber-700">
                            Limite de pagamento (CLT Art. 145):{' '}
                            {formatDatePtBr(fer.data_limite_pagamento)}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {fer.total_liquido > 0 && (
                          <div className="text-right mr-2">
                            <span className="text-[10px] text-[#64748B] block">Valor Líquido</span>
                            <span className="font-mono font-bold text-emerald-700 text-sm">
                              {ocultarValores
                                ? '••••'
                                : `R$ ${fer.total_liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                            </span>
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleVisualizarFerias(fer)}
                          className="text-xs gap-1 border-slate-200"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>Recibo</span>
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ================= ABA 3: RESCISÕES & TRCT ================= */}
          <TabsContent value="trct" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-[#0FA3A3]" />
                  Termos de Rescisão do Contrato de Trabalho (TRCT)
                </h2>
                <p className="text-xs text-[#64748B]">
                  Espelho do termo homologatório com discriminação de verbas rescisórias e guias.
                </p>
              </div>
            </div>

            {loadingDados ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-2">
                <RefreshCw className="h-6 w-6 animate-spin text-[#0FA3A3]" />
                <p className="text-xs text-[#64748B]">Buscando rescisões...</p>
              </div>
            ) : rescisoesList.length === 0 ? (
              <Card className="rounded-2xl border-slate-200 bg-white p-8 text-center shadow-2xs">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-[#1A2333]">Contrato de Trabalho Ativo</h3>
                <p className="text-xs text-[#64748B] mt-1 max-w-sm mx-auto">
                  Você não possui processos rescisórios em aberto. Seu contrato de trabalho
                  encontra-se vigente.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {rescisoesList.map((resc) => (
                  <Card
                    key={resc.id}
                    className="rounded-2xl border-slate-200 bg-white shadow-2xs p-4 sm:p-5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#1A2333]">
                            Desligamento: {formatDatePtBr(resc.data_desligamento)}
                          </span>
                          <Badge className="bg-rose-50 text-rose-700 border-rose-200">
                            {resc.status.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-xs text-[#64748B]">
                          Motivo: <strong>{resc.motivo_desligamento}</strong> • Aviso Prévio:{' '}
                          {resc.dias_aviso_previo} dias
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Prazo quitação Art. 477: {formatDatePtBr(resc.prazo_pagamento_limite)}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] text-[#64748B] block">
                            Líquido Rescisório
                          </span>
                          <span className="font-mono font-bold text-emerald-700 text-sm">
                            {ocultarValores
                              ? '••••'
                              : `R$ ${resc.total_liquido_rescisao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleVisualizarTrct(resc)}
                          className="text-xs gap-1.5 bg-[#0FA3A3] text-white hover:bg-[#0C8585] rounded-xl"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>Ver TRCT</span>
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ================= ABA 4: DADOS CADASTRAIS (LGPD) ================= */}
          <TabsContent value="dados" className="space-y-4">
            <Card className="rounded-2xl border-slate-200 bg-white shadow-2xs p-5 sm:p-6 space-y-4">
              <div>
                <h2 className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#0FA3A3]" />
                  Ficha Cadastral Funcional • Conformidade e-Social & LGPD
                </h2>
                <p className="text-xs text-[#64748B]">
                  Em atendimento à Lei Geral de Proteção de Dados (Lei nº 13.709/2018), seus dados
                  sensíveis são exibidos sob máscara de segurança. Para correções cadastrais, entre
                  em contato com o RH ou contabilidade.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold uppercase text-[#64748B] block">
                    Nome Completo
                  </span>
                  <span className="text-xs font-semibold text-[#1A2333]">
                    {funcionario.nome_completo}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold uppercase text-[#64748B] block">
                    CPF (Mascarado LGPD)
                  </span>
                  <span className="text-xs font-mono font-semibold text-[#1A2333]">
                    {formatLgpdCpf(funcionario.cpf)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold uppercase text-[#64748B] block">
                    Cargo / Função
                  </span>
                  <span className="text-xs font-semibold text-[#1A2333]">
                    {funcionario.cargo} {funcionario.cbo && `(CBO: ${funcionario.cbo})`}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold uppercase text-[#64748B] block">
                    CTPS Digital
                  </span>
                  <span className="text-xs font-mono font-semibold text-[#1A2333]">
                    {formatLgpdCtps(funcionario.ctps_numero)} / {funcionario.ctps_serie || '***'}-
                    {funcionario.ctps_uf || 'SP'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold uppercase text-[#64748B] block">
                    PIS / NIS (Mascarado)
                  </span>
                  <span className="text-xs font-mono font-semibold text-[#1A2333]">
                    {funcionario.nis_pis ? `***${funcionario.nis_pis.slice(-4)}` : 'Não informado'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold uppercase text-[#64748B] block">
                    Data de Admissão
                  </span>
                  <span className="text-xs font-semibold text-[#1A2333]">
                    {formatDatePtBr(funcionario.data_admissao)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold uppercase text-[#64748B] block">
                    Regime de Contratação
                  </span>
                  <span className="text-xs font-semibold text-[#1A2333] uppercase">
                    {funcionario.tipo} (Consolidação das Leis do Trabalho)
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold uppercase text-[#64748B] block">
                    Empresa Empregadora
                  </span>
                  <span className="text-xs font-semibold text-[#1A2333]">{nomeEmpresa}</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold uppercase text-[#64748B] block">
                    Matrícula e-Social
                  </span>
                  <span className="text-xs font-mono font-semibold text-[#1A2333]">
                    {funcionario.matricula_esocial || 'Gerada automaticamente'}
                  </span>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* ================= MODAL DE IMPRESSÃO / VISUALIZAÇÃO DO HOLERITE ================= */}
      <Dialog open={modalHoleriteOpen} onOpenChange={setModalHoleriteOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-6 rounded-2xl bg-white shadow-2xl">
          <DialogHeader className="print:hidden pb-2 border-b">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-base font-bold text-[#1A2333]">
                  Recibo de Pagamento de Salário
                </DialogTitle>
                <DialogDescription className="text-xs text-[#64748B]">
                  Competência {selectedHolerite?.competencia}
                </DialogDescription>
              </div>
              <Button
                size="sm"
                onClick={() => window.print()}
                className="gap-1.5 h-8 text-xs bg-[#0FA3A3] text-white hover:bg-[#0C8585]"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Imprimir / Salvar PDF</span>
              </Button>
            </div>
          </DialogHeader>

          {selectedHolerite && (
            <div className="p-4 sm:p-6 border border-slate-300 rounded-xl bg-white space-y-4 font-sans text-xs">
              {/* Cabeçalho da Empresa */}
              <div className="border-b pb-3 flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-sm text-[#1A2333] uppercase">{nomeEmpresa}</h3>
                  <p className="text-[11px] text-[#64748B] font-mono">
                    CNPJ:{' '}
                    {empresa?.cnpj
                      ? maskCnpj(empresa.cnpj)
                      : selectedHolerite.expand?.empresa?.cnpj || '—'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-xs uppercase block text-[#0FA3A3]">
                    Recibo de Pagamento
                  </span>
                  <span className="font-mono text-xs text-[#1A2333]">
                    Comp: {selectedHolerite.competencia}
                  </span>
                </div>
              </div>

              {/* Dados do Empregado */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-2.5 bg-slate-50 rounded-lg text-[11px]">
                <div>
                  <span className="text-[#64748B] block">Colaborador:</span>
                  <span className="font-bold text-[#1A2333]">{funcionario.nome_completo}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block">CPF:</span>
                  <span className="font-mono text-[#1A2333]">{maskCpf(funcionario.cpf)}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block">Cargo:</span>
                  <span className="text-[#1A2333]">{funcionario.cargo}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block">Admissão:</span>
                  <span className="text-[#1A2333]">
                    {formatDatePtBr(funcionario.data_admissao)}
                  </span>
                </div>
              </div>

              {/* Tabela de Rubricas / Proventos / Descontos */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-[11px] h-8">Cód / Rubrica</TableHead>
                      <TableHead className="text-[11px] h-8">Descrição</TableHead>
                      <TableHead className="text-[11px] h-8 text-right">Referência</TableHead>
                      <TableHead className="text-[11px] h-8 text-right">Proventos (R$)</TableHead>
                      <TableHead className="text-[11px] h-8 text-right">Descontos (R$)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-[11px]">
                    <TableRow>
                      <TableCell className="font-mono">001</TableCell>
                      <TableCell className="font-medium">Salário Base Mensal</TableCell>
                      <TableCell className="text-right">30d</TableCell>
                      <TableCell className="text-right font-mono">
                        {selectedHolerite.salario_base.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-right font-mono">—</TableCell>
                    </TableRow>
                    {selectedHolerite.inss > 0 && (
                      <TableRow>
                        <TableCell className="font-mono">101</TableCell>
                        <TableCell>INSS Folha de Pagamento</TableCell>
                        <TableCell className="text-right">Tabela CLT</TableCell>
                        <TableCell className="text-right font-mono">—</TableCell>
                        <TableCell className="text-right font-mono text-amber-700">
                          {selectedHolerite.inss.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                      </TableRow>
                    )}
                    {selectedHolerite.irrf > 0 && (
                      <TableRow>
                        <TableCell className="font-mono">102</TableCell>
                        <TableCell>IRRF Retido na Fonte</TableCell>
                        <TableCell className="text-right">Tabela IR</TableCell>
                        <TableCell className="text-right font-mono">—</TableCell>
                        <TableCell className="text-right font-mono text-amber-700">
                          {selectedHolerite.irrf.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Totais */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg text-xs">
                <div>
                  <span className="text-[#64748B] block text-[10px]">TOTAL DE VENCIMENTOS</span>
                  <span className="font-mono font-bold text-[#1A2333]">
                    R${' '}
                    {selectedHolerite.salario_base.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-amber-700 block text-[10px]">TOTAL DE DEDUÇÕES</span>
                  <span className="font-mono font-bold text-amber-700">
                    - R${' '}
                    {(selectedHolerite.inss + selectedHolerite.irrf).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-emerald-700 block text-[10px] font-bold">
                    VALOR LÍQUIDO A RECEBER
                  </span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">
                    R${' '}
                    {selectedHolerite.total_liquido.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              {/* Rodapé e Bases de Cálculo */}
              <div className="grid grid-cols-4 gap-2 text-[10px] text-[#64748B] border-t pt-2">
                <div>
                  <span>Sal. Contrib. INSS:</span>{' '}
                  <strong className="text-[#1A2333]">
                    R$ {selectedHolerite.salario_base.toFixed(2)}
                  </strong>
                </div>
                <div>
                  <span>Base FGTS:</span>{' '}
                  <strong className="text-[#1A2333]">
                    R$ {selectedHolerite.salario_base.toFixed(2)}
                  </strong>
                </div>
                <div>
                  <span>FGTS do Mês:</span>{' '}
                  <strong className="text-[#1A2333]">R$ {selectedHolerite.fgts.toFixed(2)}</strong>
                </div>
                <div>
                  <span>Base IRRF:</span>{' '}
                  <strong className="text-[#1A2333]">
                    R$ {(selectedHolerite.salario_base - selectedHolerite.inss).toFixed(2)}
                  </strong>
                </div>
              </div>

              {/* Assinatura / Quitação */}
              <div className="pt-6 border-t border-dashed text-center text-[10px] text-[#64748B]">
                <p>
                  Declaro ter recebido a importância líquida discriminada neste recibo de pagamento.
                </p>
                <div className="mt-8 flex justify-center">
                  <div className="border-t border-slate-400 w-64 pt-1">
                    <span>{funcionario.nome_completo}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ================= MODAL TRCT ================= */}
      <Dialog open={modalTrctOpen} onOpenChange={setModalTrctOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-6 rounded-2xl bg-white shadow-2xl">
          <DialogHeader className="print:hidden pb-2 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-bold text-[#1A2333]">
                Termo de Rescisão do Contrato de Trabalho (TRCT)
              </DialogTitle>
              <Button
                size="sm"
                onClick={() => window.print()}
                className="gap-1.5 h-8 text-xs bg-[#0FA3A3] text-white hover:bg-[#0C8585]"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Imprimir TRCT</span>
              </Button>
            </div>
          </DialogHeader>

          {selectedRescisao && (
            <div className="p-4 sm:p-6 border rounded-xl bg-white space-y-4 font-sans text-xs">
              <div className="border-b pb-3 flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-sm uppercase text-[#1A2333]">{nomeEmpresa}</h3>
                  <p className="text-[11px] text-[#64748B]">
                    CNPJ: {selectedRescisao.expand?.empresa?.cnpj || '—'}
                  </p>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  TRCT Portaria MTE nº 1.057
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-2.5 bg-slate-50 rounded-lg text-[11px]">
                <div>
                  <span className="text-[#64748B] block">Trabalhador:</span>
                  <span className="font-bold text-[#1A2333]">{funcionario.nome_completo}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block">CPF:</span>
                  <span className="font-mono text-[#1A2333]">{maskCpf(funcionario.cpf)}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block">Desligamento:</span>
                  <span className="font-bold text-[#1A2333]">
                    {formatDatePtBr(selectedRescisao.data_desligamento)}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block">Causa do Afastamento:</span>
                  <span className="text-[#1A2333]">{selectedRescisao.motivo_desligamento}</span>
                </div>
              </div>

              {/* Discriminativo das Verbas */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-[11px]">Rubrica / Descrição</TableHead>
                      <TableHead className="text-[11px] text-right">Proventos (R$)</TableHead>
                      <TableHead className="text-[11px] text-right">Descontos (R$)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-[11px]">
                    {selectedRescisao.verbas_rescisorias_detalhadas?.map((vb, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <span className="font-mono text-slate-400 mr-2">[{vb.rubrica}]</span>
                          {vb.descricao}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {vb.tipo === 'provento' ? vb.valor.toFixed(2) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-rose-600">
                          {vb.tipo === 'desconto' ? vb.valor.toFixed(2) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Totais do TRCT */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg text-xs">
                <div>
                  <span className="text-[#64748B] block text-[10px]">TOTAL BRUTO</span>
                  <span className="font-mono font-bold text-[#1A2333]">
                    R$ {selectedRescisao.total_bruto_rescisao.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-emerald-700 block text-[10px] font-bold">
                    VALOR LÍQUIDO RESCISÓRIO
                  </span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">
                    R$ {selectedRescisao.total_liquido_rescisao.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="pt-6 border-t border-dashed flex justify-between text-center text-[10px] text-[#64748B]">
                <div className="border-t border-slate-400 w-48 pt-1">Assinatura Empregador</div>
                <div className="border-t border-slate-400 w-48 pt-1">Assinatura Empregado</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ================= MODAL FÉRIAS ================= */}
      <Dialog open={modalFeriasOpen} onOpenChange={setModalFeriasOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-6 rounded-2xl bg-white shadow-2xl">
          <DialogHeader className="print:hidden pb-2 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-bold text-[#1A2333]">
                Recibo de Aviso e Concessão de Férias
              </DialogTitle>
              <Button
                size="sm"
                onClick={() => window.print()}
                className="gap-1.5 h-8 text-xs bg-[#0FA3A3] text-white hover:bg-[#0C8585]"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Imprimir</span>
              </Button>
            </div>
          </DialogHeader>

          {selectedFerias && (
            <div className="p-4 sm:p-6 border rounded-xl bg-white space-y-4 font-sans text-xs">
              <div className="border-b pb-3 flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-sm uppercase text-[#1A2333]">{nomeEmpresa}</h3>
                  <p className="text-[11px] text-[#64748B]">
                    CNPJ: {selectedFerias.expand?.empresa?.cnpj || '—'}
                  </p>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  Aviso de Férias CLT Art. 135
                </Badge>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
                <p>
                  <strong>Colaborador:</strong> {funcionario.nome_completo} (CPF:{' '}
                  {maskCpf(funcionario.cpf)})
                </p>
                <p>
                  <strong>Período Aquisitivo:</strong>{' '}
                  {formatDatePtBr(selectedFerias.periodo_aquisitivo_inicio)} até{' '}
                  {formatDatePtBr(selectedFerias.periodo_aquisitivo_fim)}
                </p>
                <p>
                  <strong>Dias de Gozo:</strong> {selectedFerias.dias_gozo} dias (
                  {formatDatePtBr(selectedFerias.data_inicio_gozo)} a{' '}
                  {formatDatePtBr(selectedFerias.data_fim_gozo)})
                  {selectedFerias.vender_abono && selectedFerias.dias_abono
                    ? ` | Abono Pecuniário: ${selectedFerias.dias_abono} dias`
                    : ''}
                </p>
                {selectedFerias.total_liquido > 0 && (
                  <p className="pt-2 text-emerald-700 font-bold">
                    Valor Líquido de Férias (+ 1/3 Constitucional): R${' '}
                    {selectedFerias.total_liquido.toFixed(2)}
                  </p>
                )}
              </div>

              <div className="pt-6 border-t border-dashed flex justify-between text-center text-[10px] text-[#64748B]">
                <div className="border-t border-slate-400 w-48 pt-1">Assinatura Empregador</div>
                <div className="border-t border-slate-400 w-48 pt-1">Ciente do Empregado</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Footer Geral */}
      <footer className="py-4 text-center text-xs text-[#94A3B8] border-t border-slate-100 bg-white">
        Plataforma Contábil SaaS • Portal do Empregado • Rumo Consultoria Contábil • LGPD & e-Social
        Compliance
      </footer>
    </div>
  )
}

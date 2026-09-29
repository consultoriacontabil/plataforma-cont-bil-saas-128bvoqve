import React, { useState, useEffect, useCallback, useMemo } from 'react'
import pb from '@/lib/pocketbase/client'
import {
  Send,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  FileCode2,
  Lock,
  Unlock,
  Building2,
  Calendar,
  Search,
  Filter,
  CheckCheck,
  Download,
  AlertCircle,
  KeyRound,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { useToast } from '@/hooks/use-toast'
import { esocialService } from '@/services/esocial'
import { BadgeTransmissaoAutonomia } from '@/components/BadgeTransmissaoAutonomia'
import type {
  Empresa,
  EsocialEventoRecord,
  EsocialConfigRecord,
  EsocialEventoTipo,
  EsocialEventoStatus,
  EsocialDiagnosticoCredenciais,
  UserRole,
} from '@/types'
import { formatDatePtBr, formatDateTimePtBr } from '@/lib/formatters'

interface PainelEsocialProps {
  tenantId: string
  userId: string
  userRole?: UserRole
  empresas: Empresa[]
  selectedEmpresaId: string
  onSelectEmpresaId: (id: string) => void
  selectedCompetencia: string
  onSelectCompetencia: (comp: string) => void
  onAbrirFichaColaborador?: (funcionarioId: string) => void
}

export const PainelEsocial: React.FC<PainelEsocialProps> = ({
  tenantId,
  userId,
  userRole,
  empresas,
  selectedEmpresaId,
  onSelectEmpresaId,
  selectedCompetencia,
  onSelectCompetencia,
  onAbrirFichaColaborador,
}) => {
  const { toast } = useToast()

  const [eventos, setEventos] = useState<EsocialEventoRecord[]>([])
  const [config, setConfig] = useState<EsocialConfigRecord | null>(null)
  const [certAtivoEmpresa, setCertAtivoEmpresa] = useState<boolean>(false)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [transmittingId, setTransmittingId] = useState<string | null>(null)

  // Filtros da Fila
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

  // Modal Ver XML
  const [modalXmlOpen, setModalXmlOpen] = useState(false)
  const [eventoXmlVisualizando, setEventoXmlVisualizando] = useState<EsocialEventoRecord | null>(
    null,
  )

  // Modal Diagnóstico de Credenciais
  const [modalDiagOpen, setModalDiagOpen] = useState(false)
  const [diagResultado, setDiagResultado] = useState<EsocialDiagnosticoCredenciais | null>(null)
  const [testandoCredenciais, setTestandoCredenciais] = useState(false)

  // Modal Fechamento S-1299
  const [modalFechamentoOpen, setModalFechamentoOpen] = useState(false)
  const [fechandoComp, setFechandoComp] = useState(false)

  // Modal Reabertura S-1298
  const [modalReaberturaOpen, setModalReaberturaOpen] = useState(false)
  const [motivoReabertura, setMotivoReabertura] = useState('')
  const [reabrindoComp, setReabrindoComp] = useState(false)

  // Permissões
  const canEdit = userRole === 'administrador' || userRole === 'contador'
  const isCliente = userRole === 'cliente'

  // Carregar Eventos e Configuração
  const carregarDados = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const [evts, cfg, certs] = await Promise.all([
        esocialService.listEventos(tenantId, {
          empresaId: selectedEmpresaId,
          competencia: selectedCompetencia,
          tipoEvento: filtroTipo,
          status: filtroStatus,
        }),
        selectedEmpresaId !== 'todas'
          ? esocialService.getConfig(tenantId, selectedEmpresaId)
          : Promise.resolve(null),
        selectedEmpresaId !== 'todas'
          ? pb
              .collection('certificados_digitais')
              .getFullList({
                filter: `tenant_id = "${tenantId}" && empresa = "${selectedEmpresaId}" && status = "ativo"`,
              })
              .catch(() => [])
          : Promise.resolve([]),
      ])
      setEventos(evts)
      setConfig(cfg)
      setCertAtivoEmpresa(Boolean(cfg?.certificado_a1 || (certs && certs.length > 0)))
    } catch (err) {
      console.error('Erro ao carregar e-Social:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar e-Social',
        description: 'Não foi possível carregar os eventos da fila.',
      })
    } finally {
      setLoading(false)
    }
  }, [tenantId, selectedEmpresaId, selectedCompetencia, filtroTipo, filtroStatus, toast])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Sincronizar Fila de Eventos da Competência
  const handleSincronizarFila = async () => {
    if (selectedEmpresaId === 'todas') {
      toast({
        variant: 'destructive',
        title: 'Selecione uma empresa',
        description: 'Escolha uma empresa específica para gerar a fila da competência.',
      })
      return
    }

    setSyncing(true)
    try {
      const res = await esocialService.sincronizarEventosCompetencia(
        tenantId,
        selectedEmpresaId,
        selectedCompetencia,
        userId,
      )
      toast({
        title: 'Fila e-Social sincronizada!',
        description: `${res.gerados} novos eventos gerados (${res.validados} prontos, ${res.pendencias} com pendências de validação).`,
      })
      carregarDados()
    } catch (err) {
      console.error('Erro ao sincronizar eventos:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar eventos',
        description: 'Falha ao sincronizar eventos do e-Social.',
      })
    } finally {
      setSyncing(false)
    }
  }

  // Testar Credenciais
  const handleTestarCredenciais = async () => {
    if (selectedEmpresaId === 'todas') {
      toast({
        variant: 'destructive',
        title: 'Selecione uma empresa',
        description: 'Selecione uma empresa para testar o certificado A1 e conexão.',
      })
      return
    }

    setTestandoCredenciais(true)
    setModalDiagOpen(true)
    try {
      const diag = await esocialService.testarCredenciais(tenantId, selectedEmpresaId, userId)
      setDiagResultado(diag)
    } catch (err) {
      console.error('Erro ao testar credenciais:', err)
      toast({
        variant: 'destructive',
        title: 'Falha no diagnóstico',
        description: 'Não foi possível testar os parâmetros da empresa.',
      })
    } finally {
      setTestandoCredenciais(false)
    }
  }

  // Transmitir Evento em Modo Supervisionado
  const handleTransmitirEvento = async (evento: EsocialEventoRecord) => {
    if (!canEdit) {
      toast({
        variant: 'destructive',
        title: 'Acesso restrito',
        description: 'Apenas contadores e administradores podem transmitir eventos.',
      })
      return
    }

    setTransmittingId(evento.id)
    try {
      const res = await esocialService.transmitirEventoSupervisionado(evento.id, tenantId, userId)
      if (res.sucesso) {
        toast({
          title: 'Evento Transmitido!',
          description: res.mensagem,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Transmissão Supervisionada Bloqueada',
          description: res.mensagem,
        })
      }
      carregarDados()
    } catch (err) {
      console.error('Erro ao transmitir:', err)
      toast({
        variant: 'destructive',
        title: 'Erro na transmissão',
        description: 'Ocorreu um erro ao comunicar com a fila e-Social.',
      })
    } finally {
      setTransmittingId(null)
    }
  }

  // Fechar Competência S-1299
  const handleFecharCompetencia = async () => {
    if (selectedEmpresaId === 'todas') return
    setFechandoComp(true)
    try {
      const res = await esocialService.fecharCompetenciaEsocial(
        tenantId,
        selectedEmpresaId,
        selectedCompetencia,
        userId,
      )
      if (res.sucesso) {
        toast({
          title: 'Competência Encerrada (S-1299)',
          description: res.mensagem,
        })
        setModalFechamentoOpen(false)
        carregarDados()
      } else {
        toast({
          variant: 'destructive',
          title: 'Fechamento impedido',
          description: res.mensagem,
        })
      }
    } catch (err) {
      console.error('Erro ao fechar competência:', err)
      toast({
        variant: 'destructive',
        title: 'Erro no fechamento',
        description: 'Falha ao transmitir evento S-1299.',
      })
    } finally {
      setFechandoComp(false)
    }
  }

  // Reabrir Competência S-1298
  const handleReabrirCompetencia = async () => {
    if (selectedEmpresaId === 'todas' || !motivoReabertura.trim()) return
    setReabrindoComp(true)
    try {
      const res = await esocialService.reabrirCompetenciaEsocial(
        tenantId,
        selectedEmpresaId,
        selectedCompetencia,
        motivoReabertura,
        userId,
      )
      if (res.sucesso) {
        toast({
          title: 'Competência Reaberta (S-1298)',
          description: res.mensagem,
        })
        setModalReaberturaOpen(false)
        setMotivoReabertura('')
        carregarDados()
      } else {
        toast({
          variant: 'destructive',
          title: 'Reabertura negada',
          description: res.mensagem,
        })
      }
    } catch (err) {
      console.error('Erro ao reabrir competência:', err)
      toast({
        variant: 'destructive',
        title: 'Erro na reabertura',
        description: 'Falha ao transmitir evento S-1298.',
      })
    } finally {
      setReabrindoComp(false)
    }
  }

  // Baixar XML
  const handleBaixarXml = (evento: EsocialEventoRecord) => {
    if (!evento.xml_gerado) {
      toast({
        variant: 'destructive',
        title: 'XML Indisponível',
        description: 'Este evento ainda não possui XML estruturado.',
      })
      return
    }
    const blob = new Blob([evento.xml_gerado], { type: 'application/xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${evento.tipo_evento}-${evento.identificador_evento || 'esocial'}.xml`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Verificações de Prazo
  const agora = new Date()
  const calcularPrazoInfo = (prazoStr?: string) => {
    if (!prazoStr) return { status: 'normal', texto: '—' }
    const dt = new Date(prazoStr)
    const diffDias = Math.ceil((dt.getTime() - agora.getTime()) / (1000 * 3600 * 24))

    if (diffDias < 0) {
      return { status: 'atrasado', texto: `Vencido (${Math.abs(diffDias)}d atrás)` }
    }
    if (diffDias <= 3) {
      return { status: 'alerta', texto: `Vence em ${diffDias}d (${formatDatePtBr(prazoStr)})` }
    }
    return { status: 'ok', texto: formatDatePtBr(prazoStr) }
  }

  // Totalizadores da Fila
  const stats = useMemo(() => {
    const total = eventos.length
    const prontos = eventos.filter((e) => e.status === 'pronto' || e.status === 'validado').length
    const transmitidos = eventos.filter(
      (e) => e.status === 'transmitido' || e.status === 'fechado',
    ).length
    const pendentes = eventos.filter(
      (e) => e.status === 'pendente' || e.status === 'rejeitado',
    ).length
    const vencidos = eventos.filter((e) => {
      if (e.status === 'transmitido' || e.status === 'fechado') return false
      if (!e.prazo_legal) return false
      return new Date(e.prazo_legal).getTime() < agora.getTime()
    }).length

    const isFechada = eventos.some((e) => e.tipo_evento === 'S-1299' && e.status === 'fechado')

    return { total, prontos, transmitidos, pendentes, vencidos, isFechada }
  }, [eventos, agora])

  if (isCliente) {
    return (
      <Card className="rounded-2xl border-[#E2E8F0]">
        <CardContent className="p-8 text-center text-xs text-[#64748B]">
          <ShieldAlert className="h-8 w-8 mx-auto text-amber-500 mb-2" />
          <p className="font-bold text-sm text-[#1A2333]">Área de Conformidade Restrita</p>
          <p className="mt-1">
            O Painel de Transmissão e-Social é reservado à equipe técnica contábil e
            administradores.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Banner de Modo de Operação & Diagnóstico */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-[#0B1F3A] to-slate-900 text-white shadow-md">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-base tracking-tight">
              Painel de Conformidade e-Social
            </span>
            <BadgeTransmissaoAutonomia
              tipo="certificado_a1"
              isCredenciado={certAtivoEmpresa}
              detalhe={
                certAtivoEmpresa
                  ? 'Certificado A1 válido vinculado à empresa. Validação e transmissão autorizadas.'
                  : 'Certificado A1 ausente ou pendente. A transmissão e-Social opera em Modo Supervisão para auditoria contábil humana.'
              }
              configUrl="/obrigacoes"
            />
            <Badge variant="outline" className="text-slate-300 border-slate-700 text-[11px]">
              Layout S-1.1 Oficial
            </Badge>
          </div>
          <p className="text-xs text-slate-300">
            Validação estrutural dos XMLs, conformidade cadastral e transmissão rastreada.
            Honestidade de integração: transmissão real em produção plugada via certificado A1
            e-CNPJ.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestarCredenciais}
            disabled={testandoCredenciais || selectedEmpresaId === 'todas'}
            className="h-8 text-xs font-semibold rounded-xl bg-white/10 hover:bg-white/20 text-white border-white/20 gap-1.5"
          >
            <KeyRound className="h-3.5 w-3.5 text-amber-300" />
            <span>Testar Credenciais</span>
          </Button>

          {stats.isFechada ? (
            <Button
              size="sm"
              onClick={() => setModalReaberturaOpen(true)}
              disabled={!canEdit || selectedEmpresaId === 'todas'}
              className="h-8 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
            >
              <Unlock className="h-3.5 w-3.5" />
              <span>Reabrir Competência (S-1298)</span>
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setModalFechamentoOpen(true)}
              disabled={!canEdit || selectedEmpresaId === 'todas' || stats.prontos === 0}
              className="h-8 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Fechar Competência (S-1299)</span>
            </Button>
          )}
        </div>
      </div>

      {/* Card de Informações da Empresa & Status da Competência */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Total na Fila
              </p>
              <p className="text-2xl font-bold text-[#1A2333] mt-1">{stats.total}</p>
              <p className="text-[11px] text-[#64748B]">Eventos S-1.1</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-[#1A2333]">
              <FileCode2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Prontos / Validados
              </p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{stats.prontos}</p>
              <p className="text-[11px] text-blue-600">Aptos para envio</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <CheckCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Transmitidos / Recibo
              </p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.transmitidos}</p>
              <p className="text-[11px] text-emerald-600">Com protocolo gov.br</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Pendências / Vencidos
              </p>
              <p className="text-2xl font-bold text-rose-600 mt-1">{stats.pendentes}</p>
              <p className="text-[11px] text-rose-600">{stats.vencidos} com prazo legal crítico</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerta de Competência Fechada com Trava no DP */}
      {stats.isFechada && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
          <Lock className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-sm text-amber-950">
              Competência {selectedCompetencia} Fechada via S-1299
            </p>
            <p className="mt-0.5 text-amber-800">
              O evento periódico de fechamento foi protocolado. Edições retroativas de folha de
              pagamento e colaboradores estão bloqueadas para conformidade legal. Para retificar,
              utilize a Reabertura Auditada (S-1298).
            </p>
          </div>
        </div>
      )}

      {/* Barra de Filtros e Sincronização */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#64748B]" />
            <Select value={selectedEmpresaId} onValueChange={onSelectEmpresaId}>
              <SelectTrigger className="w-52 h-9 text-xs rounded-xl border-[#E2E8F0]">
                <SelectValue placeholder="Empresa" />
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

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#64748B]" />
            <Select value={selectedCompetencia} onValueChange={onSelectCompetencia}>
              <SelectTrigger className="w-32 h-9 text-xs rounded-xl border-[#E2E8F0]">
                <SelectValue placeholder="Competência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="08/2026">08/2026</SelectItem>
                <SelectItem value="09/2026">09/2026</SelectItem>
                <SelectItem value="10/2026">10/2026</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-36 h-9 text-xs rounded-xl border-[#E2E8F0]">
              <SelectValue placeholder="Tipo Evento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Eventos</SelectItem>
              <SelectItem value="S-1200">S-1200 Remuneração</SelectItem>
              <SelectItem value="S-1210">S-1210 Pagamentos</SelectItem>
              <SelectItem value="S-1299">S-1299 Fechamento</SelectItem>
              <SelectItem value="S-1298">S-1298 Reabertura</SelectItem>
              <SelectItem value="S-2200">S-2200 Admissão</SelectItem>
              <SelectItem value="S-2205">S-2205 Alt. Cadastral</SelectItem>
              <SelectItem value="S-2230">S-2230 Afastamento</SelectItem>
              <SelectItem value="S-2299">S-2299 Desligamento</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-32 h-9 text-xs rounded-xl border-[#E2E8F0]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="pronto">Pronto</SelectItem>
              <SelectItem value="validado">Validado</SelectItem>
              <SelectItem value="transmitido">Transmitido</SelectItem>
              <SelectItem value="rejeitado">Rejeitado</SelectItem>
              <SelectItem value="fechado">Fechado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSincronizarFila}
            disabled={syncing || selectedEmpresaId === 'todas'}
            className="h-9 text-xs font-semibold rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Gerando Fila...' : 'Sincronizar Fila DP'}</span>
          </Button>
        </div>
      </div>

      {/* Tabela da Fila de Eventos */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-[#64748B] font-semibold border-b border-[#E2E8F0]">
              <tr>
                <th className="py-3 px-4">Evento / ID</th>
                <th className="py-3 px-4">Empresa / Trabalhador</th>
                <th className="py-3 px-4">Competência</th>
                <th className="py-3 px-4">Prazo Legal</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Recibo / Protocolo</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[#1A2333]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#94A3B8]">
                    Carregando fila de eventos e-Social...
                  </td>
                </tr>
              ) : eventos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#94A3B8]">
                    Nenhum evento encontrado para os filtros selecionados. Clique em
                    &quot;Sincronizar Fila DP&quot; para gerar os eventos automaticamente.
                  </td>
                </tr>
              ) : (
                eventos.map((ev) => {
                  const prazoInfo = calcularPrazoInfo(ev.prazo_legal)
                  const hasErros = ev.erros_validacao && ev.erros_validacao.length > 0

                  return (
                    <tr key={ev.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="font-mono font-bold bg-slate-50 text-[#1A2333]"
                          >
                            {ev.tipo_evento}
                          </Badge>
                          <span className="font-mono text-[11px] text-[#64748B]">
                            {ev.identificador_evento || ev.id.slice(0, 8)}
                          </span>
                        </div>
                        {ev.tipo_evento === 'S-2200' && (
                          <p className="text-[10px] text-[#64748B] mt-0.5">Admissão de Empregado</p>
                        )}
                        {ev.tipo_evento === 'S-1200' && (
                          <p className="text-[10px] text-[#64748B] mt-0.5">
                            Remuneração do Trabalhador
                          </p>
                        )}
                        {ev.tipo_evento === 'S-1210' && (
                          <p className="text-[10px] text-[#64748B] mt-0.5">
                            Pagamentos de Rendimentos
                          </p>
                        )}
                        {ev.tipo_evento === 'S-1299' && (
                          <p className="text-[10px] text-[#64748B] mt-0.5">Fechamento Periódico</p>
                        )}
                        {ev.tipo_evento === 'S-1298' && (
                          <p className="text-[10px] text-[#64748B] mt-0.5">Reabertura de Folha</p>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {ev.funcionario && onAbrirFichaColaborador ? (
                          <button
                            type="button"
                            onClick={() => onAbrirFichaColaborador(ev.funcionario!)}
                            className="text-left font-semibold text-[#1A2333] hover:text-[#0FA3A3] hover:underline cursor-pointer block"
                          >
                            {ev.expand?.funcionario?.nome_completo || 'Colaborador'}
                          </button>
                        ) : (
                          <p className="font-semibold text-[#1A2333]">
                            {ev.expand?.funcionario?.nome_completo ||
                              ev.expand?.empresa?.nome_fantasia ||
                              ev.expand?.empresa?.razao_social ||
                              '—'}
                          </p>
                        )}
                        <p className="text-[11px] text-[#64748B]">
                          {ev.expand?.funcionario
                            ? `CPF: ${ev.expand.funcionario.cpf}`
                            : `CNPJ: ${ev.expand?.empresa?.cnpj || ''}`}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 font-medium text-[#475569]">
                        {ev.competencia || '—'}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 font-medium ${
                            prazoInfo.status === 'atrasado'
                              ? 'text-rose-600 font-bold'
                              : prazoInfo.status === 'alerta'
                                ? 'text-amber-600 font-semibold'
                                : 'text-[#64748B]'
                          }`}
                        >
                          <Clock className="h-3 w-3" />
                          {prazoInfo.texto}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {ev.status === 'transmitido' && (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                            Transmitido
                          </Badge>
                        )}
                        {ev.status === 'fechado' && (
                          <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200">
                            Fechado (S-1299)
                          </Badge>
                        )}
                        {ev.status === 'validado' && (
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                            Validado
                          </Badge>
                        )}
                        {ev.status === 'pronto' && (
                          <Badge className="bg-sky-100 text-sky-800 border-sky-200">
                            Pronto p/ Envio
                          </Badge>
                        )}
                        {ev.status === 'pendente' && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                            Pendente
                          </Badge>
                        )}
                        {ev.status === 'rejeitado' && (
                          <Badge className="bg-rose-100 text-rose-800 border-rose-200">
                            Rejeitado
                          </Badge>
                        )}

                        {hasErros && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-rose-600">
                            <AlertCircle className="h-3 w-3" />
                            <span>{ev.erros_validacao?.length} pendência(s)</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {ev.recibo_entrega ? (
                          <div className="space-y-0.5">
                            <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 block truncate max-w-[180px]">
                              {ev.recibo_entrega}
                            </span>
                            <span className="text-[10px] text-[#64748B] block">
                              {ev.data_transmissao ? formatDateTimePtBr(ev.data_transmissao) : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#94A3B8]">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {ev.xml_gerado && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEventoXmlVisualizando(ev)
                                setModalXmlOpen(true)
                              }}
                              className="h-7 text-[11px] text-[#475569] hover:text-[#0FA3A3] gap-1"
                              title="Visualizar XML S-1.1"
                            >
                              <FileCode2 className="h-3.5 w-3.5" />
                              <span>XML</span>
                            </Button>
                          )}

                          {canEdit && ev.status !== 'transmitido' && ev.status !== 'fechado' && (
                            <Button
                              size="sm"
                              onClick={() => handleTransmitirEvento(ev)}
                              disabled={transmittingId === ev.id || hasErros}
                              className="h-7 text-[11px] font-semibold bg-[#0FA3A3] text-white hover:bg-[#0C8585] rounded-lg gap-1"
                            >
                              <Send className="h-3 w-3" />
                              <span>{transmittingId === ev.id ? 'Enviando...' : 'Transmitir'}</span>
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
      </div>

      {/* Modal: Visualizar XML do Evento */}
      <Dialog open={modalXmlOpen} onOpenChange={setModalXmlOpen}>
        <DialogContent className="max-w-3xl rounded-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <FileCode2 className="h-5 w-5 text-[#0FA3A3]" />
                  <span>Estrutura XML Oficial — Layout {eventoXmlVisualizando?.tipo_evento}</span>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Padrão S-1.1 do e-Social (XSD schemas gov.br) gerado a partir dos dados do módulo
                  DP.
                </DialogDescription>
              </div>

              {eventoXmlVisualizando && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBaixarXml(eventoXmlVisualizando)}
                  className="rounded-xl text-xs gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Baixar XML</span>
                </Button>
              )}
            </div>
          </DialogHeader>

          {eventoXmlVisualizando?.erros_validacao &&
            eventoXmlVisualizando.erros_validacao.length > 0 && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                <p className="font-bold text-xs text-rose-800 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Pendências Cadastrais Impedindo Transmissão:</span>
                </p>
                <ul className="text-[11px] text-rose-700 list-disc list-inside space-y-0.5">
                  {eventoXmlVisualizando.erros_validacao.map((err, i) => (
                    <li key={i}>
                      <b>{err.campo}:</b> {err.mensagem} (<i>Ação: {err.acao}</i>)
                    </li>
                  ))}
                </ul>
              </div>
            )}

          <div className="flex-1 overflow-auto bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs">
            <pre className="whitespace-pre-wrap">{eventoXmlVisualizando?.xml_gerado || ''}</pre>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalXmlOpen(false)}
              className="rounded-xl text-xs"
            >
              Fechar Visualizador
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Diagnóstico de Credenciais Item a Item */}
      <Dialog open={modalDiagOpen} onOpenChange={setModalDiagOpen}>
        <DialogContent className="max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-500" />
              <span>Diagnóstico de Credenciais e-Social</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Verificação em tempo real dos requisitos para transmissão oficial no ambiente
              e-Social.
            </DialogDescription>
          </DialogHeader>

          {testandoCredenciais ? (
            <div className="py-8 text-center space-y-3">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-[#0FA3A3]" />
              <p className="text-xs text-[#64748B]">
                Auditando certificado A1, validade, permissões gov.br e ambiente...
              </p>
            </div>
          ) : diagResultado ? (
            <div className="space-y-4 py-2 text-xs">
              <div
                className={`p-3.5 rounded-xl border ${
                  diagResultado.certificado_ok && diagResultado.senha_ok
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  {diagResultado.certificado_ok && diagResultado.senha_ok ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  )}
                  <p className="font-bold text-sm">Status Geral: {diagResultado.status_geral}</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {diagResultado.detalhes.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    {item.sucesso ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="font-bold text-[#1A2333]">{item.item}</p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">{item.mensagem}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-slate-100 rounded-xl text-[11px] text-[#64748B] flex items-center justify-between">
                <span>
                  Modo Atual: <b>Supervisão Controlada</b>
                </span>
                <span>
                  Ambiente: <b>{diagResultado.ambiente_comunicacao.toUpperCase()}</b>
                </span>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalDiagOpen(false)}
              className="rounded-xl text-xs"
            >
              Fechar Diagnóstico
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Fechamento de Folha S-1299 */}
      <Dialog open={modalFechamentoOpen} onOpenChange={setModalFechamentoOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-emerald-600" />
              <span>Transmitir Evento S-1299 (Fechamento)</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Encerramento oficial das remunerações e apurações da competência {selectedCompetencia}
              .
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <p className="text-[#475569]">
              Ao protocolar o evento S-1299, a competência <b>{selectedCompetencia}</b> será marcada
              como fechada e <b>bloqueada para modificações retroativas</b> no Departamento Pessoal
              e no Financeiro.
            </p>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Eventos Validados:</span>
                <span className="font-bold text-[#1A2333]">{stats.prontos}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Pendências Remanescentes:</span>
                <span className="font-bold text-rose-600">{stats.pendentes}</span>
              </div>
            </div>

            {stats.pendentes > 0 && (
              <p className="text-rose-600 font-semibold text-[11px]">
                Atenção: Existem eventos com pendências. O e-Social pode rejeitar o fechamento caso
                haja cadastros ou remunerações inconsistentes.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalFechamentoOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleFecharCompetencia}
              disabled={fechandoComp || stats.pendentes > 0}
              className="rounded-xl text-xs bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {fechandoComp ? 'Fechando...' : 'Confirmar Fechamento S-1299'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Reabertura S-1298 */}
      <Dialog open={modalReaberturaOpen} onOpenChange={setModalReaberturaOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="h-5 w-5 text-amber-600" />
              <span>Reabrir Competência e-Social (S-1298)</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Libera a competência {selectedCompetencia} para alterações e cálculos retificadores.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <p className="text-[#475569]">
              Conforme exigência do e-Social, a reabertura de eventos periódicos deve conter uma
              justificativa formal que constará no histórico de auditoria contábil.
            </p>

            <div>
              <Label className="text-xs font-semibold">
                Justificativa da Reabertura (Mínimo 10 caracteres)
              </Label>
              <Textarea
                value={motivoReabertura}
                onChange={(e) => setMotivoReabertura(e.target.value)}
                placeholder="Ex: Retificação de horas extras de colaboradores conforme convenção coletiva..."
                className="mt-1 h-24 text-xs rounded-xl border-[#E2E8F0] resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalReaberturaOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleReabrirCompetencia}
              disabled={reabrindoComp || motivoReabertura.trim().length < 10}
              className="rounded-xl text-xs bg-amber-600 text-white hover:bg-amber-700"
            >
              {reabrindoComp ? 'Transmitindo S-1298...' : 'Confirmar Reabertura'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

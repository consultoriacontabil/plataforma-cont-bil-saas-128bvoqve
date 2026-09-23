import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileCheck2,
  AlertTriangle,
  AlertCircle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Building2,
  ArrowUpRight,
  PlusCircle,
  Filter,
  CheckCircle2,
  ExternalLink,
  Search,
  Sparkles,
  Info,
  Layers,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  certidoesService,
  type CertidaoSaudeInfo,
  type CertidaoSaude,
} from '@/services/regularidade'
import { workflowService } from '@/services/workflows'
import { maskCnpj, formatDatePtBr } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type {
  Empresa,
  CertidaoRecord,
  TipoCertidao,
  StatusCertidao,
  WorkflowPrioridade,
} from '@/types'

// Os 5 pilares oficiais de certidões negativas
export const TIPOS_CND_MONITORADAS: Array<{
  tipo: TipoCertidao
  sigla: string
  nome: string
  orgao: string
}> = [
  {
    tipo: 'receita_pgfn_cnd',
    sigla: 'Federal (Receita/PGFN)',
    nome: 'Certidão Conjunta Negativa Federal',
    orgao: 'RFB / PGFN',
  },
  {
    tipo: 'estadual',
    sigla: 'Estadual (SEFAZ)',
    nome: 'Certidão Negativa de Débitos Estaduais / ICMS',
    orgao: 'Secretaria da Fazenda Estadual',
  },
  {
    tipo: 'municipal',
    sigla: 'Municipal (Prefeitura)',
    nome: 'Certidão Negativa de Tributos Mobiliários e Imobiliários',
    orgao: 'Prefeitura Municipal',
  },
  {
    tipo: 'fgts_crf',
    sigla: 'FGTS (CRF Caixa)',
    nome: 'Certificado de Regularidade do FGTS',
    orgao: 'Caixa Econômica Federal',
  },
  {
    tipo: 'trabalhista_cndt',
    sigla: 'Trabalhista (CNDT)',
    nome: 'Certidão Negativa de Débitos Trabalhistas',
    orgao: 'Tribunal Superior do Trabalho / CSJT',
  },
]

export interface StatusCertidaoEmpresaItem {
  tipo: TipoCertidao
  sigla: string
  nome: string
  orgao: string
  saude: CertidaoSaude
  label: string
  diasRestantes?: number
  certidao?: CertidaoRecord
}

export interface EmpresaCndDiagnostic {
  empresa: Empresa
  certidoes: StatusCertidaoEmpresaItem[]
  totalMonitoradas: number
  validas: number
  vencendo: number
  vencidas: number
  semRegistro: number
  temPendencia: boolean // vencida, semRegistro ou sem_efeito
  temVencendo: boolean
  piorEstado: 'vencida' | 'sem_registro' | 'vencendo' | 'valida'
}

interface DashboardMonitorCndsProps {
  empresas: Empresa[]
  certidoes: CertidaoRecord[]
  loading?: boolean
  error?: string | null
  isCliente?: boolean
  currentUserId?: string
  tenantId?: string
  onWorkflowCreated?: () => void
}

export const DashboardMonitorCnds: React.FC<DashboardMonitorCndsProps> = ({
  empresas,
  certidoes,
  loading = false,
  error = null,
  isCliente = false,
  currentUserId,
  tenantId,
  onWorkflowCreated,
}) => {
  const navigate = useNavigate()
  const { toast } = useToast()

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState<
    'todos' | 'com_pendencia' | 'vencidas' | 'vencendo' | 'regulares'
  >('todos')
  const [busca, setBusca] = useState('')

  // Modal para criar solicitação / tarefa de regularização no fluxo existente (workflows)
  const [modalSolicitacaoOpen, setModalSolicitacaoOpen] = useState(false)
  const [empresaSelecionada, setEmpresaSelecionada] = useState<Empresa | null>(null)
  const [certidaoFoco, setCertidaoFoco] = useState<StatusCertidaoEmpresaItem | null>(null)
  const [solicitacaoTitulo, setSolicitacaoTitulo] = useState('')
  const [solicitacaoDescricao, setSolicitacaoDescricao] = useState('')
  const [solicitacaoPrioridade, setSolicitacaoPrioridade] = useState<WorkflowPrioridade>('alta')
  const [solicitacaoPrazo, setSolicitacaoPrazo] = useState('')
  const [salvandoSolicitacao, setSalvandoSolicitacao] = useState(false)

  // Mapa de certidões mais recentes por empresa e por tipo
  const certidoesPorEmpresaTipo = useMemo(() => {
    const map = new Map<string, Map<TipoCertidao, CertidaoRecord>>()

    certidoes.forEach((c) => {
      const empId = c.empresa
      if (!empId) return

      if (!map.has(empId)) {
        map.set(empId, new Map())
      }
      const subMap = map.get(empId)!
      const existente = subMap.get(c.tipo)

      // Se já houver certidão desse tipo, prefere a que tem validade mais recente
      if (!existente) {
        subMap.set(c.tipo, c)
      } else {
        const valExistente = new Date(existente.data_validade).getTime()
        const valNova = new Date(c.data_validade).getTime()
        if (valNova > valExistente) {
          subMap.set(c.tipo, c)
        }
      }
    })

    return map
  }, [certidoes])

  // Diagnóstico estruturado por empresa ativa
  const diagnosticos = useMemo<EmpresaCndDiagnostic[]>(() => {
    const ativas = empresas.filter((e) => e.status === 'ativo')

    return ativas.map((emp) => {
      const subMap = certidoesPorEmpresaTipo.get(emp.id)

      let validas = 0
      let vencendo = 0
      let vencidas = 0
      let semRegistro = 0

      const itens: StatusCertidaoEmpresaItem[] = TIPOS_CND_MONITORADAS.map((pilar) => {
        // Tratar CPEN como alternativa equivalente da Receita/PGFN
        let cert = subMap?.get(pilar.tipo)
        if (!cert && pilar.tipo === 'receita_pgfn_cnd') {
          cert = subMap?.get('receita_pgfn_cpen')
        }

        const info: CertidaoSaudeInfo = certidoesService.calcularSaude(cert)

        if (info.saude === 'valida') {
          validas++
        } else if (info.saude === 'proximo_vencimento') {
          vencendo++
        } else if (info.saude === 'vencida' || info.saude === 'sem_efeito') {
          vencidas++
        } else {
          semRegistro++
        }

        return {
          tipo: pilar.tipo,
          sigla: pilar.sigla,
          nome: pilar.nome,
          orgao: pilar.orgao,
          saude: info.saude,
          label: info.label,
          diasRestantes: info.diasRestantes,
          certidao: cert,
        }
      })

      const temPendencia = vencidas > 0 || semRegistro > 0
      const temVencendo = vencendo > 0

      let piorEstado: EmpresaCndDiagnostic['piorEstado'] = 'valida'
      if (vencidas > 0) piorEstado = 'vencida'
      else if (semRegistro > 0) piorEstado = 'sem_registro'
      else if (vencendo > 0) piorEstado = 'vencendo'

      return {
        empresa: emp,
        certidoes: itens,
        totalMonitoradas: TIPOS_CND_MONITORADAS.length,
        validas,
        vencendo,
        vencidas,
        semRegistro,
        temPendencia,
        temVencendo,
        piorEstado,
      }
    })
  }, [empresas, certidoesPorEmpresaTipo])

  // Contadores globais do painel
  const contadores = useMemo(() => {
    let empresasComPendencia = 0
    let empresasVencidas = 0
    let empresasVencendo = 0
    let empresasRegulares = 0
    let totalCndsVencidas = 0
    let totalCndsVencendo = 0
    let totalCndsAusentes = 0

    diagnosticos.forEach((d) => {
      if (d.temPendencia || d.temVencendo) {
        empresasComPendencia++
      } else {
        empresasRegulares++
      }

      if (d.vencidas > 0) {
        empresasVencidas++
      }
      if (d.vencendo > 0) {
        empresasVencendo++
      }

      totalCndsVencidas += d.vencidas
      totalCndsVencendo += d.vencendo
      totalCndsAusentes += d.semRegistro
    })

    return {
      empresasComPendencia,
      empresasVencidas,
      empresasVencendo,
      empresasRegulares,
      totalCndsVencidas,
      totalCndsVencendo,
      totalCndsAusentes,
      totalEmpresas: diagnosticos.length,
    }
  }, [diagnosticos])

  // Diagnósticos filtrados
  const diagnosticosFiltrados = useMemo(() => {
    return diagnosticos
      .filter((d) => {
        // Filtro de Busca textual
        if (busca.trim()) {
          const termo = busca.toLowerCase().trim()
          const razao = d.empresa.razao_social?.toLowerCase() || ''
          const fantasia = d.empresa.nome_fantasia?.toLowerCase() || ''
          const cnpj = d.empresa.cnpj || ''
          const matchText =
            razao.includes(termo) || fantasia.includes(termo) || cnpj.includes(termo)
          if (!matchText) return false
        }

        // Filtro de status clicável
        if (filtroStatus === 'com_pendencia') {
          return d.temPendencia || d.temVencendo
        }
        if (filtroStatus === 'vencidas') {
          return d.vencidas > 0
        }
        if (filtroStatus === 'vencendo') {
          return d.vencendo > 0
        }
        if (filtroStatus === 'regulares') {
          return !d.temPendencia && !d.temVencendo
        }

        return true
      })
      .sort((a, b) => {
        // Ordenação por criticidade: vencidas > ausentes > vencendo > regulares
        const peso = {
          vencida: 0,
          sem_registro: 1,
          vencendo: 2,
          valida: 3,
        }
        const diff = peso[a.piorEstado] - peso[b.piorEstado]
        if (diff !== 0) return diff
        return (a.empresa.nome_fantasia || a.empresa.razao_social).localeCompare(
          b.empresa.nome_fantasia || b.empresa.razao_social,
        )
      })
  }, [diagnosticos, filtroStatus, busca])

  // Abrir modal de criação de solicitação no workflow existente
  const handleAbrirSolicitacao = (empresa: Empresa, certidao?: StatusCertidaoEmpresaItem) => {
    setEmpresaSelecionada(empresa)
    setCertidaoFoco(certidao || null)

    const empNome = empresa.nome_fantasia || empresa.razao_social
    const pilarNome = certidao ? certidao.sigla : 'CNDs Gerais'

    setSolicitacaoTitulo(`Regularizar CND ${pilarNome} - ${empNome}`)

    let descPadrao = `Ação de regularização fiscal solicitada via Monitor de CNDs do Dashboard para a empresa ${empNome} (CNPJ: ${maskCnpj(empresa.cnpj)}).\n`
    if (certidao) {
      if (certidao.saude === 'vencida') {
        descPadrao += `Certidão ${certidao.nome} (${certidao.orgao}) encontra-se VENCIDA (${certidao.label}). Necessário emissão ou parcelamento de débitos.`
      } else if (certidao.saude === 'proximo_vencimento') {
        descPadrao += `Certidão ${certidao.nome} (${certidao.orgao}) está próxima do vencimento (${certidao.label}). Providenciar nova certidão antes de travar operações.`
      } else if (certidao.saude === 'pendente') {
        descPadrao += `Certidão ${certidao.nome} (${certidao.orgao}) NUNCA foi emitida/cadastrada no sistema. Realizar emissão inicial no portal oficial do órgão.`
      }
    } else {
      descPadrao += `Acompanhar e atualizar certidões negativas perante órgãos federais, estaduais, municipais, trabalhistas e FGTS.`
    }

    setSolicitacaoDescricao(descPadrao)
    setSolicitacaoPrioridade('alta')

    // Prazo padrão: +3 dias úteis
    const d = new Date()
    d.setDate(d.getDate() + 3)
    setSolicitacaoPrazo(d.toISOString().split('T')[0])

    setModalSolicitacaoOpen(true)
  }

  const handleSalvarSolicitacao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId || !currentUserId || !empresaSelecionada) {
      toast({
        variant: 'destructive',
        title: 'Não foi possível registrar solicitação',
        description: 'Informações do usuário ou tenant não identificadas.',
      })
      return
    }

    setSalvandoSolicitacao(true)
    try {
      await workflowService.create({
        tenant_id: tenantId,
        empresa_id: empresaSelecionada.id,
        tipo: 'outros',
        titulo: solicitacaoTitulo.trim(),
        descricao: solicitacaoDescricao.trim(),
        prioridade: solicitacaoPrioridade,
        status: 'pendente',
        prazo: solicitacaoPrazo ? `${solicitacaoPrazo} 18:00:00` : undefined,
        criado_por_id: currentUserId,
        atribuido_id: currentUserId,
      })

      toast({
        title: 'Solicitação registrada!',
        description:
          'A tarefa foi criada no fluxo operacional de Workflows e o prazo foi agendado.',
      })

      setModalSolicitacaoOpen(false)
      if (onWorkflowCreated) {
        onWorkflowCreated()
      }
    } catch (err) {
      console.error('Erro ao criar workflow para CND:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar solicitação',
        description: 'Não foi possível salvar o workflow da certidão.',
      })
    } finally {
      setSalvandoSolicitacao(false)
    }
  }

  // Renderização visual dos badges de certidão
  const renderPilarBadge = (item: StatusCertidaoEmpresaItem, empresa: Empresa) => {
    const isValida = item.saude === 'valida'
    const isVencendo = item.saude === 'proximo_vencimento'
    const isVencida = item.saude === 'vencida' || item.saude === 'sem_efeito'
    const isAusente = item.saude === 'pendente'

    let badgeClass = 'border-slate-200 bg-slate-50 text-slate-700'
    let icon = <Clock className="h-3 w-3 text-slate-400" />
    let tooltipText = `${item.sigla}: Não cadastrada / Nunca emitida`

    if (isValida) {
      badgeClass = 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
      icon = <ShieldCheck className="h-3 w-3 text-emerald-600" />
      tooltipText = `${item.sigla}: Válida (${item.diasRestantes} dias restantes)`
      if (item.certidao?.data_validade) {
        tooltipText += ` • Até ${formatDatePtBr(item.certidao.data_validade)}`
      }
    } else if (isVencendo) {
      badgeClass = 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 animate-pulse'
      icon = <ShieldAlert className="h-3 w-3 text-amber-600" />
      tooltipText = `${item.sigla}: Vencendo em ${item.diasRestantes} dias!`
      if (item.certidao?.data_validade) {
        tooltipText += ` • Vence em ${formatDatePtBr(item.certidao.data_validade)}`
      }
    } else if (isVencida) {
      badgeClass = 'border-red-300 bg-red-50 text-red-900 hover:bg-red-100 font-bold'
      icon = <ShieldX className="h-3 w-3 text-red-600" />
      tooltipText = `${item.sigla}: VENCIDA! Exige renovação imediata`
    } else if (isAusente) {
      badgeClass = 'border-slate-300 bg-slate-100/90 text-slate-600 hover:bg-slate-200'
      icon = <AlertCircle className="h-3 w-3 text-slate-400" />
      tooltipText = `${item.sigla}: Sem registro cadastrado nesta empresa`
    }

    return (
      <button
        key={item.tipo}
        type="button"
        onClick={() => {
          if (!isCliente) {
            navigate(`/empresas/${empresa.id}?tab=regularidade`)
          } else {
            navigate('/portal')
          }
        }}
        title={tooltipText}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-medium transition-all text-left truncate max-w-[170px]',
          badgeClass,
        )}
      >
        <span className="shrink-0">{icon}</span>
        <span className="font-semibold truncate">
          {item.tipo === 'receita_pgfn_cnd'
            ? 'Federal'
            : item.tipo === 'estadual'
              ? 'Estadual'
              : item.tipo === 'municipal'
                ? 'Municipal'
                : item.tipo === 'fgts_crf'
                  ? 'FGTS'
                  : 'Trabalhista'}
        </span>
        <span className="text-[9px] opacity-80 shrink-0">
          {isValida
            ? `${item.diasRestantes}d`
            : isVencendo
              ? `≤${item.diasRestantes}d`
              : isVencida
                ? 'vencida'
                : 'ausente'}
        </span>
      </button>
    )
  }

  return (
    <Card className="rounded-2xl border-[#E2E8F0] shadow-xs overflow-hidden">
      {/* Top Header */}
      <CardHeader className="p-5 pb-4 bg-gradient-to-r from-amber-50/50 via-white to-teal-50/30 border-b border-[#E2E8F0]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <FileCheck2 className="h-4 w-4" />
              </div>
              <CardTitle className="text-base font-bold text-[#1A2333]">
                Monitor de CNDs & Regularidade Fiscal
              </CardTitle>

              {contadores.empresasComPendencia > 0 ? (
                <Badge className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5">
                  {contadores.empresasComPendencia} empresa
                  {contadores.empresasComPendencia > 1 ? 's' : ''} em alerta
                </Badge>
              ) : (
                <Badge className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5">
                  100% em dia
                </Badge>
              )}
            </div>

            <CardDescription className="text-xs text-[#64748B]">
              Diagnóstico contínuo das 5 certidões essenciais (Federal RFB/PGFN, Estadual SEFAZ,
              Municipal, FGTS/Caixa e CNDT Trabalhista)
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (isCliente) {
                  navigate('/portal')
                } else {
                  navigate('/obrigacoes')
                }
              }}
              className="h-8 text-xs font-semibold gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-50 rounded-xl"
            >
              <span>{isCliente ? 'Ver Regularidade' : 'Painel de Regularidade'}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Contadores / Alertas no Topo (Clicáveis para filtrar) */}
        <div className="grid grid-cols-2 gap-2 pt-3 sm:grid-cols-4">
          {/* Card 1: Com Pendência Total */}
          <button
            type="button"
            onClick={() =>
              setFiltroStatus(filtroStatus === 'com_pendencia' ? 'todos' : 'com_pendencia')
            }
            className={cn(
              'flex flex-col text-left p-2.5 rounded-xl border transition-all text-xs',
              filtroStatus === 'com_pendencia'
                ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-400'
                : 'bg-white border-[#E2E8F0] hover:border-amber-200 hover:bg-amber-50/40',
            )}
          >
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-amber-600" />
              Empresas c/ Alerta
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-extrabold text-amber-700">
                {contadores.empresasComPendencia}
              </span>
              <span className="text-[10px] text-slate-500">/ {contadores.totalEmpresas} emp.</span>
            </div>
            <span className="text-[10px] text-amber-800/80 mt-0.5 truncate">
              {contadores.totalCndsAusentes} certidão(ões) ausente(s)
            </span>
          </button>

          {/* Card 2: Vencidas */}
          <button
            type="button"
            onClick={() => setFiltroStatus(filtroStatus === 'vencidas' ? 'todos' : 'vencidas')}
            className={cn(
              'flex flex-col text-left p-2.5 rounded-xl border transition-all text-xs',
              filtroStatus === 'vencidas'
                ? 'bg-red-50 border-red-300 ring-1 ring-red-400'
                : 'bg-white border-[#E2E8F0] hover:border-red-200 hover:bg-red-50/40',
            )}
          >
            <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider flex items-center gap-1">
              <ShieldX className="h-3 w-3 text-red-600" />
              Vencidas (Crítico)
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-extrabold text-red-600">
                {contadores.empresasVencidas}
              </span>
              <span className="text-[10px] text-slate-500">empresas</span>
            </div>
            <span className="text-[10px] text-red-700/80 mt-0.5 truncate">
              {contadores.totalCndsVencidas} certidão(ões) expirada(s)
            </span>
          </button>

          {/* Card 3: Vencendo em 30 dias */}
          <button
            type="button"
            onClick={() => setFiltroStatus(filtroStatus === 'vencendo' ? 'todos' : 'vencendo')}
            className={cn(
              'flex flex-col text-left p-2.5 rounded-xl border transition-all text-xs',
              filtroStatus === 'vencendo'
                ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-400'
                : 'bg-white border-[#E2E8F0] hover:border-amber-200 hover:bg-amber-50/40',
            )}
          >
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
              <Clock className="h-3 w-3 text-amber-600" />
              Vencendo em ≤30d
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-extrabold text-amber-700">
                {contadores.empresasVencendo}
              </span>
              <span className="text-[10px] text-slate-500">empresas</span>
            </div>
            <span className="text-[10px] text-amber-800/80 mt-0.5 truncate">
              {contadores.totalCndsVencendo} renovação(ões) próxima(s)
            </span>
          </button>

          {/* Card 4: 100% em dia */}
          <button
            type="button"
            onClick={() => setFiltroStatus(filtroStatus === 'regulares' ? 'todos' : 'regulares')}
            className={cn(
              'flex flex-col text-left p-2.5 rounded-xl border transition-all text-xs',
              filtroStatus === 'regulares'
                ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-400'
                : 'bg-white border-[#E2E8F0] hover:border-emerald-200 hover:bg-emerald-50/40',
            )}
          >
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-emerald-600" />
              100% Em Dia
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-extrabold text-emerald-600">
                {contadores.empresasRegulares}
              </span>
              <span className="text-[10px] text-slate-500">empresas</span>
            </div>
            <span className="text-[10px] text-emerald-700/80 mt-0.5 truncate">
              Sem pendências ou vencimentos
            </span>
          </button>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por razão social, nome fantasia ou CNPJ..."
              className="h-8 pl-8 text-xs rounded-xl border-[#E2E8F0] bg-white"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            {filtroStatus !== 'todos' && (
              <button
                type="button"
                onClick={() => setFiltroStatus('todos')}
                className="text-[11px] text-[#0FA3A3] hover:underline font-semibold"
              >
                Limpar filtro ({filtroStatus.replace('_', ' ')})
              </button>
            )}

            <span className="text-[11px] text-[#64748B]">
              Mostrando <strong className="text-[#1A2333]">{diagnosticosFiltrados.length}</strong>{' '}
              de {diagnosticos.length} empresa(s)
            </span>
          </div>
        </div>

        {/* Aviso de Modo Supervisão / Emissão Honesta */}
        <div className="mt-2.5 rounded-xl border border-sky-200 bg-sky-50/60 p-2.5 flex items-start gap-2 text-[11px] text-sky-900">
          <Info className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold">Modo Supervisão Contábil: </span>
            A consulta nos portais de certidões (Receita/PGFN, SEFAZ, Prefeituras, Caixa e TST)
            acompanha o status das certidões cadastradas e sincronizadas. O sistema monitora
            continuamente a validade e gera alertas para renovação oportuna.
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {error ? (
          <div className="p-6 text-center text-xs text-red-600 bg-red-50/50">
            <AlertCircle className="h-6 w-6 mx-auto mb-2 text-red-500" />
            <p className="font-semibold">Erro ao carregar monitor de CNDs</p>
            <p className="text-[11px] text-red-500 mt-1">{error}</p>
          </div>
        ) : loading ? (
          <div className="p-8 text-center text-xs text-[#64748B] space-y-2">
            <div className="h-6 w-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Varrendo certidões negativas de débito...</p>
          </div>
        ) : diagnosticosFiltrados.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#64748B]">
            {contadores.empresasComPendencia === 0 ? (
              <div className="max-w-sm mx-auto">
                <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <p className="font-bold text-sm text-[#1A2333]">Todas as certidões estão em dia!</p>
                <p className="text-[11px] text-[#64748B] mt-1">
                  Nenhuma pendência ou vencimento iminente encontrado na carteira monitorada. Todas
                  as certidões estão ativas e com validade superior a 30 dias.
                </p>
              </div>
            ) : (
              <div className="max-w-sm mx-auto">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="font-bold text-sm text-[#1A2333]">
                  Nenhuma empresa para o filtro selecionado
                </p>
                <p className="text-[11px] text-[#64748B] mt-1">
                  Não há empresas correspondentes ao critério &quot;{filtroStatus}&quot;
                  {busca ? ` com a busca "${busca}"` : ''}.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFiltroStatus('todos')
                    setBusca('')
                  }}
                  className="mt-3 h-8 text-xs border-[#E2E8F0]"
                >
                  Ver todas as empresas
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
            {diagnosticosFiltrados.map((diag) => {
              const empNome = diag.empresa.nome_fantasia || diag.empresa.razao_social
              const razao = diag.empresa.razao_social

              // Pior certidão para atalho de solicitação
              const piorCertidao =
                diag.certidoes.find((c) => c.saude === 'vencida') ||
                diag.certidoes.find((c) => c.saude === 'pendente') ||
                diag.certidoes.find((c) => c.saude === 'proximo_vencimento')

              return (
                <div
                  key={diag.empresa.id}
                  className="p-3.5 px-5 flex flex-col gap-3 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    {/* Identificação da Empresa */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold text-xs border',
                          diag.vencidas > 0
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : diag.semRegistro > 0
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : diag.vencendo > 0
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200',
                        )}
                      >
                        {diag.vencidas > 0 ? (
                          <ShieldX className="h-4 w-4" />
                        ) : diag.temPendencia ? (
                          <AlertTriangle className="h-4 w-4" />
                        ) : diag.vencendo > 0 ? (
                          <ShieldAlert className="h-4 w-4" />
                        ) : (
                          <ShieldCheck className="h-4 w-4" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              if (isCliente) {
                                navigate('/portal')
                              } else {
                                navigate(`/empresas/${diag.empresa.id}?tab=regularidade`)
                              }
                            }}
                            className="font-bold text-xs text-[#1A2333] hover:text-[#0FA3A3] text-left truncate flex items-center gap-1"
                          >
                            <Building2 className="h-3 w-3 text-[#64748B]" />
                            <span className="truncate">{empNome}</span>
                          </button>

                          <span className="text-[11px] font-mono text-[#64748B]">
                            {maskCnpj(diag.empresa.cnpj)}
                          </span>

                          {diag.empresa.uf && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0 border-slate-300 font-semibold text-[#64748B]"
                            >
                              {diag.empresa.uf}
                            </Badge>
                          )}
                        </div>

                        {razao && empNome !== razao && (
                          <p className="text-[11px] text-[#64748B] truncate max-w-md">{razao}</p>
                        )}
                      </div>
                    </div>

                    {/* Ações Rápidas por Empresa */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      {diag.temPendencia || diag.temVencendo ? (
                        <>
                          {!isCliente && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAbrirSolicitacao(diag.empresa, piorCertidao)}
                              className="h-7 text-[11px] font-semibold gap-1 rounded-lg border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                              title="Registrar solicitação / tarefa de regularização no fluxo existente"
                            >
                              <PlusCircle className="h-3 w-3 text-amber-700" />
                              <span>Registrar Solicitação</span>
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (isCliente) {
                                navigate('/portal')
                              } else {
                                navigate(`/empresas/${diag.empresa.id}?tab=regularidade`)
                              }
                            }}
                            className="h-7 text-[11px] font-semibold gap-1 text-[#0FA3A3] hover:bg-teal-50"
                          >
                            <span>Resolver</span>
                            <ArrowUpRight className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Em Dia</span>
                        </div>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (isCliente) {
                            navigate('/portal')
                          } else {
                            navigate(`/empresas/${diag.empresa.id}?tab=regularidade`)
                          }
                        }}
                        className="h-7 w-7 p-0 text-[#64748B] hover:text-[#0FA3A3] hover:bg-slate-100"
                        title="Ver certidões e regularidade da empresa"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Pilares de CNDs com badges por estado */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5 border-t border-slate-100">
                    <span className="text-[10px] font-semibold text-[#64748B] mr-1 hidden sm:inline">
                      CNDs:
                    </span>
                    {diag.certidoes.map((pilar) => renderPilarBadge(pilar, diag.empresa))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Modal: Registrar Solicitação no Fluxo Existente (Workflows) */}
      <Dialog open={modalSolicitacaoOpen} onOpenChange={setModalSolicitacaoOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333] flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-amber-600" />
              <span>Registrar Solicitação de Regularização</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Cria uma tarefa operacional vinculada à empresa no kanban de workflows contábeis.
            </DialogDescription>
          </DialogHeader>

          {empresaSelecionada && (
            <form onSubmit={handleSalvarSolicitacao} className="space-y-3.5 pt-1 text-xs">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#64748B]">
                  Empresa Vinculada
                </span>
                <p className="font-bold text-xs text-[#1A2333]">
                  {empresaSelecionada.nome_fantasia || empresaSelecionada.razao_social}
                </p>
                <p className="font-mono text-[11px] text-[#64748B]">
                  CNPJ: {maskCnpj(empresaSelecionada.cnpj)}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sol_titulo" className="text-xs font-semibold text-[#1A2333]">
                  Título da Tarefa *
                </Label>
                <Input
                  id="sol_titulo"
                  required
                  value={solicitacaoTitulo}
                  onChange={(e) => setSolicitacaoTitulo(e.target.value)}
                  className="h-9 text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#1A2333]">Prioridade</Label>
                  <Select
                    value={solicitacaoPrioridade}
                    onValueChange={(val: WorkflowPrioridade) => setSolicitacaoPrioridade(val)}
                  >
                    <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alta">Alta (Crítica)</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="baixa">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sol_prazo" className="text-xs font-semibold text-[#1A2333]">
                    Prazo Limite *
                  </Label>
                  <Input
                    id="sol_prazo"
                    type="date"
                    required
                    value={solicitacaoPrazo}
                    onChange={(e) => setSolicitacaoPrazo(e.target.value)}
                    className="h-9 text-xs rounded-xl border-[#E2E8F0]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sol_desc" className="text-xs font-semibold text-[#1A2333]">
                  Instruções e Diagnóstico de Regularização
                </Label>
                <Textarea
                  id="sol_desc"
                  rows={4}
                  value={solicitacaoDescricao}
                  onChange={(e) => setSolicitacaoDescricao(e.target.value)}
                  className="text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalSolicitacaoOpen(false)}
                  className="text-xs rounded-xl h-9"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={salvandoSolicitacao || !solicitacaoTitulo.trim()}
                  className="gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-9 px-4 shadow-xs"
                >
                  {salvandoSolicitacao ? 'Criando Tarefa...' : 'Confirmar Solicitação'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

import React, { useState, useEffect, useMemo } from 'react'
import {
  Users2,
  TrendingUp,
  Percent,
  AlertTriangle,
  Bot,
  PlayCircle,
  Plus,
  ShieldCheck,
  FileText,
  DollarSign,
  Download,
  CheckCircle2,
  Calendar,
  Building2,
  RefreshCw,
  Clock,
  Sparkles,
  ArrowRight,
  PieChart,
  Wallet,
  Receipt,
  FileCheck2,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency, maskCpf, formatDatePtBr } from '@/lib/formatters'
import { proLaboreService, type DiagnosticoFatorR } from '@/services/proLaboreService'
import { elisaOpsService, type ProcessoOperacionalRecord } from '@/services/elisaOpsService'
import type {
  SocioRecord,
  SocioStatus,
  ProLaboreLancamentoRecord,
  ProLaboreFatorRAlertaRecord,
  Empresa,
  Funcionario,
} from '@/types'
import { Link } from 'react-router-dom'

interface PainelProLaboreDistribuicaoProps {
  empresaSelecionadaId: string
  competenciaAtual: string
  empresas: Empresa[]
  funcionarios: Funcionario[]
}

export const PainelProLaboreDistribuicao: React.FC<PainelProLaboreDistribuicaoProps> = ({
  empresaSelecionadaId,
  competenciaAtual,
  empresas,
  funcionarios,
}) => {
  const { user } = useAuth()
  const { toast } = useToast()

  // Estados locais
  const [loading, setLoading] = useState(false)
  const [activeSubTab, setActiveSubTab] = useState<
    'pro_labore' | 'distribuicao' | 'socios' | 'fator_r'
  >('pro_labore')
  const [socios, setSocios] = useState<SocioRecord[]>([])
  const [lancamentos, setLancamentos] = useState<ProLaboreLancamentoRecord[]>([])
  const [alertasFatorR, setAlertasFatorR] = useState<ProLaboreFatorRAlertaRecord[]>([])
  const [diagnosticoFatorR, setDiagnosticoFatorR] = useState<DiagnosticoFatorR | null>(null)
  const [processoDemo, setProcessoDemo] = useState<ProcessoOperacionalRecord | null>(null)

  // Modais
  const [modalSocioOpen, setModalSocioOpen] = useState(false)
  const [editingSocio, setEditingSocio] = useState<SocioRecord | null>(null)
  const [salvandoSocio, setSalvandoSocio] = useState(false)

  // Modal de Simulação / Detalhes de Cálculo
  const [modalDetalheOpen, setModalDetalheOpen] = useState(false)
  const [detalheItem, setDetalheItem] = useState<ProLaboreLancamentoRecord | null>(null)

  // Modal de Aprovação Nível 3 (Chancela CRC)
  const [modalAprovacaoOpen, setModalAprovacaoOpen] = useState(false)
  const [processandoAprovacao, setProcessandoAprovacao] = useState(false)

  // Estado de execução da Elliza
  const [executandoAcaoElliza, setExecutandoAcaoElliza] = useState(false)

  // Form de Sócio
  const [formSocio, setFormSocio] = useState<{
    empresa: string
    nome_completo: string
    cpf: string
    email: string
    telefone: string
    cargo_funcao: string
    percentual_participacao: number
    quantidade_quotas: number
    valor_participacao: number
    pro_labore_definido: number
    data_inicio: string
    is_contribuinte_individual: boolean
    optante_distribuicao_lucros: boolean
    dependentes_irrf: number
    banco: string
    agencia: string
    conta: string
    chave_pix: string
    status: SocioStatus
    funcionario_vinculado: string
    observacoes: string
  }>({
    empresa: '',
    nome_completo: '',
    cpf: '',
    email: '',
    telefone: '',
    cargo_funcao: 'Sócio-Administrador',
    percentual_participacao: 50,
    quantidade_quotas: 10000,
    valor_participacao: 10000,
    pro_labore_definido: 5000,
    data_inicio: new Date().toISOString().split('T')[0],
    is_contribuinte_individual: true,
    optante_distribuicao_lucros: true,
    dependentes_irrf: 0,
    banco: '',
    agencia: '',
    conta: '',
    chave_pix: '',
    status: 'ativo',
    funcionario_vinculado: '',
    observacoes: '',
  })

  // Empresa efetiva
  const empresaIdEfetiva = useMemo(() => {
    if (empresaSelecionadaId && empresaSelecionadaId !== 'todas') {
      return empresaSelecionadaId
    }
    return empresas[0]?.id || ''
  }, [empresaSelecionadaId, empresas])

  const empresaAtualObj = useMemo(() => {
    return empresas.find((e) => e.id === empresaIdEfetiva)
  }, [empresas, empresaIdEfetiva])

  // Carregar dados
  const carregarDados = async () => {
    if (!user?.tenant_id) return
    setLoading(true)
    try {
      const [listaSocios, listaLanc, listaAlertas] = await Promise.all([
        proLaboreService.listSocios(user.tenant_id, empresaIdEfetiva),
        proLaboreService.listLancamentos(user.tenant_id, empresaIdEfetiva, competenciaAtual),
        proLaboreService.listAlertasFatorR(user.tenant_id, empresaIdEfetiva, competenciaAtual),
      ])

      setSocios(listaSocios)
      setLancamentos(listaLanc)
      setAlertasFatorR(listaAlertas)

      // Diagnóstico Fator R
      const totalProLaboreCompetencia = listaLanc.reduce(
        (acc, cur) => acc + (cur.valor_bruto || 0),
        0,
      )
      if (empresaIdEfetiva) {
        const diag = await proLaboreService.diagnosticarFatorR(
          user.tenant_id,
          empresaIdEfetiva,
          competenciaAtual,
          totalProLaboreCompetencia || 13000,
        )
        setDiagnosticoFatorR(diag)
      }

      // Buscar processo operacional demo vinculado ao POP-DP-01
      try {
        const procs = await elisaOpsService.listProcessos(user.tenant_id, {
          area: 'pessoal',
          empresaId: empresaIdEfetiva,
        })
        const pDemo = procs.find(
          (p) => p.codigo_sop === 'POP-DP-01' || p.titulo.includes('Pró-labore'),
        )
        if (pDemo) setProcessoDemo(pDemo)
      } catch {
        /* intentionally ignored */
      }
    } catch (err) {
      console.error('[PainelProLaboreDistribuicao] Erro ao carregar dados:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: String(err),
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [user?.tenant_id, empresaIdEfetiva, competenciaAtual])

  // Totais da Competência
  const totais = useMemo(() => {
    return lancamentos.reduce(
      (acc, cur) => {
        acc.bruto += cur.valor_bruto || 0
        acc.inss += cur.inss_retido || 0
        acc.irrf += cur.irrf_retido || 0
        acc.liquido += cur.valor_liquido || 0
        acc.distribuicao += cur.distribuicao_lucro_valor || 0
        return acc
      },
      { bruto: 0, inss: 0, irrf: 0, liquido: 0, distribuicao: 0 },
    )
  }, [lancamentos])

  // Ação: Abrir modal de novo sócio
  const handleOpenNovoSocio = (socio?: SocioRecord) => {
    if (socio) {
      setEditingSocio(socio)
      setFormSocio({
        empresa: socio.empresa,
        nome_completo: socio.nome_completo,
        cpf: socio.cpf,
        email: socio.email || '',
        telefone: socio.telefone || '',
        cargo_funcao: socio.cargo_funcao,
        percentual_participacao: socio.percentual_participacao,
        quantidade_quotas: socio.quantidade_quotas || 0,
        valor_participacao: socio.valor_participacao || 0,
        pro_labore_definido: socio.pro_labore_definido || 0,
        data_inicio: socio.data_inicio ? socio.data_inicio.split('T')[0] : '',
        is_contribuinte_individual: socio.is_contribuinte_individual ?? true,
        optante_distribuicao_lucros: socio.optante_distribuicao_lucros ?? true,
        dependentes_irrf: socio.dependentes_irrf || 0,
        banco: socio.banco || '',
        agencia: socio.agencia || '',
        conta: socio.conta || '',
        chave_pix: socio.chave_pix || '',
        status: socio.status,
        funcionario_vinculado: socio.funcionario_vinculado || '',
        observacoes: socio.observacoes || '',
      })
    } else {
      setEditingSocio(null)
      setFormSocio({
        empresa: empresaIdEfetiva,
        nome_completo: '',
        cpf: '',
        email: '',
        telefone: '',
        cargo_funcao: 'Sócio-Administrador',
        percentual_participacao: 50,
        quantidade_quotas: 10000,
        valor_participacao: 10000,
        pro_labore_definido: 5000,
        data_inicio: new Date().toISOString().split('T')[0],
        is_contribuinte_individual: true,
        optante_distribuicao_lucros: true,
        dependentes_irrf: 0,
        banco: '',
        agencia: '',
        conta: '',
        chave_pix: '',
        status: 'ativo',
        funcionario_vinculado: '',
        observacoes: '',
      })
    }
    setModalSocioOpen(true)
  }

  // Salvar Sócio
  const handleSalvarSocio = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.tenant_id) return
    if (!formSocio.empresa) {
      toast({ variant: 'destructive', title: 'Selecione uma empresa' })
      return
    }
    if (!formSocio.nome_completo.trim() || !formSocio.cpf.trim()) {
      toast({ variant: 'destructive', title: 'Nome e CPF são obrigatórios' })
      return
    }

    setSalvandoSocio(true)
    try {
      const payload: Partial<SocioRecord> = {
        tenant_id: user.tenant_id,
        empresa: formSocio.empresa,
        nome_completo: formSocio.nome_completo.trim(),
        cpf: formSocio.cpf.trim(),
        email: formSocio.email.trim(),
        telefone: formSocio.telefone.trim(),
        cargo_funcao: formSocio.cargo_funcao,
        percentual_participacao: Number(formSocio.percentual_participacao),
        quantidade_quotas: Number(formSocio.quantidade_quotas),
        valor_participacao: Number(formSocio.valor_participacao),
        pro_labore_definido: Number(formSocio.pro_labore_definido),
        data_inicio: new Date(formSocio.data_inicio).toISOString(),
        is_contribuinte_individual: Boolean(formSocio.is_contribuinte_individual),
        optante_distribuicao_lucros: Boolean(formSocio.optante_distribuicao_lucros),
        dependentes_irrf: Number(formSocio.dependentes_irrf),
        banco: formSocio.banco,
        agencia: formSocio.agencia,
        conta: formSocio.conta,
        chave_pix: formSocio.chave_pix,
        status: formSocio.status,
        funcionario_vinculado: formSocio.funcionario_vinculado || undefined,
        observacoes: formSocio.observacoes,
      }

      if (editingSocio) {
        await proLaboreService.updateSocio(editingSocio.id, payload)
        toast({ title: 'Sócio atualizado com sucesso!' })
      } else {
        await proLaboreService.createSocio(payload)
        toast({ title: 'Sócio cadastrado com sucesso!' })
      }
      setModalSocioOpen(false)
      carregarDados()
    } catch (err) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar sócio',
        description: String(err),
      })
    } finally {
      setSalvandoSocio(false)
    }
  }

  // Executar Ação da Elliza (Piloto Automático DP / Fator R)
  const handleExecutarAcaoElliza = async () => {
    if (!user?.tenant_id || !empresaIdEfetiva) return
    setExecutandoAcaoElliza(true)
    try {
      const res = await proLaboreService.processarProLaboreEDistribuicaoCompetencia({
        tenantId: user.tenant_id,
        empresaId: empresaIdEfetiva,
        competencia: competenciaAtual,
        solicitanteNome: user.name || 'Elliza Piloto',
      })

      toast({
        title: 'Elliza concluiu apuração!',
        description: res.mensagem,
      })

      // Se temos o processo na esteira, acionar também a próxima ação determinística da Elliza
      if (processoDemo && processoDemo.status !== 'AGUARDANDO_APROVACAO') {
        await elisaOpsService.executarProximaAcaoElisa({
          tenantId: user.tenant_id,
          processoId: processoDemo.id,
          empresaId: empresaIdEfetiva,
        })
      }

      await carregarDados()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Falha ao executar ação da Elliza',
        description: String(err),
      })
    } finally {
      setExecutandoAcaoElliza(false)
    }
  }

  // Formalização e Aprovação do Contador CRC (Nível 3)
  const handleFormalizarAprovacao = async () => {
    if (!user?.tenant_id || !empresaIdEfetiva) return
    setProcessandoAprovacao(true)
    try {
      const resp = await proLaboreService.formalizarEEnviarRecibos({
        tenantId: user.tenant_id,
        empresaId: empresaIdEfetiva,
        competencia: competenciaAtual,
        chanceladoPor: user.name || user.email || 'Contador Responsável CRC',
      })

      // Se existir o processo parado em AGUARDANDO_APROVACAO, atualizar para APROVADO
      if (processoDemo) {
        await elisaOpsService.updateProcesso(processoDemo.id, {
          status: 'CONCLUIDO',
          progresso_percentual: 100,
          decisao_necessaria_humana: '',
          resultado_ultima_acao:
            'Chancelado pelo Contador CRC. Recibos e retenções formalizados com sucesso.',
        })
      }

      toast({
        title: 'Chancela CRC Concluída!',
        description: resp.mensagem,
      })
      setModalAprovacaoOpen(false)
      await carregarDados()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro na aprovação',
        description: String(err),
      })
    } finally {
      setProcessandoAprovacao(false)
    }
  }

  // Resolver Alerta de Fator R
  const handleResolverAlerta = async (alertaId: string) => {
    try {
      await proLaboreService.resolverAlertaFatorR(
        alertaId,
        user?.name || user?.email || 'Contador CRC',
      )
      toast({
        title: 'Alerta arquivado',
        description: 'Recálculo e ciência do Fator R registrados na trilha de auditoria.',
      })
      await carregarDados()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao resolver alerta',
        description: String(err),
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Header do Módulo Pró-Labore & Distribuição */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge className="bg-[#0FA3A3] text-white text-xs font-bold gap-1">
              <Users2 className="h-3 w-3" />
              <span>Quadro Societário &amp; Sócios</span>
            </Badge>
            <Badge variant="outline" className="text-slate-700 text-xs font-mono">
              Competência: {competenciaAtual}
            </Badge>
            {empresaAtualObj && (
              <Badge variant="secondary" className="text-slate-800 text-xs font-medium">
                {empresaAtualObj.nome_fantasia || empresaAtualObj.razao_social}
              </Badge>
            )}
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold">
              INSS Contribuinte Individual (11%) • IRRF Progressivo
            </Badge>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Pró-labore, Distribuição de Lucros &amp; Fator R
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestão integrada de remuneração societária com retenção previdenciária/fiscal e
            monitoramento automático do limiar de 28% no Simples Nacional.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarDados}
            disabled={loading}
            className="rounded-xl text-xs h-9 border-slate-200 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenNovoSocio()}
            className="rounded-xl text-xs h-9 border-[#0FA3A3] text-[#0FA3A3] hover:bg-teal-50 font-bold gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Cadastrar Sócio</span>
          </Button>

          <Button
            size="sm"
            onClick={handleExecutarAcaoElliza}
            disabled={executandoAcaoElliza}
            className="rounded-xl text-xs font-bold h-9 bg-[#0FA3A3] hover:bg-[#0C8585] text-white shadow-xs gap-1.5"
          >
            <PlayCircle className={`h-4 w-4 ${executandoAcaoElliza ? 'animate-spin' : ''}`} />
            <span>{executandoAcaoElliza ? 'Apurando...' : 'Apurar Pró-labore da Competência'}</span>
          </Button>
        </div>
      </div>

      {/* 2. Bloco Ações da Elliza (Padrão Unificado da Plataforma) */}
      <Card className="rounded-2xl border-2 border-teal-500/40 bg-gradient-to-br from-teal-50/60 via-white to-cyan-50/30 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-teal-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0FA3A3] text-white shadow-xs shrink-0 mt-0.5">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-slate-900">
                  🤖 Ações da Elliza — Esteira de Pró-labore e Fator R
                </h3>
                <Badge className="bg-teal-100 text-teal-800 text-[10px] font-bold">
                  SOP: POP-DP-01
                </Badge>
                {processoDemo && (
                  <Badge
                    className={`text-[10px] font-bold ${
                      processoDemo.status === 'AGUARDANDO_APROVACAO'
                        ? 'bg-amber-500 text-white animate-pulse'
                        : processoDemo.status === 'CONCLUIDO'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-blue-600 text-white'
                    }`}
                  >
                    Status: {processoDemo.status.replace('_', ' ')}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                A Elliza apura a remuneração dos sócios, confronta com o teto do INSS (R$ 7.786,02),
                calcula o IRRF e monitora em tempo real a oscilação do Fator R (Anexo III vs Anexo
                V).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {processoDemo?.id && (
              <Link to={`/processos/${processoDemo.id}`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 text-xs font-semibold border-slate-300 rounded-xl gap-1.5"
                >
                  <FileText className="h-3.5 w-3.5 text-slate-600" />
                  <span>Ver na Esteira</span>
                </Button>
              </Link>
            )}

            {processoDemo?.status === 'AGUARDANDO_APROVACAO' ? (
              <Button
                size="lg"
                onClick={() => setModalAprovacaoOpen(true)}
                className="h-10 px-5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-md gap-2 rounded-xl"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>[ APROVAR CHANCELA CRC (NÍVEL 3) ]</span>
              </Button>
            ) : (
              <Button
                size="lg"
                disabled={executandoAcaoElliza}
                onClick={handleExecutarAcaoElliza}
                className="h-10 px-5 bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-extrabold text-xs shadow-md gap-2 rounded-xl"
              >
                <PlayCircle className={`h-4 w-4 ${executandoAcaoElliza ? 'animate-spin' : ''}`} />
                <span>{executandoAcaoElliza ? 'EXECUTANDO...' : '[ EXECUTAR PRÓXIMA AÇÃO ]'}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Detalhes da Ação Atual da Elliza */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 text-xs">
          <div className="rounded-xl bg-white border border-slate-200 p-3 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Etapa Atual
            </span>
            <span className="font-bold text-slate-900 block mt-0.5 truncate">
              {processoDemo?.etapa_atual_nome || '4. Conferência técnica do Contador CRC (Nível 3)'}
            </span>
          </div>

          <div className="rounded-xl bg-white border border-slate-200 p-3 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-teal-700 block">
              Próxima Ação
            </span>
            <span className="font-semibold text-slate-800 block mt-0.5 line-clamp-2">
              {processoDemo?.proxima_acao ||
                'Validar cálculo de INSS/IRRF e aprovar formalização de recibos de pró-labore.'}
            </span>
          </div>

          <div className="rounded-xl bg-white border border-slate-200 p-3 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Critério de Sucesso
            </span>
            <span className="text-slate-700 block mt-0.5 line-clamp-2">
              {processoDemo?.criterio_sucesso_atual ||
                'Retenções e limites de Fator R validados matematicamente sem divergência.'}
            </span>
          </div>

          <div className="rounded-xl bg-white border border-slate-200 p-3 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Última Execução
            </span>
            <span className="text-emerald-700 font-medium block mt-0.5 line-clamp-2">
              {processoDemo?.ultima_acao_executada ||
                'Etapa 3 concluída: Alerta de cruzamento de 28% no Fator R emitido com sucesso.'}
            </span>
          </div>
        </div>

        {/* Banner de Aprovação Humana Obrigatória */}
        {processoDemo?.status === 'AGUARDANDO_APROVACAO' && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-amber-900 font-semibold">
                {processoDemo.decisao_necessaria_humana ||
                  'Modo Humano: Esta etapa requer conferência técnica e aprovação pelo Contador CRC antes da emissão dos recibos.'}
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => setModalAprovacaoOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-7 font-bold shrink-0 rounded-lg"
            >
              Chancelar Agora
            </Button>
          </div>
        )}
      </Card>

      {/* 3. Painel de Alertas de Fator R (Requisito Explícito do Usuário) */}
      <Card className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-2xs">
        <div className="flex items-start justify-between gap-4 border-b border-amber-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                <span>Monitoramento Ativo do Fator R (Simples Nacional — Limiar 28%)</span>
                {alertasFatorR.some((a) => !a.resolvido) && (
                  <Badge className="bg-amber-600 text-white text-[10px] font-bold">
                    Alerta Ativo
                  </Badge>
                )}
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                Proporção Folha de Pagamentos + Pró-labore sobre a Receita Bruta dos últimos 12
                meses (RBT12).
              </p>
            </div>
          </div>

          {diagnosticoFatorR && (
            <div className="flex items-center gap-3 text-right">
              <div>
                <span className="text-[10px] text-amber-700 uppercase font-bold block">
                  Fator R Atual
                </span>
                <span className="text-base font-black text-amber-900">
                  {diagnosticoFatorR.fatorRAtual.toFixed(2)}%
                </span>
              </div>
              <ArrowRight className="h-4 w-4 text-amber-500" />
              <div>
                <span className="text-[10px] text-teal-700 uppercase font-bold block">
                  Projetado c/ Pró-labore
                </span>
                <span className="text-base font-black text-[#0FA3A3]">
                  {diagnosticoFatorR.fatorRProjetado.toFixed(2)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Cards de Alertas Registrados */}
        <div className="mt-4 space-y-3">
          {alertasFatorR.length === 0 ? (
            <div className="bg-white/80 border border-amber-200/60 rounded-xl p-4 text-center text-xs text-slate-600">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
              <p className="font-semibold text-slate-800">
                Fator R em conformidade regular para a competência {competenciaAtual}.
              </p>
              <p className="text-[11px] text-slate-500">
                Não foram detectadas oscilações críticas de anexo ou limites tributários pendentes.
              </p>
            </div>
          ) : (
            alertasFatorR.map((alerta) => (
              <div
                key={alerta.id}
                className={`rounded-xl border p-4 transition-all ${
                  alerta.resolvido
                    ? 'bg-white/70 border-slate-200 opacity-75'
                    : 'bg-white border-amber-300 shadow-2xs ring-1 ring-amber-400/20'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        className={`text-[10px] font-bold ${
                          alerta.severidade === 'alta'
                            ? 'bg-rose-600 text-white'
                            : 'bg-amber-500 text-white'
                        }`}
                      >
                        Severidade: {alerta.severidade.toUpperCase()}
                      </Badge>
                      <h4 className="text-xs font-black text-slate-900">{alerta.titulo}</h4>
                      {alerta.resolvido && (
                        <Badge
                          variant="outline"
                          className="text-emerald-700 border-emerald-300 text-[10px]"
                        >
                          ✓ Resolvido / Ciente
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{alerta.mensagem}</p>

                    {alerta.acao_recomendada && (
                      <p className="text-[11px] text-amber-900 bg-amber-100/60 p-2 rounded-lg font-medium">
                        💡 <strong>Ação Recomendada pela Elliza:</strong> {alerta.acao_recomendada}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1">
                      <span>RBT12: {formatCurrency(alerta.rbt12 || 0)}</span>
                      <span>Folha 12m: {formatCurrency(alerta.folha12 || 0)}</span>
                      {alerta.enquadramento_novo && (
                        <span className="font-semibold text-[#0FA3A3]">
                          Novo Enquadramento: {alerta.enquadramento_novo}
                        </span>
                      )}
                    </div>
                  </div>

                  {!alerta.resolvido && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResolverAlerta(alerta.id)}
                      className="rounded-xl text-xs h-8 border-amber-300 text-amber-900 hover:bg-amber-100 font-semibold shrink-0"
                    >
                      Dar Ciência / Recalculado
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* 4. Totalizadores Gerais da Competência */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="rounded-2xl border-slate-200 shadow-2xs">
          <CardContent className="p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Pró-labore Bruto
            </span>
            <div className="text-xl font-black text-slate-900 mt-1">
              {formatCurrency(totais.bruto)}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {lancamentos.length} sócio(s) apurado(s)
            </span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-2xs">
          <CardContent className="p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              INSS Retido (11%)
            </span>
            <div className="text-xl font-black text-blue-700 mt-1">
              {formatCurrency(totais.inss)}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Teto Salário Contrib.: R$ 7.786,02
            </span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-2xs">
          <CardContent className="p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              IRRF Retido
            </span>
            <div className="text-xl font-black text-rose-700 mt-1">
              {formatCurrency(totais.irrf)}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Lei 14.663/23 c/ Simplificado
            </span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-2xs">
          <CardContent className="p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Líquido a Pagar
            </span>
            <div className="text-xl font-black text-emerald-700 mt-1">
              {formatCurrency(totais.liquido)}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">TED / PIX aos titulares</span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-2xs bg-teal-50/40 border-teal-200">
          <CardContent className="p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 block">
              Distribuição de Lucros
            </span>
            <div className="text-xl font-black text-[#0FA3A3] mt-1">
              {formatCurrency(totais.distribuicao)}
            </div>
            <span className="text-[10px] text-teal-700 mt-0.5 block font-medium">
              100% Isenta de IR (Lei 9.249/95)
            </span>
          </CardContent>
        </Card>
      </div>

      {/* 5. Abas de Detalhamento: Folha Pró-labore, Distribuição de Lucros e Cadastro de Sócios */}
      <Tabs
        value={activeSubTab}
        onValueChange={(v) => setActiveSubTab(v as any)}
        className="w-full"
      >
        <TabsList className="bg-slate-200/60 p-1 rounded-xl h-10 w-full sm:w-auto">
          <TabsTrigger value="pro_labore" className="gap-2 text-xs font-semibold rounded-lg">
            <Receipt className="h-4 w-4 text-[#0FA3A3]" />
            <span>Folha de Pró-labore ({lancamentos.length})</span>
          </TabsTrigger>
          <TabsTrigger value="distribuicao" className="gap-2 text-xs font-semibold rounded-lg">
            <Wallet className="h-4 w-4 text-emerald-600" />
            <span>Distribuição de Lucros</span>
          </TabsTrigger>
          <TabsTrigger value="socios" className="gap-2 text-xs font-semibold rounded-lg">
            <Users2 className="h-4 w-4 text-sky-600" />
            <span>Quadro de Sócios ({socios.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* ABA: FOLHA DE PRÓ-LABORE */}
        <TabsContent value="pro_labore" className="space-y-4 mt-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Lançamentos de Pró-labore — Competência {competenciaAtual}
                </h3>
                <p className="text-xs text-slate-500">
                  Valores calculados com regras fiscais de contribuinte individual e tabela de IRRF
                  vigente.
                </p>
              </div>

              {lancamentos.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setModalAprovacaoOpen(true)}
                  className="rounded-xl text-xs h-8 font-bold border-emerald-300 text-emerald-700 hover:bg-emerald-50 gap-1.5"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Formalizar Folha CRC</span>
                </Button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Sócio / CPF</th>
                    <th className="py-3 px-4">Cargo / Função</th>
                    <th className="py-3 px-4 text-right">Pró-labore Bruto</th>
                    <th className="py-3 px-4 text-right">INSS (11%)</th>
                    <th className="py-3 px-4 text-right">IRRF Retido</th>
                    <th className="py-3 px-4 text-right">Valor Líquido</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Carregando pró-labore dos sócios...
                      </td>
                    </tr>
                  ) : lancamentos.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Nenhum pró-labore apurado para esta competência. Clique em{' '}
                        <strong>"Apurar Pró-labore da Competência"</strong> para executar o cálculo.
                      </td>
                    </tr>
                  ) : (
                    lancamentos.map((item) => {
                      const socioObj = item.expand?.socio
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-900 block">
                              {socioObj?.nome_completo || 'Sócio'}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              CPF: {maskCpf(socioObj?.cpf || '')}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-600">
                            {socioObj?.cargo_funcao || 'Sócio'}
                            <span className="block text-[10px] text-slate-400">
                              Participação: {socioObj?.percentual_participacao || 0}%
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(item.valor_bruto)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-blue-700">
                            {formatCurrency(item.inss_retido)}
                            {item.atingiu_teto_inss && (
                              <span className="block text-[9px] text-amber-700 font-bold uppercase">
                                Teto Atingido
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-rose-700">
                            {formatCurrency(item.irrf_retido)}
                            {item.deducao_simplificada_usada && (
                              <span className="block text-[9px] text-teal-700 font-medium">
                                Desc. Simplificado
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                            {formatCurrency(item.valor_liquido)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <Badge
                              className={`text-[10px] font-bold ${
                                item.status === 'aprovado'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-teal-100 text-[#0FA3A3]'
                              }`}
                            >
                              {item.status.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDetalheItem(item)
                                setModalDetalheOpen(true)
                              }}
                              className="h-7 px-2 text-[11px] text-[#0FA3A3] hover:bg-teal-50"
                            >
                              <Info className="h-3.5 w-3.5 mr-1" />
                              Memória
                            </Button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ABA: DISTRIBUIÇÃO DE LUCROS */}
        <TabsContent value="distribuicao" className="space-y-4 mt-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Distribuição de Lucros Isentos por Sócio (Base Legal: Lei 9.249/95 art. 10)
                </h3>
                <p className="text-xs text-slate-500">
                  Integrado ao resultado contábil da competência com rateio rigoroso pela
                  participação societária.
                </p>
              </div>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold">
                Isenção 100% de IRPF
              </Badge>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {socios
                .filter((s) => s.optante_distribuicao_lucros)
                .map((s) => {
                  const lancSocio = lancamentos.find((l) => l.socio === s.id)
                  const valorDist = lancSocio?.distribuicao_lucro_valor || 0
                  const isAguardando = lancSocio?.distribuicao_status === 'aguardando_fechamento'

                  return (
                    <Card key={s.id} className="rounded-xl border-slate-200 shadow-2xs">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900 block">
                              {s.nome_completo}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {s.cargo_funcao} • {s.percentual_participacao}% de quotas
                            </span>
                          </div>
                          <Badge
                            className={`text-[10px] font-bold ${
                              isAguardando
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isAguardando ? 'AGUARDANDO FECHAMENTO' : 'APURADO'}
                          </Badge>
                        </div>

                        <div className="rounded-lg bg-slate-50 p-3 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              Lucro Isento Projetado
                            </span>
                            <span className="text-lg font-black text-slate-900">
                              {isAguardando ? 'Aguardando DRE' : formatCurrency(valorDist)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              Conta Bancária / PIX
                            </span>
                            <span className="text-xs font-mono text-slate-700">
                              {s.chave_pix || s.conta || 'Não cadastrado'}
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          {isAguardando
                            ? 'Parada honesta da Elliza: O balancete da competência ainda não foi encerrado pelo contador. O valor será consolidado automaticamente após o fechamento contábil.'
                            : 'Distribuição chancelada em conformidade com o Contrato Social e apuração do resultado contábil.'}
                        </p>
                      </CardContent>
                    </Card>
                  )
                })}
            </div>
          </div>
        </TabsContent>

        {/* ABA: QUADRO DE SÓCIOS */}
        <TabsContent value="socios" className="space-y-4 mt-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Sócios e Quotistas Cadastrados ({socios.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Definição de quotas, remuneração mensal de pró-labore e vínculo de contribuinte
                  individual.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => handleOpenNovoSocio()}
                className="rounded-xl text-xs font-bold h-8 bg-[#0FA3A3] text-white hover:bg-[#0C8585] gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Novo Sócio</span>
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Nome Completo / CPF</th>
                    <th className="py-3 px-4">Cargo / Função</th>
                    <th className="py-3 px-4 text-center">Participação (%)</th>
                    <th className="py-3 px-4 text-right">Pró-labore Definido</th>
                    <th className="py-3 px-4 text-center">Contribuinte Individual</th>
                    <th className="py-3 px-4 text-center">Distribuição Lucros</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {socios.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Nenhum sócio cadastrado. Clique em "Novo Sócio" para iniciar.
                      </td>
                    </tr>
                  ) : (
                    socios.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 block">{s.nome_completo}</span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            CPF: {maskCpf(s.cpf)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-700">{s.cargo_funcao}</td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                          {s.percentual_participacao}%
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-[#0FA3A3]">
                          {formatCurrency(s.pro_labore_definido || 0)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {s.is_contribuinte_individual ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                              Sim (11%)
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-500 text-[10px]">
                              Não
                            </Badge>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {s.optante_distribuicao_lucros ? (
                            <Badge className="bg-teal-50 text-[#0FA3A3] border-teal-200 text-[10px]">
                              Optante
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-500 text-[10px]">
                              Inapto
                            </Badge>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <Badge
                            className={`text-[10px] font-bold ${
                              s.status === 'ativo'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {s.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenNovoSocio(s)}
                            className="h-7 px-2 text-[11px] text-slate-600 hover:text-[#0FA3A3]"
                          >
                            Editar
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* MODAL 1: CADASTRAR / EDITAR SÓCIO */}
      <Dialog open={modalSocioOpen} onOpenChange={setModalSocioOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingSocio ? 'Editar Sócio' : 'Novo Sócio / Quotista'}</DialogTitle>
            <DialogDescription>
              Vincule o sócio à empresa com quotas de capital, pró-labore definido e dados de
              retenção tributária.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarSocio} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <Label>Empresa</Label>
                <Select
                  value={formSocio.empresa}
                  onValueChange={(v) => setFormSocio({ ...formSocio, empresa: v })}
                >
                  <SelectTrigger className="h-9 text-xs">
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

              <div className="space-y-1">
                <Label>Cargo / Função</Label>
                <Select
                  value={formSocio.cargo_funcao}
                  onValueChange={(v) => setFormSocio({ ...formSocio, cargo_funcao: v })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sócio-Administrador">Sócio-Administrador</SelectItem>
                    <SelectItem value="Sócio-Quotista">Sócio-Quotista</SelectItem>
                    <SelectItem value="Titular">Titular</SelectItem>
                    <SelectItem value="Diretor Estatutário">Diretor Estatutário</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Nome Completo</Label>
                <Input
                  required
                  value={formSocio.nome_completo}
                  onChange={(e) => setFormSocio({ ...formSocio, nome_completo: e.target.value })}
                  placeholder="Nome do sócio"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label>CPF</Label>
                <Input
                  required
                  value={formSocio.cpf}
                  onChange={(e) => setFormSocio({ ...formSocio, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label>Participação (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                  value={formSocio.percentual_participacao}
                  onChange={(e) =>
                    setFormSocio({ ...formSocio, percentual_participacao: Number(e.target.value) })
                  }
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label>Pró-labore Mensal Acordado (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formSocio.pro_labore_definido}
                  onChange={(e) =>
                    setFormSocio({ ...formSocio, pro_labore_definido: Number(e.target.value) })
                  }
                  className="h-9 text-xs font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label>Dependentes para IRRF</Label>
                <Input
                  type="number"
                  min="0"
                  value={formSocio.dependentes_irrf}
                  onChange={(e) =>
                    setFormSocio({ ...formSocio, dependentes_irrf: Number(e.target.value) })
                  }
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label>Data de Início no Contrato</Label>
                <Input
                  type="date"
                  value={formSocio.data_inicio}
                  onChange={(e) => setFormSocio({ ...formSocio, data_inicio: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label>Chave PIX para Recebimento</Label>
                <Input
                  value={formSocio.chave_pix}
                  onChange={(e) => setFormSocio({ ...formSocio, chave_pix: e.target.value })}
                  placeholder="CPF, celular ou e-mail"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label>Vínculo com Colaborador CLT (Opcional)</Label>
                <Select
                  value={formSocio.funcionario_vinculado || 'nenhum'}
                  onValueChange={(v) =>
                    setFormSocio({
                      ...formSocio,
                      funcionario_vinculado: v === 'nenhum' ? '' : v,
                    })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Vincular se houver ficha DP" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Nenhum (Entidade Própria)</SelectItem>
                    {funcionarios.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome_completo} ({f.cargo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSocio.is_contribuinte_individual}
                  onChange={(e) =>
                    setFormSocio({ ...formSocio, is_contribuinte_individual: e.target.checked })
                  }
                  className="rounded border-slate-300"
                />
                <span>Contribuinte Individual (recolhe INSS 11%)</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSocio.optante_distribuicao_lucros}
                  onChange={(e) =>
                    setFormSocio({ ...formSocio, optante_distribuicao_lucros: e.target.checked })
                  }
                  className="rounded border-slate-300"
                />
                <span>Habilitar Distribuição de Lucros Isentos</span>
              </label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalSocioOpen(false)}
                className="h-9 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvandoSocio}
                className="h-9 text-xs font-bold bg-[#0FA3A3] text-white hover:bg-[#0C8585]"
              >
                {salvandoSocio ? 'Salvando...' : 'Salvar Sócio'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: MEMÓRIA DE CÁLCULO E DETALHE DO PRÓ-LABORE */}
      <Dialog open={modalDetalheOpen} onOpenChange={setModalDetalheOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Memória de Cálculo de Pró-labore</DialogTitle>
            <DialogDescription>
              Detalhamento das retenções legais aplicadas na competência {competenciaAtual}.
            </DialogDescription>
          </DialogHeader>

          {detalheItem && (
            <div className="space-y-4 text-xs">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500">Pró-labore Bruto Acordado:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(detalheItem.valor_bruto)}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500">Base de Cálculo INSS (Teto: R$ 7.786,02):</span>
                  <span className="font-mono text-slate-800">
                    {formatCurrency(detalheItem.base_inss)}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-blue-700 font-semibold">
                    (-) INSS Contribuinte Individual (11%):
                  </span>
                  <span className="font-mono font-bold text-blue-700">
                    {formatCurrency(detalheItem.inss_retido)}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500">Base de Cálculo IRRF:</span>
                  <span className="font-mono text-slate-800">
                    {formatCurrency(detalheItem.base_irrf)}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-rose-700 font-semibold">
                    (-) IRRF Retido (Alíq. {detalheItem.aliquota_irrf}%):
                  </span>
                  <span className="font-mono font-bold text-rose-700">
                    {formatCurrency(detalheItem.irrf_retido)}
                  </span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-emerald-800 font-bold text-sm">
                    (=) Valor Líquido a Pagar:
                  </span>
                  <span className="font-mono font-black text-emerald-700 text-sm">
                    {formatCurrency(detalheItem.valor_liquido)}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3">
                <span className="font-bold text-teal-900 block mb-1">
                  Distribuição de Lucros Isentos da Competência:
                </span>
                <p className="text-teal-800">
                  Valor Apurado:{' '}
                  <strong>{formatCurrency(detalheItem.distribuicao_lucro_valor || 0)}</strong>{' '}
                  (Status: {detalheItem.distribuicao_status.toUpperCase()})
                </p>
                <p className="text-[11px] text-teal-700 mt-1">
                  Base legal: Lei 9.249/95 art. 10 e LC 123/2006 art. 14.
                </p>
              </div>

              <div className="text-[10px] text-slate-400 font-mono">
                Recibo Nº: {detalheItem.numero_recibo || '—'} • Hash: {detalheItem.hash_evidencia}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalDetalheOpen(false)}
              className="h-8 text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: APROVAÇÃO TÉCNICA CRC (NÍVEL 3) */}
      <Dialog open={modalAprovacaoOpen} onOpenChange={setModalAprovacaoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-900">
              <ShieldCheck className="h-5 w-5 text-amber-600" />
              <span>Chancela Técnica do Contador CRC (Nível 3)</span>
            </DialogTitle>
            <DialogDescription>
              Aprovação obrigatória de conformidade da folha de pró-labore e validação dos alertas
              do Fator R para a competência {competenciaAtual}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900">
              <p className="font-bold">Resumo da Competência:</p>
              <ul className="list-disc pl-4 mt-1 space-y-1">
                <li>Total Pró-labore: {formatCurrency(totais.bruto)}</li>
                <li>INSS Total Recolhido: {formatCurrency(totais.inss)}</li>
                <li>IRRF Total Retido: {formatCurrency(totais.irrf)}</li>
                <li>Fator R Projetado: {diagnosticoFatorR?.fatorRProjetado.toFixed(2)}%</li>
              </ul>
            </div>

            <p className="text-slate-600 leading-relaxed">
              Ao chancelar, os recibos de pró-labore serão formalizados no GED da plataforma com
              hash SHA-256 e o processo na esteira da Elliza avançará para conclusão.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalAprovacaoOpen(false)}
              className="h-9 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={processandoAprovacao}
              onClick={handleFormalizarAprovacao}
              className="h-9 text-xs font-bold bg-amber-600 text-white hover:bg-amber-700"
            >
              {processandoAprovacao ? 'Formalizando...' : 'Chancelar e Aprovar Folha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

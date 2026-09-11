import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  FileText,
  Building2,
  ArrowRight,
  RefreshCw,
  Search,
  Filter,
  ExternalLink,
  ShieldAlert,
  Percent,
  TrendingUp,
  AlertCircle,
  Layers,
  Edit3,
  Calendar,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { empresasService } from '@/services/empresas'
import { contabilService } from '@/services/contabil'
import { preLancamentoService } from '@/services/preLancamento'
import type { Empresa, ContaContabil, PreLancamentoRecord, PreLancamentoStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { cn } from '@/lib/utils'

export default function PreLancamentoPage() {
  const { tenant, member, user } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [sugestoes, setSugestoes] = useState<PreLancamentoRecord[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [contas, setContas] = useState<ContaContabil[]>([])

  // Filtros
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('todas')
  const [filtroCompetencia, setFiltroCompetencia] = useState<string>('todas')
  const [filtroStatus, setFiltroStatus] = useState<string>('todas')
  const [filtroConfianca, setFiltroConfianca] = useState<number>(0)
  const [busca, setBusca] = useState<string>('')

  // Ações e Modais
  const [analisandoPendentes, setAnalisandoPendentes] = useState(false)
  const [itemEmEdicao, setItemEmEdicao] = useState<PreLancamentoRecord | null>(null)
  const [modalEditarOpen, setModalEditarOpen] = useState(false)
  const [modalRejeitarOpen, setModalRejeitarOpen] = useState(false)
  const [itemParaRejeitar, setItemParaRejeitar] = useState<PreLancamentoRecord | null>(null)
  const [motivoRejeicao, setMotivoRejeicao] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Formulário de Edição antes de Aceitar
  const [editDebito, setEditDebito] = useState('')
  const [editCredito, setEditCredito] = useState('')
  const [editValor, setEditValor] = useState<number>(0)
  const [editHistorico, setEditHistorico] = useState('')
  const [editCompetencia, setEditCompetencia] = useState('')

  // Permissões
  // Auxiliar pode sugerir e rejeitar; Aceitar (gerar lançamento) segue a regra de confirmação de lançamentos (administrador e contador)
  const perfil = member?.perfil || 'auxiliar'
  const canAceitar = perfil === 'administrador' || perfil === 'contador'
  const canRejeitar = perfil === 'administrador' || perfil === 'contador' || perfil === 'auxiliar'

  // Carregar Dados Iniciais
  const carregarDados = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const [sugList, emps, contasPlano] = await Promise.all([
        preLancamentoService.list(tenant.id, {
          empresaId: filtroEmpresa,
          competencia: filtroCompetencia,
          status: filtroStatus,
          confiancaMinima: filtroConfianca,
          busca,
        }),
        empresasService.list(tenant.id),
        contabilService.getPlanoContas(tenant.id, 'ativa = true'),
      ])
      setSugestoes(sugList)
      setEmpresas(emps)
      setContas(contasPlano)
    } catch (err) {
      console.error('Erro ao carregar pré-lançamentos:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar sugestões',
        description: 'Não foi possível carregar os pré-lançamentos contábeis.',
      })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, filtroEmpresa, filtroCompetencia, filtroStatus, filtroConfianca, busca, toast])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Totalizadores
  const totalPendentes = useMemo(
    () => sugestoes.filter((s) => s.status === 'pendente').length,
    [sugestoes],
  )
  const totalAltaConfianca = useMemo(
    () => sugestoes.filter((s) => s.status === 'pendente' && s.confianca >= 80).length,
    [sugestoes],
  )
  const totalConvertidasHoje = useMemo(() => {
    const hojeStr = new Date().toISOString().slice(0, 10)
    return sugestoes.filter(
      (s) => s.status === 'convertido' && (s.data_processamento || '').startsWith(hojeStr),
    ).length
  }, [sugestoes])
  const valorTotalSugerido = useMemo(
    () =>
      sugestoes
        .filter((s) => s.status === 'pendente')
        .reduce((acc, curr) => acc + (curr.valor_sugerido || 0), 0),
    [sugestoes],
  )

  // Disparar Análise dos Documentos Pendentes no GED
  const handleAnalisarPendentes = async () => {
    if (!tenant?.id) return
    setAnalisandoPendentes(true)
    try {
      const res = await preLancamentoService.analisarDocumentosPendentes(
        tenant.id,
        filtroEmpresa !== 'todas' ? filtroEmpresa : undefined,
        filtroCompetencia !== 'todas' ? filtroCompetencia : undefined,
      )
      toast({
        title: 'Análise de Documentos Concluída!',
        description: `${res.analisados} documentos analisados, ${res.novasSugestoes} novas sugestões contábeis geradas (${res.altaConfianca} de alta confiança).`,
      })
      void carregarDados()
    } catch (err: any) {
      console.error('Erro ao analisar documentos:', err)
      toast({
        variant: 'destructive',
        title: 'Erro no motor de sugestão',
        description: err?.message || 'Falha ao analisar documentos classificados do GED.',
      })
    } finally {
      setAnalisandoPendentes(false)
    }
  }

  // Abrir Modal de Edição/Revisão
  const handleAbrirEdicao = (item: PreLancamentoRecord) => {
    setItemEmEdicao(item)
    setEditDebito(item.debito_sugerido || '')
    setEditCredito(item.credito_sugerido || '')
    setEditValor(item.valor_sugerido || 0)
    setEditHistorico(item.historico_sugerido || '')
    setEditCompetencia(item.competencia || '09/2026')
    setModalEditarOpen(true)
  }

  // Salvar Edição da Sugestão
  const handleSalvarEdicao = async (aceitarAposSalvar = false) => {
    if (!itemEmEdicao || !tenant?.id || !user?.id) return
    setActionLoading(true)
    try {
      if (aceitarAposSalvar) {
        if (!canAceitar) {
          toast({
            variant: 'destructive',
            title: 'Permissão restrita',
            description:
              'Apenas Contadores ou Administradores podem converter em lançamento contábil.',
          })
          return
        }

        await preLancamentoService.aceitar(itemEmEdicao.id, user.id, {
          debitoContaId: editDebito,
          creditoContaId: editCredito,
          valor: editValor,
          historico: editHistorico,
          competencia: editCompetencia,
        })

        toast({
          title: 'Lançamento Contábil Confirmado!',
          description: `Partida dobrada de R$ ${editValor.toFixed(2)} criada com sucesso na competência ${editCompetencia}.`,
        })
      } else {
        await preLancamentoService.update(itemEmEdicao.id, {
          debito_sugerido: editDebito,
          credito_sugerido: editCredito,
          valor_sugerido: editValor,
          historico_sugerido: editHistorico,
          competencia: editCompetencia,
        })

        toast({
          title: 'Sugestão atualizada',
          description: 'Os dados do pré-lançamento foram revisados com sucesso.',
        })
      }

      setModalEditarOpen(false)
      setItemEmEdicao(null)
      void carregarDados()
    } catch (err: any) {
      console.error('Erro ao salvar/aceitar pré-lançamento:', err)
      toast({
        variant: 'destructive',
        title: 'Operação não permitida',
        description: err?.message || 'Falha ao processar o pré-lançamento.',
      })
    } finally {
      setActionLoading(false)
    }
  }

  // Aceitar Direto (com contas sugeridas)
  const handleAceitarDireto = async (item: PreLancamentoRecord) => {
    if (!user?.id) return
    if (!canAceitar) {
      toast({
        variant: 'destructive',
        title: 'Permissão restrita',
        description: 'Apenas Contadores ou Administradores podem efetivar lançamentos contábeis.',
      })
      return
    }

    if (!item.debito_sugerido || !item.credito_sugerido) {
      handleAbrirEdicao(item)
      return
    }

    setActionLoading(true)
    try {
      await preLancamentoService.aceitar(item.id, user.id)
      toast({
        title: 'Partida Dobrada Efetivada!',
        description: `Lançamento de R$ ${item.valor_sugerido.toFixed(2)} gerado para a competência ${item.competencia}.`,
      })
      void carregarDados()
    } catch (err: any) {
      console.error('Erro ao aceitar sugestão:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao efetivar lançamento',
        description: err?.message || 'Falha ao converter sugestão em lançamento contábil.',
      })
    } finally {
      setActionLoading(false)
    }
  }

  // Abrir Modal Rejeição
  const handleAbrirRejeicao = (item: PreLancamentoRecord) => {
    setItemParaRejeitar(item)
    setMotivoRejeicao('')
    setModalRejeitarOpen(true)
  }

  // Confirmar Rejeição
  const handleConfirmarRejeicao = async () => {
    if (!itemParaRejeitar || !user?.id) return
    setActionLoading(true)
    try {
      await preLancamentoService.rejeitar(itemParaRejeitar.id, motivoRejeicao, user.id)
      toast({
        title: 'Sugestão Rejeitada',
        description: 'O pré-lançamento foi marcado como rejeitado.',
      })
      setModalRejeitarOpen(false)
      setItemParaRejeitar(null)
      void carregarDados()
    } catch (err: any) {
      console.error('Erro ao rejeitar sugestão:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao rejeitar',
        description: err?.message || 'Falha ao registrar a rejeição.',
      })
    } finally {
      setActionLoading(false)
    }
  }

  // Badge de Confiança
  const getBadgeConfianca = (confianca: number) => {
    if (confianca >= 80) {
      return (
        <Badge className="bg-emerald-100 text-[#16A34A] border-emerald-300 font-bold text-[10px] gap-1">
          <Sparkles className="h-3 w-3" />
          <span>{confianca}% Alta</span>
        </Badge>
      )
    }
    if (confianca >= 60) {
      return (
        <Badge className="bg-amber-100 text-[#D97706] border-amber-300 font-bold text-[10px] gap-1">
          <span>{confianca}% Média</span>
        </Badge>
      )
    }
    return (
      <Badge className="bg-slate-100 text-[#64748B] border-slate-300 font-medium text-[10px] gap-1">
        <span>{confianca}% Baixa</span>
      </Badge>
    )
  }

  // Badge de Status
  const getBadgeStatus = (status: PreLancamentoStatus) => {
    switch (status) {
      case 'convertido':
      case 'aceito':
        return (
          <Badge className="bg-emerald-100 text-[#16A34A] border-emerald-200 text-[10px] font-bold">
            Convertido
          </Badge>
        )
      case 'rejeitado':
        return (
          <Badge className="bg-red-100 text-[#DC2626] border-red-200 text-[10px] font-bold">
            Rejeitado
          </Badge>
        )
      default:
        return (
          <Badge className="bg-amber-100 text-[#D97706] border-amber-200 text-[10px] font-bold">
            Pendente
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-[#1A2333]">
              Pré-Lançamento Inteligente
            </h2>
            <Badge className="bg-gradient-to-r from-[#0FA3A3] to-teal-600 text-white text-[11px] font-semibold gap-1">
              <Sparkles className="h-3 w-3" />
              <span>Motor Heurístico GED</span>
            </Badge>
          </div>
          <p className="text-xs text-[#64748B]">
            Sugestão automática de partidas dobradas a partir de documentos fiscais classificados no
            GED com anti-duplicidade e bloqueio de competências
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleAnalisarPendentes}
            disabled={analisandoPendentes}
            className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs font-semibold h-10 shadow-xs"
          >
            {analisandoPendentes ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Analisando Documentos...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Analisar Pendentes do GED</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Cards Totalizadores */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Sugestões Pendentes */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Sugestões Pendentes
              </p>
              <h3 className="text-2xl font-bold text-[#1A2333] mt-1">{totalPendentes}</h3>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Aguardando revisão ou aceite</p>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-amber-50 text-[#D97706] flex items-center justify-center">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Alta Confiança */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Alta Confiança (≥ 80%)
              </p>
              <h3 className="text-2xl font-bold text-[#16A34A] mt-1">{totalAltaConfianca}</h3>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Prontas para conversão rápida</p>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-emerald-50 text-[#16A34A] flex items-center justify-center">
              <Sparkles className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Convertidas Hoje */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Convertidas Hoje
              </p>
              <h3 className="text-2xl font-bold text-[#0FA3A3] mt-1">{totalConvertidasHoje}</h3>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Partidas dobradas efetivadas</p>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-teal-50 text-[#0FA3A3] flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Valor Total Sugerido */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Valor Pendente Sugerido
              </p>
              <h3 className="text-2xl font-bold text-[#1A2333] mt-1">
                {valorTotalSugerido.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </h3>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Soma dos valores a classificar</p>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-sky-50 text-[#0284C7] flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5 items-end">
            {/* Empresa */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Empresa
              </label>
              <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Todas as empresas" />
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

            {/* Competência */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Competência
              </label>
              <Select value={filtroCompetencia} onValueChange={setFiltroCompetencia}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Todas as competências" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Competências</SelectItem>
                  <SelectItem value="08/2026">08/2026</SelectItem>
                  <SelectItem value="09/2026">09/2026</SelectItem>
                  <SelectItem value="10/2026">10/2026</SelectItem>
                  <SelectItem value="11/2026">11/2026</SelectItem>
                  <SelectItem value="12/2026">12/2026</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Status
              </label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todos os Status</SelectItem>
                  <SelectItem value="pendente">Pendentes</SelectItem>
                  <SelectItem value="convertido">Convertidos</SelectItem>
                  <SelectItem value="rejeitado">Rejeitados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Confiança Mínima */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Confiança Mínima
              </label>
              <Select
                value={String(filtroConfianca)}
                onValueChange={(v) => setFiltroConfianca(Number(v))}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Qualquer confiança" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Todas (0% a 100%)</SelectItem>
                  <SelectItem value="60">Média ou Alta (≥ 60%)</SelectItem>
                  <SelectItem value="80">Alta Confiança (≥ 80%)</SelectItem>
                  <SelectItem value="90">Altíssima (≥ 90%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Busca textual */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Buscar no Histórico
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8]" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Ex: NFSe, fatura, DAS..."
                  className="h-9 pl-8 text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Sugestões */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-[#E2E8F0] py-4 px-6 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-[#1A2333]">
              Sugestões Contábeis Geradas ({sugestoes.length})
            </CardTitle>
            <CardDescription className="text-xs text-[#64748B]">
              Revise o débito, crédito e histórico antes de aprovar a partida dobrada
            </CardDescription>
          </div>

          <Button
            onClick={() => carregarDados()}
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-[#0FA3A3]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Atualizar</span>
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Empresa / Comp.</th>
                  <th className="py-3 px-4">Documento GED</th>
                  <th className="py-3 px-4">Débito / Crédito Sugeridos</th>
                  <th className="py-3 px-4">Histórico & Observações</th>
                  <th className="py-3 px-4 text-right">Valor Sugerido</th>
                  <th className="py-3 px-4 text-center">Confiança</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-[#94A3B8]">
                      Carregando sugestões de pré-lançamento...
                    </td>
                  </tr>
                ) : sugestoes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-[#94A3B8]">
                      Nenhuma sugestão encontrada com os filtros aplicados. Clique em &quot;Analisar
                      Pendentes do GED&quot; para varrer documentos novos.
                    </td>
                  </tr>
                ) : (
                  sugestoes.map((sug) => {
                    const doc = sug.expand?.documento
                    const emp = sug.expand?.empresa
                    const deb = sug.expand?.debito_sugerido
                    const cred = sug.expand?.credito_sugerido
                    const isPendente = sug.status === 'pendente'

                    return (
                      <tr
                        key={sug.id}
                        className={cn(
                          'hover:bg-slate-50/80 transition-colors',
                          sug.status === 'convertido' && 'bg-emerald-50/20',
                          sug.status === 'rejeitado' && 'bg-red-50/20 opacity-75',
                        )}
                      >
                        {/* Empresa / Comp */}
                        <td className="py-3.5 px-4 font-semibold text-[#1A2333]">
                          <div>{emp?.nome_fantasia || emp?.razao_social || 'Empresa'}</div>
                          <span className="inline-block mt-0.5 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-[#64748B]">
                            {sug.competencia}
                          </span>
                        </td>

                        {/* Documento de Origem */}
                        <td className="py-3.5 px-4 text-[#1A2333]">
                          {doc ? (
                            <Link
                              to="/documentos"
                              className="inline-flex items-center gap-1 font-medium text-[#0FA3A3] hover:underline"
                              title="Ver arquivo no GED"
                            >
                              <FileText className="h-3.5 w-3.5 shrink-0" />
                              <span className="max-w-[150px] truncate">{doc.nome_arquivo}</span>
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                            </Link>
                          ) : (
                            <span className="text-[#94A3B8] italic">Avulso</span>
                          )}
                        </td>

                        {/* Débito / Crédito */}
                        <td className="py-3.5 px-4 text-[#1A2333]">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className="font-bold text-emerald-700 bg-emerald-50 px-1 rounded">
                                D:
                              </span>
                              <span className="truncate max-w-[190px]" title={deb?.nome}>
                                {deb ? `${deb.codigo} - ${deb.nome}` : 'Conta a definir'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className="font-bold text-sky-700 bg-sky-50 px-1 rounded">
                                C:
                              </span>
                              <span className="truncate max-w-[190px]" title={cred?.nome}>
                                {cred ? `${cred.codigo} - ${cred.nome}` : 'Conta a definir'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Histórico */}
                        <td className="py-3.5 px-4 text-[#1A2333] max-w-[240px]">
                          <p className="line-clamp-2 text-xs">{sug.historico_sugerido}</p>
                          {sug.status === 'rejeitado' && sug.motivo_rejeicao && (
                            <p className="text-[10px] text-red-600 italic mt-0.5">
                              Motivo: {sug.motivo_rejeicao}
                            </p>
                          )}
                          {sug.status === 'convertido' && sug.lote_id && (
                            <p className="text-[10px] font-mono text-emerald-700 mt-0.5">
                              Lote: {sug.lote_id}
                            </p>
                          )}
                        </td>

                        {/* Valor Sugerido */}
                        <td className="py-3.5 px-4 text-right font-bold text-[#1A2333] whitespace-nowrap">
                          {sug.valor_sugerido.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>

                        {/* Confiança */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {getBadgeConfianca(sug.confianca)}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {getBadgeStatus(sug.status)}
                        </td>

                        {/* Ações */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {isPendente ? (
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Botão Aceitar */}
                              <Button
                                onClick={() => handleAceitarDireto(sug)}
                                size="sm"
                                disabled={actionLoading || !canAceitar}
                                title={
                                  !canAceitar
                                    ? 'Apenas Contadores ou Administradores podem aceitar'
                                    : 'Gerar lançamento contábil partida dobrada'
                                }
                                className="h-7 text-xs rounded-lg bg-[#16A34A] hover:bg-emerald-700 text-white px-2.5 font-semibold gap-1 shadow-2xs"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Aceitar</span>
                              </Button>

                              {/* Botão Revisar/Editar */}
                              <Button
                                onClick={() => handleAbrirEdicao(sug)}
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs rounded-lg px-2 border-[#E2E8F0] hover:bg-slate-100"
                                title="Editar contas e valores antes de aceitar"
                              >
                                <Edit3 className="h-3.5 w-3.5 text-[#64748B]" />
                              </Button>

                              {/* Botão Rejeitar */}
                              {canRejeitar && (
                                <Button
                                  onClick={() => handleAbrirRejeicao(sug)}
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs rounded-lg text-red-600 hover:bg-red-50 px-2"
                                  title="Rejeitar sugestão"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          ) : sug.status === 'convertido' ? (
                            <span className="text-[11px] font-semibold text-emerald-700">
                              Lançamento Gerado
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#94A3B8]">Rejeitado</span>
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

      {/* MODAL: Revisão / Edição da Sugestão antes de Aceitar */}
      <Dialog open={modalEditarOpen} onOpenChange={setModalEditarOpen}>
        <DialogContent className="sm:max-w-[550px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333] flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-[#0FA3A3]" />
              <span>Revisar e Classificar Pré-Lançamento</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Ajuste as contas contábeis de débito e crédito, valor ou histórico para geração da
              partida dobrada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Empresa e Competência */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-[#1A2333]">Empresa</label>
                <Input
                  disabled
                  value={
                    itemEmEdicao?.expand?.empresa?.nome_fantasia ||
                    itemEmEdicao?.expand?.empresa?.razao_social ||
                    ''
                  }
                  className="h-9 text-xs bg-slate-50"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#1A2333]">Competência *</label>
                <Input
                  value={editCompetencia}
                  onChange={(e) => setEditCompetencia(e.target.value)}
                  placeholder="MM/AAAA"
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            {/* Contas de Débito e Crédito */}
            <div className="space-y-1">
              <label className="font-semibold text-emerald-700">
                Conta a Débito (Aplicação / Despesa / Ativo) *
              </label>
              <Select value={editDebito} onValueChange={setEditDebito}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Selecione a conta de débito" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.codigo} - {c.nome} ({c.tipo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-sky-700">
                Conta a Crédito (Origem / Passivo / Receita / Banco) *
              </label>
              <Select value={editCredito} onValueChange={setEditCredito}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Selecione a conta de crédito" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.codigo} - {c.nome} ({c.tipo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Valor */}
            <div className="space-y-1">
              <label className="font-semibold text-[#1A2333]">Valor do Lançamento (R$) *</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={editValor}
                onChange={(e) => setEditValor(parseFloat(e.target.value) || 0)}
                className="h-9 text-xs rounded-xl font-mono"
              />
            </div>

            {/* Histórico */}
            <div className="space-y-1">
              <label className="font-semibold text-[#1A2333]">Histórico Contábil *</label>
              <Textarea
                rows={2}
                value={editHistorico}
                onChange={(e) => setEditHistorico(e.target.value)}
                className="text-xs rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalEditarOpen(false)}
              className="text-xs rounded-xl"
            >
              Cancelar
            </Button>

            <Button
              variant="secondary"
              size="sm"
              disabled={actionLoading}
              onClick={() => handleSalvarEdicao(false)}
              className="text-xs rounded-xl"
            >
              Salvar Alterações
            </Button>

            {canAceitar && (
              <Button
                size="sm"
                disabled={actionLoading}
                onClick={() => handleSalvarEdicao(true)}
                className="text-xs rounded-xl bg-[#16A34A] text-white hover:bg-emerald-700 font-semibold"
              >
                {actionLoading ? 'Gerando Lançamento...' : 'Salvar e Gerar Partida Dobrada'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Rejeitar Sugestão */}
      <Dialog open={modalRejeitarOpen} onOpenChange={setModalRejeitarOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#DC2626] flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              <span>Rejeitar Sugestão de Pré-Lançamento</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Informe o motivo da rejeição para registro na auditoria e aprimoramento do motor
              heurístico.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-[#1A2333]">Motivo da Rejeição (Opcional)</label>
              <Textarea
                value={motivoRejeicao}
                onChange={(e) => setMotivoRejeicao(e.target.value)}
                placeholder="Ex: Documento não corresponde a fato contábil ou já lançado manualmente em outra conta."
                rows={3}
                className="text-xs rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalRejeitarOpen(false)}
              className="text-xs rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={actionLoading}
              onClick={handleConfirmarRejeicao}
              className="text-xs rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              {actionLoading ? 'Rejeitando...' : 'Confirmar Rejeição'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

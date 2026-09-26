import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Boxes,
  Plus,
  Play,
  ArrowDownCircle,
  Building2,
  Calendar,
  Search,
  Filter,
  DollarSign,
  TrendingDown,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  History,
  Trash2,
  RefreshCw,
  ExternalLink,
  ArrowRightLeft,
  MapPin,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { empresasService } from '@/services/empresas'
import { patrimonioService } from '@/services/patrimonio'
import { contabilService } from '@/services/contabil'
import type {
  Empresa,
  AtivoPatrimonial,
  AtivoCategoria,
  AtivoStatus,
  TipoBaixaAtivo,
  ContaContabil,
  BaixaAtivoRecord,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

// Sugestões de taxa anual e vida útil por categoria
const CATEGORIA_DEFAULTS: Record<
  AtivoCategoria,
  { label: string; taxa: number; vidaUtilMeses: number }
> = {
  maquinas_equipamentos: { label: 'Máquinas e Equipamentos', taxa: 10, vidaUtilMeses: 120 },
  veiculos: { label: 'Veículos de Transporte', taxa: 20, vidaUtilMeses: 60 },
  moveis_utensilios: { label: 'Móveis e Utensílios', taxa: 10, vidaUtilMeses: 120 },
  computadores_ti: { label: 'Computadores e T.I.', taxa: 20, vidaUtilMeses: 60 },
  instalacoes_imoveis: { label: 'Instalações e Imóveis', taxa: 4, vidaUtilMeses: 300 },
  outros: { label: 'Outros Bens do Ativo', taxa: 10, vidaUtilMeses: 120 },
}

export default function PatrimonioPage() {
  const { tenant, member, user } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('todas')
  const [selectedCategoria, setSelectedCategoria] = useState<string>('todas')
  const [selectedStatus, setSelectedStatus] = useState<string>('todos')
  const [searchQuery, setSearchQuery] = useState('')

  // Ativos e contas contábeis
  const [ativos, setAtivos] = useState<AtivoPatrimonial[]>([])
  const [contasContabeis, setContasContabeis] = useState<ContaContabil[]>([])
  const [baixasHistorico, setBaixasHistorico] = useState<BaixaAtivoRecord[]>([])
  const [transferenciasHistorico, setTransferenciasHistorico] = useState<any[]>([])
  const [selectedSetorFiltro, setSelectedSetorFiltro] = useState('todos')

  // Modais
  const [isNovoAtivoOpen, setIsNovoAtivoOpen] = useState(false)
  const [isDepreciarOpen, setIsDepreciarOpen] = useState(false)
  const [isBaixarOpen, setIsBaixarOpen] = useState(false)
  const [isHistoricoBaixasOpen, setIsHistoricoBaixasOpen] = useState(false)
  const [isTransferirOpen, setIsTransferirOpen] = useState(false)
  const [isHistoricoTransferenciasOpen, setIsHistoricoTransferenciasOpen] = useState(false)
  const [ativoParaTransferencia, setAtivoParaTransferencia] = useState<AtivoPatrimonial | null>(
    null,
  )

  // Permissões: Auxiliar não pode aprovar/baixar, Cliente bloqueado
  const isAuxiliar = member?.perfil === 'auxiliar'
  const isConsultor = member?.perfil === 'consultor'
  const canEdit = !isAuxiliar && !isConsultor

  // Form State: Novo Ativo
  const [formData, setFormData] = useState({
    empresa: '',
    descricao: '',
    categoria: 'computadores_ti' as AtivoCategoria,
    numero_nf: '',
    fornecedor: '',
    data_aquisicao: new Date().toISOString().split('T')[0],
    valor_aquisicao: 0,
    valor_residual: 0,
    taxa_depreciacao_anual: 20,
    vida_util_meses: 60,
    conta_ativo: '',
    conta_depreciacao_acumulada: '',
    conta_despesa_depreciacao: '',
    setor_localizacao: 'Administrativo / TI',
    filial_unidade: 'Matriz',
    responsavel_bem: 'Coordenação Geral',
    observacoes: '',
  })

  // Form State: Processar Depreciação
  const [deprecEmpresaId, setDeprecEmpresaId] = useState('')
  const [deprecCompetencia, setDeprecCompetencia] = useState('09/2026')
  const [processingDeprec, setProcessingDeprec] = useState(false)

  // Form State: Baixa de Ativo
  const [ativoParaBaixa, setAtivoParaBaixa] = useState<AtivoPatrimonial | null>(null)
  const [baixaForm, setBaixaForm] = useState({
    tipo_baixa: 'venda' as TipoBaixaAtivo,
    data_baixa: new Date().toISOString().split('T')[0],
    valor_venda: 0,
    motivo: '',
  })
  const [processingBaixa, setProcessingBaixa] = useState(false)

  // Form State: Transferência Física (FASE 3)
  const [transferForm, setTransferForm] = useState({
    data_transferencia: new Date().toISOString().split('T')[0],
    destino_setor: '',
    destino_filial: 'Matriz',
    destino_responsavel: '',
    motivo: '',
    observacao: '',
  })
  const [processingTransfer, setProcessingTransfer] = useState(false)

  // 1. Carregar Empresas e Contas Contábeis
  useEffect(() => {
    if (!tenant?.id) return
    const initData = async () => {
      try {
        const [empRes, contasRes] = await Promise.all([
          empresasService.list(tenant.id),
          contabilService.getPlanoContas(tenant.id, 'ativa = true'),
        ])
        setEmpresas(empRes)
        setContasContabeis(contasRes)

        if (empRes.length > 0) {
          setDeprecEmpresaId(empRes[0].id)
          setFormData((prev) => ({
            ...prev,
            empresa: empRes[0].id,
          }))
        }
      } catch (err) {
        console.error('Erro ao inicializar dados de patrimônio:', err)
      }
    }
    void initData()
  }, [tenant?.id])

  // Contas filtradas para selects
  const contasAtivo = useMemo(
    () => contasContabeis.filter((c) => c.tipo === 'ativo' && !c.codigo.includes('09')),
    [contasContabeis],
  )
  const contasDeprecAcum = useMemo(
    () =>
      contasContabeis.filter(
        (c) => c.tipo === 'ativo' && c.nome.toLowerCase().includes('deprecia'),
      ),
    [contasContabeis],
  )
  const contasDespesaDeprec = useMemo(
    () =>
      contasContabeis.filter(
        (c) => c.tipo === 'despesa' && c.nome.toLowerCase().includes('deprecia'),
      ),
    [contasContabeis],
  )

  // Atualizar contas padrão no form ao mudar categoria
  const handleCategoriaChange = (cat: AtivoCategoria) => {
    const config = CATEGORIA_DEFAULTS[cat]
    setFormData((prev) => ({
      ...prev,
      categoria: cat,
      taxa_depreciacao_anual: config.taxa,
      vida_util_meses: config.vidaUtilMeses,
    }))
  }

  // 2. Carregar Lista de Ativos
  const loadAtivos = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const data = await patrimonioService.listAtivos(tenant.id, {
        empresaId: selectedEmpresaId,
        categoria: selectedCategoria,
        status: selectedStatus,
        busca: searchQuery,
      })
      setAtivos(data)
    } catch (err) {
      console.error('Erro ao carregar bens:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar patrimônio',
        description: 'Não foi possível carregar a lista de bens.',
      })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, selectedEmpresaId, selectedCategoria, selectedStatus, searchQuery, toast])

  useEffect(() => {
    void loadAtivos()
  }, [loadAtivos])

  // Carregar histórico de baixas
  const loadBaixas = async () => {
    if (!tenant?.id) return
    try {
      const list = await patrimonioService.listBaixas(tenant.id, selectedEmpresaId)
      setBaixasHistorico(list)
      setIsHistoricoBaixasOpen(true)
    } catch (err) {
      console.error('Erro ao carregar baixas:', err)
    }
  }

  // Carregar histórico de transferências
  const loadTransferencias = async (ativoId?: string) => {
    if (!tenant?.id) return
    try {
      const list = await patrimonioService.listTransferencias(tenant.id, {
        ativoId,
        empresaId: selectedEmpresaId,
      })
      setTransferenciasHistorico(list)
      setIsHistoricoTransferenciasOpen(true)
    } catch (err) {
      console.error('Erro ao carregar transferências:', err)
    }
  }

  const handleAbrirTransferencia = (ativo: AtivoPatrimonial) => {
    setAtivoParaTransferencia(ativo)
    setTransferForm({
      data_transferencia: new Date().toISOString().split('T')[0],
      destino_setor: '',
      destino_filial: ativo.filial_unidade || 'Matriz',
      destino_responsavel: '',
      motivo: '',
      observacao: '',
    })
    setIsTransferirOpen(true)
  }

  const handleConfirmarTransferencia = async (e: React.FormEvent) => {
    e.preventDefault()
    if (
      !tenant?.id ||
      !ativoParaTransferencia ||
      !transferForm.destino_setor ||
      !transferForm.destino_responsavel
    ) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Informe o setor de destino e o novo responsável pelo bem.',
      })
      return
    }

    setProcessingTransfer(true)
    try {
      await patrimonioService.transferirAtivo({
        tenant_id: tenant.id,
        empresa_id: ativoParaTransferencia.empresa,
        ativo_id: ativoParaTransferencia.id,
        data_transferencia: transferForm.data_transferencia,
        destino_setor: transferForm.destino_setor,
        destino_filial: transferForm.destino_filial,
        destino_responsavel: transferForm.destino_responsavel,
        motivo: transferForm.motivo,
        observacao: transferForm.observacao,
        usuario_id: user?.id,
      })

      toast({
        title: 'Transferência concluída!',
        description: `Bem ${ativoParaTransferencia.descricao} alocado em ${transferForm.destino_setor} aos cuidados de ${transferForm.destino_responsavel}.`,
      })

      setIsTransferirOpen(false)
      setAtivoParaTransferencia(null)
      void loadAtivos()
    } catch (err: any) {
      console.error('Erro ao transferir bem:', err)
      toast({
        variant: 'destructive',
        title: 'Erro na transferência',
        description: err?.message || 'Falha ao gravar transferência patrimonial.',
      })
    } finally {
      setProcessingTransfer(false)
    }
  }

  // Totalizadores calculados
  const totalizadores = useMemo(() => {
    let custoTotal = 0
    let depreciacaoAcumulada = 0
    let valorLiquido = 0
    let ativosEmOperacao = 0

    ativos.forEach((a) => {
      if (a.status !== 'baixado') {
        custoTotal += a.valor_aquisicao
        const dep = a.depreciacao_acumulada_calculada || 0
        depreciacaoAcumulada += dep
        valorLiquido += Math.max(0, a.valor_aquisicao - dep)
        ativosEmOperacao++
      }
    })

    return {
      custoTotal,
      depreciacaoAcumulada,
      valorLiquido,
      ativosEmOperacao,
    }
  }, [ativos])

  // Salvar Novo Ativo
  const handleCreateAtivo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant?.id || !formData.empresa || !formData.descricao || formData.valor_aquisicao <= 0) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Preencha a empresa, descrição e valor de aquisição.',
      })
      return
    }

    try {
      // Auto-selecionar contas padrão se não escolhidas
      let contaAtivoId = formData.conta_ativo
      let contaAcumId = formData.conta_depreciacao_acumulada
      let contaDespId = formData.conta_despesa_depreciacao

      if (!contaAtivoId && contasAtivo.length > 0) contaAtivoId = contasAtivo[0].id
      if (!contaAcumId && contasDeprecAcum.length > 0) contaAcumId = contasDeprecAcum[0].id
      if (!contaDespId && contasDespesaDeprec.length > 0) contaDespId = contasDespesaDeprec[0].id

      await patrimonioService.createAtivo({
        tenant_id: tenant.id,
        empresa: formData.empresa,
        descricao: formData.descricao,
        categoria: formData.categoria,
        numero_nf: formData.numero_nf,
        fornecedor: formData.fornecedor,
        data_aquisicao: formData.data_aquisicao,
        valor_aquisicao: Number(formData.valor_aquisicao),
        valor_residual: Number(formData.valor_residual) || 0,
        taxa_depreciacao_anual: Number(formData.taxa_depreciacao_anual),
        vida_util_meses: Number(formData.vida_util_meses) || 60,
        conta_ativo: contaAtivoId,
        conta_depreciacao_acumulada: contaAcumId,
        conta_despesa_depreciacao: contaDespId,
        observacoes: formData.observacoes,
      })

      toast({
        title: 'Ativo cadastrado com sucesso!',
        description: `${formData.descricao} incorporado ao patrimônio.`,
      })

      setIsNovoAtivoOpen(false)
      setFormData({
        empresa: empresas[0]?.id || '',
        descricao: '',
        categoria: 'computadores_ti',
        numero_nf: '',
        fornecedor: '',
        data_aquisicao: new Date().toISOString().split('T')[0],
        valor_aquisicao: 0,
        valor_residual: 0,
        taxa_depreciacao_anual: 20,
        vida_util_meses: 60,
        conta_ativo: '',
        conta_depreciacao_acumulada: '',
        conta_despesa_depreciacao: '',
        setor_localizacao: 'Administrativo / TI',
        filial_unidade: 'Matriz',
        responsavel_bem: 'Coordenação Geral',
        observacoes: '',
      })
      void loadAtivos()
    } catch (err) {
      console.error('Erro ao cadastrar ativo:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Verifique se todos os campos estão corretos.',
      })
    }
  }

  // Processar Depreciação
  const handleProcessarDepreciacao = async () => {
    if (!tenant?.id || !deprecEmpresaId || !deprecCompetencia) return
    setProcessingDeprec(true)
    try {
      const res = await patrimonioService.processarDepreciacao(
        tenant.id,
        deprecEmpresaId,
        deprecCompetencia,
        user?.id,
      )

      if (res.ativosProcessados === 0) {
        toast({
          title: 'Depreciação já processada ou sem ativos pendentes',
          description: `Nenhum novo lançamento necessário para a competência ${deprecCompetencia}.`,
        })
      } else {
        toast({
          title: 'Depreciação processada com sucesso!',
          description: `${res.ativosProcessados} ativos depreciados. Total de R$ ${res.valorTotalDepreciacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em ${res.lancamentosGerados} lançamentos contábeis.`,
        })
      }

      setIsDepreciarOpen(false)
      void loadAtivos()
    } catch (err: any) {
      console.error('Erro ao processar depreciação:', err)
      toast({
        variant: 'destructive',
        title: 'Erro no processamento',
        description:
          err?.message || 'Não foi possível gerar os lançamentos contábeis de depreciação.',
      })
    } finally {
      setProcessingDeprec(false)
    }
  }

  // Abrir Modal de Baixa
  const handleAbrirBaixa = (ativo: AtivoPatrimonial) => {
    setAtivoParaBaixa(ativo)
    const dep = ativo.depreciacao_acumulada_calculada || 0
    const residual = Math.max(0, ativo.valor_aquisicao - dep)
    setBaixaForm({
      tipo_baixa: 'venda',
      data_baixa: new Date().toISOString().split('T')[0],
      valor_venda: residual,
      motivo: '',
    })
    setIsBaixarOpen(true)
  }

  // Confirmar Baixa de Ativo
  const handleConfirmarBaixa = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant?.id || !ativoParaBaixa) return
    setProcessingBaixa(true)
    try {
      await patrimonioService.registrarBaixa({
        tenant_id: tenant.id,
        ativoId: ativoParaBaixa.id,
        empresaId: ativoParaBaixa.empresa,
        tipo_baixa: baixaForm.tipo_baixa,
        data_baixa: baixaForm.data_baixa,
        valor_venda: Number(baixaForm.valor_venda) || 0,
        motivo: baixaForm.motivo,
        usuario_id: user?.id,
      })

      toast({
        title: 'Baixa registrada com sucesso!',
        description: `O ativo ${ativoParaBaixa.descricao} foi baixado e os lançamentos contábeis foram gerados.`,
      })

      setIsBaixarOpen(false)
      setAtivoParaBaixa(null)
      void loadAtivos()
    } catch (err: any) {
      console.error('Erro ao registrar baixa:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao baixar ativo',
        description: err?.message || 'Falha ao processar a baixa patrimonial.',
      })
    } finally {
      setProcessingBaixa(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-[#1A2333]">
              Gestão de Patrimônio & Ativos
            </h2>
            <Badge className="bg-[#0FA3A3] text-white text-[11px] font-semibold">P2</Badge>
          </div>
          <p className="text-xs text-[#64748B]">
            Cadastro de bens imobilizados, cálculo linear de depreciação mensal e baixa com partidas
            dobradas
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => loadTransferencias()}
            variant="outline"
            className="gap-2 rounded-xl text-xs font-semibold h-10 border-[#E2E8F0] bg-white shadow-xs hover:bg-slate-50"
          >
            <ArrowRightLeft className="h-4 w-4 text-[#0FA3A3]" />
            <span>Transferências</span>
          </Button>

          <Button
            onClick={loadBaixas}
            variant="outline"
            className="gap-2 rounded-xl text-xs font-semibold h-10 border-[#E2E8F0] bg-white shadow-xs hover:bg-slate-50"
          >
            <History className="h-4 w-4 text-[#64748B]" />
            <span>Histórico de Baixas</span>
          </Button>

          {canEdit && (
            <>
              <Button
                onClick={() => setIsDepreciarOpen(true)}
                variant="outline"
                className="gap-2 rounded-xl text-xs font-semibold h-10 border-[#0FA3A3] text-[#0FA3A3] bg-teal-50/50 hover:bg-teal-100/50 shadow-xs"
              >
                <Play className="h-4 w-4" />
                <span>Processar Depreciação</span>
              </Button>

              <Button
                onClick={() => setIsNovoAtivoOpen(true)}
                className="gap-2 rounded-xl text-xs font-semibold h-10 bg-[#0FA3A3] text-white hover:bg-[#0C8585] shadow-xs"
              >
                <Plus className="h-4 w-4" />
                <span>Novo Bem Patrimonial</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Indicadores / Totalizadores */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Custo de Aquisição
              </p>
              <p className="text-xl font-bold text-[#1A2333] mt-1">
                R${' '}
                {totalizadores.custoTotal.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-[#2563EB]">
              <Boxes className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Depreciação Acumulada
              </p>
              <p className="text-xl font-bold text-[#DC2626] mt-1">
                (-) R${' '}
                {totalizadores.depreciacaoAcumulada.toLocaleString('pt-BR', {
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
                Valor Contábil Líquido
              </p>
              <p className="text-xl font-bold text-[#16A34A] mt-1">
                R${' '}
                {totalizadores.valorLiquido.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-[#16A34A]">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Bens em Operação
              </p>
              <p className="text-xl font-bold text-[#1A2333] mt-1">
                {totalizadores.ativosEmOperacao} ativos
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-[#0FA3A3]">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Busca textual */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Buscar Bem / NF / Fornecedor
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Nome do ativo ou NF..."
                  className="h-9 pl-9 text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>
            </div>

            {/* Empresa */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Empresa
              </label>
              <Select value={selectedEmpresaId} onValueChange={setSelectedEmpresaId}>
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

            {/* Categoria */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Categoria
              </label>
              <Select value={selectedCategoria} onValueChange={setSelectedCategoria}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Categorias</SelectItem>
                  {Object.entries(CATEGORIA_DEFAULTS).map(([key, val]) => (
                    <SelectItem key={key} value={key}>
                      {val.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Status
              </label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="ativo">Ativo (Em uso)</SelectItem>
                  <SelectItem value="depreciado">100% Depreciado</SelectItem>
                  <SelectItem value="baixado">Baixado / Alienado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Localização / Setor (FASE 3) */}
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-4 pt-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Filtrar por Setor / Localização Física
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  'todos',
                  'Administrativo / TI',
                  'Operacional / Fábrica',
                  'Financeiro / Contábil',
                  'Comercial / Vendas',
                  'Diretoria',
                ].map((st) => (
                  <Button
                    key={st}
                    type="button"
                    variant={selectedSetorFiltro === st ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedSetorFiltro(st)}
                    className={cn(
                      'h-7 rounded-lg text-xs',
                      selectedSetorFiltro === st
                        ? 'bg-[#0FA3A3] text-white hover:bg-[#0C8585]'
                        : 'text-[#64748B] border-[#E2E8F0] hover:bg-slate-50',
                    )}
                  >
                    {st === 'todos' ? 'Todos os Setores' : st}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Bens Patrimoniais */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Descrição do Bem</th>
                <th className="py-3 px-4">Localização & Responsável</th>
                <th className="py-3 px-4">Empresa / NF</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4 text-right">Aquisição</th>
                <th className="py-3 px-4 text-right">Deprec. Acumulada</th>
                <th className="py-3 px-4 text-right">Valor Líquido</th>
                <th className="py-3 px-4 text-center">% Deprec.</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#94A3B8]">
                    Carregando patrimônio...
                  </td>
                </tr>
              ) : ativos.filter((a) => {
                  if (selectedSetorFiltro === 'todos') return true
                  return a.setor_localizacao
                    ?.toLowerCase()
                    .includes(selectedSetorFiltro.toLowerCase())
                }).length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#94A3B8]">
                    Nenhum bem patrimonial encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                ativos
                  .filter((a) => {
                    if (selectedSetorFiltro === 'todos') return true
                    return a.setor_localizacao
                      ?.toLowerCase()
                      .includes(selectedSetorFiltro.toLowerCase())
                  })
                  .map((ativo) => {
                    const emp = empresas.find((e) => e.id === ativo.empresa)
                    const dep = ativo.depreciacao_acumulada_calculada || 0
                    const liq = Math.max(0, ativo.valor_aquisicao - dep)
                    const baseDeprec = Math.max(
                      0,
                      ativo.valor_aquisicao - (ativo.valor_residual || 0),
                    )
                    const percentDeprec =
                      baseDeprec > 0 ? Math.min(100, Math.round((dep / baseDeprec) * 100)) : 0

                    return (
                      <tr key={ativo.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-[#1A2333]">
                          <div>
                            <p>{ativo.descricao}</p>
                            <p className="text-[10px] text-[#64748B] font-normal">
                              Adquirido em{' '}
                              {new Date(ativo.data_aquisicao).toLocaleDateString('pt-BR')} • Forn:{' '}
                              {ativo.fornecedor || 'Não informado'}
                            </p>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-[#64748B]">
                          <p className="font-medium text-[#1A2333] flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-[#0FA3A3]" />
                            <span>{ativo.setor_localizacao || 'Geral / Não atribuído'}</span>
                          </p>
                          <p className="text-[10px] text-[#64748B]">
                            Resp: {ativo.responsavel_bem || 'N/A'} •{' '}
                            {ativo.filial_unidade || 'Matriz'}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-[#64748B]">
                          <p className="font-medium text-[#1A2333]">
                            {emp?.nome_fantasia || emp?.razao_social || 'Empresa'}
                          </p>
                          <p className="text-[10px]">{ativo.numero_nf || 'Sem NF'}</p>
                        </td>
                        <td className="py-3.5 px-4 text-[#64748B]">
                          <Badge
                            variant="outline"
                            className="text-[10px] font-normal border-slate-200"
                          >
                            {CATEGORIA_DEFAULTS[ativo.categoria]?.label || ativo.categoria}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold text-[#1A2333]">
                          R${' '}
                          {ativo.valor_aquisicao.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-3.5 px-4 text-right text-[#DC2626] font-medium">
                          (-) R${' '}
                          {dep.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-[#16A34A]">
                          R${' '}
                          {liq.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <div className="w-12 h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full bg-[#0FA3A3]"
                                style={{ width: `${percentDeprec}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-semibold text-[#64748B]">
                              {percentDeprec}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {ativo.status === 'ativo' ? (
                            <Badge className="bg-emerald-100 text-[#16A34A] border-emerald-200 text-[10px]">
                              Ativo
                            </Badge>
                          ) : ativo.status === 'depreciado' ? (
                            <Badge className="bg-amber-100 text-[#D97706] border-amber-200 text-[10px]">
                              Depreciado
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-[#64748B] border-slate-200 text-[10px]">
                              Baixado
                            </Badge>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {ativo.status !== 'baixado' && canEdit && (
                              <Button
                                onClick={() => handleAbrirTransferencia(ativo)}
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 text-[11px] text-[#0FA3A3] hover:bg-teal-50 hover:text-[#0C8585]"
                                title="Transferir localização ou responsável"
                              >
                                <ArrowRightLeft className="h-3.5 w-3.5" />
                                <span>Transferir</span>
                              </Button>
                            )}

                            {ativo.status !== 'baixado' && canEdit ? (
                              <Button
                                onClick={() => handleAbrirBaixa(ativo)}
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 text-[11px] text-[#DC2626] hover:bg-red-50 hover:text-[#DC2626]"
                              >
                                <ArrowDownCircle className="h-3.5 w-3.5" />
                                <span>Baixar</span>
                              </Button>
                            ) : (
                              <span className="text-[11px] text-[#94A3B8]">—</span>
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

      {/* Modal: Novo Bem Patrimonial */}
      <Dialog open={isNovoAtivoOpen} onOpenChange={setIsNovoAtivoOpen}>
        <DialogContent className="sm:max-w-[650px] rounded-2xl">
          <form onSubmit={handleCreateAtivo}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#1A2333]">
                Cadastrar Novo Bem Patrimonial
              </DialogTitle>
              <DialogDescription className="text-xs text-[#64748B]">
                Registro de imobilizado com taxas lineares de depreciação e amarração contábil
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 py-4 text-xs">
              {/* Empresa */}
              <div className="space-y-1">
                <label className="font-semibold text-[#1A2333]">Empresa *</label>
                <Select
                  value={formData.empresa}
                  onValueChange={(val) => setFormData({ ...formData, empresa: val })}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl">
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

              {/* Categoria */}
              <div className="space-y-1">
                <label className="font-semibold text-[#1A2333]">Categoria do Ativo *</label>
                <Select
                  value={formData.categoria}
                  onValueChange={(val) => handleCategoriaChange(val as AtivoCategoria)}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIA_DEFAULTS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v.label} (sugerido {v.taxa}% a.a.)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Descrição */}
              <div className="col-span-2 space-y-1">
                <label className="font-semibold text-[#1A2333]">Descrição Completa do Bem *</label>
                <Input
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Ex: Servidor Dell PowerEdge ou Veículo Fiat Strada"
                  className="h-9 text-xs rounded-xl"
                  required
                />
              </div>

              {/* Fornecedor */}
              <div className="space-y-1">
                <label className="font-semibold text-[#1A2333]">Fornecedor</label>
                <Input
                  value={formData.fornecedor}
                  onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })}
                  placeholder="Nome do fabricante ou loja"
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              {/* Nota Fiscal */}
              <div className="space-y-1">
                <label className="font-semibold text-[#1A2333]">Número da Nota Fiscal</label>
                <Input
                  value={formData.numero_nf}
                  onChange={(e) => setFormData({ ...formData, numero_nf: e.target.value })}
                  placeholder="Ex: NF-e 45902"
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              {/* Data de Aquisição */}
              <div className="space-y-1">
                <label className="font-semibold text-[#1A2333]">Data de Aquisição *</label>
                <Input
                  type="date"
                  value={formData.data_aquisicao}
                  onChange={(e) => setFormData({ ...formData, data_aquisicao: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                  required
                />
              </div>

              {/* Valor de Aquisição */}
              <div className="space-y-1">
                <label className="font-semibold text-[#1A2333]">Valor de Aquisição (R$) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.valor_aquisicao || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, valor_aquisicao: Number(e.target.value) })
                  }
                  placeholder="0.00"
                  className="h-9 text-xs rounded-xl font-bold"
                  required
                />
              </div>

              {/* Valor Residual */}
              <div className="space-y-1">
                <label className="font-semibold text-[#1A2333]">Valor Residual (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.valor_residual || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, valor_residual: Number(e.target.value) })
                  }
                  placeholder="Ex: 10% do valor"
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              {/* Taxa de Depreciação Anual (%) */}
              <div className="space-y-1">
                <label className="font-semibold text-[#1A2333]">Taxa Depreciação Anual (%) *</label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.taxa_depreciacao_anual}
                  onChange={(e) =>
                    setFormData({ ...formData, taxa_depreciacao_anual: Number(e.target.value) })
                  }
                  className="h-9 text-xs rounded-xl"
                  required
                />
              </div>

              {/* Conta Contábil do Ativo */}
              <div className="col-span-2 space-y-1">
                <label className="font-semibold text-[#1A2333]">
                  Conta Contábil do Imobilizado
                </label>
                <Select
                  value={formData.conta_ativo}
                  onValueChange={(val) => setFormData({ ...formData, conta_ativo: val })}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="Selecione a conta do plano de contas" />
                  </SelectTrigger>
                  <SelectContent>
                    {contasAtivo.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.codigo} - {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Localização Física e Responsável (FASE 3) */}
              <div className="col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="space-y-1">
                  <label className="font-semibold text-[#1A2333]">Setor / Departamento</label>
                  <Input
                    value={formData.setor_localizacao}
                    onChange={(e) =>
                      setFormData({ ...formData, setor_localizacao: e.target.value })
                    }
                    placeholder="Ex: TI / Administrativo"
                    className="h-9 text-xs rounded-xl bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-[#1A2333]">Filial / Unidade</label>
                  <Input
                    value={formData.filial_unidade}
                    onChange={(e) => setFormData({ ...formData, filial_unidade: e.target.value })}
                    placeholder="Ex: Matriz"
                    className="h-9 text-xs rounded-xl bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-[#1A2333]">Responsável pelo Bem</label>
                  <Input
                    value={formData.responsavel_bem}
                    onChange={(e) => setFormData({ ...formData, responsavel_bem: e.target.value })}
                    placeholder="Ex: Coordenação Geral"
                    className="h-9 text-xs rounded-xl bg-white"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNovoAtivoOpen(false)}
                className="h-9 text-xs rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="h-9 text-xs rounded-xl bg-[#0FA3A3] text-white hover:bg-[#0C8585]"
              >
                Salvar Ativo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Processar Depreciação */}
      <Dialog open={isDepreciarOpen} onOpenChange={setIsDepreciarOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1A2333]">
              Processar Depreciação Linear
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Calcula a quota mensal de todos os bens da empresa e lança a partida dobrada na
              competência selecionada
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-[#1A2333]">Empresa *</label>
              <Select value={deprecEmpresaId} onValueChange={setDeprecEmpresaId}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
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

            <div className="space-y-1.5">
              <label className="font-semibold text-[#1A2333]">Competência de Lançamento *</label>
              <Select value={deprecCompetencia} onValueChange={setDeprecCompetencia}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="08/2026">08/2026 (Agosto de 2026)</SelectItem>
                  <SelectItem value="09/2026">09/2026 (Setembro de 2026)</SelectItem>
                  <SelectItem value="10/2026">10/2026 (Outubro de 2026)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-3 text-xs text-[#0FA3A3] space-y-1">
              <p className="font-bold">Partida Dobrada Automática:</p>
              <p>• DÉBITO: 4.2.4 Despesas com Depreciação (Resultado)</p>
              <p>• CRÉDITO: 1.2.1.09 (-) Depreciação Acumulada (Ativo Redutora)</p>
              <p className="text-[11px] text-[#64748B] pt-1">
                Possui anti-duplicidade para evitar lançar duas vezes no mesmo mês.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDepreciarOpen(false)}
              className="h-9 text-xs rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleProcessarDepreciacao}
              disabled={processingDeprec}
              className="h-9 text-xs rounded-xl bg-[#0FA3A3] text-white hover:bg-[#0C8585]"
            >
              {processingDeprec ? 'Calculando...' : 'Confirmar e Processar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Registrar Baixa de Ativo */}
      <Dialog open={isBaixarOpen} onOpenChange={setIsBaixarOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl">
          <form onSubmit={handleConfirmarBaixa}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#DC2626]">
                Registrar Baixa de Ativo
              </DialogTitle>
              <DialogDescription className="text-xs text-[#64748B]">
                Desincorporação patrimonial por alienação, venda, sucata ou obsolescência
              </DialogDescription>
            </DialogHeader>

            {ativoParaBaixa && (
              <div className="space-y-4 py-4 text-xs">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <p className="font-bold text-[#1A2333]">{ativoParaBaixa.descricao}</p>
                  <p className="text-[#64748B] text-[11px] mt-0.5">
                    Valor Original: R${' '}
                    {ativoParaBaixa.valor_aquisicao.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}{' '}
                    • Deprec. Acumulada: R${' '}
                    {(ativoParaBaixa.depreciacao_acumulada_calculada || 0).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                  <p className="text-emerald-700 font-semibold text-[11px] mt-0.5">
                    Valor Contábil Líquido Atual: R${' '}
                    {Math.max(
                      0,
                      ativoParaBaixa.valor_aquisicao -
                        (ativoParaBaixa.depreciacao_acumulada_calculada || 0),
                    ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-[#1A2333]">Tipo de Baixa *</label>
                    <Select
                      value={baixaForm.tipo_baixa}
                      onValueChange={(val) =>
                        setBaixaForm({ ...baixaForm, tipo_baixa: val as TipoBaixaAtivo })
                      }
                    >
                      <SelectTrigger className="h-9 text-xs rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="venda">Venda / Alienação</SelectItem>
                        <SelectItem value="obsolescencia">Obsolescência</SelectItem>
                        <SelectItem value="sucata">Sucata</SelectItem>
                        <SelectItem value="perda">Perda / Sinistro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#1A2333]">Data da Baixa *</label>
                    <Input
                      type="date"
                      value={baixaForm.data_baixa}
                      onChange={(e) => setBaixaForm({ ...baixaForm, data_baixa: e.target.value })}
                      className="h-9 text-xs rounded-xl"
                      required
                    />
                  </div>
                </div>

                {baixaForm.tipo_baixa === 'venda' && (
                  <div className="space-y-1">
                    <label className="font-semibold text-[#1A2333]">Valor da Venda (R$)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={baixaForm.valor_venda}
                      onChange={(e) =>
                        setBaixaForm({ ...baixaForm, valor_venda: Number(e.target.value) })
                      }
                      className="h-9 text-xs rounded-xl font-bold"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-semibold text-[#1A2333]">Motivo / Justificativa</label>
                  <Input
                    value={baixaForm.motivo}
                    onChange={(e) => setBaixaForm({ ...baixaForm, motivo: e.target.value })}
                    placeholder="Ex: Substituição por novo equipamento mais rápido"
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsBaixarOpen(false)}
                className="h-9 text-xs rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={processingBaixa}
                className="h-9 text-xs rounded-xl bg-[#DC2626] text-white hover:bg-red-700"
              >
                {processingBaixa ? 'Processando...' : 'Confirmar Baixa'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Histórico de Baixas */}
      <Dialog open={isHistoricoBaixasOpen} onOpenChange={setIsHistoricoBaixasOpen}>
        <DialogContent className="sm:max-w-[700px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1A2333]">
              Histórico de Baixas de Patrimônio
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Registro contábil de todos os bens desincorporados e resultado apurado
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-96 overflow-y-auto space-y-2 py-2 text-xs">
            {baixasHistorico.length === 0 ? (
              <p className="py-8 text-center text-[#94A3B8]">
                Nenhuma baixa registrada até o momento.
              </p>
            ) : (
              baixasHistorico.map((b) => (
                <div
                  key={b.id}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between"
                >
                  <div>
                    <p className="font-bold text-[#1A2333]">
                      {b.expand?.ativo?.descricao || 'Ativo'}
                    </p>
                    <p className="text-[10px] text-[#64748B]">
                      {new Date(b.data_baixa).toLocaleDateString('pt-BR')} • Tipo:{' '}
                      <span className="uppercase font-semibold">{b.tipo_baixa}</span> • Motivo:{' '}
                      {b.motivo || 'Sem observações'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[#1A2333]">
                      Venda: R${' '}
                      {(b.valor_venda || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p
                      className={cn(
                        'text-[10px] font-bold',
                        (b.ganho_perda || 0) >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]',
                      )}
                    >
                      {(b.ganho_perda || 0) >= 0 ? 'Ganho' : 'Perda'}: R${' '}
                      {(b.ganho_perda || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={() => setIsHistoricoBaixasOpen(false)}
              className="h-9 text-xs rounded-xl bg-[#0FA3A3] text-white"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Transferir Bem Patrimonial (FASE 3) */}
      <Dialog open={isTransferirOpen} onOpenChange={setIsTransferirOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
          <form onSubmit={handleConfirmarTransferencia}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#1A2333] flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-[#0FA3A3]" />
                Transferência Física e de Responsabilidade
              </DialogTitle>
              <DialogDescription className="text-xs text-[#64748B]">
                Movimentação interna do bem patrimonial com rastreabilidade e histórico na auditoria
              </DialogDescription>
            </DialogHeader>

            {ativoParaTransferencia && (
              <div className="space-y-4 py-4 text-xs">
                {/* Localização Atual */}
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <p className="font-bold text-[#1A2333]">{ativoParaTransferencia.descricao}</p>
                  <p className="text-[#64748B] text-[11px] mt-1">
                    <span className="font-semibold text-slate-700">Localização Atual:</span>{' '}
                    {ativoParaTransferencia.setor_localizacao || 'Geral / Não atribuído'} (
                    {ativoParaTransferencia.filial_unidade || 'Matriz'})
                  </p>
                  <p className="text-[#64748B] text-[11px]">
                    <span className="font-semibold text-slate-700">Responsável Atual:</span>{' '}
                    {ativoParaTransferencia.responsavel_bem || 'N/A'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-[#1A2333]">Data da Transferência *</label>
                    <Input
                      type="date"
                      value={transferForm.data_transferencia}
                      onChange={(e) =>
                        setTransferForm({ ...transferForm, data_transferencia: e.target.value })
                      }
                      className="h-9 text-xs rounded-xl"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#1A2333]">Nova Filial / Unidade</label>
                    <Input
                      value={transferForm.destino_filial}
                      onChange={(e) =>
                        setTransferForm({ ...transferForm, destino_filial: e.target.value })
                      }
                      placeholder="Ex: Matriz ou Filial SP"
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-[#1A2333]">Novo Setor / Destino *</label>
                    <Input
                      value={transferForm.destino_setor}
                      onChange={(e) =>
                        setTransferForm({ ...transferForm, destino_setor: e.target.value })
                      }
                      placeholder="Ex: Sala de Reunião / Comercial"
                      className="h-9 text-xs rounded-xl"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-[#1A2333]">Novo Responsável *</label>
                    <Input
                      value={transferForm.destino_responsavel}
                      onChange={(e) =>
                        setTransferForm({ ...transferForm, destino_responsavel: e.target.value })
                      }
                      placeholder="Nome do colaborador"
                      className="h-9 text-xs rounded-xl"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#1A2333]">Motivo da Transferência</label>
                  <Input
                    value={transferForm.motivo}
                    onChange={(e) => setTransferForm({ ...transferForm, motivo: e.target.value })}
                    placeholder="Ex: Mudança de setor, promoção de colaborador, realocação física"
                    className="h-9 text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#1A2333]">Observações Adicionais</label>
                  <Input
                    value={transferForm.observacao}
                    onChange={(e) =>
                      setTransferForm({ ...transferForm, observacao: e.target.value })
                    }
                    placeholder="Anotações internas sobre o estado físico ou transporte..."
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTransferirOpen(false)}
                className="h-9 text-xs rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={processingTransfer}
                className="h-9 text-xs rounded-xl bg-[#0FA3A3] text-white hover:bg-[#0C8585]"
              >
                {processingTransfer ? 'Gravando...' : 'Confirmar Transferência'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Histórico de Transferências (FASE 3) */}
      <Dialog open={isHistoricoTransferenciasOpen} onOpenChange={setIsHistoricoTransferenciasOpen}>
        <DialogContent className="sm:max-w-[760px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1A2333] flex items-center gap-2">
              <History className="h-5 w-5 text-[#0FA3A3]" />
              Histórico de Transferências Internas
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Trilha de auditoria das movimentações físicas e mudanças de custódia dos bens
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-96 overflow-y-auto space-y-2 py-2 text-xs">
            {transferenciasHistorico.length === 0 ? (
              <p className="py-8 text-center text-[#94A3B8]">
                Nenhuma transferência interna realizada até o momento.
              </p>
            ) : (
              transferenciasHistorico.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-[#1A2333]">
                      {t.expand?.ativo?.descricao || 'Ativo Patrimonial'}
                    </p>
                    <span className="text-[11px] font-medium text-[#64748B]">
                      {new Date(t.data_transferencia).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-[#334155] pt-1">
                    <span className="bg-slate-200 px-2 py-0.5 rounded text-slate-700">
                      De: {t.origem_setor || 'Geral'} ({t.origem_responsavel || 'N/A'})
                    </span>
                    <ArrowRightLeft className="h-3 w-3 text-[#0FA3A3]" />
                    <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded font-semibold">
                      Para: {t.destino_setor} ({t.destino_responsavel})
                    </span>
                  </div>

                  {(t.motivo || t.observacao) && (
                    <p className="text-[10px] text-[#64748B] pt-1">
                      {t.motivo && <span className="font-semibold">Motivo: {t.motivo}</span>}
                      {t.motivo && t.observacao && ' • '}
                      {t.observacao && <span>Obs: {t.observacao}</span>}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={() => setIsHistoricoTransferenciasOpen(false)}
              className="h-9 text-xs rounded-xl bg-[#0FA3A3] text-white"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

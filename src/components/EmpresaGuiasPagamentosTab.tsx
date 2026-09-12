import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  FileText,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Download,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  CreditCard,
  Building2,
  Check,
  Eye,
  FileSpreadsheet,
  AlertCircle,
  FileCheck,
  Percent,
} from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import {
  guiasPagamentosService,
  CreateGuiaInput,
  CreateParcelamentoInput,
} from '@/services/guiasPagamentos'
import { formatDatePtBr } from '@/lib/formatters'
import type {
  GuiaPagamentoRecord,
  ParcelamentoFederalRecord,
  ParcelaItem,
  GuiaTipo,
  GuiaSituacao,
  ModalidadeParcelamento,
} from '@/types'

interface EmpresaGuiasPagamentosTabProps {
  empresaId: string
  tenantId: string
  canEdit: boolean
  onRefreshParent?: () => Promise<void>
}

export function EmpresaGuiasPagamentosTab({
  empresaId,
  tenantId,
  canEdit,
  onRefreshParent,
}: EmpresaGuiasPagamentosTabProps) {
  const { user } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [guias, setGuias] = useState<GuiaPagamentoRecord[]>([])
  const [parcelamentos, setParcelamentos] = useState<ParcelamentoFederalRecord[]>([])

  // Filtros de Guias
  const [searchGuia, setSearchGuia] = useState('')
  const [filtroTipoGuia, setFiltroTipoGuia] = useState<string>('todos')
  const [filtroSituacaoGuia, setFiltroSituacaoGuia] = useState<string>('todos')

  // Modais
  const [modalNovaGuiaOpen, setModalNovaGuiaOpen] = useState(false)
  const [modalNovoParcelamentoOpen, setModalNovoParcelamentoOpen] = useState(false)
  const [modalBaixaGuiaOpen, setModalBaixaGuiaOpen] = useState(false)
  const [guiaSelecionadaParaBaixa, setGuiaSelecionadaParaBaixa] =
    useState<GuiaPagamentoRecord | null>(null)
  const [modalQuadroParcelasOpen, setModalQuadroParcelasOpen] = useState(false)
  const [parcelamentoDetalhe, setParcelamentoDetalhe] = useState<ParcelamentoFederalRecord | null>(
    null,
  )

  // Formulário Nova Guia
  const [formGuia, setFormGuia] = useState<{
    tipo_guia: GuiaTipo
    codigo_receita: string
    periodo_apuracao: string
    numero_referencia: string
    descricao: string
    valor_original: string
    acrescimos: string
    valor_total: string
    data_vencimento: string
    situacao: GuiaSituacao
    observacoes: string
    arquivoComprovante: File | null
  }>({
    tipo_guia: 'darf',
    codigo_receita: '2089',
    periodo_apuracao: '',
    numero_referencia: '',
    descricao: '',
    valor_original: '',
    acrescimos: '0',
    valor_total: '',
    data_vencimento: '',
    situacao: 'pendente',
    observacoes: '',
    arquivoComprovante: null,
  })

  // Formulário Baixa de Guia
  const [formBaixa, setFormBaixa] = useState<{
    dataPagamento: string
    autenticacaoBancaria: string
    baixarNoFinanceiro: boolean
    comprovanteArquivo: File | null
  }>({
    dataPagamento: new Date().toISOString().split('T')[0],
    autenticacaoBancaria: '',
    baixarNoFinanceiro: true,
    comprovanteArquivo: null,
  })

  // Formulário Novo Parcelamento
  const [formParc, setFormParc] = useState<{
    numero_parcelamento: string
    modalidade: ModalidadeParcelamento
    descricao_modalidade: string
    data_adesao: string
    total_parcelas: string
    parcelas_quitadas: string
    valor_total_consolidado: string
    saldo_devedor: string
    situacao_rfb: 'em_dia' | 'parcela_a_vencer' | 'em_atraso' | 'liquidado'
    proxima_parcela_numero: string
    proxima_parcela_vencimento: string
    proxima_parcela_valor: string
    observacoes: string
  }>({
    numero_parcelamento: '',
    modalidade: 'pert_sn',
    descricao_modalidade: '',
    data_adesao: new Date().toISOString().split('T')[0],
    total_parcelas: '12',
    parcelas_quitadas: '0',
    valor_total_consolidado: '',
    saldo_devedor: '',
    situacao_rfb: 'em_dia',
    proxima_parcela_numero: '1',
    proxima_parcela_vencimento: '',
    proxima_parcela_valor: '',
    observacoes: '',
  })

  // Carregar dados
  const carregarDados = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    try {
      const [listG, listP] = await Promise.all([
        guiasPagamentosService.listGuias(empresaId),
        guiasPagamentosService.listParcelamentos(empresaId),
      ])
      setGuias(listG)
      setParcelamentos(listP)
    } catch (err) {
      console.error('Erro ao carregar guias e parcelamentos:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível buscar as guias e parcelamentos federais.',
      })
    } finally {
      setLoading(false)
    }
  }, [empresaId, toast])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Sincronizar com DCTFWeb, Fiscal e Financeiro
  const handleSincronizarFontes = async () => {
    setSyncing(true)
    try {
      const res = await guiasPagamentosService.sincronizarGuiasComFontes(
        tenantId,
        empresaId,
        user?.id,
      )
      toast({
        title: 'Sincronização Concluída',
        description: `${res.inseridas} nova(s) guia(s) importada(s) e ${res.atualizadas} atualizada(s) via DCTFWeb/Fiscal/Financeiro.`,
      })
      await carregarDados()
      if (onRefreshParent) await onRefreshParent()
    } catch (err) {
      console.error('Erro na sincronização:', err)
      toast({
        variant: 'destructive',
        title: 'Falha na Sincronização',
        description: 'Não foi possível sincronizar com DCTFWeb e Fiscal.',
      })
    } finally {
      setSyncing(false)
    }
  }

  // Resumo Executivo
  const resumo = useMemo(() => {
    return guiasPagamentosService.calcularResumoExecutivo(guias, parcelamentos)
  }, [guias, parcelamentos])

  // Filtragem de guias
  const guiasFiltradas = useMemo(() => {
    return guias.filter((g) => {
      const matchSearch =
        searchGuia.trim() === '' ||
        g.codigo_receita.toLowerCase().includes(searchGuia.toLowerCase()) ||
        (g.numero_referencia &&
          g.numero_referencia.toLowerCase().includes(searchGuia.toLowerCase())) ||
        (g.descricao && g.descricao.toLowerCase().includes(searchGuia.toLowerCase())) ||
        g.periodo_apuracao.includes(searchGuia)

      const matchTipo = filtroTipoGuia === 'todos' || g.tipo_guia === filtroTipoGuia
      const matchSituacao = filtroSituacaoGuia === 'todos' || g.situacao === filtroSituacaoGuia

      return matchSearch && matchTipo && matchSituacao
    })
  }, [guias, searchGuia, filtroTipoGuia, filtroSituacaoGuia])

  // Submeter Criação de Guia
  const handleCriarGuia = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formGuia.periodo_apuracao || !formGuia.valor_total || !formGuia.data_vencimento) {
      toast({
        variant: 'destructive',
        title: 'Campos Obrigatórios',
        description: 'Preencha o período, o valor total e o vencimento da guia.',
      })
      return
    }

    try {
      const totalNum = parseFloat(formGuia.valor_total.replace(',', '.'))
      const origNum = formGuia.valor_original
        ? parseFloat(formGuia.valor_original.replace(',', '.'))
        : totalNum
      const acrescNum = formGuia.acrescimos ? parseFloat(formGuia.acrescimos.replace(',', '.')) : 0

      const input: CreateGuiaInput = {
        tenant_id: tenantId,
        empresa: empresaId,
        tipo_guia: formGuia.tipo_guia,
        codigo_receita: formGuia.codigo_receita || '0000',
        periodo_apuracao: formGuia.periodo_apuracao,
        numero_referencia: formGuia.numero_referencia || undefined,
        descricao: formGuia.descricao || undefined,
        valor_original: origNum,
        acrescimos: acrescNum,
        valor_total: totalNum,
        data_vencimento: new Date(formGuia.data_vencimento).toISOString(),
        situacao: formGuia.situacao,
        origem: 'manual',
        observacoes: formGuia.observacoes || undefined,
        comprovante_arquivo: formGuia.arquivoComprovante,
      }

      await guiasPagamentosService.createGuia(input, user?.id)
      toast({
        title: 'Guia cadastrada',
        description: `Guia ${formGuia.tipo_guia.toUpperCase()} salva com sucesso.`,
      })
      setModalNovaGuiaOpen(false)
      setFormGuia({
        tipo_guia: 'darf',
        codigo_receita: '2089',
        periodo_apuracao: '',
        numero_referencia: '',
        descricao: '',
        valor_original: '',
        acrescimos: '0',
        valor_total: '',
        data_vencimento: '',
        situacao: 'pendente',
        observacoes: '',
        arquivoComprovante: null,
      })
      carregarDados()
      if (onRefreshParent) onRefreshParent()
    } catch (err) {
      console.error('Erro ao salvar guia:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar guia',
        description: 'Verifique os dados informados.',
      })
    }
  }

  // Abrir Modal de Baixa
  const handleAbrirBaixa = (guia: GuiaPagamentoRecord) => {
    setGuiaSelecionadaParaBaixa(guia)
    setFormBaixa({
      dataPagamento: new Date().toISOString().split('T')[0],
      autenticacaoBancaria: guia.autenticacao_bancaria || '',
      baixarNoFinanceiro: true,
      comprovanteArquivo: null,
    })
    setModalBaixaGuiaOpen(true)
  }

  // Executar Baixa da Guia
  const handleConfirmarBaixa = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!guiaSelecionadaParaBaixa) return

    try {
      await guiasPagamentosService.marcarGuiaComoPaga({
        guiaId: guiaSelecionadaParaBaixa.id,
        tenantId,
        empresaId,
        usuarioId: user?.id || '',
        dataPagamento: new Date(formBaixa.dataPagamento).toISOString(),
        autenticacaoBancaria: formBaixa.autenticacaoBancaria || undefined,
        comprovante: formBaixa.comprovanteArquivo,
        baixarNoFinanceiro: formBaixa.baixarNoFinanceiro,
      })

      toast({
        title: 'Guia Baixada com Sucesso',
        description: `Guia marcada como paga.${formBaixa.baixarNoFinanceiro ? ' Título no Financeiro atualizado.' : ''}`,
      })

      setModalBaixaGuiaOpen(false)
      setGuiaSelecionadaParaBaixa(null)
      carregarDados()
      if (onRefreshParent) onRefreshParent()
    } catch (err) {
      console.error('Erro ao baixar guia:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar baixa',
        description: 'Não foi possível atualizar a situação da guia.',
      })
    }
  }

  // Submeter Novo Parcelamento
  const handleCriarParcelamento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formParc.numero_parcelamento || !formParc.total_parcelas || !formParc.saldo_devedor) {
      toast({
        variant: 'destructive',
        title: 'Campos Obrigatórios',
        description: 'Preencha o número, total de parcelas e saldo devedor.',
      })
      return
    }

    try {
      const totParc = parseInt(formParc.total_parcelas, 10)
      const quitParc = parseInt(formParc.parcelas_quitadas || '0', 10)
      const saldoDev = parseFloat(formParc.saldo_devedor.replace(',', '.'))
      const valConsol = formParc.valor_total_consolidado
        ? parseFloat(formParc.valor_total_consolidado.replace(',', '.'))
        : saldoDev

      const proxNum = formParc.proxima_parcela_numero
        ? parseInt(formParc.proxima_parcela_numero, 10)
        : quitParc + 1
      const proxValor = formParc.proxima_parcela_valor
        ? parseFloat(formParc.proxima_parcela_valor.replace(',', '.'))
        : saldoDev / (totParc - quitParc || 1)

      // Gerar quadro automático de parcelas
      const parcelasGeradas: ParcelaItem[] = []
      const valorBaseParcela = valConsol / totParc
      const dataBase = new Date(formParc.data_adesao)

      for (let i = 1; i <= totParc; i++) {
        const isQuitada = i <= quitParc
        const vencParcela = new Date(dataBase)
        vencParcela.setMonth(vencParcela.getMonth() + i)

        let statusParcela: 'paga' | 'aberta' | 'atrasada' = isQuitada ? 'paga' : 'aberta'
        if (!isQuitada && vencParcela.getTime() < Date.now()) {
          statusParcela = 'atrasada'
        }

        parcelasGeradas.push({
          numero: i,
          vencimento: vencParcela.toISOString(),
          valor_principal: Number(valorBaseParcela.toFixed(2)),
          juros_selic: 0,
          valor_total: Number(valorBaseParcela.toFixed(2)),
          status: statusParcela,
          data_pagamento: isQuitada ? vencParcela.toISOString() : null,
          codigo_barras: `858${i.toString().padStart(3, '0')}${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        })
      }

      const input: CreateParcelamentoInput = {
        tenant_id: tenantId,
        empresa: empresaId,
        numero_parcelamento: formParc.numero_parcelamento,
        modalidade: formParc.modalidade,
        descricao_modalidade: formParc.descricao_modalidade || undefined,
        data_adesao: new Date(formParc.data_adesao).toISOString(),
        total_parcelas: totParc,
        parcelas_quitadas: quitParc,
        valor_total_consolidado: valConsol,
        saldo_devedor: saldoDev,
        situacao_rfb: formParc.situacao_rfb,
        proxima_parcela_numero: proxNum,
        proxima_parcela_vencimento: formParc.proxima_parcela_vencimento
          ? new Date(formParc.proxima_parcela_vencimento).toISOString()
          : undefined,
        proxima_parcela_valor: Number(proxValor.toFixed(2)),
        quadro_parcelas_json: parcelasGeradas,
        origem_captura: 'manual_contador',
        observacoes: formParc.observacoes || undefined,
      }

      await guiasPagamentosService.createParcelamento(input, user?.id)

      toast({
        title: 'Parcelamento Cadastrado',
        description: `Acordo ${formParc.numero_parcelamento} registrado com sucesso.`,
      })

      setModalNovoParcelamentoOpen(false)
      carregarDados()
      if (onRefreshParent) onRefreshParent()
    } catch (err) {
      console.error('Erro ao cadastrar parcelamento:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar parcelamento',
        description: 'Verifique as informações preenchidas.',
      })
    }
  }

  // Alternar status de uma parcela do quadro
  const handleAlternarStatusParcela = async (
    parcelamentoId: string,
    numeroParcela: number,
    novoStatus: 'paga' | 'aberta' | 'atrasada',
  ) => {
    try {
      const atualizado = await guiasPagamentosService.atualizarStatusParcela(
        parcelamentoId,
        numeroParcela,
        novoStatus,
        novoStatus === 'paga' ? new Date().toISOString() : null,
        user?.id,
        tenantId,
      )
      setParcelamentoDetalhe(atualizado)
      toast({
        title: 'Parcela Atualizada',
        description: `Parcela ${numeroParcela} marcada como ${novoStatus.toUpperCase()}.`,
      })
      carregarDados()
      if (onRefreshParent) onRefreshParent()
    } catch (err) {
      console.error('Erro ao atualizar parcela:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar parcela',
        description: 'Não foi possível modificar o status da parcela.',
      })
    }
  }

  // Badges visuais de Guia
  const renderBadgeSituacaoGuia = (situacao: GuiaSituacao, vencimentoStr: string) => {
    const isVencidaReal =
      situacao === 'vencida' ||
      (situacao === 'pendente' && new Date(vencimentoStr).getTime() < Date.now())

    if (situacao === 'paga') {
      return (
        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 text-[11px] gap-1 font-semibold">
          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          <span>Paga</span>
        </Badge>
      )
    }

    if (isVencidaReal) {
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200 text-[11px] gap-1 font-semibold animate-pulse">
          <AlertCircle className="h-3 w-3 text-red-600" />
          <span>Vencida</span>
        </Badge>
      )
    }

    if (situacao === 'em_parcelamento') {
      return (
        <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-200 text-[11px] gap-1 font-semibold">
          <Layers className="h-3 w-3 text-purple-600" />
          <span>Parcelada</span>
        </Badge>
      )
    }

    if (situacao === 'compensada') {
      return (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200 text-[11px] gap-1 font-semibold">
          <Percent className="h-3 w-3 text-blue-600" />
          <span>Compensada (DCOMP)</span>
        </Badge>
      )
    }

    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 text-[11px] gap-1 font-semibold">
        <Clock className="h-3 w-3 text-amber-600" />
        <span>Pendente</span>
      </Badge>
    )
  }

  // Badges visuais de Parcelamento (🟢🟡🔴)
  const renderBadgeSaudeParcelamento = (parc: ParcelamentoFederalRecord) => {
    const saude = guiasPagamentosService.calcularSaudeParcelamento(parc)

    if (saude.badge === 'inadimplente') {
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-300 text-xs gap-1 font-bold">
          <span className="h-2 w-2 rounded-full bg-red-600" />
          <span>🔴 {saude.label}</span>
        </Badge>
      )
    }

    if (saude.badge === 'vencendo_7d') {
      return (
        <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 border-amber-300 text-xs gap-1 font-bold animate-pulse">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <span>🟡 {saude.label}</span>
        </Badge>
      )
    }

    return (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-300 text-xs gap-1 font-bold">
        <span className="h-2 w-2 rounded-full bg-emerald-600" />
        <span>🟢 {saude.label}</span>
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* 1. RESUMO EXECUTIVO NO TOPO */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total em Aberto */}
        <Card className="rounded-xl border-[#E2E8F0] shadow-xs bg-gradient-to-br from-white to-slate-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748B]">Total Tributos em Aberto</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold text-[#1A2333]">
              R$ {resumo.totalAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="mt-1 text-[11px] text-[#64748B]">
              {resumo.qtdGuiasAbertas} guia(s) no prazo legal
            </p>
          </CardContent>
        </Card>

        {/* Guias Vencidas */}
        <Card
          className={`rounded-xl border shadow-xs ${
            resumo.qtdGuiasVencidas > 0
              ? 'border-red-200 bg-red-50/30'
              : 'border-[#E2E8F0] bg-white'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748B]">Guias Vencidas</span>
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  resumo.qtdGuiasVencidas > 0
                    ? 'bg-red-100 text-red-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {resumo.qtdGuiasVencidas > 0 ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
              </div>
            </div>
            <p
              className={`mt-2 text-xl font-bold ${
                resumo.qtdGuiasVencidas > 0 ? 'text-red-700' : 'text-[#1A2333]'
              }`}
            >
              R$ {resumo.totalVencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="mt-1 text-[11px] text-[#64748B]">
              {resumo.qtdGuiasVencidas === 0
                ? 'Nenhuma guia em atraso'
                : `${resumo.qtdGuiasVencidas} guia(s) com cobrança ativa`}
            </p>
          </CardContent>
        </Card>

        {/* Parcelamentos Federais (PAR / PER-DCOMP) */}
        <Card className="rounded-xl border-[#E2E8F0] shadow-xs bg-gradient-to-br from-white to-slate-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748B]">
                Saldo Parcelamentos (PAR)
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold text-[#1A2333]">
              R${' '}
              {resumo.saldoDevedorParcelamentos.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}
            </p>
            <p className="mt-1 text-[11px] text-[#64748B]">
              {resumo.parcelamentosAtivos} acordo(s) ativo(s)
              {resumo.parcelamentosComAtraso > 0 && (
                <span className="font-bold text-red-600">
                  {' '}
                  • {resumo.parcelamentosComAtraso} em atraso
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Regularidade Fiscal Consolidada */}
        <Card
          className={`rounded-xl border shadow-xs ${
            resumo.regularidadeTributaria === 'irregular'
              ? 'border-red-300 bg-red-50/40'
              : resumo.regularidadeTributaria === 'alerta'
                ? 'border-amber-300 bg-amber-50/40'
                : 'border-emerald-200 bg-emerald-50/30'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748B]">Regularidade Tributária</span>
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  resumo.regularidadeTributaria === 'irregular'
                    ? 'bg-red-200 text-red-800'
                    : resumo.regularidadeTributaria === 'alerta'
                      ? 'bg-amber-200 text-amber-800'
                      : 'bg-emerald-200 text-emerald-800'
                }`}
              >
                {resumo.regularidadeTributaria === 'irregular' ? (
                  <ShieldX className="h-4 w-4" />
                ) : resumo.regularidadeTributaria === 'alerta' ? (
                  <ShieldAlert className="h-4 w-4" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
              </div>
            </div>
            <p
              className={`mt-2 text-base font-bold ${
                resumo.regularidadeTributaria === 'irregular'
                  ? 'text-red-700'
                  : resumo.regularidadeTributaria === 'alerta'
                    ? 'text-amber-800'
                    : 'text-emerald-700'
              }`}
            >
              {resumo.regularidadeTributaria === 'irregular'
                ? '🔴 Débitos / Parcelas em Atraso'
                : resumo.regularidadeTributaria === 'alerta'
                  ? '🟡 Atenção / Prazos Próximos'
                  : '🟢 100% Adimplente'}
            </p>
            <p className="mt-1 text-[11px] text-[#64748B]">
              Total pago no ano: R${' '}
              {resumo.totalPagoAno.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AÇÕES E BARRA DE SINCRONIZAÇÃO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#E2E8F0]">
        <div>
          <h4 className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#0FA3A3]" />
            <span>Consulta de Guias de Arrecadação e Parcelamentos Federais</span>
          </h4>
          <p className="text-xs text-[#64748B] mt-0.5">
            Monitoramento de DARF, DARF Previdenciário (DCTFWeb), DAS e acordos PAR/PER-DCOMP
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSincronizarFontes}
            disabled={syncing}
            className="text-xs h-9 border-[#0FA3A3] text-[#0FA3A3] hover:bg-[#F0FDFA]"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Sincronizando...' : 'Sincronizar com DCTFWeb/Fiscal'}</span>
          </Button>

          {canEdit && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalNovoParcelamentoOpen(true)}
                className="text-xs h-9 text-[#0B1F3A] border-slate-300 hover:bg-slate-50"
              >
                <Layers className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
                <span>+ Parcelamento PAR</span>
              </Button>

              <Button
                size="sm"
                onClick={() => setModalNovaGuiaOpen(true)}
                className="text-xs h-9 bg-[#0FA3A3] hover:bg-[#0C8585] text-white"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                <span>+ Registrar Guia</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* SEÇÃO PRINCIPAL COM SUB-ABAS: GUIAS vs PARCELAMENTOS */}
      <Tabs defaultValue="guias" className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-xl h-10 w-full sm:w-auto justify-start mb-4">
          <TabsTrigger
            value="guias"
            className="rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-white data-[state=active]:text-[#0FA3A3]"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Guias de Arrecadação ({guias.length})</span>
            {resumo.qtdGuiasVencidas > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-red-600 text-white">
                {resumo.qtdGuiasVencidas}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="parcelamentos"
            className="rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-white data-[state=active]:text-[#0FA3A3]"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Extrato PAR / PER-DCOMP ({parcelamentos.length})</span>
            {resumo.parcelamentosComAtraso > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-red-600 text-white">
                {resumo.parcelamentosComAtraso}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ==================================================== */}
        {/* SUB-ABA 1: GUIAS DE PAGAMENTO */}
        {/* ==================================================== */}
        <TabsContent value="guias" className="space-y-4">
          {/* Barra de Filtros */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 rounded-xl border border-[#E2E8F0]">
            <div className="relative flex-1 max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" />
              <Input
                placeholder="Buscar por código, número ou descrição..."
                value={searchGuia}
                onChange={(e) => setSearchGuia(e.target.value)}
                className="h-8 pl-8 text-xs border-[#E2E8F0] rounded-lg"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Select value={filtroTipoGuia} onValueChange={setFiltroTipoGuia}>
                <SelectTrigger className="h-8 text-xs w-[160px] border-[#E2E8F0]">
                  <SelectValue placeholder="Tipo de Guia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Tipos</SelectItem>
                  <SelectItem value="darf">DARF Comum</SelectItem>
                  <SelectItem value="darf_previdenciario">DARF Previdenciário</SelectItem>
                  <SelectItem value="dctfweb">DCTFWeb</SelectItem>
                  <SelectItem value="das">DAS Simples</SelectItem>
                  <SelectItem value="dae_par">DAE / Guia PAR</SelectItem>
                  <SelectItem value="perdcomp">DCOMP</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filtroSituacaoGuia} onValueChange={setFiltroSituacaoGuia}>
                <SelectTrigger className="h-8 text-xs w-[140px] border-[#E2E8F0]">
                  <SelectValue placeholder="Situação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas Situações</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="paga">Paga</SelectItem>
                  <SelectItem value="vencida">Vencida</SelectItem>
                  <SelectItem value="em_parcelamento">Parcelada</SelectItem>
                  <SelectItem value="compensada">Compensada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabela de Guias */}
          <Card className="rounded-xl border-[#E2E8F0] shadow-xs overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                      <th className="py-3 px-4">Tipo & Código</th>
                      <th className="py-3 px-4">Período / Ref.</th>
                      <th className="py-3 px-4">Vencimento</th>
                      <th className="py-3 px-4">Valor Total</th>
                      <th className="py-3 px-4">Data Pagamento</th>
                      <th className="py-3 px-4">Situação</th>
                      <th className="py-3 px-4">Origem</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-[#64748B]">
                          Carregando guias de tributos federais...
                        </td>
                      </tr>
                    ) : guiasFiltradas.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-[#94A3B8]">
                          Nenhuma guia encontrada com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      guiasFiltradas.map((guia) => {
                        const isPaga = guia.situacao === 'paga'
                        return (
                          <tr key={guia.id} className="hover:bg-slate-50/75 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-[#1A2333]">
                                {guia.codigo_receita}
                              </div>
                              <div className="text-[11px] text-[#64748B]">
                                {guiasPagamentosService.getTipoGuiaLabel(guia.tipo_guia)}
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <div className="font-medium text-[#1A2333]">
                                Comp. {guia.periodo_apuracao}
                              </div>
                              {guia.numero_referencia && (
                                <div className="text-[10px] text-[#64748B] font-mono">
                                  {guia.numero_referencia}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-4 font-medium text-[#1A2333]">
                              {formatDatePtBr(guia.data_vencimento)}
                            </td>

                            <td className="py-3 px-4 font-bold text-[#1A2333]">
                              R${' '}
                              {guia.valor_total.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                              })}
                            </td>

                            <td className="py-3 px-4 text-[#64748B]">
                              {guia.data_pagamento ? (
                                <div className="flex flex-col">
                                  <span className="font-semibold text-emerald-700">
                                    {formatDatePtBr(guia.data_pagamento)}
                                  </span>
                                  {guia.autenticacao_bancaria && (
                                    <span className="text-[9px] font-mono text-slate-500">
                                      Aut: {guia.autenticacao_bancaria.slice(0, 16)}...
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              {renderBadgeSituacaoGuia(guia.situacao, guia.data_vencimento)}
                            </td>

                            <td className="py-3 px-4">
                              <Badge
                                variant="outline"
                                className="text-[10px] font-normal border-slate-200 text-slate-600"
                              >
                                {guia.origem === 'dctfweb'
                                  ? 'DCTFWeb'
                                  : guia.origem === 'fiscal'
                                    ? 'Fiscal'
                                    : guia.origem === 'conector_rfb'
                                      ? 'Conector RFB'
                                      : 'Manual'}
                              </Badge>
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {!isPaga && canEdit && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleAbrirBaixa(guia)}
                                    className="h-7 px-2 text-[11px] border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                  >
                                    <Check className="h-3 w-3 mr-1" />
                                    <span>Dar Baixa</span>
                                  </Button>
                                )}

                                {guia.comprovante_arquivo && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      // Link direto para arquivo pocketbase
                                      const url = `${import.meta.env.VITE_POCKETBASE_URL || ''}/api/files/guias_pagamentos/${guia.id}/${guia.comprovante_arquivo}`
                                      window.open(url, '_blank')
                                    }}
                                    className="h-7 w-7 p-0 text-[#0FA3A3] hover:bg-teal-50"
                                    title="Baixar comprovante de arrecadação"
                                  >
                                    <Download className="h-3.5 w-3.5" />
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================================================== */}
        {/* SUB-ABA 2: EXTRATO DO PAR / PER-DCOMP */}
        {/* ==================================================== */}
        <TabsContent value="parcelamentos" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {parcelamentos.length === 0 ? (
              <div className="col-span-2 text-center py-12 bg-white rounded-xl border border-slate-200 text-[#64748B]">
                <Layers className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                <p className="font-semibold text-sm">Nenhum parcelamento federal registrado</p>
                <p className="text-xs text-slate-400 mt-1">
                  Cadastre acordos ordinários, PERT ou transações tributárias da PGFN para
                  monitoramento automático das parcelas.
                </p>
              </div>
            ) : (
              parcelamentos.map((parc) => {
                const progresso = Math.round(
                  (parc.parcelas_quitadas / (parc.total_parcelas || 1)) * 100,
                )
                const parcelasRestantes = parc.total_parcelas - parc.parcelas_quitadas

                return (
                  <Card
                    key={parc.id}
                    className="rounded-xl border border-[#E2E8F0] shadow-xs hover:border-slate-300 transition-colors bg-white overflow-hidden"
                  >
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[#1A2333] font-mono">
                            {parc.numero_parcelamento}
                          </span>
                          {renderBadgeSaudeParcelamento(parc)}
                        </div>
                        <p className="text-xs text-[#64748B] mt-0.5">
                          {guiasPagamentosService.getModalidadeParcelamentoLabel(parc.modalidade)}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setParcelamentoDetalhe(parc)
                          setModalQuadroParcelasOpen(true)
                        }}
                        className="text-xs h-8 border-slate-200 text-[#0B1F3A] hover:bg-slate-100"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1 text-[#0FA3A3]" />
                        <span>Ver Quadro ({parc.total_parcelas})</span>
                      </Button>
                    </div>

                    <CardContent className="p-4 space-y-4">
                      {/* Progresso de quitação */}
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-[#64748B] font-medium">Progresso do Acordo</span>
                          <span className="font-bold text-[#1A2333]">
                            {parc.parcelas_quitadas} de {parc.total_parcelas} pagas ({progresso}%)
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-[#0FA3A3] rounded-full transition-all duration-300"
                            style={{ width: `${progresso}%` }}
                          />
                        </div>
                      </div>

                      {/* Dados Financeiros */}
                      <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50/80 p-3 rounded-lg border border-slate-100">
                        <div>
                          <span className="text-[#64748B] block">Saldo Devedor Atual:</span>
                          <span className="font-bold text-sm text-[#1A2333]">
                            R${' '}
                            {parc.saldo_devedor.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>

                        <div>
                          <span className="text-[#64748B] block">Parcelas Restantes:</span>
                          <span className="font-bold text-sm text-[#1A2333]">
                            {parcelasRestantes} parcela(s)
                          </span>
                        </div>
                      </div>

                      {/* Próxima Parcela */}
                      {parc.proxima_parcela_vencimento && (
                        <div className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50/40 text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide block">
                              Próxima Parcela (nº {parc.proxima_parcela_numero})
                            </span>
                            <span className="font-bold text-sm text-[#1A2333]">
                              R${' '}
                              {(parc.proxima_parcela_valor || 0).toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[11px] text-[#64748B] block">Vencimento:</span>
                            <span className="font-bold text-xs text-[#1A2333]">
                              {formatDatePtBr(parc.proxima_parcela_vencimento)}
                            </span>
                          </div>
                        </div>
                      )}

                      {parc.observacoes && (
                        <p className="text-[11px] text-[#64748B] italic bg-slate-50 p-2 rounded">
                          {parc.observacoes}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ==================================================== */}
      {/* MODAL 1: REGISTRAR NOVA GUIA */}
      {/* ==================================================== */}
      <Dialog open={modalNovaGuiaOpen} onOpenChange={setModalNovaGuiaOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333] flex items-center gap-2">
              <Plus className="h-4 w-4 text-[#0FA3A3]" />
              <span>Registrar Guia de Arrecadação Federal</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Cadastre manualmente uma guia DARF, DAS, DCTFWeb ou DCOMP com seus dados oficiais de
              recolhimento.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCriarGuia} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo de Guia *</Label>
                <Select
                  value={formGuia.tipo_guia}
                  onValueChange={(val) =>
                    setFormGuia((prev) => ({ ...prev, tipo_guia: val as GuiaTipo }))
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="darf">DARF Comum</SelectItem>
                    <SelectItem value="darf_previdenciario">DARF Previdenciário</SelectItem>
                    <SelectItem value="dctfweb">DARF DCTFWeb</SelectItem>
                    <SelectItem value="das">DAS Simples Nacional</SelectItem>
                    <SelectItem value="dae_par">DAE / Guia PAR</SelectItem>
                    <SelectItem value="perdcomp">DCOMP Compensação</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Código de Receita *</Label>
                <Input
                  placeholder="Ex: 2089, 5952, 111-0"
                  value={formGuia.codigo_receita}
                  onChange={(e) =>
                    setFormGuia((prev) => ({ ...prev, codigo_receita: e.target.value }))
                  }
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Período de Apuração *</Label>
                <Input
                  placeholder="Ex: 08/2026"
                  value={formGuia.periodo_apuracao}
                  onChange={(e) =>
                    setFormGuia((prev) => ({ ...prev, periodo_apuracao: e.target.value }))
                  }
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs">Número de Referência / PAR</Label>
                <Input
                  placeholder="Opcional"
                  value={formGuia.numero_referencia}
                  onChange={(e) =>
                    setFormGuia((prev) => ({ ...prev, numero_referencia: e.target.value }))
                  }
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Valor Original (R$)</Label>
                <Input
                  placeholder="0,00"
                  value={formGuia.valor_original}
                  onChange={(e) =>
                    setFormGuia((prev) => ({ ...prev, valor_original: e.target.value }))
                  }
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs">Acréscimos (R$)</Label>
                <Input
                  placeholder="0,00"
                  value={formGuia.acrescimos}
                  onChange={(e) => setFormGuia((prev) => ({ ...prev, acrescimos: e.target.value }))}
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs">Valor Total * (R$)</Label>
                <Input
                  placeholder="0,00"
                  value={formGuia.valor_total}
                  onChange={(e) =>
                    setFormGuia((prev) => ({ ...prev, valor_total: e.target.value }))
                  }
                  className="h-9 text-xs font-bold"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data de Vencimento *</Label>
                <Input
                  type="date"
                  value={formGuia.data_vencimento}
                  onChange={(e) =>
                    setFormGuia((prev) => ({ ...prev, data_vencimento: e.target.value }))
                  }
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs">Situação Inicial</Label>
                <Select
                  value={formGuia.situacao}
                  onValueChange={(val) =>
                    setFormGuia((prev) => ({ ...prev, situacao: val as GuiaSituacao }))
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="paga">Paga</SelectItem>
                    <SelectItem value="vencida">Vencida</SelectItem>
                    <SelectItem value="em_parcelamento">Em Parcelamento</SelectItem>
                    <SelectItem value="compensada">Compensada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Descrição / Finalidade</Label>
              <Input
                placeholder="Ex: DARF Previdenciário consolidado folha"
                value={formGuia.descricao}
                onChange={(e) => setFormGuia((prev) => ({ ...prev, descricao: e.target.value }))}
                className="h-9 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">Anexo do Documento / Comprovante (PDF)</Label>
              <Input
                type="file"
                accept=".pdf,image/png,image/jpeg"
                onChange={(e) =>
                  setFormGuia((prev) => ({
                    ...prev,
                    arquivoComprovante: e.target.files?.[0] || null,
                  }))
                }
                className="h-9 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalNovaGuiaOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-[#0FA3A3] hover:bg-[#0C8585] text-white"
              >
                Salvar Guia
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==================================================== */}
      {/* MODAL 2: BAIXA DE GUIA DE PAGAMENTO */}
      {/* ==================================================== */}
      <Dialog open={modalBaixaGuiaOpen} onOpenChange={setModalBaixaGuiaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333] flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Registrar Pagamento de Guia</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Confirme a quitação da guia e opcionalmente realize a baixa correspondente no
              Financeiro.
            </DialogDescription>
          </DialogHeader>

          {guiaSelecionadaParaBaixa && (
            <form onSubmit={handleConfirmarBaixa} className="space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[#1A2333]">
                    {guiaSelecionadaParaBaixa.codigo_receita} (Comp.{' '}
                    {guiaSelecionadaParaBaixa.periodo_apuracao})
                  </span>
                  <span className="font-bold text-sm text-[#0FA3A3]">
                    R${' '}
                    {guiaSelecionadaParaBaixa.valor_total.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <p className="text-[11px] text-[#64748B] mt-1">
                  Vencimento original: {formatDatePtBr(guiaSelecionadaParaBaixa.data_vencimento)}
                </p>
              </div>

              <div>
                <Label className="text-xs">Data Efetiva de Pagamento *</Label>
                <Input
                  type="date"
                  value={formBaixa.dataPagamento}
                  onChange={(e) =>
                    setFormBaixa((prev) => ({ ...prev, dataPagamento: e.target.value }))
                  }
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs">Código / Autenticação Bancária</Label>
                <Input
                  placeholder="Ex: AUT-BCO-99882211"
                  value={formBaixa.autenticacaoBancaria}
                  onChange={(e) =>
                    setFormBaixa((prev) => ({ ...prev, autenticacaoBancaria: e.target.value }))
                  }
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div>
                <Label className="text-xs">Comprovante de Pagamento (PDF ou Imagem)</Label>
                <Input
                  type="file"
                  accept=".pdf,image/png,image/jpeg"
                  onChange={(e) =>
                    setFormBaixa((prev) => ({
                      ...prev,
                      comprovanteArquivo: e.target.files?.[0] || null,
                    }))
                  }
                  className="h-9 text-xs"
                />
              </div>

              <div className="flex items-start gap-2 p-2.5 bg-blue-50/60 rounded-lg border border-blue-200">
                <input
                  type="checkbox"
                  id="baixarFin"
                  checked={formBaixa.baixarNoFinanceiro}
                  onChange={(e) =>
                    setFormBaixa((prev) => ({ ...prev, baixarNoFinanceiro: e.target.checked }))
                  }
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0FA3A3] focus:ring-[#0FA3A3]"
                />
                <label htmlFor="baixarFin" className="text-[11px] text-[#1A2333] cursor-pointer">
                  <b>Realizar baixa no Financeiro</b>: atualizar status do título a pagar vinculado
                  para "pago" e registrar conciliação bancária.
                </label>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalBaixaGuiaOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  Confirmar Baixa
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ==================================================== */}
      {/* MODAL 3: CADASTRAR PARCELAMENTO FEDERAL */}
      {/* ==================================================== */}
      <Dialog open={modalNovoParcelamentoOpen} onOpenChange={setModalNovoParcelamentoOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333] flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-600" />
              <span>Novo Parcelamento Federal (PAR / PER-DCOMP)</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Cadastre o acordo de parcelamento ativo junto à Receita Federal ou PGFN.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCriarParcelamento} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Número do Parcelamento *</Label>
                <Input
                  placeholder="Ex: PAR-RFB-2026-9912"
                  value={formParc.numero_parcelamento}
                  onChange={(e) =>
                    setFormParc((prev) => ({ ...prev, numero_parcelamento: e.target.value }))
                  }
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>

              <div>
                <Label className="text-xs">Modalidade do Acordo *</Label>
                <Select
                  value={formParc.modalidade}
                  onValueChange={(val) =>
                    setFormParc((prev) => ({
                      ...prev,
                      modalidade: val as ModalidadeParcelamento,
                    }))
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pert_sn">PERT-SN (Simples Nacional)</SelectItem>
                    <SelectItem value="pert_demais">PERT Geral</SelectItem>
                    <SelectItem value="ordinario_rfb">Ordinário RFB (Até 60x)</SelectItem>
                    <SelectItem value="simplificado_previdenciario">
                      Simplificado Previdenciário
                    </SelectItem>
                    <SelectItem value="transacao_tributaria_pgfn">
                      Transação Tributária PGFN
                    </SelectItem>
                    <SelectItem value="perdcomp_compensacao">PER/DCOMP Compensação</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Data de Adesão *</Label>
                <Input
                  type="date"
                  value={formParc.data_adesao}
                  onChange={(e) =>
                    setFormParc((prev) => ({ ...prev, data_adesao: e.target.value }))
                  }
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs">Total de Parcelas *</Label>
                <Input
                  type="number"
                  min="1"
                  max="180"
                  value={formParc.total_parcelas}
                  onChange={(e) =>
                    setFormParc((prev) => ({ ...prev, total_parcelas: e.target.value }))
                  }
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs">Parcelas Quitadas</Label>
                <Input
                  type="number"
                  min="0"
                  value={formParc.parcelas_quitadas}
                  onChange={(e) =>
                    setFormParc((prev) => ({ ...prev, parcelas_quitadas: e.target.value }))
                  }
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Valor Total Consolidado (R$)</Label>
                <Input
                  placeholder="0,00"
                  value={formParc.valor_total_consolidado}
                  onChange={(e) =>
                    setFormParc((prev) => ({ ...prev, valor_total_consolidado: e.target.value }))
                  }
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs">Saldo Devedor Atual * (R$)</Label>
                <Input
                  placeholder="0,00"
                  value={formParc.saldo_devedor}
                  onChange={(e) =>
                    setFormParc((prev) => ({ ...prev, saldo_devedor: e.target.value }))
                  }
                  className="h-9 text-xs font-bold"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Próxima Parcela (Nº)</Label>
                <Input
                  type="number"
                  value={formParc.proxima_parcela_numero}
                  onChange={(e) =>
                    setFormParc((prev) => ({ ...prev, proxima_parcela_numero: e.target.value }))
                  }
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs">Próx. Vencimento</Label>
                <Input
                  type="date"
                  value={formParc.proxima_parcela_vencimento}
                  onChange={(e) =>
                    setFormParc((prev) => ({
                      ...prev,
                      proxima_parcela_vencimento: e.target.value,
                    }))
                  }
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs">Valor Próx. Parcela (R$)</Label>
                <Input
                  placeholder="0,00"
                  value={formParc.proxima_parcela_valor}
                  onChange={(e) =>
                    setFormParc((prev) => ({
                      ...prev,
                      proxima_parcela_valor: e.target.value,
                    }))
                  }
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Observações / Fundamentação Legal</Label>
              <Textarea
                placeholder="Ex: Art. 9º Resolução CGSN nº 140/2018..."
                value={formParc.observacoes}
                onChange={(e) => setFormParc((prev) => ({ ...prev, observacoes: e.target.value }))}
                className="text-xs resize-none h-16"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalNovoParcelamentoOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-[#0FA3A3] hover:bg-[#0C8585] text-white"
              >
                Cadastrar Acordo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==================================================== */}
      {/* MODAL 4: QUADRO DE PARCELAS DO PARCELAMENTO */}
      {/* ==================================================== */}
      <Dialog open={modalQuadroParcelasOpen} onOpenChange={setModalQuadroParcelasOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-600" />
                <span>
                  Extrato & Quadro de Parcelas — {parcelamentoDetalhe?.numero_parcelamento}
                </span>
              </div>
              {parcelamentoDetalhe && renderBadgeSaudeParcelamento(parcelamentoDetalhe)}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Histórico de parcelas, datas de vencimento, juros Selic e controle individual de
              quitação.
            </DialogDescription>
          </DialogHeader>

          {parcelamentoDetalhe && (
            <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
              {/* Resumo rápido do acordo */}
              <div className="grid grid-cols-4 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-[#64748B] block text-[10px]">Adesão:</span>
                  <span className="font-semibold text-[#1A2333]">
                    {formatDatePtBr(parcelamentoDetalhe.data_adesao)}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[10px]">Total Consolidado:</span>
                  <span className="font-semibold text-[#1A2333]">
                    R${' '}
                    {(parcelamentoDetalhe.valor_total_consolidado || 0).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[10px]">Saldo Devedor:</span>
                  <span className="font-bold text-[#0FA3A3]">
                    R${' '}
                    {parcelamentoDetalhe.saldo_devedor.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[10px]">Quitadas:</span>
                  <span className="font-semibold text-[#1A2333]">
                    {parcelamentoDetalhe.parcelas_quitadas} de {parcelamentoDetalhe.total_parcelas}
                  </span>
                </div>
              </div>

              {/* Tabela do Quadro de Parcelas */}
              <div className="rounded-lg border border-[#E2E8F0] overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-slate-100/75 text-[10px] font-bold uppercase text-[#64748B]">
                      <th className="py-2.5 px-3">Parcela</th>
                      <th className="py-2.5 px-3">Vencimento</th>
                      <th className="py-2.5 px-3">Principal (R$)</th>
                      <th className="py-2.5 px-3">Selic (R$)</th>
                      <th className="py-2.5 px-3">Total (R$)</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Pagamento</th>
                      {canEdit && <th className="py-2.5 px-3 text-right">Ação</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Array.isArray(parcelamentoDetalhe.quadro_parcelas_json) &&
                    parcelamentoDetalhe.quadro_parcelas_json.length > 0 ? (
                      parcelamentoDetalhe.quadro_parcelas_json.map((parc) => {
                        const isPaga = parc.status === 'paga'
                        const isAtrasada = parc.status === 'atrasada'

                        return (
                          <tr
                            key={parc.numero}
                            className={`hover:bg-slate-50 transition-colors ${
                              isAtrasada ? 'bg-red-50/30' : ''
                            }`}
                          >
                            <td className="py-2 px-3 font-bold text-[#1A2333]">
                              {parc.numero} / {parcelamentoDetalhe.total_parcelas}
                            </td>
                            <td className="py-2 px-3">{formatDatePtBr(parc.vencimento)}</td>
                            <td className="py-2 px-3">
                              R${' '}
                              {parc.valor_principal.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                            <td className="py-2 px-3 text-slate-500">
                              R${' '}
                              {(parc.juros_selic || 0).toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                            <td className="py-2 px-3 font-bold text-[#1A2333]">
                              R${' '}
                              {parc.valor_total.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                            <td className="py-2 px-3">
                              {isPaga ? (
                                <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold border-emerald-200">
                                  Paga
                                </Badge>
                              ) : isAtrasada ? (
                                <Badge className="bg-red-100 text-red-800 text-[10px] font-semibold border-red-200 animate-pulse">
                                  Atrasada
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-100 text-amber-800 text-[10px] font-semibold border-amber-200">
                                  Em Aberto
                                </Badge>
                              )}
                            </td>
                            <td className="py-2 px-3 text-[#64748B] text-[11px]">
                              {parc.data_pagamento ? formatDatePtBr(parc.data_pagamento) : '—'}
                            </td>

                            {canEdit && (
                              <td className="py-2 px-3 text-right">
                                {isPaga ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      handleAlternarStatusParcela(
                                        parcelamentoDetalhe.id,
                                        parc.numero,
                                        'aberta',
                                      )
                                    }
                                    className="h-6 px-2 text-[10px] text-slate-500 hover:text-red-600"
                                  >
                                    Reabrir
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      handleAlternarStatusParcela(
                                        parcelamentoDetalhe.id,
                                        parc.numero,
                                        'paga',
                                      )
                                    }
                                    className="h-6 px-2 text-[10px] border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                  >
                                    <Check className="h-2.5 w-2.5 mr-1" />
                                    <span>Pagar</span>
                                  </Button>
                                )}
                              </td>
                            )}
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-[#94A3B8]">
                          Nenhum detalhe de parcelas gerado para este parcelamento.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalQuadroParcelasOpen(false)}
            >
              Fechar Quadro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

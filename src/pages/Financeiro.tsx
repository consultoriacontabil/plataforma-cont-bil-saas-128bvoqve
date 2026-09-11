import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Building2,
  PlusCircle,
  FileCheck2,
  Calendar,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Upload,
  RefreshCw,
  FileSpreadsheet,
  Link2,
  Layers,
  Sparkles,
  DollarSign,
  Trash2,
  Check,
  X,
  Ban,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { empresasService } from '@/services/empresas'
import { contabilService } from '@/services/contabil'
import { financeiroService } from '@/services/financeiro'
import type {
  Empresa,
  ContaBancariaRecord,
  ContaFinanceiraRecord,
  ExtratoBancarioRecord,
  ContaContabil,
  ContaFinanceiraTipo,
  ContaFinanceiraStatus,
  IntegracaoBancariaRecord,
  IntegracaoLogRecord,
  IntegracaoModo,
  IntegracaoFrequencia,
  IntegracaoFonteTipo,
  IntegracaoStatus,
} from '@/types'
import { formatDatePtBr } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

export default function FinanceiroPage() {
  const { tenant, user, hasPermission } = useAuth()
  const { toast } = useToast()

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('all')
  const [contasBancarias, setContasBancarias] = useState<ContaBancariaRecord[]>([])
  const [titulos, setTitulos] = useState<ContaFinanceiraRecord[]>([])
  const [extratos, setExtratos] = useState<ExtratoBancarioRecord[]>([])
  const [planoContas, setPlanoContas] = useState<ContaContabil[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros de Títulos
  const [tipoAtivo, setTipoAtivo] = useState<ContaFinanceiraTipo>('pagar')
  const [statusFiltro, setStatusFiltro] = useState<ContaFinanceiraStatus | 'todos'>('todos')
  const [periodoInicio, setPeriodoInicio] = useState<string>('')
  const [periodoFim, setPeriodoFim] = useState<string>('')
  const [busca, setBusca] = useState<string>('')

  // Modal Novo Título
  const [modalNovoTituloOpen, setModalNovoTituloOpen] = useState(false)
  const [novoTipo, setNovoTipo] = useState<ContaFinanceiraTipo>('pagar')
  const [novoEmpresaId, setNovoEmpresaId] = useState<string>('')
  const [novoPessoa, setNovoPessoa] = useState<string>('')
  const [novoDescricao, setNovoDescricao] = useState<string>('')
  const [novoDocRef, setNovoDocRef] = useState<string>('')
  const [novoCategoriaId, setNovoCategoriaId] = useState<string>('')
  const [novoValor, setNovoValor] = useState<string>('')
  const [novoEmissao, setNovoEmissao] = useState<string>(new Date().toISOString().split('T')[0])
  const [novoVencimento, setNovoVencimento] = useState<string>(
    new Date().toISOString().split('T')[0],
  )
  const [novoObservacoes, setNovoObservacoes] = useState<string>('')
  const [salvandoTitulo, setSalvandoTitulo] = useState(false)

  // Modal Baixar Título
  const [modalBaixaOpen, setModalBaixaOpen] = useState(false)
  const [tituloParaBaixa, setTituloParaBaixa] = useState<ContaFinanceiraRecord | null>(null)
  const [baixaData, setBaixaData] = useState<string>(new Date().toISOString().split('T')[0])
  const [baixaContaBancariaId, setBaixaContaBancariaId] = useState<string>('')
  const [baixaGerarContabil, setBaixaGerarContabil] = useState(true)
  const [salvandoBaixa, setSalvandoBaixa] = useState(false)

  // Modal Nova Conta Bancária
  const [modalContaBancariaOpen, setModalContaBancariaOpen] = useState(false)
  const [cbEmpresaId, setCbEmpresaId] = useState<string>('')
  const [cbBanco, setCbBanco] = useState<string>('')
  const [cbAgencia, setCbAgencia] = useState<string>('')
  const [cbConta, setCbConta] = useState<string>('')
  const [cbSaldoInicial, setCbSaldoInicial] = useState<string>('0')
  const [cbContaContabilId, setCbContaContabilId] = useState<string>('')
  const [salvandoContaBancaria, setSalvandoContaBancaria] = useState(false)

  // Importação e Conciliação de Extrato
  const [modalImportarExtratoOpen, setModalImportarExtratoOpen] = useState(false)
  const [extratoEmpresaId, setExtratoEmpresaId] = useState<string>('')
  const [extratoContaBancariaId, setExtratoContaBancariaId] = useState<string>('')
  const [csvContent, setCsvContent] = useState<string>('')
  const [previewExtrato, setPreviewExtrato] = useState<
    {
      data: string
      descricao: string
      documento_numero?: string
      valor: number
      tipo_transacao: 'credito' | 'debito'
    }[]
  >([])
  const [importandoExtrato, setImportandoExtrato] = useState(false)

  // Modal Conciliar Extrato Manualmente
  const [modalConciliarLinhaOpen, setModalConciliarLinhaOpen] = useState(false)
  const [extratoSelecionado, setExtratoSelecionado] = useState<ExtratoBancarioRecord | null>(null)
  const [tituloSelecionadoId, setTituloSelecionadoId] = useState<string>('')
  const [concilCategoriaAvulsaId, setConcilCategoriaAvulsaId] = useState<string>('')
  const [concilGerarContabil, setConcilGerarContabil] = useState(true)
  const [salvandoConciliacao, setSalvandoConciliacao] = useState(false)

  // Estados de Integração Bancária & Importação Automática
  const [integracoes, setIntegracoes] = useState<IntegracaoBancariaRecord[]>([])
  const [integracaoLogs, setIntegracaoLogs] = useState<IntegracaoLogRecord[]>([])
  const [modalNovaIntegracaoOpen, setModalNovaIntegracaoOpen] = useState(false)
  const [modalLogsOpen, setModalLogsOpen] = useState(false)
  const [integracaoSelecionadaLogs, setIntegracaoSelecionadaLogs] =
    useState<IntegracaoBancariaRecord | null>(null)
  const [executandoIntegracaoId, setExecutandoIntegracaoId] = useState<string | null>(null)

  // Form Nova Integração
  const [intEmpresaId, setIntEmpresaId] = useState<string>('')
  const [intContaId, setIntContaId] = useState<string>('')
  const [intModo, setIntModo] = useState<IntegracaoModo>('automatico')
  const [intFrequencia, setIntFrequencia] = useState<IntegracaoFrequencia>('diaria')
  const [intFonteTipo, setIntFonteTipo] = useState<IntegracaoFonteTipo>('email')
  const [intFonteIdentificador, setIntFonteIdentificador] = useState<string>('')
  const [intObservacoes, setIntObservacoes] = useState<string>('')
  const [salvandoIntegracao, setSalvandoIntegracao] = useState(false)

  // Permissão de escrita (Admin, Contador, Auxiliar)
  const canWrite = hasPermission(['administrador', 'contador', 'auxiliar'])

  // Carregar dados
  const loadData = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const [empList, cbList, titList, extList, pcList, intList, logsList] = await Promise.all([
        empresasService.list(tenant.id),
        financeiroService.listContasBancarias(
          tenant.id,
          selectedEmpresaId === 'all' ? undefined : selectedEmpresaId,
        ),
        financeiroService.listTitulos(tenant.id, {
          empresaId: selectedEmpresaId,
          tipo: tipoAtivo,
          status: statusFiltro,
          periodoInicio: periodoInicio || undefined,
          periodoFim: periodoFim || undefined,
          busca: busca || undefined,
        }),
        financeiroService.listExtratos(
          tenant.id,
          undefined,
          selectedEmpresaId === 'all' ? undefined : selectedEmpresaId,
        ),
        contabilService.getPlanoContas(tenant.id),
        financeiroService.listIntegracoes(
          tenant.id,
          selectedEmpresaId === 'all' ? undefined : selectedEmpresaId,
        ),
        financeiroService.listIntegracaoLogs(tenant.id),
      ])

      setEmpresas(empList)
      setContasBancarias(cbList)
      setTitulos(titList)
      setExtratos(extList)
      setPlanoContas(pcList)
      setIntegracoes(intList)
      setIntegracaoLogs(logsList)

      if (!novoEmpresaId && empList.length > 0) {
        setNovoEmpresaId(empList[0].id)
        setCbEmpresaId(empList[0].id)
        setExtratoEmpresaId(empList[0].id)
        setIntEmpresaId(empList[0].id)
      }
      if (!intContaId && cbList.length > 0) {
        setIntContaId(cbList[0].id)
      }
    } catch (err) {
      console.error('Erro ao carregar dados financeiros:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar módulo financeiro',
        description: 'Verifique sua conexão ou tente novamente.',
      })
    } finally {
      setLoading(false)
    }
  }, [
    tenant?.id,
    selectedEmpresaId,
    tipoAtivo,
    statusFiltro,
    periodoInicio,
    periodoFim,
    busca,
    novoEmpresaId,
    toast,
  ])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Totalizadores
  const totalizadores = useMemo(() => {
    let pendente = 0
    let pago = 0
    let atrasado = 0
    const now = new Date()

    titulos.forEach((t) => {
      const v = t.valor || 0
      if (t.status === 'pago') {
        pago += v
      } else if (t.status === 'cancelado') {
        // Ignora cancelado no saldo de pagamento
      } else {
        // Checar se está atrasado pela data de vencimento
        const venc = new Date(t.data_vencimento)
        if (t.status === 'atrasado' || venc < now) {
          atrasado += v
        } else {
          pendente += v
        }
      }
    })

    return { pendente, pago, atrasado, totalGeral: pendente + pago + atrasado }
  }, [titulos])

  // Salvar Novo Título
  const handleSalvarTitulo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (
      !tenant?.id ||
      !novoEmpresaId ||
      !novoPessoa.trim() ||
      !novoDescricao.trim() ||
      !novoValor
    ) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Preencha a empresa, favorecido/cliente, descrição e valor.',
      })
      return
    }

    setSalvandoTitulo(true)
    try {
      const valorNum = parseFloat(novoValor.replace(',', '.'))
      await financeiroService.createTitulo({
        tenant_id: tenant.id,
        empresa: novoEmpresaId,
        tipo: novoTipo,
        pessoa: novoPessoa.trim(),
        descricao: novoDescricao.trim(),
        documento_ref: novoDocRef.trim() || undefined,
        categoria: novoCategoriaId || undefined,
        valor: valorNum,
        data_emissao: novoEmissao,
        data_vencimento: novoVencimento,
        status: 'pendente',
        observacoes: novoObservacoes.trim() || undefined,
      })

      toast({
        title: 'Título financeiro cadastrado!',
        description: `Título a ${novoTipo} inserido com sucesso.`,
      })

      setModalNovoTituloOpen(false)
      setNovoPessoa('')
      setNovoDescricao('')
      setNovoDocRef('')
      setNovoValor('')
      setNovoObservacoes('')
      loadData()
    } catch (err) {
      console.error('Erro ao criar título:', err)
      toast({
        variant: 'destructive',
        title: 'Falha ao salvar título',
        description: 'Ocorreu um erro ao registrar o lançamento financeiro.',
      })
    } finally {
      setSalvandoTitulo(false)
    }
  }

  // Abrir Baixa de Título
  const handleAbrirBaixa = (t: ContaFinanceiraRecord) => {
    setTituloParaBaixa(t)
    setBaixaData(new Date().toISOString().split('T')[0])
    // Buscar conta bancária sugerida para a empresa do título
    const cb = contasBancarias.find((c) => c.empresa === t.empresa)
    setBaixaContaBancariaId(cb?.id || contasBancarias[0]?.id || '')
    setModalBaixaOpen(true)
  }

  // Confirmar Baixa
  const handleConfirmarBaixa = async () => {
    if (!tituloParaBaixa) return
    setSalvandoBaixa(true)
    try {
      await financeiroService.baixarTitulo({
        tituloId: tituloParaBaixa.id,
        dataPagamento: baixaData,
        contaBancariaId: baixaContaBancariaId || undefined,
        gerarLancamentoContabil: baixaGerarContabil,
        usuarioId: user?.id,
      })

      toast({
        title: 'Baixa efetuada com sucesso!',
        description: baixaGerarContabil
          ? 'Título liquidado e partidas dobradas geradas na contabilidade.'
          : 'Título liquidado no financeiro.',
      })

      setModalBaixaOpen(false)
      setTituloParaBaixa(null)
      loadData()
    } catch (err: unknown) {
      console.error('Erro na baixa do título:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao realizar baixa do título.'
      toast({
        variant: 'destructive',
        title: 'Erro na baixa',
        description: msg,
      })
    } finally {
      setSalvandoBaixa(false)
    }
  }

  // Salvar Nova Conta Bancária
  const handleSalvarContaBancaria = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant?.id || !cbEmpresaId || !cbBanco.trim() || !cbAgencia.trim() || !cbConta.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Informe o banco, agência, número da conta e empresa.',
      })
      return
    }

    setSalvandoContaBancaria(true)
    try {
      const saldo = parseFloat(cbSaldoInicial.replace(',', '.')) || 0
      await financeiroService.createContaBancaria({
        tenant_id: tenant.id,
        empresa: cbEmpresaId,
        banco: cbBanco.trim(),
        agencia: cbAgencia.trim(),
        conta: cbConta.trim(),
        saldo_inicial: saldo,
        saldo_atual: saldo,
        ativa: true,
        conta_contabil: cbContaContabilId || undefined,
      })

      toast({
        title: 'Conta bancária cadastrada!',
        description: 'A conta já está disponível para baixas e conciliação.',
      })

      setModalContaBancariaOpen(false)
      setCbBanco('')
      setCbAgencia('')
      setCbConta('')
      setCbSaldoInicial('0')
      loadData()
    } catch (err) {
      console.error('Erro ao criar conta bancária:', err)
      toast({
        variant: 'destructive',
        title: 'Erro no cadastro',
        description: 'Não foi possível cadastrar a conta bancária.',
      })
    } finally {
      setSalvandoContaBancaria(false)
    }
  }

  // Parse Simples de CSV / OFX de Extrato
  const handleProcessarCsv = (text: string) => {
    setCsvContent(text)
    if (!text.trim()) {
      setPreviewExtrato([])
      return
    }

    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
    const parsed: {
      data: string
      descricao: string
      documento_numero?: string
      valor: number
      tipo_transacao: 'credito' | 'debito'
    }[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Pular cabeçalho se contiver "data" ou "descricao"
      if (i === 0 && (line.toLowerCase().includes('data') || line.toLowerCase().includes('date'))) {
        continue
      }

      // Separador por ponto e vírgula ou vírgula
      const parts = line.includes(';') ? line.split(';') : line.split(',')
      if (parts.length >= 3) {
        const rawDate = parts[0]?.trim() || ''
        const rawDesc = parts[1]?.trim() || ''
        const rawValor = parts[2]?.trim() || '0'
        const rawDoc = parts[3]?.trim() || ''

        // Normalizar data (DD/MM/AAAA ou AAAA-MM-DD)
        let isoDate = ''
        if (rawDate.includes('/')) {
          const [d, m, y] = rawDate.split('/')
          if (d && m && y) {
            isoDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
          }
        } else if (rawDate.includes('-')) {
          isoDate = rawDate
        }

        const numValor = parseFloat(rawValor.replace(/[R$\s]/g, '').replace(',', '.'))
        if (!isNaN(numValor) && isoDate) {
          parsed.push({
            data: `${isoDate} 12:00:00.000Z`,
            descricao: rawDesc || 'Transação Extrato',
            documento_numero: rawDoc || undefined,
            valor: numValor,
            tipo_transacao: numValor < 0 ? 'debito' : 'credito',
          })
        }
      }
    }

    setPreviewExtrato(parsed)
  }

  // Importar Extrato
  const handleImportarExtrato = async () => {
    if (
      !tenant?.id ||
      !extratoEmpresaId ||
      !extratoContaBancariaId ||
      previewExtrato.length === 0
    ) {
      toast({
        variant: 'destructive',
        title: 'Dados incompletos',
        description: 'Selecione a empresa, conta bancária e informe linhas válidas de extrato.',
      })
      return
    }

    setImportandoExtrato(true)
    try {
      const count = await financeiroService.importExtratoLote(
        tenant.id,
        extratoEmpresaId,
        extratoContaBancariaId,
        previewExtrato,
      )

      toast({
        title: 'Extrato importado!',
        description: `${count} lançamento(s) importado(s) para conciliação.`,
      })

      setModalImportarExtratoOpen(false)
      setCsvContent('')
      setPreviewExtrato([])
      loadData()
    } catch (err) {
      console.error('Erro ao importar extrato:', err)
      toast({
        variant: 'destructive',
        title: 'Falha na importação',
        description: 'Não foi possível salvar os registros de extrato.',
      })
    } finally {
      setImportandoExtrato(false)
    }
  }

  // Abrir Conciliação de Linha de Extrato
  const handleAbrirConciliarLinha = (ex: ExtratoBancarioRecord) => {
    setExtratoSelecionado(ex)
    // Tentar sugerir match automático por valor aproximado + tipo
    const valorAbs = Math.abs(ex.valor)
    const match = titulos.find((t) => {
      const condTipo = ex.tipo_transacao === 'debito' ? t.tipo === 'pagar' : t.tipo === 'receber'
      const condValor = Math.abs(t.valor - valorAbs) < 0.05
      const condStatus = t.status !== 'cancelado'
      return condTipo && condValor && condStatus
    })

    setTituloSelecionadoId(match?.id || '')
    setConcilCategoriaAvulsaId('')
    setConcilGerarContabil(true)
    setModalConciliarLinhaOpen(true)
  }

  // Confirmar Conciliação
  const handleConfirmarConciliacao = async () => {
    if (!extratoSelecionado) return
    setSalvandoConciliacao(true)
    try {
      await financeiroService.conciliarExtrato(
        extratoSelecionado.id,
        tituloSelecionadoId || undefined,
        {
          gerarLancamentoContabil: concilGerarContabil,
          categoriaId: concilCategoriaAvulsaId || undefined,
          usuarioId: user?.id,
        },
      )

      toast({
        title: 'Conciliação realizada!',
        description: 'Extrato bancário conciliado com sucesso.',
      })

      setModalConciliarLinhaOpen(false)
      setExtratoSelecionado(null)
      loadData()
    } catch (err: unknown) {
      console.error('Erro ao conciliar extrato:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao conciliar lançamento bancário.'
      toast({
        variant: 'destructive',
        title: 'Erro na conciliação',
        description: msg,
      })
    } finally {
      setSalvandoConciliacao(false)
    }
  }

  // Desconciliar
  const handleDesconciliar = async (id: string) => {
    try {
      await financeiroService.desconciliarExtrato(id)
      toast({
        title: 'Conciliação desfeita',
        description: 'A linha do extrato retornou para o status pendente.',
      })
      loadData()
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível desfazer a conciliação.',
      })
    }
  }

  // Criar Nova Configuração de Integração Bancária
  const handleSalvarIntegracao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant?.id || !intEmpresaId || !intContaId || !intFonteIdentificador.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description:
          'Preencha empresa, conta bancária e o identificador da fonte (e-mail, SFTP ou pasta).',
      })
      return
    }

    setSalvandoIntegracao(true)
    try {
      await financeiroService.createIntegracao({
        tenant_id: tenant.id,
        empresa: intEmpresaId,
        conta_bancaria: intContaId,
        modo: intModo,
        frequencia: intFrequencia,
        fonte_tipo: intFonteTipo,
        fonte_identificador: intFonteIdentificador.trim(),
        status: 'ativo',
        observacoes: intObservacoes.trim() || undefined,
      })

      toast({
        title: 'Integração bancária configurada!',
        description: `Importação em modo ${intModo} cadastrada com sucesso.`,
      })

      setModalNovaIntegracaoOpen(false)
      setIntFonteIdentificador('')
      setIntObservacoes('')
      loadData()
    } catch (err) {
      console.error('Erro ao configurar integração:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar integração',
        description: 'Não foi possível registrar a configuração.',
      })
    } finally {
      setSalvandoIntegracao(false)
    }
  }

  // Disparar "Importar Agora" para a integração bancária
  const handleImportarAgoraIntegracao = async (integ: IntegracaoBancariaRecord) => {
    setExecutandoIntegracaoId(integ.id)
    try {
      const res = await financeiroService.executarImportacaoIntegracao(integ.id, user?.id)
      toast({
        title: 'Importação e Conciliação Executadas!',
        description: `${res.inseridos} novas linhas de extrato importadas, ${res.duplicados} duplicadas ignoradas e ${res.conciliados} conciliadas automaticamente.`,
      })
      loadData()
    } catch (err) {
      console.error('Erro ao executar importação sob demanda:', err)
      toast({
        variant: 'destructive',
        title: 'Falha na importação',
        description: 'Ocorreu um erro ao importar e conciliar os dados da fonte configurada.',
      })
    } finally {
      setExecutandoIntegracaoId(null)
    }
  }

  // Alternar Status da Integração (Ativar / Pausar)
  const handleToggleStatusIntegracao = async (integ: IntegracaoBancariaRecord) => {
    const novoStatus: IntegracaoStatus = integ.status === 'ativo' ? 'pausado' : 'ativo'
    try {
      await financeiroService.updateIntegracao(integ.id, { status: novoStatus })
      toast({
        title: `Integração ${novoStatus === 'ativo' ? 'ativada' : 'pausada'}`,
      })
      loadData()
    } catch (err) {
      console.error('Erro ao alterar status da integração:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao alterar status',
      })
    }
  }

  // Abrir Histórico de Logs da Integração
  const handleAbrirLogs = (integ: IntegracaoBancariaRecord) => {
    setIntegracaoSelecionadaLogs(integ)
    setModalLogsOpen(true)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header com Seletor de Empresa e Botões de Ação */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#E2E8F0] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-[#0FA3A3]">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#1A2333]">
                Financeiro & Conciliação
              </h1>
              <p className="text-xs text-[#64748B]">
                Controle de contas a pagar, receber, tesouraria e conciliação bancária automatizada
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor Global de Empresa */}
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#94A3B8]" />
            <Select value={selectedEmpresaId} onValueChange={setSelectedEmpresaId}>
              <SelectTrigger className="h-9 w-48 text-xs rounded-xl bg-white border-[#E2E8F0]">
                <SelectValue placeholder="Todas as empresas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome_fantasia || e.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {canWrite && (
            <>
              <Button
                onClick={() => setModalContaBancariaOpen(true)}
                variant="outline"
                size="sm"
                className="h-9 text-xs rounded-xl border-[#E2E8F0] gap-1.5"
              >
                <Building2 className="h-3.5 w-3.5 text-[#0FA3A3]" />
                <span>Nova Conta</span>
              </Button>

              <Button
                onClick={() => {
                  setNovoTipo(tipoAtivo)
                  setModalNovoTituloOpen(true)
                }}
                size="sm"
                className="h-9 text-xs rounded-xl bg-[#0FA3A3] text-white hover:bg-[#0C8585] gap-1.5 shadow-xs"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Novo Título</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Cards Totalizadores de Saldo */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-[#64748B]">Total Pendente</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-[#1A2333]">
              R$ {totalizadores.pendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="mt-1 text-[11px] text-[#64748B]">Títulos a vencer no prazo</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-[#64748B]">Total Vencido / Atrasado</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-red-600">
              R$ {totalizadores.atrasado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="mt-1 text-[11px] text-red-500 font-medium">Requer atenção imediata</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-[#64748B]">Total Liquidado / Pago</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-emerald-600">
              R$ {totalizadores.pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="mt-1 text-[11px] text-emerald-600">Baixados com conciliação</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs bg-slate-900 text-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-slate-400">Contas Bancárias Ativas</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-teal-300">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-white">
              {contasBancarias.length} conta{contasBancarias.length !== 1 ? 's' : ''}
            </div>
            <p className="mt-1 text-[11px] text-teal-300 font-medium truncate">
              {contasBancarias[0]
                ? `${contasBancarias[0].banco} (Ag. ${contasBancarias[0].agencia})`
                : 'Nenhuma conta cadastrada'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Abas Principais: Contas a Pagar, Contas a Receber, Conciliação Bancária, Contas Bancárias */}
      <Tabs
        defaultValue="pagar"
        onValueChange={(val) => {
          if (val === 'pagar' || val === 'receber') {
            setTipoAtivo(val)
          }
        }}
        className="w-full"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E2E8F0] pb-2">
          <TabsList className="bg-slate-100 p-1 rounded-xl h-10">
            <TabsTrigger value="pagar" className="gap-2 text-xs font-semibold rounded-lg">
              <ArrowUpRight className="h-3.5 w-3.5 text-red-500" />
              <span>Contas a Pagar</span>
            </TabsTrigger>
            <TabsTrigger value="receber" className="gap-2 text-xs font-semibold rounded-lg">
              <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500" />
              <span>Contas a Receber</span>
            </TabsTrigger>
            <TabsTrigger value="conciliacao" className="gap-2 text-xs font-semibold rounded-lg">
              <FileCheck2 className="h-3.5 w-3.5 text-[#0FA3A3]" />
              <span>Conciliação Bancária ({extratos.length})</span>
            </TabsTrigger>
            <TabsTrigger value="bancos" className="gap-2 text-xs font-semibold rounded-lg">
              <Building2 className="h-3.5 w-3.5 text-blue-500" />
              <span>Contas Bancárias ({contasBancarias.length})</span>
            </TabsTrigger>
            <TabsTrigger value="integracoes" className="gap-2 text-xs font-semibold rounded-lg">
              <RefreshCw className="h-3.5 w-3.5 text-indigo-500" />
              <span>Integrações Bancárias</span>
            </TabsTrigger>
          </TabsList>

          <Button
            onClick={() => loadData()}
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-[#64748B] hover:text-[#1A2333]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Atualizar</span>
          </Button>
        </div>

        {/* ABA: CONTAS A PAGAR & CONTAS A RECEBER (TELA COMPARTILHADA COM FILTRO DE TIPO) */}
        {(['pagar', 'receber'] as const).map((abaTipo) => (
          <TabsContent key={abaTipo} value={abaTipo} className="space-y-4 mt-4">
            {/* Barra de Filtros */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-[#E2E8F0] shadow-2xs">
              <div className="flex flex-1 flex-wrap items-center gap-2.5">
                <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8]" />
                  <Input
                    placeholder={`Buscar por ${abaTipo === 'pagar' ? 'fornecedor' : 'cliente'} ou descrição...`}
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="h-8 pl-9 text-xs rounded-xl border-[#E2E8F0]"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-[#64748B] whitespace-nowrap">Status:</Label>
                  <Select
                    value={statusFiltro}
                    onValueChange={(v) => setStatusFiltro(v as ContaFinanceiraStatus | 'todos')}
                  >
                    <SelectTrigger className="h-8 w-32 text-xs rounded-xl border-[#E2E8F0]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="atrasado">Atrasado</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-[#64748B] whitespace-nowrap">De:</Label>
                  <Input
                    type="date"
                    value={periodoInicio}
                    onChange={(e) => setPeriodoInicio(e.target.value)}
                    className="h-8 w-32 text-xs rounded-xl border-[#E2E8F0]"
                  />
                  <Label className="text-xs text-[#64748B] whitespace-nowrap">Até:</Label>
                  <Input
                    type="date"
                    value={periodoFim}
                    onChange={(e) => setPeriodoFim(e.target.value)}
                    className="h-8 w-32 text-xs rounded-xl border-[#E2E8F0]"
                  />
                </div>
              </div>

              {(busca || statusFiltro !== 'todos' || periodoInicio || periodoFim) && (
                <Button
                  onClick={() => {
                    setBusca('')
                    setStatusFiltro('todos')
                    setPeriodoInicio('')
                    setPeriodoFim('')
                  }}
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-[#EF4444]"
                >
                  Limpar filtros
                </Button>
              )}
            </div>

            {/* Tabela de Títulos */}
            <div className="rounded-3xl border border-[#E2E8F0] bg-white shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] text-[#64748B] font-semibold border-b border-[#E2E8F0]">
                    <tr>
                      <th className="py-3.5 px-4">
                        {abaTipo === 'pagar' ? 'Fornecedor' : 'Cliente'}
                      </th>
                      <th className="py-3.5 px-4">Descrição / NF</th>
                      <th className="py-3.5 px-4">Empresa</th>
                      <th className="py-3.5 px-4">Categoria Contábil</th>
                      <th className="py-3.5 px-4">Vencimento</th>
                      <th className="py-3.5 px-4">Valor</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[#1A2333]">
                    {titulos.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-[#94A3B8]">
                          Nenhum título financeiro encontrado para os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      titulos.map((t) => {
                        const venc = new Date(t.data_vencimento)
                        const now = new Date()
                        const diffDias = Math.ceil(
                          (venc.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
                        )
                        const isVencido =
                          t.status === 'atrasado' || (t.status === 'pendente' && diffDias < 0)
                        const isProximo = t.status === 'pendente' && diffDias >= 0 && diffDias <= 3

                        return (
                          <tr
                            key={t.id}
                            className={cn(
                              'hover:bg-slate-50/70 transition-colors',
                              isVencido && 'bg-rose-50/20',
                              isProximo && 'bg-amber-50/20',
                            )}
                          >
                            <td className="py-3.5 px-4 font-bold text-[#1A2333]">
                              <div className="flex flex-col">
                                <span>{t.pessoa}</span>
                                {t.documento_ref && (
                                  <span className="text-[10px] text-[#64748B]">
                                    Ref: {t.documento_ref}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 max-w-xs truncate">{t.descricao}</td>
                            <td className="py-3.5 px-4 font-medium text-[#475569]">
                              {t.expand?.empresa?.nome_fantasia ||
                                t.expand?.empresa?.razao_social ||
                                'Empresa'}
                            </td>
                            <td className="py-3.5 px-4 text-[#64748B]">
                              {t.expand?.categoria ? (
                                <span className="font-mono text-[11px]">
                                  {t.expand.categoria.codigo} - {t.expand.categoria.nome}
                                </span>
                              ) : (
                                <span className="text-[#94A3B8] italic">Não categorizado</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex flex-col">
                                <span className={cn(isVencido && 'text-red-600 font-bold')}>
                                  {formatDatePtBr(t.data_vencimento)}
                                </span>
                                {isVencido && (
                                  <span className="text-[10px] text-red-500 font-semibold">
                                    Vencido ({Math.abs(diffDias)}d)
                                  </span>
                                )}
                                {isProximo && (
                                  <span className="text-[10px] text-amber-600 font-semibold">
                                    Vence em {diffDias === 0 ? 'Hoje' : `${diffDias}d`}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-[#1A2333]">
                              R$ {t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3.5 px-4">
                              {t.status === 'pago' ? (
                                <Badge className="bg-[#DCFCE7] text-[#16A34A] border-emerald-200">
                                  Liquidado
                                </Badge>
                              ) : isVencido ? (
                                <Badge className="bg-[#FEE2E2] text-[#DC2626] border-rose-200">
                                  Atrasado
                                </Badge>
                              ) : t.status === 'cancelado' ? (
                                <Badge variant="outline" className="text-slate-400">
                                  Cancelado
                                </Badge>
                              ) : (
                                <Badge className="bg-[#FEF3C7] text-[#D97706] border-amber-200">
                                  Pendente
                                </Badge>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {t.status !== 'pago' && t.status !== 'cancelado' && canWrite && (
                                  <Button
                                    onClick={() => handleAbrirBaixa(t)}
                                    size="sm"
                                    className="h-7 text-[11px] rounded-lg bg-teal-600 hover:bg-teal-700 text-white gap-1 px-2.5"
                                  >
                                    <Check className="h-3 w-3" />
                                    <span>Baixar</span>
                                  </Button>
                                )}
                                {t.lote_contabil_id && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] text-[#0FA3A3] border-teal-200"
                                    title={`Lote contábil gerado: ${t.lote_contabil_id}`}
                                  >
                                    Contabilizado
                                  </Badge>
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
          </TabsContent>
        ))}

        {/* ABA: CONCILIAÇÃO BANCÁRIA */}
        <TabsContent value="conciliacao" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-2xs">
            <div>
              <h3 className="text-sm font-bold text-[#1A2333]">
                Importação e Conferência de Extrato
              </h3>
              <p className="text-xs text-[#64748B]">
                Importe extratos CSV ou OFX do banco e faça o batimento automático contra títulos a
                pagar e receber.
              </p>
            </div>
            {canWrite && (
              <Button
                onClick={() => setModalImportarExtratoOpen(true)}
                size="sm"
                className="h-9 text-xs rounded-xl bg-[#0FA3A3] text-white hover:bg-[#0C8585] gap-1.5"
              >
                <Upload className="h-4 w-4" />
                <span>Importar Extrato CSV/OFX</span>
              </Button>
            )}
          </div>

          <div className="rounded-3xl border border-[#E2E8F0] bg-white shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[#64748B] font-semibold border-b border-[#E2E8F0]">
                  <tr>
                    <th className="py-3.5 px-4">Data Extrato</th>
                    <th className="py-3.5 px-4">Conta Bancária</th>
                    <th className="py-3.5 px-4">Histórico / Transação</th>
                    <th className="py-3.5 px-4">Documento</th>
                    <th className="py-3.5 px-4">Valor Movimento</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Título Vinculado</th>
                    <th className="py-3.5 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[#1A2333]">
                  {extratos.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[#94A3B8]">
                        Nenhuma linha de extrato importada ainda. Clique em &quot;Importar
                        Extrato&quot; para iniciar.
                      </td>
                    </tr>
                  ) : (
                    extratos.map((ex) => {
                      const isConciliado = ex.status === 'conciliado'
                      const isDebito = ex.tipo_transacao === 'debito'

                      return (
                        <tr key={ex.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 text-[#64748B]">{formatDatePtBr(ex.data)}</td>
                          <td className="py-3.5 px-4 font-semibold text-[#1A2333]">
                            {ex.expand?.conta_bancaria?.banco || 'Conta Bancária'}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-[#1A2333] max-w-xs truncate">
                            {ex.descricao}
                          </td>
                          <td className="py-3.5 px-4 text-[#64748B]">
                            {ex.documento_numero || '—'}
                          </td>
                          <td
                            className={cn(
                              'py-3.5 px-4 font-mono font-bold',
                              isDebito ? 'text-red-600' : 'text-emerald-600',
                            )}
                          >
                            {isDebito ? '- ' : '+ '}
                            R${' '}
                            {Math.abs(ex.valor).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="py-3.5 px-4">
                            {isConciliado ? (
                              <Badge className="bg-[#DCFCE7] text-[#16A34A] border-emerald-200 gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Conciliado</span>
                              </Badge>
                            ) : (
                              <Badge className="bg-[#FEF3C7] text-[#D97706] border-amber-200">
                                Pendente Match
                              </Badge>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-[#64748B]">
                            {ex.expand?.titulo_conciliado ? (
                              <div className="flex flex-col text-[11px]">
                                <span className="font-semibold text-[#1A2333]">
                                  {ex.expand.titulo_conciliado.pessoa}
                                </span>
                                <span>{ex.expand.titulo_conciliado.descricao}</span>
                              </div>
                            ) : (
                              <span className="text-[#94A3B8] italic">Avulso / Sem match</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {canWrite && (
                              <>
                                {!isConciliado ? (
                                  <Button
                                    onClick={() => handleAbrirConciliarLinha(ex)}
                                    size="sm"
                                    className="h-7 text-[11px] rounded-lg bg-[#0FA3A3] hover:bg-[#0C8585] text-white gap-1 px-2.5"
                                  >
                                    <Link2 className="h-3 w-3" />
                                    <span>Conciliar</span>
                                  </Button>
                                ) : (
                                  <Button
                                    onClick={() => handleDesconciliar(ex.id)}
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-[10px] rounded-lg text-slate-500 hover:text-red-600 px-2"
                                  >
                                    Desfazer
                                  </Button>
                                )}
                              </>
                            )}
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

        {/* ABA: CONTAS BANCÁRIAS */}
        <TabsContent value="bancos" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contasBancarias.length === 0 ? (
              <div className="col-span-full py-12 text-center text-[#94A3B8] bg-white rounded-3xl border border-[#E2E8F0]">
                Nenhuma conta bancária cadastrada. Clique em &quot;Nova Conta&quot; para iniciar.
              </div>
            ) : (
              contasBancarias.map((cb) => (
                <Card key={cb.id} className="rounded-2xl border-[#E2E8F0] shadow-xs">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-[#0FA3A3]">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold text-[#1A2333]">
                          {cb.banco}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {cb.expand?.empresa?.nome_fantasia || cb.expand?.empresa?.razao_social}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant={cb.ativa ? 'default' : 'outline'} className="text-[10px]">
                      {cb.ativa ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-2 text-xs">
                    <div className="grid grid-cols-2 gap-2 text-[#64748B]">
                      <div>
                        <span className="block text-[10px] uppercase font-semibold text-[#94A3B8]">
                          Agência
                        </span>
                        <span className="font-semibold text-[#1A2333]">{cb.agencia}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-semibold text-[#94A3B8]">
                          Conta Corrente
                        </span>
                        <span className="font-semibold text-[#1A2333]">{cb.conta}</span>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-2 flex items-center justify-between">
                      <span className="text-[#64748B]">Saldo Atual:</span>
                      <span className="text-base font-mono font-bold text-teal-700">
                        R${' '}
                        {(cb.saldo_atual || cb.saldo_inicial).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>

                    {cb.expand?.conta_contabil && (
                      <p className="text-[10px] text-[#64748B] truncate">
                        Conta contábil vinculada:{' '}
                        <span className="font-mono font-bold">
                          {cb.expand.conta_contabil.codigo} - {cb.expand.conta_contabil.nome}
                        </span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* ABA: INTEGRAÇÕES BANCÁRIAS (IMPORTAÇÃO AUTOMÁTICA & AGENDADA) */}
        <TabsContent value="integracoes" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-2xs">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#1A2333]">
                  Integrações Bancárias & Importação Automática de Extratos
                </h3>
                <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">
                  Job Agendado (cronAdd)
                </Badge>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                Configure canais automatizados de extrato (caixas postais de e-mail, diretórios SFTP
                ou rotinas agendadas) para processamento contínuo sem digitação manual.
              </p>
              <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 rounded-lg p-2 border border-amber-200">
                <strong>Nota de Conformidade:</strong> A conexão direta via Open Finance requer
                credenciais externas e certificado ICP-Brasil regulamentado pelo BACEN. A plataforma
                fornece a esteira de importação agendada e conciliação automática com gatilhos
                configuráveis por conta bancária.
              </div>
            </div>

            {canWrite && (
              <Button
                onClick={() => setModalNovaIntegracaoOpen(true)}
                size="sm"
                className="h-9 text-xs rounded-xl bg-[#0FA3A3] text-white hover:bg-[#0C8585] gap-1.5 shrink-0"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Nova Integração</span>
              </Button>
            )}
          </div>

          {/* Cards de Integrações Configuradas por Conta */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {integracoes.length === 0 ? (
              <div className="col-span-full py-12 text-center text-[#94A3B8] bg-white rounded-3xl border border-[#E2E8F0]">
                Nenhuma integração bancária configurada ainda. Clique em &quot;Nova Integração&quot;
                para configurar fontes de extratos automáticos.
              </div>
            ) : (
              integracoes.map((integ) => {
                const isExecuting = executandoIntegracaoId === integ.id

                return (
                  <Card key={integ.id} className="rounded-2xl border-[#E2E8F0] shadow-xs bg-white">
                    <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-bold text-[#1A2333]">
                            {integ.expand?.conta_bancaria?.banco || 'Conta Bancária'}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {integ.expand?.empresa?.nome_fantasia ||
                              integ.expand?.empresa?.razao_social ||
                              'Empresa'}
                          </CardDescription>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          className={cn(
                            'text-[10px] font-semibold',
                            integ.status === 'ativo'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : integ.status === 'pausado'
                                ? 'bg-amber-100 text-amber-800 border-amber-200'
                                : 'bg-red-100 text-red-800 border-red-200',
                          )}
                        >
                          {integ.status.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">
                          {integ.modo}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3 pt-3 text-xs">
                      <div className="grid grid-cols-2 gap-2 text-[#64748B]">
                        <div>
                          <span className="block text-[10px] uppercase font-semibold text-[#94A3B8]">
                            Fonte de Entrada
                          </span>
                          <span className="font-medium text-[#1A2333] capitalize">
                            {integ.fonte_tipo.replace('_', ' ')}
                          </span>
                          <span className="block text-[11px] text-[#475569] font-mono truncate">
                            {integ.fonte_identificador}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase font-semibold text-[#94A3B8]">
                            Frequência da Rotina
                          </span>
                          <span className="font-medium text-[#1A2333] capitalize">
                            {integ.frequencia} (06:30 UTC)
                          </span>
                          <span className="block text-[11px] text-[#475569]">
                            {integ.proxima_execucao
                              ? `Próxima: ${formatDatePtBr(integ.proxima_execucao)}`
                              : 'Agendada no cron'}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100 grid grid-cols-3 text-center">
                        <div>
                          <span className="block text-[10px] text-[#64748B]">Última Execução</span>
                          <span className="font-semibold text-[#1A2333] text-[11px]">
                            {integ.ultima_execucao
                              ? formatDatePtBr(integ.ultima_execucao)
                              : 'Nunca'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-[#64748B]">
                            Linhas Importadas
                          </span>
                          <span className="font-bold text-teal-700 text-xs">
                            {integ.total_importados || 0}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-[#64748B]">Conciliadas Auto</span>
                          <span className="font-bold text-emerald-600 text-xs">
                            {integ.total_conciliados || 0}
                          </span>
                        </div>
                      </div>

                      {integ.observacoes && (
                        <p className="text-[11px] text-[#64748B] italic">
                          &quot;{integ.observacoes}&quot;
                        </p>
                      )}

                      <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAbrirLogs(integ)}
                          className="h-8 text-xs text-[#64748B] hover:text-[#1A2333] gap-1"
                        >
                          <Clock className="h-3.5 w-3.5" />
                          <span>Histórico de Logs</span>
                        </Button>

                        <div className="flex items-center gap-1.5">
                          {canWrite && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleStatusIntegracao(integ)}
                              className="h-8 text-xs rounded-xl"
                            >
                              {integ.status === 'ativo' ? 'Pausar' : 'Ativar'}
                            </Button>
                          )}

                          {canWrite && (
                            <Button
                              size="sm"
                              disabled={isExecuting}
                              onClick={() => handleImportarAgoraIntegracao(integ)}
                              className="h-8 text-xs rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-xs"
                            >
                              <RefreshCw
                                className={cn('h-3.5 w-3.5', isExecuting && 'animate-spin')}
                              />
                              <span>{isExecuting ? 'Importando...' : 'Importar Agora'}</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* MODAL: NOVO TÍTULO A PAGAR / RECEBER */}
      <Dialog open={modalNovoTituloOpen} onOpenChange={setModalNovoTituloOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333]">
              Cadastrar Título a {novoTipo === 'pagar' ? 'Pagar' : 'Receber'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Informe os dados da fatura, boleto ou recibo para acompanhamento.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarTitulo} className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Tipo</Label>
                <Select
                  value={novoTipo}
                  onValueChange={(v) => setNovoTipo(v as ContaFinanceiraTipo)}
                >
                  <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pagar">Contas a Pagar</SelectItem>
                    <SelectItem value="receber">Contas a Receber</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Empresa</Label>
                <Select value={novoEmpresaId} onValueChange={setNovoEmpresaId}>
                  <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                    <SelectValue placeholder="Selecione" />
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
            </div>

            <div>
              <Label className="text-xs font-semibold">
                {novoTipo === 'pagar' ? 'Fornecedor / Beneficiário' : 'Cliente / Pagador'} *
              </Label>
              <Input
                required
                value={novoPessoa}
                onChange={(e) => setNovoPessoa(e.target.value)}
                placeholder="Ex: Google Brasil, AWS, Cliente XPTO..."
                className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Descrição do Título *</Label>
                <Input
                  required
                  value={novoDescricao}
                  onChange={(e) => setNovoDescricao(e.target.value)}
                  placeholder="Ex: Licença mensal..."
                  className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Nº Documento / NF (opcional)</Label>
                <Input
                  value={novoDocRef}
                  onChange={(e) => setNovoDocRef(e.target.value)}
                  placeholder="Ex: NFSe-1049"
                  className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs font-semibold">Valor (R$) *</Label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={novoValor}
                  onChange={(e) => setNovoValor(e.target.value)}
                  placeholder="0,00"
                  className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Emissão *</Label>
                <Input
                  type="date"
                  required
                  value={novoEmissao}
                  onChange={(e) => setNovoEmissao(e.target.value)}
                  className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Vencimento *</Label>
                <Input
                  type="date"
                  required
                  value={novoVencimento}
                  onChange={(e) => setNovoVencimento(e.target.value)}
                  className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Categoria Contábil (Plano de Contas)</Label>
              <Select value={novoCategoriaId} onValueChange={setNovoCategoriaId}>
                <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                  <SelectValue placeholder="Selecione a contrapartida contábil" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {planoContas.map((pc) => (
                    <SelectItem key={pc.id} value={pc.id}>
                      {pc.codigo} - {pc.nome} ({pc.tipo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Observações</Label>
              <Textarea
                value={novoObservacoes}
                onChange={(e) => setNovoObservacoes(e.target.value)}
                placeholder="Detalhes adicionais..."
                className="h-16 rounded-xl border-[#E2E8F0] mt-1 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalNovoTituloOpen(false)}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={salvandoTitulo}
                className="rounded-xl bg-[#0FA3A3] text-white hover:bg-[#0C8585]"
              >
                {salvandoTitulo ? 'Salvando...' : 'Salvar Título'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: BAIXAR TÍTULO */}
      <Dialog open={modalBaixaOpen} onOpenChange={setModalBaixaOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333]">
              Confirmar Baixa de {tituloParaBaixa?.tipo === 'pagar' ? 'Pagamento' : 'Recebimento'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Informe a data de liquidação e a conta bancária utilizada.
            </DialogDescription>
          </DialogHeader>

          {tituloParaBaixa && (
            <div className="space-y-4 py-2 text-xs">
              <div className="rounded-xl bg-slate-50 p-3 border border-[#E2E8F0] space-y-1">
                <p className="font-bold text-[#1A2333] text-sm">{tituloParaBaixa.descricao}</p>
                <p className="text-[#64748B]">Favorecido: {tituloParaBaixa.pessoa}</p>
                <p className="text-sm font-mono font-bold text-[#0FA3A3]">
                  Valor: R${' '}
                  {tituloParaBaixa.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div>
                <Label className="text-xs font-semibold">Data da Liquidação / Pagamento</Label>
                <Input
                  type="date"
                  value={baixaData}
                  onChange={(e) => setBaixaData(e.target.value)}
                  className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Conta Bancária de Movimento</Label>
                <Select value={baixaContaBancariaId} onValueChange={setBaixaContaBancariaId}>
                  <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                    <SelectValue placeholder="Selecione a conta bancária" />
                  </SelectTrigger>
                  <SelectContent>
                    {contasBancarias.map((cb) => (
                      <SelectItem key={cb.id} value={cb.id}>
                        {cb.banco} (Ag. {cb.agencia} - Conta {cb.conta})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-start gap-2 pt-1">
                <Checkbox
                  id="chk-gerar-contabil"
                  checked={baixaGerarContabil}
                  onCheckedChange={(c) => setBaixaGerarContabil(Boolean(c))}
                />
                <label
                  htmlFor="chk-gerar-contabil"
                  className="text-xs font-medium text-[#1A2333] cursor-pointer"
                >
                  Gerar lançamento contábil automático em partidas dobradas
                  <span className="block text-[11px] text-[#64748B]">
                    (Respeita bloqueio server-side de competências fechadas)
                  </span>
                </label>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalBaixaOpen(false)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarBaixa}
              size="sm"
              disabled={salvandoBaixa}
              className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white"
            >
              {salvandoBaixa ? 'Processando baixa...' : 'Confirmar Baixa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: NOVA CONTA BANCÁRIA */}
      <Dialog open={modalContaBancariaOpen} onOpenChange={setModalContaBancariaOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333]">
              Cadastrar Conta Bancária
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cadastre a conta corrente da empresa para conciliação e baixa de títulos.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarContaBancaria} className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold">Empresa *</Label>
              <Select value={cbEmpresaId} onValueChange={setCbEmpresaId}>
                <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
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

            <div>
              <Label className="text-xs font-semibold">Banco / Instituição Financeira *</Label>
              <Input
                required
                value={cbBanco}
                onChange={(e) => setCbBanco(e.target.value)}
                placeholder="Ex: Itaú Unibanco (341), Bradesco (237)..."
                className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Agência *</Label>
                <Input
                  required
                  value={cbAgencia}
                  onChange={(e) => setCbAgencia(e.target.value)}
                  placeholder="Ex: 0922"
                  className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Conta Corrente *</Label>
                <Input
                  required
                  value={cbConta}
                  onChange={(e) => setCbConta(e.target.value)}
                  placeholder="Ex: 54321-0"
                  className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Saldo Inicial (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={cbSaldoInicial}
                  onChange={(e) => setCbSaldoInicial(e.target.value)}
                  placeholder="0,00"
                  className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Conta Contábil Vinculada</Label>
                <Select value={cbContaContabilId} onValueChange={setCbContaContabilId}>
                  <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                    <SelectValue placeholder="Ex: 1.1.1.02 Bancos" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {planoContas.map((pc) => (
                      <SelectItem key={pc.id} value={pc.id}>
                        {pc.codigo} - {pc.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalContaBancariaOpen(false)}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={salvandoContaBancaria}
                className="rounded-xl bg-[#0FA3A3] text-white hover:bg-[#0C8585]"
              >
                {salvandoContaBancaria ? 'Salvando...' : 'Cadastrar Conta'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: IMPORTAR EXTRATO CSV */}
      <Dialog open={modalImportarExtratoOpen} onOpenChange={setModalImportarExtratoOpen}>
        <DialogContent className="max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333]">
              Importar Extrato Bancário (CSV / OFX)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cole as linhas do extrato (Data; Descrição; Valor; Nº Doc opcional) ou envie o
              arquivo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Empresa *</Label>
                <Select value={extratoEmpresaId} onValueChange={setExtratoEmpresaId}>
                  <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                    <SelectValue placeholder="Selecione" />
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
              <div>
                <Label className="text-xs font-semibold">Conta Bancária Destino *</Label>
                <Select value={extratoContaBancariaId} onValueChange={setExtratoContaBancariaId}>
                  <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {contasBancarias.map((cb) => (
                      <SelectItem key={cb.id} value={cb.id}>
                        {cb.banco} (Ag. {cb.agencia} - {cb.conta})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">
                  Conteúdo CSV (Ponto e Vírgula ou Vírgula)
                </Label>
                <button
                  type="button"
                  onClick={() =>
                    handleProcessarCsv(
                      `Data;Descricao;Valor;Doc\n10/10/2026;TED RECEB CLIENTE XPTO;12500,00;DOC-102\n15/10/2026;PAGAMENTO ALUGUEL ESCRITORIO;-3500,00;DOC-103\n20/10/2026;TARIFA MANUTENCAO CONTA;-89,00;TAR-01`,
                    )
                  }
                  className="text-[11px] font-semibold text-[#0FA3A3] hover:underline"
                >
                  Carregar exemplo
                </button>
              </div>
              <Textarea
                value={csvContent}
                onChange={(e) => handleProcessarCsv(e.target.value)}
                placeholder="2026-10-10;TED RECEBIDO;5000.00;DOC01&#10;2026-10-12;PAGTO FORNECEDOR;-1200.00;DOC02"
                className="h-28 rounded-xl border-[#E2E8F0] mt-1 text-xs font-mono"
              />
            </div>

            {previewExtrato.length > 0 && (
              <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3">
                <p className="font-bold text-teal-900 text-xs mb-1.5 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-[#0FA3A3]" />
                  <span>Pré-visualização: {previewExtrato.length} lançamentos válidos</span>
                </p>
                <div className="max-h-32 overflow-y-auto divide-y divide-teal-100 text-[11px]">
                  {previewExtrato.map((p, idx) => (
                    <div key={idx} className="py-1 flex items-center justify-between">
                      <span className="truncate max-w-[280px]">
                        {p.descricao} ({formatDatePtBr(p.data)})
                      </span>
                      <span
                        className={cn(
                          'font-mono font-bold',
                          p.tipo_transacao === 'debito' ? 'text-red-600' : 'text-emerald-700',
                        )}
                      >
                        R$ {p.valor.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalImportarExtratoOpen(false)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleImportarExtrato}
              disabled={importandoExtrato || previewExtrato.length === 0}
              className="rounded-xl bg-[#0FA3A3] text-white hover:bg-[#0C8585]"
            >
              {importandoExtrato ? 'Importando...' : 'Confirmar Importação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: CONCILIAR LINHA DE EXTRATO */}
      <Dialog open={modalConciliarLinhaOpen} onOpenChange={setModalConciliarLinhaOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333]">
              Conciliação de Linha de Extrato
            </DialogTitle>
            <DialogDescription className="text-xs">
              Vincule a transação bancária a um título financeiro ou informe a categoria avulsa.
            </DialogDescription>
          </DialogHeader>

          {extratoSelecionado && (
            <div className="space-y-4 py-2 text-xs">
              <div className="rounded-xl bg-slate-50 p-3 border border-[#E2E8F0] space-y-1">
                <p className="font-bold text-[#1A2333] text-sm">{extratoSelecionado.descricao}</p>
                <p className="text-[#64748B]">Data: {formatDatePtBr(extratoSelecionado.data)}</p>
                <p
                  className={cn(
                    'text-sm font-mono font-bold',
                    extratoSelecionado.tipo_transacao === 'debito'
                      ? 'text-red-600'
                      : 'text-emerald-600',
                  )}
                >
                  Valor: {extratoSelecionado.tipo_transacao === 'debito' ? '- ' : '+ '}
                  R${' '}
                  {Math.abs(extratoSelecionado.valor).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>

              <div>
                <Label className="text-xs font-semibold">
                  Título Correspondente (Sugestão Automática de Match)
                </Label>
                <Select value={tituloSelecionadoId} onValueChange={setTituloSelecionadoId}>
                  <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                    <SelectValue placeholder="Selecione o título correspondente" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    <SelectItem value="">Sem título (Conciliação avulsa)</SelectItem>
                    {titulos
                      .filter((t) =>
                        extratoSelecionado.tipo_transacao === 'debito'
                          ? t.tipo === 'pagar'
                          : t.tipo === 'receber',
                      )
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.pessoa} - R$ {t.valor.toFixed(2)} ({t.descricao})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {!tituloSelecionadoId && (
                <div>
                  <Label className="text-xs font-semibold">
                    Categoria Contábil Avulsa (ex: Despesa Bancária, Rendimento)
                  </Label>
                  <Select
                    value={concilCategoriaAvulsaId}
                    onValueChange={setConcilCategoriaAvulsaId}
                  >
                    <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                      <SelectValue placeholder="Selecione a conta no plano de contas" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {planoContas.map((pc) => (
                        <SelectItem key={pc.id} value={pc.id}>
                          {pc.codigo} - {pc.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-start gap-2 pt-1">
                <Checkbox
                  id="chk-concil-contabil"
                  checked={concilGerarContabil}
                  onCheckedChange={(c) => setConcilGerarContabil(Boolean(c))}
                />
                <label
                  htmlFor="chk-concil-contabil"
                  className="text-xs font-medium text-[#1A2333] cursor-pointer"
                >
                  Registrar lançamento contábil em partidas dobradas
                  <span className="block text-[11px] text-[#64748B]">
                    (Débito/Crédito: Bancos × Contrapartida com validação de competência fechada)
                  </span>
                </label>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalConciliarLinhaOpen(false)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarConciliacao}
              size="sm"
              disabled={salvandoConciliacao}
              className="rounded-xl bg-[#0FA3A3] text-white hover:bg-[#0C8585]"
            >
              {salvandoConciliacao ? 'Conciliando...' : 'Confirmar Match'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: NOVA INTEGRAÇÃO BANCÁRIA */}
      <Dialog open={modalNovaIntegracaoOpen} onOpenChange={setModalNovaIntegracaoOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333]">
              Configurar Integração Bancária Automática
            </DialogTitle>
            <DialogDescription className="text-xs">
              Defina a conta, modo de importação e canal de recebimento dos extratos.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarIntegracao} className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Empresa *</Label>
                <Select value={intEmpresaId} onValueChange={setIntEmpresaId}>
                  <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
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

              <div>
                <Label className="text-xs font-semibold">Conta Bancária *</Label>
                <Select value={intContaId} onValueChange={setIntContaId}>
                  <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {contasBancarias.map((cb) => (
                      <SelectItem key={cb.id} value={cb.id}>
                        {cb.banco} ({cb.conta})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Modo de Operação *</Label>
                <Select value={intModo} onValueChange={(v) => setIntModo(v as IntegracaoModo)}>
                  <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="automatico">Automático (Agendado)</SelectItem>
                    <SelectItem value="manual">Manual (Sob demanda)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Frequência da Rotina *</Label>
                <Select
                  value={intFrequencia}
                  onValueChange={(v) => setIntFrequencia(v as IntegracaoFrequencia)}
                >
                  <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diaria">Diária (06:30 UTC)</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Tipo de Canal / Fonte de Entrada *</Label>
              <Select
                value={intFonteTipo}
                onValueChange={(v) => setIntFonteTipo(v as IntegracaoFonteTipo)}
              >
                <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Caixa Postal de E-mail (Extrato anexo)</SelectItem>
                  <SelectItem value="pasta_sftp">Diretório / SFTP do Banco</SelectItem>
                  <SelectItem value="arquivo_agendado">Repositório Agendado em Nuvem</SelectItem>
                  <SelectItem value="webhook_simulado">Endpoint / Webhook Provedor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">
                Identificador da Fonte (E-mail, Pasta ou URL) *
              </Label>
              <Input
                required
                value={intFonteIdentificador}
                onChange={(e) => setIntFonteIdentificador(e.target.value)}
                placeholder="Ex: extratos-itau@rumo.com.br ou /var/extratos/bb"
                className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Observações / Instruções Operacionais</Label>
              <Textarea
                value={intObservacoes}
                onChange={(e) => setIntObservacoes(e.target.value)}
                placeholder="Ex: Arquivo enviado pelo banco diariamente às 05:00..."
                className="h-16 rounded-xl border-[#E2E8F0] mt-1 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalNovaIntegracaoOpen(false)}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={salvandoIntegracao}
                className="rounded-xl bg-[#0FA3A3] text-white hover:bg-[#0C8585]"
              >
                {salvandoIntegracao ? 'Configurando...' : 'Salvar Integração'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: HISTÓRICO DE LOGS DE EXECUÇÃO */}
      <Dialog open={modalLogsOpen} onOpenChange={setModalLogsOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333]">
              Histórico de Execuções da Integração
            </DialogTitle>
            <DialogDescription className="text-xs">
              {integracaoSelecionadaLogs?.expand?.conta_bancaria?.banco} - Fonte:{' '}
              {integracaoSelecionadaLogs?.fonte_identificador}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs max-h-96 overflow-y-auto">
            {integracaoLogs.filter(
              (l) => !integracaoSelecionadaLogs || l.integracao === integracaoSelecionadaLogs.id,
            ).length === 0 ? (
              <div className="py-8 text-center text-[#94A3B8]">
                Nenhum log registrado para esta integração bancária.
              </div>
            ) : (
              integracaoLogs
                .filter(
                  (l) =>
                    !integracaoSelecionadaLogs || l.integracao === integracaoSelecionadaLogs.id,
                )
                .map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={cn(
                            'text-[10px]',
                            log.status === 'sucesso'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : log.status === 'aviso'
                                ? 'bg-amber-100 text-amber-800 border-amber-200'
                                : 'bg-red-100 text-red-800 border-red-200',
                          )}
                        >
                          {log.status.toUpperCase()}
                        </Badge>
                        <span className="font-semibold text-[#1A2333]">
                          {formatDatePtBr(log.data_execucao)}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#64748B]">
                        {new Date(log.data_execucao).toLocaleTimeString('pt-BR')}
                      </span>
                    </div>

                    <p className="text-xs text-[#475569]">{log.mensagem}</p>

                    <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-100 text-[11px] text-[#64748B]">
                      <span>
                        Lidas: <strong className="text-[#1A2333]">{log.linhas_lidas || 0}</strong>
                      </span>
                      <span>
                        Importadas:{' '}
                        <strong className="text-teal-700">{log.linhas_importadas || 0}</strong>
                      </span>
                      <span>
                        Duplicadas:{' '}
                        <strong className="text-amber-700">{log.linhas_duplicadas || 0}</strong>
                      </span>
                      <span>
                        Conciliadas:{' '}
                        <strong className="text-emerald-700">{log.linhas_conciliadas || 0}</strong>
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalLogsOpen(false)}
              className="rounded-xl"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

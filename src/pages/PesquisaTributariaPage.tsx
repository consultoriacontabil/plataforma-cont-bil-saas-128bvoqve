import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { empresasService } from '@/services/empresas'
import { PesquisaTributaria, pesquisaTributariaService } from '@/services/pesquisaTributariaService'
import { EllizaComando, ellizaComandosService } from '@/services/ellizaComandosService'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  BookOpen,
  Send,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Building2,
  FileText,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Scale,
  Activity,
  Layers,
  HelpCircle,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatDatePtBr } from '@/lib/formatters'
import { RelatorioMarkdownViewer } from '@/components/RelatorioMarkdownViewer'
import { Empresa } from '@/types'

export default function PesquisaTributariaPage() {
  const { tenant } = useAuth()
  const tenantId = tenant?.id || ''
  const { toast } = useToast()

  // Estados de dados
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [pesquisas, setPesquisas] = useState<PesquisaTributaria[]>([])
  const [comandosFila, setComandosFila] = useState<EllizaComando[]>([])
  const [carregando, setCarregando] = useState(false)
  const [enviandoComando, setEnviandoComando] = useState(false)

  // Filtros
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('todas')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroTermo, setFiltroTermo] = useState<string>('')

  // Formulário de Disparo
  const [pergunta, setPergunta] = useState('')
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string>('nenhuma')
  const [ncm, setNcm] = useState('')
  const [cfop, setCfop] = useState('')
  const [tipoOperacao, setTipoOperacao] = useState('')
  const [ufOrigem, setUfOrigem] = useState('')
  const [ufDestino, setUfDestino] = useState('')
  const [aliquotaEstudo, setAliquotaEstudo] = useState('')
  const [prioridade, setPrioridade] = useState<number>(3)

  // Modal de Detalhe do Relatório
  const [modalAberta, setModalAberta] = useState(false)
  const [pesquisaSelecionada, setPesquisaSelecionada] = useState<PesquisaTributaria | null>(null)

  // Carregar empresas
  useEffect(() => {
    if (!tenantId) return
    const carregarEmpresas = async () => {
      try {
        const res = await empresasService.list(tenantId)
        setEmpresas(res)
      } catch (err) {
        console.error('Erro ao listar empresas:', err)
      }
    }
    carregarEmpresas()
  }, [tenantId])

  // Carregar pesquisas e comandos
  const carregarDados = async () => {
    if (!tenantId) return
    setCarregando(true)
    try {
      const [listaPesquisas, listaComandos] = await Promise.all([
        pesquisaTributariaService.listar({
          tenantId,
          empresaId: filtroEmpresa,
          status: filtroStatus,
          termo: filtroTermo,
        }),
        ellizaComandosService.listar(tenantId, 50),
      ])
      setPesquisas(listaPesquisas)
      // Filtrar comandos específicos de pesquisa tributária
      const cmdsPesquisa = listaComandos.filter((c) => c.tipo === 'pesquisa_tributaria')
      setComandosFila(cmdsPesquisa)
    } catch (err) {
      console.error('Erro ao carregar dados de pesquisa tributária:', err)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarDados()
    const timer = setInterval(carregarDados, 15000)
    return () => clearInterval(timer)
  }, [tenantId, filtroEmpresa, filtroStatus, filtroTermo])

  // Disparo de Nova Pesquisa Tributária
  const handleDispararPesquisa = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pergunta.trim()) {
      toast({
        title: 'Pergunta obrigatória',
        description: 'Descreva a dúvida fiscal ou o objetivo da pesquisa tributária.',
        variant: 'destructive',
      })
      return
    }

    setEnviandoComando(true)
    try {
      const empId = empresaSelecionada !== 'nenhuma' ? empresaSelecionada : undefined

      const cmdCriado = await ellizaComandosService.dispararPesquisaTributaria({
        tenant_id: tenantId,
        empresa_id: empId,
        pergunta: pergunta.trim(),
        contexto: {
          ncm: ncm.trim() || undefined,
          cfop: cfop.trim() || undefined,
          operacao: tipoOperacao.trim() || undefined,
          uf_origem: ufOrigem.trim().toUpperCase() || undefined,
          uf_destino: ufDestino.trim().toUpperCase() || undefined,
          aliquota_estudo: aliquotaEstudo.trim() || undefined,
        },
        prioridade,
      })

      toast({
        title: 'Pesquisa Tributária Enfileirada',
        description: `Comando criado com nonce ${cmdCriado.nonce.slice(0, 10)}... na Fila da Elliza.`,
      })

      // Limpar formulário parcial
      setPergunta('')
      setNcm('')
      setCfop('')
      setTipoOperacao('')
      setAliquotaEstudo('')

      await carregarDados()
    } catch (err) {
      console.error('Erro ao disparar comando de pesquisa:', err)
      toast({
        title: 'Falha no disparo',
        description: 'Não foi possível enfileirar o comando. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setEnviandoComando(false)
    }
  }

  // Métricas para a Trilha RPA v1.0
  const totalPesquisas = pesquisas.length
  const concluidasCount = pesquisas.filter((p) => p.status === 'concluida').length
  const emAnaliseCount = pesquisas.filter((p) => p.status === 'em_analise').length
  const errosCount = comandosFila.filter((c) => c.status === 'erro').length
  const pendentesFilaCount = comandosFila.filter(
    (c) => c.status === 'pendente' || c.status === 'em_execucao',
  ).length

  const renderBadgeStatusPesquisa = (status: string) => {
    switch (status) {
      case 'concluida':
        return (
          <Badge className="bg-emerald-600 text-white font-mono text-[10px] uppercase font-bold">
            Concluída
          </Badge>
        )
      case 'em_analise':
        return (
          <Badge className="bg-blue-600 text-white font-mono text-[10px] uppercase font-bold animate-pulse">
            Em Análise
          </Badge>
        )
      case 'revisao_necessaria':
        return (
          <Badge className="bg-amber-600 text-white font-mono text-[10px] uppercase font-bold">
            Revisão
          </Badge>
        )
      case 'erro':
        return (
          <Badge className="bg-red-600 text-white font-mono text-[10px] uppercase font-bold">
            Erro Honesto
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="font-mono text-[10px]">
            {status || '—'}
          </Badge>
        )
    }
  }

  const renderBadgeStatusComando = (status: string) => {
    switch (status) {
      case 'pendente':
        return (
          <Badge className="bg-amber-500 text-white font-mono text-[9px] uppercase font-bold">
            Pendente
          </Badge>
        )
      case 'em_execucao':
      case 'aceito':
        return (
          <Badge className="bg-blue-600 text-white font-mono text-[9px] uppercase font-bold animate-pulse">
            Em Execução
          </Badge>
        )
      case 'concluido':
        return (
          <Badge className="bg-emerald-600 text-white font-mono text-[9px] uppercase font-bold">
            Concluído
          </Badge>
        )
      case 'erro':
        return (
          <Badge className="bg-red-600 text-white font-mono text-[9px] uppercase font-bold">
            Erro Honesto
          </Badge>
        )
      case 'expirado':
        return (
          <Badge className="bg-slate-500 text-white font-mono text-[9px] uppercase font-bold">
            Expirado
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="font-mono text-[9px]">
            {status || '—'}
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-teal-500/10 rounded-xl border border-teal-500/20 text-[#0FA3A3]">
              <Scale className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                  Pesquisa Tributária Avançada
                </h1>
                <Badge className="bg-[#0FA3A3] text-white text-[10px] font-bold">
                  Workflow ELLIZA Desktop
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Acionamento automatizado do motor de pesquisa fiscal da ELLIZA Desktop (POP-EX-04)
                com geração de relatório técnico fundamentado e parecer contábil.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={carregarDados}
            disabled={carregando}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${carregando ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Grid de Telemetria Trilha RPA v1.0 */}
      <div
        id="rpa-grid-pesquisas-tributarias"
        data-rpa-status={carregando ? 'loading' : 'loaded'}
        data-total-pesquisas={totalPesquisas}
        data-total-concluidas={concluidasCount}
        data-total-em-analise={emAnaliseCount}
        data-total-fila-comandos={comandosFila.length}
        data-total-erros-fila={errosCount}
        className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs"
      >
        <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <span className="text-[10px] text-slate-500 uppercase font-bold block">
            Total de Pesquisas
          </span>
          <strong className="text-slate-900 text-lg font-black">{totalPesquisas}</strong>
        </div>
        <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-2xs">
          <span className="text-[10px] text-emerald-800 uppercase font-bold block">
            Relatórios Concluídos
          </span>
          <strong className="text-emerald-950 text-lg font-black">{concluidasCount}</strong>
        </div>
        <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/50 shadow-2xs">
          <span className="text-[10px] text-blue-800 uppercase font-bold block">
            Em Análise na Desktop
          </span>
          <strong className="text-blue-900 text-lg font-black">{emAnaliseCount}</strong>
        </div>
        <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 shadow-2xs">
          <span className="text-[10px] text-amber-800 uppercase font-bold block">
            Fila de Comandos (Pendentes)
          </span>
          <strong className="text-amber-900 text-lg font-black">{pendentesFilaCount}</strong>
        </div>
        <div className="p-3 rounded-xl border border-red-200 bg-red-50/50 shadow-2xs">
          <span className="text-[10px] text-red-800 uppercase font-bold block">
            Paradas Honestas (Erros)
          </span>
          <strong className="text-red-950 text-lg font-black">{errosCount}</strong>
        </div>
      </div>

      {/* Banner de Status Trilha RPA v1.0 */}
      <div
        id="rpa-status-conclusao"
        data-rpa-state={errosCount > 0 ? 'error' : concluidasCount > 0 ? 'success' : 'open'}
        data-rpa-resultado={
          errosCount > 0
            ? 'Existem comandos de pesquisa tributária rejeitados com parada honesta.'
            : concluidasCount > 0
              ? 'Pesquisas fiscais fundamentadas e relatórios técnicos disponíveis.'
              : 'Aguardando envio de pesquisas tributárias para processamento.'
        }
        className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
          errosCount > 0
            ? 'bg-red-50/80 border-red-200 text-red-950'
            : concluidasCount > 0
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}
      >
        <div className="flex items-center gap-2">
          {errosCount > 0 ? (
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
          ) : concluidasCount > 0 ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <Activity className="h-4 w-4 text-[#0FA3A3] shrink-0" />
          )}
          <span className="font-medium">
            {errosCount > 0
              ? 'Parada honesta: comandos devolvidos por falta de evidência ou relatório inconsistente foram registrados como pendência estruturada.'
              : concluidasCount > 0
                ? 'Canal integrado com a ELLIZA desktop. Relatórios técnicos gerados e auditados em conformidade com o POP-EX-04.'
                : 'Canal de pesquisa tributária pronto para disparar consultas ao workflow da ELLIZA desktop.'}
          </span>
        </div>
        <span className="font-mono text-[10px] text-slate-500">Trilha RPA v1.0 • POP-EX-04</span>
      </div>

      {/* Formulário de Disparo */}
      <Card className="p-5 rounded-2xl border-slate-200 bg-white shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#0FA3A3]" />
            <h3 className="font-bold text-sm text-slate-900">
              Disparar Pesquisa Tributária para a ELLIZA Desktop
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">
            Enfileira comando{' '}
            <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">pesquisa_tributaria</code>
          </span>
        </div>

        <form onSubmit={handleDispararPesquisa} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-800 flex items-center justify-between">
              <span>Pergunta / Objetivo da Pesquisa Tributária (Linguagem Natural) *</span>
              <span className="text-[10px] text-slate-400 font-normal">
                Ex.: Qual a tributação de ICMS e PIS/COFINS para importação de café verde?
              </span>
            </label>
            <Textarea
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              placeholder="Descreva a matéria fiscal, tese tributária, dúvida sobre alíquota, isenção, benefício fiscal, enquadramento Simples vs. Presumido..."
              rows={3}
              required
              className="text-xs resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {/* Empresa Opcional */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 flex items-center gap-1">
                <Building2 className="h-3 w-3 text-slate-400" />
                <span>Empresa / Cliente (Opcional)</span>
              </label>
              <Select value={empresaSelecionada} onValueChange={setEmpresaSelecionada}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione empresa..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">Nenhuma (Estudo Geral)</SelectItem>
                  {empresas.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.nome_fantasia || emp.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* NCM */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">NCM (8 dígitos)</label>
              <Input
                value={ncm}
                onChange={(e) => setNcm(e.target.value)}
                placeholder="Ex.: 0901.11.10"
                className="h-8 text-xs font-mono"
              />
            </div>

            {/* CFOP */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">CFOP</label>
              <Input
                value={cfop}
                onChange={(e) => setCfop(e.target.value)}
                placeholder="Ex.: 5102 / 6102"
                className="h-8 text-xs font-mono"
              />
            </div>

            {/* Tipo de Operação */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Tipo de Operação</label>
              <Input
                value={tipoOperacao}
                onChange={(e) => setTipoOperacao(e.target.value)}
                placeholder="Ex.: Venda interna, Interestadual, Importação..."
                className="h-8 text-xs"
              />
            </div>

            {/* UF Origem */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">UF Origem</label>
              <Input
                value={ufOrigem}
                onChange={(e) => setUfOrigem(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="Ex.: SP"
                maxLength={2}
                className="h-8 text-xs font-mono uppercase"
              />
            </div>

            {/* UF Destino */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">UF Destino</label>
              <Input
                value={ufDestino}
                onChange={(e) => setUfDestino(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="Ex.: RJ"
                maxLength={2}
                className="h-8 text-xs font-mono uppercase"
              />
            </div>

            {/* Alíquota / Benefício em Estudo */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Benefício / Alíquota em Estudo</label>
              <Input
                value={aliquotaEstudo}
                onChange={(e) => setAliquotaEstudo(e.target.value)}
                placeholder="Ex.: Redução de base 60%, Isenção Art. 8º..."
                className="h-8 text-xs"
              />
            </div>

            {/* Prioridade */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Prioridade</label>
              <Select
                value={String(prioridade)}
                onValueChange={(val) => setPrioridade(parseInt(val, 10))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">P1 - Muito Baixa</SelectItem>
                  <SelectItem value="2">P2 - Baixa</SelectItem>
                  <SelectItem value="3">P3 - Média (Padrão)</SelectItem>
                  <SelectItem value="4">P4 - Alta</SelectItem>
                  <SelectItem value="5">P5 - Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-[11px] text-slate-500">
              A ELLIZA Desktop captura a pesquisa via polling/SSE, consulta bases (RFB, SEFAZ, IBPT)
              e devolve relatório técnico fundamentado.
            </span>
            <Button
              id="rpa-btn-executar"
              data-action-code="DISPARAR_PESQUISA_TRIBUTARIA"
              data-rpa-action="disparar-pesquisa-tributaria"
              type="submit"
              disabled={enviandoComando || !pergunta.trim()}
              className="bg-[#0FA3A3] hover:bg-[#0c8282] text-white text-xs gap-1.5 h-8 font-bold"
            >
              {enviandoComando ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Enfileirando...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Enviar Pesquisa para a ELLIZA</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>

      {/* Comandos de Pesquisa na Fila da Elliza */}
      {comandosFila.length > 0 && (
        <Card className="p-4 rounded-2xl border-slate-200 bg-white shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#0FA3A3]" />
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                Comandos de Pesquisa na Fila da Elliza ({comandosFila.length})
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              Status em tempo real da execução desktop
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                  <th className="py-2 px-3">Nonce / ID</th>
                  <th className="py-2 px-3">Empresa</th>
                  <th className="py-2 px-3">Pergunta / Resumo</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Resultado / Parada Honesta</th>
                  <th className="py-2 px-3">Enfileirado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comandosFila.map((cmd) => {
                  const empNome =
                    cmd.expand?.empresa_id?.nome_fantasia ||
                    cmd.expand?.empresa_id?.razao_social ||
                    '—'
                  const perguntaPayload = (cmd.payload as any)?.pergunta || '—'

                  return (
                    <tr
                      key={cmd.id}
                      className="hover:bg-slate-50/70 transition-colors"
                      data-rpa-cmd-id={cmd.id}
                      data-rpa-cmd-nonce={cmd.nonce}
                      data-rpa-cmd-status={cmd.status}
                    >
                      <td className="py-2 px-3 font-mono text-[11px]">
                        <span className="font-bold text-slate-900 block truncate max-w-[130px]">
                          {cmd.nonce}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          P{cmd.prioridade || 3} • {cmd.id}
                        </span>
                      </td>

                      <td className="py-2 px-3">
                        <span className="font-medium text-slate-800 block truncate max-w-[150px]">
                          {empNome}
                        </span>
                      </td>

                      <td className="py-2 px-3 max-w-[280px]">
                        <p
                          className="line-clamp-2 text-slate-700 text-[11px]"
                          title={perguntaPayload}
                        >
                          {perguntaPayload}
                        </p>
                      </td>

                      <td className="py-2 px-3">{renderBadgeStatusComando(cmd.status)}</td>

                      <td className="py-2 px-3 max-w-[240px]">
                        {cmd.status === 'concluido' && (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1 text-[11px]">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            Relatório emitido
                          </span>
                        )}
                        {cmd.status === 'erro' && (
                          <div className="bg-red-50 p-1.5 rounded border border-red-200 text-[10px] text-red-800">
                            <span className="font-bold block flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 text-red-600" />
                              {cmd.erro?.codigo || 'ERRO'}
                            </span>
                            <span className="line-clamp-2">
                              {cmd.erro?.motivo || 'Falha reportada.'}
                            </span>
                          </div>
                        )}
                        {cmd.status === 'pendente' && (
                          <span className="text-amber-700 text-[11px] font-mono">
                            Aguardando aceite da desktop
                          </span>
                        )}
                        {cmd.status === 'em_execucao' && (
                          <span className="text-blue-700 text-[11px] font-mono animate-pulse">
                            Processando pesquisa...
                          </span>
                        )}
                        {cmd.status === 'expirado' && (
                          <span className="text-slate-500 text-[11px] font-mono">Expirado</span>
                        )}
                      </td>

                      <td className="py-2 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                        {formatDatePtBr(cmd.created)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Histórico e Pesquisas Gravadas */}
      <Card className="p-5 rounded-2xl border-slate-200 bg-white shadow-xs space-y-4">
        {/* Filtros da Tabela */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#0FA3A3]" />
            <h3 className="font-bold text-sm text-slate-900">
              Histórico de Pesquisas Tributárias e Pareceres Técnicos
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filtro Empresa */}
            <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
              <SelectTrigger className="h-8 text-xs w-[180px]">
                <SelectValue placeholder="Filtrar empresa..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Empresas</SelectItem>
                {empresas.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.nome_fantasia || emp.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro Status */}
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="h-8 text-xs w-[140px]">
                <SelectValue placeholder="Status..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
                <SelectItem value="em_analise">Em Análise</SelectItem>
                <SelectItem value="revisao_necessaria">Revisão</SelectItem>
                <SelectItem value="erro">Erro Honesto</SelectItem>
              </SelectContent>
            </Select>

            {/* Busca textual */}
            <div className="relative w-[180px]">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <Input
                value={filtroTermo}
                onChange={(e) => setFiltroTermo(e.target.value)}
                placeholder="Buscar termo..."
                className="h-8 text-xs pl-8"
              />
            </div>
          </div>
        </div>

        {/* Grid de Pesquisas */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                <th className="py-2.5 px-3">Pergunta / Matéria Fiscal</th>
                <th className="py-2.5 px-3">Empresa / Cliente</th>
                <th className="py-2.5 px-3">Contexto (NCM / CFOP / UF)</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Fontes Oficiais</th>
                <th className="py-2.5 px-3">Data / Conclusão</th>
                <th className="py-2.5 px-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {pesquisas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    <Scale className="h-7 w-7 text-slate-300 mx-auto mb-2" />
                    <span className="font-semibold block text-slate-700">
                      Nenhuma pesquisa tributária encontrada
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Utilize o formulário acima para disparar uma pesquisa fiscal à ELLIZA desktop.
                    </span>
                  </td>
                </tr>
              ) : (
                pesquisas.map((p) => {
                  const empNome =
                    p.expand?.empresa_id?.nome_fantasia || p.expand?.empresa_id?.razao_social || '—'
                  const ctx = p.contexto || {}
                  const fontesQtd = Array.isArray(p.fontes) ? p.fontes.length : 0

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/80 transition-colors"
                      data-rpa-pesquisa-id={p.id}
                      data-rpa-pesquisa-status={p.status}
                    >
                      {/* Pergunta */}
                      <td className="py-2.5 px-3 max-w-[300px]">
                        <span
                          className="font-semibold text-slate-900 block line-clamp-2"
                          title={p.pergunta}
                        >
                          {p.pergunta}
                        </span>
                        {p.conclusoes && (
                          <span className="text-[10px] text-slate-500 line-clamp-1 mt-0.5 block italic">
                            Síntese: {p.conclusoes}
                          </span>
                        )}
                      </td>

                      {/* Empresa */}
                      <td className="py-2.5 px-3 max-w-[150px]">
                        <span className="font-medium text-slate-800 block truncate" title={empNome}>
                          {empNome}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {p.expand?.empresa_id?.cnpj || '—'}
                        </span>
                      </td>

                      {/* Contexto */}
                      <td className="py-2.5 px-3">
                        <div className="space-y-0.5 text-[11px]">
                          {ctx.ncm ? (
                            <span className="font-mono text-slate-800 block">
                              <strong>NCM:</strong> {ctx.ncm}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[10px]">NCM: —</span>
                          )}
                          {(ctx.uf_origem || ctx.uf_destino) && (
                            <span className="text-[10px] text-slate-600 block font-mono">
                              {ctx.uf_origem || '—'} → {ctx.uf_destino || '—'}
                              {ctx.cfop ? ` | CFOP ${ctx.cfop}` : ''}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3">{renderBadgeStatusPesquisa(p.status)}</td>

                      {/* Fontes */}
                      <td className="py-2.5 px-3">
                        {fontesQtd > 0 ? (
                          <Badge
                            variant="outline"
                            className="bg-slate-50 text-slate-700 font-mono text-[10px]"
                          >
                            {fontesQtd} {fontesQtd === 1 ? 'fonte' : 'fontes'}
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Data */}
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap text-[11px]">
                        {formatDatePtBr(p.created)}
                      </td>

                      {/* Ação */}
                      <td className="py-2.5 px-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setPesquisaSelecionada(p)
                            setModalAberta(true)
                          }}
                          className="h-7 text-xs gap-1 text-[#0FA3A3] hover:text-[#0c8282] hover:bg-teal-50"
                        >
                          <span>Ver Relatório</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal de Exibição do Relatório Técnico Completo */}
      <Dialog open={modalAberta} onOpenChange={setModalAberta}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {pesquisaSelecionada && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-teal-500/10 rounded-lg text-[#0FA3A3]">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-black text-slate-900">
                      Relatório Técnico de Pesquisa Tributária
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                      ID: {pesquisaSelecionada.id} • Criado em{' '}
                      {formatDatePtBr(pesquisaSelecionada.created)}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Informações da Pergunta e Empresa */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Pergunta / Consulta Fiscal
                  </span>
                  <p className="font-semibold text-slate-900 text-xs mt-0.5">
                    {pesquisaSelecionada.pergunta}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-200/60 text-[11px]">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Empresa</span>
                    <strong className="text-slate-800">
                      {pesquisaSelecionada.expand?.empresa_id?.nome_fantasia ||
                        pesquisaSelecionada.expand?.empresa_id?.razao_social ||
                        'Geral (Sem vínculo)'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">NCM / CFOP</span>
                    <strong className="font-mono text-slate-800">
                      {pesquisaSelecionada.contexto?.ncm || '—'} /{' '}
                      {pesquisaSelecionada.contexto?.cfop || '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Origem → Destino</span>
                    <strong className="font-mono text-slate-800">
                      {pesquisaSelecionada.contexto?.uf_origem || '—'} →{' '}
                      {pesquisaSelecionada.contexto?.uf_destino || '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Status</span>
                    {renderBadgeStatusPesquisa(pesquisaSelecionada.status)}
                  </div>
                </div>
              </div>

              {/* Conclusões Executivas */}
              {pesquisaSelecionada.conclusoes && (
                <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-3 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-teal-950 font-bold text-[11px] uppercase tracking-wider">
                    <ShieldCheck className="h-4 w-4 text-[#0FA3A3]" />
                    <span>Conclusão / Parecer Executivo</span>
                  </div>
                  <p className="text-teal-950 leading-relaxed font-medium">
                    {pesquisaSelecionada.conclusoes}
                  </p>
                </div>
              )}

              {/* Relatório Técnico em Markdown */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <span className="font-bold text-xs text-slate-900 uppercase tracking-wider block border-b border-slate-100 pb-1.5">
                  Fundamentação Técnica e Análise Normativa
                </span>
                <RelatorioMarkdownViewer
                  conteudo={
                    pesquisaSelecionada.relatorio_tecnico ||
                    'Nenhum relatório técnico emitido para esta pesquisa.'
                  }
                />
              </div>

              {/* Fontes Normativas Citadas */}
              {Array.isArray(pesquisaSelecionada.fontes) &&
                pesquisaSelecionada.fontes.length > 0 && (
                  <div className="space-y-2">
                    <span className="font-bold text-xs text-slate-800 uppercase tracking-wider block">
                      Fontes Normativas e Doutrinárias ({pesquisaSelecionada.fontes.length})
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {pesquisaSelecionada.fontes.map((fonte, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <strong className="text-slate-900 font-bold">{fonte.titulo}</strong>
                            {fonte.tipo && (
                              <Badge variant="outline" className="text-[9px] uppercase font-mono">
                                {fonte.tipo}
                              </Badge>
                            )}
                          </div>
                          {fonte.numero && (
                            <span className="text-[10px] text-slate-600 block">
                              Norma nº {fonte.numero} {fonte.ano ? `de ${fonte.ano}` : ''}
                              {fonte.orgao ? ` (${fonte.orgao})` : ''}
                            </span>
                          )}
                          {fonte.trecho && (
                            <p className="text-[10px] text-slate-500 italic border-l-2 border-slate-300 pl-1.5 mt-1">
                              &quot;{fonte.trecho}&quot;
                            </p>
                          )}
                          {fonte.link && (
                            <a
                              href={fonte.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-[#0FA3A3] hover:underline flex items-center gap-1 pt-0.5"
                            >
                              <span>Consultar documento oficial</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Evidências e Metadados de Auditoria */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs space-y-1.5">
                <span className="font-bold text-[10px] uppercase text-slate-600 tracking-wider block">
                  Auditoria e Evidências Trilha RPA v1.0
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono text-slate-600">
                  <div>
                    Comando ID:{' '}
                    <span className="text-slate-900">
                      {pesquisaSelecionada.criado_por_comando_id || '—'}
                    </span>
                  </div>
                  <div>
                    Agente:{' '}
                    <span className="text-slate-900">
                      {(pesquisaSelecionada.metadados_json as any)?.agente || 'elliza-desktop-rpa'}
                    </span>
                  </div>
                  <div>
                    Evidências:{' '}
                    <span className="text-slate-900">
                      {Array.isArray(pesquisaSelecionada.evidencias)
                        ? pesquisaSelecionada.evidencias.join(', ') || '—'
                        : '—'}
                    </span>
                  </div>
                  <div>
                    Concluído em:{' '}
                    <span className="text-slate-900">
                      {(pesquisaSelecionada.metadados_json as any)?.concluido_em ||
                        formatDatePtBr(pesquisaSelecionada.updated)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

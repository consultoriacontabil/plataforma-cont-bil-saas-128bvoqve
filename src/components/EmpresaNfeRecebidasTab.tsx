import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  FileText,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  FileCode,
  Download,
  ExternalLink,
  ChevronRight,
  Info,
  Calendar,
  Building2,
  FileCheck2,
  Layers,
  Sparkles,
  Lock,
  KeyRound,
  Eye,
  SlidersHorizontal,
  PlusCircle,
  HelpCircle,
  FileSpreadsheet,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { nfeDestinatarioService, type SalvarNfeConfigInput } from '@/services/nfeDestinatario'
import { certificadosService } from '@/services/certificados'
import { documentosService } from '@/services/documentos'
import { auditService } from '@/services/audit'
import { formatDatePtBr, formatDateTimePtBr, maskCnpj } from '@/lib/formatters'
import type {
  Empresa,
  NfeConfigRecord,
  NfeRecebidaRecord,
  NfeSyncLogRecord,
  NfeDiagnosticoResult,
  NfeStatusManifestacao,
  CertificadoDigitalRecord,
} from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface EmpresaNfeRecebidasTabProps {
  empresa: Empresa
  canEdit?: boolean
  onSyncCompleted?: () => void
}

export function EmpresaNfeRecebidasTab({
  empresa,
  canEdit = true,
  onSyncCompleted,
}: EmpresaNfeRecebidasTabProps) {
  const { user, tenant } = useAuth()
  const { toast } = useToast()

  const [activeSubTab, setActiveSubTab] = useState<'notas' | 'configuracao' | 'historico'>('notas')

  // Config State
  const [config, setConfig] = useState<NfeConfigRecord | null>(null)
  const [certificados, setCertificados] = useState<CertificadoDigitalRecord[]>([])
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [savingConfig, setSavingConfig] = useState(false)

  // Config Form Fields
  const [buscaAtiva, setBuscaAtiva] = useState(false)
  const [ambiente, setAmbiente] = useState<'producao' | 'homologacao'>('producao')
  const [certificadoId, setCertificadoId] = useState<string>('')
  const [senhaCertificado, setSenhaCertificado] = useState('')
  const [autoImportarGed, setAutoImportarGed] = useState(true)
  const [autoCiencia, setAutoCiencia] = useState(false)

  // Notas State
  const [notas, setNotas] = useState<NfeRecebidaRecord[]>([])
  const [loadingNotas, setLoadingNotas] = useState(true)
  const [search, setSearch] = useState('')
  const [statusManifFilter, setStatusManifFilter] = useState<string>('todos')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  // Logs State
  const [logs, setLogs] = useState<NfeSyncLogRecord[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  // Diagnóstico / Ações State
  const [diagnostico, setDiagnostico] = useState<NfeDiagnosticoResult | null>(null)
  const [testandoCredenciais, setTestandoCredenciais] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [diagModalOpen, setDiagModalOpen] = useState(false)

  // Manifestação Modal State
  const [manifestarModalOpen, setManifestarModalOpen] = useState(false)
  const [notaSelecionada, setNotaSelecionada] = useState<NfeRecebidaRecord | null>(null)
  const [tipoManifSelecionada, setTipoManifSelecionada] =
    useState<NfeStatusManifestacao>('confirmada')
  const [justificativaManif, setJustificativaManif] = useState('')
  const [enviandoManif, setEnviandoManif] = useState(false)

  // Detalhe da Nota Modal State
  const [detalheModalOpen, setDetalheModalOpen] = useState(false)

  // Consulta por Chave Pública Modal State
  const [chaveManualModalOpen, setChaveManualModalOpen] = useState(false)
  const [chaveManualInput, setChaveManualInput] = useState('')
  const [razaoEmitManual, setRazaoEmitManual] = useState('')
  const [valorManual, setValorManual] = useState('')
  const [importandoChaveManual, setImportandoChaveManual] = useState(false)

  // Carregar dados iniciais
  const loadInitialData = useCallback(async () => {
    if (!empresa?.id) return
    try {
      setLoadingConfig(true)
      const [cfg, certList] = await Promise.all([
        nfeDestinatarioService.getConfig(empresa.id),
        certificadosService.listByEmpresa(empresa.id),
      ])

      setCertificados(certList)
      const certAtivo = certList.find((c) => c.status === 'ativo') || certList[0]

      if (cfg) {
        setConfig(cfg)
        setBuscaAtiva(cfg.busca_automatica_ativa ?? Boolean(certAtivo))
        setAmbiente(cfg.ambiente || 'producao')
        const effectiveCertId = cfg.certificado_a1 || (certAtivo ? certAtivo.id : '')
        setCertificadoId(effectiveCertId)
        setSenhaCertificado(cfg.senha_certificado || (certAtivo ? certAtivo.senha || '' : ''))
        setAutoImportarGed(cfg.auto_importar_ged ?? true)
        setAutoCiencia(cfg.auto_ciencia_operacao ?? false)
        if (cfg.ultimo_diagnostico_json) {
          setDiagnostico(cfg.ultimo_diagnostico_json)
        }
      } else {
        // Padrões se ainda não configurado
        if (certAtivo) {
          setBuscaAtiva(true)
          setCertificadoId(certAtivo.id)
          setSenhaCertificado(certAtivo.senha || '')
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar configuração de NF-e:', err)
    } finally {
      setLoadingConfig(false)
    }
  }, [empresa?.id])

  const loadNotas = useCallback(async () => {
    if (!empresa?.id) return
    try {
      setLoadingNotas(true)
      const res = await nfeDestinatarioService.listRecebidas({
        empresaId: empresa.id,
        statusManifestacao: statusManifFilter,
        search,
        dataInicio: dataInicio || undefined,
        dataFim: dataFim || undefined,
      })
      setNotas(res.items)
    } catch (err) {
      console.warn('Erro ao carregar notas recebidas:', err)
    } finally {
      setLoadingNotas(false)
    }
  }, [empresa?.id, statusManifFilter, search, dataInicio, dataFim])

  const loadLogs = useCallback(async () => {
    if (!empresa?.id) return
    try {
      setLoadingLogs(true)
      const res = await nfeDestinatarioService.listLogs(empresa.id, 20)
      setLogs(res)
    } catch (err) {
      console.warn('Erro ao carregar logs:', err)
    } finally {
      setLoadingLogs(false)
    }
  }, [empresa?.id])

  useEffect(() => {
    loadInitialData()
    loadNotas()
    loadLogs()
  }, [loadInitialData, loadNotas, loadLogs])

  // Identificação do certificado ativo selecionado
  const certSelecionado = useMemo(() => {
    return certificados.find((c) => c.id === certificadoId) || certificados[0] || null
  }, [certificados, certificadoId])

  const isModoSupervisao = useMemo(() => {
    if (!config) return true
    return (
      config.status_conexao === 'modo_supervisao' || config.status_conexao === 'erro_credenciais'
    )
  }, [config])

  // Salvar Configurações
  const handleSalvarConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!empresa?.id || !tenant?.id) return

    setSavingConfig(true)
    try {
      const input: SalvarNfeConfigInput = {
        tenant_id: tenant.id,
        empresa: empresa.id,
        busca_automatica_ativa: buscaAtiva,
        ambiente,
        certificado_a1: certificadoId || undefined,
        senha_certificado: senhaCertificado.trim(),
        auto_importar_ged: autoImportarGed,
        auto_ciencia_operacao: autoCiencia,
      }

      const saved = await nfeDestinatarioService.salvarConfig(input)
      setConfig(saved)
      toast({
        title: 'Parâmetros atualizados!',
        description: 'As configurações de busca de NF-e da empresa foram salvas com sucesso.',
      })

      // Se ativou ou mudou credenciais, rodar diagnóstico automático transparente
      await handleTestarCredenciais(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar parâmetros.'
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: msg,
      })
    } finally {
      setSavingConfig(false)
    }
  }

  // Testar Credenciais
  const handleTestarCredenciais = async (abrirModal = true) => {
    if (!empresa?.id || !tenant?.id) return

    setTestandoCredenciais(true)
    try {
      const diag = await nfeDestinatarioService.testarCredenciais({
        tenant_id: tenant.id,
        empresa_id: empresa.id,
        certificado_a1: certificadoId,
        senha_certificado: senhaCertificado.trim(),
        ambiente,
      })

      setDiagnostico(diag)
      if (abrirModal) {
        setDiagModalOpen(true)
      }

      // Atualizar config com o diagnóstico retornado
      const updatedCfg = await nfeDestinatarioService.getConfig(empresa.id)
      if (updatedCfg) setConfig(updatedCfg)

      await loadLogs()

      if (diag.status === 'conectado') {
        toast({
          title: 'Conexão SEFAZ DFe validada!',
          description: diag.mensagem,
        })
      } else {
        toast({
          variant: 'default',
          title: 'Diagnóstico em Modo Supervisão',
          description: diag.mensagem,
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao testar conexão com SEFAZ.'
      toast({
        variant: 'destructive',
        title: 'Erro no diagnóstico',
        description: msg,
      })
    } finally {
      setTestandoCredenciais(false)
    }
  }

  // Sincronizar Agora
  const handleSincronizarAgora = async () => {
    if (!empresa?.id || !tenant?.id) return

    setSincronizando(true)
    try {
      const res = await nfeDestinatarioService.sincronizarAgora({
        tenant_id: tenant.id,
        empresa_id: empresa.id,
      })

      if (res.sucesso) {
        toast({
          title: 'Sincronização SEFAZ concluída!',
          description: res.mensagem,
        })
      } else {
        toast({
          variant: 'default',
          title: 'Operação em Modo Supervisão',
          description: res.mensagem,
        })
      }

      await Promise.all([loadNotas(), loadLogs(), loadInitialData()])
      if (onSyncCompleted) onSyncCompleted()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao sincronizar com a SEFAZ.'
      toast({
        variant: 'destructive',
        title: 'Erro de comunicação',
        description: msg,
      })
    } finally {
      setSincronizando(false)
    }
  }

  // Abrir modal de manifestação
  const handleOpenManifestar = (nota: NfeRecebidaRecord) => {
    setNotaSelecionada(nota)
    setTipoManifSelecionada(
      nota.status_manifestacao === 'sem_manifestacao' ? 'confirmada' : nota.status_manifestacao,
    )
    setJustificativaManif(nota.justificativa_manifestacao || '')
    setManifestarModalOpen(true)
  }

  // Submeter manifestação
  const handleSubmitManifestacao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!notaSelecionada) return

    if (tipoManifSelecionada === 'nao_realizada' && justificativaManif.trim().length < 15) {
      toast({
        variant: 'destructive',
        title: 'Justificativa obrigatória',
        description:
          'Para Operação Não Realizada a SEFAZ exige justificativa de no mínimo 15 caracteres.',
      })
      return
    }

    setEnviandoManif(true)
    try {
      const res = await nfeDestinatarioService.registrarManifestacao({
        nfe_id: notaSelecionada.id,
        tipo_manifestacao: tipoManifSelecionada,
        justificativa: justificativaManif.trim() || undefined,
      })

      toast({
        title: 'Manifestação Registrada!',
        description: res.mensagem,
      })

      setManifestarModalOpen(false)
      setNotaSelecionada(null)
      setJustificativaManif('')
      await loadNotas()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao manifestar nota fiscal.'
      toast({
        variant: 'destructive',
        title: 'Erro na manifestação',
        description: msg,
      })
    } finally {
      setEnviandoManif(false)
    }
  }

  // Importar por chave manual pública de 44 dígitos
  const handleImportarChaveManual = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!empresa?.id || !tenant?.id) return

    const chaveLimpa = chaveManualInput.replace(/\D/g, '').trim()
    if (chaveLimpa.length !== 44) {
      toast({
        variant: 'destructive',
        title: 'Chave de Acesso Inválida',
        description: 'A chave deve conter exatamente 44 dígitos numéricos.',
      })
      return
    }

    setImportandoChaveManual(true)
    try {
      const res = await nfeDestinatarioService.consultarChaveManual({
        tenant_id: tenant.id,
        empresa_id: empresa.id,
        chave_acesso: chaveLimpa,
        razao_social_emitente: razaoEmitManual.trim() || undefined,
        valor_total: valorManual ? parseFloat(valorManual.replace(',', '.')) : undefined,
      })

      toast({
        title: 'NF-e importada no GED!',
        description: `${res.mensagem} (NF ${res.numero} - ${res.emitente})`,
      })

      setChaveManualModalOpen(false)
      setChaveManualInput('')
      setRazaoEmitManual('')
      setValorManual('')
      await Promise.all([loadNotas(), loadLogs(), loadInitialData()])
      if (onSyncCompleted) onSyncCompleted()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao importar chave de acesso.'
      toast({
        variant: 'destructive',
        title: 'Falha na importação',
        description: msg,
      })
    } finally {
      setImportandoChaveManual(false)
    }
  }

  // Badges e Estilos
  const renderManifestacaoBadge = (status: NfeStatusManifestacao) => {
    switch (status) {
      case 'confirmada':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold gap-1 text-[11px]">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Confirmação da Operação
          </Badge>
        )
      case 'ciencia':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300 font-semibold gap-1 text-[11px]">
            <Clock className="w-3 h-3 text-blue-600" />
            Ciência da Emissão
          </Badge>
        )
      case 'desconhecida':
        return (
          <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-semibold gap-1 text-[11px]">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Desconhecimento
          </Badge>
        )
      case 'nao_realizada':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-300 font-semibold gap-1 text-[11px]">
            <ShieldX className="w-3 h-3 text-red-600" />
            Não Realizada
          </Badge>
        )
      case 'sem_manifestacao':
      default:
        return (
          <Badge
            variant="outline"
            className="bg-slate-50 text-slate-700 border-slate-300 text-[11px]"
          >
            Sem Manifestação
          </Badge>
        )
    }
  }

  const renderStatusConexaoBadge = () => {
    if (!config || !config.busca_automatica_ativa) {
      return (
        <Badge
          variant="outline"
          className="bg-slate-50 text-slate-600 border-slate-300 gap-1.5 py-1 px-3"
        >
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Busca Inativa</span>
        </Badge>
      )
    }

    if (config.status_conexao === 'conectado') {
      return (
        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-300 gap-1.5 py-1 px-3 font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>WebService SEFAZ Ativo</span>
        </Badge>
      )
    }

    if (config.status_conexao === 'modo_supervisao') {
      return (
        <Badge className="bg-amber-50 text-amber-800 border border-amber-300 gap-1.5 py-1 px-3 font-semibold">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
          <span>Modo Supervisão (Transparente)</span>
        </Badge>
      )
    }

    return (
      <Badge className="bg-red-50 text-red-700 border border-red-300 gap-1.5 py-1 px-3 font-semibold">
        <ShieldX className="w-3.5 h-3.5 text-red-600" />
        <span>Credenciais Pendentes</span>
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Banner de Status & Indicador Transparente de Modo Supervisão */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-xs overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 via-[#0B1F3A] to-[#0A3055] p-5 sm:p-6 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FileCode className="h-5 w-5 text-[#0FA3A3]" />
                <h3 className="text-base sm:text-lg font-bold">
                  Busca Automática de NF-e (Módulo Destinatário / SEFAZ DFe)
                </h3>
              </div>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Varredura direta no WebService <strong>nfeDistDFeInteresse</strong> da SEFAZ para
                captura de todas as notas fiscais eletrônicas (entradas e devoluções) emitidas
                contra o CNPJ <strong>{maskCnpj(empresa.cnpj)}</strong> com importação automática
                para o GED.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {renderStatusConexaoBadge()}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestarCredenciais(true)}
                disabled={testandoCredenciais}
                className="bg-white/10 text-white border-white/20 hover:bg-white/20 text-xs h-8 gap-1.5 rounded-xl"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testandoCredenciais ? 'animate-spin' : ''}`} />
                <span>Testar Conexão</span>
              </Button>
              <Button
                size="sm"
                onClick={handleSincronizarAgora}
                disabled={sincronizando}
                className="bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs h-8 gap-1.5 rounded-xl font-semibold shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${sincronizando ? 'animate-spin' : ''}`} />
                <span>{sincronizando ? 'Buscando SEFAZ...' : 'Buscar NF-e Agora'}</span>
              </Button>
            </div>
          </div>

          {/* Card interno caso esteja em Modo Supervisão */}
          {isModoSupervisao && (
            <div className="mt-4 rounded-xl bg-amber-500/15 border border-amber-400/30 p-3.5 flex items-start gap-3 text-xs text-amber-200">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-amber-300">
                  Modo Supervisão Ativo (Sem Falso Sucesso)
                </span>
                <p className="text-amber-100 text-[11px] leading-relaxed">
                  A SEFAZ exige certificado <strong>e-CNPJ A1 com senha</strong> para o canal seguro
                  mTLS de Distribuição DF-e. Enquanto as credenciais não forem preenchidas na aba
                  Configuração, você pode consultar notas individualmente pela{' '}
                  <strong>chave de 44 dígitos</strong> ou anexar arquivos XML/DANFE no GED.
                </p>
              </div>
            </div>
          )}

          {/* Régua de Estatísticas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/10 text-xs">
            <div>
              <span className="text-slate-400 text-[11px]">Notas no Sistema:</span>
              <p className="font-bold text-sm text-white">{notas.length}</p>
            </div>
            <div>
              <span className="text-slate-400 text-[11px]">Último NSU SEFAZ:</span>
              <p className="font-mono text-xs text-teal-300">
                {config?.ultimo_nsu || '000000000000000'}
              </p>
            </div>
            <div>
              <span className="text-slate-400 text-[11px]">Última Sincronização:</span>
              <p className="text-xs text-white">
                {config?.ultima_sincronizacao_em
                  ? formatDateTimePtBr(config.ultima_sincronizacao_em)
                  : 'Nunca executada'}
              </p>
            </div>
            <div>
              <span className="text-slate-400 text-[11px]">Job Diário das 08h:</span>
              <p className="text-xs text-teal-300 font-semibold">
                {buscaAtiva ? 'Monitoramento Ativo' : 'Pausado'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Navegação Secundária da Ficha de NF-e */}
      <Tabs
        value={activeSubTab}
        onValueChange={(v) => setActiveSubTab(v as 'notas' | 'configuracao' | 'historico')}
        className="w-full"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
          <TabsList className="bg-slate-100 p-1 rounded-xl h-10 w-full sm:w-auto justify-start">
            <TabsTrigger
              value="notas"
              className="rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-white data-[state=active]:text-[#0FA3A3]"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Notas Recebidas ({notas.length})</span>
            </TabsTrigger>
            <TabsTrigger
              value="configuracao"
              className="rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-white data-[state=active]:text-[#0FA3A3]"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Configuração & WebService</span>
            </TabsTrigger>
            <TabsTrigger
              value="historico"
              className="rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-white data-[state=active]:text-[#0FA3A3]"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Histórico de Varreduras ({logs.length})</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setChaveManualModalOpen(true)}
              className="text-xs rounded-xl h-9 gap-1.5 border-[#E2E8F0] hover:bg-slate-50 font-semibold text-[#1A2333]"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#0FA3A3]" />
              <span>Importar Chave 44 Dígitos</span>
            </Button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* ABA 1: NOTAS FISCAIS RECEBIDAS & MANIFESTAÇÃO */}
        {/* ========================================================================= */}
        <TabsContent value="notas" className="pt-4 space-y-4 m-0">
          {/* Barra de Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-white p-3 rounded-2xl border border-[#E2E8F0]">
            <div className="sm:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por emitente, CNPJ, chave 44 dígitos ou número..."
                className="h-9 pl-9 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            <div>
              <Select value={statusManifFilter} onValueChange={(val) => setStatusManifFilter(val)}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Manifestação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as manifestações</SelectItem>
                  <SelectItem value="sem_manifestacao">Sem Manifestação</SelectItem>
                  <SelectItem value="ciencia">Ciência da Operação</SelectItem>
                  <SelectItem value="confirmada">Confirmação da Operação</SelectItem>
                  <SelectItem value="desconhecida">Desconhecimento</SelectItem>
                  <SelectItem value="nao_realizada">Operação Não Realizada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadNotas}
                className="w-full text-xs h-9 rounded-xl border-[#E2E8F0] gap-1.5"
              >
                <Filter className="w-3.5 h-3.5 text-[#0FA3A3]" />
                <span>Filtrar</span>
              </Button>
            </div>
          </div>

          {/* Tabela de Notas */}
          <Card className="rounded-2xl border-[#E2E8F0] shadow-xs overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                      <th className="py-3 px-4">Emissão</th>
                      <th className="py-3 px-4">NF / Série</th>
                      <th className="py-3 px-4">Fornecedor / Emitente</th>
                      <th className="py-3 px-4 text-right">Valor Total</th>
                      <th className="py-3 px-4">Manifestação Destinatário</th>
                      <th className="py-3 px-4">Origem</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingNotas ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          Carregando notas fiscais recebidas...
                        </td>
                      </tr>
                    ) : notas.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          Nenhuma NF-e localizada para este filtro. Clique em &quot;Buscar NF-e
                          Agora&quot; ou &quot;Importar Chave 44 Dígitos&quot;.
                        </td>
                      </tr>
                    ) : (
                      notas.map((nota) => (
                        <tr
                          key={nota.id}
                          className="hover:bg-slate-50/75 transition-colors cursor-pointer"
                          onClick={() => {
                            setNotaSelecionada(nota)
                            setDetalheModalOpen(true)
                          }}
                        >
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-semibold text-slate-900">
                              {formatDatePtBr(nota.data_emissao)}
                            </span>
                            <div className="text-[10px] text-slate-500 font-mono">
                              NSU {nota.nsu || '—'}
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-bold text-slate-900">
                              Nº {nota.numero || 'S/N'}
                            </span>
                            <span className="text-slate-500 text-[11px] ml-1">
                              (Série {nota.serie || '1'})
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div
                              className="font-semibold text-slate-900 truncate max-w-xs"
                              title={nota.razao_social_emitente}
                            >
                              {nota.nome_fantasia_emitente || nota.razao_social_emitente}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                              <span>{maskCnpj(nota.cnpj_emitente)}</span>
                              {nota.uf_emitente && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1 py-0 h-4 uppercase"
                                >
                                  {nota.uf_emitente}
                                </Badge>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <span className="font-bold text-slate-900">
                              {nota.valor_total.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </span>
                            {nota.valor_icms && nota.valor_icms > 0 ? (
                              <div className="text-[10px] text-slate-500">
                                ICMS:{' '}
                                {nota.valor_icms.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}
                              </div>
                            ) : null}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            {renderManifestacaoBadge(nota.status_manifestacao)}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-[10px] font-semibold gap-1">
                              <Sparkles className="w-2.5 h-2.5 text-teal-600" />
                              Busca SEFAZ
                            </Badge>
                          </td>

                          <td
                            className="py-3 px-4 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenManifestar(nota)}
                                disabled={!canEdit}
                                className="h-7 text-xs rounded-lg px-2.5 font-semibold text-[#0FA3A3] border-teal-200 hover:bg-teal-50"
                              >
                                Manifestar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setNotaSelecionada(nota)
                                  setDetalheModalOpen(true)
                                }}
                                className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA 2: CONFIGURAÇÃO DO WEBSERVICE SEFAZ & CREDENCIAIS */}
        {/* ========================================================================= */}
        <TabsContent value="configuracao" className="pt-4 space-y-6 m-0">
          <form onSubmit={handleSalvarConfig} className="space-y-6">
            <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-[#1A2333]">
                  Parâmetros de Varredura SEFAZ Distribuição DFe
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  Configuração por empresa com autenticação mTLS e controle de NSU sequencial
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-4 space-y-6 text-xs">
                {/* Switch Ativação */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="space-y-0.5 max-w-lg">
                    <Label className="text-xs font-bold text-slate-900">
                      Ativar Busca Automática de NF-e
                    </Label>
                    <p className="text-[11px] text-slate-500">
                      Quando ativo, o robô diário das 08h varre a SEFAZ e traz as notas fiscais
                      recebidas para o GED e painel de manifestação.
                    </p>
                  </div>
                  <Switch
                    checked={buscaAtiva}
                    onCheckedChange={setBuscaAtiva}
                    disabled={!canEdit}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Ambiente */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-900">Ambiente SEFAZ *</Label>
                    <Select
                      value={ambiente}
                      onValueChange={(val: 'producao' | 'homologacao') => setAmbiente(val)}
                      disabled={!canEdit}
                    >
                      <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                        <SelectValue placeholder="Selecione o ambiente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="producao">Produção Oficial SEFAZ</SelectItem>
                        <SelectItem value="homologacao">Homologação / Testes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Certificado Vinculado */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-900">
                      Certificado e-CNPJ A1 Vinculado *
                    </Label>
                    <Select
                      value={certificadoId}
                      onValueChange={setCertificadoId}
                      disabled={!canEdit || certificados.length === 0}
                    >
                      <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                        <SelectValue
                          placeholder={
                            certificados.length === 0
                              ? 'Nenhum certificado A1 cadastrado'
                              : 'Selecione o certificado'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {certificados.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.titular} ({c.tipo.toUpperCase()} - {c.emissor})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {certificados.length === 0 && (
                      <p className="text-[11px] text-amber-600 flex items-center gap-1 mt-1">
                        <AlertTriangle className="w-3 h-3" />
                        Cadastre o certificado A1 da empresa na aba &quot;Certificado Digital&quot;.
                      </p>
                    )}
                  </div>

                  {/* Senha do Certificado */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-900">
                      Senha do Arquivo .PFX (Chave Privada)
                    </Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        type="password"
                        value={senhaCertificado}
                        onChange={(e) => setSenhaCertificado(e.target.value)}
                        placeholder="Senha para assinatura da requisição DFe"
                        className="h-10 pl-9 text-xs rounded-xl border-[#E2E8F0]"
                        disabled={!canEdit}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Necessária para descriptografar o certificado A1 e assinar o envelope SOAP
                      nfeDistDFeInteresse.
                    </p>
                  </div>

                  {/* Status Conexão / Diagnóstico Rápido */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-900">
                      Status Atual de Comunicação
                    </Label>
                    <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                      <div>{renderStatusConexaoBadge()}</div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTestarCredenciais(true)}
                        className="h-7 text-xs text-[#0FA3A3] font-semibold"
                      >
                        Ver Diagnóstico
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Opções de Automação */}
                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <h4 className="font-bold text-slate-900 text-xs">Comportamento de Automação</h4>

                  <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-semibold text-slate-900">
                        Importação Automática para o GED
                      </Label>
                      <p className="text-[11px] text-slate-500">
                        Cada nota localizada gera um documento com XML no GED da empresa com badge
                        de origem &quot;Busca SEFAZ&quot;.
                      </p>
                    </div>
                    <Switch
                      checked={autoImportarGed}
                      onCheckedChange={setAutoImportarGed}
                      disabled={!canEdit}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-semibold text-slate-900">
                        Registrar Ciência da Operação Automaticamente
                      </Label>
                      <p className="text-[11px] text-slate-500">
                        Gera o evento de &quot;Ciência da Emissão&quot; (210210) assim que a NF-e é
                        detectada para liberação do XML completo na SEFAZ.
                      </p>
                    </div>
                    <Switch
                      checked={autoCiencia}
                      onCheckedChange={setAutoCiencia}
                      disabled={!canEdit}
                    />
                  </div>
                </div>

                {/* Ações */}
                {canEdit && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <Button
                      type="submit"
                      disabled={savingConfig}
                      className="bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs h-9 px-5 rounded-xl font-semibold shadow-xs"
                    >
                      {savingConfig ? 'Salvando Parâmetros...' : 'Salvar Parâmetros'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </form>
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA 3: HISTÓRICO DE VARREDURAS (LOGS E AUDITORIA) */}
        {/* ========================================================================= */}
        <TabsContent value="historico" className="pt-4 space-y-4 m-0">
          <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-[#1A2333]">
                  Histórico de Sincronizações SEFAZ
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  Auditoria de todas as consultas executadas via robô ou manualmente
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadLogs}
                disabled={loadingLogs}
                className="h-8 text-xs rounded-xl"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingLogs ? 'animate-spin' : ''}`} />
                <span>Atualizar</span>
              </Button>
            </CardHeader>

            <CardContent className="p-0">
              <div className="divide-y divide-slate-100 text-xs">
                {logs.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    Nenhum log registrado para esta empresa ainda.
                  </div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <div className="flex items-center gap-2">
                          {log.sucesso ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <ShieldAlert className="w-4 h-4 text-amber-500" />
                          )}
                          <span className="font-semibold text-slate-900">{log.mensagem}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatDateTimePtBr(log.created)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          Origem: {log.origem_acionamento.replace('_', ' ')}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          Modo: {log.modo_operacao.replace('_', ' ')}
                        </Badge>
                        <span>Duração: {log.duracao_ms}ms</span>
                        <span>•</span>
                        <span>Novas notas: {log.notas_novas_importadas}</span>
                        {log.ultimo_nsu_consultado && (
                          <>
                            <span>•</span>
                            <span className="font-mono">NSU: {log.ultimo_nsu_consultado}</span>
                          </>
                        )}
                        {log.expand?.executado_por?.name && (
                          <>
                            <span>•</span>
                            <span>Por: {log.expand.executado_por.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ========================================================================= */}
      {/* MODAL: DIAGNÓSTICO ITEM A ITEM DA CONEXÃO SEFAZ */}
      {/* ========================================================================= */}
      <Dialog open={diagModalOpen} onOpenChange={setDiagModalOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#0FA3A3]" />
              Diagnóstico de Conexão SEFAZ DFe
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Verificação transparente dos pré-requisitos para busca de notas fiscais emitidas
              contra o CNPJ {maskCnpj(empresa.cnpj)}
            </DialogDescription>
          </DialogHeader>

          {diagnostico && (
            <div className="space-y-4 pt-2 text-xs">
              <div
                className={`p-3 rounded-xl border text-xs ${
                  diagnostico.status === 'conectado'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <p className="font-semibold">{diagnostico.mensagem}</p>
                <p className="text-[11px] opacity-80 mt-1">
                  Verificado em: {formatDateTimePtBr(diagnostico.data_verificacao)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
                <div className="p-3 flex items-center justify-between">
                  <span>Certificado e-CNPJ Detectado</span>
                  {diagnostico.itens_checados.certificado_detectado ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                      Detectado
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px]">
                      Não Cadastrado
                    </Badge>
                  )}
                </div>

                <div className="p-3 flex items-center justify-between">
                  <span>Tipo do Certificado (A1 em arquivo .pfx)</span>
                  {diagnostico.itens_checados.certificado_tipo_a1 ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                      A1 Válido
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-900 border-amber-200 text-[10px]">
                      Pendente A1
                    </Badge>
                  )}
                </div>

                <div className="p-3 flex items-center justify-between">
                  <span>Senha do Certificado Configurada</span>
                  {diagnostico.itens_checados.senha_presente ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                      Presente
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-900 border-amber-200 text-[10px]">
                      Não Informada
                    </Badge>
                  )}
                </div>

                <div className="p-3 flex items-center justify-between">
                  <span>Ambiente Selecionado</span>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {diagnostico.itens_checados.ambiente}
                  </Badge>
                </div>

                <div className="p-3 flex items-center justify-between">
                  <span>WebService SEFAZ DFe (nfeDistDFeInteresse)</span>
                  {diagnostico.itens_checados.comunicacao_sefaz_dist_dfe ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                      Homologado
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-[10px]">
                      Aguardando Credenciais
                    </Badge>
                  )}
                </div>

                <div className="p-3 flex items-center justify-between">
                  <span>Consulta Pública Chave 44 Dígitos</span>
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px]">
                    Disponível
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDiagModalOpen(false)}
              className="text-xs rounded-xl"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: REGISTRAR MANIFESTAÇÃO DO DESTINATÁRIO */}
      {/* ========================================================================= */}
      <Dialog open={manifestarModalOpen} onOpenChange={setManifestarModalOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base text-slate-900 flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-[#0FA3A3]" />
              Manifestação do Destinatário
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Registre a manifestação jurídica sobre a NF-e recebida conforme legislação da SEFAZ
            </DialogDescription>
          </DialogHeader>

          {notaSelecionada && (
            <form onSubmit={handleSubmitManifestacao} className="space-y-4 pt-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">
                    NF nº {notaSelecionada.numero} (Série {notaSelecionada.serie})
                  </span>
                  <span className="font-bold text-slate-900">
                    {notaSelecionada.valor_total.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 truncate">
                  Emitente: {notaSelecionada.razao_social_emitente} (
                  {maskCnpj(notaSelecionada.cnpj_emitente)})
                </p>
                <p className="text-[10px] font-mono text-slate-400 truncate">
                  Chave: {notaSelecionada.chave_acesso}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-900">
                  Tipo de Manifestação *
                </Label>
                <Select
                  value={tipoManifSelecionada}
                  onValueChange={(val: NfeStatusManifestacao) => setTipoManifSelecionada(val)}
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmada">
                      Confirmação da Operação (210200) — Operação ocorrida e mercadoria recebida
                    </SelectItem>
                    <SelectItem value="ciencia">
                      Ciência da Emissão (210210) — Ciente da emissão, mercadoria a caminho
                    </SelectItem>
                    <SelectItem value="desconhecida">
                      Desconhecimento da Operação (210220) — Não solicitou nem reconhece a compra
                    </SelectItem>
                    <SelectItem value="nao_realizada">
                      Operação Não Realizada (210240) — Devolução/Sinistro/Carga não entregue
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(tipoManifSelecionada === 'nao_realizada' ||
                tipoManifSelecionada === 'desconhecida') && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-900">
                    Justificativa Obrigatória SEFAZ *
                  </Label>
                  <Textarea
                    rows={3}
                    value={justificativaManif}
                    onChange={(e) => setJustificativaManif(e.target.value)}
                    placeholder="Descreva o motivo (mínimo de 15 caracteres: ex.: Mercadoria avariada durante transporte e devolvida integralmente)."
                    className="text-xs rounded-xl border-[#E2E8F0]"
                  />
                  <p className="text-[10px] text-slate-400">
                    Caracteres: {justificativaManif.trim().length}/15 mínimo
                  </p>
                </div>
              )}

              {isModoSupervisao && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-800">
                  <strong>Modo Supervisão:</strong> A manifestação será registrada no banco de dados
                  e histórico de auditoria, e será transmitida automaticamente à SEFAZ assim que as
                  credenciais A1 forem informadas.
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setManifestarModalOpen(false)}
                  className="text-xs rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={enviandoManif}
                  className="bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs rounded-xl font-semibold shadow-xs"
                >
                  {enviandoManif ? 'Transmitindo...' : 'Confirmar Manifestação'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: DETALHES COMPLETOS DA NOTA RECEBIDA */}
      {/* ========================================================================= */}
      <Dialog open={detalheModalOpen} onOpenChange={setDetalheModalOpen}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base text-slate-900 flex items-center justify-between">
              <span>
                NF-e nº {notaSelecionada?.numero} (Série {notaSelecionada?.serie})
              </span>
              <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-[10px]">
                Origem: Busca SEFAZ
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 font-mono break-all">
              Chave: {notaSelecionada?.chave_acesso}
            </DialogDescription>
          </DialogHeader>

          {notaSelecionada && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-[11px] text-slate-500">Valor Total:</span>
                  <p className="font-bold text-sm text-slate-900">
                    {notaSelecionada.valor_total.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500">ICMS Destacado:</span>
                  <p className="font-bold text-sm text-slate-900">
                    {(notaSelecionada.valor_icms || 0).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500">CFOP Principal:</span>
                  <p className="font-semibold text-slate-900">
                    {notaSelecionada.cfop_principal || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500">Data de Emissão:</span>
                  <p className="font-semibold text-slate-900">
                    {formatDatePtBr(notaSelecionada.data_emissao)}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500">Data Autorização:</span>
                  <p className="font-semibold text-slate-900">
                    {formatDatePtBr(notaSelecionada.data_autorizacao)}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500">NSU SEFAZ:</span>
                  <p className="font-mono text-slate-900">{notaSelecionada.nsu || '—'}</p>
                </div>
              </div>

              <div className="space-y-1 border border-slate-200 rounded-xl p-3">
                <span className="font-bold text-slate-900 text-xs">Dados do Emitente</span>
                <p className="text-slate-800 font-semibold">
                  {notaSelecionada.razao_social_emitente}
                </p>
                <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                  <span>CNPJ: {maskCnpj(notaSelecionada.cnpj_emitente)}</span>
                  <span>UF: {notaSelecionada.uf_emitente || '—'}</span>
                </div>
                {notaSelecionada.natureza_operacao && (
                  <p className="text-[11px] text-slate-600 mt-1">
                    <strong>Natureza da Operação:</strong> {notaSelecionada.natureza_operacao}
                  </p>
                )}
              </div>

              <div className="space-y-1 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">Manifestação Atual</span>
                  {renderManifestacaoBadge(notaSelecionada.status_manifestacao)}
                </div>
                {notaSelecionada.data_manifestacao && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Manifestado em: {formatDateTimePtBr(notaSelecionada.data_manifestacao)}
                    {notaSelecionada.expand?.manifestado_por?.name && (
                      <span> por {notaSelecionada.expand.manifestado_por.name}</span>
                    )}
                  </p>
                )}
                {notaSelecionada.justificativa_manifestacao && (
                  <p className="text-[11px] text-slate-700 bg-slate-50 p-2 rounded-lg mt-1 italic">
                    &quot;{notaSelecionada.justificativa_manifestacao}&quot;
                  </p>
                )}
              </div>

              {/* Link para o documento no GED */}
              {notaSelecionada.documento_ged && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-900">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-teal-600" />
                    <div>
                      <span className="font-bold">Documento Arquivado no GED</span>
                      <p className="text-[11px] text-teal-700">
                        XML de entrada protegido contra duplicidade por chave de 44 dígitos
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-teal-600 text-white text-[10px]">Anti-duplicidade OK</Badge>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDetalheModalOpen(false)}
              className="text-xs rounded-xl"
            >
              Fechar
            </Button>
            {notaSelecionada && canEdit && (
              <Button
                size="sm"
                onClick={() => {
                  setDetalheModalOpen(false)
                  handleOpenManifestar(notaSelecionada)
                }}
                className="bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs rounded-xl font-semibold"
              >
                Alterar Manifestação
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: IMPORTAÇÃO MANUAL VIA CHAVE DE 44 DÍGITOS (CONSULTA PÚBLICA SEFAZ) */}
      {/* ========================================================================= */}
      <Dialog open={chaveManualModalOpen} onOpenChange={setChaveManualModalOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base text-slate-900 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-[#0FA3A3]" />
              Importar NF-e por Chave Pública de 44 Dígitos
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Permite importar qualquer nota fiscal eletrônica colando a chave de acesso. Os
              metadados principais são extraídos e o documento é arquivado no GED.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleImportarChaveManual} className="space-y-4 pt-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-900">
                Chave de Acesso (44 dígitos numéricos) *
              </Label>
              <Input
                value={chaveManualInput}
                onChange={(e) => setChaveManualInput(e.target.value)}
                placeholder="Ex: 41260305882194000185550010000412891823749102"
                maxLength={44}
                className="h-10 text-xs font-mono rounded-xl border-[#E2E8F0]"
                required
              />
              <p className="text-[10px] text-slate-400">
                Dígitos: {chaveManualInput.replace(/\D/g, '').length}/44
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-900">
                  Fornecedor / Emitente (Opcional)
                </Label>
                <Input
                  value={razaoEmitManual}
                  onChange={(e) => setRazaoEmitManual(e.target.value)}
                  placeholder="Nome do fornecedor"
                  className="h-10 text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-900">
                  Valor Total R$ (Opcional)
                </Label>
                <Input
                  value={valorManual}
                  onChange={(e) => setValorManual(e.target.value)}
                  placeholder="Ex: 1250,00"
                  className="h-10 text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <span className="font-semibold text-slate-900">Como funciona:</span>
              <p>
                O sistema valida a chave, extrai a UF, CNPJ do emitente, número e série da nota,
                verifica a anti-duplicidade e cria automaticamente o registro na coleção do GED com
                a flag de origem &quot;Busca SEFAZ&quot;.
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setChaveManualModalOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={
                  importandoChaveManual || chaveManualInput.replace(/\D/g, '').length !== 44
                }
                className="bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs rounded-xl font-semibold shadow-xs"
              >
                {importandoChaveManual ? 'Importando...' : 'Importar para o GED'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

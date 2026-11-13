import React, { useState, useEffect } from 'react'
import {
  KeyRound,
  Terminal,
  Copy,
  Check,
  Play,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  Send,
  Plus,
  Trash2,
  ExternalLink,
  Shield,
  Activity,
  Code2,
  Laptop,
  BookOpen,
  ScanLine,
  ListChecks,
  Globe,
  FolderSync,
  UploadCloud,
  FileText,
  Layers,
  CheckCheck,
  Zap,
  ShieldCheck,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import {
  elisaOpsService,
  type EllizaAgenteExternoChaveRecord,
  type BlueprintTarefaAprovada,
  type TipoIntegracaoAgente,
} from '@/services/elisaOpsService'
import { formatDatePtBr } from '@/lib/formatters'

interface PainelAgenteExternoProps {
  tenantId: string
  onRefreshFila?: () => void
}

export function PainelAgenteExterno({ tenantId, onRefreshFila }: PainelAgenteExternoProps) {
  const { toast } = useToast()

  // Chaves
  const [chaves, setChaves] = useState<EllizaAgenteExternoChaveRecord[]>([])
  const [loadingChaves, setLoadingChaves] = useState(true)
  const [chaveSelecionada, setChaveSelecionada] = useState<string>(
    'elliza_agt_live_99482fbc71a340e58832a884ef',
  )

  // Modal nova credencial
  const [modalNovaChaveAberta, setModalNovaChaveAberta] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoIdentificador, setNovoIdentificador] = useState('')
  const [novoTipo, setNovoTipo] = useState<TipoIntegracaoAgente>('playwright_computer_use')
  const [salvandoChave, setSalvandoChave] = useState(false)
  const [chaveGeradaPlana, setChaveGeradaPlana] = useState<string | null>(null)

  // Testador / Simulador interativo do Ciclo Completo
  const [testandoTarefas, setTestandoTarefas] = useState(false)
  const [tarefasEncontradas, setTarefasEncontradas] = useState<BlueprintTarefaAprovada[]>([])
  const [tarefaSelecionada, setTarefaSelecionada] = useState<BlueprintTarefaAprovada | null>(null)
  const [executandoAcao, setExecutandoAcao] = useState(false)
  const [logExecucao, setLogExecucao] = useState<string[]>([])

  // Payload da evidência e conclusão
  const [protocoloDemo, setProtocoloDemo] = useState('PROT-ECAC-2026-9812')
  const [descricaoEvidencia, setDescricaoEvidencia] = useState(
    'Guia DAS gerada e capturada com sucesso no portal PGDAS-D / e-CAC.',
  )
  const [salvarGed, setSalvarGed] = useState(true)

  // Copiado
  const [copiado, setCopiado] = useState(false)

  // API Key dedicada ELLIZA Desktop (revelada sob demanda / cópia única)
  const [mostrarKeyDesktop, setMostrarKeyDesktop] = useState(false)
  const rawKeyEllizaDesktopPadrao = 'elliza_agt_live_desktop_c89a24fe10bb73e921'

  const loadChaves = async () => {
    if (!tenantId) return
    setLoadingChaves(true)
    try {
      const res = await elisaOpsService.listChavesAgenteExterno(tenantId)
      setChaves(res)
    } catch (err) {
      console.error('Erro ao listar chaves:', err)
    } finally {
      setLoadingChaves(false)
    }
  }

  useEffect(() => {
    loadChaves()
  }, [tenantId])

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString('pt-BR')
    setLogExecucao((prev) => [`[${time}] ${msg}`, ...prev])
  }

  const handleCriarChave = async () => {
    if (!novoNome.trim() || !novoIdentificador.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campos Obrigatórios',
        description: 'Informe o nome amigável e o identificador do agente.',
      })
      return
    }

    setSalvandoChave(true)
    try {
      const res = await elisaOpsService.criarChaveAgenteExterno({
        tenantId,
        nome: novoNome,
        identificadorAgente: novoIdentificador.toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
        tipoIntegracao: novoTipo,
      })
      setChaveGeradaPlana(res.apiKeyPlana)
      setChaveSelecionada(res.apiKeyPlana)
      toast({
        title: 'Credencial Criada com Sucesso!',
        description:
          'Guarde o token de API. Por motivos de segurança, ele não será exibido novamente.',
      })
      loadChaves()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar chave',
        description: String(err),
      })
    } finally {
      setSalvandoChave(false)
    }
  }

  const handleRevogarChave = async (id: string) => {
    if (
      !confirm(
        'Deseja realmente revogar esta credencial? Agentes usando esta chave perderão o acesso imediatamente.',
      )
    )
      return
    try {
      await elisaOpsService.revogarChaveAgenteExterno(id, tenantId)
      toast({ title: 'Chave revogada com sucesso.' })
      loadChaves()
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao revogar', description: String(err) })
    }
  }

  // Ações do Simulador do Ciclo Completo
  const handleBuscarTarefasAprovadas = async () => {
    if (!chaveSelecionada.trim()) {
      toast({
        variant: 'destructive',
        title: 'Informe a API Key',
        description: 'Selecione ou insira a chave do agente.',
      })
      return
    }
    setTestandoTarefas(true)
    addLog(
      `🔍 Agente buscando tarefas com status APROVADO via GET /backend/v1/elliza-agente/tarefas-aprovadas...`,
    )
    try {
      const res = await elisaOpsService.testarEndpointBuscarTarefasAprovadas(chaveSelecionada)
      if (res.sucesso && res.tarefas) {
        setTarefasEncontradas(res.tarefas)
        addLog(`✓ Tarefas aprovadas encontradas: ${res.tarefas.length}`)
        if (res.tarefas.length > 0) {
          setTarefaSelecionada(res.tarefas[0])
          addLog(
            `✓ Blueprint carregado para Job [${res.tarefas[0].job_codigo}]: ${res.tarefas[0].processo.titulo}`,
          )
        }
      } else {
        addLog(`❌ Erro retornado pela API: ${res.erro}`)
        toast({ variant: 'destructive', title: 'Falha na busca', description: res.erro })
      }
    } catch (err: any) {
      addLog(`❌ Exceção de rede: ${err.message}`)
    } finally {
      setTestandoTarefas(false)
    }
  }

  const handleIniciarJobSelecionado = async () => {
    if (!tarefaSelecionada) return
    setExecutandoAcao(true)
    addLog(
      `🚀 Agente iniciando Job [${tarefaSelecionada.job_codigo}] via POST /backend/v1/elliza-agente/tarefas/${tarefaSelecionada.job_id}/iniciar...`,
    )
    try {
      const res = await elisaOpsService.testarEndpointIniciarJob(
        tarefaSelecionada.job_id,
        chaveSelecionada,
      )
      if (res.sucesso) {
        addLog(
          `✓ Job iniciado com sucesso! Status alterado para EM_EXECUCAO no banco e audit_log gravado.`,
        )
        toast({ title: 'Job Iniciado', description: 'Transicionado para EM_EXECUCAO.' })
        onRefreshFila?.()
      } else {
        addLog(`❌ Erro ao iniciar: ${res.erro}`)
      }
    } catch (err: any) {
      addLog(`❌ Falha: ${err.message}`)
    } finally {
      setExecutandoAcao(false)
    }
  }

  const handleEnviarEvidenciaEDevolverSucesso = async () => {
    if (!tarefaSelecionada) return
    setExecutandoAcao(true)
    addLog(
      `📸 Agente enviando evidência com hash SHA-256 via POST /backend/v1/elliza-agente/tarefas/${tarefaSelecionada.job_id}/evidencias...`,
    )
    try {
      // 1. Enviar Evidência
      const shaDemo = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      const evRes = await elisaOpsService.testarEndpointEnviarEvidencia(
        tarefaSelecionada.job_id,
        chaveSelecionada,
        {
          titulo: `Evidência DAS Capturada — ${tarefaSelecionada.job_codigo}`,
          tipo: 'screenshot',
          protocolo_numero: protocoloDemo,
          numero_operacao: `OP-${Date.now().toString().slice(-6)}`,
          hash_sha256: shaDemo,
          descricao: descricaoEvidencia,
          salvar_no_ged: salvarGed,
          resultado_obtido:
            'Guia DAS e extrato do Simples Nacional emitidos com êxito sem divergências.',
        },
      )

      if (!evRes.sucesso) {
        addLog(`❌ Erro no envio da evidência: ${evRes.erro}`)
        setExecutandoAcao(false)
        return
      }

      addLog(
        `✓ Evidência salva em elisa_evidencias! ID: ${evRes.dados?.evidencia_id} | Protocolo: ${protocoloDemo} | Hash SHA-256 gravado | GED: ${salvarGed ? 'Sim' : 'Não'}`,
      )

      // 2. Concluir Job com validação explícita de critério de sucesso
      addLog(
        `✅ Agente concluindo tarefa com critério de sucesso validado via POST /backend/v1/elliza-agente/tarefas/${tarefaSelecionada.job_id}/concluir...`,
      )
      const concRes = await elisaOpsService.testarEndpointConcluirJob(
        tarefaSelecionada.job_id,
        chaveSelecionada,
        {
          resultado: `Concluído pelo Agente Playwright com sucesso. Protocolo: ${protocoloDemo}.`,
          criterio_sucesso_validado: true,
          tempo_execucao_segundos: 28,
        },
      )

      if (concRes.sucesso) {
        addLog(
          `✓ Job CONCLUÍDO! Próxima etapa identificada: ${concRes.dados?.proxima_etapa?.titulo || 'Processo 100% finalizado'}.`,
        )
        addLog(`✓ Trilha de auditoria gerada em audit_log.`)
        toast({
          title: 'Ciclo Completo Executado!',
          description: 'Evidência enviada com hash SHA-256 e tarefa concluída com sucesso.',
        })
        onRefreshFila?.()
        handleBuscarTarefasAprovadas()
      } else {
        addLog(`❌ Erro na conclusão: ${concRes.erro}`)
      }
    } catch (err: any) {
      addLog(`❌ Falha no ciclo: ${err.message}`)
    } finally {
      setExecutandoAcao(false)
    }
  }

  const handleReportarExcecao = async () => {
    if (!tarefaSelecionada) return
    const motivo = prompt(
      'Informe por que o agente parou (Ex.: Erro 503 no portal e-CAC ou Certificado Digital sem procuração):',
    )
    if (!motivo) return
    const decisao = prompt(
      'Qual decisão humana é necessária? (Ex.: Contador deve renovar a procuração eletrônica no e-CAC):',
    )
    if (!decisao) return

    setExecutandoAcao(true)
    addLog(
      `⚠️ Agente reportando exceção estruturada via POST /backend/v1/elliza-agente/tarefas/${tarefaSelecionada.job_id}/reportar-erro...`,
    )
    try {
      const res = await elisaOpsService.testarEndpointReportarErro(
        tarefaSelecionada.job_id,
        chaveSelecionada,
        {
          por_que_parou: motivo,
          decisao_necessaria: decisao,
          o_que_foi_executado: 'Navegação até a tela de emissão via Playwright.',
          o_que_falta: 'Validação da procuração e reemissão da guia.',
          status_processo: 'BLOQUEADO',
        },
      )
      if (res.sucesso) {
        addLog(
          `✓ Exceção registrada no Modo Humano! Pendência ID: ${res.dados?.pendencia_id}. Processo retido como BLOQUEADO.`,
        )
        toast({
          title: 'Exceção Registrada',
          description: 'Processo retido no Modo Humano sem adivinhação.',
        })
        onRefreshFila?.()
        handleBuscarTarefasAprovadas()
      } else {
        addLog(`❌ Erro ao reportar: ${res.erro}`)
      }
    } catch (err: any) {
      addLog(`❌ Falha: ${err.message}`)
    } finally {
      setExecutandoAcao(false)
    }
  }

  const copiarTexto = (txt: string) => {
    navigator.clipboard.writeText(txt)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
    toast({ title: 'Copiado para a área de transferência!' })
  }

  return (
    <div className="space-y-6">
      {/* Card Oficial de Registro: ELLIZA Desktop (RPA PC Local) */}
      <Card
        id="rpa-cadastro-elliza-desktop"
        className="rounded-2xl border-teal-300 bg-gradient-to-br from-teal-900 via-slate-900 to-slate-950 text-white p-5 shadow-md relative overflow-hidden"
      >
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="p-1.5 bg-teal-500/20 rounded-lg border border-teal-400/30">
                <Laptop className="h-5 w-5 text-teal-300" />
              </div>
              <h3 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                ELLIZA Desktop (RPA Local no PC do Usuário)
              </h3>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/40 text-[10px] font-bold">
                Agente Ativo (Oficial Rumo)
              </Badge>
              <Badge className="bg-teal-500/20 text-teal-200 border-teal-400/30 text-[10px]">
                Contrato v1.0
              </Badge>
              <Badge variant="outline" className="text-slate-300 border-slate-700 text-[10px]">
                Substituição do Domínio
              </Badge>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Software RPA de terceiros com licença adquirida e instalado no PC do escritório. Atua
              como o<strong> braço executor local oficial da plataforma Rumo</strong> para rotinas
              contábeis, fiscais e folha, substituindo a operação legado do software Domínio.
              Comunica-se exclusivamente via endpoints autenticados da esteira{' '}
              <code>/backend/v1/elliza-agente/*</code>.
            </p>

            {/* Painel de Conexão: Base URL Oficial do Backend PocketBase + Chave de API */}
            <div className="pt-2 space-y-3">
              {/* Bloco Base URL em Destaque com Aviso SPA vs Backend */}
              <div className="p-3.5 bg-slate-950 border-2 border-teal-400/50 rounded-xl space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-mono text-teal-300 font-bold flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-teal-400" />
                    Base URL Oficial da API (Host PocketBase):
                  </span>
                  <Button
                    size="sm"
                    onClick={() =>
                      copiarTexto(
                        'https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev',
                      )
                    }
                    className="h-6 text-[10px] bg-teal-600 hover:bg-teal-500 text-white font-bold gap-1 px-2.5"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Copiar Base URL</span>
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value="https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev"
                    className="h-8 font-mono text-xs bg-slate-900 border-teal-500/40 text-emerald-300 font-semibold select-all"
                  />
                </div>

                <div className="rounded-lg bg-amber-500/15 border border-amber-400/30 p-2.5 text-[11px] text-amber-200 leading-relaxed space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                    <span>ATENÇÃO: NÃO UTILIZE O DOMÍNIO PÚBLICO PARA A API</span>
                  </div>
                  <p>
                    O domínio público{' '}
                    <code className="text-amber-100 font-mono font-bold bg-slate-900/80 px-1 py-0.5 rounded">
                      rumoconsultoriacontabil.com.br
                    </code>{' '}
                    serve <strong>apenas a interface web (React SPA)</strong> e{' '}
                    <strong>NÃO serve /backend/v1/*</strong>. Chamadas para o domínio público
                    devolvem a página HTML do SPA (404) e quebram a deserialização JSON do conector.
                  </p>
                  <p className="text-[10px] text-slate-300">
                    No conector ELLIZA Desktop, preencha o campo <em>Base URL / Servidor da API</em>{' '}
                    com:{' '}
                    <code className="text-emerald-300 font-mono">
                      https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev
                    </code>
                  </p>
                </div>
              </div>

              {/* Chave de API Dedicada */}
              <div className="p-3 bg-slate-900/90 border border-teal-500/30 rounded-xl space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-teal-300 font-bold flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-teal-400" />
                    Chave de API Dedicada (X-Elliza-Api-Key):
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setMostrarKeyDesktop(!mostrarKeyDesktop)}
                      className="h-6 text-[10px] text-slate-300 hover:text-white hover:bg-slate-800"
                    >
                      {mostrarKeyDesktop ? 'Ocultar Chave' : 'Exibir Chave'}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        copiarTexto(rawKeyEllizaDesktopPadrao)
                        setChaveSelecionada(rawKeyEllizaDesktopPadrao)
                      }}
                      className="h-6 text-[10px] bg-teal-600 hover:bg-teal-500 text-white font-bold gap-1 px-2.5"
                    >
                      <Copy className="h-3 w-3" />
                      <span>Copiar Chave do Agente</span>
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    type={mostrarKeyDesktop ? 'text' : 'password'}
                    value={rawKeyEllizaDesktopPadrao}
                    className="h-8 font-mono text-xs bg-slate-950 border-slate-800 text-teal-300 select-all"
                  />
                </div>

                <div className="text-[11px] text-slate-400 flex flex-col sm:flex-row sm:items-center gap-2 pt-1 border-t border-slate-800">
                  <span className="font-semibold text-slate-300">Onde colar no Desktop:</span>
                  <span className="text-slate-400">
                    No software ELLIZA Desktop em{' '}
                    <em>
                      Configurações &gt; Integração Rumo Cloud &gt; Token de Autenticação (API Key)
                    </em>
                    .
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs space-y-1">
              <span className="font-bold text-slate-200 block text-[11px]">
                Identificador do Agente:
              </span>
              <code className="text-teal-300 font-mono font-bold">elliza-desktop-rpa</code>
              <div className="text-[10px] text-slate-400 pt-1">
                Autonomia: Nível 2 Supervisionado
              </div>
              <div className="text-[10px] text-emerald-400 font-medium">
                Privilégio Mínimo: Fila &amp; Telemetria
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => {
                setNovoNome('')
                setNovoIdentificador('')
                setChaveGeradaPlana(null)
                setModalNovaChaveAberta(true)
              }}
              variant="outline"
              className="text-white border-slate-700 bg-slate-800/70 hover:bg-slate-700 text-xs h-8 gap-1.5 font-bold shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Outra Credencial</span>
            </Button>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="simulador" className="space-y-4">
        <TabsList className="bg-slate-100 p-1 border border-slate-200 flex-wrap">
          <TabsTrigger value="simulador" className="text-xs font-semibold gap-1.5">
            <Activity className="h-3.5 w-3.5 text-[#0FA3A3]" />
            <span>Simulador do Ciclo Completo</span>
          </TabsTrigger>
          <TabsTrigger value="manual" className="text-xs font-semibold gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-teal-600" />
            <span>Manual de Operação (POP-EX-01)</span>
          </TabsTrigger>
          <TabsTrigger value="robo-scanner" className="text-xs font-semibold gap-1.5">
            <ScanLine className="h-3.5 w-3.5 text-indigo-600" />
            <span>Robô 1 — Scanner → GED (POP-EX-02)</span>
          </TabsTrigger>
          <TabsTrigger value="sincronizacao-pasta" className="text-xs font-semibold gap-1.5">
            <FolderSync className="h-3.5 w-3.5 text-teal-600" />
            <span>Sincronização Pasta → GED (POP-EX-03)</span>
          </TabsTrigger>
          <TabsTrigger value="credenciais" className="text-xs font-semibold gap-1.5">
            <KeyRound className="h-3.5 w-3.5 text-amber-600" />
            <span>Contas de Serviço & Tokens ({chaves.length})</span>
          </TabsTrigger>
          <TabsTrigger value="documentacao" className="text-xs font-semibold gap-1.5">
            <Code2 className="h-3.5 w-3.5 text-blue-600" />
            <span>Contrato da API & Script Python</span>
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: SIMULADOR DO CICLO COMPLETO */}
        <TabsContent value="simulador" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Coluna Esquerda: Controle do Agente */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-[#0FA3A3]" />
                    <span className="font-bold text-xs text-slate-900">
                      Credencial Ativa do Agente
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] text-emerald-700 bg-emerald-50 border-emerald-300"
                  >
                    Autenticado
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-700">
                    Token / API Key:
                  </label>
                  <Input
                    value={chaveSelecionada}
                    onChange={(e) => setChaveSelecionada(e.target.value)}
                    placeholder="elliza_agt_live_..."
                    className="h-8 font-mono text-xs"
                  />
                  <p className="text-[10px] text-slate-400">
                    Token demo pré-carregado com perfil operacional dedicado (não usa admin).
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={handleBuscarTarefasAprovadas}
                  disabled={testandoTarefas}
                  className="w-full h-8 text-xs bg-slate-800 hover:bg-slate-900 text-white gap-2 font-semibold"
                >
                  <RotateCw className={`h-3.5 w-3.5 ${testandoTarefas ? 'animate-spin' : ''}`} />
                  <span>Passo 1: Buscar Tarefas APROVADAS na Fila</span>
                </Button>
              </Card>

              {/* Lista de Tarefas Aprovadas Prontas para Coleta */}
              <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">
                    Tarefas Aprovadas Aptas ({tarefasEncontradas.length})
                  </span>
                  <Badge className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]">
                    Status: APROVADO
                  </Badge>
                </div>

                {tarefasEncontradas.length === 0 ? (
                  <div className="border border-dashed border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
                    Clique em <strong>Buscar Tarefas APROVADAS</strong> para que o agente liste as
                    atividades liberadas pelo Modo Humano.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {tarefasEncontradas.map((t) => (
                      <div
                        key={t.job_id}
                        onClick={() => setTarefaSelecionada(t)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                          tarefaSelecionada?.job_id === t.job_id
                            ? 'border-[#0FA3A3] bg-teal-50/50 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono font-bold text-slate-900">{t.job_codigo}</span>
                          <Badge className="bg-emerald-600 text-white text-[9px] uppercase font-bold">
                            {t.status}
                          </Badge>
                        </div>
                        <p className="font-semibold text-slate-800 truncate">{t.processo.titulo}</p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {t.cliente.razao_social} • CNPJ: {t.cliente.cnpj}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Ações de Execução e Retorno */}
              {tarefaSelecionada && (
                <Card className="rounded-2xl border-teal-200 bg-teal-50/30 p-4 shadow-xs space-y-3">
                  <span className="font-bold text-xs text-slate-900 block border-b pb-2">
                    Comandos do Agente para o Job: {tarefaSelecionada.job_codigo}
                  </span>

                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      size="sm"
                      onClick={handleIniciarJobSelecionado}
                      disabled={executandoAcao}
                      className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1.5"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>Passo 2: Iniciar Execução (EM_EXECUCAO)</span>
                    </Button>

                    <div className="space-y-2 pt-2 border-t border-teal-200/60">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-700">
                          Protocolo Retornado:
                        </label>
                        <Input
                          value={protocoloDemo}
                          onChange={(e) => setProtocoloDemo(e.target.value)}
                          className="h-7 text-xs font-mono bg-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-700">
                          Descrição / Resumo:
                        </label>
                        <Input
                          value={descricaoEvidencia}
                          onChange={(e) => setDescricaoEvidencia(e.target.value)}
                          className="h-7 text-xs bg-white"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          id="salvarGedCheck"
                          checked={salvarGed}
                          onChange={(e) => setSalvarGed(e.target.checked)}
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                        <label
                          htmlFor="salvarGedCheck"
                          className="text-[11px] text-slate-700 font-medium cursor-pointer"
                        >
                          Registrar documento gerado no GED do cliente
                        </label>
                      </div>

                      <Button
                        size="sm"
                        onClick={handleEnviarEvidenciaEDevolverSucesso}
                        disabled={executandoAcao}
                        className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 shadow-xs"
                      >
                        <FileCheck2 className="h-3.5 w-3.5" />
                        <span>Passo 3: Enviar Evidência (SHA-256) & Concluir</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleReportarExcecao}
                        disabled={executandoAcao}
                        className="w-full h-8 text-xs border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 font-semibold gap-1.5"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        <span>Reportar Exceção Honesta (Bloquear com Segurança)</span>
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </div>

            {/* Coluna Direita: Contexto do Blueprint Estruturado + Console de Logs */}
            <div className="lg:col-span-7 space-y-4">
              {/* Blueprint da Tarefa */}
              <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-[#0FA3A3]" />
                    <span className="font-bold text-xs text-slate-900">
                      Contexto Estruturado do Blueprint (Entregue ao Agente)
                    </span>
                  </div>
                  {tarefaSelecionada && (
                    <Badge variant="outline" className="text-[10px] text-slate-600">
                      POP: {tarefaSelecionada.pop_relacionado}
                    </Badge>
                  )}
                </div>

                {tarefaSelecionada ? (
                  <div className="space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">
                          Cliente
                        </span>
                        <strong className="text-slate-900">
                          {tarefaSelecionada.cliente.razao_social}
                        </strong>
                        <span className="text-[10px] text-slate-500 font-mono block">
                          CNPJ: {tarefaSelecionada.cliente.cnpj}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">
                          Competência & Área
                        </span>
                        <span className="font-semibold text-slate-800">
                          {tarefaSelecionada.competencia}
                        </span>
                        <span className="text-[10px] text-teal-700 font-semibold block uppercase">
                          {tarefaSelecionada.area}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
                        <span className="font-bold text-emerald-950 block text-[11px] mb-0.5">
                          ✓ Critério Rigoroso de Sucesso:
                        </span>
                        <p className="text-emerald-900 text-[11px] leading-snug">
                          {tarefaSelecionada.criterio_sucesso}
                        </p>
                      </div>

                      <div className="bg-red-50 border border-red-200 p-2.5 rounded-xl">
                        <span className="font-bold text-red-950 block text-[11px] mb-0.5">
                          ⚠️ Critério de Erro:
                        </span>
                        <p className="text-red-900 text-[11px] leading-snug">
                          {tarefaSelecionada.criterio_erro}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-[11px] overflow-x-auto space-y-1">
                      <span className="text-slate-400 block text-[10px]">
                        # Próxima Ação Determinística:
                      </span>
                      <p className="text-teal-300 font-semibold">
                        {tarefaSelecionada.proxima_acao}
                      </p>
                      <span className="text-slate-400 block text-[10px] pt-1">
                        # Diretriz em caso de erro:
                      </span>
                      <p className="text-amber-300 text-[10px]">
                        {tarefaSelecionada.o_que_fazer_em_caso_de_erro}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Selecione uma tarefa aprovada à esquerda para inspecionar os parâmetros do
                    blueprint.
                  </div>
                )}
              </Card>

              {/* Console de Auditoria em Tempo Real */}
              <Card className="rounded-2xl border-slate-900 bg-slate-950 text-slate-200 p-4 shadow-xs space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-emerald-400" />
                    <span className="font-mono text-xs font-bold text-white">
                      Console de Execução & Auditoria
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLogExecucao([])}
                    className="h-6 text-[10px] text-slate-400 hover:text-white"
                  >
                    Limpar
                  </Button>
                </div>

                <div className="font-mono text-[11px] space-y-1 max-h-[220px] overflow-y-auto pr-1">
                  {logExecucao.length === 0 ? (
                    <span className="text-slate-600 block">
                      Aguardando disparo de comandos pelo agente externo...
                    </span>
                  ) : (
                    logExecucao.map((log, idx) => (
                      <div key={idx} className="leading-tight text-slate-300">
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ABA NOVAL: MANUAL DE OPERAÇÃO RUMO (POP-EX-01) + CHECKLIST DE VALIDAÇÃO DO 1º CICLO */}
        <TabsContent value="manual" className="space-y-6">
          {/* Card com o Manual de Operação RUMO Integral */}
          <Card
            id="rpa-manual-operacao-rumo"
            className="rounded-2xl border-slate-200 bg-white p-6 shadow-xs space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-teal-500/10 rounded-lg border border-teal-500/20 text-[#0FA3A3]">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <h3 className="font-black text-lg text-slate-900 tracking-tight">
                    MANUAL DE OPERAÇÃO RUMO — AGENTE EXTERNO ELLIZA DESKTOP (RPA)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Versão do contrato: <strong className="text-slate-800">Trilha RPA v1.0</strong> ·
                  Público:{' '}
                  <code className="font-mono text-teal-700 font-bold">
                    ELLIZA desktop (elliza-desktop-rpa)
                  </code>{' '}
                  · Base URL Oficial da API:{' '}
                  <code className="font-mono text-emerald-700 font-bold">
                    https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev
                  </code>{' '}
                  · Catálogo 2026.4: <strong className="text-teal-700">POP-EX-01</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge className="bg-teal-600 text-white font-bold text-[10px]">
                  POP-EX-01 (Ativo)
                </Badge>
                <Badge variant="outline" className="text-slate-600 text-[10px]">
                  Versão 2026.4
                </Badge>
              </div>
            </div>

            {/* Seção 1 */}
            <div className="space-y-2">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-white text-[10px]">
                  1
                </span>
                1. Identidade e privilégios
              </h4>
              <p className="text-xs text-slate-700 leading-relaxed pl-7">
                Você é a <strong>ELLIZA desktop</strong>, executora local (RPA) da plataforma Rumo.
                Privilégios mínimos por design: acesso <strong>APENAS</strong> aos endpoints{' '}
                <code className="text-teal-700 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                  /backend/v1/elliza-agente/*
                </code>{' '}
                no host do PocketBase (
                <strong>https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev</strong>).
                O domínio público <code>rumoconsultoriacontabil.com.br</code> serve exclusivamente o
                front-end React SPA e <strong>NÃO deve ser usado pelo conector</strong> (devolve
                404/HTML). Nunca acessar banco, painel de administração ou qualquer outra rota —
                tentativa é rejeitada e registrada. Credencial: API key dedicada no header{' '}
                <code className="font-mono text-slate-900 bg-slate-100 px-1 py-0.5 rounded">
                  X-Elliza-Api-Key
                </code>{' '}
                (ou <code>Authorization: Bearer &lt;key&gt;</code>) em <strong>TODA</strong>{' '}
                chamada. Onde configurar:{' '}
                <em>Configurações → Integração Rumo Cloud → Token de Autenticação</em>.
              </p>
            </div>

            {/* Seção 2 */}
            <div className="space-y-2">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-white text-[10px]">
                  2
                </span>
                2. O ciclo de operação (loop contínuo, intervalo 30–60s)
              </h4>
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-700 leading-relaxed pl-7">
                <li>
                  <strong>Polling</strong> —{' '}
                  <code className="font-mono text-emerald-700">
                    GET /backend/v1/elliza-agente/buscar-aprovadas
                  </code>{' '}
                  → retorna as tarefas aprovadas no Nível 3 pela supervisão humana (ou vazio;
                  aguarde e reinicie)
                </li>
                <li>
                  <strong>Ler tarefa + contexto</strong> — cada tarefa traz <code>job_id</code>,{' '}
                  <code>processo_id</code>, POP de referência e payload de execução
                </li>
                <li>
                  <strong>Navegar à tela do processo e ler o estado</strong> pelos atributos de
                  telemetria (seção 4) — nunca por texto visual
                </li>
                <li>
                  <strong>Executar a ação no PC</strong> (RPA local, ZAP, OCR etc.)
                </li>
                <li>
                  <strong>Capturar evidência</strong> — screenshot antes/depois + hash{' '}
                  <strong>SHA-256</strong> do arquivo
                </li>
                <li>
                  <strong>Reportar</strong> — <code>POST /iniciar</code> ao começar;{' '}
                  <code>POST /concluir</code> ao terminar; <code>POST /erro</code> se falhar;
                  evidências via <code>POST /evidencias</code>
                </li>
                <li>
                  <strong>Reiniciar o polling</strong>
                </li>
              </ol>
            </div>

            {/* Seção 3 */}
            <div className="space-y-2">
              <h4 className="font-bold text-sm text-rose-900 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-white text-[10px]">
                  3
                </span>
                3. Regra de Ouro (inegociável)
              </h4>
              <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-950 leading-relaxed ml-7">
                <p>
                  Nunca marcar etapa como concluída por inferência. Só há conclusão quando:{' '}
                  <strong>(a)</strong> o indicador inequívoco da tela confirma (
                  <code className="bg-white px-1 py-0.5 rounded border border-rose-200">
                    #rpa-status-conclusao
                  </code>{' '}
                  com{' '}
                  <code className="bg-white px-1 py-0.5 rounded border border-rose-200">
                    data-rpa-state=&quot;success&quot;
                  </code>
                  ), E <strong>(b)</strong>{' '}
                  <code className="bg-white px-1 py-0.5 rounded border border-rose-200 font-bold">
                    criterio_sucesso_validado: true
                  </code>{' '}
                  é enviado no <code>/concluir</code> — sem ele a chamada retorna{' '}
                  <strong>400</strong> e a etapa permanece em execução. Se houver dúvida,
                  divergência ou dado faltando:{' '}
                  <strong>pare honestamente e reporte via /erro</strong>. Nunca invente valor para
                  fechar etapa.
                </p>
              </div>
            </div>

            {/* Seção 4 */}
            <div className="space-y-2">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-white text-[10px]">
                  4
                </span>
                4. Contrato de telemetria visual (Trilha RPA v1.0)
              </h4>
              <div className="ml-7 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b">
                    <tr>
                      <th className="py-2 px-3">Elemento</th>
                      <th className="py-2 px-3">Seletor / Atributo</th>
                      <th className="py-2 px-3">Uso Operacional</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-900">Etapa de processo</td>
                      <td className="py-2 px-3 font-mono text-teal-700">
                        [data-step-code] com data-step-status=&quot;pending|running|done|error&quot;
                        e data-job-id
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        Decidir se executa e vincular à tarefa da API
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        Grid de lançamentos
                      </td>
                      <td className="py-2 px-3 font-mono text-teal-700">
                        #rpa-grid-lancamentos, #rpa-grid-balancete com data-total-rows,
                        data-total-debito, data-total-credito, data-diferenca, data-rpa-equilibrado
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        Raspar sem perder linha; exigir data-diferenca=&quot;0.00&quot;
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-900">Conciliação</td>
                      <td className="py-2 px-3 font-mono text-teal-700">
                        #rpa-grid-conciliacao com data-total-rows, data-pendencias-count
                      </td>
                      <td className="py-2 px-3 text-slate-600">Ler pendências por atributo</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-900">Botão de ação</td>
                      <td className="py-2 px-3 font-mono text-teal-700">
                        #rpa-btn-executar com data-action-code e data-enabled-reason
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        Só clicar quando habilitado; se desabilitado, ler o motivo
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-900">Botão depreciação</td>
                      <td className="py-2 px-3 font-mono text-teal-700">
                        #rpa-btn-rodar-depreciacao com data-competencia
                      </td>
                      <td className="py-2 px-3 text-slate-600">Módulo Patrimônio</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-900">Log da aplicação</td>
                      <td className="py-2 px-3 font-mono text-teal-700">
                        #rpa-log-container com linhas data-log-level=&quot;info|warn|error&quot; e
                        data-log-timestamp
                      </td>
                      <td className="py-2 px-3 text-slate-600">Registrar erros como evidência</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-900">Conclusão</td>
                      <td className="py-2 px-3 font-mono text-teal-700">
                        #rpa-status-conclusao com data-rpa-state=&quot;success|error|open&quot;
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        Único indicador válido de fim de rotina
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-900">Ficha da empresa</td>
                      <td className="py-2 px-3 font-mono text-teal-700">
                        #rpa-empresa-ficha; campos com data-rpa-field / data-rpa-value; QSA em
                        #rpa-grid-qsa com data-socio-cpf, data-socio-participacao
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        Fonte única de dados cadastrais e societários
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        Pedidos de Documentos / GED
                      </td>
                      <td className="py-2 px-3 font-mono text-teal-700">
                        #rpa-grid-documentos com data-total-rows, data-pedido-id, data-rpa-status
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        Leitura determinística de pedidos e documentos anexados
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-500 pl-7 italic">
                Governança: seletores são contrato versionado; qualquer mudança passa pela aba
                Agente Externo (RPA) em /elisa-fila — nunca presuma que um seletor antigo continua
                válido.
              </p>
            </div>

            {/* Seção 5 */}
            <div className="space-y-2">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-white text-[10px]">
                  5
                </span>
                5. Mapa de telas da plataforma
              </h4>
              <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-700 pl-7 leading-relaxed">
                <li>
                  <code className="font-mono text-teal-700">/elisa-fila</code> | Fila de tarefas
                  aprovadas + contrato | consultar; aba Agente Externo traz contrato e script Python
                  de referência
                </li>
                <li>
                  <code className="font-mono text-teal-700">/central-operacoes</code> | Operações e
                  SOPs em execução | ver contexto do processo antes de executar
                </li>
                <li>
                  <code className="font-mono text-teal-700">/empresas/:id</code> (aba Ficha
                  Cadastral) | Identificação, Societário, Parametrização | LER dados via{' '}
                  <code>data-rpa-field</code> para preencher portais externos
                </li>
                <li>
                  <code className="font-mono text-teal-700">/processos/:id</code> | Etapas do
                  processo com telemetria | executar etapas, ler status
                </li>
                <li>
                  <code className="font-mono text-teal-700">/portal-acessos</code> | Autorizações
                  (ex.: envio WhatsApp) | verificar autorização antes de qualquer envio
                </li>
                <li>
                  <code className="font-mono text-teal-700">/pop-treinamento</code> | POPs vigentes
                  (2026.4) | consultar regras do processo antes da 1ª execução
                </li>
              </ul>
            </div>

            {/* Seção 6 */}
            <div className="space-y-2">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-white text-[10px]">
                  6
                </span>
                6. Processos passo a passo
              </h4>
              <div className="space-y-2 pl-7 text-xs text-slate-700 leading-relaxed">
                <p>
                  <strong>6.1 Fechamento Contábil (POP-04, 16 etapas FCT-04):</strong> buscar tarefa
                  → navegar ao processo → localizar etapa pelo <code>data-step-code</code> → validar{' '}
                  <code>data-step-status=&quot;pending&quot;</code> → ler grid do balancete e
                  conferir <code>data-diferenca=&quot;0.00&quot;</code> → executar a ação (
                  <code>data-action-code</code>) → aguardar{' '}
                  <code>#rpa-status-conclusao[data-rpa-state=&quot;success&quot;]</code> → /concluir
                  com evidência.
                </p>
                <p>
                  <strong>6.2 Conciliação Bancária/Cartões (POP-05):</strong> ler{' '}
                  <code>#rpa-grid-conciliacao</code>; processar itens; se{' '}
                  <code>data-pendencias-count &gt; 0</code> ao final, reportar via /erro ou concluir
                  parcialmente com a pendência descrita — nunca concluir como &quot;success&quot;
                  com pendência aberta.
                </p>
                <p>
                  <strong>6.3 Consulta de dados cadastrais:</strong> navegar a{' '}
                  <code>/empresas/:id</code>, ler <code>#rpa-empresa-ficha</code> campo a campo via{' '}
                  <code>data-rpa-field</code>/<code>data-rpa-value</code>; societário via{' '}
                  <code>#rpa-grid-qsa</code>. Valor &quot;—&quot; significa &quot;sem dado&quot;:
                  não preencher com suposição.
                </p>
                <p>
                  <strong>6.4 Envio WhatsApp via ZAP (POP-AT-01):</strong> a plataforma NÃO envia;
                  ela enfileira. Buscar a tarefa aprovada, verificar a autorização da empresa em{' '}
                  <code>/portal-acessos</code>, executar o disparo pelo ZAP local e retornar
                  evidência (screenshot da mensagem enviada + hash). Histórico fica em{' '}
                  <code>whatsapp_envios</code>.
                </p>
                <p>
                  <strong>6.5 Scanner → GED:</strong> digitalizar/OCR do documento do cliente,
                  classificar e anexar ao pedido de documentos correspondente; evidência com hash.
                </p>
              </div>
            </div>

            {/* Seção 7 */}
            <div className="space-y-2">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-white text-[10px]">
                  7
                </span>
                7. Erros, limites e proibições
              </h4>
              <ul className="list-disc list-inside space-y-1 text-xs text-slate-700 pl-7 leading-relaxed">
                <li>
                  Falha de execução → <code>POST /erro</code> com mensagem legível; nunca retentar
                  silenciosamente além do limite configurado
                </li>
                <li>
                  Tarefa ambígua ou dado divergente → parada honesta (reportar, não improvisar)
                </li>
                <li className="font-semibold text-rose-700">
                  Proibido: concluir sem indicador inequívoco, alterar dados sem tarefa aprovada,
                  acessar rota fora da lista da seção 1, usar a Evolution API (descontinuada) para
                  WhatsApp
                </li>
              </ul>
            </div>
          </Card>

          {/* CHECKLIST DE VALIDAÇÃO DO PRIMEIRO CICLO (ENTREGA 2) */}
          <Card
            id="rpa-checklist-validacao-ciclo"
            className="rounded-2xl border-teal-300 bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 text-white p-6 shadow-md space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-teal-800/60 pb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-teal-500/20 rounded-lg border border-teal-400/40 text-teal-300">
                    <ListChecks className="h-5 w-5" />
                  </div>
                  <h4 className="font-black text-base text-white tracking-tight">
                    Checklist de Validação do Primeiro Ciclo (Ponta a Ponta)
                  </h4>
                </div>
                <p className="text-xs text-slate-300">
                  Passo a passo auditável para validar a integração no PC do escritório usando o job
                  demo oficial <strong>JOB-092026-WA-ZAP01</strong>.
                </p>
              </div>

              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-xs font-mono font-bold">
                Job Demo: JOB-092026-WA-ZAP01
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Etapa 1 */}
              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
                <div className="flex items-center gap-2 text-teal-300 font-bold">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-500 text-slate-950 text-[10px] font-black">
                    1
                  </span>
                  Configurar Base URL e API Key no PC
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  No software <strong>ELLIZA Desktop</strong> instalado no seu computador, abra{' '}
                  <em>Configurações → Integração Rumo Cloud</em>:
                </p>
                <div className="space-y-1 text-[10px] font-mono bg-slate-950 p-2 rounded border border-slate-800 text-slate-300">
                  <div>
                    <span className="text-slate-400">Base URL:</span>{' '}
                    <span className="text-emerald-300 select-all">
                      https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Token/Key:</span>{' '}
                    <span className="text-teal-300 select-all">{rawKeyEllizaDesktopPadrao}</span>
                  </div>
                </div>
                <p className="text-[10px] text-amber-300">
                  ⚠️ NÃO utilize rumoconsultoriacontabil.com.br (servidor do SPA).
                </p>
              </div>

              {/* Etapa 2 */}
              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
                <div className="flex items-center gap-2 text-teal-300 font-bold">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-500 text-slate-950 text-[10px] font-black">
                    2
                  </span>
                  Validar Autenticação e Polling no Backend
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Dispare a chamada de validação ou o polling diretamente no host PocketBase:
                </p>
                <code className="block text-[10px] font-mono bg-slate-950 p-1.5 rounded border border-slate-800 text-emerald-300 overflow-x-auto">
                  POST
                  https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev/backend/v1/elliza-agente/auth/validar
                </code>
                <p className="text-slate-400 text-[10px]">
                  Resultado esperado:{' '}
                  <code className="text-emerald-300">{`{"sucesso": true, "agente": ...}`}</code>. Em
                  seguida,{' '}
                  <code className="text-teal-300 font-mono">GET .../tarefas-aprovadas</code> retorna
                  o job <strong className="text-white">JOB-092026-WA-ZAP01</strong> com status{' '}
                  <span className="text-emerald-400 font-bold">APROVADO</span>.
                </p>
              </div>

              {/* Etapa 3 */}
              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
                <div className="flex items-center gap-2 text-teal-300 font-bold">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-500 text-slate-950 text-[10px] font-black">
                    3
                  </span>
                  Conferir Autorização &amp; Executar via ZAP
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  O robô verifica a autorização formal da empresa em{' '}
                  <code className="text-teal-300 font-mono">/portal-acessos</code> (Aba Envio Ativo
                  WhatsApp) e executa o disparo da mensagem através do aplicativo local{' '}
                  <strong>ZAP da ELLIZA desktop</strong>.
                </p>
              </div>

              {/* Etapa 4 */}
              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
                <div className="flex items-center gap-2 text-teal-300 font-bold">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-500 text-slate-950 text-[10px] font-black">
                    4
                  </span>
                  Devolver /iniciar → /evidencias → /concluir
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  A ELLIZA desktop chama{' '}
                  <code className="text-teal-300 font-mono">POST .../iniciar</code>, anexa a
                  evidência com screenshot e hash <strong>SHA-256</strong> em{' '}
                  <code className="text-teal-300 font-mono">POST .../evidencias</code> e finaliza
                  com <code className="text-teal-300 font-mono">POST .../concluir</code> com{' '}
                  <code>criterio_sucesso_validado: true</code>.
                </p>
                <p className="text-slate-400 text-[10px]">
                  Resultado esperado: HTTP 200 com{' '}
                  <code className="text-emerald-300">{`{"sucesso": true, "status": "CONCLUIDO"}`}</code>
                  .
                </p>
              </div>
            </div>

            {/* Exemplo de Chamada Completa em cURL com Base URL Correta */}
            <div className="rounded-xl border border-teal-500/40 bg-slate-950 p-4 space-y-3 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-bold text-teal-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Terminal className="h-4 w-4 text-teal-400" />
                  Exemplos de Chamada Completa (cURL) no Host Oficial:
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    copiarTexto(`# 1. Validação de Autenticação
curl -X POST "https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev/backend/v1/elliza-agente/auth/validar" \\
  -H "X-Elliza-Api-Key: ${rawKeyEllizaDesktopPadrao}" \\
  -H "Content-Type: application/json"

# 2. Polling de Tarefas Aprovadas
curl -X GET "https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev/backend/v1/elliza-agente/tarefas-aprovadas" \\
  -H "X-Elliza-Api-Key: ${rawKeyEllizaDesktopPadrao}"

# 3. Concluir Tarefa com Validação de Sucesso
curl -X POST "https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev/backend/v1/elliza-agente/concluir" \\
  -H "X-Elliza-Api-Key: ${rawKeyEllizaDesktopPadrao}" \\
  -H "Content-Type: application/json" \\
  -d '{"job_id": "JOB-092026-WA-ZAP01", "criterio_sucesso_validado": true, "resultado": "Homologado via ZAP desktop"}'`)
                  }
                  className="h-6 text-[10px] border-teal-500/40 text-teal-300 hover:text-white hover:bg-teal-900/40 gap-1"
                >
                  <Copy className="h-3 w-3" />
                  <span>Copiar Comandos cURL</span>
                </Button>
              </div>

              <div className="space-y-2 text-[11px] font-mono leading-relaxed overflow-x-auto text-slate-300 bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                <div className="text-slate-400">
                  // 1. Validar Autenticação (devolve 200 com agente identificado):
                </div>
                <div className="text-emerald-300">{`curl -X POST "https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev/backend/v1/elliza-agente/auth/validar" \\
  -H "X-Elliza-Api-Key: ${rawKeyEllizaDesktopPadrao}" \\
  -H "Content-Type: application/json"`}</div>
                <div className="text-slate-400 pt-1">// Resposta esperada:</div>
                <div className="text-slate-300">{`{"sucesso": true, "mensagem": "Autenticação de Agente Externo validada com sucesso.", "agente": {"identificador": "elliza-desktop-rpa", "status": "ativo"}}`}</div>

                <div className="text-slate-400 pt-2">// 2. Buscar Tarefas Aprovadas:</div>
                <div className="text-emerald-300">{`curl -X GET "https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev/backend/v1/elliza-agente/tarefas-aprovadas" \\
  -H "X-Elliza-Api-Key: ${rawKeyEllizaDesktopPadrao}"`}</div>
                <div className="text-slate-400 pt-1">// Resposta esperada:</div>
                <div className="text-slate-300">{`{"sucesso": true, "total_tarefas_aprovadas": 1, "tarefas": [{"job_id": "...", "job_codigo": "JOB-092026-WA-ZAP01", ...}]}`}</div>

                <div className="text-slate-400 pt-2">
                  // 3. Concluir Tarefa (com critério validado):
                </div>
                <div className="text-emerald-300">{`curl -X POST "https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev/backend/v1/elliza-agente/concluir" \\
  -H "X-Elliza-Api-Key: ${rawKeyEllizaDesktopPadrao}" \\
  -H "Content-Type: application/json" \\
  -d '{"job_id": "JOB-092026-WA-ZAP01", "criterio_sucesso_validado": true, "resultado": "Homologado via ZAP desktop"}'`}</div>
                <div className="text-slate-400 pt-1">// Resposta esperada:</div>
                <div className="text-slate-300">{`{"sucesso": true, "mensagem": "Job concluído com sucesso e esteira avançada.", "status": "CONCLUIDO"}`}</div>
              </div>
            </div>

            {/* Onde Conferir na Plataforma */}
            <div className="rounded-xl border border-teal-500/30 bg-slate-950/70 p-4 space-y-2 text-xs">
              <span className="font-bold text-teal-300 uppercase tracking-wider text-[11px] block">
                🔍 Onde e o que o usuário confere na plataforma após o ciclo:
              </span>
              <ul className="list-disc list-inside space-y-1.5 text-slate-300 leading-relaxed">
                <li>
                  <strong>Na tela /elisa-fila (Aba Tarefas &amp; Jobs):</strong> Localize o card{' '}
                  <code className="font-mono text-teal-300">JOB-092026-WA-ZAP01</code>. O status
                  deve transicionar de <span className="text-amber-400">APROVADO</span> para{' '}
                  <span className="text-emerald-400 font-bold">CONCLUIDO</span>, com resumo de
                  evidência e tempo de execução preenchidos.
                </li>
                <li>
                  <strong>No histórico de envios WhatsApp (whatsapp_envios):</strong> Acesse{' '}
                  <code>/portal-acessos</code> (Aba Envio Ativo WhatsApp). O registro com referência{' '}
                  <code className="font-mono text-teal-300">JOB-092026-WA-ZAP01</code> exibe status{' '}
                  <code>enviado</code> (ou enfileirado aguardando o ZAP) com canal{' '}
                  <code>zap_elliza_desktop</code> e recibo de entrega.
                </li>
                <li>
                  <strong>No painel de Evidências (/elisa-fila):</strong> Inspecione o registro em{' '}
                  <code>elisa_evidencias</code> contendo o hash criptográfico{' '}
                  <strong>SHA-256</strong> e comprovante anexado.
                </li>
              </ul>
            </div>
          </Card>
        </TabsContent>

        {/* ABA NOVA: ROBÔ 1 — SCANNER → GED (POP-EX-02) */}
        <TabsContent value="robo-scanner" className="space-y-6">
          <Card
            id="rpa-robo-scanner-ged"
            className="rounded-2xl border-slate-200 bg-white p-6 shadow-xs space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-indigo-600">
                    <ScanLine className="h-5 w-5" />
                  </div>
                  <h3 className="font-black text-lg text-slate-900 tracking-tight">
                    Robô 1 — Scanner → GED (Digitalização e Classificação)
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  Procedimento Operacional Padrão:{' '}
                  <strong className="text-indigo-700">POP-EX-02</strong> · Versão 2026.4 · Job
                  Template:{' '}
                  <code className="font-mono font-bold text-slate-800">JOB-092026-SCAN-GED01</code>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge className="bg-indigo-600 text-white font-bold text-[10px]">
                  POP-EX-02 (Ativo)
                </Badge>
                <Badge variant="outline" className="text-slate-600 text-[10px]">
                  Mapeamento Robô 1
                </Badge>
              </div>
            </div>

            {/* Descrição Geral e Objetivo */}
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-2 text-xs text-indigo-950 leading-relaxed">
              <strong className="block text-indigo-900 text-sm">
                Objetivo do Robô Scanner → GED:
              </strong>
              <p>
                Automatizar a esteira física-digital de documentos recebidos no escritório contábil.
                A <strong>ELLIZA desktop</strong> digitaliza o documento físico através do scanner
                local acoplado ao PC (ou monitora pasta local de digitalização), aplica
                reconhecimento óptico de caracteres (<strong>OCR</strong>), classifica o documento
                (extrato bancário, nota fiscal, contrato, fatura), identifica o cliente pelo CNPJ,
                localiza o pedido correspondente em{' '}
                <code className="font-mono">/pedidos-documentos</code> via telemetria determinística{' '}
                <code className="font-mono">#rpa-grid-documentos</code>, anexa o PDF ao GED e
                homologa a conclusão pela Regra de Ouro.
              </p>
            </div>

            {/* Passo a Passo Expandido (Seção 6.5 do Manual) */}
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-slate-900 uppercase tracking-wider text-[11px]">
                Passo a Passo Operacional do Robô (Etapas POP-EX-02):
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
                {/* Passo 1 */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white text-[10px]">
                      1
                    </span>
                    Digitalização
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Captura física pelo scanner local em resolução mínima de 300 DPI (PDF ou imagem
                    legível).
                  </p>
                </div>

                {/* Passo 2 */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white text-[10px]">
                      2
                    </span>
                    OCR &amp; Classificação
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Extração de texto via OCR da ELLIZA; categorização automática em tipologia
                    válida do catálogo.
                  </p>
                </div>

                {/* Passo 3 */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white text-[10px]">
                      3
                    </span>
                    Vincular Pedido
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Reconhece o CNPJ, navega a <code>/pedidos-documentos</code> e lê{' '}
                    <code>#rpa-grid-documentos</code>.
                  </p>
                </div>

                {/* Passo 4 */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white text-[10px]">
                      4
                    </span>
                    Anexar no GED
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Upload no repositório GED, baixa no item solicitado do pedido e cálculo do hash
                    SHA-256.
                  </p>
                </div>

                {/* Passo 5 */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white text-[10px]">
                      5
                    </span>
                    Regra de Ouro
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Disparo de <code>POST /evidencias</code> e <code>POST /concluir</code> com{' '}
                    <code>criterio_sucesso_validado: true</code>.
                  </p>
                </div>
              </div>
            </div>

            {/* Estrutura do Payload de Execução (Job Template) */}
            <div className="space-y-2">
              <span className="font-bold text-slate-900 text-xs uppercase tracking-wider block">
                Payload de Execução do Job Template (JOB-092026-SCAN-GED01):
              </span>

              <div className="bg-slate-950 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto">
                <pre>{`{
  "tipo_operacao": "SCANNER_GED_DIGITALIZACAO",
  "robo_codigo": "ROBO-01-SCANNER-GED",
  "empresa_id": "8p0e1w9y7szvtyy",
  "competencia": "09/2026",
  "pedido_documentos_id": "f3z8c3j8tv2p6kx",
  "categoria_documento": "extrato_bancario",
  "resolucao_dpi_minima": 300,
  "arquivos_esperados": [
    {
      "nome_sugerido": "extrato_bancario_itau_092026.pdf",
      "descricao": "Extrato bancário conta corrente Itaú Setembro/2026",
      "tipo": "extrato_bancario",
      "obrigatorio": true
    }
  ],
  "criterio_sucesso": "Documento digitalizado anexado ao GED, item do pedido marcado como recebido e evidência com hash SHA-256 devolvida.",
  "criterio_erro": "Falha no scanner, imagem ilegível ou erro ao indexar no GED contábil.",
  "timeout_segundos": 120
}`}</pre>
              </div>
            </div>

            {/* Critérios de Sucesso e Parada Honesta */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 space-y-1.5">
                <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Critérios de Sucesso Validáveis:
                </span>
                <ul className="list-disc list-inside text-emerald-900 space-y-1 text-[11px]">
                  <li>Documento anexado no GED com empresa_id correta</li>
                  <li>Item do pedido de documentos transicionado para &quot;recebido&quot;</li>
                  <li>Evidência com hash SHA-256 e recibo arquivado em elisa_evidencias</li>
                  <li>Indicador #rpa-status-conclusao validado</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 space-y-1.5">
                <span className="font-bold text-amber-950 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Diretriz de Parada Honesta:
                </span>
                <p className="text-amber-900 text-[11px] leading-relaxed">
                  Caso o documento digitalizado seja ilegível, o CNPJ não corresponda a nenhuma
                  empresa da carteira, ou não haja pedido de documentos aberto: a ELLIZA desktop{' '}
                  <strong>NUNCA adivinha ou anexa em cliente errado</strong>. Reporta imediatamente
                  via <code>POST /erro</code> e move o arquivo para a quarentena.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ABA NOVA: SINCRONIZAÇÃO PASTA LOCAL → GED (POP-EX-03) */}
        <TabsContent value="sincronizacao-pasta" className="space-y-6">
          <Card
            id="rpa-sincronizacao-pasta-ged"
            className="rounded-2xl border-slate-200 bg-white p-6 shadow-xs space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-teal-500/10 rounded-lg border border-teal-500/20 text-[#0FA3A3]">
                    <FolderSync className="h-5 w-5" />
                  </div>
                  <h3 className="font-black text-lg text-slate-900 tracking-tight">
                    Sincronização Pasta Local → GED (Agente ELLIZA Desktop)
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  Procedimento Operacional Padrão:{' '}
                  <strong className="text-teal-700">POP-EX-03</strong> · Versão 2026.4 · Job
                  Template:{' '}
                  <code className="font-mono font-bold text-slate-800">JOB-092026-SYNC-GED01</code>{' '}
                  · Endpoint:{' '}
                  <code className="font-mono text-emerald-700 font-bold">
                    POST /backend/v1/elliza-agente/upload-documento
                  </code>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge className="bg-[#0FA3A3] text-white font-bold text-[10px]">
                  POP-EX-03 (Ativo)
                </Badge>
                <Badge variant="outline" className="text-slate-600 text-[10px]">
                  Trilha RPA v1.0
                </Badge>
              </div>
            </div>

            {/* Descrição Geral e Objetivo */}
            <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-4 space-y-2 text-xs text-teal-950 leading-relaxed">
              <strong className="block text-teal-900 text-sm flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#0FA3A3]" />
                Objetivo da Tarefa Sincronização Pasta → GED:
              </strong>
              <p>
                Permitir que a <strong>ELLIZA desktop</strong> monitore pastas locais configuradas
                no computador do escritório (ex.:{' '}
                <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-teal-200">
                  C:\RumoContabil\Documentos\GED\&lt;CNPJ&gt;\&lt;AAAA-MM&gt;
                </code>
                ) e sincronize os arquivos novos com o GED contábil da Rumo de forma determinística,
                com <strong>deduplicação por hash SHA-256</strong> (arquivos repetidos não criam
                segunda cópia), <strong>classificação estrita por CNPJ e competência</strong> e{' '}
                <strong>parada honesta em arquivos não classificáveis</strong> (nunca adivinha
                destino; cria pendência humana imediata para conferência do contador).
              </p>
            </div>

            {/* Grid de Telemetria Trilha RPA v1.0 da Sincronização */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[#0FA3A3]" />
                  Telemetria Trilha RPA v1.0 — Indicadores de Sincronização:
                </h4>
                <span className="text-[11px] text-slate-500 font-mono">
                  Contrato #rpa-grid-sincronizacao-ged
                </span>
              </div>

              {/* Grid rpa-* com data-total-* */}
              <div
                id="rpa-grid-sincronizacao-ged"
                data-total-rows="3"
                data-total-arquivados="24"
                data-total-deduplicados="18"
                data-total-rejeitados="0"
                data-rpa-status="loaded"
                className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs"
              >
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">
                    Diretório Base Monitorado
                  </span>
                  <strong
                    className="text-slate-900 font-mono text-[11px] block truncate"
                    title="C:\RumoContabil\Documentos\GED"
                  >
                    C:\RumoContabil\GED
                  </strong>
                  <span className="text-[10px] text-teal-700 font-semibold block">
                    Padrão: CNPJ\AAAA-MM
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/70 shadow-2xs space-y-1">
                  <span className="text-[10px] text-emerald-800 uppercase font-bold block flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    Arquivados no GED
                  </span>
                  <strong className="text-emerald-950 text-lg font-black block">24</strong>
                  <span className="text-[10px] text-emerald-700 block">
                    Novos gravados com hash SHA-256
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/70 shadow-2xs space-y-1">
                  <span className="text-[10px] text-blue-800 uppercase font-bold block flex items-center gap-1">
                    <CheckCheck className="h-3 w-3 text-blue-600" />
                    Deduplicados (Já Existiam)
                  </span>
                  <strong className="text-blue-950 text-lg font-black block">18</strong>
                  <span className="text-[10px] text-blue-700 block">
                    Mesmo hash no GED (sem duplicata)
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 shadow-2xs space-y-1">
                  <span className="text-[10px] text-amber-800 uppercase font-bold block flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                    Rejeitados (Parada Honesta)
                  </span>
                  <strong className="text-amber-950 text-lg font-black block">0</strong>
                  <span className="text-[10px] text-amber-700 block">
                    Zero palpites; pendência humana
                  </span>
                </div>
              </div>
            </div>

            {/* As 4 Regras de Ouro da Sincronização */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0FA3A3] text-white text-[10px]">
                    1
                  </span>
                  Extração Determinística
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  O robô desktop extrai o CNPJ (14 dígitos) e a competência (AAAA-MM) diretamente do
                  caminho local <code className="text-slate-800 font-mono">...\CNPJ\AAAA-MM\*</code>
                  .
                </p>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0FA3A3] text-white text-[10px]">
                    2
                  </span>
                  Cálculo do Hash SHA-256
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Antes do upload, o conector calcula o hash criptográfico SHA-256 do arquivo no PC
                  para garantia de integridade ponta a ponta.
                </p>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0FA3A3] text-white text-[10px]">
                    3
                  </span>
                  Deduplicação por Hash
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Se o par (empresa_id, hash) já existir no GED, a API responde status{' '}
                  <strong className="text-blue-700">deduplicado</strong> sem criar cópia repetida.
                </p>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 text-white text-[10px]">
                    4
                  </span>
                  Parada Honesta
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  CNPJ inexistente no tenant, competência malformada ou hash ausente é rejeitado com
                  motivo exato e gera pendência humana imediata.
                </p>
              </div>
            </div>

            {/* Documentação e Exemplo do Endpoint de Upload Multipart */}
            <div className="space-y-2">
              <span className="font-bold text-slate-900 text-xs uppercase tracking-wider block">
                Contrato da Rota: POST /backend/v1/elliza-agente/upload-documento
                (multipart/form-data)
              </span>

              <div className="bg-slate-950 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto space-y-3">
                <div className="text-slate-400">
                  # Exemplo de chamada via cURL (multipart/form-data com X-Elliza-Api-Key):
                </div>
                <pre className="text-emerald-300 leading-relaxed">{`curl -X POST "https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev/backend/v1/elliza-agente/upload-documento" \\
  -H "X-Elliza-Api-Key: ${rawKeyEllizaDesktopPadrao}" \\
  -F "arquivo=@C:/RumoContabil/Documentos/GED/12345678000199/2026-09/extrato_itau.pdf" \\
  -F "cnpj=12345678000199" \\
  -F "competencia=2026-09" \\
  -F "hash_sha256=a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e" \\
  -F "nome_arquivo=extrato_itau.pdf" \\
  -F "tipo_documento=extrato_bancario" \\
  -F "job_id=JOB-092026-SYNC-GED01"`}</pre>

                <div className="text-slate-400 pt-2">
                  # Resposta 1 — Arquivo Novo Gravado no GED (HTTP 201 Created):
                </div>
                <pre className="text-slate-300">{`{
  "sucesso": true,
  "status": "arquivado",
  "mensagem": "Documento arquivado com sucesso no GED da empresa Rumo na competência 2026-09.",
  "documento_id": "pbc_doc_991823ab",
  "hash_sha256": "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
  "empresa_id": "8p0e1w9y7szvtyy",
  "cnpj": "12345678000199",
  "competencia": "2026-09",
  "nome_arquivo": "extrato_itau.pdf"
}`}</pre>

                <div className="text-slate-400 pt-2">
                  # Resposta 2 — Arquivo Já Existente / Deduplicado (HTTP 200 OK):
                </div>
                <pre className="text-blue-300">{`{
  "sucesso": true,
  "status": "deduplicado",
  "mensagem": "Arquivo já arquivado previamente no GED desta empresa com o mesmo hash SHA-256. Nenhuma cópia duplicada foi criada.",
  "documento_id": "pbc_doc_991823ab",
  "hash_sha256": "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
  "empresa_id": "8p0e1w9y7szvtyy"
}`}</pre>

                <div className="text-slate-400 pt-2">
                  # Resposta 3 — Parada Honesta / Rejeitado (HTTP 422 Unprocessable):
                </div>
                <pre className="text-amber-300">{`{
  "sucesso": false,
  "status": "rejeitado",
  "parada_honesta": true,
  "motivo": "Empresa com CNPJ 99.999.999/0001-99 não foi encontrada no escritório. Regra de ouro da Rumo: parada honesta sem adivinhar destino.",
  "decisao_necessaria": "Cadastrar a empresa na plataforma Rumo ou corrigir o CNPJ da pasta local.",
  "pendencia_id": "pbc_pend_882910cc"
}`}</pre>
              </div>
            </div>

            {/* Payload de Execução e Homologação da Tarefa */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 space-y-1.5">
                <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Homologação com a Regra de Ouro:
                </span>
                <p className="text-emerald-900 text-[11px] leading-relaxed">
                  A conclusão da tarefa só é despachada via <code>POST /concluir</code> após todos
                  os arquivos da pasta local serem processados (novos arquivados, repetidos
                  deduplicados). Os IDs gerados no GED e a contagem de hashes são persistidos em{' '}
                  <code>elisa_evidencias</code> com <code>criterio_sucesso_validado: true</code>.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 space-y-1.5">
                <span className="font-bold text-amber-950 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Salvaguarda de Arquivo Não Classificável:
                </span>
                <p className="text-amber-900 text-[11px] leading-relaxed">
                  Arquivos em diretórios fora da hierarquia CNPJ\AAAA-MM, arquivos sem CNPJ válido
                  ou com hash ausente <strong>NUNCA são associados a clientes aleatórios</strong>. O
                  sistema devolve erro e cria uma pendência de validação humana para resolução do
                  contador.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ABA 2: CONTAS DE SERVIÇO & TOKENS */}
        <TabsContent value="credenciais" className="space-y-4">
          <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-bold text-sm text-slate-900">Contas de Serviço Operacionais</h4>
                <p className="text-xs text-slate-500">
                  Credenciais dedicadas com princípio do privilégio mínimo. O agente opera isolado
                  sem privilégios de administrador.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setNovoNome('')
                  setNovoIdentificador('')
                  setChaveGeradaPlana(null)
                  setModalNovaChaveAberta(true)
                }}
                className="bg-[#0FA3A3] hover:bg-[#0c8282] text-white text-xs h-8 gap-1.5 font-bold"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Nova Credencial</span>
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Agente / Nome</th>
                    <th className="py-2.5 px-3">Identificador</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Prefixo da Chave</th>
                    <th className="py-2.5 px-3">Tarefas Executadas</th>
                    <th className="py-2.5 px-3">Última Execução</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {chaves.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-semibold text-slate-900">{c.nome}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        {c.identificador_agente}
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {c.tipo_integracao.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                        {c.api_key_prefixo}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800">
                        {c.total_tarefas_executadas || 0}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {c.ultima_execucao_em ? formatDatePtBr(c.ultima_execucao_em) : 'Nunca'}
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          className={`text-[10px] font-bold ${
                            c.status === 'ativo'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-red-600 text-white'
                          }`}
                        >
                          {c.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {c.status === 'ativo' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevogarChave(c.id)}
                            className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Revogar</span>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ABA 3: CONTRATO DA API & EXEMPLO PYTHON (PLAYWRIGHT + COMPUTER USE) */}
        <TabsContent value="documentacao" className="space-y-4">
          <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div>
              <h4 className="font-bold text-base text-slate-900">
                Guia de Integração para Agente Externo (Python + Playwright + Computer Use)
              </h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Este contrato padronizado permite que seu robô em Python interaja com sistemas que
                não possuem API (como PVA do SPED, Caixa Postal e-CAC, emissão de PGDAS-D e
                prefeituras municipais), consumindo diretamente a Fila da Elliza.
              </p>
            </div>

            {/* CHECKLIST DE PRÉ-REQUISITOS DA ELLIZA DESKTOP */}
            <div
              id="rpa-checklist-pre-requisitos-desktop"
              className="p-4 rounded-xl border border-teal-200 bg-teal-50/70 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#0FA3A3]" />
                  <h5 className="font-bold text-sm text-teal-950">
                    Checklist de Pré-Requisitos da ELLIZA Desktop (PC Local)
                  </h5>
                </div>
                <Badge className="bg-[#0FA3A3] text-white text-[10px] font-bold">
                  Assistente Local
                </Badge>
              </div>
              <p className="text-xs text-teal-900 leading-relaxed">
                Para os próximos marcos de hiperautomação contábil e RPA, confira se os
                pré-requisitos abaixo estão habilitados na configuração do assistente da ELLIZA no
                seu computador:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
                <div className="p-3 bg-white rounded-lg border border-teal-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-emerald-600" />
                      WhatsApp (ZAP)
                    </span>
                    <Badge className="bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                      Pré-requisito
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Sessão do ZAP ativa e conectada para envios ativos de DAS, guias e notificações
                    a clientes.
                  </p>
                </div>

                <div className="p-3 bg-white rounded-lg border border-teal-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                      Plugin NopeCHA
                    </span>
                    <Badge className="bg-blue-100 text-blue-800 text-[9px] font-bold">Ativo</Badge>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Resolução autônoma de CAPTCHAs em portais municipais, Caixa e juntas comerciais
                    sem travar o RPA.
                  </p>
                </div>

                <div className="p-3 bg-white rounded-lg border border-teal-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5 text-purple-600" />
                      APIs Brasileiras
                    </span>
                    <Badge className="bg-purple-100 text-purple-800 text-[9px] font-bold">
                      Habilitadas
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Receita Federal (CNPJ/CNAE), IBPT (tributação fiscal) e Banco Central
                    (Selic/moedas) configuradas.
                  </p>
                </div>
              </div>
            </div>

            {/* Endpoints */}
            <div className="space-y-2 text-xs">
              <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
                Endpoints REST da Plataforma (Header obrigatório:{' '}
                <code>X-Elliza-Api-Key: &lt;token&gt;</code>)
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 font-mono text-[11px]">
                <div className="bg-slate-50 border p-2.5 rounded-lg">
                  <span className="text-emerald-700 font-bold block">
                    GET /backend/v1/elliza-agente/buscar-aprovadas (ou /tarefas-aprovadas)
                  </span>
                  <span className="text-slate-600 text-[10px]">
                    Busca jobs com status APROVADO atribuídos ao agente ou aptos para coleta.
                  </span>
                </div>

                <div className="bg-slate-50 border p-2.5 rounded-lg">
                  <span className="text-blue-700 font-bold block">
                    POST /backend/v1/elliza-agente/iniciar (ou /tarefas/:id/iniciar)
                  </span>
                  <span className="text-slate-600 text-[10px]">
                    Transiciona para EM_EXECUCAO e audita início com timestamp.
                  </span>
                </div>

                <div className="bg-slate-50 border p-2.5 rounded-lg">
                  <span className="text-purple-700 font-bold block">
                    POST /backend/v1/elliza-agente/evidencias (ou /tarefas/:id/evidencias)
                  </span>
                  <span className="text-slate-600 text-[10px]">
                    Grava screenshot/comprovante com hash SHA-256 e GED.
                  </span>
                </div>

                <div className="bg-slate-50 border p-2.5 rounded-lg">
                  <span className="text-teal-700 font-bold block">
                    POST /backend/v1/elliza-agente/concluir (ou /tarefas/:id/concluir)
                  </span>
                  <span className="text-slate-600 text-[10px]">
                    Valida critério de sucesso (Regra de Ouro) e avança esteira.
                  </span>
                </div>

                <div className="bg-slate-50 border p-2.5 rounded-lg col-span-1 md:col-span-2">
                  <span className="text-red-700 font-bold block">
                    POST /backend/v1/elliza-agente/erro (ou /tarefas/:id/reportar-erro)
                  </span>
                  <span className="text-slate-600 text-[10px]">
                    Reporta exceção honesta sem adivinhação e retém como BLOQUEADO.
                  </span>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg col-span-1 md:col-span-2">
                  <span className="text-emerald-800 font-bold block flex items-center gap-1.5">
                    <FolderSync className="h-3.5 w-3.5 text-emerald-700" />
                    POST /backend/v1/elliza-agente/upload-documento (multipart/form-data)
                  </span>
                  <span className="text-emerald-900 text-[10px]">
                    Upload de documentos da pasta local para o GED com deduplicação por hash
                    SHA-256, classificação determinística por CNPJ e competência AAAA-MM, e parada
                    honesta em não classificáveis.
                  </span>
                </div>

                {/* MARCO 1: NOVOS ENDPOINTS DO CANAL DE COMANDOS */}
                <div className="bg-teal-50 border border-teal-200 p-2.5 rounded-lg col-span-1 md:col-span-2 space-y-1">
                  <span className="text-teal-900 font-bold block flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5 text-teal-700" />
                    MARCO 1 — Endpoints do Canal de Comandos Rumo ⇄ ELLIZA Desktop
                  </span>
                  <span className="text-teal-800 text-[10px] block">
                    Base: <code>/backend/v1/elliza-agente/comandos/*</code> com autenticação via{' '}
                    <code>X-Elliza-Api-Key</code>
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[10px]">
                    <div className="bg-white p-1.5 rounded border border-teal-100">
                      <strong className="text-teal-950 block">GET .../comandos/assinar</strong>
                      <span>
                        Stream SSE (ou polling) dos comandos pendentes do tenant (canal de descida).
                      </span>
                    </div>
                    <div className="bg-white p-1.5 rounded border border-teal-100">
                      <strong className="text-teal-950 block">
                        GET .../comandos/obter?nonce=...
                      </strong>
                      <span>Polling fallback com suporte a filtro por nonce e status.</span>
                    </div>
                    <div className="bg-white p-1.5 rounded border border-teal-100">
                      <strong className="text-blue-900 block">POST .../comandos/aceitar</strong>
                      <span>
                        Marca em_execucao com lock idempotente por nonce; expirado recusa.
                      </span>
                    </div>
                    <div className="bg-white p-1.5 rounded border border-teal-100">
                      <strong className="text-emerald-900 block">POST .../comandos/concluir</strong>
                      <span>
                        Recebe resultado + evidências. Regra de Ouro: sem evidência vira erro
                        honesto.
                      </span>
                    </div>
                    <div className="bg-white p-1.5 rounded border border-teal-100 col-span-1 sm:col-span-2">
                      <strong className="text-red-900 block">POST .../comandos/erro</strong>
                      <span>
                        Erro honesto: grava pendência estruturada em processo_pendencias, nunca
                        &quot;sucesso aproximado&quot;.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* EXEMPLOS CURL DOS NOVOS ENDPOINTS DE COMANDO */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
                Exemplos de Chamada cURL — Canal de Comandos (ELLIZA Desktop)
              </span>
              <div className="bg-slate-950 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto space-y-3">
                <div className="text-slate-400"># 1. Assinar / Obter Comandos Pendentes:</div>
                <pre className="text-emerald-300">{`curl -X GET "https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev/backend/v1/elliza-agente/comandos/assinar" \\
  -H "X-Elliza-Api-Key: ${rawKeyEllizaDesktopPadrao}" \\
  -H "Accept: application/json"`}</pre>

                <div className="text-slate-400 pt-1">
                  # 2. Aceitar Execução com Lock Idempotente (Nonce):
                </div>
                <pre className="text-blue-300">{`curl -X POST "https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev/backend/v1/elliza-agente/comandos/aceitar" \\
  -H "X-Elliza-Api-Key: ${rawKeyEllizaDesktopPadrao}" \\
  -H "Content-Type: application/json" \\
  -d '{"nonce": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"}'`}</pre>

                <div className="text-slate-400 pt-1">
                  # 3. Concluir Comando extrair_documento com Dados Fiscais + Evidência (Regra de
                  Ouro):
                </div>
                <pre className="text-emerald-300">{`curl -X POST "https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev/backend/v1/elliza-agente/comandos/concluir" \\
  -H "X-Elliza-Api-Key: ${rawKeyEllizaDesktopPadrao}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "nonce": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "evidencias": ["evi_ocr_scanner_9921"],
    "resultado": {
      "numero": "14820",
      "serie": "1",
      "cnpj_emitente": "12345678000199",
      "cnpj_destinatario": "98765432000188",
      "valor_total": 3500.00,
      "cfop": "5102",
      "competencia": "2026-09",
      "itens": [{"item": 1, "descricao": "Serviços Contábeis", "valor": 3500.00}]
    }
  }'`}</pre>

                <div className="text-slate-400 pt-1">
                  # 3.1. Concluir Comando pesquisa_tributaria com Relatório Técnico + Fontes
                  (POP-EX-04):
                </div>
                <pre className="text-teal-300">{`curl -X POST "https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev/backend/v1/elliza-agente/comandos/concluir" \\
  -H "X-Elliza-Api-Key: ${rawKeyEllizaDesktopPadrao}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "nonce": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "evidencias": ["evi_cosit_disit_7731", "hash_doc_sefaz_sp_01"],
    "resultado": {
      "relatorio_tecnico": "## 1. Parecer Técnico de Enquadramento Fiscal\\n\\n### Matéria em Consulta\\nAnálise de incidência de ICMS e PIS/COFINS na operação indicada...\\n\\n### Fundamentação Legal\\n- **RICMS/SP Artigo 8º**: Hipótese de isenção sob certas condições.\\n- **Solução de Consulta COSIT nº 123/2025**: Interpretação da RFB para crédito de PIS/COFINS.\\n\\n### Conclusão e Riscos\\nOperação passível de crédito fiscal condicionado à documentação de origem.",
      "conclusoes": "Operação com direito a crédito de PIS/COFINS conforme Solução de Consulta COSIT nº 123/2025; ICMS diferido na remessa interna.",
      "fontes": [
        {"titulo": "Solução de Consulta COSIT nº 123/2025", "tipo": "solucao_consulta", "numero": "123", "ano": 2025, "orgao": "Receita Federal do Brasil"},
        {"titulo": "RICMS do Estado de SP - Art. 8º", "tipo": "decreto", "numero": "45.490", "ano": 2000, "orgao": "SEFAZ/SP"}
      ]
    }
  }'`}</pre>

                <div className="text-slate-400 pt-1">
                  # 3.2. FASE 1 — Concluir Comando consultar_cnpj com Resumo Cadastral (evidência
                  obrigatória):
                </div>
                <pre className="text-teal-300">{`curl -X POST "https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev/backend/v1/elliza-agente/comandos/concluir" \\
  -H "X-Elliza-Api-Key: ${rawKeyEllizaDesktopPadrao}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "nonce": "f1cnpj-0001-conforme-recebido-no-obter",
    "evidencias": ["evi_cartao_cnpj_rfb_2026"],
    "resultado": {
      "cnpj": "12345678000199",
      "razao_social": "EMPRESA EXEMPLO LTDA",
      "situacao_cadastral": "ATIVA",
      "data_situacao_cadastral": "2015-03-10",
      "natureza_juridica": "206-2 - Sociedade Empresária Limitada",
      "capital_social": 100000.00,
      "endereco": {"logradouro": "AV PAULISTA", "numero": "1000", "municipio": "SAO PAULO", "uf": "SP", "cep": "01310200"},
      "cnae_principal": {"codigo": "6920601", "descricao": "Atividades de contabilidade"}
    }
  }'
# Sem resumo_cadastral válido, a conclusão é recusada com HTTP 422 e vira pendência em processo_pendencias.`}</pre>

                <div className="text-slate-400 pt-1">
                  # 3.3. FASE 1 — Concluir Comando cnd_federal (mesmo formato para cnd_estadual com
                  "uf", cnd_municipal, cndt e comprovante_cnpj):
                </div>
                <pre className="text-teal-300">{`curl -X POST "https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev/backend/v1/elliza-agente/comandos/concluir" \\
  -H "X-Elliza-Api-Key: ${rawKeyEllizaDesktopPadrao}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "nonce": "f1cndfed-0001-conforme-recebido-no-obter",
    "evidencias": ["evi_pdf_cnd_federal_sha256"],
    "resultado": {
      "pdf_url": "https://cav.receita.fazenda.gov.br/autenticacao/CERTIDAOS/print-CERTIDAOCPFPJEX.aspx?tip=2&id=EXEMPLO",
      "pdf_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "situacao": "negativa",
      "data_emissao": "2026-11-13",
      "data_validade": "2027-01-11",
      "nome_arquivo": "cnd_federal_12345678000199_2026-11-13.pdf"
    }
  }'
# Exigência dura: PDF real (pdf_url + pdf_sha256, ou documento_id do GED) + situacao (negativa | positiva | positiva_com_efeitos).
# cnd_estadual: incluir "uf" no payload do comando e na conclusão (ex.: "uf": "SP"); comprovante_cnpj não tem situacao de débitos? tem: usar a situação do comprovante.`}</pre>

                <div className="text-slate-400 pt-1">
                  # 3.4. FASE 1 — Disparo manual (equivalente ao botão da ficha) e demais tipos de
                  comando da Fase 1 no canal:
                </div>
                <pre className="text-slate-300">{`# Os 6 tipos da Fase 1 são enfileirados pela Rumo em elliza_comandos (status pendente):
#   consultar_cnpj    — Consulta cartão CNPJ na RFB (via botão "Consultar CNPJ via ELLIZA" na ficha).
#   cnd_federal       — CND Federal (Receita/PGFN).
#   cnd_estadual      — CND Estadual SEFAZ (payload do comando carrega "uf", ex.: "uf": "SP").
#   cnd_municipal     — CND Municipal (prefeitura da sede).
#   cndt              — CNDT (Tribunal Superior do Trabalho).
#   comprovante_cnpj  — Comprovante de Inscrição e Situação Cadastral (cartão CNPJ completo).
# A ELLIZA desktop os recebe em GET .../comandos/assinar e responde em POST .../comandos/concluir
# com a evidência do item 3.2 (CNPJ) ou 3.3 (certidões). Sem evidência: HTTP 422 + pendência.`}</pre>

                <div className="text-slate-400 pt-1">
                  # 4. Reportar Erro Honesto com Pendência Estruturada:
                </div>
                <pre className="text-amber-300">{`curl -X POST "https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev/backend/v1/elliza-agente/comandos/erro" \\
  -H "X-Elliza-Api-Key: ${rawKeyEllizaDesktopPadrao}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "nonce": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "codigo": "OCR_ILEGIVEL",
    "motivo": "Documento digitalizado com resolução inferior a 150 DPI, campos fiscais ilegíveis.",
    "o_que_foi_executado": "Scanner local OCR processou imagem mas confiança média ficou abaixo de 40%.",
    "o_que_falta": "Reenvio de documento com melhor resolução pelo cliente.",
    "decisao_necessaria": "Solicitar novo upload ao cliente em /portal-cliente."
  }'`}</pre>
              </div>
            </div>

            {/* SEÇÃO NOVA: CICLO DE OPERAÇÃO — ELLIZA DESKTOP */}
            <div
              id="rpa-ciclo-operacao-elliza-desktop"
              className="space-y-4 pt-3 border-t border-slate-200"
            >
              <div className="flex items-center gap-2">
                <Laptop className="h-5 w-5 text-[#0FA3A3]" />
                <h5 className="font-black text-sm text-slate-900 uppercase tracking-tight">
                  Ciclo de Operação — ELLIZA Desktop (Loop de Polling &amp; Execução Local)
                </h5>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 text-xs text-slate-700">
                <p className="leading-relaxed">
                  A <strong>ELLIZA Desktop</strong> opera em regime contínuo (daemon ou serviço em
                  background no PC do usuário) através de um ciclo determinístico de 7 passos:
                </p>

                <ol className="list-decimal list-inside space-y-2 text-slate-800 font-medium leading-relaxed pl-1">
                  <li>
                    <strong>(1) Polling periódico:</strong> O robô faz requisição HTTP GET em{' '}
                    <code className="text-emerald-700 font-mono bg-white px-1.5 py-0.5 rounded border">
                      /backend/v1/elliza-agente/buscar-aprovadas
                    </code>{' '}
                    enviando o cabeçalho <code>X-Elliza-Api-Key: &lt;chave_desktop&gt;</code>.
                  </li>
                  <li>
                    <strong>(2) Recepção e Blueprint:</strong> Recebe as tarefas com status{' '}
                    <span className="text-emerald-700 font-bold">APROVADO</span>, dados do cliente
                    (CNPJ, razão social), competência, SOP relacionado e payload de execução.
                  </li>
                  <li>
                    <strong>(3) Navegação e Telemetria Trilha RPA v1.0:</strong> Navega à tela
                    correspondente da Rumo no navegador local e lê a telemetria determinística (ex.:{' '}
                    <code>data-step-status</code>, <code>data-rpa-field</code>,{' '}
                    <code>#rpa-empresa-ficha</code>, <code>#rpa-grid-qsa</code>,{' '}
                    <code>#rpa-btn-executar</code>).
                  </li>
                  <li>
                    <strong>(4) Execução da Ação Local:</strong> Executa a rotina nos portais
                    fiscais/bancários ou no ZAP da ELLIZA Desktop (disparos oficiais de WhatsApp).
                  </li>
                  <li>
                    <strong>(5) Captura de Evidência Auditável:</strong> Captura screenshot ou
                    recibo oficial e calcula o hash criptográfico <strong>SHA-256</strong> da
                    imagem/documento.
                  </li>
                  <li>
                    <strong>(6) Notificação de Status:</strong> Notifica a Rumo chamando{' '}
                    <code>POST /iniciar</code>, anexa a evidência em <code>POST /evidencias</code> e
                    conclui em <code>POST /concluir</code> (ou se houver divergência, aciona{' '}
                    <code>POST /erro</code>).
                  </li>
                  <li>
                    <strong>(7) Reinício do Ciclo:</strong> Aguarda o intervalo de repouso
                    configurado e reinicia o loop.
                  </li>
                </ol>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <div className="bg-white border border-slate-200 rounded-lg p-3">
                    <span className="font-bold text-slate-900 block text-[11px] mb-1">
                      ⏱️ Intervalo Recomendado
                    </span>
                    <span className="text-slate-600 text-[11px] leading-snug block">
                      Polling a cada <strong>30 a 60 segundos</strong>. Em horário comercial, reduz
                      carga no PC e assegura atendimento rápido às aprovações humanas.
                    </span>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-3">
                    <span className="font-bold text-slate-900 block text-[11px] mb-1">
                      🛡️ Regra de Ouro (Evidência + Hash)
                    </span>
                    <span className="text-slate-600 text-[11px] leading-snug block">
                      Nenhuma conclusão é homologada sem <strong>evidência com hash SHA-256</strong>{' '}
                      e confirmação explícita de <code>criterio_sucesso_validado: true</code>.
                    </span>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-3">
                    <span className="font-bold text-slate-900 block text-[11px] mb-1">
                      🔒 Isolamento &amp; Segurança
                    </span>
                    <span className="text-slate-600 text-[11px] leading-snug block">
                      A ELLIZA Desktop <strong>não acessa o banco nem endpoints internos</strong>.
                      Acesso restrito a <code>/backend/v1/elliza-agente/*</code> via API key
                      dedicada.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* SEÇÃO: CONTRATO DE TELEMETRIA VISUAL (TRILHA RPA v1.0) */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-slate-900">
                      Contrato de Telemetria Visual (Trilha RPA v1.0)
                    </span>
                    <Badge className="bg-[#0FA3A3] text-white text-[10px] font-bold">
                      Versão 1.0 (Congelada)
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Contrato determinístico de seletores, data-attributes e comportamentos esperados
                    pelo robô (Playwright / Computer Use).
                  </p>
                </div>
              </div>

              {/* Nota de Governança de Contrato */}
              <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-3 text-xs text-teal-950">
                <strong>Nota de Governança:</strong> Estes atributos e IDs são um{' '}
                <span className="underline font-semibold">contrato versionado</span>. Mudanças
                futuras nos seletores exigem atualização prévia nesta aba e versionamento semântico
                (v1.1 / v2.0) para não quebrar robôs em produção em VMs externas.
              </div>

              {/* Tabela do Contrato: 8 Linhas */}
              <div className="rounded-xl border border-slate-200 overflow-x-auto bg-white shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold text-[11px] uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Elemento</th>
                      <th className="py-2.5 px-3">ID / Seletor</th>
                      <th className="py-2.5 px-3">Atributos Contratados</th>
                      <th className="py-2.5 px-3">Comportamento Esperado pelo Robô</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        1. Etapas do Processo
                      </td>
                      <td className="py-2.5 px-3 font-mono text-teal-700">#rpa-step-{'{ordem}'}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        data-step-code=&quot;FCT-04-E03&quot;
                        <br />
                        data-step-status=&quot;pending|running|done|error&quot;
                        <br />
                        data-job-id=&quot;...&quot;
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 leading-snug">
                        Identifica o card da etapa atual. Status mapeado:
                        ENFILEIRADO/AGUARDANDO→pending, EM_EXECUCAO→running, CONCLUIDO→done,
                        AGUARDANDO_APROVACAO/BLOQUEADO→error.
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">2. Botão de Execução</td>
                      <td className="py-2.5 px-3 font-mono text-teal-700">#rpa-btn-executar</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        data-action-code=&quot;...&quot;
                        <br />
                        data-rpa-action=&quot;executar-proxima-etapa&quot;
                        <br />
                        data-enabled-reason=&quot;...&quot;
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 leading-snug">
                        Gatilho da esteira. Se desabilitado, inspeciona{' '}
                        <code>data-enabled-reason</code> para saber motivo (ex.: Aprovação CRC,
                        Execução em andamento).
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">3. Grid Balancete</td>
                      <td className="py-2.5 px-3 font-mono text-teal-700">#rpa-grid-balancete</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        data-total-rows=&quot;N&quot;
                        <br />
                        data-total-debito=&quot;0.00&quot;
                        <br />
                        data-total-credito=&quot;0.00&quot;
                        <br />
                        data-diferenca=&quot;0.00&quot;
                        <br />
                        data-rpa-equilibrado=&quot;true|false&quot;
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 leading-snug">
                        Leitura determinística dos saldos do balancete sem scraping de texto. Robô
                        checa <code>data-rpa-equilibrado=&quot;true&quot;</code> antes de emitir
                        encerramento.
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">4. Grid Lançamentos</td>
                      <td className="py-2.5 px-3 font-mono text-teal-700">#rpa-grid-lancamentos</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        data-total-rows=&quot;N&quot;
                        <br />
                        data-total-debito=&quot;0.00&quot;
                        <br />
                        data-total-credito=&quot;0.00&quot;
                        <br />
                        data-diferenca=&quot;0.00&quot;
                        <br />
                        data-rpa-equilibrado=&quot;true|false&quot;
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 leading-snug">
                        Totais oficiais dos lançamentos contábeis. Partida dobrada validada quando{' '}
                        <code>data-diferenca=&quot;0.00&quot;</code>.
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">5. Grid Conciliação</td>
                      <td className="py-2.5 px-3 font-mono text-teal-700">#rpa-grid-conciliacao</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        data-total-rows=&quot;N&quot;
                        <br />
                        data-pendencias-count=&quot;N&quot;
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 leading-snug">
                        Batimento de extrato bancário. Conciliação plena confirmada quando{' '}
                        <code>data-pendencias-count=&quot;0&quot;</code>.
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">6. Log Operacional</td>
                      <td className="py-2.5 px-3 font-mono text-teal-700">#rpa-log-container</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        data-log-visibility=&quot;visible|hidden&quot;
                        <br />
                        data-log-count=&quot;N&quot;
                        <br />
                        Filhos: data-log-level=&quot;info|warn|error&quot;
                        <br />
                        data-log-timestamp=&quot;...&quot;
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 leading-snug">
                        Container sempre presente no DOM. Robô usa <code>
                          wait_for_selector
                        </code>{' '}
                        para rastrear evidências e erros registrados na esteira.
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        7. Indicador de Conclusão
                      </td>
                      <td className="py-2.5 px-3 font-mono text-teal-700">#rpa-status-conclusao</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        data-rpa-state=&quot;success|error|open&quot;
                        <br />
                        data-rpa-resultado=&quot;...&quot;
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 leading-snug">
                        Sinalizador inequívoco. Concluído→success, Aguardando
                        aprovação/bloqueado→error, senão→open. Resume o resultado da última ação.
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">8. Botão Depreciação</td>
                      <td className="py-2.5 px-3 font-mono text-teal-700">
                        #rpa-btn-rodar-depreciacao
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        data-rpa-action=&quot;processar-depreciacao&quot;
                        <br />
                        data-competencia=&quot;MM/AAAA&quot;
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 leading-snug">
                        Dispara o cálculo automático de depreciação linear contábil da competência
                        selecionada no Patrimônio.
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">8.1 Grid Patrimônio</td>
                      <td className="py-2.5 px-3 font-mono text-teal-700">#rpa-grid-patrimonio</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        data-total-rows=&quot;N&quot;
                        <br />
                        data-total-aquisicao=&quot;...&quot;
                        <br />
                        data-total-liquido=&quot;...&quot;
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 leading-snug">
                        Tabela de bens patrimoniais imobilizados com totais calculados e telemetria
                        determinística.
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        9. Ficha Cadastral da Empresa
                      </td>
                      <td className="py-2.5 px-3 font-mono text-teal-700">#rpa-empresa-ficha</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        data-rpa-field=&quot;{'{nome_do_campo}'}&quot;
                        <br />
                        data-rpa-value=&quot;{'{valor}'}&quot;
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 leading-snug">
                        Container da Ficha Cadastral Completa (/empresas/:id). Cada campo de
                        Identificação, Localização e Parametrização expõe{' '}
                        <code>data-rpa-field</code> e <code>data-rpa-value</code> com valor real ou
                        &quot;—&quot; caso ausente.
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        10. Grid QSA (Societário)
                      </td>
                      <td className="py-2.5 px-3 font-mono text-teal-700">#rpa-grid-qsa</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        data-total-rows=&quot;N&quot;
                        <br />
                        data-socio-cpf=&quot;...&quot;
                        <br />
                        data-socio-participacao=&quot;50.00%&quot;
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 leading-snug">
                        Grid determinístico do Quadro de Sócios e Administradores. Por linha/sócio:
                        CPF, percentual de quotas, RG, data de nascimento, naturalidade e endereço
                        completo.
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        11. Pedidos de Documentos / GED
                      </td>
                      <td className="py-2.5 px-3 font-mono text-teal-700">
                        #rpa-grid-documentos
                        <br />
                        #rpa-grid-ged-documentos
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        data-total-rows=&quot;N&quot;
                        <br />
                        data-rpa-status=&quot;loaded|empty&quot;
                        <br />
                        data-pedido-id=&quot;...&quot;
                        <br />
                        data-documento-tipo=&quot;...&quot;
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 leading-snug">
                        Leitura determinística de pedidos de documentos e repositório GED para robôs
                        de digitalização, classificação OCR (Scanner → GED) e baixa automática de
                        documentos.
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50 bg-teal-50/30">
                      <td className="py-2.5 px-3 font-bold text-teal-950">
                        12. Sincronização Pasta → GED
                      </td>
                      <td className="py-2.5 px-3 font-mono text-teal-700">
                        #rpa-grid-sincronizacao-ged
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        data-total-rows=&quot;N&quot;
                        <br />
                        data-total-arquivados=&quot;N&quot;
                        <br />
                        data-total-deduplicados=&quot;N&quot;
                        <br />
                        data-total-rejeitados=&quot;N&quot;
                        <br />
                        data-rpa-status=&quot;loaded&quot;
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 leading-snug">
                        Telemetria em tempo real da rotina de sincronização de pastas locais no
                        padrão CNPJ\AAAA-MM, contabilizando novos arquivados, duplicados
                        identificados e paradas honestas retidas para validação humana.
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50 bg-emerald-50/30">
                      <td className="py-2.5 px-3 font-bold text-emerald-950">
                        13. Pesquisa Tributária Avançada
                      </td>
                      <td className="py-2.5 px-3 font-mono text-teal-700">
                        #rpa-grid-pesquisas-tributarias
                        <br />
                        #rpa-status-conclusao
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        data-total-pesquisas=&quot;N&quot;
                        <br />
                        data-total-concluidas=&quot;N&quot;
                        <br />
                        data-total-em-analise=&quot;N&quot;
                        <br />
                        data-total-fila-comandos=&quot;N&quot;
                        <br />
                        data-total-erros-fila=&quot;N&quot;
                        <br />
                        data-rpa-status=&quot;loaded&quot;
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 leading-snug">
                        Módulo de Pesquisa Tributária Avançada (POP-EX-04 / /pesquisa-tributaria).
                        Leitura determinística do status da pesquisa, fundamentação técnica da
                        ELLIZA Desktop e relatórios concluídos auditáveis.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Código Python de Exemplo (Playwright + Telemetria Trilha RPA v1.0) */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800">
                  Script Python de Demonstração (Playwright + Telemetria Trilha RPA v1.0):
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copiarTexto(`# ==============================================================================
# Script de Automação Playwright com Telemetria Trilha RPA v1.0
# Integração: Fila da Elliza + Leitura Determinística da Plataforma Contábil
# ==============================================================================

import asyncio
from playwright.async_api import async_playwright
import requests
import hashlib

# IMPORTANTE: A API do Agente vive no host PocketBase (NÃO no domínio público que serve o SPA React)
API_BASE = "https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev/backend/v1/elliza-agente"
WEB_URL = "https://rumoconsultoriacontabil.com.br"
API_KEY = "elliza_agt_live_99482fbc71a340e58832a884ef"
HEADERS = {"X-Elliza-Api-Key": API_KEY, "Content-Type": "application/json"}

async def executar_fechamento_rpa():
    # 1. Buscar Tarefas Aprovadas na Fila da Elliza
    res = requests.get(f"{API_BASE}/tarefas-aprovadas", headers=HEADERS)
    tarefas = res.json().get("tarefas", [])
    if not tarefas:
        print("Nenhuma tarefa aprovada pendente de execução.")
        return

    job = tarefas[0]
    job_id = job["job_id"]
    processo_id = job.get("processo_id") or job["processo"]["id"]
    print(f"Iniciando Job {job['job_codigo']} do Processo {processo_id}...")

    # Registrar início da execução na API
    requests.post(f"{API_BASE}/tarefas/{job_id}/iniciar", headers=HEADERS)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # 2. Navegar para a página de execução do processo (interface web)
        await page.goto(f"{WEB_URL}/processos/{processo_id}")
        await page.wait_for_selector("#rpa-status-conclusao")

        # 3. Leitura da Telemetria das Etapas (data-step-status)
        etapa_1 = await page.wait_for_selector("#rpa-step-1")
        status_e1 = await etapa_1.get_attribute("data-step-status")
        code_e1 = await etapa_1.get_attribute("data-step-code")
        print(f"Etapa 1 ({code_e1}) status atual: {status_e1}")

        # 4. Executar próxima etapa caso habilitada
        btn_exec = await page.wait_for_selector("#rpa-btn-executar")
        is_disabled = await btn_exec.is_disabled()
        if not is_disabled:
            action_code = await btn_exec.get_attribute("data-action-code")
            print(f"Disparando ação: {action_code}")
            await btn_exec.click()
            await page.wait_for_timeout(3000)
        else:
            motivo = await btn_exec.get_attribute("data-enabled-reason")
            print(f"Botão de execução retido. Motivo: {motivo}")

        # 5. Validação da Telemetria do Balancete (data-diferenca e data-rpa-equilibrado)
        await page.goto(f"{WEB_URL}/balancete")
        grid_balancete = await page.wait_for_selector("#rpa-grid-balancete")
        dif = await grid_balancete.get_attribute("data-diferenca")
        equilibrado = await grid_balancete.get_attribute("data-rpa-equilibrado")
        total_rows = await grid_balancete.get_attribute("data-total-rows")
        print(f"Balancete: {total_rows} linhas, Diferença: R$ {dif}, Equilibrado: {equilibrado}")

        if equilibrado != "true":
            raise ValueError(f"Balancete divergente! Diferença detectada: R$ {dif}")

        # 6. Gravar Screenshot Auditável e Hash SHA-256
        screenshot_bytes = await page.screenshot()
        hash_sha256 = hashlib.sha256(screenshot_bytes).hexdigest()

        requests.post(f"{API_BASE}/tarefas/{job_id}/evidencias", headers=HEADERS, json={
            "titulo": f"Balancete Equilibrado ({dif})",
            "tipo": "screenshot",
            "protocolo_numero": f"BAL-{processo_id[:8]}",
            "hash_sha256": hash_sha256,
            "salvar_no_ged": True
        })

        # 7. Concluir Tarefa na Fila da Elliza
        requests.post(f"{API_BASE}/tarefas/{job_id}/concluir", headers=HEADERS, json={
            "resultado": f"Validação concluída com sucesso. Balancete fechado com diferença R$ {dif}.",
            "criterio_sucesso_validado": True,
            "tempo_execucao_segundos": 18
        })

        await browser.close()
        print("Execução finalizada com êxito.")

if __name__ == "__main__":
    asyncio.run(executar_fechamento_rpa())
`)
                  }
                  className="h-7 text-xs gap-1.5"
                >
                  {copiado ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>{copiado ? 'Copiado!' : 'Copiar Script Python'}</span>
                </Button>
              </div>

              <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed">
                <pre>{`# Exemplo Playwright: leitura de telemetria Trilha RPA v1.0
etapa = await page.wait_for_selector("#rpa-step-1")
status = await etapa.get_attribute("data-step-status")  # pending|running|done|error

# Validação do Balancete por data-attributes (sem scraping frágil de HTML)
balancete = await page.wait_for_selector("#rpa-grid-balancete")
diferenca = await balancete.get_attribute("data-diferenca")            # "0.00"
equilibrado = await balancete.get_attribute("data-rpa-equilibrado")    # "true"

# Disparo da próxima ação pelo botão de contrato
btn_exec = await page.wait_for_selector("#rpa-btn-executar")
if not await btn_exec.is_disabled():
    await btn_exec.click()`}</pre>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Criar Credencial */}
      <Dialog open={modalNovaChaveAberta} onOpenChange={setModalNovaChaveAberta}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <KeyRound className="h-5 w-5 text-[#0FA3A3]" />
              <span>Nova Credencial de Agente Externo</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Crie uma conta de serviço com chave de API dedicada. O agente terá privilégio mínimo
              de execução.
            </DialogDescription>
          </DialogHeader>

          {chaveGeradaPlana ? (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5 text-xs">
                <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Token de API Gerado com Sucesso!
                </span>
                <p className="text-emerald-900 leading-snug">
                  Copie e armazene este token com segurança em suas variáveis de ambiente. Por
                  segurança, ele não será exibido novamente.
                </p>
                <div className="flex items-center gap-2 pt-2">
                  <Input
                    readOnly
                    value={chaveGeradaPlana}
                    className="font-mono text-xs bg-white text-slate-900 h-8"
                  />
                  <Button
                    size="sm"
                    onClick={() => copiarTexto(chaveGeradaPlana)}
                    className="h-8 bg-emerald-700 hover:bg-emerald-800 text-white text-xs shrink-0"
                  >
                    Copiar
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-800">Nome Amigável do Agente:</label>
                <Input
                  placeholder="Ex.: RPA Playwright Portais Fiscais (VM 02)"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-800">Identificador Único (Slug):</label>
                <Input
                  placeholder="Ex.: rpa-playwright-fiscal-02"
                  value={novoIdentificador}
                  onChange={(e) => setNovoIdentificador(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-800">Tipo de Automação:</label>
                <Select value={novoTipo} onValueChange={(val: any) => setNovoTipo(val)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="playwright_computer_use">
                      Playwright + Computer Use (Tela)
                    </SelectItem>
                    <SelectItem value="rpa_script_python">Script Python Autônomo</SelectItem>
                    <SelectItem value="custom_agent">Agente Customizado (API)</SelectItem>
                    <SelectItem value="webhook_runner">Webhook Runner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            {chaveGeradaPlana ? (
              <Button
                size="sm"
                onClick={() => setModalNovaChaveAberta(false)}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs"
              >
                Concluir
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModalNovaChaveAberta(false)}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleCriarChave}
                  disabled={salvandoChave}
                  className="bg-[#0FA3A3] hover:bg-[#0c8282] text-white text-xs font-bold"
                >
                  {salvandoChave ? 'Gerando...' : 'Gerar Chave de API'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

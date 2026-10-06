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
      {/* Banner Informativo de Arquitetura */}
      <Card className="rounded-2xl border-teal-200 bg-gradient-to-r from-teal-50/80 via-white to-slate-50 p-4 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Laptop className="h-6 w-6 text-[#0FA3A3] shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Integração de Agente Externo (RPA / Playwright + Computer Use)
                </h3>
                <Badge className="bg-[#0FA3A3] text-white text-[10px] font-bold">API REST v1</Badge>
                <Badge variant="outline" className="text-slate-600 text-[10px]">
                  Privilégio Mínimo
                </Badge>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Permite que scripts em Python, Playwright ou ferramentas de Computer Use busquem
                tarefas com status <strong>APROVADO</strong> na Fila da Elliza, executem a automação
                em portais externos (PVA do SPED, e-CAC, PGDAS-D, Prefeituras) e devolvam evidências
                com hash SHA-256 e trilha de auditoria completa.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => {
                setNovoNome('')
                setNovoIdentificador('')
                setChaveGeradaPlana(null)
                setModalNovaChaveAberta(true)
              }}
              className="bg-[#0FA3A3] hover:bg-[#0c8282] text-white text-xs h-8 gap-1.5 font-bold shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Nova Credencial de Agente</span>
            </Button>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="simulador" className="space-y-4">
        <TabsList className="bg-slate-100 p-1 border border-slate-200">
          <TabsTrigger value="simulador" className="text-xs font-semibold gap-1.5">
            <Activity className="h-3.5 w-3.5 text-[#0FA3A3]" />
            <span>Simulador do Ciclo Completo</span>
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

            {/* Endpoints */}
            <div className="space-y-2 text-xs">
              <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
                Endpoints REST da Plataforma (Header obrigatório:{' '}
                <code>X-Elliza-Api-Key: &lt;token&gt;</code>)
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 font-mono text-[11px]">
                <div className="bg-slate-50 border p-2.5 rounded-lg">
                  <span className="text-emerald-700 font-bold block">
                    GET /backend/v1/elliza-agente/tarefas-aprovadas
                  </span>
                  <span className="text-slate-600 text-[10px]">
                    Busca jobs com status APROVADO no Modo Humano.
                  </span>
                </div>

                <div className="bg-slate-50 border p-2.5 rounded-lg">
                  <span className="text-blue-700 font-bold block">
                    POST /backend/v1/elliza-agente/tarefas/:id/iniciar
                  </span>
                  <span className="text-slate-600 text-[10px]">
                    Transiciona para EM_EXECUCAO e audita início.
                  </span>
                </div>

                <div className="bg-slate-50 border p-2.5 rounded-lg">
                  <span className="text-purple-700 font-bold block">
                    POST /backend/v1/elliza-agente/tarefas/:id/evidencias
                  </span>
                  <span className="text-slate-600 text-[10px]">
                    Grava screenshot/comprovante com hash SHA-256 e GED.
                  </span>
                </div>

                <div className="bg-slate-50 border p-2.5 rounded-lg">
                  <span className="text-teal-700 font-bold block">
                    POST /backend/v1/elliza-agente/tarefas/:id/concluir
                  </span>
                  <span className="text-slate-600 text-[10px]">
                    Valida critério de sucesso e avança para próxima etapa.
                  </span>
                </div>

                <div className="bg-slate-50 border p-2.5 rounded-lg col-span-1 md:col-span-2">
                  <span className="text-red-700 font-bold block">
                    POST /backend/v1/elliza-agente/tarefas/:id/reportar-erro
                  </span>
                  <span className="text-slate-600 text-[10px]">
                    Cria pendência no Modo Humano (BLOQUEADO) sem adivinhação.
                  </span>
                </div>
              </div>
            </div>

            {/* Código Python de Exemplo */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800">
                  Script Python de Demonstração (Playwright + Computer Use):
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copiarTexto(`# Script de integração com a Fila da Elliza (Python + Playwright)
import requests
import hashlib
import time

BASE_URL = "https://SEU_DOMINIO/backend/v1/elliza-agente"
API_KEY = "elliza_agt_live_99482fbc71a340e58832a884ef"
HEADERS = {"X-Elliza-Api-Key": API_KEY, "Content-Type": "application/json"}

# 1. Buscar Tarefas Aprovadas no Modo Humano
res = requests.get(f"{BASE_URL}/tarefas-aprovadas", headers=HEADERS)
tarefas = res.json().get("tarefas", [])

for job in tarefas:
    job_id = job["job_id"]
    print(f"Executando Job: {job['job_codigo']} - {job['processo']['titulo']}")

    # 2. Registrar início da execução
    requests.post(f"{BASE_URL}/tarefas/{job_id}/iniciar", headers=HEADERS)

    # 3. Execução Playwright de tela (exemplo no portal e-CAC / PGDAS-D)
    # ... código do Playwright ...
    protocolo_gerado = "PROT-PGDASD-2026-994812"

    # 4. Enviar Evidência com Hash SHA-256
    hash_sha256 = hashlib.sha256(b"screenshot_bytes").hexdigest()
    requests.post(f"{BASE_URL}/tarefas/{job_id}/evidencias", headers=HEADERS, json={
        "titulo": f"Comprovante DAS {job['competencia']}",
        "tipo": "screenshot",
        "protocolo_numero": protocolo_gerado,
        "hash_sha256": hash_sha256,
        "salvar_no_ged": True
    })

    # 5. Concluir com validação de critério de sucesso
    requests.post(f"{BASE_URL}/tarefas/{job_id}/concluir", headers=HEADERS, json={
        "resultado": f"DAS emitido com êxito. Protocolo: {protocolo_gerado}",
        "criterio_sucesso_validado": True,
        "tempo_execucao_segundos": 24
    })
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
                <pre>{`# 1. Buscar tarefas aprovadas
res = requests.get(f"{BASE_URL}/tarefas-aprovadas", headers=HEADERS)
tarefas = res.json().get("tarefas", [])

# 2. Iniciar execução
requests.post(f"{BASE_URL}/tarefas/{job_id}/iniciar", headers=HEADERS)

# 3. Enviar Evidência Auditável (Screenshot + Protocolo + Hash)
requests.post(f"{BASE_URL}/tarefas/{job_id}/evidencias", headers=HEADERS, json={
    "titulo": "Comprovante DAS 09/2026",
    "tipo": "screenshot",
    "protocolo_numero": "PROT-994812",
    "hash_sha256": sha256_da_imagem,
    "salvar_no_ged": True
})

# 4. Concluir validando o critério de sucesso
requests.post(f"{BASE_URL}/tarefas/{job_id}/concluir", headers=HEADERS, json={
    "resultado": "Guia emitida sem divergências.",
    "criterio_sucesso_validado": True
})`}</pre>
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

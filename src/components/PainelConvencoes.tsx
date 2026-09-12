import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Sparkles,
  TrendingUp,
  RefreshCw,
  Plus,
  Trash2,
  Undo2,
  ShieldAlert,
  ArrowRight,
  Info,
  DollarSign,
  Users,
  Search,
  ExternalLink,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import {
  convencoesService,
  EstimativaImpactoReajuste,
  ResultadoAplicacaoFolha,
} from '@/services/convencoes'
import type {
  Empresa,
  Funcionario,
  ConvencaoColetivaRecord,
  HistoricoSalarialRecord,
  ParametroAdicionalConvencao,
} from '@/types'

interface PainelConvencoesProps {
  empresaSelecionadaId: string
  empresas: Empresa[]
  competenciaAtual: string
  funcionarios: Funcionario[]
  convencoes: ConvencaoColetivaRecord[]
  historicosSalariais: HistoricoSalarialRecord[]
  loading: boolean
  onRefresh: () => Promise<void>
}

export function PainelConvencoes({
  empresaSelecionadaId,
  empresas,
  competenciaAtual,
  funcionarios,
  convencoes,
  historicosSalariais,
  loading,
  onRefresh,
}: PainelConvencoesProps) {
  const { user, tenant } = useAuth()
  const podeEditar = user?.perfil === 'administrador' || user?.perfil === 'contador'

  // Filtros locais
  const [termoBusca, setTermoBusca] = useState<string>('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

  // Modal: Nova / Editar Convenção
  const [modalConvencaoAberto, setModalConvencaoAberto] = useState(false)
  const [salvandoConvencao, setSalvandoConvencao] = useState(false)
  const [editandoConvencaoId, setEditandoConvencaoId] = useState<string | null>(null)

  // Form State Convenção
  const [formEmpresa, setFormEmpresa] = useState<string>(
    empresaSelecionadaId !== 'todas' ? empresaSelecionadaId : empresas[0]?.id || '',
  )
  const [formTitulo, setFormTitulo] = useState<string>('')
  const [formSindicatoLaboral, setFormSindicatoLaboral] = useState<string>('')
  const [formSindicatoPatronal, setFormSindicatoPatronal] = useState<string>('')
  const [formCategoria, setFormCategoria] = useState<string>('')
  const [formNumeroMte, setFormNumeroMte] = useState<string>('')
  const [formDataBase, setFormDataBase] = useState<string>('01/01')
  const [formVigenciaInicio, setFormVigenciaInicio] = useState<string>('2026-01-01')
  const [formVigenciaFim, setFormVigenciaFim] = useState<string>('2026-12-31')
  const [formPisoSalarial, setFormPisoSalarial] = useState<number>(2500)
  const [formPercentualReajuste, setFormPercentualReajuste] = useState<number>(5.5)
  const [formDataAplicacaoReajuste, setFormDataAplicacaoReajuste] = useState<string>('2026-01-01')
  const [formAdicionalHe, setFormAdicionalHe] = useState<number>(60)
  const [formAdicionalNoturno, setFormAdicionalNoturno] = useState<number>(25)
  const [formAdicionalInsalubridade, setFormAdicionalInsalubridade] = useState<number>(20)
  const [formTicketRefeicao, setFormTicketRefeicao] = useState<number>(40)
  const [formAuxilioCreche, setFormAuxilioCreche] = useState<number>(450)
  const [formAlertaDias, setFormAlertaDias] = useState<number>(60)
  const [formObservacoes, setFormObservacoes] = useState<string>('')

  // Modal: Revisão e Aplicação em 1 Clique
  const [modalRevisaoAberto, setModalRevisaoAberto] = useState(false)
  const [simulacaoImpacto, setSimulacaoImpacto] = useState<EstimativaImpactoReajuste | null>(null)
  const [simulando, setSimulando] = useState(false)
  const [aplicando1Clique, setAplicando1Clique] = useState(false)
  const [aplicarRetroativoCheck, setAplicarRetroativoCheck] = useState(true)

  // Reversão / Rollback
  const [revertendoLote, setRevertendoLote] = useState<string | null>(null)

  // Lista de convenções filtradas
  const convencoesFiltradas = useMemo(() => {
    return convencoes.filter((c) => {
      if (filtroStatus !== 'todos') {
        const info = convencoesService.calcularStatusVigencia(
          c.vigencia_fim,
          c.alerta_dias_config || 60,
        )
        if (filtroStatus === 'vigente' && info.status !== 'vigente') return false
        if (filtroStatus === 'a_vencer' && !info.status.startsWith('a_vencer')) return false
        if (filtroStatus === 'vencida' && info.status !== 'vencida') return false
      }
      if (termoBusca.trim()) {
        const t = termoBusca.toLowerCase()
        const tit = c.titulo.toLowerCase()
        const sind = c.sindicato_laboral.toLowerCase()
        const cat = c.categoria_profissional.toLowerCase()
        if (!tit.includes(t) && !sind.includes(t) && !cat.includes(t)) return false
      }
      return true
    })
  }, [convencoes, filtroStatus, termoBusca])

  // Contagem de saúde das convenções (Badges 🟢🟡🔴)
  const saudeConvencoes = useMemo(() => {
    let verdes = 0
    let amarelos = 0
    let vermelhos = 0

    convencoes.forEach((c) => {
      const calc = convencoesService.calcularStatusVigencia(
        c.vigencia_fim,
        c.alerta_dias_config || 60,
      )
      if (calc.corBadge === 'verde') verdes++
      else if (calc.corBadge === 'amarelo') amarelos++
      else if (calc.corBadge === 'vermelho') vermelhos++
    })

    return { verdes, amarelos, vermelhos, total: convencoes.length }
  }, [convencoes])

  // Abrir Modal para Nova Convenção
  const abrirNovaConvencao = () => {
    setEditandoConvencaoId(null)
    setFormEmpresa(empresaSelecionadaId !== 'todas' ? empresaSelecionadaId : empresas[0]?.id || '')
    setFormTitulo('')
    setFormSindicatoLaboral('')
    setFormSindicatoPatronal('')
    setFormCategoria('')
    setFormNumeroMte('')
    setFormDataBase('01/05')
    setFormVigenciaInicio('2026-05-01')
    setFormVigenciaFim('2027-04-30')
    setFormPisoSalarial(2600)
    setFormPercentualReajuste(5.0)
    setFormDataAplicacaoReajuste('2026-05-01')
    setFormAdicionalHe(60)
    setFormAdicionalNoturno(25)
    setFormAdicionalInsalubridade(20)
    setFormTicketRefeicao(38)
    setFormAuxilioCreche(400)
    setFormAlertaDias(60)
    setFormObservacoes('')
    setModalConvencaoAberto(true)
  }

  // Salvar Convenção
  const handleSalvarConvencao = async () => {
    if (!tenant?.id || !user?.id) return
    if (!formEmpresa || !formTitulo || !formSindicatoLaboral || !formCategoria) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha título, sindicato laboral, categoria e datas de vigência.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSalvandoConvencao(true)
      const payload = {
        tenant_id: tenant.id,
        empresa: formEmpresa,
        titulo: formTitulo,
        sindicato_laboral: formSindicatoLaboral,
        sindicato_patronal: formSindicatoPatronal,
        categoria_profissional: formCategoria,
        numero_registro_mte: formNumeroMte,
        data_base: formDataBase,
        vigencia_inicio: new Date(formVigenciaInicio).toISOString(),
        vigencia_fim: new Date(formVigenciaFim + 'T23:59:59.000Z').toISOString(),
        piso_salarial: formPisoSalarial,
        percentual_reajuste: formPercentualReajuste,
        data_aplicacao_reajuste: new Date(formDataAplicacaoReajuste).toISOString(),
        adicional_hora_extra: formAdicionalHe,
        adicional_noturno: formAdicionalNoturno,
        adicional_insalubridade_minimo: formAdicionalInsalubridade,
        ticket_refeicao_diario: formTicketRefeicao,
        auxilio_creche: formAuxilioCreche,
        alerta_dias_config: formAlertaDias,
        observacoes: formObservacoes,
      }

      if (editandoConvencaoId) {
        await convencoesService.updateConvencao(editandoConvencaoId, payload, user.id)
        toast({
          title: 'Convenção atualizada',
          description: `Os parâmetros de "${formTitulo}" foram salvos com sucesso.`,
        })
      } else {
        await convencoesService.createConvencao(payload, user.id)
        toast({
          title: 'Convenção cadastrada',
          description: `Monitoramento ativo para "${formTitulo}".`,
        })
      }

      setModalConvencaoAberto(false)
      await onRefresh()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao salvar convenção',
        description: 'Verifique os dados informados.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoConvencao(false)
    }
  }

  // Abrir Simulação de Impacto para "Atualizar Folha com 1 Clique"
  const handleIniciarAplicacao1Clique = async (convencao: ConvencaoColetivaRecord) => {
    if (!tenant?.id) return
    try {
      setSimulando(true)
      const simulacao = await convencoesService.simularImpactoReajuste(
        tenant.id,
        convencao.id,
        competenciaAtual,
      )
      setSimulacaoImpacto(simulacao)
      setModalRevisaoAberto(true)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro na simulação',
        description: 'Não foi possível apurar o impacto dos colaboradores.',
        variant: 'destructive',
      })
    } finally {
      setSimulando(false)
    }
  }

  // Executar a aplicação 1 Clique confirmada
  const handleConfirmarAplicacao1Clique = async () => {
    if (!tenant?.id || !user?.id || !simulacaoImpacto) return

    try {
      setAplicando1Clique(true)
      const res: ResultadoAplicacaoFolha = await convencoesService.aplicarParametrosFolha1Clique(
        tenant.id,
        simulacaoImpacto.convencao.id,
        competenciaAtual,
        user.id,
        aplicarRetroativoCheck,
      )

      toast({
        title: 'Folha Atualizada com 1 Clique!',
        description: `${res.colaboradoresAtualizados} colaborador(es) reajustados. Custo mensal adicional: R$ ${res.custoAdicionalMensal.toFixed(
          2,
        )}. Folha da competência ${competenciaAtual} recalculada com sucesso!`,
      })

      setModalRevisaoAberto(false)
      await onRefresh()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao aplicar reajuste',
        description: 'Ocorreu uma falha durante a atualização da folha.',
        variant: 'destructive',
      })
    } finally {
      setAplicando1Clique(false)
    }
  }

  // Reversão / Rollback de um lote
  const handleReverterLote = async (loteId: string) => {
    if (!tenant?.id || !user?.id) return
    if (
      !confirm(
        `Deseja realmente REVERTER todos os salários reajustados neste lote (${loteId}) para seus valores anteriores?`,
      )
    ) {
      return
    }

    try {
      setRevertendoLote(loteId)
      const res = await convencoesService.reverterReajusteLote(
        tenant.id,
        loteId,
        competenciaAtual,
        user.id,
      )
      if (res.sucesso) {
        toast({
          title: 'Reversão (Rollback) Concluída',
          description: `${res.revertidos} colaborador(es) restaurados aos salários anteriores e folha recalculada.`,
        })
        await onRefresh()
      } else {
        toast({
          title: 'Nenhum registro revertido',
          description: 'Este lote já havia sido revertido ou não possui lançamentos.',
          variant: 'destructive',
        })
      }
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro no rollback',
        description: 'Não foi possível reverter o lote.',
        variant: 'destructive',
      })
    } finally {
      setRevertendoLote(null)
    }
  }

  // Excluir convenção
  const handleExcluirConvencao = async (id: string, titulo: string) => {
    if (!user?.id) return
    if (!confirm(`Remover convenção "${titulo}" do monitoramento?`)) return

    try {
      await convencoesService.deleteConvencao(id, user.id)
      toast({
        title: 'Convenção removida',
        description: 'O registro foi excluído do sistema.',
      })
      await onRefresh()
    } catch (err) {
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível remover a convenção.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* BANNER DE TRANSPARÊNCIA RUMO (DIÁRIO OFICIAL & SUPERVISÃO) */}
      <Alert className="border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40">
        <Info className="h-5 w-5 text-amber-700 dark:text-amber-400" />
        <AlertTitle className="font-semibold text-amber-900 dark:text-amber-200">
          Monitoramento de Vigência & Padrão de Transparência Rumo
        </AlertTitle>
        <AlertDescription className="text-xs text-amber-800 dark:text-amber-300 space-y-1.5 mt-1">
          <p>
            • <b>Aviso de Transparência Legal:</b> O sistema <b>não lê o Diário Oficial sozinho</b>{' '}
            ou de forma autônoma sem supervisão. O monitoramento automatizado acompanha
            rigorosamente <b>prazos de vigência, datas-base e proximidade de vencimento</b> (com
            notificações diárias no sino e por e-mail aos contadores).
          </p>
          <p>
            • <b>Atualização em 1 Clique:</b> Ao receber o instrumento homologado (CCT/ACT) ou a
            minuta sindical, o contador cadastra os novos parâmetros (piso, percentual de reajuste,
            data-base e verbas) e o botão <b>&quot;Atualizar Folha com 1 Clique&quot;</b> aplica em
            cascata todas as alterações salariais, recalcula as verbas e a folha da competência, com
            trilha de auditoria integral e opção de <b>reversão (rollback)</b>.
          </p>
        </AlertDescription>
      </Alert>

      {/* CARDS DE SAÚDE DAS CONVENÇÕES (BADGES 🟢🟡🔴) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">
              Total de CCTs Cadastradas
            </span>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">{saudeConvencoes.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Instrumentos sob monitoramento</p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">
              Vigentes & Regulares
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {saudeConvencoes.verdes}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              🟢 Prazos acima do limite de alerta
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">
              A Vencer (Atenção)
            </span>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {saudeConvencoes.amarelos}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              🟡 Vencimento a menos de 60/30 dias
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">
              Vencidas / Urgentes
            </span>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {saudeConvencoes.vermelhos}
            </div>
            <p className="text-xs text-muted-foreground mt-1">🔴 Expiradas sem termo aditivo</p>
          </CardContent>
        </Card>
      </div>

      {/* ABAS: CONVENÇÕES ATIVAS & HISTÓRICO SALARIAL / AUDITORIA */}
      <Tabs defaultValue="convencoes" className="w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3">
          <TabsList>
            <TabsTrigger value="convencoes" className="text-xs gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Convenções & Parâmetros ({convencoes.length})
            </TabsTrigger>
            <TabsTrigger value="historico" className="text-xs gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Histórico de Reajustes & Rollback (
              {historicosSalariais.length})
            </TabsTrigger>
          </TabsList>

          {podeEditar && (
            <Button
              size="sm"
              onClick={abrirNovaConvencao}
              className="h-9 gap-1.5 text-xs bg-primary"
            >
              <Plus className="h-4 w-4" /> Nova Convenção Coletiva
            </Button>
          )}
        </div>

        {/* TAB 1: CONVENÇÕES E MONITORAMENTO */}
        <TabsContent value="convencoes" className="space-y-4 pt-4">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-lg border">
            <div className="relative flex-1 w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por sindicato, categoria..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-[180px] h-9 text-xs">
                  <SelectValue placeholder="Status de Vigência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="vigente">🟢 Vigentes</SelectItem>
                  <SelectItem value="a_vencer">🟡 A Vencer (&lt; 60 dias)</SelectItem>
                  <SelectItem value="vencida">🔴 Vencidas</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => onRefresh()}
                className="h-9 gap-1 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Cards de Cada Convenção */}
          <div className="space-y-4">
            {convencoesFiltradas.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-semibold">Nenhuma convenção coletiva encontrada.</p>
                  <p className="text-xs">
                    Cadastre a convenção da empresa para ativar o monitoramento.
                  </p>
                </CardContent>
              </Card>
            ) : (
              convencoesFiltradas.map((c) => {
                const info = convencoesService.calcularStatusVigencia(
                  c.vigencia_fim,
                  c.alerta_dias_config || 60,
                )
                const empresaNome =
                  c.expand?.empresa?.razao_social ||
                  empresas.find((e) => e.id === c.empresa)?.razao_social ||
                  'Empresa'

                return (
                  <Card
                    key={c.id}
                    className={`border transition-shadow hover:shadow-md ${
                      info.corBadge === 'vermelho'
                        ? 'border-red-300 dark:border-red-900/60 bg-red-50/20'
                        : info.corBadge === 'amarelo'
                          ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50/20'
                          : 'border-border'
                    }`}
                  >
                    <CardHeader className="p-4 pb-3">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-foreground">{c.titulo}</span>
                            {/* Badges de Vigência 🟢🟡🔴 */}
                            {info.corBadge === 'verde' && (
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[11px] gap-1"
                              >
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                Vigente ({info.diasRestantes} dias restantes)
                              </Badge>
                            )}
                            {info.corBadge === 'amarelo' && (
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-700 border-amber-300 text-[11px] gap-1"
                              >
                                <span className="h-2 w-2 rounded-full bg-amber-500" />
                                Atenção: Vence em {info.diasRestantes} dias
                              </Badge>
                            )}
                            {info.corBadge === 'vermelho' && (
                              <Badge
                                variant="outline"
                                className="bg-red-50 text-red-700 border-red-300 text-[11px] gap-1"
                              >
                                <span className="h-2 w-2 rounded-full bg-red-500" />
                                ⚠️ Vencida ({Math.abs(info.diasRestantes)} dias expirados)
                              </Badge>
                            )}

                            <Badge variant="secondary" className="text-[10px]">
                              Data-Base: {c.data_base}
                            </Badge>
                          </div>

                          <p className="text-xs text-muted-foreground mt-1">
                            <b>Empresa:</b> {empresaNome} • <b>Sindicato:</b> {c.sindicato_laboral}
                          </p>
                        </div>

                        {/* Ações Rápidas */}
                        <div className="flex items-center gap-2">
                          {podeEditar && (
                            <Button
                              size="sm"
                              onClick={() => handleIniciarAplicacao1Clique(c)}
                              disabled={simulando}
                              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-9 gap-1.5 shadow-sm font-semibold"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              Atualizar Folha com 1 Clique
                            </Button>
                          )}

                          {podeEditar && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-red-600"
                              onClick={() => handleExcluirConvencao(c.id, c.titulo)}
                              title="Excluir convenção"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-0 space-y-3">
                      {/* Grid de Parâmetros Coletados da CCT */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-3 bg-muted/40 rounded-lg border text-xs">
                        <div>
                          <span className="text-[11px] text-muted-foreground block">
                            Piso Salarial
                          </span>
                          <span className="font-bold text-foreground">
                            R${' '}
                            {(c.piso_salarial || 0).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>

                        <div>
                          <span className="text-[11px] text-muted-foreground block">
                            Reajuste Pactuado
                          </span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            +{c.percentual_reajuste || 0}%
                          </span>
                        </div>

                        <div>
                          <span className="text-[11px] text-muted-foreground block">
                            Hora Extra Mín.
                          </span>
                          <span className="font-semibold text-foreground">
                            {c.adicional_hora_extra || 50}%
                          </span>
                        </div>

                        <div>
                          <span className="text-[11px] text-muted-foreground block">
                            Adic. Noturno
                          </span>
                          <span className="font-semibold text-foreground">
                            {c.adicional_noturno || 20}%
                          </span>
                        </div>

                        <div>
                          <span className="text-[11px] text-muted-foreground block">
                            Ticket Refeição
                          </span>
                          <span className="font-semibold text-foreground">
                            R${' '}
                            {(c.ticket_refeicao_diario || 0).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}
                            /dia
                          </span>
                        </div>

                        <div>
                          <span className="text-[11px] text-muted-foreground block">
                            Auxílio Creche
                          </span>
                          <span className="font-semibold text-foreground">
                            R${' '}
                            {(c.auxilio_creche || 0).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Parâmetros adicionais se houver */}
                      {c.parametros_adicionais_json && c.parametros_adicionais_json.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="text-muted-foreground font-medium">
                            Outras Cláusulas:
                          </span>
                          {c.parametros_adicionais_json.map((param, pIdx) => (
                            <Badge key={pIdx} variant="outline" className="text-[10px] py-0">
                              {param.nome}: {param.valor} {param.unidade || ''}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Vigência e Alerta */}
                      <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                        <div>
                          Vigência:{' '}
                          <span className="font-medium text-foreground">
                            {new Date(c.vigencia_inicio).toLocaleDateString('pt-BR')} até{' '}
                            {new Date(c.vigencia_fim).toLocaleDateString('pt-BR')}
                          </span>{' '}
                          {c.numero_registro_mte && `(Registro MTE: ${c.numero_registro_mte})`}
                        </div>

                        {c.ultima_aplicacao_em && (
                          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                            Última aplicação na folha:{' '}
                            {new Date(c.ultima_aplicacao_em).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>

        {/* TAB 2: HISTÓRICO SALARIAL & AUDITORIA DE REAJUSTES (COM ROLLBACK) */}
        <TabsContent value="historico" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="p-4 pb-2 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">
                    Trilha de Auditoria: Alterações Salariais & Convenções
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Registro de reajustes aplicados em 1 clique, com cálculo de diferença retroativa
                    e reversão instantânea.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  {historicosSalariais.length} registro(s)
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-xs font-semibold">Data / Lote</TableHead>
                      <TableHead className="text-xs font-semibold">Colaborador</TableHead>
                      <TableHead className="text-xs font-semibold">Origem / Motivo</TableHead>
                      <TableHead className="text-xs font-semibold text-right">
                        Salário Anterior
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-right">
                        Novo Salário
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-right">
                        Diferença Mensal
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-right">
                        Retroativo Sugerido
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-center">
                        Status / Ação
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {historicosSalariais.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center py-8 text-muted-foreground text-xs"
                        >
                          Nenhum histórico salarial registrado até o momento.
                        </TableCell>
                      </TableRow>
                    ) : (
                      historicosSalariais.map((h) => {
                        const funcNome = h.expand?.funcionario?.nome_completo || 'Colaborador'
                        const cctNome =
                          h.expand?.convencao_origem?.titulo || 'Convenção Coletiva de Trabalho'

                        return (
                          <TableRow key={h.id} className="text-xs hover:bg-muted/20">
                            <TableCell className="py-2.5">
                              <div className="font-medium">
                                {new Date(h.data_alteracao).toLocaleDateString('pt-BR')}
                              </div>
                              <div className="text-[10px] font-mono text-muted-foreground">
                                {h.lote_reajuste_id || 'INDIVIDUAL'}
                              </div>
                            </TableCell>

                            <TableCell className="py-2.5 font-medium">{funcNome}</TableCell>

                            <TableCell className="py-2.5">
                              <div className="font-medium text-foreground">{cctNome}</div>
                              <div className="text-[10px] text-muted-foreground">
                                {h.motivo === 'enquadramento_piso'
                                  ? 'Enquadramento ao Piso Salarial'
                                  : 'Reajuste CCT (+ ' + (h.percentual_aplicado || 0) + '%)'}
                              </div>
                            </TableCell>

                            <TableCell className="py-2.5 text-right text-muted-foreground">
                              R$ {h.salario_anterior.toFixed(2)}
                            </TableCell>

                            <TableCell className="py-2.5 text-right font-bold text-foreground">
                              R$ {h.salario_novo.toFixed(2)}
                            </TableCell>

                            <TableCell className="py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                              +R$ {(h.diferenca_mensal || 0).toFixed(2)}
                            </TableCell>

                            <TableCell className="py-2.5 text-right font-medium text-amber-700 dark:text-amber-400">
                              {(h.retroativo_sugerido || 0) > 0 ? (
                                <div>
                                  R$ {h.retroativo_sugerido?.toFixed(2)}
                                  <div className="text-[10px] text-muted-foreground">
                                    {h.meses_retroativos} mês(es) retroativo(s)
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>

                            <TableCell className="py-2.5 text-center">
                              {h.revertido ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] bg-red-50 text-red-700 border-red-200"
                                >
                                  Revertido (Rollback)
                                </Badge>
                              ) : (
                                podeEditar &&
                                h.lote_reajuste_id && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleReverterLote(h.lote_reajuste_id!)}
                                    disabled={revertendoLote === h.lote_reajuste_id}
                                    className="h-7 text-[11px] gap-1 text-muted-foreground hover:text-red-600 hover:border-red-300"
                                  >
                                    <Undo2 className="h-3 w-3" />
                                    {revertendoLote === h.lote_reajuste_id
                                      ? 'Revertendo...'
                                      : 'Desfazer Lote'}
                                  </Button>
                                )
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL: CADASTRO / EDIÇÃO DE CONVENÇÃO COLETIVA */}
      <Dialog open={modalConvencaoAberto} onOpenChange={setModalConvencaoAberto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {editandoConvencaoId
                ? 'Editar Convenção Coletiva'
                : 'Cadastrar Nova Convenção Coletiva'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Informe os parâmetros pactuados na CCT/ACT para iniciar o monitoramento e viabilizar o
              reajuste em 1 clique.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Empresa Vinculada</Label>
                <Select value={formEmpresa} onValueChange={setFormEmpresa}>
                  <SelectTrigger className="h-9 text-xs mt-1">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Título do Instrumento</Label>
                <Input
                  value={formTitulo}
                  onChange={(e) => setFormTitulo(e.target.value)}
                  placeholder="Ex: CCT TI / SINDPD-SP 2026/2027"
                  className="h-9 text-xs mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Sindicato Laboral (Trabalhadores)</Label>
                <Input
                  value={formSindicatoLaboral}
                  onChange={(e) => setFormSindicatoLaboral(e.target.value)}
                  placeholder="Ex: SINDPD - Sindicato dos Empregados em TI"
                  className="h-9 text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Categoria Profissional</Label>
                <Input
                  value={formCategoria}
                  onChange={(e) => setFormCategoria(e.target.value)}
                  placeholder="Ex: Empregados em TI e Desenvolvimento"
                  className="h-9 text-xs mt-1"
                />
              </div>
            </div>

            {/* Vigência e Datas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-muted/40 rounded-lg border">
              <div>
                <Label className="text-xs font-semibold">Data-Base Sindical</Label>
                <Input
                  value={formDataBase}
                  onChange={(e) => setFormDataBase(e.target.value)}
                  placeholder="01/01 ou Maio"
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Vigência Início</Label>
                <Input
                  type="date"
                  value={formVigenciaInicio}
                  onChange={(e) => setFormVigenciaInicio(e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Vigência Fim (Alerta Ativo)</Label>
                <Input
                  type="date"
                  value={formVigenciaFim}
                  onChange={(e) => setFormVigenciaFim(e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>

            {/* Parâmetros Salariais e de Folha */}
            <div className="border rounded-lg p-3 space-y-3 bg-card">
              <span className="text-xs font-bold text-foreground block">
                Parâmetros Salariais e de Cláusulas Econômicas
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Piso Salarial (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formPisoSalarial}
                    onChange={(e) => setFormPisoSalarial(parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs">Reajuste Salarial (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formPercentualReajuste}
                    onChange={(e) => setFormPercentualReajuste(parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs">Data de Aplicação do Reajuste</Label>
                  <Input
                    type="date"
                    value={formDataAplicacaoReajuste}
                    onChange={(e) => setFormDataAplicacaoReajuste(e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t">
                <div>
                  <Label className="text-[11px]">Adic. Hora Extra (%)</Label>
                  <Input
                    type="number"
                    value={formAdicionalHe}
                    onChange={(e) => setFormAdicionalHe(parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-[11px]">Adic. Noturno (%)</Label>
                  <Input
                    type="number"
                    value={formAdicionalNoturno}
                    onChange={(e) => setFormAdicionalNoturno(parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-[11px]">VR Diário (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formTicketRefeicao}
                    onChange={(e) => setFormTicketRefeicao(parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-[11px]">Auxílio Creche (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formAuxilioCreche}
                    onChange={(e) => setFormAuxilioCreche(parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Configuração do Monitoramento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Alerta de Vencimento Antecipado</Label>
                <Select
                  value={formAlertaDias.toString()}
                  onValueChange={(v) => setFormAlertaDias(parseInt(v))}
                >
                  <SelectTrigger className="h-9 text-xs mt-1">
                    <SelectValue placeholder="Dias de antecedência" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">60 dias antes (Padrão)</SelectItem>
                    <SelectItem value="45">45 dias antes</SelectItem>
                    <SelectItem value="30">30 dias antes</SelectItem>
                    <SelectItem value="15">15 dias antes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Nº Registro MTE (Mediador)</Label>
                <Input
                  value={formNumeroMte}
                  onChange={(e) => setFormNumeroMte(e.target.value)}
                  placeholder="Ex: SP001428/2026"
                  className="h-9 text-xs mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Observações / Anotações Sindicais</Label>
              <Input
                value={formObservacoes}
                onChange={(e) => setFormObservacoes(e.target.value)}
                placeholder="Ex: Aguardando homologação do termo aditivo pelo MTE."
                className="h-8 text-xs mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalConvencaoAberto(false)}
              disabled={salvandoConvencao}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSalvarConvencao}
              disabled={salvandoConvencao}
              className="bg-primary gap-1"
            >
              {salvandoConvencao ? 'Salvando...' : 'Salvar e Ativar Monitor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE REVISÃO E CONFIRMAÇÃO: ATUALIZAR FOLHA COM 1 CLIQUE */}
      <Dialog open={modalRevisaoAberto} onOpenChange={setModalRevisaoAberto}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary font-bold">
              <Sparkles className="h-5 w-5" />
              Revisão de Impacto na Folha: Atualizar com 1 Clique
            </DialogTitle>
            <DialogDescription className="text-xs">
              Confira detalhadamente as alterações salariais, impacto financeiro mensal e verbas em
              cascata antes de aplicar.
            </DialogDescription>
          </DialogHeader>

          {simulacaoImpacto && (
            <div className="space-y-4 py-2">
              {/* Resumo da Convenção Selecionada */}
              <div className="bg-muted/40 p-3 rounded-lg border text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <span className="text-muted-foreground block">Convenção:</span>
                  <span className="font-bold text-foreground">
                    {simulacaoImpacto.convencao.titulo}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Reajuste Pactuado:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    +{simulacaoImpacto.convencao.percentual_reajuste}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Piso da Categoria:</span>
                  <span className="font-bold text-foreground">
                    R${' '}
                    {(simulacaoImpacto.convencao.piso_salarial || 0).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Competência Afetada:</span>
                  <span className="font-bold text-foreground">
                    {simulacaoImpacto.competenciaAfetada}
                  </span>
                </div>
              </div>

              {/* Cards de Impacto Financeiro Estimado */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="border-border">
                  <CardContent className="p-3">
                    <span className="text-xs text-muted-foreground block">
                      Colaboradores Impactados
                    </span>
                    <span className="text-xl font-bold text-foreground">
                      {simulacaoImpacto.totalColaboradores}
                    </span>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardContent className="p-3">
                    <span className="text-xs text-muted-foreground block">
                      Custo Adicional Mensal
                    </span>
                    <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      +R${' '}
                      {simulacaoImpacto.custoAdicionalMensal.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardContent className="p-3">
                    <span className="text-xs text-muted-foreground block">
                      Diferença Retroativa Total
                    </span>
                    <span className="text-xl font-bold text-amber-600 dark:text-amber-400">
                      R${' '}
                      {simulacaoImpacto.custoRetroativoTotal.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </CardContent>
                </Card>
              </div>

              {/* Tabela de Colaboradores Reajustados */}
              <div>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                  Demonstrativo por Colaborador
                </h4>
                <div className="border rounded-lg max-h-56 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 text-[11px]">
                        <TableHead>Colaborador / Cargo</TableHead>
                        <TableHead className="text-right">Salário Atual</TableHead>
                        <TableHead className="text-right">Novo Salário</TableHead>
                        <TableHead className="text-right">Aumento Mensal</TableHead>
                        <TableHead className="text-right">Retroativo Sugerido</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {simulacaoImpacto.colaboradoresImpactados.map((item) => (
                        <TableRow key={item.funcionarioId} className="text-xs">
                          <TableCell className="py-2">
                            <span className="font-semibold block">{item.nomeCompleto}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {item.cargo} {item.enquadradoPiso && '• Enquadrado no Piso'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right py-2 text-muted-foreground">
                            R$ {item.salarioAtual.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right py-2 font-bold text-foreground">
                            R$ {item.salarioNovo.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right py-2 font-medium text-emerald-600 dark:text-emerald-400">
                            +R$ {item.diferencaMensal.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right py-2 text-amber-700 dark:text-amber-400 font-medium">
                            {item.retroativoSugerido > 0 ? (
                              <span>
                                R$ {item.retroativoSugerido.toFixed(2)}{' '}
                                <span className="text-[10px] text-muted-foreground">
                                  ({item.mesesRetroativos}m)
                                </span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Verbas do Catálogo que serão atualizadas em cascata */}
              {simulacaoImpacto.verbasAtualizadasCatalogo.length > 0 && (
                <div className="p-3 bg-muted/30 rounded-lg border text-xs space-y-1">
                  <span className="font-semibold text-foreground block">
                    Atualizações em Cascata no Catálogo de Verbas:
                  </span>
                  {simulacaoImpacto.verbasAtualizadasCatalogo.map((v) => (
                    <div key={v.codigo} className="flex items-center justify-between text-[11px]">
                      <span>
                        • Verba {v.codigo} - {v.descricao}
                      </span>
                      <span className="font-semibold">
                        De {v.valorAnterior}% para {v.valorNovo}%
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Opção de lançar retroativo */}
              {simulacaoImpacto.custoRetroativoTotal > 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-lg">
                  <Checkbox
                    id="check-retroativo"
                    checked={aplicarRetroativoCheck}
                    onCheckedChange={(c) => setAplicarRetroativoCheck(!!c)}
                    className="mt-0.5"
                  />
                  <div className="text-xs">
                    <label
                      htmlFor="check-retroativo"
                      className="font-semibold text-amber-900 dark:text-amber-200 cursor-pointer"
                    >
                      Lançar Diferença Salarial Retroativa na Folha de{' '}
                      {simulacaoImpacto.competenciaAfetada}
                    </label>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                      Gera automaticamente os lançamentos da rubrica de diferença salarial
                      retroativa pactuada no montante total de R${' '}
                      {simulacaoImpacto.custoRetroativoTotal.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                      .
                    </p>
                  </div>
                </div>
              )}

              {/* Nota Legal */}
              <p className="text-[11px] text-muted-foreground italic">
                {simulacaoImpacto.avisoLegal}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalRevisaoAberto(false)}
              disabled={aplicando1Clique}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmarAplicacao1Clique}
              disabled={aplicando1Clique}
              className="bg-primary gap-1.5 font-semibold"
            >
              {aplicando1Clique ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Aplicando Reajuste em Cascata...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Confirmar e Aplicar na Folha
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

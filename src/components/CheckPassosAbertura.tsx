import { useState } from 'react'
import {
  CheckCircle2,
  Circle,
  Clock,
  User,
  Hash,
  Calendar,
  Save,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  AlertCircle,
  HelpCircle,
  Lock,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  ItemCheckPassoAbertura,
  agruparPassosAbertura,
  inicializarChecklistPassos,
} from '@/lib/passosAberturaConfig'
import { formatDateTimePtBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'

interface CheckPassosAberturaProps {
  itens?: ItemCheckPassoAbertura[] | null
  podeEditar: boolean // apenas contador e administrador
  usuarioAtual: {
    id: string
    nome: string
    role?: string
  }
  tenantId: string
  workflowId: string
  contexto?: 'workflow_painel' | 'empresa_aba'
  workflowConcluido?: boolean
  onSolicitarFinalizacao?: () => void
  onToggleItem: (
    itemId: string,
    marcado: boolean,
    dadosAuxiliares?: {
      protocolo_viabilidade?: string
      nire?: string
      data_efetivacao_cnpj?: string
      observacao?: string
    },
  ) => Promise<void>
  onSalvarCamposAuxiliares: (
    itemId: string,
    campos: {
      protocolo_viabilidade?: string
      nire?: string
      data_efetivacao_cnpj?: string
      observacao?: string
    },
  ) => Promise<void>
}

export function CheckPassosAbertura({
  itens: itensProp,
  podeEditar,
  onToggleItem,
  onSalvarCamposAuxiliares,
  contexto = 'workflow_painel',
  workflowConcluido = false,
  onSolicitarFinalizacao,
}: CheckPassosAberturaProps) {
  const { toast } = useToast()
  const itens = inicializarChecklistPassos(itensProp)
  const grupos = agruparPassosAbertura(itens)

  // Progresso geral
  const totalGeral = itens.length // 18
  const concluidosGeral = itens.filter((i) => i.concluido).length
  const percentualGeral = Math.round((concluidosGeral / totalGeral) * 100)

  // Identifica o passo atual: primeiro passo com item pendente
  const passoAtual =
    grupos.find((g) => g.itens.some((it) => !it.concluido)) || grupos[grupos.length - 1]

  // Estado de recolhimento dos 3 passos
  const [passosAbertos, setPassosAbertos] = useState<Record<string, boolean>>({
    passo_1: true,
    passo_2: true,
    passo_3: true,
  })

  // Estado inline dos campos auxiliares por item
  const [valoresAuxiliares, setValoresAuxiliares] = useState<
    Record<
      string,
      {
        protocolo_viabilidade: string
        nire: string
        data_efetivacao_cnpj: string
      }
    >
  >(() => {
    const map: Record<
      string,
      { protocolo_viabilidade: string; nire: string; data_efetivacao_cnpj: string }
    > = {}
    itens.forEach((it) => {
      map[it.id] = {
        protocolo_viabilidade: it.protocolo_viabilidade || '',
        nire: it.nire || '',
        data_efetivacao_cnpj: it.data_efetivacao_cnpj || '',
      }
    })
    return map
  })

  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [salvandoCamposId, setSalvandoCamposId] = useState<string | null>(null)

  const togglePassoAberto = (passoId: string) => {
    setPassosAbertos((prev) => ({
      ...prev,
      [passoId]: !prev[passoId],
    }))
  }

  const handleToggle = async (item: ItemCheckPassoAbertura) => {
    if (!podeEditar) {
      toast({
        title: 'Acesso restrito',
        description:
          'Apenas Administradores e Contadores podem marcar ou desmarcar os passos operacionais da abertura.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSalvandoId(item.id)
      const novoStatus = !item.concluido
      const aux = valoresAuxiliares[item.id] || {
        protocolo_viabilidade: item.protocolo_viabilidade || '',
        nire: item.nire || '',
        data_efetivacao_cnpj: item.data_efetivacao_cnpj || '',
      }

      await onToggleItem(item.id, novoStatus, aux)

      toast({
        title: novoStatus ? 'Item concluído' : 'Item reaberto para correção',
        description: `Passo ${item.numero} atualizado com sucesso.`,
      })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao atualizar passo',
        description: 'Não foi possível salvar o status do item. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoId(null)
    }
  }

  const handleSalvarCamposAuxiliares = async (item: ItemCheckPassoAbertura) => {
    if (!podeEditar) return
    const aux = valoresAuxiliares[item.id] || {
      protocolo_viabilidade: '',
      nire: '',
      data_efetivacao_cnpj: '',
    }
    try {
      setSalvandoCamposId(item.id)
      await onSalvarCamposAuxiliares(item.id, aux)
      toast({
        title: 'Anotações salvas',
        description: 'Dados auxiliares do passo registrados com sucesso.',
      })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as anotações do passo.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoCamposId(null)
    }
  }

  return (
    <Card className="border border-border/80 shadow-sm overflow-hidden bg-card">
      <CardHeader className="bg-muted/30 pb-4 border-b border-border/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg font-bold tracking-tight">
                Check dos Passos da Abertura
              </CardTitle>
              <Badge variant="outline" className="text-xs font-mono font-medium">
                {concluidosGeral}/{totalGeral} itens ({percentualGeral}%)
              </Badge>
              {passoAtual && (
                <Badge
                  variant="secondary"
                  className="bg-primary/10 text-primary border-primary/20 text-xs hidden sm:inline-flex"
                >
                  Foco: Passo {passoAtual.numero}
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Roteiro operacional obrigatório de 3 passos para abertura legal de empresa
              (Viabilidade, Coletor Nacional e Junta Comercial).
              {!podeEditar && (
                <span className="inline-flex items-center gap-1 ml-2 text-amber-600 font-medium">
                  <Lock className="h-3 w-3" /> Modo somente leitura (apenas Contador/Admin)
                </span>
              )}
            </CardDescription>
          </div>

          <div className="w-full md:w-56 space-y-1.5 self-center">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="font-medium">Progresso Geral</span>
              <span className="font-semibold text-foreground">
                {concluidosGeral} de {totalGeral}
              </span>
            </div>
            <Progress value={percentualGeral} className="h-2.5" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-5">
        {grupos.map((grupo) => {
          const concluidosGrupo = grupo.itens.filter((i) => i.concluido).length
          const totalGrupo = grupo.itens.length
          const percGrupo = Math.round((concluidosGrupo / totalGrupo) * 100)
          const isAberto = passosAbertos[grupo.id] ?? true
          const isPassoAtual = passoAtual?.id === grupo.id
          const is100 = concluidosGrupo === totalGrupo

          return (
            <div
              key={grupo.id}
              className={`rounded-lg border transition-all ${
                is100
                  ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/20 dark:bg-emerald-950/10'
                  : isPassoAtual
                    ? 'border-primary/40 bg-card shadow-sm ring-1 ring-primary/20'
                    : 'border-border/70 bg-card'
              }`}
            >
              {/* Header do Passo */}
              <button
                type="button"
                onClick={() => togglePassoAberto(grupo.id)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/40 transition-colors rounded-t-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                      is100
                        ? 'bg-emerald-500 text-white'
                        : isPassoAtual
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {is100 ? <CheckCircle2 className="h-5 w-5" /> : grupo.numero}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{grupo.titulo}</span>
                      {isPassoAtual && !is100 && (
                        <Badge
                          variant="secondary"
                          className="bg-primary/10 text-primary border-primary/20 text-[10px] py-0 px-1.5"
                        >
                          Passo Atual
                        </Badge>
                      )}
                      {is100 && (
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 text-[10px] py-0 px-1.5"
                        >
                          Concluído
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      {grupo.subtitulo}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs font-semibold text-foreground">
                      {concluidosGrupo}/{totalGrupo}
                    </span>
                    <span className="text-[11px] text-muted-foreground ml-1">({percGrupo}%)</span>
                    <div className="w-20 hidden sm:block mt-1">
                      <Progress value={percGrupo} className="h-1.5" />
                    </div>
                  </div>
                  {isAberto ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Lista de itens do passo */}
              {isAberto && (
                <div className="p-3 sm:p-4 border-t border-border/50 divide-y divide-border/40">
                  {grupo.itens.map((item) => {
                    const isSalvando = salvandoId === item.id
                    const auxState = valoresAuxiliares[item.id] || {
                      protocolo_viabilidade: item.protocolo_viabilidade || '',
                      nire: item.nire || '',
                      data_efetivacao_cnpj: item.data_efetivacao_cnpj || '',
                    }

                    return (
                      <div
                        key={item.id}
                        className={`py-3 first:pt-1 last:pb-1 transition-colors ${
                          item.concluido ? 'bg-muted/10' : 'hover:bg-muted/20'
                        } rounded-md px-2`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            disabled={!podeEditar || isSalvando}
                            onClick={() => handleToggle(item)}
                            title={
                              !podeEditar
                                ? 'Somente Contador e Administrador podem alterar'
                                : item.concluido
                                  ? 'Clique para desmarcar (auditado)'
                                  : 'Clique para marcar como concluído'
                            }
                            className={`mt-0.5 flex-shrink-0 transition-transform active:scale-95 disabled:cursor-not-allowed ${
                              !podeEditar ? 'opacity-60' : 'cursor-pointer'
                            }`}
                          >
                            {item.concluido ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
                            )}
                          </button>

                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <p
                                onClick={() => podeEditar && !isSalvando && handleToggle(item)}
                                className={`text-sm leading-relaxed ${
                                  item.concluido
                                    ? 'text-foreground/70 line-through decoration-muted-foreground/60'
                                    : 'text-foreground font-medium'
                                } ${podeEditar ? 'cursor-pointer select-none' : ''}`}
                              >
                                <span className="font-mono text-xs font-bold text-muted-foreground mr-1.5">
                                  #{item.numero}
                                </span>
                                {item.texto}
                              </p>
                            </div>

                            {/* Detalhes de conclusão e auditoria */}
                            {item.concluido && (
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground pt-0.5">
                                {item.concluido_em && (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                                    <Clock className="h-3 w-3" />
                                    Concluído em: {formatDateTimePtBr(item.concluido_em)}
                                  </span>
                                )}
                                {item.concluido_por_nome && (
                                  <span className="inline-flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    Por: {item.concluido_por_nome}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Campos auxiliares inline (onde o texto pede anotação) */}
                            {item.temProtocoloViabilidade && (
                              <div className="mt-2 p-2.5 rounded-md bg-muted/40 border border-border/60 max-w-lg space-y-1.5">
                                <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                                  <Hash className="h-3 w-3 text-primary" />
                                  Número do Protocolo da Viabilidade
                                </label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    disabled={!podeEditar}
                                    placeholder="Ex: SPV2600123456 ou PRV123..."
                                    value={auxState.protocolo_viabilidade}
                                    onChange={(e) =>
                                      setValoresAuxiliares((prev) => ({
                                        ...prev,
                                        [item.id]: {
                                          ...auxState,
                                          protocolo_viabilidade: e.target.value,
                                        },
                                      }))
                                    }
                                    className="h-8 text-xs font-mono uppercase bg-background"
                                  />
                                  {podeEditar && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={salvandoCamposId === item.id}
                                      onClick={() => handleSalvarCamposAuxiliares(item)}
                                      className="h-8 px-2.5 text-xs gap-1 shrink-0"
                                    >
                                      <Save className="h-3.5 w-3.5" />
                                      Salvar
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )}

                            {item.temNireCnpj && (
                              <div className="mt-2 p-2.5 rounded-md bg-muted/40 border border-border/60 max-w-xl space-y-2">
                                <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                                  <Hash className="h-3 w-3 text-primary" />
                                  Anotação de NIRE e Efetivação do CNPJ
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground">
                                      NIRE registrado
                                    </label>
                                    <Input
                                      disabled={!podeEditar}
                                      placeholder="Ex: 35.2.1234567-8"
                                      value={auxState.nire}
                                      onChange={(e) =>
                                        setValoresAuxiliares((prev) => ({
                                          ...prev,
                                          [item.id]: {
                                            ...auxState,
                                            nire: e.target.value,
                                          },
                                        }))
                                      }
                                      className="h-8 text-xs font-mono bg-background"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                                      <Calendar className="h-3 w-3" /> Data de Efetivação CNPJ
                                    </label>
                                    <Input
                                      type="date"
                                      disabled={!podeEditar}
                                      value={auxState.data_efetivacao_cnpj}
                                      onChange={(e) =>
                                        setValoresAuxiliares((prev) => ({
                                          ...prev,
                                          [item.id]: {
                                            ...auxState,
                                            data_efetivacao_cnpj: e.target.value,
                                          },
                                        }))
                                      }
                                      className="h-8 text-xs bg-background"
                                    />
                                  </div>
                                </div>
                                {podeEditar && (
                                  <div className="flex justify-end pt-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={salvandoCamposId === item.id}
                                      onClick={() => handleSalvarCamposAuxiliares(item)}
                                      className="h-7 px-2.5 text-xs gap-1"
                                    >
                                      <Save className="h-3 w-3" />
                                      Salvar Anotações
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Banner de Conclusão dos 18 passos ou ação rápida para finalizar e importar */}
        {!workflowConcluido && (
          <div
            className={`rounded-xl border p-4 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
              concluidosGeral === totalGeral
                ? 'border-emerald-300 bg-emerald-50/70 text-emerald-950 shadow-xs'
                : 'border-slate-200 bg-slate-50/70 text-slate-800'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold ${
                  concluidosGeral === totalGeral
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-[#1A2333]">
                    {concluidosGeral === totalGeral
                      ? 'Todos os 18 itens operacionais foram concluídos!'
                      : 'Etapa Final: Conclusão & Importação para Empresas'}
                  </h4>
                  {concluidosGeral === totalGeral && (
                    <Badge className="bg-emerald-200 text-emerald-900 text-[10px] font-bold">
                      100% Pronto
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {concluidosGeral === totalGeral
                    ? 'Abertura operacional finalizada. Preencha agora a identificação definitiva (tipo societário, razão social deferida, CNPJ e cliente) para importar diretamente para Empresas Cadastradas.'
                    : 'Ao concluir os passos ou quando a Junta homologar o processo, clique para concluir a abertura e importar para Empresas Cadastradas.'}
                </p>
              </div>
            </div>

            {podeEditar && onSolicitarFinalizacao && (
              <Button
                type="button"
                onClick={onSolicitarFinalizacao}
                className={`shrink-0 h-10 px-5 rounded-xl font-semibold text-xs gap-2 shadow-xs transition-colors ${
                  concluidosGeral === totalGeral
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse hover:animate-none'
                    : 'bg-[#0FA3A3] hover:bg-[#0D8E8E] text-white'
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Finalizar Abertura & Importar</span>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

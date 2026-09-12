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
import {
  Plus,
  Printer,
  Bus,
  Utensils,
  ShoppingBag,
  Info,
  Calendar,
  UserCheck,
  Building2,
  Trash2,
  Search,
  Sparkles,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { beneficiosService, CalculoBeneficioCltResult } from '@/services/beneficios'
import type {
  Empresa,
  Funcionario,
  BeneficioConcedidoRecord,
  BeneficioTipo,
  BeneficioStatus,
} from '@/types'

interface PainelBeneficiosProps {
  empresaSelecionadaId: string
  empresas: Empresa[]
  competenciaAtual: string
  funcionarios: Funcionario[]
  beneficios: BeneficioConcedidoRecord[]
  loading: boolean
  onRefresh: () => Promise<void>
}

export function PainelBeneficios({
  empresaSelecionadaId,
  empresas,
  competenciaAtual,
  funcionarios,
  beneficios,
  loading,
  onRefresh,
}: PainelBeneficiosProps) {
  const { user, tenant } = useAuth()
  const isReadOnly = user?.perfil === 'auxiliar' || user?.perfil === 'cliente'
  const podeEditar = user?.perfil === 'administrador' || user?.perfil === 'contador'

  // Filtros locais
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [filtroFuncionario, setFiltroFuncionario] = useState<string>('todos')
  const [buscaTermo, setBuscaTermo] = useState<string>('')

  // Modal Novo Benefício
  const [modalNovoAberto, setModalNovoAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // Form State
  const [formEmpresa, setFormEmpresa] = useState<string>(
    empresaSelecionadaId !== 'todas' ? empresaSelecionadaId : empresas[0]?.id || '',
  )
  const [formFuncionario, setFormFuncionario] = useState<string>('')
  const [formCompetencia, setFormCompetencia] = useState<string>(competenciaAtual)
  const [formTipo, setFormTipo] = useState<BeneficioTipo>('vale_transporte')
  const [formDiasUteis, setFormDiasUteis] = useState<number>(22)
  const [formQtdDia, setFormQtdDia] = useState<number>(2)
  const [formValorUnitario, setFormValorUnitario] = useState<number>(5.0)
  const [formCoparticipacaoPerc, setFormCoparticipacaoPerc] = useState<number>(5)
  const [formOperadora, setFormOperadora] = useState<string>('SPTrans / Bilhete Único')
  const [formNumeroCartao, setFormNumeroCartao] = useState<string>('')
  const [formObservacoes, setFormObservacoes] = useState<string>('')

  // Modal Recibo de Benefícios (Individual e Consolidado Empresa)
  const [modalReciboAberto, setModalReciboAberto] = useState(false)
  const [reciboModo, setReciboModo] = useState<'individual' | 'consolidado'>('individual')
  const [reciboFuncionarioId, setReciboFuncionarioId] = useState<string>('')

  // Colaborador selecionado no formulário
  const funcionarioFormObj = useMemo(() => {
    return funcionarios.find((f) => f.id === formFuncionario)
  }, [funcionarios, formFuncionario])

  // Cálculo CLT dinâmico no formulário
  const calculoCltPreview: CalculoBeneficioCltResult = useMemo(() => {
    const salBase = funcionarioFormObj?.salario || 0
    return beneficiosService.calcularBeneficioClt({
      tipo: formTipo,
      salarioBase: salBase,
      diasUteis: formDiasUteis,
      quantidadeDia: formQtdDia,
      valorUnitario: formValorUnitario,
      percentualDescontoInformado: formTipo === 'vale_transporte' ? 6 : formCoparticipacaoPerc,
    })
  }, [
    formTipo,
    funcionarioFormObj?.salario,
    formDiasUteis,
    formQtdDia,
    formValorUnitario,
    formCoparticipacaoPerc,
  ])

  // Lista de benefícios filtrada
  const beneficiosFiltrados = useMemo(() => {
    return beneficios.filter((b) => {
      if (filtroTipo !== 'todos' && b.tipo !== filtroTipo) return false
      if (filtroFuncionario !== 'todos' && b.funcionario !== filtroFuncionario) return false
      if (buscaTermo.trim()) {
        const termo = buscaTermo.toLowerCase()
        const nome = b.expand?.funcionario?.nome_completo?.toLowerCase() || ''
        const op = b.operadora?.toLowerCase() || ''
        const cartao = b.numero_cartao?.toLowerCase() || ''
        if (!nome.includes(termo) && !op.includes(termo) && !cartao.includes(termo)) return false
      }
      return true
    })
  }, [beneficios, filtroTipo, filtroFuncionario, buscaTermo])

  // Métricas consolidadas da competência
  const metricas = useMemo(() => {
    let totalBeneficios = 0
    let totalDescontoColaboradores = 0
    let totalCustoEmpresa = 0
    let qtdVt = 0
    let qtdVa = 0
    let qtdVr = 0

    beneficiosFiltrados.forEach((b) => {
      totalBeneficios += b.valor_total_beneficio || 0
      totalDescontoColaboradores += b.desconto_colaborador || 0
      totalCustoEmpresa += b.custo_empresa || 0
      if (b.tipo === 'vale_transporte') qtdVt++
      if (b.tipo === 'vale_alimentacao') qtdVa++
      if (b.tipo === 'vale_refeicao') qtdVr++
    })

    return {
      totalBeneficios,
      totalDescontoColaboradores,
      totalCustoEmpresa,
      qtdVt,
      qtdVa,
      qtdVr,
      totalLancamentos: beneficiosFiltrados.length,
    }
  }, [beneficiosFiltrados])

  // Salvar novo benefício
  const handleSalvarBeneficio = async () => {
    if (!tenant?.id || !user?.id) {
      toast({ title: 'Erro', description: 'Usuário não autenticado.', variant: 'destructive' })
      return
    }
    if (!formEmpresa || !formFuncionario || !formCompetencia) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Selecione a empresa, colaborador e competência.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSalvando(true)
      await beneficiosService.createBeneficio(
        {
          tenant_id: tenant.id,
          empresa: formEmpresa,
          funcionario: formFuncionario,
          competencia: formCompetencia,
          tipo: formTipo,
          dias_uteis: formDiasUteis,
          quantidade_dia: formQtdDia,
          valor_unitario: formValorUnitario,
          valor_total_beneficio: calculoCltPreview.valorTotalBeneficio,
          desconto_colaborador: calculoCltPreview.descontoColaborador,
          custo_empresa: calculoCltPreview.custoEmpresa,
          operadora: formOperadora,
          numero_cartao: formNumeroCartao,
          status: 'entregue',
          data_entrega: new Date().toISOString(),
          observacoes: formObservacoes,
        },
        user.id,
      )

      toast({
        title: 'Benefício Concedido com Sucesso',
        description: `${
          formTipo === 'vale_transporte' ? 'VT' : formTipo === 'vale_alimentacao' ? 'VA' : 'VR'
        } de R$ ${calculoCltPreview.valorTotalBeneficio.toFixed(
          2,
        )} cadastrado e sincronizado com a folha.`,
      })

      setModalNovoAberto(false)
      // reset form
      setFormObservacoes('')
      setFormNumeroCartao('')
      await onRefresh()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível cadastrar o benefício.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  // Excluir benefício
  const handleExcluirBeneficio = async (id: string, tipo: string) => {
    if (!user?.id) return
    if (!confirm('Deseja realmente remover esta concessão de benefício?')) return

    try {
      await beneficiosService.deleteBeneficio(id, user.id)
      toast({
        title: 'Benefício removido',
        description: `O registro de ${tipo} foi excluído da competência.`,
      })
      await onRefresh()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível remover o registro.',
        variant: 'destructive',
      })
    }
  }

  // Abrir Modal de Recibo
  const abrirRecibo = (modo: 'individual' | 'consolidado', funcId?: string) => {
    setReciboModo(modo)
    if (funcId) {
      setReciboFuncionarioId(funcId)
    } else if (funcionarios.length > 0) {
      setReciboFuncionarioId(funcionarios[0].id)
    }
    setModalReciboAberto(true)

    // Log de auditoria
    if (tenant?.id && user?.id) {
      const empNome =
        empresas.find((e) => e.id === empresaSelecionadaId)?.razao_social || 'Consolidado'
      beneficiosService.registrarAuditoriaRecibo(
        tenant.id,
        user.id,
        modo === 'individual' ? 'individual' : 'consolidado_empresa',
        empresaSelecionadaId,
        `Competência ${competenciaAtual} - Empresa ${empNome}`,
      )
    }
  }

  // Impressão nativa estilizada
  const dispararImpressao = () => {
    window.print()
  }

  // Dados do recibo individual
  const reciboFuncionario = useMemo(() => {
    return funcionarios.find((f) => f.id === reciboFuncionarioId)
  }, [funcionarios, reciboFuncionarioId])

  const beneficiosDoRecibo = useMemo(() => {
    if (reciboModo === 'individual') {
      return beneficios.filter(
        (b) => b.funcionario === reciboFuncionarioId && b.competencia === competenciaAtual,
      )
    }
    // Consolidado da empresa
    return beneficios.filter((b) => b.competencia === competenciaAtual)
  }, [beneficios, reciboModo, reciboFuncionarioId, competenciaAtual])

  const empresaAtivaObj = useMemo(() => {
    return empresas.find((e) => e.id === empresaSelecionadaId) || empresas[0]
  }, [empresas, empresaSelecionadaId])

  return (
    <div className="space-y-6">
      {/* Banner de Conformidade Legal e Não-incidência Tributária */}
      <Alert className="border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40">
        <ShieldCheck className="h-5 w-5 text-sky-600 dark:text-sky-400" />
        <AlertTitle className="font-semibold text-sky-900 dark:text-sky-200">
          Enquadramento Legal CLT: Benefícios VT / VA / VR
        </AlertTitle>
        <AlertDescription className="text-xs text-sky-800 dark:text-sky-300 space-y-1 mt-1">
          <p>
            • <b>Vale Transporte (Lei nº 7.418/85):</b> Desconto em folha limitado expressamente a{' '}
            <b>6% do salário-base</b> (art. 4º). O excedente é custeado integralmente pelo
            empregador.
          </p>
          <p>
            • <b>Não Incidência Tributária:</b> Em conformidade com o <b>art. 457, § 2º da CLT</b> e
            legislação do PAT (Lei 6.321/76), os valores de VT, VA e VR fornecidos in natura{' '}
            <b>não possuem natureza salarial</b> e não integram a base de cálculo de INSS, FGTS e
            IRRF.
          </p>
        </AlertDescription>
      </Alert>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">
              Total Concedido
            </span>
            <ShoppingBag className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">
              R$ {metricas.totalBeneficios.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metricas.totalLancamentos} benefício(s) emitido(s)
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">
              Desconto CLT Colaboradores
            </span>
            <UserCheck className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              R${' '}
              {metricas.totalDescontoColaboradores.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">VT teto 6% + Coparticipação PAT</p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">
              Custo Líquido Empresa
            </span>
            <Building2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              R${' '}
              {metricas.totalCustoEmpresa.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Isento de encargos patronais</p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">
              Distribuição por Tipo
            </span>
            <Bus className="h-4 w-4 text-sky-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <Badge variant="outline" className="bg-sky-50 dark:bg-sky-950/50 text-sky-700">
                VT: {metricas.qtdVt}
              </Badge>
              <Badge
                variant="outline"
                className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700"
              >
                VA: {metricas.qtdVa}
              </Badge>
              <Badge
                variant="outline"
                className="bg-orange-50 dark:bg-orange-950/50 text-orange-700"
              >
                VR: {metricas.qtdVr}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Comp. {competenciaAtual}</p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Ações */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Busca */}
              <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar colaborador ou operadora..."
                  value={buscaTermo}
                  onChange={(e) => setBuscaTermo(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>

              {/* Filtro Tipo */}
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="w-[170px] h-9 text-xs">
                  <SelectValue placeholder="Tipo de Benefício" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Benefícios</SelectItem>
                  <SelectItem value="vale_transporte">Vale Transporte (VT)</SelectItem>
                  <SelectItem value="vale_alimentacao">Vale Alimentação (VA)</SelectItem>
                  <SelectItem value="vale_refeicao">Vale Refeição (VR)</SelectItem>
                </SelectContent>
              </Select>

              {/* Filtro Colaborador */}
              <Select value={filtroFuncionario} onValueChange={setFiltroFuncionario}>
                <SelectTrigger className="w-[200px] h-9 text-xs">
                  <SelectValue placeholder="Colaborador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Colaboradores</SelectItem>
                  {funcionarios.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome_completo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Botões de Ação */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => abrirRecibo('consolidado')}
                className="gap-1.5 text-xs h-9"
              >
                <Printer className="h-4 w-4" />
                Recibo da Empresa
              </Button>

              {podeEditar && (
                <Button
                  size="sm"
                  onClick={() => {
                    setFormEmpresa(
                      empresaSelecionadaId !== 'todas'
                        ? empresaSelecionadaId
                        : empresas[0]?.id || '',
                    )
                    setFormCompetencia(competenciaAtual)
                    if (funcionarios.length > 0) setFormFuncionario(funcionarios[0].id)
                    setModalNovoAberto(true)
                  }}
                  className="gap-1.5 text-xs h-9 bg-primary"
                >
                  <Plus className="h-4 w-4" />
                  Conceder Benefício
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Benefícios */}
      <Card>
        <CardHeader className="p-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Benefícios Concedidos na Competência ({competenciaAtual})
              </CardTitle>
              <CardDescription className="text-xs">
                Valores calculados com base nas regras CLT e operadoras cadastradas
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {beneficiosFiltrados.length} registro(s)
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs font-semibold">Colaborador</TableHead>
                  <TableHead className="text-xs font-semibold">Benefício</TableHead>
                  <TableHead className="text-xs font-semibold">Cálculo Base</TableHead>
                  <TableHead className="text-xs font-semibold">Operadora / Cartão</TableHead>
                  <TableHead className="text-xs font-semibold text-right">
                    Total Concedido
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-right">
                    Desconto Folha (CLT)
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-right">Custo Empresa</TableHead>
                  <TableHead className="text-xs font-semibold text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-muted-foreground text-sm"
                    >
                      Carregando lançamentos de benefícios...
                    </TableCell>
                  </TableRow>
                ) : beneficiosFiltrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10">
                      <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                        <ShoppingBag className="h-8 w-8 text-muted-foreground/50" />
                        <p className="text-sm font-medium">
                          Nenhum benefício encontrado nesta competência.
                        </p>
                        <p className="text-xs">
                          Clique em &quot;Conceder Benefício&quot; para registrar VT, VA ou VR de um
                          colaborador.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  beneficiosFiltrados.map((b) => {
                    const funcNome = b.expand?.funcionario?.nome_completo || 'Colaborador'
                    const funcCargo = b.expand?.funcionario?.cargo || 'Geral'
                    const funcCpf = b.expand?.funcionario?.cpf || ''

                    return (
                      <TableRow key={b.id} className="hover:bg-muted/30">
                        <TableCell className="py-2.5">
                          <div className="font-medium text-xs text-foreground">{funcNome}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {funcCargo} {funcCpf && `• CPF: ${funcCpf}`}
                          </div>
                        </TableCell>

                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-1.5">
                            {b.tipo === 'vale_transporte' && (
                              <Badge
                                variant="outline"
                                className="bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 text-[11px] gap-1"
                              >
                                <Bus className="h-3 w-3" /> Vale Transporte
                              </Badge>
                            )}
                            {b.tipo === 'vale_alimentacao' && (
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 text-[11px] gap-1"
                              >
                                <ShoppingBag className="h-3 w-3" /> Vale Alimentação
                              </Badge>
                            )}
                            {b.tipo === 'vale_refeicao' && (
                              <Badge
                                variant="outline"
                                className="bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200 text-[11px] gap-1"
                              >
                                <Utensils className="h-3 w-3" /> Vale Refeição
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="py-2.5 text-xs text-muted-foreground">
                          {b.dias_uteis || 22} dias × {b.quantidade_dia || 1}/dia a R${' '}
                          {(b.valor_unitario || 0).toFixed(2)}
                        </TableCell>

                        <TableCell className="py-2.5 text-xs">
                          <div className="font-medium text-foreground">{b.operadora || 'N/I'}</div>
                          {b.numero_cartao && (
                            <div className="text-[11px] text-muted-foreground">
                              Cartão: {b.numero_cartao}
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="py-2.5 text-xs font-semibold text-right text-foreground">
                          R$ {b.valor_total_beneficio.toFixed(2)}
                        </TableCell>

                        <TableCell className="py-2.5 text-xs font-medium text-right text-amber-700 dark:text-amber-400">
                          R$ {(b.desconto_colaborador || 0).toFixed(2)}
                          {b.tipo === 'vale_transporte' && (
                            <div className="text-[10px] text-muted-foreground">Teto 6% CLT</div>
                          )}
                        </TableCell>

                        <TableCell className="py-2.5 text-xs font-medium text-right text-emerald-700 dark:text-emerald-400">
                          R$ {(b.custo_empresa || 0).toFixed(2)}
                        </TableCell>

                        <TableCell className="py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Gerar Recibo de Entrega Individual"
                              onClick={() => abrirRecibo('individual', b.funcionario)}
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>

                            {podeEditar && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-red-600"
                                title="Excluir benefício"
                                onClick={() => handleExcluirBeneficio(b.id, b.tipo)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
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

      {/* MODAL: NOVO BENEFÍCIO (COM CÁLCULO LEGAL CLT EM TEMPO REAL) */}
      <Dialog open={modalNovoAberto} onOpenChange={setModalNovoAberto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Conceder Benefício CLT (VT / VA / VR)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cadastre a concessão com cálculo legal automático de coparticipação e desconto em
              folha.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Empresa e Competência */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Empresa</Label>
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
                <Label className="text-xs font-semibold">Competência (MM/AAAA)</Label>
                <Input
                  value={formCompetencia}
                  onChange={(e) => setFormCompetencia(e.target.value)}
                  placeholder="09/2026"
                  className="h-9 text-xs mt-1"
                />
              </div>
            </div>

            {/* Colaborador */}
            <div>
              <Label className="text-xs font-semibold">Colaborador</Label>
              <Select value={formFuncionario} onValueChange={setFormFuncionario}>
                <SelectTrigger className="h-9 text-xs mt-1">
                  <SelectValue placeholder="Selecione o colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {funcionarios
                    .filter((f) => !formEmpresa || f.empresa === formEmpresa)
                    .map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome_completo} ({f.cargo} - Salário: R${' '}
                        {(f.salario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de Benefício */}
            <div>
              <Label className="text-xs font-semibold">Tipo de Benefício</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <Button
                  type="button"
                  variant={formTipo === 'vale_transporte' ? 'default' : 'outline'}
                  className="h-10 text-xs justify-center gap-1.5"
                  onClick={() => {
                    setFormTipo('vale_transporte')
                    setFormOperadora('SPTrans / Bilhete Único')
                    setFormQtdDia(2)
                    setFormValorUnitario(5.0)
                  }}
                >
                  <Bus className="h-4 w-4" /> Vale Transporte (VT)
                </Button>
                <Button
                  type="button"
                  variant={formTipo === 'vale_alimentacao' ? 'default' : 'outline'}
                  className="h-10 text-xs justify-center gap-1.5"
                  onClick={() => {
                    setFormTipo('vale_alimentacao')
                    setFormOperadora('Sodexo / Pluxee')
                    setFormQtdDia(1)
                    setFormValorUnitario(38.0)
                  }}
                >
                  <ShoppingBag className="h-4 w-4" /> Alimentação (VA)
                </Button>
                <Button
                  type="button"
                  variant={formTipo === 'vale_refeicao' ? 'default' : 'outline'}
                  className="h-10 text-xs justify-center gap-1.5"
                  onClick={() => {
                    setFormTipo('vale_refeicao')
                    setFormOperadora('Ticket Restaurante')
                    setFormQtdDia(1)
                    setFormValorUnitario(42.0)
                  }}
                >
                  <Utensils className="h-4 w-4" /> Refeição (VR)
                </Button>
              </div>
            </div>

            {/* Parâmetros Quantitativos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg border">
              <div>
                <Label className="text-xs">Dias Úteis</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={formDiasUteis}
                  onChange={(e) => setFormDiasUteis(parseInt(e.target.value) || 0)}
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">
                  {formTipo === 'vale_transporte' ? 'Passagens / Dia' : 'Qtd. / Dia'}
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={formQtdDia}
                  onChange={(e) => setFormQtdDia(parseInt(e.target.value) || 0)}
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">Valor Unitário (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formValorUnitario}
                  onChange={(e) => setFormValorUnitario(parseFloat(e.target.value) || 0)}
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>

            {/* Operadora e Cartão */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Operadora / Beneficiária</Label>
                <Input
                  value={formOperadora}
                  onChange={(e) => setFormOperadora(e.target.value)}
                  placeholder="Ex: Alelo, Sodexo, Ticket, VR, SPTrans"
                  className="h-9 text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Nº do Cartão / Matrícula (Opcional)</Label>
                <Input
                  value={formNumeroCartao}
                  onChange={(e) => setFormNumeroCartao(e.target.value)}
                  placeholder="Ex: 6032-****-1234"
                  className="h-9 text-xs mt-1"
                />
              </div>
            </div>

            {/* Simulação Legal e Desconto CLT */}
            <div className="p-3 bg-card border rounded-lg space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Resumo da Concessão e Desconto CLT:</span>
                <span className="text-primary">
                  Total: R${' '}
                  {calculoCltPreview.valorTotalBeneficio.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t">
                <div>
                  <span className="text-muted-foreground block">Desconto Colaborador:</span>
                  <span className="font-semibold text-amber-700 dark:text-amber-400">
                    R${' '}
                    {calculoCltPreview.descontoColaborador.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  {formTipo === 'vale_transporte' && (
                    <span className="text-[10px] text-muted-foreground block">
                      Teto legal 6% (R${' '}
                      {calculoCltPreview.tetoLegalVt.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                      )
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-muted-foreground block">Custo Líquido Empresa:</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    R${' '}
                    {calculoCltPreview.custoEmpresa.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground block">Natureza Salarial:</span>
                  <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700">
                    Isento INSS/FGTS/IRRF
                  </Badge>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground italic pt-1">
                {calculoCltPreview.avisoLegalClt}
              </p>
            </div>

            {/* Observações */}
            <div>
              <Label className="text-xs font-semibold">Observações / Instruções</Label>
              <Input
                value={formObservacoes}
                onChange={(e) => setFormObservacoes(e.target.value)}
                placeholder="Ex: Carga liberada no 1º dia útil do mês."
                className="h-8 text-xs mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalNovoAberto(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSalvarBeneficio}
              disabled={salvando || !formFuncionario}
              className="bg-primary gap-1"
            >
              {salvando ? 'Salvando...' : 'Confirmar e Conceder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: RECIBO DE ENTREGA DE BENEFÍCIOS (IMPRIMÍVEL / PADRÃO VISUAL DO ESCRITÓRIO) */}
      <Dialog open={modalReciboAberto} onOpenChange={setModalReciboAberto}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader className="print:hidden">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <Printer className="h-5 w-5 text-primary" />
                  Recibo de Entrega de Benefícios (CLT)
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Documento comprobatório de entrega de VT / VA / VR com notas legais de
                  não-incidência tributária.
                </DialogDescription>
              </div>

              <div className="flex items-center gap-2">
                {reciboModo === 'individual' && (
                  <Select value={reciboFuncionarioId} onValueChange={setReciboFuncionarioId}>
                    <SelectTrigger className="w-[200px] h-8 text-xs">
                      <SelectValue placeholder="Selecione Colaborador" />
                    </SelectTrigger>
                    <SelectContent>
                      {funcionarios.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome_completo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button size="sm" onClick={dispararImpressao} className="h-8 gap-1.5 text-xs">
                  <Printer className="h-3.5 w-3.5" /> Imprimir / Salvar PDF
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* ÁREA IMPRIMÍVEL DO RECIBO */}
          <div
            id="area-recibo-beneficios"
            className="p-6 bg-white text-slate-900 border rounded-lg space-y-6 text-sm font-sans"
          >
            {/* Cabeçalho do Recibo com Identidade Visual */}
            <div className="border-b pb-4 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded bg-primary text-primary-foreground font-bold flex items-center justify-center text-base">
                    R
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 leading-none">
                      RUMO CONSULTORIA CONTÁBIL
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Departamento Pessoal & Relações Trabalhistas
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-right text-xs">
                <span className="font-bold text-slate-800">RECIBO DE ENTREGA DE BENEFÍCIOS</span>
                <p className="text-slate-500">Competência: {competenciaAtual}</p>
                <p className="text-[10px] text-slate-400">
                  Emitido em: {new Date().toLocaleDateString('pt-BR')} às{' '}
                  {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            {/* Dados da Empresa Empregadora */}
            <div className="bg-slate-50 p-3 rounded border text-xs grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 block">Razão Social do Empregador:</span>
                <span className="font-bold text-slate-800">
                  {empresaAtivaObj?.razao_social || 'Empresa Contratante'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">CNPJ:</span>
                <span className="font-mono text-slate-800">
                  {empresaAtivaObj?.cnpj || '00.000.000/0001-00'}
                </span>
              </div>
            </div>

            {/* MODO INDIVIDUAL: Dados do Empregado */}
            {reciboModo === 'individual' && reciboFuncionario && (
              <div className="bg-slate-50 p-3 rounded border text-xs grid grid-cols-3 gap-2">
                <div>
                  <span className="text-slate-500 block">Empregado(a):</span>
                  <span className="font-bold text-slate-800">
                    {reciboFuncionario.nome_completo}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">CPF / CTPS:</span>
                  <span className="font-mono text-slate-800">
                    {reciboFuncionario.cpf || 'Não informado'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Cargo / Função:</span>
                  <span className="text-slate-800">{reciboFuncionario.cargo || 'Geral'}</span>
                </div>
              </div>
            )}

            {/* Tabela de Benefícios Entregues */}
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                {reciboModo === 'individual'
                  ? 'Demonstrativo dos Benefícios Concedidos'
                  : 'Relação Consolidada de Benefícios por Colaborador'}
              </h3>

              <table className="w-full text-xs border border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700">
                    {reciboModo === 'consolidado' && (
                      <th className="border p-2 text-left">Colaborador</th>
                    )}
                    <th className="border p-2 text-left">Benefício</th>
                    <th className="border p-2 text-left">Operadora / Cartão</th>
                    <th className="border p-2 text-center">Dias / Qtd</th>
                    <th className="border p-2 text-right">Valor Total Concedido</th>
                    <th className="border p-2 text-right">Desconto Folha (CLT)</th>
                    <th className="border p-2 text-right">Custo Líquido Empresa</th>
                  </tr>
                </thead>
                <tbody>
                  {beneficiosDoRecibo.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="border p-4 text-center text-slate-500">
                        Nenhum benefício registrado nesta seleção para a competência{' '}
                        {competenciaAtual}.
                      </td>
                    </tr>
                  ) : (
                    beneficiosDoRecibo.map((b) => (
                      <tr key={b.id} className="border-b">
                        {reciboModo === 'consolidado' && (
                          <td className="border p-2 font-medium">
                            {b.expand?.funcionario?.nome_completo || 'Colaborador'}
                          </td>
                        )}
                        <td className="border p-2 font-semibold">
                          {b.tipo === 'vale_transporte'
                            ? 'Vale Transporte (VT)'
                            : b.tipo === 'vale_alimentacao'
                              ? 'Vale Alimentação (VA)'
                              : 'Vale Refeição (VR)'}
                        </td>
                        <td className="border p-2">
                          {b.operadora}
                          {b.numero_cartao && ` (${b.numero_cartao})`}
                        </td>
                        <td className="border p-2 text-center">
                          {b.dias_uteis} dias ({b.quantidade_dia}/dia)
                        </td>
                        <td className="border p-2 text-right font-medium">
                          R$ {b.valor_total_beneficio.toFixed(2)}
                        </td>
                        <td className="border p-2 text-right text-slate-700">
                          R$ {(b.desconto_colaborador || 0).toFixed(2)}
                        </td>
                        <td className="border p-2 text-right font-semibold">
                          R$ {(b.custo_empresa || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold">
                    <td
                      colSpan={reciboModo === 'consolidado' ? 4 : 3}
                      className="border p-2 text-right"
                    >
                      TOTAIS GERAIS:
                    </td>
                    <td className="border p-2 text-right">
                      R${' '}
                      {beneficiosDoRecibo
                        .reduce((acc, x) => acc + x.valor_total_beneficio, 0)
                        .toFixed(2)}
                    </td>
                    <td className="border p-2 text-right">
                      R${' '}
                      {beneficiosDoRecibo
                        .reduce((acc, x) => acc + (x.desconto_colaborador || 0), 0)
                        .toFixed(2)}
                    </td>
                    <td className="border p-2 text-right">
                      R${' '}
                      {beneficiosDoRecibo
                        .reduce((acc, x) => acc + (x.custo_empresa || 0), 0)
                        .toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Nota Legal e Declaração de Recebimento */}
            <div className="p-3 bg-slate-50 border rounded text-[11px] text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800">
                FUNDAMENTAÇÃO JURÍDICA E DECLARAÇÃO DE NÃO-INCIDÊNCIA TRIBUTÁRIA:
              </p>
              <p>
                1. <b>Vale Transporte:</b> Concedido nos estritos termos da Lei Federal nº 7.418/85
                e Decreto nº 95.247/87, com participação do empregado limitada ao patamar legal de
                6% do seu salário básico, constituindo antecipação de despesas estritamente para
                deslocamento residência-trabalho e vice-versa.
              </p>
              <p>
                2. <b>Vale Alimentação e Refeição:</b> Fornecidos segundo o Programa de Alimentação
                do Trabalhador (PAT - Lei nº 6.321/76) e consoante expressa disposição do art. 457,
                § 2º da CLT (redação dada pela Lei nº 13.467/2017), não ostentando natureza
                salarial, não se incorporando à remuneração para nenhum efeito e <b>não</b>{' '}
                constituindo base de incidência de INSS, FGTS ou retenção de IRRF.
              </p>
              {reciboModo === 'individual' && (
                <p className="pt-2 font-medium text-slate-800">
                  Declaro que recebi os créditos/benefícios supramencionados em perfeita ordem para
                  a competência indicada e comprometo-me a utilizá-los exclusivamente para as
                  finalidades legais previstas.
                </p>
              )}
            </div>

            {/* Campos de Assinatura */}
            <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs">
              <div>
                <div className="border-t border-slate-400 pt-2 font-semibold text-slate-800">
                  {reciboModo === 'individual' && reciboFuncionario
                    ? reciboFuncionario.nome_completo
                    : 'Empregado(a) Beneficiário(a)'}
                </div>
                <div className="text-[11px] text-slate-500">Assinatura do Colaborador</div>
              </div>

              <div>
                <div className="border-t border-slate-400 pt-2 font-semibold text-slate-800">
                  {empresaAtivaObj?.razao_social || 'Responsável pelo Empregador'}
                </div>
                <div className="text-[11px] text-slate-500">
                  Departamento Pessoal / Recursos Humanos
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="print:hidden">
            <Button variant="outline" size="sm" onClick={() => setModalReciboAberto(false)}>
              Fechar
            </Button>
            <Button size="sm" onClick={dispararImpressao} className="bg-primary gap-1">
              <Printer className="h-4 w-4" /> Imprimir Documento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

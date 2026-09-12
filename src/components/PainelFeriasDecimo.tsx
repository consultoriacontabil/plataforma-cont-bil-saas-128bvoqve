import React, { useState, useEffect, useMemo } from 'react'
import {
  Calendar,
  DollarSign,
  TrendingUp,
  FileText,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  ChevronRight,
  ShieldCheck,
  Building2,
  User,
  Info,
  Layers,
  ArrowRight,
  Sparkles,
  HelpCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import {
  calculosTrabalhistasService,
  type CreateFeriasInput,
  type CreateDecimoInput,
} from '@/services/calculosTrabalhistas'
import {
  calcularFeriasClt,
  calcularDecimoTerceiroClt,
  apurarMediasVerbasVariaveis,
} from '@/lib/calculoClt'
import type {
  Empresa,
  Funcionario,
  FeriasPeriodoRecord,
  DecimoTerceiroRecord,
  VerbaLancamentoRecord,
  ItemMapaMedia,
} from '@/types'

interface PainelFeriasDecimoProps {
  tenantId: string
  usuarioId: string
  perfilUsuario?: string
  empresas: Empresa[]
  selectedEmpresaId: string
  onEmpresaChange: (id: string) => void
  onAbrirFichaColaborador?: (funcionarioId: string) => void
}
export function PainelFeriasDecimo({
  tenantId,
  usuarioId,
  perfilUsuario,
  empresas,
  selectedEmpresaId,
  onEmpresaChange,
  onAbrirFichaColaborador,
}: PainelFeriasDecimoProps) {
  const { toast } = useToast()

  const [activeSubTab, setActiveSubTab] = useState<'ferias' | 'decimo'>('ferias')
  const [loading, setLoading] = useState(false)
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [feriasList, setFeriasList] = useState<FeriasPeriodoRecord[]>([])
  const [decimoList, setDecimoList] = useState<DecimoTerceiroRecord[]>([])

  // Modais
  const [isFeriasModalOpen, setIsFeriasModalOpen] = useState(false)
  const [isDecimoModalOpen, setIsDecimoModalOpen] = useState(false)
  const [detalheItem, setDetalheItem] = useState<FeriasPeriodoRecord | DecimoTerceiroRecord | null>(
    null,
  )
  const [isDetalheModalOpen, setIsDetalheModalOpen] = useState(false)

  // Form Férias
  const [feriasForm, setFeriasForm] = useState<{
    funcionarioId: string
    competencia: string
    dtInicioAquisitivo: string
    dtFimAquisitivo: string
    dtInicioGozo: string
    dtFimGozo: string
    diasGozo: number
    venderAbono: boolean
    diasAbono: number
    adiantar13: boolean
    observacoes: string
  }>({
    funcionarioId: '',
    competencia: '10/2026',
    dtInicioAquisitivo: '2025-08-01',
    dtFimAquisitivo: '2026-07-31',
    dtInicioGozo: '2026-10-05',
    dtFimGozo: '2026-10-24',
    diasGozo: 20,
    venderAbono: true,
    diasAbono: 10,
    adiantar13: false,
    observacoes: '',
  })

  // Form 13º
  const [decimoForm, setDecimoForm] = useState<{
    funcionarioId: string
    ano: number
    competencia: string
    parcela: 'primeira_parcela' | 'segunda_parcela' | 'parcela_unica'
    mesesTrabalhados: number
    salarioMaternidadeMeses: number
    observacoes: string
  }>({
    funcionarioId: '',
    ano: 2026,
    competencia: '11/2026',
    parcela: 'primeira_parcela',
    mesesTrabalhados: 12,
    salarioMaternidadeMeses: 0,
    observacoes: '',
  })

  // Simulações em tempo real nos formulários
  const [previewMedias, setPreviewMedias] = useState<{ media: number; itens: ItemMapaMedia[] }>({
    media: 0,
    itens: [],
  })

  // Carregar dados
  const carregarDados = async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const [resF, resD] = await Promise.all([
        calculosTrabalhistasService.listFerias(tenantId, {
          empresaId: selectedEmpresaId,
        }),
        calculosTrabalhistasService.listDecimo(tenantId, {
          empresaId: selectedEmpresaId,
        }),
      ])
      setFeriasList(resF)
      setDecimoList(resD)
    } catch (e) {
      console.error(e)
      toast({
        title: 'Erro ao carregar cálculos',
        description: 'Não foi possível buscar férias e 13º salário.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Carregar funcionários CLT da empresa selecionada
  useEffect(() => {
    const fetchFuncs = async () => {
      try {
        const { dpService } = await import('@/services/dp')
        const list = await dpService.listFuncionarios(tenantId, {
          empresaId: selectedEmpresaId,
        })
        // Filtrar apenas CLT
        setFuncionarios(
          list.filter(
            (f) =>
              (f.tipo === 'clt' || (f as any).tipo_contrato === 'CLT') && f.status !== 'demitido',
          ),
        )
      } catch (err) {
        console.error(err)
      }
    }
    fetchFuncs()
    carregarDados()
  }, [tenantId, selectedEmpresaId])

  // Ao selecionar funcionário no form de férias, buscar suas médias e pré-preencher
  useEffect(() => {
    if (!feriasForm.funcionarioId) return
    const f = funcionarios.find((x) => x.id === feriasForm.funcionarioId)
    if (!f) return

    calculosTrabalhistasService
      .apurarMediasFuncionario(tenantId, f.empresa, f.id)
      .then((m) => {
        setPreviewMedias(m)
      })
      .catch(() => setPreviewMedias({ media: 0, itens: [] }))
  }, [feriasForm.funcionarioId])

  // Ao selecionar funcionário no form de 13º, apurar avos e médias
  useEffect(() => {
    if (!decimoForm.funcionarioId) return
    const f = funcionarios.find((x) => x.id === decimoForm.funcionarioId)
    if (!f) return

    calculosTrabalhistasService
      .apurarAvosDecimoFuncionario(f.data_admissao, decimoForm.ano)
      .then((avos) => {
        setDecimoForm((prev) => ({ ...prev, mesesTrabalhados: avos }))
      })

    calculosTrabalhistasService
      .apurarMediasFuncionario(tenantId, f.empresa, f.id)
      .then((m) => {
        setPreviewMedias(m)
      })
      .catch(() => setPreviewMedias({ media: 0, itens: [] }))
  }, [decimoForm.funcionarioId, decimoForm.ano])

  // Cálculo em tempo real para o modal de Férias
  const selectedFuncFerias = useMemo(() => {
    return funcionarios.find((x) => x.id === feriasForm.funcionarioId)
  }, [funcionarios, feriasForm.funcionarioId])

  const previewCalcFerias = useMemo(() => {
    if (!selectedFuncFerias) return null
    return calcularFeriasClt({
      salarioBase: selectedFuncFerias.salario || 0,
      diasGozo: feriasForm.diasGozo,
      venderAbono: feriasForm.venderAbono,
      diasAbono: feriasForm.diasAbono,
      dependentes: selectedFuncFerias.dependentes_irrf || 0,
      mediaVariaveis: previewMedias.media,
      adiantar13: feriasForm.adiantar13,
    })
  }, [selectedFuncFerias, feriasForm, previewMedias.media])

  // Cálculo em tempo real para o modal de 13º
  const selectedFuncDecimo = useMemo(() => {
    return funcionarios.find((x) => x.id === decimoForm.funcionarioId)
  }, [funcionarios, decimoForm.funcionarioId])

  const previewCalcDecimo = useMemo(() => {
    if (!selectedFuncDecimo) return null
    return calcularDecimoTerceiroClt({
      salarioBase: selectedFuncDecimo.salario || 0,
      mesesTrabalhados: decimoForm.mesesTrabalhados,
      parcela: decimoForm.parcela,
      mediaVariaveis: previewMedias.media,
      adiantamentoJaPago: 0,
      dependentes: selectedFuncDecimo.dependentes_irrf || 0,
      salarioMaternidadeMeses: decimoForm.salarioMaternidadeMeses,
    })
  }, [selectedFuncDecimo, decimoForm, previewMedias.media])

  // Submeter novo cálculo de Férias
  const handleSalvarFerias = async () => {
    if (!selectedFuncFerias) {
      toast({ title: 'Selecione um colaborador', variant: 'destructive' })
      return
    }
    if (feriasForm.diasGozo + (feriasForm.venderAbono ? feriasForm.diasAbono : 0) > 30) {
      toast({
        title: 'Total de dias inválido',
        description: 'A soma de dias de gozo e abono não pode ultrapassar 30 dias.',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)
      await calculosTrabalhistasService.criarCalculoFerias(
        {
          tenant_id: tenantId,
          empresa: selectedFuncFerias.empresa,
          funcionario: selectedFuncFerias.id,
          competencia: feriasForm.competencia,
          periodo_aquisitivo_inicio: feriasForm.dtInicioAquisitivo,
          periodo_aquisitivo_fim: feriasForm.dtFimAquisitivo,
          data_inicio_gozo: feriasForm.dtInicioGozo,
          data_fim_gozo: feriasForm.dtFimGozo,
          dias_gozo: feriasForm.diasGozo,
          vender_abono: feriasForm.venderAbono,
          dias_abono: feriasForm.diasAbono,
          adiantar_13: feriasForm.adiantar13,
          observacoes: feriasForm.observacoes,
        },
        usuarioId,
      )

      toast({
        title: 'Férias calculadas com sucesso!',
        description: `Recibo gerado para ${selectedFuncFerias.nome_completo}.`,
      })
      setIsFeriasModalOpen(false)
      carregarDados()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao calcular férias',
        description: 'Verifique se os dados estão corretos.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Submeter novo cálculo de 13º
  const handleSalvarDecimo = async () => {
    if (!selectedFuncDecimo) {
      toast({ title: 'Selecione um colaborador', variant: 'destructive' })
      return
    }

    try {
      setLoading(true)
      await calculosTrabalhistasService.criarCalculoDecimo(
        {
          tenant_id: tenantId,
          empresa: selectedFuncDecimo.empresa,
          funcionario: selectedFuncDecimo.id,
          ano: decimoForm.ano,
          competencia: decimoForm.competencia,
          parcela: decimoForm.parcela,
          meses_trabalhados: decimoForm.mesesTrabalhados,
          salario_maternidade_meses: decimoForm.salarioMaternidadeMeses,
          observacoes: decimoForm.observacoes,
        },
        usuarioId,
      )

      toast({
        title: '13º Salário calculado!',
        description: `Parcela gerada para ${selectedFuncDecimo.nome_completo}. Guia INSS (2172) preparada.`,
      })
      setIsDecimoModalOpen(false)
      carregarDados()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao calcular 13º',
        description: 'Não foi possível gravar o cálculo.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Quitar Férias
  const handleQuitarFerias = async (item: FeriasPeriodoRecord) => {
    try {
      setLoading(true)
      await calculosTrabalhistasService.marcarFeriasPaga(item.id, usuarioId)
      toast({
        title: 'Férias quitadas!',
        description: `Status do colaborador atualizado e integrado à Folha de Pagamento.`,
      })
      carregarDados()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao quitar férias', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  // Quitar 13º
  const handleQuitarDecimo = async (item: DecimoTerceiroRecord) => {
    try {
      setLoading(true)
      await calculosTrabalhistasService.marcarDecimoPago(item.id, usuarioId)
      toast({
        title: '13º Salário liquidado!',
        description: `Valores lançados na folha e guia DCTFWeb vinculada.`,
      })
      carregarDados()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao quitar 13º', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header com Modo de Supervisão e seletor */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-muted/40 p-4 rounded-lg border border-border">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Férias e 13º Salário (CLT)
            </h2>
            <Badge
              variant="outline"
              className="border-amber-400 bg-amber-50 text-amber-800 text-xs"
            >
              Modo Supervisão CLT
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Apurador automático de médias das verbas variáveis com reflexo legal, adicionais
            constitucionais e guias DCTFWeb (cód. 2172).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeSubTab === 'ferias' ? (
            <Button
              onClick={() => {
                if (funcionarios.length > 0) {
                  setFeriasForm((prev) => ({ ...prev, funcionarioId: funcionarios[0].id }))
                }
                setIsFeriasModalOpen(true)
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="w-4 h-4 mr-2" />
              Calcular Férias
            </Button>
          ) : (
            <Button
              onClick={() => {
                if (funcionarios.length > 0) {
                  setDecimoForm((prev) => ({ ...prev, funcionarioId: funcionarios[0].id }))
                }
                setIsDecimoModalOpen(true)
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="w-4 h-4 mr-2" />
              Calcular 13º Salário
            </Button>
          )}
        </div>
      </div>

      {/* Sub-Abas: Férias x 13º */}
      <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as 'ferias' | 'decimo')}>
        <TabsList className="grid w-full sm:w-[400px] grid-cols-2">
          <TabsTrigger value="ferias" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Férias CLT ({feriasList.length})
          </TabsTrigger>
          <TabsTrigger value="decimo" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            13º Salário ({decimoList.length})
          </TabsTrigger>
        </TabsList>

        {/* 1. ABA FÉRIAS */}
        <TabsContent value="ferias" className="space-y-4 pt-2">
          {feriasList.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="w-12 h-12 text-muted-foreground/50 mb-3" />
                <h3 className="text-base font-medium">Nenhum cálculo de férias registrado</h3>
                <p className="text-sm text-muted-foreground max-w-sm mt-1">
                  Selecione um colaborador CLT para apurar período aquisitivo, médias variáveis e
                  gerar o recibo com 1/3 legal.
                </p>
                <Button
                  onClick={() => setIsFeriasModalOpen(true)}
                  variant="outline"
                  className="mt-4"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Iniciar Primeiro Cálculo
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {feriasList.map((item) => {
                const func = item.expand?.funcionario
                const emp = item.expand?.empresa
                const prazoPagamento = item.data_limite_pagamento
                  ? new Date(item.data_limite_pagamento).toLocaleDateString('pt-BR')
                  : 'N/A'

                return (
                  <Card key={item.id} className="hover:border-primary/50 transition-colors">
                    <CardContent className="p-5">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {func?.id && onAbrirFichaColaborador ? (
                              <button
                                type="button"
                                onClick={() => onAbrirFichaColaborador(func.id)}
                                className="font-semibold text-base text-foreground hover:text-[#0FA3A3] hover:underline cursor-pointer text-left"
                              >
                                {func.nome_completo}
                              </button>
                            ) : (
                              <span className="font-semibold text-base text-foreground">
                                {func?.nome_completo || 'Colaborador'}
                              </span>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {func?.cargo || 'CLT'}
                            </Badge>
                            <Badge
                              className={
                                item.status === 'pago'
                                  ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-500/10 text-amber-700 border-amber-200'
                              }
                            >
                              {item.status === 'pago'
                                ? 'Pago & Integrado'
                                : 'Calculado (Aguardando Pgto)'}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>Empresa: {emp?.razao_social || 'N/A'}</span>
                            <span>Competência: {item.competencia}</span>
                            <span>
                              Gozo: {item.dias_gozo} dias (
                              {new Date(item.data_inicio_gozo).toLocaleDateString('pt-BR')} a{' '}
                              {new Date(item.data_fim_gozo).toLocaleDateString('pt-BR')})
                            </span>
                            {item.vender_abono && (
                              <span className="text-primary font-medium">
                                Abono pecuniário: {item.dias_abono} dias vendidos
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Valores e Ações */}
                        <div className="flex flex-wrap items-center gap-4 lg:gap-6">
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Salário + Médias</div>
                            <div className="text-sm font-medium">
                              R${' '}
                              {item.remuneracao_base_ferias.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                              })}
                            </div>
                            {item.media_variaveis ? (
                              <div className="text-[11px] text-blue-600 font-mono">
                                (+ R$ {item.media_variaveis.toFixed(2)} médias)
                              </div>
                            ) : null}
                          </div>

                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Valor Bruto (+1/3)</div>
                            <div className="text-sm font-semibold text-foreground">
                              R${' '}
                              {item.total_bruto.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                              })}
                            </div>
                            <div className="text-[11px] text-rose-500">
                              - R${' '}
                              {item.total_descontos?.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                              })}{' '}
                              (INSS/IRRF)
                            </div>
                          </div>

                          <div className="text-right pl-3 border-l border-border">
                            <div className="text-xs text-muted-foreground font-medium">
                              Líquido a Pagar
                            </div>
                            <div className="text-lg font-bold text-emerald-600">
                              R${' '}
                              {item.total_liquido.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                              })}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Prazo CLT: até {prazoPagamento}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setDetalheItem(item)
                                setIsDetalheModalOpen(true)
                              }}
                            >
                              <FileText className="w-4 h-4 mr-1" />
                              Ver Recibo
                            </Button>

                            {item.status !== 'pago' && (
                              <Button
                                size="sm"
                                onClick={() => handleQuitarFerias(item)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Quitar & Integrar
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Mapa de médias explicativo em linha */}
                      {item.mapa_medias_json && item.mapa_medias_json.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-dashed border-border/80 flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-1 text-blue-700">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>
                              Médias variáveis apuradas:{' '}
                              {item.mapa_medias_json
                                .slice(0, 3)
                                .map(
                                  (m) => `${m.verba} (${m.competencia}: R$ ${m.valor.toFixed(2)})`,
                                )
                                .join(' • ')}
                            </span>
                          </div>
                          <span className="font-mono text-[11px]">CLT Art. 142 §5º</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* 2. ABA 13º SALÁRIO */}
        <TabsContent value="decimo" className="space-y-4 pt-2">
          {decimoList.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <TrendingUp className="w-12 h-12 text-muted-foreground/50 mb-3" />
                <h3 className="text-base font-medium">Nenhum cálculo de 13º registrado</h3>
                <p className="text-sm text-muted-foreground max-w-sm mt-1">
                  Apure a 1ª parcela (adiantamento sem descontos) ou 2ª parcela (com tributação
                  exclusiva de INSS/IRRF e guia 2172).
                </p>
                <Button
                  onClick={() => setIsDecimoModalOpen(true)}
                  variant="outline"
                  className="mt-4"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Calcular Parcela de 13º
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {decimoList.map((item) => {
                const func = item.expand?.funcionario
                const emp = item.expand?.empresa
                const parcelaLabel =
                  item.parcela === 'primeira_parcela'
                    ? '1ª Parcela (Adiantamento 50%)'
                    : item.parcela === 'segunda_parcela'
                      ? '2ª Parcela (Quitação Anual)'
                      : 'Parcela Única'

                return (
                  <Card key={item.id} className="hover:border-primary/50 transition-colors">
                    <CardContent className="p-5">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {func?.id && onAbrirFichaColaborador ? (
                              <button
                                type="button"
                                onClick={() => onAbrirFichaColaborador(func.id)}
                                className="font-semibold text-base text-foreground hover:text-[#0FA3A3] hover:underline cursor-pointer text-left"
                              >
                                {func.nome_completo}
                              </button>
                            ) : (
                              <span className="font-semibold text-base text-foreground">
                                {func?.nome_completo || 'Colaborador'}
                              </span>
                            )}
                            <Badge
                              variant="outline"
                              className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                            >
                              {parcelaLabel}
                            </Badge>
                            <Badge
                              className={
                                item.status === 'pago'
                                  ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-500/10 text-amber-700 border-amber-200'
                              }
                            >
                              {item.status === 'pago' ? 'Pago & Integrado' : 'Calculado'}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>Empresa: {emp?.razao_social || 'N/A'}</span>
                            <span>Ano Ref: {item.ano}</span>
                            <span>Competência: {item.competencia}</span>
                            <span>Avos: {item.meses_trabalhados}/12 avos</span>
                            {item.codigo_receita_inss && (
                              <span className="font-mono text-purple-700 font-medium">
                                DCTFWeb Guia INSS: {item.codigo_receita_inss} (Venc: 20/12)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Valores e Ações */}
                        <div className="flex flex-wrap items-center gap-4 lg:gap-6">
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Base Anual + Médias</div>
                            <div className="text-sm font-medium">
                              R${' '}
                              {item.remuneracao_base_calculo.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                              })}
                            </div>
                            {item.media_variaveis ? (
                              <div className="text-[11px] text-blue-600 font-mono">
                                (+ R$ {item.media_variaveis.toFixed(2)} médias)
                              </div>
                            ) : null}
                          </div>

                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Valor Bruto Parcela</div>
                            <div className="text-sm font-semibold text-foreground">
                              R${' '}
                              {item.valor_bruto.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                              })}
                            </div>
                            <div className="text-[11px] text-rose-500">
                              - R${' '}
                              {item.total_descontos?.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                              })}{' '}
                              {item.parcela === 'primeira_parcela'
                                ? '(sem ret.)'
                                : '(INSS/IRRF/Adiant.)'}
                            </div>
                          </div>

                          <div className="text-right pl-3 border-l border-border">
                            <div className="text-xs text-muted-foreground font-medium">
                              Líquido a Pagar
                            </div>
                            <div className="text-lg font-bold text-emerald-600">
                              R${' '}
                              {item.total_liquido.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                              })}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              FGTS 8%: R$ {item.fgts?.toFixed(2) || '0.00'}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setDetalheItem(item)
                                setIsDetalheModalOpen(true)
                              }}
                            >
                              <FileText className="w-4 h-4 mr-1" />
                              Ver Demonstrativo
                            </Button>

                            {item.status !== 'pago' && (
                              <Button
                                size="sm"
                                onClick={() => handleQuitarDecimo(item)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Quitar & Integrar
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Alerta de Guia 2172 na 2ª Parcela */}
                      {item.parcela === 'segunda_parcela' && (
                        <div className="mt-3 pt-3 border-t border-dashed border-border/80 flex items-center justify-between text-xs text-muted-foreground">
                          <span className="text-purple-700 font-medium">
                            Tributação exclusiva na fonte: INSS retido R$ {item.inss?.toFixed(2)} e
                            IRRF R$ {item.irrf?.toFixed(2)} (cód. receita 0561).
                          </span>
                          <span className="font-mono text-[11px]">
                            Vencimento Guia: 20/12/{item.ano}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* MODAL 1: CÁLCULO DE FÉRIAS */}
      <Dialog open={isFeriasModalOpen} onOpenChange={setIsFeriasModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Calendar className="w-5 h-5 text-primary" />
              Calcular Férias CLT com Médias de Verbas
            </DialogTitle>
            <DialogDescription>
              Apurador de período aquisitivo, média das horas extras/adicionais variáveis
              (reflexo_ferias_13), abono pecuniário e 1/3 constitucional.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Colaborador CLT *</Label>
                <Select
                  value={feriasForm.funcionarioId}
                  onValueChange={(v) => setFeriasForm((prev) => ({ ...prev, funcionarioId: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o colaborador" />
                  </SelectTrigger>
                  <SelectContent>
                    {funcionarios.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome_completo} ({f.cargo} - R${' '}
                        {f.salario?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Competência Folha *</Label>
                <Input
                  className="mt-1"
                  value={feriasForm.competencia}
                  onChange={(e) =>
                    setFeriasForm((prev) => ({ ...prev, competencia: e.target.value }))
                  }
                  placeholder="MM/AAAA"
                />
              </div>
            </div>

            {/* Período Aquisitivo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-muted/30 rounded-md border border-border/60">
              <div>
                <Label className="text-xs font-semibold">Início Período Aquisitivo</Label>
                <Input
                  type="date"
                  className="mt-1 h-9"
                  value={feriasForm.dtInicioAquisitivo}
                  onChange={(e) =>
                    setFeriasForm((prev) => ({ ...prev, dtInicioAquisitivo: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Fim Período Aquisitivo</Label>
                <Input
                  type="date"
                  className="mt-1 h-9"
                  value={feriasForm.dtFimAquisitivo}
                  onChange={(e) =>
                    setFeriasForm((prev) => ({ ...prev, dtFimAquisitivo: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Período de Gozo e Abono */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs">Data Início Gozo</Label>
                <Input
                  type="date"
                  className="mt-1 h-9"
                  value={feriasForm.dtInicioGozo}
                  onChange={(e) =>
                    setFeriasForm((prev) => ({ ...prev, dtInicioGozo: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Data Fim Gozo</Label>
                <Input
                  type="date"
                  className="mt-1 h-9"
                  value={feriasForm.dtFimGozo}
                  onChange={(e) =>
                    setFeriasForm((prev) => ({ ...prev, dtFimGozo: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Dias de Gozo (10 a 30)</Label>
                <Input
                  type="number"
                  className="mt-1 h-9"
                  min={10}
                  max={30}
                  value={feriasForm.diasGozo}
                  onChange={(e) =>
                    setFeriasForm((prev) => ({ ...prev, diasGozo: parseInt(e.target.value) || 0 }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Dias Abono (Venda máx 10)</Label>
                <Input
                  type="number"
                  className="mt-1 h-9"
                  disabled={!feriasForm.venderAbono}
                  min={1}
                  max={10}
                  value={feriasForm.diasAbono}
                  onChange={(e) =>
                    setFeriasForm((prev) => ({ ...prev, diasAbono: parseInt(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg bg-background">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">
                  Vender 1/3 em Abono Pecuniário (CLT Art. 143)
                </Label>
                <p className="text-xs text-muted-foreground">
                  O abono pecuniário e seu respectivo 1/3 são totalmente isentos de retenção de INSS
                  e IRRF.
                </p>
              </div>
              <Switch
                checked={feriasForm.venderAbono}
                onCheckedChange={(checked) =>
                  setFeriasForm((prev) => ({ ...prev, venderAbono: checked }))
                }
              />
            </div>

            {/* Mapa de Médias Apuradas */}
            <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-md text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-blue-900 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                  Mapa das Médias de Verbas Variáveis (reflexo_ferias_13)
                </span>
                <span className="font-mono text-blue-700 font-bold">
                  Média Mensal: R$ {previewMedias.media.toFixed(2)}
                </span>
              </div>
              {previewMedias.itens.length === 0 ? (
                <p className="text-muted-foreground italic">
                  Nenhum lançamento de verba variável encontrado nos últimos 12 meses. O cálculo
                  usará o salário contratual base.
                </p>
              ) : (
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {previewMedias.itens.map((it, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between font-mono text-[11px] text-blue-800"
                    >
                      <span>
                        {it.competencia} — {it.verba} {it.codigo ? `(${it.codigo})` : ''}
                      </span>
                      <span>R$ {it.valor.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Simulação em Tempo Real */}
            {previewCalcFerias && (
              <div className="p-4 bg-muted/60 rounded-lg border border-border space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Demonstrativo em Tempo Real
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    Remuneração Base: R${' '}
                    {previewCalcFerias.remuneracaoBase.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">
                      Férias Gozo ({previewCalcFerias.diasGozo}d):
                    </span>
                    <p className="font-medium">R$ {previewCalcFerias.valorFeriasGozo.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">1/3 Constitucional:</span>
                    <p className="font-medium">
                      R$ {previewCalcFerias.tercoConstitucionalFerias.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Abono Pecuniário:</span>
                    <p className="font-medium text-primary">
                      R$ {previewCalcFerias.valorAbonoPecuniario.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">1/3 Abono (Isento):</span>
                    <p className="font-medium text-primary">
                      R$ {previewCalcFerias.tercoConstitucionalAbono.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-2 border-t">
                  <div>
                    <span className="text-muted-foreground">INSS Retido:</span>
                    <p className="font-semibold text-rose-600">
                      - R$ {previewCalcFerias.inss.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">IRRF Retido:</span>
                    <p className="font-semibold text-rose-600">
                      - R$ {previewCalcFerias.irrf.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground font-semibold">Valor Líquido:</span>
                    <p className="text-base font-bold text-emerald-600">
                      R${' '}
                      {previewCalcFerias.totalLiquido.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFeriasModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarFerias} disabled={loading || !selectedFuncFerias}>
              {loading ? 'Calculando...' : 'Gravar Férias'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: CÁLCULO DE 13º SALÁRIO */}
      <Dialog open={isDecimoModalOpen} onOpenChange={setIsDecimoModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5 text-primary" />
              Calcular 13º Salário CLT com Médias
            </DialogTitle>
            <DialogDescription>
              Apuração de avos trabalhados (mês com &gt; 14 dias conta avo inteiro - CLT art. 146),
              médias variáveis e guia DCTFWeb código 2172.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Colaborador CLT *</Label>
                <Select
                  value={decimoForm.funcionarioId}
                  onValueChange={(v) => setDecimoForm((prev) => ({ ...prev, funcionarioId: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o colaborador" />
                  </SelectTrigger>
                  <SelectContent>
                    {funcionarios.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome_completo} ({f.cargo} - R${' '}
                        {f.salario?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Parcela a Calcular *</Label>
                <Select
                  value={decimoForm.parcela}
                  onValueChange={(v: any) => setDecimoForm((prev) => ({ ...prev, parcela: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primeira_parcela">
                      1ª Parcela (Adiantamento 50% sem descontos)
                    </SelectItem>
                    <SelectItem value="segunda_parcela">
                      2ª Parcela (Quitação com INSS/IRRF tributação exclusiva)
                    </SelectItem>
                    <SelectItem value="parcela_unica">Parcela Única / Integral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">Ano Referência</Label>
                <Input
                  type="number"
                  className="mt-1 h-9"
                  value={decimoForm.ano}
                  onChange={(e) =>
                    setDecimoForm((prev) => ({ ...prev, ano: parseInt(e.target.value) || 2026 }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Competência</Label>
                <Input
                  className="mt-1 h-9"
                  value={decimoForm.competencia}
                  onChange={(e) =>
                    setDecimoForm((prev) => ({ ...prev, competencia: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Avos Trabalhados (1 a 12)</Label>
                <Input
                  type="number"
                  className="mt-1 h-9"
                  min={1}
                  max={12}
                  value={decimoForm.mesesTrabalhados}
                  onChange={(e) =>
                    setDecimoForm((prev) => ({
                      ...prev,
                      mesesTrabalhados: parseInt(e.target.value) || 12,
                    }))
                  }
                />
              </div>
            </div>

            {/* Salário-Maternidade */}
            <div className="p-3 border rounded-lg bg-muted/20">
              <Label className="text-xs font-semibold">
                Salário-Maternidade no Período (Meses)
              </Label>
              <p className="text-[11px] text-muted-foreground mb-1">
                A fração correspondente aos meses de salário-maternidade é de responsabilidade da
                Previdência e dedutível na DCTFWeb.
              </p>
              <Input
                type="number"
                className="h-8 max-w-[120px]"
                min={0}
                max={6}
                value={decimoForm.salarioMaternidadeMeses}
                onChange={(e) =>
                  setDecimoForm((prev) => ({
                    ...prev,
                    salarioMaternidadeMeses: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </div>

            {/* Simulação em Tempo Real 13º */}
            {previewCalcDecimo && (
              <div className="p-4 bg-muted/60 rounded-lg border border-border space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Simulação da Parcela ({previewCalcDecimo.mesesTrabalhados}/12 avos)
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    Remuneração Base: R${' '}
                    {previewCalcDecimo.remuneracaoBase.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Valor Bruto Parcela:</span>
                    <p className="font-semibold text-foreground">
                      R$ {previewCalcDecimo.valorBrutoParcela.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">INSS Retido:</span>
                    <p className="font-semibold text-rose-600">
                      {decimoForm.parcela === 'primeira_parcela'
                        ? 'Isento (1ª Parcela)'
                        : `- R$ ${previewCalcDecimo.inss.toFixed(2)}`}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">IRRF Retido:</span>
                    <p className="font-semibold text-rose-600">
                      {decimoForm.parcela === 'primeira_parcela'
                        ? 'Isento (1ª Parcela)'
                        : `- R$ ${previewCalcDecimo.irrf.toFixed(2)}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t text-xs">
                  <span className="font-medium text-muted-foreground">
                    Líquido da Parcela a Pagar:
                  </span>
                  <span className="text-base font-bold text-emerald-600">
                    R${' '}
                    {previewCalcDecimo.totalLiquido.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDecimoModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarDecimo} disabled={loading || !selectedFuncDecimo}>
              {loading ? 'Calculando...' : 'Gravar 13º Salário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: RECIBO / DEMONSTRATIVO IMPRIMÍVEL */}
      <Dialog open={isDetalheModalOpen} onOpenChange={setIsDetalheModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-base">
              <span>Recibo e Demonstrativo de Cálculo CLT</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.print()}
                className="print:hidden"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
            </DialogTitle>
          </DialogHeader>

          {detalheItem && (
            <div className="p-6 border rounded-lg bg-card text-foreground font-sans space-y-6 text-sm">
              <div className="flex justify-between items-start border-b pb-4">
                <div>
                  <h3 className="font-bold text-lg">
                    {detalheItem.expand?.empresa?.razao_social || 'Empresa'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    CNPJ: {detalheItem.expand?.empresa?.cnpj || 'N/A'}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="text-xs font-mono">
                    Competência: {detalheItem.competencia}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {'parcela' in detalheItem
                      ? 'Demonstrativo de 13º Salário'
                      : 'Recibo de Férias e Abono'}
                  </p>
                </div>
              </div>

              {/* Dados do Colaborador */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-3 bg-muted/20 rounded">
                <div>
                  <span className="text-xs text-muted-foreground">Colaborador</span>
                  <p className="font-semibold">{detalheItem.expand?.funcionario?.nome_completo}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">CPF</span>
                  <p className="font-mono text-xs">{detalheItem.expand?.funcionario?.cpf}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Cargo</span>
                  <p>{detalheItem.expand?.funcionario?.cargo || 'CLT'}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Salário Contratual</span>
                  <p className="font-semibold">
                    R${' '}
                    {detalheItem.salario_base.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Tabela de Verbas e Descontos */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição da Rubrica</TableHead>
                    <TableHead className="text-right">Proventos (R$)</TableHead>
                    <TableHead className="text-right">Descontos (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {'parcela' in detalheItem ? (
                    <>
                      <TableRow>
                        <TableCell>
                          13º Salário - Valor Bruto Parcela ({detalheItem.meses_trabalhados}/12
                          avos)
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {detalheItem.valor_bruto.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-right">-</TableCell>
                      </TableRow>
                      {detalheItem.adiantamento_pago ? (
                        <TableRow>
                          <TableCell>Desconto Adiantamento 1ª Parcela</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right text-rose-600">
                            {detalheItem.adiantamento_pago.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                        </TableRow>
                      ) : null}
                      {detalheItem.inss ? (
                        <TableRow>
                          <TableCell>INSS Previdência Social (Tributação Exclusiva 13º)</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right text-rose-600">
                            {detalheItem.inss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ) : null}
                      {detalheItem.irrf ? (
                        <TableRow>
                          <TableCell>IRRF Retido Fonte 13º (Código 0561)</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right text-rose-600">
                            {detalheItem.irrf.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <TableRow>
                        <TableCell>Férias Gozo ({detalheItem.dias_gozo} dias)</TableCell>
                        <TableCell className="text-right font-medium">
                          {detalheItem.valor_ferias_gozo.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-right">-</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>1/3 Constitucional sobre Férias Gozo</TableCell>
                        <TableCell className="text-right font-medium">
                          {detalheItem.terco_constitucional_ferias.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-right">-</TableCell>
                      </TableRow>
                      {detalheItem.valor_abono_pecuniario ? (
                        <TableRow>
                          <TableCell>
                            Abono Pecuniário (Venda 1/3 legal - {detalheItem.dias_abono} dias)
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {detalheItem.valor_abono_pecuniario.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-right">-</TableCell>
                        </TableRow>
                      ) : null}
                      {detalheItem.terco_constitucional_abono ? (
                        <TableRow>
                          <TableCell>1/3 Constitucional sobre Abono Pecuniário (Isento)</TableCell>
                          <TableCell className="text-right font-medium">
                            {detalheItem.terco_constitucional_abono.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-right">-</TableCell>
                        </TableRow>
                      ) : null}
                      {detalheItem.inss ? (
                        <TableRow>
                          <TableCell>INSS Previdência Social</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right text-rose-600">
                            {detalheItem.inss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ) : null}
                      {detalheItem.irrf ? (
                        <TableRow>
                          <TableCell>IRRF Retido na Fonte</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right text-rose-600">
                            {detalheItem.irrf.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </>
                  )}
                </TableBody>
              </Table>

              {/* Totais */}
              <div className="flex justify-between items-center p-4 bg-muted/30 rounded-lg border">
                <div>
                  <span className="text-xs text-muted-foreground uppercase">
                    Status do Documento
                  </span>
                  <p className="font-semibold text-foreground">
                    {detalheItem.status === 'pago'
                      ? 'Quitado & Integrado à DCTFWeb'
                      : 'Aguardando Pagamento Bancário'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground font-semibold">
                    Valor Líquido a Pagar
                  </span>
                  <p className="text-xl font-bold text-emerald-600">
                    R${' '}
                    {detalheItem.total_liquido.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>

              {/* Assinatura */}
              <div className="pt-10 flex justify-between text-xs text-center border-t border-dashed">
                <div className="w-56 border-t pt-1">
                  <span>Assinatura do Empregador</span>
                </div>
                <div className="w-56 border-t pt-1">
                  <span>Assinatura do Empregado</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

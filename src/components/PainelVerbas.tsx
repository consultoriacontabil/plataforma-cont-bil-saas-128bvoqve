import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Coins,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Clock,
  Trash2,
  Edit,
  Building2,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  RefreshCw,
  Calculator,
} from 'lucide-react'
import {
  verbasService,
  type CreateVerbaCatalogoInput,
  type CreateVerbaLancamentoInput,
} from '@/services/verbas'
import { dpService } from '@/services/dp'
import { validarLancamentoClt } from '@/lib/calculoClt'
import type {
  Empresa,
  Funcionario,
  VerbaCatalogoRecord,
  VerbaLancamentoRecord,
  VerbaTipo,
  VerbaUnidade,
  AlertaConformidadeClt,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { formatDatePtBr } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface PainelVerbasProps {
  tenantId: string
  userId: string
  canManage: boolean
  empresas: Empresa[]
  selectedEmpresaId: string
  onSelectEmpresaId: (id: string) => void
  selectedCompetencia: string
  onSelectCompetencia: (comp: string) => void
  onFolhaRecalculated?: () => void
}

export function PainelVerbas({
  tenantId,
  userId,
  canManage,
  empresas,
  selectedEmpresaId,
  onSelectEmpresaId,
  selectedCompetencia,
  onSelectCompetencia,
  onFolhaRecalculated,
}: PainelVerbasProps) {
  const { toast } = useToast()

  const [subTab, setSubTab] = useState<'lancamentos' | 'catalogo'>('lancamentos')
  const [loading, setLoading] = useState(false)

  // Dados
  const [catalogo, setCatalogo] = useState<VerbaCatalogoRecord[]>([])
  const [lancamentos, setLancamentos] = useState<VerbaLancamentoRecord[]>([])
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])

  // Filtros
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [filtroFuncionario, setFiltroFuncionario] = useState<string>('todos')

  // Modais
  const [modalLancamentoOpen, setModalLancamentoOpen] = useState(false)
  const [editingLancamento, setEditingLancamento] = useState<VerbaLancamentoRecord | null>(null)

  const [modalVerbaOpen, setModalVerbaOpen] = useState(false)
  const [editingVerba, setEditingVerba] = useState<VerbaCatalogoRecord | null>(null)

  // Form Lançamento
  const [formLancEmpresa, setFormLancEmpresa] = useState('')
  const [formLancFunc, setFormLancFunc] = useState('')
  const [formLancVerba, setFormLancVerba] = useState('')
  const [formLancComp, setFormLancComp] = useState('')
  const [formLancQtd, setFormLancQtd] = useState('1')
  const [formLancAliq, setFormLancAliq] = useState('')
  const [formLancValor, setFormLancValor] = useState('')
  const [formLancRef, setFormLancRef] = useState('')
  const [formLancAlertas, setFormLancAlertas] = useState<AlertaConformidadeClt[]>([])
  const [savingLanc, setSavingLanc] = useState(false)

  // Form Catálogo
  const [formVerbaEmpresa, setFormVerbaEmpresa] = useState('')
  const [formVerbaCodigo, setFormVerbaCodigo] = useState('')
  const [formVerbaDescricao, setFormVerbaDescricao] = useState('')
  const [formVerbaTipo, setFormVerbaTipo] = useState<VerbaTipo>('provento')
  const [formVerbaRubrica, setFormVerbaRubrica] = useState('1000')
  const [formVerbaUnidade, setFormVerbaUnidade] = useState<VerbaUnidade>('horas')
  const [formVerbaValorPadrao, setFormVerbaValorPadrao] = useState('0')
  const [formVerbaIncideInss, setFormVerbaIncideInss] = useState(true)
  const [formVerbaIncideIrrf, setFormVerbaIncideIrrf] = useState(true)
  const [formVerbaIncideFgts, setFormVerbaIncideFgts] = useState(true)
  const [formVerbaIntegraSalContrib, setFormVerbaIntegraSalContrib] = useState(true)
  const [formVerbaReflexoDsr, setFormVerbaReflexoDsr] = useState(false)
  const [formVerbaReflexoFerias13, setFormVerbaReflexoFerias13] = useState(true)
  const [formVerbaObservacoes, setFormVerbaObservacoes] = useState('')
  const [savingVerba, setSavingVerba] = useState(false)

  // Carregar dados
  const loadData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const [catList, lancList, funcsList] = await Promise.all([
        verbasService.listCatalogo(tenantId, selectedEmpresaId),
        verbasService.listLancamentos(tenantId, {
          empresaId: selectedEmpresaId,
          funcionarioId: filtroFuncionario,
          competencia: selectedCompetencia,
        }),
        dpService.listFuncionarios(tenantId, {
          empresaId: selectedEmpresaId,
          status: 'todos',
        }),
      ])
      setCatalogo(catList)
      setLancamentos(lancList)
      setFuncionarios(funcsList)
    } catch (err) {
      console.error('Erro ao carregar verbas:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar verbas',
        description: 'Não foi possível carregar os eventos e lançamentos salariais.',
      })
    } finally {
      setLoading(false)
    }
  }, [tenantId, selectedEmpresaId, filtroFuncionario, selectedCompetencia, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Lançamentos filtrados
  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter((l) => {
      const vDesc = l.expand?.verba?.descricao || ''
      const fNome = l.expand?.funcionario?.nome_completo || ''
      const matchBusca =
        !busca.trim() ||
        vDesc.toLowerCase().includes(busca.toLowerCase()) ||
        fNome.toLowerCase().includes(busca.toLowerCase()) ||
        (l.referencia_detalhe || '').toLowerCase().includes(busca.toLowerCase())
      const matchTipo =
        filtroTipo === 'todos' || (l.expand?.verba && l.expand.verba.tipo === filtroTipo)
      return matchBusca && matchTipo
    })
  }, [lancamentos, busca, filtroTipo])

  // Totalizadores de proventos e descontos variáveis
  const totalizadores = useMemo(() => {
    let proventos = 0
    let descontos = 0
    let alertasContagem = 0

    lancamentosFiltrados.forEach((l) => {
      const isProv = l.expand?.verba ? l.expand.verba.tipo === 'provento' : l.valor_calculado > 0
      if (isProv) {
        proventos += l.valor_calculado || 0
      } else {
        descontos += l.valor_calculado || 0
      }
      if (l.alertas_clt && Array.isArray(l.alertas_clt) && l.alertas_clt.length > 0) {
        alertasContagem += l.alertas_clt.length
      }
    })

    return { proventos, descontos, alertasContagem, saldoVariavel: proventos - descontos }
  }, [lancamentosFiltrados])

  // Recalcular simulação ao mudar quantidade, alíquota ou verba no formulário de lançamento
  const handleAutoCalcValor = (
    verbaId: string,
    funcId: string,
    qtdStr: string,
    aliqStr: string,
  ) => {
    const v = catalogo.find((item) => item.id === verbaId)
    const f = funcionarios.find((item) => item.id === funcId)
    const qtd = parseFloat(qtdStr) || 0
    const aliq = parseFloat(aliqStr)

    if (!v || !f) return

    const sal = f.salario || 0
    const valorHora = sal / 220
    const valorDia = sal / 30

    let calc = 0

    if (v.codigo === '1020') {
      // Hora Extra 50%
      const perc = !isNaN(aliq) && aliq > 0 ? aliq : 50
      calc = qtd * valorHora * (1 + perc / 100)
    } else if (v.codigo === '1021') {
      // Hora Extra 100%
      const perc = !isNaN(aliq) && aliq > 0 ? aliq : 100
      calc = qtd * valorHora * (1 + perc / 100)
    } else if (v.codigo === '1030') {
      // Adicional Noturno 20%
      const perc = !isNaN(aliq) && aliq > 0 ? aliq : 20
      calc = qtd * valorHora * (perc / 100)
    } else if (v.codigo === '9001') {
      // Desconto VT
      const perc = !isNaN(aliq) && aliq > 0 ? aliq : 6
      calc = Math.min(sal * (perc / 100), sal * 0.06)
    } else if (v.codigo === '9003') {
      // Falta
      calc = qtd * valorDia
    } else if (v.unidade === 'horas') {
      calc = qtd * valorHora
    } else if (v.unidade === 'dias') {
      calc = qtd * valorDia
    } else if (v.unidade === 'percentual' && !isNaN(aliq)) {
      calc = sal * (aliq / 100)
    } else if (v.valor_padrao && v.valor_padrao > 0 && qtd > 0) {
      calc = qtd * v.valor_padrao
    }

    if (calc > 0) {
      setFormLancValor(calc.toFixed(2))
    }

    // Validar regras CLT
    const { alertas } = validarLancamentoClt({
      verba: v,
      salarioBase: sal,
      quantidade: qtd,
      aliquotaPercentual: !isNaN(aliq) ? aliq : undefined,
      valorCalculado: calc > 0 ? Number(calc.toFixed(2)) : parseFloat(formLancValor) || 0,
    })
    setFormLancAlertas(alertas)
  }

  // Abrir Modal de Lançamento
  const handleOpenLancamentoModal = (item?: VerbaLancamentoRecord) => {
    const empId = selectedEmpresaId !== 'todas' ? selectedEmpresaId : empresas[0]?.id || ''
    if (item) {
      setEditingLancamento(item)
      setFormLancEmpresa(item.empresa)
      setFormLancFunc(item.funcionario)
      setFormLancVerba(item.verba)
      setFormLancComp(item.competencia)
      setFormLancQtd(String(item.quantidade ?? 1))
      setFormLancAliq(item.aliquota_percentual ? String(item.aliquota_percentual) : '')
      setFormLancValor(String(item.valor_calculado))
      setFormLancRef(item.referencia_detalhe || '')
      setFormLancAlertas(item.alertas_clt || [])
    } else {
      setEditingLancamento(null)
      setFormLancEmpresa(empId)
      setFormLancFunc(funcionarios[0]?.id || '')
      setFormLancVerba(catalogo[0]?.id || '')
      setFormLancComp(selectedCompetencia)
      setFormLancQtd('1')
      setFormLancAliq(catalogo[0]?.valor_padrao ? String(catalogo[0].valor_padrao) : '')
      setFormLancValor('')
      setFormLancRef('')
      setFormLancAlertas([])

      if (catalogo[0] && funcionarios[0]) {
        handleAutoCalcValor(
          catalogo[0].id,
          funcionarios[0].id,
          '1',
          String(catalogo[0].valor_padrao || ''),
        )
      }
    }
    setModalLancamentoOpen(true)
  }

  // Salvar Lançamento
  const handleSaveLancamento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId || !formLancEmpresa || !formLancFunc || !formLancVerba) {
      toast({
        variant: 'destructive',
        title: 'Dados incompletos',
        description: 'Selecione empresa, colaborador e verba.',
      })
      return
    }

    const valorNum = parseFloat(formLancValor.replace(',', '.'))
    if (isNaN(valorNum) || valorNum <= 0) {
      toast({
        variant: 'destructive',
        title: 'Valor inválido',
        description: 'Informe um valor maior que zero.',
      })
      return
    }

    setSavingLanc(true)
    try {
      const payload: CreateVerbaLancamentoInput = {
        tenant_id: tenantId,
        empresa: formLancEmpresa,
        funcionario: formLancFunc,
        verba: formLancVerba,
        competencia: formLancComp || selectedCompetencia,
        quantidade: parseFloat(formLancQtd) || 1,
        aliquota_percentual: parseFloat(formLancAliq) || undefined,
        valor_calculado: valorNum,
        referencia_detalhe: formLancRef.trim() || undefined,
      }

      if (editingLancamento) {
        await verbasService.updateLancamento(editingLancamento.id, payload, userId)
        toast({
          title: 'Lançamento atualizado',
          description: 'A verba foi recalculada com sucesso.',
        })
      } else {
        await verbasService.createLancamento(payload, userId)
        toast({
          title: 'Verba lançada com sucesso!',
          description: 'O lançamento foi vinculado ao colaborador na competência.',
        })
      }

      // Recalcular automaticamente a folha do colaborador para refletir o novo cálculo CLT
      try {
        await dpService.recalcularFolhaFuncionario(
          tenantId,
          formLancEmpresa,
          formLancFunc,
          formLancComp || selectedCompetencia,
        )
        if (onFolhaRecalculated) onFolhaRecalculated()
      } catch (errRecalc) {
        console.warn('Erro ao recalcular folha após salvar verba:', errRecalc)
      }

      setModalLancamentoOpen(false)
      loadData()
    } catch (err) {
      console.error('Erro ao salvar lançamento:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Não foi possível gravar o lançamento.',
      })
    } finally {
      setSavingLanc(false)
    }
  }

  // Deletar Lançamento
  const handleDeleteLancamento = async (id: string) => {
    if (!window.confirm('Deseja excluir este lançamento de verba?')) return
    try {
      const item = lancamentos.find((l) => l.id === id)
      await verbasService.deleteLancamento(id, userId)
      toast({ title: 'Lançamento excluído com sucesso.' })

      if (item) {
        try {
          await dpService.recalcularFolhaFuncionario(
            tenantId,
            item.empresa,
            item.funcionario,
            item.competencia,
          )
          if (onFolhaRecalculated) onFolhaRecalculated()
        } catch {
          /* intentionally ignored */
        }
      }

      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o lançamento.',
      })
    }
  }

  // Abrir Modal de Catálogo
  const handleOpenVerbaModal = (v?: VerbaCatalogoRecord) => {
    const empId = selectedEmpresaId !== 'todas' ? selectedEmpresaId : empresas[0]?.id || ''
    if (v) {
      setEditingVerba(v)
      setFormVerbaEmpresa(v.empresa)
      setFormVerbaCodigo(v.codigo)
      setFormVerbaDescricao(v.descricao)
      setFormVerbaTipo(v.tipo)
      setFormVerbaRubrica(v.rubrica_esocial)
      setFormVerbaUnidade(v.unidade)
      setFormVerbaValorPadrao(v.valor_padrao ? String(v.valor_padrao) : '0')
      setFormVerbaIncideInss(v.incide_inss)
      setFormVerbaIncideIrrf(v.incide_irrf)
      setFormVerbaIncideFgts(v.incide_fgts)
      setFormVerbaIntegraSalContrib(v.integra_salario_contrib)
      setFormVerbaReflexoDsr(v.reflexo_dsr)
      setFormVerbaReflexoFerias13(v.reflexo_ferias_13)
      setFormVerbaObservacoes(v.observacoes || '')
    } else {
      setEditingVerba(null)
      setFormVerbaEmpresa(empId)
      setFormVerbaCodigo('')
      setFormVerbaDescricao('')
      setFormVerbaTipo('provento')
      setFormVerbaRubrica('1000')
      setFormVerbaUnidade('horas')
      setFormVerbaValorPadrao('50')
      setFormVerbaIncideInss(true)
      setFormVerbaIncideIrrf(true)
      setFormVerbaIncideFgts(true)
      setFormVerbaIntegraSalContrib(true)
      setFormVerbaReflexoDsr(true)
      setFormVerbaReflexoFerias13(true)
      setFormVerbaObservacoes('')
    }
    setModalVerbaOpen(true)
  }

  // Salvar Verba no Catálogo
  const handleSaveVerba = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId || !formVerbaCodigo.trim() || !formVerbaDescricao.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Informe o código e a descrição da verba.',
      })
      return
    }

    setSavingVerba(true)
    try {
      const payload: CreateVerbaCatalogoInput = {
        tenant_id: tenantId,
        empresa: formVerbaEmpresa || empresas[0]?.id || '',
        codigo: formVerbaCodigo.trim(),
        descricao: formVerbaDescricao.trim(),
        tipo: formVerbaTipo,
        rubrica_esocial: formVerbaRubrica,
        unidade: formVerbaUnidade,
        valor_padrao: parseFloat(formVerbaValorPadrao) || 0,
        incide_inss: formVerbaIncideInss,
        incide_irrf: formVerbaIncideIrrf,
        incide_fgts: formVerbaIncideFgts,
        integra_salario_contrib: formVerbaIntegraSalContrib,
        reflexo_dsr: formVerbaReflexoDsr,
        reflexo_ferias_13: formVerbaReflexoFerias13,
        observacoes: formVerbaObservacoes.trim() || undefined,
        ativo: true,
      }

      if (editingVerba) {
        await verbasService.updateVerbaCatalogo(editingVerba.id, payload, userId)
        toast({
          title: 'Verba atualizada',
          description: `${formVerbaDescricao} salva no catálogo.`,
        })
      } else {
        await verbasService.createVerbaCatalogo(payload, userId)
        toast({
          title: 'Verba cadastrada!',
          description: 'Novo evento disponível para lançamento em folha.',
        })
      }

      setModalVerbaOpen(false)
      loadData()
    } catch (err) {
      console.error('Erro ao salvar verba:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Não foi possível cadastrar a verba no catálogo.',
      })
    } finally {
      setSavingVerba(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Barra de Filtros e Sub-abas */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-3 rounded-2xl border border-[#E2E8F0] shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            value={subTab}
            onValueChange={(v) => setSubTab(v as typeof subTab)}
            className="w-auto"
          >
            <TabsList className="bg-slate-100 p-1 rounded-xl h-9">
              <TabsTrigger value="lancamentos" className="gap-1.5 text-xs font-semibold rounded-lg">
                <Calculator className="h-3.5 w-3.5 text-[#0FA3A3]" />
                <span>Lançamentos do Mês ({lancamentos.length})</span>
              </TabsTrigger>
              <TabsTrigger value="catalogo" className="gap-1.5 text-xs font-semibold rounded-lg">
                <Layers className="h-3.5 w-3.5 text-indigo-600" />
                <span>Catálogo de Verbas ({catalogo.length})</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {subTab === 'lancamentos' && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#64748B]" />
              <Select value={selectedCompetencia} onValueChange={onSelectCompetencia}>
                <SelectTrigger className="w-32 h-8 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Competência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="08/2026">08/2026</SelectItem>
                  <SelectItem value="09/2026">09/2026</SelectItem>
                  <SelectItem value="10/2026">10/2026</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="relative w-48 sm:w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8]" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar verba ou colaborador..."
              className="pl-8 h-8 text-xs rounded-xl border-[#E2E8F0]"
            />
          </div>

          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-32 h-8 text-xs rounded-xl border-[#E2E8F0]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Tipos</SelectItem>
              <SelectItem value="provento">Proventos (+)</SelectItem>
              <SelectItem value="desconto">Descontos (-)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            {subTab === 'lancamentos' ? (
              <Button
                onClick={() => handleOpenLancamentoModal()}
                className="gap-1.5 rounded-xl text-xs font-semibold h-8 bg-[#0FA3A3] text-white hover:bg-[#0C8585]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Lançar Verba / Desconto</span>
              </Button>
            ) : (
              <Button
                onClick={() => handleOpenVerbaModal()}
                className="gap-1.5 rounded-xl text-xs font-semibold h-8 bg-indigo-600 text-white hover:bg-indigo-700"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Nova Verba no Catálogo</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Cards de Resumo */}
      {subTab === 'lancamentos' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Proventos Adicionais
                </p>
                <p className="text-xl font-bold text-emerald-600 mt-1">
                  + R${' '}
                  {totalizadores.proventos.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <ArrowUpRight className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Descontos em Folha
                </p>
                <p className="text-xl font-bold text-rose-600 mt-1">
                  - R${' '}
                  {totalizadores.descontos.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                <ArrowDownRight className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Saldo Variável Total
                </p>
                <p
                  className={cn(
                    'text-xl font-bold mt-1',
                    totalizadores.saldoVariavel >= 0 ? 'text-[#1A2333]' : 'text-rose-600',
                  )}
                >
                  R${' '}
                  {totalizadores.saldoVariavel.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-[#64748B]">
                <Coins className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Conformidade CLT
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {totalizadores.alertasContagem === 0 ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      100% Conforme
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-xs gap-1">
                      <AlertTriangle className="h-3 w-3 text-amber-600" />
                      {totalizadores.alertasContagem} alertas ativos
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CONTEÚDO SUB-ABA 1: LANÇAMENTOS DO MÊS */}
      {subTab === 'lancamentos' && (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[#64748B] font-semibold border-b border-[#E2E8F0]">
                <tr>
                  <th className="py-3 px-4">Colaborador</th>
                  <th className="py-3 px-4">Verba / Rubrica e-Social</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Qtd / Alíquota</th>
                  <th className="py-3 px-4">Valor Calculado</th>
                  <th className="py-3 px-4">Validações Legais CLT</th>
                  {canManage && <th className="py-3 px-4 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[#1A2333]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#94A3B8]">
                      Carregando lançamentos de verbas...
                    </td>
                  </tr>
                ) : lancamentosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#94A3B8]">
                      Nenhuma verba lançada para {selectedCompetencia}. Clique em &quot;Lançar Verba
                      / Desconto&quot; acima.
                    </td>
                  </tr>
                ) : (
                  lancamentosFiltrados.map((item) => {
                    const v = item.expand?.verba
                    const f = item.expand?.funcionario
                    const isProv = v ? v.tipo === 'provento' : item.valor_calculado > 0
                    const hasAlertas = item.alertas_clt && item.alertas_clt.length > 0

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-semibold text-[#1A2333]">
                          {f?.nome_completo || 'Colaborador'}
                          <p className="text-[11px] font-normal text-[#64748B]">
                            {f?.cargo || 'Cargo'} • Salário: R$ {(f?.salario || 0).toFixed(2)}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-[#1A2333]">{v?.descricao || 'Verba'}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[10px] text-[#64748B] bg-slate-100 px-1.5 py-0.5 rounded">
                              Cód: {v?.codigo || '—'}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] text-sky-700 bg-sky-50 border-sky-200"
                            >
                              e-Social: {v?.rubrica_esocial || '1000'}
                            </Badge>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {isProv ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                              Provento (+)
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]">
                              Desconto (-)
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-[#475569]">
                          {item.quantidade ? `${item.quantidade} ${v?.unidade || 'un'}` : '—'}
                          {item.aliquota_percentual ? ` (${item.aliquota_percentual}%)` : ''}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">
                          <span className={isProv ? 'text-emerald-700' : 'text-rose-700'}>
                            {isProv ? '+ ' : '- '} R$ {item.valor_calculado.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {hasAlertas ? (
                            <div className="space-y-1">
                              {item.alertas_clt?.map((al, idx) => (
                                <div
                                  key={idx}
                                  className={cn(
                                    'flex items-start gap-1 p-1 rounded text-[11px]',
                                    al.tipo === 'infracao'
                                      ? 'bg-amber-50 text-amber-900 border border-amber-200'
                                      : 'bg-blue-50 text-blue-900 border border-blue-200',
                                  )}
                                  title={al.mensagem}
                                >
                                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-600" />
                                  <div>
                                    <span className="font-semibold">{al.regra}: </span>
                                    <span>{al.mensagem}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>CLT Conforme</span>
                            </Badge>
                          )}
                        </td>
                        {canManage && (
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenLancamentoModal(item)}
                                className="h-7 w-7 p-0 text-[#64748B] hover:text-[#0FA3A3]"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteLancamento(item.id)}
                                className="h-7 w-7 p-0 text-[#64748B] hover:text-rose-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTEÚDO SUB-ABA 2: CATÁLOGO DE VERBAS */}
      {subTab === 'catalogo' && (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[#64748B] font-semibold border-b border-[#E2E8F0]">
                <tr>
                  <th className="py-3 px-4">Código / Descrição</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Rubrica e-Social</th>
                  <th className="py-3 px-4">Unidade / Valor Padrão</th>
                  <th className="py-3 px-4">Incidências Legais</th>
                  <th className="py-3 px-4">Reflexos CLT</th>
                  {canManage && <th className="py-3 px-4 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[#1A2333]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#94A3B8]">
                      Carregando catálogo de verbas...
                    </td>
                  </tr>
                ) : catalogo.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#94A3B8]">
                      Nenhuma verba cadastrada no catálogo.
                    </td>
                  </tr>
                ) : (
                  catalogo.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-[#0FA3A3] bg-teal-50 px-1.5 py-0.5 rounded">
                            {v.codigo}
                          </span>
                          <span className="font-semibold text-[#1A2333]">{v.descricao}</span>
                        </div>
                        {v.observacoes && (
                          <p className="text-[11px] text-[#64748B] mt-0.5">{v.observacoes}</p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {v.tipo === 'provento' ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                            Provento (+)
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]">
                            Desconto (-)
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-sky-800">
                        Rubrica {v.rubrica_esocial}
                      </td>
                      <td className="py-3 px-4 text-[#475569]">
                        <span className="capitalize">{v.unidade.replace('_', ' ')}</span>
                        {v.valor_padrao
                          ? ` (Padrão: ${v.valor_padrao}${v.unidade === 'percentual' ? '%' : ''})`
                          : ''}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          <span
                            className={cn(
                              'text-[10px] font-bold px-1 rounded',
                              v.incide_inss
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-400',
                            )}
                          >
                            INSS {v.incide_inss ? '✓' : '✗'}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] font-bold px-1 rounded',
                              v.incide_irrf
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-400',
                            )}
                          >
                            IRRF {v.incide_irrf ? '✓' : '✗'}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] font-bold px-1 rounded',
                              v.incide_fgts
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-slate-100 text-slate-400',
                            )}
                          >
                            FGTS {v.incide_fgts ? '✓' : '✗'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#475569]">
                        <div className="flex items-center gap-1 text-[11px]">
                          {v.reflexo_dsr && (
                            <Badge variant="outline" className="text-[10px] bg-slate-50">
                              DSR
                            </Badge>
                          )}
                          {v.reflexo_ferias_13 && (
                            <Badge variant="outline" className="text-[10px] bg-slate-50">
                              Férias/13º
                            </Badge>
                          )}
                          {!v.reflexo_dsr && !v.reflexo_ferias_13 && (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                      {canManage && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenVerbaModal(v)}
                              className="h-7 w-7 p-0 text-[#64748B] hover:text-[#0FA3A3]"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Lançar Verba por Colaborador */}
      <Dialog open={modalLancamentoOpen} onOpenChange={setModalLancamentoOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingLancamento
                ? 'Editar Lançamento de Verba'
                : 'Lançar Verba Salarial / Desconto'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Lançamento de verba remuneratória ou desconto na folha de pagamento do colaborador
              conforme CLT.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveLancamento} className="space-y-3 py-1 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Empresa</Label>
                <Select
                  value={formLancEmpresa}
                  onValueChange={(val) => {
                    setFormLancEmpresa(val)
                    const funcsDaEmp = funcionarios.filter((f) => f.empresa === val)
                    if (funcsDaEmp.length > 0) setFormLancFunc(funcsDaEmp[0].id)
                  }}
                  required
                >
                  <SelectTrigger className="h-8 rounded-xl border-[#E2E8F0] mt-1 text-xs">
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
                <Label className="text-xs font-semibold">Competência</Label>
                <Input
                  value={formLancComp}
                  onChange={(e) => setFormLancComp(e.target.value)}
                  placeholder="MM/AAAA"
                  required
                  className="h-8 rounded-xl border-[#E2E8F0] mt-1 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Colaborador</Label>
              <Select
                value={formLancFunc}
                onValueChange={(val) => {
                  setFormLancFunc(val)
                  handleAutoCalcValor(formLancVerba, val, formLancQtd, formLancAliq)
                }}
                required
              >
                <SelectTrigger className="h-8 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                  <SelectValue placeholder="Selecione o colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {funcionarios
                    .filter((f) => !formLancEmpresa || f.empresa === formLancEmpresa)
                    .map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome_completo} ({f.cargo} - R$ {f.salario.toFixed(2)})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Verba / Evento (Catálogo)</Label>
              <Select
                value={formLancVerba}
                onValueChange={(val) => {
                  setFormLancVerba(val)
                  const v = catalogo.find((c) => c.id === val)
                  if (v?.valor_padrao) {
                    setFormLancAliq(String(v.valor_padrao))
                  }
                  handleAutoCalcValor(
                    val,
                    formLancFunc,
                    formLancQtd,
                    v?.valor_padrao ? String(v.valor_padrao) : formLancAliq,
                  )
                }}
                required
              >
                <SelectTrigger className="h-8 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                  <SelectValue placeholder="Selecione a verba" />
                </SelectTrigger>
                <SelectContent>
                  {catalogo.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      [{v.codigo}] {v.descricao} ({v.tipo.toUpperCase()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold">Quantidade</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formLancQtd}
                  onChange={(e) => {
                    setFormLancQtd(e.target.value)
                    handleAutoCalcValor(formLancVerba, formLancFunc, e.target.value, formLancAliq)
                  }}
                  placeholder="Ex: 10"
                  className="h-8 rounded-xl border-[#E2E8F0] mt-1 text-xs font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Adicional / Alíquota (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formLancAliq}
                  onChange={(e) => {
                    setFormLancAliq(e.target.value)
                    handleAutoCalcValor(formLancVerba, formLancFunc, formLancQtd, e.target.value)
                  }}
                  placeholder="Ex: 50"
                  className="h-8 rounded-xl border-[#E2E8F0] mt-1 text-xs font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Valor Calculado (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formLancValor}
                  onChange={(e) => setFormLancValor(e.target.value)}
                  placeholder="0.00"
                  required
                  className="h-8 rounded-xl border-[#E2E8F0] mt-1 text-xs font-mono font-bold text-[#0FA3A3]"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Memória de Cálculo / Observação</Label>
              <Input
                value={formLancRef}
                onChange={(e) => setFormLancRef(e.target.value)}
                placeholder="Ex: 10 horas extras a 50% autorizadas pela gerência"
                className="h-8 rounded-xl border-[#E2E8F0] mt-1 text-xs"
              />
            </div>

            {/* Painel de Conformidade CLT ao vivo */}
            {formLancAlertas.length > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-1.5">
                <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span>Alertas de Conformidade CLT</span>
                </div>
                {formLancAlertas.map((a, i) => (
                  <p key={i} className="text-[11px] text-amber-800">
                    • <strong>{a.regra}:</strong> {a.mensagem}{' '}
                    {a.sugestao && <span className="underline italic">({a.sugestao})</span>}
                  </p>
                ))}
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalLancamentoOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingLanc}
                className="rounded-xl text-xs bg-[#0FA3A3] text-white hover:bg-[#0C8585]"
              >
                {savingLanc ? 'Gravando...' : 'Confirmar Lançamento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Cadastro de Verba no Catálogo */}
      <Dialog open={modalVerbaOpen} onOpenChange={setModalVerbaOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingVerba ? 'Editar Verba no Catálogo' : 'Cadastrar Verba no Catálogo'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Definição de rubrica salarial com incidências tributárias e reflexos CLT.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveVerba} className="space-y-3 py-1 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs font-semibold">Código</Label>
                <Input
                  value={formVerbaCodigo}
                  onChange={(e) => setFormVerbaCodigo(e.target.value)}
                  placeholder="Ex: 1020"
                  required
                  className="h-8 rounded-xl border-[#E2E8F0] mt-1 text-xs font-mono font-bold"
                />
              </div>

              <div className="col-span-2">
                <Label className="text-xs font-semibold">Descrição da Verba</Label>
                <Input
                  value={formVerbaDescricao}
                  onChange={(e) => setFormVerbaDescricao(e.target.value)}
                  placeholder="Ex: Horas Extras 50%"
                  required
                  className="h-8 rounded-xl border-[#E2E8F0] mt-1 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs font-semibold">Tipo</Label>
                <Select
                  value={formVerbaTipo}
                  onValueChange={(val) => setFormVerbaTipo(val as VerbaTipo)}
                >
                  <SelectTrigger className="h-8 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="provento">Provento (+)</SelectItem>
                    <SelectItem value="desconto">Desconto (-)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Rubrica e-Social (Tabela 1)</Label>
                <Select value={formVerbaRubrica} onValueChange={setFormVerbaRubrica}>
                  <SelectTrigger className="h-8 rounded-xl border-[#E2E8F0] mt-1 text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1000">1000 - Salário/Vencimento</SelectItem>
                    <SelectItem value="1020">1020 - Horas Extras</SelectItem>
                    <SelectItem value="1040">1040 - DSR Variáveis</SelectItem>
                    <SelectItem value="9901">9901 - INSS / Descontos Gerais</SelectItem>
                    <SelectItem value="9902">9902 - IRRF / Pensão</SelectItem>
                    <SelectItem value="9903">9903 - FGTS</SelectItem>
                    <SelectItem value="9904">9904 - Vale Transporte</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Unidade Base</Label>
                <Select
                  value={formVerbaUnidade}
                  onValueChange={(val) => setFormVerbaUnidade(val as VerbaUnidade)}
                >
                  <SelectTrigger className="h-8 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="horas">Horas</SelectItem>
                    <SelectItem value="dias">Dias</SelectItem>
                    <SelectItem value="percentual">Percentual (%)</SelectItem>
                    <SelectItem value="valor_fixo">Valor Fixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Incidências Legais */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2">
              <Label className="text-xs font-bold text-[#1A2333]">
                Incidências Legais & Tributárias
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex items-center justify-between p-1.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[11px] font-medium">Incide INSS</span>
                  <Switch checked={formVerbaIncideInss} onCheckedChange={setFormVerbaIncideInss} />
                </div>
                <div className="flex items-center justify-between p-1.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[11px] font-medium">Incide IRRF</span>
                  <Switch checked={formVerbaIncideIrrf} onCheckedChange={setFormVerbaIncideIrrf} />
                </div>
                <div className="flex items-center justify-between p-1.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[11px] font-medium">Incide FGTS</span>
                  <Switch checked={formVerbaIncideFgts} onCheckedChange={setFormVerbaIncideFgts} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="flex items-center justify-between p-1.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[11px] font-medium">Reflexo em DSR</span>
                  <Switch checked={formVerbaReflexoDsr} onCheckedChange={setFormVerbaReflexoDsr} />
                </div>
                <div className="flex items-center justify-between p-1.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[11px] font-medium">Reflexo Férias / 13º</span>
                  <Switch
                    checked={formVerbaReflexoFerias13}
                    onCheckedChange={setFormVerbaReflexoFerias13}
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Observações / Base Legal</Label>
              <Textarea
                value={formVerbaObservacoes}
                onChange={(e) => setFormVerbaObservacoes(e.target.value)}
                placeholder="Ex: CLT art. 59, CF art. 7º, XVI. Mínimo legal de 50%."
                className="h-16 text-xs rounded-xl border-[#E2E8F0] resize-none"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalVerbaOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingVerba}
                className="rounded-xl text-xs bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {savingVerba ? 'Gravando...' : 'Salvar no Catálogo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
